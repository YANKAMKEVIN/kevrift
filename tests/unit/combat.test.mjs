import { describe, test, expect, beforeEach } from 'vitest';
import { etat, game, start, wireUi, keys, pressed, DT, run } from './helpers.mjs';
import { EDEF, W } from '../../src/config.ts';
import { attack, dash, doNova, eShoot, explode, heal, hitEnemy, hurtPlayer, killEnemy, makeEnemy, moveCircle, shoot, aimDir } from '../../src/sim/combat.ts';
import { update } from '../../src/sim/update.ts';
import { solidAt } from '../../src/sim/rooms.ts';
import { R } from '../../src/sim/math.ts';

/** Arène vide avec un ennemi prêt à se battre. */
function lone(type = 'mite', dx = 0, dy = -40, elite = false) {
  etat.enemies.length = 0; etat.spawners.length = 0; etat.room.waves = []; etat.room.wave = 99;
  const e = makeEnemy(type, etat.P.x + dx, etat.P.y + dy, elite); e.spawnT = 0; etat.enemies.push(e);
  return e;
}
/** Désactive les coups critiques et la variation de dégâts pour un calcul exact. */
function noLuck() { etat.S.crit = 0; R.f = () => .5; }

beforeEach(() => { wireUi(); start(12); etat.P.inv = 0; });

describe('le héros frappe', () => {
  test('dégâts sans critique : base × 1 (± 8 %)', () => {
    noLuck(); const e = lone('brute'); const hp0 = e.hp;
    hitEnemy(e, 20, 0, 1);
    expect(hp0 - e.hp).toBe(20);
    expect(game.dealt).toBe(20);
  });
  test('critique : × 2,2', () => {
    const e = lone('brute'); etat.S.crit = 1; R.f = () => .5; const hp0 = e.hp;
    hitEnemy(e, 10, 0, 1);
    expect(hp0 - e.hp).toBe(22);
  });
  test('dégâts fixes : ni critique ni variation', () => {
    const e = lone('brute'); etat.S.crit = 1; const hp0 = e.hp;
    hitEnemy(e, 13, 0, 1, { fixed: 1 });
    expect(hp0 - e.hp).toBe(13);
  });
  test('un ennemi qui apparaît encore est intouchable', () => {
    const e = lone(); e.spawnT = .5; const hp0 = e.hp; hitEnemy(e, 999, 0, 1); expect(e.hp).toBe(hp0);
  });
  test('le recul est réduit pour les brutes et les champions', () => {
    noLuck();
    const m = lone('mite'); hitEnemy(m, 1, 1, 0, { kb: 100 }); expect(m.kx).toBeCloseTo(100);
    const b = lone('brute'); hitEnemy(b, 1, 1, 0, { kb: 100 }); expect(b.kx).toBeCloseTo(20);
    const c = lone('mite', 0, -40, true); hitEnemy(c, 1, 1, 0, { kb: 100 }); expect(c.kx).toBeCloseTo(40);
  });
  test('chaque coup remplit la Nova, plafonnée à 100', () => {
    const e = lone('brute'); hitEnemy(e, 1, 0, 1); expect(etat.P.nova).toBeCloseTo(2.4);
    etat.P.nova = 99; hitEnemy(e, 1, 0, 1, { nova: 50 }); expect(etat.P.nova).toBe(100);
  });
  test('combo de lame : trois coups, le troisième plus lourd et plus long', () => {
    lone('brute', 0, -300);
    const steps = [], cds = [];
    for (let i = 0; i < 4; i++) { attack(); steps.push(etat.P.combo); cds.push(etat.P.atkCd); etat.P.comboT = .3; }
    expect(steps).toEqual([0, 1, 2, 0]);
    expect(cds[2]).toBeGreaterThan(cds[0]);
  });
  test('la lame touche devant, pas derrière', () => {
    noLuck();
    const front = lone('brute', 0, -50); const back = makeEnemy('brute', etat.P.x, etat.P.y + 60); back.spawnT = 0; etat.enemies.push(back);
    etat.P.aim = -Math.PI / 2; etat.P.comboT = 0;
    const f0 = front.hp, b0 = back.hp; attack();
    expect(front.hp).toBeLessThan(f0); expect(back.hp).toBe(b0);
  });
  test('renvoi : la lame retourne les tirs ennemis en runes', () => {
    lone('brute', 0, -300);
    eShoot(etat.P.x, etat.P.y - 40, Math.PI / 2, 100);
    etat.P.aim = -Math.PI / 2; attack();
    expect(etat.bullets[0].dead).toBe(true);
    expect(etat.projs).toHaveLength(1); expect(etat.projs[0].refl).toBe(1);
    expect(etat.projs[0].vy).toBeLessThan(0);
  });
  test('rune : autant de projectiles que S.shots, recharge S.shotCd', () => {
    etat.S.shots = 3; shoot();
    expect(etat.projs).toHaveLength(3); expect(etat.P.shotCd).toBe(etat.S.shotCd);
  });
  test('les runes perçantes traversent plusieurs ennemis', () => {
    noLuck(); etat.S.pierce = 2;
    etat.enemies.length = 0;
    for (let i = 0; i < 3; i++) { const e = makeEnemy('brute', etat.P.x, etat.P.y - 60 - i * 45); e.spawnT = 0; etat.enemies.push(e); }
    etat.room.waves = []; etat.room.wave = 99;
    etat.P.aim = -Math.PI / 2; shoot();
    for (let i = 0; i < 40; i++) update(DT, null);
    expect(etat.enemies.filter(e => e.hp < e.maxHp)).toHaveLength(3);
  });
  test('visée automatique : vers l\'ennemi le plus proche devant', () => {
    const e = lone('mite', 100, 0); etat.P.face = 0;
    expect(aimDir(null)).toBeCloseTo(Math.atan2(e.y - etat.P.y, e.x - etat.P.x));
  });
  test('sans ennemi, la visée suit le regard', () => { lone(); etat.enemies.length = 0; etat.P.face = 1.2; expect(aimDir(null)).toBe(1.2); });
});

