/* Team Performance poster renderer: renderTeamPerf(el, state). A team's group photo (one picture, or up to 7 player cut-outs
   that are arranged into a squad: star in front, the rest beside and behind) with the team's result stats, three layouts:
   arena  (Arena Ribbon: shockwave light slashes, slanted result ribbon, a stats bar with huge italic numbers; crimson + amber),
   neon   (Neon Stage: holographic tunnel, the squad behind a glowing platform, the short name huge behind them, angled HUD
           tiles; violet + lime) and
   roster (Diagonal Roster: a team-colour band with speed stripes, one row of players, slanted title, skewed stat boxes;
           blue + pink).
   Every block sits in a .mv wrapper so the admin can drag it and wheel-resize it; see tpMoveStyle. */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rgb = hx => [1, 3, 5].map(i => parseInt(hx.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const rgba = (hx, a) => `rgba(${rgb(hx).join(',')},${a})`;
  const hsl = hx => { const [r, g, b] = rgb(hx).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (!d) return { h: 0, s: 0, l: (mx + mn) / 2 }; const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: h * 60, s: d / (1 - Math.abs(mx + mn - 1)), l: (mx + mn) / 2 }; };
  const fromHsl = (h, s, l) => { const f = n => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); }; return '#' + f(0) + f(8) + f(4); };

  /* Colours. Default template = fixed colours per layout. "Team colours": c1 = the team colour, c2 = its second colour or a
     vivid contrast; plain black/white teams get gold + purple. An upload keeps the template accents. */
  const TPL = {
    arena: { c1: '#ff2348', c2: '#ffb21e', bgA: '#4a0a16', bgB: '#080104' },
    neon: { c1: '#9b5cff', c2: '#c6ff3a', bgA: '#2a1366', bgB: '#05030d' },
    roster: { c1: '#1f6bff', c2: '#ff3d6e', bgA: '#0d1f5c', bgB: '#03061a' },
  };
  const lum = hx => { const [r, g, b] = rgb(hx); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  const plain = c => { const { s, l } = hsl(c || '#888888'); return s < .2 || l < .1 || l > .93; };
  function palette(st) {
    const P = { ...TPL[st.layout] }, t = st.team;
    if (st.bgMode !== 'jersey') return P;
    let a = t.color, b = t.color2;
    if (plain(a) && b && !plain(b)) [a, b] = [b, ''];
    const gold = plain(a) || (hsl(a).h >= 25 && hsl(a).h <= 75);   // plain black/white and yellow/orange/gold kits: gold + purple
    if (plain(a)) a = '#f5b829';
    if (gold) b = '#a070ff';
    else if (!b || plain(b) || Math.abs(hsl(a).h - hsl(b).h) < 25) {
      const { h } = hsl(a), warm = h < 70 || h > 320;
      b = warm ? fromHsl((h + 200) % 360, .9, .6) : fromHsl((h + 150) % 360, .95, .58);   // warm kits get a cool pop and the other way round
    }
    const { h, s } = gold ? { h: 266, s: .7 } : hsl(a);
    return { ...P, c1: a, c2: b, c3: P.c3 && (lum(a) > .55 ? a : '#ffd23a'), bgA: fromHsl(h, Math.min(.8, s), .2), bgB: fromHsl(h, .5, .03) };
  }

  // admin's own drags/sizes of sections, kept apart for each layout
  window.tpMoveKey = st => st.layout;
  window.tpMoveStyle = (st, key) => {
    const o = ((st.moves || {})[tpMoveKey(st)] || {})[key] || {}, sc = o.s || 1;
    return `transform:translate(${o.x || 0}px,${o.y || 0}px)${sc !== 1 ? ` scale(${sc})` : ''};transform-origin:${o.ox || 540}px ${o.oy || 675}px`;
  };

  /* The squad. Each cut-out is scaled so every head comes out the same width (measured from the photo's alpha: m.head, m.top,
     m.cx), front row low and big, the back row higher and a little smaller, the star (player 1) in the middle of the front row.
     box: { x, w, y = top of the front heads, head = front head width }. Returns <img> tags with absolute styles. */
  // rows per squad size and each spot's x as a share of the box width (back players stand in the gaps of the front row)
  const ROWS = { 1: [1, 0], 2: [2, 0], 3: [3, 0], 4: [2, 2], 5: [3, 2], 6: [4, 2], 7: [4, 3] };
  const FRONT = { 1: [.5], 2: [.3, .7], 3: [1 / 6, .5, 5 / 6], 4: [.125, .375, .625, .875] };
  const BACK = { 4: [.1, .9], 5: [1 / 3, 2 / 3], 6: [.25, .75], 7: [.25, .5, .75] };
  const ORDER = { 1: [0], 2: [0, 1], 3: [1, 0, 2], 4: [2, 0, 1, 3] };   // player 1 (the star) goes in the middle
  window.tpSquad = (st, box) => {
    const ps = st.players.map((p, i) => ({ p, i })).filter(o => o.p.photo).slice(0, 7), n = ps.length;
    if (!n) return [];
    const [fN] = ROWS[n], front = ps.slice(0, fN), back = ps.slice(fN);
    const out = [];
    const place = (o, cx, headTop, hw, z) => {
      const p = o.p, m = p.m || { w: 1000, h: 1000, head: 260, top: 40, cx: 500 }, zz = p.zoom || 1;
      const s = hw * zz / m.head, W = m.w * s, H = m.h * s;
      const left = cx - m.cx * s + (p.dx || 0), top = headTop - (zz - 1) * hw * .5 - m.top * s + (p.dy || 0);
      // name tag spot: on the chest for the front row, at shoulder height (in the gaps between front heads) for the back row
      const tag = { x: cx + (p.dx || 0), y: headTop + (p.dy || 0) + hw * zz * (z > 1 ? 2.3 : 1.75) };
      out.push({ i: o.i, z, tag, style: `left:${left.toFixed(1)}px;top:${top.toFixed(1)}px;width:${W.toFixed(1)}px;height:${H.toFixed(1)}px;z-index:${z}` });
    };
    if (box.row) {   // one line of players, the star in the middle, the rest outwards in turns
      const mid = (n - 1) / 2, slots = [...Array(n).keys()].sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b);
      const hw = Math.min(box.head, box.w / n * .8);
      ps.forEach((o, k) => { const sl = slots[k], star = k === 0 && n > 2;
        place(o, box.x + box.w * (sl + .5) / n, box.y - (star ? hw * .1 : 0), hw * (star ? 1.12 : 1), star ? 4 : Math.abs(sl - mid) >= 2 ? 2 : 3); });
      return out;
    }
    ORDER[fN].forEach((k, slot) => {
      const star = k === 0 && fN > 2;
      place(front[k], box.x + box.w * FRONT[fN][slot], box.y - (star ? box.head * .12 : 0), box.head * (star ? 1.1 : 1), star ? 4 : 3);
    });
    back.forEach((o, j) => place(o, box.x + box.w * BACK[n][j], box.y - box.head * 1.18, box.head * .88, 1));
    return out;
  };
  // one group picture instead of cut-outs: fills the box width, bottom on the box bottom
  const groupStyle = (g, box) => {
    const z = g.zoom || 1, w = box.w * 1.06 * z;
    return `left:calc(${box.x + box.w / 2}px - ${w / 2}px + ${g.dx || 0}px);bottom:${-(g.dy || 0)}px;width:${w}px`;
  };

  function renderTeamPerf(root, st) {
    const L = st.layout, P = palette(st), t = st.team, isUp = st.bgMode === 'image' && st.bgImage;
    const mv = (key, html) => `<div class="mv" data-move="${key}" style="${tpMoveStyle(st, key)}">${html}</div>`;
    const crest = (s, c) => t.logo ? `<img class="lg" src="${t.logo}" style="width:${s}px;height:${s}px" alt="">`
      : `<div class="mono" style="width:${s}px;height:${s}px;background:${c};font-size:${Math.round(s * .3)}px">${esc((t.short || t.name || '').slice(0, 3).toUpperCase())}</div>`;
    const stats = st.stats.filter(s => String(s.value).trim() !== '' || String(s.label).trim() !== '');
    const names = st.players.filter(p => p.photo && p.name).map(p => esc(p.name));
    const tagged = st.nameTags && st.photoMode !== 'group';   // a name tag under each player (else the names line)
    const showLine = st.showNames && names.length && !tagged;
    const sp = `<div class="sp"><div class="k">${esc(st.partnersLabel).toUpperCase()}</div><div class="sprow">${st.partners.map(p =>
      `<div>${p.logo ? `<img src="${p.logo}" alt="">` : esc(p.name)}</div>`).join('')}</div><div class="w">${esc(st.site).toUpperCase()}</div></div>`;
    const bg = isUp ? `<div class="upbg" style="background-image:url('${st.bgImage}')"></div><div class="wash"></div>` : tpArt(L, (st.styles || {})[L], P, st);
    const efcb = st.logo ? `<img class="el" src="${st.logo}" alt="">` : '';

    // the squad inside a clipping box that ends at `bottom`
    const squad = (box, bottom) => {
      let inner = '';
      if (st.photoMode === 'group') {
        if (st.group.photo) inner = `<img data-p="9" class="gimg" src="${st.group.photo}" style="${groupStyle(st.group, { ...box, y: 0 })}" alt="">`;
      } else {
        const sq = tpSquad(st, box);
        inner = sq.map(o => `<img data-p="${o.i}" src="${st.players[o.i].photo}" style="${o.style}" alt="">`).join('');
        if (tagged) tags = sq.filter(o => st.players[o.i].name).map(o =>
          `<div class="ntag${o.z > 1 ? '' : ' bk'}" style="left:${o.tag.x.toFixed(0)}px;top:${Math.min(o.tag.y, bottom - 40).toFixed(0)}px"><b>${esc(st.players[o.i].name).toUpperCase()}</b></div>`).join('');
      }
      return `<div class="grp" style="height:${bottom}px">${inner}</div>`;
    };
    let h = '', tags = '';
    const tagLayer = () => tags ? mv('tags', `<div class="ntags">${tags}</div>`) : '';
    const confetti = () => {
      if (!st.confetti) return '';
      let r = 77; const R = () => ((r = (r * 16807) % 2147483647) / 2147483647);
      const cs = [P.c2, '#ffd23a', '#ffffff', P.c1];
      return mv('confetti', `<svg class="full conf">${Array.from({ length: 90 }, () => { const x = R() * 1080, y = R() * 980, w = 6 + R() * 12, hh = 3 + R() * 7, c = cs[Math.floor(R() * 4)];
        return R() < .25 ? `<path d="M${x.toFixed(0)} ${y.toFixed(0)} q${(8 + R() * 10).toFixed(0)} -10 ${(20 + R() * 16).toFixed(0)} 0" stroke="${c}" stroke-width="3" fill="none" opacity=".9"/>`
          : `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(1)}" height="${hh.toFixed(1)}" fill="${c}" opacity="${(.6 + R() * .4).toFixed(2)}" transform="rotate(${(R() * 360).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})"/>`; }).join('')}</svg>`);
    };

    if (L === 'arena') {
      h += bg || `<div class="wash" style="background:radial-gradient(75% 55% at 50% 38%, ${P.bgA}, ${P.bgB} 80%)"></div>
        <svg class="full"><defs>
          <radialGradient id="ga"><stop offset="0" stop-color="${P.c1}" stop-opacity=".55"/><stop offset="1" stop-color="${P.c1}" stop-opacity="0"/></radialGradient>
          <radialGradient id="gb"><stop offset="0" stop-color="${P.c2}" stop-opacity=".28"/><stop offset="1" stop-color="${P.c2}" stop-opacity="0"/></radialGradient>
          <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.bgB}" stop-opacity="0"/><stop offset="1" stop-color="${P.bgB}"/></linearGradient></defs>
          <ellipse cx="540" cy="560" rx="560" ry="420" fill="url(#ga)"/><ellipse cx="930" cy="140" rx="420" ry="300" fill="url(#gb)"/>
          <g fill="none" stroke="${P.c1}">${Array.from({ length: 9 }, (_, i) => `<ellipse cx="540" cy="${720 + i * 6}" rx="${430 + i * 95}" ry="${170 + i * 52}" stroke-opacity="${(.34 - i * .03).toFixed(2)}" stroke-width="${i % 3 ? 1.5 : 3}" stroke-dasharray="${i % 3 ? '2 9' : 'none'}"/>`).join('')}</g>
          <g opacity=".05" stroke="#fff" stroke-width="2">${Array.from({ length: 22 }, (_, i) => `<line x1="${-300 + i * 80}" y1="0" x2="${-650 + i * 80}" y2="1350"/>`).join('')}</g>
          <rect x="0" y="700" width="1080" height="250" fill="url(#fade)"/><rect x="0" y="950" width="1080" height="400" fill="${P.bgB}"/></svg>`;
      h += mv('head', `<div class="hd">${efcb}<span>${esc(st.event).toUpperCase()}</span></div>`);
      if (st.tag) h += mv('tag', `<div class="tag">${esc(st.tag).toUpperCase()}</div>`);
      h += squad({ x: 70, w: 940, y: 340, head: 138 }, 905);
      h += `<div class="floor"></div>`;
      h += tagLayer();
      h += mv('team', `<div class="hero">${crest(84, P.c1)}<div class="tn">${esc(t.name)}</div></div>`);
      h += confetti();
      h += mv('ribbon', `<div class="rib"><i></i><b>${esc(st.title).toUpperCase()}</b><i></i></div>`);
      h += mv('stats', `<div class="stats" style="--n:${Math.max(1, stats.length)}">${stats.map(s =>
        `<div class="st"><span>${esc(s.label).toUpperCase()}</span><b>${esc(s.value)}</b></div>`).join('')}</div>`);
      if (showLine) h += mv('names', `<div class="names">${names.join('<em>◆</em>')}</div>`);
    } else if (L === 'neon') {
      const big = t.short || t.name || '';
      h += bg || `<div class="wash" style="background:radial-gradient(85% 60% at 50% 40%, ${P.bgA}, ${P.bgB} 78%)"></div>
        <svg class="full"><defs>
          <radialGradient id="ga"><stop offset="0" stop-color="${P.c1}" stop-opacity=".5"/><stop offset="1" stop-color="${P.c1}" stop-opacity="0"/></radialGradient>
          <linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.c1}" stop-opacity="0"/><stop offset="1" stop-color="${P.c1}" stop-opacity=".22"/></linearGradient></defs>
          <ellipse cx="540" cy="600" rx="520" ry="380" fill="url(#ga)"/>
          <g stroke="url(#gl)" stroke-width="1.5">${Array.from({ length: 17 }, (_, i) => `<line x1="540" y1="880" x2="${-1060 + i * 200}" y2="1350"/>`).join('')}
            ${Array.from({ length: 6 }, (_, i) => `<line x1="0" y1="${960 + i * i * 14 + i * 20}" x2="1080" y2="${960 + i * i * 14 + i * 20}"/>`).join('')}</g>
          <g fill="none" stroke="${P.c2}" stroke-width="3" opacity=".85"><path d="M34 90 V34 H90"/><path d="M990 34 H1046 V90"/><path d="M34 1160 V1216 H90"/><path d="M990 1216 H1046 V1160"/></g></svg>`;
      if (big) h += mv('big', `<div class="big">${esc(big)}</div>`);
      h += mv('head', `<div class="hd"><div class="ev">${efcb}<span>${esc(st.event).toUpperCase()}</span></div><div class="sub">${esc(st.title).toUpperCase()}</div></div>`);
      h += squad({ x: 150, w: 780, y: 462, head: 126 }, 1000);
      h += `<svg class="plat" viewBox="0 0 1080 200"><defs>
          <linearGradient id="pf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(P.bgA, '#000000', .2)}"/><stop offset="1" stop-color="${P.bgB}"/></linearGradient>
          <filter id="glow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="7"/></filter></defs>
          <path d="M70 60 A470 60 0 0 0 1010 60 V110 A470 60 0 0 1 70 110 Z" fill="url(#pf)"/>
          <ellipse cx="540" cy="60" rx="470" ry="60" fill="none" stroke="${P.c1}" stroke-width="6" filter="url(#glow)"/>
          <ellipse cx="540" cy="60" rx="470" ry="60" fill="${mix(P.bgB, P.c1, .22)}" fill-opacity=".9"/>
          <ellipse cx="540" cy="60" rx="470" ry="60" fill="none" stroke="${mix(P.c1, '#ffffff', .45)}" stroke-width="2.5"/>
          <ellipse cx="540" cy="62" rx="390" ry="42" fill="none" stroke="${P.c2}" stroke-width="1.5" stroke-dasharray="6 10" opacity=".8"/>
          <path d="M70 110 A470 60 0 0 0 1010 110" fill="none" stroke="${P.c1}" stroke-width="2" opacity=".6"/></svg>`;
      h += tagLayer();
      h += mv('crest', `<div class="cst">${crest(84, P.c1)}<b>${esc(t.name).toUpperCase()}</b></div>`);
      h += confetti();
      h += mv('stats', `<div class="stats" style="--n:${Math.max(1, stats.length)}">${stats.map(s =>
        `<div class="st"><span>${esc(s.label).toUpperCase()}</span><b>${esc(s.value)}</b></div>`).join('')}</div>`);
      if (showLine) h += mv('names', `<div class="names">${names.join('<em>/</em>')}</div>`);
    } else if (L === 'roster') {
      // Diagonal Roster: a team-colour band with speed stripes across the poster, one row of players in front of it, a slanted
      // title and skewed stat boxes (reference: official roster posters)
      const word = esc((t.short || t.name || '').toUpperCase());
      h += bg || `<div class="wash" style="background:linear-gradient(160deg, ${P.bgA}, ${P.bgB} 75%)"></div>`;
      h += mv('band', `<svg class="full band"><defs>
          <linearGradient id="rb" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${mix(P.c1, '#000000', .35)}"/><stop offset=".55" stop-color="${P.c1}"/><stop offset="1" stop-color="${mix(P.c1, '#ffffff', .25)}"/></linearGradient>
          <clipPath id="rc"><polygon points="-60,980 1140,300 1140,650 -60,1330"/></clipPath>
          <filter id="rs" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="22"/></filter></defs>
          <polygon points="-60,1000 1140,320 1140,670 -60,1350" fill="#000" opacity=".55" filter="url(#rs)"/>
          <polygon points="-60,980 1140,300 1140,650 -60,1330" fill="url(#rb)" opacity="${isUp ? .85 : 1}"/>
          <g clip-path="url(#rc)">
            <g transform="rotate(-29.5 540 815)" font-family="Kanit" font-style="italic" font-weight="900" font-size="150" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="2">
              ${[0, 1, 2].map(r => `<text x="${-700 + r * 260}" y="${690 + r * 150}">${Array(8).fill(word).join(' ')}</text>`).join('')}</g>
            <g transform="rotate(-29.5 540 815)">${Array.from({ length: 14 }, (_, i) => `<rect x="${-300 + (i * 197) % 1500}" y="${560 + (i * 53) % 480}" width="${160 + (i * 89) % 340}" height="${i % 3 ? 4 : 9}" fill="${i % 4 ? '#fff' : P.c2}" opacity="${i % 3 ? .35 : .8}"/>`).join('')}</g>
          </g>
          <polygon points="-60,960 1140,280 1140,292 -60,972" fill="${P.c2}"/><polygon points="-60,1346 1140,666 1140,676 -60,1356" fill="#fff" opacity=".8"/></svg>`);
      h += mv('head', `<div class="hd">${efcb}<span>${esc(st.event).toUpperCase()}</span></div>`);
      h += mv('title', `<div class="tt"><i>${esc(t.name)}</i><b>${esc(st.bigTitle).toUpperCase()}</b>${st.title ? `<span>${esc(st.title).toUpperCase()}</span>` : ''}</div>`);
      h += mv('crest', `<div class="cst">${crest(150, P.c1)}</div>`);
      h += squad({ x: 30, w: 1020, y: 390, head: 132, row: 1 }, 1010);
      h += tagLayer();
      h += confetti();
      h += mv('stats', `<div class="stats" style="--n:${Math.max(1, stats.length)}">${stats.map(s =>
        `<div class="st"><b>${esc(s.value)}</b><span>${esc(s.label).toUpperCase()}</span></div>`).join('')}</div>`);
      if (showLine) h += mv('names', `<div class="names">${names.join('<em>/</em>')}</div>`);
    }

    root.innerHTML = `<div class="tp ${L}${isUp ? ' up' : ''}" style="--c1:${P.c1};--c2:${P.c2};--c3:${P.c3 || P.c2};--d1:${mix(P.c1, '#000000', .45)};--ink:${lum(P.c1) > .55 ? mix(P.c2, '#000000', .15) : P.c1};--bgB:${P.bgB};--g1:${rgba(P.c1, .55)}">${h}${mv('partners', sp)}</div>`;
    fitText(root.firstElementChild);
  }

  // long names and titles shrink until they fit their space
  function fitText(p) {
    p.querySelectorAll('.ttl, .tn, .rib b, .names, .big, .tt b, .tt i').forEach(el => {
      el.style.fontSize = '';
      const max = el.clientWidth;
      let f = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > max + 1 && f > 8) { f -= 1; el.style.fontSize = f + 'px'; }
    });
  }

  window.renderTeamPerf = renderTeamPerf;
})();
