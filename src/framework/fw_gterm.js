/* ============================================================
   用語のリンク：本文の用語（a.gt）を押すと、ページを移らずに、その場に小さな説明を出す。
   説明は、この HTML の中の GLOSS（[グループ, 見出し, 説明, ID]）から引く。印は、組み立てのときに gterm.py が a.gt に直す。
   ============================================================ */
let gPop = null, gFrom = null;
function gClose(back){
  if (!gPop) return;
  gPop.remove(); gPop = null;
  if (gFrom){ gFrom.setAttribute('aria-expanded', 'false'); if (back && document.contains(gFrom)) gFrom.focus(); }
  gFrom = null;
}
function gPlace(){
  if (!gPop || !gFrom || !document.contains(gFrom)){ gClose(false); return; }
  const r = gFrom.getBoundingClientRect(), dw = document.documentElement.clientWidth, pw = gPop.offsetWidth, ph = gPop.offsetHeight;
  const left = Math.max(8, Math.min(r.left, dw - pw - 8)) + window.scrollX;
  const below = r.bottom + 6 + ph <= window.innerHeight || r.top - 6 - ph < 50;
  gPop.style.left = left + 'px'; gPop.style.top = ((below ? r.bottom + 6 : r.top - 6 - ph) + window.scrollY) + 'px';
}
function gOpen(a){
  const t = GLOSS.find(x => x[3] === a.dataset.g); if (!t) return;
  gClose(false);
  gPop = el('div', 'gpop', '<span class="gh">' + t[1] + '</span><p>' + t[2] + '</p><div class="gpa"><button type="button" class="btn sm" data-act="panel">この画面の用語集で開く</button><a class="btn sm" href="glossary.html#' + t[3] + '" target="_blank" rel="noopener">用語集で見る</a><button type="button" class="btn sm" data-act="close">閉じる</button></div>');
  gPop.setAttribute('role', 'dialog'); gPop.setAttribute('aria-label', '用語の説明：' + t[1].replace(/<[^>]*>/g, '')); gPop.tabIndex = -1;
  document.body.appendChild(gPop); gFrom = a; a.setAttribute('aria-expanded', 'true');
  gPlace(); gPop.focus({preventScroll: true});
}
/* 右端の用語集のパネルを開いて、ID の用語を見せる */
function glossAt(id){
  const g = $('#gloss'), f = $('#glFind'); if (!g) return;
  if (f && f.value){ f.value = ''; f.dispatchEvent(new Event('input')); }
  g.hidden = false;
  const dt = document.getElementById(id); if (!dt) return;
  for (const e of g.querySelectorAll('dt.hit')) e.classList.remove('hit');
  dt.classList.add('hit'); dt.scrollIntoView({block: 'center'}); dt.tabIndex = -1; dt.focus({preventScroll: true});
}
document.addEventListener('click', e => {
  const t = e.target, a = t && t.closest ? t.closest('a.gt') : null;
  if (a){ e.preventDefault(); if (gFrom === a) gClose(false); else gOpen(a); return; }
  if (!gPop) return;
  const b = t && t.closest ? t.closest('.gpop [data-act]') : null;
  if (b){ const id = gFrom ? gFrom.dataset.g : null, act = b.dataset.act; gClose(act === 'close'); if (act === 'panel' && id) glossAt(id); return; }
  if (!gPop.contains(t)) gClose(false);
});
document.addEventListener('keydown', e => {
  const a = e.target && e.target.closest ? e.target.closest('a.gt') : null;
  if (a && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); if (gFrom === a) gClose(true); else gOpen(a); }
  else if (e.key === 'Escape' && gPop){ e.stopPropagation(); gClose(true); }
}, true);
window.addEventListener('resize', gPlace);
window.addEventListener('hashchange', () => gClose(false));
