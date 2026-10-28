// 쿠팡 검색 결과 페이지에서 확장 전송 필드(04_fe.md §12.4)를 뽑아 recv.py로 보낸다.
// 쿠팡 첫 화면 검색창으로 검색한 뒤 개발자 도구 콘솔에서 Q를 검색어로 바꿔 실행한다.
// 행: [productId, vendorItemId, 상품명, 표시 가격, 할인 표시, 단위가격 표시, 로켓프레시, 카드 글자 2~8줄]
// 상품명은 카드 글자 첫 줄로 읽는다 — 배지가 첫 줄인 카드가 있다(research/backend/17 §3.3).
const Q = '삼겹살';
const seen = new Set(); const rows = []; let ads = 0;
for (const c of document.querySelectorAll('li[class*="ProductUnit_productUnit"]')) {
  const lines = c.innerText.split('\n').map(s => s.trim()).filter(Boolean);
  if (lines.includes('광고')) { ads++; continue; }
  const a = c.querySelector('a[href*="/vp/products/"]'); if (!a) continue;
  const h = a.getAttribute('href');
  const pid = (h.match(/products\/(\d+)/) || [])[1]; const vid = (h.match(/vendorItemId=(\d+)/) || [])[1];
  if (!vid || seen.has(vid)) continue; seen.add(vid);
  const price = [...c.querySelectorAll('span,strong,div')].find(e => e.children.length === 0 && /^[\d,]+원$/.test(e.textContent.trim()) && !e.closest('del'));
  const unit = lines.find(l => /^\(.+당 [\d,]+원\)$/.test(l));
  const disc = lines.find(l => /할인$/.test(l));
  const fresh = [...c.querySelectorAll('img')].some(i => /logo_fresh/.test(i.getAttribute('src') || ''));
  rows.push([pid, vid, lines[0], price ? +price.textContent.replace(/[^\d]/g, '') : null, disc || null, unit ? unit.slice(1, -1) : null, fresh, lines.slice(1, 8).join(' / ')]);
}
const loggedIn = !![...document.querySelectorAll('a')].find(a => a.textContent.trim() === '로그아웃');
await fetch('http://127.0.0.1:8765/', {method: 'POST', headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({query: Q, logged_in: loggedIn, ads, rows})}).then(r => `${r.status} rows ${rows.length} ads ${ads} logged_in ${loggedIn}`);
