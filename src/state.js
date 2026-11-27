// @ts-check
/** État mutable partagé (partie, héros, salle, entrées), et liaisons vers l'interface. */
import { H, W } from './config.js';

/** Entités du jeu : objets simples créés par les règles (héros, ennemis, projectiles, particules…).
 * Leurs champs varient selon le type ; on les laisse ouverts plutôt que de dupliquer la logique en types.
 * @typedef {Record<string, any>} Ent */

/** État mutable partagé (anciennes variables globales). */
export const etat = {
  scale: 1,
  dpr: 1,
  /** Statistiques du héros pour la plongée (dégâts, cadence, pouvoirs…). @type {Ent} */ S: /** @type {any} */ (undefined),
  /** Le héros. @type {Ent} */ P: /** @type {any} */ (undefined),
  /** Salle en cours (null sur l'écran titre). @type {any} */ room: null,
  /** @type {Ent[]} */ enemies: [],
  /** @type {Ent[]} */ bullets: [],
  /** @type {Ent[]} */ projs: [],
  /** @type {Ent[]} */ parts: [],
  /** @type {Ent[]} */ texts: [],
  /** @type {Ent[]} */ picks: [],
  /** @type {Ent[]} */ spawners: [],
  /** @type {Ent[]} */ fires: [],
  /** @type {Ent[]} */ slashes: [],
  /** @type {Ent[]} */ zones: [],
  /** @type {Ent[]} */ portals: [],
  /** @type {Ent[]} */ bolts: [],
  /** @type {Ent[]} */ lasers: [],
  stageIdx: 0,
  roomInStage: 0,
  roomNum: 0,
  /** Le boss quand il est là, sinon null. @type {any} */ boss: null,
  lastT: performance.now(),
  ovBack: 'oTitle',
};
/* =========================================================
   ENTRÉES : clavier, souris, manette, tactile
   ========================================================= */
/** @type {Record<string, boolean>} */
export const keys = {};
/** @type {Ent} */
export const IN = { mx: 0, my: 0, ax: 0, ay: 0, aim: null, atk: false, shot: false, dash: false, nova: false, mode: 'kb', mouse: { x: W / 2, y: H / 2, l: false, r: false, t: -9 } };
/** Appuis à traiter à la prochaine image. @type {Record<string, number>} */
export const pressed = {};
/** Commandes tactiles. @type {Ent} */
export const T = { joyId: null, ox: 0, oy: 0, x: 0, y: 0, atk: false, shot: false };
/* =========================================================
   ÉTAT
   ========================================================= */
/** @type {Ent} */
export const game = { state: 'title', t: 0, runT: 0, hitstop: 0, slow: 1, slowT: 0, shake: 0, flash: 0, flashCol: '#fff', banner: null, trans: null, kills: 0, shards: 0, dealt: 0, roomsDone: 0, taken: {}, endT: 0 };
/** Liaisons vers l'interface, branchées par ui.js (vides sous Node). */
export const fx = { /** @param {string|null} _id */ overlay(_id) {}, roomLoaded() {}, choice() {}, shop() {}, /** @param {boolean} _won */ end(_won) {} };
/* écran titre animé */
/** @type {{pts:Ent[]}} */
export const TITLE = { pts: [] };
