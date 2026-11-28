import { describe, test, expect, beforeEach } from 'vitest';
import { etat, game, start, wireUi, run, DT } from './helpers.mjs';
import { BORDER, EDEF, H, PLAN, W, ZONES } from '../../src/config.js';
import { advance, freeSpot, openPortals, planWaves, rectHit, solidAt, roomCleared } from '../../src/sim/rooms.js';
import { music } from '../../src/sim/state.js';
import { update } from '../../src/sim/update.js';

const ROOMS = PLAN.reduce((a, p) => a + p[1], 0);
const inner = w => !w.b;
const POOL = [
  new Set(['mite', 'spitter', 'bomber', 'splitter']),
  new Set(['mite', 'spitter', 'bomber', 'brute', 'sentinel', 'splitter', 'weaver']),
  new Set(['mite', 'spitter', 'bomber', 'brute', 'sentinel', 'weaver', 'splitter']),
];

beforeEach(() => { wireUi(); });

describe('génération des salles', () => {
  test('quatre murs d\'enceinte qui ferment l\'arène', () => {
    start(1);
    const b = etat.room.walls.filter(w => w.b);
    expect(b).toHaveLength(4);
    expect(solidAt(5, H / 2, 1)).toBe(true); expect(solidAt(W - 5, H / 2, 1)).toBe(true);
    expect(solidAt(W / 2, 5, 1)).toBe(true); expect(solidAt(W / 2, H - 5, 1)).toBe(true);
  });
  test.each(Array.from({ length: 40 }, (_, i) => i + 1))('graine %i : obstacles symétriques et dans l\'arène', s => {
    start(s);
    const ws = etat.room.walls.filter(inner);
    expect(ws.length % 4).toBe(0);
    for (const w of ws) {
      expect(w.x).toBeGreaterThanOrEqual(BORDER); expect(w.y).toBeGreaterThanOrEqual(BORDER);
      expect(w.x + w.w).toBeLessThanOrEqual(W - BORDER); expect(w.y + w.h).toBeLessThanOrEqual(H - BORDER);
      expect(w.w).toBeGreaterThan(0); expect(w.h).toBeGreaterThan(0);
      // le reflet gauche-droite de chaque obstacle existe aussi
      expect(ws.some(o => Math.abs(o.x - (W - w.x - w.w)) < 1e-9 && o.y === w.y && o.w === w.w && o.h === w.h)).toBe(true);
    }
  });
  test('le héros apparaît en bas, au centre, libre et brièvement invulnérable', () => {
    for (let s = 1; s <= 25; s++) {
      start(s);
      expect(etat.P.x).toBe(W / 2); expect(etat.P.y).toBe(H - 70);
      expect(solidAt(etat.P.x, etat.P.y, etat.P.r)).toBe(false);
      expect(etat.P.inv).toBeGreaterThan(0);
    }
  });
  test('les évents n\'apparaissent qu\'à partir de la strate II, loin du héros', () => {
    start(2);
    expect(etat.room.vents).toHaveLength(0);
    let seen = 0;
    for (let s = 1; s <= 20; s++) {
      start(s); etat.stageIdx = 1; etat.roomInStage = 0; etat.roomNum = 4; advance('combat');
      for (const v of etat.room.vents) { seen++; expect(Math.hypot(v.x - W / 2, v.y - 460)).toBeGreaterThan(120); }
      expect(etat.room.vents.length).toBeLessThanOrEqual(3);
    }
    expect(seen).toBeGreaterThan(10);
  });
  test('freeSpot : jamais dans un mur, toujours assez loin du héros', () => {
    start(11);
    for (let i = 0; i < 200; i++) {
      const p = freeSpot(14, 200);
      if (!p) continue;
      expect(solidAt(p.x, p.y, 14)).toBe(false);
      expect(Math.hypot(p.x - etat.P.x, p.y - etat.P.y)).toBeGreaterThan(200);
    }
  });
  test('freeSpot renvoie null quand c\'est impossible', () => { start(1); expect(freeSpot(10, 5000, 30)).toBeNull(); });
  test('rectHit : cercle contre rectangle', () => {
    const w = { x: 100, y: 100, w: 50, h: 20 };
    expect(rectHit(90, 110, 11, w)).toBe(true);
    expect(rectHit(90, 110, 9, w)).toBe(false);
    expect(rectHit(125, 110, 1, w)).toBe(true);
    expect(rectHit(160, 130, 10, w)).toBe(false);
  });
});

