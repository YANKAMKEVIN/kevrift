/** Toile principale, mise à l'échelle (densité de pixels plafonnée) et sprites de lueur mis en cache. */
import { H, W } from '../config.ts';
import { $ } from '../util.ts';
import { cappedDpr, view } from './view.ts';

export const stage = $('stage');
export const cv: HTMLCanvasElement = $('cv');
export const ctx = (cv.getContext('2d') as CanvasRenderingContext2D);

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
const glowCache: Record<string, HTMLCanvasElement> = {};
function glowSprite(col: string) {
  if (glowCache[col]) return glowCache[col];
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = (c.getContext('2d') as CanvasRenderingContext2D), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, col); gr.addColorStop(.25, col + 'aa'); gr.addColorStop(.6, col + '33'); gr.addColorStop(1, col + '00');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return glowCache[col] = c;
}
export function glow(x: number, y: number, r: number, col: string, a = 1) {
  ctx.globalAlpha = a; ctx.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1;
}
