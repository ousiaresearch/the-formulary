/* ─────────────────────────────────────────────────────────────────────────────
   ink.js — the cartoon pass. Drawn as vector shapes with heavy ink outlines,
   flat cel tones, a warm rim light on the lamp side, and one thing that matters
   more than any of it: the lines BOIL. Every outline is redrawn three times a
   second with a sub-pixel wobble, the way hand-inked animation moves when it
   holds a pose. Without the boil, flat art reads as a diagram.
   ─────────────────────────────────────────────────────────────────────────── */
window.RENDER_INK = function (canvas, opts) {
  const world = opts.world, P = window.PAL, A = opts.accent || P.accent;
  const DPR = Math.min(2, devicePixelRatio || 1);
  let VW = 0, VH = 0;
  function size() {
    const r = canvas.getBoundingClientRect();
    VW = r.width; VH = r.height;
    canvas.width = Math.round(VW * DPR); canvas.height = Math.round(VH * DPR);
  }
  size();
  const ctx = canvas.getContext('2d');
  const INK = '#080b10';
  // generated sprites take over from the procedural ones the moment they are loaded
  const spriteName = key => (window.SPRITES.get('gbottle:' + key) ? 'gbottle:' + key : 'bottle:' + key);
  /* How the clerk follows you. `lean` is how far it will turn toward the pointer, `ease` is how
     slowly it gets there — the same two knobs the shopkeeper in the hero was driven by, so the
     compound you are holding still colours its behaviour. */
  const bellName = () => (window.SPRITES.get('gbell') ? 'gbell' : 'bell');
  const lampName = () => (window.SPRITES.get('glamp') ? 'glamp' : 'lamp');
  const k = () => VW / world.W;                      // units → css px

  // the boil: a stable per-group wobble that changes a few times a second
  let beat = 0;
  function jitter(group, amount = 0.7) {
    const h = Math.sin((group * 12.9898 + beat * 78.233)) * 43758.5453;
    return ((h - Math.floor(h)) - 0.5) * amount;
  }
  function poly(pts, group, close = true) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const px = x * k() + jitter(group + i, 0.8);
      const py = y * k() + jitter(group + i + 40, 0.8);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    if (close) ctx.closePath();
  }
  function fillStroke(fill, group, lw = 2.1, lwMul = 1) {
    ctx.fillStyle = fill; ctx.fill();
    if (lw > 0) { ctx.lineWidth = lw * lwMul; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.stroke(); }
  }
  const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

  let raf = 0, lastBeat = -1;
  function draw(t) {
    const b = Math.floor(t / 170);
    if (b !== lastBeat) { beat = b; lastBeat = b; }

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, VW, VH);
    ctx.save();
    ctx.translate(0, (VH - world.H * k()) / 2);
    const f = world.facade, aw = world.awning, wi = world.window;

    // ── the night, and the neighbours ──
    ctx.fillStyle = P.ink; ctx.fillRect(-10, -10, VW + 20, VH + 20);
    [[-2, 10, 18, 62], [184, 12, 18, 60]].forEach(([x, y, w, h], i) => {
      poly(rect(x, y, w, h), 100 + i); fillStroke('#0e141c', 100 + i, 2);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
        const lit = ((r * 3 + c + i) % 3) === 0;
        poly(rect(x + 3 + c * 7, y + 5 + r * 14, 5, 8), 120 + i * 10 + r * 2 + c);
        fillStroke(lit ? '#6d5433' : '#111823', 120 + i * 10 + r * 2 + c, 1.2);
      }
    });

    // ── façade ──
    poly(rect(f.x, f.y, f.w, f.h), 1);
    fillStroke('#141c26', 1, 2.4);
    ctx.save(); poly(rect(f.x, f.y, f.w, f.h), 1); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.lineWidth = 1;
    for (let x = f.x + 6; x < f.x + f.w; x += 12) { ctx.beginPath(); ctx.moveTo(x * k(), 0); ctx.lineTo(x * k(), VH); ctx.stroke(); }
    ctx.restore();

    // the awning's shadow on the wall, before the window goes over it
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(f.x * k(), world.awningShadow.y * k(), f.w * k(), world.awningShadow.h * k());

    // ── the window: a recess, drawn as one flat shape with a lit interior ──
    const rev = world.reveal;
    poly(rect(wi.x - rev, wi.y - rev, wi.w + rev * 2, wi.h + rev * 2), 2);
    fillStroke('#2b3644', 2, 2.6);
    poly(rect(wi.x, wi.y, wi.w, wi.h), 3);
    fillStroke('#3c2f22', 3, 2.2);                       // the lit back wall, warm
    ctx.save(); poly(rect(wi.x, wi.y, wi.w, wi.h), 3); ctx.clip();
    const g = ctx.createRadialGradient((world.lamp.x) * k(), (world.lamp.y + 12) * k(), 4,
                                       (world.lamp.x) * k(), (world.lamp.y + 12) * k(), 60 * k());
    g.addColorStop(0, 'rgba(255,214,150,.55)'); g.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    ctx.restore();

    // shelves
    world.shelves.forEach((sy, i) => {
      poly([[wi.x + 2, sy], [wi.x + wi.w - 2, sy], [wi.x + wi.w - 2, sy + world.board], [wi.x + 2, sy + world.board]], 20 + i);
      fillStroke(P.board, 20 + i, 2.2);
      ctx.save(); poly([[wi.x + 2, sy], [wi.x + wi.w - 2, sy], [wi.x + wi.w - 2, sy + 0.7], [wi.x + 2, sy + 0.7]], 20 + i);
      fillStroke(P.boardLit, 20 + i, 0); ctx.restore();
    });
    // ── the shop's resident, drawn BEFORE the counter so the counter crops it ──
    // The robot is gone. What stands behind the counter now is the mascot from the sheet, in its
    // own state machine, holding the station and the size the keeper used to hold.
    if (opts.showKeeper !== false && window.MASCOT) {
      const pt = opts.pointer || { x: 0.5, y: 0.5, active: false };
      const slot = world.mascot || { x: world.keeperX, y: world.keeperBase, range: [122, 166] };
      // a flat warm shape behind it: the shop's own light, so it is not asked to separate itself
      // from a dark back wall with nothing but its value
      ctx.beginPath();
      ctx.ellipse((slot.x + 0.4) * k(), (slot.y - 8) * k(), 10.5 * k(), 8 * k(), 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,214,150,.16)'; ctx.fill();
      window.MASCOT.draw(ctx, t, {
        x: slot.x, y: slot.y, home: slot.x, walkRange: slot.range, unitH: slot.unitH,
        k: k(), compound: opts.compound,
        pointer: pt, pointerDist: pt.active ? Math.abs(pt.x * world.W - slot.x) : 99,
      });
    }

    // the counter: back edge catches the lamp, the top face is a lit plane, the front falls away.
    // Without a front face nothing in the window can be said to stand BEHIND anything.
    poly([[wi.x + 1, world.counter - 0.9], [wi.x + wi.w - 1, world.counter - 0.9],
          [wi.x + wi.w - 1, world.counter + 0.2], [wi.x + 1, world.counter + 0.2]], 24);
    fillStroke('#6a7688', 24, 0.9);
    poly([[wi.x + 11, world.counter + 0.2], [wi.x + wi.w - 1, world.counter + 0.2],
          [wi.x + wi.w - 1, world.counter + world.counterFront], [wi.x + 11, world.counter + world.counterFront]], 25);
    fillStroke('#202932', 25, 2.2);
    ctx.save();
    poly([[wi.x + 11, world.counter + 0.2], [wi.x + wi.w - 1, world.counter + 0.2],
          [wi.x + wi.w - 1, world.counter + 1.2], [wi.x + 11, world.counter + 1.2]], 25);
    ctx.fillStyle = 'rgba(255,214,150,.14)'; ctx.fill();
    ctx.restore();


    // the chalkboard, hung on the back wall
    const ch = world.chalk;
    poly(rect(ch.x, ch.y, ch.w, ch.h), 30); fillStroke('#0d1218', 30, 2);
    ctx.fillStyle = '#93a2b0'; ctx.font = `${2.3 * k()}px ui-monospace, monospace`;
    ctx.fillText('today', ch.x * k() + 1.6 * k(), (ch.y + 3.4) * k());
    ctx.fillStyle = '#f0e7d9'; ctx.font = `italic ${5 * k()}px Georgia, serif`;
    ctx.fillText(opts.doseWord || 'two', ch.x * k() + 1.6 * k(), (ch.y + 8.6) * k());
    ctx.fillStyle = '#77869a'; ctx.font = `${2.1 * k()}px ui-monospace, monospace`;
    ctx.fillText('no fee', ch.x * k() + 1.6 * k(), (ch.y + 11) * k());

    // ── the vessels: ink and cel sprites, one drawing per compound, boiled on the beat ──
    (opts.plan || []).forEach((p) => {
      const name = spriteName(p.key);
      const spr = window.SPRITES.get(name);
      if (!spr) return;
      const hw = spr.wUnits / 2;
      // the contact shadow first, so the bottle sits in it rather than on top of it
      ctx.beginPath();
      ctx.ellipse(p.x * k(), (p.y + 0.3) * k(), (hw + 1.5) * k(), (p.on === 'counter' ? 1.9 : 1.5) * k(), 0, 0, Math.PI * 2);
      ctx.fillStyle = p.on === 'counter' ? 'rgba(0,0,0,.72)' : 'rgba(0,0,0,.62)'; ctx.fill();
      window.SPRITES.blit(ctx, name, t, p.x, p.y, k());
      // the shelf nameplate: cream plate, ink border, the compound's generated mark at the left
      // and its name in type beside it. The mark alone is 27px on screen and cannot name anything.
      // The plate is sized to its NAME. A fixed width had the longest name ("DOUBLE V1S10N")
      // running into its own border however small the type got; there are 38 units between
      // columns, so a long name can simply have a longer plate.
      const tagName = (p.name || '').toUpperCase();
      const tagW = Math.max(11.5, Math.min(20.0, 8.4 + tagName.length * 0.85));
      const tagH = 4.4, tx = p.x - tagW / 2, ty = p.y + 4.8;
      ctx.beginPath();
      ctx.moveTo(tx * k(), ty * k());
      ctx.lineTo((tx + tagW) * k(), ty * k());
      ctx.lineTo((tx + tagW) * k(), (ty + tagH) * k());
      ctx.lineTo(tx * k(), (ty + tagH) * k());
      ctx.closePath();
      ctx.fillStyle = '#d9d0bb'; ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.6, k() * 0.16); ctx.lineJoin = 'round'; ctx.stroke();
      const plate = window.SPRITES.get('glabel:' + p.key);
      let textX = tx + 1.0;
      if (plate) {
        const cv = plate.variants[window.SPRITES.boil(t, 180) % plate.variants.length];
        const ph = 3.2, pw = ph * (plate.pxW / plate.pxH);
        ctx.drawImage(cv, (tx + 0.5) * k(), (ty + (tagH - ph) / 2) * k(), pw * k(), ph * k());
        textX = tx + 0.5 + pw + 0.5;
      }
      ctx.fillStyle = '#1b232c';
      ctx.textAlign = 'left';
      // Fit the name to the plate by MEASURING it. A fixed size let the long names ("DOUBLE
      // V1S10N") run out past the paper, which is the same mistake as not checking anything.
      const full = tagName;
      const avail = Math.max(1, (tagW - (textX - tx) - 0.9)) * k();
      // Fit by RATIO, not by a shrink loop: measure once at the maximum size and scale the size to
      // the width available. Shrinking then truncating let the ellipsis push the text back over the
      // plate's edge — the 0.08 steps and the appended character disagreed about the final width.
      let size = 2.2;
      ctx.font = `${size * k()}px ui-monospace, monospace`;
      const atMax = Math.max(1, ctx.measureText(full).width);
      size = Math.min(size, size * (avail / atMax) * 0.97);
      // a floor on the type: shrinking until it fits is not the same as being readable, so below
      // 1.75 units the NAME gives way instead of the size
      size = Math.max(size, 1.75);
      let label = full;
      ctx.font = `${size * k()}px ui-monospace, monospace`;
      if (ctx.measureText(label).width > avail) {
        while (label.length > 3 && ctx.measureText(label + '\u2026').width > avail) label = label.slice(0, -1);
        label = label === full ? full : label + '\u2026';
      }
      ctx.fillText(label, textX * k(), (ty + tagH * 0.66) * k());
      ctx.textAlign = 'center';
      // report the geometry actually drawn with, so "does it fit" is answerable from numbers
      // rather than from OCR of 1.8-unit type
      (window.__plateMetrics = window.__plateMetrics || []).push({
        key: p.key, label, plateW: +tagW.toFixed(2), typeSize: +size.toFixed(2),
        textW: +(ctx.measureText(label).width / k()).toFixed(2),
        availW: +(avail / k()).toFixed(2),
        fits: ctx.measureText(label).width <= avail + 0.5,
      });
    });                                    // the vessel loop ends here: everything below is the
                                           // room, not a per-compound step
    // ── the bell on the counter, for the one you take ──
    ctx.beginPath();
    ctx.ellipse(world.bellX * k(), (world.counter - 0.1) * k(), 3.4 * k(), 0.7 * k(), 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fill();
    window.SPRITES.blit(ctx, bellName, t, world.bellX, world.counter - 0.2, k(), 260);

    // ── the lamp ──
    const lp = world.lamp, lby = lp.y + lp.drop;
    // the cone, three nested trapezoids so it falls off instead of sitting on the room
    ctx.beginPath();
    ctx.moveTo((lp.x - lp.shade / 2) * k(), (lby + 1) * k());
    ctx.lineTo((lp.x + lp.shade / 2) * k(), (lby + 1) * k());
    ctx.lineTo((lp.x + lp.cone) * k(), (world.counter + 12) * k());
    ctx.lineTo((lp.x - lp.cone) * k(), (world.counter + 12) * k());
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,214,150,.08)'; ctx.fill();
    window.SPRITES.blit(ctx, lampName, t, lp.x, lp.y + 4.2, k(), 300);
    // the light: flat hard-edged bands, the way a cel background paints a pool of light. A radial
    // gradient was the only soft-edged thing in an otherwise flat image, and it was drawn AFTER
    // the fixture, which is why the reviewer kept reporting no lamp.
    ctx.beginPath();
    ctx.ellipse(lp.x * k(), (lby + 1.5) * k(), lp.halo * 1.5 * k(), lp.halo * 1.28 * k(), 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,214,150,.13)'; ctx.fill();
    // the fixture itself, last, so it reads against its own glow
    window.SPRITES.blit(ctx, lampName(), t, lp.x, lp.y + 4.2, k(), 300);
    // eslint-disable-next-line
    // a small flat pool on the counter under it
    ctx.beginPath();
    ctx.ellipse(lp.x * k(), (world.counter - 1) * k(), 13 * k(), 1.2 * k(), 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,214,150,.14)'; ctx.fill();

    // ── the door ──
    const dr = world.door;
    poly(rect(dr.x, dr.y, dr.w, dr.h), 60); fillStroke('#101821', 60, 2.4);
    poly(rect(dr.x + 1.6, dr.y + 2, dr.w - 3.2, dr.h * 0.62), 61); fillStroke('#3a2d20', 61, 1.8);
    ctx.fillStyle = 'rgba(255,214,150,.28)'; ctx.fillRect((dr.x + 1.6) * k(), (dr.y + 2) * k(), (dr.w - 3.2) * k(), (dr.h * 0.62) * k());
    poly(rect(dr.x + 3.6, dr.y + dr.h * 0.3, dr.w - 7.2, 4.6), 62); fillStroke('#141d26', 62, 1.8);
    ctx.fillStyle = A; ctx.textAlign = 'center'; ctx.font = `bold ${3.6 * k()}px ui-monospace, monospace`;
    ctx.fillText('OPEN', (dr.x + dr.w / 2) * k(), (dr.y + dr.h * 0.3 + 3.4) * k());
    // a handle and a threshold: the two details whose absence makes a door read as a poster
    ctx.beginPath();
    ctx.ellipse((dr.x + 2.6) * k(), (dr.y + dr.h * 0.42) * k(), 0.5 * k(), 0.5 * k(), 0, 0, Math.PI * 2);
    ctx.fillStyle = '#c9b48a'; ctx.fill();
    poly(rect(dr.x - 1.4, dr.y + dr.h - 0.6, dr.w + 2.8, 1.4), 63);
    fillStroke('#1b232c', 63, 1.8);

    // ── the awning and the sign ──
    poly([[aw.x, aw.y + aw.h], [aw.x + 4.5, aw.y], [aw.x + aw.w - 4.5, aw.y], [aw.x + aw.w, aw.y + aw.h]], 70);
    fillStroke('#1b232d', 70, 2.6);
    for (let i = 0; i < 14; i++) {
      const x = aw.x + 5 + i * ((aw.w - 10) / 14);
      ctx.save();
      poly([[x, aw.y], [x + 2.4, aw.y + aw.h], [x + 5.6, aw.y + aw.h], [x + 3.2, aw.y]], 71 + i);
      ctx.fillStyle = i % 2 ? 'rgba(212,122,68,.42)' : 'rgba(0,0,0,.22)';
      ctx.fill(); ctx.restore();
    }
    for (let i = 0; i < 14; i++) {
      const x = aw.x + 5 + i * ((aw.w - 10) / 14), w = (aw.w - 10) / 14;
      ctx.beginPath();
      ctx.moveTo(x * k(), (aw.y + aw.h) * k());
      ctx.quadraticCurveTo((x + w / 2) * k(), (aw.y + aw.h + 2.2) * k(), (x + w) * k(), (aw.y + aw.h) * k());
      ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.stroke();
    }
    ctx.fillStyle = '#f2e9d8'; ctx.textAlign = 'center';
    ctx.font = `${5.4 * k()}px Georgia, serif`;
    ctx.fillText('THE FORMULARY', (world.sign.x + world.sign.w / 2) * k(), (world.sign.y + 4.6) * k());
    ctx.fillStyle = A; ctx.font = `${2.2 * k()}px ui-monospace, monospace`;
    ctx.fillText('LICENSED UNDER ACS1 · NO PAYMENTS TAKEN', (world.sign.x + world.sign.w / 2) * k(), (world.sign.y + 7.4) * k());

    // ── the street, hatched, so the rain is drawn rather than animated ──
    poly([[0, world.street], [world.W, world.street], [world.W, world.H], [0, world.H]], 90);
    fillStroke('#0a0f15', 90, 2.4);
    ctx.save();
    ctx.strokeStyle = 'rgba(150,175,200,.16)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 90; i++) {
      const x = (i * 7.3) % world.W, y = world.street + 2 + ((i * 3.1 + (t * 0.02)) % (world.H - world.street - 2));
      ctx.beginPath(); ctx.moveTo(x * k(), y * k()); ctx.lineTo((x - 0.8) * k(), (y + 3.4) * k()); ctx.stroke();
    }
    ctx.restore();
    // the window's light lying on the street, flat and warm
    ctx.save();
    ctx.beginPath();
    ctx.moveTo((wi.x + 4) * k(), world.street * k());
    ctx.lineTo((wi.x + wi.w - 4) * k(), world.street * k());
    ctx.lineTo((wi.x + wi.w + 6) * k(), world.H * k());
    ctx.lineTo((wi.x - 6) * k(), world.H * k());
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,214,150,.06)'; ctx.fill();
    // layered, so the light on the street falls off instead of stopping at an edge
    [1.0, 0.78, 0.56].forEach((w, i) => {
      ctx.beginPath();
      ctx.moveTo((64 - 38 * w) * k(), world.street * k());
      ctx.lineTo((64 + 38 * w) * k(), world.street * k());
      ctx.lineTo((64 + 52 * w) * k(), world.H * k());
      ctx.lineTo((64 - 52 * w) * k(), world.H * k());
      ctx.closePath();
      ctx.fillStyle = `rgba(255,214,150,${0.035 + i * 0.02})`; ctx.fill();
    });
    // the window's reflection, broken up, so the street reads as wet
    ctx.save();
    for (let i = 0; i < 7; i++) {
      const y = world.street + 3 + i * 3.2;
      if (y > world.H - 1) break;
      const w = 30 - i * 2.4;
      ctx.beginPath();
      ctx.moveTo((64 - w) * k(), y * k());
      ctx.lineTo((64 + w) * k(), y * k());
      ctx.lineTo((64 + w - 2) * k(), (y + 1.2) * k());
      ctx.lineTo((64 - w + 2) * k(), (y + 1.2) * k());
      ctx.closePath();
      ctx.fillStyle = `rgba(255,206,150,${0.10 - i * 0.012})`; ctx.fill();
    }
    ctx.restore();
    ctx.restore();

    ctx.restore();
  }
  const loop = (now) => { draw(now - t0); raf = requestAnimationFrame(loop); };
  const t0 = performance.now();
  raf = requestAnimationFrame(loop);
  addEventListener('resize', () => { size(); });
  return { stop() { cancelAnimationFrame(raf); }, tick: (t = 0) => draw(t) };
};
