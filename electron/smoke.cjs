// Written with AI assistance (Codex). Native Electron integration smoke; no renderer test bridge.
const { writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { previewReady } = require('./smoke-readiness.cjs');
module.exports = function runSmoke(win, app) {
      const timer = setTimeout(() => { console.error('SMOKE timeout'); app.exit(1); }, 35000);
      win.webContents.once('did-finish-load', async () => {
        try {
          const missing = process.argv.includes('--smoke-missing');
          const preview = process.argv.includes('--smoke-preview');
          const result = await win.webContents.executeJavaScript(`(async () => {
            if (${preview}) location.hash = '#preview';
            const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
            for (let i=0;i<200;i++) {
              const error = document.querySelector('[role="alert"]');
              if (${missing} && error?.textContent.includes('404')) return 'missing-data error visible';
              if (!${missing} && error) throw new Error(error.textContent);
              if (${preview} && /No terrain yet|failed|error/i.test(document.querySelector('.preview-badge')?.textContent ?? '')) throw new Error('Preview terrain unavailable: ' + document.querySelector('.preview-badge').textContent);
              const ready = ${preview} ? (${previewReady.toString()})(document, location) : !!document.querySelector('[data-scene-ready="true"]');
              if (ready && !${missing}) {
                const response = await fetch('/grids/height_4m.bin');
                if (!response.ok || (await response.arrayBuffer()).byteLength !== 4202500) throw new Error('Grid fetch failed');
                if (!${preview}) {
                  if (!document.body.textContent.includes('DEMO route') || !document.body.textContent.includes('UNKNOWN')) throw new Error('Missing demo labels');
                  const resume = [...document.querySelectorAll('button')].find(b => b.textContent === 'Resume');
                  if (resume) { resume.click(); await wait(100); }
                  const button = [...document.querySelectorAll('button')].find(b => b.textContent === 'Pause');
                  if (!button) throw new Error('Pause control unavailable');
                  button.click(); await wait(150);
                  if (!document.body.textContent.includes('PAUSED')) throw new Error('Pause failed');
                  [...document.querySelectorAll('button')].find(b => b.textContent === 'Reset').click(); await wait(150);
                }
                return ${preview} ? 'preview canvas and offline grid OK' : '3D scene, labels, pause/reset and offline grid OK';
              }
              await wait(100);
            }
            throw new Error('Scene never became ready');
          })()`);
          if (!missing && !preview) {
            win.focus();
            await win.webContents.executeJavaScript(`(() => { [...document.querySelectorAll('button')].find(b => b.textContent === 'Resume')?.click(); document.querySelector('.raw-scene canvas').click(); })()`, true);
            await new Promise(resolve => setTimeout(resolve, 200));
            if (!await win.webContents.executeJavaScript('!!document.pointerLockElement')) throw new Error('Pointer lock failed');
            const position = () => win.webContents.executeJavaScript(`document.querySelector('.raw-controls').textContent.match(/X [-0-9.]+ m · Z [-0-9.]+ m/)[0]`);
            const before = await position();
            win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'W' });
            win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Shift' });
            await new Promise(resolve => setTimeout(resolve, 400));
            win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'W' });
            win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Shift' });
            await new Promise(resolve => setTimeout(resolve, 150));
            const after = await position();
            if (before === after) throw new Error('WASD movement failed');
            await win.webContents.executeJavaScript('document.exitPointerLock()');
            console.log('SMOKE pointer lock + WASD/Shift', before, '->', after);
          }
          const screenshot = join(tmpdir(), process.argv.includes('--smoke-preview') ? 'raw-preview-smoke.png' : process.argv.includes('--smoke-missing') ? 'raw-missing-smoke.png' : 'raw-engine-smoke.png');
          await writeFile(screenshot, (await win.webContents.capturePage()).toPNG());
          console.log('SMOKE', result, screenshot);
          clearTimeout(timer); app.exit(0);
        } catch (error) { console.error(error); clearTimeout(timer); app.exit(1); }
      });
};
