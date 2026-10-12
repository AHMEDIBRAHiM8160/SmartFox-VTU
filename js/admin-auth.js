/* Smart Fox VTU — Admin authentication */

const SFVTU_ADMIN_TOKEN_KEY = 'sfvtu_admin_token';
const SFVTU_ADMIN_API_BASE =
  window.SFVTU_API_BASE || 'http://localhost:5000';

function getAdminToken() {
  return sessionStorage.getItem(SFVTU_ADMIN_TOKEN_KEY) || '';
}

function setAdminToken(token) {
  sessionStorage.setItem(SFVTU_ADMIN_TOKEN_KEY, token);
}

function clearAdminAuth() {
  sessionStorage.removeItem(SFVTU_ADMIN_TOKEN_KEY);
  sessionStorage.removeItem('sfvtu_admin');
}

function adminHeaders(extra = {}) {
  const token = getAdminToken();

  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function adminApi(path, options = {}) {
  const response = await fetch(`${SFVTU_ADMIN_API_BASE}${path}`, {
    ...options,
    headers: adminHeaders({
      ...(options.headers || {})
    })
  });

  let data = null;

  try {
    data = await response.json();
  } catch (_) {
    data = null;
  }

  if (response.status === 401 || response.status === 403) {
    clearAdminAuth();
  }

  if (!response.ok) {
    throw new Error(
      data?.message || `Request failed with status ${response.status}.`
    );
  }

  return data;
}

function showAdminLoginError(message) {
  const box = document.getElementById('admin-login-error');

  if (!box) return;

  box.textContent = message;
  box.hidden = false;
}

function hideAdminLoginError() {
  const box = document.getElementById('admin-login-error');

  if (!box) return;

  box.hidden = true;
  box.textContent = '';
}

function setAdminLoginLoading(loading) {
  const button = document.getElementById('admin-login-btn');
  const text = document.querySelector('.admin-login-btn-text');

  if (!button) return;

  button.disabled = loading;

  if (text) {
    text.textContent = loading
      ? 'Signing in...'
      : 'Login to Admin';
  }
}

async function handleAdminLogin(event) {
  event.preventDefault();

  hideAdminLoginError();

  const form = event.currentTarget;
  const email = form.email.value.trim();
  const password = form.password.value;

  if (!email || !password) {
    showAdminLoginError('Please enter your admin email and password.');
    return;
  }

  setAdminLoginLoading(true);

  try {
    const response = await fetch(
      `${SFVTU_ADMIN_API_BASE}/api/admin/login`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password
        })
      }
    );

    let data = null;

    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }

    if (!response.ok) {
      throw new Error(
        data?.message || 'Admin login failed.'
      );
    }

    if (!data?.token) {
      throw new Error('Admin login succeeded but no authentication token was returned.');
    }

    setAdminToken(data.token);

    if (data.admin) {
      sessionStorage.setItem(
        'sfvtu_admin',
        JSON.stringify(data.admin)
      );
    }

    window.location.href = 'admin.html';
  } catch (error) {
    console.error('Admin login error:', error);
    showAdminLoginError(error.message || 'Unable to login as administrator.');
    setAdminLoginLoading(false);
  }
}

async function requireAdminAuth() {
  const token = getAdminToken();

  if (!token) {
    window.location.replace('admin-login.html');
    return null;
  }

  try {
    const data = await adminApi('/api/admin/me');

    if (!data?.admin) {
      throw new Error('Invalid admin session.');
    }

    sessionStorage.setItem(
      'sfvtu_admin',
      JSON.stringify(data.admin)
    );

    return data.admin;
  } catch (error) {
    console.error('Admin authentication failed:', error);

    clearAdminAuth();
    window.location.replace('admin-login.html');
    return null;
  }
}

function adminLogout() {
  clearAdminAuth();
  window.location.replace('admin-login.html');
}

function redirectIfAdminAuthed() {
  if (getAdminToken()) {
    window.location.replace('admin.html');
  }
}

function initAdminLogin() {
  redirectIfAdminAuthed();

  document
    .getElementById('admin-login-form')
    ?.addEventListener('submit', handleAdminLogin);
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('admin-login-form')) {
    initAdminLogin();
  }
});
