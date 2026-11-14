// Written with AI assistance (Codex).
import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import electron from 'electron';
const server = await createServer({ server: { host: 'localhost' } });
await server.listen();
const child = spawn(electron, ['.', '--dev', ...process.argv.slice(2)], { stdio: 'inherit' });
const close = async () => { child.kill(); await server.close(); };
child.on('exit', async code => { await server.close(); process.exit(code ?? 1); });
process.on('SIGINT', close);
process.on('SIGTERM', close);
