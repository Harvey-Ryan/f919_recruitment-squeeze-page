/* ================================================================
   INIT
================================================================= */
history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

gsap.registerPlugin(ScrollTrigger);

const isMobile = window.matchMedia('(max-width: 768px)').matches;

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
    // CEILING — dense bank straddling the planet top edge to fully conceal it
    buildLayer({
      seed: 4004, count: 26,
      wMin: 350, wMax: 650, hMin: 280, hMax: 560,
      yLo: -0.15, yHi: 0.35, speed: 0.007,
      light: [235, 172, 68], dark: [162, 92, 22], alpha: 0.85,
    }),
    // FAR — large slow puffs spanning upper band
    buildLayer({
      seed: 1001, count: 20,
      wMin: 420, wMax: 720, hMin: 175, hMax: 300,
      yLo: 0.0, yHi: 0.56, speed: 0.010,
      light: [228, 168, 60], dark: [158, 88, 18], alpha: 0.58,
    }),
    // MID — medium puffs, warmer ochre
    buildLayer({
      seed: 2002, count: 22,
      wMin: 280, wMax: 520, hMin: 115, hMax: 220,
      yLo: 0.0, yHi: 0.55, speed: 0.022,
      light: [245, 192, 78], dark: [176, 108, 28], alpha: 0.68,
    }),
    // NEAR — smaller defined puffs, lowest band
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

    const tipY = window.innerHeight * 0.55;
    const span = Math.max(0, tipY - rect.bottom);

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
   t 8.64→16      Foreground rises from off-screen, all layers move together  (54%→100%)
================================================================= */
// Set all off-screen starting positions before ScrollTrigger initialises
// to prevent a flash of elements at their natural CSS positions on load
gsap.set('.layer--foreground', { y: '100%' });
gsap.set('.layer--planet',     { y: '110%' });
gsap.set('.layer--clouds',     { y: '169.2%' });
gsap.set('.fleet-block', { opacity: 0 });
gsap.set('.site-header', { yPercent: -100 });
if (!isMobile) gsap.set('.info', { y: window.innerHeight });

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

// Laser colour: blue → red, timed to the moment the beam hits the planet surface (~t=7.3)
// Starts shifting just before contact, completes as planet fully rises
tl.to(document.documentElement, {
  '--laser-core':    '#fff6f0',
  '--laser-mid':     '#ff2800',
  '--laser-mid-tip': 'rgba(255, 80, 0, 0.3)',
  '--laser-outer':   'rgba(255, 60, 0, 0.2)',
  ease: 'power2.out', duration: 2.5,
}, 7);

// "Meet the Crew" — pops in dead centre at 5% scroll, fades by 7%
tl.fromTo('.meet-crew',
  { opacity: 0, xPercent: -50, yPercent: -50 },
  { opacity: 1, xPercent: -50, yPercent: -50, duration: 0.15, ease: 'power2.out' },
  0.6
);
tl.to('.meet-crew',
  { y: -(window.innerHeight * 0.55), opacity: 0, duration: 1.0, ease: 'power2.in' },
  1.0
);

// Quotes — marquee style: pop in from the side, then scroll upward off screen
// Entry (0.25) + exit (0.75) = 1.0 unit, filling the gap between each quote
document.querySelectorAll('.quote').forEach(q => {
  const tIn    = parseFloat(q.dataset.t);
  const isLeft = q.classList.contains('quote--left');

  // Pop in from the side
  tl.fromTo(q,
    { opacity: 0, x: isLeft ? 50 : -50, yPercent: -50, y: 0 },
    { opacity: 1, x: 0, yPercent: -50, y: 0, duration: 0.25, ease: 'back.out(1.4)' },
    tIn
  );

  // Scroll upward off screen, fading in the final stretch
  tl.to(q,
    { y: -(window.innerHeight * 0.65), opacity: 0, yPercent: -50, duration: 0.55, ease: 'power2.in' },
    tIn + 0.45
  );
});

