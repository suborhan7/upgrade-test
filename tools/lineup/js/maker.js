/* Maker page: form -> state -> poster. Two teams, each with name, logo (a plain background is cut away, the colour comes from the
   logo), colour, formation, the captain with a photo (name taken from the (C) player unless typed) (auto cut-out, drag/size on the poster), up to 11 starters
   (one per line: number, name, position, (C) for the captain) and subs. HD PNG download. */
(function () {
  const SL = window.SAMPLE_LOGOS || {}, S = window.SAMPLE_PHOTOS || {};
  const state = {
    layout: 'face',                // face | shirts | holo
    moves: {},                     // admin's drags/sizes per layout
    hidden: {},                    // parts the admin switched off, per layout
    bgMode: 'template',            // 'template' | 'jersey' | 'image'
    bgImage: '',
    logo: '',
    title: 'Starting XI',
    event: 'eFCB Winter Cup 2026',
    stage: 'Semi-final · Leg 1',
    date: '2026-10-28',
    time: '9:30 PM',
    live: 'facebook.com/efcb',
    gamerLabel: 'Captain',
    showNum: true, showPos: true, showCap: true, showSubs: true, showPhotos: true,
    teams: [
      { name: 'Barcelona', gamer: '', color: '#a50044', logo: SL.barcelona || '', photo: S.cmf || '', dx: 0, dy: 0, zoom: 1, formation: '4-3-3',
        xi: '13 Joan Garcia GK\n23 Kounde RB\n2 Cubarsi CB\n24 Eric Garcia CB\n3 Balde LB\n21 De Jong CM (C)\n8 Pedri CM\n16 Fermin AM\n10 Yamal RW\n11 Raphinha LW\n9 Lewandowski ST',
        subs: 'Szczesny, Araujo, Christensen, Gerard Martin, Casado, Gavi, Olmo, Rashford, Ferran Torres' },
      { name: 'Real Madrid', gamer: '', color: '#febe10', logo: SL['real-madrid'] || '', photo: S.llfc || '', dx: 0, dy: 0, zoom: 1, formation: '4-3-3',
        xi: '1 Courtois GK\n8 Valverde RB (C)\n17 Asencio CB\n24 Huijsen CB\n18 Carreras LB\n14 Tchouameni DM\n6 Camavinga CM\n5 Bellingham CM\n11 Rodrygo RW\n7 Vinicius LW\n10 Mbappe ST',
        subs: 'Lunin, Carvajal, Alaba, Rudiger, Mendy, Arda Guler, Ceballos, Brahim, Mastantuono, Gonzalo' },
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

  // names for the "Poster e ki ki thakbe" list and the editor bar (js/studio-edit.js)
  const PARTS = {};
  function syncParts() {
    for (const k of Object.keys(PARTS)) delete PARTS[k];
    const [a, b] = state.teams.map(t => t.name || 'Team');
    const L = state.layout;
    PARTS.head = 'Header / title';
    if (L === 'face') Object.assign(PARTS, { crests: 'Logo + X + team name', spine: 'Majher line', l0: `List: ${a}`, l1: `List: ${b}`, s0: `Subs: ${a}`, s1: `Subs: ${b}`, g0: `Captain plate: ${a}`, g1: `Captain plate: ${b}`, info: 'Live line' });
    if (L === 'shirts') Object.assign(PARTS, { t0: `Shirts: ${a}`, t1: `Shirts: ${b}`, s0: `Subs: ${a}`, s1: `Subs: ${b}`, g0: `Captain plate: ${a}`, g1: `Captain plate: ${b}`, band: 'VS band (stage, date)' });
    if (L === 'holo') Object.assign(PARTS, { vs: 'VS + stage + date', t0: `Panel: ${a}`, t1: `Panel: ${b}` });
    PARTS.p0 = `Captain er chobi: ${a}`; PARTS.p1 = `Captain er chobi: ${b}`;
    PARTS.partners = 'Partners strip';
  }
  let editing = false;

  const render = () => {
    syncParts();
    renderLineup(poster, state);
    if (editing) StudioEdit.afterRender();
    $('#bgUploadRow').style.display = state.bgMode === 'image' ? '' : 'none';
    $$('#teams .pdet').forEach((d, i) => {
      const t = state.teams[i];
      $('summary', d).textContent = `Team ${i + 1}: ${t.name || '—'} · ${luParse(t.xi).length} jon`;
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
    const k = i.dataset.k;
    if (i.type === 'checkbox') { i.checked = state[k]; i.addEventListener('change', () => { state[k] = i.checked; render(); }); return; }
    i.value = state[k];
    i.addEventListener(i.tagName === 'SELECT' ? 'change' : 'input', () => { state[k] = i.value; render(); });
  });
  $$('[data-file]').forEach(i => i.addEventListener('change', async e => {
    const f = e.target.files[0]; state[i.dataset.file] = f ? await readFile(f) : ''; render();
  }));

  // ---- the two teams ----
  const tpl = $('#teamTpl'), wrap = $('#teams');
  state.teams.forEach((t, ti) => {
    const box = tpl.content.firstElementChild.cloneNode(true);
    if (ti === 0) box.open = true;
    wrap.appendChild(box);
    $$('[data-f]', box).forEach(inp => { inp.value = t[inp.dataset.f]; inp.addEventListener('input', () => { t[inp.dataset.f] = inp.value; render(); }); });
    const setColor = hex => { if (!hex) return; t.color = hex; $('[data-f="color"]', box).value = hex; render(); };
    $('[data-auto]', box).addEventListener('click', async () => { if (t.logo) try { setColor(await logoColor(t.logo)); } catch (e) { console.warn('Colour detect failed', e); } });
    $('[data-logo]', box).addEventListener('change', async e => {
      const f = e.target.files[0]; let logo = f ? await readFile(f) : '';
      if (logo && !(await hasTransparency(logo))) logo = await clearLogoBg(logo);
      t.logo = logo; render();
      if (logo) try { setColor(await logoColor(logo)); } catch (err) { /* keep the old colour */ }
    });
    $('[data-photo]', box).addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      const status = $('#phStatus');
      let src = await readFile(f);
      if ($('#cutout').checked && !(await hasTransparency(src))) {
        try { src = await cutOut(f, status); }
        catch (err) { console.warn('Auto cut-out failed', err); status.textContent = 'Auto cut-out hoyni (internet lagbe). Normal chobi boshano holo.'; }
      }
      t.photo = await JerseyColors.trimTransparent(src);
      Object.assign(t, { dx: 0, dy: 0, zoom: 1 });
      render();
    });
    $('[data-noph]', box).addEventListener('click', () => { t.photo = ''; $('[data-photo]', box).value = ''; render(); });
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

  // ---- captain photos: drag = move, wheel = size (sections are moved by js/studio-edit.js) ----
  const frame = $('#frame');
  const posterScale = () => frame.getBoundingClientRect().width / 1080;
  let drag = null;
  frame.addEventListener('pointerdown', e => {
    const el = e.target.closest('[data-p]'); if (!el) return;
    const t = state.teams[+el.dataset.p];
    drag = { el, t, x: e.clientX, y: e.clientY, dx: t.dx, dy: t.dy };
    frame.setPointerCapture(e.pointerId); frame.classList.add('dragging');
  });
  frame.addEventListener('pointermove', e => {
    if (!drag) return;
    const s = posterScale();
    drag.t.dx = Math.round(drag.dx + (e.clientX - drag.x) / s); drag.t.dy = Math.round(drag.dy + (e.clientY - drag.y) / s);
    drag.el.style.cssText = luPhotoStyle(drag.t);
  });
  const endDrag = () => { const was = drag; drag = null; frame.classList.remove('dragging'); if (was) render(); };
  frame.addEventListener('pointerup', endDrag); frame.addEventListener('pointercancel', endDrag);
  frame.addEventListener('wheel', e => {
    const el = e.target.closest('[data-p]'); if (!el) return;
    e.preventDefault();
    const t = state.teams[+el.dataset.p];
    t.zoom = Math.min(2.5, Math.max(0.4, +(t.zoom * (e.deltaY < 0 ? 1.05 : 0.95)).toFixed(3)));
    render();
  }, { passive: false });

  StudioEdit.init({
    frame, poster, state, render, panel: $('#form'), partsBox: $('#parts'), parts: PARTS,
    moveKey: () => luMoveKey(state), styleOf: k => luMoveStyle(state, k),
    photo: { get: i => state.teams[i], changed: () => {}, box: el => el.closest('.ph') },
    extras: { get: () => state.teams.map(t => [t.dx, t.dy, t.zoom]), set: v => { state.teams.forEach((t, i) => { [t.dx, t.dy, t.zoom] = v[i]; }); } },
  });
  editing = true;

  // ---- reset: every section and both photos of this layout back to the default spot and size ----
  $('#resetAll').addEventListener('click', () => {
    delete state.moves[luMoveKey(state)]; delete state.hidden[luMoveKey(state)];
    state.teams.forEach(t => Object.assign(t, { dx: 0, dy: 0, zoom: 1 }));
    render();
  });

  // ---- download: 2x (2160 × 2700) so text and edges stay sharp ----
  $('#download').addEventListener('click', async () => {
    const btn = $('#download'); btn.disabled = true; btn.textContent = 'Rendering…';
    try {
      const url = await htmlToImage.toPng($('.lu', poster), { width: 1080, height: 1350, pixelRatio: 2, fontEmbedCSS: window.POSTER_FONT_CSS, cacheBust: false });
      const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const a = document.createElement('a');
      a.download = `lineup-${slug(state.teams[0].name)}-vs-${slug(state.teams[1].name)}-${state.layout}.png`;
      a.href = url; a.click();
    } catch (e) { alert('Export failed: ' + e.message); }
    btn.disabled = false; btn.textContent = 'Download PNG (HD)';
  });

  render();
  document.fonts.addEventListener('loadingdone', () => render());   // a late font changes text widths, so fit again
  const fontsReady = Promise.all(['400 40px "Bebas Neue"', '800 20px Manrope', '600 20px Manrope', '700 20px Manrope', '400 40px Bungee', '400 40px Audiowide',
    '600 20px Oxanium', '700 20px Oxanium', '800 20px Oxanium'].map(f => document.fonts.load(f))).catch(() => {});
  window.__ready = fontsReady.then(() => { render(); StudioEdit.reset(); });
  window.__posterState = state;
  window.__render = render;
})();
