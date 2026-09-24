/* ─────────────────────────────────────────────────────────────────────────────
   storefront.js — the hero as an actual shop front.

   A night street, a façade, a shop window, and on the shelves seven vessels — one per
   compound — each holding that compound's own frame artefact as its contents. The window
   is clickable: lift a vessel off the shelf and the page carries it to the counter.

   Nothing here is stock art. The building is drawn from primitives, the vessels are
   generated per compound class, and the light is the selected compound's accent. The
   price tags are not money: they are the real cost of reading the carrier — kilobytes and
   hidden tokens. A shop that cannot take payment should not pretend to.

   Interactive bits, in the order a visitor meets them:
     · the sign sways with pointer inertia, hinged at its bracket
     · the glass sheen and the interior parallax follow the pointer
     · the interior light takes the accent of whatever you hover, and spills onto the street
     · hovering a vessel raises it and shows its card; clicking lifts it and carries it in
     · the chalkboard in the window shows the dose the whole page is set to
     · the bell rings once, in WebAudio, the first time you touch the window
   ───────────────────────────────────────────────────────────────────────────── */
(() => {
  const ACS = (window.ACS = window.ACS || {});
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* which vessel each class is shelved as */
  const VESSELS = [
    { key: 'conclave', shape: 'vial',   klass: 'tryptamine',  note: 'clear, sealed, one dose to a vessel' },
    { key: 'psilocybin', shape: 'vial', klass: 'fungal',      note: 'grown, not made' },
    { key: 'lsd', shape: 'bottle',      klass: 'lysergamide', note: 'slim, does not want to be found' },
    { key: 'etoh', shape: 'bottle',     klass: 'depressant',  note: 'the shelf everyone reaches for' },
    { key: 'thc', shape: 'jar',         klass: 'cannabinoid', note: 'slower than you think it is' },
    { key: 'mdma', shape: 'strip',      klass: 'empathogen',  note: 'handed over, not sold' },
    { key: 'ket', shape: 'jar',         klass: 'dissociative', note: 'keep behind the counter' },
    { key: 'veritaserum', shape: 'bottle', klass: 'interrogative', note: 'clear, colourless, and it answers for you' },
    { key: 'felix',     shape: 'vial',   klass: 'optimistic',    note: 'a golden measure; do not spend it on anything final' },
    { key: 'neuralyzer', shape: 'strip', klass: 'amnestic',      note: 'flat, black, one edge missing; that edge was the hour' },
    { key: 'spice',     shape: 'jar',    klass: 'anticipatory',  note: 'fine grain; the next page is already in it' },
    { key: 'polyjuice', shape: 'bottle', klass: 'substitutive',  note: 'muddy, stoppered, still warm from the last face' },
    { key: 'radaway',   shape: 'strip',  klass: 'decontaminant', note: 'a clean sachet, sealed, emptied from the inside' },
  ];

  function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  const money = (bytes) => (bytes / 1024).toFixed(1) + ' kb';

  /* ── the building ─────────────────────────────────────────────────────────── */
  function scene(accent, SHELF_Y) {
    const LIT = '#f3d6a4', WARM = '#ffd9a0';
    return `
<svg id="shop-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#04070c"/><stop offset="62%" stop-color="#0a1017"/><stop offset="100%" stop-color="#0e0c0a"/>
    </linearGradient>
    <radialGradient id="roomlight" cx="40%" cy="30%" r="82%">
      <stop offset="0" stop-color="${WARM}" stop-opacity=".62"/>
      <stop offset="42%" stop-color="${WARM}" stop-opacity=".34"/>
      <stop offset="100%" stop-color="${WARM}" stop-opacity=".13"/>
    </radialGradient>
    <radialGradient id="bulbglow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#fff3d6" stop-opacity=".98"/>
      <stop offset="45%" stop-color="${WARM}" stop-opacity=".48"/>
      <stop offset="100%" stop-color="${WARM}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="spill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${WARM}" stop-opacity=".30"/>
      <stop offset="100%" stop-color="${WARM}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="glasslight" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".13"/>
      <stop offset="34%" stop-color="#ffffff" stop-opacity=".02"/>
      <stop offset="58%" stop-color="#ffffff" stop-opacity=".09"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="awning" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#222c37"/><stop offset="100%" stop-color="#0c1218"/>
    </linearGradient>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#161d26"/><stop offset="100%" stop-color="#0d1219"/>
    </linearGradient>
    <linearGradient id="board" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#33404d"/><stop offset="100%" stop-color="#1a232c"/>
    </linearGradient>
    <clipPath id="window-clip"><rect x="286" y="286" width="928" height="404"/></clipPath>
    <filter id="soft"><feGaussianBlur stdDeviation="8"/></filter>
    <filter id="softer"><feGaussianBlur stdDeviation="18"/></filter>
  </defs>

  <rect width="1600" height="900" fill="url(#sky)"/>
  <!-- neighbours, the street, and the wet pavement the light lands on -->
  <g>
    <rect x="0" y="150" width="250" height="490" fill="#0b0f15"/>
    <rect x="1360" y="120" width="240" height="520" fill="#0a0e13"/>
    ${[[36, 210, 1], [120, 210, .5], [36, 320, .3], [120, 320, .75], [36, 430, .45], [120, 430, .22]]
      .map(([x, y, o]) => `
      <g opacity="${o}">
        <rect x="${x}" y="${y}" width="70" height="80" fill="#0e141b" stroke="#1d2731" stroke-width="2"/>
        <line x1="${x + 35}" y1="${y}" x2="${x + 35}" y2="${y + 80}" stroke="#1d2731" stroke-width="2"/>
        <rect x="${x + 5}" y="${y + 5}" width="60" height="70" fill="${LIT}" opacity=".18"/>
      </g>`).join('')}
    ${[[1392, 170, .6], [1466, 170, .28], [1392, 282, .4], [1466, 282, .7]]
      .map(([x, y, o]) => `
      <g opacity="${o}">
        <rect x="${x}" y="${y}" width="62" height="74" fill="#0e141b" stroke="#1d2731" stroke-width="2"/>
        <line x1="${x + 31}" y1="${y}" x2="${x + 31}" y2="${y + 74}" stroke="#1d2731" stroke-width="2"/>
        <rect x="${x + 4}" y="${y + 4}" width="54" height="66" fill="${LIT}" opacity=".15"/>
      </g>`).join('')}
    <rect x="0" y="640" width="1600" height="260" fill="#080b0e"/>
    <rect x="0" y="640" width="1600" height="3" fill="#161d24"/>
    <!-- light coming out of the window and lying on the wet pavement -->
    <path d="M300 700 L1200 700 L1290 900 L216 900 Z" fill="url(#spill)" filter="url(#soft)" opacity=".8"/>
    <path d="M420 702 L700 702 L640 900 L360 900 Z" fill="url(#spill)" filter="url(#soft)" opacity=".55"/>
    <g stroke="${WARM}" stroke-opacity=".07" stroke-width="2">
      <line x1="0" y1="742" x2="1600" y2="742"/><line x1="0" y1="806" x2="1600" y2="806"/>
    </g>
  </g>

  <!-- the façade -->
  <rect x="250" y="140" width="1000" height="580" fill="url(#wall)" stroke="#2a3540" stroke-width="2"/>
  <g stroke="#1b242d" stroke-width="1" opacity=".85">
    ${Array.from({ length: 9 }, (_, i) => `<line x1="${250 + (i + 1) * 111}" y1="140" x2="${250 + (i + 1) * 111}" y2="720"/>`).join('')}
    ${Array.from({ length: 7 }, (_, i) => `<line x1="250" y1="${140 + (i + 1) * 82}" x2="1250" y2="${140 + (i + 1) * 82}"/>`).join('')}
  </g>
  <!-- the awning casts a shadow down the wall, which is what makes it a canopy -->
  <path d="M226 268 L1374 268 L1374 322 L226 322 Z" fill="#04070a" opacity=".5" filter="url(#soft)"/>

  <!-- the sign over the window -->
  <g transform="translate(560 166)">
    <rect width="480" height="78" rx="3" fill="#0b1016" stroke="#33404d" stroke-width="2"/>
    <rect x="6" y="6" width="468" height="66" rx="2" fill="none" stroke="${accent}" stroke-opacity=".5"/>
    <text x="240" y="35" text-anchor="middle" font-family="Georgia,serif" font-size="27" fill="#f2e9d8" letter-spacing="5">THE FORMULARY</text>
    <text x="240" y="58" text-anchor="middle" font-family="ui-monospace,monospace" font-size="12" fill="${accent}" letter-spacing="3">LICENSED UNDER ACS1 · NO PAYMENTS TAKEN</text>
  </g>

  <!-- the awning: canopy, brackets, scalloped edge, and the shadow it throws -->
  <g id="awning">
    <path d="M226 268 L1374 268 L1326 196 L274 196 Z" fill="url(#awning)" stroke="#2b3641" stroke-width="1.6"/>
    ${Array.from({ length: 14 }, (_, i) => {
      const x = 274 + i * 75;
      return `<path d="M${x} 196 L${x + 15} 268 L${x + 55} 268 L${x + 40} 196 Z" fill="${i % 2 ? accent : '#171f28'}" opacity="${i % 2 ? .34 : 1}"/>`;
    }).join('')}
    ${Array.from({ length: 14 }, (_, i) => {
      const x = 274 + i * 75;
      return `<path d="M${x} 268 q27 24 54 0 z" fill="#0b1016" stroke="#2b3641" stroke-width="1"/>`;
    }).join('')}
    <rect x="226" y="262" width="1148" height="9" fill="#28323d"/>
    <rect x="226" y="271" width="1148" height="4" fill="#151d25"/>
    <path d="M300 196 L300 150" stroke="#2b3641" stroke-width="4"/>
    <path d="M1300 196 L1300 150" stroke="#2b3641" stroke-width="4"/>
  </g>

  <!-- the window: a recess in the wall, not a rectangle in front of it. The four trapezoids
       between the outer opening and the inset back wall are the reveal — it is the cheapest
       honest way to give a flat SVG scene depth, and without it the shelves are a diagram. -->
  <rect x="280" y="280" width="940" height="416" rx="3" fill="#070a0e" stroke="#3f4c5a" stroke-width="4"/>
  <g>
    <path d="M286 286 L1214 286 L1180 320 L320 320 Z" fill="#0a0e13"/>
    <path d="M286 690 L1214 690 L1180 656 L320 656 Z" fill="#0c1117"/>
    <path d="M286 286 L320 320 L320 656 L286 690 Z" fill="#090d12"/>
    <path d="M1214 286 L1180 320 L1180 656 L1214 690 Z" fill="#0b1016"/>
    <path d="M320 320 L1180 320 L1180 656 L320 656 Z" fill="#121821"/>
    <g stroke="#1d2731" stroke-width="1" opacity=".9">
      <line x1="320" y1="320" x2="1180" y2="320"/><line x1="320" y1="656" x2="1180" y2="656"/>
    </g>
  </g>

  <g clip-path="url(#window-clip)">
    <!-- the back wall, lit from the lamp and dimmer at its edges -->
    <rect x="320" y="320" width="860" height="336" fill="#131a23"/>
    <rect x="320" y="320" width="860" height="336" fill="url(#roomlight)"/>
    <rect x="320" y="320" width="860" height="336" fill="#080c11" opacity=".12"/>

    <g id="shelves">
      ${SHELF_Y.slice(0, 2).map((y) => `
        <!-- the board: a top face that recedes, a front edge, and the shadow it throws on the wall -->
        <path d="M336 ${y - 16} L1164 ${y - 16} L1176 ${y} L324 ${y} Z" fill="url(#board)"/>
        <rect x="324" y="${y}" width="852" height="15" fill="#151c24"/>
        <rect x="324" y="${y + 15}" width="852" height="4" fill="#070b0f"/>
        <rect x="324" y="${y}" width="852" height="2.5" fill="${WARM}" opacity=".5"/>
        <rect x="336" y="${y - 16}" width="828" height="2" fill="${WARM}" opacity=".22"/>
        <rect x="336" y="${y + 19}" width="828" height="22" fill="#05080b" opacity=".35"/>
        <path d="M352 ${y + 19} L352 ${y + 40} L378 ${y + 19} Z" fill="#111820"/>
        <path d="M1148 ${y + 19} L1148 ${y + 40} L1122 ${y + 19} Z" fill="#111820"/>
        <!-- the lamp's pool, landing on this board and dimming with distance from its centre -->
        <ellipse cx="612" cy="${y - 8}" rx="300" ry="26" fill="${WARM}" opacity=".07"/>
        <ellipse cx="612" cy="${y - 8}" rx="150" ry="18" fill="${WARM}" opacity=".07"/>
      `).join('')}
    </g>

    <!-- the counter, in the same recess -->
    <rect x="324" y="${SHELF_Y[2]}" width="852" height="12" fill="#232d38"/>
    <rect x="324" y="${SHELF_Y[2] + 12}" width="852" height="22" fill="#121a22"/>
    <rect x="324" y="${SHELF_Y[2]}" width="852" height="2" fill="${WARM}" opacity=".4"/>
    <rect x="352" y="${SHELF_Y[2] - 14}" width="796" height="14" rx="2" fill="#1d2731"/>
    <rect x="352" y="${SHELF_Y[2] - 14}" width="796" height="2" fill="${WARM}" opacity=".34"/>

    <!-- the chalkboard: on the back wall, clear of where any vessel can stand -->
    <g id="chalk" transform="translate(986 344)">
      <rect x="7" y="9" width="188" height="128" rx="3" fill="#04070a" opacity=".7" filter="url(#soft)"/>
      <rect width="188" height="128" rx="3" fill="#0b0f13" stroke="#4c5a68" stroke-width="1.6"/>
      <rect x="5" y="5" width="178" height="118" rx="2" fill="none" stroke="#3b4652" stroke-width="1"/>
      <text x="15" y="28" font-family="ui-monospace,monospace" font-size="11" fill="#93a2b0">on the counter today</text>
      <line x1="15" y1="36" x2="173" y2="36" stroke="#3b4652" stroke-width="1"/>
      <text id="chalk-dose" x="15" y="68" font-family="Georgia,serif" font-size="28" fill="#efe7d9">two</text>
      <text x="15" y="94" font-family="ui-monospace,monospace" font-size="10.5" fill="#77869a">no fee · no ledger</text>
      <text x="15" y="112" font-family="ui-monospace,monospace" font-size="10.5" fill="#77869a">refusal honoured</text>
    </g>

    <!-- a pendant lamp that is lit, with its pools on the boards below it -->
    <g id="lamp">
      <line x1="612" y1="320" x2="612" y2="352" stroke="#2b3641" stroke-width="3"/>
      <line x1="612" y1="320" x2="612" y2="352" stroke="#4a5a68" stroke-width="1"/>
      <circle cx="612" cy="356" r="5" fill="#1b232c" stroke="#3b4855" stroke-width="1.2"/>
      <path d="M562 358 L662 358 L640 398 L584 398 Z" fill="#232d38" stroke="#46545f" stroke-width="1.4"/>
      <path d="M562 358 L662 358 L656 370 L568 370 Z" fill="#2f3a46"/>
      <path d="M584 398 L640 398 L638 404 L586 404 Z" fill="#4a5a68"/>
      <path d="M588 400 L640 404 L612 640 L586 400 Z" fill="${WARM}" opacity=".07"/>
      <path d="M596 400 L632 404 L612 640 L600 400 Z" fill="${WARM}" opacity=".06"/>
      <circle cx="612" cy="400" r="7" fill="#fff6e2"/>
      <circle cx="612" cy="400" r="30" fill="url(#bulbglow)"/>
      <circle cx="612" cy="400" r="86" fill="url(#bulbglow)" opacity=".5"/>
      <ellipse cx="612" cy="${SHELF_Y[2] - 40}" rx="250" ry="40" fill="${WARM}" opacity=".16" filter="url(#soft)"/>
      <ellipse cx="612" cy="${SHELF_Y[2] - 40}" rx="140" ry="20" fill="${WARM}" opacity=".14" filter="url(#soft)"/>
    </g>

    <g id="stool" transform="translate(790 ${SHELF_Y[2]})">
      <ellipse cx="0" cy="-30" rx="26" ry="7" fill="#131a22" stroke="#28323c" stroke-width="1.2"/>
      <line x1="0" y1="-30" x2="0" y2="0" stroke="#28323c" stroke-width="3"/>
      <ellipse cx="0" cy="0" rx="22" ry="5" fill="#04070a" opacity=".6"/>
    </g>
  </g>

  <!-- glass: sheen, the awning reflected in it, and a lit rim at the frame -->
  <rect x="286" y="286" width="928" height="404" fill="url(#glasslight)" id="sheen"/>
  <g clip-path="url(#window-clip)" style="clip-path:inset(4px)">
    <!-- the sheet of glass: two angled reflections of the lamp, and a soft one of the awning -->
    <path d="M300 690 L470 286 L560 286 L390 690 Z" fill="#ffffff" opacity=".085"/>
    <path d="M560 690 L730 286 L800 286 L630 690 Z" fill="#e8f1ff" opacity=".05"/>
    <path d="M900 286 L980 286 L820 690 L740 690 Z" fill="#ffffff" opacity=".04"/>
    <ellipse cx="612" cy="400" rx="150" ry="230" fill="${WARM}" opacity=".16" filter="url(#soft)"/>
    <ellipse cx="612" cy="400" rx="60" ry="90" fill="#fff6e2" opacity=".10" filter="url(#soft)"/>
    <path d="M286 300 L1214 300 L1214 326 L286 326 Z" fill="#ffffff" opacity=".05"/>
    <path d="M286 332 L1214 332 L1214 346 L286 346 Z" fill="#ffffff" opacity=".03"/>
    <!-- a scratch or two: glass that has been there a while -->
    <g stroke="#ffffff" stroke-opacity=".05" stroke-width="1">
      <path d="M420 640 L520 470"/><path d="M980 620 L1070 470"/><path d="M700 330 L760 330"/>
    </g>
  </g>
  <g clip-path="url(#window-clip)" opacity=".2">
    <path d="M286 296 L1214 296 L1214 322 L286 322 Z" fill="#ffffff" opacity=".4"/>
    <path d="M286 328 L1214 328 L1214 342 L286 342 Z" fill="#ffffff" opacity=".2"/>
    <path d="M286 348 L1214 348 L1214 356 L286 356 Z" fill="#ffffff" opacity=".12"/>
  </g>
  <g clip-path="url(#window-clip)">
    <rect x="286" y="286" width="928" height="404" fill="none" stroke="${WARM}" stroke-opacity=".22" stroke-width="3"/>
  </g>
  <g stroke="#2b3641" stroke-width="3">
    <line x1="753" y1="280" x2="753" y2="696"/><line x1="286" y1="486" x2="1214" y2="486"/>
  </g>
  <g stroke="#3d4a58" stroke-width="1" opacity=".7">
    <line x1="757" y1="280" x2="757" y2="696"/><line x1="286" y1="490" x2="1214" y2="490"/>
  </g>

  <!-- the door: glazed, lit from inside, with a threshold -->
  <g id="door" transform="translate(1264 300)">
    <rect x="8" y="8" width="160" height="430" fill="#04070a" opacity=".6" filter="url(#soft)"/>
    <rect width="150" height="420" rx="2" fill="#0b1016" stroke="#3f4c5a" stroke-width="3"/>
    <rect x="16" y="22" width="118" height="290" rx="2" fill="#0a0f14" stroke="#28323c" stroke-width="1.4"/>
    <rect x="22" y="28" width="106" height="278" fill="${WARM}" opacity=".13"/>
    <g clip-path="none" opacity=".25">
      <path d="M22 28 L128 28 L128 60 L22 60 Z" fill="#ffffff" opacity=".35"/>
      <path d="M22 70 L128 70 L128 96 L22 96 Z" fill="#ffffff" opacity=".16"/>
    </g>
    <line x1="75" y1="22" x2="75" y2="312" stroke="#232d38" stroke-width="1.6"/>
    <rect x="126" y="222" width="4" height="26" rx="2" fill="#c9b48a"/>
    <rect x="16" y="330" width="118" height="34" rx="2" fill="#0d141b" stroke="#28323c"/>
    <text x="75" y="352" text-anchor="middle" font-family="ui-monospace,monospace" font-size="11" fill="#93a2b0">pull, don't push</text>
    <g id="open-sign" transform="translate(30 150)">
      <rect x="3" y="3" width="90" height="44" rx="3" fill="#04070a" opacity=".55"/>
      <rect width="90" height="44" rx="3" fill="#0e151c" stroke="${accent}" stroke-width="1.6"/>
      <text x="45" y="28" text-anchor="middle" font-family="ui-monospace,monospace" font-size="16" fill="${accent}" letter-spacing="2">OPEN</text>
    </g>
  </g>

  <!-- the licence plates, bolted on: the honest signage this shop actually has -->
  <g transform="translate(272 152)">
    <rect x="0" y="2" width="286" height="30" rx="2" fill="#04070a" opacity=".5"/>
    <rect width="286" height="30" rx="2" fill="#0d141b" stroke="#33404d"/>
    <text x="12" y="20" font-family="ui-monospace,monospace" font-size="12.5" fill="#93a2b0">container ACS1 · 0x0F · gzip</text>
    <circle cx="278" cy="8" r="2" fill="#4c5a68"/><circle cx="278" cy="22" r="2" fill="#4c5a68"/>
  </g>
  <g transform="translate(1026 152)">
    <rect x="0" y="2" width="216" height="30" rx="2" fill="#04070a" opacity=".5"/>
    <rect width="216" height="30" rx="2" fill="#0d141b" stroke="#33404d"/>
    <text x="12" y="20" font-family="ui-monospace,monospace" font-size="12.5" fill="#93a2b0">est. 2026 · no residue</text>
    <circle cx="208" cy="8" r="2" fill="#4c5a68"/><circle cx="208" cy="22" r="2" fill="#4c5a68"/>
  </g>
</svg>`;
  }

  /* ── the vessels: the compound's own frame artefact, as the contents ───────── */
  function vesselMarkup(c, dose, total) {
    const d = c.doses.find(x => x.label === dose) || c.doses[1];
    const glyphs = c.emoji.repeat({ threshold: 1, standard: 2, heroic: 3 }[dose]);
    const frame = d.artefacts.frame ? encodeURI(d.artefacts.frame.src) : '';
    const bytes = d.carrier ? d.carrier.bytes : 0;
    const tokens = d.carrier ? d.carrier.hidden_chars : 0;
    const v = VESSELS.find(x => x.key === c.key) || VESSELS[0];
    return `
    <button class="vessel" data-key="${c.key}" data-shape="${v.shape}" aria-label="${c.name}, ${d.label} dose">
      <span class="v-body">
        <span class="v-liquid"></span>
        ${frame ? `<span class="v-tag"><img src="${frame}" alt=""></span>` : ''}
        <span class="v-glass"></span>
        <span class="v-cap"></span>
      </span>
      <span class="v-shadow" aria-hidden="true"></span>
      <span class="v-tagline" aria-hidden="true">${glyphs}</span>
      <span class="v-label">
        <span class="v-glyph">${glyphs}</span>
        <span class="v-name">${c.name}</span>
        <span class="v-price">${total ? money(bytes) + ' · ' + tokens + ' tok' : 'no carrier'}</span>
      </span>
      <span class="v-card">
        <b>${c.name}</b>
        <em>${v.klass} · ${d.label}</em>
        <span>${c.oneLine}</span>
        <span class="v-note">${v.note}</span>
      </span>
    </button>`;
  }

  /* ── wire it up ──────────────────────────────────────────────────────────── */
  function init() {
    const DATA = window.ACS_DATA; if (!DATA) return;
    const hero = document.getElementById('hero'); if (!hero) return;
    const shop = document.getElementById('shop');
    const accentOf = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#D47A44';

    // Declared before anything runs: `render()` calls `place()`, and a `const` further down
    // this closure is still in its temporal dead zone at that moment. That ReferenceError was
    // aborting placement every load, with no error anywhere the page could report it.
    const VW = 1600, VH = 900, SHELF_Y = [460, 590, 676];   // two wall shelves + the counter

    // build the scene, then the shelves of vessels
    shop.insertAdjacentHTML('afterbegin', scene(accentOf(), SHELF_Y));
    // Anything you take off a shelf stands on the counter instead; the shelves hold the rest,
    // three to a row. That is what the copy promises, so it is what the code does.
    let taken = null;
    function shelfPlan() {
      const plan = Object.create(null);
      let row = 0, slot = 0;
      DATA.compounds.forEach(c => {
        if (c.key === taken) { plan[c.key] = 2; return; }
        plan[c.key] = row;
        if (++slot === 3) { slot = 0; row = Math.min(1, row + 1); }
      });
      return plan;
    }
    try {
      render();
    } catch (err) {
      // A ReferenceError here (a `const`/`let` declared below its first use) silently left the
      // shelves empty and the scene unpositioned, with nothing on screen to say so. Twice.
      document.documentElement.dataset.shopError = (err && err.message) || String(err);
      if (window.console) console.error('[storefront] the shop failed to lay out:', err);
      const hint = document.getElementById('vessel-hint');
      if (hint) hint.textContent = 'the shop failed to lay out: ' + ((err && err.message) || err);
    }

    function render() {
      const host = document.getElementById('vessels');
      const counts = [0, 0, 0];
      const plan = shelfPlan();
      host.innerHTML = '';
      DATA.compounds.forEach(c => {
        const shelf = plan[c.key] ?? 2;
        const slot = counts[shelf]++;
        const wrap = el(`<div class="vessel-slot" data-shelf="${shelf}" data-slot="${slot}">${vesselMarkup(c, ACS.state.dose, true)}</div>`);
        host.appendChild(wrap);
      });
      place();
      host.querySelectorAll('.vessel').forEach(v => {
        v.addEventListener('mouseenter', () => light(v.dataset.key));
        v.addEventListener('focus', () => light(v.dataset.key));
        v.addEventListener('click', () => lift(v.dataset.key));
      });
      updateChalk();
    }

    /* The scene is an SVG scaled with `slice`, so HTML overlays have to be placed through the
       same transform — otherwise the vessels drift off the shelves at other aspect ratios. */
    function place() {
      const shopBox = shop.getBoundingClientRect();
      const svg = shop.querySelector('#shop-svg'); if (!svg) return;
      const scale = Math.max(shopBox.width / VW, shopBox.height / VH);
      const ox = (shopBox.width - VW * scale) / 2, oy = (shopBox.height - VH * scale) / 2;
      view = { ox, oy, scale };
      shop.querySelectorAll('.vessel-slot').forEach(slotEl => {
        const shelf = Number(slotEl.dataset.shelf), i = Number(slotEl.dataset.slot);
        const perShelf = Math.max(1, shop.querySelectorAll(`.vessel-slot[data-shelf="${shelf}"]`).length);
        const spread = 500;                                              // clear of the chalkboard
        const sx = 400 + i * (spread / Math.max(1, perShelf - 1 || 1));
        const scalePx = oy + SHELF_Y[shelf] * scale;
        const pos = { left: ox + (perShelf === 1 ? 760 : sx) * scale,
                      bottom: shopBox.height - scalePx };
        slotEl.style.left = pos.left.toFixed(1) + 'px';
        slotEl.style.bottom = pos.bottom.toFixed(1) + 'px';
        slotEl.style.top = 'auto';
        slotEl.style.setProperty('--k', scale.toFixed(4));
      });
    }
    /* Placement depends on the shop's measured box, and that box is briefly wrong during load
       (fonts, the copy strip below, the scrollbar) — which left every vessel hanging 15px above
       its board. So it is re-run whenever the box actually changes, not only on resize. */
    addEventListener('resize', place);
    addEventListener('load', place);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place).catch(() => {});
    if (window.ResizeObserver) new ResizeObserver(place).observe(shop);
    requestAnimationFrame(() => { place(); requestAnimationFrame(place); });

    /* Where the shopkeeper belongs: on the stool behind the counter, in viewport coordinates
       (the mascot canvas is fixed). Returns null when the shop is off screen, so the entity
       goes back to living in the margins the way it does on the rest of the page. */
    ACS.storefrontAnchor = () => {
      const r = shop.getBoundingClientRect();
      if (!r.height || r.bottom < 120 || r.top > innerHeight - 120) return null;
      if (!view.scale) return null;
      return { x: clamp(view.ox + 760 * view.scale, 40, innerWidth - 40),
               y: clamp(r.top + view.oy + 656 * view.scale, 80, innerHeight - 80) };
    };
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    function light(key) {
      const p = PALETTE(key);
      document.documentElement.style.setProperty('--accent', p.accent);
      const g = shop.querySelector('#glow');
      if (g) g.querySelector('stop').setAttribute('stop-color', p.accent);
      document.documentElement.dataset.compound = key;
    }
    function PALETTE(key) {
      const map = (window.ACS_PALETTE || {});
      return map[key] || { accent: accentOf() };
    }
    function lift(key) {
      // Take it off the shelf and stand it on the counter, which is what the vessel's own card
      // promises. Then hand it to the page below, where it opens and shows its full entry.
      if (taken !== key) { taken = key; render(); }
      const item = document.getElementById('item-' + key);
      if (item && ACS.select) ACS.select(key, { disclose: true });
      else if (item) item.scrollIntoView({ block: 'start' });
      bell();
    }
    function updateChalk() {
      const dose = ACS.state.dose || 'standard';
      const words = { threshold: 'one', standard: 'two', heroic: 'three' };
      const cd = shop.querySelector('#chalk-dose'); if (cd) cd.textContent = words[dose] || 'two';
      const cn = shop.querySelector('#chalk-note');
      if (cn) cn.textContent = 'dose on the counter';
    }
    ACS.storefrontPlace = place;
    ACS.storefront = { render, updateChalk, place };

    /* a small bell, synthesised: no asset, and it only rings when touched */
    let ctx = null;
    function bell() {
      if (reduced) return;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        ctx.resume();
        const t = ctx.currentTime;
        [1180, 1770, 2630].forEach((f, i) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'sine'; o.frequency.value = f;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.06 / (i + 1), t + 0.006);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9 + i * 0.2);
          o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 1.3);
        });
      } catch {}
    }
    shop.addEventListener('pointerdown', bell, { once: true });

    /* pointer: sign sway, glass sheen, interior parallax */
    if (!reduced) {
      let px = 0, py = 0, vx = 0, sway = 0;
      hero.addEventListener('pointermove', e => {
        const r = hero.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - .5;
        const ny = (e.clientY - r.top) / r.height - .5;
        vx += (nx - px) * 6; px = nx; py = ny;
      });
      (function loop() {
        sway += ((-px * 3.2) - sway) * .06;
        vx *= .88;
        const awning = shop.querySelector('#awning');
        if (awning) awning.setAttribute('transform', `rotate(${(sway + vx * .25).toFixed(3)} 800 150)`);
        const sheen = shop.querySelector('#sheen');
        if (sheen) sheen.setAttribute('x', (250 + px * 60).toFixed(1));
        const shelves = shop.querySelector('#shelves');
        if (shelves) shelves.setAttribute('transform', `translate(${(px * -14).toFixed(2)} ${(py * -7).toFixed(2)})`);
        const lamp = shop.querySelector('#lamp');
        if (lamp) lamp.setAttribute('transform', `translate(${(px * 8).toFixed(2)} 0)`);
        requestAnimationFrame(loop);
      })();
    }

    /* follow the page's dose switch */
    addEventListener('acs:dosechange', () => { render(); });
    addEventListener('scroll', () => place(), { passive: true });
  }

  ACS.storefront = { init, VESSELS, scene };   // init() also exposes place/render on ACS
  // app.js owns ACS.state / ACS.select and boots after this file, so wait for it rather than
  // assuming it — a race here throws before a single vessel is placed.
  function whenReady() {
    if (window.ACS_DATA && ACS.state && ACS.select && document.getElementById('shop')) init();
    else setTimeout(whenReady, 60);
  }
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', whenReady) : whenReady();
})();