describe('vagues d\'ennemis', () => {
  test('combat : 2 vagues, défi : 3 vagues et un champion', () => {
    start(3); expect(etat.room.waves).toHaveLength(2);
    etat.roomNum = 2; advance('defi');
    expect(etat.room.waves).toHaveLength(3);
    const last = etat.room.waves[2];
    expect(last.at(-1).elite).toBe(true);
    expect(['splitter', 'brute', 'weaver']).toContain(last.at(-1).type);
  });
  test('le budget grandit avec la profondeur', () => {
    const cost = () => etat.room.waves.flat().reduce((a, w) => a + EDEF[w.type].cost, 0);
    start(5); const early = cost();
    etat.roomNum = 9; etat.room.waves = []; planWaves(); const late = cost();
    expect(late).toBeGreaterThan(early * 2);
  });
  test.each([0, 1, 2])('strate %i : seulement les ennemis de sa liste', z => {
    for (let s = 1; s <= 15; s++) {
      start(s); etat.room.z = z; etat.roomNum = 1 + z * 4; etat.room.waves = []; planWaves();
      for (const w of etat.room.waves.flat()) expect(POOL[z].has(w.type)).toBe(true);
    }
  });
  test('pas de cristal diviseur dans la toute première salle', () => {
    for (let s = 1; s <= 30; s++) { start(s); for (const w of etat.room.waves.flat()) expect(w.type).not.toBe('splitter'); }
  });
  test('au plus 14 ennemis par vague', () => {
    start(8); etat.roomNum = 40; etat.room.waves = []; planWaves();
    for (const w of etat.room.waves) expect(w.length).toBeLessThanOrEqual(14);
  });
  test('la salle se purifie quand toutes les vagues sont vaincues', () => {
    start(4);
    let frames = 0;
    while (!etat.room.cleared && frames++ < 60 * 60) {
      for (const e of etat.enemies) if (!e.dead && e.spawnT <= 0) { e.hp = 0; e.dead = true; }
      etat.P.inv = 1; update(DT, null);
    }
    expect(etat.room.cleared).toBe(true);
    expect(etat.room.wave).toBe(etat.room.waves.length);
    expect(game.roomsDone).toBe(1);
  });
});

describe('salles spéciales', () => {
  test('fontaine : déjà purifiée, portails ouverts, soigne 45 PV une seule fois', () => {
    start(6); etat.P.hp = 20; advance('fountain');
    expect(etat.room.cleared).toBe(true); expect(etat.portals.length).toBeGreaterThan(0);
    etat.P.x = etat.room.obj.x; etat.P.y = etat.room.obj.y + 10; update(DT, null);
    expect(etat.room.obj.used).toBe(true);
    expect(etat.P.hp).toBe(65);
    update(DT, null); expect(etat.P.hp).toBe(65);
  });
  test('marchand : s\'ouvre quand on s\'approche', () => {
    start(6);
    advance('shop');
    expect(etat.room.obj.kind).toBe('shop');
    etat.P.x = etat.room.obj.x; etat.P.y = etat.room.obj.y + 30;
    const portals0 = etat.portals.length;
    run(70);
    expect(etat.room.obj.used).toBe(true);
    expect(etat.portals.length).toBeGreaterThan(portals0); // le wireUi de test quitte la boutique : portails ouverts
  });
});

describe('portails et progression', () => {
  test('choix ordinaire : deux portails dont un combat', () => {
    for (let s = 1; s <= 20; s++) {
      start(s); game.shards = 0; etat.portals.length = 0; openPortals();
      const types = etat.portals.map(p => p.type);
      expect(types).toHaveLength(2); expect(types).toContain('combat');
      expect(types).not.toContain('shop');
    }
  });
  test('le marchand ne se propose qu\'avec au moins 25 éclats', () => {
    let shop = 0;
    for (let s = 1; s <= 60; s++) { start(s); game.shards = 30; etat.portals.length = 0; openPortals(); if (etat.portals.some(p => p.type === 'shop')) shop++; }
    expect(shop).toBeGreaterThan(5);
  });
  test('avant-dernière salle d\'une strate : un seul portail, le gardien', () => {
    start(2); etat.roomInStage = PLAN[0][1] - 2; etat.portals.length = 0; openPortals();
    expect(etat.portals).toHaveLength(1);
    expect(etat.portals[0]).toMatchObject({ type: 'defi', gate: true });
  });
  test('dernière salle de la dernière strate : le portail du boss', () => {
    start(2); etat.stageIdx = 2; etat.roomInStage = PLAN[2][1] - 1; etat.portals.length = 0; openPortals();
    expect(etat.portals.map(p => p.type)).toEqual(['boss']);
  });
  test('changer de strate : bannière, musique, et 30 PV rendus', () => {
    start(9); etat.roomInStage = PLAN[0][1] - 1; etat.roomNum = PLAN[0][1] - 1; etat.P.hp = 40;
    advance('combat');
    expect(etat.stageIdx).toBe(1); expect(etat.roomInStage).toBe(0);
    expect(game.banner.s).toBe(ZONES[1].name);
    expect(music.zone).toBe(1);
    expect(etat.P.hp).toBe(70);
  });
  test('la plongée compte 11 salles puis le boss', () => {
    expect(ROOMS).toBe(11);
    start(1); const seen = [etat.stageIdx];
    for (let i = 0; i < ROOMS - 1; i++) { advance('combat'); seen.push(etat.stageIdx); }
    expect(seen).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2]);
    advance('boss');
    expect(etat.room.type).toBe('boss'); expect(etat.room.z).toBe(2); expect(etat.boss).not.toBeNull();
  });
  test('entrer dans un portail lance la transition puis charge la salle', () => {
    start(3); roomCleared(); etat.room.rewarded = true; etat.portals.length = 0; openPortals();
    const p = etat.portals[0]; etat.P.x = p.x; etat.P.y = p.y; etat.P.inv = 9;
    const before = etat.room;
    run(45);
    expect(game.trans).not.toBeNull();
    run(60);
    expect(etat.room).not.toBe(before);
    expect(etat.room.type).toBe(p.type);
    expect(etat.roomNum).toBe(1);
  });
});
