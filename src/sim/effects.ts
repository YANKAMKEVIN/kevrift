/** Effets de jeu : particules, textes, secousses, ralentis, bandeaux (données seulement, dessinées par src/render). */
import { TAU } from '../config.ts';
import { rnd } from './math.ts';
import { etat, game } from './state.ts';

/* =========================================================
   EFFETS
   ========================================================= */
export function burst(x: number, y: number, col: string, n = 12, spd = 260, life = .5, kind: 'spark' | 'shard' = 'spark') {
  for (let i = 0; i < n; i++) {
    const a = rnd(TAU), s = rnd(.3, 1) * spd;
    etat.parts.push({ k: kind, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(.5, 1) * life, max: life, col, rot: rnd(TAU), vr: rnd(-12, 12), sz: rnd(2, 5) });
  }
  if (etat.parts.length > 900) etat.parts.splice(0, etat.parts.length - 900);
}
export function ring(x: number, y: number, col: string, r0: number, r1: number, life = .35, w = 4) { etat.parts.push({ k: 'ring', x, y, r0, r1, life, max: life, col, w }); }
export function flare(x: number, y: number, col: string, r: number, life = .25) { etat.parts.push({ k: 'glow', x, y, r, life, max: life, col }); }
export function txt(x: number, y: number, s: string, col = '#fff', big = false) { etat.texts.push({ x: x + rnd(-6, 6), y, s, col, t: 0, big }); }
export function shake(a: number) { game.shake = Math.min(24, Math.max(game.shake, a)); }
/** Gel bref de l'image (impact). */
export function stop(t: number) { game.hitstop = Math.max(game.hitstop, t); }
export function flash(c: string, a = .5) { game.flash = a; game.flashCol = c; }
export function banner(t: string, s: string, big?: boolean) { game.banner = { t, s, life: 2.6, big }; }
