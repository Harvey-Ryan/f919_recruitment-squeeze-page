/* ================================================================
   INIT
================================================================= */
gsap.registerPlugin(ScrollTrigger);

// ── Lenis smooth scroll ──────────────────────────────────────
const lenis = new Lenis({
  duration: 1.4,
  easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  wheelMultiplier: 0.85,
});

// Keep GSAP ScrollTrigger in sync with Lenis scroll position
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(time => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

/* ================================================================
   STAR FIELD
   Generates and injects star elements into the space background.
   Count, size range, and opacity range are all tunable here.
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
      `width:${size}px;` +
      `height:${size}px;` +
      `--o:${(Math.random() * 0.55 + 0.2).toFixed(2)};` +
      `--d:${(Math.random() * 4 + 2).toFixed(1)}s;` +
      `--delay:${(Math.random() * 6).toFixed(1)}s`;

    frag.appendChild(el);
  }

  container.appendChild(frag);
})(document.querySelector('.layer--space'));

/* ================================================================
   IMAGE PLACEHOLDER HANDLING
   Hides the placeholder when a real image loads successfully.
   (onerror="this.hidden=true" in the HTML handles the 404 case.)
================================================================= */
document.querySelectorAll('.layer img').forEach(img => {
  img.addEventListener('load', () => {
    const ph = img.nextElementSibling;
    if (ph?.classList.contains('placeholder')) ph.hidden = true;
  });
});

/* ================================================================
   CLOUD CANVAS LAYERS
   Three canvas tiles (far / mid / near) are pre-rendered once to a
   buffer 2 × the viewport width, then scrolled horizontally at
   different speeds via CSS transform — no per-frame redraws.

   Each puff is a cluster of soft, top-lit circles whose colours
   shift from shadowed amber at the base to pale sandy cream at the
   peaks. The undercast band at the bottom of each layer gives the
   sense of looking down into a thick cloud interior.

   VH must stay in sync with .layer--clouds height in style.css.
================================================================= */
(function initClouds() {
  const container = document.querySelector('.layer--clouds');
  if (!container) return;

  const VW   = window.innerWidth;
  const VH   = Math.round(window.innerHeight * 0.65); // matches CSS 65vh
  const TILE = VW * 2; // 2× wide → seamless horizontal loop

  /* ── Seeded LCG — same seed always yields the same cloud ─────── */
  function mkRng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s ^ (s >>> 17), 0x45d9f3b))  >>> 0;
      s = (Math.imul(s ^ (s >>> 13), 0x9e3779b9)) >>> 0;
      return s / 0x100000000;
    };
  }

  /* ── Draw one puff: overlapping circles with vertical lighting ── */
  function drawPuff(ctx, cx, cy, pw, ph, seed, cfg) {
    const rand = mkRng(seed);
    const n    = Math.max(10, Math.ceil(pw / 15));

    // Collect circles then paint bottom→top so lit peaks paint last
    const circles = [];
    for (let i = 0; i < n; i++) {
      const angle  = rand() * Math.PI * 2;
      const radial = Math.pow(rand(), 0.52); // slight perimeter bias → lumpy edge
      circles.push({
        x: cx + Math.cos(angle) * radial * pw * 0.52,
        y: cy + Math.sin(angle) * radial * ph * 0.40,
        r: pw * 0.09 + rand() * pw * 0.13,
      });
    }
    circles.sort((a, b) => b.y - a.y); // bottom first

    for (const c of circles) {
      // 0 = top of puff (fully lit), 1 = bottom (fully shadowed)
      const vp    = Math.max(0, Math.min(1, (c.y - (cy - ph * 0.42)) / (ph * 0.84)));
      const light = 1 - vp;

      const [lr, lg, lb] = cfg.light;
      const [dr, dg, db] = cfg.dark;
      const cr = (dr + (lr - dr) * light) | 0;
      const cg = (dg + (lg - dg) * light) | 0;
      const cb = (db + (lb - db) * light) | 0;

      // Radial highlight shifted slightly upward for a sunlit-top feel
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

  /* ── Build one canvas layer, return its per-frame tick ─────────── */
  function buildLayer(cfg) {
    const canvas = document.createElement('canvas');
    canvas.className = 'cloud-canvas';
    canvas.width  = TILE;
    canvas.height = VH;
    container.appendChild(canvas);

    const ctx  = canvas.getContext('2d');
    const rand = mkRng(cfg.seed);

    // Place puffs and draw each one at x and x + VW for seamless tile
    for (let i = 0; i < cfg.count; i++) {
      const pw = cfg.wMin + rand() * (cfg.wMax - cfg.wMin);
      const ph = cfg.hMin + rand() * (cfg.hMax - cfg.hMin);
      const px = rand() * VW;
      const py = (cfg.yLo + rand() * (cfg.yHi - cfg.yLo)) * VH;
      const ps = (cfg.seed * 137 + i * 31) | 0;

      drawPuff(ctx, px,      py, pw, ph, ps, cfg);
      drawPuff(ctx, px + VW, py, pw, ph, ps, cfg); // tile copy
    }

    let scroll = 0;
    return function tick(dt) {
      scroll = (scroll + cfg.speed * dt) % VW;
      canvas.style.transform = `translateX(-${scroll}px)`;
    };
  }

  /* ── Layer definitions ───────────────────────────────────────── */
  const ticks = [

    // FAR — large, slow, muted amber; fills the upper cloud band
    buildLayer({
      seed: 1001, count: 7,
      wMin: 420, wMax: 720, hMin: 175, hMax: 300,
      yLo: 0.04, yHi: 0.56,
      speed: 0.010,
      light: [228, 168, 60], dark: [158, 88, 18],
      alpha: 0.58,
    }),

    // MID — medium puffs, warmer ochre, overlapping zone
    buildLayer({
      seed: 2002, count: 10,
      wMin: 280, wMax: 520, hMin: 115, hMax: 220,
      yLo: 0.18, yHi: 0.74,
      speed: 0.022,
      light: [245, 192, 78], dark: [176, 108, 28],
      alpha: 0.68,
    }),

    // NEAR — smaller defined puffs, bright sandy cream; lowest band
    buildLayer({
      seed: 3003, count: 13,
      wMin: 175, wMax: 360, hMin: 80, hMax: 160,
      yLo: 0.40, yHi: 0.96,
      speed: 0.040,
      light: [255, 212, 96], dark: [194, 130, 42],
      alpha: 0.76,
    }),

  ];

  // Hook into GSAP's ticker so cloud drift stays in sync with the scene
  gsap.ticker.add((time, dt) => ticks.forEach(tick => tick(dt)));
})();

