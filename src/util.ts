/** Petits outils de l'interface : accès aux éléments, icônes, format des temps, hasard cosmétique. */
import { ICONS } from './config.ts';

/** Élément de la page par son id (la page est fixe : il existe toujours). */
export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
export const svgIcon = (k: keyof typeof ICONS) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${ICONS[k]}</svg>`;
/** S : secondes */
export const fmtT = (s: number) => Math.floor(s / 60) + ' min ' + String(Math.floor(s % 60)).padStart(2, '0');
/** Hasard cosmétique (rendu, son, écran titre) : ne consomme jamais le hasard de la simulation. */
export const frnd = (a = 1, b?: number) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
