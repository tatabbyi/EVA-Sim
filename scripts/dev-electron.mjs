// Written with AI assistance (Codex). Fixed origin shared with the Electron host.
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
const PORT = 5173;
// Check the port first, before loading Vite or Electron: a clear error even where their native binaries are missing.
const portFree = () => new Promise(resolve => {
  const probe = createNetServer().once('error', () => resolve(false));
  probe.listen(PORT, 'localhost', () => probe.close(() => resolve(true)));
});
let server, child, closing;
const close = () => closing ??= (async () => { child?.kill(); await server?.close(); })();
const fail = async message => {
  console.error('RAW dev launcher failed:', message);
  await close(); process.exitCode = 1;
};
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void close(); });
try {
  if (!(await portFree())) {
    await fail(`Port ${PORT} is already in use`);
  } else {
    const [{ createServer }, { default: electron }] = await Promise.all([import('vite'), import('electron')]);
    server = await createServer({ server: { host: 'localhost', port: PORT, strictPort: true } });
    await server.listen();
    // VS Code may expose ELECTRON_RUN_AS_NODE; native Electron must ignore it.
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    child = spawn(electron, ['.', '--dev', ...process.argv.slice(2)], { stdio: 'inherit', env });
    child.once('error', async error => { console.error(error); await close(); process.exitCode = 1; });
    child.once('exit', async code => { await close(); process.exitCode = code ?? 1; });
  }
} catch (error) {
  await fail(error.message);
}
