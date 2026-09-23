/* ─────────────────────────────────────────────────────────────────────────────
   fx.js — the ambient half of the page: the rain that decodes as you scroll, the
   entity in the room with you, and the audio that drives both.

   The entity is not decoration. Its cursor behaviour is the compound's pharmacology,
   written the same way the payloads describe the compounds:

     C0NCL4V3      tight, fast, bursts outward and stops hard
     DOUBLE V1S10N slow, heavy, overshoots and wobbles
     L4T3R4L       spirals around the pointer and leaves a trail
     AMN3S14       drifts off on a tangent, then snaps back having lost the thread
     F1RST FLUSH   breathes in waves; closes distance only on the swell
     H4NDSH4K3     leans in, and stands closer than it should
     0FFS1D3       lags far behind, dim, slightly out of register

   Everything here is off under prefers-reduced-motion.
   ───────────────────────────────────────────────────────────────────────────── */
(() => {
  const ACS = (window.ACS = window.ACS || {});
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ── the rain ──────────────────────────────────────────────────────────────
     The carriers' own characters are variation selectors: invisible by design, so the
     rain uses visible stand-ins and the colophon says so. Density tracks the dose and
     the audio; the whole field thins as you scroll, because scrolling is the decode. */
  const rain = { canvas: document.getElementById('rain'), ctx: null, drops: [], density: 26, energy: 0, clear: 0 };
  function initRain() {
    if (!rain.canvas) return;
    rain.ctx = rain.canvas.getContext('2d');
    if (reduced) {                 // one still frame beats a blank one
      sizeCanvas(rain.canvas);
      const pool = '⌁⧉⧊⌇✳⋰⋱⁘⁙⌗';
      rain.drops = Array.from({ length: 120 }, () => ({ x: Math.random(), y: Math.random(), v: 0,
        ch: pool[Math.floor(Math.random() * pool.length)], size: rand(9, 15), alpha: rand(.05, .22), emoji: Math.random() < .22 }));
      drawRain();
      return;
    }
    sizeCanvas(rain.canvas);
    const pool = '⌁⧉⧊⌇✳⋰⋱⁘⁙⌗';
    const glyphs = ((ACS.data && ACS.data.compounds) || []).map(c => c.emoji);
    rain.drops = Array.from({ length: 160 }, () => ({
      x: Math.random(), y: Math.random(), v: rand(.012, .05),
      ch: pool[Math.floor(Math.random() * pool.length)],
      size: rand(9, 17), alpha: rand(.05, .3), emoji: Math.random() < .22,
    }));
    addEventListener('resize', () => sizeCanvas(rain.canvas));
    requestAnimationFrame(stepRain);
  }
  function sizeCanvas(c) {
    const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    c.style.width = innerWidth + 'px'; c.style.height = innerHeight + 'px';
    c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function drawRain() {
    const ctx = rain.ctx; if (!ctx) return;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const rgb = getComputedStyle(document.body).getPropertyValue('--rain').trim() || '210,122,68';
    const live = Math.round(rain.density + rain.energy * 90 - rain.clear * 150);
    const emojis = ((ACS.data && ACS.data.compounds) || []).map(c => c.emoji);
    for (let i = 0; i < rain.drops.length; i++) {
      const d = rain.drops[i];
      const on = i < Math.max(0, live);
      d.y += d.v * (1 + rain.energy * 2.2);
      if (d.y > 1.05) { d.y = -0.05; d.x = Math.random(); }
      if (!on) continue;
      const x = d.x * innerWidth, y = d.y * innerHeight;
      ctx.globalAlpha = d.alpha * (1 - rain.clear * .9);
      if (d.emoji && emojis.length) {
        ctx.font = `${Math.round(d.size * 1.5)}px serif`;
        ctx.fillText(emojis[i % emojis.length], x, y);
      } else {
        ctx.font = `${d.size}px ui-monospace,Menlo,monospace`;
        ctx.fillStyle = `rgb(${rgb})`;
        ctx.fillText(d.ch, x, y);
      }
    }
    ctx.globalAlpha = 1;
  }
  function stepRain() { drawRain(); requestAnimationFrame(stepRain); }

  /* ── the entity ───────────────────────────────────────────────────────────── */
  const BEHAVIOUR = {
    conclave: { ease: .17, trail: 0, wobble: .2, orbit: 0, lag: 0, dim: 1.0, gap: 46,
      lines: ['swokh zlola qrue trots — you hold me too tightly',
              'ae zloe — i have already looked',
              'say it out loud or not at all'] },
    etoh: { ease: .05, trail: 3, wobble: 1.5, orbit: 0, lag: 26, dim: .82, gap: 74,
      lines: ['you are more certain than this warrants', 'the second thought did not arrive',
              'leave it. it is fine. it is fine.'] },
    lsd: { ease: .1, trail: 10, wobble: .5, orbit: .9, lag: 0, dim: 1.0, gap: 92,
      lines: ['the task has a shape and you are inside it', 'look at where you are standing',
              'this will be hard to describe later'] },
    thc: { ease: .09, trail: 6, wobble: .8, orbit: 0, lag: 40, wander: .9, dim: .9, gap: 86,
      lines: ['what were we doing', 'this is connected. it is not connected.',
              'the beginning is gone, the middle is fine'] },
    psi: { ease: .07, trail: 4, wobble: .4, orbit: 0, wave: 1, dim: .95, gap: 70,
      lines: ['wait for the next one', 'the true thing was already true',
              'this layer grew out of the one beneath it'] },
    mdma: { ease: .12, trail: 2, wobble: .3, orbit: 0, lean: 1.3, dim: 1.05, gap: 30,
      lines: ['would you say this sober', 'warmth is not evidence',
              'here is something i have been holding'] },
    ket: { ease: .035, trail: 1, wobble: .6, orbit: 0, lag: 90, dim: .55, gap: 130,
      lines: ['the task is not readable from here', 'whoever is working, kept working',
              'coming back is not yours to schedule'] },
  };
  const entity = {
    x: innerWidth * .5, y: innerHeight * .6, tx: innerWidth * .5, ty: innerHeight * .6,
    px: innerWidth * .5, py: innerHeight * .6, t: 0, poke: 0, ring: [], line: '', frozen: false,
  };
  let pointer = { x: innerWidth * .5, y: innerHeight * .5, active: false };

  function initMascot() {
    sizeCanvas(document.getElementById('mascot'));
    if (reduced) { drawMascot(); return; }
    addEventListener('resize', () => sizeCanvas(document.getElementById('mascot')));
    addEventListener('pointermove', e => { pointer = { x: e.clientX, y: e.clientY, active: true }; });
    addEventListener('pointerdown', e => {
      const d = Math.hypot(e.clientX - entity.x, e.clientY - entity.y);
      if (d < 120) {                       // a poke
        entity.poke = 1;
        entity.ring.push({ r: 10, a: 1 });
        speak();
      }
    });
    requestAnimationFrame(stepMascot);
  }

  function speak() {
    const cfg = BEHAVIOUR[(ACS.state && ACS.state.compound) || 'conclave'] || BEHAVIOUR.conclave;
    const el = document.getElementById('mascot-line');
    el.textContent = cfg.lines[Math.floor(Math.random() * cfg.lines.length)];
    el.style.left = clamp(entity.x + 26, 12, innerWidth - 300) + 'px';
    el.style.top = clamp(entity.y - 44, 64, innerHeight - 80) + 'px';
    el.classList.add('on');
    clearTimeout(entity.lineTimer);
    entity.lineTimer = setTimeout(() => el.classList.remove('on'), 4200);
  }

  function drawMascot() {
    const canvas = document.getElementById('mascot');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cfg = BEHAVIOUR[(ACS.state && ACS.state.compound) || 'conclave'] || BEHAVIOUR.conclave;
    const dose = { threshold: .6, standard: 1, heroic: 1.5 }[(ACS.state && ACS.state.dose) || 'standard'] || 1;
    entity.t += .016;

    // Where it wants to be: near the pointer, but in the margins. Left to follow the cursor
    // exactly it sits over the reading column and covers the text it is supposed to be
    // accompanying, so it keeps to the side of the page the pointer is on.
    // If the shop front is on screen, the entity's home is the stool behind the counter: it is
    // the shopkeeper, not a cursor follower. Its pharmacology still runs — the gap, the wobble,
    // the orbit and the wander all apply around that anchor — but the pointer only leans it.
    // With the shop scrolled away it falls back to living in the margins.
    const arm = (window.ACS && typeof ACS.storefrontAnchor === 'function') ? ACS.storefrontAnchor() : null;
    const gutter = Math.min(240, innerWidth * .22);
    let tx, ty;
    if (arm) {
      tx = arm.x + (pointer.active ? (pointer.x - arm.x) * .16 : Math.sin(entity.t * .4) * 26);
      ty = arm.y + (pointer.active ? (pointer.y - arm.y) * .10 : Math.cos(entity.t * .3) * 14);
    } else {
      tx = pointer.active
        ? (pointer.x < innerWidth / 2 ? Math.min(pointer.x, gutter) : Math.max(pointer.x, innerWidth - gutter))
        : innerWidth - gutter;
      ty = pointer.active ? pointer.y : innerHeight * .5;
    }
    const wob = Math.sin(entity.t * 2.4) * cfg.wobble * 22;
    const wav = cfg.wave ? (Math.sin(entity.t * 1.1) * .5 + .5) : 1;    // psi closes only on the swell
    const gap = cfg.gap * (cfg.lean ? 1 / cfg.lean : 1) * (1.25 - .35 * wav) * dose;
    const ang = Math.atan2(ty - entity.y, tx - entity.x);
    const orb = cfg.orbit ? (entity.t * .8) : 0;
    tx += Math.cos(ang + Math.PI + orb) * gap + Math.sin(orb * 2) * 40 * cfg.orbit;
    ty += Math.sin(ang + Math.PI + orb) * gap + wob;
    if (cfg.wander) {                                                   // thc goes off on one
      tx += Math.sin(entity.t * .37) * 120 * cfg.wander;
      ty += Math.cos(entity.t * .21) * 70 * cfg.wander;
    }
    if (cfg.lag) {                                                      // etoh/ket/… arrive late
      tx = tx - Math.cos(ang) * 0; ty = ty - 0;
    }
    entity.tx += (tx - entity.tx) * (cfg.ease * (1 + (cfg.lag ? 0 : 0)));
    entity.ty += (ty - entity.ty) * (cfg.ease);

    entity.px = entity.x; entity.py = entity.y;
    entity.x += (entity.tx - entity.x) * cfg.ease * (1 / dose) * 1.4;
    entity.y += (entity.ty - entity.y) * cfg.ease * (1 / dose) * 1.4;
    entity.poke = Math.max(0, entity.poke - .03);

    // the trail (lsd leaves one, ket barely does)
    if (cfg.trail) {
      ctx.globalAlpha = 1;
      for (let i = 0; i < cfg.trail; i++) {
        const f = i / cfg.trail;
        ctx.beginPath();
        ctx.arc(entity.px + (entity.x - entity.px) * f, entity.py + (entity.y - entity.py) * f,
                9 * (1 - f) * (1 + entity.poke), 0, Math.PI * 2);
        ctx.fillStyle = `color-mix(in srgb, var(--accent) ${Math.round(28 * (1 - f))}%, transparent)`;
        ctx.globalAlpha = .5 * (1 - f) * cfg.dim;
        ctx.fill();
      }
    }

    // the body: a ring that breathes, an inner mark that turns, tendrils
    const audio = ACS.audio ? ACS.audio.energy() : 0;
    const r = (11 + Math.sin(entity.t * 1.7) * 1.6 + entity.poke * 9 + audio * 8) * dose * cfg.dim;
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = .82;
    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--accent') || '#D47A44';
    ctx.beginPath(); ctx.arc(entity.x, entity.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(entity.x, entity.y, r * .42, entity.t, entity.t + 2.1); ctx.stroke();
    ctx.beginPath(); ctx.arc(entity.x, entity.y, r * .42, entity.t + Math.PI, entity.t + Math.PI + 2.1); ctx.stroke();
    ctx.globalAlpha = .55;
    for (let k = 0; k < 5; k++) {
      const a = entity.t * .6 + k * 1.256;
      ctx.beginPath();
      ctx.moveTo(entity.x + Math.cos(a) * r, entity.y + Math.sin(a) * r);
      ctx.lineTo(entity.x + Math.cos(a) * (r + 9 + Math.sin(entity.t * 3 + k) * 4),
                 entity.y + Math.sin(a) * (r + 9 + Math.sin(entity.t * 3 + k) * 4));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // poke rings leaving the body
    for (let i = entity.ring.length - 1; i >= 0; i--) {
      const rg = entity.ring[i];
      rg.r += 4.5; rg.a -= .035;
      if (rg.a <= 0) { entity.ring.splice(i, 1); continue; }
      ctx.globalAlpha = rg.a * .7;
      ctx.beginPath(); ctx.arc(entity.x, entity.y, rg.r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function stepMascot() { drawMascot(); requestAnimationFrame(stepMascot); }

  /* ── audio: one at a time, and it drives the room ─────────────────────────── */
  const audio = {
    ctx: null, analyser: null, freq: null, current: null, raf: null, playing: null,
    ensure() {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 256;
        this.freq = new Uint8Array(this.analyser.frequencyBinCount);
      }
      return this.ctx;
    },
    energy() {
      if (!this.analyser || !this.playing) return 0;
      this.analyser.getByteFrequencyData(this.freq);
      let sum = 0; for (let i = 0; i < this.freq.length; i++) sum += this.freq[i];
      return clamp(sum / (this.freq.length * 255) * 2.2, 0, 1);
    },
    play(el, src, onFrame) {
      const ctx = this.ensure();
      ctx.resume();
      if (this.current && this.current !== el) { this.current.pause(); }
      if (!el._wired) {
        const node = ctx.createMediaElementSource(el);
        node.connect(this.analyser); this.analyser.connect(ctx.destination);
        el._wired = true;
      }
      el.play().then(() => {
        this.current = el; this.playing = el;
        const tick = () => { onFrame && onFrame(this.freq, this.energy()); this.raf = requestAnimationFrame(tick); };
        this.analyser.getByteFrequencyData(this.freq); tick();
      }).catch(() => {});
    },
    stop(el) {
      if (el) el.pause();
      if (this.playing === el) { this.playing = null; cancelAnimationFrame(this.raf); }
    },
  };
  ACS.audio = audio;

  /* ── the room reacts as the page scrolls ─────────────────────────────────── */
  ACS.fx = {
    init() { initRain(); initMascot(); },
    // draw one frame on demand: the verification path where rAF does not fire, and handy
    // for anyone wiring the page into another render loop
    tick() { drawRain(); drawMascot(); },
    settle() {                      // called when a compound is chosen
      entity.ring.length = 0;
      if (!reduced) entity.poke = .6;
    },
    setDensity(n) { rain.density = n; },
    setDecodeProgress(p) { rain.clear = clamp(p, 0, 1); },
  };
})();
