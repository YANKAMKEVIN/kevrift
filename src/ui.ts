/** Écrans : titre, aide, réglages, cartes de pouvoir, marchand, pause, fin de partie. */
import { CFG, save, persist, recordRun } from './save.ts';
import { $, fmtT, svgIcon } from './util.ts';
import { AU } from './audio.ts';
import { IN, etat, fx, game, keys, leaveRun, music } from './sim/state.ts';
import { view } from './render/view.ts';
import { touchUI } from './input.ts';
import { RAR, ROMAN, VERSION } from './config.ts';
import { UPS } from './sim/ups.ts';
import { drawFloor } from './render/floor.ts';
import { newRun, openPortals, rollUps, takeUp } from './sim/rooms.ts';
import { heal } from './sim/combat.ts';
import type { Up } from './sim/ups.ts';
import type { Stats } from './save.ts';

function cardHTML(u: Up, extra = '') {
  const lv = game.taken[u.id] || 0;
  return `<span class="rar">${RAR[u.r].n}</span>${svgIcon(u.ic)}<b>${u.n}</b><p>${u.d}</p>${extra || `<span class="lv">${lv ? 'Niveau ' + (lv + 1) + ' / ' + u.max : 'Nouveau'}</span>`}`;
}
function showChoice() {
  const def = etat.room.type === 'defi';
  const ups = rollUps(3, def);
  $('chTitle').textContent = def ? 'Récompense du défi' : 'Choisis ton pouvoir';
  $('chSub').textContent = def ? 'Le défi est vaincu : les pouvoirs rares se montrent plus souvent.' : 'Une seule amélioration. Elle durera jusqu\'à la fin de la plongée.';
  const box = $('cards'); box.innerHTML = '';
  ups.forEach(u => {
    const b = document.createElement('button'); b.className = 'card'; b.style.setProperty('--rc', RAR[u.r].c); b.innerHTML = cardHTML(u);
    b.onclick = () => { takeUp(u); showOv(null); game.state = 'play'; openPortals(); };
    box.appendChild(b);
  });
  $('chRow').innerHTML = '';
  if (!ups.length) { game.state = 'play'; openPortals(); return; }
  game.state = 'choice'; showOv('oChoice');
}
function showShop() {
  const ups = rollUps(3, true), price = [40, 70, 110];
  $('chTitle').textContent = 'Le Marchand des Failles';
  const box = $('cards'); box.innerHTML = '';
  type Item = { u: Up; p: number; heal?: undefined } | { u?: undefined; p: number; heal: true };
  const items: Item[] = ups.map(u => ({ u, p: price[u.r] }));
  items.push({ heal: true, p: 30 });
  const refresh = () => {
    $('chSub').textContent = 'Tu as ' + game.shards + ' éclats. Achète autant que tu peux, puis continue.';
    [...box.children].forEach((b, i) => b.classList.toggle('poor', items[i].p > game.shards));
  };
  items.forEach(it => {
    const b = document.createElement('button'); b.className = 'card';
    if (it.heal) { b.style.setProperty('--rc', '#6dffb0'); b.innerHTML = `<span class="rar">SOIN</span>${svgIcon('heal')}<b>Fiole de Lumière</b><p>Rend 40 PV</p><span class="price">${it.p} éclats</span>`; }
    else { b.style.setProperty('--rc', RAR[it.u.r].c); b.innerHTML = cardHTML(it.u, `<span class="price">${it.p} éclats</span>`); }
    b.onclick = () => {
      if (it.p > game.shards) { AU.play('warn'); return; }
      game.shards -= it.p; AU.play('buy');
      if (it.heal) heal(40); else takeUp(it.u);
      b.classList.add('sold'); refresh();
      const nxt = box.querySelector<HTMLElement>('.card:not(.sold)') || $('bLeave'); if (nxt) nxt.focus();
    };
    box.appendChild(b);
  });
  $('chRow').innerHTML = '<button class="btn" id="bLeave">CONTINUER</button>';
  $('bLeave').onclick = () => { showOv(null); game.state = 'play'; openPortals(); };
  refresh();
  game.state = 'choice'; showOv('oChoice');
}
/* =========================================================
   MENUS ET FIN DE PARTIE
   ========================================================= */
