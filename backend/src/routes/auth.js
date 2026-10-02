const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const router = express.Router();

function createToken(user) {
  return jwt.sign(
    { sub: String(user.id), email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    phone: user.phone,
    status: user.status
  };
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const fullName = String(req.body.fullName || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = String(req.body.phone || '').trim();
  const password = String(req.body.password || '');

  if (fullName.length < 3 || fullName.length > 120) {
    return res.status(400).json({
      success: false,
      message: 'Full name must be between 3 and 120 characters.'
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Enter a valid email address.'
    });
  }

  if (!/^0\d{10}$/.test(phone)) {
    return res.status(400).json({
      success: false,
      message: 'Enter a valid 11-digit Nigerian phone number.'
    });
  }

  if (password.length < 8 || password.length > 72) {
    return res.status(400).json({
      success: false,
      message: 'Password must be between 8 and 72 characters.'
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      success: false,
      message: 'Authentication is not configured.'
    });
  }

  let connection;

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.execute(
      `INSERT INTO users (full_name, email, phone, password_hash)
       VALUES (?, ?, ?, ?)`,
      [fullName, email, phone, passwordHash]
    );

    const userId = result.insertId;

    await connection.execute(
      `INSERT INTO wallets (user_id, balance, currency)
       VALUES (?, 0.00, 'NGN')`,
      [userId]
    );

    await connection.commit();

    const user = {
      id: userId,
      full_name: fullName,
      email,
      phone,
      status: 'active'
    };

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      user: publicUser(user),
      token: createToken(user)
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Email or phone number is already registered.'
      });
    }

    console.error('Registration failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Could not create account. Please try again.'
    });
  } finally {
    if (connection) connection.release();
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const identifier = String(req.body.identifier || '').trim();
  const password = String(req.body.password || '');

  if (!identifier || !password) {
    return res.status(400).json({
      success: false,
      message: 'Enter your email or phone number and password.'
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      success: false,
      message: 'Authentication is not configured.'
    });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT id, full_name, email, phone, password_hash, status
       FROM users
       WHERE email = ? OR phone = ?
       LIMIT 1`,
      [identifier.toLowerCase(), identifier]
    );

    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email/phone number or password.'
      });
    }

    const user = rows[0];
    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email/phone number or password.'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'This account is not active. Please contact support.'
      });
    }

    return res.json({
      success: true,
      message: 'Login successful.',
      user: publicUser(user),
      token: createToken(user)
    });
  } catch (error) {
    console.error('Login failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Could not log in. Please try again.'
    });
  }
});

module.exports = router;