/* ================================================================
   LASER ANCHOR
   Runs every GSAP frame. Both endpoints are derived from live
   bounding rects so the beam tracks the station (top) and the
   planet surface (bottom) regardless of scroll position or viewport
   size. A separate progress scalar (driven by the scroll timeline)
   lets the beam "fire" from zero rather than appearing at full
   length immediately.
================================================================= */
// Fraction of the planet layer's height where the beam terminates.
// 0 = very top edge of the planet layer, 1 = bottom edge.
// Increase to aim deeper into the planet surface.
const LASER_PLANET_TARGET = 0.80;

const laserState = { progress: 0 };

(function initLaserAnchor() {
  const laser    = document.querySelector('.laser');
  const img      = document.querySelector('.station-img');
  const fallback = document.querySelector('.placeholder--station');
  const planet   = document.querySelector('.layer--planet');

  // Compute target from offsetHeight (ignores GSAP transforms), so the impact
  // point stays fixed regardless of where the planet is in its animation.
  function computeTarget() {
    return window.innerHeight - planet.offsetHeight * (1 - LASER_PLANET_TARGET);
  }

  let planetTarget = computeTarget();

  function update() {
    const el            = (!img.hidden && img.complete && img.naturalWidth > 0) ? img : fallback;
    const stationRect   = el.getBoundingClientRect();
    const stationBottom = stationRect.bottom;

    laser.style.left = `${stationRect.left + stationRect.width * 0.5}px`;
    laser.style.top  = `${stationBottom}px`;

    const span = Math.max(0, Math.min(planetTarget, window.innerHeight) - stationBottom);
    laser.style.height = `${span * laserState.progress}px`;
  }

  gsap.ticker.add(update);
  window.addEventListener('resize', () => { planetTarget = computeTarget(); update(); }, { passive: true });
})();

