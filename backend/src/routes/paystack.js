const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const { pool } = require('../config/db');
const {
  initializeTransaction,
  verifyTransaction
} = require('../services/paystack');

const router = express.Router();

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      success: false,
      message: 'Authentication is not configured.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = Number(decoded.sub);

    if (!Number.isSafeInteger(userId) || userId < 1) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token.'
      });
    }

    req.userId = userId;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token.'
    });
  }
}

// POST /api/paystack/initialize
router.post('/initialize', authenticateToken, async (req, res) => {
  let connection;

  try {
    const amountNaira = Number(req.body.amount);

    if (
      !Number.isFinite(amountNaira) ||
      amountNaira < 100 ||
      amountNaira > 1000000
    ) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be between ₦100 and ₦1,000,000.'
      });
    }

    const amountKobo = Math.round(amountNaira * 100);

    connection = await pool.getConnection();

    const [users] = await connection.execute(
      `SELECT id, email, status
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [req.userId]
    );

    if (!users.length || users[0].status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'User account is not active.'
      });
    }

    const [wallets] = await connection.execute(
      `SELECT id, status
       FROM wallets
       WHERE user_id = ?
       LIMIT 1`,
      [req.userId]
    );

    if (!wallets.length || wallets[0].status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Wallet is not active.'
      });
    }

    const reference =
      `SFX-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

    await connection.execute(
      `INSERT INTO payments
        (user_id, amount, gateway, gateway_reference, status)
       VALUES (?, ?, 'paystack', ?, 'pending')`,
      [req.userId, amountNaira.toFixed(2), reference]
    );

    const paystackResponse = await initializeTransaction({
      email: users[0].email,
      amount: amountKobo,
      currency: 'NGN',
      reference,
      callback_url: 'http://127.0.0.1:5500/wallet.html',
      metadata: {
        user_id: String(req.userId),
        wallet_id: String(wallets[0].id),
        payment_reference: reference
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Payment initialized successfully.',
      payment: {
        reference,
        authorizationUrl: paystackResponse.data.authorization_url,
        accessCode: paystackResponse.data.access_code
      }
    });
  } catch (error) {
    console.error('Paystack initialization failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Could not initialize payment.'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// POST /api/paystack/verify/:reference
router.post('/verify/:reference', authenticateToken, async (req, res) => {
  const reference = String(req.params.reference || '').trim();

  if (!reference || reference.length > 150) {
    return res.status(400).json({
      success: false,
      message: 'Invalid payment reference.'
    });
  }

  let connection;

  try {
    // Ask Paystack for the authoritative transaction status.
    const paystackResponse = await verifyTransaction(reference);
    const transaction = paystackResponse.data;

    if (!transaction) {
      return res.status(502).json({
        success: false,
        message: 'Invalid response from payment gateway.'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Lock the payment row so two simultaneous requests cannot
    // credit the same payment at the same time.
    const [payments] = await connection.execute(
      `SELECT id, user_id, amount, gateway, gateway_reference, status
       FROM payments
       WHERE gateway = 'paystack'
       AND gateway_reference = ?
       LIMIT 1
       FOR UPDATE`,
      [reference]
    );

    if (!payments.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: 'Payment record not found.'
      });
    }

    const payment = payments[0];

    // The authenticated user must own this payment.
    if (Number(payment.user_id) !== Number(req.userId)) {
      await connection.rollback();

      return res.status(403).json({
        success: false,
        message: 'You are not authorized to verify this payment.'
      });
    }

    // If this payment was already credited, never credit it again.
    if (payment.status === 'successful') {
      await connection.commit();

      return res.json({
        success: true,
        message: 'Payment has already been credited.',
        payment: {
          reference,
          status: 'successful',
          amount: Number(payment.amount),
          currency: 'NGN'
        }
      });
    }

    // Reference must match exactly.
    if (transaction.reference !== reference) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: 'Payment reference verification failed.'
      });
    }

    // Paystack amount is in kobo; our DB amount is in naira.
    const expectedAmountKobo = Math.round(Number(payment.amount) * 100);

    if (Number(transaction.amount) !== expectedAmountKobo) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: 'Payment amount verification failed.'
      });
    }

    if (String(transaction.currency).toUpperCase() !== 'NGN') {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: 'Payment currency verification failed.'
      });
    }

    // Only a confirmed Paystack "success" can credit the wallet.
    if (transaction.status !== 'success') {
      if (
        transaction.status === 'failed' ||
        transaction.status === 'abandoned'
      ) {
        await connection.execute(
          `UPDATE payments
           SET status = ?
           WHERE id = ?`,
          [transaction.status, payment.id]
        );
      }

      await connection.commit();

      return res.status(400).json({
        success: false,
        message: `Payment is not successful. Current status: ${transaction.status}.`,
        payment: {
          reference,
          status: transaction.status
        }
      });
    }

    // Lock the user's wallet before changing its balance.
    const [wallets] = await connection.execute(
      `SELECT id, balance, currency, status
       FROM wallets
       WHERE user_id = ?
       LIMIT 1
       FOR UPDATE`,
      [payment.user_id]
    );

    if (!wallets.length || wallets[0].status !== 'active') {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: 'Wallet is not available for funding.'
      });
    }

    const wallet = wallets[0];

    if (wallet.currency !== 'NGN') {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: 'Wallet currency is not supported.'
      });
    }

    const balanceBefore = Number(wallet.balance);
    const amount = Number(payment.amount);
    const balanceAfter = balanceBefore + amount;

    // Mark payment successful.
    await connection.execute(
      `UPDATE payments
       SET status = 'successful'
       WHERE id = ?`,
      [payment.id]
    );

    // Credit wallet.
    await connection.execute(
      `UPDATE wallets
       SET balance = ?
       WHERE id = ?`,
      [balanceAfter.toFixed(2), wallet.id]
    );

    // Record the wallet movement using the same unique reference.
    await connection.execute(
      `INSERT INTO wallet_transactions
        (user_id, wallet_id, type, amount, balance_before,
         balance_after, reference, description, status)
       VALUES (?, ?, 'funding', ?, ?, ?, ?, ?, 'successful')`,
      [
        payment.user_id,
        wallet.id,
        amount.toFixed(2),
        balanceBefore.toFixed(2),
        balanceAfter.toFixed(2),
        reference,
        'Wallet funding via Paystack'
      ]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: 'Payment verified and wallet funded successfully.',
      payment: {
        reference,
        status: 'successful',
        amount,
        currency: 'NGN'
      },
      wallet: {
        balance: balanceAfter,
        currency: wallet.currency
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }

    // Duplicate wallet transaction means another request already
    // completed the credit.
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'This payment has already been processed.'
      });
    }

    console.error('Paystack verification failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Could not verify payment.'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// POST /api/paystack/webhook
router.post('/webhook', async (req, res) => {
  const signature = String(
    req.headers['x-paystack-signature'] || ''
  ).trim();

  if (!process.env.PAYSTACK_SECRET_KEY) {
    return res.status(500).json({
      success: false,
      message: 'Paystack is not configured.'
    });
  }

  if (!req.rawBody || !signature || !/^[a-f0-9]{128}$/i.test(signature)) {
    return res.status(401).json({
      success: false,
      message: 'Invalid webhook signature.'
    });
  }

  const expectedSignature = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(req.rawBody)
    .digest('hex');

  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  const receivedBuffer = Buffer.from(signature, 'hex');

  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    return res.status(401).json({
      success: false,
      message: 'Invalid webhook signature.'
    });
  }

  const event = req.body;

  if (!event || typeof event !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'Invalid webhook payload.'
    });
  }

  const eventType = String(event.event || '').trim();
  const transaction = event.data || {};
  const reference = String(transaction.reference || '').trim();

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.execute(
      `INSERT INTO webhook_events
        (provider, event_type, reference, payload, processed)
       VALUES ('paystack', ?, ?, ?, 0)`,
      [
        eventType,
        reference || null,
        JSON.stringify(event)
      ]
    );

    // We only fund wallets for successful Paystack charges.
    if (eventType !== 'charge.success') {
      await connection.execute(
        `UPDATE webhook_events
         SET processed = 1, processed_at = CURRENT_TIMESTAMP
         WHERE provider = 'paystack'
         AND event_type = ?
         AND reference <=> ?`,
        [eventType, reference || null]
      );

      await connection.commit();

      return res.status(200).json({
        success: true,
        message: 'Webhook received.'
      });
    }

    if (!reference || reference.length > 150) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: 'Invalid payment reference.'
      });
    }

    const [payments] = await connection.execute(
      `SELECT id, user_id, amount, gateway,
              gateway_reference, status
       FROM payments
       WHERE gateway = 'paystack'
       AND gateway_reference = ?
       LIMIT 1
       FOR UPDATE`,
      [reference]
    );

    // The event is valid Paystack traffic, but it does not
    // belong to one of our locally initialized payments.
    if (!payments.length) {
      await connection.execute(
        `UPDATE webhook_events
         SET processed = 1, processed_at = CURRENT_TIMESTAMP
         WHERE provider = 'paystack'
         AND event_type = ?
         AND reference = ?`,
        [eventType, reference]
      );

      await connection.commit();

      return res.status(200).json({
        success: true,
        message: 'Webhook received.'
      });
    }

    const payment = payments[0];

    // Idempotency: verify route or another webhook may already
    // have credited this payment.
    if (payment.status === 'successful') {
      await connection.execute(
        `UPDATE webhook_events
         SET processed = 1, processed_at = CURRENT_TIMESTAMP
         WHERE provider = 'paystack'
         AND event_type = ?
         AND reference = ?`,
        [eventType, reference]
      );

      await connection.commit();

      return res.status(200).json({
        success: true,
        message: 'Payment has already been processed.'
      });
    }

    const expectedAmountKobo =
      Math.round(Number(payment.amount) * 100);

    if (Number(transaction.amount) !== expectedAmountKobo) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: 'Payment amount verification failed.'
      });
    }

    if (
      String(transaction.currency || '').toUpperCase() !== 'NGN'
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: 'Payment currency verification failed.'
      });
    }

    if (transaction.status !== 'success') {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: 'Payment status verification failed.'
      });
    }

    const [wallets] = await connection.execute(
      `SELECT id, balance, currency, status
       FROM wallets
       WHERE user_id = ?
       LIMIT 1
       FOR UPDATE`,
      [payment.user_id]
    );

    if (!wallets.length || wallets[0].status !== 'active') {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: 'Wallet is not available for funding.'
      });
    }

    const wallet = wallets[0];

    if (wallet.currency !== 'NGN') {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: 'Wallet currency is not supported.'
      });
    }

    const balanceBefore = Number(wallet.balance);
    const amount = Number(payment.amount);
    const balanceAfter = balanceBefore + amount;

    await connection.execute(
      `UPDATE payments
       SET status = 'successful'
       WHERE id = ?`,
      [payment.id]
    );

    await connection.execute(
      `UPDATE wallets
       SET balance = ?
       WHERE id = ?`,
      [balanceAfter.toFixed(2), wallet.id]
    );

    await connection.execute(
      `INSERT INTO wallet_transactions
        (user_id, wallet_id, type, amount,
         balance_before, balance_after,
         reference, description, status)
       VALUES (?, ?, 'funding', ?, ?, ?, ?, ?, 'successful')`,
      [
        payment.user_id,
        wallet.id,
        amount.toFixed(2),
        balanceBefore.toFixed(2),
        balanceAfter.toFixed(2),
        reference,
        'Wallet funding via Paystack webhook'
      ]
    );

    await connection.execute(
      `UPDATE webhook_events
       SET processed = 1, processed_at = CURRENT_TIMESTAMP
       WHERE provider = 'paystack'
       AND event_type = ?
       AND reference = ?`,
      [eventType, reference]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully.'
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(200).json({
        success: true,
        message: 'Webhook already received.'
      });
    }

    console.error('Paystack webhook failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Webhook processing failed.'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;