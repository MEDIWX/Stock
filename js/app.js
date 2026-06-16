let DELETED_ROUND_DATES = JSON.parse(localStorage.getItem('DELETED_ROUND_DATES') || '[]');

function rememberDeletedRound(date) {
  if (!DELETED_ROUND_DATES.includes(date)) {
    DELETED_ROUND_DATES.push(date);
    localStorage.setItem('DELETED_ROUND_DATES', JSON.stringify(DELETED_ROUND_DATES));
  }
}

function isDeletedRound(date) {
  return DELETED_ROUND_DATES.includes(date);
}

// ==================== NAVIGATION ====================
function getCurrentRoundTitle() {
  if(typeof STOCK_ROUNDS !== 'undefined' && STOCK_ROUNDS[activeRoundIndex]) {
    return `รอบเช็กสต็อก: ${STOCK_ROUNDS[activeRoundIndex].date}`;
  }
  return 'รอบเช็กสต็อก';
}

// When switching rounds, update header title too
function switchRoundAndRefreshTitle() {
  const sel = document.getElementById('round-select');
  if(sel) switchRound(sel.value);
  // Update header if on stockcheck page
  const titleEl = document.getElementById('page-title');
  if(titleEl && document.getElementById('page-stockcheck').classList.contains('active')) {
    titleEl.textContent = getCurrentRoundTitle();
  }
}


