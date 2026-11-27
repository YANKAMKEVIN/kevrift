// @ts-check
/** Sol de la salle, dessiné une fois par salle dans une toile en cache. */
import { BORDER, H, TAU, W, ZONES } from '../config.js';
import { frnd as rnd } from '../util.js';
import { etat } from '../sim/state.js';
import { ZONE_ART, art } from '../art.js';

/** Toile du sol (deux fois la taille logique, pour rester net). */
export const floorC = document.createElement('canvas');
floorC.width = W * 2;
floorC.height = H * 2;
const fctx = /** @type {CanvasRenderingContext2D} */ (floorC.getContext('2d'));

/* --- dessin du sol, mis en cache --- */
export function drawFloor() {
  const Z = ZONES[etat.room.z], g = fctx;
  g.setTransform(2, 0, 0, 2, 0, 0);
  g.fillStyle = Z.bg; g.fillRect(0, 0, W, H);
  const sol = art(ZONE_ART[etat.room.z]);
  let gr = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 560);
  if (sol) {
    // sol peint, assombri pour que les ennemis et projectiles ressortent
    g.drawImage(sol, 0, 0, W, H);
    g.fillStyle = Z.bg + '73'; g.fillRect(0, 0, W, H);
  } else {
    gr.addColorStop(0, Z.floor + 'cc'); gr.addColorStop(1, Z.bg + '00');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // dalles en losange
    g.strokeStyle = Z.acc + '14'; g.lineWidth = 1;
    for (let i = -H; i < W + H; i += 48) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + H, H); g.stroke(); g.beginPath(); g.moveTo(i, H); g.lineTo(i + H, 0); g.stroke(); }
  }
  // fissures lumineuses
  g.lineCap = 'round';
  for (let k = 0; k < 7; k++) {
    let x = rnd(BORDER, W - BORDER), y = rnd(BORDER, H - BORDER), a = rnd(TAU);
    const pts = [[x, y]];
    for (let i = 0; i < 5 + Math.floor(Math.random() * 7); i++) { a += rnd(-.9, .9); x += Math.cos(a) * rnd(14, 34); y += Math.sin(a) * rnd(14, 34); pts.push([x, y]); }
    for (const [lw, al] of /** @type {[number, string][]} */ ([[7, '10'], [3, '30'], [1.2, '90']])) {
      g.strokeStyle = Z.acc + al; g.lineWidth = lw; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
    }
  }
  // cercle de runes central
  g.strokeStyle = Z.acc + '18'; g.lineWidth = 2;
  g.beginPath(); g.arc(W / 2, H / 2, 150, 0, TAU); g.stroke();
  g.beginPath(); g.arc(W / 2, H / 2, 120, 0, TAU); g.setLineDash([4, 10]); g.stroke(); g.setLineDash([]);
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.save(); g.translate(W / 2 + Math.cos(a) * 135, H / 2 + Math.sin(a) * 135); g.rotate(a); g.strokeRect(-4, -4, 8, 8); g.restore(); }
  // petits cristaux
  for (let i = 0; i < 40; i++) {
    const x = rnd(BORDER, W - BORDER), y = rnd(BORDER, H - BORDER), s = rnd(2, 5);
    g.fillStyle = Z.acc + (Math.random() < .3 ? '55' : '22');
    g.beginPath(); g.moveTo(x, y - s * 1.6); g.lineTo(x + s, y); g.lineTo(x, y + s * .6); g.lineTo(x - s, y); g.fill();
  }
  // ombres des murs
  g.fillStyle = '#00000066';
  for (const w of etat.room.walls) if (!w.b) g.fillRect(w.x + 6, w.y + 10, w.w, w.h + 6);
  // murs
  for (const w of etat.room.walls) {
    if (w.b) continue;
    const dep = 12;
    g.fillStyle = Z.wall; g.fillRect(w.x, w.y + w.h - dep, w.w, dep + 4);
    gr = g.createLinearGradient(w.x, w.y - dep, w.x, w.y + w.h);
    gr.addColorStop(0, Z.wallTop); gr.addColorStop(1, Z.wall);
    g.fillStyle = gr; g.fillRect(w.x, w.y - dep, w.w, w.h);
    g.strokeStyle = Z.acc + 'aa'; g.lineWidth = 1.5; g.strokeRect(w.x + .75, w.y - dep + .75, w.w - 1.5, w.h - 1.5);
    g.strokeStyle = Z.acc + '33'; g.beginPath(); g.moveTo(w.x + 4, w.y - dep + 4); g.lineTo(w.x + w.w - 4, w.y + w.h - dep - 4); g.stroke();
    g.fillStyle = Z.acc + '22'; g.fillRect(w.x, w.y + w.h - dep, w.w, 2);
  }
  // enceinte
  gr = g.createLinearGradient(0, 0, 0, BORDER);
  g.fillStyle = Z.wall;
  g.fillRect(0, 0, W, BORDER); g.fillRect(0, H - BORDER, W, BORDER); g.fillRect(0, 0, BORDER, H); g.fillRect(W - BORDER, 0, BORDER, H);
  g.fillStyle = Z.wallTop; g.fillRect(0, 0, W, BORDER - 10); g.fillRect(0, 0, BORDER - 8, H); g.fillRect(W - BORDER + 8, 0, BORDER, H); g.fillRect(0, H - BORDER + 8, W, BORDER);
  g.strokeStyle = Z.acc + 'cc'; g.lineWidth = 2; g.strokeRect(BORDER, BORDER, W - BORDER * 2, H - BORDER * 2);
  g.strokeStyle = Z.acc + '33'; g.lineWidth = 8; g.strokeRect(BORDER + 4, BORDER + 4, W - BORDER * 2 - 8, H - BORDER * 2 - 8);
  for (let i = 0; i < 4; i++) { const cx = i % 2 ? W - BORDER / 2 : BORDER / 2, cy = i < 2 ? BORDER / 2 : H - BORDER / 2; g.fillStyle = Z.acc; g.beginPath(); g.moveTo(cx, cy - 7); g.lineTo(cx + 7, cy); g.lineTo(cx, cy + 7); g.lineTo(cx - 7, cy); g.fill(); }
  // vignette
  gr = g.createRadialGradient(W / 2, H / 2, 260, W / 2, H / 2, 620);
  gr.addColorStop(0, '#0000'); gr.addColorStop(1, '#000a');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
}
