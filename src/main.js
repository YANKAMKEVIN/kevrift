// @ts-check
/** Point d'entrée : boucle de jeu. */
import { drawFloor, render, resize } from './render.js';
import { seed, clamp } from './util.js';
import { hitEnemy } from './combat.js';
import { pollPad } from './input.js';
import { etat, game } from './state.js';
import { UPS } from './ups.js';
import { advance, newRun, takeUp } from './rooms.js';
import { updTitle, update } from './update.js';
import { togglePause } from './ui.js';
import { loadArt } from './art.js';

// ?graine=N : partie reproductible ; ?turbo=N : N images de jeu par image affichée (tests)
const Q = new URLSearchParams(location.search);
if (Q.has('graine')) seed(+(Q.get('graine') || 0));
const TURBO = clamp(Math.floor(+(Q.get('turbo') || 1)) || 1, 1, 20);
// visuels peints : le sol de la salle en cours est redessiné dès qu'ils arrivent
loadArt().then(n => { if (etat.room) drawFloor(); /** @type {any} */ (window).__kev.art = n; });
addEventListener('resize', resize);
resize();
function frame(now) {
  let dt = Math.min(.033, (now - etat.lastT) / 1000); etat.lastT = now;
  const st = pollPad(dt);
  game.t += dt;
  if (game.state === 'play') for (let i = 0; i < TURBO && game.state === 'play'; i++) update(dt, st);
  else if (game.state === 'title') updTitle(dt);
  render();
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'play') togglePause(); });
/** Accès pour les tests de navigateur. */
/** @type {any} */ (window).__kev = { game, hitEnemy, get P() { return etat.P; }, get S() { return etat.S; }, get enemies() { return etat.enemies; }, get room() { return etat.room; }, newRun, advance, takeUp, UPS, get boss() { return etat.boss; }, get portals() { return etat.portals; }, set roomNum(v) { etat.roomNum = v; }, set stageIdx(v) { etat.stageIdx = v; }, set roomInStage(v) { etat.roomInStage = v; } };
requestAnimationFrame(frame);
