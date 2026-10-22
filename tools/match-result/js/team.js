/* Team mode of the Match Result card: club crest vs club crest with the score. renderMatchTeam(el, d), called by renderMatch
   for the layouts in MR_TEAM_LAYOUTS. d.tm = { photoMode: 'none' | 'captain' | 'squad', title, nameTags, confetti,
   teams: [{ name, short, score, scorers, logo, color, color2, captain, photo, dx, dy, zoom, squad: [{ name, photo, m, dx, dy, zoom }] }] }.
   Three layouts:
   clash   (Crest Clash: two team-colour halves split by a lightning seam, the crests on glowing rings, a huge chrome score
            between them, the result word in giant outline letters behind; captains can stand behind their crests),
   victory (Victory Squad: the winning team's squad big in front of a huge italic title with a script word, the winner's crest
            as a watermark, confetti, and a broadcast score bar with both crests),
   torn    (Torn Poster: a torn paper strip across the poster with the score stamped on it, one team above it and one below,
            halftone dots, captains layered over the tear, a WINNER tape on the winner's crest).
   Photos: captains are data-p 2 / 3, squad players data-p 10 + j (team 1) and 20 + j (team 2). Every block is a .mv layer
   (data-move) the admin can drag, wheel-resize and remove; the partners strip sits at the bottom of every layout. */
