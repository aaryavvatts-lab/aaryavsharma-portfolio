// Runs the home page scroll story. Works out which stop the reader is on from the
// scroll position, keeps the particle field (or its flat twin) in step, places the
// clickable labels over the hero orbit and the research network, and makes the
// Minnesota map answer by county.

import { NETWORK_NODES, ringCenters, mnPoint, RING_S, type ShapeName, type GeoData } from './shapes';
import { drawShape, projectAll, viewSize, type Layout } from './flat';
import { gpuTier, reducedMotion, isLight } from './prefs';

type Screen = { sx: number; sy: number; back: boolean };

type Renderer = {
  kind: 'webgl' | 'flat';
  setStage(s: number): void;
  setLayouts(l: Layout[]): void;
  setTheme(light: boolean): void;
  setHover(on: boolean): void;
  setCounty(c: number): void;
  resize(): void;
  project(pts: [number, number, number][]): Screen[];
  introDone(): boolean;
  ringAngle(): number;
  destroy(): void;
};

type County = { slug: string; name: string; label: string; url: string };

const COUNTS = { low: 16000, mid: 34000, high: 60000 } as const;

// Rough half-width of each shape in world units, including its sway.
const RADIUS: Record<ShapeName, number> = {
  ring: 2.5, sphere: 1.55, network: 1.5, book: 1.55, southAsia: 1.45, brain: 1.3, helix: 1.25, minnesota: 1.3, galaxy: 2.1,
};

