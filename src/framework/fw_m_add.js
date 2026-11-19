/* ============================================================
   中級シリーズ用の差し替え（make_fw_m.py が、fw_core2.js のうしろにつなぐ。入門の回には入らない）
   入門との違い：3 択の予想のかわりに、数値入力と判定（ask）、段階的なヒント、計算書（sheet）。
   ステップ定義に足すもの：
     ask: [{id, label, unit, ans（数値、または数値を返す関数）, tol, tolType: 'abs'|'rel', hints: [1 回目, 2 回目]}]
     solve: 解き方（正解したとき、または 3 回外れたときに全部見せる）
     sheet: 計算書の行を返す関数（省略すると、全ステップ共通の SHEET を使う）。行は {k: 項目, f: 式・根拠, v: 値, u: 単位, st: 決めるステップ, head: 見出し行}
     read: {what, eq, sym, tbl, cond（この式が使える条件）, fail（崩れる条件）, mis}
   ============================================================ */
const MST = {tries: [], ok: [], rev: [], val: [], fb: []};
const askAns = a => typeof a.ans === 'function' ? a.ans() : a.ans;
function askParse(s){ s = String(s || '').trim().replace(/[０-９．]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/[−－ー]/g, '-').replace(/,/g, ''); return s === '' ? NaN : Number(s); }
function askOk(a, v){ const t = askAns(a); return isFinite(v) && (a.tolType === 'rel' ? Math.abs(v - t) <= Math.abs(t) * a.tol * (1 + 1e-9) : Math.abs(v - t) <= a.tol * (1 + 1e-9)); }
const askTol = a => a.tolType === 'rel' ? '±' + fx(a.tol * 100, 0) + '%' : '±' + a.tol;
function sheetRows(){ const st = STEPS[cur]; return (st.sheet || SHEET)(lastR); }
function renderSheet(){
  const host = $('#sheet'); if (!host) return; const st = STEPS[cur], open = !st.ask || MST.ok[cur] || MST.rev[cur];
  let h = '<div class="tw"><table class="t sheet"><tr><th>項目</th><th>式・根拠</th><th>値</th><th>単位</th></tr>';
  for (const r of sheetRows()){
    if (r.head){ h += '<tr class="sh"><td colspan="4">' + r.head + '</td></tr>'; continue; }
    const s = r.st || 0, shown = s < cur + 1 || (s === cur + 1 && open) || st.free;
    h += '<tr class="' + (s === cur + 1 ? 'now' : '') + (shown ? '' : ' yet') + '"><td>' + r.k + '</td><td>' + (r.f || '') + '</td><td class="num">' + (shown ? r.v : s === cur + 1 ? '（これから計算）' : '（ステップ ' + s + '）') + '</td><td>' + (shown ? (r.u || '') : '') + '</td></tr>';
  }
  host.innerHTML = h + '</table></div>';
}
function redraw(){
  const st = STEPS[cur]; syncCtl();
  lastR = st.draw(PL) || {};
  const tl = $('#tiles'); if (tl) tl.innerHTML = tilesHtml(lastR.tiles);
  if (st.ask){ if (MST.ok[cur]) STATE.ms[cur] = true; }
  else if (st.mission && !STATE.ms[cur] && STATE.touched && st.mission.ok(lastR)) STATE.ms[cur] = true;
  renderSheet(); showMission();
}
function showAnswer(){}
function showSolve(){
  const st = STEPS[cur], b = $('#ansBody'); if (!b) return; const open = MST.ok[cur] || MST.rev[cur];
  b.hidden = !open; if (open) b.innerHTML = '<p><b>解き方</b></p>' + rt(st.solve || '').split('||').map(p => '<p>' + p + '</p>').join('');
  const w = $('#ansWait'); if (w) w.hidden = !!open;
}
function judge(){
  const st = STEPS[cur], i = cur, vals = {}, fb = $('#askFb'); let all = true, firstBad = null;
  for (const a of st.ask){ const e = document.querySelector('#asks input[data-id="' + a.id + '"]'), v = askParse(e.value), ok = askOk(a, v); vals[a.id] = e.value; e.classList.toggle('good', ok); e.classList.toggle('bad', !ok); e.setAttribute('aria-invalid', String(!ok)); if (!ok){ all = false; if (!firstBad) firstBad = a; } }
  MST.val[i] = vals;
  if (all){ MST.ok[i] = true; MST.fb[i] = '<p class="okline"><b>正解。</b>下のスライダーで条件を変え、答えの変化（感度）を確認</p>'; }
  else {
    MST.tries[i] = (MST.tries[i] || 0) + 1; const n = MST.tries[i], hs = firstBad.hints || [];
    let h = '<p class="ngline"><b>' + (isFinite(askParse(vals[firstBad.id])) ? '「' + firstBad.label + '」が許容範囲（' + askTol(firstBad) + '）の外' : '「' + firstBad.label + '」が未入力') + '</b>（' + n + ' 回目）</p>';
    for (let k = 0; k < Math.min(n, hs.length, 2); k++) h += '<p class="hintline">ヒント ' + (k + 1) + '：' + rt(hs[k]) + '</p>';
    if (n >= 3){ MST.rev[i] = true; h += '<p class="hintline">3 回目のため、下に解き方をすべて表示。確認のうえ再入力</p>'; }
    MST.fb[i] = h;
  }
  fb.innerHTML = MST.fb[i];
  if (MST.ok[i] || MST.rev[i]) $('#opCard').classList.remove('locked');
  STATE.touched = true; redraw(); showSolve();
}
function renderRead(st, i){
  const r = st.read || {}, para = s => rt(s).split('||').map(p => '<p>' + p + '</p>').join(''); let h = '<h2><span class="num">ステップ ' + (i + 1) + ' / ' + STEPS.length + '</span>' + st.title + '</h2>', n = 0; const no = () => '①②③④⑤⑥'[n++];
  if (i === 0 && typeof PRE !== 'undefined'){
    h += '<div class="pre"><b>この回に必要な前提知識</b>　' + H + '（入門の回で扱った内容）';
    for (const p of PRE){ if (typeof p === 'string'){ const L = PREQLINK[p], ok = L && SERIES[L[0]].ready; h += '<details><summary>' + PREQ[p][0] + '</summary><p>' + PREQ[p][1] + (ok ? '　<a href="' + SERIES[L[0]].file + '#s' + L[1] + '">詳細は入門 第' + L[0] + '回 ステップ ' + L[1] + '</a>' : '') + '</p></details>'; } else h += '<p style="margin:6px 0 0;font-size:13px">' + p.t + '　<a href="' + SERIES[p.no].file + '#s' + p.step + '">' + (SERIES[p.no].label || '入門 第' + p.no + '回') + ' ステップ ' + p.step + '</a></p>'; }
    h += '</div>';
  }
  if (r.ana) h += '<h3>' + no() + ' たとえ　' + H + '</h3><p>' + rt(r.ana) + '</p>';
  if (r.what) h += '<h3>' + no() + ' 考え方</h3>' + para(r.what);
  if (r.eq) h += '<h3>' + no() + ' 使う式</h3>' + eq(r.eq) + '<p class="sym">' + rt(r.sym) + '</p>';
  if (r.tbl) h += r.tbl;
  if (r.cond) h += '<h3>' + no() + ' この式が使える条件</h3>' + para(r.cond);
  if (r.fail) h += '<h3>' + no() + ' 崩れる条件</h3>' + para(r.fail);
  if (r.mis) h += '<h3>' + no() + ' よくある誤解</h3><div class="mis">' + rt(r.mis) + '</div>';
  if (st.extra) h += '<div id="extra"></div>';
  if (i === STEPS.length - 1){ const nx = SERIES[SIM_NO + 1]; h += nx && nx.ready ? '<p class="nextsim">この回はここまで。次は　<a class="btn primary" href="' + nx.file + '">' + nx.label + ' ' + nx.name + ' →</a></p>' : '<p class="nextsim">この回はここまで。<a href="00_index.html">目次へ戻る</a></p>'; }
  h += '<div class="src"><b>出典</b>　' + (st.srcRaw ? '' : 'Radar Handbook 3rd ed.　') + st.src + '</div>';
  if (st.memo) h += '<details class="memo"><summary>指導者向けメモ（つまずきやすい点と、声のかけ方）</summary>' + para(st.memo) + '</details>';
  $('#read').innerHTML = h;
  if (st.extra) $('#extra').innerHTML = st.extra();
}
function renderSim(st, i){
  const sim = $('#sim'); sim.innerHTML = ''; PL = []; PLOTS.length = 0;
  const unlocked = !st.ask || MST.ok[i] || MST.rev[i];
  if (st.ask){
    const v = MST.val[i] || {};
    const q = el('div', 'card q', '<span class="lbl">計算</span><div class="qm">' + rt(st.q).split('||').map(p => '<p>' + p + '</p>').join('') + '</div><div class="asks" id="asks">' + st.ask.map(a => '<label class="ask"><span class="al">' + a.label + '</span><span class="ai"><input type="text" inputmode="decimal" autocomplete="off" data-id="' + a.id + '" value="' + (v[a.id] === undefined ? '' : String(v[a.id]).replace(/"/g, '')) + '" aria-label="' + a.label.replace(/<[^>]*>/g, '') + '"><span class="au">' + (a.unit || '') + '</span><small>許容 ' + askTol(a) + '</small></span></label>').join('') +
      '</div><button type="button" class="btn primary" id="judgeBtn">判定する</button><div class="hint">手計算で求めた数値を入力（電卓の使用可）。外れた場合はヒントを 1 段ずつ表示</div><div id="askFb" class="fb">' + (MST.fb[i] || '') + '</div>');
    sim.appendChild(q);
    $('#judgeBtn', q).addEventListener('click', judge);
    $('#asks', q).addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); judge(); } });
  }
  const op = el('div', 'card op' + (unlocked ? '' : ' locked'), '<div class="lockmsg">先に計算して入力</div><span class="lbl">' + (st.ask ? '感度を見る' : '操作') + '</span><span class="hint" style="margin:0">' + (st.do || (st.ask ? '答え合わせのあとで条件を変え、答えの変化を確認' : 'スライダーを動かして確認')) + '</span><div class="fixed" id="fixed" style="margin-top:6px"></div><div class="ctls" id="ctls"></div><div class="acts" id="acts"></div><div class="plotgrid" id="plots"></div><div class="tiles" id="tiles"></div>');
  op.id = 'opCard'; sim.appendChild(op);
  for (const c of (st.ctl || [])) buildCtl($('#ctls', op), c);
  const acts = $('#acts', op);
  for (const a of (st.acts || [])){ const b = el('button', 'btn sm', a.t); b.type = 'button'; b.addEventListener('click', () => { a.f(); userChanged(); }); acts.appendChild(b); }
  for (const p of (st.plots || [{}])) PL.push(new Plot($('#plots', op), {h: p.h || 230}));
  const sh = el('div', 'card sheetc', '<span class="lbl">計算書</span><span class="hint" style="margin:0">' + (st.free ? '前提から結果までを、現在の設定の値で 1 枚にまとめた表' : 'ステップが進むごとに行を追加。値は標準の条件（P<sub>d</sub> 0.9 など）でのもの') + '</span><div id="sheet"></div>'); sim.appendChild(sh);
  if (st.mission){ const m = el('div', 'card ms', '<span class="lbl" style="background:var(--s2)">ミッション</span><span class="st"></span><p>' + st.mission.t + '</p>'); m.id = 'msCard'; sim.appendChild(m); }
  if (st.ask){ const a = el('div', 'card ans', '<div class="body" id="ansBody" hidden></div><span class="hint" id="ansWait">正解時（または 3 回外れた時点）に、ここに解き方を表示</span>'); sim.appendChild(a); showSolve(); }
}
/* 強調（marks）に高さの範囲がないとき、上を 2 割あける。ラベルが、枠の上（図の中）に出て、横軸の目盛りに重ならない */
const plotSetIntro = Plot.prototype.set;
Plot.prototype.set = function(cfg){ if (cfg && cfg.marks && cfg.yr) for (const k in cfg.marks){ const mk = cfg.marks[k]; if (mk.y0 === undefined && mk.y1 === undefined) mk.y1 = cfg.yr[1] - 0.2 * (cfg.yr[1] - cfg.yr[0]); } return plotSetIntro.call(this, cfg); };
function bootM(){
  STEPS.forEach((s, i) => { if (s.ask && !s.mission) s.mission = {t: '手計算で求めた値を入力し、「正解」と判定されること。', ok: () => !!MST.ok[i]}; });
  boot();
}
