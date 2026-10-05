const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/wallet
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT w.balance, w.currency, w.status
       FROM wallets w
       INNER JOIN users u ON u.id = w.user_id
       WHERE w.user_id = ?
       AND u.status = 'active'
       LIMIT 1`,
      [req.userId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found.'
      });
    }

    return res.json({
      success: true,
      wallet: {
        balance: Number(rows[0].balance),
        currency: rows[0].currency,
        status: rows[0].status
      }
    });
  } catch (error) {
    console.error('Wallet lookup failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Could not retrieve wallet.'
    });
  }
});

// GET /api/wallet/transactions
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
         id,
         type,
         amount,
         balance_before,
         balance_after,
         reference,
         description,
         status,
         created_at
       FROM wallet_transactions
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 50`,
      [req.userId]
    );

    return res.json({
      success: true,
      transactions: rows.map(row => ({
        id: row.id,
        type: row.type,
        amount: Number(row.amount),
        balanceBefore: Number(row.balance_before),
        balanceAfter: Number(row.balance_after),
        reference: row.reference,
        description: row.description,
        status: row.status,
        date: row.created_at
      }))
    });
  } catch (error) {
    console.error('Wallet transactions lookup failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Could not retrieve wallet transactions.'
    });
  }
});

module.exports = router;
