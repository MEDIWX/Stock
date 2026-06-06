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

// Override renderAll to include stock check page
function renderAll() {
  renderDashboard();
  renderInventory();
  renderStockCheck();
  renderRestock();
  renderRevenue();
  updateBadge();
}
