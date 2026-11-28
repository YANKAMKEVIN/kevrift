# KEVRIFT

Roguelike d'action vu de dessus, jouable directement dans le navigateur. Tu es un guerrier de cristal qui plonge dans la Faille : trois strates de salles générées au hasard, des améliorations à choisir entre chaque salle, et l'Archonte Fracturé qui t'attend au fond. Une partie dure de 10 à 15 minutes.

## Jouer

En ligne : https://yankamkevin.github.io/kevrift/ (une fois GitHub Pages activé).

En local (Node 22.18 ou plus récent) : le jeu est écrit en TypeScript, servi par Vite qui le compile à la volée. La musique et les sons sont toujours générés pendant la partie.

```bash
npm ci
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

Version 1.2.0 (affichée sur l'écran titre). Le code est en **TypeScript strict** (`src/**/*.ts`, aucun `any`). `npm run build` produit la version regroupée et minifiée dans `dist/` (Vite) ; c'est elle que GitHub Pages publie, par le workflow `.github/workflows/pages.yml`, à chaque fusion dans `main`.

Le code est séparé en deux mondes :

- **`src/sim/`, la simulation** : règles pures et déterministes, sans DOM. Un hasard à graine (`seed(n)`, mulberry32) ; le son passe par un port (`sfx`, `music`) et l'interface par `fx`. Elle tourne telle quelle sous Node (tests, bot).
- **`src/render/`, le rendu** et l'interface (`ui.ts`, `input.ts`, `audio.ts`) : ils lisent l'état de la simulation et ont leur propre hasard cosmétique, pour qu'une même graine donne toujours la même plongée.

| Fichier | Rôle |
|---|---|
| `src/config.ts` | Données : strates, plan d'une plongée, ennemis, boss, portails. |
| `src/sim/types.ts` | Types des entités : ennemis, Archonte, projectiles, particules, ramassables, salles, portails. |
| `src/sim/state.ts` | État de la plongée, commandes, ports vers l'interface et le son. |
| `src/sim/math.ts` | Hasard à graine, calculs, filtrage sur place (pas d'allocation par image). |
| `src/sim/rooms.ts` | Plongée et salles : génération, vagues, portails, progression, cartes de pouvoir. |
| `src/sim/combat.ts`, `boss.ts`, `effects.ts`, `ups.ts` | Combat, ennemis, Archonte et ses phases, effets, les 26 pouvoirs. |
| `src/sim/update.ts` | Une image de jeu. |
| `src/sim/bot.ts` | Bot qui joue des plongées entières (tests et `npm run bot`). |
| `src/render/*.ts` | Toile et densité de pixels, sol, héros, ennemis, HUD, écran titre. |
| `src/save.ts` | Sauvegarde versionnée. |
| `src/ui.ts`, `src/input.ts`, `src/audio.ts`, `src/art.ts` | Écrans, entrées (clavier, souris, manette, tactile), son, visuels peints. |

Types : `npm run types` (`tsc` en mode strict, `noUnusedLocals`, `noImplicitReturns`…, aussi sur `tools/` et `vite.config.ts`). Les imports sont écrits en `.ts` et sans syntaxe propre à TypeScript à l'exécution : Node 22.18+ exécute la simulation telle quelle (`node tools/bot.ts`).
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
npm test            # types + unitaires + bot + construction + fumée (sources et dist) + plongée complète + commandes
npm run bot -- --parties 50   # le bot joue 50 plongées libres et 50 gardées
```

- `npm run unit` (vitest, 330+ tests) : génération des salles sur 40 graines, vagues et budgets, portails et progression des strates, combat (critiques, recul, combo, renvoi, bouclier, épines, dernier souffle, esquive, Nova), effet exact des 26 pouvoirs, tirage des cartes, phases et mort de l'Archonte, sauvegarde (migration, palmarès, carrière, données abîmées, stockage bloqué ou plein), déterminisme, règles d'architecture (simulation sans DOM, fichiers de moins de 400 lignes, tout en TypeScript sans `any`).
- Empreinte (`tests/unit/empreinte.test.mjs`) : un rejeu à commandes scriptées, dont l'état complet est haché à chaque image, et les bilans du bot sur 40 plongées doivent rester identiques bit pour bit (`tests/unit/empreinte.json`). Toute réécriture sans changement de règles doit la garder ; un changement voulu des règles la régénère avec `EMPREINTE_ECRIRE=1 npx vitest run tests/unit/empreinte.test.mjs`.
- `npm run bot` : un bot joue de vraies plongées sur la simulation, sans navigateur et sans tricher (il esquive, frappe, tire, choisit ses pouvoirs, achète, prend les portails). Il vérifie des invariants à chaque image. En mode gardé (PV remis au maximum), il doit battre l'Archonte à chaque graine.
- `npm run smoke` (et `smoke:dist` sur la version construite) : le jeu joue tout seul sur ordinateur, iPhone SE et Pixel 7 couché ; échoue sur toute erreur console, un bouton hors écran, une page qui déborde ou une chute d'images/s.
- `npm run partie` : dans le navigateur, le héros bouge et frappe au clavier, l'onglet caché met en pause et arrête la boucle, puis une plongée assistée va jusqu'à l'écran de victoire en cliquant les vraies cartes ; record, palmarès, carrière, réglages, ancien format et sauvegarde abîmée vérifiés après rechargement.
- `npm run commandes` : 80 vérifications dans le navigateur, au clavier et à la souris (menus, 4 directions, diagonale, chaque action, pause, pas de touche collée), à la manette simulée (navigation des menus, sticks et zone morte, chaque bouton, front montant, manette débranchée) et au tactile réel envoyé par le navigateur (joystick, chaque bouton, deux doigts à la fois, boutons d'au moins 44 px, ni défilement ni zoom).

Les tests de navigateur démarrent eux-mêmes Vite (ou servent `dist/` avec `SITE_DIR=dist`) sur un port libre entre 5200 et 5999.

La CI GitHub (`.github/workflows/tests.yml`) lance tout sur chaque PR et bloque en cas d'échec. GitHub Pages est publié par `.github/workflows/pages.yml` (source de Pages : « GitHub Actions »).
