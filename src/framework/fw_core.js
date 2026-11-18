/* ============================================================
   4本共通の進行部品：問い → 予想 → 操作 → 答え合わせ、ミッション、読み物、用語集、指導者メモ
   各回のファイルで STEPS（ステップの定義）、CT（操作部の一覧）、PRE（前提知識）、resetS(init) を用意する
   ============================================================ */
const STATE = {pred: [], shown: [], ms: [], touched: false};
let cur = 0, PL = [], playT = null, hlT = null, lastR = {};
/* dB の値に「何倍か」を添える（電力の比）。例：−20.0 dB（電力 1/100） */
function ratioTxt(d){ const r = Math.pow(10, Math.abs(d) / 10), s = r >= 9950 ? fx(r / 1e4, r >= 99500 ? 0 : 1) + ' 万' : r >= 99.5 ? fx(r, 0) : r >= 9.95 ? fx(r, 0) : fx(r, 1); return Math.abs(d) < 0.05 ? '1 倍' : d > 0 ? s + ' 倍' : '1/' + s; }
function dbx(d, dg){ return isFinite(d) ? fx(d, dg === undefined ? 1 : dg) + ' dB（電力 ' + ratioTxt(d) + '）' : '—'; }
/* 読み物の書き方：[[キー|表示]] はシミュレータ側を強調するリンク、{H} は「補足」の印 */
function rt(s){ return String(s || '').replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '<a class="term" data-hl="$1" role="button" tabindex="0">$2</a>').replace(/\{H\}/g, H); }
function tilesHtml(a){ return (a || []).filter(Boolean).map(t => '<div class="tile"><div class="k">' + t.k + '</div><div class="v">' + t.v + '</div>' + (t.s ? '<div class="s">' + t.s + '</div>' : '') + '</div>').join(''); }
const eq = b => '<div class="eq">' + b + '</div>';

