/* Fixtures poster renderer: renderFixtures(el, state). A match schedule (2 to 8 matches: both teams with logo, name, player and an
   optional player cut-out, date, time and a small label), three layouts: clash (slanted rows, logo tile + player over a name plate,
   big VS in the middle; violet + amber), cal (match-day calendar: a tear-off date block and a light match card per row; coral + mint)
   and line (a glowing timeline down the left, each match a pill in the two team colours with round photo badges; gold + blue).
   Every block sits in a .mv wrapper so the admin can drag it and wheel-resize it; see fxMoveStyle. */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dk = (hx, k) => { const n = parseInt(hx.slice(1), 16), f = c => Math.round(c * k).toString(16).padStart(2, '0'); return '#' + f(n >> 16) + f(n >> 8 & 255) + f(n & 255); };
  const hue = hx => { const n = parseInt(hx.slice(1), 16), r = (n >> 16) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (!d) return { h: 0, s: 0, l: (mx + mn) / 2 }; const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: h * 60, s: d / (1 - Math.abs(mx + mn - 1)), l: (mx + mn) / 2 }; };
  const mix = (a, b, t) => {
    const p = x => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16)), A = p(a), B = p(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  };
  const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'], DAY = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  // "2026-10-28" -> { d: '28', m: 'OCT', w: 'WED' }; anything else is shown as typed
  const dateParts = s => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim());
    if (!m) return { d: esc(s), m: '', w: '', txt: esc(s) };
    const dt = new Date(+m[1], +m[2] - 1, +m[3]);
    return { d: String(+m[3]), m: MON[dt.getMonth()], w: DAY[dt.getDay()], txt: `${+m[3]} ${MON[dt.getMonth()]}` };
  };

  /* Colours. Default template = fixed colours per layout. "Team colours" gives each match its two team colours (plates, stripes,
     pills) and tints the background from match 1; plain black/white teams fall back to the layout accent, and a yellow/orange
     team in the background gets purple beside it. An upload keeps the template accents. */
  const TPL = {
    clash: { c1: '#8b4dff', c2: '#ffb627', c3: '#2fd5ff', bgA: '#2a1173', bgB: '#090322' },
    cal: { c1: '#ff5a4e', c2: '#3cf0c5', c3: '#ffd166', bgA: '#0d3b3a', bgB: '#031312' },
    line: { c1: '#ffc93c', c2: '#2f7bff', c3: '#ff4f9a', bgA: '#16224a', bgB: '#04060f' },
  };
  const plain = c => { const { s, l } = hue(c || '#888888'); return s < .2 || l < .1 || l > .93; };
  window.fxTeamColor = (st, t, side) => {
    const P = TPL[st.layout];
    if (st.bgMode !== 'jersey') return side ? P.c2 : P.c1;
    return plain(t.color) ? (side ? P.c2 : P.c1) : t.color;
  };
  function palette(st) {
    const T = { ...TPL[st.layout] };
    if (st.bgMode !== 'jersey') return T;
    const m = st.matches[0], a = fxTeamColor(st, m.a, 0), b = fxTeamColor(st, m.b, 1), { h } = hue(a), warm = !plain(m.a.color) && h > 25 && h < 70;
    return { ...T, bgA: warm ? '#2a0f55' : dk(a, .42), bgB: dk(b, .12), tintA: a, tintB: warm ? '#9b5cff' : b };
  }

  // admin's own drags/sizes of sections, kept apart for each layout
  window.fxMoveKey = st => st.layout;
  window.fxMoveStyle = (st, key) => {
    const o = ((st.moves || {})[fxMoveKey(st)] || {})[key] || {}, sc = o.s || 1;
    return `transform:translate(${o.x || 0}px,${o.y || 0}px)${sc !== 1 ? ` scale(${sc})` : ''};transform-origin:${o.ox || 540}px ${o.oy || 675}px`;
  };
  // a player cut-out inside its slot: centred, feet at the slot bottom, then the admin's nudge and size
  window.fxPhotoStyle = t => `left:calc(50% + ${t.dx || 0}px);bottom:${-(t.dy || 0)}px;height:${Math.round(100 * (t.zoom || 1))}%`;

  // match area per layout: first row top, bottom limit, tallest row, gap between rows
  const AREA = {
    clash: { top: 292, bot: 1112, max: 168, gap: 18 },
    cal: { top: 306, bot: 1128, max: 150, gap: 14 },
    line: { top: 280, bot: 1140, max: 150, gap: 18 },
  };

  function renderFixtures(root, st) {
    const L = st.layout, P = palette(st), ms = st.matches.slice(0, st.count), n = ms.length;
    const isUp = st.bgMode === 'image' && st.bgImage;
    const mv = (key, html) => `<div class="mv" data-move="${key}" style="${fxMoveStyle(st, key)}">${html}</div>`;
    const crest = (t, s, c) => t.logo ? `<img class="lg" src="${t.logo}" style="width:${s}px;height:${s}px" alt="">`
      : `<div class="mono" style="width:${s}px;height:${s}px;background:${c || t.color || '#555'};font-size:${Math.round(s * .32)}px">${esc((t.name || '').slice(0, 3).toUpperCase())}</div>`;
    const photo = (t, i, cls) => t.photo && st.showPhotos ? `<div class="ph ${cls || ''}"><img data-p="${i}" src="${t.photo}" style="${fxPhotoStyle(t)}" alt=""></div>` : '';
    const sp = `<div class="sp"><div class="k">${esc(st.partnersLabel).toUpperCase()}</div><div class="sprow">${st.partners.map(p =>
      `<div>${p.logo ? `<img src="${p.logo}" alt="">` : esc(p.name)}</div>`).join('')}</div><div class="w">${esc(st.site).toUpperCase()}</div></div>`;
    const bg = isUp ? `<div class="upbg" style="background-image:url('${st.bgImage}')"></div><div class="wash"></div>` : '';
    const A = AREA[L], rowH = Math.min(Math.round(A.max * 1.18), Math.floor((A.bot - A.top) / Math.max(n, 1)));
    const sz = (rowH / A.max).toFixed(3), y0 = A.top + Math.max(0, Math.round((A.bot - A.top - rowH * n) / 2));
    const evLine = `<div class="ev">${st.logo ? `<img src="${st.logo}" alt="">` : ''}${esc(st.event).toUpperCase()}</div>`;
    let h = '';

    if (L === 'clash') {
      h += bg || `<div class="wash" style="background:radial-gradient(110% 70% at 50% 18%, ${P.bgA}, ${P.bgB} 72%)"></div>
        <svg class="full"><defs><linearGradient id="fa" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${P.tintA || P.c1}" stop-opacity="0"/><stop offset=".5" stop-color="${P.tintA || P.c1}" stop-opacity=".55"/><stop offset="1" stop-color="${P.tintA || P.c1}" stop-opacity="0"/></linearGradient>
          <linearGradient id="fb" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${P.tintB || P.c2}" stop-opacity="0"/><stop offset=".5" stop-color="${P.tintB || P.c2}" stop-opacity=".45"/><stop offset="1" stop-color="${P.tintB || P.c2}" stop-opacity="0"/></linearGradient></defs>
          <polygon points="-40,240 1120,40 1120,58 -40,262" fill="url(#fa)" opacity=".7"/><polygon points="-40,1180 1120,960 1120,972 -40,1194" fill="url(#fb)" opacity=".8"/>
          <g fill="#ffffff" opacity=".035">${Array.from({ length: 12 }, (_, i) => `<polygon points="${i * 110 - 200},1350 ${i * 110 - 160},1350 ${i * 110 + 240},0 ${i * 110 + 200},0"/>`).join('')}</g></svg>`;
      h += mv('head', `<div class="hd">${evLine}<div class="ttl">${esc(st.title)}</div>${st.stage ? `<div class="stg"><span>${esc(st.stage)}</span></div>` : ''}</div>`);
      ms.forEach((m, k) => {
        const ca = fxTeamColor(st, m.a, 0), cb = fxTeamColor(st, m.b, 1), d = dateParts(m.date);
        const side = (t, i, c, r) => `<div class="side ${r ? 'r' : 'l'}" style="--k:${c}">
            <div class="tile">${crest(t, Math.round(104 * sz), c)}</div>
            ${photo(t, i)}
            <div class="plate"><div class="nm">${esc(t.name)}</div>${t.player && st.showPlayer ? `<div class="pn">${esc(t.player)}</div>` : ''}</div></div>`;
        h += mv('m' + k, `<div class="row" style="top:${y0 + k * rowH}px;height:${rowH - A.gap}px;--sz:${sz}">
          ${side(m.a, k * 2, ca, 0)}
          <div class="mid">${m.label ? `<div class="lb">${esc(m.label)}</div>` : ''}<div class="vs">VS</div><div class="when">${d.txt}${m.time ? ` · ${esc(m.time)}` : ''}</div></div>
          ${side(m.b, k * 2 + 1, cb, 1)}</div>`);
      });
      h += mv('info', `<div class="info">${st.format ? `<div class="fmt">${esc(st.format)}</div>` : ''}${st.start ? `<div class="st">${esc(st.start)}</div>` : ''}${st.live ? `<div class="lv"><b>LIVE</b>${esc(st.live)}</div>` : ''}</div>`);
    } else if (L === 'cal') {
      h += bg || `<div class="wash" style="background:linear-gradient(160deg, ${P.bgA}, ${P.bgB} 70%)"></div>
        <svg class="full"><circle cx="1010" cy="120" r="300" fill="none" stroke="${P.tintA || P.c1}" stroke-opacity=".22" stroke-width="2"/><circle cx="1010" cy="120" r="236" fill="none" stroke="${P.tintB || P.c2}" stroke-opacity=".16" stroke-width="2"/>
          <g fill="#ffffff" opacity=".05">${Array.from({ length: 14 }, (_, r) => Array.from({ length: 24 }, (_, c) => `<circle cx="${30 + c * 44}" cy="${1150 + r * 14}" r="2"/>`).join('')).slice(0, 6).join('')}</g>
          <rect x="0" y="0" width="14" height="1350" fill="${P.tintA || P.c1}"/><rect x="14" y="0" width="5" height="1350" fill="${P.tintB || P.c2}"/></svg>`;
      const tw = String(st.title || '').trim().split(/\s+/), t1 = tw.length > 1 ? tw.slice(0, -1).join(' ') : '', t2 = tw[tw.length - 1] || '';
      h += mv('head', `<div class="hd hv-${st.calHead || 'a'}">${(st.calHead || 'a') === 'a' ? `<div class="t1">${esc(t1)}</div><div class="ttl">${esc(t2)}</div>` : `<div class="ttl">${esc(st.title)}</div><div class="ul"></div>`}<div class="side">${evLine}${st.stage ? `<div class="stg">${esc(st.stage)}</div>` : ''}</div></div>`);
      ms.forEach((m, k) => {
        const ca = fxTeamColor(st, m.a, 0), cb = fxTeamColor(st, m.b, 1), d = dateParts(m.date);
        const team = (t, c, r) => `<div class="tm ${r ? 'r' : 'l'}" style="--k:${c}">${crest(t, Math.round(84 * sz), c)}<div class="nmb"><div class="nm">${esc(t.name)}</div>${t.player && st.showPlayer ? `<div class="pn">${esc(t.player)}</div>` : ''}</div></div>`;
        h += mv('m' + k, `<div class="row" style="top:${y0 + k * rowH}px;height:${rowH - A.gap}px;--sz:${sz};--ka:${ca};--kb:${cb}">
          <div class="date"><div class="mo">${d.m || '&nbsp;'}</div><div class="dd">${d.d}</div><div class="wd">${d.w}</div></div>
          <div class="card">${team(m.a, ca, 0)}<div class="ko">${m.label ? `<i>${esc(m.label)}</i>` : ''}<b>${esc(m.time || 'VS')}</b></div>${team(m.b, cb, 1)}</div></div>`);
      });
      h += mv('info', `<div class="info">${st.format ? `<span>${esc(st.format)}</span>` : ''}${st.start ? `<span class="st">${esc(st.start)}</span>` : ''}${st.live ? `<span><b>LIVE</b> ${esc(st.live)}</span>` : ''}</div>`);
    } else {
      h += bg || `<div class="wash" style="background:radial-gradient(90% 55% at 70% 0%, ${P.bgA}, ${P.bgB} 78%)"></div>
        <svg class="full"><defs><radialGradient id="gl"><stop offset="0" stop-color="${P.tintB || P.c2}" stop-opacity=".45"/><stop offset="1" stop-color="${P.tintB || P.c2}" stop-opacity="0"/></radialGradient>
          <radialGradient id="gl2"><stop offset="0" stop-color="${P.tintA || P.c1}" stop-opacity=".3"/><stop offset="1" stop-color="${P.tintA || P.c1}" stop-opacity="0"/></radialGradient></defs>
          <circle cx="980" cy="1080" r="420" fill="url(#gl)"/><circle cx="80" cy="200" r="360" fill="url(#gl2)"/>
          <g stroke="#ffffff" stroke-opacity=".05">${Array.from({ length: 9 }, (_, i) => `<path d="M-50 ${330 + i * 110} Q 540 ${250 + i * 110} 1130 ${330 + i * 110}" fill="none"/>`).join('')}</g></svg>`;
      h += mv('head', `<div class="hd">${evLine}<div class="ttl">${esc(st.title)}</div><div class="bar"></div>${st.stage ? `<div class="stg">${esc(st.stage)}</div>` : ''}</div>`);
      h += mv('axis', `<div class="axis" style="top:${y0 - 10}px;height:${rowH * n + 6}px"></div>`);
      ms.forEach((m, k) => {
        const ca = fxTeamColor(st, m.a, 0), cb = fxTeamColor(st, m.b, 1), d = dateParts(m.date);
        const end = (t, i, c, r) => `<div class="end ${r ? 'r' : 'l'}" style="--k:${c}"><div class="badge">${t.photo && st.showPhotos ? photo(t, i, 'rd') : crest(t, Math.round(70 * sz), c)}</div>
          <div class="nmb">${t.photo && st.showPhotos ? `<span class="mini">${crest(t, Math.round(40 * sz), c)}</span>` : ''}<div class="nm">${esc(t.name)}</div>${t.player && st.showPlayer ? `<div class="pn">${esc(t.player)}</div>` : ''}</div></div>`;
        h += mv('m' + k, `<div class="row" style="top:${y0 + k * rowH}px;height:${rowH - A.gap}px;--sz:${sz};--ka:${ca};--kb:${cb}">
          <div class="when"><b>${esc(m.time)}</b><span>${d.w ? d.w + ' · ' : ''}${d.txt}</span>${m.label ? `<i>${esc(m.label)}</i>` : ''}</div><div class="node"></div>
          <div class="pill">${end(m.a, k * 2, ca, 0)}<div class="vs">VS</div>${end(m.b, k * 2 + 1, cb, 1)}</div></div>`);
      });
      h += mv('info', `<div class="info">${st.format ? `<div>${esc(st.format)}</div>` : ''}${st.start ? `<div class="st">${esc(st.start)}</div>` : ''}${st.live ? `<div class="lv"><b>● LIVE</b> ${esc(st.live)}</div>` : ''}</div>`);
    }

    root.innerHTML = `<div class="fx ${L}${isUp ? ' up' : ''}" style="--c1:${P.c1};--c2:${P.c2};--c3:${P.c3}">${h}${mv('partners', sp)}</div>`;
    fitText(root.firstElementChild);
  }

  // long names and titles shrink until they fit their space
  function fitText(p) {
    p.querySelectorAll('.ttl, .nm, .when b').forEach(el => {
      el.style.fontSize = '';
      const max = el.clientWidth;
      let f = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > max + 1 && f > 10) { f -= 1; el.style.fontSize = f + 'px'; }
    });
  }

  window.renderFixtures = renderFixtures;
})();
