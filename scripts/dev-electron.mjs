// Written with AI assistance (Codex). Fixed origin shared with the Electron host.
import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import electron from 'electron';
let server, child, closing;
const close = () => closing ??= (async () => { child?.kill(); await server?.close(); })();
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void close(); });
try {
  server = await createServer({ server: { host: 'localhost', port: 5173, strictPort: true } });
  await server.listen();
  child = spawn(electron, ['.', '--dev', ...process.argv.slice(2)], { stdio: 'inherit' });
  child.once('error', async error => { console.error(error); await close(); process.exitCode = 1; });
  child.once('exit', async code => { await close(); process.exitCode = code ?? 1; });
} catch (error) {
  console.error('RAW dev launcher failed:', error.message);
  await close(); process.exitCode = 1;
}
