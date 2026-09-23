/* ─────────────────────────────────────────────────────────────────────────────
   world.js — the shop, described once, in its own units (160 × 90).

   Three renderers draw this same description three different ways: a software
   pixel rasteriser, a hand-inked cartoon, and an atmospherically lit realist
   pass. Keeping the scene out of the renderers is the whole point of the
   exercise — otherwise comparing the looks compares the bugs.

   Units: 160 wide, 90 tall. The nominal street line is y = 62.
   Compound data (names, classes, artefacts, real costs) comes from the built
   page's own ACS_DATA, so nothing here can drift from the formulary.
   ─────────────────────────────────────────────────────────────────────────── */
window.WORLD = {
  /* 220 x 124, still 16:9. Three rows and a shelf tag under each need 60 units of window height:
     a 14.4-unit bottle plus a 6-unit tag, twice, plus a 13.3-unit bottle standing on the counter.
     At 37 units (the original) a tag could only ever hang into the row beneath it; at 52 it still
     clipped. These bands are computed, not guessed. */
  W: 220, H: 124,
  street: 96,

  facade: { x: 20, y: 6, w: 180, h: 90 },
  sign:   { x: 65, y: 10, w: 54, h: 7 },
  awning: { x: 18, y: 20, w: 184, h: 9 },           // canopy: 20 -> 29, scalloped at 29
  window: { x: 32, y: 32, w: 120, h: 60 },          // the glazed opening
  reveal: 3,                                        // how deep the opening is recessed

  shelves: [47, 66],                                // board top faces, front edge
  board:   2,                                       // board thickness
  counter: 86,                                      // the counter top, inside the glass
  counterFront: 4,                                  // its front face, down to the sill

  /* the wall the awning darkens. Without it an awning is a stripe sitting on a flat wall. */
  awningShadow: { y: 29, h: 5 },

  /* The lamp hangs BETWEEN the first two columns. The chalkboard is out on the facade beside the
     window, which is where a shop keeps one and where it cannot fight the shelves for room. */
  lamp:  { x: 67, y: 34, drop: 5, shade: 7, halo: 12, cone: 24 },
  chalk: { x: 156, y: 40, w: 18, h: 13 },
  door:  { x: 180, y: 38, w: 16, h: 34 },

  vessel: { w: 8, h: 11 },                          // one compound, in scene units
  /* Three to a shelf at 38 units apart across a 120-unit window: 24 units of clear air between
     two bottles, and a label plate hangs in the space each row was given. */
  rowX: [48, 86, 124],
  counterX: 66,                                     // the one you have taken
  keeperX: 140, keeperBase: 90,                     // behind the counter, right of the bottles
  bellX: 106,                                       // on the counter, for the one you take
  tagW: 5.2, tagH: 6.0, tagDrop: 6.0,               // the shelf tag, and how far it hangs
  /* the mascot: it stands where the keeper stood, behind the counter, at the keeper's size — the
     robot is gone and this is what the shop keeps instead. `range` is the stretch of floor behind
     the counter it may walk along while following you. */
  mascot: { x: 140, y: 90, range: [122, 166], unitH: 23 },
};

/* Where each vessel stands. Six slots on the boards (three to a shelf) and one on the counter —
   so exactly one compound is off the shelf at any time, and no two ever share a position. With
   seven compounds and a naively wrapped layout the seventh silently lands on the fourth. */
window.WORLD.plan = function (compounds, takenKey) {
  const W = window.WORLD;
  const counterKey = takenKey || (compounds[compounds.length - 1] || {}).key;
  const out = [];
  let slot = 0;
  compounds.forEach(c => {
    if (c.key === counterKey) { out.push({ key: c.key, x: W.counterX, y: W.counter, on: 'counter' }); return; }
    out.push({ key: c.key, x: W.rowX[slot % 3], y: W.shelves[slot < 3 ? 0 : 1], on: 'shelf' });
    slot++;
  });
  return out;
};

/* A warm-to-cool palette, shared so the three renderers are comparable. */
window.PAL = {
  ink:      '#04060a',
  night:    '#080d14',
  wall:     '#131b24',
  wallLit:  '#2b3644',
  board:    '#2c3743',
  boardLit: '#48576a',
  warm:     '#ffd9a0',
  warmDim:  '#a37b46',
  glass:    '#8fb4d6',
  glassDim: '#3d5a75',
  paper:    '#e8dfcc',
  door:     '#0d141b',
  accent:   '#d47a44',
  stone:    '#171d25',
  water:    '#0b1219',
};
