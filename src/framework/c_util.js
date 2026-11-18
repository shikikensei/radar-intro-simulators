/* ============================================================
   第0回・第5回以降で共通に使う小さな道具
   ============================================================ */
const MINUS = '−';
function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gaussGen(seed){ const r = mulberry32(seed); let sp = null; return function(){ if (sp !== null){ const v = sp; sp = null; return v; } const u = Math.sqrt(-2 * Math.log(1 - r())), a = 2 * Math.PI * r(); sp = u * Math.sin(a); return u * Math.cos(a); }; }
const db10 = v => 10 * Math.log10(v);
const SUPD = {'-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹'};
function sup(n){ return String(n).split('').map(c => SUPD[c] || c).join(''); }
function sci(v, d){ if (!(v === v)) return '—'; if (v === 0) return '0'; let e = Math.floor(Math.log10(Math.abs(v))), m = v / Math.pow(10, e); if (Math.abs(m) >= 9.95){ m /= 10; e++; } return fx(m, d === undefined ? 1 : d) + '×10' + sup(e); }
function wilson(k, n){ if (!n) return [0, 1]; const z = 1.96, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [k === 0 ? 0 : Math.max(0, c - h), k === n ? 1 : Math.min(1, c + h)]; }
function checkTable(R){
  const lab = {ok: '<span class="ok">一致</span>', info: '<span class="info">差あり</span>', ng: '<span class="ng">不一致</span>', ref: '<span class="info">参考</span>'};
  let h = '<h3>ハンドブックの値との照合</h3><p class="sym">「差あり」は条件の違いなどで差があるもの、「参考」はハンドブックに基準値のない確認です（理由は備考）。</p><div class="tw"><table class="t"><tr><th>項目</th><th>ハンドブック（基準）</th><th>このシミュレータ</th><th>判定</th><th>備考</th></tr>';
  for (const r of R) h += '<tr><td>' + r.item + '</td><td>' + r.ref + '</td><td>' + r.calc + '</td><td>' + lab[r.st] + '</td><td><small>' + r.note + '</small></td></tr>';
  return h + '</table></div>';
}
const near = (a, b, tol) => Math.abs(a - b) <= tol ? 'ok' : 'ng';
