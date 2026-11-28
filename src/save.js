// @ts-check
/** Sauvegarde versionnée (réglages, meilleure plongée, palmarès et carrière) dans localStorage.
 *
 * Règle : toute modification du format incrémente SAVE_VERSION et ajoute une étape
 * à migrate(). Une sauvegarde abîmée ou plus récente que le jeu n'est jamais
 * écrasée en silence : elle est mise de côté sous KEY + '.abimee' et le jeu repart
 * des valeurs par défaut. L'ancien format (clés kevrift_cfg et kevrift_best) est
 * repris une fois puis effacé. */

export const KEY = 'kevrift.sauvegarde';
export const LEGACY = { cfg: 'kevrift_cfg', best: 'kevrift_best' };
export const SAVE_VERSION = 2;
/** Nombre de plongées gardées au palmarès. */
export const TOP_N = 5;

/** @typedef {{mus:number,sfx:number,shake:boolean,glow:boolean}} Cfg */
/** score : 1000 si victoire + 10 par salle + avancée sur le boss ; time : durée de la plongée en secondes.
 * @typedef {{score:number,won:boolean,rooms:number,time:number}} Best */
/** Carrière (toutes plongées confondues) : n'influence jamais le jeu, elle se lit sur l'écran titre.
 * deepest : strate la plus profonde atteinte (0 à 2, 3 = boss atteint).
 * @typedef {{runs:number,wins:number,kills:number,rooms:number,time:number,deepest:number}} Stats */
/** @typedef {{version:number,cfg:Cfg,best:Best|null,top:Best[],stats:Stats}} SaveData */

/** @returns {Stats} */
export function emptyStats() { return { runs: 0, wins: 0, kills: 0, rooms: 0, time: 0, deepest: 0 }; }
/** @returns {SaveData} */
export function defaults() { return { version: SAVE_VERSION, cfg: { mus: 70, sfx: 80, shake: true, glow: true }, best: null, top: [], stats: emptyStats() }; }

/** @param {unknown} v @param {number} lo @param {number} hi */
const numIn = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
/** @param {unknown} v @param {number} lo @param {number} hi */
const intIn = (v, lo, hi) => Number.isInteger(v) && numIn(v, lo, hi);

/** @param {any} c @returns {c is Cfg} */
export function isCfg(c) { return !!c && intIn(c.mus, 0, 100) && intIn(c.sfx, 0, 100) && typeof c.shake === 'boolean' && typeof c.glow === 'boolean'; }
/** @param {any} b @returns {b is Best} */
export function isBest(b) { return !!b && numIn(b.score, 0, 1e6) && typeof b.won === 'boolean' && intIn(b.rooms, 0, 1000) && numIn(b.time, 0, 864000); }
/** @param {any} s @returns {s is Stats} */
export function isStats(s) {
  return !!s && intIn(s.runs, 0, 1e9) && intIn(s.wins, 0, s.runs) && intIn(s.kills, 0, 1e12) && intIn(s.rooms, 0, 1e9) && numIn(s.time, 0, 1e12) && intIn(s.deepest, 0, 3);
}

/** Amène une sauvegarde d'une version antérieure à SAVE_VERSION ; null si inconnue ou trop récente.
 * @param {any} d @returns {any} */
export function migrate(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const v = d.version;
  if (!Number.isInteger(v) || v < 1 || v > SAVE_VERSION) return null;
  let out = structuredClone(d);
  if (out.version === 1) out = v1ToV2(out);
  // Étapes futures, à chaîner ici : if (out.version === 2) out = v2ToV3(out);
  return out;
}
/** v1 -> v2 : ajout du palmarès (le record en devient la première ligne) et de la carrière.
 * @param {any} d */
export function v1ToV2(d) {
  const best = isBest(d.best) ? d.best : null;
  const stats = emptyStats();
  if (best) { stats.runs = 1; stats.wins = best.won ? 1 : 0; stats.rooms = best.rooms; stats.time = best.time; stats.deepest = best.won ? 3 : 0; }
  return { ...d, version: 2, top: best ? [{ ...best }] : [], stats };
}

/** @param {any} d @returns {d is SaveData} */
export function isValid(d) {
  return !!d && d.version === SAVE_VERSION && isCfg(d.cfg) && (d.best === null || isBest(d.best))
    && Array.isArray(d.top) && d.top.length <= TOP_N && d.top.every(isBest) && isStats(d.stats);
}

/** Texte -> sauvegarde valide, ou null.
 * @param {string|null} text */
export function parse(text) {
  if (text == null) return null;
  let raw;
  try { raw = JSON.parse(text); } catch { return null; }
  const d = migrate(raw);
  return isValid(d) ? d : null;
}

