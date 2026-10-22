/* card-smartfill: AI smart fill for card maker forms.
 *
 * Load it into a card maker page (bookmarklet, userscript, or a <script> tag) and a small
 * "Smart fill" panel appears. Paste a match report (or drop an eFootball result screenshot),
 * press Fill, and every text field the source actually mentions gets filled.
 *
 * Rule number one: it never invents. The model has to quote the source for every value, and
 * any value that cannot be found in the source (team names, players, numbers) is thrown away.
 * Fields with no match are left as they are and listed, so you fill them by hand.
 *
 * The Gemini API key is asked for at runtime and kept only in this browser. It is never in the code.
 */
(function (root) {
  'use strict';

  // tried in this order after the models the key itself lists; Google retires old ones, so none is hard-wired
  const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-lite-latest'];
  const API = 'https://generativelanguage.googleapis.com/v1beta';
  const ENDPOINT = m => `${API}/models/${m}:generateContent`;
  const KEY_STORE = 'cardSmartfill.key';
  const MODEL_STORE = 'cardSmartfill.model';

  /* ---------- grounding: the part that stops made-up data ---------- */

  // lower case, strip accents, every run of non letters/digits becomes one space
  function norm(s) {
    return String(s == null ? '' : s)
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }

  const tokens = s => norm(s).split(' ').filter(Boolean);

  // true when `value` is made only of words and numbers written in `quote` (a span the model copied from the
  // source, checked separately). "Chittagong Kings FC" fails against the quote "Chittagong Kings", while
  // "Mbappe 23', 27'" passes against "mbappe at 23 and 27". Without a quote, each comma-separated piece of
  // the value must be written in the source word for word.
  function grounded(value, source, quote) {
    if (quote != null) {
      const words = new Set(tokens(quote));
      const vt = tokens(value);
      return vt.length > 0 && vt.every(t => words.has(t));
    }
    const src = ' ' + norm(source) + ' ';
    const pieces = String(value).split(/[,;\n]+/).map(norm).filter(Boolean);
    return pieces.length > 0 && pieces.every(p => src.includes(' ' + p + ' '));
  }

  // keep only fills that point to a real field and whose value (and quote) come from the source
  function checkFills(fills, fields, source) {
    const byId = new Map(fields.map(f => [f.id, f]));
    const src = ' ' + norm(source) + ' ';
    const ok = [], rejected = [];
    for (const f of Array.isArray(fills) ? fills : []) {
      const field = f && byId.get(f.id);
      const value = f && typeof f.value === 'string' ? f.value.trim() : f && typeof f.value === 'number' ? String(f.value) : '';
      if (!field || !value) continue;
      const quoteOk = typeof f.quote === 'string' && norm(f.quote) && src.includes(' ' + norm(f.quote) + ' ');
      if (!quoteOk || !grounded(value, source, f.quote)) { rejected.push({ field, value, why: quoteOk ? 'not in source' : 'no matching quote' }); continue; }
      if (field.numeric && !/^\d+$/.test(value)) { rejected.push({ field, value, why: 'not a number' }); continue; }
      if (ok.some(o => o.field === field)) continue;
      ok.push({ field, value });
    }
    return { ok, rejected };
  }

  /* ---------- reading the form ---------- */

  const visible = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';

  // the label text of a control, without the text of selects/options inside the same label
  function labelOf(el) {
    const parts = [];
    const lab = el.closest('label') || (el.id && el.ownerDocument.querySelector(`label[for="${CSS.escape(el.id)}"]`));
    if (lab) {
      const c = lab.cloneNode(true);
      c.querySelectorAll('input,select,textarea,option,button').forEach(n => n.remove());
      parts.push(c.textContent.replace(/\s+/g, ' ').trim());
    }
    if (el.placeholder) parts.push(el.placeholder);
    if (el.title) parts.push(el.title);
    if (!parts.join('') && el.previousElementSibling) parts.push(el.previousElementSibling.textContent.trim());
    return parts.filter(Boolean).join(' / ');
  }

  // section heading (h3) and, for list rows, the row number
  function contextOf(el) {
    const sec = el.closest('section, fieldset');
    const h = sec && sec.querySelector('h3, h2, legend');
    let ctx = h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
    const row = el.closest('.prow, .row, li, tr');
    if (row && row.parentElement) {
      const rows = [...row.parentElement.children].filter(r => r.tagName === row.tagName);
      if (rows.length > 1) ctx += ` (row ${rows.indexOf(row) + 1})`;
    }
    return ctx;
  }

  const FILLABLE = 'input:not([type]), input[type=text], input[type=number], input[type=search], textarea';

  function readFields(doc) {
    const scope = doc.querySelector('#form, aside.form, form') || doc.body;
    return [...scope.querySelectorAll(FILLABLE)]
      .filter(el => !el.disabled && !el.readOnly && visible(el) && !el.closest('#card-smartfill'))
      .map((el, i) => ({
        id: 'f' + (i + 1),
        el,
        label: labelOf(el) || '(no label)',
        section: contextOf(el),
        numeric: el.type === 'number' || el.inputMode === 'numeric',
        multiline: el.tagName === 'TEXTAREA',
        current: el.value,
      }));
  }

  function setValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, value);   // works with frameworks that watch the native setter too
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* ---------- Gemini ---------- */

  function fillPrompt(fields, source) {
    const list = fields.map(f => ({ id: f.id, section: f.section, label: f.label, type: f.numeric ? 'whole number' : f.multiline ? 'text, may be several lines' : 'text' }));
    return [
      'You fill a form for a football (eFootball) graphic card from a SOURCE text.',
      'STRICT RULES:',
      '- Use ONLY facts written in SOURCE. Never guess, never use outside knowledge, never invent team names, player names, scores, dates or any number.',
      '- If SOURCE does not clearly give a field\'s value, leave that field out. Leaving fields out is correct and expected.',
      '- Copy names exactly as written in SOURCE. Do not translate, expand, shorten or correct them.',
      '- For every fill give "quote": a short exact span copied from SOURCE that contains the value.',
      '- Fields marked "whole number" get digits only.',
      '- Several values in one text field (e.g. goal scorers) are joined with ", ".',
      '- Decide which team is which only from SOURCE (e.g. the order they are written in). Team 1 is the first team named.',
      '',
      'FIELDS (JSON):', JSON.stringify(list),
      '',
      'SOURCE:', '"""', source, '"""',
    ].join('\n');
  }

  const FILL_SCHEMA = {
    type: 'OBJECT',
    properties: { fills: { type: 'ARRAY', items: { type: 'OBJECT', properties: { id: { type: 'STRING' }, value: { type: 'STRING' }, quote: { type: 'STRING' } }, required: ['id', 'value', 'quote'] } } },
    required: ['fills'],
  };

  const TRANSCRIBE_PROMPT = [
    'This is a screenshot of an eFootball match result screen.',
    'Write down, as plain text, ONLY what is actually visible: team / club names, player names, the score of each side, goal scorers with their minutes, the date, and any stats rows (label and both numbers).',
    'Put the left / home side first. Copy every name and number exactly as shown. If something is cut off or unreadable, skip it. Do not add anything that is not in the image.',
    'Format: one fact per line, like "Home team: X", "Away team: Y", "Score: 2 - 1", "Home scorers: A 12\', B 80\'", "Possession: 55 - 45".',
  ].join('\n');

  /* ---------- picking a model that works for this key ---------- */

  // "models/gemini-3.8-flash" -> [3.8]; used to put the newest flash first
  const versionOf = id => { const m = id.match(/gemini-(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; };

  // ListModels names -> usable text models, newest stable flash first, then pro, then lite / preview
  function rankModels(models) {
    const ok = (models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => String(m.name || '').replace(/^models\//, ''))
      .filter(id => /^gemini-/.test(id) && !/(tts|image|audio|live|embed|vision|thinking|robotics|computer|learnlm|gemma|aqa|exp)/i.test(id));
    const score = id => (/flash/.test(id) && !/lite/.test(id) ? 0 : /pro/.test(id) ? 1 : 2) * 10 + (/preview/.test(id) ? 5 : 0);
    return [...new Set(ok)].sort((a, b) => score(a) - score(b) || versionOf(b) - versionOf(a) || a.length - b.length);
  }

  async function listModels(key) {
    try {
      const res = await fetch(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
      if (!res.ok) return [];
      return rankModels((await res.json()).models);
    } catch { return []; }
  }

  const store = {
    get: k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  };

  // errors where another model may work (retired, not found, quota, overloaded); a bad key is not one of them
  const tryNext = (status, msg) => !/api.key|API_KEY|permission.denied.*key|unregistered callers/i.test(msg)
    && (status === 404 || status === 429 || status >= 500 || /no longer available|not found|not supported|deprecated|quota|overloaded|unavailable|update your code/i.test(msg));

  let candidates = null;   // worked out once per page load

  async function modelsFor(key) {
    if (!candidates) candidates = [store.get(MODEL_STORE), ...await listModels(key), ...FALLBACK_MODELS].filter(Boolean);
    return [...new Set(candidates)];
  }

  async function callModel(key, model, body) {
    const res = await fetch(ENDPOINT(model), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = new Error((data.error && data.error.message) || `Gemini error ${res.status}`);
      e.status = res.status;
      throw e;
    }
    const text = (((data.candidates || [])[0] || {}).content || { parts: [] }).parts.map(p => p.text || '').join('');
    if (!text) throw new Error('Gemini returned nothing (blocked or empty).');
    return text;
  }

  async function gemini(key, parts, opts = {}) {
    const body = {
      contents: [{ role: 'user', parts }],
      generationConfig: Object.assign({ temperature: 0 }, opts.schema ? { responseMimeType: 'application/json', responseSchema: opts.schema } : {}),
    };
    const queue = await modelsFor(key), tried = [];
    let last;
    while (queue.length) {
      const model = queue.shift();
      tried.push(model);
      try {
        const text = await callModel(key, model, body);
        store.set(MODEL_STORE, model);
        candidates = [model, ...candidates.filter(m => m !== model)];
        api.lastModel = model;
        return text;
      } catch (e) {
        last = e;
        if (!e.status || !tryNext(e.status, e.message)) throw e;
        candidates = candidates.filter(m => m !== model);
        if (store.get(MODEL_STORE) === model) store.set(MODEL_STORE, '');
        // Google often names the replacement: "...use models/gemini-3.8-flash..."
        const hint = (e.message.match(/models\/(gemini-[\w.-]+)/g) || []).map(h => h.slice(7).replace(/[.-]+$/, '')).find(m => m !== model && !tried.includes(m));
        if (hint) { const i = queue.indexOf(hint); if (i >= 0) queue.splice(i, 1); queue.unshift(hint); }
      }
    }
    throw new Error(`No Gemini model worked for this key (tried ${tried.join(', ')}). Last error: ${last ? last.message : 'none'}`);
  }

  async function aiFills(key, fields, source) {
    const out = await gemini(key, [{ text: fillPrompt(fields, source) }], { schema: FILL_SCHEMA });
    let parsed;
    try { parsed = JSON.parse(out); } catch { throw new Error('Gemini did not return valid JSON.'); }
    return parsed.fills || [];
  }

  // phase 2: screenshot -> plain text of what is visible -> the same strict text fill
  async function transcribe(key, file) {
    const b64 = await new Promise((ok, bad) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).split(',')[1]);
      r.onerror = () => bad(r.error);
      r.readAsDataURL(file);
    });
    return (await gemini(key, [{ text: TRANSCRIBE_PROMPT }, { inlineData: { mimeType: file.type || 'image/png', data: b64 } }])).trim();
  }

  /* ---------- which page holds the form ---------- */

  // the studio shows one maker at a time in an iframe; a maker opened alone is the page itself
  function targetDoc() {
    const frames = [...document.querySelectorAll('iframe')].filter(visible);
    for (const f of frames) {
      try { if (f.contentDocument && f.contentDocument.querySelector(FILLABLE)) return f.contentDocument; } catch { /* other origin */ }
    }
    return document;
  }

  /* ---------- panel ---------- */

  const CSS_TEXT = `
#card-smartfill{position:fixed;right:16px;bottom:96px;max-height:calc(100vh - 112px);overflow:auto;z-index:2147483000;width:340px;max-width:calc(100vw - 32px);font:13px/1.4 system-ui,sans-serif;color:#e8ebf2;background:#1b2030;border:1px solid #333b52;border-radius:12px;box-shadow:0 10px 30px #0008}
#card-smartfill.min{width:auto;background:#22c55e;border-color:#22c55e;color:#06210f;border-radius:999px;box-shadow:0 6px 20px #22c55e66}
#card-smartfill.min header{padding:12px 18px;font-size:15px}
#card-smartfill.min .csf-body,#card-smartfill.min header small,#card-smartfill.min [data-x]{display:none}
#card-smartfill header{display:flex;align-items:center;gap:8px;padding:10px 12px;cursor:pointer;font-weight:600}
#card-smartfill header span{flex:1}
#card-smartfill .csf-body{padding:0 12px 12px;display:grid;gap:8px}
#card-smartfill textarea,#card-smartfill input[type=password]{width:100%;box-sizing:border-box;background:#11141b;color:inherit;border:1px solid #333b52;border-radius:8px;padding:8px;font:inherit}
#card-smartfill textarea{min-height:90px;resize:vertical}
#card-smartfill button{background:#2b334a;color:inherit;border:1px solid #3d4766;border-radius:8px;padding:7px 10px;font:inherit;cursor:pointer}
#card-smartfill button.go{background:#3b82f6;border-color:#3b82f6;color:#fff;font-weight:600}
#card-smartfill button:disabled{opacity:.5;cursor:wait}
#card-smartfill .row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
#card-smartfill .drop{border:1px dashed #4a5578;border-radius:8px;padding:8px;text-align:center;color:#9aa4bf}
#card-smartfill .drop.has{color:#e8ebf2;border-style:solid}
#card-smartfill .msg{white-space:pre-wrap;max-height:180px;overflow:auto;color:#c4cbe0}
#card-smartfill .msg b{color:#fff}
#card-smartfill .err{color:#ff8a8a}
#card-smartfill small{color:#8590ad}
#card-smartfill a{color:#8ab4ff;text-decoration:underline}
#card-smartfill label.row{flex-wrap:nowrap;align-items:flex-start}`;

  function panel() {
    if (!document.getElementById('card-smartfill-css')) {
      const st = document.createElement('style'); st.id = 'card-smartfill-css'; st.textContent = CSS_TEXT; document.head.appendChild(st);
    }
    const box = document.createElement('div');
    box.id = 'card-smartfill';
    box.innerHTML = `
      <header><span>✨ Smart fill</span><small>Gemini</small><button type="button" data-x title="Hide">–</button></header>
      <div class="csf-body">
        <div data-keyrow class="row">
          <input type="password" data-key placeholder="Paste your Gemini API key" autocomplete="off">
          <label class="row"><input type="checkbox" data-remember checked> <small>remember on this browser</small></label>
          <small>Get a free key here: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a></small>
        </div>
        <textarea data-src placeholder="Paste the match info here, e.g.&#10;FC Dhaka 3 - 1 Chittagong Kings&#10;Scorers: Rafi 12', 55', Tamim 80' ; Sakib 33'"></textarea>
        <label class="drop" data-drop>Or drop / pick an eFootball result screenshot<input type="file" accept="image/*" data-img hidden></label>
        <div class="row">
          <button type="button" class="go" data-fill>Fill this card</button>
          <button type="button" data-undo disabled>Undo</button>
          <button type="button" data-forget>Forget key</button>
        </div>
        <label class="row"><input type="checkbox" data-blank checked> <small>Empty the other fields of a section it fills (no leftover sample names)</small></label>
        <div class="msg" data-msg><small>Only fills what your text or screenshot actually says. Anything missing stays empty for you to type.</small></div>
      </div>`;
    document.body.appendChild(box);
    return box;
  }

  function mount(opts = {}) {
    const open = document.getElementById('card-smartfill');
    if (open) { open.classList.remove('min'); return; }   // clicked the bookmark again
    const box = panel();
    if (opts.minimized) box.classList.add('min');
    const $ = s => box.querySelector(s);
    const keyIn = $('[data-key]'), msg = $('[data-msg]'), imgIn = $('[data-img]'), drop = $('[data-drop]');
    let image = null, undo = [];

    const stored = () => { try { return localStorage.getItem(KEY_STORE) || sessionStorage.getItem(KEY_STORE) || ''; } catch { return ''; } };
    const showKeyRow = () => { $('[data-keyrow]').style.display = stored() ? 'none' : ''; };
    showKeyRow();

    const say = (html, err) => { msg.innerHTML = html; msg.classList.toggle('err', !!err); };
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    function setImage(f) {
      image = f && f.type.startsWith('image/') ? f : null;
      drop.firstChild.textContent = image ? `Screenshot: ${image.name}` : 'Or drop / pick an eFootball result screenshot';
      drop.classList.toggle('has', !!image);
    }
    imgIn.addEventListener('change', () => setImage(imgIn.files[0]));
    drop.addEventListener('dragover', e => e.preventDefault());
    drop.addEventListener('drop', e => { e.preventDefault(); setImage(e.dataTransfer.files[0]); });
    $('[data-src]').addEventListener('paste', e => {
      const f = [...(e.clipboardData || {}).files || []].find(x => x.type.startsWith('image/'));
      if (f) { e.preventDefault(); setImage(f); }
    });

    $('header').addEventListener('click', e => { if (!e.target.closest('[data-x]')) box.classList.toggle('min'); });
    $('[data-x]').addEventListener('click', () => box.classList.add('min'));
    $('[data-forget]').addEventListener('click', () => {
      try { localStorage.removeItem(KEY_STORE); sessionStorage.removeItem(KEY_STORE); } catch {}
      keyIn.value = ''; showKeyRow(); say('<small>Key removed from this browser.</small>');
    });
    $('[data-undo]').addEventListener('click', () => {
      undo.forEach(u => { setValue(u.el, u.old); u.el.classList.remove('csf-filled'); });
      undo = []; $('[data-undo]').disabled = true; say('<small>Undone.</small>');
    });

    $('[data-fill]').addEventListener('click', async () => {
      const key = keyIn.value.trim() || stored();
      if (!key) return say('Add your Gemini API key first. Get one free at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>', true);
      if (keyIn.value.trim()) {
        try { ($('[data-remember]').checked ? localStorage : sessionStorage).setItem(KEY_STORE, key); } catch {}
        keyIn.value = ''; showKeyRow();
      }
      let source = $('[data-src]').value.trim();
      if (!source && !image) return say('Paste some match info or add a screenshot.', true);
      const doc = targetDoc();
      const fields = readFields(doc);
      if (!fields.length) return say('No text fields found on this card.', true);

      const btn = $('[data-fill]'); btn.disabled = true;
      try {
        if (image) {
          say('<small>Reading the screenshot…</small>');
          const seen = await transcribe(key, image);
          source = source ? source + '\n' + seen : seen;
          $('[data-src]').value = source;   // you can see (and fix) what was read
        }
        say(`<small>Matching ${fields.length} fields…</small>`);
        const fills = await aiFills(key, fields, source);
        const { ok, rejected } = checkFills(fills, fields, source);
        if (!doc.getElementById('card-smartfill-mark')) {   // the green outline, inside the card's own page
          const st = doc.createElement('style'); st.id = 'card-smartfill-mark';
          st.textContent = '.csf-filled{outline:2px solid #22c55e !important;outline-offset:1px}'; doc.head.appendChild(st);
        }
        doc.querySelectorAll('.csf-filled').forEach(e => e.classList.remove('csf-filled'));
        const filled = new Set(ok.map(o => o.field));
        const left = fields.filter(f => !filled.has(f));
        // a section that got real data should not keep sample values next to it (old team name beside the new score)
        const touched = new Set(ok.map(o => o.field.el.closest('section, fieldset')).filter(Boolean));
        const blank = $('[data-blank]').checked ? left.filter(f => f.el.value && touched.has(f.el.closest('section, fieldset'))) : [];
        undo = [...ok.map(o => o.field), ...blank].map(f => ({ el: f.el, old: f.el.value }));
        ok.forEach(({ field, value }) => { setValue(field.el, value); field.el.classList.add('csf-filled'); });
        blank.forEach(f => setValue(f.el, ''));
        $('[data-undo]').disabled = !undo.length;
        let html = `<b>Filled ${ok.length}</b> of ${fields.length} fields (green outline). <small>Model: ${esc(api.lastModel)}</small>`;
        if (image) html += '\n<small>Read from the screenshot: check the text above, it is what was filled from.</small>';
        if (rejected.length) html += `\n<b>Thrown away ${rejected.length}</b> (not in your source):\n` + rejected.map(r => `• ${esc(r.field.label)}: "${esc(r.value)}" (${r.why})`).join('\n');
        if (blank.length) html += `\n<b>Emptied ${blank.length}</b> (same section, not in source).`;
        if (left.length) html += `\n<b>Not in source</b> (type these yourself):\n` + left.map(f => `• ${esc([f.section, f.label].filter(Boolean).join(' › '))}`).join('\n');
        say(html);
      } catch (e) {
        say(esc(e.message || e), true);
      } finally { btn.disabled = false; }
    });
  }

  const api = { norm, grounded, checkFills, readFields, fillPrompt, setValue, transcribe, aiFills, mount, rankModels, tryNext, gemini, FALLBACK_MODELS, lastModel: '' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    root.CardSmartfill = api;
    // <script src="card-smartfill.js" data-start="min"> shows just the small "Smart fill" button until clicked
    const opts = { minimized: !!(document.currentScript && document.currentScript.dataset.start === 'min') };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => mount(opts)); else mount(opts);
  }
})(typeof window !== 'undefined' ? window : globalThis);
