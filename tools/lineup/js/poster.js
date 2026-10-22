/* Lineup poster renderer: renderLineup(el, state). Both teams' starting players before a match (number, name, position, captain),
   subs, formation, the team's captain with a cut-out photo, three layouts:
   face (Face-Off: crests with a big X on top, the two lists mirrored on a centre spine, the captains at the edges; magenta + cyan),
   shirts (Shirt Wall: dressing-room wall, every player a shirt on a hanger with name and number; orange + blue + volt) and
   holo (Holo Panels: two glass panels with the captain rising out of each, neon number squares; violet + mint).
   Every block sits in a .mv wrapper so the admin can drag it and wheel-resize it; see luMoveStyle. */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rgb = hx => [1, 3, 5].map(i => parseInt(hx.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const hsl = hx => { const [r, g, b] = rgb(hx).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (!d) return { h: 0, s: 0, l: (mx + mn) / 2 }; const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: h * 60, s: d / (1 - Math.abs(mx + mn - 1)), l: (mx + mn) / 2 }; };
  const lum = hx => { const [r, g, b] = rgb(hx); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'], DAY = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  // "2026-10-28" -> "WED 28 OCT"; anything else is shown as typed
  const dateTxt = s => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim());
    if (!m) return esc(s);
    const dt = new Date(+m[1], +m[2] - 1, +m[3]);
    return `${DAY[dt.getDay()]} ${+m[3]} ${MON[dt.getMonth()]}`;
  };

  /* One player per line: "9 Lewandowski ST". A leading number is the shirt number, a known position code at the end is the
     position, and (C) or * anywhere marks the captain. */
  const POS = /^(GK|CB|LCB|RCB|LB|RB|LWB|RWB|DF|DEF|DM|CDM|CM|LCM|RCM|CAM|AM|LM|RM|MF|MID|LW|RW|LF|RF|CF|SS|ST|FW|FWD)$/i;
  window.luParse = txt => String(txt || '').split(/\n/).map(l => l.trim()).filter(Boolean).slice(0, 11).map(l => {
    let cap = false;
    l = l.replace(/\(c\)|\*/ig, () => { cap = true; return ''; }).replace(/\s+/g, ' ').trim();
    const w = l.split(' ');
    const no = /^\d{1,3}$/.test(w[0]) && w.length > 1 ? w.shift() : '';
    const pos = w.length > 1 && POS.test(w[w.length - 1]) ? w.pop().toUpperCase() : '';
    return { no, name: w.join(' '), pos, cap };
  });
  const subsOf = txt => String(txt || '').split(/[,\n]/).map(s => s.trim()).filter(Boolean);

  /* Colours. Default template = fixed colours per layout. "Team colours" uses each team's colour (plain black/white teams fall
     back to the layout accent) and tints the background from both; an upload keeps the template accents. */
  const TPL = {
    face: { c1: '#ff2d78', c2: '#25dcff', c3: '#ffd23f', bgA: '#17154a', bgB: '#03040c' },
    shirts: { c1: '#ff5b2e', c2: '#3a6dff', c3: '#d5ff3b', bgA: '#2a2f3a', bgB: '#0a0c10' },
    holo: { c1: '#a25bff', c2: '#16efab', c3: '#ffd84a', bgA: '#1d0f45', bgB: '#04030c' },
  };
  const plain = c => { const { s, l } = hsl(c || '#888888'); return s < .2 || l < .1 || l > .93; };
  const teamColor = (st, t, i) => {
    const P = TPL[st.layout], d = i ? P.c2 : P.c1;
    return st.bgMode === 'jersey' && !plain(t.color) ? t.color : d;
  };
  function palette(st) {
    const P = { ...TPL[st.layout] };
    if (st.bgMode !== 'jersey') return P;
    const a = teamColor(st, st.teams[0], 0), b = teamColor(st, st.teams[1], 1);
    return { ...P, c1: a, c2: b, bgA: mix(mix(a, b, .5), '#000000', .55), bgB: '#05060b' };
  }

  // admin's own drags/sizes of sections, kept apart for each layout
  window.luMoveKey = st => st.layout;
  window.luMoveStyle = (st, key) => {
    const o = ((st.moves || {})[luMoveKey(st)] || {})[key] || {}, sc = o.s || 1;
    return `transform:translate(${o.x || 0}px,${o.y || 0}px)${sc !== 1 ? ` scale(${sc})` : ''};transform-origin:${o.ox || 540}px ${o.oy || 675}px`;
  };
  // a cut-out inside its slot: centred, feet at the slot bottom, then the admin's nudge and size
  window.luPhotoStyle = t => `left:calc(50% + ${t.dx || 0}px);bottom:${-(t.dy || 0)}px;height:${Math.round(100 * (t.zoom || 1))}%`;

  function renderLineup(root, st) {
    const L = st.layout, P = palette(st), T = st.teams, isUp = st.bgMode === 'image' && st.bgImage;
    const K = [teamColor(st, T[0], 0), teamColor(st, T[1], 1)];
    const XI = T.map(t => luParse(t.xi)), SUBS = T.map(t => subsOf(t.subs));
    // captain's name: typed in the form, else the player marked (C)
    const CAP = T.map((t, i) => (t.gamer || '').trim() || ((XI[i].find(p => p.cap) || {}).name || ''));
    const n = Math.max(1, XI[0].length, XI[1].length);
    const mv = (key, html) => `<div class="mv" data-move="${key}" style="${luMoveStyle(st, key)}">${html}</div>`;
    const crest = (t, s, c) => t.logo ? `<img class="lg" src="${t.logo}" style="width:${s}px;height:${s}px" alt="">`
      : `<div class="mono" style="width:${s}px;height:${s}px;background:${c};font-size:${Math.round(s * .3)}px">${esc((t.short || t.name || '').slice(0, 3).toUpperCase())}</div>`;
    const photo = (i, cls) => T[i].photo && st.showPhotos ? `<div class="ph ${cls}"><img data-p="${i}" src="${T[i].photo}" style="${luPhotoStyle(T[i])}" alt=""></div>` : '';
    const cap = p => p.cap && st.showCap ? '<em class="cap">C</em>' : '';
    const when = [dateTxt(st.date), esc(st.time)].filter(Boolean).join(' · ');
    const sp = `<div class="sp"><div class="k">${esc(st.partnersLabel).toUpperCase()}</div><div class="sprow">${st.partners.map(p =>
      `<div>${p.logo ? `<img src="${p.logo}" alt="">` : esc(p.name)}</div>`).join('')}</div><div class="w">${esc(st.site).toUpperCase()}</div></div>`;
    const bg = isUp ? `<div class="upbg" style="background-image:url('${st.bgImage}')"></div><div class="wash"></div>` : '';
    const ev = `<div class="ev">${st.logo ? `<img src="${st.logo}" alt="">` : ''}<span>${esc(st.event).toUpperCase()}</span></div>`;
    const live = st.live ? `<div class="lv"><b>LIVE</b>${esc(st.live)}</div>` : '';
    let h = '';

    if (L === 'face') {
      h += bg || `<div class="wash" style="background:radial-gradient(80% 55% at 50% 30%, ${P.bgA}, ${P.bgB} 78%)"></div>
        <svg class="full"><defs>
          <radialGradient id="ga"><stop offset="0" stop-color="${K[0]}" stop-opacity=".55"/><stop offset="1" stop-color="${K[0]}" stop-opacity="0"/></radialGradient>
          <radialGradient id="gb"><stop offset="0" stop-color="${K[1]}" stop-opacity=".5"/><stop offset="1" stop-color="${K[1]}" stop-opacity="0"/></radialGradient></defs>
          <ellipse cx="120" cy="900" rx="430" ry="620" fill="url(#ga)"/><ellipse cx="960" cy="900" rx="430" ry="620" fill="url(#gb)"/>
          <g opacity=".07" stroke="#fff" stroke-width="2">${Array.from({ length: 15 }, (_, i) => `<line x1="540" y1="-80" x2="${-560 + i * 157}" y2="1350"/>`).join('')}</g></svg>`;
      h += mv('head', `<div class="hd">${ev}<div class="ttl">${esc(st.title)}</div><div class="pill">${st.stage ? `<b>${esc(st.stage)}</b>` : ''}${when ? `<span>${when}</span>` : ''}</div></div>`);
      const cr = i => `<div class="cr ${i ? 'r' : 'l'}" style="--k:${K[i]}">${crest(T[i], 124, K[i])}<div class="tn">${esc(T[i].name)}</div>${T[i].formation ? `<div class="fm">${esc(T[i].formation)}</div>` : ''}</div>`;
      h += mv('crests', `<div class="crests">${cr(0)}<div class="x">X</div>${cr(1)}</div>`);
      h += photo(0, 'pl') + photo(1, 'pr');
      const top = 486, area = 512, rh = Math.min(56, Math.floor(area / n)), y0 = top + Math.round((area - rh * n) / 2);
      h += mv('spine', `<div class="spine" style="top:${y0 - 6}px;height:${rh * n + 12}px"></div>`);
      XI.forEach((xi, i) => {
        h += mv('l' + i, `<div class="col ${i ? 'r' : 'l'}" style="top:${y0}px;--k:${K[i]};--rh:${rh}px">${xi.map(p =>
          `<div class="row">${st.showPos && p.pos ? `<i class="ps">${esc(p.pos)}</i>` : ''}<span class="nm">${esc(p.name).toUpperCase()}</span>${cap(p)}${st.showNum ? `<b class="no">${esc(p.no)}</b>` : ''}</div>`).join('')}</div>`);
        if (st.showSubs && SUBS[i].length) h += mv('s' + i, `<div class="subs ${i ? 'r' : 'l'}" style="--k:${K[i]}"><div class="k">SUBSTITUTES</div><div class="sl">${SUBS[i].map(esc).join(' · ')}</div></div>`);
        if (CAP[i]) h += mv('g' + i, `<div class="gp ${i ? 'r' : 'l'}" style="--k:${K[i]}"><span>${esc(st.gamerLabel).toUpperCase()}</span><b>${esc(CAP[i])}</b></div>`);
      });
      if (live) h += mv('info', `<div class="info">${live}</div>`);
    } else if (L === 'shirts') {
      h += bg || `<div class="wash" style="background:linear-gradient(180deg, ${P.bgA}, ${P.bgB} 85%)"></div>
        <div class="lockers"></div>
        <svg class="full"><defs>
          <radialGradient id="ga"><stop offset="0" stop-color="${K[0]}" stop-opacity=".42"/><stop offset="1" stop-color="${K[0]}" stop-opacity="0"/></radialGradient>
          <radialGradient id="gb"><stop offset="0" stop-color="${K[1]}" stop-opacity=".42"/><stop offset="1" stop-color="${K[1]}" stop-opacity="0"/></radialGradient></defs>
          <ellipse cx="160" cy="420" rx="520" ry="330" fill="url(#ga)"/><ellipse cx="920" cy="980" rx="520" ry="330" fill="url(#gb)"/></svg>`;
      h += mv('head', `<div class="hd">${ev}<div class="ttl">${esc(st.title)}</div>${live}</div>`);
      const shirt = (p, i) => {
        const gk = p.pos === 'GK', c = gk ? P.c3 : (st.bgMode === 'jersey' ? (T[i].color || K[i]) : K[i]);
        const ink = lum(c) > .62 ? '#12141a' : '#ffffff', trim = lum(c) > .62 ? K[i] : mix(c, '#ffffff', .6);
        return `<div class="sh" style="--c:${c};--d:${mix(c, '#000000', .38)};--ink:${ink};--trim:${gk ? '#12141a' : trim}">
          <svg class="hook" viewBox="0 0 60 26"><path d="M30 2 q6 0 6 5 q0 4 -6 6 v3 M4 25 L30 15 L56 25" fill="none" stroke="#c9ced8" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <div class="tee"><div class="col"></div>${st.showPos && p.pos ? `<i>${esc(p.pos)}</i>` : ''}<span class="nm">${esc(p.name).toUpperCase()}</span>${st.showNum ? `<b>${esc(p.no)}</b>` : ''}</div>
          ${p.cap && st.showCap ? '<em class="cap">C</em>' : ''}</div>`;
      };
      T.forEach((t, i) => {
        const y = i ? 754 : 216, xi = XI[i], half = xi.length > 6 ? Math.ceil(xi.length / 2) : xi.length;
        const rows = [xi.slice(0, half), xi.slice(half)].filter(r => r.length);
        h += photo(i, i ? 'pr' : 'pl');
        h += mv('t' + i, `<div class="blk ${i ? 'r' : 'l'}" style="top:${y}px;--k:${K[i]}">
          <div class="bh">${crest(t, 64, K[i])}<div class="tn">${esc(t.name)}</div>${t.formation ? `<div class="fm">${esc(t.formation)}</div>` : ''}</div>
          ${rows.map(r => `<div class="rack"><div class="rail"></div><div class="shs">${r.map(p => shirt(p, i)).join('')}</div></div>`).join('')}</div>`);
        if (st.showSubs && SUBS[i].length) h += mv('s' + i, `<div class="subs ${i ? 'r' : 'l'}" style="top:${y + 412}px;--k:${K[i]}"><b>SUBS</b><span>${SUBS[i].map(esc).join(' · ')}</span></div>`);
        if (CAP[i]) h += mv('g' + i, `<div class="gp ${i ? 'r' : 'l'}" style="top:${y + (i ? 360 : 330)}px;--k:${K[i]}"><span>${esc(st.gamerLabel).toUpperCase()}</span><b>${esc(CAP[i])}</b></div>`);
      });
      h += mv('band', `<div class="band"><div class="bl">${esc(st.stage)}</div><div class="vs">VS</div><div class="br">${when}</div></div>`);
    } else {
      h += bg || `<div class="wash" style="background:radial-gradient(90% 60% at 50% 22%, ${P.bgA}, ${P.bgB} 80%)"></div>
        <svg class="full"><defs>
          <radialGradient id="ga"><stop offset="0" stop-color="${K[0]}" stop-opacity=".5"/><stop offset="1" stop-color="${K[0]}" stop-opacity="0"/></radialGradient>
          <radialGradient id="gb"><stop offset="0" stop-color="${K[1]}" stop-opacity=".45"/><stop offset="1" stop-color="${K[1]}" stop-opacity="0"/></radialGradient></defs>
          <circle cx="285" cy="420" r="330" fill="url(#ga)"/><circle cx="795" cy="420" r="330" fill="url(#gb)"/>
          <g fill="none" stroke="#fff" stroke-opacity=".06">${Array.from({ length: 10 }, (_, i) => `<polygon points="${[0, 1, 2, 3, 4, 5].map(a => `${540 + (60 + i * 70) * Math.cos(Math.PI / 3 * a + Math.PI / 6)},${360 + (60 + i * 70) * Math.sin(Math.PI / 3 * a + Math.PI / 6)}`).join(' ')}"/>`).join('')}</g></svg>`;
      h += mv('head', `<div class="hd">${ev}<div class="ttl">${esc(st.title)}</div>${live}</div>`);
      h += photo(0, 'pl') + photo(1, 'pr');
      h += mv('vs', `<div class="vsb"><div class="hex">VS</div>${st.stage ? `<div class="stg">${esc(st.stage)}</div>` : ''}${when ? `<div class="wh">${when}</div>` : ''}</div>`);
      const top = 652, area = 470, rh = Math.min(50, Math.floor(area / n));
      T.forEach((t, i) => {
        h += mv('t' + i, `<div class="pan ${i ? 'r' : 'l'}" style="--k:${K[i]};--rh:${rh}px">
          <div class="ban">${crest(t, 62, K[i])}<div class="tb"><div class="tn">${esc(t.name)}</div><div class="mt">${t.formation ? `<b>${esc(t.formation)}</b>` : ''}${CAP[i] ? `<span>${esc(st.gamerLabel)}: ${esc(CAP[i])}</span>` : ''}</div></div></div>
          <div class="list" style="top:${top - 560}px">${XI[i].map(p => `<div class="row">${st.showNum ? `<b class="no">${esc(p.no)}</b>` : ''}<span class="nm">${esc(p.name).toUpperCase()}</span>${cap(p)}${st.showPos && p.pos ? `<i class="ps">${esc(p.pos)}</i>` : ''}</div>`).join('')}</div>
          ${st.showSubs && SUBS[i].length ? `<div class="subs"><div class="k">SUBS</div><div class="sl">${SUBS[i].map(esc).join(' · ')}</div></div>` : ''}</div>`);
      });
    }

    root.innerHTML = `<div class="lu ${L}${isUp ? ' up' : ''}" style="--c1:${P.c1};--c2:${P.c2};--c3:${P.c3};--k1:${K[0]};--k2:${K[1]}">${h}${mv('partners', sp)}</div>`;
    fitText(root.firstElementChild);
  }

  // long names and titles shrink until they fit their space
  function fitText(p) {
    p.querySelectorAll('.ttl, .nm, .tn').forEach(el => {
      el.style.fontSize = '';
      const max = el.clientWidth;
      let f = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > max + 1 && f > 8) { f -= 1; el.style.fontSize = f + 'px'; }
    });
  }

  window.renderLineup = renderLineup;
})();
