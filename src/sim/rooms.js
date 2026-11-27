// @ts-check
/** Partie et salles : nouvelle partie, génération des salles, vagues, portails, progression, améliorations. Sans DOM. */
import { BORDER, EDEF, H, PLAN, RAR, ROMAN, W, ZONES } from '../config.js';
import { UPS } from './ups.js';
import { R, clamp, pick, rint, rnd } from './math.js';
import { etat, fx, game, makePlayer, makeStats, music, sfx } from './state.js';
import { banner, burst, ring, txt } from './effects.js';
import { heal } from './combat.js';
import { startBoss } from './boss.js';

export function newRun() {
  etat.S = makeStats();
  etat.P = makePlayer();
  Object.assign(game, { endT: 0, endWon: false, trans: null, banner: null, runT: 0, kills: 0, shards: 0, dealt: 0, roomsDone: 0, taken: {}, slow: 1, slowT: 0, hitstop: 0 });
  etat.stageIdx = 0; etat.roomInStage = 0; etat.roomNum = 0; etat.boss = null;
  loadRoom('combat');
  game.state = 'play';
  fx.overlay(null);
  banner('STRATE I', ZONES[0].name);
  music.zone = 0; music.target = 1;
}
function loadRoom(type) {
  const z = type === 'boss' ? 2 : PLAN[etat.stageIdx][0];
  etat.room = { type, z, waves: [], wave: -1, waveT: .9, cleared: false, clearT: 0, walls: [], vents: [], obj: null, rewarded: false };
  etat.enemies = []; etat.bullets = []; etat.projs = []; etat.parts = []; etat.texts = []; etat.picks = []; etat.spawners = []; etat.fires = []; etat.slashes = []; etat.zones = []; etat.portals = []; etat.bolts = []; etat.lasers = [];
  etat.boss = null;
  // murs d'enceinte
  etat.room.walls.push({ x: 0, y: 0, w: W, h: BORDER, b: 1 }, { x: 0, y: H - BORDER, w: W, h: BORDER, b: 1 }, { x: 0, y: 0, w: BORDER, h: H, b: 1 }, { x: W - BORDER, y: 0, w: BORDER, h: H, b: 1 });
  if (type === 'combat' || type === 'defi') {
    const pat = pick(['pillars', 'blocks', 'lanes', 'scatter', 'ring']);
    const quad = [];
    if (pat === 'pillars') { quad.push({ x: rint(170, 260), y: rint(175, 200), w: 44, h: 44 }); if (R.f() < .6) quad.push({ x: rint(330, 380), y: rint(215, 230), w: 36, h: 36 }); }
    if (pat === 'blocks') quad.push({ x: rint(150, 240), y: rint(175, 195), w: rint(90, 150), h: rint(30, 44) });
    if (pat === 'lanes') quad.push({ x: rint(120, 170), y: rint(190, 215), w: rint(180, 240), h: 26 });
    if (pat === 'scatter') for (let i = 0; i < rint(2, 3); i++) quad.push({ x: rint(110, 390), y: rint(175, 225), w: rint(26, 40), h: rint(26, 40) });
    if (pat === 'ring') { quad.push({ x: 330, y: 180, w: 110, h: 26 }); quad.push({ x: 330, y: 180, w: 26, h: 52 }); }
    for (const q of quad) {
      if (q.x + q.w > 440) q.w = 440 - q.x;
      etat.room.walls.push(q, { x: W - q.x - q.w, y: q.y, w: q.w, h: q.h }, { x: q.x, y: H - q.y - q.h, w: q.w, h: q.h }, { x: W - q.x - q.w, y: H - q.y - q.h, w: q.w, h: q.h });
    }
    if (z >= 1) {
      for (let i = 0; i < 2 + z; i++) { const p = freeSpot(40, 300); if (p && Math.hypot(p.x - W / 2, p.y - 460) > 120) etat.room.vents.push({ x: p.x, y: p.y, t: rnd(0, 3), r: 34 }); }
    }
    planWaves();
  } else if (type === 'boss') {
    etat.room.walls.push({ x: 150, y: 110, w: 40, h: 40 }, { x: W - 190, y: 110, w: 40, h: 40 }, { x: 150, y: H - 150, w: 40, h: 40 }, { x: W - 190, y: H - 150, w: 40, h: 40 });
    etat.room.waveT = 99;
  } else if (type === 'fountain') {
    etat.room.obj = { kind: 'fountain', x: W / 2, y: H / 2 - 20, used: false };
    etat.room.cleared = true; etat.room.rewarded = true; etat.room.clearT = 9;
  } else if (type === 'shop') {
    etat.room.obj = { kind: 'shop', x: W / 2, y: H / 2 - 30, used: false, t: 0 };
    etat.room.cleared = true; etat.room.rewarded = true; etat.room.clearT = 9;
  }
  etat.P.x = W / 2; etat.P.y = H - 70; etat.P.vx = etat.P.vy = 0; etat.P.inv = 1; etat.P.dashT = 0;
  fx.roomLoaded();
  if (type === 'fountain') openPortals();
  if (type === 'boss') startBoss();
}
export function rectHit(x, y, r, w) { const cx = clamp(x, w.x, w.x + w.w), cy = clamp(y, w.y, w.y + w.h); return (x - cx) ** 2 + (y - cy) ** 2 < r * r; }
export function solidAt(x, y, r) { for (const w of etat.room.walls) if (rectHit(x, y, r, w)) return true; return false; }
export function freeSpot(r, minD, tries = 60) {
  for (let i = 0; i < tries; i++) {
    const x = rnd(BORDER + r + 10, W - BORDER - r - 10), y = rnd(BORDER + r + 10, H - BORDER - r - 10);
    if (!solidAt(x, y, r) && Math.hypot(x - etat.P.x, y - etat.P.y) > minD) return { x, y };
  }
  return null;
}
export function planWaves() {
  const z = etat.room.z, def = etat.room.type === 'defi';
  let budget = 5 + etat.roomNum * 1.7; if (def) budget *= 1.2;
  /** @type {[string, number][]} */
  const pools = /** @type {any} */ ([
    [['mite', 5], ['spitter', 3], ['bomber', 2], ['splitter', etat.roomNum >= 1 ? 2 : 0]],
    [['mite', 3], ['spitter', 3], ['bomber', 3], ['brute', 3], ['sentinel', 2], ['splitter', 2], ['weaver', 1]],
    [['mite', 2], ['spitter', 2], ['bomber', 3], ['brute', 3], ['sentinel', 3], ['weaver', 3], ['splitter', 2]]
  ])[z];
  const tot = pools.reduce((a, b) => a + b[1], 0);
  const nW = def ? 3 : 2;
  for (let i = 0; i < nW; i++) {
    let b = budget * (.75 + .25 * i); const w = [];
    while (b > 0 && w.length < 14) {
      let k = rnd(tot), t = pools[0][0];
      for (const p of pools) { k -= p[1]; if (k <= 0) { t = p[0]; break; } }
      w.push({ type: t }); b -= EDEF[t].cost;
    }
    etat.room.waves.push(w);
  }
  if (def) etat.room.waves[nW - 1].push({ type: ['splitter', 'brute', 'weaver'][z], elite: true });
}
/* =========================================================
   PROGRESSION ENTRE LES SALLES
   ========================================================= */
