/* Home page motion: mounts the Hairline electrode array in the hero, and draws the simulated EEG band.
   Loaded after hairline-kernel.js and before electrode-array.js, which calls window.hairline. */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- the electrode array ---------- */
  var stage = document.getElementById('array');
  var read = document.getElementById('arrayRead');
  if (stage && window.HL) {
    window.hairline = function (figure) {
      HL.inject(document);
      stage.setAttribute('data-hairline', figure.name);
      stage.setAttribute('role', 'img');
      stage.setAttribute('aria-label', figure.means + ' Move the pointer across it.');
      var svg = HL.mk('svg', { viewBox: '0 0 400 320', 'aria-hidden': 'true' }, stage);
      var text = '';
      var out = {
        get textContent() { return text; },
        set textContent(v) { text = v == null ? '' : String(v); if (read) read.textContent = text; }
      };
      figure.mount({ stage: stage, svg: svg, read: out }, figure.range[1]);
      if (!text) out.textContent = 'rest';
      /* one slow lap when the figure scrolls into view, so a visitor sees it answer; a real pointer ends it */
      if (!reduce && 'IntersectionObserver' in window) {
        var lap = null;
        var io = new IntersectionObserver(function (es) {
          if (es[0].isIntersecting && !lap) {
            lap = HL.tour(stage, figure.tour || HL.LAP, function () {});
            io.disconnect();
          }
        }, { threshold: 0.6 });
        io.observe(stage);
      }
    };
  }

  /* ---------- the simulated EEG band ---------- */
  var canvas = document.getElementById('trace');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var CH = 6, SPEED = 46, W = 0, H = 0, dpr = 1, t0 = 0, raf = 0, visible = true;
  var ink = '#1a1a19', acc = '#4e6b4d';
  function colours() {
    var cs = getComputedStyle(document.documentElement);
    ink = cs.getPropertyValue('--ink').trim() || ink;
    acc = cs.getPropertyValue('--accent').trim() || acc;
  }
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  /* smooth deterministic noise: a few incommensurate sines per channel */
  var seeds = [];
  for (var c = 0; c < CH; c++) seeds.push({ a: [1.1 + c * 0.37, 2.3 + c * 0.21, 4.7 + c * 0.53, 9.1 + c * 0.17], p: [c * 1.7, c * 0.9 + 1, c * 2.3 + 2, c * 0.4 + 3] });
  function sample(c, t) {
    var s = seeds[c], v = 0;
    v += Math.sin(t * s.a[0] + s.p[0]) * 0.55;
    v += Math.sin(t * s.a[1] + s.p[1]) * 0.35;
    v += Math.sin(t * s.a[2] + s.p[2]) * 0.22;
    v += Math.sin(t * s.a[3] + s.p[3]) * 0.12;
    return v;
  }
  /* a blink: one slow bump on the two front channels every few seconds */
  function blink(c, t) {
    if (c > 1) return 0;
    var period = 7.5, x = ((t % period) + period) % period - 2.2;
    return Math.exp(-x * x * 14) * (c === 0 ? 2.2 : 1.5);
  }
  function draw(now) {
    var t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    var gap = H / CH, amp = gap * 0.3;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (var c = 0; c < CH; c++) {
      var cy = gap * (c + 0.5);
      ctx.beginPath();
      for (var x = 0; x <= W; x += 3) {
        var tt = t + (x / SPEED) * 0.9;
        var y = cy - (sample(c, tt * 1.6) + blink(c, tt) * 0.7) * amp * 0.95;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineWidth = c === 1 ? 1.6 : 1.1;
      ctx.strokeStyle = c === 1 ? acc : ink;
      ctx.globalAlpha = c === 1 ? 0.95 : 0.3;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function loop(now) { raf = 0; if (!visible) return; draw(now); raf = requestAnimationFrame(loop); }
  function start() { if (!reduce && visible && !raf) raf = requestAnimationFrame(loop); }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  colours(); size(); t0 = performance.now() - 4200; draw(performance.now());
  if (window.ResizeObserver) new ResizeObserver(function () { size(); draw(performance.now()); }).observe(canvas);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) start(); else stop(); }).observe(canvas);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  /* repaint when the theme changes */
  new MutationObserver(function () { colours(); draw(performance.now()); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  if (mq.addEventListener) mq.addEventListener('change', function () { colours(); draw(performance.now()); });
  start();
})();
