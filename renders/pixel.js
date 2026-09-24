/* ─────────────────────────────────────────────────────────────────────────────
   pixel.js — a software rasteriser, 320 × 180, upscaled with nearest neighbour.

   Every pixel is shaded by hand: a material picks a tone ramp, a light field
   picks the position on that ramp, and a 4×4 Bayer threshold dithers between
   the two nearest tones. That is how real pixel art gets gradients — not by
   blurring, but by choosing which pixel gets the lighter ink. The lamp
   flickers, so the dither threshold moves, and the whole room breathes.
   ─────────────────────────────────────────────────────────────────────────── */
window.RENDER_PIXEL = function (canvas, opts) {
  const world = opts.world, P = window.PAL;
  const S = 2, W = world.W * S, H = world.H * S;      // 320 × 180
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const D = img.data;

  const BAYER = [
    [0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5],
  ].map(r => r.map(v => (v + 0.5) / 16));

  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const RAMPS = {
    night:   [P.ink, P.night, '#0d141d'],
    wall:    [P.ink, '#0c121a', P.wall, P.wallLit, '#3b495a'],
    board:   ['#0a0f15', '#1b232d', P.board, P.boardLit],
    warm:    ['#3a2a17', P.warmDim, '#e0b072', P.warm],
    glass:   [P.night, P.glassDim, '#5d84a6', P.glass],
    door:    ['#04070a', P.door, '#1a242f', '#3d5164'],
    stone:   ['#070a0e', '#0d1319', P.stone, '#232c37'],
    water:   ['#05080c', P.water, '#14212d', '#25404f'],
    paper:   ['#2b2a26', '#8e8676', P.paper, '#fff6e0'],
    accent:  ['#2a1a10', '#8a4c2a', P.accent, '#f0a068'],
  };
  const VESSEL_TONES = [
    { body: ['#263442', '#54718c', '#a8c6e0'] },
    { body: ['#23381f', '#4e7a3c', '#a6d17e'] },
    { body: ['#2c2440', '#5b4c8c', '#b2a2e0'] },
    { body: ['#3a2a14', '#8a5f26', '#e6bb6a'] },
    { body: ['#3d1f2c', '#8c3f5c', '#e890ac'] },
  ];

  // ── the light field: one warm lamp, ambient, and the spill on the street ──
  function lightAt(u, v, t) {
    const flick = 1 + 0.035 * Math.sin(t * 0.006) + 0.02 * Math.sin(t * 0.017 + 1.7);
    const lx = world.lamp.x, ly = world.lamp.y + world.lamp.drop + 2;
    const d2 = (u - lx) * (u - lx) + (v - ly) * (v - ly) * 1.5;
    const lamp = 2.1 * Math.exp(-d2 / 260) * flick;
    const inside = u > world.window.x && u < world.window.x + world.window.w &&
                   v > world.window.y && v < world.window.y + world.window.h;
    const ambient = inside ? 0.42 : 0.16;
    let spill = 0;
    if (v > world.street) {
      const near = Math.max(0, 1 - (v - world.street) / 26);
      const across = Math.max(0, 1 - Math.abs(u - 64) / 62);
      spill = 0.55 * near * across;
    }
    return { L: ambient + lamp + spill, warm: Math.min(1, (lamp + spill) * 0.9) };
  }

  // ── the material at a point in scene units ────────────────────────────────
  const V = opts.plan || [];
  function materialAt(u, v) {
    const f = world.facade, aw = world.awning, wi = world.window, dr = world.door;
    // vessels stand in front of everything inside the glass
    for (const p of V) {
      const hw = world.vessel.w / 2, top = p.y - world.vessel.h;
      // a bottle profile, not a rectangle: shoulder in, neck, cap
      const dy = (v - top) / world.vessel.h;
      const halfNow = dy < 0.14 ? hw * 0.42 : dy < 0.26 ? hw * 0.62 : dy < 0.38 ? hw * 0.86 : hw;
      if (u > p.x - halfNow && u < p.x + halfNow && v > top && v < p.y) {
        const rel = (u - (p.x - halfNow)) / (halfNow * 2);
        const idx = p.ramp % VESSEL_TONES.length;
        const set = VESSEL_TONES[idx];
        if (dy < 0.14) return { ramp: null, fixed: '#4a5a68', bottle: true };            // the cap
        // the label sits on the belly, where a paper label sits
        if (dy > 0.44 && dy < 0.78 && rel > 0.14 && rel < 0.86) return { ramp: 'paper', fixed: null, label: p };
        // glass: a hard bright rim on the lamp side, a dark core, a dim far edge
        const lit = rel < 0.3;
        const hot = rel < 0.14;                                  // the specular, one column wide
        // a one-pixel rim down the far edge. Without it a dark bottle and the dark glass behind
        // it sit at the same value and the silhouette dissolves — which is what the reviewer saw.
        if (rel > 0.9) return { ramp: null, fixed: '#8ea6bd', bottle: true };
        return { ramp: null, fixed: hot ? '#eaf4ff' : (lit ? set.body[2] : (rel > 0.78 ? set.body[1] : set.body[0])), bottle: true };
      }
    }
    // the lamp: a fixture you can see, drawn over the room it lights
    const lp = world.lamp, lby = lp.y + lp.drop;
    if (v > lp.y && v < lby && u > lp.x - lp.shade / 2 && u < lp.x + lp.shade / 2) {
      const t2 = (v - lp.y) / (lby - lp.y);
      if (u > lp.x - lp.shade / 2 * (0.4 + t2) && u < lp.x + lp.shade / 2 * (0.4 + t2)) {
        return { ramp: 'board', fixed: t2 > 0.82 ? '#7d8794' : '#1e2732' };              // the shade
      }
    }
    if (Math.abs(u - lp.x) < 0.9 && v > lp.y - 2.5 && v < lp.y) return { ramp: null, fixed: '#5c6b7a' };  // cord
    if (v >= lby && v < lby + 1.6 && Math.abs(u - lp.x) < 2.2) return { ramp: null, fixed: '#fff3d6' };   // the bulb
    if (u > wi.x && u < wi.x + wi.w && v > wi.y && v < wi.y + wi.h) {
      for (const sy of world.shelves) {
        if (v > sy && v < sy + world.board) return { ramp: 'board' };
        if (v > sy - 0.6 && v < sy) return { ramp: 'board', fixed: '#5b6a7d' };           // lit front lip
      }
      if (v > world.counter && v < world.counter + world.board + 1) return { ramp: 'board' };
      if (u > world.chalk.x && u < world.chalk.x + world.chalk.w &&
          v > world.chalk.y && v < world.chalk.y + world.chalk.h) return { ramp: 'door' };
      return { ramp: 'wall' };                                       // the lit back wall
    }
    if (u > dr.x && u < dr.x + dr.w && v > dr.y && v < dr.y + dr.h) {
      if (v < dr.y + world.lamp.drop + 10 && u > dr.x + 3 && u < dr.x + dr.w - 3) return { ramp: 'glass' };
      return { ramp: 'door' };
    }
    if (u > aw.x && u < aw.x + aw.w && v > aw.y && v < aw.y + aw.h) {
      const stripe = Math.floor((u - aw.x) / 4.6) % 2 === 0;
      return stripe ? { ramp: 'accent' } : { ramp: 'door' };
    }
    if (v > world.awningShadow.y && v < world.awningShadow.y + world.awningShadow.h &&
        u > f.x && u < f.x + f.w) return { ramp: 'night', fixed: '#0a0f16' };   // under the awning
    if (v > f.y && v < f.y + f.h && u > f.x && u < f.x + f.w) return { ramp: 'wall' };
    if (v >= world.street) return { ramp: v > world.street + 10 ? 'water' : 'stone' };
    // neighbouring buildings, with a window or two lit
    const col = Math.floor(u / 6) * 6, row = Math.floor(v / 7) * 7;
    if (((col * 7 + row * 13) % 11) === 0 && v < world.street) return { ramp: 'warm', fixed: '#6b5334' };
    return { ramp: 'night' };
  }

  function rampPick(tones, L, dith) {
    const n = tones.length;
    const x = Math.max(0, Math.min(1, L)) * (n - 1);
    const i = Math.floor(x);
    // full Bayer strength only in the middle of the ramp; in the darkest tone the dither reads as
    // film grain over nothing, which is what made the first pass muddy
    const strength = i === 0 ? 0.25 : 0.85;
    const useUp = (x - i) > (0.5 + (dith - 0.5) * strength);
    return tones[Math.min(n - 1, i + (useUp ? 1 : 0))];
  }

  let raf = 0;
  function draw(t) {
    for (let py = 0; py < H; py++) {
      const v = py / S + 0.5 / S;
      for (let px = 0; px < W; px++) {
        const u = px / S + 0.5 / S;
        const m = materialAt(u, v);
        const { L, warm } = lightAt(u, v, t);
        const dith = BAYER[py & 3][px & 3];
        let rgb;
        if (m.fixed) {
          const base = hex(m.fixed);
          const k = 0.45 + L * 0.75;
          rgb = [base[0] * k + warm * 90, base[1] * k + warm * 60, base[2] * k + warm * 24];
        } else {
          rgb = hex(rampPick(RAMPS[m.ramp] || RAMPS.wall, L, dith));
        }
        if (m.bottle) rgb = rgb.map(c => c * (0.85 + L * 0.5));
        const o = (py * W + px) * 4;
        D[o] = rgb[0]; D[o + 1] = rgb[1]; D[o + 2] = rgb[2]; D[o + 3] = 255;
      }
    }
    // rain: one pixel wide, in the street only, so the shop stays dry inside
    for (let i = 0; i < 90; i++) {
      const x = (i * 97) % W;
      const y = ((t * 0.22 + i * 37) % (H - world.street * S)) + world.street * S;
      const o = (Math.floor(y) * W + x) * 4;
      if (D[o] !== undefined) { D[o] = 150; D[o + 1] = 170; D[o + 2] = 190; }
    }
    // the window's reflection in the wet pavement, flipped and dithered down
    const wy = world.window.y * S, wh = (world.street - world.window.y) * S;
    for (let y = 0; y < wh; y++) {
      for (let x = 0; x < world.window.w * S; x++) {
        const sy = world.street * S + y * 1.35;
        if (sy >= H) continue;
        const sx = world.window.x * S + x;
        const src = ((world.street * S - 1 - y * 0.6) * W + sx) * 4;
        if (src < 0) continue;
        const o = (Math.floor(sy) * W + sx) * 4;
        D[o] = D[o] * 0.62 + D[src] * 0.3;
        D[o + 1] = D[o + 1] * 0.62 + D[src + 1] * 0.3;
        D[o + 2] = D[o + 2] * 0.62 + D[src + 2] * 0.3;
      }
    }
    ctx.putImageData(img, 0, 0);

    // labels last, at low resolution, so the type is pixel type
    ctx.imageSmoothingEnabled = false;
    ctx.font = '5px ui-monospace, monospace';
    ctx.textAlign = 'center';
    for (const p of V) {
      if (!p.label) continue;
      const lx = p.x * S, ly = (p.y - 3) * S;
      if (p.frame && p.frame.complete && p.frame.naturalWidth) {
        ctx.globalAlpha = 0.95;
        ctx.drawImage(p.frame, lx - 8, ly - 8, 16, 16);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = P.paper;
      ctx.font = '5px ui-monospace, monospace';
      ctx.fillText(p.glyphs || '', lx, (p.y + 3.4) * S);
    }
    ctx.fillStyle = P.warm;
    ctx.font = '7px Georgia, serif';
    ctx.fillText('THE FORMULARY', (world.sign.x + world.sign.w / 2) * S, (world.sign.y + 4.6) * S);

  }
  // A tick draws exactly one frame on demand. rAF never fires in a backgrounded tab (and is
  // suppressed under reduced motion), which is how this first rendered as three black canvases.
  const loop = (now) => { draw(now - t0); raf = requestAnimationFrame(loop); };
  const t0 = performance.now();
  raf = requestAnimationFrame(loop);
  return { stop() { cancelAnimationFrame(raf); }, tick: (t = 0) => draw(t) };
};
