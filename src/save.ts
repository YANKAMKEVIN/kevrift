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

export interface Cfg { mus: number; sfx: number; shake: boolean; glow: boolean }
/** score : 1000 si victoire + 10 par salle + avancée sur le boss ; time : durée de la plongée en secondes. */
export interface Best { score: number; won: boolean; rooms: number; time: number }
/** Carrière (toutes plongées confondues) : n'influence jamais le jeu, elle se lit sur l'écran titre.
 * deepest : strate la plus profonde atteinte (0 à 2, 3 = boss atteint). */
export interface Stats { runs: number; wins: number; kills: number; rooms: number; time: number; deepest: number }
export interface SaveData { version: number; cfg: Cfg; best: Best | null; top: Best[]; stats: Stats }
/** Données lues d'un JSON, pas encore vérifiées. */
type Raw = Record<string, unknown>;
const isRaw = (x: unknown): x is Raw => typeof x === 'object' && x !== null;

export function emptyStats(): Stats { return { runs: 0, wins: 0, kills: 0, rooms: 0, time: 0, deepest: 0 }; }
export function defaults(): SaveData { return { version: SAVE_VERSION, cfg: { mus: 70, sfx: 80, shake: true, glow: true }, best: null, top: [], stats: emptyStats() }; }

const numIn = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const intIn = (v: unknown, lo: number, hi: number) => Number.isInteger(v) && numIn(v, lo, hi);

export function isCfg(c: unknown): c is Cfg { return isRaw(c) && intIn(c.mus, 0, 100) && intIn(c.sfx, 0, 100) && typeof c.shake === 'boolean' && typeof c.glow === 'boolean'; }
export function isBest(b: unknown): b is Best { return isRaw(b) && numIn(b.score, 0, 1e6) && typeof b.won === 'boolean' && intIn(b.rooms, 0, 1000) && numIn(b.time, 0, 864000); }
export function isStats(s: unknown): s is Stats {
  return isRaw(s) && intIn(s.runs, 0, 1e9) && intIn(s.wins, 0, s.runs as number) && intIn(s.kills, 0, 1e12) && intIn(s.rooms, 0, 1e9) && numIn(s.time, 0, 1e12) && intIn(s.deepest, 0, 3);
}

/** Amène une sauvegarde d'une version antérieure à SAVE_VERSION ; null si inconnue ou trop récente. */
export function migrate(d: unknown): Raw | null {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const v = (d as Raw).version;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > SAVE_VERSION) return null;
  let out: Raw = structuredClone(d as Raw);
  if (out.version === 1) out = v1ToV2(out);
  // Étapes futures, à chaîner ici : if (out.version === 2) out = v2ToV3(out);
  return out;
}
/** v1 -> v2 : ajout du palmarès (le record en devient la première ligne) et de la carrière. */
export function v1ToV2(d: Raw) {
  const best = isBest(d.best) ? d.best : null;
  const stats = emptyStats();
  if (best) { stats.runs = 1; stats.wins = best.won ? 1 : 0; stats.rooms = best.rooms; stats.time = best.time; stats.deepest = best.won ? 3 : 0; }
  return { ...d, version: 2, top: best ? [{ ...best }] : [], stats };
}

export function isValid(d: unknown): d is SaveData {
  return isRaw(d) && d.version === SAVE_VERSION && isCfg(d.cfg) && (d.best === null || isBest(d.best))
    && Array.isArray(d.top) && d.top.length <= TOP_N && d.top.every(isBest) && isStats(d.stats);
}

/** Texte -> sauvegarde valide, ou null. */
export function parse(text: string | null) {
  if (text == null) return null;
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  const d = migrate(raw);
  return isValid(d) ? d : null;
}

/** Ancien format : deux clés JSON séparées ; on garde ce qui est lisible. */
export function fromLegacy(cfgText: string | null, bestText: string | null): SaveData {
  const d = defaults();
  const read = (t: string | null): unknown => { try { return t == null ? null : JSON.parse(t); } catch { return null; } };
  const c = read(cfgText), b = read(bestText);
  if (isRaw(c)) {
    const m: Raw = { ...d.cfg, ...c };
    if (typeof m.mus === 'number') m.mus = Math.round(m.mus);
    if (typeof m.sfx === 'number') m.sfx = Math.round(m.sfx);
    if (isCfg(m)) d.cfg = { mus: m.mus, sfx: m.sfx, shake: m.shake, glow: m.glow };
  }
  if (isBest(b)) { d.best = { score: b.score, won: b.won, rooms: b.rooms, time: b.time }; d.top = [{ ...d.best }]; d.stats = v1ToV2({ best: d.best }).stats; }
  return d;
}

/** Lit la sauvegarde ; reprend l'ancien format ; repart des valeurs par défaut si elle manque ou est abîmée. */
export function load(store: Storage | null): SaveData {
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

export function write(store: Storage | null, d: SaveData): boolean {
  if (!store || !isValid(d)) return false;
  try { store.setItem(KEY, JSON.stringify(d)); return true; } catch { return false; }
}

/** Une plongée bat-elle le record ? Meilleur score, ou victoire plus rapide. */
export function beats(best: Best | null, run: Best) { return !best || run.score > best.score || (run.won && best.won && run.time < best.time); }

/** Classement du palmarès : meilleur score d'abord, puis la victoire la plus rapide. */
export const byRank = (a: Best, b: Best) => b.score - a.score || (a.won && b.won ? a.time - b.time : 0);
/** Ajoute une plongée au palmarès (les TOP_N meilleures). */
export function addToTop(top: Best[], run: Best): Best[] { return [...top, { ...run }].sort(byRank).slice(0, TOP_N); }
/** Ce qu'une plongée ajoute à la carrière en plus de son bilan. */
export interface RunExtra { kills: number; deepest: number }
/** Ajoute une plongée à la carrière. */
export function addToStats(s: Stats, run: Best, extra: RunExtra): Stats {
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
/** Enregistre une plongée (palmarès, carrière) ; renvoie true si elle bat le record. */
export function recordRun(run: Best, extra: RunExtra = { kills: 0, deepest: 0 }) {
  const isBestRun = beats(save.best, run);
  if (isBestRun) save.best = { ...run };
  save.top = addToTop(save.top, run);
  save.stats = addToStats(save.stats, run, extra);
  persist();
  return isBestRun;
}
