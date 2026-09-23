/* ─────────────────────────────────────────────────────────────────────────────
   mascot.js — twelve poses and the thing that decides which one to use.

   A sprite sheet is vocabulary; a mascot is grammar. This holds a small state machine
   driven by what is actually happening: where the pointer is, how long since anything
   happened, what was just taken off the shelf, and the temperament of the compound in
   hand. The compound still colours everything, the way it colours the clerk's lean:
   alcohol and ketamine make it sleepy sooner, MDMA makes it want attention, psilocybin
   makes it dreamy and slow, LSD makes it restless, THC makes it wander.

   It walks. Poses whose character faces left or right are used for actual movement along
   the counter toward the pointer, not just swapped in place.
   ───────────────────────────────────────────────────────────────────────────── */
window.MASCOT = (() => {
  const POSES = [
    // sheet one
    'idle_a', 'idle_blink', 'cheer_a', 'arms_up', 'idle_b', 'sleep',
    'cheer_b', 'surprised', 'shy', 'sad', 'walk_right', 'walk_left',
    // sheet two, drawn lit from the upper left: actions and a rear view to wander with
    'idle2', 'arms_out', 'content2', 'rest_side', 'wave', 'hold_bottle',
    'hold_bell', 'cheer_up', 'away_a', 'away_b', 'away_c', 'away_d',
  ];
  // which poses are already drawn facing left; the rest are flipped to match the direction
  const SIDE = { walk_right: 1, walk_left: -1, away_a: 1, away_b: 1, away_c: 1, away_d: 1 };
  const IDLE_CYCLE = ['idle_a', 'idle_b', 'idle2', 'content2'];   // four, so the loop breathes

  /* Temperament per compound: how fast it fidgets, how soon it naps, how much it wants you. */
  const TEMPER = {
    conclave: { fidget: 1.0, nap: 22, want: 0.8, walk: 2.6 },
    etoh:     { fidget: 0.45, nap: 9,  want: 0.5, walk: 1.2 },
    lsd:      { fidget: 1.7, nap: 40, want: 0.9, walk: 3.4 },
    thc:      { fidget: 0.9, nap: 26, want: 0.6, walk: 2.0 },
    psi:      { fidget: 0.55, nap: 16, want: 0.7, walk: 1.6 },
    mdma:     { fidget: 1.2, nap: 30, want: 1.5, walk: 3.0 },
    ket:      { fidget: 0.35, nap: 7,  want: 0.3, walk: 1.0 },
  };

  const s = {
    pose: 'idle_a', poseSince: 0, clock: 0,     // an accumulated clock, monotonic by construction
    tRaw: 0, lastInteract: 0, lastTake: -99, lastPoke: -99, lastRing: -99,
    facing: 1, x: null, bob: 0, blinkUntil: 0, nextBlink: 2.5, hop: 0,
    dwell: 0,                 // seconds in the current pose, for transitions that must hold
  };
  /* Bake the shop's light into each pose once, at load.
     Drawn flat, the sprite read as a sticker: every other thing in the scene picks up the warm
     glow and darkens as it falls away from the lamp, and it did neither. `source-atop` tints only
     where the sprite is already opaque, so its silhouette and cut edges are untouched. */
  function lightIt(img) {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    const iw = c.width, ih = c.height;
    const diag = x.createLinearGradient(0, 0, iw, ih);      // the lamp is above and to the left
    diag.addColorStop(0.00, 'rgba(255,224,176,.42)');       // warm on the lit side
    diag.addColorStop(0.45, 'rgba(255,196,140,.00)');
    diag.addColorStop(1.00, 'rgba(24,18,42,.58)');          // cool and dim away from it
    x.fillStyle = diag; x.fillRect(0, 0, iw, ih);
    const down = x.createLinearGradient(0, ih * 0.45, 0, ih);  // and darker toward its feet
    down.addColorStop(0, 'rgba(20,14,26,0)');
    down.addColorStop(1, 'rgba(20,14,26,.44)');
    x.fillStyle = down; x.fillRect(0, 0, iw, ih);
    x.globalCompositeOperation = 'source-over';
    return c;
  }

  const sprites = {}, lit = {};
  let unitH = 10;             // height of the mascot in scene units

  function load(data) {
    unitH = (data && data.unitH) || unitH;
    const jobs = POSES.map(p => new Promise(res => {
      const src = data && data.poses && data.poses[p];
      if (!src) return res();
      const img = new Image();
      img.onload = () => { sprites[p] = img; try { lit[p] = lightIt(img); } catch (e) {} res(); };
      img.onerror = () => res();
      img.src = src;
    }));
    return Promise.all(jobs).then(() => Object.keys(sprites).length);
  }

  /* Events the page feeds in. A mascot that cannot be poked is a decoration. */
  function poke() { s.lastPoke = s.clock; s.dwell = 0; }
  function took() { s.lastTake = s.clock; s.dwell = 0; }
  function rang() { s.lastRing = s.clock; s.dwell = 0; }
  function interact() { s.lastInteract = s.clock; }
  /* Move its clock without drawing. The dt clamp means one drawn frame advances it by at most
     0.05s, so testing "does it eventually fall asleep" would otherwise need hundreds of frames. */
  function advance(seconds) { s.clock += Math.max(0, seconds); }

  /* Choose the pose. Ordered by urgency: having just been poked beats having just been
     given a bottle, which beats curiosity, which beats boredom. */
  function choose(ctx) {
    const temper = TEMPER[ctx.compound] || TEMPER.conclave;
    const idle = s.clock - s.lastInteract;
    const sincePoke = s.clock - s.lastPoke;
    const sinceTake = s.clock - s.lastTake;
    const sinceRing = s.clock - s.lastRing;
    // thresholds derived from the one number that exists — `nap` — rather than a second field
    const dozeAfter = Math.max(6, temper.nap * 0.5);
    const asleepAfter = Math.max(11, temper.nap);

    // the pointer rests on the creature: it gets shy about it
    if (underPointer(ctx) && sincePoke < 0.9) return 'shy';
    // it was handed something: it holds the bottle up to you, then celebrates
    if (sinceTake < 1.2) return 'hold_bottle';
    if (sinceTake < 2.1) return 'cheer_up';
    // a dose was chosen: it rings the bell
    if (sinceRing < 1.5) return 'hold_bell';

    // going somewhere outranks resting there: otherwise it would doze through its own walk
    const moving = ctx.walkTarget != null && Math.abs(ctx.walkTarget - s.x) > 0.4;
    if (moving) {
      if (!ctx.pointer.active)                          // pottering about on its own, seen from behind
        return ['away_a', 'away_b', 'away_c', 'away_d'][Math.floor(s.clock * 3.4) % 4];
      return ctx.walkTarget > s.x ? 'walk_right' : 'walk_left';
    }

    if (idle > asleepAfter) return 'sleep';             // properly asleep
    if (idle > dozeAfter) return 'rest_side';           // dozing, on its side
    // the pointer is on the counter: it comes over and waves
    if (underPointer(ctx, 11) && sincePoke > 1.2) return 'wave';
    if (sincePoke < 1.4) return 'surprised';
    if (s.clock < s.blinkUntil) return 'idle_blink';
    if (ctx.empty) return 'sad';
    return IDLE_CYCLE[Math.floor(s.clock * 0.5 * temper.fidget) % IDLE_CYCLE.length];
  }

  function underPointer(ctx, within) {
    const d = ctx.pointerDist;
    if (d == null || d > (within || 8)) return false;
    return !!(ctx.pointer && ctx.pointer.active);
  }

  /* Advance and draw. `k` is pixels per scene unit, `x`/`y` are scene units. */
  function draw(g, t, ctx) {
    const dt = Math.min(0.05, Math.max(0, t / 1000 - s.tRaw));   // never jumps, however t arrives
    s.tRaw = t / 1000;
    s.clock += dt;
    const temper = TEMPER[ctx.compound] || TEMPER.conclave;
    const pt = ctx.pointer || { active: false, x: 0.5 };
    const k = ctx.k || 1;                        // pixels per scene unit — documented, then unbound

    // walk: an actual position, clamped to the stretch of counter it is allowed to use
    if (s.x == null) s.x = ctx.home;
    // with a pointer it follows; with none it potters for a while, then goes home and settles
    const sinceAny = s.clock - s.lastInteract;
    const pottering = !pt.active && sinceAny > 3 && sinceAny < Math.max(6, temper.nap * 0.5);
    const want = pt.active && ctx.walkRange && pt.x > 0.35
      ? Math.max(ctx.walkRange[0], Math.min(ctx.walkRange[1],
          ctx.home + (pt.x - 0.5) * 9 * (0.6 + temper.want * 0.4)))
      : (ctx.walkRange && pottering
          ? ctx.walkRange[0] + (ctx.walkRange[1] - ctx.walkRange[0]) *
            (0.5 + 0.5 * Math.sin(s.clock * 0.11 * temper.fidget))
          : ctx.home);
    const step = temper.walk * dt;
    if (Math.abs(want - s.x) > 0.05) s.x += Math.sign(want - s.x) * Math.min(step, Math.abs(want - s.x));
    if (Math.abs(want - s.x) > 0.5) s.facing = Math.sign(want - s.x);

    // hand it the real target, or the walk poses can never fire and it slides sideways while
    // standing still — which is exactly what it did
    const pose = choose(Object.assign({}, ctx, { walkTarget: want }));
    if (pose !== s.pose) { s.pose = pose; s.poseSince = s.clock; }

    // blink on its own clock, so a still pose still has a heartbeat
    if (s.clock > s.nextBlink && s.pose.startsWith('idle')) {
      s.blinkUntil = s.clock + 0.13;
      s.nextBlink = s.clock + 2.2 + Math.random() * 3.4 * temper.fidget;
    }

    const img = lit[pose] || sprites[pose] || lit.idle_a || sprites.idle_a;
    if (!img) return false;
    const h = (ctx.unitH || unitH) * k;
    const w = h * (img.width / img.height);
    // a bob while idle, a hop right after being given something
    const hop = Math.max(0, 1 - (s.clock - s.lastTake) / 0.5);
    const bob = Math.sin(s.clock * (2.6 * temper.fidget)) * 0.12 * k + hop * Math.sin(hop * Math.PI) * 2.2 * k;
    const squash = 1 + hop * 0.06;

    // the shadow first, so it is UNDER the creature rather than painted across its feet
    g.beginPath();
    // matched to the bottle's shadow, which is the only thing in the scene it should agree with
    g.ellipse(ctx.x * k, ctx.y * k, (w * 0.46), (w * 0.14), 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(0,0,0,.62)'; g.fill();
    g.save();
    g.imageSmoothingEnabled = false;                 // it is pixel art: keep it crisp
    g.translate(ctx.x * k, (ctx.y) * k - bob);
    const flip = (SIDE[pose] || s.facing) < 0 ? -1 : 1;
    g.scale(flip, squash);
    g.drawImage(img, -w / 2, -h, w, h);
    g.restore();
    g.imageSmoothingEnabled = true;

    return true;
  }

  return { load, draw, poke, took, rang, interact, advance, POSES,
           loaded: () => Object.keys(sprites).length,
           state: () => ({ pose: s.pose, x: s.x, facing: s.facing, clock: +s.clock.toFixed(2),
                           sinceInteract: +(s.clock - s.lastInteract).toFixed(2) }) };
})();
