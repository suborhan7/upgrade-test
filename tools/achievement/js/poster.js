/* Achievement poster renderer: renderAchievement(el, state). A team's trophy poster (Champions / Runners Up / 3rd Place or an
   own title) with the squad (one group photo, or up to 7 player cut-outs arranged on their own), a huge title layered with the
   players, name tags, an MVP badge and up to 3 highlights. Three layouts:
   gold  (Golden Glory: sunburst rays and corner brackets, a two-row squad, the medal-coloured title IN FRONT of the players
          with a script word across it, a trophy seal; gold + crimson),
   neon  (Neon Spotlight: stage spotlights and haze, a neon script word over a huge condensed title BEHIND the heads, one row
          of players, lightning bolts at the bottom corners; teal + magenta) and
   ink   (Ink Splash: light paper with brush splashes, the star big in front and the rest around him, a dark ink pool at the
          bottom with a slanted chrome title and a light streak; indigo + pink).
   The title colour follows the award in Golden Glory: gold for champions, silver for runners up, bronze for 3rd.
   Every block sits in a .mv wrapper so the admin can drag it and wheel-resize it; see acMoveStyle. */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rgb = hx => [1, 3, 5].map(i => parseInt(hx.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const rgba = (hx, a) => `rgba(${rgb(hx).join(',')},${a})`;
  const hsl = hx => { const [r, g, b] = rgb(hx).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (!d) return { h: 0, s: 0, l: (mx + mn) / 2 }; const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: h * 60, s: d / (1 - Math.abs(mx + mn - 1)), l: (mx + mn) / 2 }; };
  const fromHsl = (h, s, l) => { const f = n => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); }; return '#' + f(0) + f(8) + f(4); };
  const seeded = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  const AWARDS = { champ: 'Champions', runner: 'Runners Up', third: '3rd Place' };
  const RANK = { champ: '1ST', runner: '2ND', third: '3RD' };
  // medal colours: light, mid, dark
  const MEDAL = { champ: ['#fff3c4', '#f5b829', '#9a5f08'], runner: ['#ffffff', '#c9d1df', '#6d7789'], third: ['#ffd9b5', '#d6884a', '#7c3f16'] };

  /* Colours. Default template = fixed colours per layout. "Team colours": c1 = the team colour, c2 = its second colour or a
     vivid contrast; plain black/white and gold/yellow teams get gold + purple. Ink Splash keeps its light paper. */
  const TPL = {
    gold: { c1: '#ffb81e', c2: '#e3203f', bgA: '#5c0b16', bgB: '#0a0204' },
    neon: { c1: '#1ee8d6', c2: '#ff3df0', bgA: '#0b3a46', bgB: '#020609' },
    ink: { c1: '#4b2cff', c2: '#ff2f7a', bgA: '#f4f1ec', bgB: '#0b0826' },
  };
  const lum = hx => { const [r, g, b] = rgb(hx); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  const plain = c => { const { s, l } = hsl(c || '#888888'); return s < .2 || l < .1 || l > .93; };
  function palette(st) {
    const P = { ...TPL[st.layout] }, t = st.team;
    if (st.bgMode !== 'jersey') return P;
    let a = t.color, b = t.color2;
    if (plain(a) && b && !plain(b)) [a, b] = [b, ''];
    const gold = plain(a) || (hsl(a).h >= 25 && hsl(a).h <= 75);
    if (plain(a)) a = '#f5b829';
    if (gold) b = '#a070ff';
    else if (!b || plain(b) || Math.abs(hsl(a).h - hsl(b).h) < 25) {
      const { h } = hsl(a), warm = h < 70 || h > 320;
      b = warm ? fromHsl((h + 200) % 360, .9, .6) : fromHsl((h + 150) % 360, .95, .58);
    }
    const { h, s } = gold ? { h: 266, s: .7 } : hsl(a);
    if (st.layout === 'ink') return { ...P, c1: a, c2: b, bgB: fromHsl(h, .55, .07) };
    return { ...P, c1: a, c2: b, bgA: fromHsl(h, Math.min(.8, s), .2), bgB: fromHsl(h, .5, .03) };
  }

  // admin's own drags/sizes of sections, kept apart for each layout
  window.acMoveKey = st => st.layout;
  window.acMoveStyle = (st, key) => {
    const o = ((st.moves || {})[acMoveKey(st)] || {})[key] || {}, sc = o.s || 1;
    return `transform:translate(${o.x || 0}px,${o.y || 0}px)${sc !== 1 ? ` scale(${sc})` : ''};transform-origin:${o.ox || 540}px ${o.oy || 675}px`;
  };

  /* The squad. Each cut-out is scaled so every head comes out the same width (measured from the photo's alpha: m.head, m.top,
     m.cx). box: { x, w, y = top of the front heads, head = front head width, mode: rows | row | hero }.
     rows: front row low and big, the back row higher in the gaps, the star in the middle of the front.
     row:  one line, the star in the middle, the rest outwards in turns.
     hero: the star big in front, the others stepping up and out behind him (a pyramid). */
  const ROWS = { 1: [1, 0], 2: [2, 0], 3: [3, 0], 4: [2, 2], 5: [3, 2], 6: [4, 2], 7: [4, 3] };
  const FRONT = { 1: [.5], 2: [.3, .7], 3: [1 / 6, .5, 5 / 6], 4: [.125, .375, .625, .875] };
  const BACK = { 4: [.1, .9], 5: [1 / 3, 2 / 3], 6: [.25, .75], 7: [.25, .5, .75] };
  const ORDER = { 1: [0], 2: [0, 1], 3: [1, 0, 2], 4: [2, 0, 1, 3] };
  // hero spots for the others: [x share, head top in head widths above the star's, size, z]
  const HERO = {
    1: [[.76, .3, .92, 3]],
    2: [[.2, .3, .92, 3], [.8, .3, .92, 3]],
    3: [[.2, .3, .92, 3], [.8, .3, .92, 3], [.5, 1.4, .84, 1]],
    4: [[.18, .3, .92, 3], [.82, .3, .92, 3], [.35, 1.35, .84, 1], [.65, 1.35, .84, 1]],
    5: [[.17, .3, .92, 3], [.83, .3, .92, 3], [.32, 1.38, .84, 1], [.68, 1.38, .84, 1], [.5, 1.6, .8, 0]],
    6: [[.2, .3, .92, 3], [.8, .3, .92, 3], [.35, 1.38, .84, 1], [.65, 1.38, .84, 1], [.02, .1, .86, 2], [.98, .1, .86, 2]],
  };
  function squadOf(st, box) {
    const ps = st.players.map((p, i) => ({ p, i })).filter(o => o.p.photo).slice(0, 7), n = ps.length;
    if (!n) return [];
    const out = [];
    const place = (o, cx, headTop, hw, z) => {
      const p = o.p, m = p.m || { w: 1000, h: 1000, head: 260, top: 40, cx: 500 }, zz = p.zoom || 1;
      const s = hw * zz / m.head, W = m.w * s, H = m.h * s;
      const left = cx - m.cx * s + (p.dx || 0), top = headTop - (zz - 1) * hw * .5 - m.top * s + (p.dy || 0);
      const tag = { x: cx + (p.dx || 0), y: headTop + (p.dy || 0) + hw * zz * (z > 2 ? 1.75 : 2.25) };
      out.push({ i: o.i, z, tag, style: `left:${left.toFixed(1)}px;top:${top.toFixed(1)}px;width:${W.toFixed(1)}px;height:${H.toFixed(1)}px;z-index:${z + 1}` });
    };
    if (box.mode === 'row') {
      const mid = (n - 1) / 2, slots = [...Array(n).keys()].sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b);
      const hw = Math.min(box.head, box.w / n * .78);
      ps.forEach((o, k) => { const sl = slots[k], star = k === 0 && n > 2;
        place(o, box.x + box.w * (sl + .5) / n, box.y - (star ? hw * .12 : 0) + Math.abs(sl - mid) * hw * .08, hw * (star ? 1.12 : 1), star ? 4 : Math.abs(sl - mid) >= 2 ? 2 : 3); });
      return out;
    }
    if (box.mode === 'hero' && n > 1) {
      const hw = box.head, [star, ...rest] = ps;
      HERO[Math.min(6, rest.length)].forEach((sp, j) => rest[j] && place(rest[j], box.x + box.w * sp[0], box.y - hw * sp[1], hw * sp[2], sp[3]));
      if (rest[6]) place(rest[6], box.x + box.w * .5, box.y - hw * 2.2, hw * .76, 0);
      place(star, box.x + box.w / 2, box.y, hw * 1.2, 4);
      return out;
    }
    const [fN] = ROWS[n], front = ps.slice(0, fN), back = ps.slice(fN);
    ORDER[fN].forEach((k, slot) => {
      const star = k === 0 && fN > 2;
      place(front[k], box.x + box.w * FRONT[fN][slot], box.y - (star ? box.head * .12 : 0), box.head * (star ? 1.1 : 1), star ? 4 : 3);
    });
    back.forEach((o, j) => place(o, box.x + box.w * BACK[n][j], box.y - box.head * 1.18, box.head * .88, 1));
    return out;
  }
  const groupStyle = (g, box) => {
    const z = g.zoom || 1, w = box.w * 1.06 * z;
    return `left:calc(${box.x + box.w / 2}px - ${w / 2}px + ${g.dx || 0}px);bottom:${-(g.dy || 0)}px;width:${w}px`;
  };

  const svg = (defs, body, cls = '') => `<svg class="full ${cls}" viewBox="0 0 1080 1350"><defs>${defs}</defs>${body}</svg>`;
  const radial = (id, c, a) => `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity="${a}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
  const medalGrad = (id, M, x2 = 1, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${M[0]}"/><stop offset=".35" stop-color="${M[1]}"/><stop offset=".55" stop-color="${M[2]}"/><stop offset=".75" stop-color="${M[1]}"/><stop offset="1" stop-color="${M[0]}"/></linearGradient>`;

  // the trophy seal: a medal disc with a laurel and a cup, the place underneath
  function seal(M, rank) {
    const leaves = side => Array.from({ length: 7 }, (_, i) => {
      const deg = side < 0 ? 205 - i * 17 : -25 + i * 17, a = deg * Math.PI / 180, x = 80 + Math.cos(a) * 54, y = 82 - Math.sin(a) * 54;
      return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="9" ry="4" transform="rotate(${(-deg + 90 + (side < 0 ? 25 : -25)).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="url(#sm)"/>`;
    }).join('');
    return `<svg class="seal" viewBox="0 0 160 160"><defs>${medalGrad('sm', M)}${radial('sg', M[1], .6)}</defs>
      <circle cx="80" cy="80" r="80" fill="url(#sg)"/>
      <circle cx="80" cy="80" r="74" fill="url(#sm)"/><circle cx="80" cy="80" r="66" fill="#140806"/>
      <circle cx="80" cy="80" r="62" fill="none" stroke="url(#sm)" stroke-width="1.5" stroke-dasharray="3 4"/>
      ${leaves(-1)}${leaves(1)}
      <path d="M60 44 H100 V56 Q100 80 80 84 Q60 80 60 56 Z" fill="url(#sm)"/>
      <path d="M61 50 Q46 50 48 62 Q50 72 63 72 M99 50 Q114 50 112 62 Q110 72 97 72" fill="none" stroke="url(#sm)" stroke-width="4"/>
      <rect x="76" y="84" width="8" height="10" fill="url(#sm)"/><rect x="66" y="94" width="28" height="7" rx="2" fill="url(#sm)"/>
      <text x="80" y="124" text-anchor="middle" font-family="Kanit" font-style="italic" font-weight="900" font-size="21" fill="url(#sm)">${esc(rank)}</text></svg>`;
  }

  function renderAchievement(root, st) {
    const L = st.layout, P = palette(st), t = st.team, isUp = st.bgMode === 'image' && st.bgImage;
    const award = st.award === 'custom' ? (st.customTitle || '') : AWARDS[st.award] || AWARDS.champ;
    const M = MEDAL[st.award] || MEDAL.champ;
    const mv = (key, html) => `<div class="mv" data-move="${key}" style="${acMoveStyle(st, key)}">${html}</div>`;
    const crest = (s, c) => t.logo ? `<img class="lg" src="${t.logo}" style="width:${s}px;height:${s}px" alt="">`
      : `<div class="mono" style="width:${s}px;height:${s}px;background:${c};font-size:${Math.round(s * .3)}px">${esc((t.short || t.name || '').slice(0, 3).toUpperCase())}</div>`;
    const stats = st.stats.filter(s => String(s.value).trim() !== '' || String(s.label).trim() !== '');
    const names = st.players.filter(p => p.photo && p.name).map(p => esc(p.name));
    const tagged = st.nameTags && st.photoMode !== 'group';
    const showLine = st.showNames && names.length && !tagged;
    const mvpOn = st.photoMode !== 'group' && st.mvp >= 0 && st.players[st.mvp] && st.players[st.mvp].photo;
    const sp = `<div class="sp"><div class="k">${esc(st.partnersLabel).toUpperCase()}</div><div class="sprow">${st.partners.map(p =>
      `<div>${p.logo ? `<img src="${p.logo}" alt="">` : esc(p.name)}</div>`).join('')}</div><div class="w">${esc(st.site).toUpperCase()}</div></div>`;
    const efcb = st.logo ? `<img class="el" src="${st.logo}" alt="">` : '';
    const upbg = isUp ? `<div class="upbg" style="background-image:url('${st.bgImage}')"></div>` : '';

    let h = '', tags = '';
    const squad = (box, bottom) => {
      let inner = '';
      if (st.photoMode === 'group') {
        if (st.group.photo) inner = `<img data-p="9" class="gimg" src="${st.group.photo}" style="${groupStyle(st.group, box)}" alt="">`;
      } else {
        const sq = squadOf(st, box);
        inner = sq.map(o => `<img data-p="${o.i}" src="${st.players[o.i].photo}" style="${o.style}" alt="">`).join('');
        tags = sq.filter(o => (tagged && st.players[o.i].name) || (mvpOn && o.i === st.mvp)).map(o => {
          const p = st.players[o.i], mvp = mvpOn && o.i === st.mvp;
          return `<div class="ntag${o.z > 2 ? '' : ' bk'}" style="left:${o.tag.x.toFixed(0)}px;top:${Math.min(o.tag.y, bottom - 50).toFixed(0)}px">${mvp ? '<em>★ MVP</em>' : ''}${tagged && p.name ? `<b>${esc(p.name).toUpperCase()}</b>` : ''}</div>`;
        }).join('');
      }
      return `<div class="grp" style="height:${bottom}px">${inner}</div>`;
    };
    const tagLayer = () => tags ? mv('tags', `<div class="ntags">${tags}</div>`) : '';
    const confetti = (cs, n = 80, maxY = 1000) => {
      if (!st.confetti) return '';
      const R = seeded(41);
      return mv('confetti', `<svg class="full conf">${Array.from({ length: n }, () => {
        const x = R() * 1080, y = 110 + R() * (maxY - 110), w = 7 + R() * 14, hh = 4 + R() * 8, c = cs[Math.floor(R() * cs.length)], r = (R() * 360).toFixed(0);
        if (R() < .22) return `<path d="M${x.toFixed(0)} ${y.toFixed(0)} q${(10 + R() * 12).toFixed(0)} -14 ${(24 + R() * 18).toFixed(0)} 0 t${(24 + R() * 18).toFixed(0)} 0" stroke="${c}" stroke-width="${(3 + R() * 3).toFixed(1)}" fill="none" stroke-linecap="round" opacity=".92" transform="rotate(${r} ${x.toFixed(0)} ${y.toFixed(0)})"/>`;
        return `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(1)}" height="${hh.toFixed(1)}" fill="${c}" opacity="${(.65 + R() * .35).toFixed(2)}" transform="rotate(${r} ${x.toFixed(0)} ${y.toFixed(0)}) skewX(${(R() * 40 - 20).toFixed(0)})"/>`;
      }).join('')}</svg>`);
    };
    const statRow = () => stats.length ? mv('stats', `<div class="stats" style="--n:${stats.length}">${stats.map(s =>
      `<div class="st"><span>${esc(s.label).toUpperCase()}</span><b>${esc(s.value)}</b></div>`).join('')}</div>`) : '';
    const namesLine = sep => showLine ? mv('names', `<div class="names">${names.join(`<em>${sep}</em>`)}</div>`) : '';

    if (L === 'gold') {
      // Golden Glory: sunburst from behind the squad, corner brackets, title in front of the players
      const R = seeded(7), cx = 540, cy = 430;
      const rays = Array.from({ length: 28 }, (_, i) => {
        const a0 = (i / 28) * Math.PI * 2, a1 = a0 + Math.PI / 28 * .55, r = 1400;
        return `<polygon points="${cx},${cy} ${(cx + Math.cos(a0) * r).toFixed(0)},${(cy + Math.sin(a0) * r).toFixed(0)} ${(cx + Math.cos(a1) * r).toFixed(0)},${(cy + Math.sin(a1) * r).toFixed(0)}" fill="${i % 2 ? P.c1 : mix(P.c1, '#ffffff', .4)}" opacity="${i % 2 ? .16 : .1}"/>`;
      }).join('');
      const sparks = Array.from({ length: 40 }, () => { const x = R() * 1080, y = R() * 900, r = .8 + R() * 2.2;
        return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="${R() < .5 ? M[0] : P.c1}" opacity="${(.4 + R() * .6).toFixed(2)}"/>`; }).join('');
      const chev = side => Array.from({ length: 7 }, (_, i) => { const y = 220 + i * 70, x = side < 0 ? 0 : 1080, d = side < 0 ? 1 : -1;
        return `<path d="M${x} ${y} l${d * 46} 28 l${-d * 46} 28" fill="none" stroke="${P.c1}" stroke-width="5" opacity="${(.5 - i * .05).toFixed(2)}"/>`; }).join('');
      h += upbg || `<div class="wash" style="background:radial-gradient(70% 52% at 50% 32%, ${mix(P.bgA, P.c2, .45)}, ${P.bgA} 45%, ${P.bgB} 88%)"></div>`;
      h += svg(radial('gc', P.c1, .55) + radial('gw', '#ffffff', .5) + `<filter id="gbl"><feGaussianBlur stdDeviation="3"/></filter>
          <linearGradient id="gf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.bgB}" stop-opacity="0"/><stop offset="1" stop-color="${P.bgB}"/></linearGradient>`,
        `${isUp ? '' : `<g filter="url(#gbl)">${rays}</g><ellipse cx="${cx}" cy="${cy}" rx="520" ry="440" fill="url(#gc)"/><ellipse cx="${cx}" cy="${cy - 40}" rx="260" ry="220" fill="url(#gw)"/>${chev(-1)}${chev(1)}${sparks}`}
         <rect x="0" y="${isUp ? 560 : 700}" width="1080" height="${isUp ? 340 : 230}" fill="url(#gf)"/><rect x="0" y="${isUp ? 899 : 929}" width="1080" height="460" fill="${P.bgB}" opacity="${isUp ? .9 : 1}"/>
         <g fill="none" stroke="${M[1]}" stroke-width="5"><path d="M36 96 V36 H96"/><path d="M984 36 H1044 V96"/><path d="M36 1164 V1224 H96"/><path d="M984 1224 H1044 V1164"/></g>`);
      h += mv('head', `<div class="hd">${efcb}<span>${esc(st.event).toUpperCase()}</span></div>`);
      h += mv('seal', `<div class="sl">${seal(M, RANK[st.award] || '★')}</div>`);
      h += confetti([M[0], M[1], '#ffffff', P.c2], 70, 900);
      h += squad({ x: 110, w: 860, y: 330, head: 132 }, 930);
      h += `<div class="fadeb" style="top:760px;height:170px"></div>`;
      h += tagLayer();
      h += mv('title', `<div class="ttl"><b>${esc(award).toUpperCase()}</b></div>`);
      if (st.script) h += mv('script', `<div class="scr">${esc(st.script)}</div>`);
      h += mv('crest', `<div class="cst">${crest(62, P.c1)}<b>${esc(t.name).toUpperCase()}</b></div>`);
      if (st.season) h += mv('season', `<div class="ssn"><i></i><span>${esc(st.season).toUpperCase()}</span><i></i></div>`);
      h += statRow();
      h += namesLine('◆');
    } else if (L === 'neon') {
      // Neon Spotlight: three stage spotlights, haze, a neon script word over the huge title, the players in front of the title
      const beam = (x, ang, c, o) => `<g transform="rotate(${ang} ${x} -40)"><polygon points="${x - 26},-40 ${x + 26},-40 ${x + 260},1100 ${x - 260},1100" fill="url(#nb${c})" opacity="${o}"/></g>`;
      const bolt = (x, y, s, flip) => { const d = `M0 0 L60 -110 L40 -40 L110 -70 L20 90 L44 10 L-20 40 Z`;
        return `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})"><path d="${d}" fill="${P.c1}" filter="url(#nglow)" opacity=".9"/><path d="${d}" fill="${mix(P.c1, '#ffffff', .55)}"/></g>`; };
      const [hr, hg, hb] = rgb(P.c1).map(v => (v / 255).toFixed(3));
      h += upbg || `<div class="wash" style="background:radial-gradient(80% 50% at 50% 18%, ${P.bgA}, ${P.bgB} 80%)"></div>`;
      h += svg(`<linearGradient id="nb1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".25" stop-color="${P.c1}" stop-opacity=".35"/><stop offset="1" stop-color="${P.c1}" stop-opacity="0"/></linearGradient>
          <linearGradient id="nb2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset=".25" stop-color="${P.c2}" stop-opacity=".28"/><stop offset="1" stop-color="${P.c2}" stop-opacity="0"/></linearGradient>
          <filter id="nbl" x="-30%" y="-10%" width="160%" height="120%"><feGaussianBlur stdDeviation="16"/></filter>
          ${radial('nf', P.c1, .55)}
          <linearGradient id="nfd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.bgB}" stop-opacity="0"/><stop offset="1" stop-color="${P.bgB}"/></linearGradient>`,
        `${isUp ? '' : `<g filter="url(#nbl)">${beam(220, -14, 1, .9)}${beam(540, 0, 2, .75)}${beam(860, 14, 1, .9)}</g>
          <g fill="#fff">${[220, 540, 860].map(x => `<ellipse cx="${x}" cy="0" rx="44" ry="12" opacity=".95"/>`).join('')}</g>`}
          <ellipse cx="540" cy="980" rx="560" ry="110" fill="url(#nf)"/>
          <rect x="0" y="${isUp ? 600 : 800}" width="1080" height="${isUp ? 400 : 200}" fill="url(#nfd)"/><rect x="0" y="999" width="1080" height="360" fill="${P.bgB}" opacity="${isUp ? .92 : 1}"/>`);
      if (!isUp) h += `<svg class="haze" viewBox="0 0 1080 520"><filter id="haze" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".006 .014" numOctaves="4" seed="9"/>
            <feColorMatrix values="0 0 0 0 ${hr}  0 0 0 0 ${hg}  0 0 0 0 ${hb}  1.6 0 0 0 -.55"/></filter><rect width="1080" height="520" filter="url(#haze)"/></svg>`;
      h += mv('head', `<div class="hd">${efcb}<span>${esc(st.event).toUpperCase()}</span></div>`);
      h += mv('title', `<div class="ttl"><b>${esc(award).toUpperCase()}</b></div>`);
      if (st.script) h += mv('script', `<div class="scr">${esc(st.script)}</div>`);
      h += confetti([P.c1, P.c2, '#ffffff'], 60, 950);
      h += squad({ x: 70, w: 940, y: 440, head: 122, mode: 'row' }, 1000);
      h += `<div class="fadeb" style="top:790px;height:210px"></div>`;
      h += mv('bolts', svg(`<filter id="nglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>`,
        `${bolt(70, 1010, 1, false)}${bolt(150, 1090, .55, false)}${bolt(1010, 1010, 1, true)}${bolt(930, 1090, .55, true)}`, 'bolts'));
      h += tagLayer();
      h += mv('crest', `<div class="cst">${crest(60, P.c1)}<b>${esc(t.name).toUpperCase()}</b></div>`);
      if (st.season) h += mv('season', `<div class="ssn"><span>${esc(st.season).toUpperCase()}</span></div>`);
      h += statRow();
      h += namesLine('/');
    } else if (L === 'ink') {
      // Ink Splash: light paper, rough brush splashes behind the squad, a dark ink pool with a slanted chrome title
      const R = seeded(23), ink = mix(P.c1, '#06041a', .25);
      const blob = (cx, cy, r, k = 16, wob = .45) => {
        const pts = Array.from({ length: k }, (_, i) => { const a = i / k * Math.PI * 2, rr = r * (1 - wob / 2 + R() * wob); return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * .8]; });
        let d = ''; pts.forEach((p, i) => { const n = pts[(i + 1) % k]; d += (i ? '' : `M${((p[0] + n[0]) / 2).toFixed(0)} ${((p[1] + n[1]) / 2).toFixed(0)}`) + ` Q${n[0].toFixed(0)} ${n[1].toFixed(0)} ${((n[0] + pts[(i + 2) % k][0]) / 2).toFixed(0)} ${((n[1] + pts[(i + 2) % k][1]) / 2).toFixed(0)}`; });
        return d + 'Z';
      };
      const drops = (cx, cy, spread, c, n) => Array.from({ length: n }, () => { const a = R() * Math.PI * 2, d = spread * (.5 + R() * .7), r = 2 + R() * R() * 16;
        return `<circle cx="${(cx + Math.cos(a) * d).toFixed(0)}" cy="${(cy + Math.sin(a) * d * .8).toFixed(0)}" r="${r.toFixed(1)}" fill="${c}"/>`; }).join('');
      const dots = Array.from({ length: 14 }, (_, r) => Array.from({ length: 14 }, (_, c) => { const s = Math.max(0, 6 - (r + c) * .45);
        return s > .4 ? `<circle cx="${40 + c * 18}" cy="${150 + r * 18}" r="${s.toFixed(1)}"/>` : ''; }).join('')).join('');
      h += upbg || `<div class="wash" style="background:radial-gradient(90% 60% at 50% 30%, #ffffff, ${P.bgA} 60%, ${mix(P.bgA, P.c1, .12)})"></div>`;
      if (!isUp) h += svg(`<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .07 0"/></filter>`,
        `<rect width="1080" height="1350" filter="url(#grain)"/><g fill="${P.c1}" opacity=".25">${dots}</g>`);
      h += mv('splash', svg(`<filter id="rough" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="4"/><feDisplacementMap in="SourceGraphic" scale="38"/></filter>
          <filter id="dry" x="-5%" y="-30%" width="110%" height="160%"><feTurbulence type="fractalNoise" baseFrequency=".02 .4" numOctaves="2" seed="2"/><feDisplacementMap in="SourceGraphic" scale="26"/></filter>
          <linearGradient id="sw" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${P.c2}" stop-opacity="0"/><stop offset=".3" stop-color="${P.c2}"/><stop offset="1" stop-color="${mix(P.c2, P.c1, .5)}"/></linearGradient>`,
        `<g filter="url(#rough)" stroke-linecap="round" fill="none">
          <path d="M40 300 C 260 200, 520 260, 700 170" stroke="${P.c1}" stroke-width="210" opacity=".95"/>
          <path d="M420 330 C 640 260, 860 300, 1060 210" stroke="${mix(P.c1, P.c2, .4)}" stroke-width="170" opacity=".9"/>
          <path d="M120 470 C 380 420, 700 470, 980 400" stroke="${ink}" stroke-width="90" opacity=".8"/></g>
         <g filter="url(#dry)" stroke-linecap="round" fill="none" opacity=".55"><path d="M-20 140 C 300 80, 700 120, 1100 60" stroke="${P.c1}" stroke-width="40"/></g>
         <g>${drops(180, 300, 300, P.c1, 26)}${drops(900, 230, 280, P.c2, 22)}</g>
         <path d="M-40 640 C 220 520, 600 600, 1120 420 L1120 470 C 640 650, 260 600, -40 700 Z" fill="url(#sw)" filter="url(#dry)" opacity=".95"/>`, 'splash'));
      h += mv('head', `<div class="hd">${efcb}<span>${esc(st.event).toUpperCase()}</span></div>`);
      h += mv('crest', `<div class="cst">${crest(110, P.c1)}</div>`);
      h += squad({ x: 130, w: 820, y: 400, head: 128, mode: 'hero' }, 1010);
      h += `<div class="fadeb" style="top:620px;height:300px"></div>`;
      // the dark ink pool at the bottom (rough top edge), in front of the players' legs
      h += svg(`<filter id="pool" x="-5%" y="-20%" width="110%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="3" seed="11"/><feDisplacementMap in="SourceGraphic" scale="44"/></filter>
          <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(P.bgB, P.c1, .35)}"/><stop offset=".3" stop-color="${P.bgB}"/></linearGradient>`,
        `<path d="M-60 930 C 200 860, 420 960, 640 900 S 960 850, 1140 880 L1140 1400 L-60 1400 Z" fill="url(#pg)" filter="url(#pool)"/>
         <path d="M-60 930 C 200 860, 420 960, 640 900 S 960 850, 1140 880" fill="none" stroke="${P.c1}" stroke-width="10" opacity=".9" filter="url(#pool)"/>`, 'pool');
      h += tagLayer();
      h += confetti([P.c1, P.c2, '#ffffff', ink], 50, 900);
      if (st.script) h += mv('script', `<div class="scr"><span>${esc(st.script).toUpperCase()}</span></div>`);
      h += mv('title', `<div class="ttl"><b>${esc(award).toUpperCase()}</b><i></i></div>`);
      h += mv('season', `<div class="ssn"><b>${esc(t.name).toUpperCase()}</b>${st.season ? `<span>${esc(st.season).toUpperCase()}</span>` : ''}</div>`);
      h += statRow();
      h += namesLine('/');
    }

    root.innerHTML = `<div class="ac ${L}${isUp ? ' up' : ''}" style="--c1:${P.c1};--c2:${P.c2};--d1:${mix(P.c1, '#000000', .45)};--l1:${mix(P.c1, '#ffffff', .55)};--bgB:${P.bgB};--g1:${rgba(P.c1, .55)};--g2:${rgba(P.c2, .55)};--m0:${M[0]};--m1:${M[1]};--m2:${M[2]};--ink:${lum(P.c1) > .6 ? mix(P.c1, '#000000', .55) : P.c1}">${h}${mv('partners', sp)}</div>`;
    fitText(root.firstElementChild);
  }

  // long names and titles shrink until they fit their space
  function fitText(p) {
    p.querySelectorAll('.ttl b, .cst b, .names, .scr, .ssn span, .ssn b').forEach(el => {
      el.style.fontSize = '';
      const max = el.clientWidth;
      let f = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > max + 1 && f > 8) { f -= 2; el.style.fontSize = f + 'px'; }
    });
  }

  window.renderAchievement = renderAchievement;
})();
