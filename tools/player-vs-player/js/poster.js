/* Player vs Player poster renderer: renderTvt(el, state). Seven layouts from shifty's VS references:
   bolt (lightning split), neon (neon frames), slash (slash plates), chrome (chrome bar), half (halftone slash),
   smoke (team-colour smoke over a pitch) and brush (neon panels, paint strokes, cyberpunk VS); those two are
   shared with the Team vs Team card. clash (Crest Clash) and torn (Torn Poster) come from the Match Result team mode:
   clash = team-colour halves split by a lightning seam, the players behind their crests on glowing rings, a chrome VS in a
   hex plate and the stage title in giant outline letters; torn = a torn paper strip across the poster with both names
   and VS stamped on it, player 1 above the tear and player 2 below it, halftone dots and a tape tag.
   st.arrange: 'side' (players side by side) or 'updown' (team 1 high on the left, team 2 low on the right; bolt, slash, half).
   Every text block sits in a .mv wrapper so the admin can drag it and wheel-resize it; see tvtMoveStyle. */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dk = (hx, k) => { const n = parseInt(hx.slice(1), 16), f = c => Math.round(c * k).toString(16).padStart(2, '0'); return '#' + f(n >> 16) + f(n >> 8 & 255) + f(n & 255); };
  // seeded random, so rays/particles stay put while the admin types
  const mix = (x, y, t) => { const p = h => [16, 8, 0].map(k => parseInt(h.slice(1), 16) >> k & 255), A = p(x), B = p(y);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  // two or three letters for a team without a logo: Team Nexus -> TN, PNG Esports -> PE, Nexus -> NEX
  const initials = t => { const w = String(t.short || t.team || '').trim().split(/\s+/).filter(Boolean);
    return (w.length > 1 ? w.slice(0, 3).map(x => x[0]).join('') : (w[0] || '').slice(0, 3)).toUpperCase(); };
  // kick-off time in 12-hour format: 21:00 -> 9:00 PM (text that is not a 24-hour time is left as typed)
  const to12 = t => String(t || '').replace(/^\s*([01]?\d|2[0-3])[:.]([0-5]\d)\s*$/, (_, h, m) => `${(+h % 12) || 12}:${m} ${+h < 12 ? 'AM' : 'PM'}`);
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  // fixed template colours per layout: [team 1, team 1 light, team 2, team 2 light]
  const TPL = {
    bolt: ['#ff8a1a', '#ffd21a', '#1f63db', '#3fc1f2'], neon: ['#2f6bff', '#8fb8ff', '#ff2d55', '#ff9db0'],
    slash: ['#1e9be0', '#7fd0ff', '#1e9be0', '#7fd0ff'], chrome: ['#1d4fd8', '#5d8bff', '#d91f3a', '#ff6b7f'],
    half: ['#1b3263', '#2c4c8f', '#c4101b', '#e8323d'],
    smoke: ['#1f6bff', '#7fb0ff', '#ff2d7a', '#ff8fb8'], brush: ['#e0213f', '#ff6b80', '#3fc3f0', '#a8e6ff'],
    clash: ['#ff2e63', '#ff8fab', '#19c7ff', '#9be6ff'], torn: ['#ff5a1f', '#ffa47a', '#2453ff', '#93a8ff'],
  };

  /* Where each player stands: x = body centre, top = head-top line, head = head width, floor = where the photo is cut
     (hidden behind the plate / bar / frame bottom). Photos are scaled by head size so every cut-out looks the same size. */
  const SLOTS = {
    bolt:   [{ x: 260, top: 470, head: 150, floor: 1012 }, { x: 820, top: 470, head: 150, floor: 1012 }],
    neon:   [{ x: 262, top: 505, head: 140, floor: 1026 }, { x: 818, top: 505, head: 140, floor: 1026 }],
    slash:  [{ x: 260, top: 405, head: 130, floor: 792 },  { x: 820, top: 555, head: 130, floor: 942 }],
    chrome: [{ x: 285, top: 480, head: 140, floor: 905 },  { x: 795, top: 480, head: 140, floor: 905 }],
    half:   [{ x: 260, top: 505, head: 140, floor: 1032 }, { x: 820, top: 505, head: 140, floor: 1032 }],
    smoke:  [{ x: 262, top: 420, head: 132, floor: 868 },  { x: 818, top: 420, head: 132, floor: 868 }],
    // clip = the neon panel the player stands in
    brush:  [{ x: 270, top: 430, head: 140, floor: 990, clip: 'inset(290px 600px 360px 60px)' },
             { x: 810, top: 430, head: 140, floor: 990, clip: 'inset(290px 60px 360px 600px)' }],
    // crest clash: players behind their crest rings, fading out at the bottom
    clash:  [{ x: 262, top: 290, head: 172, floor: 900, fade: 1 }, { x: 818, top: 290, head: 172, floor: 900, fade: 1 }],
    // torn poster: both players the same size; player 1 above the tear (clipped along the tear line, under the paper),
    // player 2 below it in front of the paper
    torn:   [{ x: 285, top: 95, head: 215, floor: 900, clip: 'polygon(0 0,1080px 0,1080px 520px,0 1000px)' },
             { x: 860, top: 650, head: 215, floor: 1255 }],
  };
  /* Upor-nich: player slots for the staggered arrangement (fade = the photo's cut line is open, so it fades out)
     and where the text sections move by default so names stay under their player. */
  const UPDOWN = {
    bolt:   { slots: [{ x: 215, top: 280, head: 150, floor: 740 }, { x: 820, top: 525, head: 150, floor: 1004 }], moves: { teamA: { x: -30, y: -272 }, teamB: { y: -8 } } },
    slash:  { slots: [{ x: 260, top: 330, head: 130, floor: 722 },  { x: 820, top: 590, head: 130, floor: 942 }],  moves: { teamA: { y: -70 } } },
    half:   { slots: [{ x: 250, top: 330, head: 132, floor: 770, fade: 1 }, { x: 830, top: 600, head: 132, floor: 1032 }], moves: { title: { y: -20 }, vs: { y: 20 }, teamA: { y: -262 } } },
  };
  // only these layouts have an upor-nich version (neon frames and the chrome bar look best side by side)
  const isUD = st => st.arrange === 'updown' && !!UPDOWN[st.layout];
  window.tvtSlots = st => isUD(st) ? UPDOWN[st.layout].slots : SLOTS[st.layout];
  // admin's own drags/sizes, kept apart for each layout and each arrangement
  window.tvtMoveKey = st => st.layout + (isUD(st) ? ':ud' : '');
  window.tvtMoveStyle = (st, key) => {
    const p = (isUD(st) && UPDOWN[st.layout].moves[key]) || {}, o = ((st.moves || {})[tvtMoveKey(st)] || {})[key] || {};
    const x = (p.x || 0) + (o.x || 0), y = (p.y || 0) + (o.y || 0), sc = o.s || 1;
    return `transform:translate(${x}px,${y}px)${sc !== 1 ? ` scale(${sc})` : ''};transform-origin:${o.ox || 540}px ${o.oy || 675}px`;
  };

  // photo placement in poster px; m = head measurement from maker.js (null = no measurement yet, fit the box instead)
  function place(t, slot) {
    const m = t.m;
    if (!m) return null;
    let s = slot.head / m.head * t.zoom;
    let left = slot.x - m.cx * s, top = slot.top - m.top * s;
    const bottom = top + m.h * s;
    if (bottom < slot.floor + 4 && t.zoom >= 1) top += slot.floor + 4 - bottom;   // short chest-up crop: push down so it never floats
    return { left: left + t.dx, top: top + t.dy, w: m.w * s, h: m.h * s };
  }
  window.tvtPhotoStyle = (t, slot) => {
    const p = place(t, slot);
    return p ? `left:${p.left.toFixed(1)}px;top:${p.top.toFixed(1)}px;width:${p.w.toFixed(1)}px;height:${p.h.toFixed(1)}px` : '';
  };

  function renderTvt(root, st) {
    const L = st.layout, [A, B] = st.teams, R = rng(7);
    const mv = (key, html) => `<div class="mv" data-move="${key}" style="${tvtMoveStyle(st, key)}">${html}</div>`;
    let a, a2, b, b2;
    if (st.bgMode === 'jersey') { a = A.c; a2 = A.c2; b = B.c; b2 = B.c2; } else [a, a2, b, b2] = TPL[L];
    const isUp = st.bgMode === 'image' && st.bgImage;
    const up = isUp ? `<div class="upbg" style="background-image:url('${st.bgImage}')"></div><div class="wash"></div>` : '';
    const sp = `<div class="sp"><div class="k">${esc(st.partnersLabel).toUpperCase()}</div><div class="row">${st.partners.map(p =>
      `<div>${p.logo ? `<img src="${p.logo}" alt="">` : esc(p.name)}</div>`).join('')}</div><div class="w">${esc(st.site).toUpperCase()}</div></div>`;
    const brand = `<div class="brand">${st.logo ? `<img src="${st.logo}" alt="">` : 'eFCB'}</div>`;
    const hdr = L === 'slash'
      ? mv('head', `<div class="hdr">${brand}<div class="ev"><b>${esc(st.title)}</b>${esc(st.event)}</div></div>`)
      : mv('head', `<div class="hdr">${brand}<div class="ev"><b>${esc(st.tag)}</b>${esc(st.date)}</div></div>`) + mv('title', `<div class="ttl"><b>${esc(st.title)}</b><span>${esc(st.event)}</span></div>`);
    const slots = tvtSlots(st);
    const ph = i => { const t = [A, B][i]; return t.photo
      ? `<div class="slot${slots[i].fade ? ' fade' : ''}" style="${slots[i].clip ? `height:1350px;clip-path:${slots[i].clip}` : `height:${slots[i].floor}px`}"><img data-p="${i}" src="${t.photo}" style="${tvtPhotoStyle(t, slots[i])}" alt=""></div>` : ''; };
    const phs = [A, B].map((t, i) => t.photo
      ? `<div class="slot${slots[i].fade ? ' fade' : ''}" style="${slots[i].clip ? `height:1350px;clip-path:${slots[i].clip}` : `height:${slots[i].floor}px`}"><img data-p="${i}" src="${t.photo}" style="${tvtPhotoStyle(t, slots[i])}" alt=""></div>` : '').join('');
    const date = esc(st.date), time = esc(to12(st.time)), extra = esc(st.extra);
    let h = '';

    if (L === 'bolt') {
      const bolt = [[700, -20], [575, 430], [665, 430], [490, 800], [580, 800], [400, 1220]], bp = bolt.map(p => p.join(',')).join(' ');
      const rays = (cx, cy, col) => `<g opacity=".55">${Array.from({ length: 90 }, (_, i) => {
        const t = i / 90 * Math.PI * 2 + R() * .03, r1 = 260 + R() * 120, r2 = 1400, w = .010 + R() * .012;
        return `<polygon points="${cx + Math.cos(t) * r1},${cy + Math.sin(t) * r1} ${cx + Math.cos(t + w) * r2},${cy + Math.sin(t + w) * r2} ${cx + Math.cos(t - w) * r2},${cy + Math.sin(t - w) * r2}" fill="${col}"/>`;
      }).join('')}</g>`;
      h = `${up || `<svg class="full" viewBox="0 0 1080 1350"><defs>
        <radialGradient id="tvgA" cx="28%" cy="42%" r="70%"><stop offset="0" stop-color="${a2}"/><stop offset=".55" stop-color="${a}"/><stop offset="1" stop-color="${dk(a, .6)}"/></radialGradient>
        <radialGradient id="tvgB" cx="76%" cy="42%" r="70%"><stop offset="0" stop-color="${b2}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${dk(b, .6)}"/></radialGradient>
        <clipPath id="tvcA"><polygon points="-10,-20 ${bp} -10,1220"/></clipPath><clipPath id="tvcB"><polygon points="1090,-20 ${bp} 1090,1220"/></clipPath></defs>
        <g clip-path="url(#tvcA)"><rect width="1080" height="1220" fill="url(#tvgA)"/>${rays(280, 520, dk(a, .55))}</g>
        <g clip-path="url(#tvcB)"><rect width="1080" height="1220" fill="url(#tvgB)"/>${rays(820, 520, dk(b, .55))}</g></svg><div class="dots"></div>`}
        <svg class="full" viewBox="0 0 1080 1350"><polyline points="${bp}" fill="none" stroke="#10142a" stroke-width="44"/><polyline points="${bp}" fill="none" stroke="#fff" stroke-width="24"/></svg>
        ${hdr}${phs}
        ${mv('vs', `<div class="vs"><div class="o"><span style="margin-top:-40px">V</span><span style="margin-top:70px;margin-left:-18px">S</span></div><span class="v">V</span><span class="s">S</span></div>`)}
        ${mv('teamA', `<div class="pl plA"><b>${esc(A.team)}</b><span>${esc(A.player)}</span></div>`)}${mv('teamB', `<div class="pl plB"><b>${esc(B.team)}</b><span>${esc(B.player)}</span></div>`)}
        ${mv('info', `<div class="info"><div><i>${[date, [time && `<em>${time}</em>`, extra].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}</i></div></div>`)}`;
    }
    if (L === 'neon') {
      // two rounded frames whose inner edges lean like a "/"
      const fA = 'M70 330 H470 Q500 330 497 358 L455 1000 Q452 1028 424 1028 H70 Q42 1028 42 1000 V358 Q42 330 70 330 Z';
      const fB = 'M656 330 H1010 Q1038 330 1038 358 V1000 Q1038 1028 1010 1028 H610 Q582 1028 585 1000 L625 358 Q628 330 656 330 Z';
      h = `${up}<svg class="full" viewBox="0 0 1080 1350"><path d="${fA}" fill="${a}" fill-opacity=".14"/><path class="glowA" d="${fA}" fill="none" stroke="${a2}" stroke-width="6"/>
        <path d="${fB}" fill="${b}" fill-opacity=".14"/><path class="glowB" d="${fB}" fill="none" stroke="${b2}" stroke-width="6"/></svg>
        ${hdr}${phs}
        ${mv('vs', `<div class="vs"><div class="v glowA" style="-webkit-text-stroke-color:${a2}">V</div>
          <svg style="position:absolute;left:96px;top:60px;filter:drop-shadow(0 0 4px #ffd27a) drop-shadow(0 0 16px #ff8a3c)" width="110" height="190" viewBox="0 0 110 190"><polygon points="70,4 18,104 52,104 34,186 96,72 60,72 84,4" fill="none" stroke="#ffe08a" stroke-width="5" stroke-linejoin="round"/></svg>
          <div class="s glowB" style="-webkit-text-stroke-color:${b2}">S</div></div>`)}
        ${mv('teamA', `<div class="nm nmA"><b>${esc(A.team)}</b><span>${esc(A.player)}</span></div>`)}${mv('teamB', `<div class="nm nmB"><b>${esc(B.team)}</b><span>${esc(B.player)}</span></div>`)}
        ${mv('info', `<div class="info">${date}${time ? `<b>${time}</b>` : ' · '}${extra}</div>`)}`;
    }
    if (L === 'slash') {
      const tint = st.bgMode === 'jersey' ? 18 : 0;
      h = `${up || `<div class="tint" style="background:radial-gradient(50% 40% at 15% 35%,color-mix(in srgb,${a} ${tint}%,transparent),transparent),radial-gradient(50% 40% at 85% 60%,color-mix(in srgb,${b} ${tint}%,transparent),transparent)"></div><div class="dotsL"></div><div class="dotsR"></div>`}
        <svg class="full" viewBox="0 0 1080 1350"><defs><filter id="tvsh"><feGaussianBlur stdDeviation="7"/></filter></defs>
          <polygon points="760,110 772,110 360,1090 348,1090" fill="rgba(0,0,0,.35)" filter="url(#tvsh)" transform="translate(-14,0)"/>
          <polygon points="764,110 768,110 354,1090 350,1090" fill="#9a9da6"/>
          <g stroke="rgba(0,0,0,.08)" stroke-width="2">${Array.from({ length: 14 }, () => { const x = 150 + R() * 800, y = 60 + R() * 1000; return `<line x1="${x}" y1="${y}" x2="${x + 30}" y2="${y - 80}"/>`; }).join('')}</g></svg>
        ${hdr}${phs}
        ${mv('teamA', `<div class="pl plA"><small>${esc(A.player)}</small><b>${esc(A.team)}</b></div>`)}
        ${mv('teamB', `<div class="pl plB"><small>${esc(B.player)}</small><b>${esc(B.team)}</b></div>`)}
        ${mv('vs', `<div class="vs"><span class="v">V</span><span class="s">S</span></div>`)}
        ${mv('info', `<div class="info">${time ? `<b>${time}</b>` : ''}${[date, extra].filter(Boolean).join(' · ')}</div>`)}`;
    }
    if (L === 'chrome') {
      const parts = (side, col) => Array.from({ length: 220 }, () => {
        const t = R(), x = side === 'L' ? -20 + t * 480 : 1100 - t * 480, y = 975 + (R() - .5) * (60 + t * 300) * (1 - t * .4), r = (R() - .5) * 60 + (side === 'L' ? -20 : 20);
        return `<rect x="${x}" y="${y}" width="${10 + R() * 16}" height="3.2" rx="1.6" fill="${col}" opacity="${(.35 + R() * .6) * (1 - t * .7)}" transform="rotate(${r} ${x} ${y})"/>`;
      }).join('');
      h = `${up || `<div class="stream stA"></div><div class="stream stB"></div>`}
        ${hdr}${phs}
        ${up ? '' : `<svg class="full" viewBox="0 0 1080 1350" style="filter:drop-shadow(0 0 5px ${a2})">${parts('L', a2)}</svg><svg class="full" viewBox="0 0 1080 1350" style="filter:drop-shadow(0 0 5px ${b2})">${parts('R', b2)}</svg>`}
        ${mv('bar', `<div class="lip"></div><div class="bar"></div>
        <div class="tn tnA">${esc(A.team)}</div><div class="tn tnB">${esc(B.team)}</div>
        <div class="pn pnA">${esc(A.player)}</div><div class="pn pnB">${esc(B.player)}</div>
        <div class="shield"></div><div class="shield2"></div><div class="vs"><span class="v">V</span><span class="s">S</span></div>`)}
        ${mv('info', `<div class="info">${date}${time ? `<b>${time}</b>` : ' · '}${extra}</div>`)}`;
    }
    if (L === 'half') {
      h = `${up || `<svg class="full" viewBox="0 0 1080 1350"><defs>
        <pattern id="tvdR" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="6" fill="${b}"/></pattern>
        <pattern id="tvdB" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="6" fill="${a}"/></pattern>
        <linearGradient id="tvf1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <linearGradient id="tvf2" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <mask id="tvmA"><rect width="1080" height="1200" fill="url(#tvf1)"/></mask><mask id="tvmB"><rect width="1080" height="1200" fill="url(#tvf2)"/></mask>
        <clipPath id="tvhA"><polygon points="0,0 720,0 380,1200 0,1200"/></clipPath><clipPath id="tvhB"><polygon points="720,0 1080,0 1080,1200 380,1200"/></clipPath></defs>
        <g clip-path="url(#tvhA)"><rect width="1080" height="1200" fill="${a}"/><rect width="1080" height="1200" fill="url(#tvdR)" mask="url(#tvmA)" opacity=".85"/></g>
        <g clip-path="url(#tvhB)"><rect width="1080" height="1200" fill="${b}"/><rect width="1080" height="1200" fill="url(#tvdB)" mask="url(#tvmB)" opacity=".85"/></g>
        <polygon points="716,0 726,0 600,440" fill="#fff"/><polygon points="760,-10 772,-10 640,330" fill="#fff" opacity=".8"/>
        <polygon points="520,720 528,720 410,1060" fill="#fff"/><polygon points="470,800 478,800 380,1080" fill="#fff" opacity=".7"/></svg>`}
        ${hdr}${phs}
        ${mv('vs', `<div class="vs" style="--sh:${st.bgMode === 'jersey' ? '#10142a' : '#0d1838'}"><b>VS</b></div>`)}
        ${mv('teamA', `<div class="tn tnA"><b>${esc(A.team)}</b><span>${esc(A.player)}</span></div>`)}${mv('teamB', `<div class="tn tnB"><b>${esc(B.team)}</b><span>${esc(B.player)}</span></div>`)}
        ${mv('info', `<div class="info">${date}${time ? `<b>${time}</b>` : ' · '}${extra}</div>`)}`;
    }

    if (L === 'smoke') {
      const clouds = (side, c1, c2) => Array.from({ length: 14 }, () => {
        const x = side === 'L' ? -60 + R() * 470 : 1140 - R() * 470, y = 380 + R() * 620, rx = 120 + R() * 170, ry = 90 + R() * 140;
        return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${R() > .5 ? c1 : c2}" opacity="${.45 + R() * .45}"/>`;
      }).join('');
      const sparks = Array.from({ length: 26 }, () => `<circle cx="${470 + R() * 140}" cy="${360 + R() * 260}" r="${1 + R() * 2.5}" opacity="${.4 + R() * .6}"/>`).join('');
      h = `${up || `<svg class="full" viewBox="0 0 1080 1350"><defs>
          <linearGradient id="pvsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b2a2e"/><stop offset=".55" stop-color="#0a1416"/><stop offset="1" stop-color="#050809"/></linearGradient>
          <filter id="pvsm" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".011" numOctaves="5" seed="9" result="n"/>
            <feDisplacementMap in="SourceGraphic" in2="n" scale="190" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="16"/></filter></defs>
          <rect width="1080" height="1200" fill="url(#pvsky)"/>
          <g filter="url(#pvsm)">${clouds('L', a, a2)}</g><g filter="url(#pvsm)">${clouds('R', b, b2)}</g></svg>`}
        <svg class="full" viewBox="0 0 1080 1350"><defs>
          <linearGradient id="pvgr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#173d1e"/><stop offset="1" stop-color="#0b2410"/></linearGradient>
          <radialGradient id="pvgc" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ff9a2e" stop-opacity=".55"/><stop offset="1" stop-color="#ff5a00" stop-opacity="0"/></radialGradient>
          <filter id="pvb6"><feGaussianBlur stdDeviation="3"/></filter></defs>
          ${up ? '' : `<path d="M0 960 L1080 960 L1080 1200 L0 1200 Z" fill="url(#pvgr)"/>
          <g opacity=".5">${Array.from({ length: 9 }, (_, i) => i % 2 ? `<path d="M${-200 + i * 185} 1200 L${380 + i * 40} 960" stroke="#1f5226" stroke-width="40" opacity=".5"/>` : '').join('')}</g>
          <path d="M0 990 L1080 990" stroke="#e8f2e8" stroke-width="4" opacity=".75"/><path d="M528 1200 L536 960 L544 960 L552 1200 Z" fill="#e8f2e8" opacity=".8"/>`}
          <ellipse cx="540" cy="640" rx="260" ry="200" fill="url(#pvgc)"/><g fill="#ffcf5a">${sparks}</g>
          <ellipse cx="540" cy="1048" rx="70" ry="12" fill="#000" opacity=".6" filter="url(#pvb6)"/>
          <g transform="translate(540 990)"><circle r="56" fill="#f4f4f4"/><polygon points="0,-20 19,-6 12,16 -12,16 -19,-6" fill="#1b1b1b"/>
            ${[0, 72, 144, 216, 288].map(r => `<g transform="rotate(${r})"><path d="M0 -20 L0 -40" stroke="#1b1b1b" stroke-width="3"/><path d="M-14 -52 L0 -40 L14 -52 L9 -56 L-9 -56 Z" fill="#1b1b1b"/></g>`).join('')}
            <circle r="56" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="5"/><circle cx="-18" cy="-20" r="26" fill="#fff" opacity=".35"/></g></svg>
        ${hdr}${phs}
        ${mv('vs', `<div class="vs"><b>VS</b></div>`)}
        ${mv('teamA', `<div class="nm nmA"><b>${esc(A.player)}</b><span>${esc(A.team)}</span></div>`)}${mv('teamB', `<div class="nm nmB"><b>${esc(B.player)}</b><span>${esc(B.team)}</span></div>`)}
        ${mv('info', `<div class="info"><div>${date}${time ? `<em>${time}</em>` : ' · '}${extra}</div></div>`)}`;
    }
    if (L === 'brush') {
      const strokes = (c1, c2, seed) => `<svg width="420" height="700" viewBox="0 0 420 700" style="position:absolute;left:0;top:0"><defs>
        <filter id="pvro${seed}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".02 .004" numOctaves="2" seed="${seed}"/><feDisplacementMap in="SourceGraphic" scale="44"/><feGaussianBlur stdDeviation="1.2"/></filter></defs>
        <g filter="url(#pvro${seed})"><path d="M-40 480 L460 260 L470 340 L-30 580 Z" fill="${c1}"/><path d="M-30 600 L450 430 L460 460 L-20 650 Z" fill="${c2}" opacity=".85"/>
        <path d="M-20 200 L300 90 L310 120 L-10 240 Z" fill="${c1}" opacity=".6"/></g></svg>`;
      // big outline word: the short name, or the first part of the player's name (Nexus_Arif -> NEXUS)
      const wordOf = t => esc(t.short || String(t.player || t.team).split(/[_\s.-]/)[0]);
      const panel = (t, x, c1, c2, seed) => `<div class="panel" style="left:${x}px;border-color:${c1};box-shadow:0 0 22px ${c1},inset 0 0 40px rgba(0,0,0,.6)">
        ${up ? '' : strokes(c1, c2, seed)}</div>`;
      // big outline word: its own section (drag, wheel, remove), still clipped to its panel
      const word = (t, k, x) => `<div class="bigclip" style="clip-path:inset(290px ${1020 - x - 420 + 60}px 360px ${x}px)">${mv(k, `<div class="big" style="left:${x + 10}px">${wordOf(t)}</div>`)}</div>`;
      h = `${up}${hdr}${panel(A, 60, a, a2, 3)}${panel(B, 600, b, b2, 8)}${word(A, 'wordA', 60)}${word(B, 'wordB', 600)}${phs}
        <svg class="full" viewBox="0 0 1080 1350"><defs><radialGradient id="pvgb" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fff2b8"/><stop offset=".35" stop-color="#e6b143"/><stop offset=".8" stop-color="#8a5a12"/><stop offset="1" stop-color="#3d2405"/></radialGradient>
          <radialGradient id="pvha" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffcf6a" stop-opacity=".5"/><stop offset="1" stop-color="#ffcf6a" stop-opacity="0"/></radialGradient></defs>
          <circle cx="540" cy="620" r="150" fill="url(#pvha)"/>
          <g transform="translate(540 620)"><circle r="78" fill="url(#pvgb)"/><polygon points="0,-26 25,-8 15,21 -15,21 -25,-8" fill="#3d2405" opacity=".85"/>
            ${[0, 72, 144, 216, 288].map(r => `<g transform="rotate(${r})"><path d="M0 -26 L0 -50" stroke="#3d2405" stroke-width="4" opacity=".8"/><path d="M-18 -68 L0 -50 L18 -68 L12 -76 L-12 -76 Z" fill="#3d2405" opacity=".75"/></g>`).join('')}
            <circle cx="-24" cy="-28" r="30" fill="#fff" opacity=".35"/></g></svg>
        ${mv('vs', `<div class="vs"><b>VS</b></div>`)}
        ${mv('teamA', `<div class="nm nmA"><b style="color:${a2}">${esc(A.player)}</b><span>${esc(A.team)}</span></div>`)}${mv('teamB', `<div class="nm nmB"><b style="color:${b2}">${esc(B.player)}</b><span>${esc(B.team)}</span></div>`)}
        ${mv('info', `<div class="info">${date}${time ? `<em>${time}</em>` : ' · '}${extra}</div>`)}`;
    }

    // team crest: the uploaded team logo, else a disc in the team colour with the team's initials
    const crest = (t, s, c) => t.logo ? `<img class="cr" src="${t.logo}" style="width:${s}px;height:${s}px" alt="">`
      : `<div class="cr mono" style="width:${s}px;height:${s}px;background:${c};font-size:${Math.round(s * .32)}px">${esc(initials(t))}</div>`;
    // the third colour (lightning, chips, tape): gold, or white when a team colour is already yellow-ish
    const hue = hx => { const n = parseInt(hx.slice(1), 16), r = (n >> 16) / 255, g = (n >> 8 & 255) / 255, bl = (n & 255) / 255, mx = Math.max(r, g, bl), d = mx - Math.min(r, g, bl);
      return !d ? -99 : (mx === r ? ((g - bl) / d + 6) % 6 : mx === g ? (bl - r) / d + 2 : (r - g) / d + 4) * 60; };
    const near = (x, y) => Math.min(Math.abs(x - y), 360 - Math.abs(x - y)) < 22;
    const pop = near(hue(a), 48) || near(hue(b), 48) ? '#ffffff' : '#ffd23a';
    const brandT = `<div class="tb">${st.logo ? `<img src="${st.logo}" alt="">` : 'eFCB'}</div>`;

    if (L === 'clash') {
      const R2 = rng(5);
      let x = 600, seam = 'M600 -20';
      for (let y = 40; y <= 1370; y += 60) { x = 600 - (y / 1350) * 120 + (R2() - .5) * 70; seam += ` L${x.toFixed(0)} ${y}`; }
      const dots = (cx, cy) => Array.from({ length: 12 }, (_, r) => Array.from({ length: 12 }, (_, k) => { const s = Math.max(0, 5.4 - Math.hypot(r, k) * .5);
        return s > .5 ? `<circle cx="${cx + (cx < 540 ? k : -k) * 17}" cy="${cy + r * 17}" r="${s.toFixed(1)}" fill="#fff"/>` : ''; }).join('')).join('');
      const ring = (cx, cy, r, c, g) => `<circle cx="${cx}" cy="${cy}" r="${r + 40}" fill="url(#pcg${g})"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="#0b0b1e" fill-opacity=".55"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c}" stroke-width="10" filter="url(#pcgl)"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${mix(c, '#ffffff', .6)}" stroke-width="3"/>
        <circle cx="${cx}" cy="${cy}" r="${r + 20}" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="4 10" opacity=".8"/>`;
      const crestRing = (k, t, cx, c, g) => mv(k, `<div class="ring">${`<svg class="full" viewBox="0 0 1080 1350"><defs>
          <radialGradient id="pcg${g}"><stop offset="0" stop-color="${c}" stop-opacity=".7"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>
          <filter id="pcgl" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="9"/></filter></defs>${ring(cx, 935, 62, c, g)}</svg>`}
        <div class="crw" style="left:${cx - 52}px;top:883px">${crest(t, 104, c)}</div></div>`);
      h = `${up ? '' : '<div class="wash" style="background:#070716"></div>'}<svg class="full" viewBox="0 0 1080 1350"><defs>
          <linearGradient id="pchl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}" stop-opacity=".95"/><stop offset="1" stop-color="${mix(a, '#070716', .7)}" stop-opacity=".9"/></linearGradient>
          <linearGradient id="pchr" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${b}" stop-opacity=".95"/><stop offset="1" stop-color="${mix(b, '#070716', .7)}" stop-opacity=".9"/></linearGradient>
          <linearGradient id="pcbm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
          <linearGradient id="pcbt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070716" stop-opacity="0"/><stop offset="1" stop-color="#070716" stop-opacity=".95"/></linearGradient>
          <filter id="pcsf" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="22"/></filter></defs>
        <path d="M0 0 H600 L480 1350 H0 Z" fill="url(#pchl)" opacity="${up ? .38 : 1}"/><path d="M600 0 H1080 V1350 H480 Z" fill="url(#pchr)" opacity="${up ? .38 : 1}"/>
        ${up ? '' : `<g filter="url(#pcsf)"><polygon points="-40,-40 60,-40 520,900 300,900" fill="url(#pcbm)" opacity=".5"/><polygon points="1020,-40 1120,-40 780,900 560,900" fill="url(#pcbm)" opacity=".5"/></g>
        <g opacity=".35">${dots(30, 150)}${dots(1050, 150)}</g>`}
        <rect x="0" y="800" width="1080" height="550" fill="url(#pcbt)"/></svg>`;
      h = up + h;
      h += mv('seam', `<svg class="full" viewBox="0 0 1080 1350"><defs><filter id="pcsg" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="9"/></filter></defs>
        <path d="${seam}" fill="none" stroke="${pop}" stroke-width="22" filter="url(#pcsg)" opacity=".85"/><path d="${seam}" fill="none" stroke="#fff" stroke-width="5"/></svg>`);
      h += mv('title', `<div class="ghost">${esc(st.title)}</div>`);
      h += ph(0) + ph(1);
      h += crestRing('crestA', A, 262, a, 1) + crestRing('crestB', B, 818, b, 2);
      h += mv('vs', `<div class="hex"><span>V</span><span>S</span></div>`);
      h += mv('teamA', `<div class="cn l"><b>${esc(A.player)}</b><span style="background:${a}">${esc(A.team)}</span></div>`);
      h += mv('teamB', `<div class="cn r"><b>${esc(B.player)}</b><span style="background:${b}">${esc(B.team)}</span></div>`);
      h += mv('info', `<div class="cinfo">${time ? `<span>${time}</span>` : ''}${date}${extra ? `<em></em>${extra}` : ''}</div>`);
      h += mv('head', `<div class="thd">${brandT}<div class="kick">${esc(st.event)}</div>${st.tag ? `<div class="ttag">${esc(st.tag)}</div>` : ''}</div>`);
    }

    if (L === 'torn') {
      const R2 = rng(29);
      // the tear runs from (0, 1000) up to (1080, 520); the paper strip is ±112px around it with ragged edges
      const yAt = (x, off) => 1000 - x * 480 / 1080 + off;
      const edge = (off, j) => { const pts = []; for (let x = -20; x <= 1100; x += 18) pts.push(`${x},${(yAt(x, off) + (R2() - .5) * j).toFixed(1)}`); return pts; };
      const top = edge(-112, 16), bot = edge(112, 16), topIn = edge(-97, 10), botIn = edge(97, 10);
      const paper = `M${top.join(' L')} L${bot.slice().reverse().join(' L')} Z`, paper2 = `M${topIn.join(' L')} L${botIn.slice().reverse().join(' L')} Z`;
      const dot = (id, c) => `<pattern id="${id}" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="8" cy="8" r="3.2" fill="${c}"/></pattern>`;
      h = `${up}<svg class="full" viewBox="0 0 1080 1350"><defs>
          <linearGradient id="ptta" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(a, '#ffffff', .12)}"/><stop offset="1" stop-color="${mix(a, '#000000', .45)}"/></linearGradient>
          <linearGradient id="pttb" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${mix(b, '#000000', .55)}"/><stop offset="1" stop-color="${mix(b, '#ffffff', .08)}"/></linearGradient>
          ${dot('ptd1', 'rgba(0,0,0,.16)')}${dot('ptd2', 'rgba(255,255,255,.1)')}
          <filter id="ptgr"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .22 0"/></filter></defs>
        <path d="M0 0 H1080 V${yAt(1080, 0)} L0 ${yAt(0, 0)} Z" fill="url(#ptta)" opacity="${up ? .42 : 1}"/>
        <path d="M0 ${yAt(0, 0)} L1080 ${yAt(1080, 0)} V1350 H0 Z" fill="url(#pttb)" opacity="${up ? .42 : 1}"/>
        ${up ? '' : `<path d="M0 0 H1080 V${yAt(1080, 0)} L0 ${yAt(0, 0)} Z" fill="url(#ptd1)" opacity=".8"/><path d="M0 ${yAt(0, 0)} L1080 ${yAt(1080, 0)} V1350 H0 Z" fill="url(#ptd2)"/>
        <rect width="1080" height="1350" filter="url(#ptgr)"/>`}</svg>`;
      h += ph(0);
      h += mv('paper', `<svg class="full paper" viewBox="0 0 1080 1350"><defs><filter id="ptsh" x="-5%" y="-20%" width="110%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="10" flood-opacity=".45"/></filter></defs>
        <path d="${paper}" fill="#f1ece1" filter="url(#ptsh)"/><path d="${paper2}" fill="none" stroke="#d9d1bf" stroke-width="2" stroke-dasharray="2 7"/><path d="${paper}" fill="url(#ptd1)" opacity=".18"/></svg>`);
      h += `<div class="front">${ph(1)}</div>`;
      // player 1 block top right, player 2 block bottom left
      h += mv('crestA', `<div class="tcr" style="left:715px;top:112px">${crest(A, 160, a)}</div>`);
      h += mv('teamA', `<div class="tnm t1" style="left:560px;width:470px;top:290px"><b>${esc(A.player)}</b><span>${esc(A.team)}</span></div>`);
      h += mv('crestB', `<div class="tcr" style="left:50px;top:1036px">${crest(B, 140, b)}</div>`);
      h += mv('teamB', `<div class="tnm t2" style="left:210px;width:340px;top:1040px"><b>${esc(B.player)}</b><span>${esc(B.team)}</span></div>`);
      h += mv('vs', `<div class="stamp"><div class="sk"><b>${esc(st.title)}</b>${esc(st.event)}</div><div class="sn">VS</div>
        <div class="sd">${time ? `<b>${time}</b>` : ''}${[date, extra].filter(Boolean).join(' · ')}</div></div>`);
      if (st.tag) h += mv('tape', `<div class="tape">${esc(st.tag)}</div>`);
      h += mv('head', `<div class="thd">${brandT}</div>`);
    }

    root.innerHTML = `<div class="tvt ${L}${isUp ? ' up' : ''}">${h}${mv('partners', sp)}</div>`;
    const p = root.firstElementChild;
    [['--a', a], ['--a2', a2], ['--b', b], ['--b2', b2]].forEach(([k, v]) => p.style.setProperty(k, v));
    fitNames(p);
  }

  // long team names shrink until they fit their space
  const FIT = { bolt: [['.pl b', 400]], neon: [['.nm b', 460]], slash: [['.plA b', 320], ['.plB b', 420]], chrome: [['.tn', 300]], half: [['.tn b', 460]], smoke: [['.nm b', 440]], brush: [['.nm b', 420], ['.big', 400]],
    clash: [['.cn b', 440]], torn: [['.t1 b', 470], ['.t2 b', 340]] };
  function fitNames(p) {
    const L = [...p.classList].find(c => FIT[c]);
    for (const [sel, max] of FIT[L]) p.querySelectorAll(sel).forEach(el => {
      el.style.fontSize = '';
      let f = parseFloat(getComputedStyle(el).fontSize);
      const w0 = el.style.width, d0 = el.style.display;
      el.style.width = 'max-content'; el.style.display = 'inline-block';
      while (el.offsetWidth > max && f > 18) { f -= 1; el.style.fontSize = f + 'px'; }
      el.style.width = w0; el.style.display = d0;
    });
    const t = p.querySelector('.ttl b');
    const g = p.querySelector('.ghost');
    if (g) { g.style.fontSize = ''; let f = parseFloat(getComputedStyle(g).fontSize); g.style.display = 'inline-block'; while (g.offsetWidth > 1120 && f > 90) { f -= 4; g.style.fontSize = f + 'px'; } g.style.display = ''; }
    if (t) { t.style.fontSize = ''; let f = parseFloat(getComputedStyle(t).fontSize); t.style.display = 'inline-block'; while (t.offsetWidth > 980 && f > 30) { f -= 2; t.style.fontSize = f + 'px'; } t.style.display = ''; }
  }

  window.renderTvt = renderTvt;
})();
