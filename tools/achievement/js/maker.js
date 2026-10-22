/* Maker page: form -> state -> poster. The Achievement card (Champions / Runners Up / 3rd Place / own title): one team with
   name, short name, logo (a plain background is cut away, colours come from the logo or the star's jersey), two colours, up to
   3 highlights, an MVP badge, and either one group photo or up to 7 player cut-outs arranged into a squad. HD PNG download. */
(function () {
  const SL = window.SAMPLE_LOGOS || {}, S = window.SAMPLE_PHOTOS || {};
  const state = {
    layout: 'gold',                // gold | neon | ink
    moves: {},                     // admin's drags/sizes per layout
    hidden: {},                    // parts the admin switched off, per layout
    bgMode: 'template',            // 'template' | 'jersey' | 'image'
    bgImage: '',
    logo: '',
    award: 'champ',                // champ | runner | third | custom
    customTitle: 'Qualified',
    script: 'Grand Final',         // the script word over the big title
    event: 'eFCB Winter Cup 2026',
    season: 'Season 4 · 20 Oct 2026',
    team: { name: 'BOD Esports', short: 'BOD', logo: SL.bod || '', color: '#f2b21b', color2: '' },
    stats: [
      { label: 'Final', value: '3-1' },
      { label: 'Prize', value: '৳25,000' },
      { label: 'Record', value: '7W 1D' },
    ],
    photoMode: 'players',          // players | group
    group: { photo: '', dx: 0, dy: 0, zoom: 1 },
    players: [
      { name: 'Rafi', photo: S.png || '' }, { name: 'Areez', photo: S.bod || '' }, { name: 'Sakib', photo: S.ngj || '' },
      { name: 'Tanvir', photo: S.tanvir || '' }, { name: 'Nayeem', photo: S.nexus || '' }, { name: '', photo: '' }, { name: '', photo: '' },
    ].map(p => ({ ...p, m: null, dx: 0, dy: 0, zoom: 1 })),
    mvp: 0,                        // index of the player with the MVP badge, -1 = none
    showNames: true,
    nameTags: true,                // a name tag on each player (off = one names line)
    confetti: true,
    site: 'efcb.com',
    partnersLabel: 'Official partners',
    partners: ['NOVAPAY', 'Pixel Arena', 'BOLT', 'zenith', 'KICKOFF+'].map(name => ({ name, logo: '' })),
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const poster = $('#poster');
  const readFile = f => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
  const loadImage = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

  // names for the "Poster e ki ki thakbe" list and the editor bar (js/studio-edit.js)
  const PARTS = {};
  function syncParts() {
    for (const k of Object.keys(PARTS)) delete PARTS[k];
    const L = state.layout;
    PARTS.head = 'Header (event)';
    if (L === 'gold') Object.assign(PARTS, { seal: 'Trophy seal', crest: 'Team logo + naam', title: 'Boro title', script: 'Script lekha', season: 'Season line', stats: 'Highlights' });
    if (L === 'neon') Object.assign(PARTS, { script: 'Neon script', title: 'Boro title', bolts: 'Lightning', crest: 'Team logo + naam', season: 'Season line', stats: 'Highlights' });
    if (L === 'ink') Object.assign(PARTS, { splash: 'Brush splash', crest: 'Team logo', script: 'Event tag', title: 'Boro title', season: 'Season line', stats: 'Highlights' });
    PARTS.names = 'Player der naam';
    state.players.forEach((p, i) => { if (p.photo) PARTS['p' + i] = `Chobi: ${p.name || 'Player ' + (i + 1)}`; });
    PARTS.p9 = 'Group photo';
    PARTS.tags = 'Player name tags'; PARTS.confetti = 'Confetti';
    PARTS.partners = 'Partners strip';
  }
  let editing = false;

  const render = () => {
    syncParts();
    renderAchievement(poster, state);
    if (editing) StudioEdit.afterRender();
    $('#bgUploadRow').style.display = state.bgMode === 'image' ? '' : 'none';
    $('#customRow').style.display = state.award === 'custom' ? '' : 'none';
    const ms = $('#mvpSel'), opts = '<option value="-1">Keu na</option>' + state.players.map((p, i) => p.photo ? `<option value="${i}">${p.name || 'Player ' + (i + 1)}</option>` : '').join('');
    if (ms.dataset.o !== opts) { ms.innerHTML = opts; ms.dataset.o = opts; }
    ms.value = state.mvp;
    $('#groupRow').style.display = state.photoMode === 'group' ? '' : 'none';
    $('#playersRow').style.display = state.photoMode === 'group' ? 'none' : '';
  };

  // colour helpers
  const toHsl = hex => {
    let [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(h * 60 + 360) % 360, s, l];
  };
  // the two strongest colours of a logo (transparent, white and black pixels skipped)
  async function logoColors(src) {
    const img = await loadImage(src);
    const W = 80, H = Math.max(1, Math.round(80 * img.height / img.width));
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0, W, H);
    const px = ctx.getImageData(0, 0, W, H).data, buckets = {};
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 200) continue;
      const hex = '#' + [px[i], px[i + 1], px[i + 2]].map(v => v.toString(16).padStart(2, '0')).join('');
      const [h, s, l] = toHsl(hex);
      if (s < 0.3 || l < 0.12 || l > 0.9) continue;
      const bk = buckets[Math.floor(h / 20)] || (buckets[Math.floor(h / 20)] = { n: 0, r: 0, g: 0, b: 0 });
      bk.n++; bk.r += px[i]; bk.g += px[i + 1]; bk.b += px[i + 2];
    }
    const top = Object.values(buckets).sort((a, b) => b.n - a.n), hx = b => '#' + [b.r, b.g, b.b].map(v => Math.round(v / b.n).toString(16).padStart(2, '0')).join('');
    return [top[0] && hx(top[0]), top[1] && top[1].n > top[0].n * .15 ? hx(top[1]) : ''];
  }

  /* Logos on a plain white/black/coloured background: everything connected to the border that matches the corner
     colour becomes transparent (soft edge), so the logo sits on the poster without a box. */
  async function clearLogoBg(src) {
    const img = await loadImage(src);
    const s = Math.min(1, 600 / Math.max(img.naturalWidth, img.naturalHeight)), W = Math.round(img.naturalWidth * s), H = Math.round(img.naturalHeight * s);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0, W, H);
    const id = ctx.getImageData(0, 0, W, H), d = id.data, bg = [d[0], d[1], d[2]];
    const dist = i => Math.max(Math.abs(d[i] - bg[0]), Math.abs(d[i + 1] - bg[1]), Math.abs(d[i + 2] - bg[2]));
    const seen = new Uint8Array(W * H), q = [];
    const push = p => { if (!seen[p] && dist(p * 4) < 60) { seen[p] = 1; q.push(p); } };
    for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
    while (q.length) {
      const p = q.pop(), x = p % W;
      if (x > 0) push(p - 1); if (x < W - 1) push(p + 1); if (p >= W) push(p - W); if (p < W * (H - 1)) push(p + W);
    }
    for (let p = 0; p < W * H; p++) if (seen[p]) d[p * 4 + 3] = Math.round(255 * Math.min(1, Math.max(0, (dist(p * 4) - 25) / 35)));
    ctx.putImageData(id, 0, 0);
    return JerseyColors.trimTransparent(cv.toDataURL('image/png'));
  }
  async function hasTransparency(src) {
    const img = await loadImage(src);
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = Math.max(1, Math.round(64 * img.height / img.width));
    const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let clear = 0; for (let i = 3; i < d.length; i += 4) if (d[i] < 200) clear++;
    return clear > d.length / 4 * 0.02;
  }
  // AI background removal in the browser (@imgly/background-removal). The model downloads once, then is cached.
  async function cutOut(file, status, keepAll) {
    if (!window.BgRemoval) throw new Error('library missing');
    status.textContent = 'Background kata hochche…';
    const blob = await BgRemoval.removeBackground(file, {
      model: 'medium', proxyToWorker: false, output: { format: 'image/png', quality: 1 },
      progress: (k, cur, total) => {
        if (k.startsWith('fetch') && total) status.textContent = `AI model download hochche (prothombar): ${Math.round(cur / total * 100)}%`;
        else if (k.startsWith('compute')) status.textContent = 'Background kata hochche…';
      },
    });
    status.textContent = 'Cut-out ready ✓';
    const src = await readFile(blob);
    return keepAll ? src : JerseyColors.keepMainSubject(src);   // a group photo keeps every person
  }
  async function preparePhoto(f, keepAll) {
    const status = $('#phStatus');
    let src = await readFile(f);
    if ($('#cutout').checked && !(await hasTransparency(src))) {
      try { src = await cutOut(f, status, keepAll); }
      catch (err) { console.warn('Auto cut-out failed', err); status.textContent = 'Auto cut-out hoyni (internet lagbe). Normal chobi boshano holo.'; }
    }
    return JerseyColors.trimTransparent(src);
  }

  /* Head size and position measured from the cut-out's alpha, so every player's head comes out the same width in the squad:
     { w, h, head (px), top (hair line y), cx (centre between head and body) } in the photo's own pixels. */
  async function measure(src) {
    const img = await loadImage(src);
    const NW = img.naturalWidth, NH = img.naturalHeight, W = 240, H = Math.max(1, Math.round(240 * NH / NW)), k = NW / W;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data, on = (x, y) => d[(y * W + x) * 4 + 3] > 128;
    let top = -1;
    for (let y = 0; y < H && top < 0; y++) { let n = 0; for (let x = 0; x < W; x++) if (on(x, y)) n++; if (n >= 3) top = y; }
    if (top < 0) return null;
    const runAt = (y, cx) => {
      if (!on(cx, y)) { let best = -1; for (let x = 0; x < W; x++) if (on(x, y) && (best < 0 || Math.abs(x - cx) < Math.abs(best - cx))) best = x; if (best < 0) return null; cx = best; }
      let a = cx, b = cx; while (a > 0 && on(a - 1, y)) a--; while (b < W - 1 && on(b + 1, y)) b++;
      return { a, b, w: b - a + 1, c: (a + b) / 2 };
    };
    let r = null; for (let y = top; y < Math.min(H, top + 8) && !r; y++) { const xs = []; for (let x = 0; x < W; x++) if (on(x, y)) xs.push(x); if (xs.length) r = { c: (xs[0] + xs[xs.length - 1]) / 2 }; }
    let cx = Math.round(r.c), hw = 0;
    for (let pass = 0; pass < 3; pass++) {
      const y = Math.min(H - 1, top + Math.round(pass === 0 ? H * 0.06 : hw * 0.55));
      const run = runAt(y, cx); if (!run) break;
      hw = run.w; cx = Math.round(run.c);
    }
    hw = Math.max(hw, W * 0.12);
    let sx = 0, n = 0;
    for (let y = Math.min(H - 1, top + Math.round(hw * 1.4)); y < H; y += 2) for (let x = 0; x < W; x += 2) if (on(x, y)) { sx += x; n++; }
    const bodyCx = n ? sx / n : cx;
    return { w: NW, h: NH, head: hw * k, top: top * k, cx: (bodyCx * 0.3 + cx * 0.7) * k };
  }
  const measureAll = () => Promise.all(state.players.map(async p => { if (p.photo && !p.m) p.m = await measure(p.photo).catch(() => null); }));

  // ---- poster fields ----
  $$('[data-k]').forEach(i => {
    const k = i.dataset.k;
    if (i.type === 'checkbox') { i.checked = state[k]; i.addEventListener('change', () => { state[k] = i.checked; render(); }); return; }
    i.value = state[k];
    i.addEventListener(i.tagName === 'SELECT' ? 'change' : 'input', () => { state[k] = i.value; render(); });
  });
  $$('[data-file]').forEach(i => i.addEventListener('change', async e => {
    const f = e.target.files[0]; state[i.dataset.file] = f ? await readFile(f) : ''; render();
  }));

  $('#mvpSel').addEventListener('change', e => { state.mvp = +e.target.value; render(); });

  // ---- team ----
  const T = state.team;
  $$('[data-t]').forEach(i => { i.value = T[i.dataset.t] || (i.type === 'color' ? '#000000' : ''); i.addEventListener('input', () => { T[i.dataset.t] = i.value; render(); }); });
  const setColors = (a, b) => { if (!a) return; T.color = a; T.color2 = b || ''; $('[data-t="color"]').value = a; $('[data-t="color2"]').value = b || '#000000'; render(); };
  $('#autoLogo').addEventListener('click', async () => { if (T.logo) try { setColors(...await logoColors(T.logo)); } catch (e) { console.warn('Colour detect failed', e); } });
  $('#autoKit').addEventListener('click', async () => {
    const p = state.players.find(q => q.photo); if (!p) return;
    try { const c = await JerseyColors.pickJerseyColors(p.photo); setColors(c.primary, c.secondary); } catch (e) { console.warn('Colour detect failed', e); }
  });
  $('#teamLogo').addEventListener('change', async e => {
    const f = e.target.files[0]; let logo = f ? await readFile(f) : '';
    if (logo && !(await hasTransparency(logo))) logo = await clearLogoBg(logo);
    T.logo = logo; render();
    if (logo) try { setColors(...await logoColors(logo)); } catch (err) { /* keep the old colours */ }
  });

  // ---- stats ----
  const stpl = $('#statTpl');
  state.stats.forEach((s, i) => {
    const row = stpl.content.firstElementChild.cloneNode(true);
    $$('[data-s]', row).forEach(inp => {
      inp.value = s[inp.dataset.s]; inp.placeholder = inp.dataset.s === 'label' ? `Stat ${i + 1}` : '0';
      inp.addEventListener('input', () => { s[inp.dataset.s] = inp.value; render(); });
    });
    $('#stats').appendChild(row);
  });

  // ---- photos ----
  $('#groupPhoto').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    Object.assign(state.group, { photo: await preparePhoto(f, true), dx: 0, dy: 0, zoom: 1 });
    render();
  });
  const pltpl = $('#playerTpl');
  state.players.forEach((p, i) => {
    const row = pltpl.content.firstElementChild.cloneNode(true);
    const name = $('[data-pn]', row); name.value = p.name; name.placeholder = i ? `Player ${i + 1}` : 'Player 1 (star)';
    name.addEventListener('input', () => { p.name = name.value; render(); });
    $('[data-pp]', row).addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      p.photo = await preparePhoto(f, false);
      p.m = await measure(p.photo).catch(() => null);
      Object.assign(p, { dx: 0, dy: 0, zoom: 1 });
      render();
    });
    $('[data-px]', row).addEventListener('click', () => { p.photo = ''; p.m = null; $('[data-pp]', row).value = ''; render(); });
    $('#players').appendChild(row);
  });

  // ---- partners ----
  const ptpl = $('#partnerTpl'), pwrap = $('#partners');
  state.partners.forEach((p, i) => {
    const row = ptpl.content.firstElementChild.cloneNode(true);
    const name = $('[data-pname]', row); name.value = p.name; name.placeholder = `Partner ${i + 1}`;
    name.addEventListener('input', () => { p.name = name.value; render(); });
    $('[data-plogo]', row).addEventListener('change', async e => { const f = e.target.files[0]; p.logo = f ? await readFile(f) : ''; render(); });
    $('[data-pclear]', row).addEventListener('click', () => { p.logo = ''; p.name = ''; name.value = ''; $('[data-plogo]', row).value = ''; render(); });
    pwrap.appendChild(row);
  });

  // ---- photos: drag = move, wheel = size (sections are moved by js/studio-edit.js); 9 = the group photo ----
  const photoOf = i => i === 9 ? state.group : state.players[i];
  const frame = $('#frame');
  const posterScale = () => frame.getBoundingClientRect().width / 1080;
  let drag = null;
  frame.addEventListener('pointerdown', e => {
    const el = e.target.closest('[data-p]'); if (!el) return;
    const t = photoOf(+el.dataset.p);
    drag = { t, x: e.clientX, y: e.clientY, dx: t.dx, dy: t.dy };
    frame.setPointerCapture(e.pointerId); frame.classList.add('dragging');
  });
  frame.addEventListener('pointermove', e => {
    if (!drag) return;
    const s = posterScale();
    drag.t.dx = Math.round(drag.dx + (e.clientX - drag.x) / s); drag.t.dy = Math.round(drag.dy + (e.clientY - drag.y) / s);
    render();
  });
  const endDrag = () => { const was = drag; drag = null; frame.classList.remove('dragging'); if (was) render(); };
  frame.addEventListener('pointerup', endDrag); frame.addEventListener('pointercancel', endDrag);
  frame.addEventListener('wheel', e => {
    const el = e.target.closest('[data-p]'); if (!el) return;
    e.preventDefault();
    const t = photoOf(+el.dataset.p);
    t.zoom = Math.min(2.5, Math.max(0.4, +(t.zoom * (e.deltaY < 0 ? 1.05 : 0.95)).toFixed(3)));
    render();
  }, { passive: false });

  const allPhotos = () => [...state.players, state.group];
  StudioEdit.init({
    frame, poster, state, render, panel: $('#form'), partsBox: $('#parts'), parts: PARTS,
    moveKey: () => acMoveKey(state), styleOf: k => acMoveStyle(state, k),
    photo: { get: photoOf, changed: () => {} },
    extras: { get: () => allPhotos().map(t => [t.dx, t.dy, t.zoom]), set: v => { allPhotos().forEach((t, i) => { [t.dx, t.dy, t.zoom] = v[i]; }); } },
  });
  editing = true;

  // ---- reset: every section and every photo of this layout back to the default spot and size ----
  $('#resetAll').addEventListener('click', () => {
    delete state.moves[acMoveKey(state)]; delete state.hidden[acMoveKey(state)];
    allPhotos().forEach(t => Object.assign(t, { dx: 0, dy: 0, zoom: 1 }));
    render();
  });

  // ---- download: 2x (2160 × 2700) so text and edges stay sharp ----
  $('#download').addEventListener('click', async () => {
    const btn = $('#download'); btn.disabled = true; btn.textContent = 'Rendering…';
    try {
      const url = await htmlToImage.toPng($('.ac', poster), { width: 1080, height: 1350, pixelRatio: 2, fontEmbedCSS: window.POSTER_FONT_CSS, cacheBust: false });
      const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const a = document.createElement('a');
      a.download = `achievement-${slug(T.name)}-${state.layout}.png`;
      a.href = url; a.click();
    } catch (e) { alert('Export failed: ' + e.message); }
    btn.disabled = false; btn.textContent = 'Download PNG (HD)';
  });

  render();
  document.fonts.addEventListener('loadingdone', () => render());   // a late font changes text widths, so fit again
  const fontsReady = Promise.all(['italic 900 40px Kanit', 'italic 800 40px Kanit', '400 40px "Bebas Neue"', '400 40px "Kaushan Script"', '700 20px Rajdhani',
    '800 20px "Saira Condensed"', '800 20px Manrope', '700 20px Manrope'].map(f => document.fonts.load(f))).catch(() => {});
  window.__ready = Promise.all([fontsReady, measureAll()]).then(() => { render(); StudioEdit.reset(); });
  window.__posterState = state;
  window.__render = render;
})();
