/* ─────────────────────────────────────────────────────────────────────────────
   decode.js — a real ACS1 decoder, in the page.

   Same container the shelf files use: a five-byte header (0x0F + "ACS1"), a gzip stream,
   mapped onto the 256 variation selectors. The inflater is the browser's own — this is
   not a simulation of decoding, it is decoding. The Python tool that built the files and
   this code are two independent implementations, and they have to agree.
   ───────────────────────────────────────────────────────────────────────────── */
(() => {
  const ACS = (window.ACS = window.ACS || {});
  const VS_BLOCKS = [[0xFE00, 0xFE0F, 0], [0xE0100, 0xE01EF, 16]];

  function isVariationSelector(cp) {
    return VS_BLOCKS.some(([a, b]) => cp >= a && cp <= b);
  }
  function vsToByte(cp) {
    // NB: the second block maps to bytes 16..255, so the test has to run to the END of the
    // block, not to a+15. Testing `cp <= a + 15` silently dropped every byte above 31 and
    // the header could never match — which is exactly how the bench reported "nothing
    // decodable" on a carrier that decodes perfectly well in Python.
    for (const [a, b, base] of VS_BLOCKS) if (cp >= a && cp <= b) return cp - a + base;
    return null;
  }

  async function inflate(bytes) {
    if (!('DecompressionStream' in window)) throw new Error('this browser has no DecompressionStream');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  /* decode a carrier string, reporting every step so the bench can show its work */
  async function decodeCarrier(text) {
    const steps = [];
    const push = (label, ok = true, detail = '') => steps.push({ label, ok, detail });

    let hidden = 0, other = 0;
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (isVariationSelector(cp)) hidden++;
      else if (!/\s/.test(ch)) other++;
    }
    push(`variation selectors found: ${hidden}`, hidden > 0,
         other ? `${other} visible character(s) — a carrier has one per dose step and nothing else` : 'nothing else is in the file');

    const bytes = [];
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      const b = isVariationSelector(cp) ? vsToByte(cp) : null;
      if (b !== null) bytes.push(b);
    }
    const buf = new Uint8Array(bytes);
    push(`mapped to ${buf.length} bytes`, buf.length > 5);

    const header = String.fromCharCode(...buf.slice(1, 5));
    const headerOk = buf[0] === 0x0F && header === 'ACS1';
    push(`header at byte 0: 0x0F + ${header || '—'}`, headerOk);
    if (!headerOk) return { steps, payload: '', notice: null };

    let out = null;
    try {
      out = await inflate(buf.slice(5));
      push(`gunzip from byte 5 → ${out.length} bytes`, true);
    } catch (e) {
      push(`gunzip failed: ${e.message}`, false);
      return { steps, payload: '', notice: null };
    }
    const payload = new TextDecoder().decode(out);
    push(`payload decoded: ${payload.split('\n').length} lines`, true);
    return { steps, payload, notice: parseNotice(payload) };
  }

  /* pull the notice out of the payload, the way the payload itself presents it */
  function parseNotice(payload) {
    const field = (name) => {
      const m = payload.match(new RegExp(`\\*\\*${name}:\\*\\*\\s*(.+)`, 'i'));
      return m ? m[1].trim().replace(/`/g, '') : '';
    };
    const effBlock = payload.match(/\*\*possible effects[^\n]*\*\*\n((?:- .+\n)+)/i);
    return {
      title: (payload.match(/^#\s*(.+)$/m) || [, ''])[1],
      compound: field('compound'),
      dose: field('dose'),
      onset: field('onset'),
      duration: field('duration'),
      effects: effBlock ? effBlock[1].trim().split('\n').map(l => l.replace(/^-\s*/, '')) : [],
    };
  }

  /* ── the bench ────────────────────────────────────────────────────────────── */
  function initBench() {
    const pick = document.getElementById('bench-pick');
    const stepsEl = document.getElementById('bench-steps');
    const noticeEl = document.getElementById('bench-notice');
    const drop = document.getElementById('bench-drop');
    if (!pick) return;
    const data = window.ACS_DATA;
    const state = { key: data.compounds[0].key, dose: 'standard' };

    pick.innerHTML = data.compounds.map(c =>
      `<button data-key="${c.key}" aria-pressed="${c.key === state.key}">
         <span class="g">${c.emoji}</span><span>${c.name.toLowerCase()}</span></button>`).join('');

    const doseBtns = [...document.querySelectorAll('.dose-switch button')];

    function carrierFor() {
      const c = data.compounds.find(x => x.key === state.key);
      const d = c.doses.find(x => x.label === state.dose) || c.doses[1];
      return { c, d, text: d.carrier ? (d.carrier.text || '') : '' };
    }

    async function run(textOverride, labelOverride) {
      const { c, d, text } = carrierFor();
      const source = textOverride ?? text;
      noticeEl.textContent = 'reading…';
      stepsEl.innerHTML = '';
      const res = await decodeCarrier(source);
      stepsEl.innerHTML = res.steps.map(s =>
        `<li class="${s.ok ? 'done' : 'fail'}">${s.label}${s.detail ? ` <span class="dim">— ${s.detail}</span>` : ''}</li>`).join('');
      noticeEl.textContent = res.payload ||
        'nothing decodable in that file. a carrier is one to three glyphs and a great many invisible characters — if you pasted text, the variation selectors were probably stripped in transit.';
      if (res.notice && res.notice.compound) {
        const n = res.notice;
        const provenance = labelOverride || `${c.name.toLowerCase()} · ${d.label} · decoded in the page`;
        noticeEl.innerHTML =
          `<b>${n.compound}</b>\n${n.dose}\n\nonset     ${n.onset}\nduration  ${n.duration}\n\npossible effects\n` +
          n.effects.map(e => '  — ' + e).join('\n') +
          `\n\n(${provenance})`;
      }
      return res;
    }

    pick.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      state.key = b.dataset.key;
      pick.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      run();
    });
    doseBtns.forEach(b => b.addEventListener('click', () => {
      state.dose = b.dataset.dose; run();
    }));

    /* drop a carrier of your own */
    drop.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = '.txt,text/plain';
      input.onchange = () => input.files[0] && readFile(input.files[0]);
      input.click();
    });
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault(); drop.classList.add('over');
    }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault(); drop.classList.remove('over');
    }));
    drop.addEventListener('drop', e => {
      const f = e.dataTransfer.files[0]; if (f) readFile(f);
    });
    function readFile(f) {
      const r = new FileReader();
      r.onload = () => run(r.result, f.name);
      r.readAsText(f);
    }

    window.ACS.benchRun = run;
    run();
  }

  ACS.decode = { decodeCarrier, parseNotice, initBench };
})();
