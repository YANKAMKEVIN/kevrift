// Commandes dans un vrai navigateur (Chromium) : clavier et souris, manette simulée (API Gamepad),
// tactile réel (événements tactiles envoyés par le protocole du navigateur, multi-doigts compris).
// Chaque partie se joue dans un « bac à sable » : vagues suspendues et héros invulnérable,
// pour mesurer chaque commande sans qu'un ennemi ne la perturbe.
// Lancer : npm run commandes   (SITE_DIR=dist pour tester la version construite)
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { startServer } from './serveur.mjs';

const OUT = process.env.SMOKE_SHOTS || 'test-results';
mkdirSync(OUT, { recursive: true });
const server = await startServer();
const URL = `${server.base}index.html?graine=5`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fails = [];
let passed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK   ' : 'ÉCHEC'} ${msg}`); if (ok) passed++; else fails.push(msg); };

/** Ouvre le jeu ; renvoie la page et la liste des erreurs console. */
async function open(browser, ctxOpts = {}, init) {
  const ctx = await browser.newContext(ctxOpts);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => window.__kev && window.__kev.game.state === 'title');
  return { ctx, page, errors };
}
/** Bac à sable : plus de vagues, héros invulnérable et immobile au bas de l'arène. */
const sandbox = page => page.evaluate(() => {
  const k = window.__kev; k.room.waveT = 1e9;
  clearInterval(window.__guard);
  window.__guard = setInterval(() => { k.P.hp = k.S.maxHp; k.P.inv = 5; }, 20);
});
const P = page => page.evaluate(() => ({ x: window.__kev.P.x, y: window.__kev.P.y, aim: window.__kev.P.aim, dashCh: window.__kev.P.dashCh, dashT: window.__kev.P.dashT, nova: window.__kev.P.nova }));
const state = page => page.evaluate(() => window.__kev.game.state);
const home = page => page.evaluate(() => { const p = window.__kev.P; p.x = 480; p.y = 470; p.vx = p.vy = 0; p.atkCd = p.shotCd = 0; });
const waitState = (page, s) => page.waitForFunction(st => window.__kev.game.state === st, s, { timeout: 5000 }).then(() => true, () => false);
/** Attend qu'une condition devienne vraie dans la page (machine chargée : pas de délai fixe). */
const until = (page, fn, arg, ms = 2000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 20 }).then(() => true, () => false);
/** Attend que le héros se soit éloigné d'au moins d px de (x, y). */
const movedFrom = (page, a, d = 25) => until(page, ([x, y, d]) => Math.hypot(window.__kev.P.x - x, window.__kev.P.y - y) > d, [a.x, a.y, d]);
/** Attend que la visée du héros soit à moins de tol radians de l'angle a. */
const aimNear = (page, a, tol = .15) => until(page, ([a, tol]) => Math.abs(Math.atan2(Math.sin(window.__kev.P.aim - a), Math.cos(window.__kev.P.aim - a))) < tol, [a, tol]);
/** Attend que la visée pointe vers le point (x, y) de l'arène. */
const aimAt = (page, x, y) => until(page, ([x, y]) => { const P = window.__kev.P, a = Math.atan2(y - P.y, x - P.x); return Math.abs(Math.atan2(Math.sin(P.aim - a), Math.cos(P.aim - a))) < .1; }, [x, y]);
const angClose = (a, b, tol = .15) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < tol;

