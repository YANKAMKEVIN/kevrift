// @ts-check
/**
 * Bot de parcours complet : joue une plongée entière sur la simulation, sans navigateur,
 * avec les mêmes commandes qu'un joueur (touches, appuis, visée automatique).
 * Il ne triche pas : il esquive les tirs, frappe au contact, tire à distance, déclenche la Nova,
 * choisit ses pouvoirs, achète chez le marchand et entre dans les portails.
 * Le mode « gardé » (guard) remet seulement ses points de vie au maximum à chaque image :
 * toute la plongée, boss compris, est alors gagnée par de vrais coups.
 * Utilisé par les tests (tests/unit/bot.test.mjs) et par `npm run bot`.
 */
import { BORDER, H, W } from '../config.js';
import { clamp, mulberry32, seed } from './math.js';
import { IN, T, etat, fx, game, keys, pressed } from './state.js';
import { newRun, openPortals, rollUps, takeUp } from './rooms.js';
import { heal } from './combat.js';
import { update } from './update.js';
import { UPS } from './ups.js';
/** @typedef {import('./state.js').Ent} Ent */
/** @typedef {import('./ups.js').Up} Up */

/** Pas de temps du bot : 60 images par seconde. */
export const BOT_DT = 1 / 60;
/** Ordre de préférence des pouvoirs (les autres viennent ensuite, par rareté). */
const PREF = ['coeur', 'vampire', 'lame', 'frenesie', 'orbite', 'souffle', 'bouclier', 'eclair', 'echo', 'crit', 'portee', 'double', 'temps', 'givre', 'surcharge', 'epines', 'vitesse'];
/** @param {Up} u */
const upScore = u => { const i = PREF.indexOf(u.id); return (i < 0 ? 100 : i) - u.r * 3; };

/**
 * @typedef {object} BotResult
 * @property {boolean} won victoire (l'Archonte est vaincu)
 * @property {boolean} ended la plongée est arrivée à un écran de fin
 * @property {number} frames images jouées
 * @property {number} rooms salles purifiées
 * @property {string[]} path types des salles traversées
 * @property {number} stage strate atteinte (0 à 2)
 * @property {number} kills ennemis vaincus
 * @property {number} hits coups reçus
 * @property {number} bossHp points de vie restants du boss (-1 s'il n'a pas été atteint)
 * @property {Record<string, number>} taken pouvoirs pris
 * @property {string[]} errors invariants violés (doit rester vide)
 */

/**
 * Joue une plongée complète.
 * @param {{seed?: number, guard?: boolean, maxFrames?: number}} [opts]
 * @returns {BotResult}
 */
export function playRun(opts = {}) {
  const { guard = false, maxFrames = 60 * 60 * 25 } = opts;
  const s = opts.seed ?? 1;
  const brain = mulberry32(s ^ 0x5eed);
  /** @type {string[]} */ const errors = [];
  let ended = false, won = false, hits = 0;
  Object.assign(fx, {
    overlay() {}, roomLoaded() {},
    choice() {
      const ups = rollUps(3, etat.room.type === 'defi');
      if (ups.length) takeUp(ups.slice().sort((a, b) => upScore(a) - upScore(b))[0]);
      game.state = 'play'; openPortals();
    },
    shop() {
      const ups = rollUps(3, true), price = [40, 70, 110];
      if (etat.P.hp < etat.S.maxHp * .6 && game.shards >= 30) { game.shards -= 30; heal(40); }
      for (const u of ups.sort((a, b) => upScore(a) - upScore(b))) if (game.shards >= price[u.r]) { game.shards -= price[u.r]; takeUp(u); }
      game.state = 'play'; openPortals();
    },
    /** @param {boolean} w */
    end(w) { ended = true; won = w; game.state = 'over'; },
  });
  seed(s);
  clearInputs();
  newRun();
  const path = [etat.room.type];
  let room = etat.room, lastHp = etat.P.hp, stuckT = 0, lastX = etat.P.x, lastY = etat.P.y, jig = 0, frames = 0;
  for (; frames < maxFrames && !ended; frames++) {
    if (guard) etat.P.hp = etat.S.maxHp;
    // une image de commandes, puis une image de simulation
    const want = think(brain, jig);
    // coincé contre un mur : on part sur le côté un moment
    const moved = Math.hypot(etat.P.x - lastX, etat.P.y - lastY);
    lastX = etat.P.x; lastY = etat.P.y;
    if (want && moved < .4) stuckT += BOT_DT; else stuckT = Math.max(0, stuckT - BOT_DT);
    if (stuckT > .5) { jig = brain() < .5 ? 1 : -1; stuckT = -.6; }
    if (stuckT >= 0 && jig && brain() < .01) jig = 0;
    update(BOT_DT, null);
    if (etat.P.hp < lastHp) hits++;
    lastHp = etat.P.hp;
    if (etat.room !== room) { room = etat.room; path.push(room.type); }
    checkInvariants(errors, frames);
    if (errors.length > 20) break;
  }
  clearInputs();
  return {
    won, ended, frames, rooms: game.roomsDone, path, stage: etat.stageIdx, kills: game.kills, hits,
    bossHp: etat.boss ? Math.max(0, Math.round(etat.boss.hp)) : -1, taken: { ...game.taken }, errors,
  };
}

