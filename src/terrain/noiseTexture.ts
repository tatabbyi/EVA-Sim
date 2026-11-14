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

/** Metres of cloth one tile of createSuitCloth covers: set texture repeats to (size of the surface) / this. */
export const SUIT_CLOTH_TILE_M = 0.16;

/**
 * EVA suit outer layer at real scale (the white ortho-fabric of an EMU's thermal micrometeoroid garment): a ripstop
 * grid of raised threads every 8 mm over a fine plain weave, soft mottling and rusty Mars-dust smudges. Returns a
 * colour map and a matching bump map with the same layout (give both the same repeat). One tile = SUIT_CLOTH_TILE_M.
 */
export function createSuitCloth(base = '#ece8df', dust = 0.5, seed = 3, size = 512): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const canvas = () => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return [c, c.getContext('2d')!] as const;
  };
  const [cc, col] = canvas();
  const [bc, bum] = canvas();
  const grid = size / 20; // 8 mm ripstop squares
  const thread = Math.max(2, Math.round(size / 170)); // about 1 mm threads

  col.fillStyle = base;
  col.fillRect(0, 0, size, size);
  bum.fillStyle = '#808080';
  bum.fillRect(0, 0, size, size);
  // plain weave: threads alternately over and under
  for (let y = 0; y < size; y += thread) {
    for (let x = 0; x < size; x += thread) {
      const over = ((x + y) / thread) % 2 === 0;
      col.fillStyle = over ? 'rgba(255,255,255,0.07)' : 'rgba(70,60,50,0.07)';
      col.fillRect(x, y, thread, thread);
      bum.fillStyle = over ? '#9a9a9a' : '#6a6a6a';
      bum.fillRect(x, y, thread, thread);
    }
  }
  // ripstop: a heavier double thread each way, raised, catching a little shadow on one side
  for (let k = 0; k < 20; k++) {
    const p = Math.round(k * grid);
    col.fillStyle = 'rgba(80,70,58,0.09)';
    col.fillRect(p, 0, thread, size);
    col.fillRect(0, p, size, thread);
    col.fillStyle = 'rgba(255,255,255,0.08)';
    col.fillRect(p + thread, 0, thread, size);
    col.fillRect(0, p + thread, size, thread);
    bum.fillStyle = '#b4b4b4';
    bum.fillRect(p, 0, thread * 2, size);
    bum.fillRect(0, p, size, thread * 2);
  }
  // soft mottling (the cloth isn't one flat colour)
  const blob = (ctx: CanvasRenderingContext2D, rgb: string, alpha: number, r: number, squash = 1) => {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, `rgba(${rgb},${alpha})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.save();
    ctx.translate(rand() * size, rand() * size);
    ctx.scale(1, squash);
    ctx.fillStyle = g;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  };
  for (let i = 0; i < 220; i++) blob(col, rand() > 0.5 ? '255,255,255' : '90,80,65', 0.05, (size / 256) * (6 + rand() * 22));
  for (let i = 0; i < Math.round(36 * dust); i++) blob(col, '160,90,55', 0.16 * dust, (size / 256) * (6 + rand() * 24), 0.6 + rand() * 0.8);

  const out = (c: HTMLCanvasElement, colour: boolean) => {
    const tex = new THREE.CanvasTexture(c);
    if (colour) tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8; // stays crisp on sleeves seen at a slant
    return tex;
  };
  return { map: out(cc, true), bump: out(bc, false) };
}
