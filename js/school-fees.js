/* ============================================
   Smart Fox VTU — School Fees (school-fees.js)
   paySchoolFees() simulates the flow now.
   Later: POST /api/school-fees/pay
   ============================================ */

const SFVTU_INSTITUTIONS = [
  'University of Lagos (UNILAG)',
  'Ahmadu Bello University (ABU Zaria)',
  'Bayero University Kano (BUK)',
  'University of Ibadan (UI)',
  'Federal Polytechnic Bida',
  'Kaduna State University (KASU)',
  'WAEC (West African Examinations Council)',
  'JAMB (Joint Admissions and Matriculation Board)'
];

const SFVTU_FEE_TYPES = ['Tuition Fee', 'Acceptance Fee', 'Hostel Fee', 'Exam Fee', 'Departmental Due', 'Registration Fee'];

function paySchoolFees({ institution, studentId, studentName, feeType, amount }) {
  const wallet = getWallet();
  if (amount > wallet.balance) throw new Error('Insufficient wallet balance.');
  setWalletBalance(wallet.balance - amount);
  const tx = {
    ref: generateRef('SCH'),
    service: 'School Fees',
    description: `School Fee Payment (${institution})`,
    amount,
    type: 'debit',
    date: new Date().toISOString(),
    status: 'pending',
    meta: { institution, studentId, studentName, feeType }
  };
  addTransaction(tx);
  addNotification('Your school-fee payment is being processed.');
  return tx;
}

function initSchoolFeesPage() {
  document.getElementById('school-balance').textContent = formatNaira(getWallet().balance);

  const instSelect = document.getElementById('sf-institution');
  instSelect.innerHTML = '<option value="">Select institution</option>' + SFVTU_INSTITUTIONS.map(i => `<option>${i}</option>`).join('');

  const feeSelect = document.getElementById('sf-fee-type');
  feeSelect.innerHTML = '<option value="">Select fee type</option>' + SFVTU_FEE_TYPES.map(f => `<option>${f}</option>`).join('');

  const form = document.getElementById('school-fees-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const institution = instSelect.value;
    const studentId = document.getElementById('sf-student-id').value.trim();
    const studentName = document.getElementById('sf-student-name').value.trim();
    const feeType = feeSelect.value;
    const amount = Number(document.getElementById('sf-amount').value);

    if (!institution) { toast('Select an institution.', 'error'); return; }
    if (!studentId) { toast('Enter the student/application ID.', 'error'); return; }
    if (!studentName) { toast('Enter the student name.', 'error'); return; }
    if (!feeType) { toast('Select a fee type.', 'error'); return; }
    if (!amount || amount < 1000) { toast('Enter a valid amount.', 'error'); return; }
    if (amount > getWallet().balance) { toast('Insufficient wallet balance.', 'error'); return; }

    openConfirmModal({
      title: 'Confirm School Fee Payment',
      rows: [
        ['Institution', institution],
        ['Student', studentName],
        ['Fee Type', feeType],
        ['Amount', formatNaira(amount)]
      ],
      confirmLabel: 'Pay Now',
      onConfirm: (done) => {
        setTimeout(() => {
          const tx = paySchoolFees({ institution, studentId, studentName, feeType, amount });
          done();
          renderSchoolFeeReceipt(tx);
          document.getElementById('school-balance').textContent = formatNaira(getWallet().balance);
          form.reset();
        }, 1000);
      }
    });
  });
}

function renderSchoolFeeReceipt(tx) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box receipt">
      <div class="receipt-status">
        <div class="check">✓</div>
        <h3>Payment Submitted</h3>
      </div>
      <div class="modal-row"><span>Student Name</span><span>${tx.meta.studentName}</span></div>
      <div class="modal-row"><span>Institution</span><span>${tx.meta.institution}</span></div>
      <div class="modal-row"><span>Reference Number</span><span>${tx.ref}</span></div>
      <div class="modal-row"><span>Amount</span><span>${formatNaira(tx.amount)}</span></div>
      <div class="modal-row"><span>Date</span><span>${formatDate(tx.date)}</span></div>
      <div class="modal-row"><span>Status</span><span class="badge badge-pending">Pending</span></div>
      <div class="modal-actions">
        <button class="btn btn-primary btn-block" id="sf-receipt-close">Done</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('sf-receipt-close').addEventListener('click', () => overlay.remove());
}