function clearInputs() {
  for (const k in keys) keys[k] = false;
  pressed.dash = pressed.nova = 0;
  IN.mode = 'kb'; IN.mouse.l = IN.mouse.r = false;
  T.x = T.y = 0; T.atk = T.shot = false;
}

/**
 * Décide des commandes pour l'image : renvoie true si le bot veut se déplacer.
 * @param {() => number} brain hasard propre au bot (ne touche pas celui de la simulation)
 * @param {number} jig décalage latéral quand il est coincé (-1, 0, 1)
 */
function think(brain, jig) {
  const P = etat.P, S = etat.S, room = etat.room;
  keys.KeyJ = keys.KeyK = false; T.x = T.y = 0;
  if (P.dead || game.trans) return false;
  let gx = 0, gy = 0; // direction voulue

  // 1. une destination : portail, fontaine, marchand, ramassables, ou l'ennemi visé
  /** @type {Ent|null} */ let goal = null;
  const target = nearestEnemy();
  if (etat.portals.length) {
    const low = P.hp < S.maxHp * .5;
    const rank = /** @param {Ent} p */ p => p.type === 'fountain' ? (low ? 0 : 3) : p.type === 'combat' ? 1 : p.type === 'shop' ? 2 : p.type === 'defi' ? (low ? 4 : 2.5) : 0;
    goal = etat.portals.slice().sort((a, b) => rank(a) - rank(b))[0];
  } else if (room.obj && !room.obj.used) goal = room.obj;
  else if (!target && etat.picks.length) goal = etat.picks[0];

  if (goal && !target) {
    const dx = goal.x - P.x, dy = goal.y - P.y, d = Math.hypot(dx, dy) || 1;
    gx = dx / d; gy = dy / d;
  } else if (target) {
    // se placer à portée de lame, sans entrer au contact
    const dx = target.x - P.x, dy = target.y - P.y, d = Math.hypot(dx, dy) || 1;
    const ideal = target.r + Math.min(44, S.range * .7);
    const want = target.type === 'boss' ? target.r + 70 : ideal;
    const k = clamp((d - want) / 40, -1, 1);
    gx = dx / d * k; gy = dy / d * k;
    // tourner autour de la cible pour ne pas rester dans son axe de tir
    const side = Math.sin(game.t * .7 + (target.a || 0)) > 0 ? 1 : -1;
    gx += -dy / d * .35 * side; gy += dx / d * .35 * side;
    if (d - target.r <= S.range * .95) keys.KeyJ = true;
    else if (d < 430) keys.KeyK = true;
  }

  // 2. menaces : tirs, kamikazes, charges, évents, lasers, contact
  let rx = 0, ry = 0, danger = 0;
  for (const b of etat.bullets) {
    const dx = P.x - b.x, dy = P.y - b.y, v2 = b.vx * b.vx + b.vy * b.vy || 1;
    const t = clamp((dx * b.vx + dy * b.vy) / v2, 0, .7);
    const cx = b.x + b.vx * t - P.x, cy = b.y + b.vy * t - P.y, cd = Math.hypot(cx, cy);
    const reach = b.r + P.r + 10;
    if (cd < reach) {
      const w = (reach - cd) / reach / (t + .15);
      const nx = cd > .01 ? -cx / cd : -b.vy / Math.sqrt(v2), ny = cd > .01 ? -cy / cd : b.vx / Math.sqrt(v2);
      rx += nx * w; ry += ny * w;
      if (t < .12) danger++;
    }
  }
  for (const e of etat.enemies) {
    if (e.dead || e.spawnT > 0) continue;
    const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
    const close = e.r + P.r + (e.type === 'boss' ? 40 : 14);
    if (d < close) { rx += dx / d * 2; ry += dy / d * 2; }
    if (e.type === 'bomber' && e.st === 'fuse' && d < 120) { rx += dx / d * 3; ry += dy / d * 3; danger++; }
    if (e.type === 'brute' && (e.st === 'wind' || e.st === 'charge')) {
      // s'écarter de l'axe de charge
      const ax = Math.cos(e.a), ay = Math.sin(e.a), along = -dx * ax - dy * ay, off = dx * -ay + dy * ax;
      if (along < -10 && Math.abs(off) < e.r + 40) { const sgn = off >= 0 ? 1 : -1; rx += -ay * sgn * 3; ry += ax * sgn * 3; if (e.st === 'charge') danger++; }
    }
    if (e.type === 'boss' && e.atk === 'charge') { rx += dx / d * 1.5; ry += dy / d * 1.5; }
  }
  for (const v of room.vents) {
    const c = v.t % 3.2, dx = P.x - v.x, dy = P.y - v.y, d = Math.hypot(dx, dy) || 1;
    if (c > 2.0 && c < 3.05 && d < v.r + P.r + 16) { rx += dx / d * 3; ry += dy / d * 3; }
  }
  if (etat.boss) for (const l of etat.lasers) {
    const ax = Math.cos(l.a), ay = Math.sin(l.a), dx = P.x - etat.boss.x, dy = P.y - etat.boss.y;
    const along = dx * ax + dy * ay, off = -dx * ay + dy * ax;
    if (along > 0 && Math.abs(off) < 60) { const sgn = off >= 0 ? 1 : -1; rx += -ay * sgn * 2.5; ry += ax * sgn * 2.5; if (l.warn <= 0 && Math.abs(off) < 30) danger++; }
  }
  for (const z of etat.zones) if (z.k === 'drop') {
    const dx = P.x - z.x, dy = P.y - z.y, d = Math.hypot(dx, dy) || 1;
    if (d < z.r + P.r + 6) { rx += dx / d * 3; ry += dy / d * 3; }
  }
  // garder ses distances avec les bords de l'arène
  const m = BORDER + 30;
  if (P.x < m) rx += 1; if (P.x > W - m) rx -= 1; if (P.y < m) ry += 1; if (P.y > H - m) ry -= 1;

  const rl = Math.hypot(rx, ry);
  if (rl > .05) { gx = gx * .35 + rx / rl * Math.min(2, rl); gy = gy * .35 + ry / rl * Math.min(2, rl); }
  if (jig) { const l = Math.hypot(gx, gy) || 1; const px = -gy / l * jig, py = gx / l * jig; gx = gx * .3 + px; gy = gy * .3 + py; }

  // 3. réflexes : esquive au dernier moment, Nova quand ça chauffe
  if (danger && P.dashCh > 0 && brain() < .9) pressed.dash = 1;
  const near = etat.enemies.filter(e => !e.dead && e.spawnT <= 0 && Math.hypot(e.x - P.x, e.y - P.y) < 260).length;
  if (P.nova >= 100 && (near >= 3 || etat.bullets.length > 12 || (etat.boss && !etat.boss.dead && etat.boss.intro <= 0))) pressed.nova = 1;

  // déplacement analogique, comme le joystick tactile
  const gl = Math.hypot(gx, gy);
  if (gl < .15) { T.x = T.y = 0; return false; }
  const k = Math.min(1, gl) / gl;
  T.x = gx * k; T.y = gy * k;
  return true;
}

