// Builds point-cloud shape data for the 3D particle scenes.
//   node scripts/build-shapes.mjs   (or: npm run shapes)
// Writes public/shapes/south-asia.json and public/shapes/minnesota.json.
// Fully deterministic: all randomness comes from seeded mulberry32.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoArea, geoBounds, geoContains, geoMercator } from 'd3-geo';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'shapes');
const DEG = Math.PI / 180;

const loadJSON = (spec) => JSON.parse(readFileSync(require.resolve(spec), 'utf8'));

// ---------------------------------------------------------------- RNG
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (rng) => {
  const u = Math.max(rng(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
};

const r3 = (v) => {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
};

// ---------------------------------------------------------------- sampling
// Equal-area grid: latitude step d, longitude step d / cos(lat), so every cell
// covers ~d^2 steradians. Each grid node gets a small seeded jitter, then is
// tested against the feature(s) with geoContains. Returns [lon, lat, idx].
function sampleEqualArea(features, target, rng, jitter = 0.32) {
  const area = features.reduce((s, f) => s + geoArea(f), 0);
  const d = Math.sqrt(area / target) / DEG; // degrees
  const boxes = features.map((f) => geoBounds(f));
  const lonMin = Math.min(...boxes.map((b) => b[0][0]));
  const lonMax = Math.max(...boxes.map((b) => b[1][0]));
  const latMin = Math.min(...boxes.map((b) => b[0][1]));
  const latMax = Math.max(...boxes.map((b) => b[1][1]));
  const out = [];
  for (let lat = latMin + d / 2; lat < latMax; lat += d) {
    const dl = d / Math.cos(lat * DEG);
    const offset = rng() * dl; // per-row phase so columns don't line up
    for (let lon = lonMin + offset; lon < lonMax; lon += dl) {
      const p = [lon + (rng() - 0.5) * 2 * jitter * dl, lat + (rng() - 0.5) * 2 * jitter * d];
      for (let i = 0; i < features.length; i++) {
        const b = boxes[i];
        if (p[0] < b[0][0] || p[0] > b[1][0] || p[1] < b[0][1] || p[1] > b[1][1]) continue;
        if (geoContains(features[i], p)) {
          out.push([p[0], p[1], i]);
          break;
        }
      }
    }
  }
  return out;
}

// Project [lon,lat] with Mercator, flip y so north is positive, then center
// the bounding box on 0,0 and scale so the longest side spans exactly 2.
function makeNormalizer(lonlats) {
  const proj = geoMercator().scale(1).translate([0, 0]).precision(0);
  const xy = lonlats.map((p) => {
    const [x, y] = proj(p);
    return [x, -y];
  });
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of xy) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const s = 2 / Math.max(x1 - x0, y1 - y0);
  return xy.map(([x, y]) => [(x - cx) * s, (y - cy) * s]);
}

// ---------------------------------------------------------------- terrain
// Ridge polylines: [[lon, lat, peak], ...], sigma in degrees. Peak heights are
// interpolated along each segment; h = max over ridges of a gaussian falloff
// from the nearest point on the polyline.
const RIDGES = [
  { name: 'Himalaya', sigma: 0.75, pts: [
    [73.6, 35.6, 0.85], [74.6, 35.2, 0.95], [75.8, 34.0, 0.85], [77.2, 32.6, 0.85],
    [78.6, 31.2, 0.95], [80.0, 30.3, 0.95], [81.5, 29.7, 0.95], [83.5, 28.75, 1.0],
    [85.5, 28.2, 1.0], [86.9, 27.95, 1.0], [88.2, 27.9, 0.95], [89.5, 28.0, 0.9],
    [90.8, 28.05, 0.9], [92.2, 27.95, 0.85], [93.8, 28.5, 0.85], [95.4, 29.0, 0.8],
    [96.8, 28.6, 0.7] ] },
  { name: 'Karakoram', sigma: 0.6, pts: [
    [74.2, 36.6, 0.85], [75.5, 36.2, 0.95], [76.5, 35.9, 1.0], [77.6, 35.4, 0.95],
    [78.6, 34.7, 0.85] ] },
  { name: 'Ladakh-Zanskar', sigma: 0.65, pts: [
    [75.6, 34.6, 0.7], [76.8, 34.0, 0.75], [78.2, 33.2, 0.75], [79.3, 32.5, 0.7] ] },
  { name: 'Pamir-Wakhan', sigma: 0.55, pts: [
    [71.4, 37.0, 0.65], [72.8, 37.0, 0.8], [74.0, 37.1, 0.85], [74.9, 37.3, 0.85] ] },
  { name: 'Hindu Kush', sigma: 0.9, pts: [
    [73.6, 36.7, 0.85], [71.8, 36.25, 0.85], [70.4, 35.6, 0.75], [69.0, 35.2, 0.6],
    [67.6, 34.8, 0.55], [66.2, 34.6, 0.5], [64.6, 34.4, 0.4], [63.0, 34.3, 0.28],
    [61.8, 34.4, 0.15] ] },
  { name: 'Spin Ghar-Sulaiman', sigma: 0.55, pts: [
    [70.6, 34.1, 0.4], [69.9, 32.6, 0.35], [69.7, 31.2, 0.32], [69.2, 30.0, 0.28],
    [67.8, 29.2, 0.2] ] },
  { name: 'Kirthar', sigma: 0.45, pts: [
    [67.4, 28.6, 0.18], [67.4, 27.0, 0.15], [67.3, 25.8, 0.1] ] },
  { name: 'Western Ghats', sigma: 0.4, pts: [
    [73.4, 21.0, 0.15], [73.6, 19.0, 0.22], [73.9, 17.0, 0.22], [74.4, 15.0, 0.22],
    [75.3, 13.2, 0.24], [76.6, 11.4, 0.3], [77.1, 10.1, 0.28], [77.3, 8.6, 0.22] ] },
  { name: 'Northeast hills', sigma: 0.45, pts: [
    [96.0, 27.4, 0.35], [95.0, 26.4, 0.3], [94.2, 25.2, 0.28], [93.5, 23.8, 0.22],
    [92.9, 22.8, 0.15] ] },
  { name: 'Shillong plateau', sigma: 0.35, pts: [
    [90.2, 25.6, 0.12], [91.8, 25.5, 0.15], [92.8, 25.7, 0.12] ] },
  { name: 'Aravalli', sigma: 0.35, pts: [
    [72.6, 24.4, 0.1], [73.8, 25.6, 0.08], [75.6, 27.2, 0.06] ] },
  { name: 'Sri Lanka highlands', sigma: 0.3, pts: [
    [80.55, 6.75, 0.17], [80.78, 6.95, 0.2], [80.9, 7.25, 0.17] ] },
];

function ridgeHeight(lon, lat) {
  const k = Math.cos(lat * DEG);
  let h = 0;
  for (const r of RIDGES) {
    let best = Infinity, peak = 0;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [ax, ay, ah] = r.pts[i];
      const [bx, by, bh] = r.pts[i + 1];
      const dx = (bx - ax) * k, dy = by - ay;
      const px = (lon - ax) * k, py = lat - ay;
      const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy)));
      const ex = px - t * dx, ey = py - t * dy;
      const d2 = ex * ex + ey * ey;
      if (d2 < best) { best = d2; peak = ah + (bh - ah) * t; }
    }
    const v = peak * Math.exp(-best / (2 * r.sigma * r.sigma));
    if (v > h) h = v;
  }
  return h;
}

