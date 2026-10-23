// The WebGL particle field for the home page. One THREE.Points cloud; each stop of
// the story is a target shape, and the vertex shader blends between two of them.

import * as THREE from 'three';
import { buildShape, TINTS, NETWORK_NODES, type ShapeName, type GeoData } from './shapes';
import { FOV, CAM_Z, POSE, viewSize, type Layout } from './flat';

const vert = /* glsl */ `
  attribute vec4 aA;
  attribute vec4 aB;
  attribute vec4 aRand;
  uniform float uMix;
  uniform float uTime;
  uniform float uSize;
  uniform float uDpr;
  uniform float uHover;
  uniform float uMotion;
  uniform vec3 uPointer;
  uniform float uPointerOn;
  uniform vec3 uColA;
  uniform vec3 uColB;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float t = clamp(uMix * 1.4 - aRand.x * 0.4, 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);
    vec3 p = mix(aA.xyz, aB.xyz, t);
    float w = mix(aA.w, aB.w, t);
    float burst = sin(3.14159 * t);
    p += (aRand.yzw - 0.5) * burst * 0.9 * uMotion;
    p += uMotion * 0.012 * vec3(
      sin(uTime * 0.9 + aRand.y * 40.0),
      cos(uTime * 0.7 + aRand.z * 40.0),
      sin(uTime * 0.8 + aRand.w * 40.0));
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vec2 d = wp.xy - uPointer.xy;
    float dist2 = dot(d, d);
    wp.xy += normalize(d + 1e-5) * exp(-dist2 * 9.0) * 0.18 * uPointerOn;
    vec4 mv = viewMatrix * wp;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uDpr * (0.55 + w * 0.9) * (1.0 + uHover * 0.18) / -mv.z;
    vColor = mix(uColA, uColB, t);
    vAlpha = (0.3 + 0.7 * w) * (1.0 + uHover * 0.35);
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

function motionAngle(shape: ShapeName, t: number) {
  const base = POSE[shape];
  switch (shape) {
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
  const data = o.shapes.map((s) => buildShape(s, n, o.geo));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const aA = new THREE.BufferAttribute(new Float32Array(n * 4), 4);
  const aB = new THREE.BufferAttribute(new Float32Array(n * 4), 4);
  aA.setUsage(THREE.DynamicDrawUsage);
  aB.setUsage(THREE.DynamicDrawUsage);
  const rand = new Float32Array(n * 4);
  let seed = 12345;
  for (let i = 0; i < rand.length; i++) { seed = (seed * 16807) % 2147483647; rand[i] = seed / 2147483647; }
  geo.setAttribute('aA', aA);
  geo.setAttribute('aB', aB);
  geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 4));

  const density = Math.sqrt(60000 / n);
  const uniforms = {
    uMix: { value: 0 },
    uTime: { value: 0 },
    uSize: { value: 15 * Math.min(density, 1.55) },
    uDpr: { value: o.dpr },
    uHover: { value: 0 },
    uMotion: { value: o.motion ? 1 : 0 },
    uPointer: { value: new THREE.Vector3(99, 99, 0) },
    uPointerOn: { value: 0 },
    uColA: { value: new THREE.Color() },
    uColB: { value: new THREE.Color() },
    uIntensity: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, uniforms,
    transparent: true, depthWrite: false, depthTest: false,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  scene.add(points);

  let light = o.light;
  let pair = -1;
  let stage = 0;
  let layouts: Layout[] = o.shapes.map(() => ({ x: 0, y: 0, scale: 1 }));
  let hover = 0, hoverTarget = 0;
  let w = 1, h = 1;
  const pointerNdc = new THREE.Vector2(9, 9);
  let pointerActive = false;
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();

  function applyTheme() {
    material.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
    uniforms.uIntensity.value = light ? 0.85 : 0.62 / Math.sqrt(Math.min(density, 2));
    material.needsUpdate = true;
    setColors();
  }
  function setColors() {
    const a = o.shapes[Math.max(pair, 0)], b = o.shapes[Math.min(Math.max(pair, 0) + 1, o.shapes.length - 1)];
    uniforms.uColA.value.set(light ? TINTS[a].light : TINTS[a].dark);
    uniforms.uColB.value.set(light ? TINTS[b].light : TINTS[b].dark);
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
  const tmp = new THREE.Vector3();

  let odd = false;
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    odd = !odd;
    if (o.halfRate && odd) return; // weak devices draw at 30 fps
    const dt = Math.min(0.08, (now - last) / 1000);
    last = now;
    if (o.motion) clock += dt;
    uniforms.uTime.value = clock;

    const last_i = o.shapes.length - 1;
    const i = Math.min(Math.floor(stage), last_i);
    const f = i >= last_i ? 0 : stage - i;
    setPair(i);
    const m = f <= 0.15 ? 0 : f >= 0.85 ? 1 : (f - 0.15) / 0.7;
    uniforms.uMix.value = m;
    const e = m * m * (3 - 2 * m);

    const la = layouts[i], lb = layouts[Math.min(i + 1, last_i)];
    const { visW, visH } = viewSize(w, h);
    points.position.set(
      ((la.x + (lb.x - la.x) * e) * visW) / 2,
      ((la.y + (lb.y - la.y) * e) * visH) / 2, 0);
    points.scale.setScalar(la.scale + (lb.scale - la.scale) * e);
    const ra = wrap(motionAngle(o.shapes[i], clock));
    const rb = wrap(motionAngle(o.shapes[Math.min(i + 1, last_i)], clock));
    let dr = wrap(rb - ra);
    points.rotation.y = ra + dr * e;

    hover += (hoverTarget - hover) * (1 - Math.exp(-dt * 8));
    uniforms.uHover.value = hover;

    if (pointerActive) {
      ray.setFromCamera(pointerNdc, camera);
      if (ray.ray.intersectPlane(plane, hit)) uniforms.uPointer.value.copy(hit);
      uniforms.uPointerOn.value += (1 - uniforms.uPointerOn.value) * (1 - Math.exp(-dt * 6));
    } else {
      uniforms.uPointerOn.value *= Math.exp(-dt * 6);
    }
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
    setPointer(x: number | null, y?: number) {
      if (x === null || y === undefined) { pointerActive = false; return; }
      pointerActive = true;
      pointerNdc.set((x / w) * 2 - 1, -(y / h) * 2 + 1);
    },
    resize,
    // Screen positions of the research nodes, for the DOM labels.
    nodes() {
      points.updateMatrixWorld();
      return NETWORK_NODES.map((p) => {
        tmp.set(p[0], p[1], p[2]).applyMatrix4(points.matrixWorld).project(camera);
        return { sx: (tmp.x * 0.5 + 0.5) * w, sy: (-tmp.y * 0.5 + 0.5) * h };
      });
    },
    destroy() {
      stop();
      o.canvas.removeEventListener('webglcontextlost', onLost);
      geo.dispose(); material.dispose(); renderer.dispose();
    },
  };
}

export type Field = ReturnType<typeof createField>;
