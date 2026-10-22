/* Points Table poster renderer: renderTable(el, state). League standings (rank, logo, team, P W D L, GF GA GD, points, form),
   three layouts: spot (table on the left, the leader's player cut-out on the right, gold rows), neon (full-width skewed neon
   rows, magenta + cyan) and led (a stadium LED scoreboard with dot-matrix text). Every block sits in a .mv wrapper so the admin
   can drag it and wheel-resize it; see ptMoveStyle. */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dk = (hx, k) => { const n = parseInt(hx.slice(1), 16), f = c => Math.round(c * k).toString(16).padStart(2, '0'); return '#' + f(n >> 16) + f(n >> 8 & 255) + f(n & 255); };
  const hue = hx => { const n = parseInt(hx.slice(1), 16), r = (n >> 16) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (!d) return { h: 0, s: 0 }; const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: h * 60, s: d / (1 - Math.abs(mx + mn - 1)) }; };
  function mix(a, b, t) {
    const p = x => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16)), A = p(a), B = p(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  const num = v => { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; };

  /* The table: played, goal difference and points are worked out from W/D/L and goals (a filled "Pts" box overrides the points),
     then sorted by points, goal difference, goals scored and name when auto sort is on. */
  window.ptRows = st => {
    const rows = st.teams.slice(0, st.count).map((t, i) => {
      const w = num(t.w), d = num(t.d), l = num(t.l), gf = num(t.gf), ga = num(t.ga);
      const pts = String(t.pts).trim() !== '' ? num(t.pts) : w * 3 + d;
      return { t, i, p: w + d + l, w, d, l, gf, ga, gd: gf - ga, pts };
    });
    if (st.autoSort) rows.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || String(a.t.name).localeCompare(String(b.t.name)));
    const n = rows.length;
    rows.forEach((r, k) => { r.rank = k + 1; r.zone = k < st.upN ? 'up' : k >= n - st.downN ? 'dn' : ''; });
    return rows;
  };

  /* Colours. Default template = fixed colours per layout; "Team colours" takes the leader's colour (yellow/orange teams get purple
     as the second colour, plain black/white teams gold + purple, every other team gold); an upload keeps the template accents. */
  function palette(st, lead) {
    const kit = (lead && lead.t.color) || '#6cabdd', team = st.bgMode === 'jersey', { h, s } = hue(kit);
    const plain = s < .2, warm = !plain && h > 25 && h < 70;
    const T = {
      spot: { c1: '#ffc23d', c2: '#19e3c2', bgA: '#0d2a26', bgB: '#040c0b', up: '#19e3c2', dn: '#ff4d6a' },
      neon: { c1: '#ff2bd6', c2: '#22e6ff', bgA: '#2a0a52', bgB: '#07020f', up: '#22e6ff', dn: '#ff3d5e' },
      led: { c1: '#ffb000', c2: '#3dff7a', bgA: '#10203a', bgB: '#03050a', up: '#3dff7a', dn: '#ff3b30' },
    }[st.layout];
    if (!team) return T;
    const light = mix(kit, '#ffffff', .3);
    if (plain) return { ...T, c1: '#ffc83d', c2: '#b77bff', bgA: '#1c1430', bgB: '#05040a', up: '#b77bff' };
    if (warm) return { ...T, c1: light, c2: '#b06bff', bgA: '#2a0f55', bgB: '#07031a', up: '#b06bff' };
    if (st.layout === 'led') return { ...T, c1: light, c2: '#ffc83d', bgA: dk(kit, .3), bgB: '#03050a', up: '#ffc83d' };
    return { ...T, c1: light, c2: '#ffc83d', bgA: dk(kit, .38), bgB: '#04060c', up: '#ffc83d' };
  }

  // admin's own drags/sizes of sections, kept apart for each layout
  window.ptMoveKey = st => st.layout;
  window.ptMoveStyle = (st, key) => {
    const o = ((st.moves || {})[ptMoveKey(st)] || {})[key] || {}, sc = o.s || 1;
    return `transform:translate(${o.x || 0}px,${o.y || 0}px)${sc !== 1 ? ` scale(${sc})` : ''};transform-origin:${o.ox || 540}px ${o.oy || 675}px`;
  };
  // the Spotlight player cut-out: feet on the partners strip, centred at x 900, then the admin's nudge and size
  window.ptPhotoStyle = ph => `left:${900 + ph.dx}px;bottom:${95 - ph.dy}px;height:${Math.round(800 * ph.zoom)}px`;

  const COLS = st => ['p', 'w', 'd', 'l'].concat(st.cols[st.layout].goals ? ['gf', 'ga'] : []).concat(['gd', 'pts']);
  const HEAD = { p: 'P', w: 'W', d: 'D', l: 'L', gf: 'GF', ga: 'GA', gd: 'GD', pts: 'PTS' };
  const val = (r, c) => c === 'gd' ? (r.gd > 0 ? '+' + r.gd : r.gd) : r[c];

  function renderTable(root, st) {
    const L = st.layout, rows = ptRows(st), P = palette(st, rows[0]), cols = COLS(st), n = rows.length;
    const isUp = st.bgMode === 'image' && st.bgImage;
    const mv = (key, html) => `<div class="mv" data-move="${key}" style="${ptMoveStyle(st, key)}">${html}</div>`;
    const crest = (t, s) => t.logo ? `<img class="lg" src="${t.logo}" style="width:${s}px;height:${s}px" alt="">`
      : `<div class="mono" style="width:${s}px;height:${s}px;background:${t.color || '#555'};font-size:${Math.round(s * .34)}px">${esc((t.short || t.name || '').slice(0, 3).toUpperCase())}</div>`;
    const form = t => `<div class="fm">${String(t.form || '').toUpperCase().replace(/[^WDL]/g, '').slice(-5).split('').map(c => `<i class="${c}">${L === 'led' ? '' : c}</i>`).join('')}</div>`;
    const sp = `<div class="sp"><div class="k">${esc(st.partnersLabel).toUpperCase()}</div><div class="sprow">${st.partners.map(p =>
      `<div>${p.logo ? `<img src="${p.logo}" alt="">` : esc(p.name)}</div>`).join('')}</div><div class="w">${esc(st.site).toUpperCase()}</div></div>`;
    const legend = `<div class="lgd">${st.upN ? `<span><i style="background:${P.up}"></i>${esc(st.upLabel)}</span>` : ''}${st.downN ? `<span><i style="background:${P.dn}"></i>${esc(st.downLabel)}</span>` : ''}</div>`;
    const bg = isUp ? `<div class="upbg" style="background-image:url('${st.bgImage}')"></div><div class="wash"></div>` : '';
    const g = TABLE[L], top = g.top, rowH = Math.min(Math.round(g.max * 1.15), Math.floor((g.bot - top - g.head) / Math.max(n, 1)));
    const size = rowH / g.max;   // rows grow for a short table and shrink for a long one, and everything in a row scales with it
    const cells = r => cols.map(c => `<div class="c ${c}">${r ? val(r, c) : HEAD[c]}</div>`).join('');
    const row = (r, k) => mv('r' + k, `<div class="row ${r.zone}${r.rank <= 3 ? ' m' + r.rank : ''}" style="top:${top + g.head + k * rowH}px;height:${rowH - g.gap}px;--z:${r.zone === 'up' ? P.up : r.zone === 'dn' ? P.dn : 'transparent'};--k:${r.t.color || '#888'};--sz:${size.toFixed(3)}">
        <div class="rk">${L === 'led' ? String(r.rank).padStart(2, '0') : L === 'spot' ? '#' + r.rank : r.rank}</div>${crest(r.t, Math.round(g.logo * size))}
        <div class="nmb"><div class="nm">${esc(r.t.name)}</div>${r.t.player && st.showPlayer ? `<div class="pn">${esc(r.t.player)}</div>` : ''}</div>
        ${cells(r)}${st.cols[L].form ? form(r.t) : ''}</div>`);
    const th = mv('th', `<div class="row th" style="top:${top}px;height:${g.head}px;--sz:${size.toFixed(3)}"><div class="rk">${L === 'led' ? 'POS' : '#'}</div><div class="nmb">${esc(st.teamLabel)}</div>${cells(null)}${st.cols[L].form ? `<div class="fm">FORM</div>` : ''}</div>`);
    const tableHtml = th + rows.map(row).join('');
    const lead = rows[0];
    let h = '';

    if (L === 'spot') {
      const ph = st.spot;
      h += bg || `<div class="wash" style="background:radial-gradient(120% 80% at 80% 45%, ${P.bgA}, ${P.bgB} 70%)"></div>
        <svg class="full" style="opacity:.5"><defs><linearGradient id="ps" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P.c1}" stop-opacity=".0"/><stop offset="1" stop-color="${P.c1}" stop-opacity=".35"/></linearGradient></defs>
          <polygon points="760,0 1080,0 1080,1350 520,1350" fill="url(#ps)"/><polygon points="900,0 960,0 700,1350 640,1350" fill="${P.c2}" opacity=".25"/></svg>`;
      h += mv('big', `<div class="big">#1</div>`);
      if (ph.photo) h += `<div class="glow" style="background:radial-gradient(circle, ${lead ? (lead.t.color || P.c1) : P.c1}cc, transparent 65%)"></div><div class="phw"><img data-p="0" src="${ph.photo}" style="${ptPhotoStyle(ph)}" alt=""></div>`;
      h += mv('head', `<div class="hd"><div class="ev">${st.logo ? `<img src="${st.logo}" alt="">` : ''}${esc(st.event).toUpperCase()}</div><div class="ttl">${esc(st.title)}</div>${st.stage ? `<div class="stg">${esc(st.stage)}</div>` : ''}</div>`)
        + mv('legend', legend) + tableHtml;
      if (lead) h += mv('cap', `<div class="cap"><i>${esc(st.capLabel)}</i><b>${esc(ph.name || lead.t.player || lead.t.name)}</b><span>${crest(lead.t, 30)}${esc(lead.t.name)} · ${lead.pts} PTS</span></div>`);
    } else if (L === 'neon') {
      h += bg || `<div class="wash" style="background:radial-gradient(90% 60% at 50% 0%, ${P.bgA}, ${P.bgB} 75%)"></div>
        <svg class="full"><g stroke="${P.c2}" stroke-opacity=".08" stroke-width="1">${Array.from({ length: 28 }, (_, i) => `<line x1="${i * 40}" y1="0" x2="${i * 40}" y2="1350"/>`).join('')}${Array.from({ length: 34 }, (_, i) => `<line x1="0" y1="${i * 40}" x2="1080" y2="${i * 40}"/>`).join('')}</g>
          <polygon points="0,170 380,0 520,0 0,330" fill="${P.c1}" opacity=".16"/><polygon points="1080,980 1080,1180 640,1350 480,1350" fill="${P.c2}" opacity=".14"/></svg>`;
      h += mv('head', `<div class="hd"><div class="ev">${st.logo ? `<img src="${st.logo}" alt="">` : ''}${esc(st.event).toUpperCase()}</div><div class="ttl">${esc(st.title)}</div>${st.stage ? `<div class="stg">${esc(st.stage)}</div>` : ''}</div>`)
        + tableHtml + mv('legend', legend);
    } else {
      h += bg || `<div class="wash" style="background:linear-gradient(180deg, ${P.bgA}, ${P.bgB} 55%)"></div>
        <div class="flood" style="left:-120px"></div><div class="flood" style="right:-120px"></div>
        <svg class="full" style="opacity:.55">${Array.from({ length: 70 }, (_, i) => { const x = (i * 157) % 1080, y = 1060 + (i * 37) % 200; return `<circle cx="${x}" cy="${y}" r="${3 + i % 4}" fill="${i % 3 ? P.c1 : '#ffffff'}" opacity="${.12 + (i % 5) * .05}"/>`; }).join('')}</svg>`;
      h += mv('board', `<div class="panel" style="height:${Math.max(300, top + g.head + n * rowH - 268 + 20)}px"><b class="bolt" style="left:14px;top:14px"></b><b class="bolt" style="right:14px;top:14px"></b><b class="bolt" style="left:14px;bottom:14px"></b><b class="bolt" style="right:14px;bottom:14px"></b></div>`)
        + mv('head', `<div class="hd"><div class="ev">${st.logo ? `<img src="${st.logo}" alt="">` : ''}${esc(st.event).toUpperCase()}</div><div class="ttl">${esc(st.title)}</div>${st.stage ? `<div class="stg">${esc(st.stage)}</div>` : ''}</div>`)
        + tableHtml + mv('legend', legend);
    }

    root.innerHTML = `<div class="pt ${L}${isUp ? ' up' : ''}" style="--c1:${P.c1};--c2:${P.c2};--up:${P.up};--dn:${P.dn}">${h}${mv('partners', sp)}</div>`;
    fitText(root.firstElementChild);
  }

  // table area per layout: first row top, bottom limit, header height, tallest row, gap between rows, logo size
  const TABLE = {
    spot: { top: 300, bot: 1236, head: 34, max: 74, gap: 7, logo: 40 },
    neon: { top: 286, bot: 1188, head: 36, max: 72, gap: 8, logo: 40 },
    led: { top: 300, bot: 1196, head: 40, max: 70, gap: 4, logo: 38 },
  };

  // long names and titles shrink until they fit their space
  function fitText(p) {
    p.querySelectorAll('.ttl, .row:not(.th) .nm, .cap b').forEach(el => {
      el.style.fontSize = '';
      const max = el.parentElement.clientWidth || el.clientWidth;
      let f = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > max + 1 && f > 10) { f -= 1; el.style.fontSize = f + 'px'; }
    });
  }

  window.renderTable = renderTable;
})();
