/* ============================================
   Smart Fox VTU — Data (data.js)
   getDataPlans() returns local dummy plans now.
   Later: GET /api/data/plans?network=
   purchaseData() → POST /api/data/purchase
   ============================================ */

const SFVTU_DATA_PLANS = {
  mtn: {
    normal: [
      { size: '1GB', validity: '1 Day', price: 350 }, { size: '2GB', validity: '14 Days', price: 1500 },
      { size: '3GB', validity: '30 Days', price: 2000 }, { size: '5GB', validity: '30 Days', price: 3500 },
      { size: '10GB', validity: '30 Days', price: 5000 }, { size: '20GB', validity: '30 Days', price: 10000 }
    ],
    corporate: [
      { size: '1GB', validity: '30 Days', price: 300 }, { size: '2GB', validity: '30 Days', price: 850 },
      { size: '5GB', validity: '30 Days', price: 2100 }, { size: '10GB', validity: '30 Days', price: 4000 }
    ],
    gift: [
      { size: '1GB', validity: '7 Days', price: 320 }, { size: '2GB', validity: '14 Days', price: 1200 },
      { size: '5GB', validity: '30 Days', price: 3000 }, { size: '10GB', validity: '30 Days', price: 4700 }
    ]
  },
  airtel: {
    normal: [
      { size: '1GB', validity: '1 Day', price: 300 }, { size: '2GB', validity: '14 Days', price: 1400 },
      { size: '3GB', validity: '30 Days', price: 1900 }, { size: '5GB', validity: '30 Days', price: 3300 },
      { size: '10GB', validity: '30 Days', price: 4800 }, { size: '20GB', validity: '30 Days', price: 9500 }
    ],
    corporate: [
      { size: '1GB', validity: '30 Days', price: 280 }, { size: '2GB', validity: '30 Days', price: 800 },
      { size: '5GB', validity: '30 Days', price: 2000 }, { size: '10GB', validity: '30 Days', price: 3800 }
    ],
    gift: [
      { size: '1GB', validity: '7 Days', price: 280 }, { size: '2GB', validity: '14 Days', price: 1100 },
      { size: '5GB', validity: '30 Days', price: 2900 }, { size: '10GB', validity: '30 Days', price: 4500 }
    ]
  },
  glo: {
    normal: [
      { size: '1GB', validity: '7 Days', price: 500 }, { size: '2GB', validity: '14 Days', price: 1000 },
      { size: '3GB', validity: '30 Days', price: 1500 }, { size: '5GB', validity: '30 Days', price: 2500 },
      { size: '10GB', validity: '30 Days', price: 4500 }, { size: '20GB', validity: '30 Days', price: 8000 }
    ],
    corporate: [
      { size: '1GB', validity: '30 Days', price: 350 }, { size: '2GB', validity: '30 Days', price: 850 },
      { size: '5GB', validity: '30 Days', price: 2200 }, { size: '10GB', validity: '30 Days', price: 4200 }
    ],
    gift: [
      { size: '1GB', validity: '7 Days', price: 450 }, { size: '2GB', validity: '14 Days', price: 900 },
      { size: '5GB', validity: '30 Days', price: 2300 }, { size: '10GB', validity: '30 Days', price: 4200 }
    ]
  },
  '9mobile': {
    normal: [
      { size: '1GB', validity: '30 Days', price: 1000 }, { size: '2GB', validity: '30 Days', price: 2000 },
      { size: '3GB', validity: '30 Days', price: 2500 }, { size: '5GB', validity: '30 Days', price: 3800 },
      { size: '10GB', validity: '30 Days', price: 6000 }, { size: '20GB', validity: '30 Days', price: 11000 }
    ],
    corporate: [
      { size: '1GB', validity: '30 Days', price: 800 }, { size: '2GB', validity: '30 Days', price: 1600 },
      { size: '5GB', validity: '30 Days', price: 3200 }, { size: '10GB', validity: '30 Days', price: 5500 }
    ],
    gift: [
      { size: '1GB', validity: '30 Days', price: 900 }, { size: '2GB', validity: '30 Days', price: 1800 },
      { size: '5GB', validity: '30 Days', price: 3500 }, { size: '10GB', validity: '30 Days', price: 5800 }
    ]
  }
};

