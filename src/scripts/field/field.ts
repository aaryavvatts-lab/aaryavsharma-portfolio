// The WebGL particle field for the home page. One THREE.Points cloud; each stop of
// the story is a target shape, and the vertex shader blends between two of them.

import * as THREE from 'three';
import { buildShape, ringLocal, mnCounty, TINTS, RING_WORKS, RING_R, RING_TILT, type ShapeName, type GeoData } from './shapes';
import { FOV, CAM_Z, POSE, viewSize, type Layout } from './flat';

const vert = /* glsl */ `
  attribute vec4 aA;
  attribute vec4 aB;
  attribute vec4 aRand;
  attribute vec3 aTint;
  attribute float aCounty;
  attribute float aGroup;
  uniform float uRingAngle;
  uniform float uMix;
  uniform float uTime;
  uniform float uSize;
  uniform float uDpr;
  uniform float uHover;
  uniform float uMotion;
  uniform float uIntro;
  uniform vec3 uColA;
  uniform vec3 uColB;
  uniform vec2 uTintAB;   // 1 when shape A / B is the hero orbit, which keeps each work's own colour
  uniform vec2 uMnAB;     // 1 when shape A / B is Minnesota
  uniform float uCounty;  // highlighted county index, -1 for none
  uniform float uLight;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float t = clamp(uMix * 1.4 - aRand.x * 0.4, 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);
    // Orbit sculptures are stored around their own centre; place them on the ring here
    // so each keeps facing the viewer as it travels.
    vec3 rc = vec3(0.0);
    if (aGroup < 5.5) {
      float a = aGroup / 6.0 * 6.28318 + uRingAngle;
      float rz = cos(a) * ${RING_R.toFixed(3)};
      rc = vec3(sin(a) * ${RING_R.toFixed(3)}, -rz * ${Math.sin(RING_TILT).toFixed(4)}, rz * ${Math.cos(RING_TILT).toFixed(4)});
    }
    vec3 pa = aA.xyz + rc * uTintAB.x;
    vec3 pb = aB.xyz + rc * uTintAB.y;
    vec3 p = mix(pa, pb, t);
    float w = mix(aA.w, aB.w, t);

    // On the way between two shapes the particles swirl around the vertical axis.
    float burst = sin(3.14159 * t) * uMotion;
    float ang = burst * (1.1 + aRand.y * 2.2);
    float c = cos(ang), s = sin(ang);
    p.xz = mat2(c, -s, s, c) * p.xz;
    p += (aRand.yzw - 0.5) * burst * 0.55;

    // Intro: particles rush in from far out of frame and settle, fastest first.
    float it = clamp(uIntro * 1.7 - aRand.w * 0.7, 0.0, 1.0);
    it = 1.0 - pow(1.0 - it, 4.0);
    vec3 far = normalize(aRand.xyz - 0.5 + 1e-3) * (4.5 + aRand.y * 5.0);
    far.z = far.z * 0.6 - 1.5;
    p = mix(far, p, it);

    // A breath of life while nothing else moves.
    p += uMotion * 0.01 * vec3(
      sin(uTime * 0.9 + aRand.y * 40.0),
      cos(uTime * 0.7 + aRand.z * 40.0),
      sin(uTime * 0.8 + aRand.w * 40.0));

    // The hovered county lifts toward the viewer and lights up.
    float mn = mix(uMnAB.x, uMnAB.y, t);
    float hot = (uCounty >= 0.0 && abs(aCounty - uCounty) < 0.5) ? mn : 0.0;
    p.z += hot * 0.09;
    w = mix(w, 1.0, hot);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uDpr * (0.55 + w * 0.9) * (1.0 + uHover * 0.18 + hot * 0.5) / -mv.z;

    vec3 colA = mix(uColA, aTint, uTintAB.x);
    vec3 colB = mix(uColB, aTint, uTintAB.y);
    vec3 col = mix(colA, colB, t);
    vec3 hi = uLight > 0.5 ? vec3(0.08, 0.06, 0.03) : vec3(1.0, 0.97, 0.9);
    vColor = mix(col, hi, hot * 0.55);
    vAlpha = (0.3 + 0.7 * w) * (1.0 + uHover * 0.35) * (0.35 + 0.65 * it);
    // Works on the far side of the orbit dim, so the ring reads in depth.
    float ringW = mix(uTintAB.x, uTintAB.y, t) * step(aGroup, 5.5);
    float near = clamp(rc.z / ${(RING_R * Math.cos(RING_TILT)).toFixed(3)} * 0.5 + 0.5, 0.0, 1.0);
    vAlpha *= mix(1.0, 0.32 + 0.68 * near, ringW);
  }
`;

