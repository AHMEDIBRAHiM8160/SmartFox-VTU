const express = require('express');
const crypto = require('crypto');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const {
  initializeTransaction,
  verifyTransaction,
  assignDedicatedAccount
} = require('../services/paystack');

const router = express.Router();


// GET /api/paystack/dedicated-account
// Return only the authenticated user's own DVA.
router.get('/dedicated-account', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT account_name, account_number, bank_name, currency, status
       FROM dedicated_virtual_accounts
       WHERE user_id = ?
       LIMIT 1`,
      [req.userId]
    );

    if (!rows.length) {
      return res.json({
        success: true,
        account: null,
        message: 'No dedicated account has been requested yet.'
      });
    }

    const account = rows[0];

    // Never display account details until Paystack confirms assignment.
    if (account.status !== 'active') {
      return res.json({
        success: true,
        account: {
          status: account.status,
          currency: account.currency
        },
        message: account.status === 'pending'
          ? 'Your dedicated account request is being processed.'
          : 'Your dedicated account could not be assigned. Please contact support.'
      });
    }

    return res.json({
      success: true,
      account: {
        accountName: account.account_name,
        accountNumber: account.account_number,
        bankName: account.bank_name,
        currency: account.currency,
        status: account.status
      }
    });
  } catch (error) {
    console.error('DVA lookup failed:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Could not retrieve dedicated account.'
    });
  }
});

// POST /api/paystack/dedicated-account/assign
// Explicit user consent is required before requesting a DVA.
router.post('/dedicated-account/assign', authenticateToken, async (req, res) => {
  if (req.body?.consent !== true) {
    return res.status(400).json({
      success: false,
      message: 'Please confirm that you agree to request a dedicated bank account.'
    });
  }

  // Safety switch: keep disabled until Paystack LIVE eligibility is confirmed.
  if (process.env.PAYSTACK_DVA_ENABLED !== 'true') {
    return res.status(503).json({
      success: false,
      message: 'Dedicated account requests are not enabled yet.'
    });
  }

  let connection;
  let user;
  let existing;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [users] = await connection.execute(
      `SELECT id, full_name, email, phone, status
       FROM users
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [req.userId]
    );

    if (!users.length || users[0].status !== 'active') {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        message: 'User account is not active.'
      });
    }

    user = users[0];

    const [accounts] = await connection.execute(
      `SELECT status, account_name, account_number, bank_name
       FROM dedicated_virtual_accounts
       WHERE user_id = ?
       LIMIT 1
       FOR UPDATE`,
      [req.userId]
    );

    existing = accounts[0] || null;

    if (existing?.status === 'active') {
      await connection.commit();
      return res.json({
        success: true,
        message: 'Your dedicated account is already active.',
        account: {
          accountName: existing.account_name,
          accountNumber: existing.account_number,
          bankName: existing.bank_name,
          status: 'active'
        }
      });
    }

    if (existing?.status === 'pending') {
      await connection.commit();
      return res.status(202).json({
        success: true,
        message: 'Your account request is already being processed.'
      });
    }

    const bankSlug = process.env.PAYSTACK_DVA_PREFERRED_BANK || 'wema-bank';

    if (existing) {
      await connection.execute(
        `UPDATE dedicated_virtual_accounts
         SET status = 'pending', failure_reason = NULL,
             bank_slug = ?
         WHERE user_id = ?`,
        [bankSlug, req.userId]
      );
    } else {
      await connection.execute(
        `INSERT INTO dedicated_virtual_accounts
          (user_id, status, bank_slug, currency)
         VALUES (?, 'pending', ?, 'NGN')`,
        [req.userId, bankSlug]
      );
    }

    await connection.commit();
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    console.error('DVA request preparation failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Could not prepare your dedicated account request.'
    });
  } finally {
    if (connection) {
      connection.release();
      connection = null;
    }
  }

  try {
    const nameParts = String(user.full_name || '').trim().split(/\s+/);
    const firstName = nameParts.shift() || '';
    const lastName = nameParts.join(' ') || firstName;

    let phone = String(user.phone || '').trim();
    if (/^0\d{10}$/.test(phone)) {
      phone = `+234${phone.slice(1)}`;
    }

    if (!user.email || !firstName || !lastName || !/^\+?\d{10,15}$/.test(phone)) {
      throw new Error('User profile needs a valid email, full name, and phone number.');
    }

    // This is the first place that contacts Paystack.
    // The environment safety switch above must be deliberately enabled.
    await assignDedicatedAccount({
      email: user.email,
      first_name: firstName,
      last_name: lastName,
      phone,
      preferred_bank: process.env.PAYSTACK_DVA_PREFERRED_BANK || 'wema-bank'
    });

    return res.status(202).json({
      success: true,
      message: 'Your dedicated account request has been submitted. Account details will appear after Paystack confirms assignment.'
    });
  } catch (error) {
    try {
      await pool.execute(
        `UPDATE dedicated_virtual_accounts
         SET status = 'failed', failure_reason = ?
         WHERE user_id = ? AND status = 'pending'`,
        [String(error.message || 'Paystack request failed').slice(0, 255), req.userId]
      );
    } catch (dbError) {
      console.error('Could not update failed DVA status:', dbError.message);
    }

    console.error('DVA assignment request failed:', error.message);

    return res.status(502).json({
      success: false,
      message: 'Paystack could not accept the account request. Please try again later or contact support.'
    });
  }
});

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
      callback_url: process.env.PAYSTACK_CALLBACK_URL || 'http://127.0.0.1:5500/wallet.html',
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

    // DVA_ASSIGNMENT_WEBHOOK_HANDLER
    const assignmentEvents = [
      'dedicatedaccount.assign.success',
      'dedicatedaccount.assign.failed',
      'customeridentification.failed'
    ];

    if (assignmentEvents.includes(eventType)) {
      const details = event.data || {};
      const dedicated = details.dedicated_account || details.dedicatedAccount || {};
      const bank = dedicated.bank || details.bank || {};
      const customer = details.customer || {};

      const customerCode = String(
        details.customer_code || customer.customer_code || ''
      ).trim();
      const email = String(
        details.email || customer.email || ''
      ).trim().toLowerCase();

      const isSuccess = eventType === 'dedicatedaccount.assign.success';
      const accountNumber = String(dedicated.account_number || details.account_number || '').trim();
      const accountName = String(dedicated.account_name || details.account_name || '').trim();
      const bankName = String(bank.name || details.bank_name || '').trim();
      const bankSlug = String(bank.slug || details.bank_slug || '').trim();
      const accountId = dedicated.id ?? details.dedicated_account_id ?? details.id ?? null;
      const currency = String(dedicated.currency || details.currency || 'NGN').toUpperCase();
      const accountIsActive = dedicated.active !== false &&
        dedicated.assigned !== false &&
        details.active !== false &&
        details.assigned !== false;

      const [matches] = await connection.execute(
        `SELECT dva.user_id
         FROM dedicated_virtual_accounts dva
         INNER JOIN users u ON u.id = dva.user_id
         WHERE (
           (? <> '' AND dva.customer_code = ?)
           OR (? <> '' AND LOWER(u.email) = ?)
         )
         LIMIT 1
         FOR UPDATE`,
        [customerCode, customerCode, email, email]
      );

      if (matches.length) {
        const userId = matches[0].user_id;

        if (
          isSuccess &&
          accountNumber &&
          accountName &&
          bankName &&
          currency === 'NGN' &&
          accountIsActive
        ) {
          await connection.execute(
            `UPDATE dedicated_virtual_accounts
             SET customer_code = COALESCE(NULLIF(?, ''), customer_code),
                 dedicated_account_id = ?,
                 account_name = ?,
                 account_number = ?,
                 bank_name = ?,
                 bank_slug = COALESCE(NULLIF(?, ''), bank_slug),
                 currency = 'NGN',
                 status = 'active',
                 failure_reason = NULL
             WHERE user_id = ?`,
            [
              customerCode,
              accountId,
              accountName,
              accountNumber,
              bankName,
              bankSlug,
              userId
            ]
          );
        } else if (!isSuccess) {
          await connection.execute(
            `UPDATE dedicated_virtual_accounts
             SET status = 'failed',
                 failure_reason = ?
             WHERE user_id = ? AND status <> 'active'`,
            [
              String(details.reason || 'Paystack could not assign the dedicated account.').slice(0, 255),
              userId
            ]
          );
        }
      }

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
        message: 'DVA assignment webhook received.'
      });
    }

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

    // DVA_CHARGE_WEBHOOK_HANDLER
    const authorization = transaction.authorization || {};

    if (authorization.channel === 'dedicated_nuban') {
      const accountNumber = String(
        authorization.receiver_bank_account_number || ''
      ).trim();
      const amountKobo = Number(transaction.amount);
      const currency = String(transaction.currency || '').toUpperCase();

      if (
        !accountNumber ||
        !Number.isSafeInteger(amountKobo) ||
        amountKobo <= 0 ||
        currency !== 'NGN' ||
        transaction.status !== 'success'
      ) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'DVA payment details failed validation.'
        });
      }

      const [accounts] = await connection.execute(
        `SELECT user_id
         FROM dedicated_virtual_accounts
         WHERE account_number = ?
           AND status = 'active'
           AND currency = 'NGN'
         LIMIT 1
         FOR UPDATE`,
        [accountNumber]
      );

      // Unknown or inactive DVA: acknowledge the event but never credit
      // an account that cannot be matched to a verified local DVA.
      if (!accounts.length) {
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
          message: 'DVA payment received; no matching active account.'
        });
      }

      const userId = accounts[0].user_id;
      const [wallets] = await connection.execute(
        `SELECT id, balance, currency, status
         FROM wallets
         WHERE user_id = ?
         LIMIT 1
         FOR UPDATE`,
        [userId]
      );

      if (!wallets.length || wallets[0].status !== 'active' ||
          wallets[0].currency !== 'NGN') {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: 'Wallet is not available for DVA funding.'
        });
      }

      const wallet = wallets[0];
      const amountNaira = amountKobo / 100;
      const balanceBefore = Number(wallet.balance);
      const balanceAfter = balanceBefore + amountNaira;

      if (!Number.isFinite(balanceAfter)) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Invalid DVA payment amount.'
        });
      }

      // The unique wallet_transactions.reference prevents a duplicate
      // Paystack reference from crediting the wallet twice.
      await connection.execute(
        `INSERT INTO wallet_transactions
          (user_id, wallet_id, type, amount,
           balance_before, balance_after,
           reference, description, status)
         VALUES (?, ?, 'funding', ?, ?, ?, ?, ?, 'successful')`,
        [
          userId,
          wallet.id,
          amountNaira.toFixed(2),
          balanceBefore.toFixed(2),
          balanceAfter.toFixed(2),
          reference,
          'Wallet funding via Paystack dedicated virtual account'
        ]
      );

      await connection.execute(
        `UPDATE wallets SET balance = ? WHERE id = ?`,
        [balanceAfter.toFixed(2), wallet.id]
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
        message: 'DVA wallet funding processed.'
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

    // Explicitly validate the Paystack reference against our payment.
    if (
      transaction.reference !== reference ||
      payment.gateway_reference !== reference
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: 'Payment reference verification failed.'
      });
    }

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