function showPage(page, navEl = null) {
  const targetPage = document.getElementById('page-' + page);
  if (!targetPage) {
    console.warn('ไม่พบหน้า:', page);
    return;
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  targetPage.classList.add('active');

  // รองรับทั้ง onclick="showPage('inventory', this)" และการคลิกจากเมนูปกติ
  const activeNav = navEl || document.querySelector(`.nav-item[data-page="${page}"]`);
  if (activeNav) activeNav.classList.add('active');

  const titles = {
    dashboard: ['Dashboard สรุปภาพรวม', 'ข้อมูลสรุปรอบการตรวจสต็อก'],
    inventory: ['สต็อกสินค้าทั้งหมด', 'คลิกที่ตัวเลขเพื่อแก้ไขได้โดยตรง'],
    restock: ['รายการที่ต้องเติมสินค้า', 'สินค้าหมดหรือใกล้หมด'],
    revenue: ['สรุปรายรับ-รายจ่าย', 'ยอดขายและกำไรรอบนี้'],
    stockcheck: [getCurrentRoundTitle(), 'คลิกที่ตัวเลขเพื่อแก้ไขได้โดยตรง • บันทึกอัตโนมัติ'],
  };

  const title = titles[page] || titles.dashboard;
  document.getElementById('page-title').textContent = title[0];
  document.getElementById('page-sub').textContent = title[1];

  // render หน้าที่ต้อง refresh ตอนเปิด
  if (page === 'stockcheck' && typeof renderStockCheck === 'function') renderStockCheck();
  if (page === 'revenue' && typeof renderRevenue === 'function') renderRevenue();
}

// ==================== FILTERS ====================
function filterCat(cat, el) {
  filterCatVal = cat;
  document.querySelectorAll('#page-inventory .tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  renderInventory();
}
function filterStatus(val) { filterStatusVal = val; renderInventory(); }
function searchItems(val) { searchVal = val; renderInventory(); }

// ==================== MODAL ====================
function openAddModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = '＋ เพิ่มสินค้าใหม่';
  ['f-name','f-cost','f-price','f-stock','f-sold','f-revenue'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('modal').classList.add('open');
}
function openEditModal(id) {
  editingId = id;
  const item = items.find(i=>i.id===id);
  document.getElementById('modal-title').textContent = '✏️ แก้ไข: '+item.name;
  document.getElementById('f-name').value = item.name;
  document.getElementById('f-cat').value = item.cat;
  document.getElementById('f-cost').value = item.cost;
  document.getElementById('f-price').value = item.price;
  document.getElementById('f-stock').value = item.stock;
  document.getElementById('f-sold').value = item.sold;
  document.getElementById('f-revenue').value = item.revenue;
  document.getElementById('modal').classList.add('open');
}
function closeModal() { document.getElementById('modal').classList.remove('open'); }
function saveItem() {
  const name = document.getElementById('f-name').value.trim();
  if(!name) { alert('กรุณาใส่ชื่อสินค้า'); return; }
  const data = {
    name, cat: document.getElementById('f-cat').value,
    cost: parseFloat(document.getElementById('f-cost').value)||0,
    price: parseFloat(document.getElementById('f-price').value)||0,
    stock: parseFloat(document.getElementById('f-stock').value)||0,
    sold: parseFloat(document.getElementById('f-sold').value)||0,
    revenue: parseFloat(document.getElementById('f-revenue').value)||0,
  };
  const totalSt = data.stock + data.sold;
  data.status = data.stock<=0 ? 'หมด!' : (totalSt>0 && data.stock < totalSt*0.4) ? 'เติมของ!' : '✓ OK';
  if(editingId) {
    const idx = items.findIndex(i=>i.id===editingId);
    items[idx] = {...items[idx], ...data};
  } else {
    items.push({id: nextId++, ...data});
  }
  closeModal();
  renderAll();
}
function deleteItem(id) {
  if(!confirm('ลบสินค้านี้?')) return;
  items = items.filter(i=>i.id!==id);
  renderAll();
}

// ==================== EXPORT ====================
function exportCSV() {
  const headers = ['ลำดับ','ชื่อสินค้า','หมวดหมู่','ต้นทุน','ราคาขาย','สต็อก','ขายไป','รายรับ','สถานะ'];
  const rows = items.map((i,idx) => [
    idx+1, i.name, catName(i.cat), i.cost, i.price, i.stock, i.sold, i.revenue, i.status
  ]);
  const csv = '\uFEFF' + [headers, ...rows].map(r=>r.join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='stock_export.csv'; a.click();
}

function printRestock() {
  window.print();
}

// Close modal on backdrop click
const modalEl = document.getElementById('modal');
if (modalEl) {
  modalEl.addEventListener('click', e => {
    if (e.target === modalEl) closeModal();
  });
}

function saveStockChecks(showAlert = true) {
  localStorage.setItem('STOCK_ROUNDS_DATA', JSON.stringify(STOCK_ROUNDS));

  supabaseSaveRound(activeRoundIndex);

  if (showAlert) {
    alert('บันทึกรอบเช็กสต็อกแล้ว ✓ (local + Supabase)');
  }
}

// ==================== เติมของใหม่ (ไม่กระทบ Statement) ====================
// แนวคิด: เวลาเติมของเข้าสต็อก เราจะบวกจำนวนเข้าทั้งช่อง "รวมสต็อก" (totalStock)
// และ "เหลือ/มีจำนวน" (remaining) พร้อมกันเท่ากัน ทำให้ ขายไป (sold = totalStock - remaining)
// ไม่เปลี่ยนแปลง เป็นผลให้ "รายรับ" และ Statement รายเดือนของรอบนั้นไม่ถูกรบกวน
// ของที่เติมจะถูกบันทึกไว้ในช่อง "ของเดิม/มีจำนวน" (previous) เพื่อให้เห็นว่ามีการเติมเข้ามา
let restockSelected = null; // { tableIndex, rowIndex, row }

function openRestockModal() {
  document.getElementById('rs-search').value = '';
  document.getElementById('rs-qty').value = '';
  document.getElementById('rs-target-round').value = 'latest';
  document.getElementById('rs-results').style.display = 'none';
  document.getElementById('rs-results').innerHTML = '';
  document.getElementById('rs-selected').style.display = 'none';
  document.getElementById('rs-selected').innerHTML = '';
  restockSelected = null;
  document.getElementById('restock-modal').classList.add('open');
  setTimeout(() => document.getElementById('rs-search').focus(), 50);
}

function closeRestockModal() {
  document.getElementById('restock-modal').classList.remove('open');
}

// ค้นหาสินค้าจากรอบล่าสุด (รอบที่ index 0 ถือเป็นรอบล่าสุดเสมอ เพราะ addNewRound ใช้ unshift)
function renderRestockSearchResults(val) {
  const q = (val || '').trim().toLowerCase();
  const box = document.getElementById('rs-results');
  if (!q) { box.style.display = 'none'; box.innerHTML = ''; return; }

  const round = STOCK_ROUNDS[0]; // รอบล่าสุด
  const matches = [];
  round.tables.forEach((t, ti) => {
    t.rows.forEach((r, ri) => {
      if (String(r.name || '').toLowerCase().includes(q)) {
        matches.push({ ti, ri, r, tableName: t.name });
      }
    });
  });

  if (!matches.length) {
    box.style.display = 'block';
    box.innerHTML = '<div style="padding:10px 12px;font-size:12px;color:var(--text3);">ไม่พบสินค้านี้ในรอบล่าสุด</div>';
    return;
  }

  box.style.display = 'block';
  box.innerHTML = matches.slice(0, 30).map(m => `
    <div style="padding:8px 12px;font-size:12px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;gap:10px;"
         onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='transparent'"
         onclick="selectRestockItem(${m.ti},${m.ri})">
      <span>${escapeHTML(m.r.name||'')} <span style="color:var(--text3)">(${escapeHTML(m.tableName)})</span></span>
      <span style="color:var(--text3)">เหลือ ${fmtN(m.r.remaining||0)}</span>
    </div>`).join('');
}

function selectRestockItem(ti, ri) {
  const round = STOCK_ROUNDS[0];
  const row = round.tables[ti].rows[ri];
  restockSelected = { tableIndex: ti, rowIndex: ri, row };
  document.getElementById('rs-results').style.display = 'none';
  const sel = document.getElementById('rs-selected');
  sel.style.display = 'block';
  sel.innerHTML = `เลือก: <strong>${escapeHTML(row.name||'')}</strong> &nbsp;·&nbsp; คงเหลือปัจจุบัน ${fmtN(row.remaining||0)} ชิ้น`;
  document.getElementById('rs-qty').focus();
}

async function confirmRestock() {
  if (!restockSelected) { alert('กรุณาเลือกสินค้าที่ต้องการเติมก่อน'); return; }
  const qty = parseFloat(document.getElementById('rs-qty').value) || 0;
  if (qty <= 0) { alert('กรุณาใส่จำนวนที่เติมเข้ามากกว่า 0'); return; }
  const targetMode = document.getElementById('rs-target-round').value;

  if (targetMode === 'new') {
    // สร้างรอบเช็กใหม่อัตโนมัติ (เหมือนกด "เพิ่มรอบเช็กใหม่") แล้วเติมของในรอบใหม่นั้น
    const today = new Date();
    const d = today.getDate();
    const m = today.getMonth() + 1;
    const y = (today.getFullYear() + 543) % 100;
    const trimmed = `${d}-${m}-${y}`;
    const base = STOCK_ROUNDS[0];
    const newRound = JSON.parse(JSON.stringify(base));
    newRound.date = trimmed;
    newRound.rent = 0;
    newRound.withdraw = 0;
    newRound.tables.forEach(t => t.rows.forEach(r => {
      r.id = `${trimmed}-${t.tableNo}-${Math.random().toString(36).slice(2,8)}`;
      r.previous = Number(r.remaining)||0;
      r.added = 0;
      r.totalStock = r.previous;
      r.remaining = r.previous;
      r.sold = 0;
      r.revenue = 0;
      r.status = '✓ OK';
    }));
    STOCK_ROUNDS.unshift(newRound);
    activeRoundIndex = 0;
  }

  // เติมของในรอบล่าสุด (index 0) เสมอ — บวกเข้า "ของเดิม/มีจำนวน" (previous) เพื่อบันทึกว่ามีการเติม
  // และบวกเข้า "รวมสต็อก" (totalStock) กับ "เหลือ/มีจำนวน" (remaining) เท่ากันโดยตรง
  // เพื่อไม่ให้กระทบ "ขายไป" (sold = totalStock - remaining) ของรอบนั้น ไม่ว่า added/previous เดิม
  // จะตรงกับ totalStock เดิมหรือไม่ก็ตาม (กันบัคกรณีข้อมูลเก่าที่ totalStock ไม่เท่ากับ added+previous)
  const round = STOCK_ROUNDS[0];
  const row = round.tables[restockSelected.tableIndex].rows[restockSelected.rowIndex];
  const soldBefore = Math.max(0, (Number(row.totalStock) || 0) - Math.max(0, Number(row.remaining) || 0));

  row.previous = (Number(row.previous) || 0) + qty;
  row.totalStock = (Number(row.totalStock) || 0) + qty;
  row.remaining = (Number(row.remaining) || 0) + qty;

  // คำนวณค่าที่ขึ้นกับต้นทุน/ราคาขายใหม่ โดยไม่ให้ totalStock ถูกคำนวณทับจาก added+previous
  const shipping = Number(row.shipping) || 0;
  const cost = Number(row.cost) || 0;
  const price = Number(row.price) || 0;
  row.totalCost = shipping + cost;
  row.profit45 = row.totalCost * 1.45;
  row.sold = soldBefore; // คงยอดขายเดิมไว้ตรงๆ ไม่ให้คลาดเคลื่อนจาก added/previous เก่า
  row.revenue = row.sold * price;
  if (row.remaining <= 0) row.status = 'หมด!';
  else if (row.totalStock > 0 && row.remaining < row.totalStock * 0.4) row.status = 'เติมของ!';
  else row.status = '✓ OK';

  syncItemsFromActiveRound();
  localStorage.setItem('STOCK_ROUNDS_DATA', JSON.stringify(STOCK_ROUNDS));
  supabaseSaveRound(0);

  closeRestockModal();
  if (typeof switchRound === 'function') activeRoundIndex = 0;
  renderAll();
  if (typeof showToast === 'function') {
    showToast(`เติม "${row.name}" เข้าสต็อกแล้ว +${fmtN(qty)} ชิ้น ✓ (ไม่กระทบ Statement)`, 3500);
  } else {
    alert(`เติม "${row.name}" เข้าสต็อกแล้ว +${fmtN(qty)} ชิ้น (ไม่กระทบ Statement)`);
  }
}

// ปิด restock modal เมื่อคลิกพื้นหลัง
const restockModalEl = document.getElementById('restock-modal');
if (restockModalEl) {
  restockModalEl.addEventListener('click', e => {
    if (e.target === restockModalEl) closeRestockModal();
  });
}

// Override renderAll to include stock check page
function renderAll() {
  renderDashboard();
  renderInventory();
  renderStockCheck();
  renderRestock();
  renderRevenue();
  updateBadge();
}
