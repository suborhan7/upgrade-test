/* Two extra Player Comparison layouts taken from the Match Result team designs. renderCmpVersus(el, d), called by
   renderComparison when d.layout is one of CMP_VS_LAYOUTS. Uses the same data as the classic layout plus
   d.bgMode ('template' | 'jersey' | 'image'), d.bgImage, d.a.logo / d.b.logo (team crest, optional),
   d.partnersLabel, d.partners [{ name, logo }], d.site.
   clash (Crest Clash: two colour halves split by a lightning seam, each player's club logo beside the name, a chrome VS
          plate in a hex, the title in big chrome cyberpunk letters over the heads, the stats in a centre column)
   torn  (Torn Poster: a torn paper strip across the poster with the stats stamped on it, player 1 above the tear and
          player 2 below, halftone dots, a tape tag on the player who wins more stats)
   Photos are data-p 0 / 1 (dragged by the maker, styled by cmpPhotoStyle); every block is a .mv layer (data-move). */
(function () {
  window.CMP_VS_LAYOUTS = ['clash', 'torn'];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rgb = hx => { const n = parseInt(String(hx || '#000').replace('#', '').padEnd(6, '0').slice(0, 6), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const rgba = (hx, a) => `rgba(${rgb(hx).join(',')},${a})`;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const seeded = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const num = v => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? null : n; };
  const mv = (k, h) => `<div class="mv" data-move="${k}">${h}</div>`;
  const svg = (defs, body, cls = '') => `<svg class="full ${cls}" viewBox="0 0 1080 1350"><defs>${defs}</defs>${body}</svg>`;

  function toHsl(hex) {
    const [r, g, b] = rgb(hex).map(v => v / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min, s = l > .5 ? d / (2 - max - min) : d / (max + min);
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  }
  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
    const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  }
  // one strong colour per player from the jersey (trim of a white/black kit, purple for a plain one), as in Match Result
  function teamColor(p, q) {
    const [h, s, l] = toHsl(p), [sh, ss, sl] = toHsl(q);
    if (!(s < .25 || l < .12 || l > .92)) return { c: hsl(h, Math.max(s, .7), clamp(l, .4, .56)), plain: false };
    if (ss > .25 && sl > .12 && sl < .9) return { c: hsl(sh, Math.max(ss, .65), clamp(sl, .38, .5)), plain: false };
    return { c: '#7b3fe4', plain: true };
  }
  function popFor(c, plain) {
    if (plain) return '#f5c542';
    const [h, s] = toHsl(c);
    if (s < .25) return '#22d3ee';
    if (h >= 25 && h < 80) return '#7b3fe4';
    if (h < 25 || h >= 330) return '#ffc23a';
    if (h < 200) return '#ffd23a';
    if (h < 262) return '#2de2c9';
    return '#ff4fd8';
  }
  const lum = hx => { const [r, g, b] = rgb(hx).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
  const onPaper = c => lum(c) > .3 ? mix(c, '#000000', .35) : c;   // a value printed on the cream paper stays readable
  const hueGap = (a, b) => { const d = Math.abs(toHsl(a)[0] - toHsl(b)[0]); return Math.min(d, 360 - d); };

  // default template = fixed colours per layout; jersey = each player's kit colour (a contrast colour when both kits match)
  const TPL = { clash: { c1: '#ff2e63', c2: '#19c7ff', pop: '#ffd23a' }, torn: { c1: '#ff5a1f', c2: '#2453ff', pop: '#ffe14a' } };
  function palette(d) {
    if (d.bgMode !== 'jersey') return TPL[d.layout];
    const a = teamColor(d.a.primary, d.a.secondary), b = teamColor(d.b.primary, d.b.secondary);
    let c2 = b.c, pop = popFor(a.c, a.plain);
    if (hueGap(a.c, c2) < 28) c2 = pop;
    if (hueGap(pop, c2) < 28) pop = '#ffffff';
    return { c1: a.c, c2, pop };
  }

  function winner(s) {
    if (s.better === 'none') return null;
    const a = num(s.a), b = num(s.b);
    if (a === null || b === null || a === b) return null;
    return (s.better === 'low' ? a < b : a > b) ? 'a' : 'b';
  }

  // where each layout stands its two players: centre x, feet line, height (the admin's drag / size goes on top)
  const SPOT = {
    clash: { a: { cx: 215, bottom: 1050, h: 690 }, b: { cx: 865, bottom: 1050, h: 690 } },
    torn: { a: { cx: 270, bottom: 840, h: 530 }, b: { cx: 860, bottom: 1290, h: 530 } },
  };
  window.cmpPhotoStyle = (d, key) => {
    const p = d[key], s = SPOT[d.layout][key];
    return `left:${s.cx}px;top:${s.bottom - s.h}px;height:${s.h}px;transform:translateX(-50%) translate(${+p.dx || 0}px,${+p.dy || 0}px) scale(${+p.zoom || 1});`;
  };
  const photo = (d, key) => d[key].photo ? `<img class="cap player-${key}" data-p="${key === 'a' ? 0 : 1}" src="${esc(d[key].photo)}" alt="" style="${cmpPhotoStyle(d, key)}">` : '';
  const crest = (p, s) => p.logo ? `<img class="cr" src="${esc(p.logo)}" style="width:${s}px;height:${s}px" alt="">` : '';
  const partners = d => `<div class="sp"><div class="k">${esc(d.partnersLabel || '').toUpperCase()}</div><div class="sprow">${(d.partners || []).map(p =>
    `<div>${p.logo ? `<img src="${esc(p.logo)}" alt="">` : esc(p.name)}</div>`).join('')}</div><div class="w">${esc(d.site || '').toUpperCase()}</div></div>`;
  const brand = d => d.logo ? `<div class="brand logo"><img src="${esc(d.logo)}" alt=""></div>` : `<div class="brand">eFCB</div>`;
  // the title in two lines (first word, then the rest), in the cyberpunk Orbitron face
  const titleLines = t => { const w = String(t || '').trim().split(/\s+/); return w.length > 1 ? `<b>${esc(w[0])}</b><b>${esc(w.slice(1).join(' '))}</b>` : `<b>${esc(w[0] || '')}</b>`; };
  const better = (n, lead) => `<b class="res ${lead ? 'w' : 'l'}">BETTER IN ${n}</b>`;

  // ---------------------------------------------------------------- Crest Clash
  function clash(d, P, up, rows, wa, wb) {
    const R = seeded(5);
    let x = 600, seam = 'M600 -20';
    for (let y = 40; y <= 1370; y += 60) { x = 600 - (y / 1350) * 120 + (R() - .5) * 70; seam += ` L${x.toFixed(0)} ${y}`; }
    const dots = (cx, cy) => Array.from({ length: 12 }, (_, r) => Array.from({ length: 12 }, (_, k) => { const s = Math.max(0, 5.4 - Math.hypot(r, k) * .5);
      return s > .5 ? `<circle cx="${cx + (cx < 540 ? k : -k) * 17}" cy="${cy + r * 17}" r="${s.toFixed(1)}" fill="#fff"/>` : ''; }).join('')).join('');
    let h = up ? `<div class="bgimg" style="background-image:url('${esc(d.bgImage)}')"></div><div class="wash" style="background:linear-gradient(180deg,rgba(5,5,16,.25),rgba(5,5,16,.85) 75%)"></div>`
      : `<div class="wash" style="background:#070716"></div>`;
    h += svg(`<linearGradient id="hl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P.c1}" stop-opacity=".95"/><stop offset="1" stop-color="${mix(P.c1, '#070716', .7)}" stop-opacity=".9"/></linearGradient>
        <linearGradient id="hr" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.c2}" stop-opacity=".95"/><stop offset="1" stop-color="${mix(P.c2, '#070716', .7)}" stop-opacity=".9"/></linearGradient>
        <radialGradient id="cg1"><stop offset="0" stop-color="${P.c1}" stop-opacity=".7"/><stop offset="1" stop-color="${P.c1}" stop-opacity="0"/></radialGradient>
        <radialGradient id="cg2"><stop offset="0" stop-color="${P.c2}" stop-opacity=".7"/><stop offset="1" stop-color="${P.c2}" stop-opacity="0"/></radialGradient>
        <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <filter id="glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="9"/></filter>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="22"/></filter>
        <filter id="spk" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.2"/></filter>`,
      `<path d="M0 0 H600 L480 1350 H0 Z" fill="url(#hl)" opacity="${up ? .38 : 1}"/><path d="M600 0 H1080 V1350 H480 Z" fill="url(#hr)" opacity="${up ? .38 : 1}"/>
       ${up ? '' : `<g filter="url(#soft)"><polygon points="-40,-40 60,-40 520,900 300,900" fill="url(#beam)" opacity=".5"/><polygon points="1020,-40 1120,-40 780,900 560,900" fill="url(#beam)" opacity=".5"/></g>
       <g opacity=".35">${dots(30, 150)}${dots(1050, 150)}</g>`}`);
    // two forks off the main bolt and sparks along it
    const fork = (y0, dir, n) => { let fx = 600 - (y0 / 1350) * 120, fy = y0, d = `M${fx.toFixed(0)} ${fy}`;
      for (let i = 0; i < n; i++) { fx += dir * (28 + R() * 30); fy += 26 + R() * 30; d += ` L${fx.toFixed(0)} ${fy.toFixed(0)}`; } return d; };
    const forks = [fork(250, 1, 4), fork(700, -1, 5), fork(1020, 1, 3)];
    const sparks = Array.from({ length: 26 }, () => { const y = R() * 1250, sx = 600 - (y / 1350) * 120 + (R() - .5) * 140;
      return `<circle cx="${sx.toFixed(0)}" cy="${y.toFixed(0)}" r="${(1 + R() * 2.6).toFixed(1)}" fill="#fff" opacity="${(.4 + R() * .6).toFixed(2)}"/>`; }).join('');
    h += mv('seam', svg('', `<path d="${seam}" fill="none" stroke="${P.pop}" stroke-width="26" filter="url(#glow)" opacity=".9"/>
      ${forks.map(f => `<path d="${f}" fill="none" stroke="${P.pop}" stroke-width="10" filter="url(#glow)" opacity=".8"/><path d="${f}" fill="none" stroke="#fff" stroke-width="2.5"/>`).join('')}
      <path d="${seam}" fill="none" stroke="#fff" stroke-width="5"/><g filter="url(#spk)">${sparks}</g>`, 'seam'));
    h += mv('title', `<div class="ttl">${titleLines(d.title)}</div>`);
    h += photo(d, 'a') + photo(d, 'b');
    h += `<div class="floor"></div>`;
    h += mv('vs', `<div class="vsplate"><span>VS</span></div>`);
    const val = (v, win, k) => `<span class="v ${win ? 'win ' + k : ''}"><i>${esc(v)}</i></span>`;
    if (rows.length) h += mv('stats', `<div class="cstats">${rows.map(r => `<div class="crow">
        ${val(r.a, r.w === 'a', 'a')}<em>${esc(r.label)}</em>${val(r.b, r.w === 'b', 'b')}</div>`).join('')}</div>`);
    // the club logo sits right before the player's name (no ring)
    const nm = (p, k) => `<div class="nrow ${k === 'a' ? 'l' : 'r'}">${crest(p, 78)}<div class="tn">${esc(p.name)}</div></div>`;
    h += mv('nameA', nm(d.a, 'a'));
    h += mv('nameB', nm(d.b, 'b'));
    const info = (p, n, lead, side) => `<div class="ti ${side}"><span>${esc(p.team)}</span>${rows.length ? better(n, lead) : ''}</div>`;
    h += mv('teamA', info(d.a, wa, wa > wb, 'l'));
    h += mv('teamB', info(d.b, wb, wb > wa, 'r'));
    h += mv('brand', `<div class="hd l">${brand(d)}</div>`);
    if (d.tag) h += mv('tag', `<div class="hd r"><div class="tag">${esc(d.tag)}</div></div>`);
    h += mv('kick', `<div class="kick">${esc(d.kicker)}</div>`);
    return h;
  }

  // ---------------------------------------------------------------- Torn Poster
  function torn(d, P, up, rows, wa, wb) {
    const R = seeded(29);
    // the tear runs from (0, 1000) up to (1080, 520); the paper strip is ±108px around it with ragged edges
    const yAt = (x, off) => 1000 - x * 480 / 1080 + off;
    const edge = (off, j) => { const pts = []; for (let x = -20; x <= 1100; x += 18) pts.push(`${x},${(yAt(x, off) + (R() - .5) * j).toFixed(1)}`); return pts; };
    const top = edge(-108, 16), bot = edge(108, 16), topIn = edge(-93, 10), botIn = edge(93, 10);
    const paper = `M${top.join(' L')} L${bot.slice().reverse().join(' L')} Z`;
    const paper2 = `M${topIn.join(' L')} L${botIn.slice().reverse().join(' L')} Z`;
    const dot = (id, c) => `<pattern id="${id}" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="8" cy="8" r="3.2" fill="${c}"/></pattern>`;
    let h = up ? `<div class="bgimg" style="background-image:url('${esc(d.bgImage)}')"></div>` : '';
    h += svg(`<linearGradient id="ta" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(P.c1, '#ffffff', .12)}"/><stop offset="1" stop-color="${mix(P.c1, '#000000', .45)}"/></linearGradient>
        <linearGradient id="tb" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${mix(P.c2, '#000000', .55)}"/><stop offset="1" stop-color="${mix(P.c2, '#ffffff', .08)}"/></linearGradient>
        ${dot('d1', rgba('#000000', .16))}${dot('d2', rgba('#ffffff', .1))}
        <filter id="grit"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .22 0"/></filter>
        <filter id="psh" x="-5%" y="-20%" width="110%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="10" flood-opacity=".45"/></filter>`,
      `<path d="M0 0 H1080 V${yAt(1080, 0)} L0 ${yAt(0, 0)} Z" fill="url(#ta)" opacity="${up ? .42 : 1}"/>
       <path d="M0 ${yAt(0, 0)} L1080 ${yAt(1080, 0)} V1350 H0 Z" fill="url(#tb)" opacity="${up ? .42 : 1}"/>
       ${up ? '' : `<path d="M0 0 H1080 V${yAt(1080, 0)} L0 ${yAt(0, 0)} Z" fill="url(#d1)" opacity=".8"/><path d="M0 ${yAt(0, 0)} L1080 ${yAt(1080, 0)} V1350 H0 Z" fill="url(#d2)"/>
       <rect width="1080" height="1350" filter="url(#grit)"/>`}
       <path d="M0 1180 H1080 V1350 H0 Z" fill="#000" opacity=".35"/>`);
    // player 1 stands behind the paper, player 2 in front of it below the tear
    h += photo(d, 'a');
    h += mv('paper', svg('', `<path d="${paper}" fill="#f1ece1" filter="url(#psh)"/><path d="${paper2}" fill="none" stroke="#d9d1bf" stroke-width="2" stroke-dasharray="2 7"/>
      <path d="${paper}" fill="url(#d1)" opacity=".18"/>`, 'paper'));
    // the stats stamped along the strip: player 1's value above the label, player 2's below
    if (rows.length) h += mv('stats', `<div class="tstats">${rows.map(r => `<div class="tcol">
        <b class="${r.w === 'a' ? 'wa' : r.w ? 'lo' : ''}">${esc(r.a)}</b><em>${esc(r.label)}</em><b class="${r.w === 'b' ? 'wb' : r.w ? 'lo' : ''}">${esc(r.b)}</b></div>`).join('')}</div>`);
    h += photo(d, 'b');
    const tape = (n, lead) => rows.length && lead ? `<b class="tape">BETTER IN ${n}</b>` : '';
    h += mv('title', `<div class="tt"><div class="tk">${esc(d.kicker)}</div><div class="th">${titleLines(d.title)}</div></div>`);
    h += mv('nameA', `<div class="tb t1">${crest(d.a, 96)}<div class="tx"><div class="tn">${esc(d.a.name)}</div><div class="tm2">${esc(d.a.team)}</div></div>${tape(wa, wa > wb)}</div>`);
    h += mv('nameB', `<div class="tb t2">${crest(d.b, 86)}<div class="tx"><div class="tn">${esc(d.b.name)}</div><div class="tm2">${esc(d.b.team)}</div></div>${tape(wb, wb > wa)}</div>`);
    h += mv('brand', `<div class="hd l">${brand(d)}</div>`);
    if (d.tag) h += mv('tag', `<div class="hd r"><div class="tag">${esc(d.tag)}</div></div>`);
    return h;
  }

  function fitText(root) {
    root.querySelectorAll('.tn, .ttl b, .th b, .ti span, .kick').forEach(el => {
      el.style.fontSize = '';
      const max = el.clientWidth;
      let f = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > max + 1 && f > 10) { f -= 2; el.style.fontSize = f + 'px'; }
    });
  }

  window.renderCmpVersus = function (el, d) {
    const L = d.layout, up = d.bgMode === 'image' && !!d.bgImage, P = palette(d);
    const rows = d.stats.filter(s => s.label || s.a || s.b).slice(0, 7).map(s => ({ ...s, w: winner(s) }));
    const wa = rows.filter(r => r.w === 'a').length, wb = rows.filter(r => r.w === 'b').length;
    const body = (L === 'torn' ? torn : clash)(d, P, up, rows, wa, wb);
    el.innerHTML = `<div class="vsl ${L}${up ? ' custom-bg' : ''}" style="--c1:${P.c1};--c2:${P.c2};--pop:${P.pop};--l1:${mix(P.c1, '#ffffff', .55)};--l2:${mix(P.c2, '#ffffff', .55)};--d1:${mix(P.c1, '#000000', .45)};--d2:${mix(P.c2, '#000000', .45)};--pa:${onPaper(P.c1)};--pb:${onPaper(P.c2)}" data-n="${rows.length}">${body}${mv('partners', partners(d))}</div>`;
    fitText(el.firstElementChild);
  };
})();
