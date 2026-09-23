/* ─────────────────────────────────────────────────────────────────────────────
   sprites.js — ink and cel sprites, drawn once at high resolution.

   The reason to do this instead of redrawing primitives every frame: detail costs
   nothing at render time. Each sprite here is a full ink drawing — a variable-weight
   outline, two flat cel bands, a cast shade, a rim light on the lamp side, hatching
   in the occlusion, a paper label — and it is rasterised once, then blitted.

   The boil is the other half. Hand-inked animation does not wobble its lines: it
   holds a pose and the whole DRAWING swaps among two or three near-identical
   drawings. So every sprite is built in three variants, each drawn with a different
   seeded irregularity, and the renderer cycles them on the beat. Shapes never warp;
   the ink just moves the way ink moves.
   ─────────────────────────────────────────────────────────────────────────── */
window.SPRITES = (() => {
  const SCALE = 14;                       // sprite pixels per scene unit
  const INK = '#080b10';
  const VARIANTS = 3;

  /* a seeded wobble, stable per (variant, point index) */
  function wob(seed) {
    const h = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return (h - Math.floor(h)) - 0.5;
  }
  const rnd = (seed, amp) => wob(seed) * amp;

  const cache = new Map();
  const canvases = () => {
    const c = document.createElement('canvas');
    return c;
  };

  /* ── a bottle, described once and drawn properly ────────────────────────── */
  /* proportions in sprite units; the caller gives the footprint in scene units */
  function drawBottle(ctx, def, variant, px) {
    const S = SCALE, W = def.w * S, H = def.h * S;
    const cx = W / 2;
    const bw = def.bodyW * S / 2;                 // body half width
    const nw = def.neckW * S / 2;                 // neck half width
    const shoulderY = def.shoulder * H;
    const baseY = H - def.base * S;
    const j = (i, amp = 0.55) => rnd(variant * 97 + i, amp) * S * 0.06;

    const body = () => {
      ctx.beginPath();
      ctx.moveTo(cx - nw + j(1), j(2));
      ctx.lineTo(cx + nw + j(3), j(4));
      ctx.lineTo(cx + nw + j(5), shoulderY + j(6));
      ctx.bezierCurveTo(cx + nw + j(7), shoulderY + H * 0.06,
                        cx + bw + j(8), shoulderY + H * 0.08,
                        cx + bw + j(9), shoulderY + H * 0.20);
      ctx.lineTo(cx + bw + j(10), baseY);
      ctx.quadraticCurveTo(cx + bw + j(11), H, cx + bw - def.corner * S, H);
      ctx.lineTo(cx - bw + def.corner * S, H);
      ctx.quadraticCurveTo(cx - bw + j(12), H, cx - bw + j(13), baseY);
      ctx.lineTo(cx - bw + j(14), shoulderY + H * 0.20);
      ctx.bezierCurveTo(cx - bw + j(15), shoulderY + H * 0.08,
                        cx - nw + j(16), shoulderY + H * 0.06,
                        cx - nw + j(17), shoulderY + j(18));
      ctx.closePath();
    };

    // 1. the flat body, darkest of the cel bands
    ctx.save();
    body();
    ctx.fillStyle = def.tone[0];
    ctx.fill();

    // 2. everything else happens inside the silhouette
    ctx.save();
    body();
    ctx.clip();

    // the lit cel band: a flat shape, hard-edged, the way cel shading works
    ctx.beginPath();
    ctx.moveTo(cx - bw, shoulderY + H * 0.2);
    ctx.lineTo(cx - bw + bw * 1.05, shoulderY + H * 0.16);
    ctx.lineTo(cx - bw + bw * 0.9, H);
    ctx.lineTo(cx - bw, H);
    ctx.closePath();
    ctx.fillStyle = def.tone[1];
    ctx.fill();

    // the cast shade: the far third, one flat tone, no gradient
    ctx.beginPath();
    ctx.moveTo(cx + bw * 0.34, 0);
    ctx.lineTo(cx + bw, 0);
    ctx.lineTo(cx + bw, H);
    ctx.lineTo(cx + bw * 0.5, H);
    ctx.closePath();
    ctx.fillStyle = def.tone[2];
    ctx.fill();

    // what is in it, with its surface
    if (def.liquid) {
      const ly = H - H * def.liquid;
      ctx.beginPath();
      ctx.moveTo(cx - bw, ly + j(20, 0.4));
      ctx.lineTo(cx + bw, ly + j(21, 0.4));
      ctx.lineTo(cx + bw, H);
      ctx.lineTo(cx - bw, H);
      ctx.closePath();
      ctx.fillStyle = def.liquidTone || 'rgba(0,0,0,.32)';
      ctx.fill();
      ctx.strokeStyle = def.surface || 'rgba(255,255,255,.24)';
      ctx.lineWidth = Math.max(1, S * 0.14);
      ctx.beginPath();
      ctx.moveTo(cx - bw, ly + j(22, 0.4));
      ctx.lineTo(cx + bw, ly + j(23, 0.4));
      ctx.stroke();
    }

    // occlusion hatching at the base and the shoulder
    ctx.strokeStyle = 'rgba(0,0,0,.36)';
    ctx.lineWidth = Math.max(1, S * 0.1);
    for (let i = 0; i < 5; i++) {
      const y0 = H - 2 - i * S * 0.36 + rnd(variant * 7 + i, 0.4);
      ctx.beginPath();
      ctx.moveTo(cx - bw * (0.9 - i * 0.06), y0);
      ctx.lineTo(cx - bw * (0.2 + i * 0.05), y0 - S * 0.3);
      ctx.stroke();
    }
    for (let i = 0; i < 3; i++) {
      const y0 = shoulderY + H * 0.06 + i * S * 0.28;
      ctx.beginPath();
      ctx.moveTo(cx - nw * 0.9, y0);
      ctx.lineTo(cx - bw * 0.5, y0 - S * 0.18);
      ctx.stroke();
    }

    // the paper label. Five geometries, because one rectangle on seven bottles is what makes a
    // shelf look like a single sprite recoloured.
    if (def.label) {
      const lw = bw * 2 * 0.98, lh = H * def.label.h;
      const lx = cx - lw / 2, ly = H * def.label.y;
      const shape = () => {
        ctx.beginPath();
        switch (def.labelShape) {
          case 'square':
            ctx.rect(cx - lw * 0.32, ly, lw * 0.64, lh * 0.9);
            break;
          case 'circle':
            ctx.arc(cx, ly + lh * 0.5, Math.min(lw * 0.34, lh * 0.55), 0, Math.PI * 2);
            break;
          case 'banner':                       // a strip with notched ends
            ctx.moveTo(lx + lw * 0.08, ly);
            ctx.lineTo(lx + lw, ly);
            ctx.lineTo(lx + lw * 0.92, ly + lh * 0.5);
            ctx.lineTo(lx + lw, ly + lh);
            ctx.lineTo(lx + lw * 0.08, ly + lh);
            ctx.lineTo(lx, ly + lh * 0.5);
            break;
          case 'tallBand':
            ctx.rect(lx, ly, lw, lh * 1.25);
            break;
          default:
            ctx.rect(lx, ly, lw, lh);
        }
        ctx.closePath();
      };
      ctx.save();
      shape();
      ctx.fillStyle = '#d9d0bb'; ctx.fill();
      ctx.clip();
      ctx.fillStyle = 'rgba(0,0,0,.10)';
      ctx.fillRect(lx, ly + lh * 0.7, lw, lh);
      if (def.label.img && def.label.img.complete && def.label.img.naturalWidth) {
        ctx.globalAlpha = 0.92;
        ctx.drawImage(def.label.img, lx, ly, lw, lh * 1.25);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      shape();
      ctx.strokeStyle = 'rgba(8,11,16,.75)';
      ctx.lineWidth = Math.max(1, S * 0.09);
      ctx.stroke();
    }

    // the rim light: the lamp is to the left, so a hard band down the left edge
    ctx.strokeStyle = def.rim || 'rgba(255,214,150,.62)';
    ctx.lineWidth = Math.max(1.2, S * 0.22);
    ctx.beginPath();
    ctx.moveTo(cx - bw + S * 0.16, H - S * 0.3);
    ctx.lineTo(cx - bw + S * 0.16 + j(40, 0.5), shoulderY + H * 0.2);
    ctx.lineTo(cx - nw - j(41, 0.4), S * 0.5);
    ctx.stroke();

    // the specular: its length and number differ per compound, so the glass does not repeat
    ctx.strokeStyle = 'rgba(255,255,255,.44)';
    ctx.lineWidth = Math.max(1, S * 0.13);
    const specAt = (y0, y1, dx) => {
      ctx.beginPath();
      ctx.moveTo(cx - bw * 0.66 + j(50, 0.4) + dx, H * y0);
      ctx.lineTo(cx - bw * 0.6 + j(51, 0.4) + dx, H * y1);
      ctx.stroke();
    };
    if (def.spec === 'long') specAt(0.3, 0.86, 0);
    else if (def.spec === 'short') specAt(0.46, 0.68, 0);
    else if (def.spec === 'double') { specAt(0.32, 0.54, 0); specAt(0.6, 0.8, S * 0.12); }
    ctx.restore();

    // the closure, above the neck, drawn before the ink so the outline wraps it
    const capTop = def.cap === 'dropper' ? S * 1.5 : def.cap === 'tin' ? S * 1.1 : S * 0.5;
    const capW = def.cap === 'screw' ? nw * 2.5 : def.cap === 'tin' ? nw * 2.3 : nw * 2.1;
    ctx.beginPath();
    if (def.cap === 'cork') {
      ctx.moveTo(cx - nw * 0.9 + j(60), -capTop);
      ctx.lineTo(cx + nw * 0.9 + j(61), -capTop);
      ctx.lineTo(cx + nw * 0.95, j(62));
      ctx.lineTo(cx - nw * 0.95, j(63));
    } else if (def.cap === 'dropper') {
      ctx.moveTo(cx - nw * 0.7, -capTop);
      ctx.lineTo(cx + nw * 0.7, -capTop);
      ctx.lineTo(cx + nw * 1.15, -S * 0.2);
      ctx.lineTo(cx - nw * 1.15, -S * 0.2);
    } else if (def.cap === 'screw') {
      ctx.moveTo(cx - nw * 1.25 + j(64), -capTop);
      ctx.lineTo(cx + nw * 1.25 + j(65), -capTop);
      ctx.lineTo(cx + nw * 1.25, j(66));
      ctx.lineTo(cx - nw * 1.25, j(67));
    } else if (def.cap === 'tin') {
      ctx.ellipse(cx, -S * 0.25, capW / 2, S * 0.42, 0, 0, Math.PI * 2);
    } else {
      ctx.ellipse(cx, -S * 0.2, nw * 1.0, S * 0.34, 0, 0, Math.PI * 2);
    }
    ctx.closePath();
    ctx.fillStyle = def.cap === 'cork' ? '#a9834e' : def.cap === 'tin' ? '#7d8794'
                  : def.cap === 'dropper' ? '#1b232e' : '#39465a';
    ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,.34)';
    ctx.fillRect(cx, -S * 2, cx + S * 3, S * 4);
    ctx.restore();
    ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2, S * def.ink); ctx.stroke();

    // 3. the ink, last, over everything — a variable-weight outline
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    body();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2, S * def.ink);
    ctx.stroke();
    // pressure: a heavier stroke at the base and the shoulder, the way a nib loads up
    ctx.save();
    body();
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(cx - bw - S, H - S * 0.1);
    ctx.lineTo(cx + bw + S, H - S * 0.1);
    ctx.lineWidth = Math.max(2.5, S * def.ink * 1.9);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  /* ── the lamp, the bell, the shopkeeper ─────────────────────────────────── */
  function drawLamp(ctx, def, variant) {
    const S = SCALE, W = def.w * S, H = def.h * S, cx = W / 2;
    const j = (i, amp = 0.5) => rnd(variant * 61 + i, amp) * S * 0.05;
    ctx.lineCap = 'round';
    // the ceiling rose it hangs from, and the cord. A pendant with no suspension reads as a
    // wall light, a shelf lamp, or a decal — it has to come from somewhere.
    ctx.beginPath();
    ctx.ellipse(cx + j(0), S * 0.34, S * 0.62, S * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#39465a'; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, S * 0.1); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2.4, S * 0.16);
    ctx.beginPath(); ctx.moveTo(cx + j(1), S * 0.5); ctx.lineTo(cx + j(2), H * 0.42); ctx.stroke();
    ctx.strokeStyle = '#5a6b80'; ctx.lineWidth = Math.max(1, S * 0.05);
    ctx.beginPath(); ctx.moveTo(cx + j(3) - S * 0.06, S * 0.5); ctx.lineTo(cx + j(4) - S * 0.06, H * 0.42); ctx.stroke();
    // the shade: a cone, ink outline, one shade band, a lit inner lip
    const sw = def.shade * S;
    ctx.beginPath();
    ctx.moveTo(cx - sw / 2 + j(5), H * 0.42);
    ctx.lineTo(cx + sw / 2 + j(6), H * 0.42);
    ctx.lineTo(cx + sw / 2 - S * 0.5, H);
    ctx.lineTo(cx - sw / 2 + S * 0.5, H);
    ctx.closePath();
    ctx.fillStyle = '#26303c'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#161d26';
    ctx.beginPath(); ctx.moveTo(cx, H * 0.42); ctx.lineTo(cx + sw, H * 0.42); ctx.lineTo(cx + sw, H); ctx.lineTo(cx, H); ctx.fill();
    ctx.restore();
    ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, S * 0.15); ctx.stroke();
    // the glowing lip and the bulb
    ctx.beginPath();
    ctx.ellipse(cx + j(7), H - S * 0.1, sw / 2 - S * 0.55, S * 0.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffdfa8'; ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + j(8), H + S * 0.14, S * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#fff8e8'; ctx.fill();
  }

  function drawBell(ctx, def, variant) {
    const S = SCALE, W = def.w * S, H = def.h * S, cx = W / 2;
    const j = (i, amp = 0.5) => rnd(variant * 29 + i, amp) * S * 0.05;
    ctx.beginPath();
    ctx.moveTo(cx - W * 0.34 + j(1), H - S * 0.2);
    ctx.bezierCurveTo(cx - W * 0.34 + j(2), H * 0.36, cx - W * 0.12, H * 0.1, cx + j(3), H * 0.1);
    ctx.bezierCurveTo(cx + W * 0.12, H * 0.1, cx + W * 0.34 + j(4), H * 0.36, cx + W * 0.34, H - S * 0.2);
    ctx.closePath();
    ctx.fillStyle = '#8a6a2e'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#b98f3f'; ctx.beginPath();
    ctx.moveTo(cx - W * 0.36, H); ctx.lineTo(cx - W * 0.05, H); ctx.lineTo(cx - W * 0.16, 0); ctx.lineTo(cx - W * 0.36, 0); ctx.fill();
    ctx.restore();
    ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, S * 0.14); ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + j(5), H - S * 0.14, W * 0.4, S * 0.22, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#6d5322'; ctx.fill(); ctx.stroke();
  }

  /* the shopkeeper, inked from behind the counter: shoulders, hat, nothing else */
  function drawKeeper(ctx, def, variant) {
    const S = SCALE, W = def.w * S, H = def.h * S, cx = W / 2;
    const j = (i, amp = 0.6) => rnd(variant * 43 + i, amp) * S * 0.07;
    const shoulders = H * 0.46, headR = W * 0.17;
    ctx.beginPath();
    ctx.moveTo(cx - W * 0.44 + j(1), H);
    ctx.bezierCurveTo(cx - W * 0.4 + j(2), shoulders + H * 0.2, cx - W * 0.22, shoulders, cx - headR * 1.15 + j(3), shoulders - H * 0.02);
    ctx.bezierCurveTo(cx - headR * 1.5, shoulders - H * 0.16, cx - headR * 1.25, H * 0.16, cx + j(4), H * 0.16);
    ctx.bezierCurveTo(cx + headR * 1.25, H * 0.16, cx + headR * 1.5, shoulders - H * 0.16, cx + headR * 1.15 + j(5), shoulders - H * 0.02);
    ctx.bezierCurveTo(cx + W * 0.22, shoulders, cx + W * 0.4 + j(6), shoulders + H * 0.2, cx + W * 0.44, H);
    ctx.closePath();
    ctx.fillStyle = '#131a23'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#0c1118';
    ctx.beginPath();
    ctx.moveTo(cx, 0); ctx.lineTo(cx + W, 0); ctx.lineTo(cx + W, H); ctx.lineTo(cx, H); ctx.fill();
    ctx.restore();
    ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2.4, S * 0.2); ctx.stroke();
    // the rim on the lamp side, and the light landing on the shoulders
    ctx.strokeStyle = 'rgba(255,214,150,.62)'; ctx.lineWidth = Math.max(1.8, S * 0.18);
    ctx.beginPath();
    ctx.moveTo(cx - W * 0.4, H);
    ctx.bezierCurveTo(cx - W * 0.38, shoulders + H * 0.12, cx - W * 0.24, shoulders - H * 0.01, cx - headR * 0.9, H * 0.19);
    ctx.stroke();
    // a backlight down the far side, so a dark figure separates from a dark room
    ctx.strokeStyle = 'rgba(150,180,210,.30)'; ctx.lineWidth = Math.max(1.4, S * 0.12);
    ctx.beginPath();
    ctx.moveTo(cx + W * 0.42, H);
    ctx.bezierCurveTo(cx + W * 0.4, shoulders + H * 0.1, cx + headR * 1.5, H * 0.2, cx + headR * 1.2, H * 0.16);
    ctx.stroke();

    // the hat: brim and crown, each with its own tone and its own ink, both filled solid — an
    // unfilled brim reads as a floating hoop, which is exactly what it looked like
    ctx.beginPath();
    ctx.ellipse(cx + j(7), H * 0.175, headR * 2.6, headR * 0.44, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#2a3546'; ctx.fill();
    ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2.4, S * 0.2); ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx + j(7), H * 0.175, headR * 2.6, headR * 0.44, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,214,150,.34)';
    ctx.fillRect(cx - headR * 2.7, H * 0.175 - headR * 0.5, headR * 1.9, headR);
    ctx.fillStyle = 'rgba(0,0,0,.34)';
    ctx.fillRect(cx + headR * 0.4, H * 0.175 - headR * 0.5, headR * 2.4, headR);
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(cx + j(8), H * 0.095, headR * 1.3, headR * 0.95, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1c2530'; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2.4, S * 0.2); ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx + j(8), H * 0.095, headR * 1.3, headR * 0.95, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.fillRect(cx + headR * 0.2, 0, headR * 2, H);
    ctx.restore();
    // the cast shadow it drops on the counter
    ctx.beginPath();
    ctx.ellipse(cx, H + S * 0.25, W * 0.42, S * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fill();
  }

  /* ── bottle designs: seven silhouettes, so the shelf reads as seven products ── */
  const BOTTLES = {
    conclave: { w: 4.4, h: 11.5, bodyW: 3.4, neckW: 1.1, shoulder: 0.30, base: 0.5, corner: 0.5,
      tone: ['#3b4a5c', '#54697f', '#2a3644'], liquid: 0.52, liquidTone: 'rgba(20,26,34,.45)',
      label: { y: 0.44, h: 0.30 }, labelShape: 'tallBand', cap: 'stopper', spec: 'double',
      ink: 0.16, rim: 'rgba(255,206,150,.72)' },
    etoh: { w: 5.2, h: 10.0, bodyW: 4.4, neckW: 1.5, shoulder: 0.26, base: 0.6, corner: 0.6,
      tone: ['#5c4128', '#8a6136', '#3d2c1c'], liquid: 0.58, liquidTone: 'rgba(96,60,20,.42)',
      label: { y: 0.42, h: 0.32 }, labelShape: 'banner', cap: 'cork',
      ink: 0.18, rim: 'rgba(255,190,120,.72)' },
    lsd: { w: 4.0, h: 8.6, bodyW: 3.0, neckW: 0.9, shoulder: 0.40, base: 0.5, corner: 0.5,
      tone: ['#2f3340', '#494f63', '#232733'], liquid: 0.34, liquidTone: 'rgba(120,140,200,.22)',
      label: { y: 0.52, h: 0.18 }, labelShape: 'square', cap: 'dropper', spec: 'short',
      ink: 0.16, rim: 'rgba(190,210,255,.72)' },
    thc: { w: 5.6, h: 9.4, bodyW: 4.8, neckW: 1.7, shoulder: 0.34, base: 0.7, corner: 1.0,
      tone: ['#39502f', '#547a41', '#283a21'], liquid: 0.46, liquidTone: 'rgba(40,70,28,.4)',
      label: { y: 0.48, h: 0.28 }, labelShape: 'circle', cap: 'tin', spec: 'long',
      ink: 0.18, rim: 'rgba(200,240,170,.62)' },
    psi: { w: 5.0, h: 9.8, bodyW: 4.2, neckW: 1.3, shoulder: 0.42, base: 0.6, corner: 1.1,
      tone: ['#4a3a2c', '#6d5540', '#33281e'], liquid: 0.44, liquidTone: 'rgba(70,52,34,.42)',
      label: { y: 0.46, h: 0.26 }, labelShape: 'banner', cap: 'cork', spec: 'double',
      ink: 0.17, rim: 'rgba(255,220,180,.6)' },
    mdma: { w: 5.4, h: 8.2, bodyW: 4.6, neckW: 2.0, shoulder: 0.18, base: 0.6, corner: 0.5,
      tone: ['#5a3040', '#83485c', '#3d2029'], liquid: 0.40, liquidTone: 'rgba(120,50,80,.34)',
      label: { y: 0.44, h: 0.32 }, labelShape: 'tallBand', cap: 'screw', spec: 'short',
      ink: 0.17, rim: 'rgba(255,190,220,.66)' },
    ket: { w: 4.6, h: 10.6, bodyW: 3.8, neckW: 1.9, shoulder: 0.20, base: 0.55, corner: 0.5,
      tone: ['#33323f', '#4d4c60', '#242430'], liquid: 0.50, liquidTone: 'rgba(40,40,60,.4)',
      label: { y: 0.42, h: 0.34 }, labelShape: 'tallBand', cap: 'screw', spec: 'long',
      ink: 0.17, rim: 'rgba(200,200,240,.6)' },
  };

  function make(name, drawFn, def, wUnits, hUnits) {
    const list = [];
    for (let v = 0; v < VARIANTS; v++) {
      const c = canvases();
      c.width = Math.ceil(wUnits * SCALE) + Math.ceil(SCALE * 0.6);
      c.height = Math.ceil(hUnits * SCALE) + Math.ceil(SCALE * 0.6);
      const ctx = c.getContext('2d');
      ctx.translate(Math.ceil(SCALE * 0.3), Math.ceil(SCALE * 0.3));
      drawFn(ctx, def, v);
      list.push(c);
    }
    cache.set(name, { variants: list, wUnits, hUnits });
    return cache.get(name);
  }

  function init(frames, dose) {
    cache.clear();
    Object.keys(BOTTLES).forEach(key => {
      const def = Object.assign({}, BOTTLES[key]);
      const img = frames && frames[key];
      const drink = def.label ? def.label : null;
      const c = canvases();
      const pad = Math.ceil(SCALE * 0.3);
      c.width = Math.ceil(def.w * SCALE) + pad * 2;
      c.height = Math.ceil(def.h * SCALE) + pad * 2;
      const ctx = c.getContext('2d');
      ctx.translate(pad, pad);
      drawBottle(ctx, Object.assign({}, def, { label: drink ? Object.assign({}, drink, { img }) : null }), 0);
      // three variants, drawn separately so the boil is coherent
      const variants = [];
      for (let v = 0; v < VARIANTS; v++) {
        const cc = canvases();
        cc.width = c.width; cc.height = c.height;
        const cx2 = cc.getContext('2d');
        cx2.translate(pad, pad);
        drawBottle(cx2, Object.assign({}, def, { label: drink ? Object.assign({}, drink, { img }) : null }), v);
        variants.push(cc);
      }
      cache.set('bottle:' + key, { variants, wUnits: def.w, hUnits: def.h,
                                   pxW: def.w * SCALE, pxH: def.h * SCALE, pad: pad / 1 });
    });
    make('lamp', drawLamp, { w: 12, h: 7.5, shade: 7 }, 12, 7.5);
    make('bell', drawBell, { w: 5, h: 4 }, 5, 4);
    make('keeper', drawKeeper, { w: 16, h: 15 }, 16, 15);
    // record pixel sizes so blit() treats procedural and generated sprites identically
    cache.forEach((spr, name) => {
      if (!spr.pxW) { spr.pxW = spr.wUnits * SCALE; spr.pxH = spr.hUnits * SCALE; spr.pad = Math.ceil(SCALE * 0.3); }
    });
    return cache.size;
  }

  const boil = (t, framesPerDrawing = 140) => Math.floor(t / framesPerDrawing) % VARIANTS;

  /* Draw a sprite so its FOOTPRINT lands where you asked, regardless of how much padding the
     sprite carries or whether it is procedural (SCALE px per unit) or generated (its own
     resolution). Callers place objects in scene units and nothing else. */
  function blit(ctx, name, t, x, yBase, k, framesPerDrawing = 140) {
    const spr = cache.get(name);
    if (!spr) return false;
    const cv = spr.variants[boil(t, framesPerDrawing) % spr.variants.length];
    const uX = spr.wUnits / (spr.pxW || 1), uY = spr.hUnits / (spr.pxH || 1);
    const padX = (spr.pad || 0) * uX, padY = (spr.pad || 0) * uY;
    ctx.drawImage(cv, (x - spr.wUnits / 2 - padX) * k, (yBase - spr.hUnits - padY) * k,
                      cv.width * uX * k, cv.height * uY * k);
    return true;
  }

  /* Generated sprites: everything the image model produced, keyed to RGBA and composed, arriving
     as data URLs (a file:// image drawn into a canvas blocks getImageData, which is how an
     earlier round of measurements was silently lost). The boil is a 1px triangle offset of the
     same drawing — a true three-drawing boil needs the ink redrawn, which one generation cannot
     give, and that limit is recorded rather than papered over. */
  function loadGenerated(spec) {
    const jobs = [];
    const add = (name, entry) => new Promise(res => {
      if (!entry || !entry.src) return res();
      const img = new Image();
      img.onload = () => {
        const pad = 3;
        const OFFSETS = [[0, 0], [0.8, -0.5], [-0.6, 0.7]];
        const variants = OFFSETS.map(([dx, dy]) => {
          const c = document.createElement('canvas');
          c.width = img.width + pad * 2; c.height = img.height + pad * 2;
          const g = c.getContext('2d');
          g.imageSmoothingEnabled = true;
          g.imageSmoothingQuality = 'high';
          g.drawImage(img, pad + dx, pad + dy);
          return c;
        });
        cache.set(name, { variants, wUnits: entry.w, hUnits: entry.h,
                          pxW: img.width, pxH: img.height, pad,
                          generated: true, file: entry.file });
        res();
      };
      img.onerror = () => res();
      img.src = entry.src;
    });
    Object.entries(spec.bottle || {}).forEach(([k, v]) => jobs.push(add('gbottle:' + k, v)));
    Object.entries(spec.prop || {}).forEach(([k, v]) => jobs.push(add('g' + k, v)));
    Object.entries(spec.label || {}).forEach(([k, v]) => jobs.push(add('glabel:' + k, v)));
    return Promise.all(jobs).then(() => cache.size);
  }

  return { init, boil, blit, loadGenerated, get: n => cache.get(n), SCALE, VARIANTS, BOTTLES };
})();