function getDataPlans(network, category = 'normal') {
  return (SFVTU_DATA_PLANS[network] && SFVTU_DATA_PLANS[network][category]) || [];
}

function purchaseData({ network, phone, plan }) {
  const wallet = getWallet();
  if (plan.price > wallet.balance) throw new Error('Insufficient wallet balance.');
  setWalletBalance(wallet.balance - plan.price);
  const tx = {
    ref: generateRef('DTA'),
    service: 'Data',
    description: `Data Purchase (${network.toUpperCase()} ${plan.size})`,
    amount: plan.price,
    type: 'debit',
    date: new Date().toISOString(),
    status: 'success'
  };
  addTransaction(tx);
  addNotification('Your data purchase was successful.');
  return tx;
}

let sfvtuDataNetwork = null;
let sfvtuDataPhone = '';

function initDataPage() {
  document.getElementById('data-balance').textContent = formatNaira(getWallet().balance);

  const grid = document.getElementById('data-network-grid');
  grid.innerHTML = SFVTU_NETWORKS.map(n => `
    <div class="network-tile" data-net="${n.key}">
      <img class="network-logo" src="${n.logo}" alt="${n.label} logo">
      <span class="net-label">${n.label}</span>
    </div>`).join('');

  const plansWrap = document.getElementById('data-plans-wrap');
  const plansGrid = document.getElementById('data-plan-grid');
  let selectedCategory = 'normal';

  grid.querySelectorAll('.network-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      grid.querySelectorAll('.network-tile').forEach(t => t.classList.remove('selected'));
      tile.classList.add('selected');
      sfvtuDataNetwork = tile.dataset.net;
      renderDataPlans();
    });
  });

  document.getElementById('data-phone').addEventListener('input', (e) => { sfvtuDataPhone = e.target.value.trim(); });

  function renderDataPlans() {
    plansWrap.classList.remove('hidden');
    const categoryTabs = ['normal', 'corporate', 'gift'];
    const existingTabs = document.getElementById('data-category-tabs');
    if (existingTabs) existingTabs.innerHTML = categoryTabs.map(c => `<button type="button" class="data-category-tab ${c === selectedCategory ? 'active' : ''}" data-category="${c}">${c === 'normal' ? 'Regular Data' : c === 'corporate' ? 'Corporate Data' : 'Gift Data'}</button>`).join('');
    const plans = getDataPlans(sfvtuDataNetwork, selectedCategory);
    plansGrid.innerHTML = plans.map((p, i) => `
      <div class="plan-card">
        <span class="plan-type-badge">${selectedCategory === 'normal' ? 'Regular' : selectedCategory}</span>
        <div class="plan-size">${p.size}</div>
        <div class="plan-valid">${p.validity}</div>
        <div class="plan-price">${formatNaira(p.price)}</div>
        <button class="btn btn-primary btn-sm btn-block" data-idx="${i}">Buy Now</button>
      </div>`).join('');

    const tabs = document.querySelectorAll('#data-category-tabs .data-category-tab');
    tabs.forEach(tab => tab.addEventListener('click', () => { selectedCategory = tab.dataset.category; renderDataPlans(); }));

    plansGrid.querySelectorAll('button[data-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const phone = document.getElementById('data-phone').value.trim();
        if (!/^0\d{10}$/.test(phone)) { toast('Enter a valid 11-digit phone number first.', 'error'); return; }
        const plan = plans[Number(btn.dataset.idx)];
        if (plan.price > getWallet().balance) { toast('Insufficient wallet balance.', 'error'); return; }

        startProtectedPurchase({
          type: 'data',
          network: sfvtuDataNetwork,
          phone,
          plan,
          amount: plan.price
        });
      });
    });
  }
}
