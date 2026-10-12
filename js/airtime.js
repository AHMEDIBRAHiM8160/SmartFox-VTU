/* ============================================
   Smart Fox VTU — Airtime (airtime.js)

   Airtime purchases are disabled until a real
   VTU provider is connected.

   Future API:
   POST /api/airtime/purchase
   ============================================ */

let sfvtuAirtimeNetwork = null;

async function loadAirtimeWalletBalance() {
  const balanceEl = document.getElementById('airtime-balance');
  const session = sfvtuGet(SFVTU_KEYS.session, null);

  if (!balanceEl || !session || !session.token) {
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

    balanceEl.textContent = formatNaira(Number(result.wallet.balance));
  } catch (error) {
    console.error('Airtime wallet error:', error.message);
    balanceEl.textContent = formatNaira(0);
  }
}

function initAirtimePage() {
  loadAirtimeWalletBalance();

  const grid = document.getElementById('network-grid');

  if (grid) {
    grid.innerHTML = SFVTU_NETWORKS.map(n => `
      <div class="network-tile" data-net="${n.key}">
        <img class="network-logo" src="${n.logo}" alt="${n.label} logo">
        <span class="net-label">${n.label}</span>
      </div>
    `).join('');

    grid.querySelectorAll('.network-tile').forEach(tile => {
      tile.addEventListener('click', () => {
        grid.querySelectorAll('.network-tile').forEach(t => {
          t.classList.remove('selected');
        });

        tile.classList.add('selected');
        sfvtuAirtimeNetwork = tile.dataset.net;
      });
    });
  }

  document.querySelectorAll('#airtime-amount-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#airtime-amount-chips .chip').forEach(c => {
        c.classList.remove('selected');
      });

      chip.classList.add('selected');

      const amountInput = document.getElementById('airtime-amount');

      if (amountInput) {
        amountInput.value = chip.dataset.amount;
      }
    });
  });

  const form = document.getElementById('airtime-form');

  if (!form) {
    return;
  }

  form.addEventListener('submit', event => {
    event.preventDefault();

    const phone = document.getElementById('airtime-phone').value.trim();
    const amount = Number(document.getElementById('airtime-amount').value);

    if (!sfvtuAirtimeNetwork) {
      toast('Select a network.', 'error');
      return;
    }

    if (!/^0\d{10}$/.test(phone)) {
      toast('Enter a valid 11-digit phone number.', 'error');
      return;
    }

    if (!Number.isFinite(amount) || amount < 50) {
      toast('Enter a valid amount (min ₦50).', 'error');
      return;
    }

    toast(
      'Airtime purchase is currently unavailable. Please try again after a VTU provider is connected.',
      'error'
    );
  });
}
