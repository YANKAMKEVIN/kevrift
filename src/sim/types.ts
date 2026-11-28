/** Types des entités de la simulation : ennemis, Archonte, projectiles, particules, salles…
 * Ce sont des objets simples (pas de classes) : la simulation les crée, le rendu les lit. */

/** Les sept ennemis ordinaires (et les petits cristaux nés d'un « splitter »). */
export type EnemyKind = 'mite' | 'spitter' | 'bomber' | 'splitter' | 'mini' | 'brute' | 'weaver' | 'sentinel';
export type RoomType = 'combat' | 'defi' | 'fountain' | 'shop' | 'boss';
/** Les attaques de l'Archonte. */
export type BossAtk = 'spiral' | 'fan' | 'charge' | 'ring' | 'lasers' | 'summon' | 'rain';

/** Ce que partagent tous les adversaires (ennemis et Archonte). */
interface FoeBase {
  x: number; y: number; vx: number; vy: number;
  /** Recul en cours. */ kx: number; ky: number;
  r: number; hp: number; maxHp: number; col: string; dmg: number;
  /** Clignotement quand il est touché. */ flash: number;
  /** Écrasement (rebond visuel) après un coup. */ sq: number;
  /** Ralenti par le givre (secondes restantes). */ slow: number;
  /** Apparition en cours (secondes) : intouchable tant que > 0. */ spawnT: number;
  t: number; a: number; dead: boolean;
  elite?: boolean;
  /** Délais propres aux dégâts répétés : lames orbitales, feu, évents. */
  orbCd?: number; burnCd?: number; ventCd?: number;
}
/** Un ennemi ordinaire. st = état de son comportement (move, aim, fuse, wind, charge, stun, fade, appear, fire). */
export interface Enemy extends FoeBase {
  type: EnemyKind;
  spd: number;
  st: string; stT: number; cd: number;
  /** Kamikaze déjà explosé (pas de seconde explosion à sa mort). */ exploded?: boolean;
  /** Sentinelle : délai entre deux salves. */ fT?: number;
}
/** L'Archonte Fracturé. */
export interface Boss extends FoeBase {
  type: 'boss';
  phase: number; atk: BossAtk | null; atkT: number; next: number; last: string;
  /** Invulnérable (secondes). */ invT: number;
  plates: number; intro: number; eye: number;
  /** Mise en scène de la mort : > 0 pendant, -1 une fois finie. */ deathT: number;
  /** Compteurs de l'attaque en cours. */ sub: number; fire: number;
  /** Charge : nombre restant, étape, durée, angle. */ cn: number; cst: 'wind' | 'go' | 'rest'; cstT: number; ca: number;
  /** Sens de rotation des lasers. */ ldir: number;
}
export type Foe = Enemy | Boss;

/** Tir ennemi. */
export interface Bullet { x: number; y: number; vx: number; vy: number; r: number; col: string; dmg: number; life: number; dead?: boolean }
/** Rune ou projectile renvoyé par le héros. */
export interface Proj { x: number; y: number; vx: number; vy: number; dmg: number; pierce: number; life: number; r: number; hit: Set<Foe>; refl?: number; dead?: boolean }

/** Particules (données seulement, dessinées par render/hero.ts). */
export interface Spark { k: 'spark' | 'shard'; x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; rot: number; vr: number; sz: number }
export interface RingFx { k: 'ring'; x: number; y: number; r0: number; r1: number; life: number; max: number; col: string; w: number }
export interface GlowFx { k: 'glow'; x: number; y: number; r: number; life: number; max: number; col: string }
export interface Ghost { k: 'ghost'; x: number; y: number; a: number; life: number; max: number }
/** Point lumineux (traînée de rune, flammèche) : vitesse facultative, sans rotation. */
export interface Dot { k: 'dot'; x: number; y: number; vx?: number; vy?: number; rot?: number; vr?: number; life: number; max: number; col: string; sz: number }
export type Particle = Spark | RingFx | GlowFx | Ghost | Dot;

/** Nombre flottant (dégâts, soins, annonces). */
export interface FloatText { x: number; y: number; s: string; col: string; t: number; big: boolean }
/** Éclat ou cœur à ramasser. */
export interface Pick { k: 'shard' | 'heal'; x: number; y: number; vx: number; vy: number; t: number; mag?: number; dead?: boolean }
/** Ennemi sur le point d'apparaître. */
export interface Spawner { x: number; y: number; type: EnemyKind; elite?: boolean; t: number; max: number; done?: boolean }
/** Traînée de feu (Sillage Ardent). */
export interface Fire { x: number; y: number; t: number; r: number }
/** Coup de lame en cours (step = rang dans le combo, 2 = coup lourd). */
export interface Slash { x: number; y: number; a: number; range: number; arc: number; t: number; dur: number; step: number }
/** Zone à retardement : rune de Nova (blesse les ennemis) ou éclat de l'Archonte (blesse le héros). */
export type Zone =
  | { k: 'rune'; x: number; y: number; t: number; r: number; dmg: number; done?: boolean }
  | { k: 'drop'; x: number; y: number; t: number; r: number; done?: boolean };
export interface Portal { x: number; y: number; type: RoomType; gate?: boolean; t: number }
/** Éclair en chaîne. */
export interface Bolt { x1: number; y1: number; x2: number; y2: number; life: number }
/** Laser tournant de l'Archonte (warn = préavis restant). */
export interface Laser { a: number; warn: number; life: number }
/** Évent de lave/cristal qui éclate en cycle. */
export interface Vent { x: number; y: number; t: number; r: number }
/** Rectangle de mur (b = mur d'enceinte). */
export interface Wall { x: number; y: number; w: number; h: number; b?: number }
/** Fontaine ou marchand au centre de la salle. */
export interface RoomObj { kind: 'fountain' | 'shop'; x: number; y: number; used: boolean; t?: number }
/** Un ennemi prévu dans une vague. */
export interface WaveSlot { type: EnemyKind; elite?: boolean }
/** Une salle. */
export interface Room {
  type: RoomType; z: number; waves: WaveSlot[][]; wave: number; waveT: number;
  cleared: boolean; clearT: number; walls: Wall[]; vents: Vent[]; obj: RoomObj | null; rewarded: boolean;
}
