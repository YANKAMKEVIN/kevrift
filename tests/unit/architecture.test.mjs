// Règles d'architecture : la simulation reste pure (testable sous Node, déterministe), les fichiers restent petits.
import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = new URL('../../src/', import.meta.url).pathname;
const files = dir => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : []; });
const all = files(SRC);
const sim = all.filter(f => relative(SRC, f).startsWith('sim/'));
const code = f => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('architecture', () => {
  test('la simulation existe', () => { expect(sim.length).toBeGreaterThanOrEqual(8); });
  test.each(sim.map(f => [relative(SRC, f), f]))('%s : aucun accès au navigateur', (_, f) => {
    const c = code(f);
    for (const g of ['document', 'window', 'localStorage', 'navigator', 'requestAnimationFrame', 'setTimeout', 'setInterval', 'performance', 'AudioContext']) {
      expect(new RegExp(`\\b${g}\\b`).test(c), g).toBe(false);
    }
  });
  test.each(sim.map(f => [relative(SRC, f), f]))('%s : n\'importe que la simulation et les données', (_, f) => {
    const imports = [...readFileSync(f, 'utf8').matchAll(/from '([^']+)'/g)].map(m => m[1]);
    for (const i of imports) expect(i.startsWith('./') || i === '../config.ts', i).toBe(true);
  });
  test.each(sim.filter(f => !f.endsWith('math.ts')).map(f => [relative(SRC, f), f]))('%s : pas de Math.random (hasard à graine seulement)', (_, f) => {
    expect(code(f)).not.toMatch(/Math\.random/);
  });
  test.each(all.map(f => [relative(SRC, f), f]))('%s : moins de 400 lignes', (_, f) => {
    expect(readFileSync(f, 'utf8').split('\n').length).toBeLessThan(400);
  });
  test('tout le code est en TypeScript (plus aucun .js dans src/)', () => {
    const js = readdirSync(SRC, { recursive: true }).filter(f => /\.(js|mjs)$/.test(String(f)));
    expect(js).toEqual([]);
  });
  test.each(all.map(f => [relative(SRC, f), f]))('%s : typage strict, sans échappatoire (any, @ts-ignore, @ts-nocheck)', (_, f) => {
    const c = code(f);
    expect(c).not.toMatch(/:\s*any\b|\bas any\b|<any>|any\[\]/);
    expect(readFileSync(f, 'utf8')).not.toMatch(/@ts-(ignore|nocheck|expect-error)/);
  });
  test.each(all.map(f => [relative(SRC, f), f]))('%s : imports relatifs explicites en .ts (exécutables tels quels par Node)', (_, f) => {
    const imports = [...readFileSync(f, 'utf8').matchAll(/from '(\.[^']+)'/g)].map(m => m[1]);
    for (const i of imports) expect(i, i).toMatch(/\.ts$/);
  });
  test('les entités de la simulation sont typées (plus de Record<string, any>)', () => {
    const types = readFileSync(join(SRC, 'sim/types.ts'), 'utf8');
    for (const t of ['Enemy', 'Boss', 'Bullet', 'Proj', 'Particle', 'Pick', 'Portal', 'Room']) expect(types, t).toMatch(new RegExp(`(interface|type) ${t}\\b`));
  });
});