const frag = /* glsl */ `
  uniform float uIntensity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d);
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a * vAlpha * uIntensity);
  }
`;

// Faint far-away dust that gives the page depth and drifts with the scroll.
const dustVert = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uDpr;
  uniform float uScroll;
  varying float vA;
  void main() {
    vec3 p = position;
    p.y = mod(p.y + uScroll * (0.4 + aSeed * 0.8) + 6.0, 12.0) - 6.0;
    p.x += sin(uTime * 0.05 + aSeed * 30.0) * 0.15;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.2 + aSeed * 2.2) * uDpr * (6.0 / -mv.z);
    vA = 0.25 + 0.75 * (0.5 + 0.5 * sin(uTime * (0.4 + aSeed) + aSeed * 50.0));
  }
`;
const dustFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColor, a * vA * uAlpha);
  }
`;

function motionAngle(shape: ShapeName, t: number) {
  const base = POSE[shape];
  switch (shape) {
    case 'ring': return base;
    case 'sphere': return base + t * 0.12;
    case 'helix': return base + t * 0.32;
    case 'galaxy': return base + t * 0.05;
    case 'brain': return base + Math.sin(t * 0.22) * 0.45;
    case 'network': return base + Math.sin(t * 0.2) * 0.3;
    case 'book': return base + Math.sin(t * 0.3) * 0.16;
    default: return base + Math.sin(t * 0.25) * 0.1;
  }
}

