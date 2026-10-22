/* Maker page: form -> state -> poster. Up to 16 teams with logo, colour, W/D/L, goals and form; the table works out played,
   goal difference and points and sorts itself. Spotlight layout shows the leader's player cut-out (drag/size). HD PNG download. */
(function () {
  const SL = window.SAMPLE_LOGOS || {}, S = window.SAMPLE_PHOTOS || {};
  const T = (name, player, color, logo, w, d, l, gf, ga, form) => ({ name, player, color, logo: SL[logo] || '', w, d, l, gf, ga, pts: '', form, short: '' });
  const MAX = 16;
  const state = {
    layout: 'spot',                // spot | neon | led
    moves: {},                     // admin's drags/sizes per layout
    hidden: {},                    // parts the admin switched off, per layout
    bgMode: 'template',            // 'template' | 'jersey' | 'image'
    bgImage: '',
    logo: '',
    title: 'Points Table',
    event: 'eFCB Winter Cup 2026',
    stage: 'Group A · Matchweek 11',
    teamLabel: 'Team',
    count: 12,
    autoSort: true,
    showPlayer: true,
    cols: { spot: { goals: false, form: false }, neon: { goals: true, form: true }, led: { goals: true, form: true } },   // GF/GA and form, per layout
    upN: 4, upLabel: 'Next round',
    downN: 2, downLabel: 'Eliminated',
    capLabel: 'Table topper',
    spot: { photo: S.tanvir || '', name: 'Tanvir', dx: 0, dy: 0, zoom: 1 },
    teams: [
      T('Man City', 'Tanvir', '#6cabdd', 'man-city', 8, 2, 1, 27, 9, 'WWDWW'),
      T('Arsenal', 'Nayeem', '#ef0107', 'arsenal', 7, 3, 1, 22, 10, 'WDWWL'),
      T('Liverpool', 'Rafi', '#c8102e', 'liverpool', 7, 2, 2, 25, 13, 'WLWWD'),
      T('Real Madrid', 'Shanto', '#febe10', 'real-madrid', 6, 3, 2, 20, 12, 'DWWLW'),
      T('Barcelona', 'Arif', '#a50044', 'barcelona', 6, 2, 3, 24, 16, 'WWLDW'),
      T('Bayern', 'Mahin', '#dc052d', 'bayern', 5, 3, 3, 19, 15, 'LWDWW'),
      T('Inter', 'Sakib', '#0068a8', 'inter', 5, 2, 4, 15, 14, 'WLLWD'),
      T('PSG', 'Ovi', '#004170', 'psg', 4, 3, 4, 17, 18, 'DLWLW'),
      T('Juventus', 'Rakib', '#1a1a1a', 'juventus', 3, 4, 4, 12, 15, 'DDLWL'),
      T('AC Milan', 'Jisan', '#fb090b', 'ac-milan', 3, 2, 6, 13, 20, 'LLWDL'),
      T('Man United', 'Fahim', '#da291c', 'man-united', 2, 3, 6, 10, 21, 'LDLLW'),
      T('Al Nassr', 'Mehedi', '#f9d200', 'al-nassr', 1, 1, 9, 8, 29, 'LLLDL'),
      ...Array.from({ length: 4 }, (_, i) => T('Team ' + (13 + i), '', '#6a3fd6', '', 0, 0, 0, 0, 0, '')),
    ],
    site: 'efcb.com',
    partnersLabel: 'Official partners',
    partners: ['NOVAPAY', 'Pixel Arena', 'BOLT', 'zenith', 'KICKOFF+'].map(name => ({ name, logo: '' })),
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const poster = $('#poster');
  const readFile = f => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
  const loadImage = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

  // names for the "Poster e ki ki thakbe" list and the editor bar (js/studio-edit.js); rows are named by their place
  const PARTS = {};
  function syncParts() {
    for (const k of Object.keys(PARTS)) delete PARTS[k];
    Object.assign(PARTS, { head: 'Header / title', legend: 'Zone legend (rong er mane)', board: 'Scoreboard frame', big: 'Boro #1 lekha', p0: 'Spotlight chobi', cap: 'Spotlight nam box', th: 'Table er heading' });
    ptRows(state).forEach((r, k) => { PARTS['r' + k] = `Row ${k + 1} (${r.t.name || '—'})`; });
    PARTS.partners = 'Partners strip';
  }
  let editing = false;

  const render = () => {
    syncParts();
    renderTable(poster, state);
    if (editing) StudioEdit.afterRender();
    $('#bgUploadRow').style.display = state.bgMode === 'image' ? '' : 'none';
    $$('[data-show]').forEach(el => el.style.display = el.dataset.show.split(' ').includes(state.layout) ? '' : 'none');
    const rank = {}; ptRows(state).forEach(r => rank[r.i] = r);
    $$('#teams .pdet').forEach((d, i) => {
      d.style.display = i < state.count ? '' : 'none';
      const r = rank[i];
      $('summary', d).textContent = r ? `#${r.rank} · ${state.teams[i].name || '—'} · ${r.pts} pts` : state.teams[i].name;
    });
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
  // the strongest colour of a logo (transparent, white and black pixels skipped)
  async function logoColor(src) {
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
    const top = Object.values(buckets).sort((a, b) => b.n - a.n)[0];
    return top ? '#' + [top.r, top.g, top.b].map(v => Math.round(v / top.n).toString(16).padStart(2, '0')).join('') : null;
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
  async function cutOut(file, status) {
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
    return JerseyColors.keepMainSubject(await readFile(blob));
  }

  // ---- poster fields ----
  $$('[data-k]').forEach(i => {
    const k = i.dataset.k, isNum = ['count', 'upN', 'downN'].includes(k);
    if (i.type === 'checkbox') { i.checked = state[k]; i.addEventListener('change', () => { state[k] = i.checked; render(); }); return; }
    i.value = state[k];
    i.addEventListener(i.tagName === 'SELECT' ? 'change' : 'input', () => { state[k] = isNum ? Math.max(0, +i.value || 0) : i.value; if (k === 'layout') syncCols(); render(); });
  });
  $$('[data-file]').forEach(i => i.addEventListener('change', async e => {
    const f = e.target.files[0]; state[i.dataset.file] = f ? await readFile(f) : ''; render();
  }));

  // GF/GA and form columns are kept per layout (the Spotlight table is narrower, so it starts without them)
  function syncCols() { const c = state.cols[state.layout]; $('#showGoals').checked = c.goals; $('#showForm').checked = c.form; }
  $('#showGoals').addEventListener('change', e => { state.cols[state.layout].goals = e.target.checked; render(); });
  $('#showForm').addEventListener('change', e => { state.cols[state.layout].form = e.target.checked; render(); });
  syncCols();

  // ---- spotlight player ----
  const zoomSync = () => { const z = Math.round(state.spot.zoom * 100); $('#spZoom').value = z; $('#spZoomVal').textContent = z + '%'; };
  $('#spName').value = state.spot.name;
  $('#spName').addEventListener('input', e => { state.spot.name = e.target.value; render(); });
  $('#spPhoto').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    const status = $('#spStatus');
    let src = await readFile(f);
    if ($('#cutout').checked && !(await hasTransparency(src))) {
      try { src = await cutOut(f, status); }
      catch (err) { console.warn('Auto cut-out failed', err); status.textContent = 'Auto cut-out hoyni (internet lagbe). Normal chobi boshano holo.'; }
    }
    state.spot.photo = await JerseyColors.trimTransparent(src);
    Object.assign(state.spot, { dx: 0, dy: 0, zoom: 1 });
    render(); zoomSync();
  });
  $('#spZoom').addEventListener('input', e => { state.spot.zoom = e.target.value / 100; render(); zoomSync(); });
  $('#spReset').addEventListener('click', () => { Object.assign(state.spot, { dx: 0, dy: 0, zoom: 1 }); render(); zoomSync(); });

  // ---- the teams ----
  const tpl = $('#teamTpl'), wrap = $('#teams');
  state.teams.forEach((t, i) => {
    const sec = tpl.content.firstElementChild.cloneNode(true);
    wrap.appendChild(sec);
    $$('[data-f]', sec).forEach(inp => {
      inp.value = t[inp.dataset.f];
      inp.addEventListener('input', () => { t[inp.dataset.f] = inp.value; render(); });
    });
    const setColor = hex => { if (!hex) return; t.color = hex; $('[data-f="color"]', sec).value = hex; render(); };
    $('[data-auto]', sec).addEventListener('click', async () => { if (t.logo) try { setColor(await logoColor(t.logo)); } catch (e) { console.warn('Colour detect failed', e); } });
    $('[data-logo]', sec).addEventListener('change', async e => {
      const f = e.target.files[0]; let logo = f ? await readFile(f) : '';
      if (logo && !(await hasTransparency(logo))) logo = await clearLogoBg(logo);
      t.logo = logo; render();
      if (logo) try { setColor(await logoColor(logo)); } catch (err) { /* keep the old colour */ }
    });
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

  // ---- spotlight photo: drag = move, wheel = size (sections are moved by js/studio-edit.js) ----
  const frame = $('#frame');
  const posterScale = () => frame.getBoundingClientRect().width / 1080;
  let drag = null;
  frame.addEventListener('pointerdown', e => {
    const el = e.target.closest('[data-p]'); if (!el) return;
    drag = { el, x: e.clientX, y: e.clientY, dx: state.spot.dx, dy: state.spot.dy };
    frame.setPointerCapture(e.pointerId); frame.classList.add('dragging');
  });
  frame.addEventListener('pointermove', e => {
    if (!drag) return;
    const s = posterScale();
    state.spot.dx = Math.round(drag.dx + (e.clientX - drag.x) / s); state.spot.dy = Math.round(drag.dy + (e.clientY - drag.y) / s);
    drag.el.style.cssText = ptPhotoStyle(state.spot);
  });
  const endDrag = () => { const was = drag; drag = null; frame.classList.remove('dragging'); if (was) render(); };
  frame.addEventListener('pointerup', endDrag); frame.addEventListener('pointercancel', endDrag);
  frame.addEventListener('wheel', e => {
    if (!e.target.closest('[data-p]')) return;
    e.preventDefault();
    state.spot.zoom = Math.min(2.5, Math.max(0.4, +(state.spot.zoom * (e.deltaY < 0 ? 1.05 : 0.95)).toFixed(3)));
    render(); zoomSync();
  }, { passive: false });

  StudioEdit.init({
    frame, poster, state, render, panel: $('#form'), partsBox: $('#parts'), parts: PARTS,
    moveKey: () => ptMoveKey(state), styleOf: k => ptMoveStyle(state, k),
    photo: { get: () => state.spot, changed: () => zoomSync(), box: el => el.closest('.phw') },
    extras: { get: () => [state.spot.dx, state.spot.dy, state.spot.zoom], set: v => { [state.spot.dx, state.spot.dy, state.spot.zoom] = v; zoomSync(); } },
  });
  editing = true;

  // ---- reset: every section and the photo of this layout back to the default spot and size ----
  $('#resetAll').addEventListener('click', () => {
    delete state.moves[ptMoveKey(state)]; delete state.hidden[ptMoveKey(state)];
    Object.assign(state.spot, { dx: 0, dy: 0, zoom: 1 }); zoomSync();
    render();
  });

  // ---- download: 2x (2160 × 2700) so text and edges stay sharp ----
  $('#download').addEventListener('click', async () => {
    const btn = $('#download'); btn.disabled = true; btn.textContent = 'Rendering…';
    try {
      const url = await htmlToImage.toPng($('.pt', poster), { width: 1080, height: 1350, pixelRatio: 2, fontEmbedCSS: window.POSTER_FONT_CSS, cacheBust: false });
      const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const a = document.createElement('a');
      a.download = `points-table-${slug(state.stage) || 'table'}-${state.layout}.png`;
      a.href = url; a.click();
    } catch (e) { alert('Export failed: ' + e.message); }
    btn.disabled = false; btn.textContent = 'Download PNG (HD)';
  });

  $('[data-k="count"]').max = MAX;
  render();
  document.fonts.addEventListener('loadingdone', () => render());   // a late font changes text widths, so fit again
  const fontsReady = Promise.all(['700 40px Oswald', '600 40px Oswald', '700 20px Rajdhani', '600 20px Rajdhani', '700 40px "Chakra Petch"', '600 20px "Chakra Petch"',
    '500 20px "Chakra Petch"', '900 40px Doto', '700 20px Doto'].map(f => document.fonts.load(f))).catch(() => {});
  window.__ready = fontsReady.then(() => { render(); StudioEdit.reset(); });
  window.__posterState = state;
  window.__render = render;
})();