// Info cards — same pop-in / scroll-up / fade-out pattern as quotes
document.querySelectorAll('.card').forEach(card => {
  const tIn    = parseFloat(card.dataset.t);
  const isLeft = card.classList.contains('card--left');

  tl.fromTo(card,
    { opacity: 0, x: isLeft ? 40 : -40, yPercent: -50, y: 0 },
    { opacity: 1, x: 0, yPercent: -50, y: 0, duration: 0.25, ease: 'back.out(1.4)' },
    tIn
  );

  tl.to(card,
    { y: -(window.innerHeight * 0.55), opacity: 0, yPercent: -50, duration: 0.75, ease: 'power2.in' },
    tIn + 1.0
  );
});

// Clouds anchored to planet top — same 110vh absolute travel as planet
tl.fromTo('.layer--clouds',
  { y: '169.2%' },
  { y: 0, ease: 'power1.out', duration: 5 },
  5
);

// Planet rises and locks at 50% scroll (t=10)
tl.fromTo('.layer--planet',
  { y: '110%' },
  { y: 0, ease: 'power1.out', duration: 5 },
  5
);

// Impact bloom appears as planet arrives under the laser tip
tl.to('.laser__impact',
  { opacity: 1, ease: 'none', duration: 1.875 },
  5.625
);

// Headline + CTA fade in at 70% scroll (t=11.2)
// yPercent: -50 centers the block at top:50%; -38 is the slide-in start (12% lower)
tl.fromTo('.cta-block',
  { opacity: 0, yPercent: -38 },
  { opacity: 1, yPercent: -50, ease: 'power2.out', duration: 0.6 },
  14
);

// Fleet block: real-time reveal at 72% scroll — image fades in, then border draws,
// then both lines type out. All chained so each step fires immediately after the last.
ScrollTrigger.create({
  trigger: '.scene-section',
  start: '70% top',
  once: true,
  onEnter() {
    const LINES = [
      { el: document.querySelectorAll('.fleet-id__line')[0], text: 'FLEET 919' },
      { el: document.querySelectorAll('.fleet-id__line')[1], text: 'JOIN THE FIGHT' },
    ];
    const rt = gsap.timeline();

    // 1. Logo fades in
    rt.fromTo('.fleet-block',
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, ease: 'power2.out', duration: 0.5 }
    );

    // 2. Border draws immediately after
    rt.fromTo('.fleet-id__border',
      { scaleY: 0 },
      { scaleY: 1, ease: 'power2.out', duration: 0.35 }
    );

    // 3. Each line types out in sequence
    LINES.forEach(({ el, text }, i) => {
      const state = { n: 0 };
      rt.fromTo(state,
        { n: 0 },
        {
          n: text.length,
          ease: 'none',
          duration: text.length * 0.07,
          onUpdate() { el.textContent = text.slice(0, Math.round(state.n)); },
        },
        `+=${i === 0 ? 0.05 : 0.15}`
      );
    });
  },
});

// Phase 3: all layers rise in sync (54%→100% scroll)
// All travel 25vh; clouds: 25/65×100 = 38.5% of their 65vh height
// Phase 3a (37.5%→56% scroll, t=6→8.96): foreground drifts up like a camera pan.
// Accounts for top 40% empty vector — settles at y:'40%' before all layers lock.
if (isMobile) {
  tl.fromTo('.layer--foreground',
    { y: '100%' },
    { y: 0, ease: 'power1.out', duration: 6, immediateRender: false },
    14
  );
} else {
  // Desktop: full two-phase foreground animation
  tl.fromTo('.layer--foreground',
    { y: '100%' },
    { y: '40%', ease: 'none', duration: 3.7 },
    7.5
  );
  tl.to('.layer--foreground',
    { y: 0, ease: 'none', duration: 2.8, startAt: { y: '40%' } },
    11.2
  );
}
if (!isMobile) {
  tl.to('.layer--planet',
    { y: '-40%', ease: 'none', duration: 2.8, startAt: { y: 0 } },
    11.2
  );
  // Clouds: 40vh / 65vh height = 61.5%
  tl.to('.layer--clouds',
    { y: '-61.5%', ease: 'none', duration: 2.8, startAt: { y: 0 } },
    11.2
  );
  // Pad desktop timeline to 20 units — mobile foreground tween (t=14, dur=6) does this
  // naturally on mobile; on desktop the last real tween ends at t=14.6 which compresses
  // the scroll map and causes the scene exit to fire before the CTA renders.
  tl.to({}, { duration: 5.4 }, 14.6);
}
// CTA and laser remain fixed at their initial rendered positions through Phase 3b

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
    start: '73% top',
    end: '77% top',
    scrub: true,
  },
});

