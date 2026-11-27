# KEVRIFT

Roguelike d'action vu de dessus, jouable directement dans le navigateur. Tu es un guerrier de cristal qui plonge dans la Faille : trois strates de salles générées au hasard, des améliorations à choisir entre chaque salle, et l'Archonte Fracturé qui t'attend au fond. Une partie dure de 10 à 15 minutes.

## Jouer

En ligne : https://yankamkevin.github.io/kevrift/ (une fois GitHub Pages activé).

En local, le jeu est en modules ES : il faut un petit serveur (un double-clic sur `index.html` ne suffit plus). Les images, la musique et les sons sont toujours générés pendant la partie.

```bash
npm start          # puis ouvrir http://localhost:8000
```

## Commandes

| Action | Clavier et souris | Manette | Tactile |
|---|---|---|---|
| Bouger | ZQSD, WASD ou flèches | Stick gauche | Joystick à gauche de l'écran |
| Viser | Souris | Stick droit (sinon visée auto) | Visée auto |
| Lame | Clic gauche ou J | X ou RT | LAME |
| Rune (tir) | Clic droit ou K | Y ou LT | RUNE |
| Esquive | Espace ou Maj | A ou RB | ESQUIVE |
| Nova | E | B ou LB | NOVA |
| Pause | Échap ou P | Start | II |

## Le jeu

- **Trois strates** : les Jardins de Verre, les Forges Pourpres, puis le Cœur du Néant, chacune avec ses couleurs, ses pièges et sa musique.
- **Sept types d'ennemis** et des champions : nuées rapides, cracheurs, kamikazes, golems qui chargent, tisseurs qui se téléportent, sentinelles en spirale, et des cristaux qui se divisent.
- **26 améliorations** en trois raretés : lames orbitales, éclairs en chaîne, traînée de feu, temps suspendu, dernier souffle, et bien d'autres.
- **Des choix de chemin** : après chaque salle, choisis un portail entre combat, défi, fontaine de soin ou marchand.
- **Le renvoi** : un coup de lame au bon moment renvoie les tirs ennemis.
- **La Nova** : chaque coup remplit une jauge qui déclenche une onde capable de balayer l'écran.
- **Le boss** : l'Archonte Fracturé, en trois phases, avec des spirales, des lasers tournants, des charges et une pluie d'éclats.

Les réglages (volume, secousses, lueur) et ta meilleure partie sont gardés dans ton navigateur.

## Technique

Version 1.1.0 (affichée sur l'écran titre). Pas d'étape de compilation : le navigateur charge `src/main.js`.

| Fichier | Rôle |
|---|---|
| `src/config.js`, `src/ups.js` | Données : strates, plan d'une plongée, ennemis, boss ; les 26 pouvoirs. |
| `src/rooms.js` | Plongée et salles : génération, vagues, portails, progression, pouvoirs. Sans DOM. |
| `src/combat.js`, `src/boss.js`, `src/effects.js` | Combat du héros, ennemis, boss et ses phases, effets. Sans DOM. |
| `src/update.js` | Une image de jeu. Sans DOM : testée sous Node. |
| `src/save.js` | Sauvegarde versionnée. |
| `src/state.js` | État partagé et liaisons vers l'interface. |
| `src/render.js`, `src/input.js`, `src/ui.js`, `src/audio.js` | Dessin, entrées (clavier, souris, manette, tactile), écrans, son. |

Les types sont vérifiés par TypeScript sur le JavaScript (`// @ts-check` + JSDoc, `npm run types`).
`?graine=N` rend une plongée reproductible et `?turbo=N` l'accélère (utilisés par les tests).

## Sauvegarde

Clé `kevrift.sauvegarde` dans le navigateur : `{ version, cfg: { mus, sfx, shake, glow }, best }`.
Tout changement de format incrémente `SAVE_VERSION` et ajoute une étape à `migrate()`.
Une sauvegarde abîmée ou d'une version plus récente est mise de côté sous `kevrift.sauvegarde.abimee`, jamais écrasée.
L'ancien format (`kevrift_cfg` et `kevrift_best`) est repris automatiquement une fois, puis effacé.

## Tests

```bash
npm install
npx playwright install chromium
npm test            # types + unitaires + fumée + plongée complète ; captures dans test-results/
```

- `npm run unit` : plongée complète simulée (3 strates, toutes les salles, boss vaincu), même graine = même plongée, vagues, coups, dégâts, esquive, mort, les 26 pouvoirs, phases du boss, sauvegarde (abîmée, trop récente, stockage bloqué, ancien format, record).
- `npm run smoke` : le jeu joue tout seul sur ordinateur, iPhone SE et Pixel 7 couché ; échoue sur toute erreur console, un bouton hors écran, une page qui déborde ou une chute d'images/s.
- `npm run partie` : dans le navigateur, le héros bouge et frappe au clavier, puis une plongée assistée va jusqu'à l'écran de victoire en cliquant les vraies cartes ; record, réglages, ancien format et sauvegarde abîmée vérifiés après rechargement.

La CI GitHub (`.github/workflows/tests.yml`) lance tout sur chaque PR et bloque en cas d'échec. GitHub Pages publie directement la branche `main` (fichier `.nojekyll`).
