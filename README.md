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

Les réglages (volume, secousses, lueur), ta meilleure partie, le palmarès de tes 5 meilleures plongées et ta carrière (plongées, victoires, ennemis vaincus) sont gardés dans ton navigateur.

## Technique

Version 1.2.0 (affichée sur l'écran titre). Pas d'étape de compilation pour jouer : le navigateur charge `src/main.js` (GitHub Pages publie `main` tel quel). `npm run build` produit aussi une version regroupée et minifiée dans `dist/` (Vite), vérifiée par la CI.

Le code est séparé en deux mondes :

- **`src/sim/`, la simulation** : règles pures et déterministes, sans DOM. Un hasard à graine (`seed(n)`, mulberry32) ; le son passe par un port (`sfx`, `music`) et l'interface par `fx`. Elle tourne telle quelle sous Node (tests, bot).
- **`src/render/`, le rendu** et l'interface (`ui.js`, `input.js`, `audio.js`) : ils lisent l'état de la simulation et ont leur propre hasard cosmétique, pour qu'une même graine donne toujours la même plongée.

| Fichier | Rôle |
|---|---|
| `src/config.js` | Données : strates, plan d'une plongée, ennemis, boss, portails. |
| `src/sim/state.js` | État de la plongée, commandes, ports vers l'interface et le son. |
| `src/sim/math.js` | Hasard à graine, calculs, filtrage sur place (pas d'allocation par image). |
| `src/sim/rooms.js` | Plongée et salles : génération, vagues, portails, progression, cartes de pouvoir. |
| `src/sim/combat.js`, `boss.js`, `effects.js`, `ups.js` | Combat, ennemis, Archonte et ses phases, effets, les 26 pouvoirs. |
| `src/sim/update.js` | Une image de jeu. |
| `src/sim/bot.js` | Bot qui joue des plongées entières (tests et `npm run bot`). |
| `src/render/*.js` | Toile et densité de pixels, sol, héros, ennemis, HUD, écran titre. |
| `src/save.js` | Sauvegarde versionnée. |
| `src/ui.js`, `src/input.js`, `src/audio.js`, `src/art.js` | Écrans, entrées (clavier, souris, manette, tactile), son, visuels peints. |

Types : TypeScript strict sur le JavaScript (`// @ts-check` + JSDoc, `noImplicitAny`, `npm run types`).
`?graine=N` rend une plongée reproductible et `?turbo=N` l'accélère (utilisés par les tests).
Perf mobile : densité de pixels plafonnée à 2, boucle d'affichage et son arrêtés quand l'onglet est caché, listes d'entités filtrées sur place.

## Visuels

Les 13 visuels du dossier `art/` ont été peints avec Codex (prompts dans `tools/art/prompts.json`) :
le tableau de l'écran titre, un sol par strate (Jardins de verre, Forges pourpres, Cœur du néant),
le héros, les 7 ennemis et l'Archonte. Les signaux de jeu (visée du cracheur, mèche du kamikaze,
charge de la brute, phases du boss) restent dessinés par-dessus. Si une image manque, le jeu
retombe sur le dessin procédural d'origine.

## Sauvegarde

Clé `kevrift.sauvegarde` dans le navigateur : `{ version: 2, cfg: { mus, sfx, shake, glow }, best, top: [5 meilleures], stats: { runs, wins, kills, rooms, time, deepest } }`.
Tout changement de format incrémente `SAVE_VERSION` et ajoute une étape à `migrate()` (v1 -> v2 : le record devient la première ligne du palmarès).
Une sauvegarde abîmée ou d'une version plus récente est mise de côté sous `kevrift.sauvegarde.abimee`, jamais écrasée. Stockage bloqué ou plein : le jeu tourne quand même.
L'ancien format (`kevrift_cfg` et `kevrift_best`) est repris automatiquement une fois, puis effacé.

## Tests

```bash
npm ci
npm test            # types + unitaires + construction + fumée (sources et dist) + plongée complète
npm run bot -- --parties 50   # le bot joue 50 plongées libres et 50 gardées
```

- `npm run unit` (vitest, 300+ tests) : génération des salles sur 40 graines, vagues et budgets, portails et progression des strates, combat (critiques, recul, combo, renvoi, bouclier, épines, dernier souffle, esquive, Nova), effet exact des 26 pouvoirs, tirage des cartes, phases et mort de l'Archonte, sauvegarde (migration, palmarès, carrière, données abîmées, stockage bloqué ou plein), déterminisme, règles d'architecture (simulation sans DOM, fichiers de moins de 400 lignes).
- `npm run bot` : un bot joue de vraies plongées sur la simulation, sans navigateur et sans tricher (il esquive, frappe, tire, choisit ses pouvoirs, achète, prend les portails). Il vérifie des invariants à chaque image. En mode gardé (PV remis au maximum), il doit battre l'Archonte à chaque graine.
- `npm run smoke` (et `smoke:dist` sur la version construite) : le jeu joue tout seul sur ordinateur, iPhone SE et Pixel 7 couché ; échoue sur toute erreur console, un bouton hors écran, une page qui déborde ou une chute d'images/s.
- `npm run partie` : dans le navigateur, le héros bouge et frappe au clavier, l'onglet caché met en pause et arrête la boucle, puis une plongée assistée va jusqu'à l'écran de victoire en cliquant les vraies cartes ; record, palmarès, carrière, réglages, ancien format et sauvegarde abîmée vérifiés après rechargement.

La CI GitHub (`.github/workflows/tests.yml`) lance tout sur chaque PR et bloque en cas d'échec. GitHub Pages publie directement la branche `main` (fichier `.nojekyll`).
