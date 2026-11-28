// Empreinte de la simulation : un rejeu déterministe (commandes scriptées, état haché à chaque image)
// et les résultats complets du bot sur 20 graines doivent rester identiques, bit pour bit.
// Sert de garde-fou aux réécritures sans changement de règles (ex. passage de JS à TypeScript).
// Si une règle change volontairement : EMPREINTE_ECRIRE=1 npx vitest run tests/unit/empreinte.test.mjs
import { describe, test, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { playRun } from '../../src/sim/bot.ts';
import { mulberry32, seed } from '../../src/sim/math.ts';
import { IN, T, etat, fx, game, keys, pressed } from '../../src/sim/state.ts';
import { newRun, openPortals, rollUps, takeUp } from '../../src/sim/rooms.ts';
import { update } from '../../src/sim/update.ts';

const FILE = new URL('./empreinte.json', import.meta.url);
const DT = 1 / 60;

/** Hachage FNV-1a 32 bits sur la représentation binaire exacte des nombres (aucun arrondi). */
function hasher() {
  let h = 0x811c9dc5;
  const dv = new DataView(new ArrayBuffer(8));
  const byte = b => { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; };
  return {
    num(v) { dv.setFloat64(0, typeof v === 'number' ? v : v ? 1 : 0); for (let i = 0; i < 8; i++) byte(dv.getUint8(i)); },
    str(s) { for (let i = 0; i < s.length; i++) byte(s.charCodeAt(i) & 255); },
    get value() { return h.toString(16).padStart(8, '0'); },
  };
}

/** Rejeu : commandes scriptées (clavier, manette, appuis) tirées d'un hasard propre, état complet haché à chaque image. */
function replay(s, frames) {
  const h = hasher(), cmd = mulberry32(s * 7919 + 1);
  Object.assign(fx, {
    overlay() {}, roomLoaded() {},
    choice() { const u = rollUps(3, etat.room.type === 'defi'); if (u.length) takeUp(u[Math.floor(cmd() * u.length)]); game.state = 'play'; openPortals(); },
    shop() { game.state = 'play'; openPortals(); },
    end(w) { game.state = 'over'; h.str(w ? 'V' : 'D'); },
  });
  seed(s);
  for (const k in keys) keys[k] = false;
  pressed.dash = pressed.nova = 0; IN.mode = 'kb'; T.x = T.y = 0; T.atk = T.shot = false;
  newRun();
  let st = null;
  for (let f = 0; f < frames && game.state === 'play'; f++) {
    if (f % 20 === 0) {
      keys.KeyW = cmd() < .3; keys.KeyS = !keys.KeyW && cmd() < .3; keys.KeyA = cmd() < .3; keys.KeyD = !keys.KeyA && cmd() < .3;
      keys.KeyJ = cmd() < .6; keys.KeyK = cmd() < .3;
      st = cmd() < .4 ? { lx: cmd() * 2 - 1, ly: cmd() * 2 - 1, rx: cmd() * 2 - 1, ry: cmd() * 2 - 1, atk: cmd() < .5, shot: cmd() < .5 } : null;
      if (cmd() < .15) pressed.dash = 1;
      if (cmd() < .1) pressed.nova = 1;
      // le héros va vers un portail quand il y en a, pour traverser plusieurs salles
      if (etat.portals.length) { etat.P.x = etat.portals[0].x; etat.P.y = etat.portals[0].y; }
    }
    update(DT, st);
    const P = etat.P;
    for (const v of [P.x, P.y, P.hp, P.nova, P.aim, P.face, P.dashCh, game.kills, game.shards, game.dealt, game.roomsDone, etat.roomNum]) h.num(v);
    for (const list of [etat.enemies, etat.bullets, etat.projs, etat.picks]) {
      h.num(list.length);
      for (const e of list) { h.num(e.x); h.num(e.y); h.num(e.hp ?? 0); }
    }
    if (etat.room) h.str(etat.room.type);
  }
  for (const k in keys) keys[k] = false;
  return { hash: h.value, roomsDone: game.roomsDone, kills: game.kills, hp: etat.P.hp };
}

function compute() {
  const replays = [1, 2, 3, 4, 5].map(s => ({ seed: s, ...replay(s, 60 * 240) }));
  const bot = [];
  for (const guard of [false, true]) for (let s = 1; s <= 20; s++) bot.push({ seed: s, guard, ...playRun({ seed: s, guard }) });
  return { replays, bot };
}

describe('empreinte de la simulation', () => {
  const now = compute();
  if (process.env.EMPREINTE_ECRIRE) writeFileSync(FILE, `{\n "replays": [\n  ${now.replays.map(r => JSON.stringify(r)).join(',\n  ')}\n ],\n "bot": [\n  ${now.bot.map(r => JSON.stringify(r)).join(',\n  ')}\n ]\n}\n`);
  const ref = JSON.parse(readFileSync(FILE, 'utf8'));
  test('rejeu déterministe : même état, image pour image, sur 5 graines', () => {
    expect(now.replays).toEqual(ref.replays);
  });
  test('bot : mêmes résultats complets sur 20 graines libres et 20 gardées', () => {
    expect(now.bot).toEqual(ref.bot);
  });
  test('l\'empreinte de référence est substantielle', () => {
    expect(ref.bot).toHaveLength(40);
    expect(ref.replays.every(r => r.hash.length === 8)).toBe(true);
    expect(ref.bot.filter(r => r.guard && r.won)).toHaveLength(20);
  });
});
