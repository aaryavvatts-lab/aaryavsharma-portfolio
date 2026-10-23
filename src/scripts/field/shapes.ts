// Point clouds for each stop of the home story. Every shape returns N points as
// [x, y, z, w] where w (0..1) is brightness. Pure math, no three.js import, so the
// flat 2D fallback can share it without pulling three into the page.

export type ShapeName = 'sphere' | 'ring' | 'book' | 'brain' | 'southAsia' | 'helix' | 'network' | 'minnesota' | 'galaxy';

export type GeoData = {
  southAsia: { n: number; pts: number[] } | null;
  minnesota: { n: number; pts: number[] } | null;
};

// mulberry32: deterministic so the same particle lands in the same place every load
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(r: () => number) {
  const u = Math.max(r(), 1e-6);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

function tiltX(out: Float32Array, angle: number) {
  const c = Math.cos(angle), s = Math.sin(angle);
  for (let i = 0; i < out.length; i += 4) {
    const y = out[i + 1], z = out[i + 2];
    out[i + 1] = y * c - z * s;
    out[i + 2] = y * s + z * c;
  }
}

function sphere(n: number, r: () => number) {
  const out = new Float32Array(n * 4);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = golden * i;
    const shell = 1.18 + gauss(r) * 0.035 + (r() < 0.12 ? r() * 0.45 : 0);
    out[i * 4] = Math.cos(th) * rad * shell;
    out[i * 4 + 1] = y * shell;
    out[i * 4 + 2] = Math.sin(th) * rad * shell;
    out[i * 4 + 3] = 0.25 + r() * 0.75;
  }
  return out;
}

// An open book: two curved page stacks with lines of "text" picked out brighter.
function book(n: number, r: () => number) {
  const out = new Float32Array(n * 4);
  const W = 1.22, H = 1.6;
  for (let i = 0; i < n; i++) {
    const side = r() < 0.5 ? -1 : 1;
    const u = r(); // 0 at the spine, 1 at the outer edge
    const v = r() - 0.5;
    const layer = r() < 0.78 ? 0 : Math.floor(r() * 7) + 1; // top page vs the stack under it
    const lift = Math.sin(Math.PI * Math.pow(u, 0.7)) * 0.32 * (1 - layer * 0.07) + Math.sqrt(u) * 0.12;
    let x = side * u * W;
    let y = v * H;
    let z = lift - layer * 0.03;
    if (layer > 0) { x = side * u * (W - layer * 0.012); y *= 1 - layer * 0.004; }
    let w = 0.28;
    if (layer === 0) {
      const inMargin = u > 0.12 && u < 0.88 && Math.abs(v) < 0.42;
      const line = (v + 0.5) * 22;
      if (inMargin && line - Math.floor(line) < 0.32) w = 0.95;
      if (inMargin && Math.abs(v - 0.36) < 0.03 && u < 0.6) w = 1;
    } else {
      w = 0.18 + (layer === 7 ? 0.3 : 0);
    }
    out[i * 4] = x;
    out[i * 4 + 1] = y + gauss(r) * 0.004;
    out[i * 4 + 2] = z + gauss(r) * 0.004;
    out[i * 4 + 3] = w;
  }
  tiltX(out, -0.95);
  for (let i = 0; i < n; i++) out[i * 4 + 1] -= 0.05;
  return out;
}

function fold(x: number, y: number, z: number) {
  return Math.sin(x * 9.5 + Math.sin(y * 6.0) * 2.2) * Math.sin(y * 8.5 + Math.sin(z * 7.0) * 2.0) +
    0.6 * Math.sin(z * 11.0 + Math.sin(x * 5.0) * 2.4);
}

