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


function showPage(page, navEl) {
  const targetPage = document.getElementById('page-' + page);
  if (!targetPage) {
    console.warn('ไม่พบหน้าที่ต้องการเปิด:', page);
    return;
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  targetPage.classList.add('active');

  // เดิมใช้ event.currentTarget ตรง ๆ ทำให้บางครั้งกดเมนูแล้ว error
  // โดยเฉพาะเมื่อ browser ไม่ส่ง window.event หรือมีการเรียก showPage() จากโค้ดอื่น
  const activeNav = navEl || document.querySelector(`.nav-item[data-page="${page}"]`);
  if (activeNav) activeNav.classList.add('active');

  const titles = {
    dashboard: ['Dashboard สรุปภาพรวม','ข้อมูลสรุปรอบการตรวจสต็อก'],
    inventory: ['สต็อกสินค้าทั้งหมด','คลิกที่ตัวเลขเพื่อแก้ไขได้โดยตรง'],
    restock: ['รายการที่ต้องเติมสินค้า','สินค้าหมดหรือใกล้หมด'],
    revenue: ['สรุปรายรับ-รายจ่าย','ยอดขายและกำไรรอบนี้'],
    stockcheck: [getCurrentRoundTitle(), 'คลิกที่ตัวเลขเพื่อแก้ไขได้โดยตรง • บันทึกอัตโนมัติ'],
  };

  const title = titles[page] || titles.dashboard;
  document.getElementById('page-title').textContent = title[0];
  document.getElementById('page-sub').textContent = title[1];
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
document.getElementById('modal').addEventListener('click', e => {
  if(e.target === document.getElementById('modal')) closeModal();
});

// Override renderAll to include stock check page
function renderAll() {
  renderDashboard();
  renderInventory();
  renderStockCheck();
  renderRestock();
  renderRevenue();
  updateBadge();
}

// ==================== SUPABASE REALTIME ====================
let supabaseClient = null;
let realtimeChannel = null;

function setSbStatus(state) {
  const dot = document.getElementById('sb-dot');
  const txt = document.getElementById('sb-status-text');
  if(!dot || !txt) return;
  const map = {
    disconnected: { color: 'var(--text3)',  text: 'ยังไม่ได้เชื่อมต่อ' },
    connecting:   { color: 'var(--yellow)', text: 'กำลังเชื่อมต่อ...' },
    connected:    { color: 'var(--green)',  text: 'เชื่อมต่อแล้ว 🟢' },
    error:        { color: 'var(--red)',    text: 'เชื่อมต่อล้มเหลว ❌' },
  };
  const s = map[state] || map.disconnected;
  dot.style.background = s.color;
  txt.textContent = s.text;
  txt.style.color = s.color;
}

async function connectSupabase(url, key) {
  url = (url || '').trim().replace(/\/$/, '');
  key = (key || '').trim();
  if(!url || !key) return; // no credentials — run offline only
  setSbStatus('connecting');
  try {
    supabaseClient = supabase.createClient(url, key);
    // Test connection
    const { error } = await supabaseClient.from('stock_rounds').select('id').limit(1);
    if(error && error.code !== 'PGRST116') throw error;
    setSbStatus('connected');
    localStorage.setItem('SUPA_URL', url);
    localStorage.setItem('SUPA_KEY', key);
    // Load from Supabase first
    await supabaseLoadRounds();
    // Start real-time
    startRealtimeSync();

  } catch(e) {
    setSbStatus('error');
    console.error('Supabase connect error:', e);
    alert('เชื่อมต่อ Supabase ไม่ได้: ' + (e.message || JSON.stringify(e)));
  }
}

// Save a single round to Supabase (upsert)
async function supabaseSaveRound(roundIdx) {
  if(!supabaseClient) return; // not connected, skip silently
  const r = STOCK_ROUNDS[roundIdx];
  if(!r) return;
  const payload = {
    round_date:   r.date,
    rent:         Number(r.rent) || 0,
    withdraw:     Number(r.withdraw) || 0,
    tables_json:  r.tables,
  };
  const { error } = await supabaseClient
    .from('stock_rounds')
    .upsert(payload, { onConflict: 'round_date' });
  if(error) console.warn('Supabase save round error:', error);
}

// Save all stock_items for current round
async function supabaseSaveItems() {
  if(!supabaseClient) return;
  const payload = items.map(i => ({
    id:         i.id,
    cat:        i.cat,
    name:       i.name,
    cost:       i.cost || 0,
    price:      i.price || 0,
    stock:      i.stock || 0,
    sold:       i.sold || 0,
    revenue:    i.revenue || 0,
    status:     i.status || '✓ OK',
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabaseClient
    .from('stock_items')
    .upsert(payload, { onConflict: 'id' });
  if(error) console.warn('Supabase save items error:', error);
}

// Load all rounds from Supabase → replace STOCK_ROUNDS
async function supabaseLoadRounds() {
  if(!supabaseClient) return;
  const { data, error } = await supabaseClient
    .from('stock_rounds')
    .select('*')
    .order('created_at', { ascending: false });
  if(error) { console.warn('Supabase load error:', error); return; }
  if(data && data.length) {
    const rounds = data.map(d => ({
      date:     d.round_date,
      rent:     Number(d.rent) || 0,
      withdraw: Number(d.withdraw) || 0,
      tables:   d.tables_json || [],
    }));
    STOCK_ROUNDS.splice(0, STOCK_ROUNDS.length, ...rounds);
    activeRoundIndex = 0;
    syncItemsFromActiveRound();
    localStorage.setItem('STOCK_ROUNDS_DATA', JSON.stringify(STOCK_ROUNDS));
    renderAll();
    showToast('โหลดข้อมูลจาก Supabase แล้ว ✓');
  }
}

// Real-time subscription
function startRealtimeSync() {
  if(realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
  realtimeChannel = supabaseClient
    .channel('stock-realtime')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'stock_rounds' },
      (payload) => {
        console.log('Realtime stock_rounds:', payload.eventType);
        supabaseLoadRounds(); // reload all rounds when any change
      }
    )
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'stock_items' },
      (payload) => {
        console.log('Realtime stock_items:', payload.eventType, payload.new?.name);
        // Patch single item in memory
        const d = payload.new;
        if(!d) return;
        const idx = items.findIndex(i => i.id === d.id);
        const updated = { id:d.id, cat:d.cat, name:d.name, cost:d.cost||0,
          price:d.price||0, stock:d.stock||0, sold:d.sold||0,
          revenue:d.revenue||0, status:d.status||'✓ OK' };
        if(idx >= 0) items[idx] = updated;
        else items.push(updated);
        renderAll();
      }
    )
    .subscribe((status) => {
      console.log('Realtime status:', status);
      if(status === 'SUBSCRIBED') showToast('🔴 Real-time เปิดแล้ว — ข้อมูลอัปเดตอัตโนมัติ', 3000);
    });
}

// Toast notification
function showToast(msg, duration=2500) {
  let el = document.getElementById('sb-toast');
  if(!el) {
    el = document.createElement('div');
    el.id = 'sb-toast';
    el.style.cssText = 'position:fixed;bottom:24px;right:24px;background:var(--surface);border:1px solid var(--border);color:var(--text);padding:10px 18px;border-radius:10px;font-size:13px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.4);transition:opacity 0.3s;pointer-events:none;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, duration);
}

// Auto-connect using hardcoded config or localStorage
// (Supabase config loaded from config.js)

// Init
renderAll();