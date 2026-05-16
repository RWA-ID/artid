/* ═══════════════════════════════════════════════════════════════
   ArtID Museum Template — script.js
   No frameworks. Spawns visitors, fires flashes,
   renders traits from injected JSON, manages lightbox.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── Visitor configuration ─────────────────────────────────────
  // Each visitor has a walk path (A/B/C — defined in CSS) and a
  // depth class which scales its size & opacity.
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
  // Pick a random visitor, briefly light up their camera, then trigger
  // the global flash overlay positioned roughly where they're standing.
  function fireFlash() {
    const visitors = document.querySelectorAll('.visitor');
    const flash    = document.getElementById('flash');
    if (!visitors.length || !flash) return;

    const v = visitors[Math.floor(Math.random() * visitors.length)];
    const rect = v.getBoundingClientRect();
    const hall = document.getElementById('hall');
    if (!hall) return;
    const hallRect = hall.getBoundingClientRect();

    // Skip if the visitor is currently offscreen (animation has them
    // outside the hall bounds). A flash from offscreen looks like a bug.
    if (rect.right < hallRect.left || rect.left > hallRect.right) {
      scheduleNextFlash();
      return;
    }

    const xPct = ((rect.left + rect.width / 2) - hallRect.left) / hallRect.width * 100;
    const yPct = ((rect.top  + rect.height * 0.4) - hallRect.top) / hallRect.height * 100;

    flash.style.setProperty('--flash-x', `${xPct.toFixed(1)}%`);
    flash.style.setProperty('--flash-y', `${yPct.toFixed(1)}%`);

    v.classList.add('is-flashing');
    flash.classList.add('is-firing');

    setTimeout(() => {
      v.classList.remove('is-flashing');
      flash.classList.remove('is-firing');
    }, 460);

    // Optional shutter click — silent by default. Enable only if you
    // want audible feedback; many users find unsolicited audio jarring.
    // playShutter();

    scheduleNextFlash();
  }

  function scheduleNextFlash() {
    // 8–15 second interval per spec
    const delay = 8000 + Math.random() * 7000;
    setTimeout(fireFlash, delay);
  }

  // ─── Traits rendering ──────────────────────────────────────────
  // The build pipeline replaces the contents of <script id="traits-data">
  // with a JSON array of trait objects like:
  //   [{ trait_type: "Background", value: "Gold", rarity: 0.04 }, ...]
  function renderTraits() {
    const host  = document.getElementById('traits');
    const blob  = document.getElementById('traits-data');
    if (!host || !blob) return;

    let traits = [];
    try {
      // Tolerate the unreplaced template placeholder during dev
      const raw = blob.textContent.trim();
      if (!raw || raw.startsWith('{{')) {
        host.innerHTML = '<div class="trait" style="grid-column:1/-1;text-align:center;color:var(--parchment-dim)"><span class="trait__value">No attributes recorded</span></div>';
        return;
      }
      traits = JSON.parse(raw);
    } catch (e) {
      console.warn('ArtID: could not parse traits JSON', e);
      return;
    }

    if (!Array.isArray(traits) || traits.length === 0) {
      host.innerHTML = '<div class="trait" style="grid-column:1/-1;text-align:center;color:var(--parchment-dim)"><span class="trait__value">No attributes recorded</span></div>';
      return;
    }

    host.innerHTML = traits.map(t => {
      const type  = escapeHtml(t.trait_type || t.type || 'Trait');
      const value = escapeHtml(String(t.value ?? ''));
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

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ─── Lightbox ──────────────────────────────────────────────────
  function initLightbox() {
    const art   = document.getElementById('artwork');
    const lb    = document.getElementById('lightbox');
    const lbImg = document.getElementById('lightboxImg');
    const close = document.getElementById('lightboxClose');
    if (!art || !lb || !lbImg) return;

    art.addEventListener('click', () => {
      lbImg.src = art.src;
      lb.classList.add('is-open');
      lb.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    });

    const closeLb = () => {
      lb.classList.remove('is-open');
      lb.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    };
    close && close.addEventListener('click', closeLb);
    lb.addEventListener('click', (e) => { if (e.target === lb) closeLb(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLb(); });
  }

  // ─── Boot ──────────────────────────────────────────────────────
  function boot() {
    spawnVisitors();
    renderTraits();
    initLightbox();

    // Start the flash loop after a brief grace period so visitors
    // have moved into position first.
    setTimeout(scheduleNextFlash, 4000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
