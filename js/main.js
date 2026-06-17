/* ================================================================
   INIT
================================================================= */
gsap.registerPlugin(ScrollTrigger);

const lenis = new Lenis({
  duration: 1.4,
  easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  wheelMultiplier: 0.85,
});

lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(time => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

/* ================================================================
   STAR FIELD
================================================================= */
(function buildStars(container, count = 220) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const el   = document.createElement('div');
    const size = (Math.random() * 1.8 + 0.4).toFixed(2);
    el.className = 'star';
    el.style.cssText =
      `left:${(Math.random() * 100).toFixed(2)}%;` +
      `top:${(Math.random() * 100).toFixed(2)}%;` +
      `width:${size}px;height:${size}px;` +
      `--o:${(Math.random() * 0.55 + 0.2).toFixed(2)};` +
      `--d:${(Math.random() * 4 + 2).toFixed(1)}s;` +
      `--delay:${(Math.random() * 6).toFixed(1)}s`;
    frag.appendChild(el);
  }
  container.appendChild(frag);
})(document.querySelector('.layer--space'));

/* ================================================================
   IMAGE PLACEHOLDER HANDLING
================================================================= */
document.querySelectorAll('.layer img').forEach(img => {
  img.addEventListener('load', () => {
    const ph = img.nextElementSibling;
    if (ph?.classList.contains('placeholder')) ph.hidden = true;
  });
});

/* ================================================================
   CLOUD CANVAS LAYERS
================================================================= */
(function initClouds() {
  const container = document.querySelector('.layer--clouds');
  if (!container) return;

  const VW   = window.innerWidth;
  const VH   = Math.round(window.innerHeight * 0.65);
  const TILE = VW * 2;

  function mkRng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s ^ (s >>> 17), 0x45d9f3b))  >>> 0;
      s = (Math.imul(s ^ (s >>> 13), 0x9e3779b9)) >>> 0;
      return s / 0x100000000;
    };
  }

  function drawPuff(ctx, cx, cy, pw, ph, seed, cfg) {
    const rand = mkRng(seed);
    const n    = Math.max(10, Math.ceil(pw / 15));
    const circles = [];
    for (let i = 0; i < n; i++) {
      const angle  = rand() * Math.PI * 2;
      const radial = Math.pow(rand(), 0.52);
      circles.push({
        x: cx + Math.cos(angle) * radial * pw * 0.52,
        y: cy + Math.sin(angle) * radial * ph * 0.40,
        r: pw * 0.09 + rand() * pw * 0.13,
      });
    }
    circles.sort((a, b) => b.y - a.y);

    for (const c of circles) {
      const vp    = Math.max(0, Math.min(1, (c.y - (cy - ph * 0.42)) / (ph * 0.84)));
      const light = 1 - vp;
      const [lr, lg, lb] = cfg.light;
      const [dr, dg, db] = cfg.dark;
      const cr = (dr + (lr - dr) * light) | 0;
      const cg = (dg + (lg - dg) * light) | 0;
      const cb = (db + (lb - db) * light) | 0;

      const g = ctx.createRadialGradient(
        c.x, c.y - c.r * 0.24, c.r * 0.04,
        c.x, c.y,               c.r
      );
      g.addColorStop(0,    `rgba(${cr},${cg},${cb},${cfg.alpha})`);
      g.addColorStop(0.50, `rgba(${cr},${cg},${cb},${+(cfg.alpha * 0.54).toFixed(3)})`);
      g.addColorStop(0.82, `rgba(${cr},${cg},${cb},${+(cfg.alpha * 0.15).toFixed(3)})`);
      g.addColorStop(1,    `rgba(${cr},${cg},${cb},0)`);

      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function buildLayer(cfg) {
    const canvas = document.createElement('canvas');
    canvas.className = 'cloud-canvas';
    canvas.width  = TILE;
    canvas.height = VH;
    container.appendChild(canvas);

    const ctx  = canvas.getContext('2d');
    const rand = mkRng(cfg.seed);

    for (let i = 0; i < cfg.count; i++) {
      const pw = cfg.wMin + rand() * (cfg.wMax - cfg.wMin);
      const ph = cfg.hMin + rand() * (cfg.hMax - cfg.hMin);
      const px = rand() * VW;
      const py = (cfg.yLo + rand() * (cfg.yHi - cfg.yLo)) * VH;
      const ps = (cfg.seed * 137 + i * 31) | 0;
      drawPuff(ctx, px,      py, pw, ph, ps, cfg);
      drawPuff(ctx, px + VW, py, pw, ph, ps, cfg);
    }

    let scroll = 0;
    return function tick(dt) {
      scroll = (scroll + cfg.speed * dt) % VW;
      canvas.style.transform = `translateX(-${scroll}px)`;
    };
  }

  const ticks = [
    buildLayer({
      seed: 1001, count: 16,
      wMin: 420, wMax: 720, hMin: 175, hMax: 300,
      yLo: 0.04, yHi: 0.56, speed: 0.010,
      light: [228, 168, 60], dark: [158, 88, 18], alpha: 0.58,
    }),
    buildLayer({
      seed: 2002, count: 18,
      wMin: 280, wMax: 520, hMin: 115, hMax: 220,
      yLo: 0.08, yHi: 0.55, speed: 0.022,
      light: [245, 192, 78], dark: [176, 108, 28], alpha: 0.68,
    }),
    buildLayer({
      seed: 3003, count: 13,
      wMin: 175, wMax: 360, hMin: 80, hMax: 160,
      yLo: 0.40, yHi: 0.96, speed: 0.040,
      light: [255, 212, 96], dark: [194, 130, 42], alpha: 0.76,
    }),
  ];

  gsap.ticker.add((time, dt) => ticks.forEach(tick => tick(dt)));
})();

