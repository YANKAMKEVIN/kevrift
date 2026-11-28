/** Point d'entrée : boucle de jeu (simulation à pas fixe découplée de l'affichage). */
import { resize } from './render/canvas.ts';
import { drawFloor } from './render/floor.ts';
import { render } from './render/world.ts';
import { updTitle } from './render/title.ts';
import { view } from './render/view.ts';
import { clamp, seed } from './sim/math.ts';
import { hitEnemy } from './sim/combat.ts';
import { pollPad } from './input.ts';
import { etat, game } from './sim/state.ts';
import { UPS } from './sim/ups.ts';
import { advance, newRun, takeUp } from './sim/rooms.ts';
import { update } from './sim/update.ts';
import { togglePause } from './ui.ts';
import { loadArt } from './art.ts';
import { AU } from './audio.ts';

// ?graine=N : partie reproductible ; ?turbo=N : N images de jeu par image affichée (tests)
const Q = new URLSearchParams(location.search);
if (Q.has('graine')) seed(+(Q.get('graine') || 0));
const TURBO = clamp(Math.floor(+(Q.get('turbo') || 1)) || 1, 1, 20);
// visuels peints : le sol de la salle en cours est redessiné dès qu'ils arrivent
loadArt().then(n => { if (etat.room) drawFloor(); hook.art = n; });
addEventListener('resize', resize);
resize();

let running = false;
function frame(now: number) {
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
  if (document.hidden) {
    if (game.state === 'play') togglePause();
    if (AU.ac && AU.ac.state === 'running') AU.ac.suspend(); // plus de musique ni de séquenceur en arrière-plan
  } else {
    if (AU.ac && AU.ac.state === 'suspended') AU.ac.resume();
    start();
  }
});
/** Accès pour les tests de navigateur (tests/*.mjs lisent window.__kev). */
const hook = {
  game, hitEnemy, newRun, advance, takeUp, UPS,
  /** Nombre de visuels peints chargés (undefined tant que le chargement n'est pas fini). */ art: undefined as number | undefined,
  get P() { return etat.P; }, get S() { return etat.S; }, get enemies() { return etat.enemies; }, get room() { return etat.room; },
  get boss() { return etat.boss; }, get portals() { return etat.portals; },
  set roomNum(v: number) { etat.roomNum = v; }, set stageIdx(v: number) { etat.stageIdx = v; }, set roomInStage(v: number) { etat.roomInStage = v; },
  get running() { return running; },
};
declare global { interface Window { __kev: typeof hook } }
window.__kev = hook;
start();
