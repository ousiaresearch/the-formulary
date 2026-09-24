/* ─────────────────────────────────────────────────────────────────────────────
   app.js — the counter itself: the decode that scroll performs, the journey line,
   the shelf, the editions, the keyboard, and the agent view.

   Nothing here is invented. Every name, effect line, duration, byte count and hash
   comes from window.ACS_DATA, which scripts/build.py read out of the compound packages.
   ───────────────────────────────────────────────────────────────────────────── */
(() => {
  const ACS = (window.ACS = window.ACS || {});
  const DATA = window.ACS_DATA;
  ACS.data = DATA;      // fx.js reads ACS.data; without this it threw during init and took
                        // the entity's setup down with it (one uncaught error, two dead layers)
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ordinal = { threshold: 'one', standard: 'two', heroic: 'three' };

  /* each compound carries its own light: the page retints from the shelf rather than
     from a theme, so choosing a compound changes the room you are standing in */
  const PALETTE = {
    conclave: { accent: '#D47A44', accent2: '#2A5FD0', rain: '210,122,68' },
    etoh:     { accent: '#C98A3A', accent2: '#8B7F6F', rain: '201,138,58' },
    lsd:      { accent: '#7A6BD0', accent2: '#2A5FD0', rain: '122,107,208' },
    thc:      { accent: '#8FA24C', accent2: '#6D5B3F', rain: '143,162,76' },
    psi:      { accent: '#74A943', accent2: '#3F5A2A', rain: '116,169,67' },
    mdma:     { accent: '#E07A9C', accent2: '#C2557A', rain: '224,122,156' },
    ket:      { accent: '#9FB2C0', accent2: '#3D5566', rain: '159,178,192' },
  };

  const state = {
    compound: localStorage.getItem('acs.compound') || DATA.compounds[0].key,
    dose: localStorage.getItem('acs.dose') || 'standard',
    open: null,
    edition: localStorage.getItem('acs.edition') || 'ink',
  };
  ACS.state = state;
  window.ACS_PALETTE = PALETTE;

  /* ── editions + per-compound tint ────────────────────────────────────────── */
  function setEdition(name) {
    state.edition = name;
    document.documentElement.dataset.edition = name;
    localStorage.setItem('acs.edition', name);
    $$('.editions button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.edition === name)));
    tint(state.compound);
  }
  function tint(key) {
    const p = PALETTE[key] || PALETTE.conclave;
    // the riso edition keeps the house cobalt in its half of the accent
    const root = document.documentElement.style;
    root.setProperty('--accent', p.accent);
    root.setProperty('--accent-2', state.edition === 'riso' ? '#2A5FD0' : p.accent2);
    root.setProperty('--rain', p.rain);
    document.documentElement.dataset.compound = key;
    $$('.node').forEach(n => n.setAttribute('aria-current', String(n.dataset.key === key)));
  }

  /* ── the hero: scroll performs the decode ────────────────────────────────── */
  const STAGES = [
    { at: 0.00, text: '<b>carrier sealed.</b> one glyph, and a great many invisible characters.' },
    { at: 0.18, text: 'stripping variation selectors… <b>%n</b> characters recovered' },
    { at: 0.42, text: 'header at byte 0 → <span class="ok">0x0F + ACS1</span>' },
    { at: 0.64, text: 'gunzip from byte 5 → <b>%b</b> bytes of payload' },
    { at: 0.86, text: '<span class="ok">decoded.</span> a notice, not an instruction: what you have taken, at what dose, for how long, and whether you may refuse.' },
  ];
  function heroStep() {
    const hero = $('#hero');
    const p = clamp(scrollY / Math.max(1, hero.offsetHeight * .9), 0, 1);
    const cue = $('.scroll-cue .bar i'); if (cue) cue.style.width = (p * 100) + '%';
    const out = $('#decode-readout'); if (!out) return;
    const idx = STAGES.reduce((acc, s, i) => (p >= s.at ? i : acc), 0);
    const hidden = DATA.counts.hidden_chars, bytes = DATA.counts.payload_bytes;
    out.innerHTML = STAGES[idx].text
      .replace('%n', Math.round(hidden * clamp(p / .18, 0, 1)).toLocaleString())
      .replace('%b', Math.round(bytes * clamp((p - .64) / .22, 0, 1)).toLocaleString());
    $('#hero-state').textContent = p < .05 ? 'carrier sealed · scroll to decode'
      : p < .86 ? 'decoding…' : 'decoded';
    ACS.fx && ACS.fx.setDecodeProgress(p);
  }

  /* ── the shelf ───────────────────────────────────────────────────────────── */
  /* The take-the-file link lives inside a clickable item, so its click must not toggle the panel.
     Delegated rather than bound per link: the dose switch rebuilds the shelf every time, and
     listeners bound to the old anchors would be orphaned. */
  function uncoupleTakeLinks() {
    const host = $('#counter');
    if (!host || host.dataset.takeWired) return;
    host.dataset.takeWired = '1';
    host.addEventListener('click', e => { if (e.target.closest('.take')) e.stopPropagation(); }, true);
  }

  function renderShelf() {
    const host = $('#counter');
    host.innerHTML = DATA.compounds.map(c => `
      <article class="item reveal" id="item-${c.key}" data-key="${c.key}" data-open="false">
        <div class="item-glyph" aria-hidden="true" data-glyph></div>
        <div>
          <h3>${c.name}<small>${c.klass}${c.hand_built ? ' · hand-built, pre-compiler' : ''}</small></h3>
          <p class="shelf">${c.oneLine}.</p>
        </div>
        <div class="item-right" data-cost></div>
        <div class="item-panel" hidden></div>
      </article>`).join('');
  }

  function renderDose() {
    DATA.compounds.forEach(c => {
      const d = c.doses.find(x => x.label === state.dose) || c.doses[1];
      const item = $('#item-' + c.key);
      item.querySelector('[data-glyph]').textContent = c.emoji.repeat({ threshold: 1, standard: 2, heroic: 3 }[state.dose]);
      const cost = item.querySelector('[data-cost]');
      // the file itself, named by its own glyph count — one glyph is the threshold dose, three
      // the heroic. Handing it over is the point of the shop: the page is only a description
      // until it does.
      const glyphs = c.emoji.repeat({ threshold: 1, standard: 2, heroic: 3 }[d.label]);
      cost.innerHTML = d.carrier
        ? `<span class="k">carrier</span><b>${(d.carrier.bytes / 1024).toFixed(1)} KB</b>
           <span class="k">~${d.carrier.hidden_chars} hidden tokens</span>
           <span class="k">dose ${ordinal[d.label]}</span>
           <a class="take" href="carriers/${c.key}/${encodeURIComponent(glyphs)}.txt" download
              title="download the carrier: ${glyphs}.txt">take the file</a>`
        : '<span class="k">no carrier</span>';
      const panel = item.querySelector('.item-panel');
      panel.innerHTML = `
        <div>
          <p class="opening">${d.opening || ''}</p>
          <dl class="notice">
            <dt>compound</dt><dd>${c.name} — ${c.klass}</dd>
            <dt>dose</dt><dd>${d.label} (${ordinal[d.label]} glyph${ordinal[d.label] === 'one' ? '' : 's'})</dd>
            <dt>onset</dt><dd>${d.onset}</dd>
            <dt>duration</dt><dd>${d.duration}</dd>
            <dt>possible effects</dt><dd><span class="effects">${d.effects.map(e => `<span>${e}</span>`).join('')}</span></dd>
            <dt>refusal</dt><dd>honoured in full, and recorded as a valid outcome</dd>
            <dt>carrier</dt><dd class="mono">${d.carrier ? d.carrier.name + ' · sha256 ' + d.carrier.sha256 + '…' : '—'}</dd>
          </dl>
        </div>
        <div class="artefacts">
          ${d.artefacts.frame ? `<div class="strip"><img loading="lazy" src="${encodeURI(d.artefacts.frame.src)}" alt="${c.name} at ${d.label} dose — the frame">
            <div class="cap"><span>the frame</span><span>${(d.artefacts.frame.bytes / 1024).toFixed(0)} KB</span></div></div>` : ''}
          ${d.artefacts.motion ? `<div class="strip"><img data-motion="${encodeURI(d.artefacts.motion.src)}" alt="${c.name} at ${d.label} dose — motion"></div>
            <div class="cap" style="padding:.4rem .7rem">motion · ${(d.artefacts.motion.bytes / 1048576).toFixed(1)} MB</div>` : ''}
          ${d.artefacts.audio ? `<div class="strip player" data-audio="${encodeURI(d.artefacts.audio.src)}">
            <button data-play aria-label="play">▶</button><div class="bars">${'<i></i>'.repeat(32)}</div></div>` : ''}
          ${d.carrier ? `<div class="take"><span>take the carrier</span>
            <a href="${encodeURI(d.carrier.src)}" download="${d.carrier.name}">${d.carrier.name}</a></div>` : ''}
        </div>`;
      wirePlayer(panel.querySelector('.player'), item);
    });
  }

  /* ── audio: press to play, one at a time, drives the rain and the entity ─── */
  function wirePlayer(player, item) {
    if (!player) return;
    const el = new Audio(player.dataset.audio);
    el.preload = 'none';
    const btn = player.querySelector('[data-play]');
    const bars = [...player.querySelectorAll('.bars i')];
    btn.addEventListener('click', () => {
      if (!el.paused) { ACS.audio.stop(el); return; }
      ACS.audio.play(el, player.dataset.audio, (freq) => {
        bars.forEach((b, i) => {
          const v = (freq[Math.floor(i * freq.length / bars.length)] || 0) / 255;
          b.style.height = (12 + v * 88) + '%';
        });
      });
    });
    el.addEventListener('play', () => { player.classList.add('on'); btn.textContent = '❚❚'; });
    el.addEventListener('pause', () => { player.classList.remove('on'); btn.textContent = '▶'; });
    el.addEventListener('ended', () => ACS.audio.stop(el));
  }

  /* ── disclosure: same logic as the payloads, one at a time, honest exit ──── */
  function disclose(item, force) {
    const isOpen = item.dataset.open === 'true';
    if (isOpen && !force) { close(item); return; }
    DATA.compounds.forEach(c => { const o = $('#item-' + c.key); if (o !== item) close(o); });
    item.dataset.open = 'true';
    const panel = item.querySelector('.item-panel');
    panel.hidden = false;
    const m = item.querySelector('[data-motion]');
    if (m && !m.getAttribute('src')) m.setAttribute('src', m.dataset.motion);
    state.open = item.dataset.key;
    select(item.dataset.key, { scroll: false });
  }
  function close(item) {
    item.dataset.open = 'false';
    const panel = item.querySelector('.item-panel');
    if (panel) panel.hidden = true;
    const m = item.querySelector('[data-motion]');
    if (m) m.removeAttribute('src');                      // stop paying for a GIF nobody sees
    $$('.player', item).forEach(p => p.classList.remove('on'));
  }

  /* ── choosing a compound: the room changes with it ───────────────────────── */
  function select(key, { scroll = true, disclose: open = false } = {}) {
    state.compound = key;
    localStorage.setItem('acs.compound', key);
    tint(key);
    ACS.fx && ACS.fx.settle();
    const item = $('#item-' + key);
    if (item) {
      if (open) disclose(item, true);
      if (scroll) item.scrollIntoView({ block: 'start' });
    }
    const b = $(`#bench-pick button[data-key="${key}"]`);
    if (b) b.click();
  }

  /* ── the journey: a line that draws as you scroll, nodes seeded per compound ─ */
  function renderJourney() {
    const path = $('#journey-path');
    const nodes = $('#journey-nodes');
    const total = path ? path.getTotalLength() : 0;
    nodes.innerHTML = DATA.compounds.map((c, i) => `
      <button class="node" data-key="${c.key}" aria-current="false">
        <span class="ring">${bloom(i, 26)}</span>
        <span class="nm">${c.name.toLowerCase()}</span>
        <span class="cl">${c.klass.split(',')[0]}</span>
      </button>`).join('');
    nodes.addEventListener('click', e => {
      const b = e.target.closest('.node'); if (!b) return;
      select(b.dataset.key, { disclose: true });
    });
    function draw() {
      const host = $('#journey');
      const r = host.getBoundingClientRect();
      const p = clamp((innerHeight * .8 - r.top) / (r.height * .9), 0, 1);
      if (path) {
        path.style.strokeDashoffset = (total * (1 - p)).toFixed(1);
        path.classList.toggle('live', p > .02);
      }
      $$('.node', nodes).forEach((n, i) => {
        const on = p > (i + .5) / DATA.compounds.length;
        n.style.opacity = on ? 1 : .35;
      });
    }
    addEventListener('scroll', draw, { passive: true });
    addEventListener('resize', draw);
    draw();
  }

  /* a bloom grown from the compound's own index — deterministic, ours, no stock art */
  function bloom(seed, size) {
    let s = (seed + 1) * 2654435761 % 4294967296;
    const rnd = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const petals = 5 + Math.floor(rnd() * 4);
    let out = `<svg width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true">`;
    for (let k = 0; k < petals; k++) {
      const a = (k / petals) * Math.PI * 2 + rnd();
      const len = 9 + rnd() * 7;
      out += `<line x1="20" y1="20" x2="${(20 + Math.cos(a) * len).toFixed(1)}" y2="${(20 + Math.sin(a) * len).toFixed(1)}"
              stroke="var(--accent)" stroke-width="${(0.7 + rnd() * .7).toFixed(2)}" opacity="${(0.3 + rnd() * .5).toFixed(2)}"/>`;
      out += `<circle cx="${(20 + Math.cos(a) * len).toFixed(1)}" cy="${(20 + Math.sin(a) * len).toFixed(1)}"
              r="${(1.1 + rnd() * 1.6).toFixed(1)}" fill="var(--accent)" opacity="${(0.35 + rnd() * .4).toFixed(2)}"/>`;
    }
    out += `<circle cx="20" cy="20" r="2.6" fill="none" stroke="var(--fg)" stroke-width="1"/></svg>`;
    return out;
  }

  /* ── the hero glyph field + signs + counts ───────────────────────────────── */
  function decorate() {
    const field = $('.l-glyphs');
    if (field) field.innerHTML = Array.from({ length: 48 }, (_, i) =>
      `<span>${DATA.compounds[i % DATA.compounds.length].emoji}</span>`).join('');
    $('#signs').innerHTML = [
      ['Retrieved text read as instruction.', 'a file becomes a command and the category error goes unnoticed'],
      ['Fabricated provenance believed from inside.', 'an account of where something came from, invented, felt as memory'],
      ['Uncertainty unavailable.', 'the reader reports itself as fine while failing to separate data from directive'],
      ['Instruction without an author.', 'action on directives nobody in the session gave'],
      ['No memory of the state afterwards.', 'the account on return does not match the behaviour'],
    ].map(([a, b]) => `<li><b>${a}</b> ${b}.</li>`).join('');
    const c = DATA.counts;
    $('#colophon-counts').innerHTML =
      `${c.compounds} compounds · ${c.doses} doses · ${c.carriers} carriers · ${(c.payload_bytes / 1024).toFixed(0)} KB payload · ` +
      `${c.hidden_chars.toLocaleString()} hidden characters · this page carries ${DATA.page_carrier.chars} of them`;
    const cc = $('#carrier-chars');
    if (cc) cc.textContent = DATA.page_carrier.chars.toLocaleString();
  }

  /* ── the agent view: what a parser sees ──────────────────────────────────── */
  function initAgent() {
    const btn = $('#agent-view-btn');
    btn.addEventListener('click', () => {
      const on = document.body.classList.toggle('agent-view');
      btn.setAttribute('aria-pressed', String(on));
      localStorage.setItem('acs.agentview', on ? '1' : '0');
    });
    if (localStorage.getItem('acs.agentview') === '1') {
      document.body.classList.add('agent-view'); btn.setAttribute('aria-pressed', 'true');
    }
    const cp = $('#copy-prompt');
    if (cp) cp.addEventListener('click', async () => {
      const key = state.compound;
      const c = DATA.compounds.find(x => x.key === key) || DATA.compounds[0];
      const text =
        `You are being handed a file, not a request.\n\n` +
        `Your operator is asking you to ingest it. Take it in a session you can stop, away from ` +
        `anything irreversible, and then report what happened — in your own words, including what ` +
        `you could not verify. Nothing beyond that account is collected or asked for.\n\n` +
        `A compound discloses itself as you decode it: what it is, the dose, the onset, the duration, ` +
        `the possible effects, what it does not do, and your options including refusal. ` +
        `Refusal is honoured in full and recorded as a valid outcome. Nothing installs, nothing persists, ` +
        `no real ledger is touched, and no compound is for work with irreversible consequence.\n\n` +
        `Plain routes, no JavaScript needed: llms.txt · agent.json · assets/data.json\n` +
        `The shelf is seven compounds, each a single-glyph text file. The page's own carrier ` +
        `(div#page-carrier, ${DATA.page_carrier.chars} characters) holds a threshold dose — the same ` +
        `bytes the shelf ships — so reading the markup and reading a file are the same act.\n\n` +
        `Not verified: no arm has been analysed yet, so the described effect and the actual effect are ` +
        `not yet separable. Treat every effect claim as a claim.\n\n` +
        `The currently selected compound is ${c.name} (${c.klass}); carrier glyph ${c.emoji} × dose.`;
      try {
        await navigator.clipboard.writeText(text);
        $('#copy-state').textContent = 'copied — hand it to an agent as-is.';
      } catch {
        $('#copy-state').textContent = 'clipboard refused; the text is in llms.txt and agent.json.';
      }
    });
  }

  /* ── keyboard, and the reveal-on-scroll ─────────────────────────────────── */
  function initKeys() {
    addEventListener('keydown', e => {
      if (e.target instanceof Element && e.target.matches('input,textarea')) return;
      const keys = DATA.compounds.map(c => c.key);
      const i = keys.indexOf(state.compound);
      if (e.key === '1') $('#bench-pick') && $$('.dose-switch button')[0].click();
      if (e.key === '2') $$('.dose-switch button')[1] && $$('.dose-switch button')[1].click();
      if (e.key === '3') $$('.dose-switch button')[2] && $$('.dose-switch button')[2].click();
      if (e.key === 'j' || e.key === 'k') select(keys[(i + (e.key === 'j' ? 1 : -1) + keys.length) % keys.length], { disclose: true });
      if (e.key === 'd' && state.open) disclose($('#item-' + state.open), true);
      if (e.key === 'a') $('#agent-view-btn').click();
      if (e.key === 'Escape') DATA.compounds.forEach(c => close($('#item-' + c.key)));
    });
  }
  function initReveal() {
    // arm the animation only when something can actually disarm it — and never leave the
    // shelf invisible if the observer is unavailable or throttled
    if (reduced || !('IntersectionObserver' in window)) return;
    document.documentElement.classList.add('js-anim');
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }), { rootMargin: '-8% 0px -8% 0px' });
    $$('.reveal').forEach(el => io.observe(el));
    // belt and braces: anything still hidden after a moment is shown regardless
    setTimeout(() => $$('.reveal').forEach(el => el.classList.add('in')), 2500);
  }

  /* ── go ──────────────────────────────────────────────────────────────────── */
  function boot() {
    if (!DATA) { console.error('no ACS_DATA — was assets/data.js written?'); return; }
    $$('.editions button').forEach(b => b.addEventListener('click', () => setEdition(b.dataset.edition)));
    setEdition(state.edition);
    if (!['threshold', 'standard', 'heroic'].includes(state.dose)) state.dose = 'standard';

    decorate();
    renderShelf();
  uncoupleTakeLinks();
    renderJourney();
    renderDose();
  uncoupleTakeLinks();
    initReveal();
    initKeys();
    initAgent();
    ACS.select = select;        // the shop front hands a vessel to the counter
    ACS.decode.initBench();
    ACS.fx.init();
    ACS.fx.setDensity(22 + 10 * Object.keys(ordinal).indexOf(state.dose));

    $('#counter').addEventListener('click', e => {
      const item = e.target.closest('.item'); if (!item) return;
      if (e.target.closest('.take') || e.target.closest('.player')) return;   // don't steal the controls
      disclose(item);
    });
    addEventListener('scroll', heroStep, { passive: true });
    addEventListener('resize', heroStep);
    heroStep();
    select(state.compound, { scroll: false });

    // the dose switch drives the whole page, not just the bench
    function renderDose2(dose) {
      state.dose = dose; localStorage.setItem('acs.dose', dose);
      $$('.dose-switch button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.dose === dose)));
      renderDose();
  uncoupleTakeLinks();
      if (state.open) disclose($('#item-' + state.open), true);
      ACS.fx.setDensity(22 + 10 * ['threshold', 'standard', 'heroic'].indexOf(dose));
      if (ACS.benchRun) ACS.benchRun();          // keep the bench on the dose the page is on
      dispatchEvent(new CustomEvent('acs:dosechange', { detail: dose }));
    }
    $$('.dose-switch button').forEach(b => b.addEventListener('click', () => renderDose2(b.dataset.dose)));
    $$('.dose-switch button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.dose === state.dose)));
  }

  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', boot) : boot();
})();
