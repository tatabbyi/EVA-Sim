// Written with AI assistance (Codex). Native host; no renderer IPC or Node access.
const { app, BrowserWindow, protocol, session } = require('electron');
const { resolve, sep } = require('node:path');
const { readFile } = require('node:fs/promises');
protocol.registerSchemesAsPrivileged([{ scheme: 'eva', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
// GitHub Actions/Xvfb may lack hardware GL and blocklist software WebGL2.
// Permit Chromium's software fallback ONLY during explicit automated smoke;
// normal app builds and real user sessions are never granted this override.
if (process.argv.includes('--smoke')) app.commandLine.appendSwitch('enable-unsafe-swiftshader');
const dev = !app.isPackaged && process.argv.includes('--dev');
const origin = dev ? 'http://localhost:5173' : 'eva://app';
app.whenReady().then(async () => {
  const root = resolve(__dirname, '../dist');
  protocol.handle('eva', async request => {
    const url = new URL(request.url);
    let path;
    try { path = resolve(root, '.' + decodeURIComponent(url.pathname)); } catch { return new Response('Invalid path', { status: 400 }); }
    if (url.host !== 'app' || !path.startsWith(root + sep)) return new Response('Forbidden', { status: 403 });
    try {
      if (process.argv.includes('--smoke-missing') && path.endsWith('height_4m.bin')) return new Response('Missing test grid', { status: 404 });
      const body = await readFile(path);
      const ext = path.split('.').pop();
      const mime = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', bin: 'application/octet-stream' }[ext] || 'application/octet-stream';
      return new Response(body, { headers: { 'Content-Type': mime } });
    } catch { return new Response('Missing asset', { status: 404 }); }
  });
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    callback({ cancel: dev ? !['http://localhost:5173', 'ws://localhost:5173', 'eva://app'].includes(url.origin) && url.protocol !== 'eva:' : url.protocol !== 'eva:' || url.host !== 'app' });
  });
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => callback({ responseHeaders: {
    ...details.responseHeaders,
    'Content-Security-Policy': [`default-src 'self'; script-src 'self'${dev ? " 'unsafe-inline'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'${dev ? ' ws://localhost:5173' : ''}; object-src 'none'; base-uri 'none'; frame-src 'none'`],
  } }));
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(permission === 'pointerLock'));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'pointerLock');
  const createWindow = () => {
    const win = new BrowserWindow({ width: 1280, height: 800, backgroundColor: '#060b12', webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(origin + '/')) event.preventDefault(); });
    win.webContents.on('will-redirect', event => event.preventDefault());
    win.loadURL(origin + '/index.html');
    if (process.argv.includes('--smoke')) require('./smoke.cjs')(win, app);
  };
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => app.quit());
