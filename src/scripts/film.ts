// Plays the reading-room film by scroll. The frames are pre-rendered stills
// (tools/hero); scrolling picks the nearest one.
// Only a window of frames around the current one is decoded at a time.

import film from '../content/film.json';

type FrameSet = { dir: string; count: number; w: number; h: number; ext: string };

const FILM_END = 0.86;   // share of the section spent playing frames; the rest fades into the page
const COPY_END = 0.1;    // the name and intro fade out over the first part of the scroll

export function startFilm() {
  const section = document.querySelector<HTMLElement>('[data-film]');
  const canvas = section?.querySelector<HTMLCanvasElement>('canvas');
  const copy = section?.querySelector<HTMLElement>('[data-film-copy]');
  const paper = section?.querySelector<HTMLElement>('[data-film-paper]');
  const root = document.documentElement;
  if (!section || !canvas || !copy || !paper) return;

  watchHeader();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  const portrait = window.innerWidth / window.innerHeight <= 0.8;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  const lean = !!conn?.saveData || /2g|3g/.test(conn?.effectiveType ?? '');
  const wide = window.innerWidth * Math.min(window.devicePixelRatio || 1, 2);
  const key = portrait ? 'port-1080' : !lean && wide >= 1500 ? 'land-1920' : 'land-1280';
  let ext: 'avif' | 'webp' = 'avif';
  const set = (film.sets as Record<string, FrameSet>)[key];
  const focal = (portrait ? film.focal.port : film.focal.land) as [number, number][];
  const step = lean ? 2 : 1;
  const N = set.count;
  const phone = /iPhone|Android|Mobile/i.test(navigator.userAgent);
  const WINDOW = phone || key === 'land-1920' ? 8 : 12;

  const blobs: (Blob | undefined)[] = new Array(N);
  const bitmaps = new Map<number, ImageBitmap>();
  const pending = new Set<number>();
  let want = 0;          // frame (fractional) the scroll asks for
  let shown = -1;        // last drawn frame key
  let running = false;
  let scrolled = false;      // the rest of the frames load once the reader starts scrolling
  const stage = section.querySelector<HTMLElement>('.film__stage')!;
  const header = document.getElementById('site-header');

  const url = (i: number) => `${set.dir}${String(i + 1).padStart(4, '0')}.${ext}`;

  // Frame 0 first, then every 32nd, 16th, 8th ... so a rough version plays early.
  function order() {
    const out: number[] = [0];
    const seen = new Set(out);
    for (let s = 32; s >= step; s = s / 2) {
      for (let i = 0; i < N; i += s) if (!seen.has(i)) { seen.add(i); out.push(i); }
      if (s === 1) break;
    }
    if (!seen.has(N - 1)) out.push(N - 1);
    return out;
  }

  async function fetchAll() {
    const queue = order();
    const early = Math.min(queue.length, 1 + Math.ceil(N / 16)); // frame 0 and every 16th
    let at = 0;
    const worker = async () => {
      while (at < queue.length) {
        if (at >= early && !scrolled) { await new Promise<void>((r) => window.addEventListener('scroll', () => r(), { once: true, passive: true })); scrolled = true; }
        const i = queue[at++];
        try {
          const r = await fetch(url(i));
          if (r.ok) { blobs[i] = await r.blob(); if (Math.abs(i - want) < WINDOW) decode(i); }
        } catch { /* a missing frame falls back to its neighbour */ }
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
  }

  // Decode at the width the cover crop actually needs, not wider.
  function decodeWidth() {
    const cw = canvas!.width, ch = canvas!.height;
    return Math.ceil(Math.max(cw, (ch * set.w) / set.h));
  }

  function decode(i: number) {
    if (bitmaps.has(i) || pending.has(i) || !blobs[i] || canvas!.width === 0) return;
    pending.add(i);
    const need = decodeWidth();
    const opts: ImageBitmapOptions = need < set.w ? { resizeWidth: need, resizeQuality: 'high' } : {};
    createImageBitmap(blobs[i]!, opts).then((b) => {
      pending.delete(i);
      if (Math.abs(i - want) > WINDOW * 1.5) { b.close(); return; }
      bitmaps.set(i, b);
      shown = -1;
      kick();
    }).catch(() => pending.delete(i));
  }

  function evict() {
    for (const [i, b] of bitmaps) if (Math.abs(i - want) > WINDOW) { b.close(); bitmaps.delete(i); }
    const c = Math.round(want);
    for (let d = 0; d <= WINDOW; d++) { decode(c + d); decode(c - d); }
  }

  function nearest(i: number) {
    for (let d = 0; d < N; d++) {
      if (bitmaps.has(i - d)) return i - d;
      if (bitmaps.has(i + d)) return i + d;
    }
    return -1;
  }

  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(canvas!.clientWidth * dpr), h = Math.round(canvas!.clientHeight * dpr);
    if (canvas!.width !== w || canvas!.height !== h) {
      canvas!.width = w; canvas!.height = h; shown = -1;
      // bitmaps were decoded for the old size; decode again at the new one
      for (const b of bitmaps.values()) b.close();
      bitmaps.clear();
    }
  }

  function place(img: ImageBitmap, f: number) {
    const cw = canvas!.width, ch = canvas!.height;
    const s = Math.max(cw / img.width, ch / img.height);
    const dw = img.width * s, dh = img.height * s;
    const [fx, fy] = focal[Math.min(focal.length - 1, Math.max(0, Math.round(f)))] ?? [0.5, 0.5];
    const dx = Math.min(0, Math.max(cw - dw, cw / 2 - fx * dw));
    const dy = Math.min(0, Math.max(ch - dh, ch / 2 - fy * dh));
    return [dx, dy, dw, dh] as const;
  }

  function draw() {
    // One whole frame at a time: blending neighbours ghosts when the camera moves fast.
    const i = nearest(Math.round(want));
    if (i < 0 || i === shown) return;
    shown = i;
    const img = bitmaps.get(i)!;
    ctx!.drawImage(img, ...place(img, i));
    if (root.dataset.filmState !== 'on') root.dataset.filmState = 'on';
  }

  function progress() {
    const r = section!.getBoundingClientRect();
    const total = section!.offsetHeight - stage.offsetHeight;
    return Math.min(1, Math.max(0, -r.top / Math.max(1, total)));
  }

  function frame() {
    running = false;
    const p = progress();
    want = Math.min(N - 1, (p / FILM_END) * (N - 1));
    copy!.style.opacity = String(Math.max(0, 1 - p / COPY_END));
    copy!.style.transform = `translate3d(0, ${(-p / COPY_END) * 24}px, 0)`;
    copy!.style.visibility = p > COPY_END ? 'hidden' : 'visible';
    const fade = Math.min(1, Math.max(0, (p - FILM_END) / (1 - FILM_END)));
    paper!.style.opacity = String(fade);
    header?.toggleAttribute('data-film-paper', fade > 0.5);
    size();
    evict();
    draw();
  }

  function kick() {
    if (!running) { running = true; requestAnimationFrame(frame); }
  }

  // Check AVIF once; fall back to WebP frames.
  const probe = new Image();
  probe.onload = () => start();
  probe.onerror = () => { ext = 'webp'; start(); };
  probe.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=';

  function start() {
    if (window.scrollY > 0) scrolled = true;
    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', kick);
    kick();
    const go = () => void fetchAll();
    if ('requestIdleCallback' in window) (window as Window & { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback(go, { timeout: 800 });
    else setTimeout(go, 200);
  }
}

// The header switches to a paper look while it sits over the book's pages.
function watchHeader() {
  const header = document.getElementById('site-header');
  const book = document.querySelector<HTMLElement>('[data-paper]');
  if (!header || !book) return;
  const check = () => {
    const r = book.getBoundingClientRect();
    header.toggleAttribute('data-paper', r.top < 64 && r.bottom > 32);
  };
  check();
  window.addEventListener('scroll', check, { passive: true });
  window.addEventListener('resize', check);
}