const browser = await chromium.launch();
try {
  /* =========================== CLAVIER ET SOURIS =========================== */
  console.log('▶ clavier et souris');
  {
    const { ctx, page, errors } = await open(browser, { viewport: { width: 1280, height: 720 } });
    // menus au clavier : Tab jusqu'à JOUER puis Entrée
    let focused = '';
    for (let i = 0; i < 8 && focused !== 'bPlay'; i++) { await page.keyboard.press('Tab'); focused = await page.evaluate(() => document.activeElement && document.activeElement.id); }
    check(focused === 'bPlay', 'menu titre : JOUER se rejoint au clavier (Tab)');
    await page.keyboard.press('Enter');
    check(await waitState(page, 'play'), 'Entrée sur JOUER lance la plongée');
    await sandbox(page);
    // déplacements : WASD (= ZQSD sur clavier français, mêmes touches physiques) et flèches
    const moves = [['KeyW', 0, -1], ['KeyS', 0, 1], ['KeyA', -1, 0], ['KeyD', 1, 0], ['ArrowUp', 0, -1], ['ArrowDown', 0, 1], ['ArrowLeft', -1, 0], ['ArrowRight', 1, 0]];
    for (const [key, sx, sy] of moves) {
      await home(page); await page.evaluate(() => { const p = window.__kev.P; p.y = 420; });
      const a = await P(page);
      await page.keyboard.down(key); await movedFrom(page, a); await page.keyboard.up(key);
      const b = await P(page), dx = b.x - a.x, dy = b.y - a.y;
      check(dx * sx + dy * sy > 15 && Math.abs(dx * sy) + Math.abs(dy * sx) < 10, `${key} déplace le héros dans le bon sens (${dx.toFixed(0)}, ${dy.toFixed(0)})`);
    }
    // diagonale : vitesse normalisée (pas plus rapide en diagonale)
    await home(page); await page.evaluate(() => { window.__kev.P.y = 420; });
    let a = await P(page);
    await page.keyboard.down('KeyW'); await page.keyboard.down('KeyD'); await movedFrom(page, a); await page.keyboard.up('KeyW'); await page.keyboard.up('KeyD');
    let b = await P(page);
    check(b.x > a.x + 10 && b.y < a.y - 10, 'deux touches : déplacement en diagonale');
    // lame (J), rune (K)
    await home(page);
    const sl0 = await page.evaluate(() => window.__kev.slashes.length);
    await page.keyboard.down('KeyJ');
    const okJ = await until(page, n => window.__kev.slashes.length > n || window.__kev.P.atkCd > 0, sl0);
    await page.keyboard.up('KeyJ');
    check(okJ, 'J : coup de lame');
    await home(page);
    await page.keyboard.down('KeyK');
    const okK = await until(page, () => window.__kev.projs.length > 0 || window.__kev.P.shotCd > 0);
    await page.keyboard.up('KeyK');
    check(okK, 'K : tir de rune');
    // esquive (Espace, Maj)
    for (const key of ['Space', 'ShiftLeft']) {
      await home(page); await sleep(1000); // recharge de l'esquive
      a = await P(page);
      await page.keyboard.press(key);
      await until(page, n => window.__kev.P.dashCh < n || window.__kev.P.dashT > 0, a.dashCh);
      b = await P(page);
      check(b.dashCh < a.dashCh || b.dashT > 0, `${key} : esquive (charges ${a.dashCh} -> ${b.dashCh})`);
    }
    // Nova (E) quand la jauge est pleine
    await page.evaluate(() => { window.__kev.P.nova = 100; });
    await page.keyboard.press('KeyE');
    check(await until(page, () => window.__kev.P.nova < 100), 'E : Nova déclenchée, jauge vidée');
    await page.keyboard.press('KeyE'); await sleep(50);
    check((await P(page)).nova < 100, 'E à jauge vide : rien ne se passe (pas d\'erreur)');
    // souris : la visée suit le pointeur, clic gauche = lame, clic droit = rune
    await home(page);
    const box = await page.locator('#cv').boundingBox();
    const toScreen = (x, y) => [box.x + x / 960 * box.width, box.y + y / 540 * box.height];
    await page.mouse.move(...toScreen(480, 200));
    const okUp = await aimAt(page, 480, 200), up = await P(page);
    check(okUp && up.aim < -1.2 && up.aim > -1.95, `souris au-dessus du héros : visée vers le haut (${up.aim.toFixed(2)} rad)`);
    await page.mouse.move(...toScreen(800, 470));
    const okRight = await aimAt(page, 800, 470);
    check(okRight && angClose((await P(page)).aim, 0, .3), 'souris à droite : visée vers la droite');
    await page.evaluate(() => { window.__kev.P.atkCd = 0; });
    await page.mouse.down();
    const okL = await until(page, () => window.__kev.slashes.length > 0 || window.__kev.P.atkCd > 0);
    await page.mouse.up();
    check(okL, 'clic gauche : coup de lame vers le pointeur');
    await page.evaluate(() => { window.__kev.P.shotCd = 0; window.__kev.P.atkCd = 0; });
    await page.mouse.down({ button: 'right' });
    const okR = await until(page, () => window.__kev.projs.length > 0);
    await page.mouse.up({ button: 'right' });
    check(okR, 'clic droit : rune tirée');
    // pause : Échap et P, retour au jeu
    await page.keyboard.press('Escape');
    check(await waitState(page, 'pause') && await page.locator('#oPause.on').count() === 1, 'Échap : pause et écran de pause');
    await page.keyboard.down('KeyD'); await sleep(150); await page.keyboard.up('KeyD');
    const xp = (await P(page)).x; await sleep(200);
    check((await P(page)).x === xp, 'en pause, le héros ne bouge plus');
    await page.keyboard.press('Escape');
    check(await waitState(page, 'play'), 'Échap à nouveau : la plongée reprend');
    await page.keyboard.press('KeyP');
    check(await waitState(page, 'pause'), 'P : pause');
    // dans la pause, les boutons se parcourent au clavier
    await until(page, () => document.activeElement && document.activeElement.id === 'bResume');
    const f0 = await page.evaluate(() => document.activeElement.id);
    check(f0 === 'bResume', `pause : REPRENDRE a le focus (${f0})`);
    await page.keyboard.press('Enter');
    check(await waitState(page, 'play'), 'Entrée sur REPRENDRE : la plongée reprend');
    // une touche tenue pendant la pause ne reste pas collée
    await home(page);
    await page.keyboard.down('KeyD'); await page.keyboard.press('Escape'); await page.keyboard.up('KeyD'); await page.keyboard.press('Escape');
    await waitState(page, 'play');
    a = await P(page); await sleep(250); b = await P(page);
    check(Math.abs(b.x - a.x) < 3, 'touche relâchée pendant la pause : pas de déplacement fantôme');
    await page.screenshot({ path: `${OUT}/commandes-clavier.png` });
    check(errors.length === 0, `clavier : aucune erreur console${errors.length ? ' : ' + errors.slice(0, 3).join(' | ') : ''}`);
    await ctx.close();
  }

  /* =========================== MANETTE SIMULÉE =========================== */
  console.log('▶ manette (API Gamepad simulée)');
  {
    // une manette standard pilotée par le test : window.__pad.axes / window.__pad.btn(i, appuyé)
    const init = () => {
      const pad = { id: 'Manette de test (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: 0,
        axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
      window.__pad = pad;
      pad.btn = (i, on) => { pad.buttons[i] = { pressed: on, touched: on, value: on ? 1 : 0 }; };
      navigator.getGamepads = () => [pad.connected ? pad : null, null, null, null];
    };
    const { ctx, page, errors } = await open(browser, { viewport: { width: 1280, height: 720 } }, init);
    // appui : bouton tenu jusqu'à ce que la condition soit vraie (ou au moins ms), puis relâché
    const btn = async (i, ms = 80, cond, arg) => { await page.evaluate(i => window.__pad.btn(i, true), i); const ok = cond ? await until(page, cond, arg) : (await sleep(ms), true); await page.evaluate(i => window.__pad.btn(i, false), i); await sleep(80); return ok; };
    const axes = (a) => page.evaluate(a => { window.__pad.axes = a; }, a);
    // menus : la croix déplace le focus, A valide
    const focusIs = () => page.evaluate(() => document.activeElement ? document.activeElement.id : '');
    await btn(13, 0, () => document.activeElement && document.activeElement !== document.body);
    const f1 = await focusIs();
    check(['bPlay', 'bHelp', 'bSetT'].includes(f1), `manette : la croix déplace le focus dans le menu (${f1})`);
    await btn(13, 0, f => document.activeElement.id !== f, f1);
    const f2 = await focusIs();
    check(f2 !== f1, `croix bas : élément suivant (${f1} -> ${f2})`);
    await btn(12, 0, f => document.activeElement.id === f, f1);
    check(await focusIs() === f1, 'croix haut : retour à l\'élément précédent');
    await page.evaluate(() => document.getElementById('bPlay').focus());
    await btn(0);
    check(await waitState(page, 'play'), 'A sur JOUER : la plongée commence');
    await sandbox(page);
    // stick gauche : déplacement analogique, zone morte respectée
    await home(page); await page.evaluate(() => { window.__kev.P.y = 420; });
    let a = await P(page);
    await axes([0.1, 0.1, 0, 0]); await sleep(250);
    let b = await P(page);
    check(Math.hypot(b.x - a.x, b.y - a.y) < 3, 'stick gauche dans la zone morte (0,1) : le héros ne dérive pas');
    await axes([1, 0, 0, 0]); await movedFrom(page, a); await axes([0, 0, 0, 0]);
    b = await P(page);
    check(b.x > a.x + 20, `stick gauche à droite : le héros avance (${(b.x - a.x).toFixed(0)} px)`);
    check(await page.evaluate(() => window.__kev.IN.mode) === 'pad', 'le jeu passe en mode manette');
    await home(page); a = await P(page);
    await axes([0, -1, 0, 0]); await movedFrom(page, a); await axes([0, 0, 0, 0]);
    b = await P(page);
    check(b.y < a.y - 20, 'stick gauche vers le haut : le héros monte');
    // stick droit : visée
    await axes([0, 0, 0, 1]);
    check(await aimNear(page, Math.PI / 2), 'stick droit vers le bas : visée vers le bas');
    await axes([0, 0, -1, 0]);
    check(await aimNear(page, Math.PI), 'stick droit à gauche : visée à gauche');
    await axes([0, 0, 0, 0]);
    // boutons d'action (disposition standard) : X / RT lame, Y / LT rune, A / RB esquive, B / LB Nova
    for (const [i, name] of [[2, 'X'], [7, 'RT']]) {
      await home(page); await page.evaluate(() => { window.__kev.slashes.length = 0; });
      check(await btn(i, 0, () => window.__kev.slashes.length > 0 || window.__kev.P.atkCd > 0), `${name} : coup de lame`);
    }
    for (const [i, name] of [[3, 'Y'], [6, 'LT']]) {
      await home(page); await page.evaluate(() => { window.__kev.projs.length = 0; });
      check(await btn(i, 0, () => window.__kev.projs.length > 0 || window.__kev.P.shotCd > 0), `${name} : tir de rune`);
    }
    for (const [i, name] of [[0, 'A'], [5, 'RB']]) {
      await home(page); await sleep(1000);
      a = await P(page);
      await page.evaluate(i => window.__pad.btn(i, true), i);
      await until(page, n => window.__kev.P.dashCh < n || window.__kev.P.dashT > 0, a.dashCh);
      b = await P(page);
      await page.evaluate(i => window.__pad.btn(i, false), i); await sleep(60);
      check(b.dashCh < a.dashCh || b.dashT > 0, `${name} : esquive`);
    }
    // bouton tenu : une seule esquive (front montant)
    await home(page); await sleep(1200);
    a = await P(page);
    await page.evaluate(() => window.__pad.btn(0, true)); await sleep(500);
    b = await P(page);
    await page.evaluate(() => window.__pad.btn(0, false)); await sleep(60);
    check(a.dashCh - b.dashCh <= 1, 'A tenu : une seule esquive, pas une rafale');
    for (const [i, name] of [[1, 'B'], [4, 'LB']]) {
      await page.evaluate(() => { window.__kev.P.nova = 100; });
      check(await btn(i, 0, () => window.__kev.P.nova < 100), `${name} : Nova`);
    }
    // Start : pause, B : reprendre
    check(await btn(9, 0, () => window.__kev.game.state === 'pause'), 'Start : pause');
    check(await btn(1, 0, () => window.__kev.game.state === 'play'), 'B dans la pause : la plongée reprend');
    await btn(9, 0, () => window.__kev.game.state === 'pause');
    await until(page, () => document.activeElement && document.activeElement.id === 'bResume');
    check(await btn(0, 0, () => window.__kev.game.state === 'play'), 'Start puis A sur REPRENDRE : la plongée reprend');
    // manette débranchée en pleine partie : plus d'entrée fantôme, pas d'erreur
    await home(page);
    await axes([1, 0, 0, 0]);
    await page.evaluate(() => { window.__pad.connected = false; });
    await sleep(250); // le temps que l'élan retombe
    a = await P(page); await sleep(250); b = await P(page);
    check(Math.abs(b.x - a.x) < 3, 'manette débranchée : le héros s\'arrête');
    await page.evaluate(() => { window.__pad.axes = [0, 0, 0, 0]; window.__pad.connected = true; });
    await page.screenshot({ path: `${OUT}/commandes-manette.png` });
    check(errors.length === 0, `manette : aucune erreur console${errors.length ? ' : ' + errors.slice(0, 3).join(' | ') : ''}`);
    await ctx.close();
  }

  /* =========================== TACTILE RÉEL =========================== */
  console.log('▶ tactile (Pixel 7 à l\'horizontale, événements tactiles du navigateur)');
  {
    const { ctx, page, errors } = await open(browser, { ...devices['Pixel 7'], viewport: { width: 915, height: 412 } });
    const cdp = await ctx.newCDPSession(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ id: p.id ?? i, x: p.x, y: p.y, radiusX: 4, radiusY: 4, force: 1 })) });
    const center = async sel => { const r = await page.locator(sel).boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
    // toucher : doigt posé jusqu'à ce que la condition soit vraie (ou au moins ms), puis levé
    const tap = async (sel, ms = 80, cond) => { const c = await center(sel); await touch('touchStart', [c]); const ok = cond ? await until(page, cond) : (await sleep(ms), true); await touch('touchEnd', []); await sleep(60); return ok; };
    // premier toucher : les commandes tactiles apparaissent
    await tap('#bPlay');
    check(await waitState(page, 'play'), 'toucher JOUER lance la plongée');
    check(await page.locator('#touch.on').count() === 1, 'les commandes tactiles s\'affichent après un toucher');
    check(await page.evaluate(() => window.__kev.IN.mode) === 'touch', 'le jeu passe en mode tactile');
    await sandbox(page);
    const st = await page.locator('#stage').boundingBox();
    for (const id of ['#tAtk', '#tDash', '#tShot', '#tNova', '#tPause']) {
      const r = await page.locator(id).boundingBox();
      check(r && r.width >= 44 && r.height >= 44 && r.x >= st.x - 1 && r.x + r.width <= st.x + st.width + 1, `${id} : visible et au moins 44 px, la taille d’un doigt (${r ? Math.round(r.width) : 0} px)`);
    }
    // joystick : apparaît sous le doigt, déplace le héros, disparaît au relâchement
    await home(page); await page.evaluate(() => { window.__kev.P.y = 420; });
    let a = await P(page);
    const j = { x: st.x + st.width * .2, y: st.y + st.height * .6 };
    await touch('touchStart', [j]);
    for (let k = 1; k <= 5; k++) { await touch('touchMove', [{ x: j.x + k * 14, y: j.y }]); await sleep(16); }
    check(await page.locator('#joy').evaluate(e => getComputedStyle(e).display) === 'block', 'joystick affiché sous le doigt');
    await movedFrom(page, a);
    let b = await P(page);
    check(b.x > a.x + 20 && Math.abs(b.y - a.y) < 12, `glisser vers la droite : le héros avance (${(b.x - a.x).toFixed(0)} px)`);
    await touch('touchEnd', []); await sleep(60);
    check(await page.locator('#joy').evaluate(e => getComputedStyle(e).display) === 'none', 'doigt levé : joystick caché');
    await sleep(250); // le temps que l'élan retombe
    a = await P(page); await sleep(200); b = await P(page);
    check(Math.hypot(b.x - a.x, b.y - a.y) < 3, 'doigt levé : le héros s\'arrête');
    // joystick vers le haut
    await home(page); a = await P(page);
    await touch('touchStart', [j]);
    for (let k = 1; k <= 5; k++) { await touch('touchMove', [{ x: j.x, y: j.y - k * 14 }]); await sleep(16); }
    await movedFrom(page, a);
    b = await P(page);
    await touch('touchEnd', []);
    check(b.y < a.y - 20, 'glisser vers le haut : le héros monte');
    // boutons
    await home(page); await page.evaluate(() => { window.__kev.slashes.length = 0; });
    check(await tap('#tAtk', 0, () => window.__kev.slashes.length > 0 || window.__kev.P.atkCd > 0), 'LAME : coup de lame');
    await home(page); await page.evaluate(() => { window.__kev.projs.length = 0; });
    check(await tap('#tShot', 0, () => window.__kev.projs.length > 0 || window.__kev.P.shotCd > 0), 'RUNE : tir de rune');
    await home(page); await sleep(1000); a = await P(page);
    { const c = await center('#tDash'); await touch('touchStart', [c]); await until(page, n => window.__kev.P.dashCh < n || window.__kev.P.dashT > 0, a.dashCh); b = await P(page); await touch('touchEnd', []); }
    check(b.dashCh < a.dashCh || b.dashT > 0, 'ESQUIVE : esquive');
    await page.evaluate(() => { window.__kev.P.nova = 100; });
    check(await tap('#tNova', 0, () => window.__kev.P.nova < 100), 'NOVA : Nova déclenchée');
    // lame maintenue : les coups s'enchaînent tant que le doigt reste posé
    await home(page);
    { const c = await center('#tAtk'); await touch('touchStart', [c]);
      check(await until(page, () => window.__kev.T.atk === true), 'LAME tenue : attaque continue');
      await touch('touchEnd', []); await sleep(60); }
    check(await page.evaluate(() => window.__kev.T.atk === false), 'LAME relâchée : l\'attaque s\'arrête');
    // deux doigts : joystick et LAME en même temps
    await home(page); await page.evaluate(() => { window.__kev.P.y = 420; window.__kev.slashes.length = 0; });
    a = await P(page);
    const atk = await center('#tAtk');
    await touch('touchStart', [{ id: 1, ...j }]);
    for (let k = 1; k <= 5; k++) { await touch('touchMove', [{ id: 1, x: j.x + k * 14, y: j.y }]); await sleep(16); }
    await touch('touchStart', [{ id: 1, x: j.x + 70, y: j.y }, { id: 2, ...atk }]);
    await movedFrom(page, a); await until(page, () => window.__kev.slashes.length > 0 || window.__kev.P.atkCd > 0);
    b = await P(page);
    const multi = await page.evaluate(() => ({ atk: window.__kev.T.atk, slashes: window.__kev.slashes.length, cd: window.__kev.P.atkCd }));
    await touch('touchEnd', []); await sleep(60);
    check(b.x > a.x + 15 && multi.atk && (multi.slashes > 0 || multi.cd > 0), 'deux doigts : le héros se déplace et frappe en même temps');
    check(await page.evaluate(() => window.__kev.T.joyId === null && !window.__kev.T.atk), 'tous les doigts levés : plus aucune commande active');
    // pause tactile
    await tap('#tPause');
    check(await waitState(page, 'pause'), 'II : pause');
    check(await page.locator('#touch').evaluate(e => getComputedStyle(e).visibility) === 'hidden', 'en pause, les commandes tactiles sont masquées');
    await until(page, () => document.getElementById('oPause').classList.contains('on'));
    await tap('#bResume');
    check(await waitState(page, 'play'), 'toucher REPRENDRE : la plongée reprend');
    // un glissé sur la moitié droite de l'écran ne crée pas de joystick
    await touch('touchStart', [{ x: st.x + st.width * .7, y: st.y + st.height * .5 }]);
    await sleep(60);
    check(await page.evaluate(() => window.__kev.T.joyId === null), 'toucher à droite : pas de joystick (zone des boutons)');
    await touch('touchEnd', []);
    // la page ne défile ni ne zoome sous les doigts
    check(await page.evaluate(() => scrollX === 0 && scrollY === 0 && (visualViewport ? visualViewport.scale === 1 : true)), 'la page n\'a ni défilé ni zoomé');
    await page.screenshot({ path: `${OUT}/commandes-tactile.png` });
    check(errors.length === 0, `tactile : aucune erreur console${errors.length ? ' : ' + errors.slice(0, 3).join(' | ') : ''}`);
    await ctx.close();
  }
} catch (e) {
  fails.push(`erreur du test : ${e.stack || e}`);
  console.log(e);
} finally { await browser.close(); server.stop(); }
console.log(fails.length ? `\n${fails.length} échec(s) sur ${passed + fails.length} vérifications :\n  ${fails.join('\n  ')}` : `\nCommandes : ${passed} vérifications réussies (clavier, souris, manette, tactile).`);
process.exit(fails.length ? 1 : 0);