const OVS = ['oTitle', 'oHelp', 'oSet', 'oChoice', 'oPause', 'oEnd'];
function showOv(id: string | null) {
  OVS.forEach(o => $(o).classList.toggle('on', o === id));
  touchUI.style.visibility = id ? 'hidden' : 'visible';
  if (id) setTimeout(() => { const f = $(id).querySelector<HTMLElement>('.card,.btn.big,.btn'); if (f) f.focus({ preventScroll: true }); }, 60);
}
export function togglePause() {
  if (game.state === 'play' && !etat.P.dead && !game.trans) {
    game.state = 'pause'; renderUps($('pUps')); showOv('oPause'); for (const k in keys) keys[k] = false; IN.mouse.l = IN.mouse.r = false;
  } else if (game.state === 'pause') {
    game.state = 'play'; showOv(null); view.lastT = performance.now();
  } else if (['oHelp', 'oSet'].some(o => $(o).classList.contains('on'))) {
    showOv(view.ovBack);
  }
}
function renderUps(el: HTMLElement) {
  const ids = Object.keys(game.taken);
  el.innerHTML = ids.length ? ids.map(id => { const u = UPS.find(x => x.id === id)!; return `<span style="--rc:${RAR[u.r].c}">${u.n}${game.taken[id] > 1 ? ' ×' + game.taken[id] : ''}</span>`; }).join('') : '<span style="--rc:#8fb4c0">Aucun pouvoir pour l\'instant</span>';
}
function endRun(won: boolean) {
  if (game.state === 'over') return;
  game.state = 'over'; music.target = 0;
  $('endT').textContent = won ? 'La Faille est scellée' : 'La Faille t\'a englouti';
  $('endT').className = won ? 'gold' : 'red';
  $('endS').textContent = won ? 'L\'Archonte Fracturé n\'est plus. Tu remontes vers la lumière, chargé d\'éclats.' : (etat.boss ? 'Si près du but. L\'Archonte t\'attend pour la revanche.' : 'Tu es tombé dans la strate ' + ROMAN[etat.room.z] + '. Chaque plongée est différente : retente ta chance.');
  const st = [['Temps', fmtT(game.runT)], ['Salles traversées', (etat.roomNum + (etat.room.cleared || won ? 1 : 0)) + (won ? ' + boss' : '')], ['Ennemis vaincus', game.kills], ['Éclats', game.shards], ['Dégâts infligés', Math.round(game.dealt).toLocaleString('fr-FR')], ['Pouvoirs', Object.values(game.taken).reduce((a, b) => a + b, 0)]];
  $('endStats').innerHTML = st.map(s => `<div><b>${s[1]}</b><small>${s[0]}</small></div>`).join('');
  renderUps($('endUps'));
  const score = (won ? 1000 : 0) + game.roomsDone * 10 + (etat.boss ? (1 - Math.max(0, etat.boss.hp) / etat.boss.maxHp) * 9 : 0);
  recordRun({ score, won, rooms: game.roomsDone, time: game.runT }, { kills: game.kills, deepest: etat.boss ? 3 : etat.stageIdx });
  showBest();
  showOv('oEnd');
}
function showBest() {
  const b = save.best;
  $('best').textContent = b ? (b.won ? 'Meilleure plongée : Archonte vaincu en ' + fmtT(b.time) : 'Meilleure plongée : ' + b.rooms + ' salle' + (b.rooms > 1 ? 's' : '') + ' purifiée' + (b.rooms > 1 ? 's' : '')) : '';
  const c = save.stats;
  $('career').textContent = c.runs ? careerText(c) : '';
}
function careerText(c: Stats) {
  const nf = (n: number) => n.toLocaleString('fr-FR');
  const deep = c.deepest >= 3 ? 'Archonte atteint' : 'strate ' + ROMAN[c.deepest] + ' atteinte';
  return `${nf(c.runs)} plongée${c.runs > 1 ? 's' : ''} · ${nf(c.wins)} victoire${c.wins > 1 ? 's' : ''} · ${nf(c.kills)} ennemis vaincus · ${deep}`;
}
showBest();
$('bPlay').onclick = () => { AU.init(); newRun(); };
$('bAgain').onclick = () => { AU.init(); newRun(); };
$('bMenu').onclick = () => { leaveRun(); showOv('oTitle'); };
$('bHelp').onclick = () => { view.ovBack = 'oTitle'; showOv('oHelp'); };
$('bHelpP').onclick = () => { view.ovBack = 'oPause'; showOv('oHelp'); };
$('bSetT').onclick = () => { view.ovBack = 'oTitle'; showOv('oSet'); };
$('bSetP').onclick = () => { view.ovBack = 'oPause'; showOv('oSet'); };
$('bHelpBack').onclick = () => showOv(view.ovBack);
$('bSetBack').onclick = () => showOv(view.ovBack);
$('bResume').onclick = () => togglePause();
$('bQuit').onclick = () => { etat.P.dead = true; endRun(false); };
const vMus = $<HTMLInputElement>('vMus'), vSfx = $<HTMLInputElement>('vSfx');
vMus.value = String(CFG.mus);
vSfx.value = String(CFG.sfx);
vMus.oninput = () => { CFG.mus = +vMus.value; persist(); AU.vol(); };
vSfx.oninput = () => { CFG.sfx = +vSfx.value; persist(); AU.vol(); AU.play('hit'); };
function tg(id: string, key: 'shake'|'glow') { const el = $(id); const upd = () => { el.classList.toggle('on', CFG[key]); el.textContent = CFG[key] ? 'OUI' : 'NON'; }; upd(); el.onclick = () => { CFG[key] = !CFG[key]; persist(); upd(); }; }
tg('tgShake', 'shake');
tg('tgGlow', 'glow');
setInterval(() => { if (!document.hidden) $('tNova').classList.toggle('rdy', etat.P.nova >= 100); }, 150);

// liaisons appelées par les règles (rooms.ts, combat.ts, update.ts), qui ne touchent jamais au DOM
Object.assign(fx, { overlay: showOv, roomLoaded: drawFloor, choice: showChoice, shop: showShop, end: endRun });
$('ver').textContent = 'v' + VERSION;
