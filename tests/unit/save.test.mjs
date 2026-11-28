import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import { KEY, LEGACY, SAVE_VERSION, defaults, parse, migrate, isValid, load, write, fromLegacy, beats } from '../../src/save.ts';
import { TOP_N, v1ToV2, addToTop, addToStats, emptyStats, isStats, byRank } from '../../src/save.ts';
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

/* ---------- version 2 : palmarès et carrière ---------- */


const v1 = (best = null) => ({ version: 1, cfg: { mus: 40, sfx: 50, shake: false, glow: true }, best });

describe('sauvegarde v2', () => {
  test('une sauvegarde v1 est migrée : réglages gardés, record en tête du palmarès', () => {
    const st = memStore({ [KEY]: JSON.stringify(v1(best)) });
    const d = load(st);
    assert.equal(d.version, 2);
    assert.deepEqual(d.cfg, v1().cfg);
    assert.deepEqual(d.best, best);
    assert.deepEqual(d.top, [best]);
    assert.equal(d.stats.runs, 1); assert.equal(d.stats.rooms, best.rooms);
  });
  test('v1 sans record : palmarès vide, carrière à zéro', () => {
    const d = parse(JSON.stringify(v1()));
    assert.deepEqual(d.top, []); assert.deepEqual(d.stats, emptyStats());
  });
  test('v1 avec une victoire : carrière qui le dit', () => {
    const d = v1ToV2(v1({ score: 1100, won: true, rooms: 11, time: 600 }));
    assert.equal(d.stats.wins, 1); assert.equal(d.stats.deepest, 3);
  });
  test('palmarès : trié, limité aux 5 meilleures', () => {
    let top = [];
    for (const score of [10, 50, 30, 70, 20, 90, 5]) top = addToTop(top, { score, won: false, rooms: 1, time: 60 });
    assert.equal(top.length, TOP_N);
    assert.deepEqual(top.map(b => b.score), [90, 70, 50, 30, 20]);
  });
  test('palmarès : à score égal, la victoire la plus rapide passe devant', () => {
    const a = { score: 1100, won: true, rooms: 11, time: 900 }, b = { ...a, time: 700 };
    assert.deepEqual([a, b].sort(byRank)[0], b);
  });
  test('addToTop ne modifie pas le palmarès reçu', () => {
    const top = [{ ...best }]; addToTop(top, { ...best, score: 999 }); assert.equal(top.length, 1);
  });
  test('carrière : chaque plongée s\'additionne', () => {
    let s = emptyStats();
    s = addToStats(s, { score: 30, won: false, rooms: 3, time: 100 }, { kills: 40, deepest: 0 });
    s = addToStats(s, { score: 1100, won: true, rooms: 11, time: 500 }, { kills: 200, deepest: 3 });
    assert.deepEqual(s, { runs: 2, wins: 1, kills: 240, rooms: 14, time: 600, deepest: 3 });
    assert.ok(isStats(s));
  });
  test('carrière : la strate la plus profonde ne recule jamais et reste bornée', () => {
    let s = addToStats(emptyStats(), best, { kills: 1, deepest: 2 });
    s = addToStats(s, best, { kills: 1, deepest: 0 }); assert.equal(s.deepest, 2);
    s = addToStats(s, best, { kills: 1, deepest: 99 }); assert.equal(s.deepest, 3);
  });
  test.each([
    ['plus de victoires que de plongées', { runs: 1, wins: 2, kills: 0, rooms: 0, time: 0, deepest: 0 }],
    ['nombre négatif', { runs: -1, wins: 0, kills: 0, rooms: 0, time: 0, deepest: 0 }],
    ['strate inconnue', { runs: 1, wins: 0, kills: 0, rooms: 0, time: 0, deepest: 7 }],
    ['champ manquant', { runs: 1, wins: 0, kills: 0, rooms: 0, time: 0 }],
    ['texte', { runs: '1', wins: 0, kills: 0, rooms: 0, time: 0, deepest: 0 }],
  ])('carrière invalide (%s) : sauvegarde mise de côté', (_, stats) => {
    const text = JSON.stringify({ ...defaults(), stats });
    const st = memStore({ [KEY]: text });
    assert.deepEqual(load(st), defaults());
    assert.equal(st.getItem(KEY + '.abimee'), text);
  });
  test('palmarès trop long ou abîmé : refusé', () => {
    assert.equal(parse(JSON.stringify({ ...defaults(), top: Array(TOP_N + 1).fill(best) })), null);
    assert.equal(parse(JSON.stringify({ ...defaults(), top: [{ score: 'beaucoup' }] })), null);
    assert.equal(parse(JSON.stringify({ ...defaults(), top: 'rien' })), null);
  });
  test('la migration ne modifie pas l\'objet d\'origine', () => {
    const d = v1(best); migrate(d); assert.equal(d.version, 1); assert.equal(d.top, undefined);
  });
  test('aller-retour v2 complet', () => {
    const st = memStore(); const d = defaults();
    d.best = best; d.top = [best]; d.stats = { runs: 4, wins: 0, kills: 321, rooms: 17, time: 1234.5, deepest: 2 };
    assert.ok(write(st, d)); assert.deepEqual(load(st), d);
  });
  test('stockage plein à l\'écriture : échec signalé, pas d\'exception', () => {
    const full = { getItem: () => null, setItem() { throw new DOMException('plein', 'QuotaExceededError'); }, removeItem() {} };
    assert.equal(write(full, defaults()), false);
  });
});
