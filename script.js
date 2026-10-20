/* Portfolio behaviour: the hero crossfade, the index stage, and the advertised-versus-checked control.
   Theme, menu and reveals live in assets/kit.js. */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- reading progress: a thin accent line along the top ---------- */
  var bar = document.querySelector('.progress');
  if (bar) {
    var queued = false;
    function paint() {
      queued = false;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.setProperty('--read', max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)).toFixed(4) : '0');
    }
    window.addEventListener('scroll', function () { if (!queued) { queued = true; requestAnimationFrame(paint); } }, { passive: true });
    window.addEventListener('resize', paint);
    paint();
  }

  /* ---------- projects: the row in the middle of the screen owns the stage ---------- */
  var stage = document.querySelector('[data-stage]');
  var rows = Array.prototype.slice.call(document.querySelectorAll('.row[data-id]'));
  if (stage && rows.length) {
    var frame = stage.querySelector('.frame');
    var scap = stage.querySelector('[data-stage-cap]');
    var active = null;
    function activate(row) {
      if (row === active) return;
      active = row;
      rows.forEach(function (r) { r.classList.toggle('is-active', r === row); });
      var id = row.getAttribute('data-id');
      frame.style.setProperty('--p', 'var(' + row.getAttribute('data-accent') + ')');
      frame.querySelectorAll('img, video').forEach(function (im) {
        var on = im.getAttribute('data-for') === id; im.classList.toggle('is-on', on);
        if (im.tagName === 'VIDEO') { if (on && !reduce) im.play().catch(function () {}); else im.pause(); }
      });
      if (scap) scap.textContent = row.getAttribute('data-cap');
    }
    activate(rows[0]);
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) activate(e.target); });
      }, { rootMargin: '-40% 0px -45% 0px', threshold: 0 });
      rows.forEach(function (r) { io.observe(r); });
    }
    rows.forEach(function (r) {
      r.addEventListener('focusin', function () { activate(r); });
      r.addEventListener('pointerenter', function () { activate(r); });
    });
  }

  /* phone and featured pictures: play videos when visible, never under reduced motion */
  if (!reduce && 'IntersectionObserver' in window) {
    var vids = document.querySelectorAll('.row__pic video, .featured video');
    var vio = new IntersectionObserver(function (es) { es.forEach(function (e) { e.isIntersecting ? e.target.play().catch(function () {}) : e.target.pause(); }); }, { threshold: 0.2 });
    vids.forEach(function (v) { vio.observe(v); });
  }

  /* ---------- a small spring ---------- */
  function Spring(x0, onUpdate) { this.x = x0; this.v = 0; this.t = x0; this.k = 0; this.c = 0; this.raf = 0; this.last = 0; this.running = false; this.onUpdate = onUpdate; }
  Spring.prototype.to = function (target, opts) {
    opts = opts || {}; var response = opts.response || 0.4; var damping = opts.damping == null ? 1 : opts.damping;
    var w = 2 * Math.PI / response; this.k = w * w; this.c = 2 * damping * w; this.t = target;
    if (opts.velocity != null) this.v = opts.velocity;
    if (reduce) { this.stop(); this.x = target; this.v = 0; this.onUpdate(this.x); return; }
    if (this.running) return;
    this.running = true; this.last = performance.now(); var self = this;
    this.raf = requestAnimationFrame(function frame(now) { self.tick(now, frame); });
  };
  Spring.prototype.tick = function (now, frame) {
    var dt = Math.min((now - this.last) / 1000, 0.05); this.last = now;
    var steps = Math.max(1, Math.ceil(dt / 0.004)), h = dt / steps;
    for (var i = 0; i < steps; i++) { var a = -this.k * (this.x - this.t) - this.c * this.v; this.v += a * h; this.x += this.v * h; }
    if (Math.abs(this.v) < 0.0005 && Math.abs(this.x - this.t) < 0.0005) { this.x = this.t; this.v = 0; this.running = false; this.onUpdate(this.x); return; }
    this.onUpdate(this.x); var self = this;
    this.raf = requestAnimationFrame(function (n) { self.tick(n, frame); });
  };
  Spring.prototype.stop = function () { cancelAnimationFrame(this.raf); this.running = false; };
  function project(v, rate) { rate = rate || 0.998; return (v / 1000) * rate / (1 - rate); }
  function rubberband(over, dim) { var c = 0.55; return (over * dim * c) / (dim + c * Math.abs(over)); }

  /* ---------- advertised versus checked ---------- */
  var track = document.getElementById('splitTrack');
  var thumb = document.getElementById('splitThumb');
  var fill = document.getElementById('splitFill');
  var btn = document.getElementById('splitToggle');
  var figs = document.querySelectorAll('.pair__fig[data-advertised]');
  if (!track || !thumb || !figs.length) return;

  var nums = Array.prototype.map.call(figs, function (el) {
    var q = el.getAttribute('data-advertised'), h = el.getAttribute('data-checked');
    var dec = function (s) { var m = s.match(/\.(\d+)/); return m ? m[1].length : 0; };
    var label = el.parentNode.querySelector('.pair__label');
    return { el: el, q: q, h: h, qv: parseFloat(q), hv: parseFloat(h), dec: Math.max(dec(q), dec(h)),
      ql: el.getAttribute('data-advertised-label'), hl: el.getAttribute('data-checked-label'),
      qc: el.getAttribute('data-advertised-class'), hc: el.getAttribute('data-checked-class'), label: label };
  });
  var PAD = 4;
  function travel() { return track.clientWidth - thumb.offsetWidth - PAD * 2; }
  function render(x) {
    var tr = travel();
    thumb.style.transform = 'translateX(' + (x * tr) + 'px)';
    fill.style.transform = 'scaleX(' + Math.max(0, (PAD + x * tr + thumb.offsetWidth / 2) / track.clientWidth) + ')';
    var f = Math.min(1, Math.max(0, x));
    nums.forEach(function (n) {
      var text = f <= 0.0005 ? n.q : f >= 0.9995 ? n.h : (n.qv + (n.hv - n.qv) * f).toFixed(n.dec) + '%';
      if (n.el.textContent !== text) n.el.textContent = text;
      var cls = 'pair__fig ' + (f > 0.5 ? n.hc : n.qc);
      if (n.el.className !== cls) n.el.className = cls;
      var lt = f > 0.5 ? n.hl : n.ql;
      if (n.label && n.label.textContent !== lt) n.label.textContent = lt;
    });
  }
  var showingChecked = false;
  function sync(target) {
    showingChecked = target === 1;
    track.setAttribute('aria-valuenow', showingChecked ? '100' : '0');
    track.setAttribute('aria-valuetext', showingChecked ? 'the checked numbers' : 'the advertised numbers');
    if (btn) { btn.setAttribute('aria-pressed', showingChecked ? 'true' : 'false'); btn.textContent = showingChecked ? 'Show the advertised numbers' : 'Show the checked numbers'; }
  }
  var spring = new Spring(0, render);
  render(0); sync(0);
  function goTo(target, opts) { sync(target); spring.to(target, opts || { response: 0.4, damping: 1 }); }
  if (btn) btn.addEventListener('click', function () { goTo(showingChecked ? 0 : 1); });
  track.addEventListener('keydown', function (e) {
    var k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowUp' || k === 'End') { e.preventDefault(); goTo(1); }
    else if (k === 'ArrowLeft' || k === 'ArrowDown' || k === 'Home') { e.preventDefault(); goTo(0); }
  });
  var dragging = false, grabOffset = 0, history = [], startX = 0, startT = 0, onThumb = false;
  function fractionFromPointer(cx) { var rect = track.getBoundingClientRect(); return (cx - rect.left - PAD - thumb.offsetWidth / 2 - grabOffset) / travel(); }
  function withResistance(f) { var tr = travel(); if (f < 0) return -rubberband(-f * tr, 120) / tr; if (f > 1) return 1 + rubberband((f - 1) * tr, 120) / tr; return f; }
  track.addEventListener('pointerdown', function (e) {
    track.setPointerCapture(e.pointerId); dragging = true; spring.stop(); history = [];
    startX = e.clientX; startT = performance.now();
    var tb = thumb.getBoundingClientRect(); onThumb = e.clientX >= tb.left && e.clientX <= tb.right;
    grabOffset = onThumb ? e.clientX - (tb.left + tb.width / 2) : 0;
    var x = withResistance(fractionFromPointer(e.clientX)); spring.x = x; render(x); history.push({ t: e.timeStamp, x: x });
  });
  track.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var x = withResistance(fractionFromPointer(e.clientX)); spring.x = x; render(x);
    history.push({ t: e.timeStamp, x: x }); while (history.length > 2 && e.timeStamp - history[0].t > 100) history.shift();
  });
  function release(e) {
    if (!dragging) return; dragging = false;
    var tr = travel(), v = 0;
    if (history.length > 1) { var a = history[0], b = history[history.length - 1]; if (b.t > a.t) v = (b.x - a.x) / ((b.t - a.t) / 1000); }
    var moved = Math.abs(e.clientX - startX), quick = performance.now() - startT < 300, target;
    if (onThumb && moved < 4 && quick) target = showingChecked ? 0 : 1;
    else { var projected = spring.x * tr + project(v * tr); target = projected / tr > 0.5 ? 1 : 0; }
    goTo(target, { response: 0.4, damping: Math.abs(v) > 1.2 ? 0.8 : 1, velocity: v });
  }
  track.addEventListener('pointerup', release);
  track.addEventListener('pointercancel', release);
  window.addEventListener('resize', function () { render(spring.x); });
})();