describe('ennemis vaincus', () => {
  test.each(Object.keys(EDEF).filter(t => t !== 'mini'))('%s : laisse ses éclats', type => {
    const e = lone(type); etat.picks.length = 0; R.f = () => .99;
    killEnemy(e);
    expect(etat.picks.filter(p => p.k === 'shard')).toHaveLength(EDEF[type].shards);
    expect(game.kills).toBe(1);
  });
  test('un champion laisse 5 fois plus d\'éclats et un soin', () => {
    const e = lone('brute', 0, -40, true); etat.picks.length = 0; killEnemy(e);
    expect(etat.picks.filter(p => p.k === 'shard')).toHaveLength(EDEF.brute.shards * 5);
    expect(etat.picks.some(p => p.k === 'heal')).toBe(true);
  });
  test('le cristal diviseur se brise en deux', () => {
    const e = lone('splitter'); killEnemy(e);
    expect(etat.enemies.filter(x => x.type === 'mini' && !x.dead)).toHaveLength(2);
  });
  test('le kamikaze explose en mourant et blesse ses voisins', () => {
    const b = lone('bomber', 0, -200); const n = makeEnemy('brute', b.x + 30, b.y); n.spawnT = 0; etat.enemies.push(n);
    const hp0 = n.hp; killEnemy(b); expect(n.hp).toBeLessThan(hp0);
  });
  test('tuer deux fois ne compte qu\'une fois', () => { const e = lone(); killEnemy(e); killEnemy(e); expect(game.kills).toBe(1); });
  test('les ennemis se renforcent avec la profondeur', () => {
    etat.roomNum = 0; const a = makeEnemy('mite', 0, 0);
    etat.roomNum = 10; const b = makeEnemy('mite', 0, 0);
    expect(b.hp).toBeCloseTo(a.hp * 2.1);
    const c = makeEnemy('mite', 0, 0, true); expect(c.hp).toBeCloseTo(b.hp * 4); expect(c.r).toBeCloseTo(b.r * 1.45);
  });
});

