// Written with AI assistance (Claude).
// Small grey noise canvas, used as a bump map for surface grain (rock, mic foam, foam pad).

import * as THREE from 'three';

export function createNoiseTexture(size = 128, seed = 1, repeat = 3): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < size * size; i++) {
    const v = 90 + rand() * 120;
    img.data.set([v, v, v, 255], i * 4);
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  return tex;
}

/** Over-under woven threads, used as a bump map for suit fabric (sleeves, gloves). */
export function createWeaveTexture(size = 128, repeat = 6): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  const n = 16, cell = size / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const over = (i + j) % 2 === 0;
      const g = ctx.createLinearGradient(i * cell, j * cell, over ? (i + 1) * cell : i * cell, over ? j * cell : (j + 1) * cell);
      g.addColorStop(0, '#5a5a5a');
      g.addColorStop(0.5, '#d0d0d0');
      g.addColorStop(1, '#5a5a5a');
      ctx.fillStyle = g;
      ctx.fillRect(i * cell + 0.5, j * cell + 0.5, cell - 1, cell - 1);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  return tex;
}

/**
 * Painted suit fabric: off-white cloth with a visible weave, soft mottling and a few rusty Mars-dust smudges.
 * `base` sets the cloth colour; `dust` (0 to 1) how dirty it is.
 */
export function createFabricTexture(base = '#ece8df', dust = 0.5, size = 256, seed = 3, repeat = 2): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  // weave: rows and columns of slightly lighter and darker threads
  const pitch = 4;
  for (let y = 0; y < size; y += pitch) {
    for (let x = 0; x < size; x += pitch) {
      const over = ((x + y) / pitch) % 2 === 0;
      ctx.fillStyle = over ? 'rgba(255,255,255,0.10)' : 'rgba(60,50,40,0.10)';
      ctx.fillRect(x, y, over ? pitch : pitch - 1, over ? pitch - 1 : pitch);
    }
  }
  // soft mottling
  for (let i = 0; i < 260; i++) {
    const r = 6 + rand() * 22;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    const shade = rand() > 0.5 ? '255,255,255' : '90,80,65';
    g.addColorStop(0, `rgba(${shade},0.05)`);
    g.addColorStop(1, `rgba(${shade},0)`);
    ctx.save();
    ctx.translate(rand() * size, rand() * size);
    ctx.fillStyle = g;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  }
  // Mars dust smudges
  for (let i = 0; i < Math.round(40 * dust); i++) {
    const r = 8 + rand() * 30;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, `rgba(160,90,55,${0.18 * dust})`);
    g.addColorStop(1, 'rgba(160,90,55,0)');
    ctx.save();
    ctx.translate(rand() * size, rand() * size);
    ctx.scale(1, 0.6 + rand() * 0.8);
    ctx.fillStyle = g;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  return tex;
}
