// @ts-check
/** État propre à l'affichage (échelle, densité de pixels, horloge, menus) : jamais lu par la simulation. */
export const view = {
  /** Pixels CSS par unité de jeu. */ scale: 1,
  /** Densité de pixels utilisée (plafonnée pour les téléphones). */ dpr: 1,
  /** Horodatage de la dernière image affichée. */ lastT: 0,
  /** Écran auquel revenir depuis l'aide ou les réglages. */ ovBack: 'oTitle',
};
/** Densité de pixels maximale : au-delà, le coût de remplissage explose sur mobile pour un gain invisible. */
export const MAX_DPR = 2;
/** @param {number} devicePixelRatio */
export function cappedDpr(devicePixelRatio) { return Math.min(MAX_DPR, devicePixelRatio > 0 ? devicePixelRatio : 1); }
