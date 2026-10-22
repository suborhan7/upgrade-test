/* Renders the Player Comparison poster into a container.
   renderComparison(container, data)
   data = {
     tag, kicker, title, partnersLabel, partners [{ name, logo }], site, logo (image url or ''),
     a: { name, team, photo, primary, secondary },   // jersey colours as hex
     b: { name, team, photo, primary, secondary },
     stats: [{ label, a, b, better: 'high' | 'low' | 'none' }]
   }
   Every text block sits in its own .mv wrapper (data-move="key") so the admin can drag, size or remove it (js/studio-edit.js);
   photos carry data-p="0|1". */
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? null : n; };

  function winner(stat) {
    if (stat.better === 'none') return null;
    const a = num(stat.a), b = num(stat.b);
    if (a === null || b === null || a === b) return null;
    const aWins = stat.better === 'low' ? a < b : a > b;
    return aWins ? 'a' : 'b';
  }

  // per-player position set in the maker: dx/dy in poster pixels, zoom 1 = default size
  function playerTransform(pl) {
    // scaled from the top so both heads stay on the same line
    const dx = +pl.dx || 0, dy = +pl.dy || 0, z = +pl.zoom || 1;
    return `transform: translateX(-50%) translate(${dx}px, ${dy}px) scale(${z}); transform-origin: 50% 0;`;
  }

  function vars(prefix, p) {
    return `--${prefix}-base:${p.base};--${prefix}-deep:${p.deep};--${prefix}-mid:${p.mid};--${prefix}-glow:${p.glow};` +
      `--${prefix}-stripe:${p.stripe};--${prefix}-accent:${p.accent};--${prefix}-on:${p.onAccent};`;
  }

  // movable section; js/studio-edit.js sets its transform after each render
  const mv = (key, html) => `<div class="mv" data-move="${key}">${html}</div>`;

  function side(key, pl, ghost) {
    return `<div class="side side-${key}">
      <div class="bg"></div><div class="stripes"></div><div class="dots"></div>
      <div class="glow"></div><div class="streaks"></div>
      ${ghost ? mv(key === 'a' ? 'ghostA' : 'ghostB', `<div class="ghost">${esc(pl.name)}</div>`) : ''}
    </div>`;
  }

  /* Background styles for Classic (d.bgStyle). 'halves' = the jersey-coloured halves; the others are full scenes painted in
     the two side colours: stadium (spotlights + crowd bokeh), smoke (coloured smoke from each side), grid (neon perspective
     grid), brush (big paint strokes). */
  // fixed two-colour themes for Classic (left, right), picked when the kits' own colours don't look good together
  const CMP_THEMES = { neon: ['#ff2e88', '#19c7ff'], gold: ['#f5b301', '#2453ff'], fire: ['#ff5a1f', '#2fa4ff'],
    violet: ['#7b3fe4', '#12c9a6'], bd: ['#0f9d58', '#e11d48'], night: ['#3b5bff', '#ff3d6e'] };
  const seeded = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  function scene(style, A, B) {
    const R = seeded(11), sv = (defs, body) => `<svg class="scene" viewBox="0 0 1080 1350" preserveAspectRatio="none"><defs>${defs}</defs>${body}</svg>`;
    if (style === 'stadium') {
      const beam = (x, tx, c, o) => `<polygon points="${x - 26},-20 ${x + 26},-20 ${tx + 230},1100 ${tx - 230},1100" fill="url(#bm${c})" opacity="${o}"/>`;
      const bokeh = Array.from({ length: 90 }, () => { const x = R() * 1080, y = 300 + R() * 420, r = 3 + R() * 13, c = [A.glow, B.glow, '#ffffff'][Math.floor(R() * 3)];
        return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="${x < 540 && c === B.glow ? A.glow : c}" opacity="${(.15 + R() * .45).toFixed(2)}"/>`; }).join('');
      return sv(`<linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#03050c"/><stop offset=".55" stop-color="#0b1330"/><stop offset="1" stop-color="#05070f"/></linearGradient>
          <linearGradient id="bmA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${A.glow}" stop-opacity=".9"/><stop offset="1" stop-color="${A.glow}" stop-opacity="0"/></linearGradient>
          <linearGradient id="bmB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${B.glow}" stop-opacity=".9"/><stop offset="1" stop-color="${B.glow}" stop-opacity="0"/></linearGradient>
          <linearGradient id="bmW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
          <radialGradient id="hzA" cx="0" cy=".55" r=".75"><stop offset="0" stop-color="${A.base}" stop-opacity=".75"/><stop offset="1" stop-color="${A.base}" stop-opacity="0"/></radialGradient>
          <radialGradient id="hzB" cx="1" cy=".55" r=".75"><stop offset="0" stop-color="${B.base}" stop-opacity=".75"/><stop offset="1" stop-color="${B.base}" stop-opacity="0"/></radialGradient>
          <filter id="bl8"><feGaussianBlur stdDeviation="8"/></filter><filter id="bl3"><feGaussianBlur stdDeviation="2.5"/></filter>`,
        `<rect width="1080" height="1350" fill="url(#sk)"/><rect width="1080" height="1350" fill="url(#hzA)"/><rect width="1080" height="1350" fill="url(#hzB)"/>
         <g filter="url(#bl8)">${beam(120, 300, 'A', .55)}${beam(300, 420, 'W', .3)}${beam(780, 660, 'W', .3)}${beam(960, 780, 'B', .55)}</g>
         <g filter="url(#bl3)">${bokeh}</g>
         <ellipse cx="540" cy="1250" rx="700" ry="160" fill="#0e3b2a" opacity=".55" filter="url(#bl8)"/>
         <path d="M-40 1180 Q540 1080 1120 1180" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="4"/>`);
    }
    if (style === 'smoke') {
      const puff = (cx, c, n) => Array.from({ length: n }, () => `<ellipse cx="${(cx + (R() - .5) * 420).toFixed(0)}" cy="${(250 + R() * 900).toFixed(0)}" rx="${(140 + R() * 200).toFixed(0)}" ry="${(90 + R() * 150).toFixed(0)}" fill="${c}" opacity="${(.18 + R() * .3).toFixed(2)}"/>`).join('');
      return sv(`<filter id="smk" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".008 .014" numOctaves="4" seed="7"/>
            <feDisplacementMap in="SourceGraphic" scale="190"/><feGaussianBlur stdDeviation="16"/></filter>
          <filter id="grn"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .06 0"/></filter>`,
        `<rect width="1080" height="1350" fill="#06070c"/>
         <g filter="url(#smk)">${puff(140, A.base, 9)}${puff(140, A.glow, 4)}${puff(940, B.base, 9)}${puff(940, B.glow, 4)}${puff(540, '#ffffff', 3)}</g>
         <rect width="1080" height="1350" filter="url(#grn)"/>`);
    }
    if (style === 'grid') {
      let lines = '';
      for (let i = -14; i <= 14; i++) lines += `<line x1="540" y1="760" x2="${540 + i * 140}" y2="1350" stroke="url(#gl)" stroke-width="2"/>`;
      for (let k = 1; k <= 12; k++) { const y = 760 + 590 * Math.pow(k / 12, 2.1); lines += `<line x1="0" y1="${y.toFixed(1)}" x2="1080" y2="${y.toFixed(1)}" stroke="url(#gl)" stroke-width="${(1 + k * .15).toFixed(2)}" opacity="${(.35 + k * .05).toFixed(2)}"/>`; }
      const stars = Array.from({ length: 70 }, () => `<circle cx="${(R() * 1080).toFixed(0)}" cy="${(R() * 700).toFixed(0)}" r="${(.6 + R() * 1.6).toFixed(1)}" fill="#fff" opacity="${(.2 + R() * .6).toFixed(2)}"/>`).join('');
      return sv(`<linearGradient id="gsk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05030f"/><stop offset=".7" stop-color="${A.deep}"/><stop offset="1" stop-color="#05030f"/></linearGradient>
          <linearGradient id="gl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${A.glow}"/><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="${B.glow}"/></linearGradient>
          <radialGradient id="sun" cx=".5" cy="1" r=".6"><stop offset="0" stop-color="${B.glow}" stop-opacity=".85"/><stop offset=".5" stop-color="${A.glow}" stop-opacity=".35"/><stop offset="1" stop-color="${A.glow}" stop-opacity="0"/></radialGradient>
          <filter id="gb"><feGaussianBlur stdDeviation="3"/></filter>
          <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1.4" fill="#000" opacity=".35"/></pattern>`,
        `<rect width="1080" height="1350" fill="url(#gsk)"/>${stars}<rect x="0" y="260" width="1080" height="500" fill="url(#sun)"/>
         <rect x="0" y="760" width="1080" height="590" fill="#06030f" opacity=".85"/>
         <g filter="url(#gb)" opacity=".9">${lines}</g><g>${lines}</g>
         <rect x="0" y="754" width="1080" height="12" fill="#fff" opacity=".9" filter="url(#gb)"/>
         <rect width="1080" height="1350" fill="url(#scan)"/>`);
    }
    // brush
    const stroke = (pts, c, w) => Array.from({ length: 7 }, (_, i) => { const j = () => ((R() - .5) * 60).toFixed(0);
      return `<path d="M${pts[0] + +j()} ${pts[1] + +j()} C${pts[2] + +j()} ${pts[3] + +j()} ${pts[4] + +j()} ${pts[5] + +j()} ${pts[6] + +j()} ${pts[7] + +j()}" fill="none" stroke="${c}" stroke-width="${(w * (.35 + R() * .5)).toFixed(0)}" stroke-linecap="round" opacity="${(.55 + R() * .45).toFixed(2)}"/>`; }).join('');
    const splat = (cx, cy, c) => Array.from({ length: 26 }, () => `<circle cx="${(cx + (R() - .5) * 420).toFixed(0)}" cy="${(cy + (R() - .5) * 420).toFixed(0)}" r="${(2 + R() * 12).toFixed(1)}" fill="${c}" opacity="${(.5 + R() * .5).toFixed(2)}"/>`).join('');
    return sv(`<filter id="rough"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="3"/><feDisplacementMap in="SourceGraphic" scale="34"/></filter>
        <filter id="grn"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .07 0"/></filter>`,
      `<rect width="1080" height="1350" fill="#0a0a10"/>
       <g filter="url(#rough)">${stroke([-120, 1250, 120, 900, 260, 500, 520, 120], A.base, 330)}${stroke([1200, 1150, 980, 820, 860, 420, 620, 60], B.base, 330)}
       ${stroke([-60, 640, 160, 560, 300, 420, 470, 300], A.glow, 90)}${stroke([1140, 560, 920, 500, 800, 380, 640, 260], B.glow, 90)}
       ${splat(330, 330, A.glow)}${splat(760, 360, B.glow)}</g>
       <rect width="1080" height="1350" filter="url(#grn)"/>`);
  }

  function renderComparison(el, d) {
    if ((window.CMP_VS_LAYOUTS || []).includes(d.layout)) return renderCmpVersus(el, d);   // Crest Clash / Torn Poster (js/versus.js)
    const th = CMP_THEMES[d.theme];   // a fixed colour pair, or the jersey colours
    const pa = th ? JerseyColors.paletteFor(th[0], '#111111') : JerseyColors.paletteFor(d.a.primary, d.a.secondary);
    const pb = th ? JerseyColors.paletteFor(th[1], '#111111') : JerseyColors.paletteFor(d.b.primary, d.b.secondary);
    const rows = d.stats.filter(s => s.label || s.a || s.b).slice(0, 7).map(s => {
      const w = winner(s);
      const cls = k => w ? (w === k ? 'win' : 'lose') : '';
      return `<div class="row">
        <div class="val val-a ${cls('a')}">${esc(s.a)}</div>
        <div class="label">${esc(s.label)}</div>
        <div class="val val-b ${cls('b')}">${esc(s.b)}</div>
      </div>`;
    }).join('');
    const nameCls = n => (String(n || '').length > 11 ? 'name long' : 'name');

    const st = d.bgStyle && d.bgStyle !== 'halves' ? d.bgStyle : '';
    el.innerHTML = `<div class="cmp layout-${esc(d.layout || 1)} ${d.ghost ? '' : 'no-ghost'}${st ? ' bgs bgs-' + st : ''}" style="${vars('a', pa)}${vars('b', pb)}">
      ${st ? scene(st, pa, pb) : side('a', d.a, d.ghost) + side('b', d.b, d.ghost)}
      <svg class="seam" viewBox="0 0 1080 1350">
        <defs><filter id="seamGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter></defs>
        <line x1="615.6" y1="0" x2="464.4" y2="1350" stroke="#fff" stroke-width="18" opacity=".55" filter="url(#seamGlow)"/>
        <line x1="615.6" y1="0" x2="464.4" y2="1350" stroke="#fff" stroke-width="4"/>
      </svg>
      <img data-p="0" class="player player-a ${d.a.photo ? '' : 'empty'}" style="${playerTransform(d.a)}" src="${esc(d.a.photo)}" alt="">
      <img data-p="1" class="player player-b ${d.b.photo ? '' : 'empty'}" style="${playerTransform(d.b)}" src="${esc(d.b.photo)}" alt="">
      <div class="floor"></div>
      <div class="top-shade"></div>
      <header>
        ${mv('brand', `<div class="brand">${d.logo ? `<img src="${esc(d.logo)}" alt="">` : `<div class="wordmark">eFCB</div>`}</div>`)}
        ${d.tag ? mv('tag', `<div class="tag">${esc(d.tag)}</div>`) : ''}
        ${mv('title', `<div class="kicker">${esc(d.kicker)}</div>
        <h1 class="${String(d.title || '').length > 16 ? 'long' : ''}">${esc(d.title)}</h1>`)}
      </header>
      ${rows ? mv('stats', `<div class="panel">${rows}</div>`) : ''}
      ${mv('nameA', `<div class="plate plate-a"><div class="${nameCls(d.a.name)}">${esc(d.a.name)}</div><div class="team">${esc(d.a.team)}</div></div>`)}
      ${mv('vs', `<div class="vs"><span>VS</span></div>`)}
      ${mv('nameB', `<div class="plate plate-b"><div class="${nameCls(d.b.name)}">${esc(d.b.name)}</div><div class="team">${esc(d.b.team)}</div></div>`)}
      ${mv('partners', `<footer class="spf"><div class="k">${esc(d.partnersLabel || '').toUpperCase()}</div><div class="sprow">${(d.partners || []).map(p => `<div>${p.logo ? `<img src="${esc(p.logo)}" alt="">` : esc(p.name)}</div>`).join('')}</div><div class="w">${esc(d.site || '').toUpperCase()}</div></footer>`)}
    </div>`;
  }

  window.renderComparison = renderComparison;
  window.playerTransform = playerTransform;
})();
