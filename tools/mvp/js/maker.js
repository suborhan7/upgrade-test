/* Maker page: form -> data -> poster, plus jersey colour auto-detect, auto cut-out and PNG download. */
(function () {
  const state = {
    tag: 'Matchday 12',
    kicker: 'eFCB PRO LEAGUE · SEASON 2',
    layout: 'big',                // current | big | rating | split
    moves: {},                    // admin's drags/sizes per layout: { big: { stats: { x, y, s, ox, oy } } }
    hidden: {},                   // parts the admin switched off, per layout: { big: { bigword: true } }
    vivid: true,
    bgMode: 'template',           // 'template' | 'jersey' | 'image'
    template: 'shatter',          // fixed design used when bgMode is 'template'
    bgImage: '',                  // admin's uploaded background (data URL)
    premiumAccent: 'gold-purple', // colour pair for the template, an upload, or a plain black/white jersey
    site: 'efcb.com',
    partnersLabel: 'Official partners',
    partners: ['NOVAPAY', 'Pixel Arena', 'BOLT', 'zenith', 'KICKOFF+'].map(name => ({ name, logo: '' })),
    logo: '',
    player: { dx: 0, dy: 0, zoom: 1, name: 'Nova_10', team: 'Dhaka Strikers', photo: (window.SAMPLE_PHOTOS || {}).a || '', primary: '#f2c200', secondary: '#111111' },
    match: { label: 'Full time', score: '3 – 1', opponent: 'Chattogram Kings' },
    stats: [
      { label: 'Match rating', value: '9.4' },
      { label: 'Goals', value: '2' },
      { label: 'Assists', value: '1' },
      { label: 'Pass accuracy', value: '91%' },
    ],
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const poster = $('#poster');
  const pairRow = document.getElementById('pairRow');
  const bgUploadRow = document.getElementById('bgUploadRow');
  const tplRow = document.getElementById('tplRow');
  // names for the "Poster e ki ki thakbe" list and the editor bar (js/studio-edit.js)
  const PARTS = { brand: 'Logo', tag: 'Tag (top right)', title: 'Title', bigword: 'MVP boro lekha', info: 'Info panel (dane)',
    stats: 'Stats', rating: 'Rating (boro number)', grid: 'Baki stats', name: 'Player name', team: 'Team name', score: 'Score box',
    partners: 'Partners strip', p0: 'Player photo' };
  const moveKey = () => state.layout || 'current';
  let editing = false;
  const render = () => {
    renderMvp(poster, state);
    if (editing) StudioEdit.afterRender();
    // the colour pair is used by the template and uploads, and by plain black/white jerseys
    tplRow.style.display = state.bgMode === 'template' ? '' : 'none';
    pairRow.style.display = state.bgMode === 'image' || state.bgMode === 'jersey' && JerseyColors.isPlainNeutral(state.player.primary, state.player.secondary) ? '' : 'none';
    bgUploadRow.style.display = state.bgMode === 'image' ? '' : 'none';
  };
  const readFile = f => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
  const sec = $('[data-player="player"]');

  async function autoColors() {
    if (!state.player.photo) return;
    try {
      const c = await JerseyColors.pickJerseyColors(state.player.photo);
      Object.assign(state.player, c);
      $('[data-p="primary"]', sec).value = c.primary;
      $('[data-p="secondary"]', sec).value = c.secondary;
      render();
    } catch (e) { console.warn('Colour detect failed', e); }
  }

  // true when the image already has see-through pixels (an existing cut-out)
  async function hasTransparency(src) {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = Math.max(1, Math.round(64 * img.height / img.width));
    const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let clear = 0; for (let i = 3; i < d.length; i += 4) if (d[i] < 200) clear++;
    return clear > d.length / 4 * 0.02;
  }

  // AI background removal in the browser (@imgly/background-removal). The model (~44 MB) downloads once, then is cached.
  async function cutOut(file, status) {
    if (!window.BgRemoval) throw new Error('library missing');
    status.textContent = 'Background kata hochche…';
    const blob = await BgRemoval.removeBackground(file, {
      model: 'small',
      // run in the page, not a worker: workers can't load the model when index.html is opened straight from disk
      proxyToWorker: false,
      output: { format: 'image/png' },
      progress: (k, cur, total) => {
        if (k.startsWith('fetch') && total) status.textContent = `AI model download hochche (prothombar): ${Math.round(cur / total * 100)}%`;
        else if (k.startsWith('compute')) status.textContent = 'Background kata hochche…';
      },
    });
    status.textContent = 'Cut-out ready ✓';
    return JerseyColors.keepMainSubject(await readFile(blob));
  }

  // poster + match fields
  $$('[data-k]').forEach(i => { i.value = state[i.dataset.k]; i.addEventListener('input', () => { state[i.dataset.k] = i.value; render(); }); });
  $$('[data-m]').forEach(i => { i.value = state.match[i.dataset.m]; i.addEventListener('input', () => { state.match[i.dataset.m] = i.value; render(); }); });
  $('[data-file="logo"]').addEventListener('change', async e => { const f = e.target.files[0]; state.logo = f ? await readFile(f) : ''; render(); });

  // ---- partners strip (bottom of the poster) ----
  const ptpl = $('#partnerTpl');
  state.partners.forEach((p, i) => {
    const row = ptpl.content.firstElementChild.cloneNode(true);
    const name = $('[data-pname]', row); name.value = p.name; name.placeholder = `Partner ${i + 1}`;
    name.addEventListener('input', () => { p.name = name.value; render(); });
    $('[data-plogo]', row).addEventListener('change', async e => { const f = e.target.files[0]; p.logo = f ? await readFile(f) : ''; render(); });
    $('[data-pclear]', row).addEventListener('click', () => { p.logo = ''; p.name = ''; name.value = ''; $('[data-plogo]', row).value = ''; render(); });
    $('#partners').appendChild(row);
  });

  // player fields
  $$('[data-p]', sec).forEach(i => {
    i.value = state.player[i.dataset.p];
    i.addEventListener('input', () => { state.player[i.dataset.p] = i.value; render(); });
  });
  $('[data-photo]', sec).addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    const status = $('[data-status]', sec);
    let src = await readFile(f);
    // normal photo (no transparent background) -> cut the player out automatically
    if ($('[data-cutout]', sec).checked && !(await hasTransparency(src))) {
      try {
        src = await cutOut(f, status);
      } catch (err) {
        console.warn('Auto cut-out failed', err);
        status.textContent = 'Auto cut-out hoyni (internet lagbe). Normal chobi boshano holo.';
      }
    }
    state.player.photo = await JerseyColors.enhancePhoto(await JerseyColors.trimTransparent(src));
    Object.assign(state.player, { dx: 0, dy: 0, zoom: 1 }); // new photo starts at the default spot
    render();
    applyPos();
    autoColors(); // new photo -> new jersey colours
  });
  $('[data-auto]', sec).addEventListener('click', autoColors);
  const bgSel = $('[data-bg]');
  bgSel.value = state.bgMode;
  bgSel.addEventListener('change', () => { state.bgMode = bgSel.value; render(); });
  $('[data-file="bg"]').addEventListener('change', async e => { const f = e.target.files[0]; state.bgImage = f ? await readFile(f) : ''; render(); });
  const tplSel = $('[data-tpl]');
  tplSel.value = state.template;
  tplSel.addEventListener('change', () => { state.template = tplSel.value; render(); });
  const pairSel = $('[data-pair]');
  pairSel.value = state.premiumAccent;
  pairSel.addEventListener('change', () => { state.premiumAccent = pairSel.value; render(); });

  // stats editor
  const statsEl = $('#stats');
  function drawStats() {
    statsEl.innerHTML = '';
    state.stats.forEach((s, i) => {
      const row = document.createElement('div');
      row.className = 'srow';
      row.innerHTML = `<input data-f="value" aria-label="Value"><input data-f="label" aria-label="Stat name"><button type="button" title="Remove">×</button>`;
      $$('[data-f]', row).forEach(inp => {
        inp.value = s[inp.dataset.f];
        inp.addEventListener('input', () => { s[inp.dataset.f] = inp.value; render(); });
      });
      $('button', row).addEventListener('click', () => { state.stats.splice(i, 1); drawStats(); render(); });
      statsEl.appendChild(row);
    });
    $('#addStat').disabled = state.stats.length >= 5;
  }
  $('#addStat').addEventListener('click', () => { state.stats.push({ label: 'Stat', value: '0' }); drawStats(); render(); });

  // download
  $('#download').addEventListener('click', async () => {
    const btn = $('#download'); btn.disabled = true; btn.textContent = 'Rendering…';
    try {
      const node = $('.mvp', poster);
      const url = await htmlToImage.toPng(node, { width: 1080, height: 1350, pixelRatio: 2, fontEmbedCSS: window.POSTER_FONT_CSS, cacheBust: false });
      const a = document.createElement('a');
      a.download = `mvp-${String(state.player.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
      a.href = url; a.click();
    } catch (e) { alert('Export failed: ' + e.message); }
    btn.disabled = false; btn.textContent = 'Download PNG (HD)';
  });

  // ---- move / resize the player photo: drag on the poster, slider in the form ----
  const frame = $('#frame');
  function applyPos() {
    const img = $('.player', poster);
    if (img) img.setAttribute('style', playerTransform(state.player) + (img.style.display === 'none' ? 'display:none;' : ''));   // keep a removed photo removed
    $('[data-zoom]', sec).value = Math.round(state.player.zoom * 100);
    $('[data-zoom-val]', sec).textContent = Math.round(state.player.zoom * 100) + '%';
  }
  const posterScale = () => frame.getBoundingClientRect().width / 1080;
  // only the photo is dragged here (sections, selection, nudge, remove and undo live in js/studio-edit.js)
  const onPhoto = e => !!e.target.closest('[data-p]');
  let drag = null;
  frame.addEventListener('pointerdown', e => {
    if (!onPhoto(e)) return;
    drag = { x: e.clientX, y: e.clientY, dx: state.player.dx, dy: state.player.dy };
    frame.setPointerCapture(e.pointerId); frame.classList.add('dragging');
  });
  frame.addEventListener('pointermove', e => {
    if (!drag) return;
    const s = posterScale(), p = state.player;
    p.dx = Math.round(drag.dx + (e.clientX - drag.x) / s);
    p.dy = Math.round(drag.dy + (e.clientY - drag.y) / s);
    applyPos();
  });
  const endDrag = () => { if (drag) { drag = null; frame.classList.remove('dragging'); } };
  frame.addEventListener('pointerup', endDrag); frame.addEventListener('pointercancel', endDrag);
  frame.addEventListener('wheel', e => {
    if (!onPhoto(e)) return;
    e.preventDefault();
    const p = state.player;
    p.zoom = Math.min(2, Math.max(0.5, +(p.zoom * (e.deltaY < 0 ? 1.05 : 0.95)).toFixed(3)));
    applyPos();
  }, { passive: false });
  $('[data-zoom]', sec).addEventListener('input', e => { state.player.zoom = e.target.value / 100; applyPos(); });
  $('[data-reset-pos]', sec).addEventListener('click', () => { Object.assign(state.player, { dx: 0, dy: 0, zoom: 1 }); applyPos(); });

  drawStats();
  render();
  applyPos();
  const enhanced = state.player.photo ? JerseyColors.enhancePhoto(state.player.photo).then(src => { state.player.photo = src; render(); }) : null;

  StudioEdit.init({
    frame, poster, state, render, panel: $('#form'), partsBox: $('#parts'), parts: PARTS, moveKey,
    styleOf: k => mvpMoveStyle(state, k),
    photo: { get: () => state.player, changed: () => applyPos() },
    extras: { get: () => [[state.player.dx, state.player.dy, state.player.zoom]], set: v => { [state.player.dx, state.player.dy, state.player.zoom] = v[0]; applyPos(); } },
  });
  editing = true;
  render();

  // ---- reset: every section and the photo of this layout back to the default spot and size ----
  $('#resetAll').addEventListener('click', () => {
    delete state.moves[moveKey()]; delete state.hidden[moveKey()];
    Object.assign(state.player, { dx: 0, dy: 0, zoom: 1 });
    render(); applyPos();
  });

  // detect the sample jersey on load so the demo shows the auto colours
  const colored = document.fonts.ready.then(autoColors);
  window.__ready = Promise.all([enhanced, colored]).then(() => { render(); StudioEdit.reset(); });
  window.__posterState = state;
})();
