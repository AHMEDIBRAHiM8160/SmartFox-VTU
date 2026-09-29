/* ============================================
   Smart Fox VTU — Wallet (wallet.js)
   fundWallet() currently writes to localStorage.
   Later: POST /api/wallet/fund
   ============================================ */

function fundWallet(amount, method) {
  const wallet = getWallet();
  const newBalance = wallet.balance + amount;
  setWalletBalance(newBalance);
  const tx = {
    ref: generateRef('WLT'),
    service: 'Wallet',
    description: `Wallet Funding via ${method}`,
    amount,
    type: 'credit',
    date: new Date().toISOString(),
    status: 'success'
  };
  addTransaction(tx);
  addNotification('Your wallet has been funded successfully.');
  return tx;
}

let sfvtuSelectedAmount = null;

function initWalletPage() {
  bindBalanceToggle('wallet-balance-toggle', 'wallet-balance-amt', () => getWallet().balance);
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
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const amount = Number(amountInput.value);
      const method = document.getElementById('fund-method').value;
      if (!amount || amount < 100) { toast('Enter a valid amount (min ₦100).', 'error'); return; }
      if (!method) { toast('Select a payment method.', 'error'); return; }

      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Processing...';
      setTimeout(() => {
        const tx = fundWallet(amount, method);
        showFundSuccessModal(tx, amount);
        btn.disabled = false; btn.textContent = 'Continue';
        form.reset();
        renderWalletHistory();
        bindBalanceToggle('wallet-balance-toggle', 'wallet-balance-amt', () => getWallet().balance);
      }, 900);
    });
  }

  renderWalletHistory();
}

function showFundSuccessModal(tx, amount) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="receipt-status">
        <div class="check">✓</div>
        <h3>Wallet Funded!</h3>
      </div>
      <div class="modal-row"><span>Reference</span><span>${tx.ref}</span></div>
      <div class="modal-row"><span>Amount</span><span>${formatNaira(amount)}</span></div>
      <div class="modal-row"><span>New Balance</span><span>${formatNaira(getWallet().balance)}</span></div>
      <div class="modal-row"><span>Status</span><span class="badge badge-success">Successful</span></div>
      <div class="modal-actions">
        <button class="btn btn-primary btn-block" id="fund-modal-close">Done</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('fund-modal-close').addEventListener('click', () => overlay.remove());
}

function renderWalletHistory() {
  const container = document.getElementById('wallet-history-body');
  if (!container) return;
  const rows = getTransactions().filter(t => t.service === 'Wallet' || t.type === 'debit');
  container.innerHTML = rows.slice(0, 12).map(t => `
    <tr>
      <td>${t.ref}</td>
      <td>${t.description}</td>
      <td>${t.type === 'credit' ? '+' : '-'}${formatNaira(t.amount)}</td>
      <td>${formatDate(t.date)}</td>
      <td><span class="badge badge-${t.status === 'success' ? 'success' : t.status}">${t.status[0].toUpperCase() + t.status.slice(1)}</span></td>
    </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:30px;">No wallet activity yet.</td></tr>';
}
