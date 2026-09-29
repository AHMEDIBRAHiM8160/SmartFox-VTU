/* ============================================
   Smart Fox VTU — Shared Utilities
   Local dummy-data layer. Every function below is
   written so it can later be swapped for a real
   fetch() call to the matching /api/... endpoint
   without changing any page's calling code.
   ============================================ */

const SFVTU_KEYS = {
  user: 'sfvtu_user',
  wallet: 'sfvtu_wallet',
  transactions: 'sfvtu_transactions',
  notifications: 'sfvtu_notifications',
  session: 'sfvtu_session',
  balanceHidden: 'sfvtu_balance_hidden',
  transactionPin: 'sfvtu_transaction_pin',
  onboardingDone: 'sfvtu_onboarding_done',
  pendingPurchase: 'sfvtu_pending_purchase',
  lastReceipt: 'sfvtu_last_receipt'
};

/* ---------- Brand logo mark (used across every page) ---------- */
const SFVTU_LOGO_SVG = `<img src="assets/smart-fox-brand.png" alt="Smart Fox VTU" />`;
const SFVTU_LOGO_LIGHT = `<img src="assets/smart-fox-brand-light.png" alt="Smart Fox VTU" />`;

function injectLogos() {
  document.querySelectorAll('.logo-icon').forEach(el => { if (!el.querySelector('img')) el.innerHTML = SFVTU_LOGO_SVG; });
}

/* ---------- Balance visibility (hide/show toggle) ---------- */
function isBalanceHidden() { return sfvtuGet(SFVTU_KEYS.balanceHidden, false); }
function setBalanceHidden(v) { sfvtuSet(SFVTU_KEYS.balanceHidden, v); }

function bindBalanceToggle(toggleBtnId, amountElId, getRawAmount) {
  const btn = document.getElementById(toggleBtnId);
  const amountEl = document.getElementById(amountElId);
  if (!btn || !amountEl) return;
  const update = () => {
    amountEl.textContent = isBalanceHidden() ? '₦ • • • • • •' : formatNaira(getRawAmount());
    btn.innerHTML = isBalanceHidden() ? '<i class="fa-solid fa-eye-slash" aria-hidden="true"></i>' : '<i class="fa-solid fa-eye" aria-hidden="true"></i>'; 
  };
  update();
  btn.addEventListener('click', () => { setBalanceHidden(!isBalanceHidden()); update(); });
}

function maskedWalletId() {
  const user = currentUser();
  const seed = user ? user.email.length + user.phone.slice(-4) : '4821';
  return 'SFX •••• ' + String(seed).slice(-4).padStart(4, '0');
}

