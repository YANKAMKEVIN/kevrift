/** Écran titre animé (tableau peint, flux de particules, faille). */
import { H, TAU, W } from '../config.ts';
import { frnd as rnd } from '../util.ts';
import { game } from '../sim/state.ts';
import { art } from '../art.ts';
import { ctx, glow } from './canvas.ts';

/** Particules du titre (cosmétiques, hasard propre au rendu). */
export const TITLE: {pts:{a:number,r:number,s:number,z:number,c:string}[]} = { pts: [] };
const TITLE_COLS = ['#3ff3e0', '#ff4d8d', '#ffd45a', '#c77dff'];
/** Anime les particules du titre. */
export function updTitle(dt: number) {
  if (TITLE.pts.length < 140) TITLE.pts.push({ a: rnd(TAU), r: rnd(20, 60), s: rnd(.3, 1.2), z: rnd(), c: TITLE_COLS[Math.floor(Math.random() * TITLE_COLS.length)] });
  for (const p of TITLE.pts) { p.r += dt * 60 * p.s * (1 + p.r / 200); p.a += dt * .3 * p.s; if (p.r > 700) { p.r = rnd(10, 40); p.a = rnd(TAU); } }
}

export function renderTitle() {
  ctx.fillStyle = '#03080b'; ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2, t = game.t;
  const titre = art('titre');
  if (titre) {
    // tableau peint, en léger zoom lent, assombri sous le logo
    const z = 1.04 + Math.sin(t * .15) * .02, iw = W * z, ih = iw * titre.height / titre.width;
    ctx.drawImage(titre, cx - iw / 2, cy - ih / 2, iw, ih);
    ctx.fillStyle = '#03080b40'; ctx.fillRect(0, 0, W, H);
  }
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
  // la faille (le tableau peint a déjà la sienne)
  ctx.strokeStyle = '#3ff3e0'; ctx.lineWidth = 3; ctx.globalAlpha = titre ? 0 : 1;
  ctx.beginPath(); ctx.moveTo(cx - 260, cy + 40);
  for (let i = 1; i <= 12; i++) ctx.lineTo(cx - 260 + i * 43, cy + 40 + Math.sin(i * 2.3 + t * 2) * 10 + (i % 2 ? -14 : 12));
  ctx.stroke(); ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  const g = ctx.createRadialGradient(cx, cy, 200, cx, cy, 620); g.addColorStop(0, '#0000'); g.addColorStop(1, '#000c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
