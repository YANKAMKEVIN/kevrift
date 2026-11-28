// @ts-check
/** Constantes et données : dimensions, strates, plan d'une partie, raretés, améliorations, ennemis, boss. */

/* =========================================================
   KEVRIFT : roguelike d'action. Tout est généré : image, son, salles.
   ========================================================= */
/** Version du jeu, affichée sur l'écran titre (garder égale à package.json). */
export const VERSION = '1.1.0';
export const W = 960, H = 540;
export const TAU = Math.PI * 2;
/* =========================================================
   DONNÉES DU JEU
   ========================================================= */
export const ZONES = [
  { name: 'JARDINS DE VERRE', bg: '#051419', floor: '#0e3640', acc: '#3ff3e0', wall: '#0f3c46', wallTop: '#1e6d78', haz: '#3ff3e0' },
  { name: 'FORGES POURPRES', bg: '#14060f', floor: '#3a1230', acc: '#ff5aa0', wall: '#40122f', wallTop: '#7b2453', haz: '#ff8a3d' },
  { name: 'CŒUR DU NÉANT', bg: '#0a0617', floor: '#261a4d', acc: '#ffd45a', wall: '#251a52', wallTop: '#4b3a92', haz: '#c77dff' }
];
export const ROMAN = ['I', 'II', 'III'];
export const PLAN = [[0, 4], [1, 4], [2, 3]];
// [strate, nombre de salles avant la suite]
export const RAR = [{ n: 'COMMUN', c: '#8fe9ff' }, { n: 'RARE', c: '#c77dff' }, { n: 'LÉGENDAIRE', c: '#ffd45a' }];
export const ICONS = {
  blade: '<path d="M4 20 L16 5 L20 4 L19 8 L4 20 Z M3 15 L9 21" />',
  rune: '<circle cx="12" cy="12" r="9"/><path d="M12 5 L17 12 L12 19 L7 12 Z"/>',
  dash: '<path d="M2 12h10M5 7h8M5 17h8M14 5l7 7-7 7"/>',
  heart: '<path d="M12 21 L3 10 L7 4 L12 8 L17 4 L21 10 Z M12 8 L12 21"/>',
  orb: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9" stroke-dasharray="4 3"/><path d="M19 5 L21 3"/>',
  bolt: '<path d="M13 2 L4 14 H11 L10 22 L20 9 H13 Z"/>',
  star: '<path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z"/>',
  nova: '<circle cx="12" cy="12" r="2.5"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="10" stroke-dasharray="2 2.5"/>',
  heal: '<path d="M12 3 V21 M3 12 H21"/><circle cx="12" cy="12" r="10"/>'
};
// statistiques et héros
/** @typedef {{hp:number,r:number,spd:number,col:string,cost:number,dmg:number,shards:number}} EnemyDef */
/** @type {Record<string, EnemyDef>} */
export const EDEF = {
  mite: { hp: 20, r: 9, spd: 150, col: '#ff4d6d', cost: 1, dmg: 10, shards: 1 },
  spitter: { hp: 30, r: 12, spd: 75, col: '#ffa63d', cost: 2, dmg: 10, shards: 2 },
  bomber: { hp: 16, r: 10, spd: 165, col: '#ffd23d', cost: 1.5, dmg: 10, shards: 1 },
  splitter: { hp: 50, r: 16, spd: 80, col: '#5dff9a', cost: 2.5, dmg: 12, shards: 2 },
  mini: { hp: 18, r: 9, spd: 130, col: '#5dff9a', cost: 0, dmg: 8, shards: 1 },
  brute: { hp: 110, r: 20, spd: 55, col: '#ff3b3b', cost: 4, dmg: 22, shards: 4 },
  weaver: { hp: 55, r: 13, spd: 60, col: '#c77dff', cost: 3.5, dmg: 10, shards: 3 },
  sentinel: { hp: 80, r: 15, spd: 20, col: '#ff6bd6', cost: 3, dmg: 10, shards: 3 }
};
/* =========================================================
   GÉNÉRATION DES SALLES
   ========================================================= */
export const BORDER = 34;
/* =========================================================
   BOSS : L'ARCHONTE FRACTURÉ
   ========================================================= */
export const BOSS_HP = 11000;
/** @type {Record<string, {n:string,s:string,c:string}>} */
export const PORTAL = {
  combat: { n: 'COMBAT', s: 'Une amélioration', c: '#3ff3e0' },
  defi: { n: 'DÉFI', s: 'Plus dur, meilleure récompense', c: '#c77dff' },
  fountain: { n: 'FONTAINE', s: 'Soigne 45 PV', c: '#6dffb0' },
  shop: { n: 'MARCHAND', s: 'Dépense tes éclats', c: '#ffd45a' },
  boss: { n: 'L\'ARCHONTE', s: 'Le fond de la Faille', c: '#ff4d6d' }
};
