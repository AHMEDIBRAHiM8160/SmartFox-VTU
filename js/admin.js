/* Smart Fox VTU — Admin Dashboard frontend demo
   Milestone 1: local dummy data only. Replace the data functions with /api/admin/* later. */

const ADMIN_USERS = [
  {name:'Ahmed Yusuf',email:'ahmed@example.com',phone:'08031234567',joined:'2026-06-02',wallet:25000,status:'Active'},
  {name:'Fatima Bello',email:'fatima.bello@example.com',phone:'08141234567',joined:'2026-06-14',wallet:18200,status:'Active'},
  {name:'Chinedu Okafor',email:'chinedu.o@example.com',phone:'07061234567',joined:'2026-07-01',wallet:4500,status:'Active'},
  {name:'Blessing Adeyemi',email:'blessing.a@example.com',phone:'09011234567',joined:'2026-07-19',wallet:0,status:'Suspended'},
  {name:'Ibrahim Musa',email:'ibrahim.m@example.com',phone:'08051234567',joined:'2026-08-03',wallet:7300,status:'Active'},
  {name:'Grace Effiong',email:'grace.e@example.com',phone:'07081234567',joined:'2026-09-10',wallet:12100,status:'Active'},
  {name:'Musa Abdullahi',email:'musa.a@example.com',phone:'08101234567',joined:'2026-09-12',wallet:34000,status:'Active'},
  {name:'Aisha Umar',email:'aisha.u@example.com',phone:'09021234567',joined:'2026-09-18',wallet:5600,status:'Active'}
];

const ADMIN_TX = [
  {ref:'SFX-882914',user:'Ahmed Yusuf',service:'Data',amount:1500,date:'Sep 25, 2026 · 09:04',status:'success'},
  {ref:'SFX-114420',user:'Fatima Bello',service:'Airtime',amount:500,date:'Sep 25, 2026 · 08:52',status:'success'},
  {ref:'SFX-663012',user:'Chinedu Okafor',service:'School Fees',amount:45000,date:'Sep 25, 2026 · 08:41',status:'pending'},
  {ref:'SFX-990211',user:'Blessing Adeyemi',service:'Wallet Funding',amount:10000,date:'Sep 25, 2026 · 08:22',status:'success'},
  {ref:'SFX-201938',user:'Ibrahim Musa',service:'Data',amount:1200,date:'Sep 25, 2026 · 08:10',status:'failed'},
  {ref:'SFX-773301',user:'Grace Effiong',service:'Airtime',amount:2000,date:'Sep 24, 2026 · 22:17',status:'success'},
  {ref:'SFX-442817',user:'Musa Abdullahi',service:'School Fees',amount:30000,date:'Sep 24, 2026 · 20:05',status:'success'},
  {ref:'SFX-338102',user:'Aisha Umar',service:'Data',amount:2500,date:'Sep 24, 2026 · 19:43',status:'pending'}
];

const ADMIN_WALLET = [
  {ref:'WAL-99102',user:'Ahmed Yusuf',type:'Credit',amount:10000,balance:25000,status:'success'},
  {ref:'WAL-99018',user:'Fatima Bello',type:'Debit',amount:1500,balance:18200,status:'success'},
  {ref:'WAL-98987',user:'Ibrahim Musa',type:'Credit',amount:5000,balance:7300,status:'success'},
  {ref:'WAL-98881',user:'Chinedu Okafor',type:'Debit',amount:45000,balance:4500,status:'pending'},
  {ref:'WAL-98774',user:'Grace Effiong',type:'Debit',amount:2000,balance:12100,status:'success'},
  {ref:'WAL-98612',user:'Aisha Umar',type:'Credit',amount:8000,balance:5600,status:'success'}
];