/* ---------- Storage helpers ---------- */
function sfvtuGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function sfvtuSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* ---------- Formatting ---------- */
function formatNaira(amount) {
  const n = Number(amount) || 0;
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}
function generateRef(prefix) {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix || 'SFX'}-${Date.now().toString().slice(-6)}${rand}`;
}
function initials(name) {
  if (!name) return 'U';
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join('');
}

/* ---------- Dummy data bootstrap ---------- */
function sfvtuSeedIfEmpty() {
  if (!localStorage.getItem(SFVTU_KEYS.transactions)) {
    const seed = [
      { ref: generateRef('SFX'), service: 'Data', description: 'Data Purchase (MTN 2GB)', amount: 1500, type: 'debit', date: new Date(Date.now() - 86400000 * 1).toISOString(), status: 'success' },
      { ref: generateRef('SFX'), service: 'Airtime', description: 'Airtime Purchase (Airtel ₦500)', amount: 500, type: 'debit', date: new Date(Date.now() - 86400000 * 2).toISOString(), status: 'success' },
      { ref: generateRef('SFX'), service: 'Wallet', description: 'Wallet Funding', amount: 5000, type: 'credit', date: new Date(Date.now() - 86400000 * 3).toISOString(), status: 'success' },
      { ref: generateRef('SFX'), service: 'School Fees', description: 'School Fee Payment (WAEC)', amount: 15000, type: 'debit', date: new Date(Date.now() - 86400000 * 5).toISOString(), status: 'success' },
      { ref: generateRef('SFX'), service: 'Data', description: 'Data Purchase (Glo 1GB)', amount: 1200, type: 'debit', date: new Date(Date.now() - 86400000 * 6).toISOString(), status: 'pending' }
    ];
    sfvtuSet(SFVTU_KEYS.transactions, seed);
  }
  if (!localStorage.getItem(SFVTU_KEYS.notifications)) {
    sfvtuSet(SFVTU_KEYS.notifications, [
      { message: 'Your data purchase was successful.', date: new Date(Date.now() - 3600000 * 2).toISOString(), read: false },
      { message: 'Your wallet has been funded successfully.', date: new Date(Date.now() - 3600000 * 20).toISOString(), read: false },
      { message: 'Your school-fee payment is being processed.', date: new Date(Date.now() - 86400000 * 3).toISOString(), read: true },
      { message: 'Login from a new device detected.', date: new Date(Date.now() - 86400000 * 5).toISOString(), read: true }
    ]);
  }
}



/* ---------- First-login welcome + 4-digit transaction PIN ---------- */
function hasTransactionPin() {
  return /^\d{4}$/.test(String(sfvtuGet(SFVTU_KEYS.transactionPin, '')));
}
function setTransactionPin(pin) { sfvtuSet(SFVTU_KEYS.transactionPin, String(pin)); }
function isOnboardingDone() { return !!sfvtuGet(SFVTU_KEYS.onboardingDone, false); }
function setOnboardingDone(v) { sfvtuSet(SFVTU_KEYS.onboardingDone, !!v); }

function openSfvtuOverlay(html, className='sfvtu-modal-overlay') {
  const overlay = document.createElement('div');
  overlay.className = className;
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
  return overlay;
}

function showFirstLoginWelcome() {
  if (isOnboardingDone() && hasTransactionPin()) return;
  const overlay = openSfvtuOverlay(`
    <div class="sfvtu-modal sfvtu-welcome-modal">
      <div class="welcome-logo"><img src="assets/smart-fox-brand.png" alt="Smart Fox VTU"></div>
      <h3>Welcome to Smart Fox VTU</h3>
      <p class="receipt-sub">Your account is ready. Buy data, airtime and access your other VTU services from one simple dashboard.</p>
      <div class="welcome-points">
        <div><i class="fa-solid fa-wifi"></i><span>Buy data from MTN, Airtel, Glo and 9mobile.</span></div>
        <div><i class="fa-solid fa-mobile-screen-button"></i><span>Buy airtime quickly and securely.</span></div>
        <div><i class="fa-solid fa-shield-halved"></i><span>Set a 4-digit transaction PIN for purchases.</span></div>
      </div>
      <button class="btn btn-primary btn-block" id="sfvtu-welcome-ok">Continue</button>
    </div>`);
  overlay.querySelector('#sfvtu-welcome-ok').onclick = () => {
    overlay.remove();
    showTransactionPinSetup();
  };
}

function showTransactionPinSetup() {
  const overlay = openSfvtUOverlaySafe(`
    <div class="sfvtu-modal sfvtu-pin-modal">
      <div class="welcome-logo small"><img src="assets/smart-fox-brand.png" alt="Smart Fox VTU"></div>
      <h3>Create Transaction PIN</h3>
      <p class="receipt-sub">Create a 4-digit PIN. You will enter this PIN before buying data or airtime.</p>
      <form id="sfvtu-pin-form">
        <div class="field"><label>4-Digit Transaction PIN</label><input id="sfvtu-pin" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" type="password" placeholder="••••" autocomplete="off"></div>
        <div class="field"><label>Confirm PIN</label><input id="sfvtu-pin-confirm" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" type="password" placeholder="••••" autocomplete="off"></div>
        <div id="sfvtu-pin-error" class="pin-error"></div>
        <button class="btn btn-primary btn-block" type="submit">Save Transaction PIN</button>
      </form>
    </div>`);
  const form=overlay.querySelector('#sfvtu-pin-form');
  form.addEventListener('submit',e=>{
    e.preventDefault();
    const pin=overlay.querySelector('#sfvtu-pin').value.trim();
    const confirm=overlay.querySelector('#sfvtu-pin-confirm').value.trim();
    const err=overlay.querySelector('#sfvtu-pin-error');
    if(!/^\d{4}$/.test(pin)){err.textContent='PIN must contain exactly 4 digits.';return;}
    if(pin!==confirm){err.textContent='The PINs do not match.';return;}
    setTransactionPin(pin); setOnboardingDone(true); overlay.remove(); toast('Transaction PIN created successfully.','success');
  });
}
function openSfvtUOverlaySafe(html){ return openSfvtuOverlay(html); }

function startProtectedPurchase(pending) {
  if (!hasTransactionPin()) { toast('Create your 4-digit transaction PIN first.','error'); showTransactionPinSetup(); return; }
  sfvtuSet(SFVTU_KEYS.pendingPurchase, pending);
  window.location.href = 'transaction-pin.html';
}

function getPendingPurchase(){ return sfvtuGet(SFVTU_KEYS.pendingPurchase, null); }
function clearPendingPurchase(){ localStorage.removeItem(SFVTU_KEYS.pendingPurchase); }
function saveReceipt(receipt){ sfvtuSet(SFVTU_KEYS.lastReceipt, receipt); }
function getLastReceipt(){ return sfvtuGet(SFVTU_KEYS.lastReceipt, null); }

function showWelcomeAfterLoginIfNeeded(){
  if (!isOnboardingDone() || !hasTransactionPin()) setTimeout(showFirstLoginWelcome, 450);
}

/* ---------- Auth / session ---------- */
function getSession() { return sfvtuGet(SFVTU_KEYS.session, null); }
function isLoggedIn() { return !!getSession(); }

function requireAuth() {
  if (!isLoggedIn()) window.location.href = 'login.html';
}
function redirectIfAuthed() {
  if (isLoggedIn()) window.location.href = 'dashboard.html';
}
function currentUser() { return sfvtuGet(SFVTU_KEYS.user, null); }

function logoutUser() {
  localStorage.removeItem(SFVTU_KEYS.session);
  window.location.href = 'login.html';
}

/* ---------- Wallet ---------- */
function getWallet() {
  return sfvtuGet(SFVTU_KEYS.wallet, { balance: 25000 });
}
function setWalletBalance(balance) {
  sfvtuSet(SFVTU_KEYS.wallet, { balance });
}
function addTransaction(tx) {
  const list = sfvtuGet(SFVTU_KEYS.transactions, []);
  list.unshift(tx);
  sfvtuSet(SFVTU_KEYS.transactions, list);
  return tx;
}
function addNotification(message) {
  const list = sfvtuGet(SFVTU_KEYS.notifications, []);
  list.unshift({ message, date: new Date().toISOString(), read: false });
  sfvtuSet(SFVTU_KEYS.notifications, list);
}
function getTransactions() {
  return sfvtuGet(SFVTU_KEYS.transactions, []);
}

/* ---------- Toast ---------- */
function toast(message, type) {
  let stack = document.getElementById('toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'toast-stack';
    document.body.appendChild(stack);
  }
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 3400);
}

/* ---------- Nav (app shell) ---------- */
const SFVTU_NAV_ITEMS = [
  { key: 'dashboard', href: 'dashboard.html', icon: '<i class=\"fa-solid fa-house\"></i>', label: 'Dashboard' },
  { key: 'airtime', href: 'airtime.html', icon: '<i class=\"fa-solid fa-mobile-screen-button\"></i>', label: 'Airtime' },
  { key: 'data', href: 'data.html', icon: '<i class=\"fa-solid fa-wifi\"></i>', label: 'Data' },
  { key: 'school-fees', href: 'school-fees.html', icon: '<i class=\"fa-solid fa-graduation-cap\"></i>', label: 'School Fees' },
  { key: 'wallet', href: 'wallet.html', icon: '<i class=\"fa-solid fa-wallet\"></i>', label: 'Wallet' },
  { key: 'transactions', href: 'transactions.html', icon: '<i class=\"fa-solid fa-receipt\"></i>', label: 'Transactions' },
  { key: 'notifications', href: 'notifications.html', icon: '<i class=\"fa-regular fa-bell\"></i>', label: 'Notifications' },
  { key: 'profile', href: 'profile.html', icon: '<i class=\"fa-regular fa-user\"></i>', label: 'Profile' },
  { key: 'help', href: 'help.html', icon: '<i class=\"fa-regular fa-circle-question\"></i>', label: 'Help & Support' }
];
const SFVTU_BOTTOM_ITEMS = ['dashboard', 'airtime', 'data', 'wallet', 'more'];

function renderAppShell(activeKey, pageTitle, pageSub) {
  const user = currentUser() || { fullName: 'Guest User' };
  const wallet = getWallet();
  const unread = sfvtuGet(SFVTU_KEYS.notifications, []).filter(n => !n.read).length;

  const sidebarLinks = SFVTU_NAV_ITEMS.map(item => `
    <a href="${item.href}" class="${item.key === activeKey ? 'active' : ''}">
      <span class="ic">${item.icon}</span> ${item.label}
    </a>`).join('');

  const bottomLinks = SFVTU_NAV_ITEMS.filter(i => SFVTU_BOTTOM_ITEMS.includes(i.key)).map(item => `
    <a href="${item.href}" class="${item.key === activeKey ? 'active' : ''}">
      <span class="ic">${item.icon}</span>${item.label.split(' ')[0]}
    </a>`).join('');

  const moreLinks = SFVTU_NAV_ITEMS.filter(i => !SFVTU_BOTTOM_ITEMS.includes(i.key)).map(item => `
    <a href="${item.href}"><span class="ic">${item.icon}</span> ${item.label}</a>`).join('');

  document.getElementById('sfvtu-shell').innerHTML = `
    <aside class="sidebar">
      <a href="dashboard.html" class="logo"><span class="logo-icon">${SFVTU_LOGO_LIGHT}</span><span>Smart Fox <em>VTU</em></span></a>
      <nav class="sidebar-nav">${sidebarLinks}</nav>
      <div class="sidebar-foot">
        <a href="#" id="sfvtu-logout-link"><i class="fa-solid fa-arrow-right-from-bracket"></i> Logout</a>
      </div>
    </aside>
    <div>
      <header class="app-topbar">
        <div class="app-search"><i class="fa-solid fa-magnifying-glass"></i><input type="text" placeholder="Search anything..." /></div>
        <div class="topbar-right">
          <a href="dashboard.html" class="topbar-brand" aria-label="Smart Fox VTU dashboard"><span class="brand-mark"><img src="assets/smart-fox-brand.png" alt="Smart Fox VTU"></span><span>Smart Fox <em>VTU</em></span></a>
          <a href="notifications.html" class="bell"><i class="fa-regular fa-bell"></i>${unread ? '<span class="dot"></span>' : ''}</a>
          <a href="profile.html" class="avatar-chip"><span class="av">${initials(user.fullName)}</span><span>Hello, ${(user.fullName || 'User').split(' ')[0]}</span></a>
        </div>
      </header>
      <main class="app-main">
        ${pageTitle ? `<h1 class="page-title">${pageTitle}</h1>` : ''}
        ${pageSub ? `<p class="page-sub">${pageSub}</p>` : ''}
        <div id="sfvtu-page-content"></div>
      </main>
    </div>
    <nav class="bottom-nav">
      <div class="bn-row">
        ${bottomLinks}
        <a href="#" id="sfvtu-more-btn"><span class="ic">⋯</span>More</a>
      </div>
    </nav>
    <div class="mobile-more-sheet" id="sfvtu-more-sheet">
      <div class="more-panel">
        ${moreLinks}
        <a href="#" id="sfvtu-logout-link-mobile"><i class="fa-solid fa-arrow-right-from-bracket"></i> Logout</a>
      </div>
    </div>
  `;

  document.getElementById('sfvtu-logout-link').addEventListener('click', (e) => { e.preventDefault(); logoutUser(); });
  const logoutMobile = document.getElementById('sfvtu-logout-link-mobile');
  if (logoutMobile) logoutMobile.addEventListener('click', (e) => { e.preventDefault(); logoutUser(); });

  const moreBtn = document.getElementById('sfvtu-more-btn');
  const moreSheet = document.getElementById('sfvtu-more-sheet');
  if (moreBtn) {
    moreBtn.addEventListener('click', (e) => { e.preventDefault(); moreSheet.classList.add('open'); });
    moreSheet.addEventListener('click', (e) => { if (e.target === moreSheet) moreSheet.classList.remove('open'); });
  }
}

/* ---------- Landing page nav toggle + FAQ (used only on index.html) ---------- */
function initPublicNav() {
  const toggle = document.getElementById('nav-toggle-btn');
  const links = document.getElementById('nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open-mobile'));
  }
  document.querySelectorAll('.faq-item').forEach(item => {
    item.querySelector('.faq-q').addEventListener('click', () => item.classList.toggle('open'));
  });
}

document.addEventListener('DOMContentLoaded', () => { sfvtuSeedIfEmpty(); injectLogos(); });
