// Bot headless : joue des plongées complètes sur la simulation (sans navigateur) et en tire des statistiques.
//   npm run bot                       10 plongées libres + 10 gardées
//   npm run bot -- --parties 50       50 de chaque
//   npm run bot -- --graine 7         une seule graine, détaillée
// Échoue (code 1) si une plongée n'arrive pas au bout, si un invariant casse,
// ou si une plongée gardée (PV remis au maximum) ne bat pas l'Archonte.
import { playRun } from '../src/sim/bot.js';

const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i < 0 ? def : Number(process.argv[i + 1]); };
const N = arg('parties', 10), only = arg('graine', NaN);
const seeds = Number.isNaN(only) ? Array.from({ length: N }, (_, i) => i + 1) : [only];
const problems = [];
const t0 = Date.now();

for (const guard of [false, true]) {
  const rows = seeds.map(seed => ({ seed, ...playRun({ seed, guard }) }));
  const won = rows.filter(r => r.won).length;
  const avg = k => (rows.reduce((a, r) => a + r[k], 0) / rows.length).toFixed(1);
  const reached = rows.filter(r => r.bossHp >= 0).length;
  console.log(`\n${guard ? 'Plongées gardées (PV remis au maximum)' : 'Plongées libres'} : ${rows.length}`);
  console.log(`  victoires ${won}/${rows.length} · boss atteint ${reached}/${rows.length} · salles ${avg('rooms')} · ennemis ${avg('kills')} · coups reçus ${avg('hits')} · durée ${(rows.reduce((a, r) => a + r.frames, 0) / rows.length / 60).toFixed(0)} s de jeu`);
  for (const r of rows) {
    if (seeds.length === 1 || !r.ended || r.errors.length || (guard && !r.won)) {
      console.log(`  graine ${r.seed} : ${r.won ? 'VICTOIRE' : r.ended ? 'défaite' : 'INACHEVÉE'} · ${r.path.join(' > ')} · boss ${r.bossHp} · ${r.errors.slice(0, 3).join(' | ')}`);
    }
    if (!r.ended) problems.push(`graine ${r.seed}${guard ? ' (gardée)' : ''} : plongée inachevée`);
    if (r.errors.length) problems.push(`graine ${r.seed}${guard ? ' (gardée)' : ''} : ${r.errors[0]}`);
    if (guard && !r.won) problems.push(`graine ${r.seed} (gardée) : l'Archonte n'est pas vaincu`);
  }
}
console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (problems.length) { console.log('\nÉCHEC\n  ' + problems.join('\n  ')); process.exit(1); }
console.log('Bot : toutes les plongées sont allées au bout.');
