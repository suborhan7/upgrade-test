/* Renders the MVP poster into a container.
   renderMvp(container, data)
   data = {
     tag, kicker, title, partnersLabel, partners [{ name, logo }], site, logo (image url or ''),
     player: { name, team, photo, primary, secondary, dx, dy, zoom },   // jersey colours as hex
     match: { score, opponent },
     stats: [{ label, value }]   // first one is the big headline number, max 5
   }
   Every text block sits in its own .mv wrapper (data-move="key") so the admin can drag, size or remove it (js/studio-edit.js);
   inside the Split info panel the blocks carry data-move themselves (a full-poster wrapper would break the panel's column).
   The photo carries data-p="0". */
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // position set in the maker: dx/dy in poster pixels, zoom 1 = default size (scaled from the top so the head stays put)
  function playerTransform(pl) {
    const dx = +pl.dx || 0, dy = +pl.dy || 0, z = +pl.zoom || 1;
    return `transform: translateX(-50%) translate(${dx}px, ${dy}px) scale(${z}); transform-origin: 50% 0;`;
  }

  // movable section; js/studio-edit.js sets its style after each render (see mvpMoveStyle)
  const mv = (key, html) => `<div class="mv" data-move="${key}">${html}</div>`;
  const SPLIT_INNER = ['tag', 'title', 'bigword', 'name', 'team', 'stats', 'score'];
  // admin's drag/size of one section; full-poster wrappers scale around the block's centre (ox, oy), panel blocks around their own
  window.mvpMoveStyle = (st, key) => {
    const o = ((st.moves || {})[st.layout || 'current'] || {})[key] || {}, x = o.x || 0, y = o.y || 0, s = o.s || 1;
    if ((st.layout === 'split') && SPLIT_INNER.includes(key)) return x || y || s !== 1 ? `transform:translate(${x}px,${y}px)${s !== 1 ? ` scale(${s})` : ''}` : '';
    return `transform:translate(${x}px,${y}px)${s !== 1 ? ` scale(${s})` : ''};transform-origin:${o.ox || 540}px ${o.oy || 675}px`;
  };

  function renderMvp(el, d) {
    const p = d.vivid ? JerseyColors.vividPalette(d.player.primary, d.player.secondary, d.neutralTheme) : JerseyColors.paletteFor(d.player.primary, d.player.secondary);
    // background: 'template' = fixed eFCB look, 'jersey' = colours from the kit, 'image' = admin's own upload
    const mode = d.bgMode || 'jersey';
    const custom = mode === 'image' && d.bgImage;
    // template/upload, or a plain black/white kit -> dark base with a two-colour pair
    const premium = d.vivid && (mode !== 'jersey' || JerseyColors.isPlainNeutral(d.player.primary, d.player.secondary));
    // black base + two colours: c1 = main accent, c2 = second colour (like yellow + purple)
    const PREMIUM = {
      'gold-purple': ['#f5c542', '#7b3fe4'], 'cyan-magenta': ['#22d3ee', '#d946ef'], 'orange-blue': ['#ff7a1a', '#3b82f6'],
      'red-gold': ['#ff3b4e', '#f5c542'], 'green-cyan': ['#39e58c', '#22b8ee'],
    };
    // fixed templates: each has its own background design and colour pair, whatever the jersey
    const TEMPLATES = {
      shatter: ['#ff7a1a', '#3b82f6'], neon: ['#22d3ee', '#e040fb'],
    };
    const tpl = mode === 'template' ? (TEMPLATES[d.template] ? d.template : 'shatter') : '';
    const pair = tpl ? TEMPLATES[tpl] : (PREMIUM[d.premiumAccent] || PREMIUM['gold-purple']);
    if (premium) { p.accent = pair[0]; p.c2 = pair[1]; p.onAccent = '#0b0d12'; }
    const vars = `--k-base:${p.base};--k-deep:${p.deep};--k-mid:${p.mid};--k-glow:${p.glow};--k-stripe:${p.stripe};--k-accent:${p.accent};--k-on:${p.onAccent};`;
    const pc = d.vivid ? p : JerseyColors.popColors(p.accent);
    const pvars = `--k-pop:${pc.pop};--k-pop2:${pc.pop2};--k-ana:${pc.ana};--k-mvp:${pc.mvp || pc.pop};--k-mvp-sh:${pc.mvpShadow || pc.ana};${premium ? `--k-c2:${pair[1]};` : ''}`;
    const stats = d.stats.filter(s => s.label || s.value).slice(0, 5).map((s, i) =>
      `<div class="stat ${i === 0 ? 'hero' : ''}"><div class="v">${esc(s.value)}</div><div class="l">${esc(s.label)}</div></div>`).join('');
    const pl = d.player, m = d.match || {};
    const longName = String(pl.name || '').length > 13 ? 'long' : '';

    const layout = d.layout || 'current';
    const matchLine = [pl.team, m.score ? `${m.score}${m.opponent ? ' vs ' + m.opponent : ''}` : ''].filter(Boolean).map(esc).join('<i>·</i>');
    const brand = mv('brand', `<div class="brand">${d.logo ? `<img src="${esc(d.logo)}" alt="">` : `<div class="wordmark">eFCB</div>`}</div>`);
    const tag = d.tag ? mv('tag', `<div class="tag">${esc(d.tag)}</div>`) : '';
    const bg = custom ? `<div class="bgimg" style="background-image:url('${esc(d.bgImage)}')"></div>` : `<div class="bg"></div><div class="stripes"></div><div class="dots"></div>
      <div class="glow"></div><div class="rings"></div><div class="streaks"></div>`;
    const img = `<img data-p="0" class="player ${pl.photo ? '' : 'empty'}" style="${playerTransform(pl)}" src="${esc(pl.photo)}" alt="">`;
    const footer = mv('partners', `<footer class="spf"><div class="k">${esc(d.partnersLabel || '').toUpperCase()}</div><div class="sprow">${(d.partners || []).map(p => `<div>${p.logo ? `<img src="${esc(p.logo)}" alt="">` : esc(p.name)}</div>`).join('')}</div><div class="w">${esc(d.site || '').toUpperCase()}</div></footer>`);
    const plate = sub => mv('name', `<div class="plate"><div class="name ${longName}">${esc(pl.name)}</div>${sub}</div>`);
    let body;

    if (layout === 'big') {
      // giant MVP letters behind the player, stats strip across the bottom
      body = `${bg}${mv('bigword', `<div class="bigword">MVP</div>`)}${img}<div class="floor"></div><div class="top-shade"></div>
        <header>${brand}${tag}${mv('title', `<div class="kicker">${esc(d.kicker)}</div>`)}</header>
        ${stats ? mv('stats', `<div class="stats">${stats}</div>`) : ''}
        ${plate(`<div class="sub">${matchLine}</div>`)}`;
    } else if (layout === 'rating') {
      // left-aligned title, huge rating number, small stat grid, full-width name plate
      const [hero, ...rest] = d.stats.filter(s => s.label || s.value).slice(0, 5);
      body = `${bg}${img}<div class="floor"></div><div class="top-shade"></div>
        <header>${brand}${tag}${mv('title', `<div class="kicker">${esc(d.kicker)}</div><h1>${esc(d.title)}</h1>`)}</header>
        ${hero ? mv('rating', `<div class="rating"><div class="v">${esc(hero.value)}</div><div class="l">${esc(hero.label)}</div></div>`) : ''}
        ${rest.length ? mv('grid', `<div class="grid">${rest.map(s => `<div class="cell"><div class="v">${esc(s.value)}</div><div class="l">${esc(s.label)}</div></div>`).join('')}</div>`) : ''}
        ${plate(`<div class="sub">${matchLine}</div>`)}`;
    } else if (layout === 'split') {
      // player on the left, solid info panel on the right
      const rows = d.stats.filter(s => s.label || s.value).slice(0, 5).map((s, i) =>
        `<div class="trow ${i === 0 ? 'hero' : ''}"><span>${esc(s.label)}</span><b>${esc(s.value)}</b></div>`).join('');
      body = `${bg}${img}<div class="floor"></div>
        <header>${brand}</header>
        ${mv('info', `<aside class="info">
          ${d.tag ? `<div class="tag" data-move="tag">${esc(d.tag)}</div>` : ''}
          <div class="kicker" data-move="title">${esc(d.kicker)}</div>
          <div class="mvpword" data-move="bigword">MVP</div>
          <div class="name ${longName}" data-move="name">${esc(pl.name)}</div>
          <div class="team" data-move="team">${esc(pl.team)}</div>
          <div class="table" data-move="stats">${rows}</div>
          ${m.score ? `<div class="result" data-move="score"><span>${esc(m.label || 'Full time')}</span><b>${esc(m.score)}</b><span>${m.opponent ? 'vs ' + esc(m.opponent) : ''}</span></div>` : ''}
        </aside>`)}`;
    } else {
      body = `${bg}${img}<div class="floor"></div><div class="top-shade"></div>
        <header>${brand}${tag}${mv('title', `<div class="kicker">${esc(d.kicker)}</div>
          <h1 class="${String(d.title || '').length > 16 ? 'long' : ''}">${esc(d.title)}</h1>`)}</header>
        ${stats ? mv('stats', `<div class="stats">${stats}</div>`) : ''}
        ${plate(`<div class="team">${esc(pl.team)}</div>`)}
        ${m.score || m.opponent ? mv('score', `<div class="match"><div class="lbl">${esc(m.label || 'Full time')}</div><div class="score">${esc(m.score)}</div><div class="vs">${m.opponent ? 'vs ' + esc(m.opponent) : ''}</div></div>`) : ''}`;
    }
    el.innerHTML = `<div class="mvp layout-${esc(layout)} ${d.vivid ? 'vivid' : ''} ${premium ? 'premium' : ''} ${custom ? 'custom-bg' : ''} ${tpl ? 'tpl-' + tpl : ''}" style="${vars}${pvars}">${body}${footer}</div>`;
  }

  window.renderMvp = renderMvp;
  window.playerTransform = playerTransform;
})();
