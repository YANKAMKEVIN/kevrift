// @ts-check
/** Une image de jeu : héros, projectiles, zones, salle terminée. Sans DOM : testé sous Node. */
import { BORDER, H, TAU, W, ZONES } from './config.js';
import { R, angDiff, clamp, lerp, pick, rnd } from './util.js';
import { AU } from './audio.js';
import { IN, T, TITLE, etat, fx, game, keys, pressed } from './state.js';
import { advance, enterPortal, roomCleared, solidAt } from './rooms.js';
import { burst, flare, flash, ring, shake, txt } from './effects.js';
import { aimDir, attack, dash, doNova, eShoot, explode, heal, hitEnemy, hurtPlayer, makeEnemy, moveCircle, shoot, spawnWave, updEnemy } from './combat.js';
import { bossDeath, updBoss } from './boss.js';

export function update(rdt, st) {
  if (game.hitstop > 0) { game.hitstop -= rdt; updFx(rdt * .15); return; }
  if (game.slowT > 0) { game.slowT -= rdt; if (game.slowT <= 0) game.slow = 1; }
  const wdt = rdt * game.slow;          // temps du monde
  const pdt = etat.S.timeSlow && game.slow < 1 && !etat.P.dead ? rdt : wdt; // le héros échappe au ralenti
  if (!etat.P.dead && !game.trans) game.runT += rdt;

  // transition entre salles
  if (game.trans) {
    game.trans.t += rdt;
    if (game.trans.t > .45 && !game.trans.done) { game.trans.done = true; advance(game.trans.type); }
    if (game.trans.t > .9) game.trans = null;
    updFx(wdt);
    return;
  }

  // ---------- héros ----------
  if (!etat.P.dead) {
    let mx = 0, my = 0;
    if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1;
    if (keys.KeyW || keys.ArrowUp) my -= 1; if (keys.KeyS || keys.ArrowDown) my += 1;
    if (st) { mx += st.lx; my += st.ly; }
    mx += T.x; my += T.y;
    const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    if (ml > .1) etat.P.face = Math.atan2(my, mx);
    etat.P.aim = aimDir(st);
    if (IN.mode === 'mouse') etat.P.face = etat.P.aim;

    etat.P.atkCd -= pdt; etat.P.shotCd -= pdt; etat.P.comboT -= pdt; etat.P.inv -= pdt; etat.P.hurtT -= pdt;
    if (etat.P.shieldT > 0) etat.P.shieldT -= pdt;
    if (etat.P.dashCh < etat.S.dashMax) { etat.P.dashRe -= pdt; if (etat.P.dashRe <= 0) { etat.P.dashCh++; etat.P.dashRe = etat.P.dashCh < etat.S.dashMax ? etat.S.dashCd : 0; } }

    const wantAtk = keys.KeyJ || IN.mouse.l || T.atk || (st && st.atk);
    const wantShot = keys.KeyK || IN.mouse.r || T.shot || (st && st.shot);
    if (pressed.dash) dash(mx, my);
    if (pressed.nova) doNova();
    pressed.dash = pressed.nova = 0;
    if (wantAtk && etat.P.atkCd <= 0 && etat.P.dashT <= 0) attack();
    else if (wantShot && etat.P.shotCd <= 0 && etat.P.dashT <= 0) shoot();

    if (etat.P.dashT > 0) {
      etat.P.dashT -= pdt;
      etat.P.vx = etat.P.dx * 820; etat.P.vy = etat.P.dy * 820;
      etat.parts.push({ k: 'ghost', x: etat.P.x, y: etat.P.y, a: etat.P.face, life: .22, max: .22 });
      if (etat.S.burn) { etat.P.trailT -= pdt; if (etat.P.trailT <= 0) { etat.P.trailT = .025; etat.fires.push({ x: etat.P.x, y: etat.P.y, t: 1.8, r: 18 }); } }
      if (etat.P.dashT <= 0) { etat.P.vx *= .3; etat.P.vy *= .3; }
    } else {
      const sp = etat.S.speed * (etat.P.atkCd > 0 ? .7 : 1);
      const a = Math.min(1, pdt * 14);
      etat.P.vx = lerp(etat.P.vx, mx * sp, a); etat.P.vy = lerp(etat.P.vy, my * sp, a);
      if (ml > .1) { etat.P.step += pdt * 10; }
    }
    moveCircle(etat.P, etat.P.vx * pdt, etat.P.vy * pdt);

    // lames orbitales
    if (etat.S.orbit) {
      etat.P.orbA += pdt * 4.2;
      for (let i = 0; i < etat.S.orbit; i++) {
        const a = etat.P.orbA + i / etat.S.orbit * TAU, ox = etat.P.x + Math.cos(a) * 54, oy = etat.P.y + Math.sin(a) * 54;
        for (const e of etat.enemies) {
          if (e.dead || e.spawnT > 0) continue;
          e.orbCd = (e.orbCd || 0);
          if (e.orbCd <= 0 && Math.hypot(e.x - ox, e.y - oy) < e.r + 10) { e.orbCd = .35; hitEnemy(e, Math.round(etat.S.dmg * .55), e.x - etat.P.x, e.y - etat.P.y, { kb: 120, nova: 1, nochain: 1 }); }
        }
        for (const b of etat.bullets) if (!b.dead && Math.hypot(b.x - ox, b.y - oy) < b.r + 9) { b.dead = true; burst(b.x, b.y, '#8fe9ff', 3, 100, .2); }
      }
      for (const e of etat.enemies) if (e.orbCd > 0) e.orbCd -= wdt;
    }
  }

  // ---------- salle : vagues ----------
  if (etat.room.type === 'combat' || etat.room.type === 'defi') {
    if (!etat.room.cleared) {
      const alive = etat.enemies.filter(e => !e.dead).length + etat.spawners.length;
      if (alive === 0) {
        etat.room.waveT -= wdt;
        if (etat.room.waveT <= 0) {
          etat.room.wave++;
          if (etat.room.wave < etat.room.waves.length) { spawnWave(etat.room.waves[etat.room.wave]); etat.room.waveT = .7; AU.target = 1; }
          else roomCleared();
        }
      }
    }
  }
  if (etat.room.cleared && !etat.room.rewarded) {
    etat.room.clearT += rdt;
    if (etat.room.clearT > 1.1) { etat.room.rewarded = true; fx.choice(); }
  }
  if (etat.room.type === 'shop' && etat.room.obj && !etat.room.obj.used) { etat.room.obj.t += rdt; if (etat.room.obj.t > .9 && Math.hypot(etat.P.x - etat.room.obj.x, etat.P.y - etat.room.obj.y) < 70) { etat.room.obj.used = true; fx.shop(); } }
  if (etat.room.type === 'fountain' && etat.room.obj && !etat.room.obj.used && Math.hypot(etat.P.x - etat.room.obj.x, etat.P.y - etat.room.obj.y) < 50) {
    etat.room.obj.used = true; heal(45); AU.play('heal'); ring(etat.room.obj.x, etat.room.obj.y, '#6dffb0', 10, 140, .6, 6); burst(etat.room.obj.x, etat.room.obj.y, '#6dffb0', 30, 260, .8, 'shard');
  }

  // apparitions
  for (const s of etat.spawners) {
    s.t -= wdt;
    if (s.t <= 0) { const e = makeEnemy(s.type, s.x, s.y, s.elite); etat.enemies.push(e); burst(s.x, s.y, e.col, 14, 220, .4); ring(s.x, s.y, e.col, 4, 40, .3, 3); s.done = true; if (s.elite) { txt(s.x, s.y - 30, 'CHAMPION', '#ffd45a', true); shake(6); } }
  }
  etat.spawners = etat.spawners.filter(s => !s.done);

  // ennemis
  for (const e of etat.enemies) { if (e.dead) continue; if (e.type === 'boss') updBoss(wdt); else updEnemy(e, wdt); }
  if (etat.boss && etat.boss.hp <= 0 && !etat.boss.deathT) bossDeath();
  if (etat.boss && etat.boss.deathT > 0) {
    etat.boss.deathT -= rdt;
    if (R.f() < .5) { burst(etat.boss.x + rnd(-40, 40), etat.boss.y + rnd(-40, 40), pick(['#ffd45a', '#c77dff', '#ffffff']), 8, 300, .6, 'shard'); }
    if (R.f() < .12) { AU.play('boom'); shake(8); ring(etat.boss.x + rnd(-30, 30), etat.boss.y + rnd(-30, 30), '#ffd45a', 10, 90, .4, 5); }
    if (etat.boss.deathT <= 0) {
      etat.boss.dead = true; flash('#ffffff', 1); shake(24); AU.play('nova');
      burst(etat.boss.x, etat.boss.y, '#ffd45a', 80, 700, 1.4, 'shard'); burst(etat.boss.x, etat.boss.y, '#c77dff', 60, 500, 1.2, 'shard'); ring(etat.boss.x, etat.boss.y, '#ffffff', 20, 700, 1.2, 14);
      for (let i = 0; i < 60; i++) etat.picks.push({ k: 'shard', x: etat.boss.x, y: etat.boss.y, vx: rnd(-300, 300), vy: rnd(-300, 300), t: 0, mag: 1 });
      setTimeout(() => fx.end(true), 2200);
      etat.boss.deathT = -1;
    }
  }
  etat.enemies = etat.enemies.filter(e => !e.dead || (e === etat.boss && etat.boss.deathT !== -1 && !etat.boss.dead));
  if (etat.boss && etat.boss.dead) etat.enemies = etat.enemies.filter(e => e !== etat.boss);

  // projectiles ennemis
  for (const b of etat.bullets) {
    b.x += b.vx * wdt; b.y += b.vy * wdt; b.life -= wdt;
    if (b.life <= 0 || solidAt(b.x, b.y, 2)) { b.dead = true; burst(b.x, b.y, b.col, 3, 90, .2); continue; }
    if (!etat.P.dead && Math.hypot(b.x - etat.P.x, b.y - etat.P.y) < b.r + etat.P.r - 3) { if (hurtPlayer(b.dmg, b.x - b.vx, b.y - b.vy) || etat.P.inv > 0) { if (etat.P.dashT <= 0) b.dead = true; } }
  }
  etat.bullets = etat.bullets.filter(b => !b.dead);

  // projectiles du héros
  for (const p of etat.projs) {
    if (etat.S.homing || p.refl) {
      let best = null, bd = 260;
      for (const e of etat.enemies) { if (e.dead || e.spawnT > 0 || p.hit.has(e)) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } }
      if (best && (etat.S.homing || p.refl)) {
        const a = Math.atan2(p.vy, p.vx), ta = Math.atan2(best.y - p.y, best.x - p.x), sp = Math.hypot(p.vx, p.vy);
        const na = a + clamp(angDiff(a, ta), -7 * wdt, 7 * wdt) * (etat.S.homing ? 1 : .4);
        p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp;
      }
    }
    p.x += p.vx * wdt; p.y += p.vy * wdt; p.life -= wdt;
    if (R.f() < .6) etat.parts.push({ k: 'dot', x: p.x, y: p.y, life: .2, max: .2, col: p.refl ? '#ffffff' : '#8fe9ff', sz: p.r * .8 });
    if (p.life <= 0 || solidAt(p.x, p.y, 2)) { p.dead = true; burst(p.x, p.y, '#8fe9ff', 5, 140, .2); continue; }
    for (const e of etat.enemies) {
      if (e.dead || e.spawnT > 0 || p.hit.has(e)) continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r) {
        p.hit.add(e); hitEnemy(e, p.dmg, p.vx, p.vy, { kb: 120, nova: 1.6 });
        if (p.pierce-- <= 0) { p.dead = true; break; }
      }
    }
  }
  etat.projs = etat.projs.filter(p => !p.dead);

  // feux, zones, évents
  for (const f of etat.fires) {
    f.t -= wdt;
    for (const e of etat.enemies) if (!e.dead && e.spawnT <= 0 && Math.hypot(e.x - f.x, e.y - f.y) < f.r + e.r) { e.burnCd = (e.burnCd || 0) - wdt; if (e.burnCd <= 0) { e.burnCd = .3; hitEnemy(e, Math.round(etat.S.dmg * .45), 0, 0, { kb: 0, nochain: 1, quiet: 1, nova: .3 }); } }
    if (R.f() < .3) etat.parts.push({ k: 'dot', x: f.x + rnd(-10, 10), y: f.y + rnd(-10, 10), vy: -40, life: .4, max: .4, col: '#ff8a3d', sz: 4 });
  }
  etat.fires = etat.fires.filter(f => f.t > 0);
  for (const z of etat.zones) {
    z.t -= wdt;
    if (z.t <= 0 && !z.done) {
      z.done = true;
      if (z.k === 'rune') explode(z.x, z.y, z.r, 0, z.dmg, '#8fe9ff', true);
      if (z.k === 'drop') { explode(z.x, z.y, z.r, 18, 0, '#ffd45a', true); for (let i = 0; i < 6; i++) eShoot(z.x, z.y, i / 6 * TAU + rnd(), 130, '#ffd45a', 5, 10); }
    }
  }
  etat.zones = etat.zones.filter(z => !z.done);
  for (const v of etat.room.vents) {
    v.t += wdt; const c = v.t % 3.2;
    if (c > 2.5 && c - wdt <= 2.5) { AU.play('boom'); burst(v.x, v.y, ZONES[etat.room.z].haz, 18, 260, .5); ring(v.x, v.y, ZONES[etat.room.z].haz, 6, v.r * 1.4, .3, 5); }
    if (c > 2.5 && c < 3.0) {
      if (Math.hypot(etat.P.x - v.x, etat.P.y - v.y) < v.r + etat.P.r - 4) hurtPlayer(15, v.x, v.y);
      for (const e of etat.enemies) if (!e.dead && e.type !== 'boss' && Math.hypot(e.x - v.x, e.y - v.y) < v.r + e.r) { e.ventCd = (e.ventCd || 0) - wdt; if (e.ventCd <= 0) { e.ventCd = .5; hitEnemy(e, 25, e.x - v.x, e.y - v.y, { nochain: 1, quiet: 1, fixed: 1, nova: 0 }); } }
    }
  }

  // ramassables
  for (const p of etat.picks) {
    p.t += wdt;
    const dx = etat.P.x - p.x, dy = etat.P.y - p.y, d = Math.hypot(dx, dy) || 1;
    if (p.mag || d < 95 || etat.room.cleared) { p.mag = 1; const s = 520 + p.t * 200; p.vx = lerp(p.vx, dx / d * s, wdt * 6); p.vy = lerp(p.vy, dy / d * s, wdt * 6); }
    else { p.vx *= Math.pow(.02, wdt); p.vy *= Math.pow(.02, wdt); }
    p.x += p.vx * wdt; p.y += p.vy * wdt;
    p.x = clamp(p.x, BORDER + 6, W - BORDER - 6); p.y = clamp(p.y, BORDER + 6, H - BORDER - 6);
    if (d < etat.P.r + 10 && !etat.P.dead) {
      p.dead = true;
      if (p.k === 'shard') { game.shards++; AU.play('pickup', 1 + (game.shards % 8) * .06); flare(etat.P.x, etat.P.y, '#3ff3e0', 18, .15); }
      else { heal(12); AU.play('heal'); ring(etat.P.x, etat.P.y, '#6dffb0', 8, 40, .3, 3); }
    }
  }
  etat.picks = etat.picks.filter(p => !p.dead);

  // portails
  for (const p of etat.portals) {
    p.t += rdt;
    if (p.t > .6 && !etat.P.dead && Math.hypot(etat.P.x - p.x, etat.P.y - p.y) < 30 && !game.trans) enterPortal(p);
  }

  updFx(wdt);
}
function updFx(dt) {
  for (const p of etat.parts) {
    p.life -= dt;
    if (p.k === 'spark' || p.k === 'shard' || p.k === 'dot') { p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt; if (p.vx) { p.vx *= Math.pow(.03, dt); p.vy *= Math.pow(.03, dt); } p.rot += (p.vr || 0) * dt; }
  }
  etat.parts = etat.parts.filter(p => p.life > 0);
  for (const t of etat.texts) t.t += dt;
  etat.texts = etat.texts.filter(t => t.t < .8);
  for (const s of etat.slashes) s.t += dt;
  etat.slashes = etat.slashes.filter(s => s.t < s.dur);
  for (const b of etat.bolts) b.life -= dt;
  etat.bolts = etat.bolts.filter(b => b.life > 0);
  game.shake = Math.max(0, game.shake - dt * 60);
  game.flash = Math.max(0, game.flash - dt * 2.5);
  if (game.banner) { game.banner.life -= dt; if (game.banner.life <= 0) game.banner = null; }
}
export function updTitle(dt) {
  if (TITLE.pts.length < 140) TITLE.pts.push({ a: rnd(TAU), r: rnd(20, 60), s: rnd(.3, 1.2), z: rnd(), c: pick(['#3ff3e0', '#ff4d8d', '#ffd45a', '#c77dff']) });
  for (const p of TITLE.pts) { p.r += dt * 60 * p.s * (1 + p.r / 200); p.a += dt * .3 * p.s; if (p.r > 700) { p.r = rnd(10, 40); p.a = rnd(TAU); } }
}
