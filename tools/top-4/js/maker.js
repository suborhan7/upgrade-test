/* Maker page: form -> state -> poster. Head-size auto-fit, auto cut-out, kit colours, drag/size and PNG download. */
(function () {
  const S = window.SAMPLE_PHOTOS || {};
  const player = o => Object.assign({ dx: 0, dy: 0, zoom: 1, logo: '', photo: '', m: null, gd: '' }, o);
  const state = {
    layout: 'podium',              // 'podium' | 'board'
    moves: {},                     // admin's drags/sizes per layout: { podium: { block1: { x, y, s, ox, oy } } }
    hidden: {},                    // parts the admin switched off, per layout: { board: { prize: true } }
    bgMode: 'template',            // 'template' | 'jersey' | 'image'
    theme: 'navy',                 // navy (default) | jewel | ocean | emerald | ember
    bgImage: '',
    logo: '',
    event: 'eFCB Winter Cup 2026',
    sub: 'Final standings',
    boardWord: 'Standings',
    prize: 'BDT 25,000',
    site: 'efcb.com',
    partnersLabel: 'Official partners',
    partners: ['NOVAPAY', 'Pixel Arena', 'BOLT', 'zenith', 'KICKOFF+'].map(name => ({ name, logo: '' })),
    players: [
      player({ player: 'BOD',     team: 'BOD Esports',          pts: '21', w: '7', d: '0', l: '1', gd: '+14', photo: S.p1 || '', kit: '#e3b100' }),
      player({ player: 'Nexus',   team: 'Team Nexus',           pts: '18', w: '6', d: '0', l: '2', gd: '+9',  photo: S.p2 || '', kit: '#6a2bd9' }),
      player({ player: 'NPC',     team: 'Narayanganj PES Club', pts: '15', w: '5', d: '0', l: '3', gd: '+4',  photo: S.p3 || '', kit: '#b8862b' }),
      player({ player: 'Nexus B', team: 'Team Nexus',           pts: '13', w: '4', d: '1', l: '3', gd: '+1',  photo: S.p4 || '', kit: '#7b2ff7' }),
    ],
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const poster = $('#poster');
  const readFile = f => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
  const loadImage = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

  // names for the "Poster e ki ki thakbe" list and the editor bar (js/studio-edit.js); 1-4 = place
  const PL = ['1st', '2nd', '3rd', '4th'];
  const PARTS = Object.assign({ brand: 'eFCB logo', event: 'Event name', title: 'TOP 4 title', sub: 'Line under TOP 4', uline: 'Underline',
    champLabel: 'CHAMPION label', champName: 'Champion name', champTeam: 'Champion team', champStats: 'Champion stats', prize: 'Prize' },
    ...PL.map((p, i) => ({ ['p' + i]: `${p} photo`, ['block' + (i + 1)]: `${p} podium step`, ['row' + (i + 1)]: `${p} row`, ['rank' + (i + 1)]: `${p} rank number`,
      ['name' + (i + 1)]: `${p} name + team`, ['stats' + (i + 1)]: `${p} points + record`, ['pts' + (i + 1)]: `${p} points`, ['logo' + (i + 1)]: `${p} team logo` })),
    { partners: 'Partners strip' });
  let editing = false;

  const render = () => {
    renderTop4(poster, state);
    if (editing) StudioEdit.afterRender();
    $('#bgUploadRow').style.display = state.bgMode === 'image' ? '' : 'none';
    $('#themeRow').style.display = state.bgMode === 'image' ? 'none' : '';
    $$('[data-only]').forEach(el => el.style.display = el.dataset.only === state.layout ? '' : 'none');
  };

  /* Measures a cut-out from its transparency: size, head width, head-top row and body centre (natural px).
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
    // width of the solid run through the head's centre on one row
    const runAt = (y, cx) => {
      if (!on(cx, y)) { let best = -1; for (let x = 0; x < W; x++) if (on(x, y) && (best < 0 || Math.abs(x - cx) < Math.abs(best - cx))) best = x; if (best < 0) return null; cx = best; }
      let a = cx, b = cx; while (a > 0 && on(a - 1, y)) a--; while (b < W - 1 && on(b + 1, y)) b++;
      return { a, b, w: b - a + 1, c: (a + b) / 2 };
    };
    // start a little below the hair line, then measure again at eye level (about half a head down)
    let r = null; for (let y = top; y < Math.min(H, top + 8) && !r; y++) { let xs = []; for (let x = 0; x < W; x++) if (on(x, y)) xs.push(x); if (xs.length) r = { c: (xs[0] + xs[xs.length - 1]) / 2 }; }
    let cx = Math.round(r.c), hw = 0;
    for (let pass = 0; pass < 3; pass++) {
      const y = Math.min(H - 1, top + Math.round(pass === 0 ? H * 0.06 : hw * 0.55));
      const run = runAt(y, cx); if (!run) break;
      hw = run.w; cx = Math.round(run.c);
    }
    hw = Math.max(hw, W * 0.12);
    // body centre: average of the visible pixels below the head
    let sx = 0, n = 0;
    for (let y = Math.min(H - 1, top + Math.round(hw * 1.4)); y < H; y += 2) for (let x = 0; x < W; x += 2) if (on(x, y)) { sx += x; n++; }
    const bodyCx = n ? sx / n : cx;
    return { w: NW, h: NH, head: hw * k, top: top * k, cx: (bodyCx * 0.5 + cx * 0.5) * k };
  }

  // the kit colour used in jersey mode: the more colourful of the two detected colours
  function kitColor(c) {
    const sat = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };
    const a = c.primary, b = c.secondary;
    if (sat(a) >= 0.3) return a;
    if (b && sat(b) >= 0.3) return b;
    return '#3d6bff';   // plain black/white kit: a neutral blue
  }

  async function hasTransparency(src) {
    const img = await loadImage(src);
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

  // ---- poster fields ----
  $$('[data-k]').forEach(i => {
    i.value = state[i.dataset.k];
    i.addEventListener(i.tagName === 'SELECT' ? 'change' : 'input', () => { state[i.dataset.k] = i.value; render(); });
  });
  $$('[data-file]').forEach(i => i.addEventListener('change', async e => {
    const f = e.target.files[0]; state[i.dataset.file] = f ? await readFile(f) : ''; render();
  }));

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

  // ---- player sections ----
  const TITLES = ['1st · Champion', '2nd · Runner-up', '3rd place', '4th place'];
  const tpl = $('#playerTpl'), wrap = $('#players');
  const secs = state.players.map((t, i) => {
    const sec = tpl.content.firstElementChild.cloneNode(true);
    $('h3', sec).textContent = TITLES[i];
    if (i !== 0) $('[data-gd]', sec).remove();
    wrap.appendChild(sec);
    $$('[data-t]', sec).forEach(inp => {
      inp.value = t[inp.dataset.t];
      inp.addEventListener('input', () => { t[inp.dataset.t] = inp.value; render(); });
    });
    const setKit = c => { t.kit = c; $('[data-t="kit"]', sec).value = c; render(); };
    const fromJersey = async () => { if (t.photo) try { setKit(kitColor(await JerseyColors.pickJerseyColors(t.photo))); } catch (e) { console.warn('Colour detect failed', e); } };
    $('[data-auto]', sec).addEventListener('click', fromJersey);

    $('[data-photo]', sec).addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      const status = $('[data-status]', sec);
      let src = await readFile(f);
      if ($('[data-cutout]', sec).checked && !(await hasTransparency(src))) {
        try { src = await cutOut(f, status); }
        catch (err) { console.warn('Auto cut-out failed', err); status.textContent = 'Auto cut-out hoyni (internet lagbe). Normal chobi boshano holo.'; }
      }
      t.photo = await JerseyColors.enhancePhoto(await JerseyColors.trimTransparent(src));
      t.m = await measure(t.photo).catch(() => null);
      Object.assign(t, { dx: 0, dy: 0, zoom: 1 });
      render(); syncZoom(i);
      fromJersey();
    });
    $('[data-logo]', sec).addEventListener('change', async e => { const f = e.target.files[0]; t.logo = f ? await readFile(f) : ''; render(); });
    $('[data-zoom]', sec).addEventListener('input', e => { t.zoom = e.target.value / 100; render(); syncZoom(i); });
    $('[data-reset-pos]', sec).addEventListener('click', () => { Object.assign(t, { dx: 0, dy: 0, zoom: 1 }); render(); syncZoom(i); });
    return { sec };
  });
  function syncZoom(i) {
    const sec = secs[i].sec, z = Math.round(state.players[i].zoom * 100);
    $('[data-zoom]', sec).value = z; $('[data-zoom-val]', sec).textContent = z + '%';
  }

  // ---- photos: drag and wheel-resize (sections, selection, nudge, remove and undo live in js/studio-edit.js) ----
  const frame = $('#frame');
  const posterScale = () => frame.getBoundingClientRect().width / 1080;
  const target = e => e.target.closest('[data-p]');
  let drag = null;
  frame.addEventListener('pointerdown', e => {
    const el = target(e); if (!el) return;
    const t = state.players[+el.dataset.p], face = el.classList.contains('face');
    drag = { t, el: face ? el.querySelector('img') : el, face, x: e.clientX, y: e.clientY, dx: t.dx, dy: t.dy };
    if (!drag.el) { drag = null; return; }
    frame.setPointerCapture(e.pointerId); frame.classList.add('dragging');
  });
  frame.addEventListener('pointermove', e => {
    if (!drag) return;
    const s = posterScale() * (drag.face ? 0.4 : 1), t = drag.t;
    t.dx = Math.round(drag.dx + (e.clientX - drag.x) / s);
    t.dy = Math.round(drag.dy + (e.clientY - drag.y) / s);
    drag.el.style.transform = top4PhotoTransform(t, drag.face ? 0.4 : 1);   // move only the photo while dragging
  });
  const endDrag = () => { drag = null; frame.classList.remove('dragging'); };
  frame.addEventListener('pointerup', endDrag); frame.addEventListener('pointercancel', endDrag);
  frame.addEventListener('wheel', e => {
    const el = target(e); if (!el) return;
    e.preventDefault();
    const i = +el.dataset.p, t = state.players[i];
    t.zoom = Math.min(2, Math.max(0.5, +(t.zoom * (e.deltaY < 0 ? 1.05 : 0.95)).toFixed(3)));
    render(); syncZoom(i);
  }, { passive: false });

  /* Section move/size. Untouched sections get no transform at all, so the default poster (and its stacking) stays exactly
     as designed. Sections sit inside other boxes (podium step, row, champion block), so the kit's poster-px resize centre is
     turned into the wrapper's own px. A moved section comes above the untouched ones (and keeps the highest z-index inside it). */
  const styleOf = k => {
    const m = (state.moves[state.layout] || {})[k] || {}, s = m.s || 1;
    if (!m.x && !m.y && s === 1) return '';
    const el = poster.querySelector(`[data-move="${k}"]`), root = poster.firstElementChild;
    let ox = 0, oy = 0, z = 0;
    for (let e = el; e && e !== root; e = e.offsetParent) { ox += e.offsetLeft; oy += e.offsetTop; }
    for (let a = el && el.parentElement.closest('[data-move]'); a; a = a.parentElement.closest('[data-move]')) { const q = (state.moves[state.layout] || {})[a.dataset.move] || {}; ox += q.x || 0; oy += q.y || 0; }
    if (el) [el, ...el.querySelectorAll('*')].forEach(d => { z = Math.max(z, parseInt(getComputedStyle(d).zIndex) || 0); });
    return `transform:translate(${m.x || 0}px,${m.y || 0}px)${s !== 1 ? ` scale(${s})` : ''};transform-origin:${(m.ox || 540) - ox}px ${(m.oy || 675) - oy}px;z-index:${Math.max(1, z)}${el && !el.classList.contains('mv') ? ';position:relative' : ''}`;
  };
  StudioEdit.init({
    frame, poster, state, render, panel: $('#form'), partsBox: $('#parts'), parts: PARTS,
    moveKey: () => state.layout, styleOf,
    photo: { get: i => state.players[i], changed: i => syncZoom(i), box: el => el.classList.contains('face') ? el.querySelector('img') || el : el },   // a row's face tile stays, only its photo goes
    extras: { get: () => state.players.map(t => [t.dx, t.dy, t.zoom]), set: v => v.forEach((p, i) => { [state.players[i].dx, state.players[i].dy, state.players[i].zoom] = p; syncZoom(i); }) },
  });
  editing = true;

  // ---- reset: every section and all four photos of this layout back to the default spot and size ----
  $('#resetAll').addEventListener('click', () => {
    delete state.moves[state.layout]; delete state.hidden[state.layout];
    state.players.forEach((t, i) => { Object.assign(t, { dx: 0, dy: 0, zoom: 1 }); syncZoom(i); });
    render();
  });

  // ---- download ----
  $('#download').addEventListener('click', async () => {
    const btn = $('#download'); btn.disabled = true; btn.textContent = 'Rendering…';
    try {
      const url = await htmlToImage.toPng($('.t4', poster), { width: 1080, height: 1350, pixelRatio: 2, fontEmbedCSS: window.POSTER_FONT_CSS, cacheBust: false });
      const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const a = document.createElement('a');
      a.download = `top-4-${slug(state.event) || 'standings'}-${state.layout}.png`;
      a.href = url; a.click();
    } catch (e) { alert('Export failed: ' + e.message); }
    btn.disabled = false; btn.textContent = 'Download PNG (HD)';
  });

  render();
  const fontsReady = Promise.all(['900 80px "Big Shoulders Display"', '700 20px Orbitron', '900 20px Orbitron', 'italic 700 20px "Chakra Petch"', '400 20px "Russo One"']
    .map(f => document.fonts.load(f))).catch(() => {});
  // sample photos: measure the heads so they sit right from the start
  window.__ready = fontsReady.then(async () => {
    for (const t of state.players) if (t.photo) t.m = await measure(t.photo).catch(() => null);
    render(); StudioEdit.reset();
  });
  window.__posterState = state;
  window.__render = render;
})();
