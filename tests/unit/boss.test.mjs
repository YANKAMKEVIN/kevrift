import { describe, test, expect, beforeEach } from 'vitest';
import { etat, game, start, wireUi, run, DT } from './helpers.mjs';
import { BOSS_HP, PLAN } from '../../src/config.js';
import { advance } from '../../src/sim/rooms.js';
import { hitEnemy, makeEnemy } from '../../src/sim/combat.js';
import { update } from '../../src/sim/update.js';
import { music } from '../../src/sim/state.js';

let log;
function toBoss(s = 31) {
  log = wireUi(); start(s);
  etat.stageIdx = 2; etat.roomInStage = PLAN[2][1] - 1; etat.roomNum = 10;
  advance('boss');
  return etat.boss;
}
const ready = b => { b.intro = 0; b.invT = 0; };
beforeEach(() => toBoss());

describe('l\'Archonte Fracturé', () => {
  test('arrive avec tous ses points de vie, sa musique et son intro', () => {
    const b = etat.boss;
    expect(b.hp).toBe(BOSS_HP); expect(b.phase).toBe(1); expect(b.intro).toBeGreaterThan(0);
    expect(etat.enemies).toContain(b);
    expect(music.zone).toBe(3); expect(music.target).toBe(2);
  });
  test('invulnérable pendant son intro', () => {
    const b = etat.boss; hitEnemy(b, 5000, 0, 0); expect(b.hp).toBe(BOSS_HP);
  });
  test.each([[.7, 1], [.6, 2], [.4, 2], [.3, 3], [.05, 3]])('à %f de ses PV : phase %i', (frac, phase) => {
    const b = etat.boss; ready(b); b.hp = BOSS_HP * frac; etat.P.inv = 99;
    update(DT, null); run(5);
    expect(b.phase).toBe(phase);
  });
  test('chaque phase lui fait perdre des plaques et le rend brièvement invulnérable', () => {
    const b = etat.boss; ready(b); b.hp = BOSS_HP * .5; etat.P.inv = 99; update(DT, null);
    expect(b.plates).toBe(4); expect(b.invT).toBeGreaterThan(1);
    run(30); b.invT = 0; b.hp = BOSS_HP * .2; run(30);
    expect(b.plates).toBe(2); expect(game.banner.t).toBe('PHASE III');
  });
  test('il attaque : des tirs apparaissent', () => {
    const b = etat.boss; ready(b); b.next = 0; etat.P.inv = 999;
    let shots = 0; for (let i = 0; i < 60 * 8; i++) { etat.P.hp = 100; etat.P.inv = 9; update(DT, null); shots = Math.max(shots, etat.bullets.length + etat.lasers.length + etat.zones.length); }
    expect(shots).toBeGreaterThan(5);
  });
  test('il ne répète jamais la même attaque deux fois de suite', () => {
    const b = etat.boss; ready(b); b.hp = BOSS_HP * .2; const seq = [];
    for (let i = 0; i < 60 * 40; i++) { etat.P.hp = 100; etat.P.inv = 9; update(DT, null); if (b.atk && seq.at(-1) !== b.atk) seq.push(b.atk); else if (!b.atk && seq.at(-1) !== null) seq.push(null); }
    const atks = seq.filter(Boolean);
    expect(atks.length).toBeGreaterThan(4);
    for (let i = 1; i < atks.length; i++) expect(atks[i]).not.toBe(atks[i - 1]);
  });
  test('vaincu : ses sbires meurent, puis la victoire est annoncée après la mise en scène', () => {
    const b = etat.boss; ready(b);
    const m = makeEnemy('mite', 200, 200); m.spawnT = 0; etat.enemies.push(m);
    hitEnemy(b, BOSS_HP * 2, 0, 0, { fixed: 1 });
    etat.P.inv = 99; run(20); // après le gel d'impact
    expect(b.deathT).toBeGreaterThan(0); expect(m.dead).toBe(true); expect(etat.lasers).toHaveLength(0);
    run(60 * 2);
    expect(log).not.toContain('VICTOIRE');
    run(60 * 4);
    expect(b.dead).toBe(true);
    expect(log).toContain('VICTOIRE');
    expect(game.endT).toBe(0);
  });
  test('la fin n\'est annoncée qu\'une seule fois', () => {
    const b = etat.boss; ready(b); hitEnemy(b, BOSS_HP * 2, 0, 0, { fixed: 1 });
    run(60 * 8);
    expect(log.filter(x => x === 'VICTOIRE')).toHaveLength(1);
  });
  test('une nouvelle plongée annule une fin en attente', () => {
    const b = etat.boss; ready(b); hitEnemy(b, BOSS_HP * 2, 0, 0, { fixed: 1 }); run(60 * 3);
    start(2); run(60 * 5);
    expect(log).not.toContain('VICTOIRE'); expect(game.endT).toBe(0);
  });
});
