/* ============================================
   Smart Fox VTU — Airtime (airtime.js)
   purchaseAirtime() simulates the flow now.
   Later: POST /api/airtime/purchase
   ============================================ */

const SFVTU_NETWORKS = [
  { key: 'mtn', label: 'MTN', color: '#ffcc08', logo: 'assets/networks/mtn.svg' },
  { key: 'airtel', label: 'Airtel', color: '#e60012', logo: 'assets/networks/airtel.svg' },
  { key: 'glo', label: 'Glo', color: '#008c44', logo: 'assets/networks/glo.svg' },
  { key: '9mobile', label: '9mobile', color: '#00a88f', logo: 'assets/networks/9mobile.svg' }
];

let sfvtuAirtimeNetwork = null;

function purchaseAirtime({ network, phone, amount }) {
  const wallet = getWallet();
  if (amount > wallet.balance) throw new Error('Insufficient wallet balance.');
  setWalletBalance(wallet.balance - amount);
  const tx = {
    ref: generateRef('ATM'),
    service: 'Airtime',
    description: `Airtime Purchase (${network.toUpperCase()} ${phone})`,
    amount,
    type: 'debit',
    date: new Date().toISOString(),
    status: 'success'
  };
  addTransaction(tx);
  addNotification(`Your ${network.toUpperCase()} airtime purchase was successful.`);
  return tx;
}

function initAirtimePage() {
  const wallet = getWallet();
  document.getElementById('airtime-balance').textContent = formatNaira(wallet.balance);

  const grid = document.getElementById('network-grid');
  grid.innerHTML = SFVTU_NETWORKS.map(n => `
    <div class="network-tile" data-net="${n.key}">
      <img class="network-logo" src="${n.logo}" alt="${n.label} logo">
      <span class="net-label">${n.label}</span>
    </div>`).join('');

  grid.querySelectorAll('.network-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      grid.querySelectorAll('.network-tile').forEach(t => t.classList.remove('selected'));
      tile.classList.add('selected');
      sfvtuAirtimeNetwork = tile.dataset.net;
    });
  });

  document.querySelectorAll('#airtime-amount-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#airtime-amount-chips .chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      document.getElementById('airtime-amount').value = chip.dataset.amount;
    });
  });

  const form = document.getElementById('airtime-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const phone = document.getElementById('airtime-phone').value.trim();
    const amount = Number(document.getElementById('airtime-amount').value);

    if (!sfvtuAirtimeNetwork) { toast('Select a network.', 'error'); return; }
    if (!/^0\d{10}$/.test(phone)) { toast('Enter a valid 11-digit phone number.', 'error'); return; }
    if (!amount || amount < 50) { toast('Enter a valid amount (min ₦50).', 'error'); return; }
    if (amount > getWallet().balance) { toast('Insufficient wallet balance.', 'error'); return; }

    startProtectedPurchase({
      type: 'airtime',
      network: sfvtuAirtimeNetwork,
      phone,
      amount
    });
  });
}

/* ---------- Shared confirm / success modal helpers (used by airtime, data, school-fees) ---------- */
function openConfirmModal({ title, rows, confirmLabel, onConfirm }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <h3>${title}</h3>
      ${rows.map(r => `<div class="modal-row"><span>${r[0]}</span><span>${r[1]}</span></div>`).join('')}
      <div class="modal-actions">
        <button class="btn btn-ghost" id="confirm-cancel">Cancel</button>
        <button class="btn btn-primary btn-block" id="confirm-proceed">${confirmLabel}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('confirm-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('confirm-proceed').addEventListener('click', (e) => {
    e.target.disabled = true;
    e.target.textContent = 'Processing...';
    onConfirm(() => overlay.remove());
  });
}

function showSuccessModal(heading, tx, amount) {
  saveReceipt({
    heading,
    tx,
    amount,
    createdAt: new Date().toISOString()
  });
  window.location.href = 'receipt.html';
}