function stopPlay(){ if (playT){ clearInterval(playT); playT = null; const b = $('#playBtn'); if (b) b.textContent = b.dataset.t; } }
function ctlDef(c){ const o = typeof c === 'string' ? {k: c} : c; return Object.assign({}, CT[o.k], o); }
function getV(d){ return d.get ? d.get() : S[d.k]; }
function setV(d, v){ if (d.set) d.set(v); else S[d.k] = v; }
function buildCtl(host, c){
  const d = ctlDef(c), e = el('div', 'ctl'); e.dataset.k = d.k;
  if (d.seg){
    e.innerHTML = '<div class="ctl-h"><label>' + d.l + '</label></div><span class="seg">' + d.seg.map(o => '<button type="button" data-v="' + o[0] + '">' + o[1] + '</button>').join('') + '</span><small></small>';
    $('.seg', e).addEventListener('click', ev => { const v = ev.target && ev.target.dataset ? ev.target.dataset.v : undefined; if (v !== undefined){ setV(d, typeof d.seg[0][0] === 'number' ? Number(v) : v); userChanged(); } });
  } else if (d.chk){
    e.innerHTML = '<label class="chk"><input type="checkbox">' + d.l + '</label><small></small>';
    $('input', e).addEventListener('change', ev => { setV(d, ev.target.checked); userChanged(); });
  } else {
    e.innerHTML = '<div class="ctl-h"><label>' + d.l + '</label><output></output></div><input type="range" min="' + d.min + '" max="' + d.max + '" step="' + d.step + '" aria-label="' + d.l.replace(/<[^>]*>/g, '') + '"><small></small>';
    $('input', e).addEventListener('input', ev => { setV(d, parseFloat(ev.target.value)); userChanged(); });
  }
  e._d = d; host.appendChild(e);
}
function syncCtl(){
  for (const e of document.querySelectorAll('#sim .ctl')){
    const d = e._d, v = getV(d);
    if (d.seg){ for (const b of $('.seg', e).children) b.setAttribute('aria-pressed', String(b.dataset.v) === String(v)); }
    else if (d.chk) $('input', e).checked = !!v;
    else { $('input', e).value = v; $('output', e).textContent = d.f ? d.f(v) : String(v); }
    $('small', e).textContent = d.h ? d.h(v) : '';
  }
  const fx_ = $('#fixed'), st = STEPS[cur];
  if (fx_) fx_.innerHTML = ((st.fixed && st.fixed.length) || (st.fixT && st.fixT.length) ? 'このステップでは固定：' + (st.fixed || []).map(k => { const d = ctlDef(k), v = getV(d); return '<span>' + d.l.replace(/（.*?）/g, '') + ' ' + (d.seg ? (d.seg.find(o => String(o[0]) === String(v)) || ['', v])[1] : d.chk ? (v ? 'あり' : 'なし') : d.f ? d.f(v) : v) + '</span>'; }).join('') + (st.fixT || []).map(t => '<span>' + t + '</span>').join('') : '');
}
function userChanged(){ STATE.touched = true; redraw(); }
function redraw(){
  const st = STEPS[cur]; syncCtl();
  lastR = st.draw(PL) || {};
  const tl = $('#tiles'); if (tl) tl.innerHTML = tilesHtml(lastR.tiles);
  if (st.mission && !STATE.ms[cur] && STATE.touched && ((st.free && !st.q) || STATE.pred[cur] !== undefined) && st.mission.ok(lastR)){ STATE.ms[cur] = true; }
  showMission();
}
function showMission(){
  const st = STEPS[cur], c = $('#msCard');
  if (c){ c.classList.toggle('done', !!STATE.ms[cur]); $('.st', c).textContent = STATE.ms[cur] ? '達成！' : (lastR.msHint ? '未達成（' + lastR.msHint + '）' : '未達成'); }
  const bar = $('#msbar'); let n = 0, h = 'ミッション ';
  STEPS.forEach((s, i) => { if (!s.mission) return; if (STATE.ms[i]) n++; h += '<button type="button" data-i="' + i + '" class="' + (STATE.ms[i] ? 'done' : '') + '" title="ステップ ' + (i + 1) + '：' + s.short + (STATE.ms[i] ? '（達成）' : '') + '" aria-label="ステップ ' + (i + 1) + ' のミッション' + (STATE.ms[i] ? '（達成）' : '（未達成）') + '">✓</button>'; });
  bar.innerHTML = h + '<b>' + n + ' / ' + STEPS.filter(s => s.mission).length + '</b>';
  for (const b of $('#steps').children) b.classList.toggle('done', !!STATE.ms[Number(b.dataset.i)]);
}
function showAnswer(){
  const st = STEPS[cur], body = $('#ansBody'), p = STATE.pred[cur]; if (!body || !STATE.shown[cur]) return;
  body.hidden = false;
  body.innerHTML = '<p><b>' + (p === st.ans ? '予想どおりです。' : '予想とは違いましたね。外れても大丈夫、ここで「なぜ」を確かめれば身につきます。') + '</b></p><p>答え：<b>' + st.ch[st.ans] + '</b></p><p>' + rt(st.why) + '</p>';
  const bs = $('#choices').children; for (let i = 0; i < bs.length; i++) bs[i].classList.toggle('right', i === st.ans);
}
function renderRead(st, i){
  const r = st.read || {}; let h = '<h2><span class="num">ステップ ' + (i + 1) + ' / ' + STEPS.length + '</span>' + st.title + '</h2>';
  if (i === 0 && typeof PRE !== 'undefined'){
    h += '<div class="pre"><b>このシミュレータに必要な前提知識</b>　' + H + '（開くと 30 秒で読める説明が出ます）';
    for (const p of PRE){ if (typeof p === 'string') h += '<details><summary>' + PREQ[p][0] + '</summary><p>' + PREQ[p][1] + '</p></details>'; else h += '<p style="margin:6px 0 0;font-size:13px">' + p.t + '　<a href="' + SERIES[p.no].file + '#s' + p.step + '">第' + p.no + '回のステップ' + p.step + 'を先に見てね</a></p>'; }
    h += '</div>';
  }
  if (r.ana) h += '<h3>① 身近なたとえ　' + H + '</h3><p>' + rt(r.ana) + '</p>';
  if (r.what) h += '<h3>② 何が起きているか</h3>' + rt(r.what).split('||').map(p => '<p>' + p + '</p>').join('');
  if (r.eq) h += '<h3>③ 大事な式</h3>' + eq(r.eq) + '<p class="sym">' + rt(r.sym) + '</p>';
  if (r.mis) h += '<h3>④ よくある誤解</h3><div class="mis">' + rt(r.mis) + '</div>';
  if (st.extra) h += '<div id="extra"></div>';
  h += '<div class="src"><b>出典</b>　Radar Handbook 3rd ed.　' + st.src + '</div>';
  if (st.memo) h += '<details class="memo"><summary>指導者向けメモ（つまずきやすい点と、声のかけ方）</summary>' + rt(st.memo).split('||').map(p => '<p>' + p + '</p>').join('') + '</details>';
  $('#read').innerHTML = h;
  if (st.extra) $('#extra').innerHTML = st.extra();
}
function renderSim(st, i){
  const sim = $('#sim'); sim.innerHTML = ''; PL = []; PLOTS.length = 0;
  const unlocked = (st.free && !st.q) || STATE.pred[i] !== undefined;
  if (st.q){
    const q = el('div', 'card q', '<span class="lbl">問い</span><p>' + st.q + '</p><div class="ch" id="choices">' + st.ch.map((c, k) => '<button type="button" data-k="' + k + '" aria-pressed="' + (STATE.pred[i] === k) + '">' + c + '</button>').join('') + '</div><div class="hint">まず予想を 1 つ選ぼう（当たり外れは気にしなくて大丈夫）。選ぶと下の操作部が使えるようになります。</div>');
    sim.appendChild(q);
    $('#choices', q).addEventListener('click', ev => { const k = ev.target && ev.target.dataset ? ev.target.dataset.k : undefined; if (k === undefined) return; STATE.pred[i] = Number(k); for (const b of $('#choices').children) b.setAttribute('aria-pressed', b.dataset.k === k); $('#opCard').classList.remove('locked'); $('#ansBtn').disabled = false; redraw(); });
  }
  const op = el('div', 'card op' + (unlocked ? '' : ' locked'), '<div class="lockmsg">予想してから触ろう</div><span class="lbl">操作</span><span class="hint" style="margin:0">' + (st.do || 'スライダーを動かして確かめよう') + '</span><div class="fixed" id="fixed" style="margin-top:6px"></div><div class="ctls" id="ctls"></div><div class="acts" id="acts"></div><div class="plotgrid" id="plots"></div><div class="tiles" id="tiles"></div>');
  op.id = 'opCard'; sim.appendChild(op);
  for (const c of (st.ctl || [])) buildCtl($('#ctls', op), c);
  const acts = $('#acts', op);
  for (const a of (st.acts || [])){
    const b = el('button', 'btn sm', a.t); b.type = 'button';
    if (a.play){ b.id = 'playBtn'; b.dataset.t = a.t; b.addEventListener('click', () => { if (playT){ stopPlay(); return; } b.textContent = '■ 止める'; const p = a.play; playT = setInterval(() => { let v = S[p.k] + p.step; if (v > p.max){ if (p.once){ S[p.k] = p.max; stopPlay(); userChanged(); return; } v = p.min; } S[p.k] = v; userChanged(); }, p.ms || 90); }); }
    else b.addEventListener('click', () => { a.f(); userChanged(); });
    acts.appendChild(b);
  }
  for (const p of (st.plots || [{}])) PL.push(new Plot($('#plots', op), {h: p.h || 230}));
  if (st.mission){ const m = el('div', 'card ms', '<span class="lbl" style="background:var(--s2)">ミッション</span><span class="st"></span><p>' + st.mission.t + '</p>'); m.id = 'msCard'; sim.appendChild(m); }
  if (st.q){
    const a = el('div', 'card ans', '<button type="button" class="btn primary" id="ansBtn"' + (unlocked ? '' : ' disabled') + '>答えを見る</button>　<span class="hint">操作して確かめてから押そう</span><div class="body" id="ansBody" hidden></div>');
    sim.appendChild(a); $('#ansBtn', a).addEventListener('click', () => { STATE.shown[i] = true; showAnswer(); });
  }
}
function goStep(i){
  stopPlay(); cur = Math.max(0, Math.min(STEPS.length - 1, i)); const st = STEPS[cur];
  resetS(st.init || {}); STATE.touched = false; HLKEY = null;
  renderRead(st, cur); renderSim(st, cur);
  for (const b of $('#steps').children) b.setAttribute('aria-current', String(Number(b.dataset.i) === cur));
  $('#prevBtn').disabled = cur === 0; $('#nextBtn').disabled = cur === STEPS.length - 1;
  redraw(); showAnswer();
  try { if (location.hash !== '#s' + (cur + 1)) history.replaceState(null, '', '#s' + (cur + 1)); } catch (e) {}
}
function highlight(key){
  clearTimeout(hlT); for (const e of document.querySelectorAll('.flash')) e.classList.remove('flash');
  let target = null;
  if (key.indexOf('ctl:') === 0){ target = document.querySelector('#sim .ctl[data-k="' + key.slice(4) + '"]'); HLKEY = null; }
  else if (key.indexOf('tile:') === 0){ target = document.querySelectorAll('#tiles .tile')[Number(key.slice(5))]; HLKEY = null; }
  else { HLKEY = key; for (const p of PLOTS) if (p.cfg && p.cfg.marks && p.cfg.marks[key]){ target = p.root; break; } }
  if (target && target.classList && HLKEY === null) target.classList.add('flash');
  redrawAll();
  if (target){ const r = target.getBoundingClientRect(); if (r.top < 50 || r.bottom > innerHeight) target.scrollIntoView({block: 'center', behavior: 'smooth'}); }
  hlT = setTimeout(() => { HLKEY = null; for (const e of document.querySelectorAll('.flash')) e.classList.remove('flash'); redrawAll(); }, 4000);
}
function buildGloss(){
  const g = $('#gloss'), grp = n => GLOSS.filter(t => t[0] === n).map(t => '<dt>' + t[1] + '</dt><dd>' + t[2] + '</dd>').join('');
  let h = '<h2>用語集（4 回共通）<button class="btn sm" type="button" id="glClose">閉じる</button></h2><input type="search" id="glFind" placeholder="用語をさがす" aria-label="用語をさがす"><dl id="glList">';
  h += '<h3>この回（第' + SIM_NO + '回 ' + SERIES[SIM_NO].name + '）の用語</h3>' + grp(SIM_NO) + '<h3>基礎の用語　' + H + '</h3>' + grp(0);
  for (let n = 1; n <= 4; n++) if (n !== SIM_NO) h += '<h3>第' + n + '回 ' + SERIES[n].name + '</h3>' + grp(n);
  g.innerHTML = h + '</dl><p class="sym" style="margin-top:12px">用語の訳と説明は、Radar Handbook 3rd ed. の用語を新人向けに言い換えたものです。「基礎の用語」は一般的な知識による補足です。</p>';
  const toggle = on => { g.hidden = !on; if (on) $('#glFind').focus(); };
  $('#glBtn').addEventListener('click', () => toggle(g.hidden)); $('#glTab').addEventListener('click', () => toggle(g.hidden)); $('#glClose').addEventListener('click', () => toggle(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') toggle(false); });
  $('#glFind').addEventListener('input', e => { const q = e.target.value.trim().toLowerCase(); for (const dt of g.querySelectorAll('dt')){ const hit = !q || (dt.textContent + dt.nextElementSibling.textContent).toLowerCase().indexOf(q) >= 0; dt.hidden = !hit; dt.nextElementSibling.hidden = !hit; } });
}
function applyTheme(t){ document.documentElement.setAttribute('data-theme', t); $('#themeBtn').textContent = '表示: ' + (t === 'dark' ? 'ダーク' : 'ライト'); redrawAll(); }
function boot(){
  const nav = $('#steps');
  STEPS.forEach((s, i) => { const b = el('button', '', '<i>' + (i + 1) + '</i>' + s.short); b.type = 'button'; b.dataset.i = i; b.addEventListener('click', () => goStep(i)); nav.appendChild(b); });
  $('#prevBtn').addEventListener('click', () => { goStep(cur - 1); window.scrollTo(0, 0); });
  $('#nextBtn').addEventListener('click', () => { goStep(cur + 1); window.scrollTo(0, 0); });
  $('#msbar').addEventListener('click', e => { const i = e.target && e.target.dataset ? e.target.dataset.i : undefined; if (i !== undefined) goStep(Number(i)); });
  const onTerm = e => { const a = e.target && e.target.closest ? e.target.closest('a.term') : null; if (a && (e.type === 'click' || e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); highlight(a.dataset.hl); } };
  $('#read').addEventListener('click', onTerm); $('#read').addEventListener('keydown', onTerm);
  buildGloss();
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  let theme = mq && mq.matches ? 'dark' : 'light';
  $('#themeBtn').addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; applyTheme(theme); });
  document.documentElement.setAttribute('data-theme', theme);
  const h = /^#s(\d+)$/.exec(location.hash || '');
  goStep(h ? Number(h[1]) - 1 : 0); applyTheme(theme);
  window.addEventListener('hashchange', () => { const m = /^#s(\d+)$/.exec(location.hash || ''); if (m && Number(m[1]) - 1 !== cur) goStep(Number(m[1]) - 1); });
  if (window.ResizeObserver) new ResizeObserver(() => redrawAll()).observe($('#sim')); else window.addEventListener('resize', redrawAll);
}