// Side view of a brain: two folded hemispheres, cerebellum and brain stem.
function brain(n: number, r: () => number) {
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const pick = r();
    let x: number, y: number, z: number, w: number;
    if (pick < 0.82) {
      // cerebrum shell
      let dx: number, dy: number, dz: number, len: number;
      do {
        dx = gauss(r); dy = gauss(r); dz = gauss(r);
        len = Math.hypot(dx, dy, dz);
      } while (len < 1e-4);
      dx /= len; dy /= len; dz /= len;
      const hemi = dz >= 0 ? 1 : -1;
      const f = fold(dx, dy, dz);
      const rr = 1 + f * 0.06 - (r() < 0.25 ? r() * 0.08 : 0);
      x = dx * 1.08 * rr;
      y = dy * 0.78 * rr;
      z = hemi * (0.06 + Math.abs(dz) * 0.52 * rr);
      if (y < -0.32) y = -0.32 + (y + 0.32) * 0.45; // flatter underside
      if (x > 0.35 && y < -0.1) y += 0.06; // frontal lobe sits higher
      w = f > 0.35 ? 0.95 : f > -0.2 ? 0.5 : 0.22;
    } else if (pick < 0.95) {
      // cerebellum, finely striped
      const a = r() * Math.PI * 2, b = Math.acos(2 * r() - 1);
      x = -0.72 + Math.sin(b) * Math.cos(a) * 0.36;
      y = -0.5 + Math.cos(b) * 0.2;
      z = Math.sin(b) * Math.sin(a) * 0.5;
      const stripe = Math.sin((y + 0.5) * 70);
      w = stripe > 0.2 ? 0.85 : 0.3;
    } else {
      // brain stem
      const t = r();
      const a = r() * Math.PI * 2;
      x = -0.3 - t * 0.12 + Math.cos(a) * 0.075;
      y = -0.42 - t * 0.62;
      z = Math.sin(a) * 0.075;
      w = 0.35;
    }
    out[i * 4] = x; out[i * 4 + 1] = y + 0.12; out[i * 4 + 2] = z; out[i * 4 + 3] = w;
  }
  return out;
}

function southAsia(n: number, r: () => number, data: NonNullable<GeoData['southAsia']>) {
  const out = new Float32Array(n * 4);
  const m = data.n;
  for (let i = 0; i < n; i++) {
    const k = (i % m) * 4;
    const h = data.pts[k + 2];
    out[i * 4] = data.pts[k] * 1.4 + gauss(r) * 0.006;
    out[i * 4 + 1] = data.pts[k + 1] * 1.4 + gauss(r) * 0.006;
    out[i * 4 + 2] = h * 0.38 + gauss(r) * 0.004;
    out[i * 4 + 3] = 0.3 + h * 0.7;
  }
  tiltX(out, -0.62);
  return out;
}

function helix(n: number, r: () => number) {
  const out = new Float32Array(n * 4);
  const turns = 2.3, Hh = 2.4, R = 0.44, rungs = 24;
  for (let i = 0; i < n; i++) {
    let x: number, y: number, z: number, w: number;
    if (r() < 0.68) {
      const t = r();
      const strand = r() < 0.5 ? 0 : Math.PI;
      const a = t * turns * Math.PI * 2 + strand;
      x = Math.cos(a) * R + gauss(r) * 0.018;
      z = Math.sin(a) * R + gauss(r) * 0.018;
      y = (t - 0.5) * Hh + gauss(r) * 0.01;
      w = 0.95;
    } else {
      const k = Math.floor(r() * rungs);
      const t = (k + 0.5) / rungs;
      const a = t * turns * Math.PI * 2;
      const s = r() * 2 - 1;
      x = Math.cos(a) * R * s;
      z = Math.sin(a) * R * s;
      y = (t - 0.5) * Hh + gauss(r) * 0.006;
      w = 0.4 + (Math.abs(s) < 0.08 ? 0.4 : 0);
    }
    out[i * 4] = x; out[i * 4 + 1] = y; out[i * 4 + 2] = z; out[i * 4 + 3] = w;
  }
  return out;
}

// Ten nodes, one per research project, in the order of `projects` in site.ts.
export const NETWORK_NODES: [number, number, number][] = [
  [-1.15, 0.62, 0.1], [-0.35, 0.95, -0.25], [0.55, 0.78, 0.2], [1.2, 0.35, -0.15],
  [-0.85, -0.05, 0.35], [0.05, 0.2, -0.05], [0.85, -0.3, 0.3], [-1.25, -0.72, -0.2],
  [-0.2, -0.78, 0.15], [0.65, -0.98, -0.25],
];

function edges(): [number, number][] {
  const list: [number, number][] = [];
  const seen = new Set<string>();
  NETWORK_NODES.forEach((a, i) => {
    const near = NETWORK_NODES.map((b, j) => ({ j, d: Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) }))
      .filter((e) => e.j !== i).sort((p, q) => p.d - q.d).slice(0, 3);
    near.forEach(({ j }) => {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(key)) { seen.add(key); list.push([i, j]); }
    });
  });
  return list;
}

