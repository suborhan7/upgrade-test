/* Best XI / Team of the Week poster renderer: renderXI(el, state). Eleven players placed by the chosen formation, two layouts:
   pitch (a tilted 3D pitch with round photo badges in each player's kit colour) and board (a flat tactics board with photo
   tiles and colour-coded positions). Every block sits in a .mv wrapper so the admin can drag it and wheel-resize it; see xiMoveStyle. */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dk = (hx, k) => { const n = parseInt(hx.slice(1), 16), f = c => Math.round(c * k).toString(16).padStart(2, '0'); return '#' + f(n >> 16) + f(n >> 8 & 255) + f(n & 255); };
  const hue = hx => { const n = parseInt(hx.slice(1), 16), r = (n >> 16) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (!d) return { h: 0, s: 0 }; const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: h * 60, s: d / (1 - Math.abs(mx + mn - 1)) }; };

  /* Formations: players in form order (1 = keeper, then defenders, midfielders, forwards, left to right).
     x runs 0..1 across the pitch, y from 0 (attack, top) to 1 (own goal, bottom). */
  const GK = [['GK', .5, .96]];
  const D3 = [['DF', .2, .66], ['DF', .5, .68], ['DF', .8, .66]];
  const D4 = [['DF', .09, .63], ['DF', .36, .67], ['DF', .64, .67], ['DF', .91, .63]];
  const D5 = [['DF', .06, .6], ['DF', .28, .67], ['DF', .5, .69], ['DF', .72, .67], ['DF', .94, .6]];
  const M3 = [['MF', .24, .38], ['MF', .5, .34], ['MF', .76, .38]];
  const M4 = [['MF', .09, .37], ['MF', .36, .4], ['MF', .64, .4], ['MF', .91, .37]];
  const M5 = [['MF', .06, .35], ['MF', .28, .41], ['MF', .5, .35], ['MF', .72, .41], ['MF', .94, .35]];
  const F1 = [['FW', .5, .02]];
  const F2 = [['FW', .33, .07], ['FW', .67, .07]];
  const F3 = [['FW', .15, .09], ['FW', .5, .04], ['FW', .85, .09]];
  const FORMATIONS = {
    '4-3-3': [...GK, ...D4, ...M3, ...F3],
    '4-4-2': [...GK, ...D4, ...M4, ...F2],
    '4-2-3-1': [...GK, ['DF', .09, .67], ['DF', .36, .71], ['DF', .64, .71], ['DF', .91, .67], ['MF', .33, .455], ['MF', .67, .455], ['MF', .15, .235], ['MF', .5, .215], ['MF', .85, .235], ['FW', .5, -.01]],
    '3-5-2': [...GK, ...D3, ...M5, ...F2],
    '3-4-3': [...GK, ...D3, ...M4, ...F3],
    '5-3-2': [...GK, ...D5, ...M3, ...F2],
  };
  window.XI_FORMATIONS = FORMATIONS;
  const POS_COL = { FW: '#ff3b5c', MF: '#14c38e', DF: '#2f7bff', GK: '#ffb800' };

  /* Colours. "Default template" uses fixed ones; "Jersey / logo colours" takes the star player's kit colour (yellow/orange
     kits get purple as the second colour, every other kit gets gold). An uploaded background keeps the template accents. */
  function palette(st) {
    const kit = (st.players[st.star] || st.players[0]).kit || '#6a3fd6', jersey = st.bgMode === 'jersey', { h, s } = hue(kit);
    const plain = s < .2, warm = !plain && h > 25 && h < 70;
    if (st.layout === 'pitch') {
      if (!jersey) return { c1: '#22e3ff', c1b: '#14b8d8', c2: '#ffb21e', bgA: '#04202c', bgB: '#071019', pA: '#0e3a3f', pB: '#0b3236' };
      // yellow/orange kits sit on purple, plain black/white kits on black with gold + purple
      if (warm) return { c1: mix(kit, '#ffffff', .2), c1b: kit, c2: '#c08bff', bgA: '#2a0f55', bgB: '#07031a', pA: '#2c1460', pB: '#25104f' };
      if (plain) return { c1: '#ffc83d', c1b: '#e8a417', c2: '#b17aff', bgA: '#1a1030', bgB: '#05040a', pA: '#1d1830', pB: '#181428' };
      return { c1: mix(kit, '#ffffff', .35), c1b: kit, c2: '#ffc83d', bgA: dk(kit, .32), bgB: '#05060d', pA: dk(kit, .42), pB: dk(kit, .36) };
    }
    if (!jersey) return { g1: '#2f6bff', g2: '#00c2ff', b1: '#1e9e5a', b2: '#16894d' };
    if (warm) return { g1: kit, g2: '#7a3cff', b1: '#2e1466', b2: '#28115a' };
    if (plain) return { g1: '#3a1d72', g2: '#c9962a', b1: '#17121f', b2: '#120e19' };
    return { g1: dk(kit, .85), g2: mix(kit, '#00c2ff', .45), b1: dk(kit, .5), b2: dk(kit, .43) };
  }
  function mix(a, b, t) {
    const p = x => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16)), A = p(a), B = p(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }

  // admin's own drags/sizes of sections, kept apart for each layout
  window.xiMoveKey = st => st.layout;
  window.xiMoveStyle = (st, key) => {
    const o = ((st.moves || {})[xiMoveKey(st)] || {})[key] || {}, sc = o.s || 1;
    return `transform:translate(${o.x || 0}px,${o.y || 0}px)${sc !== 1 ? ` scale(${sc})` : ''};transform-origin:${o.ox || 540}px ${o.oy || 675}px`;
  };

  /* A player's photo inside its badge/tile (w × h): scaled so the HEAD is the same size in every badge, whatever the crop
     of the photo (m = head measurement from maker.js), then the admin's own nudge (dx, dy) and size (zoom). */
  window.xiPhotoStyle = (p, w, h) => {
    const m = p.m;
    if (!m) return `left:${p.dx}px;top:${p.dy}px;width:${w * p.zoom}px;height:${h * p.zoom}px;object-fit:cover;object-position:50% 15%`;
    const s = w * .44 / m.head * p.zoom;
    return `left:${(w / 2 - m.hcx * s + p.dx).toFixed(1)}px;top:${(h * .12 - m.top * s + p.dy).toFixed(1)}px;width:${(m.w * s).toFixed(1)}px;height:${(m.h * s).toFixed(1)}px`;
  };

  // where each player sits on the poster (centre of the photo), and how big, for the current layout + formation
  const PITCH = { top: 290, bot: 1225, tw: 700, bw: 1060 };
  const pitchPt = (x, y) => { const w = PITCH.tw + (PITCH.bw - PITCH.tw) * y; return [540 + (x - .5) * w, PITCH.top + (PITCH.bot - PITCH.top) * y]; };
  window.xiSlots = st => {
    const F = FORMATIONS[st.formation] || FORMATIONS['4-3-3'];
    const rowN = (r, y) => F.filter(f => f[0] === r && Math.abs(f[2] - y) < .1).length;
    const lines = new Set(F.map(f => Math.round(f[2] * 10))).size;
    return F.map(([pos, x, y]) => {
      // a row of five, or a formation with five lines (4-2-3-1), gets slightly smaller badges so nothing overlaps
      const crowd = Math.min(rowN(pos, y) >= 5 ? .9 : 1, lines >= 5 ? .84 : 1);
      if (st.layout === 'pitch') { const [px, py] = pitchPt(x, y * .9 + .04), s = .84 + .26 * y; return { pos, x: px, y: py, d: Math.round(118 * s * crowd), ps: (.88 + .16 * y) * crowd, z: Math.round(y * 100) }; }
      return { pos, x: 52 + 70 + x * 836, y: 262 + 86 + y * 790, w: Math.round(118 * crowd), h: Math.round(132 * crowd), z: Math.round(y * 100) };
    });
  };

  function renderXI(root, st) {
    const L = st.layout, P = palette(st), slots = xiSlots(st);
    const isUp = st.bgMode === 'image' && st.bgImage;
    const mv = (key, html, z = '') => `<div class="mv" data-move="${key}" style="${xiMoveStyle(st, key)}"${z}>${html}</div>`;
    const crest = (p, s) => p.logo ? `<img class="lg" src="${p.logo}" style="width:${s}px;height:${s}px" alt="">`
      : `<div class="mono" style="width:${s}px;height:${s}px;background:${p.kit || '#555'};font-size:${Math.round(s * .3)}px">${esc((p.team || '').slice(0, 3).toUpperCase())}</div>`;
    const sp = `<div class="sp"><div class="k">${esc(st.partnersLabel).toUpperCase()}</div><div class="sprow">${st.partners.map(p =>
      `<div>${p.logo ? `<img src="${p.logo}" alt="">` : esc(p.name)}</div>`).join('')}</div><div class="w">${esc(st.site).toUpperCase()}</div></div>`;
    const ratings = st.players.map(p => parseFloat(p.rating)).filter(v => !isNaN(v));
    const avg = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '–';
    const star = st.players[st.star];
    const photo = (p, i, w, h) => p.photo ? `<div class="ph"><img data-p="${i}" src="${p.photo}" style="${xiPhotoStyle(p, w, h)}" alt=""></div>` : '<div class="ph"></div>';
    // players nearer the camera (lower on the poster) sit on top
    const order = slots.map((s, i) => i).sort((a, b) => slots[a].z - slots[b].z);
    let h = '';

    if (L === 'pitch') {
      const stripes = Array.from({ length: 10 }, (_, i) => { const a = pitchPt(0, i / 10), b = pitchPt(1, i / 10), c = pitchPt(1, (i + 1) / 10), d = pitchPt(0, (i + 1) / 10);
        return `<polygon points="${a} ${b} ${c} ${d}" fill="${isUp ? `rgba(8,24,34,${i % 2 ? .55 : .45})` : i % 2 ? P.pA : P.pB}"/>`; }).join('');
      const ln = pts => `<polyline points="${pts.map(p => pitchPt(...p)).join(' ')}" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="3"/>`;
      const circ = ln(Array.from({ length: 41 }, (_, i) => [.5 + Math.cos(i / 40 * Math.PI * 2) * .13, .5 + Math.sin(i / 40 * Math.PI * 2) * .085]));
      const lines = ln([[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]) + ln([[0, .5], [1, .5]]) + circ + ln([[.22, 0], [.22, .15], [.78, .15], [.78, 0]]) + ln([[.22, 1], [.22, .85], [.78, .85], [.78, 1]])
        + ln([[.38, 0], [.38, .055], [.62, .055], [.62, 0]]) + ln([[.38, 1], [.38, .945], [.62, .945], [.62, 1]]);
      const bg = isUp ? `<div class="upbg" style="background-image:url('${st.bgImage}')"></div><div class="wash" style="background:rgba(4,8,18,.42)"></div>`
        : `<svg class="full"><defs><radialGradient id="xg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="${P.bgA}"/><stop offset="1" stop-color="${P.bgB}"/></radialGradient>
          <linearGradient id="xfl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.c1}" stop-opacity=".22"/><stop offset="1" stop-color="${P.c1}" stop-opacity="0"/></linearGradient></defs>
          <rect width="1080" height="1350" fill="url(#xg)"/><polygon points="0,0 260,0 460,290 330,290" fill="url(#xfl)" opacity=".7"/><polygon points="1080,0 820,0 620,290 750,290" fill="url(#xfl)" opacity=".7"/></svg>`;
      const field = `<svg class="full"><polygon points="${pitchPt(-.06, -.02)} ${pitchPt(1.06, -.02)} ${pitchPt(1.06, 1.02)} ${pitchPt(-.06, 1.02)}" fill="rgba(0,0,0,.35)"/>${stripes}${lines}</svg>`;
      const words = esc(st.title).split(' '), last = words.pop();
      h += bg + mv('pitch', field)
        + mv('head', `<div><div class="eyebrow">${st.logo ? `<img src="${st.logo}" alt="">` : ''}${esc(st.event).toUpperCase()}</div>
          <div class="ttl">${words.join(' ')} <b>${last}</b></div>
          <div class="sub">${st.week ? `<span class="chip">${esc(st.week)}</span>` : ''}<span class="chip f">${esc(st.formation)}</span>${st.tag ? `<span class="chip">${esc(st.tag)}</span>` : ''}</div></div>`);
      order.forEach(i => {
        const p = st.players[i], s = slots[i], isStar = i === st.star;
        h += mv('pl' + i, `<div class="pl" style="left:${s.x.toFixed(1)}px;top:${s.y.toFixed(1)}px;--k:${p.kit || '#888'}">
          <div class="ring${isStar ? ' star' : ''}" style="width:${s.d}px;height:${s.d}px">${photo(p, i, s.d - 10, s.d - 10)}${p.rating ? `<div class="rt${isStar ? ' star' : ''}">${esc(p.rating)}</div>` : ''}</div>
          <div class="plate" style="transform:scale(${s.ps.toFixed(2)})">${crest(p, 30)}<div><div class="nm"><span class="pos">${s.pos}</span>${esc(p.name)}</div><div class="tm">${esc(p.team)}</div></div></div></div>`);
      });
      h += mv('avg', `<div class="avg"><b>${avg}</b><i>${esc(st.avgLabel)}</i></div>`);
    } else {
      const W = 976, H = 966;
      const page = isUp ? `<div class="upbg" style="background-image:url('${st.bgImage}')"></div><div class="wash" style="background:rgba(6,10,24,.25)"></div>`
        : `<div class="wash" style="background:linear-gradient(135deg,${P.g1},${P.g2})"></div><svg class="full" style="opacity:.14"><g stroke="#fff" stroke-width="2">${Array.from({ length: 30 }, (_, i) => `<line x1="${i * 70 - 400}" y1="0" x2="${i * 70}" y2="1350"/>`).join('')}</g></svg>`;
      const stripes = isUp ? `<rect width="${W}" height="${H}" fill="rgba(8,20,40,.55)"/>` : Array.from({ length: 8 }, (_, i) => `<rect x="0" y="${i * H / 8}" width="${W}" height="${H / 8}" fill="${i % 2 ? P.b1 : P.b2}"/>`).join('');
      const a = 'fill="none" stroke="rgba(255,255,255,.55)" stroke-width="3"';
      const bd = `<div class="bd"><svg width="${W}" height="${H}">${stripes}<rect x="20" y="20" width="${W - 40}" height="${H - 40}" rx="8" ${a}/><line x1="20" y1="${H / 2}" x2="${W - 20}" y2="${H / 2}" ${a}/>
        <circle cx="${W / 2}" cy="${H / 2}" r="82" ${a}/><rect x="${W / 2 - 210}" y="20" width="420" height="140" ${a}/><rect x="${W / 2 - 210}" y="${H - 160}" width="420" height="140" ${a}/>
        <rect x="${W / 2 - 95}" y="20" width="190" height="56" ${a}/><rect x="${W / 2 - 95}" y="${H - 76}" width="190" height="56" ${a}/></svg></div>`;
      h += page + mv('board', bd)
        + mv('head', `<div class="hd"><div class="brand">${st.logo ? `<img src="${st.logo}" alt="">` : 'eFCB'}</div>${st.event ? `<div class="tag">${esc(st.event)}</div>` : ''}</div>`)
        + mv('title', `<div class="ttl"><span>${esc(st.title)}</span><small>${[st.week, st.formation].filter(Boolean).map(esc).join(' · ').toUpperCase()}</small></div>`)
        + mv('stats', `<div class="side"><div class="stat"><b>${avg}</b><i>${esc(st.avgLabel)}</i></div>${star ? `<div class="stat"><b>${esc(star.rating)}</b><i>${esc(st.topLabel)}</i><i>${esc(star.name)}</i></div>` : ''}</div>`);
      order.forEach(i => {
        const p = st.players[i], s = slots[i], isStar = i === st.star;
        h += mv('pl' + i, `<div class="pl" style="left:${s.x.toFixed(1)}px;top:${s.y.toFixed(1)}px">
          <div class="tile${isStar ? ' star' : ''}" style="width:${s.w}px;height:${s.h}px">${photo(p, i, s.w - 8, s.h - 8)}</div>
          <div class="ps" style="background:${POS_COL[s.pos]}">${s.pos}</div>${p.rating ? `<div class="rt${isStar ? ' star' : ''}">${esc(p.rating)}</div>` : ''}
          <div class="card">${crest(p, 26)}<div><div class="nm">${esc(p.name)}</div><div class="tm">${esc(p.team)}</div></div></div></div>`);
      });
    }

    root.innerHTML = `<div class="xi ${L}${isUp ? ' up' : ''}" style="--c1:${P.c1 || ''};--c1b:${P.c1b || ''};--c2:${P.c2 || ''}">${h}${mv('partners', sp)}</div>`;
    fitText(root.firstElementChild);
  }

  // long names and titles shrink until they fit their space
  const FIT = { pitch: [['.ttl', 1000], ['.plate .nm', 150]], board: [['.ttl span', 600], ['.card .nm', 120]] };
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

  window.renderXI = renderXI;
})();
