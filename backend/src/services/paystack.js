const PAYSTACK_BASE_URL = 'https://api.paystack.co';

function getSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;

  if (!key) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured.');
  }

  return key;
}

async function paystackRequest(path, options = {}) {
  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.status) {
    const message =
      data?.message || `Paystack request failed with HTTP ${response.status}.`;

    const error = new Error(message);
    error.status = response.status;
    error.paystackResponse = data;
    throw error;
  }

  return data;
}

async function initializeTransaction({
  email,
  amount,
  reference,
  currency = 'NGN',
  metadata
}) {
  return paystackRequest('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email,
      amount: String(amount),
      currency,
      reference,
      metadata
    })
  });
}

async function verifyTransaction(reference) {
  return paystackRequest(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    {
      method: 'GET'
    }
  );
}

module.exports = {
  initializeTransaction,
  verifyTransaction
};