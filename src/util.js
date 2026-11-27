// @ts-check
/** Petits outils de l'interface : accès aux éléments, icônes, format des temps, hasard cosmétique. */
import { ICONS } from './config.js';

/** Élément de la page par son id (la page est fixe : il existe toujours).
 * @param {string} id @returns {any} */
export const $ = id => document.getElementById(id);
/** @param {keyof typeof ICONS} k */
export const svgIcon = k => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${ICONS[k]}</svg>`;
/** @param {number} s secondes */
export const fmtT = s => Math.floor(s / 60) + ' min ' + String(Math.floor(s % 60)).padStart(2, '0');
/** Hasard cosmétique (rendu, son, écran titre) : ne consomme jamais le hasard de la simulation.
 * @param {number} [a] @param {number} [b] */
export const frnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
