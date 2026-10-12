const express = require('express');
const crypto = require('crypto');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function normalizePhone(phone) {
  return String(phone || '').trim();
}

function normalizeNetwork(network) {
  return String(network || '').trim().toUpperCase();
}

function createReference() {
  return `SFX-AIR-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

// POST /api/airtime/purchase
router.post('/purchase', authenticateToken, async (req, res) => {
  const network = normalizeNetwork(req.body.network);
  const phone = normalizePhone(req.body.phone);
  const amount = Number(req.body.amount);

  const allowedNetworks = ['MTN', 'AIRTEL', 'GLO', '9MOBILE'];

  if (!allowedNetworks.includes(network)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid network.'
    });
  }

  if (!/^0\d{10}$/.test(phone)) {
    return res.status(400).json({
      success: false,
      message: 'Enter a valid 11-digit Nigerian phone number.'
    });
  }

  if (!Number.isFinite(amount) || amount < 50 || amount > 500000) {
    return res.status(400).json({
      success: false,
      message: 'Airtime amount must be between ₦50 and ₦500,000.'
    });
  }

  const reference = createReference();

  try {
    const [walletRows] = await pool.execute(
      `SELECT id, balance, status
       FROM wallets
       WHERE user_id = ?
       LIMIT 1`,
      [req.userId]
    );

    if (!walletRows.length) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found.'
      });
    }

    const wallet = walletRows[0];

    if (wallet.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your wallet is not active.'
      });
    }

    if (Number(wallet.balance) < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance.'
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO airtime_transactions
       (
         user_id,
         network,
         phone,
         amount,
         our_reference,
         status
       )
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [
        req.userId,
        network,
        phone,
        amount,
        reference
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Airtime purchase request created.',
      transaction: {
        id: result.insertId,
        reference,
        network,
        phone,
        amount,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Airtime purchase creation failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Could not create airtime purchase request.'
    });
  }
});

module.exports = router;