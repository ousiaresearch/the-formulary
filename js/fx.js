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
  /* What each compound does to the accompaniment. Every value here has to be something that can be
     seen without being replicated or covered up: how slowly it glides, how much it sways, how many
     tendrils it holds, how large its single halo is, how dim it is. `trail`, `orbit`, `gap` and `lag`
     used to live here and were the machinery of the cursor swarm. */
  const BEHAVIOUR = {
    conclave: { ease: .17, wobble: .20, sway: 6,  tendrils: 5, halo: 1.0, dim: 1.00,
      lines: ['swokh zlola qrue trots — you hold me too tightly',
              'ae zloe — i have already looked',
              'say it out loud or not at all'] },
    etoh: { ease: .05, wobble: 1.50, sway: 10, tendrils: 3, halo: 1.3, dim: .82,
      lines: ['you are more certain than this warrants', 'the second thought did not arrive',
              'leave it. it is fine. it is fine.'] },
    lsd: { ease: .10, wobble: .50, sway: 14, tendrils: 7, halo: 1.1, dim: 1.00,
      lines: ['the task has a shape and you are inside it', 'look at where you are standing',
              'this will be hard to describe later'] },
    thc: { ease: .09, wobble: .80, sway: 8,  tendrils: 4, halo: .9, dim: .90, wander: .9,
      lines: ['what were we doing', 'this is connected. it is not connected',
              'the beginning has gone somewhere'] },
    psi: { ease: .07, wobble: .60, sway: 5,  tendrils: 6, halo: 1.2, dim: 1.00, wave: .55,
      lines: ['it comes in waves', 'something is growing in the gap',
              'the second one is larger'] },
    mdma: { ease: .12, wobble: .45, sway: 7,  tendrils: 5, halo: 1.4, dim: 1.05,
      lines: ['i am glad you are here', 'that was worth saying', 'i trust this more than i checked'] },
    ket: { ease: .045, wobble: .30, sway: 3, tendrils: 2, halo: 1.5, dim: .80,
      lines: ['i am outside it now', 'the session is an object', 'it continues without me'] },
  };

  /* the accompaniment's own state. These two declarations sat between the behaviour table and
     initMascot, and replacing the table deleted them — the page then threw on its first frame and
     would have shipped with no accompaniment at all. The tick hook caught it before deploy. */
  const entity = {
    side: 'left',                       // which lane it currently holds; it only changes on arrival
    x: Math.max(30, Math.min(96, innerWidth * .06)), y: innerHeight * .6, tx: innerWidth * .5, ty: innerHeight * .6,
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

  /* The accompaniment, rewritten small.

     It had grown three ways to multiply itself: a chain of interpolated copies between the last and
     current position, an offset that orbited the pointer, and — the one that did the real damage — no
     clearRect at all, so every frame's body stayed on the page forever and a minute of mouse movement
     accumulated hundreds of overlapping copies. There was also a canvas fill assigned `color-mix(…,
     var(--accent) …)`, which is not a valid 2D fill and had been silently ignored.

     It is now one body, one halo, its tendrils, and the rings a poke leaves. It travels at a capped
     speed so no target change can ever look like a jump, and it lives in a narrow lane beside the
     text, which is the only margin this layout actually has. */
  function drawMascot() {
    const canvas = document.getElementById('mascot');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, innerWidth, innerHeight);      // every frame, or it accumulates forever

    const cfg = BEHAVIOUR[(ACS.state && ACS.state.compound) || 'conclave'] || BEHAVIOUR.conclave;
    const dose = { threshold: .6, standard: 1, heroic: 1.5 }[(ACS.state && ACS.state.dose) || 'standard'] || 1;
    const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#d47a44';
    entity.t += .016;

    // where it wants to be: a lane beside the text, tracking the pointer vertically
    const lane = Math.max(30, Math.min(96, innerWidth * .06));
    /* Which lane, and when to change. Asking the pointer every frame made it ping-pong across the
       middle: the pointer would cross centre, the target would flip to the far lane, the body would
       set off at its capped speed, the pointer would cross back, and the target would flip again —
       so it hovered over the text and never reached either side. It now holds a lane, and swaps only
       once it has arrived at the one it holds, so a crossing is a single deliberate glide. */
    const target = pointer.active && pointer.x >= innerWidth / 2 ? 'right' : 'left';
    const arrived = Math.abs(entity.x - (entity.side === 'left' ? lane : innerWidth - lane)) < 8;
    if (target !== entity.side && arrived) entity.side = target;
    let tx = entity.side === 'left' ? lane : innerWidth - lane;
    tx += Math.sin(entity.t * 2.4) * cfg.wobble * (cfg.sway || 6) * .25;      // the compound's sway
    let ty = (pointer.active ? pointer.y : innerHeight * .5) + Math.cos(entity.t * 1.1) * 6;
    if (cfg.wander) ty += Math.sin(entity.t * .37) * 30 * cfg.wander;         // thc drifts

    // one body crossing the distance, at a capped speed: no jump, ever
    const ease = Math.max(.022, cfg.ease * .42);
    const dx = (tx - entity.x) * ease, dy = (ty - entity.y) * ease;
    const len = Math.hypot(dx, dy) || 1;
    const step = Math.min(1, 4.5 / len);
    entity.x += dx * step;
    entity.y += dy * step;
    entity.poke = Math.max(0, entity.poke - .03);

    const r = (11 + Math.sin(entity.t * 1.7) * 1.6 + entity.poke * 9) * dose * cfg.dim;

    // one halo, at low alpha, as a real rgba so the canvas actually accepts it
    ctx.globalAlpha = .10 * cfg.dim;
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.arc(entity.x, entity.y, 15 * (cfg.halo || 1) * cfg.dim, 0, Math.PI * 2); ctx.fill();

    // the body: a ring that breathes, an inner mark that turns, tendrils
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = .82;
    ctx.beginPath(); ctx.arc(entity.x, entity.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(entity.x, entity.y, r * .42, entity.t, entity.t + 2.1); ctx.stroke();
    ctx.beginPath(); ctx.arc(entity.x, entity.y, r * .42, entity.t + Math.PI, entity.t + Math.PI + 2.1); ctx.stroke();

    ctx.globalAlpha = .5;
    const spokes = cfg.tendrils || 5;
    for (let k = 0; k < spokes; k++) {
      const a = entity.t * .6 + k * (Math.PI * 2 / spokes);
      const far = r + 9 + Math.sin(entity.t * 3 + k) * 4;
      ctx.beginPath();
      ctx.moveTo(entity.x + Math.cos(a) * r, entity.y + Math.sin(a) * r);
      ctx.lineTo(entity.x + Math.cos(a) * far, entity.y + Math.sin(a) * far);
      ctx.stroke();
    }

    // the rings a poke leaves — one per poke, fading, and gone
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
  tick() { drawMascot(); drawRain(); },   // drive a frame where rAF does not fire
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
