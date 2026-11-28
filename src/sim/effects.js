// @ts-check
/** Effets de jeu : particules, textes, secousses, ralentis, bandeaux (données seulement, dessinées par render.js). */
import { TAU } from '../config.js';
import { rnd } from './math.js';
import { etat, game } from './state.js';

/* =========================================================
   EFFETS
   ========================================================= */
/** @param {number} x @param {number} y @param {string} col @param {number} [n] @param {number} [spd] @param {number} [life] @param {string} [kind] */
export function burst(x, y, col, n = 12, spd = 260, life = .5, kind = 'spark') {
  for (let i = 0; i < n; i++) {
    const a = rnd(TAU), s = rnd(.3, 1) * spd;
    etat.parts.push({ k: kind, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(.5, 1) * life, max: life, col, rot: rnd(TAU), vr: rnd(-12, 12), sz: rnd(2, 5) });
  }
  if (etat.parts.length > 900) etat.parts.splice(0, etat.parts.length - 900);
}
/** @param {number} x @param {number} y @param {string} col @param {number} r0 @param {number} r1 @param {number} [life] @param {number} [w] */
export function ring(x, y, col, r0, r1, life = .35, w = 4) { etat.parts.push({ k: 'ring', x, y, r0, r1, life, max: life, col, w }); }
/** @param {number} x @param {number} y @param {string} col @param {number} r @param {number} [life] */
export function flare(x, y, col, r, life = .25) { etat.parts.push({ k: 'glow', x, y, r, life, max: life, col }); }
/** @param {number} x @param {number} y @param {string} s @param {string} [col] @param {boolean} [big] */
export function txt(x, y, s, col = '#fff', big = false) { etat.texts.push({ x: x + rnd(-6, 6), y, s, col, t: 0, big }); }
/** @param {number} a */
export function shake(a) { game.shake = Math.min(24, Math.max(game.shake, a)); }
/** Gel bref de l'image (impact). @param {number} t */
export function stop(t) { game.hitstop = Math.max(game.hitstop, t); }
/** @param {string} c @param {number} [a] */
export function flash(c, a = .5) { game.flash = a; game.flashCol = c; }
/** @param {string} t @param {string} s @param {boolean} [big] */
export function banner(t, s, big) { game.banner = { t, s, life: 2.6, big }; }
