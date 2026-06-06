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



// Init
renderAll();

// Auto-connect on page load
(function autoConnect() {
  const u = SUPA_CONFIG.url || localStorage.getItem('SUPA_URL') || '';
  const k = SUPA_CONFIG.key || localStorage.getItem('SUPA_KEY') || '';
  if(u && k) {
    if(SUPA_CONFIG.url) {
      localStorage.setItem('SUPA_URL', u);
      localStorage.setItem('SUPA_KEY', k);
    }
    setTimeout(() => connectSupabase(u, k), 400);
  }
})();
