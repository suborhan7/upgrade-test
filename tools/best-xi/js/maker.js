/* Maker page: form -> state -> poster. Eleven players placed by the chosen formation, each with a cut-out photo
   (head-size auto-fit inside its badge/tile), team, logo, kit colour and rating; one star player; drag/size and HD PNG download. */
(function () {
  const S = window.SAMPLE_PHOTOS || {}, SL = window.SAMPLE_LOGOS || {};
  const P = (name, team, kit, rating, photo, logo = '') => ({ name, team, kit, rating, photo: S[photo] || '', logo: SL[logo] || '', m: null, dx: 0, dy: 0, zoom: 1 });
  const state = {
    layout: 'board',               // board | pitch
    formation: '4-3-3',
    moves: {},                     // admin's drags/sizes per layout: { pitch: { pl3: { x, y, s, ox, oy } } }
    hidden: {},                    // parts the admin switched off, per layout
    bgMode: 'template',            // 'template' | 'jersey' | 'image'
    bgImage: '',
    logo: '',
    title: 'Team of the Week',
    event: 'eFCB Winter Cup 2026',
    week: 'Matchweek 5',
    tag: 'Best XI',
    avgLabel: 'Avg rating',
    topLabel: 'Top player',
    star: 9,                       // index of the week's star player (gold badge)
    // form order: keeper, defenders, midfielders, forwards (left to right), as in the formation
    players: [
      P('Nayeem', 'LLFC', '#8a1c2b', '8.3', 'llfc'),
      P('Sakib', 'Nexus', '#6a2fd0', '7.9', 's1', 'nexus'),
      P('Rakib', 'BOD', '#d4a514', '8.1', 's2', 'bod'),
      P('Jisan', 'NPC', '#b38a2a', '8.0', 's4'),
      P('Fahim', 'CMF', '#1f5f8f', '7.8', 'cmf'),
      P('Rafi', 'LLFC', '#8a1c2b', '8.4', 'llfc'),
      P('Arif', 'PNG', '#e0a21c', '8.8', 'png'),
      P('Mahin', 'Nexus', '#6a2fd0', '8.2', 'nexus', 'nexus'),
      P('Shanto', 'CMF', '#1f5f8f', '8.9', 'cmf'),
      P('Tanvir', 'BOD', '#d4a514', '9.6', 'tanvir', 'bod'),
      P('Ovi', 'Nexus', '#6a2fd0', '8.7', 's3', 'nexus'),
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

  // names for the "Poster e ki ki thakbe" list and the editor bar (js/studio-edit.js); player names follow the form
  const PARTS = {};
  function syncParts() {
    for (const k of Object.keys(PARTS)) delete PARTS[k];
    Object.assign(PARTS, { head: 'Header / title', title: 'Title', stats: 'Avg + top box', pitch: 'Pitch', board: 'Board', avg: 'Avg rating box' });
    const slots = xiSlots(state);
    state.players.forEach((p, i) => { PARTS['pl' + i] = `${i + 1}. ${slots[i].pos} ${p.name || ''}`; PARTS['p' + i] = `Chobi ${i + 1} (${p.name || ''})`; });
    PARTS.partners = 'Partners strip';
  }
  let editing = false;

  const render = () => {
    syncParts();
    renderXI(poster, state);
    if (editing) StudioEdit.afterRender();
    $('#bgUploadRow').style.display = state.bgMode === 'image' ? '' : 'none';
    $$('[data-show]').forEach(el => el.style.display = el.dataset.show.split(' ').includes(state.layout) ? '' : 'none');
    const slots = xiSlots(state);
    $$('#players .pdet').forEach((d, i) => { $('summary', d).textContent = `${i + 1} · ${slots[i].pos} · ${state.players[i].name || '—'}${i === state.star ? ' ★' : ''}`; });
  };

  /* Measures a cut-out from its transparency: size, head width, head-top row and head centre (natural px).
     The poster scales every photo so the HEADS come out the same size, whatever the crop of the photo. */
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
    return { w: NW, h: NH, head: hw * k, top: top * k, hcx: cx * k };
  }

  /* Photo quality: no sharpening (it made faces look broken/"fete" on compressed photos). Small photos are only
     enlarged smoothly in steps so the poster never stretches a tiny image in one go. */
  async function prepPhoto(src) {
    src = await JerseyColors.trimTransparent(src);
    const img = await loadImage(src);
    const target = 700;   // badges are small: 700px tall is plenty even for the HD download
    if (img.naturalHeight >= target * 0.8) return src;
    let cur = img, w = img.naturalWidth, h = img.naturalHeight;
    const W = Math.round(w * target / h);
    while (w < W) {
      const nw = Math.min(W, Math.round(w * 1.4)), nh = Math.round(nw * target / W);
      const cv = document.createElement('canvas'); cv.width = nw; cv.height = nh;
      const cx = cv.getContext('2d'); cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
      cx.drawImage(cur, 0, 0, nw, nh); cur = cv; w = nw; h = nh;
    }
    return cur.toDataURL('image/png');
  }

  // colour helpers: a light partner shade for gradients and glows
  const toHsl = hex => {
    let [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(h * 60 + 360) % 360, s, l];
  };
  const fromHsl = (h, s, l) => {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return '#' + [r, g, b].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
  };
  const lightOf = hex => { const [h, s, l] = toHsl(hex); return fromHsl(h, Math.min(1, s + 0.1), Math.min(0.8, l + 0.25)); };
  const mainOf = hex => { const [h, s, l] = toHsl(hex); return fromHsl(h, Math.max(0.55, s), Math.min(0.55, Math.max(0.38, l))); };

  // the kit colour: the more colourful of the two detected colours; white/black kits use their trim colour
  // (white LLFC -> maroon), and a plain black/white kit with no trim gets purple
  async function kitColor(src) {
    const c = await JerseyColors.pickJerseyColors(src);
    const sat = hex => toHsl(hex)[1] * (toHsl(hex)[2] > 0.1 && toHsl(hex)[2] < 0.92 ? 1 : 0);
    if (sat(c.primary) >= 0.3) return c.primary;
    if (c.secondary && sat(c.secondary) >= 0.3) return c.secondary;
    return (await trimColor(src)) || '#6a3fd6';
  }
  // strongest saturated colour on the shirt (below the head), even if it is only a thin trim or badge
  async function trimColor(src) {
    const img = await loadImage(src);
    const W = 120, H = Math.max(1, Math.round(120 * img.height / img.width));
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0, W, H);
    const px = ctx.getImageData(0, Math.round(H * 0.45), W, H - Math.round(H * 0.45)).data, buckets = {};
    let total = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 200) continue;
      total++;
      const hex = '#' + [px[i], px[i + 1], px[i + 2]].map(v => v.toString(16).padStart(2, '0')).join('');
      const [h, s, l] = toHsl(hex);
      if (s < 0.35 || l < 0.15 || l > 0.85) continue;
      if (h > 5 && h < 50 && s < 0.8) continue;   // skin tones (arms, hands)
      const bk = buckets[Math.floor(h / 20)] || (buckets[Math.floor(h / 20)] = { n: 0, r: 0, g: 0, b: 0 });
      bk.n++; bk.r += px[i]; bk.g += px[i + 1]; bk.b += px[i + 2];
    }
    const top = Object.values(buckets).sort((a, b) => b.n - a.n)[0];
    if (!top || top.n < total * 0.01) return null;
    return '#' + [top.r, top.g, top.b].map(v => Math.round(v / top.n).toString(16).padStart(2, '0')).join('');
  }

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
    const s = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight)), W = Math.round(img.naturalWidth * s), H = Math.round(img.naturalHeight * s);
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
      model: 'medium',
      proxyToWorker: false,
      output: { format: 'image/png', quality: 1 },
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
    i.value = state[i.dataset.k];
    i.addEventListener(i.tagName === 'SELECT' ? 'change' : 'input', () => { state[i.dataset.k] = i.value; render(); });
  });
  $$('[data-file]').forEach(i => i.addEventListener('change', async e => {
    const f = e.target.files[0]; state[i.dataset.file] = f ? await readFile(f) : ''; render();
  }));

  // ---- the eleven players ----
  const ptplP = $('#playerTpl'), plWrap = $('#players');
  const zoomSync = [];
  state.players.forEach((p, i) => {
    const sec = ptplP.content.firstElementChild.cloneNode(true);
    if (i === 0) sec.open = true;
    plWrap.appendChild(sec);
    $$('[data-f]', sec).forEach(inp => {
      inp.value = p[inp.dataset.f];
      inp.addEventListener('input', () => { p[inp.dataset.f] = inp.value; render(); });
    });
    const star = $('[data-star]', sec);
    star.checked = i === state.star;
    star.addEventListener('change', () => { if (star.checked) { state.star = i; render(); } });
    const setKit = hex => { if (!hex) return; p.kit = hex; $('[data-f="kit"]', sec).value = hex; render(); };
    $('[data-auto]', sec).addEventListener('click', async () => { if (p.photo) try { setKit(await kitColor(p.photo)); } catch (e) { console.warn('Colour detect failed', e); } });
    const syncZoom = () => { const z = Math.round(p.zoom * 100); $('[data-zoom]', sec).value = z; $('[data-zoom-val]', sec).textContent = z + '%'; };
    zoomSync[i] = syncZoom;
    $('[data-photo]', sec).addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      const status = $('[data-status]', sec);
      let src = await readFile(f);
      if ($('#cutout').checked && !(await hasTransparency(src))) {
        try { src = await cutOut(f, status); }
        catch (err) { console.warn('Auto cut-out failed', err); status.textContent = 'Auto cut-out hoyni (internet lagbe). Normal chobi boshano holo.'; }
      }
      p.photo = await prepPhoto(src);
      p.m = await measure(p.photo).catch(() => null);
      Object.assign(p, { dx: 0, dy: 0, zoom: 1 });
      render(); syncZoom();
      try { setKit(await kitColor(p.photo)); } catch (err) { /* keep the old colour */ }
    });
    $('[data-zoom]', sec).addEventListener('input', e => { p.zoom = e.target.value / 100; render(); syncZoom(); });
    $('[data-reset-pos]', sec).addEventListener('click', () => { Object.assign(p, { dx: 0, dy: 0, zoom: 1 }); render(); syncZoom(); });
    $('[data-logo]', sec).addEventListener('change', async e => {
      const f = e.target.files[0]; let logo = f ? await readFile(f) : '';
      if (logo && !(await hasTransparency(logo))) logo = await clearLogoBg(logo);
      // every player of the same team gets the logo
      const team = (p.team || '').trim().toLowerCase();
      state.players.forEach(q => { if (q === p || (team && (q.team || '').trim().toLowerCase() === team)) q.logo = logo; });
      render();
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

  // ---- photos: drag = move the face inside its badge, wheel = face size (moving whole players lives in js/studio-edit.js) ----
  const frame = $('#frame');
  const posterScale = () => frame.getBoundingClientRect().width / 1080;
  let drag = null;
  frame.addEventListener('pointerdown', e => {
    const el = e.target.closest('[data-p]'); if (!el) return;
    const p = state.players[+el.dataset.p];
    drag = { el, p, x: e.clientX, y: e.clientY, dx: p.dx, dy: p.dy };
    frame.setPointerCapture(e.pointerId); frame.classList.add('dragging');
  });
  frame.addEventListener('pointermove', e => {
    if (!drag) return;
    const s = posterScale(), box = drag.el.parentElement;
    drag.p.dx = Math.round(drag.dx + (e.clientX - drag.x) / s); drag.p.dy = Math.round(drag.dy + (e.clientY - drag.y) / s);
    xiPhotoStyle(drag.p, box.offsetWidth, box.offsetHeight).split(';').forEach(kv => { const [k, v] = kv.split(':'); if (k) drag.el.style[k] = v; });
  });
  const endDrag = () => { const was = drag; drag = null; frame.classList.remove('dragging'); if (was) render(); };
  frame.addEventListener('pointerup', endDrag); frame.addEventListener('pointercancel', endDrag);
  frame.addEventListener('wheel', e => {
    const el = e.target.closest('[data-p]'); if (!el) return;
    e.preventDefault();
    const i = +el.dataset.p, p = state.players[i];
    p.zoom = Math.min(2.5, Math.max(0.4, +(p.zoom * (e.deltaY < 0 ? 1.05 : 0.95)).toFixed(3)));
    render(); zoomSync[i]();
  }, { passive: false });

  StudioEdit.init({
    frame, poster, state, render, panel: $('#form'), partsBox: $('#parts'), parts: PARTS,
    moveKey: () => xiMoveKey(state), styleOf: k => xiMoveStyle(state, k),
    photo: { get: i => state.players[i], changed: i => zoomSync[i](), box: el => el.closest('.ring, .tile') },
    extras: { get: () => state.players.map(p => [p.dx, p.dy, p.zoom]), set: v => { v.forEach((a, i) => { [state.players[i].dx, state.players[i].dy, state.players[i].zoom] = a; zoomSync[i](); }); } },
  });
  editing = true;

  // ---- reset: every section and every face of this layout back to the default spot and size ----
  $('#resetAll').addEventListener('click', () => {
    delete state.moves[xiMoveKey(state)]; delete state.hidden[xiMoveKey(state)];
    state.players.forEach((p, i) => { Object.assign(p, { dx: 0, dy: 0, zoom: 1 }); zoomSync[i](); });
    render();
  });

  // ---- download: 2x (2160 × 2700) so text and edges stay sharp; photos keep their own resolution ----
  $('#download').addEventListener('click', async () => {
    const btn = $('#download'); btn.disabled = true; btn.textContent = 'Rendering…';
    try {
      const url = await htmlToImage.toPng($('.xi', poster), { width: 1080, height: 1350, pixelRatio: 2, fontEmbedCSS: window.POSTER_FONT_CSS, cacheBust: false });
      const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const a = document.createElement('a');
      a.download = `best-xi-${slug(state.week) || 'week'}-${state.formation}-${state.layout}.png`;
      a.href = url; a.click();
    } catch (e) { alert('Export failed: ' + e.message); }
    btn.disabled = false; btn.textContent = 'Download PNG (HD)';
  });

  render();
  document.fonts.addEventListener('loadingdone', () => render());   // a late font changes text widths, so fit again
  const fontsReady = Promise.all(['900 40px "Saira Extra Condensed"', '800 40px "Saira Extra Condensed"', '700 20px Saira', '600 20px Saira', '800 20px Saira',
    '900 40px Outfit', '800 40px Outfit', '700 20px Outfit', '600 20px Sora', '700 20px Sora', '800 20px Sora'].map(f => document.fonts.load(f))).catch(() => {});
  window.__ready = fontsReady.then(async () => {
    for (const p of state.players) if (p.photo) p.m = await measure(p.photo).catch(() => null);
    render(); StudioEdit.reset();
  });
  window.__posterState = state;
  window.__render = render;
})();