export function roomCleared() {
  etat.room.cleared = true; etat.room.clearT = 0;
  sfx.play('clear'); music.target = 0;
  txt(W / 2, H / 2 - 40, 'SALLE PURIFIÉE', ZONES[etat.room.z].acc, true);
  for (const p of etat.picks) p.mag = 1;
  game.roomsDone++;
}
function nextRoomInfo() {
  // retourne ce qui vient après la salle actuelle
  const lastInStage = etat.roomInStage >= PLAN[etat.stageIdx][1] - 1;
  if (lastInStage && etat.stageIdx === 2) return 'boss';
  if (etat.roomInStage === PLAN[etat.stageIdx][1] - 2 && etat.stageIdx < 2) return 'gate'; // la dernière salle de la strate est un défi gardien
  return 'choice';
}
export function openPortals() {
  const nx = nextRoomInfo();
  if (nx === 'boss') etat.portals.push({ x: W / 2, y: 110, type: 'boss', t: 0 });
  else if (nx === 'gate') etat.portals.push({ x: W / 2, y: 110, type: 'defi', gate: true, t: 0 });
  else {
    const other = pick(game.shards >= 25 ? ['defi', 'fountain', 'shop', 'shop', 'defi'] : ['defi', 'fountain', 'defi']);
    const order = R.f() < .5 ? ['combat', other] : [other, 'combat'];
    etat.portals.push({ x: W / 2 - 170, y: 110, type: order[0], t: 0 }, { x: W / 2 + 170, y: 110, type: order[1], t: 0 });
  }
  sfx.play('portal');
}
export function enterPortal(p) {
  sfx.play('portal');
  game.trans = { t: 0, type: p.type, gate: p.gate, done: false };
}
export function advance(type) {
  const wasStage = etat.stageIdx;
  etat.roomInStage++; etat.roomNum++;
  if (etat.roomInStage >= PLAN[etat.stageIdx][1] && etat.stageIdx < 2) { etat.stageIdx++; etat.roomInStage = 0; }
  if (type === 'boss') { loadRoom('boss'); return; }
  loadRoom(type);
  if (etat.stageIdx !== wasStage) {
    banner('STRATE ' + ROMAN[etat.stageIdx], ZONES[etat.stageIdx].name); music.zone = etat.stageIdx; heal(30);
  } else if (type === 'defi' && game.trans && game.trans.gate) banner('GARDIEN', 'Un champion garde le passage');
  music.target = etat.room.cleared ? 0 : 1;
}
/* --- cartes d'amélioration --- */
export function rollUps(n, boost) {
  const pool = UPS.filter(u => (game.taken[u.id] || 0) < u.max);
  const out = [];
  const wts = boost ? [30, 55, 15] : [68, 27, 5];
  while (out.length < n && pool.length) {
    const tot = pool.reduce((a, u) => a + wts[u.r], 0); let k = rnd(tot), idx = 0;
    for (let i = 0; i < pool.length; i++) { k -= wts[pool[i].r]; if (k <= 0) { idx = i; break; } }
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}
export function takeUp(u) {
  game.taken[u.id] = (game.taken[u.id] || 0) + 1; u.f();
  sfx.play('up'); burst(etat.P.x, etat.P.y, RAR[u.r].c, 30, 300, .6, 'shard'); ring(etat.P.x, etat.P.y, RAR[u.r].c, 10, 80, .4, 5);
}
