/* ─────────────────────────────────────────────────────────────────────────────
   real.js — the atmospheric pass. Not photoreal, but physically motivated:
   the scene is drawn once as flat materials, then lit by three light sources,
   then composited — multiply for the light, add for the specular and the bloom,
   plus contact shadow, a blurred reflection in the wet street, grain, vignette.
   The lamp is the only real source; everything else is bounce.
   ─────────────────────────────────────────────────────────────────────────── */
window.RENDER_REAL = function (canvas, opts) {
  const world = opts.world, P = window.PAL, A = opts.accent || P.accent;
  const DPR = Math.min(2, devicePixelRatio || 1);
  let VW = 0, VH = 0, k = 1, oy = 0;
  const mk = () => document.createElement('canvas');
  const albedo = mk(), light = mk(), blur = mk();
  let actx, lctx, bctx;
  [[albedo, 'actx'], [light, 'lctx'], [blur, 'bctx']].forEach(([c]) => { c.getContext('2d'); });

  function size() {
    const r = canvas.getBoundingClientRect();
    VW = Math.round(r.width); VH = Math.round(r.height);
    canvas.width = Math.round(VW * DPR); canvas.height = Math.round(VH * DPR);
    for (const c of [albedo, light, blur]) { c.width = canvas.width; c.height = canvas.height; }
    actx = albedo.getContext('2d'); lctx = light.getContext('2d'); bctx = blur.getContext('2d');
    k = Math.min(VW / world.W, VH / world.H) * DPR;
    oy = (canvas.height - world.H * k) / 2;
  }
  size();
  const ctx = canvas.getContext('2d');
  const U = u => u * k;                     // scene x → device px
  const V = v => v * k + oy;                // scene y → device px

  /* brushes ------------------------------------------------------------------ */
  function fill(shape, color, blurPx = 0) {
    actx.save();
    actx.filter = blurPx ? `blur(${blurPx}px)` : 'none';
    actx.fillStyle = color;
    actx.beginPath(); shape(actx); actx.fill();
    actx.restore();
  }
  const box = (x, y, w, h) => c => c.rect(U(x), V(y), U(w), V(h));
  function roundRect(x, y, w, h, r) {
    return c => {
      const X = U(x), Y = V(y), W = U(w), H = V(h);
      c.moveTo(X + r, Y); c.arcTo(X + W, Y, X + W, Y + H, r); c.arcTo(X + W, Y + H, X, Y + H, r);
      c.arcTo(X, Y + H, X, Y, r); c.arcTo(X, Y, X + W, Y, r); c.closePath();
    };
  }
  const grad = (x0, y0, x1, y1, stops) => {
    const g = actx.createLinearGradient(U(x0), V(y0), U(x1), V(y1));
    stops.forEach(([p, c]) => g.addColorStop(p, c));
    return g;
  };

  /* the materials ------------------------------------------------------------ */
  function drawAlbedo(t) {
    actx.setTransform(1, 0, 0, 1, 0, 0);
    actx.clearRect(0, 0, albedo.width, albedo.height);
    const f = world.facade, aw = world.awning, wi = world.window, ch = world.chalk, dr = world.door;

    // night sky behind everything
    fill(c => c.rect(0, 0, albedo.width, albedo.height), '#05070b');

    // neighbours, weathered
    [[-4, 10, 22, 64], [182, 12, 22, 62]].forEach(([x, y, w, h], i) => {
      fill(box(x, y, w, h), i ? '#0c1017' : '#0b0f16');
      for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) {
        const lit = ((r * 3 + c + i) % 3) === 0;
        fill(box(x + 3 + c * 9, y + 4 + r * 12, 6, 8), lit ? '#6a5232' : '#0f151d');
      }
    });

    // the façade: brick-ish verticals, lightly mottled
    fill(box(f.x, f.y, f.w, f.h), grad(f.x, f.y, f.x, f.y + f.h,
      [[0, '#1a222c'], [0.55, '#151d26'], [1, '#111820']]));
    for (let x = f.x; x < f.x + f.w; x += 4) {
      fill(box(x, f.y, 0.18, f.h), 'rgba(0,0,0,.16)');
    }

    // the wall under the awning sits in its shade
    fill(box(f.x, world.awningShadow.y, f.w, world.awningShadow.h), 'rgba(0,0,0,.55)');

    // the window: recess sides, then the warm back wall
    const rev = world.reveal;
    fill(box(wi.x - rev, wi.y - rev, wi.w + rev * 2, wi.h + rev * 2), '#0b1017');
    fill(box(wi.x, wi.y, wi.w, wi.h), grad(wi.x, wi.y, wi.x, wi.y + wi.h,
      [[0, '#4a3a28'], [0.5, '#3a2e20'], [1, '#2a2116']]));

    // the boards, with their lit top faces
    world.shelves.forEach(sy => {
      fill(box(wi.x + 1, sy - 1.4, wi.w - 2, 1.4), '#3a2920');            // back sliver
      fill(box(wi.x + 1, sy, wi.w - 2, 1.1), '#6a7688');                  // lit top face
      fill(box(wi.x + 1, sy + 1.1, wi.w - 2, world.board - 1.1), '#232c37');
      fill(box(wi.x + 1, sy + world.board + 0.4, wi.w - 2, 0.9), 'rgba(0,0,0,.45)');
    });
    fill(box(wi.x + 1, world.counter, wi.w - 2, 1.2), '#6a7688');
    fill(box(wi.x + 1, world.counter + 1.2, wi.w - 2, 4.4), '#242e39');
    fill(box(wi.x + 1, world.counter + 5.6, wi.w - 2, 1.2), 'rgba(0,0,0,.5)');

    // the chalkboard, with chalk that has been written on
    fill(box(ch.x, ch.y, ch.w, ch.h), '#0d1218');
    fill(box(ch.x, ch.y, ch.w, ch.h), 'rgba(255,255,255,.015)');
    // the door: dark frame, glazed, warm through the glass
    fill(box(dr.x, dr.y, dr.w, dr.h), '#0e141c');
    fill(box(dr.x + 1.6, dr.y + 2, dr.w - 3.2, dr.h * 0.6), '#2f2519');
    fill(box(dr.x + 1.6, dr.y + 2, dr.w - 3.2, dr.h * 0.6), grad(dr.x, dr.y, dr.x, dr.y + dr.h * 0.6,
      [[0, 'rgba(255,214,150,.22)'], [1, 'rgba(255,214,150,.05)']]));

    // the awning: one solid cloth, with the stripes clipped inside it, a thick front valance and
    // an arm at each end. Stripes drawn as separate bands leave gaps and read as arcs.
    const cloth = c => {
      c.moveTo(U(aw.x), V(aw.y + aw.h));
      c.quadraticCurveTo(U(aw.x + aw.w / 2), V(aw.y - 1.6), U(aw.x + aw.w), V(aw.y + aw.h));
      c.lineTo(U(aw.x + aw.w), V(aw.y + aw.h + 2.4));
      c.quadraticCurveTo(U(aw.x + aw.w / 2), V(aw.y + 0.8), U(aw.x), V(aw.y + aw.h + 2.4));
      c.closePath();
    };
    fill(cloth, grad(aw.x, aw.y - 1, aw.x, aw.y + aw.h + 2.4,
      [[0, '#2c3846'], [0.45, '#1d2631'], [1, '#131a22']]));
    actx.save();
    actx.beginPath(); cloth(actx); actx.clip();
    for (let i = 0; i < 13; i++) {
      const x = aw.x + 4 + i * ((aw.w - 8) / 13), w = (aw.w - 8) / 13;
      if (i % 2) {
        actx.fillStyle = 'rgba(212,122,68,.40)';
        actx.fillRect(U(x), V(aw.y - 4), U(w), U(aw.h + 10));
      }
    }
    // the cloth catches the lamp along its top edge and goes dark under the valance
    actx.fillStyle = 'rgba(255,214,150,.16)';
    actx.fillRect(U(aw.x), V(aw.y - 1.4), U(aw.w), Math.max(1, U(0.7)));
    actx.fillStyle = 'rgba(0,0,0,.42)';
    actx.fillRect(U(aw.x), V(aw.y + aw.h + 0.4), U(aw.w), U(2.4));
    actx.restore();
    // the valance: the scalloped lip, dark, with its own shadow below
    for (let i = 0; i < 13; i++) {
      const x = aw.x + 4 + i * ((aw.w - 8) / 13), w = (aw.w - 8) / 13;
      fill(c => {
        c.moveTo(U(x), V(aw.y + aw.h + 2.4));
        c.quadraticCurveTo(U(x + w / 2), V(aw.y + aw.h + 3.6), U(x + w), V(aw.y + aw.h + 2.4));
        c.lineTo(U(x + w), V(aw.y + aw.h + 1.2));
        c.lineTo(U(x), V(aw.y + aw.h + 1.2));
        c.closePath();
      }, i % 2 ? '#101720' : '#1a2129');
    }
    fill(box(aw.x, aw.y + aw.h + 3.6, aw.w, 2.2), 'rgba(0,0,0,.5)');
    fill(box(aw.x + 1, aw.y + 6, 0.8, aw.h - 4), '#39465a');
    fill(box(aw.x + aw.w - 1.8, aw.y + 6, 0.8, aw.h - 4), '#39465a');

    // the vessels: real glass, standing
    (opts.plan || []).forEach((p, i) => {
      const w = world.vessel.w, h = world.vessel.h, x = p.x - w / 2, y = p.y - h;
      const prop = i % 3;                                   // three proportions down the row
      const neckW = (prop === 1 ? 0.46 : 0.34) * w;
      const shoulderY = y + h * (prop === 1 ? 0.3 : 0.26);
      // the body: a bottle, not a mug — narrow, with a shoulder and a neck above it
      fill(c => {
        c.moveTo(U(x + (w - neckW) / 2), V(y));
        c.lineTo(U(x + (w + neckW) / 2), V(y));
        c.lineTo(U(x + (w + neckW) / 2), V(shoulderY));
        c.quadraticCurveTo(U(x + w), V(shoulderY + h * 0.06), U(x + w), V(shoulderY + h * 0.2));
        c.lineTo(U(x + w), V(p.y));
        c.lineTo(U(x), V(p.y));
        c.lineTo(U(x), V(shoulderY + h * 0.2));
        c.quadraticCurveTo(U(x), V(shoulderY + h * 0.06), U(x + (w - neckW) / 2), V(shoulderY));
        c.closePath();
      }, grad(x, y, x + w, p.y, [[0, 'rgba(200,222,246,.34)'], [0.35, 'rgba(130,158,186,.18)'],
        [0.7, 'rgba(66,86,108,.24)'], [1, 'rgba(22,32,44,.5)']]));
      // what is in it, and its meniscus
      fill(roundRect(x + 0.5, p.y - h * 0.34, w - 1, h * 0.32, 0.6), `color-mix(in srgb, ${A} 30%, #0a0f14)`);
      fill(box(x + 0.5, p.y - h * 0.34, w - 1, 0.35), 'rgba(255,255,255,.22)');
      // the cap
      fill(roundRect(x + (w - neckW) / 2 - 0.3, y - 0.8, neckW + 0.6, 1.5, 0.4), '#46545f');
      // a label band, wrapped, rather than a framed square stuck on the front
      const lw = w * 1.02, lh = h * 0.2, lx = p.x - lw / 2, ly = y + h * 0.46;
      if (p.frame && p.frame.complete && p.frame.naturalWidth) {
        actx.save();
        actx.beginPath(); roundRect(lx, ly, lw, lh, 0.3)(actx); actx.clip();
        actx.drawImage(p.frame, U(lx), V(ly), U(lw), V(lh));
        actx.fillStyle = 'rgba(255,240,210,.06)'; actx.fillRect(U(lx), V(ly), U(lw), U(lh));
        actx.restore();
      }
      // the glass edge
      actx.save(); actx.strokeStyle = 'rgba(200,225,250,.26)'; actx.lineWidth = Math.max(1, k * 0.07);
      actx.beginPath();
      actx.moveTo(U(x + (w - neckW) / 2), V(y)); actx.lineTo(U(x), V(shoulderY + h * 0.2));
      actx.lineTo(U(x), V(p.y)); actx.lineTo(U(x + w), V(p.y));
      actx.lineTo(U(x + w), V(shoulderY + h * 0.2));
      actx.lineTo(U(x + (w + neckW) / 2), V(y)); actx.stroke(); actx.restore();
    });

    // the lamp: cord, shade, bulb — drawn after the room so it hangs in front of it
    const lp2 = world.lamp, lby2 = lp2.y + lp2.drop;
    fill(box(lp2.x - 0.35, lp2.y - 3, 0.7, lby2 - lp2.y + 1), '#39465a');
    fill(c => {
      c.moveTo(U(lp2.x - lp2.shade / 2), V(lby2));
      c.lineTo(U(lp2.x + lp2.shade / 2), V(lby2));
      c.lineTo(U(lp2.x + lp2.shade / 2 - 1.2), V(lby2 - 4.6));
      c.lineTo(U(lp2.x - lp2.shade / 2 + 1.2), V(lby2 - 4.6));
      c.closePath();
    }, grad(lp2.x, lby2 - 5, lp2.x, lby2, [[0, '#2b3543'], [0.7, '#1b2530'], [1, '#3a2f22']]));
    fill(c => {
      c.moveTo(U(lp2.x - lp2.shade / 2 + 0.7), V(lby2 - 4.2));
      c.lineTo(U(lp2.x + lp2.shade / 2 - 0.7), V(lby2 - 4.2));
      c.lineTo(U(lp2.x + lp2.shade / 2 - 1.7), V(lby2 - 1));
      c.lineTo(U(lp2.x - lp2.shade / 2 + 1.7), V(lby2 - 1));
      c.closePath();
    }, 'rgba(255,214,150,.34)');
    fill(c => { c.arc(U(lp2.x), V(lby2 + 0.7), Math.max(1.5, U(0.9)), 0, Math.PI * 2); }, '#fff8e8');

    // street
    fill(box(0, world.street, world.W, world.H - world.street), grad(0, world.street, 0, world.H,
      [[0, '#0c1219'], [1, '#060a0e']]));
    // the kerb, its lit edge, and the wet sheen along it
    fill(box(0, world.street, world.W, 1.0), '#1a222c');
    fill(box(0, world.street, world.W, 0.35), 'rgba(190,215,240,.20)');
    fill(box(0, world.street + 1.2, world.W, 0.6), 'rgba(0,0,0,.45)');
    fill(box(0, world.street + 2, world.W, 7), grad(0, world.street + 2, 0, world.street + 9,
      [[0, 'rgba(150,180,210,.05)'], [1, 'rgba(150,180,210,0)']]));
  }

  /* the lights --------------------------------------------------------------- */
  function drawLight(t) {
    const flick = 1 + 0.03 * Math.sin(t * 0.006) + 0.018 * Math.sin(t * 0.019 + 2.1);
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    lctx.fillStyle = '#2a2f38';                                   // ambient, cool
    lctx.fillRect(0, 0, light.width, light.height);
    lctx.globalCompositeOperation = 'lighter';
    const pool = (u, v, r, color, a) => {
      const g = lctx.createRadialGradient(U(u), V(v), 0, U(u), V(v), U(r));
      g.addColorStop(0, color.replace('ALPHA', a));
      g.addColorStop(1, color.replace('ALPHA', '0'));
      lctx.fillStyle = g; lctx.fillRect(0, 0, light.width, light.height);
    };
    const lp = world.lamp, ly = lp.y + lp.drop + 1;
    // the cone the fixture actually throws, so the light has a direction and a source
    const cg = lctx.createLinearGradient(U(lp.x), V(ly), U(lp.x), V(world.counter + 12));
    cg.addColorStop(0, `rgba(255,214,150,${(0.5 * flick).toFixed(3)})`);
    cg.addColorStop(0.5, 'rgba(255,206,140,0.16)');
    cg.addColorStop(1, 'rgba(255,200,130,0)');
    lctx.fillStyle = cg;
    lctx.beginPath();
    lctx.moveTo(U(lp.x - lp.shade / 2), V(ly));
    lctx.lineTo(U(lp.x + lp.shade / 2), V(ly));
    lctx.lineTo(U(lp.x + lp.cone), V(world.counter + 12));
    lctx.lineTo(U(lp.x - lp.cone), V(world.counter + 12));
    lctx.closePath(); lctx.fill();
    pool(lp.x, ly, 16, `rgba(255,240,214,ALPHA)`, (1.0 * flick).toFixed(3));    // the bulb itself
    pool(lp.x, ly + 4, 34, `rgba(255,214,150,ALPHA)`, (0.6 * flick).toFixed(3));
    pool(lp.x, world.counter - 2, 26, `rgba(255,200,130,ALPHA)`, '0.34');
    pool(world.door.x + world.door.w / 2, world.door.y + world.door.h * 0.3, 18, `rgba(255,196,128,ALPHA)`, '0.34');
    pool(64, world.street + 9, 52, `rgba(255,196,128,ALPHA)`, (0.34 * flick).toFixed(3));   // the spill on the street
    pool(64, world.street + 4, 30, `rgba(255,206,140,ALPHA)`, (0.26 * flick).toFixed(3));
  }

  /* the frame ---------------------------------------------------------------- */
  let raf = 0, grainSeed = 0;
  function draw(t) {
    drawAlbedo(t); drawLight(t);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(albedo, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(light, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    // contact shadows: dark, tight, under each foot, painted over the lit board
    const f = world.facade, wi = world.window;
    (opts.plan || []).forEach(p => {
      const g = ctx.createRadialGradient(U(p.x), V(p.y + 0.4), 0, U(p.x), V(p.y + 0.4), U(world.vessel.w * 0.85));
      g.addColorStop(0, 'rgba(0,0,0,.88)'); g.addColorStop(0.45, 'rgba(0,0,0,.5)'); g.addColorStop(0.8, 'rgba(0,0,0,.14)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.save(); ctx.translate(U(p.x), V(p.y + 0.3)); ctx.scale(1, 0.28); ctx.translate(-U(p.x), -V(p.y + 0.3));
      ctx.beginPath(); ctx.arc(U(p.x), V(p.y + 0.3), U(world.vessel.w * 0.85), 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    // specular: the lamp's reflection in glass and shoulders, moving with the pointer
    ctx.globalCompositeOperation = 'lighter';
    const px = opts.pointer ? opts.pointer.x : 0.5;
    (opts.plan || []).forEach(p => {
      const sx = p.x - world.vessel.w / 2 + world.vessel.w * (0.18 + 0.1 * px);
      const g = ctx.createLinearGradient(U(sx), V(p.y - world.vessel.h), U(sx + 0.6), V(p.y));
      g.addColorStop(0, 'rgba(255,244,220,.32)'); g.addColorStop(1, 'rgba(255,244,220,0)');
      ctx.fillStyle = g;
      ctx.fillRect(U(sx), V(p.y - world.vessel.h + 1), Math.max(1, U(0.55)), U(world.vessel.h));
    });
    // the glass sheet: two soft reflections of the lamp
    const sheet = ctx.createLinearGradient(U(wi.x), V(wi.y), U(wi.x + wi.w * 0.6), V(wi.y + wi.h));
    sheet.addColorStop(0, 'rgba(255,240,215,.12)'); sheet.addColorStop(0.5, 'rgba(255,240,215,.02)');
    sheet.addColorStop(1, 'rgba(255,240,215,0)');
    ctx.fillStyle = sheet; ctx.fillRect(U(wi.x), V(wi.y), U(wi.w), U(wi.h));
    const lb = world.lamp;
    const refl = ctx.createRadialGradient(U(lb.x + 9), V(lb.y + 14), 0, U(lb.x + 9), V(lb.y + 14), U(9));
    refl.addColorStop(0, 'rgba(255,246,226,.20)'); refl.addColorStop(1, 'rgba(255,246,226,0)');
    ctx.fillStyle = refl; ctx.fillRect(U(wi.x), V(wi.y), U(wi.w), U(wi.h));
    ctx.globalCompositeOperation = 'source-over';

    // the wet street: the window mirrored, sampled in strips so it ripples
    ctx.save();
    ctx.beginPath(); ctx.rect(U(0), V(world.street), U(world.W), U(world.H - world.street)); ctx.clip();
    ctx.filter = 'blur(2.5px)';
    for (let y = 0; y < (world.H - world.street); y += 1) {
      const src = world.street - y * 0.6;
      if (src < world.window.y) continue;
      // puddles: a break-up pattern, so this reads as a wet street and not as a flipped copy
      const wet = Math.sin(y * 1.7 + 1.2) * 0.5 + 0.5;
      if (wet < 0.34) continue;
      const wob = Math.sin((y + t * 0.02) * 0.55) * 1.1 + Math.sin(y * 3.1) * 0.5;
      ctx.globalAlpha = 0.2 + wet * 0.34;
      ctx.drawImage(canvas,
        U(wi.x + wob * 0.4), V(src), U(wi.w), Math.max(1, U(1)),
        U(wi.x + wob), V(world.street + y), U(wi.w), Math.max(1, U(1.05)));
    }
    ctx.filter = 'none'; ctx.globalAlpha = 1;
    ctx.restore();

    // bloom: the bright pass, blurred hard, added back
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, blur.width, blur.height);
    bctx.drawImage(light, 0, 0, blur.width / 3, blur.height / 3);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.42;
    ctx.filter = 'blur(11px)';
    ctx.drawImage(blur, 0, 0, blur.width / 3, blur.height / 3, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 0.30;
    ctx.filter = 'blur(4px)';
    ctx.drawImage(blur, 0, 0, blur.width / 2, blur.height / 2, 0, 0, canvas.width, canvas.height);
    ctx.filter = 'none'; ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // type: fine, set at device resolution
    ctx.fillStyle = '#f2e9d8';
    ctx.textAlign = 'center';
    ctx.font = `${Math.round(5.2 * k)}px Georgia, serif`;
    ctx.fillText('THE FORMULARY', U(world.sign.x + world.sign.w / 2), V(world.sign.y + 4.4));
    ctx.fillStyle = A;
    ctx.font = `${Math.round(1.9 * k)}px ui-monospace, monospace`;
    ctx.fillText('LICENSED UNDER ACS1 · NO PAYMENTS TAKEN', U(world.sign.x + world.sign.w / 2), V(world.sign.y + 7.2));
    // the chalkboard, in chalk
    const ch = world.chalk;
    ctx.fillStyle = '#93a2b0'; ctx.font = `${Math.round(1.9 * k)}px ui-monospace, monospace`;
    ctx.fillText('on the counter today', U(ch.x + 1.4), V(ch.y + 3.2));
    ctx.fillStyle = '#efe7d9'; ctx.font = `italic ${Math.round(4.6 * k)}px Georgia, serif`;
    ctx.fillText(opts.doseWord || 'two', U(ch.x + 1.4), V(ch.y + 8.4));
    ctx.fillStyle = '#77869a'; ctx.font = `${Math.round(1.8 * k)}px ui-monospace, monospace`;
    ctx.fillText('no fee · no ledger', U(ch.x + 1.4), V(ch.y + 10.8));
    ctx.textAlign = 'center';
    (opts.plan || []).forEach(p => {
      ctx.fillStyle = P.paper; ctx.font = `${Math.round(2.6 * k)}px ui-monospace, monospace`;
      ctx.fillText(p.glyphs || '', U(p.x), V(p.y + 3.4));
    });

    // rain, ahead of the glass
    ctx.strokeStyle = 'rgba(190,215,240,.18)'; ctx.lineWidth = Math.max(1, k * 0.07);
    for (let i = 0; i < 130; i++) {
      const x = (i * 37.7) % world.W;
      const y = world.street - 40 + ((i * 13.3 + t * 0.06) % 46);
      ctx.beginPath(); ctx.moveTo(U(x), V(y)); ctx.lineTo(U(x - 0.35), V(y + 2.6)); ctx.stroke();
    }

    // grain and vignette, last
    grainSeed = (grainSeed + 1) % 7;
    ctx.globalAlpha = 0.045;
    ctx.fillStyle = grainSeed % 2 ? '#ffffff' : '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    const vg = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.28,
                                        canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const loop = (now) => { draw(now - t0); raf = requestAnimationFrame(loop); };
  const t0 = performance.now();
  raf = requestAnimationFrame(loop);
  addEventListener('resize', () => { size(); });
  return { stop() { cancelAnimationFrame(raf); }, tick: (t = 0) => draw(t) };
};
