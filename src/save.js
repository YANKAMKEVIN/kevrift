// @ts-check
/** Sauvegarde versionnée (réglages et meilleure plongée) dans localStorage.
 *
 * Règle : toute modification du format incrémente SAVE_VERSION et ajoute une étape
 * à migrate(). Une sauvegarde abîmée ou plus récente que le jeu n'est jamais
 * écrasée en silence : elle est mise de côté sous KEY + '.abimee' et le jeu repart
 * des valeurs par défaut. L'ancien format (clés kevrift_cfg et kevrift_best) est
 * repris une fois puis effacé. */

export const KEY = 'kevrift.sauvegarde';
export const LEGACY = { cfg: 'kevrift_cfg', best: 'kevrift_best' };
export const SAVE_VERSION = 1;

/** @typedef {{mus:number,sfx:number,shake:boolean,glow:boolean}} Cfg */
/** score : 1000 si victoire + 10 par salle + avancée sur le boss ; time : durée de la plongée en secondes.
 * @typedef {{score:number,won:boolean,rooms:number,time:number}} Best */
/** @typedef {{version:number,cfg:Cfg,best:Best|null}} SaveData */

/** @returns {SaveData} */
export function defaults() { return { version: SAVE_VERSION, cfg: { mus: 70, sfx: 80, shake: true, glow: true }, best: null }; }

/** @param {unknown} v @param {number} lo @param {number} hi */
const numIn = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
/** @param {unknown} v @param {number} lo @param {number} hi */
const intIn = (v, lo, hi) => Number.isInteger(v) && numIn(v, lo, hi);

/** @param {any} c @returns {c is Cfg} */
export function isCfg(c) { return !!c && intIn(c.mus, 0, 100) && intIn(c.sfx, 0, 100) && typeof c.shake === 'boolean' && typeof c.glow === 'boolean'; }
/** @param {any} b @returns {b is Best} */
export function isBest(b) { return !!b && numIn(b.score, 0, 1e6) && typeof b.won === 'boolean' && intIn(b.rooms, 0, 1000) && numIn(b.time, 0, 864000); }

/** Amène une sauvegarde d'une version antérieure à SAVE_VERSION ; null si inconnue ou trop récente.
 * @param {any} d @returns {any} */
export function migrate(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const v = d.version;
  if (!Number.isInteger(v) || v < 1 || v > SAVE_VERSION) return null;
  const out = structuredClone(d);
  // Étapes futures, à chaîner ici :
  // if (out.version === 1) { out = v1ToV2(out); }
  return out;
}

/** @param {any} d @returns {d is SaveData} */
export function isValid(d) { return !!d && d.version === SAVE_VERSION && isCfg(d.cfg) && (d.best === null || isBest(d.best)); }

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
  if (isBest(b)) d.best = { score: b.score, won: b.won, rooms: b.rooms, time: b.time };
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
/** Enregistre une plongée si elle bat le record ; renvoie true si c'est un nouveau record.
 * @param {Best} run */
export function recordRun(run) { if (!beats(save.best, run)) return false; save.best = { ...run }; persist(); return true; }
