import { test } from 'vitest';
import assert from 'node:assert/strict';
import { KEY, LEGACY, SAVE_VERSION, defaults, parse, migrate, isValid, load, write, fromLegacy, beats } from '../../src/save.js';
import { memStore } from './helpers.mjs';

const best = { score: 72.5, won: false, rooms: 7, time: 412.3 };

test('les valeurs par défaut sont valides', () => assert.ok(isValid(defaults())));

test('aller-retour : ce qui est sauvé est relu à l\'identique', () => {
  const st = memStore(); const d = defaults();
  d.cfg = { mus: 0, sfx: 100, shake: false, glow: false }; d.best = best;
  assert.ok(write(st, d));
  assert.deepEqual(load(st), d);
});

test('sauvegarde absente : valeurs par défaut', () => assert.deepEqual(load(memStore()), defaults()));

test('stockage bloqué (navigation privée) : le jeu tourne quand même', () => {
  const blocked = { getItem() { throw new Error('bloqué'); }, setItem() { throw new Error('bloqué'); }, removeItem() {} };
  assert.deepEqual(load(blocked), defaults());
  assert.equal(write(blocked, defaults()), false);
  assert.deepEqual(load(null), defaults());
});

test('fichier abîmé : mis de côté, jamais écrasé en silence', () => {
  const bad = ['{pas du json', '[]', '"texte"', '{"version":1}',
    JSON.stringify({ ...defaults(), cfg: { mus: 150, sfx: 80, shake: true, glow: true } }),
    JSON.stringify({ ...defaults(), best: { score: -1, won: false, rooms: 1, time: 3 } }),
    JSON.stringify({ ...defaults(), best: { score: 10, won: 'oui', rooms: 1, time: 3 } })];
  for (const b of bad) {
    const st = memStore({ [KEY]: b });
    assert.deepEqual(load(st), defaults(), b);
    assert.equal(st.getItem(KEY + '.abimee'), b);
    assert.equal(st.getItem(KEY), null);
  }
});

test('sauvegarde d\'une version plus récente du jeu : refusée', () => {
  const d = { ...defaults(), version: SAVE_VERSION + 1 };
  assert.equal(migrate(d), null);
  assert.equal(parse(JSON.stringify(d)), null);
});

test('ancien format (kevrift_cfg, kevrift_best) : repris une fois, puis anciennes clés effacées', () => {
  const st = memStore({ [LEGACY.cfg]: JSON.stringify({ mus: 30, sfx: 55.4, shake: false, glow: true }), [LEGACY.best]: JSON.stringify(best) });
  const d = load(st);
  assert.deepEqual(d.cfg, { mus: 30, sfx: 55, shake: false, glow: true });
  assert.deepEqual(d.best, best);
  assert.equal(st.getItem(LEGACY.cfg), null);
  assert.equal(st.getItem(LEGACY.best), null);
  assert.deepEqual(JSON.parse(st.getItem(KEY)), d);
});

test('ancien format partiel ou abîmé : on garde ce qui est lisible', () => {
  assert.deepEqual(fromLegacy(null, JSON.stringify(best)).cfg, defaults().cfg);
  assert.equal(fromLegacy('{oups', '{oups').best, null);
  assert.deepEqual(fromLegacy(JSON.stringify({ mus: 'fort' }), null).cfg, defaults().cfg);
});

test('record : meilleur score, ou victoire plus rapide', () => {
  assert.ok(beats(null, best));
  assert.ok(beats(best, { ...best, score: 80 }));
  assert.ok(!beats(best, { ...best, score: 50 }));
  const win = { score: 1110, won: true, rooms: 11, time: 900 };
  assert.ok(beats(win, { ...win, time: 800 }), 'victoire plus rapide');
  assert.ok(!beats(win, { ...win, time: 950 }));
});

test('write() refuse d\'écrire un état invalide', () => {
  const st = memStore(); const d = defaults(); d.cfg.mus = 101;
  assert.equal(write(st, d), false); assert.equal(st.getItem(KEY), null);
});