function wrap(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export type FieldOptions = {
  canvas: HTMLCanvasElement;
  shapes: ShapeName[];
  geo: GeoData;
  count: number;
  dpr: number;
  light: boolean;
  motion: boolean;
  onLost: () => void;
  halfRate?: boolean;
};

export function createField(o: FieldOptions) {
  const renderer = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(o.dpr);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
  camera.position.set(0, 0, CAM_Z);

  const n = o.count;
  const ringData = o.shapes.includes('ring') ? ringLocal(n, o.geo) : null;
  const data = o.shapes.map((s) => (s === 'ring' && ringData ? ringData.pos : buildShape(s, n, o.geo)));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const aA = new THREE.BufferAttribute(new Float32Array(n * 4), 4);
  const aB = new THREE.BufferAttribute(new Float32Array(n * 4), 4);
  aA.setUsage(THREE.DynamicDrawUsage);
  aB.setUsage(THREE.DynamicDrawUsage);
  const rand = new Float32Array(n * 4);
  let seed = 12345;
  for (let i = 0; i < rand.length; i++) { seed = (seed * 16807) % 2147483647; rand[i] = seed / 2147483647; }
  const tint = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
  const county = new Float32Array(n);
  for (let i = 0; i < n; i++) county[i] = mnCounty(i, o.geo.minnesota);
  geo.setAttribute('aA', aA);
  geo.setAttribute('aB', aB);
  geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 4));
  geo.setAttribute('aTint', tint);
  geo.setAttribute('aCounty', new THREE.BufferAttribute(county, 1));
  geo.setAttribute('aGroup', new THREE.BufferAttribute(ringData ? ringData.group : new Float32Array(n).fill(9), 1));

  const density = Math.sqrt(60000 / n);
  const uniforms = {
    uMix: { value: 0 },
    uTime: { value: 0 },
    uSize: { value: 15 * Math.min(density, 1.55) },
    uDpr: { value: o.dpr },
    uHover: { value: 0 },
    uMotion: { value: o.motion ? 1 : 0 },
    uIntro: { value: o.motion ? 0 : 1 },
    uColA: { value: new THREE.Color() },
    uColB: { value: new THREE.Color() },
    uTintAB: { value: new THREE.Vector2() },
    uMnAB: { value: new THREE.Vector2() },
    uCounty: { value: -1 },
    uLight: { value: 0 },
    uIntensity: { value: 1 },
    uRingAngle: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, uniforms,
    transparent: true, depthWrite: false, depthTest: false,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;

  const DUST = n >= 30000 ? 1600 : 700;
  const dustGeo = new THREE.BufferGeometry();
  const dp = new Float32Array(DUST * 3), ds = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    seed = (seed * 16807) % 2147483647; const a = seed / 2147483647;
    seed = (seed * 16807) % 2147483647; const b = seed / 2147483647;
    seed = (seed * 16807) % 2147483647; const c = seed / 2147483647;
    seed = (seed * 16807) % 2147483647; ds[i] = seed / 2147483647;
    dp[i * 3] = (a - 0.5) * 16; dp[i * 3 + 1] = (b - 0.5) * 12; dp[i * 3 + 2] = -2 - c * 7;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(ds, 1));
  const dustUniforms = { uTime: { value: 0 }, uDpr: { value: o.dpr }, uScroll: { value: 0 }, uColor: { value: new THREE.Color() }, uAlpha: { value: 0.5 } };
  const dustMat = new THREE.ShaderMaterial({ vertexShader: dustVert, fragmentShader: dustFrag, uniforms: dustUniforms, transparent: true, depthWrite: false, depthTest: false });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  scene.add(dust);
  scene.add(points);

  let light = o.light;
  let pair = -1;
  let stage = 0;
  let layouts: Layout[] = o.shapes.map(() => ({ x: 0, y: 0, scale: 1 }));
  let hover = 0, hoverTarget = 0;
  let w = 1, h = 1;

  function setTint() {
    const arr = tint.array as Float32Array;
    const cols = RING_WORKS.map((s) => new THREE.Color(light ? TINTS[s].light : TINTS[s].dark));
    for (let i = 0; i < n; i++) {
      const c = ringData && ringData.group[i] >= cols.length ? cols[0] : cols[i % cols.length];
      arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
    }
    tint.needsUpdate = true;
  }
  function applyTheme() {
    material.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
    dustMat.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
    uniforms.uIntensity.value = light ? 0.85 : 0.62 / Math.sqrt(Math.min(density, 2));
    uniforms.uLight.value = light ? 1 : 0;
    dustUniforms.uColor.value.set(light ? '#6b5a3c' : '#cfc4ae');
    dustUniforms.uAlpha.value = light ? 0.35 : 0.45;
    material.needsUpdate = true;
    dustMat.needsUpdate = true;
    setTint();
    setColors();
  }
  function setColors() {
    const ia = Math.max(pair, 0), ib = Math.min(ia + 1, o.shapes.length - 1);
    const a = o.shapes[ia], b = o.shapes[ib];
    uniforms.uColA.value.set(light ? TINTS[a].light : TINTS[a].dark);
    uniforms.uColB.value.set(light ? TINTS[b].light : TINTS[b].dark);
    uniforms.uTintAB.value.set(a === 'ring' ? 1 : 0, b === 'ring' ? 1 : 0);
    uniforms.uMnAB.value.set(a === 'minnesota' ? 1 : 0, b === 'minnesota' ? 1 : 0);
  }
  function setPair(i: number) {
    if (i === pair) return;
    pair = i;
    (aA.array as Float32Array).set(data[i]);
    (aB.array as Float32Array).set(data[Math.min(i + 1, data.length - 1)]);
    aA.needsUpdate = true;
    aB.needsUpdate = true;
    setColors();
  }
  applyTheme();
  setPair(0);

  function resize() {
    w = o.canvas.clientWidth || window.innerWidth;
    h = o.canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  const onLost = (e: Event) => { e.preventDefault(); stop(); o.onLost(); };
  o.canvas.addEventListener('webglcontextlost', onLost);

  let raf = 0;
  let last = performance.now();
  let clock = 0;
  let intro = o.motion ? 0 : 1;
  const INTRO_S = 2.6;
  const tmp = new THREE.Vector3();
  let odd = false;
  let ringAngle = 0;

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    odd = !odd;
    if (o.halfRate && odd) return; // weak devices draw at 30 fps
    const dt = Math.min(0.08, (now - last) / 1000);
    last = now;
    if (o.motion) clock += dt;
    uniforms.uTime.value = clock;
    dustUniforms.uTime.value = clock;
    dustUniforms.uScroll.value = window.scrollY / Math.max(1, h) * 1.2;
    if (intro < 1) { intro = Math.min(1, intro + dt / INTRO_S); uniforms.uIntro.value = intro; }

    const lastI = o.shapes.length - 1;
    const i = Math.min(Math.floor(stage), lastI);
    const f = i >= lastI ? 0 : stage - i;
    setPair(i);
    const m = f <= 0.15 ? 0 : f >= 0.85 ? 1 : (f - 0.15) / 0.7;
    uniforms.uMix.value = m;
    const e = m * m * (3 - 2 * m);

    const la = layouts[i], lb = layouts[Math.min(i + 1, lastI)];
    const { visW, visH } = viewSize(w, h);
    points.position.set(
      ((la.x + (lb.x - la.x) * e) * visW) / 2,
      ((la.y + (lb.y - la.y) * e) * visH) / 2, 0);
    points.scale.setScalar(la.scale + (lb.scale - la.scale) * e);
    const ra = wrap(motionAngle(o.shapes[i], clock));
    const rb = wrap(motionAngle(o.shapes[Math.min(i + 1, lastI)], clock));
    points.rotation.y = ra + wrap(rb - ra) * e;

    // The orbit turns slowly; as the reader leaves the hero it brings the book to the
    // front so the small book can grow into the big one.
    const spin = wrap(clock * 0.14);
    uniforms.uRingAngle.value = o.shapes[i] === 'ring' ? spin + wrap(0 - spin) * e : 0;
    ringAngle = uniforms.uRingAngle.value;

    hover += (hoverTarget - hover) * (1 - Math.exp(-dt * 8));
    uniforms.uHover.value = hover;
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  function stop() {
    cancelAnimationFrame(raf);
  }

  return {
    kind: 'webgl' as const,
    setStage(s: number) { stage = s; },
    setLayouts(l: Layout[]) { layouts = l; },
    setTheme(isLight: boolean) { light = isLight; applyTheme(); },
    setHover(on: boolean) { hoverTarget = on ? 1 : 0; },
    setCounty(c: number) { uniforms.uCounty.value = c; },
    resize,
    // Screen positions (and whether each is on the far side) of points in shape space.
    project(pts: [number, number, number][]) {
      points.updateMatrixWorld();
      const centre = new THREE.Vector3().setFromMatrixPosition(points.matrixWorld);
      return pts.map((p) => {
        tmp.set(p[0], p[1], p[2]).applyMatrix4(points.matrixWorld);
        const back = tmp.z < centre.z - 0.05;
        tmp.project(camera);
        return { sx: (tmp.x * 0.5 + 0.5) * w, sy: (-tmp.y * 0.5 + 0.5) * h, back };
      });
    },
    introDone() { return intro >= 1; },
    ringAngle() { return ringAngle; },
    destroy() {
      stop();
      o.canvas.removeEventListener('webglcontextlost', onLost);
      geo.dispose(); material.dispose(); dustGeo.dispose(); dustMat.dispose(); renderer.dispose();
    },
  };
}

export type Field = ReturnType<typeof createField>;
