// Written with AI assistance (Codex). Native Electron integration smoke; no renderer test bridge.
const { writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { previewReady } = require('./smoke-readiness.cjs');
module.exports = function runSmoke(win, app) {
      const evidenceDir = process.env.RUNNER_TEMP || tmpdir();
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
            const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
            const readState = () => win.webContents.executeJavaScript(`(() => {
              const text = document.querySelector('.raw-controls')?.textContent ?? '';
              const position = text.match(/X ([-0-9.]+) m · Z ([-0-9.]+) m/);
              const clock = text.match(/Clock ([0-9.]+) s/);
              return { x: position ? Number(position[1]) : null, z: position ? Number(position[2]) : null,
                time: clock ? Number(clock[1]) : null, paused: text.includes('PAUSED'),
                running: / s · run/.test(text), focus: document.hasFocus(),
                locked: document.pointerLockElement === document.querySelector('.raw-scene canvas'),
                keys: window.__rawSmokeKeys ?? [] };
            })()`);
            // Observe actual Chromium-delivered events; never dispatch renderer KeyboardEvents
            // or engine commands as a substitute for working native input.
            await win.webContents.executeJavaScript(`(() => {
              window.__rawSmokeKeys = [];
              window.addEventListener('keydown', event => window.__rawSmokeKeys.push({
                code: event.code, key: event.key, shift: event.shiftKey, trusted: event.isTrusted
              }));
            })()`);
            win.show(); win.focus(); win.webContents.focus();
            let focused = false;
            for (let i=0; i<50; i++) {
              if (win.isFocused() && (await readState()).focus) { focused=true; break; }
              await wait(100);
            }
            if (!focused) throw new Error('Native window/document did not acquire focus: ' + JSON.stringify(await readState()));
            await win.webContents.executeJavaScript(`(() => {
              [...document.querySelectorAll('button')].find(b => b.textContent === 'Resume')?.click();
              document.activeElement?.blur();
              document.querySelector('.raw-scene canvas').click();
            })()`, true);
            let before;
            for (let i=0; i<50; i++) {
              before=await readState();
              if (before.focus && before.locked && !before.paused && before.x !== null && before.z !== null && before.time !== null) break;
              await wait(100);
            }
            if (!before?.focus || !before.locked || before.paused || before.x === null || before.z === null || before.time === null) throw new Error('Input not ready: ' + JSON.stringify(before));
            let after, moved = false;
            try {
              win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Shift', modifiers: ['shift', 'left'] });
              win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'W', modifiers: ['shift'] });
              // Poll real HUD snapshots while keys are held; software-rendered Windows
              // runners may need longer than the former fixed 400 ms + 150 ms delay.
              for (let i=0; i<50; i++) {
                await wait(100); after=await readState();
                if (!after.focus || !after.locked || after.paused) throw new Error('Focus/lock lost during movement: ' + JSON.stringify(after));
                const distance=Math.hypot(after.x-before.x,after.z-before.z);
                const receivedW=after.keys.some(k => k.code === 'KeyW' && k.shift && k.trusted);
                const receivedShift=after.keys.some(k => /^Shift(Left|Right)$/.test(k.code) && k.trusted);
                if (after.x !== null && after.z !== null && after.time !== null && distance >= 1 && after.time > before.time && after.running && receivedW && receivedShift) { moved=true; break; }
              }
            } finally {
              win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'W', modifiers: ['shift'] });
              win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Shift' });
            }
            console.log('SMOKE native input diagnostics', JSON.stringify({ platform:process.platform, before, after }));
            if (!moved) throw new Error('WASD/Shift failed: require trusted key delivery, running clock/mode and >=1 m displacement');
            await win.webContents.executeJavaScript('document.exitPointerLock()');
            console.log('SMOKE pointer lock + WASD/Shift', before.x, before.z, '->', after.x, after.z);
          }
          const screenshot = join(evidenceDir, process.argv.includes('--smoke-preview') ? 'raw-preview-smoke.png' : process.argv.includes('--smoke-missing') ? 'raw-missing-smoke.png' : 'raw-engine-smoke.png');
          await writeFile(screenshot, (await win.webContents.capturePage()).toPNG());
          console.log('SMOKE', result, screenshot);
          clearTimeout(timer); app.exit(0);
        } catch (error) {
          console.error(error);
          try { await writeFile(join(evidenceDir, 'raw-failure-smoke.png'), (await win.webContents.capturePage()).toPNG()); }
          catch (captureError) { console.error('Failure screenshot unavailable:', captureError); }
          clearTimeout(timer); app.exit(1);
        }
      });
};
