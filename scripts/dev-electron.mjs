// Written with AI assistance (Codex). Fixed origin shared with the Electron host.
import { spawn } from 'node:child_process';
import { createServer } from 'vite';
let server, child, closing;
const close = () => closing ??= (async () => { child?.kill(); await server?.close(); })();
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void close(); });
try {
  try {
    server = await createServer({ server: { host: 'localhost', port: 5173, strictPort: true } });
    await server.listen();
  } catch (error) {
    // Already running `npm run dev`? Then just open the window on it.
    await server?.close();
    server = null;
    const running = /already in use/i.test(error.message) && (await fetch('http://localhost:5173/', { signal: AbortSignal.timeout(800) }).then((r) => r.ok).catch(() => false));
    if (!running) throw error;
    console.log('Using the dev server already running on http://localhost:5173');
  }
  // Load Electron only once the port is ours, so a busy port is reported first (and clearly), even before
  // `npm install` has fetched Electron.
  const { default: electron } = await import('electron');
  // Never let Electron start as plain Node (VS Code sets ELECTRON_RUN_AS_NODE for its extensions and tasks).
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  child = spawn(electron, ['.', '--dev', ...process.argv.slice(2)], { stdio: 'inherit', env });
  child.once('error', async error => { console.error(error); await close(); process.exitCode = 1; });
  child.once('exit', async code => { await close(); process.exitCode = code ?? 1; });
} catch (error) {
  console.error('RAW dev launcher failed:', error.message);
  await close(); process.exitCode = 1;
}
