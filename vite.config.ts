// Vite : serveur de développement (npm start, TypeScript compilé à la volée) et construction
// de la version publiable (npm run build -> dist/, publiée sur GitHub Pages par .github/workflows/pages.yml).
// Vitest (tests unitaires) lit aussi ce fichier.
import { defineConfig } from 'vitest/config';
import { cpSync } from 'node:fs';

export default defineConfig({
  base: './',
  publicDir: false,
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022', sourcemap: true },
  plugins: [{
    // les visuels sont chargés par leur nom au moment du jeu (src/art.ts) : on les copie tels quels
    name: 'copier-visuels',
    closeBundle() { cpSync('art', 'dist/art', { recursive: true }); },
  }],
  test: { include: ['tests/unit/**/*.test.{ts,mjs}'], testTimeout: 180000, maxWorkers: 2, minWorkers: 1 },
});
