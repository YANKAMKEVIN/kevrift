import { describe, test, expect } from 'vitest';
import { R, seed, mulberry32, rnd, rint, pick, clamp, lerp, angDiff, compact, count } from '../../src/sim/math.js';
import { cappedDpr, MAX_DPR } from '../../src/render/view.js';

describe('hasard à graine', () => {
  test('même graine, même suite', () => {
    seed(123); const a = Array.from({ length: 50 }, () => R.f());
    seed(123); const b = Array.from({ length: 50 }, () => R.f());
    expect(a).toEqual(b);
  });
  test('graines différentes, suites différentes', () => {
    seed(1); const a = R.f(); seed(2); expect(R.f()).not.toBe(a);
  });
  test('valeurs dans [0, 1[ et bien réparties', () => {
    const f = mulberry32(9); const bins = new Array(10).fill(0);
    for (let i = 0; i < 20000; i++) { const v = f(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); bins[Math.floor(v * 10)]++; }
    for (const b of bins) expect(b).toBeGreaterThan(1700);
  });
  test('deux générateurs indépendants ne se gênent pas', () => {
    const a = mulberry32(5), b = mulberry32(5);
    const x = [a(), a(), a()]; b(); expect(b()).toBe(x[1]);
  });
  test('rnd, rint et pick restent dans leurs bornes', () => {
    seed(77);
    for (let i = 0; i < 2000; i++) {
      const r = rnd(3, 7); expect(r).toBeGreaterThanOrEqual(3); expect(r).toBeLessThan(7);
      const n = rint(2, 5); expect(Number.isInteger(n)).toBe(true); expect(n).toBeGreaterThanOrEqual(2); expect(n).toBeLessThanOrEqual(5);
      expect(['a', 'b', 'c']).toContain(pick(['a', 'b', 'c']));
    }
    const seen = new Set(); for (let i = 0; i < 500; i++) seen.add(rint(2, 5));
    expect([...seen].sort()).toEqual([2, 3, 4, 5]);
  });
  test('rnd(a) donne un réel dans [0, a[', () => { seed(3); for (let i = 0; i < 100; i++) { const v = rnd(4); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(4); } });
});

describe('outils de calcul', () => {
  test('clamp et lerp', () => {
    expect(clamp(5, 0, 3)).toBe(3); expect(clamp(-1, 0, 3)).toBe(0); expect(clamp(2, 0, 3)).toBe(2);
    expect(lerp(10, 20, 0)).toBe(10); expect(lerp(10, 20, 1)).toBe(20); expect(lerp(10, 20, .25)).toBe(12.5);
  });
  test.each([[0, Math.PI / 2, Math.PI / 2], [0, -Math.PI / 2, -Math.PI / 2], [3, -3, 2 * Math.PI - 6], [-3, 3, -(2 * Math.PI - 6)], [1, 1 + 4 * Math.PI, 0]])(
    'angDiff(%f, %f) = %f', (a, b, d) => { expect(angDiff(a, b)).toBeCloseTo(d, 9); });
  test('angDiff reste dans [-π, π]', () => {
    seed(4); for (let i = 0; i < 1000; i++) { const d = angDiff(rnd(-50, 50), rnd(-50, 50)); expect(Math.abs(d)).toBeLessThanOrEqual(Math.PI + 1e-9); }
  });
  test('compact filtre sur place sans changer de tableau', () => {
    const a = [1, 2, 3, 4, 5, 6]; const ref = a;
    expect(compact(a, x => x % 2 === 0)).toBe(ref);
    expect(a).toEqual([2, 4, 6]);
    expect(compact([], () => true)).toEqual([]);
    expect(compact([1, 2], () => false)).toEqual([]);
  });
  test('compact garde l\'ordre', () => { expect(compact([5, 1, 4, 2, 3], x => x > 1)).toEqual([5, 4, 2, 3]); });
  test('count', () => { expect(count([1, 2, 3, 4], x => x > 2)).toBe(2); expect(count([], () => true)).toBe(0); });
});

describe('densité de pixels', () => {
  test('plafonnée pour les téléphones', () => { expect(cappedDpr(3)).toBe(MAX_DPR); expect(cappedDpr(2.75)).toBe(2); });
  test('inchangée sous le plafond', () => { expect(cappedDpr(1)).toBe(1); expect(cappedDpr(1.5)).toBe(1.5); });
  test('valeur absente ou absurde : 1', () => { expect(cappedDpr(0)).toBe(1); expect(cappedDpr(NaN)).toBe(1); expect(cappedDpr(-2)).toBe(1); });
});
