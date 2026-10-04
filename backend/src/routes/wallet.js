const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const router = express.Router();

// Verify JWT and identify the logged-in user.
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
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token.'
    });
  }
}

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