function network(n: number, r: () => number) {
  const out = new Float32Array(n * 4);
  const E = edges();
  for (let i = 0; i < n; i++) {
    const pick = r();
    let x: number, y: number, z: number, w: number;
    if (pick < 0.42) {
      const node = NETWORK_NODES[Math.floor(r() * NETWORK_NODES.length)];
      const s = 0.035 + (r() < 0.3 ? 0.06 : 0);
      x = node[0] + gauss(r) * s; y = node[1] + gauss(r) * s; z = node[2] + gauss(r) * s;
      w = 1;
    } else if (pick < 0.9) {
      const [a, b] = E[Math.floor(r() * E.length)];
      const t = r();
      const A = NETWORK_NODES[a], B = NETWORK_NODES[b];
      const bow = Math.sin(Math.PI * t) * 0.06;
      x = A[0] + (B[0] - A[0]) * t + gauss(r) * 0.006;
      y = A[1] + (B[1] - A[1]) * t + bow + gauss(r) * 0.006;
      z = A[2] + (B[2] - A[2]) * t + gauss(r) * 0.006;
      w = 0.45;
    } else {
      x = (r() - 0.5) * 3.4; y = (r() - 0.5) * 2.4; z = (r() - 0.5) * 1.2;
      w = 0.12;
    }
    out[i * 4] = x; out[i * 4 + 1] = y; out[i * 4 + 2] = z; out[i * 4 + 3] = w;
  }
  return out;
}

export const MN_SCALE = 1.3;
export const MN_TILT = -0.45;

// Minnesota from minnesota.json: [x, y, e, county] per point, where e is
// 0 inside a county, 1 on the state border and 2 on a county border.
function minnesota(n: number, r: () => number, data: NonNullable<GeoData['minnesota']>) {
  const out = new Float32Array(n * 4);
  const m = data.n;
  const stride = data.pts.length / m;
  for (let i = 0; i < n; i++) {
    const k = (i % m) * stride;
    const e = data.pts[k + 2];
    const jitter = e === 0 ? 0.008 : 0.003;
    out[i * 4] = data.pts[k] * MN_SCALE + gauss(r) * jitter;
    out[i * 4 + 1] = data.pts[k + 1] * MN_SCALE + gauss(r) * jitter;
    out[i * 4 + 2] = gauss(r) * 0.012;
    out[i * 4 + 3] = e === 1 ? 1 : e === 2 ? 0.62 : 0.26;
  }
  tiltX(out, MN_TILT);
  return out;
}

// County index for particle i of the Minnesota shape (-1 when the data has no counties).
export function mnCounty(i: number, data: GeoData['minnesota']) {
  if (!data) return -1;
  const stride = data.pts.length / data.n;
  return stride >= 4 ? data.pts[(i % data.n) * stride + 3] : -1;
}

// Where a point of minnesota.json sits in shape space (before the scene transform).
export function mnPoint(x: number, y: number): [number, number, number] {
  const c = Math.cos(MN_TILT), s = Math.sin(MN_TILT);
  const py = y * MN_SCALE;
  return [x * MN_SCALE, py * c, py * s];
}

// The hero: a small particle version of each thing on the home page, orbiting on one
// tilted ring. Particle i keeps the same index it has in its full-size shape, so when
// the reader scrolls, the small book grows straight into the big one. A few particles
// trace the orbit itself (group 6).
export const RING_WORKS: ShapeName[] = ['book', 'brain', 'southAsia', 'helix', 'network', 'minnesota'];
export const RING_R = 1.75, RING_S = 0.42, RING_TILT = 0.34;

export function ringCenter(k: number, angle: number): [number, number, number] {
  const a = (k / RING_WORKS.length) * Math.PI * 2 + angle;
  const x = Math.sin(a) * RING_R, z = Math.cos(a) * RING_R;
  return [x, -z * Math.sin(RING_TILT), z * Math.cos(RING_TILT)];
}

export function ringCenters(angle = 0): [number, number, number][] {
  return RING_WORKS.map((_, k) => ringCenter(k, angle));
}

