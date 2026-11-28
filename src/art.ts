/**
 * Visuels peints avec Codex (dossier art/, prompts dans tools/art/prompts.json).
 * Le jeu reste jouable sans eux : tant qu'une image n'est pas chargée, le dessin
 * procédural d'origine prend le relais.
 */

export const ART_FILES = ([
  'titre', 'sol_jardins', 'sol_forges', 'sol_neant', 'heros',
  'ennemi_mite', 'ennemi_spitter', 'ennemi_bomber', 'ennemi_splitter',
  'ennemi_brute', 'ennemi_weaver', 'ennemi_sentinel', 'archonte',
] as const);

/** Sol peint de chaque zone, dans l'ordre de ZONES. */
export const ZONE_ART = ['sol_jardins', 'sol_forges', 'sol_neant'];

/** visuel de chaque type d'ennemi (les « mini » sont des éclats de splitter) */
export const ENEMY_ART: Record<string, string> = {
  mite: 'ennemi_mite', spitter: 'ennemi_spitter', bomber: 'ennemi_bomber', splitter: 'ennemi_splitter',
  mini: 'ennemi_splitter', brute: 'ennemi_brute', weaver: 'ennemi_weaver', sentinel: 'ennemi_sentinel',
};

const loaded: Map<string, HTMLImageElement> = new Map();

/** Charge tous les visuels. Se résout quand tout est chargé, ou au bout de `maxMs`
(une image lente ou absente ne bloque jamais le jeu). (renvoie nombre d'images prêtes) */
export function loadArt(maxMs = 4000): Promise<number> {
  const all = ART_FILES.map(name => new Promise(res => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { loaded.set(name, im); res(true); };
    im.onerror = () => res(false);
    im.src = `art/${name}.webp`;
  }));
  return Promise.race([
    Promise.all(all),
    new Promise(res => setTimeout(res, maxMs)),
  ]).then(() => loaded.size);
}

/** L'image si elle est prête, sinon null. */
export function art(name: string): HTMLImageElement | null { return loaded.get(name) || null; }