export function startStory() {
  let canvas = document.querySelector<HTMLCanvasElement>('#field');
  const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-stop]'));
  if (!canvas || !sections.length) return;
  const shapes = sections.map((s) => s.dataset.shape as ShapeName);
  const mnIndex = shapes.indexOf('minnesota');

  const root = document.documentElement;
  let anchors: number[] = [];
  let target = 0;
  let current = 0;
  let renderer: Renderer | null = null;
  let layouts: Layout[] = [];
  let glTried = false;
  let lastW = 0, lastH = 0, lastNarrow = false;
  let geo: GeoData | null = null;
  const motion = !reducedMotion();
  const tier = gpuTier();

  // Must match the narrow-layout media query in index.astro.
  const narrowQuery = window.matchMedia('(max-width: 899px), (max-aspect-ratio: 21/20)');
  const isWide = () => !narrowQuery.matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  // Place each shape in the free space beside its text (wide screens) or above it (phones).
  function layoutFor(shape: ShapeName, index: number): Layout {
    const w = canvas?.clientWidth || window.innerWidth, h = canvas?.clientHeight || window.innerHeight;
    const ppu = h / viewSize(w, h).visH; // pixels per world unit at the focal plane
    const R = RADIUS[shape];
    const small = sections[index]?.dataset.size === 'small';
    if (shape === 'galaxy') {
      return { x: 0, y: isWide() ? -0.04 : 0.06, scale: Math.min(1.05, (w * 0.5) / (2.1 * ppu)) };
    }
    if (isWide()) {
      const copy = sections[index].querySelector<HTMLElement>('.stop-card, .hero-copy');
      const wrap = sections[index].querySelector<HTMLElement>('.stop__inner');
      const left = copy ? copy.getBoundingClientRect().right + 32 : w * 0.5;
      const right = wrap ? wrap.getBoundingClientRect().right : w - 32;
      const avail = Math.max(240, right - left);
      const cx = left + avail / 2;
      let scale = Math.min((avail / 2 + 40) / (R * ppu), (h * 0.42) / (R * ppu), shape === 'ring' ? 1.2 : 1.05);
      if (small) scale *= 0.85;
      return { x: (cx - w / 2) / (w / 2), y: shape === 'ring' ? 0.04 : 0, scale };
    }
    // phones and tall tablets: the shape sits in the top part, the text below it
    const radiusPx = Math.min(w * (shape === 'ring' ? 0.47 : 0.44), h * 0.2);
    const scale = (radiusPx / (R * ppu)) * (small ? 0.88 : 1);
    return { x: 0, y: 0.44, scale };
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
    groups.forEach((g) => (g.sizes = []));
    lastW = window.innerWidth; lastH = window.innerHeight; lastNarrow = narrowQuery.matches;
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

  // ---------- floating labels over the orbit and the research network ----------
  type Group = {
    layer: HTMLElement; labels: HTMLElement[]; index: number; pts: [number, number, number][];
    below: boolean; sizes: number[][];
  };
  const groups: Group[] = [
    { sel: '#ring-labels', shape: 'ring' as ShapeName, pts: ringCenters(), below: true },
    { sel: '#node-labels', shape: 'network' as ShapeName, pts: NETWORK_NODES, below: false },
  ].flatMap((g) => {
    const layer = document.querySelector<HTMLElement>(g.sel);
    const index = shapes.indexOf(g.shape);
    if (!layer || index < 0) return [];
    return [{ layer, labels: Array.from(layer.querySelectorAll<HTMLElement>('[data-node]')), index, pts: g.pts, below: g.below, sizes: [] }];
  });

  function placeGroup(g: Group) {
    if (!renderer) return;
    const d = Math.abs(current - g.index);
    // Phones get the same links as text in the card; the labels don't fit around a small shape.
    const on = d < 0.22 && isWide() && renderer.introDone();
    g.layer.toggleAttribute('data-on', on);
    if (!on && d > 0.6) return;
    const pts = renderer.project(g.below ? ringCenters(renderer.ringAngle()) : g.pts);
    if (!g.sizes.length) g.sizes = g.labels.map((el) => [el.offsetWidth, el.offsetHeight]);
    const h = canvas?.clientHeight || window.innerHeight;
    // Orbit labels sit just under each small sculpture.
    const gap = g.below ? RING_S * 1.2 * layouts[g.index].scale * (h / viewSize(1, 1).visH) : 10;
    const boxes = g.labels.map((el, i) => {
      const p = pts[i];
      const [bw, bh] = g.sizes[i];
      if (g.below) return { el, x: p.sx - bw / 2, y: p.sy + gap, w: bw, h: bh, back: p.back };
      const right = p.sx < window.innerWidth - bw - 24;
      return { el, x: right ? p.sx + 10 : p.sx - bw - 10, y: p.sy - bh / 2, w: bw, h: bh, back: false };
    });
    for (let pass = 0; pass < 14; pass++) {
      for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
        const A = boxes[a], B = boxes[b];
        if (A.back !== B.back) continue;
        if (A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h) {
          const push = (Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y)) / 2 + 1;
          if (A.y < B.y) { A.y -= push; B.y += push; } else { A.y += push; B.y -= push; }
        }
      }
    }
    const pad = 8;
    boxes.forEach((b) => {
      const x = Math.max(pad, Math.min(window.innerWidth - b.w - pad, b.x));
      const y = Math.max(64, Math.min(window.innerHeight - b.h - pad, b.y));
      b.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      b.el.toggleAttribute('data-back', b.back);
    });
  }

  // ---------- Minnesota by county ----------
  const tip = document.querySelector<HTMLAnchorElement>('#county-tip');
  const tipText = tip?.querySelector<HTMLElement>('[data-tip-text]');
  const hit = document.querySelector<HTMLElement>('#county-hit');
  const pick = document.querySelector<HTMLSelectElement>('#county-pick');
  const pickLink = document.querySelector<HTMLAnchorElement>('#county-open');
  let counties: County[] = [];
  const mnPts: { p: [number, number, number]; c: number }[] = [];
  let anchorsMn: [number, number, number][] = [];
  let county = -1;

  function setCounty(c: number, from: 'map' | 'pick' | 'clear') {
    county = c;
    renderer?.setCounty(c);
    const k = counties[c];
    if (from !== 'pick' && pick) pick.value = k ? String(c) : '';
    if (pickLink) {
      pickLink.href = k ? k.url : 'https://edanmn.vercel.app/counties/';
      const label = pickLink.querySelector('[data-open-label]');
      if (label) label.textContent = k ? `Open ${k.name} County on EDAN` : 'See every county on EDAN';
    }
    if (!tip || !tipText) return;
    tip.toggleAttribute('data-on', !!k);
    if (k) {
      tipText.textContent = k.label;
      tip.href = k.url;
      tip.setAttribute('aria-label', `${k.label}. Open on EDAN.`);
    }
  }

  function placeTip() {
    if (!tip || county < 0 || !renderer || !anchorsMn[county]) return;
    const [p] = renderer.project([anchorsMn[county]]);
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    const x = Math.max(8, Math.min(window.innerWidth - tw - 8, p.sx - tw / 2));
    const y = Math.max(72, Math.min(window.innerHeight - th - 8, p.sy - th - 18));
    tip.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }

  function countyAt(x: number, y: number) {
    if (!renderer || !mnPts.length || Math.abs(current - mnIndex) > 0.3) return -1;
    const scr = renderer.project(mnPts.map((m) => m.p));
    let best = -1, bestD = 22 * 22;
    for (let i = 0; i < scr.length; i++) {
      const dx = scr[i].sx - x, dy = scr[i].sy - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = mnPts[i].c; }
    }
    return best;
  }

  function wireCounties() {
    pick?.addEventListener('change', () => setCounty(pick.value === '' ? -1 : Number(pick.value), 'pick'));
    if (!hit) return;
    hit.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const c = countyAt(e.clientX, e.clientY);
      if (c !== county) setCounty(c, 'map');
      hit.style.cursor = c >= 0 ? 'pointer' : 'default';
    });
    hit.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') setCounty(-1, 'clear'); });
    hit.addEventListener('click', (e) => {
      const c = countyAt(e.clientX, e.clientY);
      if (c < 0) return;
      // A mouse click opens the county; a tap picks it first and shows a link to tap.
      if (finePointer.matches && counties[c]) {
        const link = document.createElement('a');
        link.href = counties[c].url; link.target = '_blank'; link.rel = 'noopener';
        link.click();
      }
      else setCounty(c, 'map');
    });
  }

  // ---------- flat renderer (no WebGL, software WebGL, reduced motion) ----------
  function createFlat(): Renderer {
    const ctx = canvas!.getContext('2d')!;
    let shown = -1, stage = 0, w = 0, h = 0, hot = -1;
    let local: Layout[] = layouts;
    function draw(i: number) {
      shown = i;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas!.clientWidth; h = canvas!.clientHeight;
      canvas!.width = Math.round(w * dpr); canvas!.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawShape(ctx, shapes[i], local[i], w, h, isLight(), geo, 9000, shapes[i] === 'minnesota' ? hot : -1);
    }
    return {
      kind: 'flat',
      setStage(s) { stage = s; const i = Math.round(s); if (i !== shown) draw(i); },
      setLayouts(l) { local = l; },
      setTheme() { draw(Math.round(stage)); },
      setHover() {},
      setCounty(c) { if (c !== hot) { hot = c; if (shapes[shown] === 'minnesota') draw(shown); } },
      resize() { if (shown >= 0) draw(shown); },
      project(pts) { const i = Math.max(shown, 0); return projectAll(pts, shapes[i], local[i], w, h); },
      introDone() { return true; },
      ringAngle() { return 0; },
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
    groups.forEach(placeGroup);
    if (mnIndex >= 0) {
      if (Math.abs(current - mnIndex) > 0.3) { if (county >= 0) setCounty(-1, 'clear'); }
      else placeTip();
    }
  }

  measure();
  window.addEventListener('scroll', readScroll, { passive: true });
  let rt = 0;
  // Phone toolbars change the height a little on every scroll; only re-measure for real resizes.
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastW && Math.abs(window.innerHeight - lastH) < 150 && narrowQuery.matches === lastNarrow) {
      renderer?.resize();
      return;
    }
    clearTimeout(rt); rt = window.setTimeout(measure, 120);
  });
  const main = document.querySelector('main');
  if (main && 'ResizeObserver' in window) {
    let mainH = 0, ot = 0;
    new ResizeObserver(([e]) => {
      const nh = e.contentRect.height;
      if (Math.abs(nh - mainH) < 2) return;
      mainH = nh; clearTimeout(ot); ot = window.setTimeout(measure, 150);
    }).observe(main);
  }

  // Orbit labels jump to their stop, landing exactly where that shape is fully formed.
  document.querySelectorAll<HTMLAnchorElement>('#ring-labels [data-node]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const i = sections.findIndex((s) => '#' + s.id === a.getAttribute('href'));
      if (i < 0) return;
      e.preventDefault();
      window.scrollTo({ top: anchors[i], behavior: motion ? 'smooth' : 'auto' });
    });
  });

  const resetSizes = () => groups.forEach((g) => (g.sizes = []));
  document.addEventListener('themechange', resetSizes);
  document.fonts?.ready.then(resetSizes);
  document.querySelectorAll<HTMLElement>('.stop-hit').forEach((a) => {
    a.addEventListener('pointerenter', () => renderer?.setHover(true));
    a.addEventListener('pointerleave', () => renderer?.setHover(false));
  });
  document.addEventListener('themechange', () => renderer?.setTheme(isLight()));

  async function boot() {
    const [{ loadGeo }, list] = await Promise.all([
      import('./shapes'),
      import('../../content/edan-counties.json').then((m) => m.default as County[]).catch(() => [] as County[]),
    ]);
    try { geo = await loadGeo(); } catch { geo = null; }
    counties = list;
    const mn = geo?.minnesota as (NonNullable<GeoData['minnesota']> & { counties?: { x: number; y: number }[] }) | null;
    if (mn && mn.pts.length / mn.n >= 4) {
      for (let i = 0; i < mn.n; i++) {
        const k = i * 4;
        if (mn.pts[k + 2] === 0) mnPts.push({ p: mnPoint(mn.pts[k], mn.pts[k + 1]), c: mn.pts[k + 3] });
      }
      anchorsMn = (mn.counties ?? []).map((c) => mnPoint(c.x, c.y));
    }
    wireCounties();
    const useGl = tier !== 'none' && motion;
    if (useGl) {
      try {
        const { createField } = await import('./field');
        glTried = true;
        renderer = createField({
          canvas: canvas!, shapes, geo: geo ?? { southAsia: null, minnesota: null }, count: COUNTS[tier as 'low' | 'mid' | 'high'],
          dpr: Math.min(window.devicePixelRatio || 1, tier === 'high' ? 2 : 1.5),
          light: isLight(), motion, halfRate: tier === 'low',
          onLost: () => { const old = renderer; renderer = createFlatSwap(); old?.destroy(); },
        });
        document.documentElement.dataset.field = 'webgl';
      } catch {
        renderer = createFlatSwap();
      }
    } else {
      renderer = createFlatSwap();
    }
    renderer.setLayouts(layouts);
    renderer.resize();
    current = target; // start where the reader already is, not at the top
    renderer.setStage(current);
    requestAnimationFrame(() => canvas!.classList.add('is-ready'));
    raf = requestAnimationFrame(tick);
  }

  // A canvas that ever had a WebGL context can't give a 2D one, so swap in a fresh one.
  function createFlatSwap(): Renderer {
    if (glTried && canvas) {
      const fresh = canvas.cloneNode() as HTMLCanvasElement;
      canvas.replaceWith(fresh);
      canvas = fresh;
      canvas.classList.add('is-ready');
    }
    document.documentElement.dataset.field = 'flat';
    const flat = createFlat();
    flat.setLayouts(layouts);
    return flat;
  }

  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(() => void boot(), { timeout: 1200 });
  else setTimeout(() => void boot(), 300);

  return () => { cancelAnimationFrame(raf); renderer?.destroy(); };
}
