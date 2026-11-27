// @ts-check
/** Toile principale, mise à l'échelle (densité de pixels plafonnée) et sprites de lueur mis en cache. */
import { H, W } from '../config.js';
import { $ } from '../util.js';
import { cappedDpr, view } from './view.js';

export const stage = $('stage');
/** @type {HTMLCanvasElement} */
export const cv = $('cv');
export const ctx = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d'));

/* ---------- mise à l'échelle ---------- */
export function resize() {
  view.dpr = cappedDpr(window.devicePixelRatio);
  view.scale = Math.min(innerWidth / W, innerHeight / H);
  const cw = Math.floor(W * view.scale), ch = Math.floor(H * view.scale);
  stage.style.width = cw + 'px'; stage.style.height = ch + 'px';
  cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
  cv.width = Math.floor(cw * view.dpr); cv.height = Math.floor(ch * view.dpr);
  stage.style.fontSize = Math.max(8, 16 * view.scale) + 'px';
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
export function glow(x, y, r, col, a = 1) {
  ctx.globalAlpha = a; ctx.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1;
}
