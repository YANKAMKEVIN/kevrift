// @ts-check
/** Rendu canvas d'une image de jeu : sol, entités, effets, lueur, puis HUD. */
import { CFG } from '../save.js';
import { EDEF, H, PORTAL, TAU, W, ZONES } from '../config.js';
import { clamp, lerp } from '../sim/math.js';
import { frnd as rnd } from '../util.js';
import { etat, game } from '../sim/state.js';
import { cv, ctx, glow } from './canvas.js';
import { view } from './view.js';
import { AU } from '../audio.js';
import { floorC } from './floor.js';
import { drawGhosts, drawPart, drawPlayer, drawSlash } from './hero.js';
import { drawBoss, drawEnemy } from './enemies.js';
import { drawHUD, drawTrans } from './hud.js';
import { renderTitle } from './title.js';

const bloomC = document.createElement('canvas');
bloomC.width = 240;
bloomC.height = 135;
const bctx = /** @type {CanvasRenderingContext2D} */ (bloomC.getContext('2d'));

/* =========================================================
   RENDU
   ========================================================= */
export function render() {
  const k = view.scale * view.dpr;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  if (game.state === 'title' || !etat.room) { renderTitle(); return; }
  const sh = CFG.shake ? game.shake : 0, sx = sh ? rnd(-sh, sh) * .5 : 0, sy = sh ? rnd(-sh, sh) * .5 : 0;
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
