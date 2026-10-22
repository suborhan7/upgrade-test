/* Top 4 poster renderer: renderTop4(el, state) draws the 1080 x 1350 poster into el.
   Layouts: 'podium' (four glass steps) and 'board' (champion hero + 3 rows).
   Backgrounds: 'template' (theme), 'jersey' (blocks + background from the players' kit colours), 'image' (admin upload).
   Every element is an editor section (data-move, see js/studio-edit.js): mv = its own layer over the box it sits in,
   w = an in-flow wrapper; a few flex items carry data-move themselves. Keys end in the place (1-4). Photos are data-p. */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // place colours: champion gold, runner-up blue, 3rd violet, 4th teal
  const TPL = [
    { f1: '#b8811a', f2: '#2a1a08', tp: '#ffd46a', ed: '#ffc23d' },
    { f1: '#2450e0', f2: '#0c1650', tp: '#6b95ff', ed: '#4d7cff' },
    { f1: '#5b2fd6', f2: '#1b0c4e', tp: '#9070ff', ed: '#7d55ff' },
    { f1: '#0f9488', f2: '#062e36', tp: '#36d9c6', ed: '#22c7b6' },
  ];
  const fromKit = c => ({ f1: `color-mix(in srgb, ${c} 88%, #000)`, f2: `color-mix(in srgb, ${c} 30%, #0b0c1a)`, tp: `color-mix(in srgb, ${c} 65%, #fff)`, ed: c });

  // toned-down mesh themes (navy = no mesh, the default)
  const MESH = {
    jewel:   'radial-gradient(900px 700px at 85% 12%,rgba(22,120,98,.8) 0%,transparent 58%),radial-gradient(900px 800px at 0% 35%,rgba(30,64,140,.75) 0%,transparent 62%),radial-gradient(800px 700px at 70% 95%,rgba(86,48,140,.7) 0%,transparent 60%),linear-gradient(160deg,#08303a,#0a1d45 60%,#0b0a2a)',
    ocean:   'radial-gradient(900px 700px at 85% 12%,rgba(30,150,190,.75) 0%,transparent 58%),radial-gradient(900px 800px at 0% 35%,rgba(34,80,190,.72) 0%,transparent 62%),radial-gradient(800px 700px at 70% 95%,rgba(70,50,170,.65) 0%,transparent 60%),linear-gradient(160deg,#0a3358,#0a1f50 60%,#0a0b30)',
    emerald: 'radial-gradient(900px 700px at 85% 12%,rgba(40,170,110,.72) 0%,transparent 58%),radial-gradient(900px 800px at 0% 35%,rgba(10,130,120,.72) 0%,transparent 62%),radial-gradient(800px 700px at 70% 95%,rgba(30,80,170,.65) 0%,transparent 60%),linear-gradient(160deg,#06402f,#063845 60%,#08163a)',
    ember:   'radial-gradient(900px 700px at 85% 12%,rgba(200,140,40,.7) 0%,transparent 58%),radial-gradient(900px 800px at 0% 35%,rgba(190,70,40,.7) 0%,transparent 62%),radial-gradient(800px 700px at 70% 95%,rgba(140,30,80,.62) 0%,transparent 60%),linear-gradient(160deg,#6e2410,#4e0f2c 60%,#250826)',
  };
  const kitMesh = c => `radial-gradient(900px 700px at 85% 12%,color-mix(in srgb,${c[0]} 62%,transparent) 0%,transparent 58%),radial-gradient(900px 800px at 0% 35%,color-mix(in srgb,${c[1]} 60%,transparent) 0%,transparent 62%),radial-gradient(800px 700px at 70% 95%,color-mix(in srgb,${c[2]} 50%,transparent) 0%,transparent 60%),linear-gradient(160deg,color-mix(in srgb,${c[0]} 30%,#08121f),#0a1838 60%,#0b0a2a)`;

  // two darkish diagonal bands (no pink): bronze-gold + copper on cool themes, teal + sapphire on warm ones
  function bands(warm) {
    const a = warm ? '#1f5f7a' : '#a8741a', b = warm ? '#1d2a6e' : '#8a4a1c';
    const band = (cx, cy, w, rot, c) => `<div class="band" style="left:${cx - w / 2}px;top:${cy - 900}px;width:${w}px;transform:rotate(${rot}deg);--c:${c}"></div>`;
    return band(900, 120, 150, 38, a) + band(230, 800, 130, -38, b);
  }

  // podium slots left to right: 4th, 3rd, 2nd, champion on the highest step
  const SLOTS = [
    { i: 3, x: 8,   w: 247, top: 900, ph: 340, num: 84,  nm: 42 },
    { i: 2, x: 263, w: 244, top: 822, ph: 380, num: 118, nm: 48 },
    { i: 1, x: 515, w: 246, top: 738, ph: 430, num: 140, nm: 52 },
    { i: 0, x: 769, w: 303, top: 600, ph: 500, num: 176, nm: 68 },
  ];
  // every head is scaled to the same width for its place and sits a fixed height above its block
  const FIT = [{ head: 140, rise: 490 }, { head: 100, rise: 372 }, { head: 94, rise: 340 }, { head: 88, rise: 316 }];
  const SUF = ['ST', 'ND', 'RD', 'TH'], PLACE = ['Champion', 'Runner-up', '3rd place', '4th place'];

  // font size that keeps a name inside `room` px (Big Shoulders is ~0.5em per letter)
  const fitSize = (s, max, room, k = 0.5) => Math.max(18, Math.min(max, Math.floor(room / (Math.max(1, String(s).length) * k))));

  // base box of a podium photo (before the admin's drag/size)
  function podiumBox(s, pl) {
    const m = pl.m;
    if (!m) return { left: s.x + s.w / 2 - s.ph * 0.49, top: s.top - s.ph + 22, width: s.ph * 0.98, height: s.ph };
    const sc = FIT[s.i].head / m.head, w = m.w * sc, h = m.h * sc;
    let top = s.top - FIT[s.i].rise - m.top * sc;
    if (top + h < s.top + 26) top = s.top + 26 - h;   // a chest-up photo is pushed down so it never floats above the block
    return { left: s.x + s.w / 2 - m.cx * sc, top, width: w, height: h };
  }
  function heroBox(pl) {
    const m = pl.m;
    if (!m) return { left: 560, top: 250, width: 520, height: 560 };
    const sc = 176 / m.head;
    return { left: 820 - m.cx * sc, top: 296 - m.top * sc, width: m.w * sc, height: m.h * sc };
  }
  function faceBox(pl) {
    const m = pl.m;
    if (!m) return { left: -12, top: 0, width: 120, height: 124 };
    const sc = 58 / m.head;
    return { left: 48 - m.cx * sc, top: 8 - m.top * sc, width: m.w * sc, height: m.h * sc };
  }
  // the admin's drag offset + size; face tiles move less because the photo is much smaller there
  function photoTransform(pl, k = 1) {
    return `translate(${(pl.dx || 0) * k}px,${(pl.dy || 0) * k}px) scale(${pl.zoom || 1})`;
  }
  const boxCss = b => `left:${b.left}px;top:${b.top}px;width:${b.width}px;height:${b.height}px;`;

  function background(s, kits) {
    const theme = s.theme || 'navy';
    if (s.bgMode === 'image' && s.bgImage) return { html: `<div class="bgimg" style="background-image:url('${s.bgImage}')"></div>`, meshed: false };
    const mesh = theme === 'navy' ? null : (s.bgMode === 'jersey' ? kitMesh(kits) : MESH[theme]);
    if (mesh) return {
      html: `<div class="mesh" style="background:${mesh}"><div class="sheen"></div>
        <div class="curve" style="left:420px;top:-260px;width:1100px;height:1100px"></div>
        <div class="curve" style="left:520px;top:-160px;width:900px;height:900px;opacity:.6"></div><div class="shade"></div>${bands(theme === 'ember')}</div>`,
      meshed: true,
    };
    // navy: two soft lights, faint wedges and streaks
    const g1 = s.bgMode === 'jersey' ? kits[0] : '#ffb21f', g2 = s.bgMode === 'jersey' ? kits[1] : '#2f6bff';
    const lt = (l, t, w, c, a) => `<div class="lt" style="left:${l}px;top:${t}px;width:${w}px;height:${w}px;background:radial-gradient(circle,color-mix(in srgb,${c} ${a}%,transparent),transparent 68%)"></div>`;
    let h = '', streaks;
    if (s.layout === 'board') {
      h += lt(560, 160, 620, g1, 32) + lt(-160, 760, 540, g2, 34)
        + `<div class="wedge" style="left:640px;top:-80px;width:200px;height:700px"></div><div class="wedge" style="left:60px;top:520px;width:220px;height:500px"></div>`;
      streaks = [[600, 300, 520, g1, .22], [680, 370, 420, g2, .28], [-60, 780, 420, g2, .3], [160, 40, 300, g2, .18]];
    } else {
      h += lt(640, 60, 560, g1, 34) + lt(400, 360, 480, g2, 40) + lt(-200, 520, 520, '#22c7b6', 18)
        + `<div class="wedge" style="left:120px;top:420px;width:260px;height:700px"></div><div class="wedge" style="left:760px;top:-80px;width:180px;height:600px"></div>`;
      streaks = [[-60, 640, 520, g2, .35], [-40, 760, 380, g1, .25], [600, 260, 520, g1, .22], [680, 330, 420, g2, .3], [160, 40, 300, g2, .18]];
    }
    for (const [x, y, w, c, o] of streaks)
      h += `<div class="streak" style="left:${x}px;top:${y}px;width:${w}px;background:linear-gradient(90deg,transparent,${c},transparent);opacity:${o}"></div>`;
    return { html: h, meshed: false };
  }

  function partners(s) {
    const list = (s.partners || []).filter(p => p.name || p.logo);
    if (!list.length) return '';
    const FONTS = [["900 26px 'Orbitron'", '.12em'], ["italic 700 30px 'Chakra Petch'", '0'], ["900 36px 'Big Shoulders Display'", '.2em'],
      ["400 30px 'Russo One'", '.04em'], ["700 24px 'Chakra Petch'", '.18em']];
    return `<div class="sp"><div class="lab">${esc(s.partnersLabel || 'Official partners')}</div><div class="logos">${list.map((p, i) => {
      const [f, ls] = FONTS[i % FONTS.length];
      return p.logo ? `<div class="logo"><img src="${p.logo}" alt=""></div>`
        : `<div class="logo" style="font:${f};letter-spacing:${ls};font-size:${Math.min(parseInt(f.match(/(\d+)px/)[1]), Math.floor(170 * 5 / Math.max(5, list.length) / (p.name.length * 0.62)))}px">${esc(p.name)}</div>`;
    }).join('')}</div>${s.site ? `<div class="site">${esc(s.site)}</div>` : ''}</div>`;
  }

  const mv = (k, h) => `<div class="mv" data-move="${k}">${h}</div>`;
  const w = (k, h) => `<div data-move="${k}">${h}</div>`;
  const brand = s => s.logo ? `<div class="abs brand img"><img src="${s.logo}" alt=""></div>` : `<div class="abs brand">eFCB</div>`;
  const rec = p => `${esc(p.w)}W ${esc(p.d)}D ${esc(p.l)}L`;

  function podium(s, K) {
    const P = s.players;
    let h = mv('brand', brand(s)) + mv('event', `<div class="abs event">${esc(s.event)}</div>`) + `
      ${mv('title', '<div class="abs title"><span class="t">Top</span><span class="n">4</span></div>')}
      ${mv('sub', `<div class="abs sub">${esc(s.sub)}</div>`)}${mv('uline', '<div class="abs uline"></div>')}`;
    for (const sl of SLOTS) {
      const pl = P[sl.i], k = K[sl.i], height = 1350 - 140 - sl.top, n = sl.i + 1;
      if (pl.photo) h += `<div class="phw" data-p="${sl.i}" style="${boxCss(podiumBox(sl, pl))}transform-origin:50% 100%;transform:${photoTransform(pl)}"><img src="${pl.photo}" alt=""></div>`;
      const nm = fitSize(pl.player, sl.nm, sl.w - (pl.logo ? 120 : 56));
      const tl = String(pl.team).length, teamStyle = sl.i === 3 || tl > 15 ? `font-size:${tl > 18 ? 11 : 13}px;letter-spacing:.06em` : '';
      h += mv('block' + n, `<div class="block" style="left:${sl.x}px;width:${sl.w}px;height:${height}px;--f1:${k.f1};--f2:${k.f2};--tp:${k.tp};--ed:${k.ed}">
        <div class="top"></div><div class="shade"></div><div class="front">
          ${mv('rank' + n, `<div class="num" style="top:${sl.i ? (sl.i === 3 ? 28 : 34) : 44}px;font-size:${sl.num}px">${sl.i + 1}<sup>${SUF[sl.i]}</sup></div>`)}
          ${pl.logo ? mv('logo' + n, `<img class="tlogo" src="${pl.logo}" alt="">`) : ''}
          <div class="info" style="top:${sl.num * .8 + (sl.i ? (sl.i === 3 ? 40 : 54) : 74)}px">
            ${w('name' + n, `<div class="place">${PLACE[sl.i]}</div>
            <div class="pname" style="font-size:${nm}px">${esc(pl.player)}</div>
            ${pl.team ? `<div class="team" style="${teamStyle}">${esc(pl.team)}</div>` : ''}`)}
            ${w('stats' + n, `<div class="pts"><b>${esc(pl.pts)}</b>PTS</div>
            ${sl.i === 3 ? '' : `<div class="rec">${rec(pl)}</div>`}`)}
          </div></div></div>`);
    }
    return h;
  }

  function board(s, K) {
    const P = s.players, c = P[0];
    let h = `<div class="abs head">${w('brand', brand(s).replace('abs ', ''))}${w('event', `<div class="event">${esc(s.event)}</div>`)}</div>
      ${mv('title', `<div class="abs title"><span class="t">Top</span><span class="n">4</span><span class="t">${esc(s.boardWord)}</span></div>`)}`;
    if (c.photo) h += `<div class="hero"><div class="phw" data-p="0" style="${boxCss(heroBox(c))}transform-origin:50% 30%;transform:${photoTransform(c)}"><img src="${c.photo}" alt=""></div></div>`;
    h += `<div class="abs champ">${w('champLabel', '<div class="clabel">CHAMPION</div>')}
      ${w('champName', `<div class="cname" style="font-size:${fitSize(c.player, 140, 520)}px">${esc(c.player)}</div>`)}
      ${c.team || c.logo ? w('champTeam', `<div class="cteam">${c.logo ? `<img src="${c.logo}" alt="">` : ''}${esc(c.team)}</div>`) : ''}
      ${w('champStats', `<div class="cstats"><div><b>${esc(c.pts)}</b><small>POINTS</small></div><div><b>${esc(c.w)}W</b><small>WINS</small></div>${c.gd !== '' ? `<div><b>${esc(c.gd)}</b><small>GOAL DIFF</small></div>` : ''}</div>`)}
      ${s.prize ? w('prize', `<div class="prize"><small>PRIZE</small><b>${esc(s.prize)}</b></div>`) : ''}</div>`;
    h += `<div class="abs rows">`;
    for (let i = 1; i < 4; i++) {
      const pl = P[i], k = K[i];
      h += w('row' + (i + 1), `<div class="row" style="--f1:${k.f1};--f2:${k.f2};--tp:${k.tp};--ed:${k.ed}">
        ${w('rank' + (i + 1), `<div class="rk">${i + 1}<sup>${SUF[i]}</sup></div>`)}
        <div class="face" data-p="${i}">${pl.photo ? `<img src="${pl.photo}" alt="" style="${boxCss(faceBox(pl))}transform-origin:50% 20%;transform:${photoTransform(pl, 0.4)}">` : ''}</div>
        <div class="rtext" data-move="name${i + 1}"><div class="rplace">${PLACE[i]}</div><div class="rname" style="font-size:${fitSize(pl.player, 44, pl.logo ? 330 : 380)}px">${esc(pl.player)}</div><div class="rteam">${esc(pl.team)}</div></div>
        ${pl.logo ? `<img class="rlogo" data-move="logo${i + 1}" src="${pl.logo}" alt="">` : ''}
        <div class="rpts" data-move="pts${i + 1}"><div class="box"><b>${esc(pl.pts)}</b>PTS</div><small>${rec(pl)}</small></div></div>`);
    }
    return h + `</div>`;
  }

  function renderTop4(el, s) {
    const jersey = s.bgMode === 'jersey', kits = s.players.map(p => p.kit || '#1f6bff');
    const K = s.players.map((p, i) => jersey ? fromKit(kits[i]) : TPL[i]);
    const bg = background(s, kits);
    let n1 = jersey ? `color-mix(in srgb, ${kits[0]} 60%, #fff)` : '#42e3ff', n2 = jersey ? `color-mix(in srgb, ${kits[0]} 75%, #000)` : '#3d6bff';
    let acc = jersey ? `color-mix(in srgb, ${kits[0]} 60%, #fff)` : '#6f8cff';
    if (bg.meshed) {
      acc = 'rgba(255,255,255,.9)';
      if (s.theme === 'ember') { n1 = '#7cf3ff'; n2 = '#3d7bff'; } else { n1 = '#ffe28a'; n2 = '#ff9a2e'; }
    }
    const body = s.layout === 'board' ? board(s, K) : podium(s, K), sp = partners(s);
    el.innerHTML = `<div class="t4 ${s.layout === 'board' ? 'lb' : 'pod'}${bg.meshed ? ' meshed' : ''}" style="--n1:${n1};--n2:${n2};--acc:${acc}">
      ${bg.html}${body}${sp ? mv('partners', sp) : ''}<div class="grain"></div></div>`;
  }

  window.renderTop4 = renderTop4;
  window.top4PhotoTransform = photoTransform;
})();