/* ================================================================
   LASER ANCHOR — Model 2: tip always fixed at 50vh
   top = tipY - height  →  bottom edge (tip) is always at tipY
   height = span * progress  →  beam grows from station downward
================================================================= */
const laserState  = { progress: 0 };
const laserOffset = { y: 0 };  // px offset applied in Phase 3 to move laser with planet

(function initLaserAnchor() {
  const laser = document.querySelector('.laser');
  const img   = document.querySelector('.station-img');
  const ph    = document.querySelector('.placeholder--station');

  function update() {
    const el   = (!img.hidden && img.complete && img.naturalWidth > 0) ? img : ph;
    const rect = el.getBoundingClientRect();

    const tipY   = window.innerHeight * 0.5;
    const span   = Math.max(0, tipY - rect.bottom);
    const height = span * laserState.progress;

    laser.style.left   = `${rect.left + rect.width * 0.5}px`;
    laser.style.top    = `${rect.bottom + laserOffset.y}px`;
    laser.style.height = `${span * laserState.progress}px`;
  }

  gsap.ticker.add(update);
  window.addEventListener('resize', update, { passive: true });
})();

/* ================================================================
   MAIN SCROLL TIMELINE
   16 units across scene-multiplier × 100vh scroll distance.

   t 0 → 2    Laser fires: progress 0 → 1, tip rises to 50vh
   t 0 → 5    Station drifts off the top of the frame
   t 0 → 16   Laser colour shifts blue → red
   t 2 → 8.5  Quotes appear one at a time at 50vh (laser tip)
   t 4 → 8    Planet surface + clouds rise and lock  (25%→50% scroll)
   t 4.5→6    Impact bloom fades in
   t 8 → 8.5  Foreground slides up to 15% overlap
   t 11.52→13.6   Foreground rises alone over locked planet  (72%→85% scroll)
   t 13.6 →16     Foreground anchored to planet+clouds, all rise together  (85%→100%)
================================================================= */
// Keep foreground off-screen until Phase 1 starts (prevents it showing at y:0 on load)
gsap.set('.layer--foreground', { y: '100%' });

const tl = gsap.timeline({
  scrollTrigger: {
    trigger: '.scene-section',
    start:   'top top',
    end:     'bottom bottom',
    scrub:   1.5,
  },
});

