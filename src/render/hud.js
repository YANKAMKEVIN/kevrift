// @ts-check
/** Interface dessinée sur la toile : vie, nova, esquives, éclats, progression, boss, bannières, transition. */
import { H, ROMAN, TAU, W, ZONES } from '../config.js';
import { clamp, lerp } from '../sim/math.js';
import { etat, game } from '../sim/state.js';
import { ctx } from './canvas.js';

export function drawHUD() {
  const Z = ZONES[etat.room.z];
  // vie
  const hx = 18, hy = 14, hw = 210;
  ctx.fillStyle = '#000000aa'; ctx.beginPath(); ctx.moveTo(hx - 6, hy - 6); ctx.lineTo(hx + hw + 14, hy - 6); ctx.lineTo(hx + hw + 4, hy + 42); ctx.lineTo(hx - 6, hy + 42); ctx.fill();
  ctx.fillStyle = '#2a0a12'; ctx.fillRect(hx, hy, hw, 14);
  const hpw = hw * clamp(etat.P.hp / etat.S.maxHp, 0, 1);
  const hg = ctx.createLinearGradient(hx, 0, hx + hw, 0); hg.addColorStop(0, '#ff2d55'); hg.addColorStop(1, '#ff7a9a');
  ctx.fillStyle = hg; ctx.fillRect(hx, hy, hpw, 14);
  ctx.fillStyle = '#ffffff55'; ctx.fillRect(hx, hy, hpw, 3);
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1; for (let i = 25; i < etat.S.maxHp; i += 25) { const x = hx + hw * i / etat.S.maxHp; ctx.beginPath(); ctx.moveTo(x, hy); ctx.lineTo(x, hy + 14); ctx.stroke(); }
  ctx.font = "700 12px 'Chakra Petch'"; ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
  ctx.fillText(Math.ceil(etat.P.hp) + ' / ' + etat.S.maxHp, hx + 6, hy + 11.5);
  // nova
  const nr = etat.P.nova / 100;
  ctx.fillStyle = '#1a1a10'; ctx.fillRect(hx, hy + 20, hw * .7, 7);
  ctx.fillStyle = nr >= 1 ? (Math.floor(game.t * 6) % 2 ? '#ffd45a' : '#fff3b0') : '#c9a63a'; ctx.fillRect(hx, hy + 20, hw * .7 * nr, 7);
  ctx.font = "700 10px 'Chakra Petch'"; ctx.fillStyle = nr >= 1 ? '#ffd45a' : '#bba870';
  ctx.fillText(nr >= 1 ? 'NOVA PRÊTE' : 'NOVA', hx + hw * .7 + 6, hy + 27);
  // esquives
  for (let i = 0; i < etat.S.dashMax; i++) {
    const x = hx + i * 14, y = hy + 31, full = i < etat.P.dashCh;
    ctx.fillStyle = full ? '#8fe9ff' : '#24434a';
    ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x + 5, y); ctx.lineTo(x + 10, y + 4); ctx.lineTo(x + 5, y + 8); ctx.fill();
  }
  if (etat.S.shield) { ctx.fillStyle = etat.P.shieldT <= 0 ? '#8fe9ff' : '#8fe9ff44'; ctx.font = "700 10px 'Chakra Petch'"; ctx.fillText(etat.P.shieldT <= 0 ? 'BOUCLIER' : 'BOUCLIER ' + Math.ceil(etat.P.shieldT) + ' s', hx + etat.S.dashMax * 14 + 8, hy + 39); }
  // haut droite : éclats et progression
  ctx.textAlign = 'right';
  ctx.font = "700 16px 'Chakra Petch'"; ctx.fillStyle = '#c9fff8';
  ctx.fillText(String(game.shards), W - 34, 28);
  ctx.fillStyle = '#3ff3e0'; ctx.beginPath(); const sx = W - 24, sy = 22; ctx.moveTo(sx, sy - 7); ctx.lineTo(sx + 4, sy); ctx.lineTo(sx, sy + 7); ctx.lineTo(sx - 4, sy); ctx.fill();
  // pastilles de salles
  const total = 12, done = etat.roomNum + (etat.room.cleared ? 1 : 0);
  const px0 = W - 22 - total * 12;
  for (let i = 0; i < total; i++) {
    const x = px0 + i * 12, y = 44, isB = i === total - 1, cur = i === etat.roomNum;
    const z = i < 4 ? 0 : i < 8 ? 1 : 2;
    ctx.fillStyle = i < done ? ZONES[z].acc : cur ? '#ffffff' : '#ffffff22';
    if (isB) { ctx.beginPath(); ctx.arc(x + 4, y, 5, 0, TAU); ctx.fill(); }
    else { ctx.fillRect(x, y - 3, 8, 6); }
  }
  // nom de la strate
  ctx.textAlign = 'center'; ctx.font = "700 11px 'Chakra Petch'"; ctx.fillStyle = Z.acc + 'aa';
  const label = etat.room.type === 'boss' ? 'FOND DE LA FAILLE' : 'STRATE ' + ROMAN[etat.room.z] + ' · ' + Z.name;
  if (!etat.boss) ctx.fillText(label, W / 2, 24);
  // barre du boss
  if (etat.boss && !etat.boss.dead) {
    const bw = 460, bx = W / 2 - bw / 2, by = H - 30;
    ctx.fillStyle = '#000000b0'; ctx.fillRect(bx - 4, by - 18, bw + 8, 30);
    ctx.font = "800 11px Unbounded,sans-serif"; ctx.fillStyle = '#ffd45a'; ctx.fillText('L\'ARCHONTE FRACTURÉ', W / 2, by - 5);
    ctx.fillStyle = '#2a0a12'; ctx.fillRect(bx, by, bw, 8);
    const bg = ctx.createLinearGradient(bx, 0, bx + bw, 0); bg.addColorStop(0, '#c77dff'); bg.addColorStop(1, '#ffd45a');
    ctx.fillStyle = bg; ctx.fillRect(bx, by, bw * Math.max(0, etat.boss.hp / etat.boss.maxHp), 8);
    ctx.fillStyle = '#000'; ctx.fillRect(bx + bw * .33, by, 2, 8); ctx.fillRect(bx + bw * .66, by, 2, 8);
  }
  // indice de portail
  if (etat.portals.length && !game.trans && game.state === 'play') {
    ctx.font = "700 13px 'Chakra Petch'"; ctx.fillStyle = '#ffffff' + (Math.floor(game.t * 2) % 2 ? 'cc' : '88');
    ctx.fillText(etat.portals.length > 1 ? 'Choisis ton chemin : entre dans un portail' : 'Entre dans le portail', W / 2, H - 48);
  }
  // bannière
  if (game.banner) {
    const b = game.banner, a = Math.min(1, b.life * 2, (2.6 - b.life) * 4);
    ctx.globalAlpha = a;
    const y = b.big ? H / 2 - 60 : 110;
    ctx.fillStyle = '#000000aa'; ctx.fillRect(0, y - 40, W, b.s ? 66 : 52);
    ctx.fillStyle = Z.acc; ctx.fillRect(0, y - 40, W, 2); ctx.fillRect(0, y + (b.s ? 24 : 10), W, 2);
    ctx.font = `900 ${b.big ? 34 : 28}px Unbounded,sans-serif`; ctx.fillStyle = '#ffffff';
    const sp = (1 - Math.min(1, (2.6 - b.life) * 2)) * 30;
    ctx.fillText(b.t, W / 2 + sp, y);
    if (b.s) { ctx.font = "500 15px 'Chakra Petch'"; ctx.fillStyle = Z.acc; ctx.fillText(b.s, W / 2 - sp, y + 18); }
    ctx.globalAlpha = 1;
  }
}
export function drawTrans() {
  const q = (game.trans ? game.trans.t : 0) / .9;
  const p = q < .5 ? q * 2 : (1 - q) * 2; // couvre puis découvre
  const e = p * p * (3 - 2 * p);
  ctx.fillStyle = '#020507';
  const x = lerp(-300, W + 300, q < .5 ? e * .5 + 0 : 1 - e * .5);
  ctx.globalAlpha = 1;
  ctx.beginPath();
  if (q < .5) { ctx.moveTo(-200, 0); ctx.lineTo(x + 200, 0); ctx.lineTo(x - 200, H); ctx.lineTo(-200, H); }
  else { ctx.moveTo(x + 200, 0); ctx.lineTo(W + 400, 0); ctx.lineTo(W + 400, H); ctx.lineTo(x - 200, H); }
  ctx.fill();
  const ex = q < .5 ? x : x;
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = '#3ff3e0'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(ex + 200, 0); ctx.lineTo(ex - 200, H); ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  // plein écran au milieu
  if (q > .38 && q < .62) { ctx.fillStyle = '#020507'; ctx.fillRect(0, 0, W, H); }
}
