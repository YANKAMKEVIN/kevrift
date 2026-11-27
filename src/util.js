// @ts-check
/** Petits outils : hasard à graine, bornes, interpolation, angles, icônes, format des temps. */
import { ICONS, TAU } from './config.js';

/** Élément de la page par son id (la page est fixe : il existe toujours).
 * @param {string} id @returns {any} */
export const $ = id => document.getElementById(id);
/** Hasard du jeu : Math.random par défaut, à graine avec seed(n) (?graine=N, tests). */
export const R = { f: Math.random };
export function seed(n) { let a = n >>> 0; R.f = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const rnd = (a = 1, b) => b === undefined ? R.f() * a : a + R.f() * (b - a);
export const rint = (a, b) => Math.floor(rnd(a, b + 1));
export const pick = a => a[Math.floor(R.f() * a.length)];
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
export const svgIcon = k => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${ICONS[k]}</svg>`;
export const fmtT = s => Math.floor(s / 60) + ' min ' + String(Math.floor(s % 60)).padStart(2, '0');
