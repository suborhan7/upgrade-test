/* Maker page: form -> state -> poster. 2 to 8 matches; per match a date, time and small label, and per team a name, player,
   logo (a plain background is cut away, the colour comes from the logo), colour and an optional player photo (auto cut-out,
   drag/size on the poster). HD PNG download. */
(function () {
  const SL = window.SAMPLE_LOGOS || {}, S = window.SAMPLE_PHOTOS || {};
  const T = (name, player, color, logo, photo) => ({ name, player, color, logo: SL[logo] || '', photo: S[photo] || '', dx: 0, dy: 0, zoom: 1 });
  const M = (date, time, label, a, b) => ({ date, time, label, a, b });
  const MAX = 8;
  const state = {
    layout: 'clash',               // clash | cal | line
    calHead: 'a',                  // Calendar title: a (small first word over a big last word) | b (one line + underline)
    moves: {},                     // admin's drags/sizes per layout
    hidden: {},                    // parts the admin switched off, per layout
    bgMode: 'template',            // 'template' | 'jersey' | 'image'
    bgImage: '',
    logo: '',
    title: 'Match Schedule',
    event: 'eFCB Winter Cup 2026',
    stage: 'Round of 16 · Day 1',
    format: 'Match format: 2 legs · Best of 3',
    start: 'Action starts 28 Oct · 8:30 PM',
    live: 'facebook.com/efcb',
    count: 4,
    showPlayer: true,
    showPhotos: true,
    matches: [
      M('2026-10-28', '8:30 PM', 'Match 1', T('Man City', 'Tanvir', '#6cabdd', 'man-city', 'tanvir'), T('Arsenal', 'Nayeem', '#ef0107', 'arsenal', 'cmf')),
      M('2026-10-28', '9:30 PM', 'Match 2', T('Liverpool', 'Rafi', '#c8102e', 'liverpool', 'llfc'), T('Real Madrid', 'Shanto', '#febe10', 'real-madrid', 'nexus')),
      M('2026-10-29', '8:30 PM', 'Match 3', T('Barcelona', 'Arif', '#a50044', 'barcelona', 'png'), T('Bayern', 'Mahin', '#dc052d', 'bayern', 'p7')),
      M('2026-10-29', '9:30 PM', 'Match 4', T('Inter', 'Sakib', '#0068a8', 'inter', 'p6'), T('PSG', 'Ovi', '#004170', 'psg', 'p9')),
      M('2026-10-30', '8:30 PM', 'Match 5', T('Juventus', 'Rakib', '#1a1a1a', 'juventus', 'p8'), T('AC Milan', 'Jisan', '#fb090b', 'ac-milan', '')),
      M('2026-10-30', '9:30 PM', 'Match 6', T('Man United', 'Fahim', '#da291c', 'man-united', ''), T('Al Nassr', 'Mehedi', '#f9d200', 'al-nassr', '')),
      M('2026-10-31', '8:30 PM', 'Match 7', T('Team 13', '', '#6a3fd6', '', ''), T('Team 14', '', '#1fa37a', '', '')),
      M('2026-10-31', '9:30 PM', 'Match 8', T('Team 15', '', '#d6563f', '', ''), T('Team 16', '', '#3f7bd6', '', '')),
    ],
    site: 'efcb.com',
    partnersLabel: 'Official partners',
    partners: ['NOVAPAY', 'Pixel Arena', 'BOLT', 'zenith', 'KICKOFF+'].map(name => ({ name, logo: '' })),
  };
  // photo i = match (i >> 1), team a (even) or b (odd)
  const teamOf = i => state.matches[i >> 1][i % 2 ? 'b' : 'a'];

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const poster = $('#poster');
  const readFile = f => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
  const loadImage = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

  // names for the "Poster e ki ki thakbe" list and the editor bar (js/studio-edit.js)
  const PARTS = {};
  function syncParts() {
    for (const k of Object.keys(PARTS)) delete PARTS[k];
    Object.assign(PARTS, { head: 'Header / title', axis: 'Timeline er line' });
    state.matches.slice(0, state.count).forEach((m, k) => {
      PARTS['m' + k] = `Match ${k + 1} (${m.a.name || '—'} vs ${m.b.name || '—'})`;
      PARTS['p' + k * 2] = `Chobi: ${m.a.player || m.a.name || 'Team 1'}`; PARTS['p' + (k * 2 + 1)] = `Chobi: ${m.b.player || m.b.name || 'Team 2'}`;
    });
    PARTS.info = 'Format / start / live line'; PARTS.partners = 'Partners strip';
  }
  let editing = false;

  const render = () => {
    syncParts();
    renderFixtures(poster, state);
    if (editing) StudioEdit.afterRender();
    $('#bgUploadRow').style.display = state.bgMode === 'image' ? '' : 'none';
    $('#calHeadRow').style.display = state.layout === 'cal' ? '' : 'none';
    $$('#matches .pdet').forEach((d, i) => {
      d.style.display = i < state.count ? '' : 'none';
      const m = state.matches[i];
      $('summary', d).textContent = `${i + 1}. ${m.a.name || '—'} vs ${m.b.name || '—'} · ${m.time || ''}`;
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
    const k = i.dataset.k, isNum = k === 'count';
    if (i.type === 'checkbox') { i.checked = state[k]; i.addEventListener('change', () => { state[k] = i.checked; render(); }); return; }
    i.value = state[k];
    i.addEventListener(i.tagName === 'SELECT' ? 'change' : 'input', () => { state[k] = isNum ? Math.min(MAX, Math.max(2, +i.value || 2)) : i.value; render(); });
  });
  $$('[data-file]').forEach(i => i.addEventListener('change', async e => {
    const f = e.target.files[0]; state[i.dataset.file] = f ? await readFile(f) : ''; render();
  }));

  // ---- the matches ----
  const tpl = $('#matchTpl'), wrap = $('#matches');
  state.matches.forEach((m, mi) => {
    const sec = tpl.content.firstElementChild.cloneNode(true);
    wrap.appendChild(sec);
    $$('[data-m]', sec).forEach(inp => { inp.value = m[inp.dataset.m]; inp.addEventListener('input', () => { m[inp.dataset.m] = inp.value; render(); }); });
    $$('.teamf', sec).forEach(box => {
      const t = m[box.dataset.side];
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

  // ---- player photos: drag = move, wheel = size (sections are moved by js/studio-edit.js) ----
  const frame = $('#frame');
  const posterScale = () => frame.getBoundingClientRect().width / 1080;
  let drag = null;
  frame.addEventListener('pointerdown', e => {
    const el = e.target.closest('[data-p]'); if (!el) return;
    const t = teamOf(+el.dataset.p);
    drag = { el, t, x: e.clientX, y: e.clientY, dx: t.dx, dy: t.dy };
    frame.setPointerCapture(e.pointerId); frame.classList.add('dragging');
  });
  frame.addEventListener('pointermove', e => {
    if (!drag) return;
    const s = posterScale();
    drag.t.dx = Math.round(drag.dx + (e.clientX - drag.x) / s); drag.t.dy = Math.round(drag.dy + (e.clientY - drag.y) / s);
    drag.el.style.cssText = fxPhotoStyle(drag.t);
  });
  const endDrag = () => { const was = drag; drag = null; frame.classList.remove('dragging'); if (was) render(); };
  frame.addEventListener('pointerup', endDrag); frame.addEventListener('pointercancel', endDrag);
  frame.addEventListener('wheel', e => {
    const el = e.target.closest('[data-p]'); if (!el) return;
    e.preventDefault();
    const t = teamOf(+el.dataset.p);
    t.zoom = Math.min(2.5, Math.max(0.4, +(t.zoom * (e.deltaY < 0 ? 1.05 : 0.95)).toFixed(3)));
    render();
  }, { passive: false });

  const allTeams = () => state.matches.flatMap(m => [m.a, m.b]);
  StudioEdit.init({
    frame, poster, state, render, panel: $('#form'), partsBox: $('#parts'), parts: PARTS,
    moveKey: () => fxMoveKey(state), styleOf: k => fxMoveStyle(state, k),
    photo: { get: i => teamOf(i), changed: () => {}, box: el => el.closest('.ph') },
    extras: { get: () => allTeams().map(t => [t.dx, t.dy, t.zoom]), set: v => { allTeams().forEach((t, i) => { [t.dx, t.dy, t.zoom] = v[i]; }); } },
  });
  editing = true;

  // ---- reset: every section and every photo of this layout back to the default spot and size ----
  $('#resetAll').addEventListener('click', () => {
    delete state.moves[fxMoveKey(state)]; delete state.hidden[fxMoveKey(state)];
    allTeams().forEach(t => Object.assign(t, { dx: 0, dy: 0, zoom: 1 }));
    render();
  });

  // ---- download: 2x (2160 × 2700) so text and edges stay sharp ----
  $('#download').addEventListener('click', async () => {
    const btn = $('#download'); btn.disabled = true; btn.textContent = 'Rendering…';
    try {
      const url = await htmlToImage.toPng($('.fx', poster), { width: 1080, height: 1350, pixelRatio: 2, fontEmbedCSS: window.POSTER_FONT_CSS, cacheBust: false });
      const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const a = document.createElement('a');
      a.download = `fixtures-${slug(state.stage) || 'schedule'}-${state.layout}.png`;
      a.href = url; a.click();
    } catch (e) { alert('Export failed: ' + e.message); }
    btn.disabled = false; btn.textContent = 'Download PNG (HD)';
  });

  render();
  document.fonts.addEventListener('loadingdone', () => render());   // a late font changes text widths, so fit again
  const fontsReady = Promise.all(['400 40px Anton', '800 40px "Saira Condensed"', '700 20px "Saira Condensed"', 'italic 900 40px Kanit', 'italic 800 40px Kanit',
    '400 20px Sora', '600 20px Sora', '700 20px Sora', '800 40px "Exo 2"', '600 20px "Exo 2"', '400 40px Michroma'].map(f => document.fonts.load(f))).catch(() => {});
  window.__ready = fontsReady.then(() => { render(); StudioEdit.reset(); });
  window.__posterState = state;
  window.__render = render;
})();
