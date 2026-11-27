// @ts-check
/** Hasard à graine et petits outils de calcul de la simulation (sans DOM). */
import { TAU } from '../config.js';

/** Hasard de la simulation : Math.random par défaut, à graine avec seed(n) (?graine=N, tests, bot).
 * Le rendu et le son n'y touchent jamais (ils ont leur propre hasard cosmétique),
 * sinon une même graine donnerait des plongées différentes selon l'affichage. */
export const R = { f: Math.random };
/** Générateur mulberry32 : rapide, 32 bits, reproductible.
 * @param {number} n @returns {() => number} */
export function mulberry32(n) { let a = n >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/** Fixe la graine de la simulation. @param {number} n */
export function seed(n) { R.f = mulberry32(n); }
/** Réel dans [0, a[ ou dans [a, b[. @param {number} [a] @param {number} [b] */
export const rnd = (a = 1, b) => b === undefined ? R.f() * a : a + R.f() * (b - a);
/** Entier dans [a, b]. @param {number} a @param {number} b */
export const rint = (a, b) => Math.floor(rnd(a, b + 1));
/** Élément au hasard. @template T @param {readonly T[]} a @returns {T} */
export const pick = a => a[Math.floor(R.f() * a.length)];
/** @param {number} v @param {number} a @param {number} b */
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
/** @param {number} a @param {number} b @param {number} t */
export const lerp = (a, b, t) => a + (b - a) * t;
/** Écart signé le plus court entre deux angles, dans [-π, π]. @param {number} a @param {number} b */
export const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
/** Filtre un tableau sur place (aucune allocation par image) et le renvoie.
 * @template T @param {T[]} arr @param {(x: T) => unknown} keep @returns {T[]} */
export function compact(arr, keep) {
  let j = 0;
  for (let i = 0; i < arr.length; i++) { const x = arr[i]; if (keep(x)) arr[j++] = x; }
  arr.length = j;
  return arr;
}
/** Nombre d'éléments qui vérifient une condition, sans tableau intermédiaire.
 * @template T @param {readonly T[]} arr @param {(x: T) => unknown} pred */
export function count(arr, pred) { let n = 0; for (const x of arr) if (pred(x)) n++; return n; }
