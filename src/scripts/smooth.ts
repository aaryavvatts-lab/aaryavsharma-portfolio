// Smooth wheel scrolling on desktop. Touch screens already scroll smoothly, and
// people who ask for reduced motion get the browser's own scrolling.
import Lenis from 'lenis';

export let lenis: Lenis | null = null;

export function startSmoothScroll() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true, anchors: true });
  const raf = (t: number) => { lenis?.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}
