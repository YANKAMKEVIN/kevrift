// @ts-check
/** Rendu canvas : sol des salles, héros, ennemis, boss, effets, HUD, écran titre. */
import { CFG } from './save.js';
import { BORDER, EDEF, H, PORTAL, ROMAN, TAU, W, ZONES } from './config.js';
import { $, R, clamp, lerp, rint, rnd } from './util.js';
import { TITLE, etat, game } from './state.js';
import { AU } from './audio.js';

export const stage = $('stage');
/** @type {HTMLCanvasElement} */
export const cv = $('cv');
const ctx = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d'));
const floorC = document.createElement('canvas');
floorC.width = W * 2;
floorC.height = H * 2;
const fctx = /** @type {CanvasRenderingContext2D} */ (floorC.getContext('2d'));
const bloomC = document.createElement('canvas');
bloomC.width = 240;
bloomC.height = 135;
const bctx = /** @type {CanvasRenderingContext2D} */ (bloomC.getContext('2d'));
/* ---------- réglages persistants ---------- */

/* ---------- mise à l'échelle ---------- */
export function resize() {
  etat.dpr = Math.min(2, window.devicePixelRatio || 1);
  etat.scale = Math.min(innerWidth / W, innerHeight / H);
  const cw = Math.floor(W * etat.scale), ch = Math.floor(H * etat.scale);
  stage.style.width = cw + 'px'; stage.style.height = ch + 'px';
  cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
  cv.width = Math.floor(cw * etat.dpr); cv.height = Math.floor(ch * etat.dpr);
  stage.style.fontSize = Math.max(8, 16 * etat.scale) + 'px';
}
/* ---------- sprites de lueur ---------- */
/** @type {Record<string, HTMLCanvasElement>} */
const glowCache = {};
function glowSprite(col) {
  if (glowCache[col]) return glowCache[col];
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, col); gr.addColorStop(.25, col + 'aa'); gr.addColorStop(.6, col + '33'); gr.addColorStop(1, col + '00');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return glowCache[col] = c;
}
function glow(x, y, r, col, a = 1) {
  ctx.globalAlpha = a; ctx.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1;
}
/* --- dessin du sol, mis en cache --- */
export function drawFloor() {
  const Z = ZONES[etat.room.z], g = fctx;
  g.setTransform(2, 0, 0, 2, 0, 0);
  g.fillStyle = Z.bg; g.fillRect(0, 0, W, H);
  let gr = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 560);
  gr.addColorStop(0, Z.floor + 'cc'); gr.addColorStop(1, Z.bg + '00');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // dalles en losange
  g.strokeStyle = Z.acc + '14'; g.lineWidth = 1;
  for (let i = -H; i < W + H; i += 48) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + H, H); g.stroke(); g.beginPath(); g.moveTo(i, H); g.lineTo(i + H, 0); g.stroke(); }
  // fissures lumineuses
  g.lineCap = 'round';
  for (let k = 0; k < 7; k++) {
    let x = rnd(BORDER, W - BORDER), y = rnd(BORDER, H - BORDER), a = rnd(TAU);
    const pts = [[x, y]];
    for (let i = 0; i < rint(5, 11); i++) { a += rnd(-.9, .9); x += Math.cos(a) * rnd(14, 34); y += Math.sin(a) * rnd(14, 34); pts.push([x, y]); }
    for (const [lw, al] of /** @type {[number, string][]} */ ([[7, '10'], [3, '30'], [1.2, '90']])) {
      g.strokeStyle = Z.acc + al; g.lineWidth = lw; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
    }
  }
  // cercle de runes central
  g.strokeStyle = Z.acc + '18'; g.lineWidth = 2;
  g.beginPath(); g.arc(W / 2, H / 2, 150, 0, TAU); g.stroke();
  g.beginPath(); g.arc(W / 2, H / 2, 120, 0, TAU); g.setLineDash([4, 10]); g.stroke(); g.setLineDash([]);
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.save(); g.translate(W / 2 + Math.cos(a) * 135, H / 2 + Math.sin(a) * 135); g.rotate(a); g.strokeRect(-4, -4, 8, 8); g.restore(); }
  // petits cristaux
  for (let i = 0; i < 40; i++) {
    const x = rnd(BORDER, W - BORDER), y = rnd(BORDER, H - BORDER), s = rnd(2, 5);
    g.fillStyle = Z.acc + (R.f() < .3 ? '55' : '22');
    g.beginPath(); g.moveTo(x, y - s * 1.6); g.lineTo(x + s, y); g.lineTo(x, y + s * .6); g.lineTo(x - s, y); g.fill();
  }
  // ombres des murs
  g.fillStyle = '#00000066';
  for (const w of etat.room.walls) if (!w.b) g.fillRect(w.x + 6, w.y + 10, w.w, w.h + 6);
  // murs
  for (const w of etat.room.walls) {
    if (w.b) continue;
    const dep = 12;
    g.fillStyle = Z.wall; g.fillRect(w.x, w.y + w.h - dep, w.w, dep + 4);
    gr = g.createLinearGradient(w.x, w.y - dep, w.x, w.y + w.h);
    gr.addColorStop(0, Z.wallTop); gr.addColorStop(1, Z.wall);
    g.fillStyle = gr; g.fillRect(w.x, w.y - dep, w.w, w.h);
    g.strokeStyle = Z.acc + 'aa'; g.lineWidth = 1.5; g.strokeRect(w.x + .75, w.y - dep + .75, w.w - 1.5, w.h - 1.5);
    g.strokeStyle = Z.acc + '33'; g.beginPath(); g.moveTo(w.x + 4, w.y - dep + 4); g.lineTo(w.x + w.w - 4, w.y + w.h - dep - 4); g.stroke();
    g.fillStyle = Z.acc + '22'; g.fillRect(w.x, w.y + w.h - dep, w.w, 2);
  }
  // enceinte
  gr = g.createLinearGradient(0, 0, 0, BORDER);
  g.fillStyle = Z.wall;
  g.fillRect(0, 0, W, BORDER); g.fillRect(0, H - BORDER, W, BORDER); g.fillRect(0, 0, BORDER, H); g.fillRect(W - BORDER, 0, BORDER, H);
  g.fillStyle = Z.wallTop; g.fillRect(0, 0, W, BORDER - 10); g.fillRect(0, 0, BORDER - 8, H); g.fillRect(W - BORDER + 8, 0, BORDER, H); g.fillRect(0, H - BORDER + 8, W, BORDER);
  g.strokeStyle = Z.acc + 'cc'; g.lineWidth = 2; g.strokeRect(BORDER, BORDER, W - BORDER * 2, H - BORDER * 2);
  g.strokeStyle = Z.acc + '33'; g.lineWidth = 8; g.strokeRect(BORDER + 4, BORDER + 4, W - BORDER * 2 - 8, H - BORDER * 2 - 8);
  for (let i = 0; i < 4; i++) { const cx = i % 2 ? W - BORDER / 2 : BORDER / 2, cy = i < 2 ? BORDER / 2 : H - BORDER / 2; g.fillStyle = Z.acc; g.beginPath(); g.moveTo(cx, cy - 7); g.lineTo(cx + 7, cy); g.lineTo(cx, cy + 7); g.lineTo(cx - 7, cy); g.fill(); }
  // vignette
  gr = g.createRadialGradient(W / 2, H / 2, 260, W / 2, H / 2, 620);
  gr.addColorStop(0, '#0000'); gr.addColorStop(1, '#000a');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
}
/* =========================================================
   RENDU
   ========================================================= */