// Positions relative to each sculpture's own centre, plus which group each particle is in.
export function ringLocal(n: number, geo: GeoData | null, seed = 7) {
  const pos = new Float32Array(n * 4);
  const group = new Float32Array(n);
  const parts = RING_WORKS.map((w) => buildShape(w, n, geo, seed));
  const r = rng(seed * 31 + 7);
  const k = RING_WORKS.length;
  for (let i = 0; i < n; i++) {
    if (r() < 0.1) {
      const th = r() * Math.PI * 2;
      const [x, y, z] = [Math.sin(th) * RING_R, 0, Math.cos(th) * RING_R];
      pos[i * 4] = x + gauss(r) * 0.012;
      pos[i * 4 + 1] = -z * Math.sin(RING_TILT) + y + gauss(r) * 0.012;
      pos[i * 4 + 2] = z * Math.cos(RING_TILT);
      pos[i * 4 + 3] = 0.16;
      group[i] = k;
      continue;
    }
    const g = i % k;
    const src = parts[g];
    pos[i * 4] = src[i * 4] * RING_S;
    pos[i * 4 + 1] = src[i * 4 + 1] * RING_S;
    pos[i * 4 + 2] = src[i * 4 + 2] * RING_S;
    pos[i * 4 + 3] = Math.min(1, src[i * 4 + 3] * 1.15);
    group[i] = g;
  }
  return { pos, group };
}

// The orbit frozen at angle 0, for the flat fallback.
function ring(n: number, geo: GeoData | null, seed: number) {
  const { pos, group } = ringLocal(n, geo, seed);
  for (let i = 0; i < n; i++) {
    if (group[i] >= RING_WORKS.length) continue;
    const [cx, cy, cz] = ringCenter(group[i], 0);
    pos[i * 4] += cx; pos[i * 4 + 1] += cy; pos[i * 4 + 2] += cz;
  }
  return pos;
}

function galaxy(n: number, r: () => number) {
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const arm = Math.floor(r() * 3);
    const rad = Math.pow(r(), 0.65) * 2.1;
    const a = rad * 2.3 + (arm * Math.PI * 2) / 3 + gauss(r) * (0.28 / (rad + 0.35));
    out[i * 4] = Math.cos(a) * rad;
    out[i * 4 + 1] = gauss(r) * 0.05 * (2.2 - rad);
    out[i * 4 + 2] = Math.sin(a) * rad;
    out[i * 4 + 3] = Math.min(1, 0.2 + 0.5 / (rad + 0.4));
  }
  tiltX(out, 0.42);
  return out;
}

export function buildShape(name: ShapeName, n: number, geo: GeoData | null, seed = 7): Float32Array {
  const r = rng(seed * 9973 + SEEDS[name]);
  switch (name) {
    case 'sphere': return sphere(n, r);
    case 'ring': return ring(n, geo, seed);
    case 'book': return book(n, r);
    case 'brain': return brain(n, r);
    case 'southAsia': return geo?.southAsia ? southAsia(n, r, geo.southAsia) : sphere(n, r);
    case 'helix': return helix(n, r);
    case 'network': return network(n, r);
    case 'minnesota': return geo?.minnesota ? minnesota(n, r, geo.minnesota) : sphere(n, r);
    case 'galaxy': return galaxy(n, r);
  }
}

const SEEDS: Record<ShapeName, number> = { ring: 151, sphere: 101, book: 211, brain: 307, southAsia: 401, helix: 503, network: 601, minnesota: 701, galaxy: 809 };

// Each map loads on its own; if one fails, that stop falls back to the sphere.
export async function loadGeo(): Promise<GeoData> {
  const get = (url: string) => fetch(url).then((res) => (res.ok ? res.json() : null)).catch(() => null);
  const [southAsia, minnesota] = await Promise.all([get('/shapes/south-asia.json'), get('/shapes/minnesota.json')]);
  return { southAsia, minnesota };
}

// Tint per shape, for the dark and the light theme.
export const TINTS: Record<ShapeName, { dark: string; light: string }> = {
  sphere: { dark: '#f2c879', light: '#8a4f08' },
  ring: { dark: '#f4d29a', light: '#7a4a0a' },
  book: { dark: '#f3b45a', light: '#9a5a0c' },
  brain: { dark: '#7fd6ea', light: '#0d6f87' },
  southAsia: { dark: '#f29b4b', light: '#a5470f' },
  helix: { dark: '#6fdcc2', light: '#0f7a68' },
  network: { dark: '#9eaaff', light: '#3446c4' },
  minnesota: { dark: '#a9d99c', light: '#3c7a32' },
  galaxy: { dark: '#f0d9a8', light: '#6b4a12' },
};
