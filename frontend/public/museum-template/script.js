/* ═══════════════════════════════════════════════════════════════
   ArtID Museum Template — script.js  (v2)

   No frameworks. Spawns 5 visitor silhouettes, fires real-shutter
   flashes spatially anchored to the visitor holding the camera,
   renders traits from injected JSON, manages the lightbox (which
   dims the hall behind), and respects prefers-reduced-motion.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ─── Visitor configuration ─────────────────────────────────────
  // Five visitors, locked per spec. Mix of depths and walk paths so
  // the hall feels populated without ever looking choreographed.
  const VISITORS = [
    { path: 'a', depth: 'mid',  bottom: '6%'  },
    { path: 'b', depth: 'near', bottom: '4%'  },
    { path: 'c', depth: 'far',  bottom: '14%' },
    { path: 'd', depth: 'far',  bottom: '12%' },
    { path: 'e', depth: 'mid',  bottom: '8%'  },
  ];

  function spawnVisitors() {
    const stage = document.querySelector('.visitors');
    if (!stage) return;

    VISITORS.forEach((cfg, i) => {
      const v = document.createElement('div');
      v.className = `visitor visitor--${cfg.path} visitor--${cfg.depth}`;
      v.style.bottom = cfg.bottom;
      v.dataset.index = String(i);

      const camera = document.createElement('div');
      camera.className = 'visitor__camera';
      v.appendChild(camera);

      stage.appendChild(v);
    });
  }

  // ─── Camera flashes ────────────────────────────────────────────
  // Each flash:
  //   1. Picks an on-screen visitor at random
  //   2. Lights up their camera pinpoint
  //   3. Positions the global flash overlay at that visitor's location
  //      so the overexposure radiates from where the shutter fired
  //   4. CSS animates the shutter curve (overexposure → drop → pop → fade)
  //
  // Skipped if the chosen visitor is offscreen — a flash from nowhere
  // reads as a bug, not a moment.

  function fireFlash() {
    const visitors = document.querySelectorAll('.visitor');
    const flash    = document.getElementById('flash');
    const hall     = document.getElementById('hall');
    if (!visitors.length || !flash || !hall) {
      scheduleNextFlash();
      return;
    }

    // Filter to visitors currently visible inside the hall
    const hallRect = hall.getBoundingClientRect();
    const onscreen = Array.from(visitors).filter(v => {
      const r = v.getBoundingClientRect();
      return r.right > hallRect.left + 40 && r.left < hallRect.right - 40;
    });
    if (!onscreen.length) {
      scheduleNextFlash();
      return;
    }

    const v    = onscreen[Math.floor(Math.random() * onscreen.length)];
    const rect = v.getBoundingClientRect();
    const xPct = ((rect.left + rect.width / 2) - hallRect.left) / hallRect.width  * 100;
    const yPct = ((rect.top  + rect.height * 0.38) - hallRect.top) / hallRect.height * 100;

    flash.style.setProperty('--flash-x', `${xPct.toFixed(1)}%`);
    flash.style.setProperty('--flash-y', `${yPct.toFixed(1)}%`);

    v.classList.add('is-flashing');
    flash.classList.add('is-firing');

    // Match the CSS shutter animation length (620ms). Cleanup at the end.
    setTimeout(() => {
      v.classList.remove('is-flashing');
      flash.classList.remove('is-firing');
    }, 640);

    scheduleNextFlash();
  }

  function scheduleNextFlash() {
    // 9-16s between flashes — quiet enough to read, frequent enough to feel alive
    const delay = 9000 + Math.random() * 7000;
    setTimeout(fireFlash, delay);
  }

  // ─── Traits rendering ──────────────────────────────────────────
  // The build pipeline replaces the contents of <script id="traits-data">
  // with a JSON array of trait objects like:
  //   [{ trait_type: "Background", value: "Gold", rarity: 0.04 }, ...]

  function renderTraits() {
    const host = document.getElementById('traits');
    const blob = document.getElementById('traits-data');
    if (!host || !blob) return;

    let traits = [];
    try {
      const raw = blob.textContent.trim();
      if (!raw || raw.startsWith('{{')) {
        host.innerHTML = emptyTraitsState();
        return;
      }
      traits = JSON.parse(raw);
    } catch (e) {
      console.warn('ArtID: could not parse traits JSON', e);
      host.innerHTML = emptyTraitsState();
      return;
    }

    if (!Array.isArray(traits) || traits.length === 0) {
      host.innerHTML = emptyTraitsState();
      return;
    }

    host.innerHTML = traits.map(t => {
      const type   = escapeHtml(t.trait_type || t.type || 'Trait');
      const value  = escapeHtml(String(t.value ?? ''));
      const rarity = (typeof t.rarity === 'number')
        ? `<span class="trait__rarity">${(t.rarity * 100).toFixed(1)}% have this</span>`
        : '';
      return `
        <div class="trait">
          <span class="trait__type">${type}</span>
          <span class="trait__value">${value}</span>
          ${rarity}
        </div>`;
    }).join('');
  }

  function emptyTraitsState() {
    return '<div class="trait" style="grid-column:1/-1;text-align:center;padding:32px 20px">'
         + '<span class="trait__value" style="color:var(--parchment-dim)">No attributes recorded</span>'
         + '</div>';
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ─── Lightbox ──────────────────────────────────────────────────
  // Opens the artwork at full size. While open, the body gets a class
  // that dims the entire hall via a CSS custom property — not just blur.

  function initLightbox() {
    const art    = document.getElementById('artwork');
    const lb     = document.getElementById('lightbox');
    const lbImg  = document.getElementById('lightboxImg');
    const close  = document.getElementById('lightboxClose');
    if (!art || !lb || !lbImg) return;

    const openLb = () => {
      lbImg.src = art.src;
      lb.classList.add('is-open');
      lb.setAttribute('aria-hidden', 'false');
      document.body.classList.add('is-lightbox-open');
      document.body.style.overflow = 'hidden';
    };
    const closeLb = () => {
      lb.classList.remove('is-open');
      lb.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('is-lightbox-open');
      document.body.style.overflow = '';
    };

    art.addEventListener('click', openLb);
    art.style.cursor = 'zoom-in';

    close && close.addEventListener('click', closeLb);
    lb.addEventListener('click', (e) => { if (e.target === lb) closeLb(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lb.classList.contains('is-open')) closeLb();
    });
  }

  // ─── Boot ──────────────────────────────────────────────────────

  function boot() {
    renderTraits();
    initLightbox();

    if (REDUCED_MOTION) return; // visitors/flash are decorative; skip entirely

    spawnVisitors();
    // Brief grace so visitors animate into the hall before the first flash
    setTimeout(scheduleNextFlash, 5000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
