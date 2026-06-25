(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────────────────────────
  // Set API_BASE to your ASOP Terminal Railway URL (no trailing slash).
  const API_BASE = 'https://YOUR_API_URL_HERE';
  const GUILD_ID = '1497395378495160493';
  const DAYS_WINDOW = 365;

  // ── Constants ────────────────────────────────────────────────────────────────
  const DAYS = 7, HOURS = 24, LEVELS = 12;
  const DAY_LABELS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
    if (i === 0)  return '12a';
    if (i === 12) return '12p';
    return i < 12 ? `${i}a` : `${i - 12}p`;
  });

  // ── 2D separable Gaussian smoothing ─────────────────────────────────────────
  function makeWeights(sigma, radius) {
    return Array.from({ length: radius * 2 + 1 }, (_, i) =>
      Math.exp(-((i - radius) ** 2) / (2 * sigma * sigma))
    );
  }

  function gaussianSmooth(grid) {
    const hW = makeWeights(1.0, 3);
    const hT = hW.reduce((a, b) => a + b, 0);

    // Horizontal pass — wrapping at hour boundaries
    const hSmoothed = grid.map(row =>
      Array.from({ length: HOURS }, (_, h) => {
        let s = 0;
        for (let k = -3; k <= 3; k++) {
          s += row[((h + k) % HOURS + HOURS) % HOURS] * hW[k + 3];
        }
        return s / hT;
      })
    );

    // Vertical pass — clamping at day boundaries
    const vW = makeWeights(1.0, 2);
    return Array.from({ length: DAYS }, (_, d) =>
      Array.from({ length: HOURS }, (_, h) => {
        let s = 0, t = 0;
        for (let k = -2; k <= 2; k++) {
          const src = Math.max(0, Math.min(DAYS - 1, d + k));
          const w = vW[k + 2];
          s += hSmoothed[src][h] * w;
          t += w;
        }
        return s / t;
      })
    );
  }

  // ── GeoJSON polygon → SVG path string ───────────────────────────────────────
  function geoJsonToPath(coordinates) {
    return coordinates.map(polygon =>
      polygon.map(ring =>
        ring.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(3)} ${y.toFixed(3)}`).join(' ') + ' Z'
      ).join(' ')
    ).join(' ');
  }

  // ── Render into #heatmap-root ────────────────────────────────────────────────
  function render(root, rawGrid) {
    const grid = gaussianSmooth(rawGrid);
    const peak = Math.max(1, ...grid.flat());

    const values = Array.from({ length: DAYS * HOURS }, (_, i) =>
      grid[Math.floor(i / HOURS)][i % HOURS]
    );

    const thresholds = Array.from({ length: LEVELS }, (_, i) => (peak * (i + 1)) / (LEVELS + 1));
    const contourData = d3.contours().size([HOURS, DAYS]).thresholds(thresholds)(values);

    const uid      = Math.random().toString(36).slice(2, 8);
    const filterId = `hm-f-${uid}`;
    const clipId   = `hm-c-${uid}`;

    const paths = contourData.map((c, i) => {
      const alpha = (0.15 + (i / (LEVELS - 1)) * 0.8).toFixed(3);
      return `<path d="${geoJsonToPath(c.coordinates)}" fill="rgba(255,200,60,${alpha})" />`;
    }).join('');

    const dividers = Array.from({ length: 6 }, (_, d) =>
      `<line x1="0" y1="${d + 1}" x2="${HOURS}" y2="${d + 1}" stroke="rgba(0,0,0,0.25)" stroke-width="0.035" />`
    ).join('');

    const hourLabels = HOUR_LABELS.map((l, h) =>
      `<span class="hm-hlabel">${h % 3 === 0 ? l : ''}</span>`
    ).join('');

    const dayLabels = DAY_LABELS.map(d =>
      `<span class="hm-dlabel">${d}</span>`
    ).join('');

    root.innerHTML = `
      <div class="hm-hour-row">${hourLabels}</div>
      <div class="hm-body-row">
        <div class="hm-days">${dayLabels}</div>
        <svg class="hm-svg" viewBox="0 0 ${HOURS} ${DAYS}" preserveAspectRatio="none">
          <defs>
            <filter id="${filterId}" x="-5%" y="-10%" width="110%" height="120%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="0.28" />
            </filter>
            <clipPath id="${clipId}">
              <rect x="0" y="0" width="${HOURS}" height="${DAYS}" />
            </clipPath>
          </defs>
          <rect x="0" y="0" width="${HOURS}" height="${DAYS}" fill="rgba(255,255,255,0.03)" />
          <g clip-path="url(#${clipId})">
            <g filter="url(#${filterId})">${paths}</g>
          </g>
          ${dividers}
        </svg>
      </div>
    `;
  }

  // ── Fetch + render ───────────────────────────────────────────────────────────
  async function load(root, loadingEl, type, timezone) {
    loadingEl.style.display = 'flex';
    root.innerHTML = '';
    try {
      const qs  = new URLSearchParams({ guildId: GUILD_ID, type, timezone, days: String(DAYS_WINDOW) });
      const res = await fetch(`${API_BASE}/api/rolecall/public/heatmap?${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      render(root, data.grid);
    } catch {
      root.innerHTML = '<p class="hm-error">Activity data unavailable.</p>';
    } finally {
      loadingEl.style.display = 'none';
    }
  }

  // ── Init ─────────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    const tabsEl    = document.getElementById('heatmap-type-tabs');
    const tzEl      = document.getElementById('heatmap-tz');
    const rootEl    = document.getElementById('heatmap-root');
    const loadingEl = document.getElementById('heatmap-loading');
    if (!rootEl || !loadingEl) return;

    let type     = 'combined';
    let timezone = 'UTC';

    tabsEl?.addEventListener('click', e => {
      const btn = e.target.closest('[data-type]');
      if (!btn) return;
      tabsEl.querySelectorAll('.heatmap-tab').forEach(b => b.classList.remove('heatmap-tab--active'));
      btn.classList.add('heatmap-tab--active');
      type = btn.dataset.type;
      load(rootEl, loadingEl, type, timezone);
    });

    tzEl?.addEventListener('change', () => {
      timezone = tzEl.value;
      load(rootEl, loadingEl, type, timezone);
    });

    load(rootEl, loadingEl, type, timezone);
  });
}());
