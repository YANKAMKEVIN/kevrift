import { test } from 'vitest';
import assert from 'node:assert/strict';
import { etat, game, assistedRun, start, run, wireUi, keys, pressed, DT } from './helpers.mjs';
import { PLAN, BOSS_HP } from '../../src/config.ts';
import { UPS } from '../../src/sim/ups.ts';
import { rollUps, takeUp, planWaves, solidAt } from '../../src/sim/rooms.ts';
import { hurtPlayer, heal, makeEnemy, hitEnemy } from '../../src/sim/combat.ts';
import { update } from '../../src/sim/update.ts';

const ROOMS = PLAN.reduce((a, p) => a + p[1], 0);

test('plongée complète : 3 strates, toutes les salles, le boss vaincu, écran de victoire', () => {
  const { log, rooms } = assistedRun(7);
  assert.equal(game.ended, true, `journal : ${log.join(' ')}`);
  assert.equal(rooms.at(-1), 'boss');
  assert.equal(rooms.length, ROOMS + 1, `salles : ${rooms.join(' ')}`);
  assert.equal(etat.stageIdx, 2);
  assert.ok(game.kills > 30, `${game.kills} ennemis vaincus`);
  assert.ok(log.filter(x => UPS.some(u => u.id === x)).length >= 4, 'des pouvoirs gagnés en route');
  assert.ok(etat.boss.dead);
});

test('la même graine donne la même plongée', () => {
  const a = assistedRun(42).rooms.join();
  const b = assistedRun(42).rooms.join();
  assert.equal(a, b);
});

test('une nouvelle plongée part de zéro', () => {
  wireUi(); start(3);
  assert.equal(game.state, 'play');
  assert.equal(etat.P.hp, 100);
  assert.equal(etat.room.type, 'combat');
  assert.equal(etat.roomNum, 0);
  assert.deepEqual(game.taken, {});
  assert.equal(etat.boss, null);
});

test('les ennemis arrivent par vagues puis la salle se purifie', () => {
  wireUi(); start(5);
  run(120);
  assert.ok(etat.enemies.length > 0 || etat.spawners.length > 0, 'une vague apparaît');
  assert.equal(etat.room.cleared, false);
});

test('les murs de la salle ne recouvrent pas le point d\'apparition du héros', () => {
  for (let s = 1; s <= 30; s++) { wireUi(); start(s); assert.equal(solidAt(etat.P.x, etat.P.y, etat.P.r), false, `graine ${s}`); }
});

test('chaque vague respecte le budget de la salle', () => {
  wireUi(); start(9);
  etat.room.waves = []; planWaves();
  const w = etat.room.waves;
  assert.ok(w.length >= 2);
  for (const wave of w) assert.ok(wave.length >= 1 && wave.length <= 14);
});

test('frapper : un ennemi au contact perd des points de vie, puis meurt', () => {
  wireUi(); start(2);
  etat.enemies.length = 0; etat.spawners.length = 0;
  const e = makeEnemy('mite', etat.P.x, etat.P.y - 40, false); e.spawnT = 0; etat.enemies.push(e);
  const hp0 = e.hp;
  etat.P.face = etat.P.aim = -Math.PI / 2; keys.KeyJ = true;
  update(DT, null); update(DT, null);
  keys.KeyJ = false;
  assert.ok(e.hp < hp0 || e.dead, 'coup porté');
  hitEnemy(e, 1e6, 0, 0); assert.ok(e.dead); assert.ok(game.kills >= 1);
});

test('prendre un coup, invulnérabilité brève, esquive, mort', () => {
  wireUi(); start(4); etat.P.inv = 0;
  assert.ok(hurtPlayer(10, etat.P.x, etat.P.y - 20));
  assert.equal(etat.P.hp, 90);
  assert.equal(hurtPlayer(10, etat.P.x, etat.P.y - 20), false, 'invulnérable juste après');
  heal(50); assert.equal(etat.P.hp, 100, 'pas au-dessus du maximum');
  etat.P.inv = 0; game.hitstop = 0; pressed.dash = 1; update(DT, null);
  assert.ok(etat.P.dashT > 0 || etat.P.inv > 0);
  assert.equal(hurtPlayer(10, etat.P.x, etat.P.y), false, 'pas de dégâts pendant l\'esquive');
  etat.P.inv = 0; etat.P.dashT = 0; etat.P.hp = 5;
  hurtPlayer(50, etat.P.x, etat.P.y);
  assert.ok(etat.P.dead, 'mort à 0 PV');
});

test('les pouvoirs changent les statistiques et respectent leur niveau maximum', () => {
  wireUi(); start(6);
  const lame = UPS.find(u => u.id === 'lame'); const d0 = etat.S.dmg;
  takeUp(lame); assert.ok(etat.S.dmg > d0);
  for (let i = 0; i < 20; i++) for (const u of rollUps(3)) { takeUp(u); }
  for (const u of UPS) assert.ok((game.taken[u.id] || 0) <= u.max, u.id);
  const r = rollUps(3); assert.equal(new Set(r.map(u => u.id)).size, r.length, 'pas de doublon dans un tirage');
});

test('chaque pouvoir s\'applique sans erreur', () => {
  for (const u of UPS) { wireUi(); start(1); assert.doesNotThrow(() => takeUp(u), u.id); }
});

test('le boss a ses points de vie et change de phase', () => {
  wireUi(); start(8);
  etat.stageIdx = 2; etat.roomInStage = PLAN[2][1] - 1; etat.roomNum = ROOMS - 1;
  etat.room.cleared = true;
  game.trans = { t: 0, type: 'boss', done: false };
  for (let i = 0; i < 60; i++) update(DT, null);
  assert.equal(etat.room.type, 'boss');
  assert.equal(etat.boss.hp, BOSS_HP);
  etat.boss.invT = 0; etat.boss.intro = 0;
  hitEnemy(etat.boss, BOSS_HP * .5, 0, 0);
  etat.P.inv = 99; for (let i = 0; i < 30; i++) update(DT, null);
  assert.ok(etat.boss.phase >= 2, `phase ${etat.boss.phase}`);
});