describe('le héros encaisse', () => {
  test('dégâts, invulnérabilité, recul', () => {
    expect(hurtPlayer(15, etat.P.x, etat.P.y + 10)).toBe(true);
    expect(etat.P.hp).toBe(85); expect(etat.P.inv).toBeGreaterThan(0); expect(etat.P.vy).toBeLessThan(0);
  });
  test('le bouclier bloque un coup puis se recharge en 10 s', () => {
    etat.S.shield = 1; etat.P.shieldT = 0;
    expect(hurtPlayer(30, 0, 0)).toBe(false); expect(etat.P.hp).toBe(100); expect(etat.P.shieldT).toBe(10);
    etat.P.inv = 0; expect(hurtPlayer(30, 0, 0)).toBe(true); expect(etat.P.hp).toBe(70);
  });
  test('épines : une onde blesse les ennemis proches', () => {
    noLuck(); etat.S.thorns = 45; const e = lone('brute', 0, -50); const hp0 = e.hp;
    hurtPlayer(5, e.x, e.y); expect(hp0 - e.hp).toBe(45);
  });
  test('dernier souffle : survit une fois avec 50 PV', () => {
    etat.S.lastBreath = 1; etat.P.hp = 10;
    hurtPlayer(50, 0, 0);
    expect(etat.P.dead).toBe(false); expect(etat.P.hp).toBe(50); expect(etat.S.lastBreath).toBe(0);
    etat.P.inv = 0; etat.P.hp = 10; hurtPlayer(50, 0, 0); expect(etat.P.dead).toBe(true);
  });
  test('soin plafonné au maximum', () => { etat.P.hp = 90; heal(50); expect(etat.P.hp).toBe(100); etat.S.maxHp = 150; heal(10); expect(etat.P.hp).toBe(110); });
  test('explosion : blesse le héros dans le rayon seulement', () => {
    explode(etat.P.x + 200, etat.P.y, 50, 20, 0, '#fff'); expect(etat.P.hp).toBe(100);
    explode(etat.P.x + 30, etat.P.y, 50, 20, 0, '#fff'); expect(etat.P.hp).toBe(80);
  });
  test('un ennemi au contact blesse', () => {
    const e = lone('mite', 0, -5); e.spawnT = 0;
    for (let i = 0; i < 3; i++) update(DT, null);
    expect(etat.P.hp).toBeLessThan(100);
  });
  test('la mort ralentit le monde puis annonce la défaite après 1,5 s de jeu', () => {
    const log = wireUi(); etat.P.hp = 5; hurtPlayer(50, 0, 0);
    expect(etat.P.dead).toBe(true); expect(game.slow).toBeLessThan(1);
    run(60); expect(log).not.toContain('DEFAITE');
    run(120); expect(log).toContain('DEFAITE');
  });
});

describe('esquive et Nova', () => {
  test('l\'esquive consomme une charge, protège, puis se recharge', () => {
    dash(1, 0);
    expect(etat.P.dashCh).toBe(0); expect(etat.P.dashT).toBeGreaterThan(0);
    expect(hurtPlayer(20, 0, 0)).toBe(false);
    dash(1, 0); expect(etat.P.dashT).toBeGreaterThan(0); // pas de seconde charge : rien ne change
    for (let i = 0; i < 70; i++) update(DT, null);
    expect(etat.P.dashCh).toBe(1);
  });
  test('l\'esquive déplace vite dans la direction voulue', () => {
    lone('mite', 0, -400); etat.enemies.length = 0;
    const x0 = etat.P.x; pressed.dash = 1; keys.KeyD = true; update(DT, null); update(DT, null); keys.KeyD = false;
    expect(etat.P.x - x0).toBeGreaterThan(15);
  });
  test('Temps Suspendu : chaque esquive ralentit le monde', () => { etat.S.timeSlow = 1; dash(0, 1); expect(game.slow).toBeLessThan(1); });
  test('Nova : il faut une jauge pleine', () => {
    const e = lone('brute', 0, -100); const hp0 = e.hp;
    etat.P.nova = 50; doNova(); expect(e.hp).toBe(hp0);
    etat.P.nova = 100; doNova(); expect(e.hp).toBeLessThan(hp0); expect(etat.P.nova).toBe(0);
  });
  test('Nova : efface tous les tirs ennemis', () => {
    for (let i = 0; i < 5; i++) eShoot(100 + i * 50, 100, 0, 10);
    etat.P.nova = 100; doNova();
    expect(etat.bullets.every(b => b.dead)).toBe(true);
    run(20); // après le gel d'impact, les tirs détruits disparaissent
    expect(etat.bullets).toHaveLength(0);
  });
  test('Nova Fracturante : 8 runes explosives', () => { etat.S.novaRunes = 1; etat.P.nova = 100; doNova(); expect(etat.zones.filter(z => z.k === 'rune')).toHaveLength(8); });
});

describe('déplacements', () => {
  test('moveCircle ne traverse jamais un mur', () => {
    const o = { x: 100, y: 100, r: 10 };
    for (let i = 0; i < 300; i++) { moveCircle(o, (i % 7) * 5 - 15, (i % 5) * 5 - 10); expect(solidAt(o.x, o.y, o.r - .5)).toBe(false); }
  });
  test('le héros avance au clavier', () => {
    lone(); etat.enemies.length = 0; const x0 = etat.P.x;
    keys.KeyD = true; for (let i = 0; i < 30; i++) update(DT, null); keys.KeyD = false;
    expect(etat.P.x).toBeGreaterThan(x0 + 40);
    expect(etat.P.x).toBeLessThan(W);
  });
});
