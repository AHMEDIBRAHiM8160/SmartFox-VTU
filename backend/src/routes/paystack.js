const express = require('express');
const axios = require('axios');

const router = express.Router();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

router.post('/initialize', async (req, res) => {
  try {
    const { email, amount } = req.body;

    if (!email || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Email and amount are required',
      });
    }

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: Math.round(Number(amount) * 100),
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return res.json({
      success: true,
      message: 'Payment initialized successfully',
      data: response.data.data,
    });
  } catch (error) {
    console.error(
      'Paystack initialize error:',
      error.response?.data || error.message
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to initialize payment',
      error: error.response?.data?.message || error.message,
    });
  }
});

module.exports = router;