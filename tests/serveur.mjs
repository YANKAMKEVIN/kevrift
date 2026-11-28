// Serveur local des tests de navigateur, sur un port libre tiré entre 5200 et 5999
// (plusieurs jeux et agents peuvent tourner en même temps sur la machine).
//   SITE_DIR=dist : sert la version construite (npm run build) telle qu'elle est publiée ;
//   sinon : serveur de développement Vite, qui compile le TypeScript de src/ à la volée.
import { spawn } from 'node:child_process';
import { createServer, connect } from 'node:net';

const free = port => new Promise(res => { const s = createServer().once('error', () => res(false)).listen(port, '127.0.0.1', () => s.close(() => res(true))); });
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Démarre le serveur ; renvoie { base, stop }. */
export async function startServer() {
  let port = 0;
  for (let i = 0; i < 50 && !port; i++) { const p = 5200 + Math.floor(Math.random() * 800); if (await free(p)) port = p; }
  if (!port) throw new Error('aucun port libre entre 5200 et 5999');
  const dir = process.env.SITE_DIR;
  const proc = dir
    ? spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', dir], { stdio: 'ignore' })
    : spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort', '--host', '127.0.0.1', '--clearScreen', 'false'], { stdio: 'ignore' });
  for (let i = 0; i < 200; i++) {
    const ok = await new Promise(res => { const c = connect(port, '127.0.0.1', () => { c.end(); res(true); }); c.on('error', () => res(false)); });
    if (ok) break;
    if (i === 199) { proc.kill(); throw new Error('serveur local injoignable'); }
    await sleep(100);
  }
  return { base: `http://127.0.0.1:${port}/`, stop: () => proc.kill() };
}
