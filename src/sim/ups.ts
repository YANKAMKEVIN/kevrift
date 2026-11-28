/** Les améliorations (pouvoirs) : effet sur les statistiques du héros. */
import type { ICONS } from '../config.ts';
import { etat } from './state.ts';
import { heal } from './combat.ts';

/** Un pouvoir : r = rareté (0 commun, 1 rare, 2 légendaire), max = niveau maximum, f = effet. */
export interface Up { id: string; n: string; d: string; r: number; ic: keyof typeof ICONS; max: number; f: () => unknown }
export const UPS: Up[] = [
  { id: 'lame', n: 'Lame Affûtée', d: '+25 % de dégâts de mêlée', r: 0, ic: 'blade', max: 5, f: () => etat.S.dmg *= 1.25 },
  { id: 'frenesie', n: 'Frénésie', d: '+18 % de vitesse d\'attaque', r: 0, ic: 'blade', max: 5, f: () => etat.S.atkSpd *= 1.18 },
  { id: 'portee', n: 'Grande Lame', d: '+22 % de portée de mêlée', r: 0, ic: 'blade', max: 3, f: () => etat.S.range *= 1.22 },
  { id: 'crit', n: 'Œil du Prisme', d: '+12 % de chances de coup critique (dégâts ×2,2)', r: 0, ic: 'star', max: 4, f: () => etat.S.crit += .12 },
  { id: 'tirrapide', n: 'Rune Vive', d: 'La rune se recharge 25 % plus vite', r: 0, ic: 'rune', max: 4, f: () => etat.S.shotCd *= .75 },
  { id: 'runeforce', n: 'Rune Lourde', d: '+40 % de dégâts des runes', r: 0, ic: 'rune', max: 4, f: () => etat.S.shotDmg *= 1.4 },
  { id: 'jumelle', n: 'Rune Jumelle', d: '+1 rune par tir', r: 1, ic: 'rune', max: 3, f: () => etat.S.shots++ },
  { id: 'percante', n: 'Rune Perçante', d: 'Les runes traversent 2 ennemis de plus', r: 0, ic: 'rune', max: 3, f: () => etat.S.pierce += 2 },
  { id: 'chercheuse', n: 'Rune Chercheuse', d: 'Les runes filent vers les ennemis', r: 1, ic: 'rune', max: 1, f: () => etat.S.homing = 1 },
  { id: 'ombre', n: 'Pas de l\'Ombre', d: 'L\'esquive se recharge 25 % plus vite', r: 0, ic: 'dash', max: 3, f: () => etat.S.dashCd *= .75 },
  { id: 'double', n: 'Double Pas', d: '+1 charge d\'esquive', r: 1, ic: 'dash', max: 2, f: () => { etat.S.dashMax++; etat.P.dashCh++; } },
  { id: 'sillage', n: 'Sillage Ardent', d: 'L\'esquive laisse une traînée de feu qui brûle les ennemis', r: 1, ic: 'dash', max: 1, f: () => etat.S.burn = 1 },
  { id: 'temps', n: 'Temps Suspendu', d: 'Chaque esquive ralentit le monde un court instant', r: 2, ic: 'dash', max: 1, f: () => etat.S.timeSlow = 1 },
  { id: 'vitesse', n: 'Semelles de Vent', d: '+12 % de vitesse de déplacement', r: 0, ic: 'dash', max: 3, f: () => etat.S.speed *= 1.12 },
  { id: 'coeur', n: 'Cœur de Cristal', d: '+25 PV max et soigne 25 PV', r: 0, ic: 'heart', max: 5, f: () => { etat.S.maxHp += 25; heal(25); } },
  { id: 'vampire', n: 'Soif d\'Éclats', d: 'Chaque ennemi vaincu te rend 2 PV', r: 1, ic: 'heart', max: 3, f: () => etat.S.life += 2 },
  { id: 'bouclier', n: 'Bouclier Prismatique', d: 'Un bouclier bloque un coup et se recharge en 10 s', r: 1, ic: 'heart', max: 1, f: () => { etat.S.shield = 1; etat.P.shieldT = 0; } },
  { id: 'epines', n: 'Épines de Verre', d: 'Quand tu es touché, une onde blesse les ennemis proches', r: 0, ic: 'heart', max: 3, f: () => etat.S.thorns += 45 },
  { id: 'souffle', n: 'Dernier Souffle', d: 'Une fois, survis à un coup fatal avec 50 PV', r: 2, ic: 'heart', max: 1, f: () => etat.S.lastBreath = 1 },
  { id: 'orbite', n: 'Lame Orbitale', d: '+1 lame qui tourne autour de toi', r: 1, ic: 'orb', max: 4, f: () => etat.S.orbit++ },
  { id: 'eclair', n: 'Arc Électrique', d: '25 % de chances qu\'un coup lance un éclair en chaîne', r: 1, ic: 'bolt', max: 3, f: () => etat.S.chain += .25 },
  { id: 'givre', n: 'Lame de Givre', d: 'Tes coups ralentissent les ennemis', r: 0, ic: 'bolt', max: 1, f: () => etat.S.frost = 1 },
  { id: 'echo', n: 'Écho Funeste', d: 'Les ennemis vaincus explosent et blessent leurs voisins', r: 1, ic: 'star', max: 2, f: () => etat.S.explode++ },
  { id: 'surcharge', n: 'Surcharge', d: 'La Nova se charge 40 % plus vite', r: 0, ic: 'nova', max: 3, f: () => etat.S.novaRate *= 1.4 },
  { id: 'novarunes', n: 'Nova Fracturante', d: 'La Nova sème 8 runes qui explosent', r: 2, ic: 'nova', max: 1, f: () => etat.S.novaRunes = 1 },
  { id: 'renvoi', n: 'Miroir Parfait', d: 'Les projectiles renvoyés font +100 % de dégâts', r: 1, ic: 'star', max: 2, f: () => etat.S.reflect += 1 }
];
