// ==================== UTILS ====================
function fmt(n) {
  if(n===0) return '—';
  return '฿' + n.toLocaleString('th', {minimumFractionDigits:0, maximumFractionDigits:0});
}
function fmtN(n) {
  if(!n && n!==0) return '—';
  return n.toLocaleString('th', {minimumFractionDigits:0, maximumFractionDigits:1});
}
function statusTag(s, sold, stock) {
  if(s==='หมด!' || stock<=0) return `<span class="tag tag-red">🔴 หมด</span>`;
  if(s==='เติมของ!') return `<span class="tag tag-yellow">⚠️ เติมของ</span>`;
  if(s==='✓ OK') return `<span class="tag tag-green">✓ OK</span>`;
  return `<span class="tag" style="background:var(--surface2);color:var(--text3)">—</span>`;
}
function catName(c) {
  return CAT_NAMES[c] || 'อื่นๆ';
}