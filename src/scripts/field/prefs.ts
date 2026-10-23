// What this device can and should do. Software WebGL (headless Chrome, some VMs)
// counts as no WebGL, because CPU-rendered 3D freezes the page.

export type Tier = 'none' | 'low' | 'mid' | 'high';

export function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function gpuTier(): Tier {
  let gl: WebGLRenderingContext | null = null;
  try {
    const c = document.createElement('canvas');
    gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
  } catch {
    return 'none';
  }
  if (!gl) return 'none';
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  if (/swiftshader|llvmpipe|software|basic render/i.test(renderer)) return 'none';
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  if (mobile || cores <= 4 || mem <= 4) return 'low';
  if (cores >= 8 && mem >= 8) return 'high';
  return 'mid';
}

export function isLight(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'light';
}
