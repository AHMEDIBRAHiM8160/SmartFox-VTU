/* ============================================
   Smart Fox VTU — Wallet (wallet.js)
   Wallet funding uses Paystack through the backend.
   ============================================ */

let sfvtuSelectedAmount = null;

function initWalletPage() {
  let walletPageBalance = 0;

  const updateWalletBalance = bindBalanceToggle(
    'wallet-balance-toggle',
    'wallet-balance-amt',
    () => walletPageBalance
  );

  async function loadWalletBalance() {
    const session = sfvtuGet(SFVTU_KEYS.session, null);

    if (!session || !session.token) {
      console.error('Wallet: No authenticated session found.');
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/wallet', {
        headers: {
          Authorization: `Bearer ${session.token}`
        }
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Could not load wallet.');
      }

      walletPageBalance = Number(result.wallet.balance);
      updateWalletBalance();
    } catch (error) {
      console.error('Wallet balance error:', error.message);
    }
  }

  async function loadDedicatedAccount() {
    const session = sfvtuGet(SFVTU_KEYS.session, null);
    const message = document.getElementById('dva-status-message');
    const badge = document.getElementById('dva-status-badge');
    const details = document.getElementById('dva-account-details');
    const controls = document.getElementById('dva-request-controls');
    const requestButton = document.getElementById('dva-request-button');

    if (!message || !badge || !details || !controls || !requestButton) return;

    if (!session || !session.token) {
      message.textContent = 'Please log in again to view your bank account.';
      return;
    }

    try {
      const response = await fetch(
        'http://localhost:5000/api/paystack/dedicated-account',
        { headers: { Authorization: `Bearer ${session.token}` } }
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Could not load bank account status.');
      }

      const account = result.account;

      details.hidden = true;
      controls.hidden = false;
      requestButton.disabled = !document.getElementById('dva-consent')?.checked;

      if (account?.status === 'active' &&
          account.accountNumber && account.accountName && account.bankName) {
        document.getElementById('dva-bank-name').textContent = account.bankName;
        document.getElementById('dva-account-name').textContent = account.accountName;
        document.getElementById('dva-account-number').textContent = account.accountNumber;
        details.hidden = false;
        controls.hidden = true;
        badge.textContent = 'Active';
        badge.className = 'badge badge-success';
        message.textContent = 'Your dedicated account is ready. Transfer only to the account shown above.';
      } else if (account?.status === 'pending') {
        badge.textContent = 'Pending';
        badge.className = 'badge badge-pending';
        message.textContent = result.message || 'Your account request is being processed. Refresh this page later.';
        controls.hidden = true;
      } else if (account?.status === 'failed') {
        badge.textContent = 'Failed';
        badge.className = 'badge badge-pending';
        message.textContent = result.message || 'Your account request failed. You may try again later.';
      } else {
        badge.textContent = 'Not requested';
        badge.className = 'badge badge-pending';
        message.textContent = 'Request your own dedicated account to receive bank transfers.';
      }
    } catch (error) {
      console.error('Dedicated account lookup error:', error);
      badge.textContent = 'Unavailable';
      message.textContent = error.message || 'Could not load account status. Please try again.';
    }
  }

  async function requestDedicatedAccount() {
    const session = sfvtuGet(SFVTU_KEYS.session, null);
    const consent = document.getElementById('dva-consent');
    const button = document.getElementById('dva-request-button');
    const message = document.getElementById('dva-status-message');

    if (!session?.token) {
      toast('Please login again.', 'error');
      return;
    }

    if (!consent?.checked) {
      toast('Please confirm your consent first.', 'error');
      return;
    }

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Submitting...';
    message.textContent = 'Submitting your request...';

    try {
      const response = await fetch(
        'http://localhost:5000/api/paystack/dedicated-account/assign',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`
          },
          body: JSON.stringify({ consent: true })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Could not request a dedicated account.');
      }

      toast(result.message || 'Account request submitted.', 'success');
      message.textContent = result.message || 'Request submitted. Waiting for confirmation.';
      await loadDedicatedAccount();
    } catch (error) {
      console.error('Dedicated account request error:', error);
      message.textContent = error.message || 'Request failed. Please try again later.';
      toast(message.textContent, 'error');
    } finally {
      button.textContent = originalText;
      button.disabled = !consent?.checked;
    }
  }

  async function verifyPaystackCallback() {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || params.get('trxref');

    if (!reference) return;

    const session = sfvtuGet(SFVTU_KEYS.session, null);

    if (!session || !session.token) {
      toast('Please login again to verify your payment.', 'error');
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:5000/api/paystack/verify/${encodeURIComponent(reference)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.token}`
          }
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Could not verify payment.'
        );
      }

      await loadWalletBalance();

      toast(
        result.message || 'Payment verified successfully.',
        'success'
      );

      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );
    } catch (error) {
      console.error('Paystack verification error:', error);
      toast(
        error.message || 'Payment verification failed.',
        'error'
      );
    }
  }

  loadWalletBalance();
  verifyPaystackCallback();
  const idEl = document.getElementById('wallet-id');
  if (idEl) idEl.textContent = maskedWalletId();

  document.querySelectorAll('.amount-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.amount-chips .chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      sfvtuSelectedAmount = Number(chip.dataset.amount);
      document.getElementById('fund-amount-input').value = sfvtuSelectedAmount;
    });
  });

  const amountInput = document.getElementById('fund-amount-input');
  if (amountInput) {
    amountInput.addEventListener('input', () => {
      document.querySelectorAll('.amount-chips .chip').forEach(c => c.classList.remove('selected'));
    });
  }

  const form = document.getElementById('fund-wallet-form');
    if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const amount = Number(amountInput.value);
      const method = document.getElementById('fund-method').value;
      const session = sfvtuGet(SFVTU_KEYS.session, null);

      if (!amount || amount < 100) {
        toast('Enter a valid amount (min ₦100).', 'error');
        return;
      }

      if (!session || !session.token) {
        toast('Please login again.', 'error');
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');
      const originalText = submitButton ? submitButton.textContent : '';

      try {
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = 'Processing...';
        }

        const response = await fetch(
          'http://localhost:5000/api/paystack/initialize',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.token}`
            },
            body: JSON.stringify({ amount })
          }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || 'Could not initialize payment.'
          );
        }

        if (!result.payment?.authorizationUrl) {
          throw new Error('Paystack checkout URL was not returned.');
        }

        window.location.href = result.payment.authorizationUrl;
      } catch (error) {
        console.error('Wallet funding error:', error);
        toast(error.message || 'Could not start payment.', 'error');

        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalText;
        }
      }
    });
  }

  renderWalletHistory();

  const dvaConsent = document.getElementById('dva-consent');
  const dvaRequestButton = document.getElementById('dva-request-button');
  if (dvaConsent && dvaRequestButton) {
    dvaConsent.addEventListener('change', () => {
      dvaRequestButton.disabled = !dvaConsent.checked;
    });
    dvaRequestButton.addEventListener('click', requestDedicatedAccount);
  }

  const copyAccountButton = document.getElementById('dva-copy-account');
  if (copyAccountButton) {
    copyAccountButton.addEventListener('click', async () => {
      const accountNumber = document.getElementById('dva-account-number')?.textContent?.trim();
      if (!accountNumber || accountNumber === '—') {
        toast('No active account number to copy.', 'error');
        return;
      }
      try {
        await navigator.clipboard.writeText(accountNumber);
        toast('Account number copied.', 'success');
      } catch {
        toast('Could not copy automatically. Please select the account number.', 'error');
      }
    });
  }

  loadDedicatedAccount();
}

async function renderWalletHistory() {
  const container = document.getElementById('wallet-history-body');
  if (!container) return;

  const session = sfvtuGet(SFVTU_KEYS.session, null);

  if (!session || !session.token) {
    container.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:30px;">Please login again.</td></tr>';
    return;
  }

  try {
    const response = await fetch('http://localhost:5000/api/wallet/transactions', {
      headers: {
        Authorization: `Bearer ${session.token}`
      }
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Could not load wallet history.');
    }

    const rows = result.transactions || [];

    container.innerHTML = rows.slice(0, 12).map(t => {
      const isCredit = t.type === 'funding' || t.type === 'refund';
      const status = t.status === 'successful' ? 'success' : t.status;

      return `
        <tr>
          <td>${t.reference}</td>
          <td>${t.description || t.type}</td>
          <td>${isCredit ? '+' : '-'}${formatNaira(t.amount)}</td>
          <td>${formatDate(t.date)}</td>
          <td>
            <span class="badge badge-${status}">
              ${status[0].toUpperCase() + status.slice(1)}
            </span>
          </td>
        </tr>`;
    }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:30px;">No wallet activity yet.</td></tr>';

  } catch (error) {
    console.error('Wallet history error:', error);
    container.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:30px;">Could not load wallet activity.</td></tr>';
  }
}

