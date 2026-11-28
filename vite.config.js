// @ts-check
// Construction de la version publiable (dist/) : modules regroupés et minifiés.
// Le jeu reste jouable sans construction (GitHub Pages publie main tel quel) ;
// la CI construit dist/ et y fait tourner le test de fumée pour vérifier le paquet.
import { defineConfig } from 'vite';
import { cpSync } from 'node:fs';

export default defineConfig({
  base: './',
  publicDir: false,
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022', sourcemap: true },
  plugins: [{
    // les visuels sont chargés par leur nom au moment du jeu (art.js) : on les copie tels quels
    name: 'copier-visuels',
    closeBundle() { cpSync('art', 'dist/art', { recursive: true }); },
  }],
  test: { include: ['tests/unit/**/*.test.{js,mjs}'], testTimeout: 30000 },
});