// Station drifts off the top
tl.to('.layer--station',
  { y: '-200vh', ease: 'none', duration: 5 },
  0
);

// Laser fires: progress 0 → 1 over 2 units
tl.to(laserState,
  { progress: 1, ease: 'none', duration: 2 },
  0
);

// Laser colour: blue → red across full timeline
tl.to(document.documentElement, {
  '--laser-core':    '#fff6f0',
  '--laser-mid':     '#ff2800',
  '--laser-mid-tip': 'rgba(255, 80, 0, 0.3)',
  '--laser-outer':   'rgba(255, 60, 0, 0.2)',
  ease: 'none', duration: 16,
}, 0);

// Quotes — one at a time, centered at laser tip (50vh)
// yPercent: -50 vertically centers each quote at top: 50vh
document.querySelectorAll('.quote').forEach(q => {
  const tIn  = parseFloat(q.dataset.t);
  const tOut = tIn + 0.5;
  const isLeft = q.classList.contains('quote--left');

  tl.fromTo(q,
    { opacity: 0, x: isLeft ? 60 : -60, yPercent: -50, y: 0 },
    { opacity: 1, x: 0, yPercent: -50, y: 0, duration: 0.3, ease: 'back.out(1.7)' },
    tIn
  );

  tl.to(q,
    { opacity: 0, yPercent: -50, duration: 0.5, ease: 'power2.in' },
    tOut
  );
});

// Clouds anchored to planet top — same 110vh absolute travel as planet
tl.fromTo('.layer--clouds',
  { y: '169.2%' },
  { y: 0, ease: 'power1.out', duration: 4 },
  4
);

// Planet rises and locks at 50% scroll (t=8)
tl.fromTo('.layer--planet',
  { y: '110%' },
  { y: 0, ease: 'power1.out', duration: 4 },
  4
);

// Impact bloom appears as planet arrives under the laser tip
tl.to('.laser__impact',
  { opacity: 1, ease: 'none', duration: 1.5 },
  4.5
);

// Phase 1: foreground slides up to overlap bottom 15% of planet once planet locks at t=8
tl.fromTo('.layer--foreground',
  { y: '100%' },
  { y: '85%', ease: 'power2.out', duration: 0.5 },
  8
);

// Phase 2: foreground rises alone while planet and clouds stay locked (72%→85%)
tl.fromTo('.layer--foreground',
  { y: '85%' },
  { y: '45.5%', ease: 'none', duration: 2.08 },
  11.52
);

// Phase 3: foreground anchored to planet surface — all three rise in sync (85%→100%)
// All travel 45.5vh at identical speed; ease: none keeps them locked together
tl.fromTo('.layer--foreground',
  { y: '45.5%' },
  { y: 0, ease: 'none', duration: 2.4 },
  13.6
);
tl.fromTo('.layer--planet',
  { y: 0 },
  { y: '-45.5%', ease: 'none', duration: 2.4 },
  13.6
);
tl.fromTo('.layer--clouds',
  { y: 0 },
  { y: '-70%', ease: 'none', duration: 2.4 },
  13.6
);
// Laser rides with the planet — animate the offset consumed by the ticker
tl.fromTo(laserOffset,
  { y: 0 },
  { y: -(window.innerHeight * 0.455), ease: 'none', duration: 2.4 },
  13.6
);

/* ================================================================
   SCROLL HUD
================================================================= */
(function initHud() {
  const elPct = document.getElementById('hud-pct');
  const elT   = document.getElementById('hud-t');
  gsap.ticker.add(() => {
    const st = tl.scrollTrigger;
    if (!st) return;
    const p = st.progress;
    elPct.textContent = (p * 100).toFixed(1) + '%';
    elT.textContent   = 't ' + (p * tl.totalDuration()).toFixed(2);
  });
})();

/* ================================================================
   SCROLL HINT
================================================================= */
gsap.to('.scroll-hint', {
  opacity: 0, y: 10, ease: 'none',
  scrollTrigger: {
    trigger: '.scene-section',
    start: 'top top',
    end: '6% top',
    scrub: true,
  },
});

