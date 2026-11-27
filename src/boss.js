// @ts-check
/** Le Gardien de la Faille : attaques et phases. Sans DOM. */
import { BOSS_HP, H, TAU, W } from './config.js';
import { R, angDiff, clamp, lerp, pick, rint, rnd } from './util.js';
import { AU } from './audio.js';
import { etat, game } from './state.js';
import { banner, burst, flare, flash, ring, shake, stop } from './effects.js';
import { eShoot, hurtPlayer, killEnemy, moveCircle, spawnWave } from './combat.js';

export function startBoss() {
  etat.boss = { type: 'boss', x: W / 2, y: 170, vx: 0, vy: 0, kx: 0, ky: 0, r: 40, hp: BOSS_HP, maxHp: BOSS_HP, col: '#ffd45a', dmg: 20, flash: 0, sq: 0, slow: 0, spawnT: 0, t: 0, phase: 1, atk: null, atkT: 0, next: 3.2, last: '', invT: 3.2, a: 0, plates: 6, intro: 3.2, eye: 0, dead: false, deathT: 0 };
  etat.enemies.push(etat.boss);
  banner('L\'ARCHONTE FRACTURÉ', 'Gardien du fond de la Faille', true);
  AU.play('roar'); AU.zone = 3; AU.target = 2; shake(14);
}
function bossAtk(name) {
  const b = etat.boss; b.atk = name; b.atkT = 0; b.last = name; b.sub = 0; b.fire = 0;
  if (name === 'charge') { b.cn = b.phase >= 2 ? 2 : 1; b.cst = 'wind'; b.cstT = .8; b.ca = Math.atan2(etat.P.y - b.y, etat.P.x - b.x); AU.play('warn'); }
  if (name === 'lasers') { const n = b.phase >= 3 ? 4 : 3, o = rnd(TAU); b.ldir = R.f() < .5 ? 1 : -1; etat.lasers = []; for (let i = 0; i < n; i++) etat.lasers.push({ a: o + i / n * TAU, warn: .9, life: 3.6 }); AU.play('warn'); }
  if (name === 'summon') { const n = b.phase >= 3 ? 4 : 3; const l = []; for (let i = 0; i < n; i++) l.push({ type: pick(['mite', 'bomber', 'mite', 'spitter']) }); spawnWave(l); }
}
export function updBoss(dt) {
  const b = etat.boss; b.t += dt; b.flash -= dt; b.sq = Math.max(0, b.sq - dt * 2); b.invT -= dt; b.a += dt * (.4 + b.phase * .25);
  b.eye = Math.atan2(etat.P.y - b.y, etat.P.x - b.x);
  if (b.deathT > 0) return;
  if (b.intro > 0) { b.intro -= dt; return; }
  // changement de phase
  const ph = b.hp < b.maxHp * .33 ? 3 : b.hp < b.maxHp * .66 ? 2 : 1;
  if (ph > b.phase) {
    b.phase = ph; b.plates = ph === 2 ? 4 : 2; b.invT = 1.6; b.atk = null; b.next = 1.8; etat.lasers = [];
    AU.play('roar'); shake(20); flash('#ffd45a', .5); stop(.2);
    for (let i = 0; i < 2; i++) burst(b.x, b.y, i ? '#ffd45a' : '#c77dff', 40, 500, .9, 'shard');
    ring(b.x, b.y, '#ffd45a', 20, 420, .7, 12);
    for (const bl of etat.bullets) bl.dead = true;
    const a = Math.atan2(etat.P.y - b.y, etat.P.x - b.x); etat.P.vx += Math.cos(a) * 600; etat.P.vy += Math.sin(a) * 600;
    banner(ph === 2 ? 'PHASE II' : 'PHASE III', ph === 2 ? 'L\'Archonte se fissure' : 'Le cœur est à nu', false);
  }
  const fast = b.phase >= 3 ? 1.25 : 1;
  if (!b.atk) {
    // dérive vers un point d'orbite
    const tx = W / 2 + Math.cos(b.t * .5) * 220, ty = H / 2 - 40 + Math.sin(b.t * .8) * 90;
    b.vx = lerp(b.vx, (tx - b.x) * 1.2, dt * 2); b.vy = lerp(b.vy, (ty - b.y) * 1.2, dt * 2);
    b.next -= dt * fast;
    if (b.next <= 0) {
      const pool = b.phase === 1 ? ['spiral', 'fan', 'charge', 'ring'] : b.phase === 2 ? ['spiral', 'fan', 'charge', 'lasers', 'summon', 'ring'] : ['spiral', 'lasers', 'rain', 'charge', 'ring', 'fan', 'summon'];
      let n; do { n = pick(pool); } while (n === b.last);
      if (n === 'summon' && etat.enemies.length > 6) n = 'fan';
      bossAtk(n);
    }
  } else {
    b.atkT += dt * fast; b.vx *= .9; b.vy *= .9;
    const A = b.atk;
    if (A === 'spiral') {
      b.fire -= dt * fast;
      if (b.fire <= 0) { b.fire = .075; const arms = b.phase >= 3 ? 3 : 2; b.sub += .23; for (let i = 0; i < arms; i++) eShoot(b.x, b.y, b.sub + i / arms * TAU, 165, '#ffd45a'); if (b.phase >= 2 && R.f() < .25) eShoot(b.x, b.y, -b.sub * 1.3, 120, '#c77dff'); AU.play('eshot'); }
      if (b.atkT > 3.2) endAtk(1.2);
    } else if (A === 'fan') {
      b.fire -= dt * fast;
      if (b.fire <= 0 && b.sub < 3) { b.fire = .5; b.sub++; const a0 = Math.atan2(etat.P.y - b.y, etat.P.x - b.x), n = b.phase >= 2 ? 9 : 7; for (let i = 0; i < n; i++) eShoot(b.x, b.y, a0 + (i - (n - 1) / 2) * .14, 240, '#ff3d7f', 7, 14); AU.play('eshot'); flare(b.x, b.y, '#ff3d7f', 80, .2); }
      if (b.sub >= 3 && b.fire <= 0) endAtk(1);
    } else if (A === 'ring') {
      b.fire -= dt * fast;
      if (b.fire <= 0 && b.sub < 3) { b.fire = .55; const n = 26, o = b.sub * .12 + rnd(TAU), gap = rint(0, n - 1); for (let i = 0; i < n; i++) if (Math.abs(i - gap) > 1) eShoot(b.x, b.y, o + i / n * TAU, 150 + b.sub * 20, '#c77dff'); b.sub++; ring(b.x, b.y, '#c77dff', 20, 80, .3); AU.play('eshot'); }
      if (b.sub >= 3 && b.fire <= 0) endAtk(1.1);
    } else if (A === 'charge') {
      b.cstT -= dt * fast;
      if (b.cst === 'wind') { b.ca = lerp(b.ca, b.ca + angDiff(b.ca, Math.atan2(etat.P.y - b.y, etat.P.x - b.x)), dt * 3); if (b.cstT <= 0) { b.cst = 'go'; b.cstT = .8; AU.play('dash'); } }
      else if (b.cst === 'go') {
        const hit = moveCircle(b, Math.cos(b.ca) * 720 * dt, Math.sin(b.ca) * 720 * dt);
        burst(b.x, b.y, '#ffd45a', 2, 120, .3);
        if (hit || b.cstT <= 0) {
          shake(16); AU.play('boom'); ring(b.x, b.y, '#ffd45a', 20, 160, .4, 8);
          const n = 18; for (let i = 0; i < n; i++) eShoot(b.x, b.y, i / n * TAU, 200, '#ffd45a');
          b.cn--; if (b.cn > 0) { b.cst = 'wind'; b.cstT = .6; AU.play('warn'); } else { b.cst = 'rest'; b.cstT = .8; }
        }
      } else if (b.cstT <= 0) endAtk(.8);
    } else if (A === 'lasers') {
      let alive = false;
      for (const l of etat.lasers) {
        if (l.warn > 0) { l.warn -= dt; if (l.warn <= 0) AU.play('laser'); alive = true; continue; }
        l.life -= dt; l.a += b.ldir * dt * (b.phase >= 3 ? .75 : .6);
        if (l.life > 0) {
          alive = true;
          const ex = b.x + Math.cos(l.a) * 1100, ey = b.y + Math.sin(l.a) * 1100;
          if (segDist(etat.P.x, etat.P.y, b.x, b.y, ex, ey) < etat.P.r + 8) hurtPlayer(20, etat.P.x - Math.sin(l.a), etat.P.y + Math.cos(l.a));
        }
      }
      if (!alive) { etat.lasers = []; endAtk(1); }
    } else if (A === 'summon') {
      if (b.atkT > 1.2) endAtk(1.4);
    } else if (A === 'rain') {
      b.fire -= dt;
      if (b.fire <= 0 && b.sub < 9) { b.fire = .26; b.sub++; etat.zones.push({ k: 'drop', x: etat.P.x + rnd(-40, 40) + etat.P.vx * .3, y: etat.P.y + rnd(-40, 40) + etat.P.vy * .3, t: .9, r: 52 }); AU.play('warn'); }
      if (b.sub >= 9 && b.fire <= 0) endAtk(1.4);
    }
  }
  moveCircle(b, (b.vx + b.kx) * dt, (b.vy + b.ky) * dt);
  b.kx *= .9; b.ky *= .9;
  if (Math.hypot(etat.P.x - b.x, etat.P.y - b.y) < b.r + etat.P.r) hurtPlayer(b.atk === 'charge' ? 28 : 18, b.x, b.y);
}
function endAtk(rest) { etat.boss.atk = null; etat.boss.next = rest; }
function segDist(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1, vy = y2 - y1, t = clamp(((px - x1) * vx + (py - y1) * vy) / (vx * vx + vy * vy), 0, 1);
  return Math.hypot(px - x1 - vx * t, py - y1 - vy * t);
}
export function bossDeath() {
  etat.boss.deathT = 2.4; etat.boss.atk = null; etat.lasers = []; AU.target = 0; game.slow = .3; game.slowT = 1.2;
  for (const b of etat.bullets) b.dead = true;
  for (const e of etat.enemies) if (e !== etat.boss && !e.dead) killEnemy(e);
  banner('L\'ARCHONTE EST BRISÉ', '', true); AU.play('roar');
}
