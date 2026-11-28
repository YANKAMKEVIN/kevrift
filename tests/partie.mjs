// Plongée complète dans un vrai navigateur (Chromium), en accéléré (?turbo) et à graine fixe (?graine) :
// 1) au clavier : le héros se déplace, frappe et blesse de vrais ennemis ;
// 2) plongée assistée (héros invulnérable, ennemis abattus d'un coup) : les vraies salles, vagues, portails,
//    cartes de pouvoir cliquées, marchand, boss et ses phases, écran de victoire ;
// puis record sauvegardé -> rechargement -> record affiché -> réglages retenus -> ancien format repris ->
// sauvegarde abîmée mise de côté.
// Lancer : npm run partie
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer, connect } from 'node:net';
import { mkdirSync } from 'node:fs';

const PORT = await new Promise(res => { const s = createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const URL = `http://127.0.0.1:${PORT}/index.html?graine=11&turbo=4`;
const OUT = process.env.SMOKE_SHOTS || 'test-results';
const KEY = 'kevrift.sauvegarde';
mkdirSync(OUT, { recursive: true });
// SITE_DIR=dist : teste la version construite par Vite plutôt que les sources
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', process.env.SITE_DIR || '.'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 100; i++) {
  const ok = await new Promise(res => { const c = connect(PORT, '127.0.0.1', () => { c.end(); res(true); }); c.on('error', () => res(false)); });
  if (ok) break; await sleep(100);
}
const fails = [];
const check = (ok, msg) => { console.log(`${ok ? 'OK   ' : 'ÉCHEC'} ${msg}`); if (!ok) fails.push(msg); };
const ASSIST = () => {
  window.__assist = setInterval(() => {
    const k = __kev; if (k.game.state !== 'play') return;
    k.P.hp = k.S.maxHp; k.P.inv = 1;
    for (const e of k.enemies) if (!e.dead && !(e.spawnT > 0)) k.hitEnemy(e, 5000, 0, 0, { quiet: true });
    const r = k.room;
    if (r.type === 'shop' && r.obj && !r.obj.used) { k.P.x = r.obj.x; k.P.y = r.obj.y + 40; }
    else if (k.portals.length && !k.game.trans) { const p = k.portals.find(q => q.type === 'combat') || k.portals[0]; k.P.x = p.x; k.P.y = p.y; }
  }, 30);
};

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const save = () => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
  const on = id => page.locator(`#${id}.on`).count().then(n => n > 0);

  await page.goto(URL);
  check(/^v\d+\.\d+\.\d+$/.test(await page.locator('#ver').innerText()), 'numéro de version sur l\'écran titre');
  await page.waitForFunction(() => __kev.art !== undefined, null, { timeout: 10000 });
  check(await page.evaluate(() => __kev.art) === 13, 'les 13 visuels peints sont chargés (titre, sols, héros, ennemis, Archonte)');
  await page.click('#bPlay');
  await page.waitForFunction(() => __kev.game.state === 'play');

  // 1) au clavier, sans aide
  const x0 = await page.evaluate(() => __kev.P.x);
  await page.keyboard.down('KeyD'); await sleep(400); await page.keyboard.up('KeyD');
  check(await page.evaluate(() => __kev.P.x) > x0 + 20, 'le héros se déplace au clavier');
  await page.waitForFunction(() => __kev.enemies.some(e => !e.spawnT || e.spawnT <= 0), null, { timeout: 15000 });
  await page.keyboard.down('KeyJ');
  for (let i = 0; i < 40 && !(await page.evaluate(() => __kev.game.dealt > 0)); i++) {
    await page.evaluate(() => { const e = __kev.enemies.find(q => !q.dead); if (e) { __kev.P.x = e.x; __kev.P.y = e.y + e.r + 18; __kev.P.face = __kev.P.aim = -Math.PI / 2; } });
    await sleep(100);
  }
  await page.keyboard.up('KeyJ');
  check(await page.evaluate(() => __kev.game.dealt > 0), 'les coups de lame touchent de vrais ennemis');
  await page.screenshot({ path: `${OUT}/partie-1-combat.png` });

  // 2) plongée assistée jusqu'au bout
  await page.evaluate(ASSIST);
  const t0 = Date.now(); let cartes = 0, marchand = 0;
  while (Date.now() - t0 < 240000) {
    if (await on('oEnd')) break;
    if (await on('oChoice')) {
      if (await page.locator('#bLeave').count()) { marchand++; await page.click('#bLeave'); }
      else { await page.locator('#cards .card').first().click(); cartes++; }
      if (cartes === 1) await page.screenshot({ path: `${OUT}/partie-2-cartes.png` });
    }
    await sleep(150);
  }
  check(await on('oEnd'), `fin de plongée atteinte (${Math.round((Date.now() - t0) / 1000)} s, ${cartes} pouvoirs choisis, ${marchand} marchand)`);
  const st = await page.evaluate(() => ({ room: __kev.room.type, boss: !!(__kev.boss && __kev.boss.dead), taken: Object.keys(__kev.game.taken).length }));
  check(st.room === 'boss' && st.boss, 'l\'Archonte est vaincu dans la salle du boss');
  check((await page.locator('#endT').innerText()).length > 0 && await page.locator('#endT.gold').count() === 1, 'écran de victoire');
  await page.screenshot({ path: `${OUT}/partie-3-victoire.png` });
  let d = await save();
  check(d?.version === 2, 'sauvegarde écrite, version 2');
  check(d?.stats?.runs >= 1 && d.stats.wins >= 1 && d.stats.kills > 0 && d.stats.deepest === 3, `carrière enregistrée (${d?.stats?.runs} plongée, ${d?.stats?.kills} ennemis)`);
  check(Array.isArray(d?.top) && d.top[0]?.won === true, 'palmarès enregistré');
  check(d?.best?.won === true && d.best.score >= 1000, `record enregistré (score ${d?.best?.score?.toFixed?.(1)})`);

  // réglages
  await page.evaluate(() => clearInterval(window.__assist));
  await page.click('#bMenu');
  await page.click('#bSetT');
  await page.locator('#vMus').fill('25');
  await page.click('#tgShake');
  d = await save();
  check(d?.cfg?.mus === 25 && d.cfg.shake === false, 'réglages sauvegardés (musique 25, secousses non)');
  await page.reload();
  check((await page.locator('#best').innerText()).includes('vaincu'), 'après rechargement : record affiché sur le titre');
  check((await page.locator('#career').innerText()).includes('victoire'), 'après rechargement : carrière affichée sur le titre');
  check(await page.locator('#vMus').inputValue() === '25', 'après rechargement : réglages retrouvés');

  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('kevrift_best', JSON.stringify({ score: 52, won: false, rooms: 5, time: 300 })); localStorage.setItem('kevrift_cfg', JSON.stringify({ mus: 40, sfx: 60, shake: true, glow: false })); });
  await page.reload();
  check((await page.locator('#best').innerText()).includes('5 salles'), 'ancien record (format d\'avant) repris');
  check(await page.locator('#vMus').inputValue() === '40', 'anciens réglages repris');
  check(await page.evaluate(() => localStorage.getItem('kevrift_best') === null && localStorage.getItem('kevrift_cfg') === null), 'anciennes clés nettoyées');

  await page.evaluate(k => localStorage.setItem(k, '{abîmée'), KEY);
  await page.reload();
  await page.click('#bPlay');
  check(await page.evaluate(k => localStorage.getItem(k + '.abimee'), KEY) === '{abîmée', 'sauvegarde abîmée mise de côté, le jeu démarre');
  check(errors.length === 0, `aucune erreur console${errors.length ? ' : ' + errors.slice(0, 3).join(' | ') : ''}`);
} finally { await browser.close(); server.kill(); }
console.log(fails.length ? `\n${fails.length} échec(s).` : '\nPlongée complète réussie.');
process.exit(fails.length ? 1 : 0);