/* ================================================================
   MAIN SCROLL TIMELINE
   Tied to .scene-section (4 × 100vh tall).
   start:'top top' + end:'bottom bottom' spans 3 × 100vh of scroll.

   Timeline is 10 units long; position arguments below map to
   scroll progress (e.g. position 3 = 30% through the scroll).

     0   → 5.5   Laser fires and grows toward the planet
     3   → 7.2   Planet surface rises from below
     5.5 → 7     Impact bloom appears at the beam tip
     6.5 → 10    Foreground element enters for added depth

   Adjust position and duration values to taste after adding images.
   The --laser-max-h, --planet-h, and --fg-h CSS variables control
   the visual sizing; the JS values below control scroll timing.
================================================================= */
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: '.scene-section',
    start:   'top top',
    end:     'bottom bottom',
    scrub:   1.5,       // seconds of lag — raise for more float, lower for tighter
  },
});

// Station drifts off the top of the frame as the user scrolls
tl.to('.layer--station',
  { y: '-100vh', ease: 'none', duration: 10 },
  0
);

// Act 1: Laser fires — progress drives the geometric height calculation above
tl.to(laserState,
  { progress: 1, ease: 'none', duration: 5.5 },
  0
);

// Laser color shift: blue → red across the full scroll
tl.to(document.documentElement, {
  '--laser-core':    '#fff6f0',
  '--laser-mid':     '#ff2800',
  '--laser-mid-tip': 'rgba(255, 80, 0, 0.3)',
  '--laser-outer':   'rgba(255, 60, 0, 0.2)',
  ease: 'none',
  duration: 10,
}, 0);

// Clouds ride with the planet — identical easing/duration/start, offset by -27.71%
// y:65.37% = planet's 110%×55vh translated into the cloud layer's 65vh coordinate space
tl.fromTo('.layer--clouds',
  { y: '100%' },
  { y: '-27.71%', ease: 'power1.out', duration: 4.2 },
  3
);

// Act 2: Planet surface rises from off-screen below
tl.fromTo('.layer--planet',
  { y: '110%' },
  { y: 0, ease: 'power1.out', duration: 4.2 },
  3
);

// Impact bloom fades in as planet enters
tl.to('.laser__impact',
  { opacity: 1, ease: 'none', duration: 1.5 },
  5.5
);

// Quotes shoot out horizontally from the laser tip as it descends.
// onStart snaps each quote's top to the live laser tip position so it
// always originates from where the beam currently ends, never the station.
const laserEl = document.querySelector('.laser');
document.querySelectorAll('.quote').forEach(q => {
  const tIn   = parseFloat(q.dataset.t);
  const tOut  = Math.min(tIn + 2.0, 5.8);
  const isLeft = q.classList.contains('quote--left');

  // Shoot out horizontally from the laser tip
  tl.fromTo(q,
    { opacity: 0, x: isLeft ? 50 : -50 },
    {
      opacity: 1,
      x: 0,
      duration: 0.45,
      ease: 'back.out(1.7)',
      onStart() {
        const tipY = parseFloat(laserEl.style.top) + parseFloat(laserEl.style.height);
        q.style.top = Math.max(0, tipY) + 'px';
      },
    },
    tIn
  );

  // Drift upward while visible — parallax against the downward scroll
  tl.fromTo(q,
    { y: 0 },
    { y: -180, ease: 'none', duration: tOut - tIn },
    tIn
  );

  // Fade out
  tl.to(q,
    { opacity: 0, duration: 0.5, ease: 'power2.in' },
    tOut
  );
});

// Act 3: Foreground enters after the cloud layer has mostly lifted
tl.fromTo('.layer--foreground',
  { y: '130%' },
  { y: 0, ease: 'power2.out', duration: 1.5 },
  8.5
);

/* ================================================================
   SCROLL HINT
   Fades out as the user begins scrolling.
================================================================= */
gsap.to('.scroll-hint', {
  opacity: 0,
  y: 10,
  ease: 'none',
  scrollTrigger: {
    trigger: '.scene-section',
    start:   'top top',
    end:     '6% top',
    scrub:   true,
  },
});

/* ================================================================
   LINKS SECTION  —  staggered entry
================================================================= */
gsap.from('.link-item', {
  opacity: 0,
  y: 28,
  stagger: 0.12,
  duration: 0.9,
  ease: 'power2.out',
  scrollTrigger: {
    trigger: '.links-section',
    start:   'top 80%',
    toggleActions: 'play none none none',
  },
});
