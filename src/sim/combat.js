// @ts-check
/** Combat : coups et tirs du héros, dégâts, ennemis et leur comportement. Sans DOM. */
import { BORDER, EDEF, H, TAU, W } from '../config.js';
import { R, angDiff, clamp, lerp, rnd } from './math.js';
import { IN, etat, game, music, scheduleEnd, sfx } from './state.js';
import { freeSpot, rectHit, solidAt } from './rooms.js';
import { banner, burst, flare, flash, ring, shake, stop, txt } from './effects.js';
/** @typedef {import('./state.js').Ent} Ent */
/** @typedef {import('./state.js').PadState} PadState */

/* =========================================================
   COMBAT DU HÉROS
   ========================================================= */
/** Soigne le héros sans dépasser son maximum. @param {number} n */
export function heal(n) {
  const before = etat.P.hp; etat.P.hp = Math.min(etat.S.maxHp, etat.P.hp + n);
  if (etat.P.hp > before) { txt(etat.P.x, etat.P.y - 20, '+' + Math.round(etat.P.hp - before), '#6dffb0'); }
}
/** Blesse le héros (sauf invulnérable, en esquive ou protégé). Renvoie true si le coup porte.
 * @param {number} dmg @param {number} sx @param {number} sy source du coup (pour le recul) @returns {boolean} */
export function hurtPlayer(dmg, sx, sy) {
  if (etat.P.inv > 0 || etat.P.dashT > 0 || etat.P.dead || game.state !== 'play') return false;
  if (etat.S.shield && etat.P.shieldT <= 0) {
    etat.P.shieldT = 10; etat.P.inv = .6; sfx.play('shield'); ring(etat.P.x, etat.P.y, '#8fe9ff', 10, 60, .4, 5); burst(etat.P.x, etat.P.y, '#8fe9ff', 16, 250, .4, 'shard'); txt(etat.P.x, etat.P.y - 24, 'BLOQUÉ', '#8fe9ff');
    return false;
  }
  etat.P.hp -= dmg; etat.P.inv = .9; etat.P.hurtT = .3;
  const a = Math.atan2(etat.P.y - sy, etat.P.x - sx); etat.P.vx += Math.cos(a) * 320; etat.P.vy += Math.sin(a) * 320;
  sfx.play('hurt'); shake(12); stop(.09); flash('#ff2d55', .45);
  burst(etat.P.x, etat.P.y, '#ff4d6d', 18, 300, .5);
  txt(etat.P.x, etat.P.y - 20, '-' + dmg, '#ff5a7a', true);
  if (etat.S.thorns) { ring(etat.P.x, etat.P.y, '#8fe9ff', 10, 110, .35, 6); for (const e of etat.enemies) if (Math.hypot(e.x - etat.P.x, e.y - etat.P.y) < 110 + e.r) hitEnemy(e, etat.S.thorns, e.x - etat.P.x, e.y - etat.P.y, { nochain: 1 }); }
  if (etat.P.hp <= 0) {
    if (etat.S.lastBreath) {
      etat.S.lastBreath = 0; etat.P.hp = 50; etat.P.inv = 2; banner('DERNIER SOUFFLE', 'La Faille refuse de te prendre'); doNova(true); return true;
    }
    etat.P.hp = 0; die();
  }
  return true;
}
function die() {
  etat.P.dead = true; game.slow = .25; game.slowT = 1.6; music.target = 0;
  burst(etat.P.x, etat.P.y, '#ffffff', 40, 400, 1, 'shard'); ring(etat.P.x, etat.P.y, '#ff4d6d', 10, 260, .9, 8); shake(20);
  scheduleEnd(false, 1.5);
}
/** @param {number} base */
function critRoll(base) { const c = R.f() < etat.S.crit; return { v: Math.round(base * (c ? 2.2 : 1) * rnd(.92, 1.08)), c }; }
/** Options d'un coup porté. @typedef {{kb?:number,nova?:number,nochain?:number|boolean,quiet?:number|boolean,fixed?:number|boolean}} HitOpts */
/** Frappe un ennemi : dégâts (critique possible), recul, nova, éclair en chaîne, mort.
 * @param {Ent} e @param {number} dmg @param {number} kx @param {number} ky direction du recul @param {HitOpts} [o] */
