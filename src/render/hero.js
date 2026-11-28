// @ts-check
/** Dessin du héros, de ses lames, de ses fantômes d'esquive et des particules. */
import { TAU } from '../config.js';
import { lerp } from '../sim/math.js';
import { etat, game } from '../sim/state.js';
import { art } from '../art.js';
import { ctx, glow } from './canvas.js';
/** @typedef {import('../sim/state.js').Ent} Ent */

/** @param {Ent} p */
export function drawPart(p) {
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
export function drawGhosts() {
  for (const p of etat.parts) {
    if (p.k !== 'ghost') continue;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a + Math.PI / 2); ctx.globalAlpha = p.life / p.max * .5;
    ctx.fillStyle = '#8fe9ff'; ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(9, 8); ctx.lineTo(0, 4); ctx.lineTo(-9, 8); ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
export function drawPlayer() {
  const blink = etat.P.inv > 0 && etat.P.dashT <= 0 && Math.floor(game.t * 20) % 2;
  ctx.globalCompositeOperation = 'lighter';
  glow(etat.P.x, etat.P.y, 48, '#3ff3e0', .35 + etat.P.nova / 100 * .3);
  if (etat.P.nova >= 100) { glow(etat.P.x, etat.P.y, 60 + Math.sin(game.t * 8) * 6, '#ffd45a', .35); }
  ctx.globalCompositeOperation = 'source-over';
  if (blink) ctx.globalAlpha = .45;
  const heros = art('heros');
  if (heros) drawHeroArt(heros);
  else drawHeroShape();
  // lame au repos (le héros peint tient déjà la sienne)
  if (!heros && !etat.slashes.length) {
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
/** Le héros peint : debout, tourné vers sa visée, avec un léger rebond de marche. */
/** @param {HTMLImageElement} img */
function drawHeroArt(img) {
  const P = etat.P, sz = 46, bob = Math.abs(Math.sin(P.step)) * 2;
  ctx.save(); ctx.translate(P.x, P.y - 6 - bob);
  if (Math.cos(P.aim) < 0) ctx.scale(-1, 1);
  ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
  if (P.hurtT > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= .7; ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz); }
  ctx.restore();
}
/** Le héros dessiné (repli sans visuel). */
function drawHeroShape() {
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
}
/** @param {Ent} s */
export function drawSlash(s) {
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
