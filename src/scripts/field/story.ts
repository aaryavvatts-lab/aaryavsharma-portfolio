// Runs the home page scroll story. Works out which stop the reader is on from the
// scroll position, keeps the particle field (or its flat twin) in step, and places
// the clickable research labels over the network shape.

import type { ShapeName, GeoData } from './shapes';
import { drawShape, nodeScreen, viewSize, type Layout } from './flat';
import { gpuTier, reducedMotion, isLight } from './prefs';

type Renderer = {
  kind: 'webgl' | 'flat';
  setStage(s: number): void;
  setLayouts(l: Layout[]): void;
  setTheme(light: boolean): void;
  setHover(on: boolean): void;
  setPointer(x: number | null, y?: number): void;
  resize(): void;
  nodes(): { sx: number; sy: number }[];
  destroy(): void;
};

const COUNTS = { low: 16000, mid: 34000, high: 60000 } as const;

export function startStory() {
  let canvas = document.querySelector<HTMLCanvasElement>('#field');
  const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-stop]'));
  const labelLayer = document.querySelector<HTMLElement>('#node-labels');
  if (!canvas || !sections.length) return;
  const labels = labelLayer ? Array.from(labelLayer.querySelectorAll<HTMLElement>('[data-node]')) : [];
  const shapes = sections.map((s) => s.dataset.shape as ShapeName);
  const researchIndex = shapes.indexOf('network');

  const root = document.documentElement;
  let anchors: number[] = [];
  let target = 0;
  let current = 0;
  let renderer: Renderer | null = null;
  let layouts: Layout[] = [];
  const motion = !reducedMotion();
  const tier = gpuTier();

  const wideQuery = window.matchMedia('(min-width: 900px) and (min-aspect-ratio: 21/20)');

  // Place each shape in the free space beside its text (wide screens) or above it (phones).
  function layoutFor(shape: ShapeName, index: number): Layout {
    const w = window.innerWidth, h = window.innerHeight;
    const ppu = h / viewSize(w, h).visH; // pixels per world unit at the focal plane
    // rough half-width of each shape in world units, including its sway
    const R = ({ sphere: 1.55, network: 1.5, book: 1.55, southAsia: 1.45, brain: 1.3, helix: 1.25, minnesota: 1.3, galaxy: 2.1 } as Record<ShapeName, number>)[shape];
    const small = sections[index]?.dataset.size === 'small';
    if (shape === 'galaxy') {
      return { x: 0, y: wideQuery.matches ? -0.04 : 0.06, scale: Math.min(1.05, (w * 0.5) / (2.1 * ppu)) };
    }
    if (wideQuery.matches) {
      const copy = sections[index].querySelector<HTMLElement>('.stop-card, .hero-copy');
      const wrap = sections[index].querySelector<HTMLElement>('.stop__inner');
      const left = copy ? copy.getBoundingClientRect().right + 32 : w * 0.5;
      const right = wrap ? wrap.getBoundingClientRect().right : w - 32;
      const avail = Math.max(240, right - left);
      const cx = left + avail / 2;
      let scale = Math.min((avail / 2 + 40) / (R * ppu), (h * 0.4) / (R * ppu), 1.05);
      if (small) scale *= 0.85;
      return { x: (cx - w / 2) / (w / 2), y: 0, scale };
    }
    // phones and tall tablets: the shape sits in the top part, the text below it
    const radiusPx = Math.min(w * 0.44, h * (shape === 'network' ? 0.16 : 0.2));
    const scale = (radiusPx / (R * ppu)) * (small ? 0.88 : 1);
    return { x: 0, y: shape === 'network' ? 0.5 : 0.44, scale };
  }

  function measure() {
    const vh = window.innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    anchors = sections.map((s, i) => {
      const r = s.getBoundingClientRect();
      const top = r.top + window.scrollY;
      if (i === 0) return 0;
      return Math.min(top + r.height / 2 - vh / 2, max);
    });
    layouts = shapes.map((s, i) => layoutFor(s, i));
    renderer?.setLayouts(layouts);
    renderer?.resize();
    readScroll();
  }

  function readScroll() {
    const y = window.scrollY;
    let s = 0;
    if (y <= anchors[0]) s = 0;
    else if (y >= anchors[anchors.length - 1]) s = anchors.length - 1;
    else {
      for (let i = 0; i < anchors.length - 1; i++) {
        if (y >= anchors[i] && y < anchors[i + 1]) {
          s = i + (y - anchors[i]) / Math.max(1, anchors[i + 1] - anchors[i]);
          break;
        }
      }
    }
    target = s;
    if (!motion) current = Math.round(s);
  }

  // ---------- labels over the research network ----------
  function placeLabels() {
    if (!labelLayer || researchIndex < 0 || !renderer) return;
    const d = Math.abs(current - researchIndex);
    const on = d < 0.22;
    labelLayer.toggleAttribute('data-on', on);
    if (!on && d > 0.6) return;
    const pts = renderer.nodes();
    const boxes = labels.map((el, i) => {
      const p = pts[i];
      const bw = el.offsetWidth, bh = el.offsetHeight;
      const right = p.sx < window.innerWidth - bw - 24;
      return { el, x: right ? p.sx + 10 : p.sx - bw - 10, y: p.sy - bh / 2, w: bw, h: bh, ax: p.sx, ay: p.sy };
    });
    for (let pass = 0; pass < 14; pass++) {
      for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
        const A = boxes[a], B = boxes[b];
        if (A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h) {
          const push = (Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y)) / 2 + 1;
          if (A.y < B.y) { A.y -= push; B.y += push; } else { A.y += push; B.y -= push; }
        }
      }
    }
    const pad = 8;
    const maxY = wideQuery.matches ? window.innerHeight - pad : window.innerHeight * 0.5;
    boxes.forEach((b) => {
      const x = Math.max(pad, Math.min(window.innerWidth - b.w - pad, b.x));
      const y = Math.max(64, Math.min(maxY - b.h, b.y));
      b.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      b.el.style.setProperty('--ax', `${(b.ax - x).toFixed(1)}px`);
      b.el.style.setProperty('--ay', `${(b.ay - y).toFixed(1)}px`);
    });
  }

  // ---------- flat renderer (no WebGL, software WebGL, reduced motion) ----------
  function createFlat(geo: GeoData | null): Renderer {
    const ctx = canvas!.getContext('2d')!;
    let shown = -1, stage = 0, w = 0, h = 0;
    let local: Layout[] = layouts;
    function draw(i: number) {
      shown = i;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas!.clientWidth; h = canvas!.clientHeight;
      canvas!.width = Math.round(w * dpr); canvas!.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawShape(ctx, shapes[i], local[i], w, h, isLight(), geo);
      if (motion) { canvas!.style.opacity = '0'; requestAnimationFrame(() => (canvas!.style.opacity = '1')); }
    }
    return {
      kind: 'flat',
      setStage(s) { stage = s; const i = Math.round(s); if (i !== shown) draw(i); },
      setLayouts(l) { local = l; },
      setTheme() { draw(Math.round(stage)); },
      setHover() {},
      setPointer() {},
      resize() { if (shown >= 0) draw(shown); },
      nodes() { return nodeScreen(local[researchIndex], w, h); },
      destroy() {},
    };
  }

  // ---------- wiring ----------
  let raf = 0, last = performance.now();
  function tick(now: number) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (motion) current += (target - current) * (1 - Math.exp(-dt * 5));
    else current = Math.round(target);
    if (Math.abs(target - current) < 0.0005) current = target;
    renderer?.setStage(current);
    const shown = current.toFixed(2);
    if (shown !== root.dataset.stage) root.dataset.stage = shown;
    placeLabels();
  }

  measure();
  window.addEventListener('scroll', readScroll, { passive: true });
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = window.setTimeout(measure, 120); });
  const main = document.querySelector('main');
  if (main && 'ResizeObserver' in window) {
    let lastH = 0, ot = 0;
    new ResizeObserver(([e]) => {
      const nh = e.contentRect.height;
      if (Math.abs(nh - lastH) < 2) return;
      lastH = nh; clearTimeout(ot); ot = window.setTimeout(measure, 150);
    }).observe(main);
  }

  document.querySelectorAll<HTMLElement>('.stop-hit').forEach((a) => {
    a.addEventListener('pointerenter', () => renderer?.setHover(true));
    a.addEventListener('pointerleave', () => renderer?.setHover(false));
  });
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.addEventListener('pointermove', (e) => renderer?.setPointer(e.clientX, e.clientY), { passive: true });
    document.addEventListener('pointerleave', () => renderer?.setPointer(null));
  }
  document.addEventListener('themechange', () => renderer?.setTheme(isLight()));

  async function boot() {
    let geo: GeoData | null = null;
    const { loadGeo } = await import('./shapes');
    try { geo = await loadGeo(); } catch { geo = null; }
    const useGl = tier !== 'none' && motion && geo;
    if (useGl) {
      try {
        const { createField } = await import('./field');
        renderer = createField({
          canvas: canvas!, shapes, geo: geo!, count: COUNTS[tier as 'low' | 'mid' | 'high'],
          dpr: Math.min(window.devicePixelRatio || 1, tier === 'high' ? 2 : 1.5),
          light: isLight(), motion,
          onLost: () => { renderer = createFlatSwap(geo); },
        });
        document.documentElement.dataset.field = 'webgl';
      } catch {
        renderer = createFlatSwap(geo);
      }
    } else {
      renderer = createFlatSwap(geo);
    }
    renderer.setLayouts(layouts);
    renderer.resize();
    requestAnimationFrame(() => canvas!.classList.add('is-ready'));
    raf = requestAnimationFrame(tick);
  }

  // A lost WebGL context cannot be reused for 2D, so swap in a fresh canvas.
  function createFlatSwap(geo: GeoData | null): Renderer {
    if (renderer?.kind === 'webgl' && canvas) {
      const fresh = canvas.cloneNode() as HTMLCanvasElement;
      canvas.replaceWith(fresh);
      canvas = fresh;
      canvas.classList.add('is-ready');
    }
    document.documentElement.dataset.field = 'flat';
    const flat = createFlat(geo);
    flat.setLayouts(layouts);
    return flat;
  }

  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(() => void boot(), { timeout: 1200 });
  else setTimeout(() => void boot(), 300);

  return () => { cancelAnimationFrame(raf); renderer?.destroy(); };
}
