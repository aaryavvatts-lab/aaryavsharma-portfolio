// Plays the reading-room film by scroll. The frames are pre-rendered stills
// (tools/hero). Every frame is downloaded ahead of time as a small compressed file,
// but only a few are decoded at once: a sparse set spread over the whole film plus a
// window around the current frame, so even a phone holds a couple of hundred MB at
// most. The frame on screen glides toward the scroll position, so it never jumps.

import film from '../content/film.json';

type FrameSet = { dir: string; count: number; w: number; h: number; ext: string };
type Frame = ImageBitmap | HTMLImageElement;

const FILM_END = 0.86;   // share of the section spent playing frames; the rest fades into the page
const COPY_END = 0.1;    // the name and intro fade out over the first part of the scroll
const EASE = 0.16;       // share of the gap to the scroll position closed per 60 Hz frame
const PORTRAIT = '(max-aspect-ratio: 4/5)';

let stop: (() => void) | null = null;

function pick(): string | null {
  const sets = film.sets as Record<string, FrameSet>;
  const portrait = window.matchMedia(PORTRAIT).matches;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  const lean = !!conn?.saveData || /2g|3g/.test(conn?.effectiveType ?? '');
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const wide = window.innerWidth * Math.min(window.devicePixelRatio || 1, 2);
  const want = portrait
    ? (wide >= 1000 && !lean ? ['port-1080', 'port-720'] : ['port-720', 'port-1080'])
    : lean ? ['land-1280']
    : wide >= 2600 && memory >= 8 ? ['land-2560', 'land-1920', 'land-1280']
    : wide >= 1400 ? ['land-1920', 'land-1280'] : ['land-1280'];
  return want.find((k) => sets[k]?.count) ?? null;
}

