// Outils communs aux tests unitaires : on joue avec les vraies règles (src/), sans navigateur.
import { etat, game, fx, keys, pressed } from '../../src/sim/state.js';
import { newRun, openPortals, rollUps, takeUp } from '../../src/sim/rooms.js';
import { hitEnemy } from '../../src/sim/combat.js';
import { update } from '../../src/sim/update.js';
import { seed } from '../../src/sim/math.js';

export { etat, game, fx, keys, pressed };
export const DT = 1 / 60;

/** localStorage en mémoire. */
export function memStore(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m };
}

/** Branche l'interface comme le ferait ui.js : on prend la première carte, on quitte le marchand. */
export function wireUi(log = []) {
  Object.assign(fx, {
    overlay() {}, roomLoaded() {},
    choice() { const u = rollUps(3, etat.room.type === 'defi')[0]; if (u) { takeUp(u); log.push(u.id); } openPortals(); },
    shop() { openPortals(); },
    end(won) { log.push(won ? 'VICTOIRE' : 'DEFAITE'); game.ended = won; },
  });
  return log;
}

/** Nouvelle plongée à graine fixe. */
export function start(n = 1) { seed(n); for (const k in keys) keys[k] = false; newRun(); }

/** Avance de n images de jeu (sans manette). */
export function run(n) { for (let i = 0; i < n && game.state === 'play'; i++) update(DT, null); }

/** Plongée complète « assistée » : le héros est invulnérable et chaque ennemi présent prend un coup fatal,
 * mais tout le reste (vagues, salles, portails, transitions, boss et ses phases, récompenses) suit les vraies règles.
 * Renvoie le journal : types de salles traversées, pouvoirs pris, fin. */
export function assistedRun(seedN = 1, maxFrames = 60 * 60 * 20) {
  const log = wireUi([]);
  start(seedN);
  const rooms = [etat.room.type];
  let lastRoom = etat.room;
  for (let f = 0; f < maxFrames; f++) {
    if (game.ended !== undefined) break;
    etat.P.hp = etat.S.maxHp; etat.P.inv = 1;
    for (const e of etat.enemies) if (!e.dead && !(e.spawnT > 0)) hitEnemy(e, 5000, 0, 0, { quiet: true });
    if (etat.room.type === 'shop' && etat.room.obj && !etat.room.obj.used) { etat.P.x = etat.room.obj.x; etat.P.y = etat.room.obj.y + 40; }
    else if (etat.portals.length && !game.trans) {
      const p = etat.portals.find(q => q.type === 'combat') || etat.portals[0];
      etat.P.x = p.x; etat.P.y = p.y;
    }
    update(DT, null);
    if (etat.room !== lastRoom) { lastRoom = etat.room; rooms.push(etat.room.type); }
  }
  return { log, rooms };
}
