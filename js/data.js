/* ============================================
   Smart Fox VTU — Data (data.js)

   Data plans and purchases are intentionally
   disabled until a real VTU provider is connected.

   Future API:
   GET  /api/data/plans?network=
   POST /api/data/purchase
   ============================================ */

let sfvtuDataNetwork = null;
let sfvtuDataPhone = '';

function initDataPage() {
  const balanceEl = document.getElementById('data-balance');
  const grid = document.getElementById('data-network-grid');
  const plansWrap = document.getElementById('data-plans-wrap');

  if (balanceEl) {
    const session = sfvtuGet(SFVTU_KEYS.session, null);

    if (session && session.token) {
      loadDataWalletBalance();
    } else {
      balanceEl.textContent = formatNaira(0);
    }
  }

  if (grid) {
    grid.innerHTML = SFVTU_NETWORKS.map(n => `
      <div class="network-tile" data-net="${n.key}">
        <img class="network-logo" src="${n.logo}" alt="${n.label} logo">
        <span class="net-label">${n.label}</span>
      </div>
    `).join('');

    grid.querySelectorAll('.network-tile').forEach(tile => {
      tile.addEventListener('click', () => {
        grid.querySelectorAll('.network-tile').forEach(t => t.classList.remove('selected'));
        tile.classList.add('selected');
        sfvtuDataNetwork = tile.dataset.net;

        if (plansWrap) {
          plansWrap.classList.remove('hidden');
        }

        const plansGrid = document.getElementById('data-plan-grid');
        const categoryTabs = document.getElementById('data-category-tabs');

        if (categoryTabs) {
          categoryTabs.innerHTML = '';
        }

        if (plansGrid) {
          plansGrid.innerHTML = `
            <div style="padding:18px 0;color:var(--text-muted);font-size:0.9rem;">
              Data plans are currently unavailable. Please try again later.
            </div>
          `;
        }
      });
    });
  }

  const phoneInput = document.getElementById('data-phone');

  if (phoneInput) {
    phoneInput.addEventListener('input', event => {
      sfvtuDataPhone = event.target.value.trim();
    });
  }
}

async function loadDataWalletBalance() {
  const balanceEl = document.getElementById('data-balance');
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
    console.error('Data wallet error:', error.message);
    balanceEl.textContent = formatNaira(0);
  }
}
