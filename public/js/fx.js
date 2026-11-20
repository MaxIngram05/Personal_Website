// Background starfield (per-scene flavour) and the pixel-dissolve transition.

export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const SCENE_STARS = {
  home: { count: 70, colors: ["#ffffff"], vx: 0, vy: 0, twinkle: 1 },
  projects: { count: 50, colors: ["#ffd600", "#ffffff"], vx: 0, vy: -0.25, twinkle: 0.6 },
  journey: { count: 55, colors: ["#ff8a1c", "#ffffff"], vx: 0.18, vy: 0, twinkle: 0.4 },
  about: { count: 55, colors: ["#3ee0ff", "#ffffff"], vx: 0, vy: 0.12, twinkle: 0.8 },
  contact: { count: 80, colors: ["#ff2030", "#ffd600", "#ffffff"], vx: 0, vy: 0, twinkle: 1.4 },
};

const HARD_COLORS = ["#c86bff", "#5dff8a", "#ffffff"];

export function starfield(canvas) {
  const g = canvas.getContext("2d");
  let stars = [];
  let cfg = SCENE_STARS.home;
  let hard = false;
  let raf = 0;
  let last = 0;
  let w = 0;
  let h = 0;

  function resize() {
    w = canvas.width = Math.ceil(window.innerWidth / 2);
    h = canvas.height = Math.ceil(window.innerHeight / 2);
    seed();
  }

  function seed() {
    const colors = hard ? HARD_COLORS : cfg.colors;
    const density = Math.min(1, (w * h) / (720 * 450));
    stars = Array.from({ length: Math.round(cfg.count * Math.max(0.45, density)) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      s: Math.random() < 0.15 ? 2 : 1,
      c: colors[(Math.random() * colors.length) | 0],
      p: Math.random() * Math.PI * 2,
      sp: 0.5 + Math.random() * 1.5,
    }));
  }

  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (t - last < 50) return; // ~20fps is plenty for twinkling pixels
    const dt = Math.min(3, (t - last) / 50);
    last = t;
    g.clearRect(0, 0, w, h);
    for (const st of stars) {
      st.x = (st.x + cfg.vx * st.sp * dt + w) % w;
      st.y = (st.y + cfg.vy * st.sp * dt + h) % h;
      st.p += 0.08 * cfg.twinkle * st.sp * dt;
      const a = 0.35 + 0.65 * Math.abs(Math.sin(st.p));
      // Quantize alpha so the twinkle steps like old hardware.
      g.globalAlpha = Math.round(a * 4) / 4;
      g.fillStyle = st.c;
      g.fillRect(st.x | 0, st.y | 0, st.s, st.s);
    }
  }

  function start() {
    cancelAnimationFrame(raf);
    if (reducedMotion() || document.hidden) {
      g.clearRect(0, 0, w, h);
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", start);
  window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", start);
  resize();

  return {
    setScene(name) {
      cfg = SCENE_STARS[name] || SCENE_STARS.home;
      seed();
      start();
    },
    setHard(value) {
      hard = value;
      seed();
    },
    start,
  };
}

// Covers the screen in random black blocks, runs `swap`, then uncovers.
export function dissolve(canvas, swap, color = "#000") {
  if (reducedMotion()) {
    swap();
    return Promise.resolve();
  }
  const g = canvas.getContext("2d");
  const cell = window.innerWidth < 600 ? 24 : 32;
  const cols = Math.ceil(window.innerWidth / cell);
  const rows = Math.ceil(window.innerHeight / cell);
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  canvas.classList.add("on");
  const cells = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) cells.push([x * cell, y * cell]);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const steps = 7;
  const per = Math.ceil(cells.length / steps);
  g.fillStyle = color;

  return new Promise((resolve) => {
    let i = 0;
    const cover = () => {
      for (const [x, y] of cells.slice(i * per, (i + 1) * per)) g.fillRect(x, y, cell, cell);
      if (++i < steps) return requestAnimationFrame(cover);
      swap();
      i = 0;
      requestAnimationFrame(uncover);
    };
    const uncover = () => {
      for (const [x, y] of cells.slice(i * per, (i + 1) * per)) g.clearRect(x, y, cell, cell);
      if (++i < steps) return requestAnimationFrame(uncover);
      canvas.classList.remove("on");
      resolve();
    };
    requestAnimationFrame(cover);
  });
}
