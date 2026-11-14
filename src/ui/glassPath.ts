// Written with AI assistance (Claude).
// Owner: Rachel. The path drawn ON THE GLASS (the "outline on the glass" version): a thin cyan line and arrow
// marks projected from the real route onto the visor, like a heads-up display. Nothing is placed in the 3D world:
// the line has the same width at any distance, is never hidden behind hills, and fades out near your feet and
// in the distance. Each frame the route is projected through the camera and the dome lens and redrawn as SVG.

import * as THREE from 'three';

export interface GlassPath {
  svg: SVGSVGElement;
  /** Route on the ground, in order (world positions). Resampled every metre and laid on the ground with heightAt. */
  setRoute(points: THREE.Vector3[], heightAt?: (x: number, z: number) => number): void;
  setVisible(on: boolean): void;
  update(camera: THREE.PerspectiveCamera, toScreen: (x: number, y: number) => { x: number; y: number }, widthPx: number, heightPx: number): void;
}

const NS = 'http://www.w3.org/2000/svg';
const CHUNK = 8; // metres of line per SVG path (each chunk gets its own fade)
const AHEAD = 160; // metres of route drawn ahead of you
const ARROW_EVERY = 6; // metres

export function createGlassPath(host: HTMLElement, colour = '#6fe3ff'): GlassPath {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'glass-path');
  svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;';
  svg.style.filter = `drop-shadow(0 0 3px ${colour}) drop-shadow(0 0 1px rgba(0,0,0,0.8))`;
  host.replaceChildren(svg);

  const chunks: SVGPathElement[] = [];
  const arrows: SVGPathElement[] = [];
  const make = (pool: SVGPathElement[], i: number, arrow: boolean) => {
    while (pool.length <= i) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('fill', arrow ? colour : 'none');
      p.setAttribute('fill-opacity', arrow ? '0.28' : '0');
      p.setAttribute('stroke', colour);
      p.setAttribute('stroke-width', arrow ? '1.6' : '2.2');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      svg.replaceChildren(...chunks, ...arrows, p);
      pool.push(p);
    }
    return pool[i];
  };

  let route: THREE.Vector3[] = [];
  let along: number[] = []; // metres from the start
  let nearest = 0;
  const cam = new THREE.Vector3(), ndc = new THREE.Vector3(), prev = new THREE.Vector3();
  const smooth = (e0: number, e1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };

  return {
    svg,
    setRoute(points, heightAt) {
      route = [];
      along = [];
      let total = 0;
      for (let i = 0; i + 1 < points.length; i++) {
        const a = points[i], b = points[i + 1], len = a.distanceTo(b);
        const n = Math.max(1, Math.round(len));
        for (let k = 0; k < n; k++) {
          const p = a.clone().lerp(b, k / n);
          if (heightAt) p.y = heightAt(p.x, p.z) + 0.05;
          route.push(p);
          along.push(total + (len * k) / n);
        }
        total += len;
      }
      if (points.length) {
        route.push(points[points.length - 1].clone());
        along.push(total);
      }
      nearest = 0;
    },
    setVisible(on) {
      svg.style.display = on ? 'block' : 'none';
    },
    update(camera, toScreen, w, h) {
      if (svg.style.display === 'none' || route.length < 2) return;
      camera.updateMatrixWorld();
      const me = camera.position;
      // Where along the route you are: search near last time, so it follows you without jumping ahead.
      let best = Infinity;
      const lo = Math.max(0, nearest - 40), hi = Math.min(route.length - 1, nearest + 80);
      for (let i = lo; i <= hi; i++) {
        const d = (route[i].x - me.x) ** 2 + (route[i].z - me.z) ** 2;
        if (d < best) {
          best = d;
          nearest = i;
        }
      }
      if (best > 900) {
        // far off the path (free roam): search all of it
        for (let i = 0; i < route.length; i++) {
          const d = (route[i].x - me.x) ** 2 + (route[i].z - me.z) ** 2;
          if (d < best) {
            best = d;
            nearest = i;
          }
        }
      }

      const view = camera.matrixWorldInverse, proj = camera.projectionMatrix;
      // Screen position of route point i, or null if it is behind you or far off screen.
      const screen = (p: THREE.Vector3) => {
        cam.copy(p).applyMatrix4(view);
        if (cam.z > -0.4) return null;
        ndc.copy(cam).applyMatrix4(proj);
        if (Math.abs(ndc.x) > 1.6 || Math.abs(ndc.y) > 1.6) return null;
        const q = toScreen(ndc.x, ndc.y);
        return { x: (q.x * 0.5 + 0.5) * w, y: (-q.y * 0.5 + 0.5) * h, depth: -cam.z };
      };

      const start = along[nearest];
      let c = 0, a = 0;
      let d = '';
      let chunkStart = start;
      let pen = false;
      const flush = (mid: number) => {
        if (!d) return;
        const p = make(chunks, c++, false);
        const fade = smooth(1, 5, mid - start) * (1 - smooth(70, AHEAD, mid - start));
        p.setAttribute('d', d);
        p.setAttribute('stroke-opacity', (0.9 * fade).toFixed(3));
        p.style.display = fade > 0.01 ? '' : 'none';
        d = '';
      };
      let nextArrow = Math.ceil(start / ARROW_EVERY) * ARROW_EVERY;
      let lastArrowX = -1e9, lastArrowY = -1e9;
      for (let i = Math.max(0, nearest - 1); i < route.length && along[i] - start < AHEAD; i++) {
        const s = screen(route[i]);
        if (!s) {
          pen = false;
          continue;
        }
        d += `${pen ? 'L' : 'M'}${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
        pen = true;
        if (along[i] - chunkStart >= CHUNK) {
          flush((along[i] + chunkStart) / 2);
          chunkStart = along[i];
          d = `M${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
        }
        // Arrow marks: flat chevrons on the glass pointing along the path, shrinking with distance.
        if (along[i] >= nextArrow && i + 1 < route.length) {
          nextArrow += ARROW_EVERY;
          const n = screen(route[i + 1]);
          const fade = smooth(1.5, 6, along[i] - start) * (1 - smooth(35, 70, along[i] - start));
          // Skip arrows that would crowd the last one (they bunch up towards the horizon).
          const room = Math.hypot(s.x - lastArrowX, s.y - lastArrowY) > 34;
          if (n && fade > 0.02 && room) {
            lastArrowX = s.x;
            lastArrowY = s.y;
            prev.set(n.x - s.x, n.y - s.y, 0).normalize();
            const size = Math.max(5, Math.min(22, 120 / Math.sqrt(s.depth)));
            const fx = prev.x * size, fy = prev.y * size, sx = -prev.y * size * 0.9, sy = prev.x * size * 0.9;
            const tip = `${(s.x + fx * 0.6).toFixed(1)} ${(s.y + fy * 0.6).toFixed(1)}`;
            const l = `${(s.x - fx * 0.4 + sx).toFixed(1)} ${(s.y - fy * 0.4 + sy).toFixed(1)}`;
            const r = `${(s.x - fx * 0.4 - sx).toFixed(1)} ${(s.y - fy * 0.4 - sy).toFixed(1)}`;
            const notch = `${(s.x - fx * 0.05).toFixed(1)} ${(s.y - fy * 0.05).toFixed(1)}`;
            const arrow = make(arrows, a++, true);
            arrow.setAttribute('d', `M${l}L${tip}L${r}L${notch}Z`);
            arrow.setAttribute('stroke-opacity', (0.95 * fade).toFixed(3));
            arrow.setAttribute('fill-opacity', (0.3 * fade).toFixed(3));
            arrow.style.display = '';
          }
        }
      }
      flush(chunkStart + CHUNK / 2);
      for (let i = c; i < chunks.length; i++) chunks[i].style.display = 'none';
      for (let i = a; i < arrows.length; i++) arrows[i].style.display = 'none';
    },
  };
}
