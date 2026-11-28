/** Hasard à graine et petits outils de calcul de la simulation (sans DOM). */
import { TAU } from '../config.ts';

/** Hasard de la simulation : Math.random par défaut, à graine avec seed(n) (?graine=N, tests, bot).
 * Le rendu et le son n'y touchent jamais (ils ont leur propre hasard cosmétique),
 * sinon une même graine donnerait des plongées différentes selon l'affichage. */
export const R = { f: Math.random };
/** Générateur mulberry32 : rapide, 32 bits, reproductible. */
export function mulberry32(n: number): () => number { let a = n >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/** Fixe la graine de la simulation. */
export function seed(n: number) { R.f = mulberry32(n); }
/** Réel dans [0, a[ ou dans [a, b[. */
export const rnd = (a = 1, b?: number) => b === undefined ? R.f() * a : a + R.f() * (b - a);
/** Entier dans [a, b]. */
export const rint = (a: number, b: number) => Math.floor(rnd(a, b + 1));
/** Élément au hasard. */
export const pick = <T>(a: readonly T[]): T => a[Math.floor(R.f() * a.length)];
export const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Écart signé le plus court entre deux angles, dans [-π, π]. */
export const angDiff = (a: number, b: number) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
/** Filtre un tableau sur place (aucune allocation par image) et le renvoie. */
export function compact<T>(arr: T[], keep: (x: T) => unknown): T[] {
  let j = 0;
  for (let i = 0; i < arr.length; i++) { const x = arr[i]; if (keep(x)) arr[j++] = x; }
  arr.length = j;
  return arr;
}
/** Nombre d'éléments qui vérifient une condition, sans tableau intermédiaire. */
export function count<T>(arr: readonly T[], pred: (x: T) => unknown) { let n = 0; for (const x of arr) if (pred(x)) n++; return n; }
