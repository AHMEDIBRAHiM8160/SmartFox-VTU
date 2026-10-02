/* ============================================
   Smart Fox VTU — Real API Authentication
   ============================================ */

const SFVTU_API_BASE = 'http://localhost:5000/api';

async function authRequest(endpoint, payload) {
  const response = await fetch(`${SFVTU_API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'An error occurred. Please try again.');
  }

  return data;
}

function saveAuthSession(data) {
  const user = data.user;

  sfvtuSet(SFVTU_KEYS.user, user);

  sfvtuSet(SFVTU_KEYS.session, {
    userId: user.id,
    email: user.email,
    token: data.token,
    loggedInAt: new Date().toISOString()
  });

  // Remove any old simulated wallet balance.
  localStorage.removeItem(SFVTU_KEYS.wallet);

  localStorage.removeItem(SFVTU_KEYS.transactionPin);
  localStorage.removeItem(SFVTU_KEYS.onboardingDone);

  return user;
}

async function registerUser({ fullName, email, phone, password }) {
  const data = await authRequest('/auth/register', {
    fullName,
    email,
    phone,
    password
  });

  return saveAuthSession(data);
}

async function loginUser({ identifier, password }) {
  const data = await authRequest('/auth/login', {
    identifier,
    password
  });

  return saveAuthSession(data);
}

/* ---------- Register page binding ---------- */

function bindRegisterForm() {
  const form = document.getElementById('register-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = form.elements.namedItem('fullName').value.trim();
    const email = form.elements.namedItem('email').value.trim();
    const phone = form.elements.namedItem('phone').value.trim();
    const password = form.elements.namedItem('password').value;
    const confirmPassword =
      form.elements.namedItem('confirmPassword').value;

    let valid = true;

    valid =
      setFieldValidity(
        'reg-fullname',
        fullName.length >= 3,
        'Enter your full name.'
      ) && valid;

    valid =
      setFieldValidity(
        'reg-email',
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
        'Enter a valid email address.'
      ) && valid;

    valid =
      setFieldValidity(
        'reg-phone',
        /^0\d{10}$/.test(phone),
        'Enter a valid 11-digit phone number.'
      ) && valid;

    valid =
      setFieldValidity(
        'reg-password',
        password.length >= 8 && password.length <= 72,
        'Password must be 8–72 characters.'
      ) && valid;

    valid =
      setFieldValidity(
        'reg-confirm',
        confirmPassword === password && confirmPassword.length > 0,
        'Passwords do not match.'
      ) && valid;

    if (!valid) return;

    const submitButton = form.querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      await registerUser({ fullName, email, phone, password });

      toast('Account created successfully!', 'success');

      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 700);
    } catch (error) {
      toast(error.message || 'Registration failed.', 'error');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

/* ---------- Login page binding ---------- */

function bindLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const identifier =
      form.elements.namedItem('identifier').value.trim();

    const password =
      form.elements.namedItem('password').value;

    let valid = true;

    valid =
      setFieldValidity(
        'login-id',
        identifier.length > 2,
        'Enter your email or phone number.'
      ) && valid;

    valid =
      setFieldValidity(
        'login-password',
        password.length > 0,
        'Enter your password.'
      ) && valid;

    if (!valid) return;

    const submitButton = form.querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      await loginUser({ identifier, password });

      toast('Welcome back!', 'success');

      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 500);
    } catch (error) {
      toast(error.message || 'Login failed.', 'error');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

/* ---------- Form validation helpers ---------- */

function setFieldValidity(fieldId, isValid, message) {
  const el = document.getElementById(fieldId);
  if (!el) return true;

  const errorEl = el.querySelector('.field-error');

  if (!isValid) {
    el.classList.add('invalid');
    if (errorEl) errorEl.textContent = message;
  } else {
    el.classList.remove('invalid');
    if (errorEl) errorEl.textContent = '';
  }

  return isValid;
}

function togglePasswordField(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;

  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = 'Hide';
  } else {
    input.type = 'password';
    btn.textContent = 'Show';
  }
}
