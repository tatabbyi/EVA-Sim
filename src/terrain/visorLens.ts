// Written with AI assistance (Claude).
// Owner: Rachel. Looking through a bubble helmet: the scene is rendered once, then drawn through a gentle barrel
// (fisheye-like) curve with a little colour fringing towards the edges, like the curved polycarbonate of a real dome.
// Desktop only: in WebXR the headset has its own lenses and post-processing breaks (research/04), so Nanda's VR
// mode should call renderer.render() directly instead of lens.render().

import * as THREE from 'three';

export interface VisorLens {
  /** Renders the scene through the dome. Use instead of renderer.render(scene, camera). */
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  uniforms: { uK: { value: number }; uCA: { value: number } };
  /** Where a point projected by the camera (NDC, -1..1) ends up on screen after the dome lens. */
  toScreen(ndcX: number, ndcY: number): { x: number; y: number };
  dispose(): void;
}

const lensVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const lensFragment = /* glsl */ `
uniform sampler2D tScene;
uniform float uK;       // barrel strength
uniform float uCA;      // colour fringing at the edges
uniform float uAspect;
varying vec2 vUv;

vec2 toUv(vec2 p) {
  return vec2(p.x / uAspect, p.y) + 0.5;
}

void main() {
  vec2 p = vUv - 0.5;
  p.x *= uAspect;
  float rMax2 = 0.25 * (uAspect * uAspect + 1.0); // corner, so the corners still show the scene's corners
  float r2 = dot(p, p);
  vec2 q = p * (1.0 + uK * r2) / (1.0 + uK * rMax2);
  float ca = uCA * r2 / rMax2;
  vec3 col;
  col.r = texture(tScene, toUv(q * (1.0 + ca))).r;
  col.g = texture(tScene, toUv(q)).g;
  col.b = texture(tScene, toUv(q * (1.0 - ca))).b;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export function createVisorLens(renderer: THREE.WebGLRenderer, opts: { strength?: number; fringe?: number } = {}): VisorLens {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  // Half-float keeps the dark night sky free of banding; 4x MSAA keeps edges smooth.
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  const uniforms = {
    tScene: { value: target.texture },
    uK: { value: opts.strength ?? 0.12 },
    uCA: { value: opts.fringe ?? 0.006 },
    uAspect: { value: size.x / size.y },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: lensVertex,
    fragmentShader: lensFragment,
    depthTest: false,
    depthWrite: false,
  });
  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(quadGeo, material);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const now = new THREE.Vector2();

  return {
    uniforms,
    toScreen(ndcX, ndcY) {
      // The lens samples p = q (1 + k|q|²) / (1 + k rMax²); solve for the screen point q by fixed-point iteration.
      const a = uniforms.uAspect.value, k = uniforms.uK.value;
      const rMax2 = 0.25 * (a * a + 1);
      const px = ndcX * 0.5 * a, py = ndcY * 0.5;
      let qx = px, qy = py;
      for (let i = 0; i < 6; i++) {
        const f = (1 + k * rMax2) / (1 + k * (qx * qx + qy * qy));
        qx = px * f;
        qy = py * f;
      }
      return { x: qx / (0.5 * a), y: qy / 0.5 };
    },
    render(scene, camera) {
      // Follows window resizes and the adaptive resolution automatically.
      // Render a little larger than the screen: the curve magnifies the centre by (1 + k * rMax²), so supersampling
      // by the same factor keeps the middle of the view pixel-for-pixel sharp.
      renderer.getDrawingBufferSize(now);
      const aspect = now.x / now.y;
      const scale = 1 + uniforms.uK.value * 0.25 * (aspect * aspect + 1);
      const tw = Math.round(now.x * scale), th = Math.round(now.y * scale);
      if (tw !== target.width || th !== target.height) target.setSize(tw, th);
      uniforms.uAspect.value = aspect;
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(quadScene, quadCamera);
    },
    dispose() {
      target.dispose();
      material.dispose();
      quadGeo.dispose();
    },
  };
}