/** Ancien format : deux clés JSON séparées ; on garde ce qui est lisible.
 * @param {string|null} cfgText @param {string|null} bestText @returns {SaveData} */
export function fromLegacy(cfgText, bestText) {
  const d = defaults();
  /** @param {string|null} t */
  const read = t => { try { return t == null ? null : JSON.parse(t); } catch { return null; } };
  const c = read(cfgText), b = read(bestText);
  if (c && typeof c === 'object') {
    const m = { ...d.cfg, ...c };
    if (typeof m.mus === 'number') m.mus = Math.round(m.mus);
    if (typeof m.sfx === 'number') m.sfx = Math.round(m.sfx);
    if (isCfg(m)) d.cfg = { mus: m.mus, sfx: m.sfx, shake: m.shake, glow: m.glow };
  }
  if (isBest(b)) { d.best = { score: b.score, won: b.won, rooms: b.rooms, time: b.time }; d.top = [{ ...d.best }]; d.stats = v1ToV2({ best: d.best }).stats; }
  return d;
}

/** Lit la sauvegarde ; reprend l'ancien format ; repart des valeurs par défaut si elle manque ou est abîmée.
 * @param {Storage|null} store @returns {SaveData} */
export function load(store) {
  if (!store) return defaults();
  let text = null, lc = null, lb = null;
  try { text = store.getItem(KEY); lc = store.getItem(LEGACY.cfg); lb = store.getItem(LEGACY.best); } catch { return defaults(); }
  if (text == null) {
    if (lc == null && lb == null) return defaults();
    const d = fromLegacy(lc, lb);
    if (write(store, d)) { try { store.removeItem(LEGACY.cfg); store.removeItem(LEGACY.best); } catch { /* bloqué */ } }
    return d;
  }
  const d = parse(text);
  if (d) return d;
  try { store.setItem(KEY + '.abimee', text); store.removeItem(KEY); } catch { /* stockage plein ou bloqué */ }
  return defaults();
}

/** @param {Storage|null} store @param {SaveData} d @returns {boolean} */
export function write(store, d) {
  if (!store || !isValid(d)) return false;
  try { store.setItem(KEY, JSON.stringify(d)); return true; } catch { return false; }
}

/** Une plongée bat-elle le record ? Meilleur score, ou victoire plus rapide.
 * @param {Best|null} best @param {Best} run */
export function beats(best, run) { return !best || run.score > best.score || (run.won && best.won && run.time < best.time); }

/** Classement du palmarès : meilleur score d'abord, puis la victoire la plus rapide.
 * @param {Best} a @param {Best} b */
export const byRank = (a, b) => b.score - a.score || (a.won && b.won ? a.time - b.time : 0);
/** Ajoute une plongée au palmarès (les TOP_N meilleures). @param {Best[]} top @param {Best} run @returns {Best[]} */
export function addToTop(top, run) { return [...top, { ...run }].sort(byRank).slice(0, TOP_N); }
/** Ajoute une plongée à la carrière.
 * @param {Stats} s @param {Best} run @param {{kills:number,deepest:number}} extra @returns {Stats} */
export function addToStats(s, run, extra) {
  return {
    runs: s.runs + 1, wins: s.wins + (run.won ? 1 : 0), kills: s.kills + Math.max(0, Math.floor(extra.kills)),
    rooms: s.rooms + run.rooms, time: s.time + run.time, deepest: Math.max(s.deepest, Math.min(3, Math.max(0, Math.floor(extra.deepest)))),
  };
}

/** Le stockage du navigateur, ou null s'il est bloqué (navigation privée, iframe…). */
export function browserStore() {
  try { const s = window.localStorage; s.getItem(KEY); return s; } catch { return null; }
}

/** Sauvegarde du jeu en cours (modifiée sur place, jamais remplacée). */
export const save = load(browserStore());
/** Réglages en cours (son, secousses, lueurs). */
export const CFG = save.cfg;
/** Écrit la sauvegarde du jeu en cours. */
export function persist() { return write(browserStore(), save); }
/** Enregistre une plongée (palmarès, carrière) ; renvoie true si elle bat le record.
 * @param {Best} run @param {{kills:number,deepest:number}} [extra] */
export function recordRun(run, extra = { kills: 0, deepest: 0 }) {
  const isBestRun = beats(save.best, run);
  if (isBestRun) save.best = { ...run };
  save.top = addToTop(save.top, run);
  save.stats = addToStats(save.stats, run, extra);
  persist();
  return isBestRun;
}
