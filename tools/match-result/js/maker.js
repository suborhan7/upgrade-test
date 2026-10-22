/* Maker page: form -> data -> poster, plus jersey/logo colour auto-detect, auto cut-out, drag/size and PNG download. */
(function () {
  const S = window.SAMPLE_PHOTOS || {}, SC = window.SAMPLE_CRESTS || {}, SCAP = window.SAMPLE_CAPTAINS || {}, SQ = window.SAMPLE_SQUAD || {};
  const team = (o) => Object.assign({ dx: 0, dy: 0, zoom: 1, logo: '', photo: '' }, o);
  // team mode: a club with its crest, captain and up to 5 squad cut-outs (m = head measure, see measure())
  const squad = list => Array.from({ length: 5 }, (_, j) => ({ name: '', photo: '', ...(list[j] || {}), m: null, dx: 0, dy: 0, zoom: 1 }));
  const club = o => Object.assign({ dx: 0, dy: 0, zoom: 1, logo: '', photo: '', squad: squad([]) }, o);
  const state = {
    mode: 'player',                // player (1v1) | team (crest vs crest)
    layout: 'wave',
    moves: {},                     // admin's drags/sizes per layout: { wave: { score: { x, y, s, ox, oy } } }
    hidden: {},                    // parts the admin switched off, per layout: { ticket: { barcode: true } }
    bgMode: 'template',            // 'template' | 'jersey' | 'image'
    bgImage: '',                   // admin's uploaded background (data URL)
    tag: 'Matchday 12',
    kicker: 'eFCB Pro League · Season 2',
    label: 'Full time',
    date: '19 Oct 2026',
    logo: '',
    teams: [
      team({ name: 'Al Nassr', player: 'Nova_10', logo: SC.alnassr || '', score: '3', scorers: "Mbappé 12', Mbappé 54', Vinícius 88'", photo: S.a || '', primary: '#f2c200', secondary: '#111111' }),
      team({ name: 'AC Milan', player: 'Red Wolf', logo: SC.milan || '', score: '1', scorers: "Kane 67'", photo: S.b || '', primary: '#d61f35', secondary: '#111111' }),
    ],
    // team mode (layouts clash / victory / torn, js/team.js)
    tm: {
      photoMode: 'squad',          // squad | captain | none
      title: 'Victory',            // Victory Squad's big word
      nameTags: true,
      confetti: true,
      teams: [
        club({ name: 'Arsenal', short: 'ARS', score: '3', scorers: "Saka 12', Havertz 54', Ødegaard 88'", logo: SC.arsenal || '', color: '#ef0107', color2: '#063672',
          captain: 'Areez', photo: SCAP.a || '', squad: squad([{ name: 'Rafi', photo: SQ.png }, { name: 'Areez', photo: SQ.bod }, { name: 'Sakib', photo: SQ.ngj }, { name: 'Tanvir', photo: SQ.tanvir }, { name: 'Nayeem', photo: SQ.nexus }]) }),
        club({ name: 'Manchester City', short: 'MCI', score: '1', scorers: "Haaland 67'", logo: SC.mancity || '', color: '#6cabdd', color2: '#1c2c5b', captain: 'Sami', photo: SCAP.b || '' }),
      ],
    },
    site: 'efcb.com',
    partnersLabel: 'Official partners',
    partners: ['NOVAPAY', 'Pixel Arena', 'BOLT', 'zenith', 'KICKOFF+'].map(name => ({ name, logo: '' })),
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const poster = $('#poster');
  const readFile = f => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });

  // names for the "Poster e ki ki thakbe" list and the editor bar (js/studio-edit.js); T/B = top/bottom team in Wave
  const PARTS = { brand: 'eFCB logo', tag: 'Tag (top right)', kick: 'League line', card: 'Ticket card', title: 'Title',
    p0: 'Team 1 photo', p1: 'Team 2 photo', photos: 'Photo window', chip1: 'Team 1 player chip', chip2: 'Team 2 player chip', vs: 'VS',
    crestT: 'Upor team logo', nameT: 'Upor team name', playerT: 'Upor player', badgeT: 'WINNER tag', scorersT: 'Upor scorers',
    crestB: 'Nicher team logo', nameB: 'Nicher team name', playerB: 'Nicher player', badgeB: 'DEFEAT tag', scorersB: 'Nicher scorers',
    name1: 'Team 1 name', result1: 'Team 1 WINNER/DEFEAT', player1: 'Team 1 player', score: 'Score', scoreTag: 'Score er upor tag',
    name2: 'Team 2 name', result2: 'Team 2 WINNER/DEFEAT', player2: 'Team 2 player', scorers1: 'Team 1 scorers', scorers2: 'Team 2 scorers',
    line: 'Dashed line', info: 'Result / date box', barcode: 'Barcode',
    crest1: 'Team 1 logo', crest2: 'Team 2 logo', seam: 'Lightning', script: 'Script lekha', mark: 'Logo watermark', confetti: 'Confetti',
    tags: 'Player name tags', hero: 'Boro logo', scorebar: 'Score bar', paper: 'Chhera kagoj', p2: 'Team 1 captain', p3: 'Team 2 captain', partners: 'Partners strip' };
  const isTeam = () => state.mode === 'team';
  const moveKey = () => state.layout + (MR_TEAM_LAYOUTS.includes(state.layout) && state.mode !== 'team' ? '-1v1' : '');
  const isTL = () => MR_TEAM_LAYOUTS.includes(state.layout);   // Crest Clash / Victory / Torn, in either mode
  // the 1v1 data drawn with a team layout: the player stands where the captain does, the team logo is the crest
  const asTeams = () => ({ ...state, tm: { ...state.tm, photoMode: 'captain', capBase: 0, player: true,
    teams: state.teams.map(t => ({ name: t.name, short: t.name.split(/\s+/).map(w => w[0] || '').join('').slice(0, 3), score: t.score, scorers: t.scorers, logo: t.logo, color: t.primary, color2: t.secondary,
      captain: t.player, photo: t.photo, dx: t.dx, dy: t.dy, zoom: t.zoom, squad: [] })) } });
  // photo numbers on the poster: 0/1 = player mode photos, 2/3 = team mode captains, 10+j / 20+j = squad players
  const photoOf = n => n < 2 ? state.teams[n] : n < 10 ? state.tm.teams[n - 2] : state.tm.teams[Math.floor(n / 10) - 1].squad[n % 10];
  const allPhotos = () => [...state.teams, ...state.tm.teams, ...state.tm.teams.flatMap(t => t.squad)];
  let editing = false;

  const render = () => {
    state.tm.teams.forEach((t, i) => t.squad.forEach((p, j) => { if (p.photo) PARTS['p' + ((i + 1) * 10 + j)] = `Squad: ${p.name || 'Player ' + (j + 1)}`; }));
    renderMatch(poster, isTL() && !isTeam() ? asTeams() : state);
    if (editing) StudioEdit.afterRender();
    $('#bgUploadRow').style.display = state.bgMode === 'image' ? '' : 'none';
    const mode = state.mode;
    $('#modeSel').value = mode;
    $$('[data-only]').forEach(el => { el.style.display = (el.dataset.only === 'tl' ? isTL() : el.dataset.only === mode) ? '' : 'none'; });
    $$('[data-k="layout"] option').forEach(o => { o.hidden = !o.dataset.mode.split(' ').includes(mode); });
  };

  // ---- poster fields ----
  $$('[data-k]').forEach(i => {
    i.value = state[i.dataset.k];
    i.addEventListener(i.tagName === 'SELECT' ? 'change' : 'input', () => { state[i.dataset.k] = i.value; render(); });
  });
  $$('[data-file]').forEach(i => i.addEventListener('change', async e => {
    const f = e.target.files[0]; state[i.dataset.file] = f ? await readFile(f) : ''; render();
  }));

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

  // the two strongest colours of a logo (transparent, white and black pixels skipped)
  async function logoColors(src) {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const W = 80, H = Math.max(1, Math.round(80 * img.height / img.width));
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0, W, H);
    const px = ctx.getImageData(0, 0, W, H).data, buckets = {};
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 200) continue;
      const r = px[i], g = px[i + 1], b = px[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const l = (mx + mn) / 510, s = mx === mn ? 0 : (mx - mn) / 255 / (1 - Math.abs(2 * l - 1));
      if (s < 0.3 || l < 0.12 || l > 0.9) continue;
      let h = mx === r ? ((g - b) / (mx - mn)) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4;
      h = ((h * 60) + 360) % 360;
      const k = Math.floor(h / 20), bk = buckets[k] || (buckets[k] = { n: 0, r: 0, g: 0, b: 0 });
      bk.n++; bk.r += r; bk.g += g; bk.b += b;
    }
    const hex = bk => '#' + [bk.r, bk.g, bk.b].map(v => Math.round(v / bk.n).toString(16).padStart(2, '0')).join('');
    const top = Object.values(buckets).sort((a, b) => b.n - a.n);
    if (!top.length) return null;
    return { primary: hex(top[0]), secondary: top[1] ? hex(top[1]) : '#111111' };
  }

  // ---- team sections ----
  const tpl = $('#teamTpl'), teamsEl = $('#teams');
  const secs = state.teams.map((t, i) => {
    const sec = tpl.content.firstElementChild.cloneNode(true);
    $('h3', sec).textContent = `Team ${i + 1}`;
    teamsEl.appendChild(sec);

    $$('[data-t]', sec).forEach(inp => {
      inp.value = t[inp.dataset.t];
      inp.addEventListener('input', () => { t[inp.dataset.t] = inp.value; render(); });
    });
    const setColors = c => {
      if (!c) return;
      Object.assign(t, c);
      $('[data-t="primary"]', sec).value = c.primary; $('[data-t="secondary"]', sec).value = c.secondary;
      render();
    };
    const fromJersey = async () => { if (t.photo) try { setColors(await JerseyColors.pickJerseyColors(t.photo)); } catch (e) { console.warn('Colour detect failed', e); } };
    const fromLogo = async () => { if (t.logo) try { setColors(await logoColors(t.logo)); } catch (e) { console.warn('Logo colours failed', e); } };
    $('[data-auto="jersey"]', sec).addEventListener('click', fromJersey);
    $('[data-auto="logo"]', sec).addEventListener('click', fromLogo);

    $('[data-photo]', sec).addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      const status = $('[data-status]', sec);
      let src = await readFile(f);
      // normal photo (no transparent background) -> cut the player out automatically
      if ($('[data-cutout]', sec).checked && !(await hasTransparency(src))) {
        try { src = await cutOut(f, status); }
        catch (err) { console.warn('Auto cut-out failed', err); status.textContent = 'Auto cut-out hoyni (internet lagbe). Normal chobi boshano holo.'; }
      }
      t.photo = await JerseyColors.enhancePhoto(await JerseyColors.trimTransparent(src));
      Object.assign(t, { dx: 0, dy: 0, zoom: 1 });
      render(); syncZoom(i);
      fromJersey();   // new photo -> new jersey colours
    });
    $('[data-logo]', sec).addEventListener('change', async e => {
      const f = e.target.files[0]; t.logo = f ? await readFile(f) : ''; render();
      if (t.logo) fromLogo();   // a logo sets the team colours too
    });
    $('[data-zoom]', sec).addEventListener('input', e => { t.zoom = e.target.value / 100; render(); syncZoom(i); });
    $('[data-reset-pos]', sec).addEventListener('click', () => { Object.assign(t, { dx: 0, dy: 0, zoom: 1 }); render(); syncZoom(i); });
    return { sec, fromJersey };
  });
  function syncZoom(i) {
    const sec = secs[i].sec, z = Math.round(state.teams[i].zoom * 100);
    $('[data-zoom]', sec).value = z; $('[data-zoom-val]', sec).textContent = z + '%';
  }

  // ---- mode: player vs player (Wave, Ticket) or team vs team (Crest Clash, Victory Squad, Torn Poster) ----
  const lastLayout = { player: 'wave', team: 'clash' };
  $('#modeSel').addEventListener('change', e => {
    lastLayout[state.mode] = state.layout; state.mode = e.target.value;
    state.layout = lastLayout[state.mode]; $('[data-k="layout"]').value = state.layout; render();
  });

  // ---- team mode fields ----
  const loadImage = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  /* Logos on a plain white/black/coloured background: everything connected to the border that matches the corner colour
     becomes transparent (soft edge), so the crest sits on the poster without a box. */
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
  /* Head size and position from the cut-out's alpha, so every squad player's head comes out the same width:
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
      return { w: b - a + 1, c: (a + b) / 2 };
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
  const measureSquads = () => Promise.all(state.tm.teams.flatMap(t => t.squad).map(async p => { if (p.photo && !p.m) p.m = await measure(p.photo).catch(() => null); }));
  async function teamPhoto(f, sec) {
    let src = await readFile(f);
    if ($('[data-tcut]', sec).checked && !(await hasTransparency(src))) {
      try { src = await cutOut(f, $('[data-tstatus]', sec)); }
      catch (err) { console.warn('Auto cut-out failed', err); $('[data-tstatus]', sec).textContent = 'Auto cut-out hoyni (internet lagbe). Normal chobi boshano holo.'; }
    }
    return JerseyColors.trimTransparent(src);   // not sharpened, so faces stay clean
  }

  $$('[data-tm]').forEach(i => {
    const k = i.dataset.tm;
    if (i.type === 'checkbox') { i.checked = state.tm[k]; i.addEventListener('change', () => { state.tm[k] = i.checked; render(); }); return; }
    i.value = state.tm[k];
    i.addEventListener(i.tagName === 'SELECT' ? 'change' : 'input', () => { state.tm[k] = i.value; render(); });
  });
  const ttpl = $('#tteamTpl'), sqtpl = $('#squadTpl');
  state.tm.teams.forEach((t, i) => {
    const sec = ttpl.content.firstElementChild.cloneNode(true);
    $('h3', sec).textContent = `Team ${i + 1}`;
    $('#tteams').appendChild(sec);
    $$('[data-tt]', sec).forEach(inp => {
      inp.value = t[inp.dataset.tt] || (inp.type === 'color' ? '#000000' : '');
      inp.addEventListener('input', () => { t[inp.dataset.tt] = inp.value; render(); });
    });
    const fromLogo = async () => {
      if (!t.logo) return;
      try { const c = await logoColors(t.logo); if (!c) return; t.color = c.primary; t.color2 = c.secondary; $('[data-tt="color"]', sec).value = c.primary; $('[data-tt="color2"]', sec).value = c.secondary; render(); }
      catch (e) { console.warn('Logo colours failed', e); }
    };
    $('[data-tauto]', sec).addEventListener('click', fromLogo);
    $('[data-tlogo]', sec).addEventListener('change', async e => {
      const f = e.target.files[0]; let logo = f ? await readFile(f) : '';
      if (logo && !(await hasTransparency(logo))) logo = await clearLogoBg(logo);
      t.logo = logo; render(); fromLogo();   // a crest sets the team colours too
    });
    $('[data-tphoto]', sec).addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      t.photo = await teamPhoto(f, sec); Object.assign(t, { dx: 0, dy: 0, zoom: 1 }); render();
    });
    t.squad.forEach((p, j) => {
      const row = sqtpl.content.firstElementChild.cloneNode(true);
      const name = $('[data-sn]', row); name.value = p.name; name.placeholder = j ? `Player ${j + 1}` : 'Player 1 (captain / star)';
      name.addEventListener('input', () => { p.name = name.value; render(); });
      $('[data-sp]', row).addEventListener('change', async e => {
        const f = e.target.files[0]; if (!f) return;
        p.photo = await teamPhoto(f, sec); p.m = await measure(p.photo).catch(() => null);
        Object.assign(p, { dx: 0, dy: 0, zoom: 1 }); render();
      });
      $('[data-sx]', row).addEventListener('click', () => { p.photo = ''; p.m = null; $('[data-sp]', row).value = ''; render(); });
      $('[data-squad]', sec).appendChild(row);
    });
  });

  // ---- partners strip (team mode) ----
  const ptpl = $('#partnerTpl');
  state.partners.forEach((p, i) => {
    const row = ptpl.content.firstElementChild.cloneNode(true);
    const name = $('[data-pname]', row); name.value = p.name; name.placeholder = `Partner ${i + 1}`;
    name.addEventListener('input', () => { p.name = name.value; render(); });
    $('[data-plogo]', row).addEventListener('change', async e => { const f = e.target.files[0]; p.logo = f ? await readFile(f) : ''; render(); });
    $('[data-pclear]', row).addEventListener('click', () => { p.logo = ''; p.name = ''; name.value = ''; $('[data-plogo]', row).value = ''; render(); });
    $('#partners').appendChild(row);
  });

  // ---- photos: drag and wheel-resize (sections, selection, nudge, remove and undo live in js/studio-edit.js) ----
  const frame = $('#frame');
  const posterScale = () => frame.getBoundingClientRect().width / 1080;
  let drag = null;
  frame.addEventListener('pointerdown', e => {
    const img = e.target.closest('[data-p]'); if (!img) return;
    const t = photoOf(+img.dataset.p);
    drag = { t, img, x: e.clientX, y: e.clientY, dx: t.dx, dy: t.dy };
    frame.setPointerCapture(e.pointerId); frame.classList.add('dragging');
  });
  frame.addEventListener('pointermove', e => {
    if (!drag) return;
    const s = posterScale(), t = drag.t;
    t.dx = Math.round(drag.dx + (e.clientX - drag.x) / s);
    t.dy = Math.round(drag.dy + (e.clientY - drag.y) / s);
    // player mode: move only the photo while dragging (no full re-render); team mode places photos by head size, so draw again
    if (isTL()) render();
    else drag.img.setAttribute('style', matchPhotoTransform(t, state.layout === 'ticket' ? 'translateX(-50%)' : ''));
  });
  const endDrag = () => { drag = null; frame.classList.remove('dragging'); };
  frame.addEventListener('pointerup', endDrag); frame.addEventListener('pointercancel', endDrag);
  frame.addEventListener('wheel', e => {
    const img = e.target.closest('[data-p]'); if (!img) return;
    e.preventDefault();
    const i = +img.dataset.p, t = photoOf(i);
    t.zoom = Math.min(2.5, Math.max(0.4, +(t.zoom * (e.deltaY < 0 ? 1.05 : 0.95)).toFixed(3)));
    render(); if (i < 2) syncZoom(i);
  }, { passive: false });

  /* Section move/size. Untouched sections get no transform at all, so the default poster (and its stacking) stays exactly
     as designed. Sections sit inside other boxes (team block, ticket card), so the kit's poster-px resize centre is turned
     into the wrapper's own px. A moved section comes above the untouched ones (and keeps the highest z-index inside it). */
  const styleOf = k => {
    const m = (state.moves[moveKey()] || {})[k] || {}, s = m.s || 1;
    if (!m.x && !m.y && s === 1) return '';
    const el = poster.querySelector(`[data-move="${k}"]`), root = poster.firstElementChild;
    let ox = 0, oy = 0, z = 0;
    for (let e = el; e && e !== root; e = e.offsetParent) { ox += e.offsetLeft; oy += e.offsetTop; }
    for (let a = el && el.parentElement.closest('[data-move]'); a; a = a.parentElement.closest('[data-move]')) { const q = (state.moves[moveKey()] || {})[a.dataset.move] || {}; ox += q.x || 0; oy += q.y || 0; }
    if (el) [el, ...el.querySelectorAll('*')].forEach(d => { z = Math.max(z, parseInt(getComputedStyle(d).zIndex) || 0); });
    return `transform:translate(${m.x || 0}px,${m.y || 0}px)${s !== 1 ? ` scale(${s})` : ''};transform-origin:${(m.ox || 540) - ox}px ${(m.oy || 675) - oy}px;z-index:${Math.max(1, z)}${el && !el.classList.contains('mv') ? ';position:relative' : ''}`;
  };
  StudioEdit.init({
    frame, poster, state, render, panel: $('#form'), partsBox: $('#parts'), parts: PARTS,
    moveKey, styleOf,
    photo: { get: photoOf, changed: i => { if (i < 2) syncZoom(i); } },
    extras: { get: () => allPhotos().map(t => [t.dx, t.dy, t.zoom]), set: v => { allPhotos().forEach((t, i) => { [t.dx, t.dy, t.zoom] = v[i]; }); syncZoom(0); syncZoom(1); } },
  });
  editing = true;

  // ---- reset: every section and both photos of this layout back to the default spot and size ----
  $('#resetAll').addEventListener('click', () => {
    const mk = moveKey();
    delete state.moves[mk]; delete state.hidden[mk];
    // both photo sets: the Wave / Ticket layouts show the player photos in team mode too
    [...state.tm.teams, ...state.tm.teams.flatMap(t => t.squad)].forEach(t => Object.assign(t, { dx: 0, dy: 0, zoom: 1 }));
    state.teams.forEach((t, i) => { Object.assign(t, { dx: 0, dy: 0, zoom: 1 }); syncZoom(i); });
    render();
  });

  // ---- download ----
  $('#download').addEventListener('click', async () => {
    const btn = $('#download'); btn.disabled = true; btn.textContent = 'Rendering…';
    try {
      const node = $('.mr', poster);
      const url = await htmlToImage.toPng(node, { width: 1080, height: 1350, pixelRatio: 2, fontEmbedCSS: window.POSTER_FONT_CSS, cacheBust: false });
      const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const a = document.createElement('a');
      const T = isTeam() ? state.tm.teams : state.teams;
      a.download = `match-result-${slug(T[0].name)}-vs-${slug(T[1].name)}${isTeam() ? '-' + state.layout : ''}.png`;
      a.href = url; a.click();
    } catch (e) { alert('Export failed: ' + e.message); }
    btn.disabled = false; btn.textContent = 'Download PNG (HD)';
  });

  render();
  // names are measured to fit, so draw again once the poster fonts are ready
  const fontsReady = Promise.all(['900 84px Unbounded', '800 38px "Bricolage Grotesque"', '900 30px Orbitron', '700 18px "Space Mono"',
    '900 80px "Big Shoulders Display"', '700 20px "Chakra Petch"', '600 20px "Chakra Petch"', 'italic 900 80px Kanit', 'italic 800 40px Kanit', '400 60px "Mr Dafoe"', '400 60px "Black Ops One"']
    .map(f => document.fonts.load(f))).catch(() => {});
  // sample photos: sharpen them and read the jersey colours, like a fresh upload
  window.__ready = fontsReady.then(async () => {
    render();
    for (const [i, t] of state.teams.entries()) if (t.photo) { t.photo = await JerseyColors.enhancePhoto(t.photo); await secs[i].fromJersey(); }
    await measureSquads();
    render(); StudioEdit.reset();
  });
  window.__posterState = state;
  window.__render = render;
})();
