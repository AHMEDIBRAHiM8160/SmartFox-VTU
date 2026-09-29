/* ============================================
   Smart Fox VTU — Auth (auth.js)
   Simulated for now. Swap the bodies of
   registerUser()/loginUser() for calls to
   POST /api/auth/register and /api/auth/login
   when the backend is ready.
   ============================================ */

function registerUser({ fullName, email, phone, password }) {
  const user = { fullName, email, phone, createdAt: new Date().toISOString() };
  sfvtuSet(SFVTU_KEYS.user, user);
  sfvtuSet(SFVTU_KEYS.wallet, { balance: 25000 }); // dummy starter balance
  sfvtuSet(SFVTU_KEYS.session, { email, loggedInAt: new Date().toISOString() });
  localStorage.removeItem(SFVTU_KEYS.transactionPin);
  localStorage.removeItem(SFVTU_KEYS.onboardingDone);
  return user;
}

function loginUser({ identifier, password }) {
  // Simulated authentication — any credentials succeed once a user record exists,
  // otherwise a fresh dummy account is created so the demo always works.
  let user = currentUser();
  if (!user) {
    user = { fullName: 'Ahmed Yusuf', email: identifier.includes('@') ? identifier : 'ahmed@example.com', phone: identifier.includes('@') ? '08012345678' : identifier, createdAt: new Date().toISOString() };
    sfvtuSet(SFVTU_KEYS.user, user);
    if (!localStorage.getItem(SFVTU_KEYS.wallet)) sfvtuSet(SFVTU_KEYS.wallet, { balance: 25000 });
  }
  sfvtuSet(SFVTU_KEYS.session, { email: user.email, loggedInAt: new Date().toISOString() });
  return user;
}

/* ---------- Register page binding ---------- */
function bindRegisterForm() {
  const form = document.getElementById('register-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let valid = true;

    const fullName = form.fullName.value.trim();
    const email = form.email.value.trim();
    const phone = form.phone.value.trim();
    const password = form.password.value;
    const confirmPassword = form.confirmPassword.value;

    valid = setFieldValidity('reg-fullname', fullName.length >= 3, 'Enter your full name.') && valid;
    valid = setFieldValidity('reg-email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Enter a valid email address.') && valid;
    valid = setFieldValidity('reg-phone', /^0\d{10}$/.test(phone), 'Enter a valid 11-digit phone number.') && valid;
    valid = setFieldValidity('reg-password', password.length >= 6, 'Password must be at least 6 characters.') && valid;
    valid = setFieldValidity('reg-confirm', confirmPassword === password && confirmPassword.length > 0, 'Passwords do not match.') && valid;

    if (!valid) return;

    registerUser({ fullName, email, phone, password });
    toast('Account created successfully!', 'success');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 700);
  });
}

/* ---------- Login page binding ---------- */
function bindLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let valid = true;
    const identifier = form.identifier.value.trim();
    const password = form.password.value;

    valid = setFieldValidity('login-id', identifier.length > 2, 'Enter your email or phone number.') && valid;
    valid = setFieldValidity('login-password', password.length > 0, 'Enter your password.') && valid;

    if (!valid) return;

    loginUser({ identifier, password });
    toast('Welcome back!', 'success');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 500);
  });
}

function setFieldValidity(fieldId, isValid, message) {
  const el = document.getElementById(fieldId);
  if (!el) return true;
  const errorEl = el.querySelector('.field-error');
  if (!isValid) {
    el.classList.add('invalid');
    if (errorEl) errorEl.textContent = message;
  } else {
    el.classList.remove('invalid');
  }
  return isValid;
}

function togglePasswordField(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') { input.type = 'text'; btn.textContent = 'Hide'; }
  else { input.type = 'password'; btn.textContent = 'Show'; }
}
