/* ─────────────────────────────────────────────────────────────────────────────
   hero-shop.js — the storefront's hero, drawn by the ink-and-cel canvas shop.

   The SVG shop front that used to live here was hand-built from absolutely positioned
   elements: a façade, an awning, a counter, seven vessels placed by measurement. It worked, but
   every element was its own little layout problem, and it had no way to animate a character
   inside it. This replaces it with the renderer that has been developed since: one scene
   described once in scene units, drawn as flat cel shapes with real ink, with the mascot from
   the sprite sheets standing behind the counter where the robot used to be.

   What is deliberately NOT replaced: the page's own machinery. The shelf list, the decode
   bench, the carrier payload in the markup, the dose control, the rain — all of that stays
   exactly as it was. This module only owns the picture, and talks to the page through the two
   hooks it already had: ACS.state (dose, taken) and ACS.select (take a vessel to the counter).

   The art is not copied in here. The renderer stack is loaded from ../renders/ so there is one
   source of truth for the bottles, the props, the frames and the poses.
   ───────────────────────────────────────────────────────────────────────────── */
(() => {
  const ACS = (window.ACS = window.ACS || {});
  const DOSE_WORD = { threshold: 'one', standard: 'two', heroic: 'three' };
  const pointer = { x: 0.5, y: 0.5, active: false };
  const frames = {};

  let canvas = null, renderer = null, opts = null, rafId = null, tries = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const compounds = () => (window.ACS_DATA && window.ACS_DATA.compounds) || [];
  const dose = () => (ACS.state && ACS.state.dose) || 'standard';
  const plan = () => window.WORLD.plan(compounds(), ACS.state && ACS.state.compound);
  const accent = () => getComputedStyle(document.documentElement)
    .getPropertyValue('--accent').trim() || '#c8763c';

  /* The label artefacts, decoded from the data URLs the compiler wrote. Data URLs because a
     file:// image drawn into a canvas taints it, and a tainted canvas cannot be measured. */
  async function loadFrames() {
    const DATAURLS = window.FRAME_DATA || {};
    await Promise.all(compounds().map(c => new Promise(res => {
      const src = (DATAURLS[c.key] || {})[dose()];
      if (!src) return res();
      const img = new Image();
      img.onload = () => { frames[c.key] = img; res(); };
      img.onerror = () => res();
      img.src = src;
    })));
  }

  /* The scene is 220x124. Sized from WIDTH, the shop came out 676px tall and the counter — with
     the resident behind it — fell below the fold, so the one thing this change is about was
     invisible on load. It is sized from HEIGHT here instead: as tall as the viewport allows,
     never wider than the column, always at the scene's own 16:9 so nothing is squashed. */
  function sizeCanvas() {
    const W = window.WORLD;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const column = canvas.parentElement.clientWidth || window.innerWidth;
    const byHeight = Math.min(window.innerHeight * 0.66, 900);
    const h = Math.min(byHeight, column * (W.H / W.W));
    const w = h * (W.W / W.H);
    canvas.style.width = Math.round(w) + 'px';
    canvas.style.height = Math.round(h) + 'px';
    canvas.style.margin = '0 auto';
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }

  function build() {
    const shop = document.getElementById('shop');
    if (!shop) return false;
    shop.classList.add('shop-canvas');
    shop.innerHTML =
      '<canvas id="shop-canvas" role="img" aria-label="the shop front, drawn in ink and flat ' +
      'cel tones: a lit window, shelves of vessels, a counter, and the shop\u2019s resident behind ' +
      'it following your pointer"></canvas>' +
      '<div class="shop-hint"><span class="label">hover a vessel \u00b7 click to take it to the ' +
      'counter</span></div>';
    canvas = document.getElementById('shop-canvas');
    sizeCanvas();

    const list = compounds();                       // the array, not the function that returns it
    opts = {
      world: window.WORLD,
      plan: plan(),
      doseWord: DOSE_WORD[dose()],
      compound: (ACS.state && ACS.state.compound) ||
                (list.length ? list[list.length - 1].key : null),
      accent: accent(),
      pointer,
    };
    renderer = window.RENDER_INK(canvas, opts);
    return !!renderer;
  }

  function frame(ts) {
    if (!renderer) return;
    renderer.tick(ts);
    if (reduced) return;                      // one frame is the whole animation, then
    rafId = requestAnimationFrame(frame);
  }
  function start() {
    if (rafId) cancelAnimationFrame(rafId);
    if (reduced) { renderer && renderer.tick(1200); return; }
    rafId = requestAnimationFrame(frame);
  }
  function stop() { if (rafId) cancelAnimationFrame(rafId); rafId = null; }

  /* Which vessel is under a point, in scene units — the same test the comparison page used. */
  function vesselAt(px, py) {
    const W = window.WORLD, V = W.vessel;
    const u = px * W.W, v = py * W.H;
    return plan().find(p => Math.abs(u - p.x) < V.w / 2 + 2 && v > p.y - V.h && v < p.y + 2) || null;
  }

  function say(key) {
    const c = compounds().find(x => x.key === key);
    const hint = document.getElementById('vessel-hint');
    const state = document.getElementById('hero-state');
    if (!c) return;
    if (hint) hint.textContent = `${c.name} \u2014 ${c.klass}. ${c.oneLine}`;
    if (state && !state.dataset.scrolled) state.textContent = `on the shelf: ${c.name}`;
  }

  function wire() {
    canvas.addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect();
      pointer.x = (e.clientX - r.left) / r.width;
      pointer.y = (e.clientY - r.top) / r.height;
      pointer.active = true;
      if (window.MASCOT) window.MASCOT.interact();
      const hit = vesselAt(pointer.x, pointer.y);
      // hovering a compound changes what the resident is like, not just what the page says
      opts.compound = hit ? hit.key : (ACS.state.compound || opts.compound);
      if (hit) say(hit.key);
      if (reduced && renderer) renderer.tick(1200);
    });
    canvas.addEventListener('pointerleave', () => {
      pointer.active = false;
      opts.compound = ACS.state.compound || opts.compound;
    });
    canvas.addEventListener('click', e => {
      const r = canvas.getBoundingClientRect();
      const hit = vesselAt((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
      if (!hit) return;
      // the page owns what "taken" means: it lights the shelf row, opens the entry, keeps state
      if (ACS.select) ACS.select(hit.key, { disclose: true, scroll: false });
      opts.plan = plan();
      opts.compound = hit.key;
      if (window.MASCOT) window.MASCOT.took();     // it holds the bottle up to you
      renderer && renderer.tick(performance.now());
      if (reduced) renderer && renderer.tick(performance.now());
    });
    // a dose was chosen elsewhere on the page: the label artefact changes with it
    addEventListener('acs:dosechange', async () => {
      opts.doseWord = DOSE_WORD[dose()];
      opts.plan = plan();
      await loadFrames();
      window.SPRITES.init(frames, dose());
      if (window.MASCOT) window.MASCOT.rang();     // it rings the bell
      renderer && renderer.tick(performance.now());
    });
    addEventListener('resize', () => {
      if (!canvas) return;
      sizeCanvas();
      renderer && renderer.tick(performance.now());
      if (!reduced && !rafId) start();
    });
    // a backgrounded tab gets no rAF at all; draw on demand rather than showing nothing
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else { start(); renderer && renderer.tick(performance.now()); }
    });
  }

  /* An async init that throws reports nothing useful: the rejection is silent and the page just
     looks empty. Every failure here writes what went wrong into the DOM, where it can be read. */
  function fail(where, err) {
    const msg = `${where}: ${err && err.message ? err.message : err}`;
    window.__heroError = msg + (err && err.stack ? '\n' + err.stack.split('\n').slice(0, 3).join('\n') : '');
    const shop = document.getElementById('shop');
    if (shop && !shop.querySelector('.hero-error')) {
      const p = document.createElement('p');
      p.className = 'label hero-error';
      p.style.cssText = 'color:#e08a6a;padding:1rem 0';
      p.textContent = 'the shop could not be drawn — ' + msg;
      shop.appendChild(p);
    }
    return false;
  }

  async function init() {
    try {
      if (!window.RENDER_INK || !window.WORLD || !window.SPRITES || !window.MASCOT)
        return fail('missing modules', new Error(
          ['RENDER_INK', 'WORLD', 'SPRITES', 'MASCOT'].filter(k => !window[k]).join(', ')));
      if (!build()) return fail('build', new Error('no renderer or no #shop'));
      wire();
      await loadFrames();
      try { window.SPRITES.init(frames, dose()); } catch (e) { return fail('SPRITES.init', e); }
      await window.SPRITES.loadGenerated(window.GEN_SPRITES || {});
      // the hero draws the resident about 75px tall. Given the 239px sheet it would be a 3.2x
      // non-integer downscale and the pixel blocks smear into mud; given the x3 set it is 1:1.
      await window.MASCOT.load(window.MASCOT_DATA_HERO || window.MASCOT_DATA);
      renderer.tick(1200);
      start();
      window.__heroShop = { renderer, opts, canvas, plan };
      document.documentElement.dataset.heroShop = 'canvas';
      return true;
    } catch (err) {
      return fail('init', err);
    }
  }

  ACS.storefront = { init, plan, vesselAt, get canvas() { return canvas; } };

  /* app.js boots after this file and owns ACS.state / ACS.select, so wait for it rather than
     assuming an order. Bounded: if it never arrives, leave the SVG-free hero empty. */
  function whenReady() {
    const ok = window.ACS_DATA && ACS.state && ACS.select && document.getElementById('shop') &&
               window.WORLD && window.RENDER_INK && window.MASCOT;
    if (ok) { init(); return; }
    if (++tries > 60) return;
    setTimeout(whenReady, 50);
  }
  document.readyState === 'loading'
    ? addEventListener('DOMContentLoaded', whenReady)
    : whenReady();
})();