export function hitEnemy(e, dmg, kx, ky, o = {}) {
  if (e.dead || e.spawnT > 0) return;
  if (e.type === 'boss' && e.invT > 0) { if (!o.quiet) burst(e.x + rnd(-20, 20), e.y + rnd(-20, 20), '#ffffff', 3, 120, .2); return; }
  let v = dmg, c = false;
  if (!o.fixed) { const cr = critRoll(dmg); v = cr.v; c = cr.c; }
  e.hp -= v; game.dealt += v; e.flash = .1;
  const kl = Math.hypot(kx, ky) || 1, kb = (o.kb || 160) * (e.type === 'brute' || e.type === 'boss' ? .2 : e.elite ? .4 : 1);
  e.kx += kx / kl * kb; e.ky += ky / kl * kb;
  e.sq = .25;
  if (etat.S.frost && !o.nochain) e.slow = 2;
  txt(e.x, e.y - e.r - 6, v + (c ? '!' : ''), c ? '#ffd45a' : '#ffffff', c);
  if (!o.quiet) { burst(e.x, e.y, c ? '#ffd45a' : e.col, c ? 10 : 6, 220, .3); sfx.play(c ? 'crit' : 'hit', rnd(.9, 1.15)); }
  etat.P.nova = Math.min(100, etat.P.nova + (o.nova === undefined ? 2.4 : o.nova) * etat.S.novaRate);
  if (!o.nochain && etat.S.chain && R.f() < etat.S.chain) chainZap(e, 3, Math.round(etat.S.dmg * .9));
  if (e.hp <= 0) killEnemy(e);
}
/** @param {Ent} from @param {number} n @param {number} dmg */
function chainZap(from, n, dmg) {
  let cur = from; const hit = new Set([from]); sfx.play('zap');
  for (let i = 0; i < n; i++) {
    let best = null, bd = 190;
    for (const e of etat.enemies) { if (hit.has(e) || e.dead || e.spawnT > 0) continue; const d = Math.hypot(e.x - cur.x, e.y - cur.y); if (d < bd) { bd = d; best = e; } }
    if (!best) break;
    etat.bolts.push({ x1: cur.x, y1: cur.y, x2: best.x, y2: best.y, life: .18 });
    hit.add(best); hitEnemy(best, dmg, best.x - cur.x, best.y - cur.y, { nochain: 1, kb: 60, quiet: 1 }); cur = best;
  }
}
/** @param {Ent} e */
export function killEnemy(e) {
  if (e.dead) return;
  e.dead = true; game.kills++;
  const big = e.r > 15;
  burst(e.x, e.y, e.col, big ? 26 : 16, big ? 340 : 280, .6, 'shard');
  burst(e.x, e.y, '#ffffff', 6, 200, .25);
  ring(e.x, e.y, e.col, e.r, e.r * 3.5, .35, 3); flare(e.x, e.y, e.col, e.r * 5, .3);
  sfx.play('kill', big ? .7 : rnd(.9, 1.2)); stop(big ? .07 : .035); shake(big ? 7 : 3);
  if (e.type === 'boss') return;
  let n = EDEF[e.type].shards * (e.elite ? 5 : 1);
  for (let i = 0; i < n; i++) etat.picks.push({ k: 'shard', x: e.x, y: e.y, vx: rnd(-140, 140), vy: rnd(-140, 140), t: 0 });
  const low = etat.P.hp < etat.S.maxHp * .35;
  if (R.f() < (low ? .1 : .04) || e.elite) etat.picks.push({ k: 'heal', x: e.x, y: e.y, vx: rnd(-60, 60), vy: rnd(-60, 60), t: 0 });
  if (etat.S.life) heal(etat.S.life);
  if (e.type === 'splitter') for (let i = 0; i < 2; i++) { const m = makeEnemy('mini', e.x + rnd(-8, 8), e.y + rnd(-8, 8)); m.kx = rnd(-200, 200); m.ky = rnd(-200, 200); m.spawnT = 0; etat.enemies.push(m); }
  if (e.type === 'bomber' && !e.exploded) explode(e.x, e.y, 70, 0, 35, e.col);
  if (etat.S.explode) explode(e.x, e.y, 60 + 15 * etat.S.explode, 0, etat.S.dmg * (.8 + .5 * etat.S.explode), '#8fe9ff', true);
}
/** Explosion : blesse le héros (pd) et/ou les ennemis (ed) dans le rayon r.
 * @param {number} x @param {number} y @param {number} r @param {number} pd @param {number} ed @param {string} col @param {boolean} [small] */
