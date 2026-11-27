// @ts-check
/** Entrées : clavier, souris, manette, tactile, navigation dans les menus. */
import { H, W } from './config.js';
import { $ } from './util.js';
import { cv, stage } from './render/canvas.js';
import { AU } from './audio.js';
import { IN, T, game, keys, pressed } from './sim/state.js';
import { togglePause } from './ui.js';

// fronts montants pour l'action en cours
addEventListener('keydown', e => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && game.state === 'play') e.preventDefault();
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (game.state === 'play') { if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') pressed.dash = 1; if (e.code === 'KeyE') pressed.nova = 1; }
  if (game.state !== 'play') AU.init();
  IN.mode = IN.mode === 'touch' || IN.mode === 'pad' ? 'kb' : IN.mode;
});
addEventListener('keyup', e => { keys[e.code] = false; });
function toWorld(cx, cy) { const r = cv.getBoundingClientRect(); return { x: (cx - r.left) / r.width * W, y: (cy - r.top) / r.height * H }; }
cv.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; const p = toWorld(e.clientX, e.clientY); IN.mouse.x = p.x; IN.mouse.y = p.y; IN.mouse.t = performance.now(); IN.mode = 'mouse'; });
cv.addEventListener('pointerdown', e => {
  AU.init();
  if (e.pointerType !== 'mouse') return;
  const p = toWorld(e.clientX, e.clientY); IN.mouse.x = p.x; IN.mouse.y = p.y; IN.mode = 'mouse'; IN.mouse.t = performance.now();
  if (e.button === 0) IN.mouse.l = true; if (e.button === 2) IN.mouse.r = true;
});
addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') return; if (e.button === 0) IN.mouse.l = false; if (e.button === 2) IN.mouse.r = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
/* tactile */
export const touchUI = $('touch'), joy = $('joy'), joyK = joy.firstElementChild;
function enableTouch() { if (IN.mode !== 'touch') { IN.mode = 'touch'; } touchUI.classList.add('on'); $('rot').classList.add('need'); }
addEventListener('touchstart', () => { enableTouch(); AU.init(); }, { passive: true });
stage.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch' || game.state !== 'play') return;
  const r = stage.getBoundingClientRect();
  if (e.clientX - r.left < r.width * .45 && T.joyId === null && !e.target.classList.contains('tb')) {
    T.joyId = e.pointerId; T.ox = e.clientX; T.oy = e.clientY; T.x = 0; T.y = 0;
    joy.style.display = 'block'; joy.style.left = (e.clientX - r.left) + 'px'; joy.style.top = (e.clientY - r.top) + 'px'; joyK.style.transform = '';
  }
});
stage.addEventListener('pointermove', e => {
  if (e.pointerId !== T.joyId) return;
  const max = joy.offsetWidth * .45; let dx = e.clientX - T.ox, dy = e.clientY - T.oy; const d = Math.hypot(dx, dy);
  if (d > max) { dx *= max / d; dy *= max / d; }
  T.x = dx / max; T.y = dy / max; joyK.style.transform = `translate(${dx}px,${dy}px)`;
});
const endJoy = e => { if (e.pointerId === T.joyId) { T.joyId = null; T.x = T.y = 0; joy.style.display = 'none'; } };
stage.addEventListener('pointerup', endJoy);
stage.addEventListener('pointercancel', endJoy);
function tbtn(id, down, up) {
  const el = $(id);
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('dn'); down(); AU.init(); });
  const u = e => { el.classList.remove('dn'); if (up) up(); };
  el.addEventListener('pointerup', u); el.addEventListener('pointercancel', u); el.addEventListener('pointerleave', u);
}
tbtn('tAtk', () => T.atk = true, () => T.atk = false);
tbtn('tShot', () => T.shot = true, () => T.shot = false);
tbtn('tDash', () => pressed.dash = 1);
tbtn('tNova', () => pressed.nova = 1);
tbtn('tPause', () => togglePause());
/* manette */
/** @type {{prev:boolean[],navT:number}} */
const PAD = { prev: [], navT: 0 };
export function pollPad(dt) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = null; for (const p of pads) if (p && p.connected) { gp = p; break; }
  if (!gp) return null;
  const b = i => gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > .4);
  const edge = i => b(i) && !PAD.prev[i];
  const dz = v => Math.abs(v) < .2 ? 0 : v;
  const st = { lx: dz(gp.axes[0] || 0), ly: dz(gp.axes[1] || 0), rx: dz(gp.axes[2] || 0), ry: dz(gp.axes[3] || 0), atk: b(2) || b(7), shot: b(3) || b(6) };
  let any = st.lx || st.ly || st.rx || st.ry; for (let i = 0; i < 16; i++) if (b(i)) any = true;
  if (any && IN.mode !== 'pad') { IN.mode = 'pad'; }
  if (edge(9) || (edge(8))) togglePause();
  if (game.state === 'play') {
    if (edge(0) || edge(5)) pressed.dash = 1;
    if (edge(1) || edge(4)) pressed.nova = 1;
  } else {
    // navigation dans les menus
    PAD.navT -= dt;
    const up = b(12) || st.ly < -.5, dn = b(13) || st.ly > .5, lf = b(14) || st.lx < -.5, rt = b(15) || st.lx > .5;
    if ((up || dn || lf || rt) && PAD.navT <= 0) { menuNav(up || lf ? -1 : 1); PAD.navT = .22; }
    if (!(up || dn || lf || rt)) PAD.navT = 0;
    if (edge(0)) { const a = /** @type {any} */ (document.activeElement); if (a && a.click && a !== document.body) a.click(); }
    if (edge(1) && game.state === 'pause') togglePause();
  }
  PAD.prev = gp.buttons.map((x, i) => b(i));
  return st;
}
function menuNav(d) {
  const ov = [...document.querySelectorAll('.ov.on')].pop(); if (!ov) return;
  const items = /** @type {HTMLElement[]} */ ([...ov.querySelectorAll('button:not(.sold),input')]).filter(x => x.offsetParent !== null);
  if (!items.length) return;
  let i = items.indexOf(/** @type {HTMLElement} */ (document.activeElement));
  i = i < 0 ? 0 : (i + d + items.length) % items.length;
  items[i].focus(); AU.play('ui');
}
