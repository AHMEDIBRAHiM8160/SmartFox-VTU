/* ============================================
   Smart Fox VTU — Transactions (transactions.js)
   getTransactions() reads local dummy data now.
   Later: GET /api/transactions
   ============================================ */

let sfvtuTxFilter = 'All';
let sfvtuTxSearch = '';

function initTransactionsPage() {
  const tabs = document.querySelectorAll('.filter-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      sfvtuTxFilter = tab.dataset.filter;
      renderTxTable();
    });
  });

  const search = document.getElementById('tx-search');
  search.addEventListener('input', () => {
    sfvtuTxSearch = search.value.trim().toLowerCase();
    renderTxTable();
  });

  renderTxTable();

  const params = new URLSearchParams(window.location.search);
  const wantedRef = params.get('ref');
  if (wantedRef) {
    const tx = getTransactions().find(t => t.ref === wantedRef);
    if (tx) openReceiptModal(tx);
  }
}

function renderTxTable() {
  const body = document.getElementById('tx-table-body');
  if (!body) return;
  let rows = getTransactions();

  if (sfvtuTxFilter !== 'All') rows = rows.filter(t => t.service === sfvtuTxFilter);
  if (sfvtuTxSearch) {
    rows = rows.filter(t =>
      t.ref.toLowerCase().includes(sfvtuTxSearch) ||
      t.description.toLowerCase().includes(sfvtuTxSearch) ||
      t.service.toLowerCase().includes(sfvtuTxSearch)
    );
  }

  document.getElementById('tx-count').textContent = `${rows.length} transaction${rows.length === 1 ? '' : 's'}`;

  body.innerHTML = rows.map(t => `
    <tr data-ref="${t.ref}">
      <td>${t.ref}</td>
      <td>${t.service}</td>
      <td>${t.type === 'credit' ? '+' : '-'}${formatNaira(t.amount)}</td>
      <td>${formatDate(t.date)}</td>
      <td><span class="badge badge-${t.status === 'success' ? 'success' : t.status}">${t.status[0].toUpperCase() + t.status.slice(1)}</span></td>
    </tr>`).join('') || `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:36px;">No transactions match your filter.</td></tr>`;

  body.querySelectorAll('tr[data-ref]').forEach(row => {
    row.addEventListener('click', () => {
      const tx = getTransactions().find(t => t.ref === row.dataset.ref);
      if (tx) openReceiptModal(tx);
    });
  });
}

function openReceiptModal(tx) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'receipt-overlay';
  overlay.innerHTML = `
    <div class="modal-box receipt" id="receipt-print-area">
      <div class="receipt-head">
        <div class="logo"><span class="logo-icon">${SFVTU_LOGO_SVG}</span><span>Smart Fox <em>VTU</em></span></div>
      </div>
      <div class="receipt-status">
        <div class="check">${tx.status === 'success' ? '✓' : tx.status === 'pending' ? '⏳' : '✕'}</div>
        <h3>${tx.status === 'success' ? 'Transaction Successful' : tx.status === 'pending' ? 'Transaction Pending' : 'Transaction Failed'}</h3>
      </div>
      <div class="modal-row"><span>Reference</span><span>${tx.ref}</span></div>
      <div class="modal-row"><span>Service</span><span>${tx.service}</span></div>
      <div class="modal-row"><span>Description</span><span>${tx.description}</span></div>
      <div class="modal-row"><span>Amount</span><span>${formatNaira(tx.amount)}</span></div>
      <div class="modal-row"><span>Date</span><span>${formatDate(tx.date)}</span></div>
      <div class="modal-row"><span>Status</span><span class="badge badge-${tx.status === 'success' ? 'success' : tx.status}">${tx.status[0].toUpperCase() + tx.status.slice(1)}</span></div>
      <div class="modal-actions">
        <button class="btn btn-outline btn-block" id="receipt-print">Print Receipt</button>
        <button class="btn btn-primary btn-block" id="receipt-download">Download</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('receipt-print').addEventListener('click', () => window.print());
  document.getElementById('receipt-download').addEventListener('click', () => downloadReceiptAsText(tx));
}

function downloadReceiptAsText(tx) {
  const content = `SMART FOX VTU — TRANSACTION RECEIPT
--------------------------------------
Reference:   ${tx.ref}
Service:     ${tx.service}
Description: ${tx.description}
Amount:      ${formatNaira(tx.amount)}
Date:        ${formatDate(tx.date)}
Status:      ${tx.status[0].toUpperCase() + tx.status.slice(1)}
--------------------------------------
Thank you for using Smart Fox VTU.`;
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${tx.ref}-receipt.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
