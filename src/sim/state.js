// @ts-check
/** État mutable de la simulation (partie, héros, salle, commandes) et ports vers l'extérieur
 * (interface, son). Aucun accès au DOM : tout ce dossier tourne sous Node. */
import { H, W } from '../config.js';

/** Entités du jeu : objets simples créés par les règles (ennemis, projectiles, particules…).
 * Leurs champs varient selon le type ; on les laisse ouverts plutôt que de dupliquer la logique en types.
 * @typedef {Record<string, any>} Ent */
/** Rectangle de mur (b = mur d'enceinte). @typedef {{x:number,y:number,w:number,h:number,b?:number}} Wall */
/** @typedef {'combat'|'defi'|'fountain'|'shop'|'boss'} RoomType */
/** Une salle. @typedef {{type:RoomType,z:number,waves:{type:string,elite?:boolean}[][],wave:number,waveT:number,cleared:boolean,clearT:number,walls:Wall[],vents:Ent[],obj:Ent|null,rewarded:boolean}} Room */

/** Statistiques de départ du héros pour une plongée. */
export function makeStats() {
  return { dmg: 12, atkSpd: 1, range: 64, shotDmg: 9, shotCd: .55, shots: 1, pierce: 0, homing: 0, dashCd: .85, dashMax: 1, crit: .05, life: 0, chain: 0, orbit: 0, explode: 0, thorns: 0, speed: 215, novaRate: 1, frost: 0, shield: 0, timeSlow: 0, lastBreath: 0, burn: 0, novaRunes: 0, reflect: 0, maxHp: 100 };
}
/** Le héros au début d'une plongée. */
export function makePlayer() {
  return { x: W / 2, y: 460, vx: 0, vy: 0, r: 11, hp: 100, face: -Math.PI / 2, aim: -Math.PI / 2, atkCd: 0, combo: 0, comboT: 0, shotCd: 0, dashCh: 1, dashRe: 0, dashT: 0, dx: 0, dy: 0, inv: 0, nova: 0, shieldT: 0, trailT: 0, hurtT: 0, orbA: 0, step: 0, dead: false, lunge: 0 };
}
/** @typedef {ReturnType<typeof makeStats>} Stats */
/** @typedef {ReturnType<typeof makePlayer>} Player */

/** État de la plongée en cours (salle, héros, entités). */
export const etat = {
  /** Statistiques du héros. @type {Stats} */ S: makeStats(),
  /** Le héros. @type {Player} */ P: makePlayer(),
  /** Salle en cours ; null sur l'écran titre (le rendu le vérifie, la simulation ne tourne que pendant une plongée). @type {Room} */ room: /** @type {any} */ (null),
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
  /** Le boss quand il est là, sinon null. @type {Ent|null} */ boss: null,
};
/* =========================================================
   COMMANDES : remplies par input.js (ou par un bot), lues par la simulation
   ========================================================= */
/** Touches enfoncées, par KeyboardEvent.code. @type {Record<string, boolean>} */
export const keys = {};
/** Souris et mode de commande. */
export const IN = { mode: /** @type {'kb'|'mouse'|'pad'|'touch'} */ ('kb'), mouse: { x: W / 2, y: H / 2, l: false, r: false, t: -9 } };
/** Appuis à traiter à la prochaine image. @type {Record<string, number>} */
export const pressed = {};
/** Commandes tactiles (joystick et boutons maintenus). */
export const T = { joyId: /** @type {number|null} */ (null), ox: 0, oy: 0, x: 0, y: 0, atk: false, shot: false };
/** État d'une manette pour une image (input.js pollPad), ou null.
 * @typedef {{lx:number,ly:number,rx:number,ry:number,atk:boolean,shot:boolean}} PadState */
/* =========================================================
   PARTIE
   ========================================================= */
/** @typedef {{t:string,s:string,life:number,big?:boolean}} Banner */
/** @typedef {{t:number,type:RoomType,gate?:boolean,done:boolean}} Trans */
export const game = {
  /** @type {'title'|'play'|'pause'|'choice'|'over'} */ state: 'title',
  t: 0, runT: 0, hitstop: 0, slow: 1, slowT: 0, shake: 0, flash: 0, flashCol: '#fff',
  /** @type {Banner|null} */ banner: null,
  /** @type {Trans|null} */ trans: null,
  kills: 0, shards: 0, dealt: 0, roomsDone: 0,
  /** Pouvoirs pris : id -> niveau. @type {Record<string, number>} */ taken: {},
  /** Compte à rebours avant l'écran de fin (secondes, 0 = aucun). */ endT: 0,
  /** Issue annoncée quand endT arrive à zéro. */ endWon: false,
};
/** Liaisons vers l'interface, branchées par ui.js (ou par un test / un bot ; vides sous Node). */
/** @type {{overlay: (id: string|null) => void, roomLoaded: () => void, choice: () => void, shop: () => void, end: (won: boolean) => void}} */
export const fx = { overlay() {}, roomLoaded() {}, choice() {}, shop() {}, end() {} };
/** Bruitages demandés par la simulation, branchés par audio.js.
 * @type {{play: (name: string, rate?: number) => void}} */
export const sfx = { play() {} };
/** Musique voulue par la simulation : strate (3 = boss) et intensité (0 calme, 1 combat, 2 boss). */
export const music = { zone: 0, target: 0 };
/** Annonce la fin de la plongée après une courte mise en scène (en temps de jeu, donc déterministe).
 * @param {boolean} won @param {number} delay secondes */
export function scheduleEnd(won, delay) { game.endT = delay; game.endWon = won; }
/** Retour à l'écran titre : plus de salle en cours (le rendu affiche alors le titre). */
export function leaveRun() { game.state = 'title'; etat.room = /** @type {any} */ (null); music.target = 0; music.zone = 0; }
