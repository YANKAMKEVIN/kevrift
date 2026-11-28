import { describe, test, expect, beforeEach } from 'vitest';
import { etat, game, start, wireUi } from './helpers.mjs';
import { UPS } from '../../src/sim/ups.js';
import { rollUps, takeUp } from '../../src/sim/rooms.js';
import { makeStats } from '../../src/sim/state.js';
import { ICONS, RAR } from '../../src/config.js';
import { seed } from '../../src/sim/math.js';

const byId = id => UPS.find(u => u.id === id);
beforeEach(() => { wireUi(); start(21); });

// effet attendu de chaque pouvoir sur les statistiques de départ
const EFFECTS = {
  lame: s => ({ dmg: s.dmg * 1.25 }), frenesie: s => ({ atkSpd: s.atkSpd * 1.18 }), portee: s => ({ range: s.range * 1.22 }),
  crit: s => ({ crit: s.crit + .12 }), tirrapide: s => ({ shotCd: s.shotCd * .75 }), runeforce: s => ({ shotDmg: s.shotDmg * 1.4 }),
  jumelle: s => ({ shots: s.shots + 1 }), percante: s => ({ pierce: s.pierce + 2 }), chercheuse: () => ({ homing: 1 }),
  ombre: s => ({ dashCd: s.dashCd * .75 }), double: s => ({ dashMax: s.dashMax + 1 }), sillage: () => ({ burn: 1 }),
  temps: () => ({ timeSlow: 1 }), vitesse: s => ({ speed: s.speed * 1.12 }), coeur: s => ({ maxHp: s.maxHp + 25 }),
  vampire: s => ({ life: s.life + 2 }), bouclier: () => ({ shield: 1 }), epines: s => ({ thorns: s.thorns + 45 }),
  souffle: () => ({ lastBreath: 1 }), orbite: s => ({ orbit: s.orbit + 1 }), eclair: s => ({ chain: s.chain + .25 }),
  givre: () => ({ frost: 1 }), echo: s => ({ explode: s.explode + 1 }), surcharge: s => ({ novaRate: s.novaRate * 1.4 }),
  novarunes: () => ({ novaRunes: 1 }), renvoi: s => ({ reflect: s.reflect + 1 }),
};

describe('catalogue des pouvoirs', () => {
  test('26 pouvoirs, identifiants uniques, données complètes', () => {
    expect(UPS).toHaveLength(26);
    expect(new Set(UPS.map(u => u.id)).size).toBe(26);
    for (const u of UPS) {
      expect(u.n.length).toBeGreaterThan(2); expect(u.d.length).toBeGreaterThan(5);
      expect(RAR[u.r]).toBeDefined(); expect(ICONS[u.ic]).toBeDefined();
      expect(u.max).toBeGreaterThanOrEqual(1);
    }
  });
  test('chaque pouvoir a un effet testé ici', () => { expect(Object.keys(EFFECTS).sort()).toEqual(UPS.map(u => u.id).sort()); });
  test('les trois raretés existent', () => { expect(new Set(UPS.map(u => u.r))).toEqual(new Set([0, 1, 2])); });
});

describe('effet de chaque pouvoir', () => {
  test.each(UPS.map(u => u.id))('%s', id => {
    const base = makeStats();
    takeUp(byId(id));
    for (const [k, v] of Object.entries(EFFECTS[id](base))) expect(etat.S[k], k).toBeCloseTo(v, 9);
    // rien d'autre ne bouge
    for (const k of Object.keys(base)) if (!(k in EFFECTS[id](base))) expect(etat.S[k], k).toBe(base[k]);
    expect(game.taken[id]).toBe(1);
  });
  test('Cœur de Cristal soigne aussi 25 PV', () => { etat.P.hp = 50; takeUp(byId('coeur')); expect(etat.P.hp).toBe(75); });
  test('Double Pas donne la charge tout de suite', () => { takeUp(byId('double')); expect(etat.P.dashCh).toBe(2); });
  test('les pouvoirs se cumulent', () => {
    const d0 = etat.S.dmg; takeUp(byId('lame')); takeUp(byId('lame'));
    expect(etat.S.dmg).toBeCloseTo(d0 * 1.25 * 1.25); expect(game.taken.lame).toBe(2);
  });
});

describe('tirage des cartes', () => {
  test('trois cartes différentes', () => {
    for (let s = 1; s <= 50; s++) { seed(s); const r = rollUps(3); expect(r).toHaveLength(3); expect(new Set(r.map(u => u.id)).size).toBe(3); }
  });
  test('un pouvoir au maximum ne sort plus', () => {
    const lame = byId('lame'); for (let i = 0; i < lame.max; i++) takeUp(lame);
    for (let s = 1; s <= 200; s++) { seed(s); expect(rollUps(3).map(u => u.id)).not.toContain('lame'); }
  });
  test('quand presque tout est pris, le tirage se réduit sans planter', () => {
    for (const u of UPS) game.taken[u.id] = u.max;
    expect(rollUps(3)).toEqual([]);
    delete game.taken.vitesse;
    expect(rollUps(3).map(u => u.id)).toEqual(['vitesse']);
  });
  test('défi et marchand : les raretés hautes sortent plus souvent', () => {
    const rate = boost => { let hi = 0, n = 0; for (let s = 1; s <= 400; s++) { seed(s); for (const u of rollUps(3, boost)) { n++; if (u.r > 0) hi++; } } return hi / n; };
    const normal = rate(false), boosted = rate(true);
    expect(boosted).toBeGreaterThan(normal + .15);
  });
  test('les légendaires restent rares hors défi', () => {
    let leg = 0, n = 0; for (let s = 1; s <= 400; s++) { seed(s); for (const u of rollUps(1)) { n++; if (u.r === 2) leg++; } }
    expect(leg / n).toBeLessThan(.15);
    expect(leg).toBeGreaterThan(0);
  });
});