(function () {
  window.MR_TEAM_LAYOUTS = ['clash', 'victory', 'torn'];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rgb = hx => { const n = parseInt(String(hx || '#000').replace('#', '').padEnd(6, '0').slice(0, 6), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const rgba = (hx, a) => `rgba(${rgb(hx).join(',')},${a})`;
  const seeded = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  const scorerList = s => String(s || '').split(/[\n,]+/).map(x => x.trim()).filter(Boolean);
  const mv = (k, h) => `<div class="mv" data-move="${k}">${h}</div>`;
  const svg = (defs, body, cls = '') => `<svg class="full ${cls}" viewBox="0 0 1080 1350"><defs>${defs}</defs>${body}</svg>`;

  /* Colours. Default template = fixed colours per layout. Team colours = each club's colour from its crest (white/black kits use
     their trim, plain ones get purple); two clubs of nearly the same colour get a contrast colour for team 2. Victory Squad
     paints the poster in the winner's colour. */
  const TPL = {
    clash: { c1: '#ff2e63', c2: '#19c7ff', pop: '#ffd23a' },
    victory: { c1: '#7b3fe4', c2: '#ff4fd8', pop: '#ffc23a' },
    torn: { c1: '#ff5a1f', c2: '#2453ff', pop: '#ffe14a' },
  };
  function palette(d, A, B) {
    if (d.bgMode !== 'jersey') return TPL[d.layout];
    const C = MR_COLORS, a = C.teamColor({ primary: A.color, secondary: A.color2 }), b = C.teamColor({ primary: B.color, secondary: B.color2 });
    let c2 = b.c;
    const dh = Math.abs(C.toHsl(a.c)[0] - C.toHsl(c2)[0]);
    if (Math.min(dh, 360 - dh) < 28) c2 = C.popFor(a.c, a.plain);
    let pop = C.popFor(a.c, a.plain);
    const dp = Math.abs(C.toHsl(pop)[0] - C.toHsl(c2)[0]);
    if (Math.min(dp, 360 - dp) < 28) pop = '#ffffff';
    return { c1: a.c, c2, pop };
  }

  const monoColor = new Map();   // a team without a logo gets a disc in its own poster colour
  const crest = (t, s, cls = '') => t.logo ? `<img class="cr ${cls}" src="${esc(t.logo)}" style="width:${s}px;height:${s}px" alt="">`
    : `<div class="cr mono ${cls}" style="width:${s}px;height:${s}px;background:${monoColor.get(t) || 'var(--c1)'};font-size:${Math.round(s * .3)}px">${esc((t.short || t.name || '').slice(0, 3).toUpperCase())}</div>`;
  // a captain cut-out standing on `bottom`, `h` px tall, centred on cx; the admin's drag/size on top
  let capBase = 2;   // photo numbers of the two captains (0 / 1 when a 1v1 is drawn with these layouts)
  const captain = (t, n, cx, bottom, h, extra = '') => t.photo ? `<img class="cap" data-p="${n}" src="${esc(t.photo)}" alt=""
      style="left:${cx}px;top:${bottom - h}px;height:${h}px;transform:translateX(-50%) translate(${+t.dx || 0}px,${+t.dy || 0}px) scale(${+t.zoom || 1});${extra}">` : '';

  /* Squad in one row: each cut-out scaled so every head comes out the same width (m = head measure from the maker), the
     first player (captain / star) in the middle and a bit bigger, the rest outwards in turns. */
  function squadRow(t, ti, box) {
    const ps = (t.squad || []).map((p, j) => ({ p, j })).filter(o => o.p.photo).slice(0, 5), n = ps.length, out = [];
    const mid = (n - 1) / 2, slots = [...Array(n).keys()].sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b);
    const hw0 = Math.min(box.head, box.w / Math.max(n, 1) * .7);
    ps.forEach((o, k) => {
      const sl = slots[k], star = k === 0 && n > 2, p = o.p, m = p.m || { w: 1000, h: 1000, head: 300, top: 30, cx: 500 }, zz = +p.zoom || 1;
      const hw = hw0 * (star ? 1.12 : 1), cx = box.x + box.w * (sl + .5) / n, headTop = box.y - (star ? hw * .1 : 0) + Math.abs(sl - mid) * hw * .1;
      const s = hw * zz / m.head, left = cx - m.cx * s + (+p.dx || 0), top = headTop - (zz - 1) * hw * .5 - m.top * s + (+p.dy || 0);
      out.push({ j: o.j, z: star ? 4 : Math.abs(sl - mid) >= 2 ? 2 : 3, name: p.name, tx: cx + (+p.dx || 0), ty: headTop + (+p.dy || 0) + hw * zz * 2.05,
        html: `<img class="sq" data-p="${(ti + 1) * 10 + o.j}" src="${esc(p.photo)}" alt="" style="left:${left.toFixed(1)}px;top:${top.toFixed(1)}px;width:${(m.w * s).toFixed(1)}px;height:${(m.h * s).toFixed(1)}px;z-index:${star ? 4 : Math.abs(sl - mid) >= 2 ? 2 : 3}">` });
    });
    return out;
  }

  const partners = d => `<div class="sp"><div class="k">${esc(d.partnersLabel || '').toUpperCase()}</div><div class="sprow">${(d.partners || []).map(p =>
    `<div>${p.logo ? `<img src="${esc(p.logo)}" alt="">` : esc(p.name)}</div>`).join('')}</div><div class="w">${esc(d.site || '').toUpperCase()}</div></div>`;
  const brand = d => d.logo ? `<div class="brand logo"><img src="${esc(d.logo)}" alt=""></div>` : `<div class="brand">eFCB</div>`;
  const ball = '<i class="ball"></i>';

  // ---------------------------------------------------------------- Crest Clash
  function clash(d, P, up) {
    const [A, B] = d.tm.teams, sa = num(A.score), sb = num(B.score), draw = sa === sb;
    const cap = d.tm.photoMode !== 'none' && (A.photo || B.photo);
    const R = seeded(5);
    // lightning seam between the halves
    let x = 600, seam = 'M600 -20';
    for (let y = 40; y <= 1370; y += 60) { x = 600 - (y / 1350) * 120 + (R() - .5) * 70; seam += ` L${x.toFixed(0)} ${y}`; }
    const dots = (cx, cy, c) => Array.from({ length: 12 }, (_, r) => Array.from({ length: 12 }, (_, k) => { const s = Math.max(0, 5.4 - Math.hypot(r, k) * .5);
      return s > .5 ? `<circle cx="${cx + (cx < 540 ? k : -k) * 17}" cy="${cy + r * 17}" r="${s.toFixed(1)}" fill="${c}"/>` : ''; }).join('')).join('');
    const ring = (cx, cy, r, c) => `<circle cx="${cx}" cy="${cy}" r="${r + 40}" fill="url(#cg${c === P.c1 ? 1 : 2})"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c}" stroke-width="10" filter="url(#glow)"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${mix(c, '#ffffff', .6)}" stroke-width="3"/>
      <circle cx="${cx}" cy="${cy}" r="${r + 22}" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="4 10" opacity=".8"/>`;
    const y0 = cap ? 690 : 600, rr = cap ? 112 : 150, cs = cap ? 190 : 250;
    let h = up ? `<div class="bgimg" style="background-image:url('${esc(d.bgImage)}')"></div><div class="wash" style="background:linear-gradient(180deg,rgba(5,5,16,.25),rgba(5,5,16,.85) 75%)"></div>`
      : `<div class="wash" style="background:#070716"></div>`;
    h += svg(`<linearGradient id="hl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P.c1}" stop-opacity=".95"/><stop offset="1" stop-color="${mix(P.c1, '#070716', .7)}" stop-opacity=".9"/></linearGradient>
        <linearGradient id="hr" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.c2}" stop-opacity=".95"/><stop offset="1" stop-color="${mix(P.c2, '#070716', .7)}" stop-opacity=".9"/></linearGradient>
        <radialGradient id="cg1"><stop offset="0" stop-color="${P.c1}" stop-opacity=".7"/><stop offset="1" stop-color="${P.c1}" stop-opacity="0"/></radialGradient>
        <radialGradient id="cg2"><stop offset="0" stop-color="${P.c2}" stop-opacity=".7"/><stop offset="1" stop-color="${P.c2}" stop-opacity="0"/></radialGradient>
        <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <linearGradient id="bot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070716" stop-opacity="0"/><stop offset="1" stop-color="#070716" stop-opacity=".95"/></linearGradient>
        <filter id="glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="9"/></filter>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="22"/></filter>`,
      `<path d="M0 0 H600 L480 1350 H0 Z" fill="url(#hl)" opacity="${up ? .38 : 1}"/><path d="M600 0 H1080 V1350 H480 Z" fill="url(#hr)" opacity="${up ? .38 : 1}"/>
       ${up ? '' : `<g filter="url(#soft)"><polygon points="-40,-40 60,-40 520,900 300,900" fill="url(#beam)" opacity=".5"/><polygon points="1020,-40 1120,-40 780,900 560,900" fill="url(#beam)" opacity=".5"/></g>
       <g opacity=".35">${dots(30, 150, '#ffffff')}${dots(1050, 150, '#ffffff')}</g>`}
       <rect x="0" y="780" width="1080" height="570" fill="url(#bot)"/>`);
    h += mv('seam', svg('', `<path d="${seam}" fill="none" stroke="${P.pop}" stroke-width="22" filter="url(#glow)" opacity=".85"/>
      <path d="${seam}" fill="none" stroke="#fff" stroke-width="5"/>`, 'seam'));
    h += mv('title', `<div class="ghost">${esc(d.label || 'Full time')}</div>`);
    if (cap) {
      h += captain(A, capBase, 250, 860, 600);
      h += captain(B, capBase + 1, 830, 860, 600);
    }
    h += `<div class="floor"></div>`;
    // with photos the crests sit in front of the team names, so they never cover a player; without photos they take the rings
    if (!cap) h += mv('crest1', `<div class="ringbox">${svg('', ring(250, y0, rr, P.c1), 'rings')}<div class="crw" style="left:${250 - cs / 2}px;top:${y0 - cs / 2}px">${crest(A, cs)}</div></div>`);
    if (!cap) h += mv('crest2', `<div class="ringbox">${svg('', ring(830, y0, rr, P.c2), 'rings')}<div class="crw" style="left:${830 - cs / 2}px;top:${y0 - cs / 2}px">${crest(B, cs)}</div></div>`);
    h += mv('score', `<div class="score" style="top:${cap ? 300 : 475}px"><span class="${!draw && sa < sb ? 'lo' : ''}">${esc(A.score)}</span><i></i><span class="${!draw && sb < sa ? 'lo' : ''}">${esc(B.score)}</span></div>`);
    const ny = cap ? 900 : 830;
    if (d.tm.player && cap) {
      if (A.captain) h += mv('player1', `<div class="pchip" style="left:250px;top:${ny - 46}px">${esc(A.captain)}</div>`);
      if (B.captain) h += mv('player2', `<div class="pchip" style="left:830px;top:${ny - 46}px">${esc(B.captain)}</div>`);
    }
    const tag = (won) => draw ? '<b class="res dr">DRAW</b>' : won ? '<b class="res w">WINNER</b>' : '<b class="res l">DEFEAT</b>';
    const ic = (k, t) => cap ? `<span class="ic" data-move="${k}">${crest(t, 78)}</span>` : '';
    h += mv('name1', `<div class="tn l" style="top:${ny}px">${ic('crest1', A)}<span>${esc(A.name)}</span></div>`);
    h += mv('name2', `<div class="tn r" style="top:${ny}px">${ic('crest2', B)}<span>${esc(B.name)}</span></div>`);
    h += mv('result1', `<div class="rs l" style="top:${ny + 78}px">${tag(sa > sb)}</div>`);
    h += mv('result2', `<div class="rs r" style="top:${ny + 78}px">${tag(sb > sa)}</div>`);
    const li = s => scorerList(s).slice(0, 4).map(x => `<li>${ball}${esc(x)}</li>`).join('');
    if (scorerList(A.scorers).length) h += mv('scorers1', `<ul class="sc l" style="top:${ny + 142}px">${li(A.scorers)}</ul>`);
    if (scorerList(B.scorers).length) h += mv('scorers2', `<ul class="sc r" style="top:${ny + 142}px">${li(B.scorers)}</ul>`);
    h += mv('info', `<div class="info"><span>${esc(d.label || 'Full time')}</span><em></em>${esc(d.date)}</div>`);
    h += mv('brand', `<div class="hd l">${brand(d)}</div>`);
    if (d.tag) h += mv('tag', `<div class="hd r"><div class="tag">${esc(d.tag)}</div></div>`);
    h += mv('kick', `<div class="kick">${esc(d.kicker)}</div>`);
    return h;
  }

  // ---------------------------------------------------------------- Victory Squad
  function victory(d, P, up) {
    const T = d.tm.teams, sa = num(T[0].score), sb = num(T[1].score), draw = sa === sb, wi = sb > sa ? 1 : 0;
    const W = T[wi], Lz = T[1 - wi], R = seeded(17);
    const c1 = P.c1, deep = mix(c1, '#05030c', .78), mode = d.tm.photoMode;
    let h = up ? `<div class="bgimg" style="background-image:url('${esc(d.bgImage)}')"></div>`
      : `<div class="wash" style="background:radial-gradient(75% 45% at 50% 30%, ${mix(c1, '#05030c', .35)}, ${deep} 60%, #05030c)"></div>`;
    if (!up && W.logo) h += mv('mark', `<div class="mark"><img src="${esc(W.logo)}" alt=""></div>`);
    if (!up) h += `<div class="speed" style="background:repeating-linear-gradient(115deg, transparent 0 46px, ${rgba(c1, .16)} 46px 52px, transparent 52px 120px)"></div>`;
    h += svg(`<radialGradient id="vg"><stop offset="0" stop-color="${mix(c1, '#ffffff', .3)}" stop-opacity=".75"/><stop offset="1" stop-color="${c1}" stop-opacity="0"/></radialGradient>
        <linearGradient id="vf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05030c" stop-opacity="0"/><stop offset="1" stop-color="#05030c"/></linearGradient>`,
      `<ellipse cx="540" cy="560" rx="520" ry="380" fill="url(#vg)" opacity="${up ? .5 : .9}"/>
       <rect x="0" y="${up ? 640 : 720}" width="1080" height="${up ? 260 : 200}" fill="url(#vf)"/><rect x="0" y="919" width="1080" height="440" fill="#05030c" opacity="${up ? .88 : 1}"/>`);
    h += mv('title', `<div class="big"><b>${esc(draw ? 'Draw' : (d.tm.title || 'Victory'))}</b></div>`);
    if (d.tm.confetti) {
      const cs = [P.pop, '#ffffff', mix(c1, '#ffffff', .4), P.c2];
      h += mv('confetti', svg('', Array.from({ length: 70 }, () => {
        const x = R() * 1080, y = 90 + R() * 820, w = 7 + R() * 13, hh = 4 + R() * 7, c = cs[Math.floor(R() * cs.length)];
        return `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(1)}" height="${hh.toFixed(1)}" fill="${c}" opacity="${(.6 + R() * .4).toFixed(2)}" transform="rotate(${(R() * 360).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)}) skewX(${(R() * 40 - 20).toFixed(0)})"/>`;
      }).join(''), 'conf'));
    }
    // the winner's players: the squad, else the captain, else a huge crest
    const sq = mode === 'squad' ? squadRow(W, wi, { x: 60, w: 960, y: 395, head: 132 }) : [];
    let tags = '';
    if (sq.length) {
      h += `<div class="grp">${sq.map(o => o.html).join('')}</div>`;
      if (d.tm.nameTags) tags = sq.filter(o => o.name).map(o => `<div class="ntag${o.z > 3 ? ' star' : ''}" style="left:${o.tx.toFixed(0)}px;top:${Math.min(o.ty, 860).toFixed(0)}px">${esc(o.name).toUpperCase()}</div>`).join('');
    } else if (mode !== 'none' && W.photo) {
      h += `<div class="grp">${captain(W, capBase + wi, 540, 960, 640)}</div>`;
      if (d.tm.nameTags && W.captain && !d.tm.player) tags = `<div class="ntag star" style="left:540px;top:800px">${esc(W.captain).toUpperCase()}</div>`;
    } else {
      h += mv('hero', `<div class="hero">${crest(W, 400)}</div>`);
    }
    h += `<div class="vfade"></div>`;
    if (tags) h += mv('tags', `<div class="ntags">${tags}</div>`);
    h += mv('script', `<div class="scr">${esc(d.label || 'Full time')}</div>`);
    // the broadcast score bar: winner panel in the team colour, the score box, the other team
    const L1 = draw ? T[0] : W, L2 = draw ? T[1] : Lz;
    const pl = t => d.tm.player ? (t.captain || t.name) : t.name;   // a 1v1 puts the player's name first, the team under it
    h += mv('scorebar', `<div class="bar">
        <div class="pnl a">${crest(L1, 92)}<div><small>${draw ? 'DRAW' : 'WINNER'}</small><b>${esc(pl(L1))}</b>${d.tm.player ? `<em>${esc(L1.name)}</em>` : ''}</div></div>
        <div class="box"><span>${esc(L1.score)}</span><i>–</i><span>${esc(L2.score)}</span></div>
        <div class="pnl b"><div><small>${draw ? 'DRAW' : 'DEFEAT'}</small><b>${esc(pl(L2))}</b>${d.tm.player ? `<em>${esc(L2.name)}</em>` : ''}</div>${crest(L2, 92)}</div></div>`);
    const s1 = scorerList(L1.scorers), s2 = scorerList(L2.scorers);
    if (s1.length) h += mv('scorers1', `<div class="vsc l">${s1.slice(0, 4).map(esc).join(' · ')}${ball}</div>`);
    if (s2.length) h += mv('scorers2', `<div class="vsc r">${ball}${s2.slice(0, 4).map(esc).join(' · ')}</div>`);
    h += mv('info', `<div class="info"><span>${esc(d.kicker)}</span><em></em>${esc(d.date)}</div>`);
    h += mv('brand', `<div class="hd l">${brand(d)}</div>`);
    if (d.tag) h += mv('tag', `<div class="hd r"><div class="tag">${esc(d.tag)}</div></div>`);
    return h;
  }

  // ---------------------------------------------------------------- Torn Poster
  function torn(d, P, up) {
    const [A, B] = d.tm.teams, sa = num(A.score), sb = num(B.score), draw = sa === sb, R = seeded(29);
    const cap = d.tm.photoMode !== 'none';
    // the tear runs from (0, 1000) up to (1080, 520); the paper strip is ±95px around it with ragged edges
    const yAt = (x, off) => 1000 - x * 480 / 1080 + off;
    const edge = (off, j) => { const pts = []; for (let x = -20; x <= 1100; x += 18) pts.push(`${x},${(yAt(x, off) + (R() - .5) * j).toFixed(1)}`); return pts; };
    const top = edge(-95, 16), bot = edge(95, 16), topIn = edge(-80, 10), botIn = edge(80, 10);
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
    // team 1 above the tear: captain on the left (behind the paper), crest + name top right
    if (cap) h += captain(A, capBase, 270, 810, 650);
    const papr = svg('', `<path d="${paper}" fill="#f1ece1" filter="url(#psh)"/><path d="${paper2}" fill="none" stroke="#d9d1bf" stroke-width="2" stroke-dasharray="2 7"/>
      <path d="${paper}" fill="url(#d1)" opacity=".18"/>`, 'paper');
    h += mv('paper', papr);
    if (cap) h += captain(B, capBase + 1, 830, 1255, 540);
    const tape = won => draw ? '' : won ? '<b class="tape">WINNER</b>' : '';
    const cs = cap ? 210 : 260;
    // team 1 block top right, team 2 block bottom left (no captains: the crests take the captains' places)
    const b1 = cap ? { cx: 795, w: 470, cy: 110, cs: 180 } : { cx: 540, w: 700, cy: 100, cs: 240 };
    const b2 = cap ? { x: 50, y: 1010, cs: 150, tx: 220, tw: 380 } : { x: 70, y: 960, cs: 230, tx: 330, tw: 700 };
    h += mv('crest1', `<div class="tcr" style="left:${b1.cx - b1.cs / 2}px;top:${b1.cy}px">${crest(A, b1.cs)}${tape(sa > sb)}</div>`);
    h += mv('crest2', `<div class="tcr" style="left:${b2.x}px;top:${b2.y + (cap ? 60 : 0)}px">${crest(B, b2.cs)}${tape(sb > sa)}</div>`);
    h += mv('name1', `<div class="tn t1" style="left:${b1.cx - b1.w / 2}px;width:${b1.w}px;top:${b1.cy + b1.cs + 14}px">${esc(A.name)}</div>`);
    h += mv('name2', `<div class="tn t2" style="left:${b2.tx}px;width:${b2.tw}px;top:${cap ? 990 : 1050}px">${esc(B.name)}</div>`);
    if (d.tm.player && cap) {
      if (A.captain) h += mv('player1', `<div class="pchip" style="left:270px;top:690px">${esc(A.captain)}</div>`);
      if (B.captain) h += mv('player2', `<div class="pchip" style="left:830px;top:1196px">${esc(B.captain)}</div>`);
    }
    const s1 = scorerList(A.scorers), s2 = scorerList(B.scorers);
    if (s1.length) h += mv('scorers1', `<div class="tsc t1" style="left:${b1.cx - b1.w / 2}px;width:${b1.w}px;top:${b1.cy + b1.cs + 86}px">${s1.slice(0, 4).map(x => `<span>${ball}${esc(x)}</span>`).join('')}</div>`);
    if (s2.length) h += mv('scorers2', `<div class="tsc t2" style="left:${b2.tx}px;width:${b2.tw}px;top:${cap ? 1062 : 1122}px">${s2.slice(0, 4).map(x => `<span>${ball}${esc(x)}</span>`).join('')}</div>`);
    // the score stamped on the paper, along the tear
    h += mv('kick', `<div class="tk">${esc(d.kicker)}</div>`);
    h += mv('score', `<div class="stamp"><div class="sn">${esc(A.score)}<i>–</i>${esc(B.score)}</div><div class="sd"><b>${esc(d.label || 'Full time')}</b>${esc(d.date)}</div></div>`);
    h += mv('brand', `<div class="hd l">${brand(d)}</div>`);
    if (d.tag) h += mv('tag', `<div class="hd r"><div class="tag">${esc(d.tag)}</div></div>`);
    return h;
  }

  function fitText(root) {
    root.querySelectorAll('.tn, .bar .pnl b, .big b, .info, .stamp .sk').forEach(el => {
      el.style.fontSize = '';
      const max = el.clientWidth;
      let f = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > max + 1 && f > 10) { f -= 2; el.style.fontSize = f + 'px'; }
    });
  }

  window.renderMatchTeam = function (el, d) {
    const L = d.layout, T = d.tm.teams, up = d.bgMode === 'image' && !!d.bgImage;
    capBase = d.tm.capBase ?? 2;
    // Victory Squad colours follow the winner
    const wi = num(T[1].score) > num(T[0].score) ? 1 : 0;
    const P = palette(d, L === 'victory' ? T[wi] : T[0], L === 'victory' ? T[1 - wi] : T[1]);
    monoColor.clear(); monoColor.set(L === 'victory' ? T[wi] : T[0], P.c1); monoColor.set(L === 'victory' ? T[1 - wi] : T[1], P.c2);
    const body = (L === 'victory' ? victory : L === 'torn' ? torn : clash)(d, P, up);
    el.innerHTML = `<div class="mr tm ${L}${up ? ' custom-bg' : ''}" style="--c1:${P.c1};--c2:${P.c2};--pop:${P.pop};--l1:${mix(P.c1, '#ffffff', .55)};--l2:${mix(P.c2, '#ffffff', .55)};--d1:${mix(P.c1, '#000000', .5)};--d2:${mix(P.c2, '#000000', .5)};--g1:${rgba(P.c1, .6)};--g2:${rgba(P.c2, .6)}">${body}${mv('partners', partners(d))}</div>`;
    fitText(el.firstElementChild);
  };
})();