export function explode(x, y, r, pd, ed, col, small) {
  ring(x, y, col, 8, r, .35, 6); flare(x, y, col, r * 1.8, .3); burst(x, y, col, small ? 10 : 22, r * 4, .45);
  sfx.play('boom'); shake(small ? 4 : 9);
  if (pd && Math.hypot(etat.P.x - x, etat.P.y - y) < r + etat.P.r) hurtPlayer(pd, x, y);
  if (ed) for (const e of etat.enemies) if (!e.dead && Math.hypot(e.x - x, e.y - y) < r + e.r) hitEnemy(e, Math.round(ed), e.x - x, e.y - y, { nochain: 1, quiet: 1, fixed: 1, nova: .5 });
}
/** Direction de visée : souris, stick droit, sinon visée automatique. @param {PadState|null} st */
export function aimDir(st) {
  if (IN.mode === 'mouse') return Math.atan2(IN.mouse.y - etat.P.y, IN.mouse.x - etat.P.x);
  if (IN.mode === 'pad' && st && (st.rx || st.ry)) return Math.atan2(st.ry, st.rx);
  // visée automatique
  let best = null, bs = 1e9;
  for (const e of etat.enemies) {
    if (e.dead || e.spawnT > 0) continue;
    const d = Math.hypot(e.x - etat.P.x, e.y - etat.P.y); if (d > 420) continue;
    const a = Math.atan2(e.y - etat.P.y, e.x - etat.P.x), off = Math.abs(angDiff(etat.P.face, a));
    const sc = d + off * 140; if (sc < bs) { bs = sc; best = a; }
  }
  return best === null ? etat.P.face : best;
}
export function attack() {
  const step = etat.P.comboT > 0 ? (etat.P.combo + 1) % 3 : 0;
  etat.P.combo = step; etat.P.comboT = .55;
  const heavy = step === 2;
  etat.P.atkCd = (heavy ? .42 : .26) / etat.S.atkSpd;
  const a = etat.P.aim, range = etat.S.range * (heavy ? 1.2 : 1), arc = heavy ? 2.6 : 2.0;
  etat.slashes.push({ x: etat.P.x, y: etat.P.y, a, range, arc, t: 0, dur: heavy ? .2 : .15, step });
  etat.P.vx += Math.cos(a) * (heavy ? 260 : 150); etat.P.vy += Math.sin(a) * (heavy ? 260 : 150);
  sfx.play(heavy ? 'slash3' : 'slash', 1 + step * .12);
  const dmg = etat.S.dmg * (heavy ? 1.8 : 1);
  let hitAny = false;
  for (const e of etat.enemies) {
    if (e.dead || e.spawnT > 0) continue;
    const dx = e.x - etat.P.x, dy = e.y - etat.P.y, d = Math.hypot(dx, dy);
    if (d - e.r > range) continue;
    if (d > e.r + 6 && Math.abs(angDiff(a, Math.atan2(dy, dx))) > arc / 2) continue;
    hitEnemy(e, dmg, dx, dy, { kb: heavy ? 380 : 190, nova: heavy ? 4 : 2.6 }); hitAny = true;
  }
  if (hitAny) { stop(heavy ? .075 : .04); shake(heavy ? 6 : 2.5); }
  // renvoi des projectiles
  let refl = 0;
  for (const b of etat.bullets) {
    const dx = b.x - etat.P.x, dy = b.y - etat.P.y, d = Math.hypot(dx, dy);
    if (d > range + 10 || Math.abs(angDiff(a, Math.atan2(dy, dx))) > arc / 2 + .2) continue;
    b.dead = true; refl++;
    const na = a + rnd(-.12, .12), sp = 560;
    etat.projs.push({ x: b.x, y: b.y, vx: Math.cos(na) * sp, vy: Math.sin(na) * sp, dmg: Math.round((etat.S.shotDmg + etat.S.dmg) * (1 + etat.S.reflect)), pierce: 1 + etat.S.pierce, life: 1.2, r: 6, hit: new Set(), refl: 1 });
    burst(b.x, b.y, '#ffffff', 5, 200, .2);
  }
  if (refl) { sfx.play('reflect'); stop(.05); txt(etat.P.x, etat.P.y - 26, refl > 1 ? 'RENVOI ×' + refl : 'RENVOI', '#8fe9ff'); etat.P.nova = Math.min(100, etat.P.nova + 3 * refl * etat.S.novaRate); }
}
export function shoot() {
  etat.P.shotCd = etat.S.shotCd;
  const n = etat.S.shots, spread = .14;
  for (let i = 0; i < n; i++) {
    const a = etat.P.aim + (i - (n - 1) / 2) * spread, sp = 620;
    etat.projs.push({ x: etat.P.x + Math.cos(a) * 14, y: etat.P.y + Math.sin(a) * 14, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: etat.S.shotDmg, pierce: etat.S.pierce, life: .9, r: 5, hit: new Set() });
  }
  flare(etat.P.x + Math.cos(etat.P.aim) * 16, etat.P.y + Math.sin(etat.P.aim) * 16, '#8fe9ff', 26, .12);
  sfx.play('shot');
}
/** @param {number} mx @param {number} my direction voulue */
export function dash(mx, my) {
  if (etat.P.dashCh <= 0) return;
  etat.P.dashCh--; if (etat.P.dashRe <= 0) etat.P.dashRe = etat.S.dashCd;
  let a = (mx || my) ? Math.atan2(my, mx) : etat.P.aim;
  etat.P.dx = Math.cos(a); etat.P.dy = Math.sin(a); etat.P.dashT = .17; etat.P.inv = Math.max(etat.P.inv, .22);
  sfx.play('dash'); ring(etat.P.x, etat.P.y, '#8fe9ff', 6, 34, .25, 3);
  if (etat.S.timeSlow) { game.slow = .35; game.slowT = .9; }
}
/** @param {boolean} [free] déclenchée sans jauge (Dernier Souffle) */
export function doNova(free) {
  if (!free && etat.P.nova < 100) return;
  if (!free) etat.P.nova = 0;
  sfx.play('nova'); shake(18); stop(.12); flash('#ffffff', .6);
  ring(etat.P.x, etat.P.y, '#ffffff', 10, 340, .6, 10); ring(etat.P.x, etat.P.y, '#8fe9ff', 10, 260, .5, 18); flare(etat.P.x, etat.P.y, '#8fe9ff', 300, .5);
  burst(etat.P.x, etat.P.y, '#8fe9ff', 50, 600, .8, 'shard');
  for (const b of etat.bullets) { b.dead = true; burst(b.x, b.y, '#ffffff', 2, 100, .2); }
  for (const e of etat.enemies) { const d = Math.hypot(e.x - etat.P.x, e.y - etat.P.y); if (d < 300 + e.r) hitEnemy(e, Math.round(etat.S.dmg * 4 + 40), e.x - etat.P.x, e.y - etat.P.y, { kb: 600, nova: 0, nochain: 1 }); }
  if (etat.S.novaRunes) for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; etat.zones.push({ k: 'rune', x: etat.P.x + Math.cos(a) * 110, y: etat.P.y + Math.sin(a) * 110, t: .5 + i * .06, r: 60, dmg: etat.S.dmg * 2.5 }); }
}
/* =========================================================
   ENNEMIS
   ========================================================= */
