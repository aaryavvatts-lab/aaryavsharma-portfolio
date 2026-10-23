// The flat twin of the 3D field: the same shapes drawn once on a 2D canvas.
// Used when WebGL is missing or slow, when reduced motion is on, and for the
// small static pictures at the top of inner pages.

import { buildShape, mnCounty, TINTS, RING_WORKS, type ShapeName, type GeoData } from './shapes';

export type Layout = { x: number; y: number; scale: number };

export const FOV = 35;
export const CAM_Z = 5.2;

export const POSE: Record<ShapeName, number> = {
  sphere: 0.3, ring: 0, book: 0, brain: -0.35, southAsia: 0, helix: 0.4, network: 0.1, minnesota: 0, galaxy: 0.6,
};

export function viewSize(w: number, h: number) {
  const visH = 2 * CAM_Z * Math.tan(((FOV / 2) * Math.PI) / 180);
  return { visW: visH * (w / h), visH };
}

// Project a point (already rotated about Y by `rotY`) with the same camera the 3D view uses.
export function project(p: [number, number, number], rotY: number, layout: Layout, w: number, h: number) {
  const { visW, visH } = viewSize(w, h);
  const c = Math.cos(rotY), s = Math.sin(rotY);
  const x = (p[0] * c + p[2] * s) * layout.scale + (layout.x * visW) / 2;
  const y = p[1] * layout.scale + (layout.y * visH) / 2;
  const z = (-p[0] * s + p[2] * c) * layout.scale;
  const d = CAM_Z - z;
  const f = (h / 2) / Math.tan(((FOV / 2) * Math.PI) / 180);
  return { sx: w / 2 + (x * f) / d, sy: h / 2 - (y * f) / d, depth: d, back: z < -0.05 * layout.scale };
}

const cache = new Map<string, Float32Array>();

export function drawShape(
  ctx: CanvasRenderingContext2D, shape: ShapeName, layout: Layout,
  w: number, h: number, light: boolean, geo: GeoData | null, count = 9000, county = -1,
) {
  const key = `${shape}:${count}:${geo ? 1 : 0}`;
  let pts = cache.get(key);
  if (!pts) { pts = buildShape(shape, count, geo); cache.set(key, pts); }
  const tint = light ? TINTS[shape].light : TINTS[shape].dark;
  const ringCols = RING_WORKS.map((r) => (light ? TINTS[r].light : TINTS[r].dark));
  const hot = light ? '#1a140a' : '#fff6e6';
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';
  ctx.fillStyle = tint;
  const base = Math.max(1, Math.min(w, h) / 520);
  for (let i = 0; i < pts.length; i += 4) {
    let wgt = pts[i + 3];
    const isHot = shape === 'minnesota' && county >= 0 && mnCounty(i / 4, geo?.minnesota ?? null) === county;
    if (isHot) wgt = 1;
    const { sx, sy, depth } = project([pts[i], pts[i + 1], pts[i + 2]], POSE[shape], layout, w, h);
    if (sx < -4 || sy < -4 || sx > w + 4 || sy > h + 4) continue;
    const size = base * (0.7 + wgt * 1.1) * (5.2 / depth) * (isHot ? 1.5 : 1);
    if (shape === 'ring') ctx.fillStyle = ringCols[(i / 4) % ringCols.length];
    if (shape === 'ring' && wgt < 0.2) ctx.fillStyle = tint;
    else if (shape === 'minnesota') ctx.fillStyle = isHot ? hot : tint;
    ctx.globalAlpha = light ? 0.25 + wgt * 0.55 : 0.18 + wgt * 0.6;
    ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
  }
  ctx.restore();
}

export function projectAll(pts: [number, number, number][], shape: ShapeName, layout: Layout, w: number, h: number) {
  return pts.map((p) => project(p, POSE[shape], layout, w, h));
}

// A static canvas that fills its parent; redraws on resize and theme change.
export function mountStatic(canvas: HTMLCanvasElement, shape: ShapeName, layout: Layout) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const draw = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawShape(ctx, shape, layout, w, h, document.documentElement.getAttribute('data-theme') === 'light', null, 7000);
  };
  draw();
  let t = 0;
  window.addEventListener('resize', () => { clearTimeout(t); t = window.setTimeout(draw, 150); });
  document.addEventListener('themechange', draw);
}
