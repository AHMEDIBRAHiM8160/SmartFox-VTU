const express = require('express');
const { checkDatabaseConnection } = require('../config/db');

const router = express.Router();

router.get('/', async (req, res) => {
  let database = 'disconnected';

  try {
    await checkDatabaseConnection();
    database = 'connected';
  } catch (error) {
    console.error('Database health check failed:', error.message);
  }

  const healthy = database === 'connected';

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    application: 'Smart Fox VTU API',
    status: healthy ? 'ok' : 'degraded',
    database,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
