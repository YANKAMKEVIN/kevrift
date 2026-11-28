// Déterminisme : une graine donne toujours la même plongée, et seul le hasard à graine est utilisé.
import { describe, test, expect } from 'vitest';
import { playRun } from '../../src/sim/bot.ts';
import { R, seed } from '../../src/sim/math.ts';

describe('déterminisme', () => {
  test('même graine, même plongée, image pour image', () => {
    const a = playRun({ seed: 13, maxFrames: 60 * 180 }), b = playRun({ seed: 13, maxFrames: 60 * 180 });
    expect(a.rooms).toBeGreaterThanOrEqual(2);
    expect(b).toEqual(a);
  });
  test('graines différentes, plongées différentes', () => {
    const a = playRun({ seed: 1, maxFrames: 60 * 90 }), b = playRun({ seed: 2, maxFrames: 60 * 90 });
    expect(a.kills === b.kills && a.hits === b.hits && a.path.join() === b.path.join() && JSON.stringify(a.taken) === JSON.stringify(b.taken)).toBe(false);
  });
  test('une plongée à graine n\'utilise jamais Math.random', () => {
    const orig = Math.random; let calls = 0;
    Math.random = () => { calls++; return orig(); };
    try { playRun({ seed: 3, maxFrames: 60 * 60 }); } finally { Math.random = orig; }
    expect(calls).toBe(0);
  });
  test('le hasard cosmétique ne décale pas celui de la simulation', async () => {
    const { frnd } = await import('../../src/util.ts');
    seed(8); const a = [R.f(), R.f()];
    seed(8); R.f(); for (let i = 0; i < 100; i++) frnd(); const b = R.f();
    expect(b).toBe(a[1]);
  });
});