export function render() {
  const k = etat.scale * etat.dpr;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  if (game.state === 'title' || !etat.room) { renderTitle(); return; }
  const sx = game.shake ? rnd(-game.shake, game.shake) * .5 : 0, sy = game.shake ? rnd(-game.shake, game.shake) * .5 : 0;
  ctx.save(); ctx.translate(sx, sy);
  ctx.drawImage(floorC, 0, 0, W, H);
  const Z = ZONES[etat.room.z], t = game.t;

  // évents
  for (const v of etat.room.vents) {
    const c = v.t % 3.2, warn = c > 1.8 && c < 2.5, on = c > 2.5 && c < 3.0;
    ctx.strokeStyle = Z.haz + (warn ? 'cc' : '44'); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(v.x, v.y, v.r, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#00000088'; ctx.beginPath(); ctx.arc(v.x, v.y, v.r * .55, 0, TAU); ctx.fill();
    if (warn) { ctx.fillStyle = Z.haz + '33'; ctx.beginPath(); ctx.arc(v.x, v.y, v.r * ((c - 1.8) / .7), 0, TAU); ctx.fill(); }
    if (on) { ctx.globalCompositeOperation = 'lighter'; glow(v.x, v.y, v.r * 2.2, Z.haz, 1 - (c - 2.5) / .5); for (let i = 0; i < 3; i++) glow(v.x + rnd(-10, 10), v.y - rnd(0, 30), rnd(14, 28), '#ffffff', .4); ctx.globalCompositeOperation = 'source-over'; }
  }
  // feux
  ctx.globalCompositeOperation = 'lighter';
  for (const f of etat.fires) glow(f.x, f.y, f.r * 1.8 * Math.min(1, f.t), '#ff8a3d', .55);
  ctx.globalCompositeOperation = 'source-over';
  // zones d'impact
  for (const z of etat.zones) {
    const col = z.k === 'drop' ? '#ffd45a' : '#8fe9ff', p = 1 - z.t / (z.k === 'drop' ? .9 : 1);
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = .8;
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.stroke();
    ctx.fillStyle = col + '33'; ctx.beginPath(); ctx.arc(z.x, z.y, z.r * clamp(p, 0, 1), 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
  // objets de salle
  if (etat.room.obj) drawObj(etat.room.obj);
  // portails
  for (const p of etat.portals) drawPortal(p);
  // apparitions
  for (const s of etat.spawners) {
    const p = 1 - s.t / s.max, col = s.elite ? '#ffd45a' : EDEF[s.type].col;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(t * 4);
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = .4 + p * .6;
    ctx.beginPath(); ctx.arc(0, 0, 26 * (1.4 - p * .6), 0, TAU * p); ctx.stroke();
    for (let i = 0; i < 4; i++) { ctx.rotate(TAU / 4); ctx.strokeRect(14, -3, 6, 6); }
    ctx.restore(); ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter'; glow(s.x, s.y, 30 * p, col, .7); ctx.globalCompositeOperation = 'source-over';
  }
  // ramassables
  ctx.globalCompositeOperation = 'lighter';
  for (const p of etat.picks) {
    if (p.k === 'shard') { glow(p.x, p.y, 12, '#3ff3e0', .7); ctx.fillStyle = '#c9fff8'; ctx.beginPath(); ctx.moveTo(p.x, p.y - 5); ctx.lineTo(p.x + 3, p.y); ctx.lineTo(p.x, p.y + 5); ctx.lineTo(p.x - 3, p.y); ctx.fill(); }
    else { glow(p.x, p.y, 20, '#6dffb0', .8); ctx.fillStyle = '#eafff3'; ctx.fillRect(p.x - 2, p.y - 6, 4, 12); ctx.fillRect(p.x - 6, p.y - 2, 12, 4); }
  }
  ctx.globalCompositeOperation = 'source-over';
  // ombres
  ctx.fillStyle = '#0000005a';
  for (const e of etat.enemies) { if (e.dead && e !== etat.boss) continue; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * .8, e.r * .9, e.r * .35, 0, 0, TAU); ctx.fill(); }
  if (!etat.P.dead) { ctx.beginPath(); ctx.ellipse(etat.P.x, etat.P.y + 10, 10, 4, 0, 0, TAU); ctx.fill(); }
  // lasers
  if (etat.boss) for (const l of etat.lasers) {
    const ex = etat.boss.x + Math.cos(l.a) * 1100, ey = etat.boss.y + Math.sin(l.a) * 1100;
    if (l.warn > 0) { ctx.strokeStyle = '#ff4d6d' + (Math.floor(t * 20) % 2 ? 'aa' : '44'); ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(etat.boss.x, etat.boss.y); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]); }
    else if (l.life > 0) {
      ctx.globalCompositeOperation = 'lighter';
      for (const [w, c] of /** @type {[number, string][]} */ ([[26, '#ff4d6d33'], [14, '#ff4d6d88'], [5, '#ffffffee']])) { ctx.strokeStyle = c; ctx.lineWidth = w + Math.sin(t * 40) * 2; ctx.beginPath(); ctx.moveTo(etat.boss.x, etat.boss.y); ctx.lineTo(ex, ey); ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  // ennemis
  for (const e of etat.enemies) { if (e === etat.boss) drawBoss(e); else if (!e.dead) drawEnemy(e); }
  // héros
  drawGhosts();
  if (!etat.P.dead) drawPlayer();
  // tranches de lame
  for (const s of etat.slashes) drawSlash(s);
  // projectiles
  ctx.globalCompositeOperation = 'lighter';
  for (const p of etat.projs) {
    const col = p.refl ? '#ffffff' : '#8fe9ff';
    glow(p.x, p.y, p.r * 4, p.refl ? '#8fe9ff' : '#3ff3e0', .9);
    ctx.strokeStyle = col; ctx.lineWidth = p.r * 1.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .025, p.y - p.vy * .025); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  // projectiles ennemis (au-dessus pour la lisibilité)
  for (const b of etat.bullets) {
    ctx.globalCompositeOperation = 'lighter'; glow(b.x, b.y, b.r * 3.2, b.col, .8); ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = b.col; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * .5, 0, TAU); ctx.fill();
  }
  // éclairs
  ctx.globalCompositeOperation = 'lighter';
  for (const b of etat.bolts) {
    ctx.strokeStyle = '#bdf6ff'; ctx.lineWidth = 2.5; ctx.globalAlpha = b.life / .18;
    ctx.beginPath(); ctx.moveTo(b.x1, b.y1);
    for (let i = 1; i < 6; i++) { const q = i / 6; ctx.lineTo(lerp(b.x1, b.x2, q) + rnd(-10, 10), lerp(b.y1, b.y2, q) + rnd(-10, 10)); }
    ctx.lineTo(b.x2, b.y2); ctx.stroke(); glow(b.x2, b.y2, 24, '#8fe9ff');
  }
  ctx.globalAlpha = 1;
  // particules
  for (const p of etat.parts) drawPart(p);
  ctx.globalCompositeOperation = 'source-over';
  // textes de dégâts
  ctx.textAlign = 'center';
  for (const tx of etat.texts) {
    const a = 1 - tx.t / .8, y = tx.y - tx.t * 50 - (tx.big ? 6 : 0);
    ctx.font = `700 ${tx.big ? 20 : 14}px 'Chakra Petch',sans-serif`;
    ctx.globalAlpha = a; ctx.fillStyle = '#000a'; ctx.fillText(tx.s, tx.x + 1.5, y + 1.5);
    ctx.fillStyle = tx.col; ctx.fillText(tx.s, tx.x, y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // lueur globale
  if (CFG.glow) {
    bctx.globalCompositeOperation = 'source-over'; bctx.drawImage(cv, 0, 0, 240, 135);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .22;
    ctx.drawImage(bloomC, 0, 0, cv.width, cv.height); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.setTransform(k, 0, 0, k, 0, 0);
  }
  // flash, blessures
  if (game.flash > 0) { ctx.globalAlpha = game.flash * .5; ctx.fillStyle = game.flashCol; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  if (etat.P.hp < etat.S.maxHp * .3 && !etat.P.dead) {
    const a = .25 + Math.sin(game.t * 6) * .12, g = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 560);
    g.addColorStop(0, '#ff000000'); g.addColorStop(1, `rgba(255,20,60,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (Math.floor(game.t * 1.6) !== Math.floor((game.t - 1 / 60) * 1.6) && game.state === 'play') AU.play('beat');
  }
  drawHUD();
  if (game.trans) drawTrans();
}
function drawPart(p) {
  const a = Math.max(0, p.life / p.max);
  if (p.k === 'spark') {
    ctx.strokeStyle = p.col; ctx.globalAlpha = a; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .04, p.y - p.vy * .04); ctx.stroke();
  } else if (p.k === 'shard') {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = a; ctx.fillStyle = p.col;
    const s = p.sz * (.5 + a * .8); ctx.beginPath(); ctx.moveTo(0, -s * 1.6); ctx.lineTo(s * .7, 0); ctx.lineTo(0, s * 1.2); ctx.lineTo(-s * .7, 0); ctx.fill(); ctx.restore();
  } else if (p.k === 'ring') {
    const q = 1 - a, r = lerp(p.r0, p.r1, 1 - Math.pow(1 - q, 3));
    ctx.strokeStyle = p.col; ctx.globalAlpha = a; ctx.lineWidth = p.w * a + .5;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke();
  } else if (p.k === 'glow') {
    glow(p.x, p.y, p.r * (1.2 - a * .4), p.col, a);
  } else if (p.k === 'dot') {
    glow(p.x, p.y, p.sz * 2.4, p.col, a * .8);
  }
  ctx.globalAlpha = 1;
}
function drawGhosts() {
  for (const p of etat.parts) {
    if (p.k !== 'ghost') continue;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a + Math.PI / 2); ctx.globalAlpha = p.life / p.max * .5;
    ctx.fillStyle = '#8fe9ff'; ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(9, 8); ctx.lineTo(0, 4); ctx.lineTo(-9, 8); ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
function drawPlayer() {
  const blink = etat.P.inv > 0 && etat.P.dashT <= 0 && Math.floor(game.t * 20) % 2;
  ctx.globalCompositeOperation = 'lighter';
  glow(etat.P.x, etat.P.y, 48, '#3ff3e0', .35 + etat.P.nova / 100 * .3);
  if (etat.P.nova >= 100) { glow(etat.P.x, etat.P.y, 60 + Math.sin(game.t * 8) * 6, '#ffd45a', .35); }
  ctx.globalCompositeOperation = 'source-over';
  if (blink) ctx.globalAlpha = .45;
  // cape
  const bob = Math.sin(etat.P.step) * 1.5, ca = etat.P.face + Math.PI, sp = Math.hypot(etat.P.vx, etat.P.vy) / 300;
  ctx.fillStyle = '#16304a';
  ctx.beginPath();
  ctx.moveTo(etat.P.x + Math.cos(ca + 1.6) * 8, etat.P.y + Math.sin(ca + 1.6) * 8);
  ctx.quadraticCurveTo(etat.P.x + Math.cos(ca) * (16 + sp * 10) + Math.sin(game.t * 9) * 2, etat.P.y + Math.sin(ca) * (16 + sp * 10), etat.P.x + Math.cos(ca - 1.6) * 8, etat.P.y + Math.sin(ca - 1.6) * 8);
  ctx.fill();
  // corps cristallin
  ctx.save(); ctx.translate(etat.P.x, etat.P.y + bob * .3); ctx.rotate(etat.P.face + Math.PI / 2);
  const g = ctx.createLinearGradient(0, -14, 0, 10); g.addColorStop(0, '#ffffff'); g.addColorStop(.5, '#9ffcf2'); g.addColorStop(1, '#2a8fa0');
  ctx.fillStyle = etat.P.hurtT > 0 ? '#ff8095' : g;
  ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(10, 3); ctx.lineTo(5, 10); ctx.lineTo(-5, 10); ctx.lineTo(-10, 3); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = '#05202a'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 1); ctx.lineTo(-4, 1); ctx.fill();
  ctx.fillStyle = '#3ff3e0'; ctx.fillRect(-1.5, -3, 3, 3);
  ctx.restore();
  // lame au repos
  if (!etat.slashes.length) {
    const a = etat.P.aim + .9, bx = etat.P.x + Math.cos(a) * 12, by = etat.P.y + Math.sin(a) * 12;
    ctx.strokeStyle = '#d9fffb'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(etat.P.aim) * 18, by + Math.sin(etat.P.aim) * 18); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // viseur
  const ax = etat.P.x + Math.cos(etat.P.aim) * 34, ay = etat.P.y + Math.sin(etat.P.aim) * 34;
  ctx.fillStyle = '#3ff3e0aa'; ctx.save(); ctx.translate(ax, ay); ctx.rotate(etat.P.aim);
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-3, -4); ctx.lineTo(-1, 0); ctx.lineTo(-3, 4); ctx.fill(); ctx.restore();
  // bouclier
  if (etat.S.shield && etat.P.shieldT <= 0) { ctx.strokeStyle = '#8fe9ff88'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(etat.P.x, etat.P.y, 19, 0, TAU); ctx.stroke(); }
  // lames orbitales
  if (etat.S.orbit) {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < etat.S.orbit; i++) {
      const a = etat.P.orbA + i / etat.S.orbit * TAU, ox = etat.P.x + Math.cos(a) * 54, oy = etat.P.y + Math.sin(a) * 54;
      glow(ox, oy, 18, '#3ff3e0', .8);
      ctx.save(); ctx.translate(ox, oy); ctx.rotate(a + game.t * 10); ctx.fillStyle = '#e6fffc';
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(3, 0); ctx.lineTo(0, 9); ctx.lineTo(-3, 0); ctx.fill(); ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}
function drawSlash(s) {
  const q = s.t / s.dur, a0 = s.a - s.arc / 2, sweep = s.arc * Math.min(1, q * 2.2);
  const start = s.step === 1 ? s.a + s.arc / 2 : a0, dir = s.step === 1 ? -1 : 1;
  ctx.save(); ctx.translate(etat.P.x, etat.P.y);
  ctx.globalCompositeOperation = 'lighter';
  const al = 1 - q;
  for (let i = 0; i < 3; i++) {
    const r = s.range * (.55 + i * .2);
    ctx.strokeStyle = i === 2 ? `rgba(255,255,255,${al})` : i === 1 ? `rgba(160,255,245,${al * .8})` : `rgba(63,243,224,${al * .5})`;
    ctx.lineWidth = (s.step === 2 ? 14 : 9) - i * 3;
    ctx.beginPath();
    if (dir > 0) ctx.arc(0, 0, r, start, start + sweep); else ctx.arc(0, 0, r, start - sweep, start);
    ctx.stroke();
  }
  const tip = start + sweep * dir;
  glow(Math.cos(tip) * s.range * .9, Math.sin(tip) * s.range * .9, 26, '#3ff3e0', al);
  ctx.restore(); ctx.globalCompositeOperation = 'source-over';
}
function drawEnemy(e) {
  const fl = e.flash > 0, sq = 1 + e.sq, t = e.t;
  ctx.save(); ctx.translate(e.x, e.y); ctx.scale(sq, 2 - sq);
  ctx.globalCompositeOperation = 'lighter';
  glow(0, 0, e.r * 2.6, e.col, e.elite ? .8 : .4);
  ctx.globalCompositeOperation = 'source-over';
  const body = fl ? '#ffffff' : e.col, dark = '#14060c';
  const face = Math.atan2(etat.P.y - e.y, etat.P.x - e.x);
  ctx.fillStyle = body; ctx.strokeStyle = fl ? '#fff' : '#ffffffaa'; ctx.lineWidth = 1.5;
  switch (e.type) {
    case 'mite': case 'mini': {
      ctx.rotate(face + Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(0, -e.r * 1.3); ctx.lineTo(e.r, e.r * .8); ctx.lineTo(0, e.r * .3); ctx.lineTo(-e.r, e.r * .8); ctx.closePath(); ctx.fill();
      if (e.type === 'mini') { ctx.stroke(); }
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(0, -e.r * .2, e.r * .28, 0, TAU); ctx.fill();
      // pattes
      ctx.strokeStyle = body; ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i += 2) { ctx.beginPath(); ctx.moveTo(i * e.r * .5, 0); ctx.lineTo(i * e.r * 1.3, Math.sin(t * 20) * 4 * i); ctx.stroke(); }
      break;
    }
    case 'spitter': {
      ctx.rotate(face);
      ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.lineTo(Math.cos(a) * e.r, Math.sin(a) * e.r); } ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(e.r * .3, 0, e.r * .45, 0, TAU); ctx.fill();
      const ch = e.st === 'aim' ? 1 - e.stT / .5 : 0;
      ctx.fillStyle = ch ? '#fff' : '#ff3d7f'; ctx.beginPath(); ctx.arc(e.r * .35, 0, e.r * (.2 + ch * .25), 0, TAU); ctx.fill();
      if (ch) { ctx.globalCompositeOperation = 'lighter'; glow(e.r * .35, 0, 20 * ch + 6, '#ff3d7f', ch); ctx.globalCompositeOperation = 'source-over'; }
      break;
    }
    case 'bomber': {
      const fuse = e.st === 'fuse', pulse = fuse ? 1 + Math.sin(t * 50) * .2 : 1;
      ctx.scale(pulse, pulse);
      ctx.fillStyle = fuse && Math.floor(t * 20) % 2 ? '#ffffff' : body;
      ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-e.r * .6, -e.r * .2); ctx.lineTo(e.r * .6, -e.r * .2); ctx.moveTo(-e.r * .4, e.r * .3); ctx.lineTo(e.r * .4, e.r * .3); ctx.stroke();
      ctx.fillStyle = '#ff3d3d'; ctx.beginPath(); ctx.arc(0, -e.r - 3, 3 + Math.sin(t * 15), 0, TAU); ctx.fill();
      if (fuse) { ctx.strokeStyle = '#ff3d3d88'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 85 / pulse, 0, TAU); ctx.stroke(); }
      break;
    }
    case 'splitter': {
      ctx.rotate(t * .8);
      for (let i = 0; i < 2; i++) { ctx.save(); ctx.rotate(i * Math.PI / 4); ctx.fillStyle = i ? body : (fl ? '#fff' : '#2f9a5c'); ctx.fillRect(-e.r * .75, -e.r * .75, e.r * 1.5, e.r * 1.5); ctx.restore(); }
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(0, 0, e.r * .35, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ffffff66'; ctx.beginPath(); ctx.moveTo(-e.r, 0); ctx.lineTo(e.r, 0); ctx.stroke();
      break;
    }
    case 'brute': {
      const wind = e.st === 'wind';
      if (wind) { ctx.save(); ctx.rotate(e.a); ctx.fillStyle = '#ff3b3b22'; ctx.fillRect(0, -e.r, 300, e.r * 2); ctx.strokeStyle = '#ff3b3b' + (Math.floor(t * 16) % 2 ? 'cc' : '55'); ctx.lineWidth = 2; ctx.strokeRect(0, -e.r, 300, e.r * 2); ctx.restore(); }
      ctx.rotate((e.st === 'charge' || wind ? e.a : face) + Math.PI / 2);
      if (wind) ctx.translate(rnd(-2, 2), rnd(-2, 2));
      ctx.beginPath(); ctx.moveTo(0, -e.r * 1.2); ctx.lineTo(e.r, -e.r * .3); ctx.lineTo(e.r * .8, e.r * .8); ctx.lineTo(-e.r * .8, e.r * .8); ctx.lineTo(-e.r, -e.r * .3); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = fl ? '#fff' : '#7a1010'; ctx.fillRect(-e.r * .6, -e.r * .15, e.r * 1.2, e.r * .5);
      ctx.fillStyle = e.st === 'stun' ? '#888' : '#ffe14d'; ctx.fillRect(-e.r * .45, -e.r * .05, e.r * .25, e.r * .25); ctx.fillRect(e.r * .2, -e.r * .05, e.r * .25, e.r * .25);
      if (e.st === 'stun') { ctx.rotate(t * 6); ctx.fillStyle = '#ffe14d'; for (let i = 0; i < 3; i++) { ctx.rotate(TAU / 3); ctx.fillRect(e.r * .9, -2, 4, 4); } }
      break;
    }
    case 'weaver': {
      const fade = e.st === 'fade' ? e.stT / .4 : e.st === 'appear' ? 1 - e.stT / .35 : 1;
      ctx.globalAlpha = Math.max(.1, fade);
      ctx.rotate(t * 1.5);
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r = i % 2 ? e.r * .55 : e.r * 1.2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
      ctx.rotate(-t * 3); ctx.strokeStyle = body; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, e.r * 1.6, 0, TAU * .7); ctx.stroke();
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(0, 0, e.r * .35, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, e.r * .14, 0, TAU); ctx.fill();
      break;
    }
    case 'sentinel': {
      ctx.rotate(e.a);
      ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.fill();
      const arms = etat.room.z >= 2 ? 4 : 3;
      for (let i = 0; i < arms; i++) { ctx.save(); ctx.rotate(i / arms * TAU); ctx.fillRect(e.r * .6, -4, e.r * .8, 8); ctx.restore(); }
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(0, 0, e.r * .55, 0, TAU); ctx.fill();
      ctx.fillStyle = e.st === 'fire' ? '#fff' : body; ctx.beginPath(); ctx.arc(0, 0, e.r * .25, 0, TAU); ctx.fill();
      break;
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  // barre de vie
  if (e.hp < e.maxHp) {
    const w = e.r * 2.2;
    ctx.fillStyle = '#000a'; ctx.fillRect(e.x - w / 2, e.y - e.r - 10, w, 3);
    ctx.fillStyle = e.elite ? '#ffd45a' : '#ff4d6d'; ctx.fillRect(e.x - w / 2, e.y - e.r - 10, w * Math.max(0, e.hp / e.maxHp), 3);
  }
  if (e.elite) { ctx.strokeStyle = '#ffd45a88'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 6 + Math.sin(e.t * 5) * 2, 0, TAU); ctx.stroke(); }
}
function drawBoss(b) {
  const t = b.t, fl = b.flash > 0 || (b.invT > 0 && b.intro <= 0 && Math.floor(t * 12) % 2);
  const ph = b.phase;
  const pc = ph === 1 ? '#ffd45a' : ph === 2 ? '#ff9a4d' : '#ff4d6d';
  ctx.save(); ctx.translate(b.x, b.y);
  const sc = b.intro > 0 ? Math.min(1, (3.2 - b.intro) / 1.2) : 1;
  ctx.scale(sc, sc);
  ctx.globalCompositeOperation = 'lighter';
  glow(0, 0, 150, '#c77dff', .45); glow(0, 0, 90, pc, .5 + Math.sin(t * 3) * .1);
  ctx.globalCompositeOperation = 'source-over';
  // anneau runique
  ctx.strokeStyle = pc + '88'; ctx.lineWidth = 2;
  ctx.save(); ctx.rotate(-t * .6); ctx.setLineDash([6, 10]); ctx.beginPath(); ctx.arc(0, 0, 78, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  // plaques orbitales
  for (let i = 0; i < b.plates; i++) {
    const a = b.a + i / b.plates * TAU, r = 58 + Math.sin(t * 2 + i) * 4;
    ctx.save(); ctx.rotate(a); ctx.translate(r, 0); ctx.rotate(Math.PI / 2);
    const g = ctx.createLinearGradient(0, -22, 0, 22); g.addColorStop(0, fl ? '#fff' : '#8e6cff'); g.addColorStop(1, fl ? '#fff' : '#2b1f5c');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(12, 0); ctx.lineTo(0, 18); ctx.lineTo(-12, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = pc; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }
  // noyau
  ctx.rotate(Math.sin(t) * .1);
  const g = ctx.createRadialGradient(0, -8, 4, 0, 0, 42); g.addColorStop(0, fl ? '#fff' : '#fff6d0'); g.addColorStop(.4, fl ? '#fff' : pc); g.addColorStop(1, fl ? '#fff' : '#3a1a5c');
  ctx.fillStyle = g;
  ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + t * .3, r = i % 2 ? 30 : 42 + (ph >= 3 ? Math.sin(t * 20 + i) * 3 : 0); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  // fissures
  ctx.strokeStyle = '#2b0a1a'; ctx.lineWidth = 2;
  for (let i = 0; i < ph; i++) { ctx.beginPath(); const a = i * 2.1; ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12); ctx.lineTo(Math.cos(a + .3) * 26, Math.sin(a + .3) * 26); ctx.lineTo(Math.cos(a - .1) * 40, Math.sin(a - .1) * 40); ctx.stroke(); }
  // œil
  ctx.rotate(-Math.sin(t) * .1);
  ctx.fillStyle = '#0b0618'; ctx.beginPath(); ctx.ellipse(0, 0, 18, 13, 0, 0, TAU); ctx.fill();
  const ex = Math.cos(b.eye) * 6, ey = Math.sin(b.eye) * 4;
  ctx.fillStyle = b.atk ? '#ff4d6d' : '#ffffff'; ctx.beginPath(); ctx.arc(ex, ey, 7, 0, TAU); ctx.fill();
  ctx.fillStyle = '#0b0618'; ctx.beginPath(); ctx.ellipse(ex, ey, 2, 5, 0, 0, TAU); ctx.fill();
  ctx.restore();
  // ligne de charge
  if (b.atk === 'charge' && b.cst === 'wind') {
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.ca);
    ctx.fillStyle = '#ffd45a22'; ctx.fillRect(0, -b.r, 900, b.r * 2);
    ctx.strokeStyle = '#ffd45a' + (Math.floor(t * 16) % 2 ? 'cc' : '44'); ctx.lineWidth = 2; ctx.strokeRect(0, -b.r, 900, b.r * 2); ctx.restore();
  }
}
function drawObj(o) {
  const t = game.t;
  if (o.kind === 'fountain') {
    ctx.fillStyle = '#0a2a22'; ctx.beginPath(); ctx.ellipse(o.x, o.y + 8, 46, 20, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#6dffb0'; ctx.lineWidth = 2; ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    if (!o.used) { glow(o.x, o.y, 70 + Math.sin(t * 3) * 6, '#6dffb0', .6); for (let i = 0; i < 5; i++) { const q = (t * .7 + i / 5) % 1; glow(o.x + Math.sin(i * 7 + t) * 16, o.y - q * 50, 8 * (1 - q), '#d6ffe8', 1 - q); } }
    else glow(o.x, o.y, 40, '#6dffb0', .2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#d6ffe8'; ctx.font = "700 13px 'Chakra Petch'"; ctx.textAlign = 'center';
    if (!o.used) ctx.fillText('Touche la fontaine pour te soigner', o.x, o.y + 54);
  }
  if (o.kind === 'shop') {
    ctx.save(); ctx.translate(o.x, o.y + Math.sin(t * 2) * 4);
    ctx.globalCompositeOperation = 'lighter'; glow(0, 0, 80, '#ffd45a', .5); ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#2b1f5c'; ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(22, 10); ctx.lineTo(14, 26); ctx.lineTo(-14, 26); ctx.lineTo(-22, 10); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffd45a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffd45a'; ctx.beginPath(); ctx.arc(-6, -6, 3, 0, TAU); ctx.arc(6, -6, 3, 0, TAU); ctx.fill();
    for (let i = 0; i < 3; i++) { const a = t * 1.5 + i / 3 * TAU; ctx.fillStyle = ['#3ff3e0', '#c77dff', '#ffd45a'][i]; ctx.beginPath(); ctx.arc(Math.cos(a) * 40, Math.sin(a) * 14 - 4, 5, 0, TAU); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = '#ffe9a8'; ctx.font = "700 13px 'Chakra Petch'"; ctx.textAlign = 'center';
    ctx.fillText(o.used ? 'Bonne plongée, voyageur.' : 'Approche-toi du marchand', o.x, o.y + 62);
  }
}
function drawPortal(p) {
  const info = PORTAL[p.type], t = game.t, op = Math.min(1, p.t / .6);
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(op, op);
  ctx.globalCompositeOperation = 'lighter';
  glow(0, 0, 70, info.c, .6);
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = info.c; ctx.globalAlpha = .4 + i * .2; ctx.lineWidth = 3 - i * .6;
    ctx.beginPath(); ctx.ellipse(0, 0, 22 + i * 7, 32 + i * 7, 0, t * (2 + i) % TAU, t * (2 + i) % TAU + 4.4); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 26); g.addColorStop(0, '#ffffff'); g.addColorStop(.5, info.c + '88'); g.addColorStop(1, info.c + '00');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 20, 30, 0, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
  ctx.globalAlpha = op;
  ctx.textAlign = 'center';
  ctx.font = "800 15px Unbounded,sans-serif"; ctx.fillStyle = '#000a'; ctx.fillText(info.n, p.x + 1, p.y + 61);
  ctx.fillStyle = info.c; ctx.fillText(info.n, p.x, p.y + 60);
  ctx.font = "500 12px 'Chakra Petch',sans-serif"; ctx.fillStyle = '#d8eef3'; ctx.fillText(p.gate ? 'Un champion garde la sortie' : info.s, p.x, p.y + 76);
  ctx.globalAlpha = 1;
}
function drawHUD() {
  const Z = ZONES[etat.room.z];
  // vie
  const hx = 18, hy = 14, hw = 210;
  ctx.fillStyle = '#000000aa'; ctx.beginPath(); ctx.moveTo(hx - 6, hy - 6); ctx.lineTo(hx + hw + 14, hy - 6); ctx.lineTo(hx + hw + 4, hy + 42); ctx.lineTo(hx - 6, hy + 42); ctx.fill();
  ctx.fillStyle = '#2a0a12'; ctx.fillRect(hx, hy, hw, 14);
  const hpw = hw * clamp(etat.P.hp / etat.S.maxHp, 0, 1);
  const hg = ctx.createLinearGradient(hx, 0, hx + hw, 0); hg.addColorStop(0, '#ff2d55'); hg.addColorStop(1, '#ff7a9a');
  ctx.fillStyle = hg; ctx.fillRect(hx, hy, hpw, 14);
  ctx.fillStyle = '#ffffff55'; ctx.fillRect(hx, hy, hpw, 3);
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1; for (let i = 25; i < etat.S.maxHp; i += 25) { const x = hx + hw * i / etat.S.maxHp; ctx.beginPath(); ctx.moveTo(x, hy); ctx.lineTo(x, hy + 14); ctx.stroke(); }
  ctx.font = "700 12px 'Chakra Petch'"; ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
  ctx.fillText(Math.ceil(etat.P.hp) + ' / ' + etat.S.maxHp, hx + 6, hy + 11.5);
  // nova
  const nr = etat.P.nova / 100;
  ctx.fillStyle = '#1a1a10'; ctx.fillRect(hx, hy + 20, hw * .7, 7);
  ctx.fillStyle = nr >= 1 ? (Math.floor(game.t * 6) % 2 ? '#ffd45a' : '#fff3b0') : '#c9a63a'; ctx.fillRect(hx, hy + 20, hw * .7 * nr, 7);
  ctx.font = "700 10px 'Chakra Petch'"; ctx.fillStyle = nr >= 1 ? '#ffd45a' : '#bba870';
  ctx.fillText(nr >= 1 ? 'NOVA PRÊTE' : 'NOVA', hx + hw * .7 + 6, hy + 27);
  // esquives
  for (let i = 0; i < etat.S.dashMax; i++) {
    const x = hx + i * 14, y = hy + 31, full = i < etat.P.dashCh;
    ctx.fillStyle = full ? '#8fe9ff' : '#24434a';
    ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x + 5, y); ctx.lineTo(x + 10, y + 4); ctx.lineTo(x + 5, y + 8); ctx.fill();
  }
  if (etat.S.shield) { ctx.fillStyle = etat.P.shieldT <= 0 ? '#8fe9ff' : '#8fe9ff44'; ctx.font = "700 10px 'Chakra Petch'"; ctx.fillText(etat.P.shieldT <= 0 ? 'BOUCLIER' : 'BOUCLIER ' + Math.ceil(etat.P.shieldT) + ' s', hx + etat.S.dashMax * 14 + 8, hy + 39); }
  if (game.touchHint === undefined) game.touchHint = 0;
  // haut droite : éclats et progression
  ctx.textAlign = 'right';
  ctx.font = "700 16px 'Chakra Petch'"; ctx.fillStyle = '#c9fff8';
  ctx.fillText(game.shards, W - 34, 28);
  ctx.fillStyle = '#3ff3e0'; ctx.beginPath(); const sx = W - 24, sy = 22; ctx.moveTo(sx, sy - 7); ctx.lineTo(sx + 4, sy); ctx.lineTo(sx, sy + 7); ctx.lineTo(sx - 4, sy); ctx.fill();
  // pastilles de salles
  const total = 12, done = etat.roomNum + (etat.room.cleared ? 1 : 0);
  const px0 = W - 22 - total * 12;
  for (let i = 0; i < total; i++) {
    const x = px0 + i * 12, y = 44, isB = i === total - 1, cur = i === etat.roomNum;
    const z = i < 4 ? 0 : i < 8 ? 1 : 2;
    ctx.fillStyle = i < done ? ZONES[z].acc : cur ? '#ffffff' : '#ffffff22';
    if (isB) { ctx.beginPath(); ctx.arc(x + 4, y, 5, 0, TAU); ctx.fill(); }
    else { ctx.fillRect(x, y - 3, 8, 6); }
  }
  // nom de la strate
  ctx.textAlign = 'center'; ctx.font = "700 11px 'Chakra Petch'"; ctx.fillStyle = Z.acc + 'aa';
  const label = etat.room.type === 'boss' ? 'FOND DE LA FAILLE' : 'STRATE ' + ROMAN[etat.room.z] + ' · ' + Z.name;
  if (!etat.boss) ctx.fillText(label, W / 2, 24);
  // barre du boss
  if (etat.boss && !etat.boss.dead) {
    const bw = 460, bx = W / 2 - bw / 2, by = H - 30;
    ctx.fillStyle = '#000000b0'; ctx.fillRect(bx - 4, by - 18, bw + 8, 30);
    ctx.font = "800 11px Unbounded,sans-serif"; ctx.fillStyle = '#ffd45a'; ctx.fillText('L\'ARCHONTE FRACTURÉ', W / 2, by - 5);
    ctx.fillStyle = '#2a0a12'; ctx.fillRect(bx, by, bw, 8);
    const bg = ctx.createLinearGradient(bx, 0, bx + bw, 0); bg.addColorStop(0, '#c77dff'); bg.addColorStop(1, '#ffd45a');
    ctx.fillStyle = bg; ctx.fillRect(bx, by, bw * Math.max(0, etat.boss.hp / etat.boss.maxHp), 8);
    ctx.fillStyle = '#000'; ctx.fillRect(bx + bw * .33, by, 2, 8); ctx.fillRect(bx + bw * .66, by, 2, 8);
  }
  // indice de portail
  if (etat.portals.length && !game.trans && game.state === 'play') {
    ctx.font = "700 13px 'Chakra Petch'"; ctx.fillStyle = '#ffffff' + (Math.floor(game.t * 2) % 2 ? 'cc' : '88');
    ctx.fillText(etat.portals.length > 1 ? 'Choisis ton chemin : entre dans un portail' : 'Entre dans le portail', W / 2, H - 48);
  }
  // bannière
  if (game.banner) {
    const b = game.banner, a = Math.min(1, b.life * 2, (2.6 - b.life) * 4);
    ctx.globalAlpha = a;
    const y = b.big ? H / 2 - 60 : 110;
    ctx.fillStyle = '#000000aa'; ctx.fillRect(0, y - 40, W, b.s ? 66 : 52);
    ctx.fillStyle = Z.acc; ctx.fillRect(0, y - 40, W, 2); ctx.fillRect(0, y + (b.s ? 24 : 10), W, 2);
    ctx.font = `900 ${b.big ? 34 : 28}px Unbounded,sans-serif`; ctx.fillStyle = '#ffffff';
    const sp = (1 - Math.min(1, (2.6 - b.life) * 2)) * 30;
    ctx.fillText(b.t, W / 2 + sp, y);
    if (b.s) { ctx.font = "500 15px 'Chakra Petch'"; ctx.fillStyle = Z.acc; ctx.fillText(b.s, W / 2 - sp, y + 18); }
    ctx.globalAlpha = 1;
  }
}
function drawTrans() {
  const q = game.trans.t / .9;
  const p = q < .5 ? q * 2 : (1 - q) * 2; // couvre puis découvre
  const e = p * p * (3 - 2 * p);
  ctx.fillStyle = '#020507';
  const x = lerp(-300, W + 300, q < .5 ? e * .5 + 0 : 1 - e * .5);
  ctx.globalAlpha = 1;
  ctx.beginPath();
  if (q < .5) { ctx.moveTo(-200, 0); ctx.lineTo(x + 200, 0); ctx.lineTo(x - 200, H); ctx.lineTo(-200, H); }
  else { ctx.moveTo(x + 200, 0); ctx.lineTo(W + 400, 0); ctx.lineTo(W + 400, H); ctx.lineTo(x - 200, H); }
  ctx.fill();
  const ex = q < .5 ? x : x;
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = '#3ff3e0'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(ex + 200, 0); ctx.lineTo(ex - 200, H); ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  // plein écran au milieu
  if (q > .38 && q < .62) { ctx.fillStyle = '#020507'; ctx.fillRect(0, 0, W, H); }
}
function renderTitle() {
  ctx.fillStyle = '#03080b'; ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2, t = game.t;
  ctx.globalCompositeOperation = 'lighter';
  glow(cx, cy, 380, '#0f5a64', .5);
  glow(cx, cy, 160 + Math.sin(t) * 10, '#ff4d8d', .18);
  for (const p of TITLE.pts) {
    const x = cx + Math.cos(p.a) * p.r, y = cy + Math.sin(p.a) * p.r * .56, s = 1 + p.r / 120;
    ctx.strokeStyle = p.c; ctx.globalAlpha = Math.min(1, p.r / 200) * .8; ctx.lineWidth = s;
    const x2 = cx + Math.cos(p.a - .04) * p.r * .94, y2 = cy + Math.sin(p.a - .04) * p.r * .94 * .56;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // la faille
  ctx.strokeStyle = '#3ff3e0'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx - 260, cy + 40);
  for (let i = 1; i <= 12; i++) ctx.lineTo(cx - 260 + i * 43, cy + 40 + Math.sin(i * 2.3 + t * 2) * 10 + (i % 2 ? -14 : 12));
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  const g = ctx.createRadialGradient(cx, cy, 200, cx, cy, 620); g.addColorStop(0, '#0000'); g.addColorStop(1, '#000c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