// Seeded 2D value noise for a bit of terrain texture.
function makeNoise(seed) {
  const hash = (ix, iy) => {
    let n = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ seed;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = sm(x - ix), fy = sm(y - iy);
    const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

// ---------------------------------------------------------------- South Asia
function buildSouthAsia() {
  const rng = mulberry32(0x5a51a);
  const noise = makeNoise(0x1234);
  const NAMES = ['Afghanistan', 'Pakistan', 'India', 'Nepal', 'Bhutan', 'Bangladesh', 'Sri Lanka', 'Maldives'];
  const w50 = loadJSON('world-atlas/countries-50m.json');
  const w10 = loadJSON('world-atlas/countries-10m.json');
  const fc50 = feature(w50, w50.objects.countries).features;
  const fc10 = feature(w10, w10.objects.countries).features;
  const find = (fc, n) => {
    const f = fc.find((x) => x.properties.name === n);
    if (!f) throw new Error(`missing country ${n}`);
    return f;
  };

  const land = NAMES.slice(0, 7).map((n) => find(fc50, n));
  const pts = sampleEqualArea(land, 6920, rng);

  // Maldives: far too small for area sampling. Jitter around the 10m island
  // vertices (each of the 176 islands equally likely, so the whole atoll chain
  // from Ihavandhippolhu to Addu shows up), spread slightly enlarged.
  const mv = find(fc10, 'Maldives');
  const islands = mv.geometry.coordinates.map((poly) => poly[0]);
  const MALDIVES_N = 84;
  for (let i = 0; i < MALDIVES_N; i++) {
    const ring = islands[Math.floor(rng() * islands.length)];
    const v = ring[Math.floor(rng() * ring.length)];
    pts.push([v[0] + gauss(rng) * 0.05, v[1] + gauss(rng) * 0.05, 7]);
  }

  const xy = makeNormalizer(pts.map((p) => [p[0], p[1]]));
  const flat = [];
  const counts = new Array(NAMES.length).fill(0);
  const sums = NAMES.map(() => [0, 0]);
  for (let i = 0; i < pts.length; i++) {
    const [lon, lat, c] = pts[i];
    let h = ridgeHeight(lon, lat);
    if (h > 0.02) h *= 0.82 + 0.36 * noise(lon * 1.6, lat * 1.6);
    h = Math.max(0, Math.min(1, h));
    if (h < 0.005) h = 0;
    const [x, y] = xy[i];
    flat.push(r3(x), r3(y), r3(h), c);
    counts[c]++;
    sums[c][0] += x;
    sums[c][1] += y;
  }

  // Label anchor: mean of the country's sampled points, snapped to the nearest
  // sampled point of that same country (keeps it inside concave shapes).
  const labels = NAMES.map((name, c) => {
    const mx = sums[c][0] / counts[c], my = sums[c][1] / counts[c];
    let best = Infinity, bx = 0, by = 0;
    for (let i = 0; i < xy.length; i++) {
      if (pts[i][2] !== c) continue;
      const d = (xy[i][0] - mx) ** 2 + (xy[i][1] - my) ** 2;
      if (d < best) { best = d; bx = xy[i][0]; by = xy[i][1]; }
    }
    return { name, x: r3(bx), y: r3(by) };
  });

  return { data: { n: pts.length, countries: NAMES, pts: flat, labels }, counts, NAMES };
}

// ---------------------------------------------------------------- Minnesota
function buildMinnesota() {
  const rng = mulberry32(0x27);
  const us = loadJSON('us-atlas/states-10m.json');
  const mn = feature(us, us.objects.states).features.find((f) => f.id === '27');
  if (!mn) throw new Error('Minnesota (27) not found');

  const interior = sampleEqualArea([mn], 2800, rng).map((p) => [p[0], p[1], 0]);

  // Border: ~700 points evenly spaced by arc length across all outer rings,
  // measured in projected space so spacing looks even on screen.
  const polys = mn.geometry.type === 'Polygon' ? [mn.geometry.coordinates] : mn.geometry.coordinates;
  const rings = polys.map((p) => p[0]);
  const proj = geoMercator().scale(1).translate([0, 0]).precision(0);
  const segs = [];
  let total = 0;
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const a = proj(ring[i]), b = proj(ring[i + 1]);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len === 0) continue;
      segs.push({ a: ring[i], b: ring[i + 1], start: total, len });
      total += len;
    }
  }
  const BORDER_N = 700;
  const step = total / BORDER_N;
  const border = [];
  let si = 0;
  const phase = rng() * step;
  for (let k = 0; k < BORDER_N; k++) {
    const s = phase + k * step;
    while (si < segs.length - 1 && segs[si].start + segs[si].len < s) si++;
    const g = segs[si];
    const t = Math.max(0, Math.min(1, (s - g.start) / g.len));
    border.push([g.a[0] + (g.b[0] - g.a[0]) * t, g.a[1] + (g.b[1] - g.a[1]) * t, 1]);
  }

  const all = [...interior, ...border];
  const xy = makeNormalizer(all.map((p) => [p[0], p[1]]));
  const flat = [];
  for (let i = 0; i < all.length; i++) flat.push(r3(xy[i][0]), r3(xy[i][1]), all[i][2]);
  return { data: { n: all.length, pts: flat }, interior: interior.length, border: border.length };
}

// ---------------------------------------------------------------- main
mkdirSync(OUT_DIR, { recursive: true });

const sa = buildSouthAsia();
const saJson = JSON.stringify(sa.data);
writeFileSync(join(OUT_DIR, 'south-asia.json'), saJson);
console.log(`south-asia.json  n=${sa.data.n}  ${(saJson.length / 1024).toFixed(1)} KB`);
sa.NAMES.forEach((n, i) => console.log(`  ${i} ${n.padEnd(12)} ${sa.counts[i]}`));

const mn = buildMinnesota();
const mnJson = JSON.stringify(mn.data);
writeFileSync(join(OUT_DIR, 'minnesota.json'), mnJson);
console.log(`minnesota.json   n=${mn.data.n} (interior ${mn.interior}, border ${mn.border})  ${(mnJson.length / 1024).toFixed(1)} KB`);
