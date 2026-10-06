const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/transactions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `
      SELECT *
      FROM (
        SELECT
          'wallet' AS type,
          wt.amount,
          wt.reference,
          wt.description,
          wt.status,
          wt.created_at
        FROM wallet_transactions wt
        WHERE wt.user_id = ?

        UNION ALL

        SELECT
          'airtime' AS type,
          at.amount,
          at.our_reference AS reference,
          CONCAT('Airtime - ', at.network, ' - ', at.phone) AS description,
          at.status,
          at.created_at
        FROM airtime_transactions at
        WHERE at.user_id = ?

        UNION ALL

        SELECT
          'data' AS type,
          dt.amount,
          dt.our_reference AS reference,
          CONCAT('Data - ', dt.network, ' - ', dt.plan_name) AS description,
          dt.status,
          dt.created_at
        FROM data_transactions dt
        WHERE dt.user_id = ?

        UNION ALL

        SELECT
          'school_fees' AS type,
          sf.amount,
          sf.our_reference AS reference,
          CONCAT('School Fees - ', sf.institution, ' - ', sf.fee_type) AS description,
          sf.status,
          sf.created_at
        FROM school_fee_transactions sf
        WHERE sf.user_id = ?
      ) AS transactions
      ORDER BY created_at DESC
      LIMIT 100
      `,
      [req.userId, req.userId, req.userId, req.userId]
    );

    return res.json({
      success: true,
      transactions: rows.map(row => ({
        type: row.type,
        amount: Number(row.amount),
        reference: row.reference,
        description: row.description,
        status: row.status,
        date: row.created_at
      }))
    });
  } catch (error) {
    console.error('Transactions lookup failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Could not retrieve transactions.'
    });
  }
});

module.exports = router;
