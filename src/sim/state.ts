/** État mutable de la simulation (partie, héros, salle, commandes) et ports vers l'extérieur
 * (interface, son). Aucun accès au DOM : tout ce dossier tourne sous Node. */
import { H, W } from '../config.ts';

import type { Bolt, Boss, Bullet, Fire, FloatText, Foe, Laser, Particle, Pick, Portal, Proj, Room, RoomType, Slash, Spawner, Zone } from './types.ts';
export type * from './types.ts';

/** Statistiques de départ du héros pour une plongée. */
export function makeStats() {
  return { dmg: 12, atkSpd: 1, range: 64, shotDmg: 9, shotCd: .55, shots: 1, pierce: 0, homing: 0, dashCd: .85, dashMax: 1, crit: .05, life: 0, chain: 0, orbit: 0, explode: 0, thorns: 0, speed: 215, novaRate: 1, frost: 0, shield: 0, timeSlow: 0, lastBreath: 0, burn: 0, novaRunes: 0, reflect: 0, maxHp: 100 };
}
/** Le héros au début d'une plongée. */
export function makePlayer() {
  return { x: W / 2, y: 460, vx: 0, vy: 0, r: 11, hp: 100, face: -Math.PI / 2, aim: -Math.PI / 2, atkCd: 0, combo: 0, comboT: 0, shotCd: 0, dashCh: 1, dashRe: 0, dashT: 0, dx: 0, dy: 0, inv: 0, nova: 0, shieldT: 0, trailT: 0, hurtT: 0, orbA: 0, step: 0, dead: false, lunge: 0 };
}
export type Stats = ReturnType<typeof makeStats>;
export type Player = ReturnType<typeof makePlayer>;

/** État de la plongée en cours (salle, héros, entités). */
export interface Etat {
  /** Statistiques du héros. */ S: Stats;
  /** Le héros. */ P: Player;
  /** Salle en cours ; null sur l'écran titre seulement (le rendu le vérifie, la simulation ne tourne que pendant une plongée). */ room: Room;
  enemies: Foe[]; bullets: Bullet[]; projs: Proj[]; parts: Particle[]; texts: FloatText[]; picks: Pick[];
  spawners: Spawner[]; fires: Fire[]; slashes: Slash[]; zones: Zone[]; portals: Portal[]; bolts: Bolt[]; lasers: Laser[];
  stageIdx: number; roomInStage: number; roomNum: number;
  /** Le boss quand il est là, sinon null. */ boss: Boss | null;
}
export const etat: Etat = {
  S: makeStats(),
  P: makePlayer(),
  room: null as unknown as Room,
  enemies: [], bullets: [], projs: [], parts: [], texts: [], picks: [],
  spawners: [], fires: [], slashes: [], zones: [], portals: [], bolts: [], lasers: [],
  stageIdx: 0,
  roomInStage: 0,
  roomNum: 0,
  boss: null,
};
/* =========================================================
   COMMANDES : remplies par input.ts (ou par un bot), lues par la simulation
   ========================================================= */
/** Touches enfoncées, par KeyboardEvent.code. */
export const keys: Record<string, boolean> = {};
/** Souris et mode de commande. */
export type InputMode = 'kb' | 'mouse' | 'pad' | 'touch';
export const IN = { mode: 'kb' as InputMode, mouse: { x: W / 2, y: H / 2, l: false, r: false, t: -9 } };
/** Appuis à traiter à la prochaine image. */
export const pressed: Record<string, number> = {};
/** Commandes tactiles (joystick et boutons maintenus). */
export const T = { joyId: null as number | null, ox: 0, oy: 0, x: 0, y: 0, atk: false, shot: false };
/** État d'une manette pour une image (input.ts pollPad), ou null. */
export interface PadState { lx: number; ly: number; rx: number; ry: number; atk: boolean; shot: boolean }
/* =========================================================
   PARTIE
   ========================================================= */
export interface Banner { t: string; s: string; life: number; big?: boolean }
export interface Trans { t: number; type: RoomType; gate?: boolean; done: boolean }
export type GameState = 'title' | 'play' | 'pause' | 'choice' | 'over';
export const game = {
  state: 'title' as GameState,
  t: 0, runT: 0, hitstop: 0, slow: 1, slowT: 0, shake: 0, flash: 0, flashCol: '#fff',
  banner: null as Banner | null,
  trans: null as Trans | null,
  kills: 0, shards: 0, dealt: 0, roomsDone: 0,
  /** Pouvoirs pris : id -> niveau. */ taken: {} as Record<string, number>,
  /** Compte à rebours avant l'écran de fin (secondes, 0 = aucun). */ endT: 0,
  /** Issue annoncée quand endT arrive à zéro. */ endWon: false,
};
/** Liaisons vers l'interface, branchées par ui.ts (ou par un test / un bot ; vides sous Node). */
export interface UiPort { overlay: (id: string | null) => void; roomLoaded: () => void; choice: () => void; shop: () => void; end: (won: boolean) => void }
export const fx: UiPort = { overlay() {}, roomLoaded() {}, choice() {}, shop() {}, end() {} };
/** Bruitages demandés par la simulation, branchés par audio.ts. */
export const sfx: { play: (name: string, rate?: number) => void } = { play() {} };
/** Musique voulue par la simulation : strate (3 = boss) et intensité (0 calme, 1 combat, 2 boss). */
export const music = { zone: 0, target: 0 };
/** Annonce la fin de la plongée après une courte mise en scène (en temps de jeu, donc déterministe), delay en secondes. */
export function scheduleEnd(won: boolean, delay: number) { game.endT = delay; game.endWon = won; }
/** Retour à l'écran titre : plus de salle en cours (le rendu affiche alors le titre). */
export function leaveRun() { game.state = 'title'; etat.room = null as unknown as Room; music.target = 0; music.zone = 0; }
