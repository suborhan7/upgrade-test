/* Small UI helpers shared by every maker (same file in every tools/<id>/js/). Changes only the form, never the poster.
   - file inputs show the chosen file name
   - long dropdown choices "Name (what it looks like)" show just the name; the rest goes in a hint line under the box
   - long section headings "Title (note)" put the note in smaller text
   - the editor toolbar becomes grouped icon buttons with a selection panel; its help text folds behind a "?" button
   - every form section is a card whose heading folds it (remembered per card)
   - Download / Share / Copy sit in a small bar right under the poster */
(function () {
  const form = document.getElementById('form');
  if (!form) return;

  function fileName(inp) {
    let n = inp.nextElementSibling && inp.nextElementSibling.classList.contains('fname') ? inp.nextElementSibling : null;
    if (!n) { n = document.createElement('span'); n.className = 'fname'; inp.after(n); }
    const f = inp.files && inp.files[0];
    const txt = f ? '✓ ' + f.name : '';
    if (n.textContent !== txt) n.textContent = txt;
    inp.classList.toggle('has-file', !!f);
    if (f) inp.title = f.name;
  }

  function splitSelect(sel) {
    let any = false;
    for (const o of sel.options) {
      const full = o.dataset.full || o.textContent;
      const m = full.match(/^(.+?)\s*\((.+)\)\s*$/);
      if (m && full.length > 24) { any = true; o.dataset.full = full; o.dataset.hint = m[2]; if (o.textContent !== m[1]) o.textContent = m[1]; }
    }
    let h = sel.nextElementSibling && sel.nextElementSibling.classList.contains('hint') ? sel.nextElementSibling : null;
    if (!any) { if (h) h.remove(); return; }
    if (!h) { h = document.createElement('small'); h.className = 'hint'; sel.after(h); }
    const cur = sel.selectedOptions[0];
    const txt = cur && cur.dataset.hint ? cur.dataset.hint : '';
    if (h.textContent !== txt) h.textContent = txt;
    sel.title = cur ? (cur.dataset.full || cur.textContent) : '';
  }

  function splitHeading(h) {
    if (h.querySelector('.sub')) return;
    const m = h.textContent.match(/^(.+?)\s*(\(.+\))\s*$/);
    if (!m || h.textContent.length < 22) return;
    h.textContent = m[1];
    const s = document.createElement('span'); s.className = 'sub'; s.textContent = m[2];
    h.appendChild(s);
  }

  // editor toolbar (made by js/studio-edit.js): icon buttons in groups, a selection panel, help behind "?"
  const ICON = {
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    smaller: '<path d="M5 12h14"/>', bigger: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>', up: '<path d="m18 15-6-6-6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
    center: '<path d="M12 3v18"/><rect x="6" y="7" width="12" height="10" rx="2"/>',
    resetone: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    hide: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2.2-2.4 3.7"/><path d="M12 17h.01"/>',
    cursor: '<path d="m4 4 7 17 2.5-7.5L21 11z"/>'
  };
  const svg = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
  const LABEL = { undo: 'Undo', redo: 'Redo', center: 'Majhe', resetone: 'Reset', hide: 'Remove' };

  function toolbar() {
    const bar = form.querySelector('.se-bar');
    if (!bar || bar.classList.contains('pro')) return;
    bar.classList.add('pro');
    const rows = bar.querySelectorAll('.se-row'), name = bar.querySelector('.se-name');
    bar.querySelectorAll('[data-se]').forEach(b => {
      const k = b.dataset.se;
      if (!ICON[k]) return;
      b.classList.add('se-ic');
      b.innerHTML = svg(k) + (LABEL[k] ? `<span>${LABEL[k]}</span>` : '');
      if (!b.title) b.title = LABEL[k] || k;
    });
    // top row: [undo redo] .... [?]
    const top = rows[0];
    const hist = document.createElement('div'); hist.className = 'se-group';
    hist.append(bar.querySelector('[data-se="undo"]'), bar.querySelector('[data-se="redo"]'));
    const help = document.createElement('button');
    help.type = 'button'; help.className = 'se-help se-ic'; help.title = 'Kivabe edit korbo'; help.innerHTML = svg('help');
    help.addEventListener('click', () => bar.classList.toggle('show-help'));
    const tag = document.createElement('span'); tag.className = 'se-tag'; tag.textContent = 'Edit';
    top.replaceChildren(tag, hist, help);
    // selection panel: name + close, then size / move / actions
    const panel = document.createElement('div'); panel.className = 'se-panel';
    const head = document.createElement('div'); head.className = 'se-head';
    const dot = document.createElement('i'); dot.innerHTML = svg('cursor');
    const title = document.createElement('b'); title.className = 'se-title';
    const close = document.createElement('button');
    close.type = 'button'; close.className = 'se-close se-ic'; close.title = 'Chhere dao (Esc)'; close.innerHTML = svg('close');
    close.addEventListener('click', () => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    head.append(dot, title, close);
    name.hidden = true;
    head.append(name);
    const [r2, r3] = [rows[1], rows[2]];
    const size = document.createElement('div'); size.className = 'se-group se-size';
    size.append(r2.querySelector('[data-se="smaller"]'), r2.querySelector('.se-pct'), r2.querySelector('[data-se="bigger"]'));
    const pad = document.createElement('div'); pad.className = 'se-group se-pad';
    ['left', 'up', 'down', 'right'].forEach(k => pad.append(r2.querySelector(`[data-se="${k}"]`)));
    const cap = (t, el) => { const w = document.createElement('div'); w.className = 'se-field'; w.innerHTML = `<small>${t}</small>`; w.append(el); return w; };
    r2.replaceChildren(cap('Size', size), cap('Move', pad));
    r3.classList.add('se-actions');
    panel.append(head, r2, r3);
    top.after(panel);
    syncName();
  }
  function syncName() {
    const bar = form.querySelector('.se-bar.pro'); if (!bar) return;
    const t = bar.querySelector('.se-name').textContent, on = /^Selected:/.test(t);
    const txt = on ? t.replace(/^Selected:\s*/, '') : 'Poster e jekono kichu click kore select koro';
    const el = bar.querySelector('.se-title');
    if (el.textContent !== txt) el.textContent = txt;
    bar.classList.toggle('has-sel', on);
  }

  function shortReset() {
    form.querySelectorAll('.reset-all').forEach(b => {
      if (b.dataset.short) return;
      b.dataset.short = '1'; b.title = b.textContent.trim();
      b.textContent = '↺ Reset to default';
    });
  }


  // ---- section cards: tap a heading to fold the section; "Poster e ki ki thakbe" and Partners start folded ----
  const FOLD_KEY = 'ui-fold:' + location.pathname;
  let folds = {};
  try { folds = JSON.parse(localStorage.getItem(FOLD_KEY) || '{}'); } catch (e) {}
  const FOLDED_FIRST = /ki ki thakbe|partners/i;
  function cards() {
    form.querySelectorAll(':scope > section, :scope > div > section').forEach(sec => {
      const h = sec.querySelector(':scope > h3');
      if (!h || sec.classList.contains('ui-card')) return;
      sec.classList.add('ui-card');
      const key = () => (h.firstChild ? h.firstChild.textContent : h.textContent).trim().toLowerCase();
      const k = key();
      if (k in folds ? folds[k] : FOLDED_FIRST.test(k)) sec.classList.add('folded');
      h.title = 'Khulo / bondho koro';
      h.addEventListener('click', () => {
        sec.classList.toggle('folded');
        folds[key()] = sec.classList.contains('folded');
        try { localStorage.setItem(FOLD_KEY, JSON.stringify(folds)); } catch (e) {}
      });
    });
  }

  // ---- Download / Share / Copy under the poster ----
  // Share and Copy reuse the maker's own HD export: the maker ends its download with a.click() on a link
  // holding the PNG; while we wait for an image that click is caught here instead of saving a file.
  let catcher = null;
  const nativeClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (catcher && this.download) { const c = catcher; catcher = null; c({ url: this.href, name: this.download }); return; }
    return nativeClick.call(this);
  };
  function exportImage() {
    const dl = document.getElementById('download');
    return new Promise((res, rej) => {
      catcher = res;
      setTimeout(() => { if (catcher === res) { catcher = null; rej(new Error('timeout')); } }, 60000);
      dl.click();
    }).then(async ({ url, name }) => ({ blob: await (await fetch(url)).blob(), name }));
  }
  function note(t) {
    let n = document.querySelector('.act-note');
    if (!n) { n = document.createElement('div'); n.className = 'act-note'; document.body.appendChild(n); }
    n.textContent = t; n.hidden = false;
    clearTimeout(note.t); note.t = setTimeout(() => { n.hidden = true; }, 2600);
  }
  const AIC = {
    download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'
  };
  const aic = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${AIC[k]}</svg>`;
  function actionBar() {
    const stage = document.querySelector('.stage'), dl = document.getElementById('download');
    if (!stage || !dl || stage.querySelector('.act-bar')) return;
    const bar = document.createElement('div'); bar.className = 'act-bar';
    dl.innerHTML = aic('download') + '<span>Download</span>'; dl.title = 'HD PNG (2160 × 2700)';
    // the maker swaps the button text while it renders; put the icon back once it is done
    new MutationObserver(() => { if (!dl.disabled && !dl.querySelector('svg')) dl.innerHTML = aic('download') + '<span>Download</span>'; })
      .observe(dl, { childList: true, attributes: true, attributeFilter: ['disabled'] });
    const mk = (k, label, title, fn) => {
      const b = document.createElement('button'); b.type = 'button'; b.innerHTML = aic(k) + `<span>${label}</span>`; b.title = title;
      b.addEventListener('click', async () => {
        b.disabled = true;
        try { await fn(); } catch (e) { if (e && e.name !== 'AbortError') note('Hoy nai, abar try koro'); }
        b.disabled = false;
      });
      return b;
    };
    const canShareFiles = !!(navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] }));
    const share = mk('share', 'Share', 'Facebook / WhatsApp / Messenger e pathao', async () => {
      const { blob, name } = await exportImage();
      await navigator.share({ files: [new File([blob], name, { type: 'image/png' })] });
    });
    const copy = mk('copy', 'Copy', 'Chobi copy koro, tarpor post e paste (Ctrl+V)', async () => {
      const { blob } = await exportImage();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      note('Chobi copy hoise, ekhon paste koro');
    });
    bar.append(dl);
    if (canShareFiles) bar.append(share);
    if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) bar.append(copy);
    stage.appendChild(bar);
    window.dispatchEvent(new Event('resize'));
  }
  // phones: undo / redo / help also sit in the Download row (copies that press the real ones), so the idle EDIT row can go
  function dockEdit() {
    const bar = form.querySelector('.se-bar.pro'), act = document.querySelector('.act-bar');
    if (!bar || !act || act.querySelector('.act-edit')) return;
    const dock = document.createElement('div'); dock.className = 'act-edit';
    ['undo', 'redo'].forEach(k => {
      const real = bar.querySelector(`[data-se="${k}"]`); if (!real) return;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'se-ic'; b.title = LABEL[k]; b.innerHTML = svg(k);
      b.addEventListener('click', () => real.click());
      const sync = () => { b.disabled = real.disabled; };
      new MutationObserver(sync).observe(real, { attributes: true, attributeFilter: ['disabled'] }); sync();
      dock.append(b);
    });
    const realHelp = bar.querySelector('.se-help');
    const help = document.createElement('button'); help.type = 'button'; help.className = 'se-ic se-help'; help.title = 'Kivabe edit korbo'; help.innerHTML = svg('help');
    help.addEventListener('click', () => realHelp && realHelp.click());
    new MutationObserver(() => help.classList.toggle('on', bar.classList.contains('show-help'))).observe(bar, { attributes: true, attributeFilter: ['class'] });
    dock.append(help);
    act.append(dock);
  }
  // Partners: "+ Add partner" under the list, and ✕ takes the partner off the poster (not just blanks it)
  function partnersPlus() {
    const box = document.getElementById('partners'), tpl = document.getElementById('partnerTpl'), st = window.__posterState;
    if (!box || !tpl || !st || !Array.isArray(st.partners) || box.dataset.plus) return;
    box.dataset.plus = '1';
    const MAX = 10;
    const kick = () => { const l = form.querySelector('[data-k="partnersLabel"]'); if (l) l.dispatchEvent(new Event('input', { bubbles: true })); };
    const add = document.createElement('button'); add.type = 'button'; add.className = 'p-add'; add.textContent = '+ Add partner';
    const sync = () => {
      [...box.children].forEach((r, i) => { const n = r.querySelector('[data-pname]'); if (n) n.placeholder = `Partner ${i + 1}`; });
      add.hidden = st.partners.length >= MAX;
    };
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-pclear]'); if (!b) return;
      const row = [...box.children].find(r => r.contains(b)), i = [...box.children].indexOf(row);
      if (i < 0) return;
      e.stopImmediatePropagation();
      st.partners.splice(i, 1); row.remove(); sync(); kick();
    }, true);
    add.addEventListener('click', () => {
      const p = { name: '', logo: '' }; st.partners.push(p);
      const row = tpl.content.firstElementChild.cloneNode(true);
      const name = row.querySelector('[data-pname]'), logo = row.querySelector('[data-plogo]');
      name.addEventListener('input', () => { p.name = name.value; kick(); });
      logo.addEventListener('change', () => {
        const f = logo.files[0]; if (!f) { p.logo = ''; kick(); return; }
        const r = new FileReader(); r.onload = () => { p.logo = r.result; kick(); }; r.readAsDataURL(f);
      });
      box.appendChild(row); sync(); name.focus(); kick();
    });
    box.after(add); sync();
  }
  // the form font (Barlow), the same face the reference studio uses; falls back to the system font offline
  if (!document.querySelector('link[data-ui-font]')) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.uiFont = '1';
    l.href = 'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&display=swap';
    document.head.appendChild(l);
  }


  // ---- Caption & hashtags (js/caption.js writes it from the card's data) ----
  const CARD = (location.pathname.match(/tools\/([^/]+)\//) || [])[1];
  function captionBox() {
    if (!window.CaptionGen || !CARD || !CaptionGen.cards.includes(CARD) || form.querySelector('.cap-sec')) return;
    const LANGS = [['en', 'English'], ['bn', 'বাংলা'], ['bl', 'Banglish']];
    let lang = 'en', variant = 0, edited = false, last = '';
    try { lang = localStorage.getItem('ui-caplang') || 'en'; } catch (e) {}
    const sec = document.createElement('section'); sec.className = 'cap-sec';
    sec.innerHTML = `<h3>Caption &amp; hashtags</h3>
      <p class="tip">Card er lekha theke nije banay. Dorkar hole edit koro, tarpor copy kore post e paste koro.</p>
      <div class="chips">${LANGS.map(([k, n]) => `<button type="button" data-lang="${k}">${n}</button>`).join('')}</div>
      <textarea rows="9" aria-label="Caption"></textarea>
      <div class="cap-actions"><button type="button" class="cap-copy">Copy caption</button><button type="button" class="cap-again">Rewrite</button></div>`;
    const ta = sec.querySelector('textarea'), copyBtn = sec.querySelector('.cap-copy');
    const chips = () => sec.querySelectorAll('[data-lang]').forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
    const update = (force) => {
      if (edited && !force) return;
      const txt = CaptionGen.make(CARD, window.__posterState, lang, variant);
      if (txt !== last || force) { last = txt; ta.value = txt; }
    };
    sec.addEventListener('click', e => {
      const b = e.target.closest('[data-lang]');
      if (b) { lang = b.dataset.lang; try { localStorage.setItem('ui-caplang', lang); } catch (err) {} chips(); edited = false; update(true); }
    });
    sec.querySelector('.cap-again').addEventListener('click', () => { variant++; edited = false; update(true); });
    ta.addEventListener('input', () => { edited = true; });
    copyBtn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(ta.value); } catch (e) { ta.select(); document.execCommand('copy'); }
      copyBtn.textContent = 'Copied ✓'; setTimeout(() => { copyBtn.textContent = 'Copy caption'; }, 1600);
    });
    chips();
    // wide screens: the box gets its own column right of the poster; otherwise it sits at the end of the form
    const app = document.querySelector('.app'), wide = matchMedia('(min-width: 1280px)');
    const aside = document.createElement('aside'); aside.className = 'cap-aside';
    const place = () => {
      if (wide.matches && app) { aside.append(sec); app.append(aside); app.classList.add('has-cap'); }
      else { form.insertBefore(sec, form.querySelector(':scope > button.primary') || null); aside.remove(); if (app) app.classList.remove('has-cap'); }
      window.dispatchEvent(new Event('resize'));
    };
    wide.addEventListener ? wide.addEventListener('change', place) : wide.addListener(place);
    place();
    update(true);
    // the card changes from the form and from the poster editor; follow it until the admin edits the text
    form.addEventListener('input', e => { if (!sec.contains(e.target)) setTimeout(update, 0); });
    form.addEventListener('change', e => { if (!sec.contains(e.target)) setTimeout(update, 0); });
    setInterval(update, 1500);
  }
  if (CARD && !window.CaptionGen) {
    const sc = document.createElement('script'); sc.src = 'js/caption.js'; sc.onload = () => { captionBox(); enhance(); };
    document.head.appendChild(sc);
  }

  let busy = false;
  function enhance() {
    if (busy) return;
    busy = true;
    form.querySelectorAll('input[type=file]').forEach(fileName);
    form.querySelectorAll('select').forEach(splitSelect);
    form.querySelectorAll('h3').forEach(splitHeading);
    toolbar();
    syncName();
    shortReset();
    cards();
    obs.takeRecords();
    busy = false;
  }

  const obs = new MutationObserver(() => enhance());
  obs.observe(form, { childList: true, subtree: true, characterData: true });
  form.addEventListener('change', e => {
    if (e.target.matches('input[type=file]')) fileName(e.target);
    if (e.target.matches('select')) splitSelect(e.target);
  });
  // clear buttons empty a file input in code (no change event), so look again after any click
  form.addEventListener('click', () => setTimeout(() => form.querySelectorAll('input[type=file]').forEach(fileName), 0));
  // selects changed in code (a layout switched by the maker) also need their hint refreshed
  form.addEventListener('input', e => { if (e.target.matches('select')) splitSelect(e.target); });
  setInterval(() => form.querySelectorAll('select').forEach(splitSelect), 800);
  enhance();
  actionBar();
  dockEdit();
  partnersPlus();
  window.addEventListener('load', enhance);

  // phones: the poster sticks at the top; tell the CSS how tall it is so the editor row sticks just below it
  const stage = document.querySelector('.stage');
  if (stage && window.ResizeObserver) new ResizeObserver(() => document.documentElement.style.setProperty('--stage-h', stage.offsetHeight + 'px')).observe(stage);
})();
