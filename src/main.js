// @ts-check
/** Point d'entrée : boucle de jeu (simulation à pas fixe découplée de l'affichage). */
import { resize } from './render/canvas.js';
import { drawFloor } from './render/floor.js';
import { render } from './render/world.js';
import { updTitle } from './render/title.js';
import { view } from './render/view.js';
import { clamp, seed } from './sim/math.js';
import { hitEnemy } from './sim/combat.js';
import { pollPad } from './input.js';
import { etat, game } from './sim/state.js';
import { UPS } from './sim/ups.js';
import { advance, newRun, takeUp } from './sim/rooms.js';
import { update } from './sim/update.js';
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

let running = false;
/** @param {number} now */
function frame(now) {
  if (document.hidden) { running = false; return; } // onglet caché : plus aucune image (batterie)
  const dt = Math.min(.033, (now - view.lastT) / 1000); view.lastT = now;
  const st = pollPad(dt);
  game.t += dt;
  if (game.state === 'play') for (let i = 0; i < TURBO && game.state === 'play'; i++) update(dt, st);
  else if (game.state === 'title') updTitle(dt);
  render();
  requestAnimationFrame(frame);
}
function start() {
  if (running) return;
  running = true; view.lastT = performance.now();
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (game.state === 'play') togglePause(); }
  else start();
});
/** Accès pour les tests de navigateur. */
/** @type {any} */ (window).__kev = { game, hitEnemy, get P() { return etat.P; }, get S() { return etat.S; }, get enemies() { return etat.enemies; }, get room() { return etat.room; }, newRun, advance, takeUp, UPS, get boss() { return etat.boss; }, get portals() { return etat.portals; }, set roomNum(v) { etat.roomNum = v; }, set stageIdx(v) { etat.stageIdx = v; }, set roomInStage(v) { etat.roomInStage = v; }, get running() { return running; } };
start();
