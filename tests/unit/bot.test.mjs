// Parcours complet automatisé : le bot joue des plongées entières sur la simulation, sans navigateur.
import { describe, test, expect } from 'vitest';
import { playRun } from '../../src/sim/bot.js';
import { PLAN } from '../../src/config.js';

const ROOMS = PLAN.reduce((a, p) => a + p[1], 0);

describe('bot : plongées complètes', () => {
  test.each([1, 2, 3])('graine %i, gardé : traverse les 3 strates et bat l\'Archonte sous de vrais coups', s => {
    const r = playRun({ seed: s, guard: true });
    expect(r.errors).toEqual([]);
    expect(r.ended).toBe(true);
    expect(r.won).toBe(true);
    expect(r.path).toHaveLength(ROOMS + 1);
    expect(r.path.at(-1)).toBe('boss');
    expect(r.stage).toBe(2);
    expect(r.bossHp).toBe(0);
    expect(r.kills).toBeGreaterThan(100);
    expect(Object.values(r.taken).reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(5);
  });
  test.each([4, 5, 6, 7])('graine %i, libre : la plongée va jusqu\'à un écran de fin, sans invariant cassé', s => {
    const r = playRun({ seed: s });
    expect(r.errors).toEqual([]);
    expect(r.ended).toBe(true);
    expect(r.rooms).toBeGreaterThanOrEqual(3);
  });
  test('le bot libre gagne parfois : le jeu est battable', () => {
    const wins = [4, 6, 9].map(s => playRun({ seed: s }).won).filter(Boolean).length;
    expect(wins).toBeGreaterThanOrEqual(1);
  });
});