const ADMIN_SERVICES = [
  {name:'Airtime',desc:'MTN, Airtel, Glo and 9mobile airtime purchases.',icon:'fa-mobile-screen-button',active:true,provider:'VTU API'},
  {name:'Data',desc:'Network data plans and automatic fulfilment.',icon:'fa-wifi',active:true,provider:'VTU API'},
  {name:'School Fees',desc:'Education and school-fee payment services.',icon:'fa-graduation-cap',active:true,provider:'Education API'},
  {name:'Electricity',desc:'Power bill and meter token services.',icon:'fa-bolt',active:true,provider:'VTU API'},
  {name:'Cable TV',desc:'TV subscriptions and renewals.',icon:'fa-tv',active:true,provider:'VTU API'},
  {name:'Exam Pins',desc:'Education PIN and examination services.',icon:'fa-ticket',active:true,provider:'Education API'},
  {name:'Airtime to Cash',desc:'Future conversion workflow with compliance controls.',icon:'fa-money-bill-transfer',active:false,provider:'Coming later'},
  {name:'Bill Payments',desc:'Future utility and recurring bill services.',icon:'fa-file-invoice-dollar',active:false,provider:'Coming later'},
  {name:'Bulk Services',desc:'Future bulk airtime/data and business tools.',icon:'fa-layer-group',active:false,provider:'Coming later'}
];

const SECTION_META={
  overview:['Platform Control','Admin Dashboard'],users:['Customer Management','Users'],transactions:['Financial Activity','Transactions'],wallets:['Wallet Management','Wallet Activities'],services:['Service Control','Services'],reports:['Analytics','Reports'],settings:['Configuration','Settings']
};
let activeTxFilter='all';

function money(n){return formatNaira ? formatNaira(n) : '₦'+Number(n).toLocaleString('en-NG',{minimumFractionDigits:2});}
function statusBadge(status,label){return `<span class="status-badge ${status}"><i class="fa-solid fa-circle"></i>${label||status[0].toUpperCase()+status.slice(1)}</span>`;}
function toast(message,type='success'){const stack=document.getElementById('adminToastStack');if(!stack)return;const el=document.createElement('div');el.className='toast '+type;el.innerHTML=`<i class="fa-solid ${type==='success'?'fa-circle-check':'fa-circle-info'}"></i> ${message}`;stack.appendChild(el);setTimeout(()=>el.remove(),2600);}

function switchAdminSection(section){
  document.querySelectorAll('.admin-section').forEach(s=>s.classList.remove('active'));
  document.getElementById('section-'+section)?.classList.add('active');
  document.querySelectorAll('.admin-nav-link').forEach(b=>b.classList.toggle('active',b.dataset.section===section));
  const meta=SECTION_META[section]||SECTION_META.overview;
  document.getElementById('section-eyebrow').textContent=meta[0];
  document.getElementById('section-title').textContent=meta[1];
  window.scrollTo({top:0,behavior:'smooth'});
  closeMobileAdmin();
}

