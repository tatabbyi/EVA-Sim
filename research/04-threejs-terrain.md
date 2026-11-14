# 04 Three.js terrain

## Version

- **Current release: 0.187.0 (r187), published 30 Oct 2026.** Previous: 0.186.1 (24 Sep 2026). r160 was Dec 2023. Source: https://registry.npmjs.org/three
- Pin it: `npm i three@0.187.0`. Addons import from `three/addons/...` (for example `three/addons/webxr/VRButton.js`).
- The migration guide says to upgrade in steps of 10 because deprecation warnings last 10 releases. Not an issue for a new project. Source: https://github.com/mrdoob/three.js/wiki/Migration-Guide

## Breaking changes since r160 that touch this project

Checked every entry from r160→r161 to r187→r188 in the migration guide. Only these matter:

| Release | Change | Effect on EVA Sim |
|---|---|---|
| r163 | "`WebGLRenderer` no longer supports WebGL 1." | Good news. All shaders compile as GLSL ES 3.00, so `fwidth`, `dFdx`, vertex texture fetch and R32F float textures are always available. No extension flags needed. |
| r163 | `stencil` context attribute now `false` by default | Only matters if using stencil masks. Probably not. |
| r164 | Node materials work only with `WebGPURenderer` | Stay on `WebGLRenderer` with GLSL `ShaderMaterial`. Don't mix in TSL examples (anything starting `webgpu_`). |
| r161 | Precision qualifiers added for all sampler types | No action. |
| r162 | `InteractiveGroup` API changed (`listenToXRControllerEvents()`) | Only if using HTML-in-VR panels. |
| r170 | `WebXRManager` honours the scene camera's layers | Useful: put desktop-only objects on another layer to hide them in VR. |
| r182 | `PCFSoftShadowMap` deprecated, use `PCFShadowMap` | Only if adding shadows. |
| r187 | "The XR camera's transformation and projection matrix are derived from the first sub camera (e.g. the left eye)" (PR #34275) | Any code that reads the XR camera to place a HUD or aim a ray now gets the left eye, not the midpoint. About 3 cm offset. Fine for a HUD. |
| r187 | `setViewport()`/`setScissor()` no longer scale by pixel ratio when a render target is bound | Only for render-to-texture minimaps. |

Nothing changed `ShaderMaterial`, `DataTexture` or `VRButton` in a breaking way. `VRButton.createButton(renderer, sessionInit)` is unchanged in the current source.

## Best official examples

| Need | Example |
|---|---|
| Terrain from a height grid, first-person fly controls | https://threejs.org/examples/#webgl_geometry_terrain |
| Raycasting onto terrain (click to add route points) | https://threejs.org/examples/#webgl_geometry_terrain_raycast |
| Camera following a spline (desktop) | https://threejs.org/examples/#webgl_geometry_extrude_splines |
| **Camera following a path in VR** | https://threejs.org/examples/#webxr_vr_rollercoaster |
| Moving the user in VR without moving the headset | https://threejs.org/examples/#webxr_vr_teleport |
| Walk-around first person on desktop | https://threejs.org/examples/#misc_controls_pointerlock |
| Basic `ShaderMaterial` | https://threejs.org/examples/#webgl_shader |

Source code for any example: `https://github.com/mrdoob/three.js/blob/r187/examples/<name>.html`

## Snippets

### Contour lines with `fract` and `fwidth`

Technique from Evan Wallace's anti-aliased grid shader (https://madebyevan.com/shaders/grid/): `abs(fract(coord - 0.5) - 0.5) / fwidth(coord)` gives the distance to the nearest line in pixels, so lines stay one pixel wide at any distance.

```glsl
// vertex
varying vec3 vPosW;
varying vec3 vNormalW;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPosW = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
```

```glsl
// fragment
uniform float uMinor;   // e.g. 5.0 m
uniform float uMajor;   // e.g. 25.0 m
varying vec3 vPosW;
varying vec3 vNormalW;

float contour(float h, float interval, float widthPx) {
  float c = h / interval;
  float d = abs(fract(c - 0.5) - 0.5) / fwidth(c);
  return 1.0 - clamp(d / widthPx, 0.0, 1.0);
}

void main() {
  vec3 base = vec3(0.05);
  float minor = contour(vPosW.y, uMinor, 1.0);
  float major = contour(vPosW.y, uMajor, 1.8);
  vec3 col = mix(base, vec3(0.9, 0.5, 0.3), max(minor * 0.5, major));
  gl_FragColor = vec4(col, 1.0);
}
```

### Outlines from slope and normals, inside the material

No post-processing needed, which matters for VR (see WebXR notes).

```glsl
uniform vec3 cameraPosition;   // built in for ShaderMaterial, no need to declare in JS

// 1. Steep-ground warning: slope from the normal. Ties to the 25° limit in 02.
float slope = acos(clamp(vNormalW.y, -1.0, 1.0));                 // radians
float steep = smoothstep(radians(20.0), radians(25.0), slope);

// 2. Crease and ridge lines: how fast the normal changes across the screen.
float crease = clamp(length(fwidth(vNormalW)) * 4.0, 0.0, 1.0);

// 3. Silhouette rim: surfaces seen edge-on.
vec3 viewDir = normalize(cameraPosition - vPosW);
float rim = 1.0 - abs(dot(viewDir, normalize(vNormalW)));
float silhouette = smoothstep(0.75, 0.95, rim);

float line = max(crease, silhouette);
col = mix(col, vec3(1.0), line);
col = mix(col, vec3(1.0, 0.2, 0.1), steep * 0.6);
```

Tune the `4.0` crease gain on real terrain. Flat-shaded pymartini triangles will show every edge if it is too high.

### Height from a float `DataTexture` in the vertex shader

```js
const tex = new THREE.DataTexture(heights /* Float32Array, W*H */, W, H, THREE.RedFormat, THREE.FloatType);
tex.minFilter = tex.magFilter = THREE.NearestFilter;   // see note below
tex.generateMipmaps = false;
tex.needsUpdate = true;

const geo = new THREE.PlaneGeometry(W - 1, H - 1, W - 1, H - 1);   // 1 unit = 1 m
geo.rotateX(-Math.PI / 2);
const mat = new THREE.ShaderMaterial({ uniforms: { uHeight: { value: tex }, uSize: { value: new THREE.Vector2(W, H) } }, vertexShader, fragmentShader });
```

```glsl
uniform sampler2D uHeight;
uniform vec2 uSize;
void main() {
  vec2 st = (uv * (uSize - 1.0) + 0.5) / uSize;   // hit texel centres exactly
  float h = texture2D(uHeight, st).r;
  vec3 p = position + vec3(0.0, h, 0.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
```

Notes:
- **Use `NearestFilter` for 32-bit float textures.** Linear filtering of R32F needs the `OES_texture_float_linear` extension (https://registry.khronos.org/webgl/extensions/OES_texture_float_linear/), which is not guaranteed on every device. With the texel-centre mapping above, each vertex lands on one texel, so nearest is exact anyway.
- If a filtered overlay is needed (Leash, comms), store it as `UnsignedByteType` + `RedFormat` (0 to 255). That filters everywhere.
- Don't use half floats for heights. Heights around −2,500 m in half precision step by 2 m.
- With pymartini (05) the heights are already in the mesh, so the data texture is mainly useful for overlays.

### First-person camera following a path

```js
const curve = new THREE.CatmullRomCurve3(routePoints);   // world space, y = ground + 1.7
const length = curve.getLength();
const rig = new THREE.Group();
rig.add(camera);
scene.add(rig);

let s = 0;                       // metres walked
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  s = Math.min(s + walkSpeed * dt, length);           // walkSpeed from 02, m/s
  const t = s / length;
  const p = curve.getPointAt(t);
  const a = curve.getPointAt(Math.min(t + 2 / length, 1));   // 2 m ahead
  rig.position.copy(p);
  rig.rotation.y = Math.atan2(-(a.x - p.x), -(a.z - p.z));  // yaw only; camera looks down -Z
  renderer.render(scene, camera);
});
```

- Don't use `rig.lookAt(ahead)`: on a non-camera object it points +Z at the target, so the camera faces backwards.
- Yaw only in VR. Pitching or rolling the rig makes people sick; the headset handles looking up and down.
- **Subtract a local origin** (the landing site) from all coordinates before building geometry. Eastings around 4,354,000 m in 32-bit floats only resolve about 0.5 m, which makes the camera jitter.

## WebXR notes (things that break)

- **Use `renderer.setAnimationLoop`, never `requestAnimationFrame`.** XR frames only come through the animation loop. Source: https://threejs.org/docs/#api/en/renderers/webxr/WebXRManager
- **Post-processing (`EffectComposer`, `OutlinePass`) doesn't work reliably in WebXR.** Common symptom is a black view. The usual fix is to skip the composer while `renderer.xr.isPresenting`. This is why outlines and contours belong in the terrain shader. Sources: https://discourse.threejs.org/t/is-it-possible-to-use-threejs-postprocessing-in-web-vr/36333 and https://discourse.threejs.org/t/webxr-not-working-with-effectcomposer/47761
- **No HTML HUD in `immersive-vr`.** DOM overlay is an AR-only feature. Build the HUD as meshes or a `CanvasTexture` plane parented to the camera, about 1 m in front.
- **WebXR needs a secure context.** Vercel gives HTTPS. For testing on a headset over USB, `adb reverse tcp:5173 tcp:5173` lets the headset open `http://localhost:5173`, which counts as secure.
- Move the user by moving a parent group (as above) or with an offset reference space (`webxr_vr_teleport`). Setting `camera.position` directly is overwritten by the headset every frame.
- Foveated rendering blurs the edge of the view. If thin contour lines shimmer at the edges, try `renderer.xr.setFoveation(0)`.
- `fwidth` works per eye, so contour width stays correct in stereo.
- Frame budget on standalone headsets is about 11 to 14 ms (72 to 90 Hz). One draw call per terrain chunk, and avoid transparent overlays stacked on top of each other.
