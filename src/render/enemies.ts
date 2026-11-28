/** Dessin des ennemis (peints ou procéduraux) et de l'Archonte. */
import { TAU } from '../config.ts';
import { frnd as rnd } from '../util.ts';
import { etat } from '../sim/state.ts';
import { ENEMY_ART, art } from '../art.ts';
import { ctx, glow } from './canvas.ts';
import type { Boss, Enemy } from '../sim/state.ts';

export function drawEnemy(e: Enemy) {
  const fl = e.flash > 0, sq = 1 + e.sq, t = e.t;
  ctx.save(); ctx.translate(e.x, e.y); ctx.scale(sq, 2 - sq);
  ctx.globalCompositeOperation = 'lighter';
  glow(0, 0, e.r * 2.6, e.col, e.elite ? .8 : .4);
  ctx.globalCompositeOperation = 'source-over';
  const body = fl ? '#ffffff' : e.col, dark = '#14060c';
  const face = Math.atan2(etat.P.y - e.y, etat.P.x - e.x);
  const img = art(ENEMY_ART[e.type]);
  if (img) drawEnemyArt(e, img, face, fl);
  else {
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
/** Taille d'affichage des ennemis peints, en multiple du rayon de collision. */
const ENEMY_SCALE: Record<string, number> = { mite: 3.4, mini: 3.4, spitter: 3.3, bomber: 3, splitter: 3.2, brute: 3.3, weaver: 3.6, sentinel: 3.4 };
/** Un ennemi peint, debout et tourné vers le héros, avec les signaux de jeu
(visée, mèche, charge, étourdissement, fondu) par-dessus. */
function drawEnemyArt(e: Enemy, img: HTMLImageElement, face: number, fl: boolean) {
  const t = e.t, sz = e.r * (ENEMY_SCALE[e.type] || 2.8);
  let k = 1, alpha = 1;
  if (e.type === 'bomber' && e.st === 'fuse') {
    k = 1 + Math.sin(t * 50) * .2;
    ctx.strokeStyle = '#ff3d3d88'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 85, 0, TAU); ctx.stroke();
  }
  if (e.type === 'brute' && e.st === 'wind') {
    ctx.save(); ctx.rotate(e.a); ctx.fillStyle = '#ff3b3b22'; ctx.fillRect(0, -e.r, 300, e.r * 2);
    ctx.strokeStyle = '#ff3b3b' + (Math.floor(t * 16) % 2 ? 'cc' : '55'); ctx.lineWidth = 2; ctx.strokeRect(0, -e.r, 300, e.r * 2); ctx.restore();
    ctx.translate(rnd(-2, 2), rnd(-2, 2));
  }
  if (e.type === 'weaver') alpha = Math.max(.1, e.st === 'fade' ? e.stT / .4 : e.st === 'appear' ? 1 - e.stT / .35 : 1);
  if (e.type === 'splitter' || e.type === 'mini') ctx.rotate(Math.sin(t * 2) * .15);
  if (e.type === 'mite' || e.type === 'mini') ctx.translate(0, Math.sin(t * 20) * 1.5);
  ctx.globalAlpha = alpha;
  ctx.save(); ctx.scale(Math.cos(face) < 0 ? -k : k, k);
  ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
  // éclair blanc quand il est touché (ou mèche qui clignote)
  const blink = fl || (e.type === 'bomber' && e.st === 'fuse' && Math.floor(t * 20) % 2);
  if (blink) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * .8; ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz); ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz); ctx.globalCompositeOperation = 'source-over'; }
  ctx.restore();
  ctx.globalAlpha = 1;
  if (e.type === 'spitter' && e.st === 'aim') {
    const ch = 1 - e.stT / .5;
    ctx.globalCompositeOperation = 'lighter'; glow(Math.cos(face) * e.r * .6, Math.sin(face) * e.r * .6, 20 * ch + 6, '#ff3d7f', ch); ctx.globalCompositeOperation = 'source-over';
  }
  if (e.type === 'sentinel' && e.st === 'fire') { ctx.globalCompositeOperation = 'lighter'; glow(0, -e.r * .4, e.r * 1.4, '#ffffff', .7); ctx.globalCompositeOperation = 'source-over'; }
  if (e.type === 'brute' && e.st === 'stun') {
    ctx.rotate(t * 6); ctx.fillStyle = '#ffe14d';
    for (let i = 0; i < 3; i++) { ctx.rotate(TAU / 3); ctx.fillRect(e.r * .9, -e.r - 2, 4, 4); }
  }
}
export function drawBoss(b: Boss) {
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
  const img = art('archonte');
  // plaques orbitales
  for (let i = 0; i < b.plates; i++) {
    const a = b.a + i / b.plates * TAU, r = (img ? 80 : 58) + Math.sin(t * 2 + i) * 4;
    ctx.save(); ctx.rotate(a); ctx.translate(r, 0); ctx.rotate(Math.PI / 2);
    const g = ctx.createLinearGradient(0, -22, 0, 22); g.addColorStop(0, fl ? '#fff' : '#8e6cff'); g.addColorStop(1, fl ? '#fff' : '#2b1f5c');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(12, 0); ctx.lineTo(0, 18); ctx.lineTo(-12, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = pc; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }
  if (img) {
    // l'Archonte peint, qui flotte ; il se fissure (lueur de phase) et clignote sous les coups
    const sz = 150, fy = Math.sin(t * 1.6) * 4;
    ctx.save(); ctx.translate(0, fy - 8);
    if (Math.cos(b.eye) < 0) ctx.scale(-1, 1);
    ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
    if (fl || ph >= 2) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fl ? .9 : (ph - 1) * .12 + Math.sin(t * 6) * .05;
      ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    ctx.restore();
    ctx.restore();
  } else {
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
  }
  // ligne de charge
  if (b.atk === 'charge' && b.cst === 'wind') {
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.ca);
    ctx.fillStyle = '#ffd45a22'; ctx.fillRect(0, -b.r, 900, b.r * 2);
    ctx.strokeStyle = '#ffd45a' + (Math.floor(t * 16) % 2 ? 'cc' : '44'); ctx.lineWidth = 2; ctx.strokeRect(0, -b.r, 900, b.r * 2); ctx.restore();
  }
}