/** @param {string} type @param {number} x @param {number} y @param {boolean} [elite] @returns {Ent} */
export function makeEnemy(type, x, y, elite) {
  const d = EDEF[type], mul = (1 + etat.roomNum * .11) * (elite ? 4 : 1);
  return { type, x, y, vx: 0, vy: 0, kx: 0, ky: 0, r: d.r * (elite ? 1.45 : 1), hp: d.hp * mul, maxHp: d.hp * mul, spd: d.spd, col: elite ? '#ffd45a' : d.col, dmg: d.dmg, elite, t: rnd(3), st: 'move', stT: 0, cd: rnd(1, 2.5), flash: 0, sq: 0, slow: 0, spawnT: 0, a: rnd(TAU), dead: false };
}
/** @param {{type:string,elite?:boolean}[]} list */
export function spawnWave(list) {
  list.forEach((s, i) => {
    const r = EDEF[s.type].r * (s.elite ? 1.45 : 1);
    const p = freeSpot(r + 6, 230) || freeSpot(r + 6, 120) || { x: W / 2, y: 120 };
    etat.spawners.push({ x: p.x, y: p.y, type: s.type, elite: s.elite, t: .85 + i * .09, max: .85 + i * .09 });
  });
  sfx.play('spawn');
}
/** Tir ennemi. @param {number} x @param {number} y @param {number} a angle @param {number} sp vitesse @param {string} [col] @param {number} [r] @param {number} [dmg] */
export function eShoot(x, y, a, sp, col = '#ff3d7f', r = 6, dmg = 12) {
  etat.bullets.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r, col, dmg, life: 6 });
}
/** Déplace un cercle en glissant sur les murs ; true s'il a touché un mur. @param {Ent|{x:number,y:number,r:number}} o @param {number} dx @param {number} dy */
export function moveCircle(o, dx, dy) {
  o.x += dx; let hit = false;
  for (const w of etat.room.walls) if (rectHit(o.x, o.y, o.r, w)) { o.x = dx > 0 ? w.x - o.r - .01 : w.x + w.w + o.r + .01; hit = true; }
  o.y += dy;
  for (const w of etat.room.walls) if (rectHit(o.x, o.y, o.r, w)) { o.y = dy > 0 ? w.y - o.r - .01 : w.y + w.h + o.r + .01; hit = true; }
  // sécurité : rester dans l'arène
  o.x = clamp(o.x, BORDER + o.r, W - BORDER - o.r); o.y = clamp(o.y, BORDER + o.r, H - BORDER - o.r);
  return hit;
}
/** Une image d'un ennemi. @param {Ent} e @param {number} dt */
export function updEnemy(e, dt) {
  e.t += dt; e.flash -= dt; e.sq = Math.max(0, e.sq - dt * 2); e.stT -= dt; e.cd -= dt;
  if (e.slow > 0) e.slow -= dt;
  const sl = e.slow > 0 ? .55 : 1;
  const dx = etat.P.x - e.x, dy = etat.P.y - e.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  let tx = 0, ty = 0; // vitesse voulue
  const sp = e.spd * sl;
  switch (e.type) {
    case 'mite': case 'mini': {
      const w = Math.sin(e.t * 5 + e.a) * .6;
      tx = (ux - uy * w) * sp; ty = (uy + ux * w) * sp; break;
    }
    case 'spitter': {
      if (e.st === 'aim') { if (e.stT <= 0) { const n = etat.room.z >= 1 ? 3 : 1; for (let i = 0; i < n; i++) eShoot(e.x, e.y, Math.atan2(dy, dx) + (i - (n - 1) / 2) * .28, 185); sfx.play('eshot'); e.st = 'move'; e.cd = rnd(1.8, 2.6); } break; }
      const want = d < 190 ? -1 : d > 300 ? 1 : 0, side = Math.sin(e.t * .8 + e.a) > 0 ? 1 : -1;
      tx = (ux * want - uy * side * .7) * sp; ty = (uy * want + ux * side * .7) * sp;
      if (e.cd <= 0) { e.st = 'aim'; e.stT = .5; }
      break;
    }
    case 'bomber': {
      if (e.st === 'fuse') { if (e.stT <= 0) { e.exploded = true; explode(e.x, e.y, 85, 22, 40, e.col); e.hp = 0; killEnemy(e); } break; }
      tx = ux * sp; ty = uy * sp;
      if (d < 58) { e.st = 'fuse'; e.stT = .55; sfx.play('warn'); }
      break;
    }
    case 'splitter': {
      tx = ux * sp + Math.cos(e.t * 2) * 40; ty = uy * sp + Math.sin(e.t * 2) * 40; break;
    }
    case 'brute': {
      if (e.st === 'wind') { if (e.stT <= 0) { e.st = 'charge'; e.stT = .6; sfx.play('dash'); } break; }
      if (e.st === 'charge') {
        const hit = moveCircle(e, Math.cos(e.a) * 540 * dt, Math.sin(e.a) * 540 * dt);
        if (R.f() < .5) burst(e.x, e.y, e.col, 1, 60, .3);
        if (hit || e.stT <= 0) { e.st = 'stun'; e.stT = hit ? .9 : .4; if (hit) { shake(8); ring(e.x, e.y, e.col, 10, 70, .3); sfx.play('boom'); } }
        break;
      }
      if (e.st === 'stun') { if (e.stT <= 0) { e.st = 'move'; e.cd = rnd(1.8, 3); } break; }
      tx = ux * sp; ty = uy * sp;
      if (e.cd <= 0 && d < 400) { e.st = 'wind'; e.stT = .7; e.a = Math.atan2(dy, dx); sfx.play('warn'); }
      break;
    }
    case 'weaver': {
      if (e.st === 'fade') {
        if (e.stT <= 0) {
          let p = null; for (let i = 0; i < 30 && !p; i++) { const a = rnd(TAU), r = rnd(170, 290), x = etat.P.x + Math.cos(a) * r, y = etat.P.y + Math.sin(a) * r; if (x > 60 && x < W - 60 && y > 60 && y < H - 60 && !solidAt(x, y, e.r)) p = { x, y }; }
          if (p) { e.x = p.x; e.y = p.y; }
          e.st = 'appear'; e.stT = .35; burst(e.x, e.y, e.col, 12, 200, .3);
        }
        break;
      }
      if (e.st === 'appear') {
        if (e.stT <= 0) { const n = etat.room.z >= 2 ? 14 : 10, o = rnd(TAU); for (let i = 0; i < n; i++) eShoot(e.x, e.y, o + i / n * TAU, 150, '#c77dff'); sfx.play('eshot'); e.st = 'move'; e.cd = rnd(2.6, 3.6); }
        break;
      }
      tx = -uy * 50 * Math.sin(e.t); ty = ux * 50 * Math.sin(e.t);
      if (e.cd <= 0) { e.st = 'fade'; e.stT = .4; }
      break;
    }
    case 'sentinel': {
      e.a += dt * (e.st === 'fire' ? 2.2 : .6);
      if (e.st === 'fire') {
        if ((e.fT = (e.fT || 0) - dt) <= 0) { e.fT = .17; const arms = etat.room.z >= 2 ? 4 : 3; for (let i = 0; i < arms; i++) eShoot(e.x, e.y, e.a + i / arms * TAU, 140, '#ff6bd6', 5, 10); sfx.play('eshot'); }
        if (e.stT <= 0) { e.st = 'move'; e.cd = rnd(1.4, 2); }
      } else if (e.cd <= 0) { e.st = 'fire'; e.stT = 2.2; }
      tx = ux * sp; ty = uy * sp; break;
    }
  }
  const acc = Math.min(1, dt * 8);
  e.vx = lerp(e.vx, tx, acc); e.vy = lerp(e.vy, ty, acc);
  // séparation
  for (const o of etat.enemies) {
    if (o === e || o.dead || o.type === 'boss') continue;
    const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy), m = e.r + o.r;
    if (od < m && od > 0) { const f = (m - od) / m * 160; e.vx += ox / od * f; e.vy += oy / od * f; }
  }
  if (e.st !== 'charge') moveCircle(e, (e.vx + e.kx) * dt, (e.vy + e.ky) * dt);
  e.kx *= Math.pow(.0008, dt); e.ky *= Math.pow(.0008, dt);
  if (Math.hypot(etat.P.x - e.x, etat.P.y - e.y) < e.r + etat.P.r - 2) hurtPlayer(e.st === 'charge' ? e.dmg * 1.4 | 0 : e.dmg, e.x, e.y);
}
