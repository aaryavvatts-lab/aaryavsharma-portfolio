/**
 * Electrode array: 64 needles on a rounded base, the way a Utah microelectrode array is built.
 * The pointer is projected back onto the ground, and each needle takes its height from its
 * distance to it, on its own spring. At rest the array is a dune with two rises. One dot rides
 * the tip of the needle under the pointer, or the tallest one at rest. Needles above half height
 * take the bright stroke. The slider is the radius, in cells.
 *
 * The pattern: a continuous field. Springs, a falloff by distance, a hit test on the ground
 * plane (which never moves), and a rest that is a composition.
 */
const {
  Cam, clamp, facing, fit, prism, proj, rings, unproj, spring, stepS,
  flatDot, mk, place, pointer, put, register, disposer, solid,
} = HL;

const N = 8, CELL = 13, FOOT = 5.4, HMAX = 74, EXT = N * CELL, PB = 6;

/** The share of full height at u radii from the pointer: 1 → .31 at 42% → .09 at the edge and beyond. */
const falloff = (u) =>
  u <= 0 ? 1 : u <= 0.417 ? 1 - (u / 0.417) * 0.6875 : u <= 1 ? 0.3125 - ((u - 0.417) / 0.583) * 0.2185 : 0.094;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 2.12);
  fit(C, [[-8, -8, -PB], [EXT + 8, EXT + 8, -PB], [EXT + 8, -8, -PB], [-8, EXT + 8, -PB], [0, 0, HMAX * 0.8]], 200, 178);
  const P = proj(C), front = facing(C);
  let R = value * CELL, over = null;

  const g = mk("g", {}, svg), cols = [];
  const [pr, pi] = rings(-8, -8, EXT + 8, EXT + 8, 10, 2.2);
  put(solid(g), prism(P, front, pr, pi, -PB, 0));
  // Diagonal by diagonal from the back corner, so appending is painting back to front.
  for (let s = 0; s <= 2 * (N - 1); s++) for (let i = 0; i < N; i++) {
    const j = s - i;
    if (j < 0 || j >= N) continue;
    const u = i / (N - 1), v = j / (N - 1);
    const h0 = 5 + 34 * Math.exp(-((u - 0.2) ** 2 + (v - 0.72) ** 2) / 0.06) + 17 * Math.exp(-((u - 0.82) ** 2 + (v - 0.24) ** 2) / 0.03);
    const x0 = i * CELL + (CELL - FOOT) / 2, y0 = j * CELL + (CELL - FOOT) / 2;
    const [ring, inner] = rings(x0, y0, x0 + FOOT, y0 + FOOT, 1.6, 0.6);
    cols.push({ i, j, h0, ring, inner, sp: spring(h0, { eps: 0.04 }), el: solid(g), drawn: NaN });
  }

  // The mark: one dot riding the tip of one needle, moved in the paint order to just
  // after it, so the needles in front still cover it.
  const mark = mk("g", {}, g);
  const dot = flatDot(mark, C, 1.05, "dot");
  const peak = cols.reduce((a, b) => (b.h0 > a.h0 ? b : a));
  const byCell = new Map();
  cols.forEach((c) => byCell.set(c.i + "," + c.j, c));
  let mc = null, want = peak;

  function drawMark() {
    if (want !== mc) { mc = want; mc.el.g.after(mark); }
    const cx = (mc.i + 0.5) * CELL, cy = (mc.j + 0.5) * CELL, h = Math.max(0.6, mc.sp.x);
    place(dot, P(cx, cy, h));
  }
  // A needle whose spring hasn't moved keeps its paths: most of the 64 are still on most frames.
  function drawCol(c) {
    const h = Math.max(0.6, c.sp.x);
    if (h === c.drawn) return;
    c.drawn = h;
    put(c.el, prism(P, front, c.ring, c.inner, 0, h));
    c.el.sil.classList.toggle("hi", h > HMAX * 0.5);
  }

  const B = register(stage, (dt) => {
    let m = false;
    for (const c of cols) { if (stepS(c.sp, dt)) m = true; drawCol(c); }
    drawMark();
    return m;
  });
  bag.add(B.unregister);

  function retarget() {
    for (const c of cols) {
      if (!over) { c.sp.t = c.h0; continue; }
      const dx = (c.i + 0.5) * CELL - over[0], dy = (c.j + 0.5) * CELL - over[1];
      c.sp.t = HMAX * falloff(Math.hypot(dx, dy) / R);
    }
    if (over) {
      const i = clamp(Math.floor(over[0] / CELL), 0, N - 1), j = clamp(Math.floor(over[1] / CELL), 0, N - 1);
      want = byCell.get(i + "," + j);
      read.textContent = `ch ${i}/${j}`;
    } else { want = peak; read.textContent = "rest"; }
    B.wake();
  }

  bag.add(pointer(stage, {
    move: (p) => { over = unproj(C, p[0], p[1], 0); retarget(); },
    leave: () => { over = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { R = v * CELL; if (over) retarget(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "electrode-array",
  means: "An array of 64 electrode needles rises under the pointer and falls off with distance.",
  rules: [1, 3, 5, 9],
  range: [1.8, 3.2, 5],
  tour: [[130, 160], [272, 150], [200, 222], null],
  mount,
});
