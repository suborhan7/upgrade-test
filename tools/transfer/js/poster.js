/* Transfer poster renderer: renderTransfer(el, state). One player moving from an old club to a new one, three layouts:
   arrow (chevrons flowing from the old club's colour into the new club's), contract (a signed transfer agreement on a
   pinstripe desk, with an inked DONE DEAL stamp) and news (a TV "Breaking news / Here we go!" broadcast with a stats ticker).
   Every block sits in a .mv wrapper so the admin can drag it and wheel-resize it; see trMoveStyle. */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dk = (hx, k) => { const n = parseInt(hx.slice(1), 16), f = c => Math.round(c * k).toString(16).padStart(2, '0'); return '#' + f(n >> 16) + f(n >> 8 & 255) + f(n & 255); };

  /* Colours of each layout. "Default template" uses fixed ones; "Club colours" takes the old club's main colour (f) and
     the new club's two colours (c1, c2). An uploaded background keeps the template colours for panels and text. */
  function palette(st) {
    const { from: F, to: T } = st, club = st.bgMode === 'jersey';
    if (st.layout === 'arrow') return club ? { f: F.c, c1: T.c, c2: T.c2, base: [dk(T.c, .22), '#06050d'] }
      : { f: '#1f7bff', c1: '#00d4ff', c2: '#ff2e88', base: ['#0b1030', '#05060f'] };
    if (st.layout === 'contract') return club ? { base: dk(T.c, .2), glow: T.c, lamp: T.c2, acc: T.c2, acc2: T.c, stamp: T.c, ink: dk(T.c, .55) }
      : { base: '#0c1a33', glow: '#1e5bd8', lamp: '#f2c14e', acc: '#f2c14e', acc2: '#ff6a3d', stamp: '#d42a2a', ink: '#0c1a33' };
    return club ? { red: '#e8132b', navy: dk(T.c, .45), c1: T.c, c2: T.c2, yel: '#ffd400' }
      : { red: '#e8132b', navy: '#0f1d4a', c1: '#1d4fff', c2: '#29d3ff', yel: '#ffd400' };
  }

  /* Where the player cut-out goes in each layout: body centre x, head-top line, head width and the floor the photo
     must reach (a short chest-up crop is pushed down so it never floats). */
  const SLOT = {
    arrow:    { x: 540, top: 262, head: 168, floor: 820 },
    contract: { x: 820, top: 320, head: 152, floor: 900 },
    news:     { x: 755, top: 282, head: 172, floor: 930 },
  };
  window.trSlot = st => SLOT[st.layout];

  // admin's own drags/sizes of sections, kept apart for each layout
  window.trMoveKey = st => st.layout;
  window.trMoveStyle = (st, key) => {
    const o = ((st.moves || {})[trMoveKey(st)] || {})[key] || {}, sc = o.s || 1;
    return `transform:translate(${o.x || 0}px,${o.y || 0}px)${sc !== 1 ? ` scale(${sc})` : ''};transform-origin:${o.ox || 540}px ${o.oy || 675}px`;
  };

  // player photo placed by head size (m = head measurement from maker.js)
  window.trPhotoStyle = (p, slot) => {
    const m = p.m;
    if (!m) return `left:${slot.x - 250 + p.dx}px;top:${slot.top - 20 + p.dy}px;width:${500 * p.zoom}px`;
    const s = slot.head / m.head * p.zoom;
    let top = slot.top - m.top * s;
    const bottom = top + m.h * s;
    if (bottom < slot.floor + 4 && p.zoom >= 1) top += slot.floor + 4 - bottom;
    return `left:${(slot.x - m.cx * s + p.dx).toFixed(1)}px;top:${(top + p.dy).toFixed(1)}px;width:${(m.w * s).toFixed(1)}px;height:${(m.h * s).toFixed(1)}px`;
  };

  function renderTransfer(root, st) {
    const L = st.layout, P = palette(st), F = st.from, T = st.to;
    const isUp = st.bgMode === 'image' && st.bgImage;
    const mv = (key, html) => `<div class="mv" data-move="${key}" style="${trMoveStyle(st, key)}">${html}</div>`;
    const logo = (src, size, extra = '') => src ? `<img class="lg" src="${src}" style="width:${size}px;height:${size}px;${extra}" alt="">`
      : `<div class="lg nolg" style="width:${size}px;height:${size}px;${extra}"></div>`;
    const sp = `<div class="sp"><div class="k">${esc(st.partnersLabel).toUpperCase()}</div><div class="sprow">${st.partners.map(p =>
      `<div>${p.logo ? `<img src="${p.logo}" alt="">` : esc(p.name)}</div>`).join('')}</div><div class="w">${esc(st.site).toUpperCase()}</div></div>`;
    const brand = `<div class="brand">${st.logo ? `<img src="${st.logo}" alt="">` : 'eFCB'}</div>`;
    const photo = (extra = '') => st.photo ? `<div class="slot"><img class="ph" data-p="0" src="${st.photo}" style="${trPhotoStyle(st, SLOT[L])};${extra}" alt=""></div>` : '';
    const up = (wash) => isUp ? `<div class="upbg" style="background-image:url('${st.bgImage}')"></div><div class="wash" style="background:${wash}"></div>` : '';
    const stats = st.stats.filter(s => s.k || s.v);
    const date = esc(st.date), name = esc(st.player);
    let h = '', vars = '';

    if (L === 'arrow') {
      vars = `--f:${P.f};--c1:${P.c1};--c2:${P.c2}`;
      const N = 9, chev = Array.from({ length: N }, (_, i) => {
        const x = -200 + i * 150, t = i / (N - 1);
        return `<path d="M${x} 420 L${x + 70} 420 L${x + 210} 560 L${x + 70} 700 L${x} 700 L${x + 140} 560 Z" fill="url(#trag)" opacity="${(.12 + t * .5).toFixed(2)}"/>`;
      }).join('');
      // thin speed streaks along the flow
      const streaks = [[460, 380, .5], [520, 520, .35], [610, 300, .45], [668, 460, .3], [735, 260, .4]].map(([y, w, o], i) =>
        `<rect x="${(i * 211) % 700 - 80}" y="${y}" width="${w}" height="3" rx="1.5" fill="url(#trag)" opacity="${o}"/>`).join('');
      h = `${up('linear-gradient(180deg,rgba(5,6,15,.35),rgba(5,6,15,.1) 40%,rgba(5,6,15,.85))') || `
        <svg class="full" viewBox="0 0 1080 1350"><defs><linearGradient id="trbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.base[0]}"/><stop offset="1" stop-color="${P.base[1]}"/></linearGradient>
          <radialGradient id="trg1" cx="22%" cy="47%" r="45%"><stop offset="0" stop-color="${P.f}" stop-opacity=".45"/><stop offset="1" stop-color="${P.f}" stop-opacity="0"/></radialGradient>
          <radialGradient id="trg2" cx="78%" cy="40%" r="50%"><stop offset="0" stop-color="${P.c1}" stop-opacity=".55"/><stop offset="1" stop-color="${P.c1}" stop-opacity="0"/></radialGradient>
          <radialGradient id="trg3" cx="92%" cy="78%" r="35%"><stop offset="0" stop-color="${P.c2}" stop-opacity=".35"/><stop offset="1" stop-color="${P.c2}" stop-opacity="0"/></radialGradient>
          <pattern id="trdots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" fill="#fff" opacity=".06"/></pattern></defs>
          <rect width="1080" height="1200" fill="url(#trbg)"/><rect width="1080" height="1200" fill="url(#trg1)"/><rect width="1080" height="1200" fill="url(#trg2)"/><rect width="1080" height="1200" fill="url(#trg3)"/>
          <rect width="1080" height="1200" fill="url(#trdots)"/></svg>`}
        <svg class="full" viewBox="0 0 1080 1350"><defs><linearGradient id="trag" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1080" y2="0"><stop offset="0" stop-color="${P.f}"/><stop offset=".55" stop-color="${P.c1}"/><stop offset="1" stop-color="${P.c2}"/></linearGradient>
          <linearGradient id="trag2"><stop offset="0" stop-color="${P.c1}"/><stop offset="1" stop-color="${P.c2}"/></linearGradient></defs>${chev}${streaks}</svg>
        ${mv('side', `<div class="side">TRANSFER · ${esc(st.window).toUpperCase()}</div>`)}
        ${mv('head', `<div class="hdr">${brand}<div class="date"><b>${esc(st.kicker).toUpperCase()}</b>${date.toUpperCase()}</div></div>`)}
        ${mv('title', `<div class="title"><span>${esc(st.title).toUpperCase()}</span></div>`)}
        ${photo()}
        ${mv('row', `<div class="row"><div class="club from">${logo(F.logo, 96, 'box-shadow:0 0 0 4px rgba(255,255,255,.15)')}<div><div class="lab">FROM</div><div class="nm">${esc(F.name).toUpperCase()}</div></div></div>
          <div class="chev">${[0, 1, 2].map(i => `<svg width="38" height="56" viewBox="0 0 38 56"><path d="M2 2 L20 2 L36 28 L20 54 L2 54 L18 28Z" fill="url(#trag2)" opacity="${.45 + i * .27}"/></svg>`).join('')}</div>
          <div class="club to">${logo(T.logo, 110, `box-shadow:0 0 0 4px ${P.c2},0 0 30px ${P.c1}`)}<div><div class="lab">TO</div><div class="nm">${esc(T.name).toUpperCase()}</div></div></div></div>`)}
        ${mv('name', `<div class="name"><b>${name.toUpperCase()}</b><i></i></div>`)}
        ${stats.length ? mv('stats', `<div class="stats" style="grid-template-columns:repeat(${stats.length},1fr)">${stats.map(s => `<div><small>${esc(s.k).toUpperCase()}</small><b>${esc(s.v)}</b></div>`).join('')}</div>`) : ''}`;
    }

    if (L === 'contract') {
      vars = `--acc:${P.acc};--acc2:${P.acc2};--stamp:${P.stamp};--ink:${P.ink};--club:${T.c}`;
      const clause = `${name} agrees to represent ${esc(T.name)} in all eFCB competitions from ${date}, ending registration with ${esc(F.full || F.name)}.`;
      h = `${up('linear-gradient(90deg,rgba(5,6,15,.6),rgba(5,6,15,.15))') || `
        <svg class="full" viewBox="0 0 1080 1350"><defs><radialGradient id="trcg" cx="78%" cy="45%" r="55%"><stop offset="0" stop-color="${P.glow}" stop-opacity=".75"/><stop offset="1" stop-color="${P.glow}" stop-opacity="0"/></radialGradient>
          <radialGradient id="trlamp" cx="12%" cy="0%" r="70%"><stop offset="0" stop-color="${P.lamp}" stop-opacity=".2"/><stop offset=".6" stop-color="${P.lamp}" stop-opacity=".05"/><stop offset="1" stop-color="${P.lamp}" stop-opacity="0"/></radialGradient>
          <pattern id="trpin" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(0)"><rect x="12" width="1.2" height="26" fill="#fff" opacity=".05"/><rect x="12" width="1.2" height="2" y="6" fill="#fff" opacity=".05"/></pattern>
          <filter id="trgrain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .06 0"/></filter></defs>
          <rect width="1080" height="1200" fill="${P.base}"/><rect width="1080" height="1200" fill="url(#trpin)"/><rect width="1080" height="1200" fill="url(#trcg)"/><rect width="1080" height="1200" fill="url(#trlamp)"/>
          <rect width="1080" height="1200" filter="url(#trgrain)"/></svg>`}
        ${mv('head', `<div class="hdr">${brand}<div class="hd">${esc(st.window).toUpperCase()}<br>${date.toUpperCase()}</div></div>`)}
        ${mv('title', `<div class="title"><i>${esc(st.kicker)}</i><b>${esc(st.title)}</b><span>SIGNED · SEALED · ${esc(T.name).toUpperCase()}</span></div>`)}
        ${photo('-webkit-mask-image:linear-gradient(180deg,#000 80%,transparent 98%);mask-image:linear-gradient(180deg,#000 80%,transparent 98%)')}
        ${mv('paper', `<div class="sheet back"></div><div class="paper">
          <svg class="grain" viewBox="0 0 560 800" preserveAspectRatio="none"><filter id="trpg"><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="3" seed="8"/><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .38  0 0 0 0 .25  0 0 0 .09 0"/></filter><rect width="560" height="800" filter="url(#trpg)"/></svg>
          <div class="lh">${logo(T.logo, 46)}<div><div class="k">eFCB · TRANSFER AGREEMENT</div><h4>Player Registration</h4></div><div class="no">Nº ${esc(st.contractNo)}</div></div>
          <div class="ln dbl"></div>
          <div class="clubs"><div class="c">${logo(F.logo, 112)}<em>FROM</em>${esc(F.name).toUpperCase()}</div>
            <svg width="70" height="30" viewBox="0 0 70 30"><path d="M2 17 C18 6 36 26 60 13" fill="none" stroke="var(--stamp)" stroke-width="3.5" stroke-linecap="round"/><path d="M50 5 L64 12 L53 24" fill="none" stroke="var(--stamp)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <div class="c">${logo(T.logo, 112)}<em>TO</em>${esc(T.name).toUpperCase()}</div></div>
          <div class="ln"></div>
          ${stats.length ? `<div class="tbl">${stats.map(s => `<div><span>${esc(s.k).toUpperCase()}</span><b>${esc(s.v)}</b></div>`).join('')}</div>` : ''}
          <p class="cl"><b>§1</b> ${clause}</p>
          <div class="sig"><div class="s">${name}</div><div class="l"><span>PLAYER SIGNATURE</span><span>${date.toUpperCase()}</span></div></div></div>
          <svg class="clip" width="54" height="130" viewBox="0 0 54 130"><defs><linearGradient id="trclip" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a6420"/><stop offset=".45" stop-color="#ffe7a3"/><stop offset="1" stop-color="#a77a26"/></linearGradient></defs>
            <path d="M14 112 V22 a13 13 0 0 1 26 0 V100 a8 8 0 0 1 -16 0 V34" fill="none" stroke="url(#trclip)" stroke-width="6" stroke-linecap="round"/></svg>`)}
        ${mv('stamp', `<svg class="stamp" viewBox="0 0 230 230"><defs><filter id="trink"><feTurbulence type="fractalNoise" baseFrequency=".06" numOctaves="3" seed="5" result="n"/><feColorMatrix in="n" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.55" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>
            <path id="trarc" d="M30 115 A85 85 0 0 1 200 115"/><path id="trarc2" d="M38 118 A77 77 0 0 0 192 118"/></defs>
          <g filter="url(#trink)"><circle cx="115" cy="115" r="108" fill="none" stroke="currentColor" stroke-width="7"/><circle cx="115" cy="115" r="94" fill="none" stroke="currentColor" stroke-width="2.5"/>
          <text font-family="IBM Plex Mono" font-weight="600" font-size="17" letter-spacing="4" fill="currentColor"><textPath href="#trarc" startOffset="50%" text-anchor="middle">eFCB · OFFICIAL</textPath></text>
          <text font-family="IBM Plex Mono" font-weight="600" font-size="15" letter-spacing="4" fill="currentColor"><textPath href="#trarc2" startOffset="50%" text-anchor="middle">★ ${esc(st.stampLine).toUpperCase()} ★</textPath></text>
          <rect x="14" y="90" width="202" height="52" fill="currentColor"/><text x="115" y="128" text-anchor="middle" font-family="Archivo Black" font-size="${Math.min(34, 300 / Math.max(6, st.title.length))}" fill="#f6f1e6">${esc(st.title).toUpperCase()}</text></g></svg>`)}
        ${mv('name', `<div class="namebox"><small>WELCOME TO ${esc(T.name).toUpperCase()}</small><b>${name}</b><div class="bar"></div><div class="site">Joins from ${esc(F.full || F.name)}</div></div>`)}`;
    }

    if (L === 'news') {
      vars = `--red:${P.red};--navy:${P.navy};--c2:${P.c2};--yel:${P.yel}`;
      const beams = [[120, .18], [330, .12], [760, .14], [960, .2]].map(([x, o]) => `<path d="M${x} 96 L${x - 160} 1120 L${x + 160} 1120 Z" fill="url(#trbm)" opacity="${o}"/>`).join('');
      const brk = (x, y, sx, sy) => `<path d="M${x} ${y + sy * 40} V${y} H${x + sx * 40}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="4"/>`;
      h = `${up('linear-gradient(180deg,rgba(5,6,15,.25),rgba(5,6,15,.7))') || `
        <svg class="full" viewBox="0 0 1080 1350"><defs><linearGradient id="trnb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#060814"/><stop offset=".6" stop-color="${P.navy}"/><stop offset="1" stop-color="#05060d"/></linearGradient>
          <linearGradient id="trbm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.c2}"/><stop offset="1" stop-color="${P.c2}" stop-opacity="0"/></linearGradient>
          <radialGradient id="trnc" cx="64%" cy="46%" r="42%"><stop offset="0" stop-color="${P.c1}" stop-opacity=".8"/><stop offset="1" stop-color="${P.c1}" stop-opacity="0"/></radialGradient>
          <pattern id="trscan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#fff" opacity=".035"/></pattern>
          <pattern id="trmap" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="9" cy="9" r="2" fill="${P.c2}" opacity=".16"/></pattern>
          <radialGradient id="trmk" cx="66%" cy="46%" r="40%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><mask id="trmm"><rect width="1080" height="1200" fill="url(#trmk)"/></mask></defs>
          <rect width="1080" height="1200" fill="url(#trnb)"/><rect width="1080" height="1200" fill="url(#trnc)"/>${beams}
          <rect width="1080" height="1200" fill="url(#trmap)" mask="url(#trmm)"/>
          <g opacity=".22" stroke="${P.c2}" fill="none"><circle cx="700" cy="560" r="300"/><circle cx="700" cy="560" r="360" stroke-dasharray="4 10"/></g>
          <rect width="1080" height="1200" fill="url(#trscan)"/></svg>`}
        <svg class="full" viewBox="0 0 1080 1350">${brk(470, 250, 1, 1)}${brk(1040, 250, -1, 1)}</svg>
        ${photo()}
        ${mv('top', `<div class="top">${brand}<div class="live"><i></i>LIVE · ${esc(st.window).toUpperCase()}</div><div class="clock"><small>BST</small>${esc(st.time)}</div></div>`)}
        ${mv('tag', `<div class="tag"><span>BREAKING NEWS</span></div><div class="excl">EXCLUSIVE</div>`)}
        ${mv('title', `<div class="hwg"><b>${esc(st.newsTop).toUpperCase()}</b><span>${esc(st.newsBig).toUpperCase()}</span></div>`)}
        ${mv('lower', `<div class="lower"><div class="l1">${logo(T.logo, 42)}${esc(st.title).toUpperCase()} · OFFICIAL</div>
          <div class="l2"><div class="nm">${name}</div><div class="mvs">${logo(F.logo, 96)}<div class="arr">»»</div>${logo(T.logo, 96)}</div></div>
          <div class="l3"><b>●</b><span>${name} completes move from ${esc(F.name)} to ${esc(T.name)} · ${date}</span></div></div>`)}
        ${stats.length ? mv('stats', `<div class="ticker"><div class="lab">STATS</div><div class="items">${stats.map((s, i) => `${i ? '<i class="dot"></i>' : ''}<div class="it">${esc(s.k).toUpperCase()}<b>${esc(s.v)}</b></div>`).join('')}</div></div>`) : ''}`;
    }

    root.innerHTML = `<div class="tr ${L}${isUp ? ' up' : ''}" style="${vars}">${h}${mv('partners', sp)}</div>`;
    fitText(root.firstElementChild);
  }

  // long names and titles shrink until they fit their space
  const FIT = {
    arrow: [['.title span', 1000], ['.name b', 900], ['.row .nm', 250]],
    contract: [['.title b', 640], ['.namebox b', 440], ['.namebox .site', 440]],
    news: [['.hwg span', 560], ['.hwg b', 560], ['.l2 .nm', 600], ['.l3 span', 900]],
  };
  function fitText(p) {
    const L = [...p.classList].find(c => FIT[c]);
    for (const [sel, max] of FIT[L]) p.querySelectorAll(sel).forEach(el => {
      el.style.fontSize = '';
      let f = parseFloat(getComputedStyle(el).fontSize);
      const w0 = el.style.width, d0 = el.style.display;
      el.style.width = 'max-content'; el.style.display = 'inline-block';
      while (el.offsetWidth > max && f > 12) { f -= 1; el.style.fontSize = f + 'px'; }
      el.style.width = w0; el.style.display = d0;
    });
  }

  window.renderTransfer = renderTransfer;
})();
