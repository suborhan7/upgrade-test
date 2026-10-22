/* Maker page: form -> data -> poster, plus jersey colour auto-detect and PNG download. */
(function () {
  const state = {
    tag: 'Semi Final',
    kicker: 'eFCB PRO LEAGUE · SEASON 2',
    title: 'Head to Head',
    layout: 2,                     // 1 | 2 | 3 (classic) | 'clash' | 'torn' (js/versus.js)
    bgStyle: 'halves',             // Classic: 'halves' | 'stadium' | 'smoke' | 'grid' | 'brush' (js/poster.js scene())
    theme: 'jersey',               // Classic colours: 'jersey' (auto from the kits) or a fixed pair from CMP_THEMES
    bgMode: 'template',            // Crest Clash / Torn Poster: 'template' | 'jersey' | 'image'
    bgImage: '',
    site: 'efcb.com',
    partnersLabel: 'Official partners',
    partners: ['NOVAPAY', 'Pixel Arena', 'BOLT', 'zenith', 'KICKOFF+'].map(name => ({ name, logo: '' })),
    moves: {},                     // admin's drags/sizes per layout: { '2': { stats: { x, y, s, ox, oy } } }
    hidden: {},                    // parts the admin switched off, per layout: { '2': { tag: true } }
    logo: '',
    a: { dx: 0, dy: 0, zoom: 1, name: 'Nova_10', team: 'Dhaka Strikers', logo: (window.SAMPLE_LOGOS || {}).a || '', photo: (window.SAMPLE_PHOTOS || {}).a || '', sample: true, primary: '#f2c200', secondary: '#111111' },
    b: { dx: 0, dy: 0, zoom: 1, name: 'Red Wolf', team: 'Chattogram Kings', logo: (window.SAMPLE_LOGOS || {}).b || '', photo: (window.SAMPLE_PHOTOS || {}).b || '', sample: true, primary: '#d8202f', secondary: '#111111' },
    stats: [
      { label: 'Matches', a: '24', b: '22', better: 'none' },
      { label: 'Wins', a: '17', b: '16', better: 'high' },
      { label: 'Goals', a: '58', b: '63', better: 'high' },
      { label: 'Assists', a: '21', b: '14', better: 'high' },
      { label: 'Clean Sheets', a: '9', b: '7', better: 'high' },
      { label: 'Goals Conceded', a: '19', b: '24', better: 'low' },
      { label: 'Win Rate', a: '71%', b: '73%', better: 'high' },
    ],
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const poster = $('#poster');
  // names for the "Poster e ki ki thakbe" list and the editor bar (js/studio-edit.js)
  const PARTS = { brand: 'Logo', tag: 'Tag (top right)', title: 'Title', stats: 'Stats panel', nameA: 'Player 1 name',
    nameB: 'Player 2 name', vs: 'VS', ghostA: 'Player 1 boro outline naam', ghostB: 'Player 2 boro outline naam',
    p0: 'Player 1 photo', p1: 'Player 2 photo', seam: 'Lightning seam', teamA: 'Player 1 team + tag', teamB: 'Player 2 team + tag', kick: 'League line', paper: 'Chhera kagoj',
    partners: 'Partners strip' };
  const KEYS = ['a', 'b'], moveKey = () => String(state.layout);
  const isVs = () => (window.CMP_VS_LAYOUTS || []).includes(state.layout);
  let editing = false;
  const render = () => { renderComparison(poster, state); if (editing) StudioEdit.afterRender(); };
  const readFile = f => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });

  async function autoColors(key) {
    if (!state[key].photo) return;
    try {
      const c = await JerseyColors.pickJerseyColors(state[key].photo);
      Object.assign(state[key], c);
      const sec = $(`[data-player="${key}"]`);
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



  // poster fields
  $$('[data-k]').forEach(i => { i.value = state[i.dataset.k]; i.addEventListener('input', () => { state[i.dataset.k] = i.value; render(); }); });
  $('[data-file="logo"]').addEventListener('change', async e => { const f = e.target.files[0]; state.logo = f ? await readFile(f) : ''; render(); });

  // player fields
  $$('[data-player]').forEach(sec => {
    const key = sec.dataset.player;
    $$('[data-p]', sec).forEach(i => {
      i.value = state[key][i.dataset.p];
      i.addEventListener('input', () => { state[key][i.dataset.p] = i.value; render(); });
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
      state[key].photo = await JerseyColors.enhancePhoto(await JerseyColors.trimTransparent(src));
      Object.assign(state[key], { dx: 0, dy: 0, zoom: 1, sample: false }); // new photo starts at the default spot
      render();
      applyPos(key);
      autoColors(key); // new photo -> new jersey colours
    });
    $('[data-auto]', sec).addEventListener('click', () => autoColors(key));
  });

  // layout, background and partners (the last two only show for Crest Clash / Torn Poster)
  const showVs = () => {
    $$('[data-vs]').forEach(el => { el.style.display = isVs() ? '' : 'none'; });
    $$('[data-classic]').forEach(el => { el.style.display = isVs() ? 'none' : ''; });
    $('#bgUploadRow').style.display = isVs() && state.bgMode === 'image' ? '' : 'none';
  };
  $('#layoutSel').value = String(state.layout);
  /* demo content per layout family: Classic keeps its original sample (Nova_10 / Red Wolf, Head to Head),
     Crest Clash / Torn Poster use the clean cut-outs with club teams. Only untouched sample values are swapped. */
  const DEMO = {
    classic: { title: 'Head to Head', a: { team: 'Dhaka Strikers', photo: (window.SAMPLE_PHOTOS || {}).a }, b: { team: 'Chattogram Kings', photo: (window.SAMPLE_PHOTOS || {}).b } },
    vs: { title: 'Player Comparison', a: { team: 'FC Barcelona', photo: (window.SAMPLE_PHOTOS_VS || {}).a }, b: { team: 'Real Madrid', photo: (window.SAMPLE_PHOTOS_VS || {}).b } },
  };
  let family = 'classic';
  async function swapDemo() {
    if ((isVs() ? 'vs' : 'classic') === family) return;
    family = isVs() ? 'vs' : 'classic';
    const to = DEMO[family], from = DEMO[family === 'vs' ? 'classic' : 'vs'];
    if (state.title === from.title) { state.title = to.title; $('[data-k="title"]').value = to.title; }
    await Promise.all(KEYS.map(async k => {
      const sec = $(`[data-player="${k}"]`);
      if (state[k].team === from[k].team) { state[k].team = to[k].team; $('[data-p="team"]', sec).value = to[k].team; }
      if (state[k].sample && to[k].photo) { state[k].photo = await JerseyColors.enhancePhoto(to[k].photo); await autoColors(k); }
    }));
    render(); KEYS.forEach(applyPos);
  }
  $('#layoutSel').addEventListener('change', e => { const v = e.target.value; state.layout = /^\d+$/.test(v) ? +v : v; showVs(); render(); KEYS.forEach(applyPos); swapDemo(); });
  $('[data-k="bgMode"]').addEventListener('change', showVs);
  $('[data-file="bgImage"]').addEventListener('change', async e => { const f = e.target.files[0]; state.bgImage = f ? await readFile(f) : ''; render(); });
  $$('[data-player]').forEach(sec => $('[data-logo]', sec).addEventListener('change', async e => {
    const f = e.target.files[0]; state[sec.dataset.player].logo = f ? await readFile(f) : ''; render();
  }));
  const ptpl = $('#partnerTpl');
  state.partners.forEach((p, i) => {
    const row = ptpl.content.firstElementChild.cloneNode(true);
    const name = $('[data-pname]', row); name.value = p.name; name.placeholder = `Partner ${i + 1}`;
    name.addEventListener('input', () => { p.name = name.value; render(); });
    $('[data-plogo]', row).addEventListener('change', async e => { const f = e.target.files[0]; p.logo = f ? await readFile(f) : ''; render(); });
    $('[data-pclear]', row).addEventListener('click', () => { p.logo = ''; p.name = ''; name.value = ''; $('[data-plogo]', row).value = ''; render(); });
    $('#partners').appendChild(row);
  });
  showVs();

  // stats editor
  const statsEl = $('#stats');
  function drawStats() {
    statsEl.innerHTML = '';
    state.stats.forEach((s, i) => {
      const row = document.createElement('div');
      row.className = 'stat';
      row.innerHTML = `<input data-f="a"><input data-f="label"><input data-f="b">
        <select data-f="better"><option value="high">Higher</option><option value="low">Lower</option><option value="none">—</option></select>
        <button type="button" title="Remove">×</button>`;
      $$('[data-f]', row).forEach(inp => {
        inp.value = s[inp.dataset.f];
        inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => { s[inp.dataset.f] = inp.value; render(); });
      });
      $('button', row).addEventListener('click', () => { state.stats.splice(i, 1); drawStats(); render(); });
      statsEl.appendChild(row);
    });
    $('#addStat').disabled = state.stats.length >= 7;
  }
  $('#addStat').addEventListener('click', () => { state.stats.push({ label: 'Stat', a: '0', b: '0', better: 'high' }); drawStats(); render(); });

  // download
  $('#download').addEventListener('click', async () => {
    const btn = $('#download'); btn.disabled = true; btn.textContent = 'Rendering…';
    try {
      const node = poster.firstElementChild;
      const url = await htmlToImage.toPng(node, { width: 1080, height: 1350, pixelRatio: 2, fontEmbedCSS: window.POSTER_FONT_CSS, cacheBust: false });
      const a = document.createElement('a');
      a.download = `comparison-${(state.a.name + '-vs-' + state.b.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
      a.href = url; a.click();
    } catch (e) { alert('Export failed: ' + e.message); }
    btn.disabled = false; btn.textContent = 'Download PNG (HD)';
  });

  drawStats();
  render();
  const enhanced = Promise.all(['a', 'b'].map(async k => { if (state[k].photo) state[k].photo = await JerseyColors.enhancePhoto(state[k].photo); })).then(render);
  // ---- move / resize player photos: drag on the poster, sliders in the form ----
  const frame = $('#frame');
  const applyPos = key => {
    const img = $(`.player-${key}`, poster);
    if (img) img.setAttribute('style', (isVs() ? cmpPhotoStyle(state, key) : playerTransform(state[key])) + (img.style.display === 'none' ? 'display:none;' : ''));   // keep a removed photo removed
    const sec = $(`[data-player="${key}"]`);
    $('[data-zoom]', sec).value = Math.round(state[key].zoom * 100);
    $('[data-zoom-val]', sec).textContent = Math.round(state[key].zoom * 100) + '%';
  };
  const posterScale = () => frame.getBoundingClientRect().width / 1080;
  // only the photos are dragged here (sections, selection, nudge, remove and undo live in js/studio-edit.js)
  const photoAt = e => { const el = e.target.closest('[data-p]'); return el ? KEYS[+el.dataset.p] : null; };
  let drag = null;
  frame.addEventListener('pointerdown', e => {
    const key = photoAt(e); if (!key) return;
    drag = { key, x: e.clientX, y: e.clientY, dx: state[key].dx, dy: state[key].dy };
    frame.setPointerCapture(e.pointerId); frame.classList.add('dragging');
  });
  frame.addEventListener('pointermove', e => {
    if (!drag) return;
    const s = posterScale(), p = state[drag.key];
    p.dx = Math.round(drag.dx + (e.clientX - drag.x) / s);
    p.dy = Math.round(drag.dy + (e.clientY - drag.y) / s);
    applyPos(drag.key);
  });
  const endDrag = () => { if (drag) { drag = null; frame.classList.remove('dragging'); } };
  frame.addEventListener('pointerup', endDrag); frame.addEventListener('pointercancel', endDrag);
  frame.addEventListener('wheel', e => {
    const key = photoAt(e); if (!key) return;
    e.preventDefault();
    const p = state[key];
    p.zoom = Math.min(2, Math.max(0.5, +(p.zoom * (e.deltaY < 0 ? 1.05 : 0.95)).toFixed(3)));
    applyPos(key);
  }, { passive: false });
  $$('[data-player]').forEach(sec => {
    const key = sec.dataset.player;
    $('[data-zoom]', sec).addEventListener('input', e => { state[key].zoom = e.target.value / 100; applyPos(key); });
    $('[data-reset-pos]', sec).addEventListener('click', () => { Object.assign(state[key], { dx: 0, dy: 0, zoom: 1 }); applyPos(key); });
    applyPos(key);
  });

  StudioEdit.init({
    frame, poster, state, render, panel: $('#form'), partsBox: $('#parts'), parts: PARTS, moveKey,
    photo: { get: i => state[KEYS[i]], changed: i => applyPos(KEYS[i]) },
    extras: { get: () => KEYS.map(k => [state[k].dx, state[k].dy, state[k].zoom]), set: v => v.forEach((p, i) => { [state[KEYS[i]].dx, state[KEYS[i]].dy, state[KEYS[i]].zoom] = p; applyPos(KEYS[i]); }) },
  });
  editing = true;
  render();

  // ---- reset: every section and both photos of this layout back to the default spot and size ----
  $('#resetAll').addEventListener('click', () => {
    delete state.moves[moveKey()]; delete state.hidden[moveKey()];
    KEYS.forEach(k => Object.assign(state[k], { dx: 0, dy: 0, zoom: 1 }));
    render(); KEYS.forEach(applyPos);
  });

  // detect the sample jerseys on load so the demo shows the auto colours
  const colored = document.fonts.ready.then(() => Promise.all([autoColors('a'), autoColors('b')]));
  window.__ready = Promise.all([enhanced, colored]).then(() => { render(); StudioEdit.reset(); });
  window.__posterState = state;
})();
