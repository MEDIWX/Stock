// ==================== RENDER ====================
let dashboardDirty = true;
let inventoryDirty = true;
let restockDirty = true;
let revenueDirty = true;
let stockCheckDirty = true;

function markDashboardDirty() { dashboardDirty = true; }
function markInventoryDirty() { inventoryDirty = true; }
function markRestockDirty() { restockDirty = true; }
function markRevenueDirty() { revenueDirty = true; }
function markStockCheckDirty() { stockCheckDirty = true; }
function markAllDirty() {
  dashboardDirty = inventoryDirty = restockDirty = revenueDirty = stockCheckDirty = true;
}
function getActivePage() {
  const activePage = document.querySelector('.page.active');
  return activePage ? activePage.id.replace('page-', '') : 'dashboard';
}
function renderPage(page) {
  if(page === 'dashboard') return renderDashboard();
  if(page === 'inventory') return renderInventory();
  if(page === 'stockcheck') return renderStockCheck();
  if(page === 'restock') return renderRestock();
  if(page === 'revenue') return renderRevenue();
}
function renderAll() {
  renderPage(getActivePage());
  updateBadge();
}

function renderDashboard() {
  const totalRevenue = items.reduce((s,i) => s + Math.max(0, i.revenue||0), 0);
  const totalItems = items.length;
  const restockItems = items.filter(i => i.status==='เติมของ!' || i.status==='หมด!' || i.stock<=0);
  const emptyItems = items.filter(i => i.status==='หมด!' || i.stock<=0);
  const stockCost = items.reduce((s,i) => s + (i.cost||0)*Math.max(0,i.stock||0), 0);

  document.getElementById('stat-revenue').textContent = fmt(totalRevenue);
  document.getElementById('stat-revenue-sub').textContent = `จาก ${items.filter(i=>i.sold>0).length} รายการที่ขาย`;
  document.getElementById('stat-total').textContent = totalItems;
  document.getElementById('stat-total-sub').textContent = 'รายการในระบบ';
  document.getElementById('stat-restock').textContent = restockItems.length;
  document.getElementById('stat-empty').textContent = emptyItems.filter(i=>i.status==='หมด!').length;
  document.getElementById('stat-cost').textContent = fmt(stockCost);

  // Empty list
  const emptyList = items.filter(i=>i.status==='หมด!');
  document.getElementById('empty-count').textContent = emptyList.length + ' รายการ';
  document.getElementById('empty-list').innerHTML = emptyList.length
    ? emptyList.map(i=>`<div class="alert-item">
        <span class="alert-item-name">${i.name}</span>
        <span class="alert-item-detail">${catName(i.cat)}</span>
        <span class="tag tag-red">หมด</span>
      </div>`).join('')
    : '<div class="empty">ไม่มีรายการ ✓</div>';

  // Low list
  const lowList = items.filter(i=>i.status==='เติมของ!');
  document.getElementById('low-count').textContent = lowList.length + ' รายการ';
  document.getElementById('low-list').innerHTML = lowList.length
    ? lowList.map(i=>`<div class="alert-item">
        <span class="alert-item-name">${i.name}</span>
        <span class="alert-item-detail">เหลือ ${fmtN(i.stock)}</span>
        <span class="tag tag-yellow">เติมของ</span>
      </div>`).join('')
    : '<div class="empty">ไม่มีรายการ ✓</div>';

  // Bestseller
  const sold = items.filter(i=>i.sold>0).sort((a,b)=>b.revenue-a.revenue).slice(0,15);
  document.getElementById('bestseller-table').innerHTML = sold.length
    ? sold.map(i=>`<tr>
        <td>${i.name}</td>
        <td><span class="cat-badge">${catName(i.cat)}</span></td>
        <td class="num">${fmtN(i.sold)}</td>
        <td class="num">${fmt(i.price)}</td>
        <td class="num" style="color:var(--green)">${fmt(i.revenue)}</td>
        <td>${statusTag(i.status, i.sold, i.stock)}</td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="empty">ยังไม่มียอดขาย</td></tr>';
}

function getFilteredItems() {
  return items.filter(i => {
    const matchCat = filterCatVal === 'all' || 
      (filterCatVal === '9-14' ? parseInt(i.cat) >= 9 : i.cat === filterCatVal);
    const matchStatus = filterStatusVal === 'all' ||
      (filterStatusVal === 'ok' && i.status === '✓ OK') ||
      (filterStatusVal === 'low' && i.status === 'เติมของ!') ||
      (filterStatusVal === 'empty' && i.status === 'หมด!') ||
      (filterStatusVal === 'none' && !i.status);
    const matchSearch = !searchVal || i.name.toLowerCase().includes(searchVal.toLowerCase());
    return matchCat && matchStatus && matchSearch;
  });
}

function renderInventory() {
  if (!inventoryDirty) return;
  inventoryDirty = false;
  const filtered = getFilteredItems();
  document.getElementById('item-count-label').textContent = `แสดง ${filtered.length} จาก ${items.length} รายการ`;
  document.getElementById('inventory-table').innerHTML = filtered.map((i, idx) => `
    <tr id="row-${i.id}">
      <td style="color:var(--text3)">${idx+1}</td>
      <td style="font-weight:500">${i.name}</td>
      <td><span class="cat-badge">${catName(i.cat)}</span></td>
      <td class="num editable" onclick="editCell(${i.id},'cost',this)">${i.cost>0?fmt(i.cost):'—'}</td>
      <td class="num editable" onclick="editCell(${i.id},'price',this)">${fmt(i.price)}</td>
      <td class="num editable" onclick="editCell(${i.id},'stock',this)" style="color:${i.stock<=0?'var(--red)':i.stock<=3?'var(--yellow)':'inherit'}">${fmtN(i.stock)}</td>
      <td class="num editable" onclick="editCell(${i.id},'sold',this)" style="color:${i.sold>0?'var(--green)':i.sold<0?'var(--red)':'var(--text3)'}">${i.sold>0?fmtN(i.sold):'—'}</td>
      <td class="num" style="color:${i.revenue>0?'var(--green)':i.revenue<0?'var(--red)':'var(--text3)'}">${i.revenue?fmt(i.revenue):'—'}</td>
      <td>${statusTag(i.status, i.sold, i.stock)}</td>
      <td>
        <button class="btn btn-ghost" style="padding:4px 8px;font-size:11px" onclick="openEditModal(${i.id})">✏️</button>
        <button class="btn" style="padding:4px 8px;font-size:11px;background:rgba(239,68,68,0.1);color:var(--red)" onclick="deleteItem(${i.id})">🗑</button>
      </td>
    </tr>`).join('');
}

function editCell(id, field, td) {
  if(td.querySelector('input')) return;
  const item = items.find(i=>i.id===id);
  const val = item[field];
  const input = document.createElement('input');
  input.className = 'cell-edit';
  input.type = 'number';
  input.value = val;
  input.step = field==='stock'||field==='sold' ? '1' : '0.01';
  td.innerHTML = '';
  td.appendChild(input);
  input.focus();
  input.select();
  const save = () => {
    const newVal = parseFloat(input.value) || 0;
    item[field] = newVal;
    if(field==='sold' || field==='price') {
      // auto calc revenue
      if(item.sold > 0) item.revenue = item.sold * item.price;
    }
    // auto update status
    const totalSt = item.stock + item.sold;
    if(item.stock <= 0) item.status = 'หมด!';
    else if(totalSt > 0 && item.stock < totalSt * 0.4) item.status = 'เติมของ!';
    else item.status = '✓ OK';
    markAllDirty();
    renderAll();
  };
  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => { if(e.key==='Enter') save(); if(e.key==='Escape') renderInventory(); });
}

function renderRestock() {
  const need = items.filter(i => 
    i.status==='หมด!' || i.status==='เติมของ!' || i.stock<=0
  ).sort((a,b) => {
    const order = {'หมด!':0,'เติมของ!':1,'':2,'✓ OK':3};
    return (order[a.status]||2) - (order[b.status]||2);
  });

  document.getElementById('restock-badge').textContent = need.length;
  document.getElementById('restock-table').innerHTML = need.length
    ? need.map((i,idx)=>`<tr>
        <td style="color:var(--text3)">${idx+1}</td>
        <td style="font-weight:500">${i.name}</td>
        <td><span class="cat-badge">${catName(i.cat)}</span></td>
        <td class="num">${fmt(i.price)}</td>
        <td class="num">${fmtN(i.stock)}</td>
        <td class="num" style="color:${i.sold>0?'var(--green)':'var(--text3)'}">${i.sold>0?fmtN(i.sold):'—'}</td>
        <td class="num" style="color:${i.stock-i.sold<2?'var(--red)':'var(--yellow)'}">
          ${fmtN(Math.max(0, i.stock - Math.max(0,i.sold)))}
        </td>
        <td>${i.status==='หมด!'
          ? '<span class="tag tag-red">🔴 ด่วนมาก</span>'
          : i.stock<=0
          ? '<span class="tag tag-red">🔴 ด่วนมาก</span>'
          : '<span class="tag tag-yellow">⚠️ เติมเร็วๆ</span>'}</td>
      </tr>`).join('')
    : '<tr><td colspan="8" class="empty">🎉 ไม่มีรายการที่ต้องเติมของ!</td></tr>';

  if(need.length) {
    document.getElementById('restock-total-row').style.display = '';
    document.getElementById('restock-summary').innerHTML = 
      `<span style="font-weight:700; font-size:13px;">${need.length} รายการ ต้องเติมสินค้า</span>`;
  } else {
    document.getElementById('restock-total-row').style.display = 'none';
  }
}

// Month names for display
const MONTH_NAMES_TH = ['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

function initRevenuePicker() {
  // Set current Buddhist Era month/year as default
  const now = new Date();
  const beYear = now.getFullYear() + 543;
  const monthEl = document.getElementById('rev-month');
  const yearEl = document.getElementById('rev-year');
  if(monthEl && !monthEl._initialized) {
    monthEl.value = now.getMonth() + 1;
    monthEl._initialized = true;
  }
  if(yearEl && !yearEl.value) {
    yearEl.value = beYear;
  }
}

// Parse round date string e.g. "9-6-69" → {day:9, month:6, beYear:2569}
function parseRoundDate(dateStr) {
  if(!dateStr) return null;
  const parts = dateStr.trim().split('-');
  if(parts.length < 2) return null;
  // Format: D-M-YY or D-M-YYYY (BE)
  const day   = parseInt(parts[0]) || 0;
  const month = parseInt(parts[1]) || 0;
  let year    = parseInt(parts[2]) || 0;
  // Treat 2-digit year as BE (e.g. 69 → 2569)
  if(year > 0 && year < 100) year += 2500;
  return { day, month, beYear: year };
}

function getMatchingRounds(selMonth, selYear) {
  // Return indices of STOCK_ROUNDS whose date falls in selMonth/selYear (BE)
  return STOCK_ROUNDS.map((r, idx) => ({ r, idx }))
    .filter(({ r }) => {
      const d = parseRoundDate(r.date);
      if(!d) return false;
      return d.month === selMonth && d.beYear === selYear;
    });
}

function getRevenueSourceItems() {
  if(typeof STOCK_ROUNDS !== 'undefined' && STOCK_ROUNDS.length) {
    const monthEl = document.getElementById('rev-month');
    const yearEl  = document.getElementById('rev-year');
    const roundFilterEl = document.getElementById('rev-round-filter');
    if(!monthEl || !yearEl) return items.filter(i=>i.sold>0 && i.revenue>0);

    const selMonth = parseInt(monthEl.value);
    const selYear  = parseInt(yearEl.value);
    const selRound = roundFilterEl ? roundFilterEl.value : 'all';

    // Find rounds matching selected month/year
    const matchingRounds = getMatchingRounds(selMonth, selYear);

    // Populate round filter dropdown — only rounds in this month
    if(roundFilterEl) {
      const prev = roundFilterEl.value;
      roundFilterEl.innerHTML = '<option value="all">ทุกรอบในเดือนนี้ (' + matchingRounds.length + ' รอบ)</option>';
      matchingRounds.forEach(({ r, idx }) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = 'รอบ: ' + r.date;
        roundFilterEl.appendChild(opt);
      });
      // Restore selection if still valid, else reset to all
      const stillValid = matchingRounds.some(({ idx }) => String(idx) === prev);
      roundFilterEl.value = stillValid ? prev : 'all';
    }

    // Determine which round indices to include
    let roundIndices;
    if(selRound === 'all') {
      roundIndices = new Set(matchingRounds.map(x => x.idx));
    } else {
      const si = parseInt(selRound);
      // Only include if it's actually in this month
      roundIndices = matchingRounds.some(x => x.idx === si) ? new Set([si]) : new Set();
    }

    // Aggregate sales from matching rounds
    const map = {};
    STOCK_ROUNDS.forEach((round, rIdx) => {
      if(!roundIndices.has(rIdx)) return;
      round.tables.forEach(t => {
        t.rows.forEach(r => {
          const sold = Number(r.sold)||0;
          const revenue = Number(r.revenue)||0;
          if(sold <= 0 || revenue <= 0) return;
          const key = r.name + '|' + t.tableNo;
          if(!map[key]) map[key] = {
            name: r.name,
            cat: String(t.tableNo),
            cost: Number(r.totalCost)||Number(r.cost)||0,
            price: Number(r.price)||0,
            sold: 0,
            revenue: 0
          };
          map[key].sold    += sold;
          map[key].revenue += revenue;
        });
      });
    });
    return Object.values(map).sort((a,b) => b.revenue - a.revenue);
  }
  return items.filter(i=>i.sold>0 && i.revenue>0).sort((a,b)=>b.revenue-a.revenue);
}

function renderRevenue() {
  initRevenuePicker();
  const monthEl = document.getElementById('rev-month');
  const yearEl = document.getElementById('rev-year');
  const selMonth = monthEl ? parseInt(monthEl.value) : (new Date().getMonth()+1);
  const selYear = yearEl ? parseInt(yearEl.value) : (new Date().getFullYear()+543);

  const periodLabel = document.getElementById('rev-period-label');
  if(periodLabel) {
    const matchingRounds = (typeof STOCK_ROUNDS !== 'undefined') ? getMatchingRounds(selMonth, selYear) : [];
    const roundFilterEl = document.getElementById('rev-round-filter');
    const selRound = roundFilterEl ? roundFilterEl.value : 'all';
    if(matchingRounds.length === 0) {
      periodLabel.innerHTML = `ประจำเดือน <strong>${MONTH_NAMES_TH[selMonth]} พ.ศ. ${selYear}</strong> &nbsp;·&nbsp; <span style="color:var(--red)">ไม่พบรอบบิลในเดือนนี้</span>`;
    } else if(selRound === 'all') {
      const roundNames = matchingRounds.map(x => x.r.date).join(', ');
      periodLabel.innerHTML = `ประจำเดือน <strong>${MONTH_NAMES_TH[selMonth]} พ.ศ. ${selYear}</strong> &nbsp;·&nbsp; รวมรอบบิล: <span style="color:var(--accent)">${roundNames}</span>`;
    } else {
      const rName = STOCK_ROUNDS[parseInt(selRound)]?.date || '';
      periodLabel.innerHTML = `ประจำเดือน <strong>${MONTH_NAMES_TH[selMonth]} พ.ศ. ${selYear}</strong> &nbsp;·&nbsp; รอบบิล: <span style="color:var(--accent)">${rName}</span>`;
    }
  }

  const sold = getRevenueSourceItems();
  const totalRev = sold.reduce((s,i)=>s+i.revenue,0);
  const totalCost = sold.reduce((s,i)=>s+(i.cost||0)*i.sold,0);
  const profit = totalRev - totalCost;
  const margin = totalRev>0 ? ((profit/totalRev)*100).toFixed(1) : 0;

  document.getElementById('rev-total').textContent = fmt(totalRev);
  document.getElementById('rev-cost').textContent = fmt(totalCost);
  document.getElementById('rev-profit').textContent = fmt(profit);
  document.getElementById('rev-margin').textContent = `อัตรากำไร ${margin}%`;
  const revItems = document.getElementById('rev-items');
  if(revItems) revItems.textContent = sold.length;

  const roundCountEl = document.getElementById('rev-round-count');
  if(roundCountEl) {
    const roundFilterEl = document.getElementById('rev-round-filter');
    const selRound = roundFilterEl ? roundFilterEl.value : 'all';
    const matchCount = (typeof STOCK_ROUNDS !== 'undefined') ? getMatchingRounds(selMonth, selYear).length : 0;
    if(selRound === 'all') {
      roundCountEl.textContent = matchCount > 0
        ? `รวม ${matchCount} รอบบิลในเดือนนี้ · ${sold.length} รายการ`
        : 'ไม่มีรอบบิลในเดือนนี้';
    } else {
      const roundName = STOCK_ROUNDS[parseInt(selRound)]?.date || '';
      roundCountEl.textContent = `รอบ ${roundName} · ${sold.length} รายการ`;
    }
  }

  document.getElementById('revenue-table').innerHTML = sold.length
    ? sold.map((i,idx)=>{
        const cogs = (i.cost||0)*i.sold;
        const gp = i.revenue - cogs;
        return `<tr>
          <td style="color:var(--text3)">${idx+1}</td>
          <td style="font-weight:500">${i.name}</td>
          <td><span class="cat-badge">${catName(i.cat)}</span></td>
          <td class="num">${fmt(i.price)}</td>
          <td class="num">${fmtN(i.sold)}</td>
          <td class="num">${fmt(cogs)}</td>
          <td class="num" style="color:var(--green)">${fmt(i.revenue)}</td>
          <td class="num" style="color:${gp>=0?'var(--green)':'var(--red)'}">${fmt(gp)}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="8" class="empty">ไม่มีข้อมูลยอดขายในเดือนนี้</td></tr>';

  const footer = document.getElementById('revenue-footer');
  if(footer && sold.length) {
    footer.innerHTML = `<tr style="background:rgba(79,142,247,0.08); border-top:2px solid var(--accent);">
      <td colspan="4" style="font-weight:700; font-size:13px; padding:10px 14px;">รวมทั้งหมด</td>
      <td class="num" style="font-weight:700;">${fmtN(sold.reduce((s,i)=>s+i.sold,0))}</td>
      <td class="num" style="font-weight:700; color:var(--red);">${fmt(totalCost)}</td>
      <td class="num" style="font-weight:700; color:var(--green);">${fmt(totalRev)}</td>
      <td class="num" style="font-weight:700; color:${profit>=0?'var(--green)':'var(--red)'};">${fmt(profit)}</td>
    </tr>`;
  } else if(footer) footer.innerHTML = '';
}

function printStatement() {
  const monthEl = document.getElementById('rev-month');
  const yearEl = document.getElementById('rev-year');
  const selMonth = monthEl ? parseInt(monthEl.value) : (new Date().getMonth()+1);
  const selYear = yearEl ? parseInt(yearEl.value) : (new Date().getFullYear()+543);
  const title = `Statement รายรับ เดือน${MONTH_NAMES_TH[selMonth]} พ.ศ.${selYear}`;
  document.title = title;
  window.print();
  document.title = 'ระบบสต็อกสินค้า';
}

function updateBadge() {
  const n = items.filter(i=>i.status==='หมด!'||i.status==='เติมของ!'||i.stock<=0).length;
  document.getElementById('restock-badge').textContent = n;
}