function renderRevenueChart(){
  const wrap=document.getElementById('revenueChart');if(!wrap)return;
  const rows=[['Apr',55,38,26],['May',68,45,30],['Jun',48,58,35],['Jul',83,42,47],['Aug',65,72,50],['Sep',94,61,68]];
  wrap.innerHTML=rows.map(r=>`<div class="chart-col"><div class="chart-bars"><i class="chart-bar" style="height:${r[1]}%"></i><i class="chart-bar orange" style="height:${r[2]}%"></i><i class="chart-bar green" style="height:${r[3]}%"></i></div><span class="chart-label">${r[0]}</span></div>`).join('');
}
function renderHealth(){
  const wrap=document.getElementById('healthList');if(!wrap)return;
  wrap.innerHTML=ADMIN_SERVICES.slice(0,6).map(s=>`<div class="health-item"><i class="fa-solid ${s.icon}"></i><div><strong>${s.name}</strong><small>${s.provider}</small></div><span class="status-dot" title="${s.active?'Active':'Coming later'}"></span></div>`).join('');
}
function renderMiniTx(){
  const wrap=document.getElementById('adminMiniTransactions');if(!wrap)return;
  wrap.innerHTML=ADMIN_TX.slice(0,5).map(t=>`<div class="mini-tx"><div class="mini-tx-main"><span class="mini-tx-icon"><i class="fa-solid ${t.service==='Data'?'fa-wifi':t.service==='Airtime'?'fa-mobile-screen-button':t.service==='School Fees'?'fa-graduation-cap':'fa-wallet'}"></i></span><div><strong>${t.user}</strong><small>${t.service} · ${t.ref}</small></div></div><div class="mini-tx-amount"><strong>${money(t.amount)}</strong><small>${statusBadge(t.status)}</small></div></div>`).join('');
}
function renderUsers(){
  const body=document.getElementById('usersTable');if(!body)return;
  const q=(document.getElementById('userSearch')?.value||'').toLowerCase().trim();const st=document.getElementById('userStatusFilter')?.value||'all';
  const rows=ADMIN_USERS.filter(u=>(st==='all'||u.status===st)&&(!q||`${u.name} ${u.email} ${u.phone}`.toLowerCase().includes(q)));
  body.innerHTML=rows.map(u=>`<tr><td><div class="user-cell"><span class="user-mini-avatar">${initials(u.name)}</span><div><strong>${u.name}</strong><small>${u.email}</small></div></div></td><td>${u.phone}</td><td>${u.joined}</td><td>${money(u.wallet)}</td><td>${statusBadge(u.status.toLowerCase(),u.status)}</td><td><button class="row-action" title="View user" data-user="${u.email}"><i class="fa-solid fa-arrow-up-right-from-square"></i></button></td></tr>`).join('')||`<tr><td colspan="6" style="text-align:center;padding:25px;color:var(--muted)">No users found.</td></tr>`;
}
function renderTransactions(){
  const body=document.getElementById('transactionsTable');if(!body)return;
  const q=(document.getElementById('transactionSearch')?.value||'').toLowerCase().trim();
  const rows=ADMIN_TX.filter(t=>(activeTxFilter==='all'||t.status===activeTxFilter)&&(!q||`${t.ref} ${t.user} ${t.service}`.toLowerCase().includes(q)));
  body.innerHTML=rows.map(t=>`<tr><td><strong>${t.ref}</strong></td><td>${t.user}</td><td>${t.service}</td><td>${money(t.amount)}</td><td>${t.date}</td><td>${statusBadge(t.status)}</td><td><button class="row-action" title="View transaction" data-ref="${t.ref}"><i class="fa-solid fa-eye"></i></button></td></tr>`).join('')||`<tr><td colspan="7" style="text-align:center;padding:25px;color:var(--muted)">No transactions found.</td></tr>`;
}
function renderWallets(){
  const body=document.getElementById('walletTable');if(!body)return;
  body.innerHTML=ADMIN_WALLET.map(w=>`<tr><td><strong>${w.ref}</strong></td><td>${w.user}</td><td><span style="color:${w.type==='Credit'?'var(--success)':'var(--danger)'}"><i class="fa-solid ${w.type==='Credit'?'fa-arrow-down':'fa-arrow-up'}"></i> ${w.type}</span></td><td>${money(w.amount)}</td><td>${money(w.balance)}</td><td>${statusBadge(w.status)}</td></tr>`).join('');
}
function renderServices(){
  const wrap=document.getElementById('serviceAdminGrid');if(!wrap)return;
  wrap.innerHTML=ADMIN_SERVICES.map((s,i)=>`<article class="service-admin-card"><div class="service-admin-top"><span class="service-admin-icon"><i class="fa-solid ${s.icon}"></i></span><label class="service-toggle"><input type="checkbox" data-service-index="${i}" ${s.active?'checked':''}><i class="toggle-ui"></i></label></div><h3>${s.name}</h3><p>${s.desc}</p><div class="service-admin-meta"><small>${s.provider}</small><small>${s.active?'Available':'Coming later'}</small></div></article>`).join('');
  wrap.querySelectorAll('input[data-service-index]').forEach(input=>input.addEventListener('change',()=>{ADMIN_SERVICES[Number(input.dataset.serviceIndex)].active=input.checked;toast(`${ADMIN_SERVICES[Number(input.dataset.serviceIndex)].name} ${input.checked?'enabled':'disabled'}.`);renderHealth();}));
}
function exportText(filename,headers,rows){const csv=[headers,...rows].map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();URL.revokeObjectURL(a.href);toast('Export prepared successfully.');}
function initAdmin(){
  renderRevenueChart();renderHealth();renderMiniTx();renderUsers();renderTransactions();renderWallets();renderServices();
  document.querySelectorAll('.admin-nav-link').forEach(b=>b.addEventListener('click',()=>switchAdminSection(b.dataset.section)));
  document.querySelectorAll('[data-section-jump]').forEach(b=>b.addEventListener('click',()=>switchAdminSection(b.dataset.sectionJump)));
  document.getElementById('userSearch')?.addEventListener('input',renderUsers);document.getElementById('userStatusFilter')?.addEventListener('change',renderUsers);document.getElementById('transactionSearch')?.addEventListener('input',renderTransactions);
  document.querySelectorAll('#transactionFilters button').forEach(b=>b.addEventListener('click',()=>{activeTxFilter=b.dataset.filter;document.querySelectorAll('#transactionFilters button').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderTransactions();}));
  document.getElementById('adminMenu')?.addEventListener('click',()=>{document.getElementById('adminSidebar')?.classList.add('open');document.getElementById('adminOverlay')?.classList.add('open');});
  document.getElementById('adminClose')?.addEventListener('click',closeMobileAdmin);document.getElementById('adminOverlay')?.addEventListener('click',closeMobileAdmin);
  document.getElementById('globalAdminSearch')?.addEventListener('input',e=>{const q=e.target.value.toLowerCase().trim();if(!q)return;const userHit=ADMIN_USERS.some(u=>`${u.name} ${u.email} ${u.phone}`.toLowerCase().includes(q));const txHit=ADMIN_TX.some(t=>`${t.ref} ${t.user} ${t.service}`.toLowerCase().includes(q));if(userHit)switchAdminSection('users');else if(txHit)switchAdminSection('transactions');});
  document.getElementById('exportUsers')?.addEventListener('click',()=>exportText('smart-fox-users.csv',['Name','Email','Phone','Joined','Wallet','Status'],ADMIN_USERS.map(u=>[u.name,u.email,u.phone,u.joined,u.wallet,u.status])));
  document.getElementById('exportTransactions')?.addEventListener('click',()=>exportText('smart-fox-transactions.csv',['Reference','User','Service','Amount','Date','Status'],ADMIN_TX.map(t=>[t.ref,t.user,t.service,t.amount,t.date,t.status])));
  document.getElementById('exportWallets')?.addEventListener('click',()=>exportText('smart-fox-wallets.csv',['Reference','User','Type','Amount','Balance','Status'],ADMIN_WALLET.map(w=>[w.ref,w.user,w.type,w.amount,w.balance,w.status])));
  document.getElementById('exportReport')?.addEventListener('click',()=>exportText('smart-fox-report.csv',['Metric','Value'],[['Total service volume','2570000'],['Total users','1248'],['Transactions','3562'],['Success rate','93.8%']]));
  document.getElementById('saveSettings')?.addEventListener('click',()=>toast('Admin settings saved locally for this demo.'));
  document.getElementById('addServiceBtn')?.addEventListener('click',()=>toast('Service creation will be connected to the backend in a later milestone.','info'));
  document.querySelectorAll('.security-row').forEach(b=>b.addEventListener('click',()=>toast('This control will be connected to authenticated admin APIs later.','info')));
  document.getElementById('maintenanceToggle')?.addEventListener('change',e=>toast(`Maintenance mode ${e.target.checked?'enabled':'disabled'}.`));
  document.getElementById('registrationToggle')?.addEventListener('change',e=>toast(`New registrations ${e.target.checked?'enabled':'disabled'}.`));
  document.getElementById('fundingToggle')?.addEventListener('change',e=>toast(`Wallet funding ${e.target.checked?'enabled':'disabled'}.`));
}
function closeMobileAdmin(){document.getElementById('adminSidebar')?.classList.remove('open');document.getElementById('adminOverlay')?.classList.remove('open');}
document.addEventListener('DOMContentLoaded',initAdmin);