// One-shot bounce on load to prompt scrolling; stored so it can be killed when CTA arrives
const scrollHintBounce = gsap.to('.scroll-hint', {
  y: 20,
  ease: 'power1.inOut',
  duration: 0.4,
  delay: 1.0,
  yoyo: true,
  repeat: 19,
});

/* ================================================================
   SCROLL HINT MORPH — swap to "LEARN MORE" + chevrons after CTA renders
================================================================= */
ScrollTrigger.create({
  trigger: '.scene-section',
  start: '70% top',
  once: true,
  onEnter() {
    scrollHintBounce.kill();
    gsap.set('.scroll-hint', { y: 0 });
    gsap.timeline({ delay: 1.5 })
      .to('.scroll-hint', { opacity: 0, duration: 0.25, ease: 'none' })
      .call(() => {
        document.querySelector('.scroll-hint__label').textContent = 'LEARN MORE';
        document.querySelector('.scroll-hint__line').style.display = 'none';
        document.querySelector('.scroll-hint__chevrons').style.display = 'flex';
      })
      .to('.scroll-hint', { opacity: 1, duration: 0.3, ease: 'none' });
  },
});

/* ================================================================
   SCENE EXIT (desktop only) — one-shot at 77% scroll
   Scene slides up, header drops in, below-fold rises from bottom.
================================================================= */
if (!isMobile) {
  ScrollTrigger.create({
    trigger: '.scene-section',
    start: '77% top',
    once: true,
    onEnter() {
      const header = document.querySelector('.site-header');
      gsap.timeline()
        .to('.scene-stage', { y: '-100vh', duration: 0.8, ease: 'power3.inOut' })
        .to('.site-header', {
          yPercent: 0,
          duration: 0.5,
          ease: 'power2.out',
          onComplete() { header.style.pointerEvents = 'auto'; },
        }, 0.4)
        .to('.info', {
          y: 0,
          duration: 0.6,
          ease: 'power2.out',
          onComplete() { document.querySelector('.info').style.pointerEvents = 'auto'; },
        }, 0.4);
    },
  });
}

// Reveal layers after ScrollTrigger's first refresh so all initial
// transforms are locked in before elements become visible
function onFirstRefresh() {
  ScrollTrigger.removeEventListener('refresh', onFirstRefresh);
  document.body.classList.remove('loading');
}
ScrollTrigger.addEventListener('refresh', onFirstRefresh);

/* ================================================================
   DAILY ACTIVE STAT
================================================================= */
(function fetchDailyActive() {
  const ROLECALL_URL = 'https://rolecallbot-production.up.railway.app';
  const GUILD_ID     = '1497395378495160493';

  fetch(`${ROLECALL_URL}/api/public/daily-active-avg?guildId=${GUILD_ID}`)
    .then(r => r.ok ? r.json() : r.json().then(b => Promise.reject(b)))
    .then(data => {
      const el = document.getElementById('stat-daily-active');
      if (el && data.avg_daily_active > 0) el.textContent = data.avg_daily_active;
    })
    .catch(err => { console.warn('[daily-active]', err); });
})();