export function startFilm() {
  const section = document.querySelector<HTMLElement>('[data-film]');
  const canvas = section?.querySelector<HTMLCanvasElement>('canvas');
  const copy = section?.querySelector<HTMLElement>('[data-film-copy]');
  const paper = section?.querySelector<HTMLElement>('[data-film-paper]');
  const stage = section?.querySelector<HTMLElement>('.film__stage');
  const header = document.getElementById('site-header');
  const root = document.documentElement;
  if (!section || !canvas || !copy || !paper || !stage) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = canvas.getContext('2d', { alpha: false });
  const key = pick();
  if (!ctx || !key) return;
  const set = (film.sets as Record<string, FrameSet>)[key];
  const N = set.count;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  const lean = !!conn?.saveData;
  // the tall scroll track only exists while the film can play
  root.dataset.filmTall = '';

  let ext = 'avif';
  let alive = true, raf = 0;
  const blobs: (Blob | undefined)[] = new Array(N);
  const frames = new Map<number, Frame>();
  const pending = new Set<number>();
  const big = set.w * set.h > 1300 * 800;
  const SPARSE = big ? 16 : 8;          // always-decoded frames, spread over the film
  const AHEAD = big ? 18 : 22, BEHIND = 8;
  const bitmaps = 'createImageBitmap' in window;
  let target = 0, shown = -1, drawn = -1, dir = 1, last = 0;

  const url = (i: number) => `${set.dir}${String(i + 1).padStart(4, '0')}.${ext}`;
  const sparse = (i: number) => i % SPARSE === 0 || i === N - 1;

  // Frame 0, then every 16th, 8th ... 1st, so a rough version plays while the rest arrive.
  function order() {
    const out = [0];
    const seen = new Set(out);
    for (let s = 16; s >= 1; s /= 2) for (let i = 0; i < N; i += s) if (!seen.has(i)) { seen.add(i); out.push(i); }
    if (!seen.has(N - 1)) out.push(N - 1);
    return lean ? out.filter((i) => i % 2 === 0 || i === N - 1) : out;
  }

  async function download() {
    const queue = order();
    let at = 0;
    const worker = async () => {
      while (alive && at < queue.length) {
        const i = queue[at++];
        for (let tries = 0; tries < 2 && alive && !blobs[i]; tries++) {
          try {
            const r = await fetch(url(i));
            if (r.ok) blobs[i] = await r.blob();
          } catch { /* retried once, then a neighbour stands in */ }
        }
        if (blobs[i]) schedule();
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
  }

  async function decode(i: number) {
    pending.add(i);
    try {
      let f: Frame;
      if (bitmaps) f = await createImageBitmap(blobs[i]!);
      else {
        const img = new Image();
        img.src = URL.createObjectURL(blobs[i]!);
        await img.decode();
        URL.revokeObjectURL(img.src);
        f = img;
      }
      if (alive && wanted(i)) { frames.set(i, f); if (Math.abs(i - shown) < Math.abs(drawn - shown)) drawn = -1; }
      else if ('close' in f) f.close();
    } catch { /* skipped; a neighbour stands in */ }
    pending.delete(i);
    schedule();
  }

  function wanted(i: number) {
    const c = Math.round(Math.max(shown, 0));
    const lo = c - (dir > 0 ? BEHIND : AHEAD), hi = c + (dir > 0 ? AHEAD : BEHIND);
    return sparse(i) || (i >= lo && i <= hi);
  }

  // Decode what is needed next, nearest the current frame first; drop what fell out of the window.
  function schedule() {
    if (!alive) return;
    for (const [i, f] of frames) if (!wanted(i)) { if ('close' in f) f.close(); frames.delete(i); }
    const c = Math.round(Math.max(shown, 0));
    for (let d = 0; d <= Math.max(AHEAD, BEHIND) && pending.size < 3; d++) {
      for (const i of dir > 0 ? [c + d, c - d] : [c - d, c + d]) {
        if (i >= 0 && i < N && blobs[i] && !frames.has(i) && !pending.has(i) && wanted(i) && pending.size < 3) void decode(i);
      }
    }
    for (let i = 0; i < N && pending.size < 3; i += SPARSE) {
      if (blobs[i] && !frames.has(i) && !pending.has(i)) void decode(i);
    }
  }

  function nearest(i: number) {
    for (let d = 0; d < N; d++) {
      if (frames.has(i - d)) return i - d;
      if (frames.has(i + d)) return i + d;
    }
    return -1;
  }

  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(canvas!.clientWidth * dpr), h = Math.round(canvas!.clientHeight * dpr);
    if (w && h && (canvas!.width !== w || canvas!.height !== h)) { canvas!.width = w; canvas!.height = h; drawn = -1; }
  }

  function draw(i: number) {
    const f = frames.get(i)!;
    const fw = 'naturalWidth' in f ? f.naturalWidth : f.width, fh = 'naturalHeight' in f ? f.naturalHeight : f.height;
    const cw = canvas!.width, ch = canvas!.height;
    const s = Math.max(cw / fw, ch / fh);
    const dw = fw * s, dh = fh * s;
    ctx!.drawImage(f, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    if (root.dataset.filmState !== 'on') root.dataset.filmState = 'on';
  }

  let total = 1, top = 0;
  function measure() {
    total = Math.max(1, section!.offsetHeight - stage!.offsetHeight);
    top = section!.getBoundingClientRect().top + window.scrollY;
    size();
  }

  let lastP = -1;
  function tick(now: number) {
    if (!alive) return;
    raf = requestAnimationFrame(tick);
    const dt = last ? Math.min(100, now - last) : 16.7;
    last = now;
    const p = Math.min(1, Math.max(0, (window.scrollY - top) / total));
    if (p !== lastP) {
      lastP = p;
      copy!.style.opacity = String(Math.max(0, 1 - p / COPY_END));
      copy!.style.transform = `translate3d(0, ${(-Math.min(p, COPY_END) / COPY_END) * 24}px, 0)`;
      copy!.style.pointerEvents = p > COPY_END ? 'none' : '';
      const fade = Math.min(1, Math.max(0, (p - FILM_END) / (1 - FILM_END)));
      paper!.style.opacity = String(fade);
      header?.toggleAttribute('data-film-paper', fade > 0.5);
    }
    target = Math.min(N - 1, (p / FILM_END) * (N - 1));
    if (shown < 0) shown = target; // a reload mid-page starts where the reader is
    const before = Math.round(shown);
    shown += (target - shown) * (1 - Math.pow(1 - EASE, dt / 16.7));
    if (Math.abs(target - shown) < 0.02) shown = target;
    const at = Math.round(shown);
    if (at !== before) { dir = at > before ? 1 : -1; schedule(); }
    const i = nearest(at);
    if (i >= 0 && i !== drawn) { drawn = i; draw(i); }
  }

  const ro = new ResizeObserver(measure);
  const mq = window.matchMedia(PORTRAIT);
  // Turning a phone or tablet swaps between the portrait and landscape films.
  const onTurn = () => { if (pick() !== key) { stop?.(); startFilm(); } };

  function begin() {
    if (!alive) return;
    measure();
    window.addEventListener('resize', measure);
    ro.observe(section!);
    mq.addEventListener('change', onTurn);
    raf = requestAnimationFrame(tick);
    const go = () => void download();
    if ('requestIdleCallback' in window) (window as Window & { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback(go, { timeout: 600 });
    else setTimeout(go, 150);
  }

  stop = () => {
    alive = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', measure);
    ro.disconnect();
    mq.removeEventListener('change', onTurn);
    for (const f of frames.values()) if ('close' in f) f.close();
    frames.clear();
    delete root.dataset.filmState;
    delete root.dataset.filmTall;
    stop = null;
  };

  // Check AVIF once; fall back to WebP frames.
  const probe = new Image();
  probe.onload = () => begin();
  probe.onerror = () => { ext = 'webp'; begin(); };
  probe.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=';
}
