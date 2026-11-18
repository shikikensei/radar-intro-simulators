/* ============================================================
   画面まわりの共通部品
   ============================================================ */
const $ = (s, r) => (r || document).querySelector(s);
function el(tag, cls, html){ const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
function fx(v, d){ if (!isFinite(v)) return '—'; const s = Math.abs(v).toFixed(d); return (v < 0 && Number(s) !== 0 ? MINUS : '') + s; }
const H = '<span class="hosoku">補足</span>';
let HLKEY = null;
const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function toDb(mag, ref){ const o = new Float64Array(mag.length), r = ref || 1; for (let i = 0; i < mag.length; i++) o[i] = 20 * Math.log10(Math.max(mag[i] / r, 1e-7)); return o; }
function maxIn(arr, i0, i1){ let m = 0; i0 = Math.max(0, i0 | 0); i1 = Math.min(arr.length - 1, i1 | 0); for (let i = i0; i <= i1; i++) if (arr[i] > m) m = arr[i]; return m; }

/* ---------- canvas グラフ ---------- */
const PLOTS = [];
function niceStep(span, target){
  const raw = span / Math.max(1, target), p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
}
function tickFmt(step){ const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9)); return v => fx(v, Math.min(d, 6)); }
class Plot {
  constructor(host, o){
    this.o = Object.assign({h: 200}, o || {});
    this.root = el('div', 'plot', '<div class="plot-h"><span class="plot-t"></span><span class="plot-lg"></span></div>' +
      '<div class="plot-c" style="height:' + this.o.h + 'px"><canvas></canvas><canvas class="ov"></canvas><div class="tip" hidden></div></div>');
    host.appendChild(this.root);
    this.tEl = $('.plot-t', this.root); this.lgEl = $('.plot-lg', this.root); this.box = $('.plot-c', this.root);
    this.cv = this.box.children[0]; this.ov = this.box.children[1]; this.tip = this.box.children[2];
    this.ov.addEventListener('pointermove', e => this.hover(e));
    this.ov.addEventListener('pointerleave', () => { this.tip.hidden = true; this.clearOv(); });
    PLOTS.push(this);
  }
  set(cfg){ this.cfg = cfg; this.draw(); }
  col(k){ return cssv('--' + (k || 's1')); }
  draw(){
    const cfg = this.cfg; if (!cfg) return;
    const W = this.box.clientWidth, Hh = this.o.h; if (W < 60) return;
    const dpr = window.devicePixelRatio || 1;
    for (const c of [this.cv, this.ov]){ c.width = Math.round(W * dpr); c.height = Math.round(Hh * dpr); }
    const g = this.cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Hh);
    const m = {l: 56, r: cfg.heat ? 66 : 14, t: 16, b: cfg.xl ? 38 : 22}, pw = W - m.l - m.r, ph = Hh - m.t - m.b;
    let xr = cfg.xr; const yr = cfg.yr;
    if (cfg.equal){ const c0 = (xr[0] + xr[1]) / 2, half = (yr[1] - yr[0]) / 2 * pw / ph; xr = [c0 - half, c0 + half]; }
    this.xr = xr;
    const X = v => m.l + (v - xr[0]) / (xr[1] - xr[0]) * pw, Y = v => m.t + (1 - (v - yr[0]) / (yr[1] - yr[0])) * ph;
    this.geo = {m, pw, ph, W, Hh, X, Y};
    this.tEl.textContent = cfg.title || '';
    this.lgEl.innerHTML = cfg.series.filter(s => s.name && !s.noLegend).map(s =>
      '<span><i style="border-top-color:' + this.col(s.color) + ';border-top-style:' + (s.dash ? 'dashed' : s.noLine ? 'dotted' : 'solid') + '"></i>' + s.name + '</span>').join('');
    const cText = cssv('--text2'), cMuted = cssv('--muted'), cGrid = cssv('--grid'), cAxis = cssv('--axis');
    g.font = '11px "Yu Gothic UI","Meiryo UI",Meiryo,system-ui,sans-serif';
    /* 帯 */
    for (const b of (cfg.bands || [])){
      const x0 = Math.max(m.l, X(b.x0)), x1 = Math.min(m.l + pw, X(b.x1)); if (x1 <= x0) continue;
      g.fillStyle = cssv('--' + (b.color || 'band')); g.fillRect(x0, m.t, x1 - x0, ph);
      if (b.label){ g.fillStyle = cText; g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText(b.label, Math.min(Math.max((x0 + x1) / 2, m.l + 40), m.l + pw - 40), m.t + 3 + (b.row || 0) * 13); }
    }
    const halo = !!cfg.heat, cSurf = cssv('--surface');
    const ft = (str, x, y) => { if (halo){ g.save(); g.lineWidth = 3; g.lineJoin = 'round'; g.strokeStyle = cSurf; g.strokeText(str, x, y); g.restore(); } g.fillText(str, x, y); };
    /* 濃淡図（距離–ドップラマップなど）。行・列が画素より多いときは最大値でまとめる（ピークを落とさない） */
    if (cfg.heat){
      const hm = cfg.heat, dark = document.documentElement.getAttribute('data-theme') === 'dark', pr = Math.max(1, Math.ceil(hm.rows / Math.max(1, ph))), pc = Math.max(1, Math.ceil(hm.cols / Math.max(1, pw)));
      const R = Math.ceil(hm.rows / pr), Cc = Math.ceil(hm.cols / pc), off = document.createElement('canvas'); off.width = Cc; off.height = R;
      const og = off.getContext('2d'), img = og.createImageData(Cc, R), nn = heatRGB(-1, dark);
      for (let r = 0; r < R; r++) for (let c = 0; c < Cc; c++){
        let v = -Infinity, any = false;
        for (let a = r * pr; a < Math.min(hm.rows, (r + 1) * pr); a++) for (let b = c * pc; b < Math.min(hm.cols, (c + 1) * pc); b++){ const z = hm.db[a * hm.cols + b]; if (z === z){ any = true; if (z > v) v = z; } }
        const rgb = any ? heatRGB((v - hm.zmin) / (hm.zmax - hm.zmin), dark) : nn, o = ((R - 1 - r) * Cc + c) * 4;
        img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255;
      }
      og.putImageData(img, 0, 0);
      g.save(); g.beginPath(); g.rect(m.l, m.t, pw, ph); g.clip(); g.imageSmoothingEnabled = false;
      g.drawImage(off, X(hm.x0), Y(hm.y1), X(hm.x1) - X(hm.x0), Y(hm.y0) - Y(hm.y1)); g.restore();
      /* 色の凡例 */
      const bx = m.l + pw + 10, bw = 10; for (let i = 0; i < ph; i++){ const rgb = heatRGB(1 - i / (ph - 1), dark); g.fillStyle = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')'; g.fillRect(bx, m.t + i, bw, 1.5); }
      g.strokeStyle = cAxis; g.lineWidth = 1; g.strokeRect(bx + 0.5, m.t + 0.5, bw, ph);
      g.fillStyle = cMuted; g.textAlign = 'left'; g.textBaseline = 'middle';
      const zs = hm.zticks || (() => { const st = niceStep(hm.zmax - hm.zmin, 5), a = []; for (let v = Math.ceil(hm.zmin / st) * st; v <= hm.zmax + 1e-9; v += st) a.push([v, fx(v, 0)]); return a; })();
      for (const z of zs) g.fillText(z[1], bx + bw + 4, m.t + (1 - (z[0] - hm.zmin) / (hm.zmax - hm.zmin)) * ph);
      if (hm.zl){ g.fillStyle = cText; g.textAlign = 'right'; g.textBaseline = 'bottom'; g.fillText(hm.zl, W - 2, Hh - 3); }
    }
    /* 目盛と格子 */
    const xs = niceStep(xr[1] - xr[0], Math.max(3, Math.floor(pw / 90))), ys = niceStep(yr[1] - yr[0], Math.max(2, Math.floor(ph / 34)));
    const xf = cfg.xfmt || tickFmt(xs), yf = cfg.yfmt || tickFmt(ys);
    g.lineWidth = 1; g.strokeStyle = cfg.heat ? 'rgba(0,0,0,0)' : cGrid; g.fillStyle = cMuted;
    g.textAlign = 'center'; g.textBaseline = 'top';
    if (cfg.xticks){
      for (const tk of cfg.xticks){ if (tk[0] < xr[0] - 1e-9 || tk[0] > xr[1] + 1e-9) continue;
        const px = Math.round(X(tk[0])) + 0.5; g.globalAlpha = tk[1] ? 1 : 0.5; g.beginPath(); g.moveTo(px, m.t); g.lineTo(px, m.t + ph); g.stroke(); g.globalAlpha = 1; if (tk[1]) g.fillText(tk[1], px, m.t + ph + 5); }
    } else for (let v = Math.ceil(xr[0] / xs - 1e-9) * xs; v <= xr[1] + xs * 1e-6; v += xs){
      const px = Math.round(X(v)) + 0.5; g.beginPath(); g.moveTo(px, m.t); g.lineTo(px, m.t + ph); g.stroke(); g.fillText(xf(v), px, m.t + ph + 5);
    }
    g.textAlign = 'right'; g.textBaseline = 'middle';
    if (cfg.yticks){
      for (const tk of cfg.yticks){ if (tk[0] < yr[0] - 1e-9 || tk[0] > yr[1] + 1e-9) continue;
        const py = Math.round(Y(tk[0])) + 0.5; g.globalAlpha = tk[1] ? 1 : 0.5; g.beginPath(); g.moveTo(m.l, py); g.lineTo(m.l + pw, py); g.stroke(); g.globalAlpha = 1; if (tk[1]) g.fillText(tk[1], m.l - 6, py); }
    } else for (let v = Math.ceil(yr[0] / ys - 1e-9) * ys; v <= yr[1] + ys * 1e-6; v += ys){
      const py = Math.round(Y(v)) + 0.5; g.beginPath(); g.moveTo(m.l, py); g.lineTo(m.l + pw, py); g.stroke(); g.fillText(yf(v), m.l - 6, py);
    }
    g.strokeStyle = cAxis; g.strokeRect(m.l + 0.5, m.t + 0.5, pw, ph);
    g.fillStyle = cText; g.textAlign = 'center'; g.textBaseline = 'bottom';
    if (cfg.xl) g.fillText(cfg.xl, m.l + pw / 2, Hh - 3);
    if (cfg.yl){ g.save(); g.translate(11, m.t + ph / 2); g.rotate(-Math.PI / 2); g.textBaseline = 'middle'; g.fillText(cfg.yl, 0, 0); g.restore(); }
    /* 系列 */
    g.save(); g.beginPath(); g.rect(m.l, m.t, pw, ph); g.clip();
    const ylo = yr[0] - (yr[1] - yr[0]), yhi = yr[1] + (yr[1] - yr[0]);
    const cl = v => v < ylo ? ylo : v > yhi ? yhi : (v === v ? v : ylo);
    for (const s of cfg.series){
      const col = this.col(s.color);
      g.strokeStyle = col; g.lineWidth = s.w || 1.8; g.setLineDash(s.dash || []); g.globalAlpha = s.alpha || 1; g.lineJoin = 'round';
      if (s.stem || s.mk){          /* 棒（ステム）と点の表示：パルスごとのサンプルなど */
        const n = s.x ? s.x.length : s.y.length, xa = i => s.x ? s.x[i] : s.x0 + i * s.dx, y0 = Y(cl(s.base || 0));
        if (s.stem){ g.beginPath(); for (let i = 0; i < n; i++){ const px = X(xa(i)); g.moveTo(px, y0); g.lineTo(px, Y(cl(s.y[i]))); } g.stroke(); }
        if (s.mk){ g.fillStyle = col; for (let i = 0; i < n; i++){ g.beginPath(); g.arc(X(xa(i)), Y(cl(s.y[i])), s.mk, 0, 2 * Math.PI); g.fill(); } }
        if (s.stem || s.noLine){ g.globalAlpha = 1; g.setLineDash([]); continue; }
      }
      g.beginPath();
      let fx0 = null, fx1 = null;
      if (s.x){
        for (let i = 0; i < s.x.length; i++){ const px = X(s.x[i]), py = Y(cl(s.y[i])); if (i){ if (s.step) g.lineTo(px, Y(cl(s.y[i - 1]))); g.lineTo(px, py); } else g.moveTo(px, py); }
        if (s.x.length){ fx0 = X(s.x[0]); fx1 = X(s.x[s.x.length - 1]); }
      } else {
        const n = s.y.length, i0 = Math.max(0, Math.floor((xr[0] - s.x0) / s.dx) - 1), i1 = Math.min(n - 1, Math.ceil((xr[1] - s.x0) / s.dx) + 1);
        if (i1 > i0){
          fx0 = X(s.x0 + i0 * s.dx); fx1 = X(s.x0 + i1 * s.dx);
          if (i1 - i0 > pw * 3){            /* 点が多いときは画素列ごとの最小・最大で描く（ピークを落とさない） */
            let cur = -1e9, lo = 0, hi = 0, first = 0, last = 0, started = false;
            const flush = () => { if (cur < -1e8) return; if (!started){ g.moveTo(cur, Y(first)); started = true; } else g.lineTo(cur, Y(first)); g.lineTo(cur, Y(lo)); g.lineTo(cur, Y(hi)); g.lineTo(cur, Y(last)); };
            for (let i = i0; i <= i1; i++){
              const px = Math.round(X(s.x0 + i * s.dx)), v = cl(s.y[i]);
              if (px !== cur){ flush(); cur = px; lo = hi = first = last = v; } else { if (v < lo) lo = v; if (v > hi) hi = v; last = v; }
            }
            flush();
          } else {
            for (let i = i0; i <= i1; i++){ const px = X(s.x0 + i * s.dx), py = Y(cl(s.y[i])); if (i === i0) g.moveTo(px, py); else g.lineTo(px, py); }
          }
        }
      }
      g.stroke();
      if (s.fill && fx0 !== null){ g.lineTo(fx1, Y(s.base || 0)); g.lineTo(fx0, Y(s.base || 0)); g.closePath(); g.globalAlpha = s.fill; g.fillStyle = col; g.fill(); }
      g.globalAlpha = 1; g.setLineDash([]);
    }
    for (const a of (cfg.arrows || [])){      /* ベクトル（矢印） */
      const x0 = X(a.x0 || 0), y0 = Y(a.y0 || 0), x1 = X(a.x1), y1 = Y(a.y1), ang = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0), h = Math.min(9, L * 0.4);
      g.strokeStyle = g.fillStyle = this.col(a.color); g.lineWidth = a.w || 2; g.globalAlpha = a.alpha || 1; g.setLineDash(a.dash || []);
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.setLineDash([]);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - h * Math.cos(ang - 0.4), y1 - h * Math.sin(ang - 0.4)); g.lineTo(x1 - h * Math.cos(ang + 0.4), y1 - h * Math.sin(ang + 0.4)); g.closePath(); g.fill(); g.globalAlpha = 1;
    }
    for (const r of (cfg.rects || [])){      /* 枠（あいまいなし領域など） */
      const x0 = X(r.x0), x1 = X(r.x1), y0 = Y(r.y1), y1 = Y(r.y0);
      if (r.fill){ g.globalAlpha = r.fill; g.fillStyle = this.col(r.color); g.fillRect(x0, y0, x1 - x0, y1 - y0); g.globalAlpha = 1; }
      if (r.w !== 0){ g.strokeStyle = this.col(r.color); g.lineWidth = r.w || 1.5; g.setLineDash(r.dash || []); g.strokeRect(x0, y0, x1 - x0, y1 - y0); g.setLineDash([]); }
    }
    g.restore();
    /* 補助線 */
    let row = 0;
    for (const h of (cfg.hl || [])){
      if (h.y < yr[0] || h.y > yr[1]) continue;
      const py = Math.round(Y(h.y)) + 0.5; g.strokeStyle = this.col(h.color || 'ref'); g.lineWidth = 1; g.setLineDash(h.dash || [4, 3]);
      g.beginPath(); g.moveTo(m.l, py); g.lineTo(m.l + pw, py); g.stroke(); g.setLineDash([]);
      if (h.label){ g.fillStyle = cText; g.textAlign = h.left ? 'left' : 'right'; g.textBaseline = 'bottom'; ft(h.label, h.left ? m.l + 5 : m.l + pw - 5, py - 2); }
    }
    for (const v of (cfg.vl || [])){
      if (v.x < xr[0] || v.x > xr[1]) continue;
      const px = Math.round(X(v.x)) + 0.5; g.strokeStyle = this.col(v.color || 'ref'); g.lineWidth = v.w || 1; g.setLineDash(v.dash || [4, 3]);
      g.beginPath(); g.moveTo(px, m.t); g.lineTo(px, m.t + ph); g.stroke(); g.setLineDash([]);
      if (v.label){
        const tw = g.measureText(v.label).width, right = px + 4 + tw < m.l + pw;
        g.fillStyle = cText; g.textAlign = right ? 'left' : 'right'; g.textBaseline = 'top';
        ft(v.label, right ? px + 4 : px - 4, m.t + 3 + (v.row !== undefined ? v.row : row++ % 3) * 13);
      }
    }
    for (const p of (cfg.pts || [])){
      if (p.x < xr[0] || p.x > xr[1] || p.y < yr[0] - 1e-9 && p.clipY || p.y > yr[1] + 1e-9 && p.clipY) continue;
      const px = X(p.x), py = Y(Math.min(Math.max(p.y, yr[0]), yr[1]));
      if (p.shape === 'x'){ const r = p.r || 4; for (const pass of [0, 1]){ g.lineWidth = pass ? 2 : 4.5; g.strokeStyle = pass ? this.col(p.color) : cSurf; g.lineCap = 'round'; g.beginPath(); g.moveTo(px - r, py - r); g.lineTo(px + r, py + r); g.moveTo(px + r, py - r); g.lineTo(px - r, py + r); g.stroke(); } g.lineCap = 'butt'; }
      else if (p.hollow){ g.lineWidth = 4; g.strokeStyle = cSurf; g.beginPath(); g.arc(px, py, p.r || 7, 0, 2 * Math.PI); g.stroke(); g.lineWidth = 2; g.strokeStyle = this.col(p.color); if (p.dash) g.setLineDash(p.dash); g.beginPath(); g.arc(px, py, p.r || 7, 0, 2 * Math.PI); g.stroke(); g.setLineDash([]); }
      else { g.fillStyle = this.col(p.color); g.strokeStyle = cSurf; g.lineWidth = 2; g.beginPath(); g.arc(px, py, p.r || 4.5, 0, 2 * Math.PI); g.fill(); g.stroke(); }
      if (p.label){ const dxl = (p.hollow ? (p.r || 7) + 3 : 7); g.fillStyle = cText; g.textAlign = p.left ? 'right' : 'left'; g.textBaseline = p.below ? 'top' : 'bottom'; ft(p.label, px + (p.left ? -dxl : dxl), py + (p.below ? 3 : -3)); }
    }
    /* 吹き出し（矢印つきの短い注記）：{x, y, t, dx, dy}。dx・dy は点から吹き出しまでのずれ [px] */
    g.font = 'bold 11.5px "Yu Gothic UI","Meiryo UI",Meiryo,system-ui,sans-serif';
    for (const nt of (cfg.notes || [])){
      if (nt.x < xr[0] || nt.x > xr[1]) continue;
      const px = X(nt.x), py = Y(Math.min(Math.max(nt.y, yr[0]), yr[1])), tw = g.measureText(nt.t).width + 12, dx = nt.dx === undefined ? 30 : nt.dx, dy = nt.dy === undefined ? -28 : nt.dy;
      let bx = dx >= 0 ? px + dx : px + dx - tw, by = py + dy - 10; bx = Math.max(m.l + 2, Math.min(m.l + pw - tw - 2, bx)); by = Math.max(m.t + 2, Math.min(m.t + ph - 22, by));
      const ex = Math.max(bx, Math.min(bx + tw, px)), ey = by + 10 < py ? by + 20 : by, ang = Math.atan2(py - ey, px - ex), cA = cssv('--accent');
      g.strokeStyle = cA; g.fillStyle = cA; g.lineWidth = 1.5; g.beginPath(); g.moveTo(ex, ey); g.lineTo(px - 5 * Math.cos(ang), py - 5 * Math.sin(ang)); g.stroke();
      g.beginPath(); g.moveTo(px - 3 * Math.cos(ang), py - 3 * Math.sin(ang)); g.lineTo(px - 10 * Math.cos(ang - 0.4), py - 10 * Math.sin(ang - 0.4)); g.lineTo(px - 10 * Math.cos(ang + 0.4), py - 10 * Math.sin(ang + 0.4)); g.closePath(); g.fill();
      g.fillStyle = cssv('--accent-bg'); g.strokeStyle = cA; g.lineWidth = 1.2; g.beginPath(); g.rect(bx + 0.5, by + 0.5, tw, 20); g.fill(); g.stroke();
      g.fillStyle = cssv('--text'); g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(nt.t, bx + 6, by + 11);
    }
    /* 読み物の用語をクリックしたときの強調：marks = {キー: {x0, x1, y0, y1, t}} のうち、いま選ばれているキーだけ描く */
    const mk = cfg.marks && HLKEY ? cfg.marks[HLKEY] : null;
    if (mk){
      const x0 = Math.max(m.l, X(mk.x0 === undefined ? xr[0] : mk.x0)), x1 = Math.min(m.l + pw, X(mk.x1 === undefined ? xr[1] : mk.x1)), y0 = Math.max(m.t, Y(mk.y1 === undefined ? yr[1] : mk.y1)), y1 = Math.min(m.t + ph, Y(mk.y0 === undefined ? yr[0] : mk.y0));
      const a0 = Math.min(x0, x1) - 3, b0 = Math.min(y0, y1) - 3, ww = Math.max(8, Math.abs(x1 - x0) + 6), hh = Math.max(8, Math.abs(y1 - y0) + 6), cH = cssv('--hl');
      g.fillStyle = cH; g.globalAlpha = 0.16; g.fillRect(a0, b0, ww, hh); g.globalAlpha = 1; g.strokeStyle = cH; g.lineWidth = 3; g.strokeRect(a0, b0, ww, hh);
      if (mk.t){ const tw = g.measureText(mk.t).width + 12, bx = Math.max(m.l + 2, Math.min(m.l + pw - tw - 2, a0 + ww / 2 - tw / 2)), by = b0 > m.t + 26 ? b0 - 24 : Math.min(m.t + ph - 22, b0 + hh + 4);
        g.fillStyle = cH; g.fillRect(bx, by, tw, 20); g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(mk.t, bx + 6, by + 11); }
    }
    g.font = '11px "Yu Gothic UI","Meiryo UI",Meiryo,system-ui,sans-serif';
    for (const t of (cfg.texts || [])){
      g.fillStyle = cText; g.textAlign = t.align || 'left'; g.textBaseline = 'top'; ft(t.s, t.px !== undefined ? m.l + t.px * pw : X(t.x), t.y !== undefined ? Y(t.y) : m.t + 3 + (t.row || 0) * 13);
    }
  }
  clearOv(){ const g = this.ov.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.ov.width, this.ov.height); }
  hover(e){
    const cfg = this.cfg, geo = this.geo; if (!cfg || !geo || cfg.noHover) return;
    const rc = this.ov.getBoundingClientRect(), px = e.clientX - rc.left, m = geo.m;
    if (px < m.l || px > m.l + geo.pw){ this.tip.hidden = true; this.clearOv(); return; }
    const xv = this.xr[0] + (px - m.l) / geo.pw * (this.xr[1] - this.xr[0]);
    const dpr = window.devicePixelRatio || 1, g = this.ov.getContext('2d');
    this.clearOv(); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.strokeStyle = cssv('--axis'); g.lineWidth = 1;
    g.beginPath(); g.moveTo(Math.round(px) + 0.5, m.t); g.lineTo(Math.round(px) + 0.5, m.t + geo.ph); g.stroke();
    const xf = cfg.tipx || (v => fx(v, 3)), yf = cfg.tipy || (v => fx(v, 3));
    let html = '<b>' + xf(xv) + '</b>';
    if (cfg.heat){
      const hm = cfg.heat, py = e.clientY - rc.top; if (py < m.t || py > m.t + geo.ph){ this.tip.hidden = true; this.clearOv(); return; }
      const yv = cfg.yr[1] - (py - m.t) / geo.ph * (cfg.yr[1] - cfg.yr[0]);
      g.beginPath(); g.moveTo(m.l, Math.round(py) + 0.5); g.lineTo(m.l + geo.pw, Math.round(py) + 0.5); g.stroke();
      const c = Math.floor((xv - hm.x0) / (hm.x1 - hm.x0) * hm.cols), r = Math.floor((yv - hm.y0) / (hm.y1 - hm.y0) * hm.rows);
      html += '<div>' + (cfg.tipy2 || (v => fx(v, 3)))(yv) + '</div>';
      if (c >= 0 && c < hm.cols && r >= 0 && r < hm.rows){ const z = hm.db[r * hm.cols + c]; html += '<div>' + (hm.tipz ? hm.tipz(z) : (z === z ? fx(z, 1) + ' dB' : '受信なし')) + '</div>'; }
    }
    for (const s of cfg.series){
      if (!s.name || s.noTip) continue;
      let v = NaN;
      if (s.x){ let lo = 0, hi = s.x.length - 1; if (hi < 0 || xv < s.x[0] || xv > s.x[hi]) continue;
        while (hi - lo > 1){ const mid = (lo + hi) >> 1; if (s.x[mid] <= xv) lo = mid; else hi = mid; }
        const d = s.x[hi] - s.x[lo]; v = d > 0 ? s.y[lo] + (s.y[hi] - s.y[lo]) * (xv - s.x[lo]) / d : s.y[lo];
      } else { const i = Math.round((xv - s.x0) / s.dx); if (i < 0 || i >= s.y.length) continue; v = s.y[i]; }
      if (v !== v) continue;
      html += '<div><i style="border-top-color:' + this.col(s.color) + ';border-top-style:' + (s.dash ? 'dashed' : 'solid') + '"></i>' + s.name + '：' + yf(v) + '</div>';
    }
    this.tip.innerHTML = html; this.tip.hidden = false;
    const tw = this.tip.offsetWidth;
    this.tip.style.left = (px + 14 + tw > geo.W ? Math.max(0, px - tw - 12) : px + 12) + 'px';
  }
}
function redrawAll(){ for (const p of PLOTS) p.draw(); }
/* 濃淡図の色（1色相の濃淡。ライトでは薄→濃、ダークでは暗→明）。t < 0 は「受信なし」 */
const HEAT_L = [[250, 250, 248], [204, 222, 244], [128, 174, 232], [42, 120, 214], [20, 70, 150], [8, 26, 66]];
const HEAT_D = [[30, 30, 29], [22, 46, 84], [32, 88, 168], [57, 135, 229], [142, 190, 246], [240, 246, 255]];
function heatRGB(t, dark){
  if (t < 0 && t === -1) return dark ? [58, 58, 55] : [222, 221, 215];
  const st = dark ? HEAT_D : HEAT_L, x = Math.max(0, Math.min(1, t)) * (st.length - 1), i = Math.min(st.length - 2, Math.floor(x)), f = x - i;
  return [0, 1, 2].map(k => Math.round(st[i][k] + (st[i + 1][k] - st[i][k]) * f));
}