/** L'ennemi le plus proche, ou null. @returns {Ent|null} */
function nearestEnemy() {
  let best = null, bd = 1e9;
  for (const e of etat.enemies) {
    if (e.dead || e.spawnT > 0 || (e.type === 'boss' && e.deathT)) continue;
    const d = Math.hypot(e.x - etat.P.x, e.y - etat.P.y) - e.r;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

/**
 * Règles qui doivent tenir à chaque image, quelle que soit la partie.
 * @param {string[]} errors @param {number} frame
 */
export function checkInvariants(errors, frame) {
  const P = etat.P, S = etat.S;
  /** @param {string} m */
  const err = m => errors.push(`image ${frame} : ${m}`);
  if (!Number.isFinite(P.x) || !Number.isFinite(P.y)) err('position du héros invalide');
  if (P.x < BORDER - 1 || P.x > W - BORDER + 1 || P.y < BORDER - 1 || P.y > H - BORDER + 1) err(`héros hors de l'arène (${P.x.toFixed(1)}, ${P.y.toFixed(1)})`);
  if (P.hp > S.maxHp + 1e-9) err(`PV au-dessus du maximum (${P.hp} / ${S.maxHp})`);
  if (P.hp < 0) err('PV négatifs');
  if (P.nova < 0 || P.nova > 100) err(`jauge de Nova hors bornes (${P.nova})`);
  if (P.dashCh < 0 || P.dashCh > S.dashMax) err(`charges d'esquive hors bornes (${P.dashCh} / ${S.dashMax})`);
  if (game.shards < 0) err('éclats négatifs');
  for (const e of etat.enemies) if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || Number.isNaN(e.hp)) { err(`ennemi ${e.type} invalide`); break; }
  for (const u of UPS) if ((game.taken[u.id] || 0) > u.max) err(`pouvoir ${u.id} au-delà de son maximum`);
  if (etat.parts.length > 2000) err(`trop de particules (${etat.parts.length})`);
  if (etat.bullets.length > 600) err(`trop de projectiles (${etat.bullets.length})`);
}
