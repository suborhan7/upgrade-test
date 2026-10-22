/* Renders the Match Result poster into a container.
   renderMatch(container, data)
   data = {
     layout: 'wave' | 'ticket' (player mode) | 'clash' | 'victory' | 'torn' (team mode, drawn by js/team.js), bgMode: 'template' | 'jersey' | 'image', bgImage,
     tag, kicker, label, date, partnersLabel, partners [{ name, logo }], site, logo,
     teams: [{ name, player, score, scorers, photo, logo, primary, secondary, dx, dy, zoom }, { ... }]
   }
   Wave puts the winner in the top half; Ticket keeps team 1 on the left.
   Every element is an editor section (data-move, see js/studio-edit.js): mv = its own layer over the box it sits in,
   w = an in-flow wrapper (wf keeps a flex child blockified, wr also keeps it on the right). Photos are data-p="team". */
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---- colour helpers ----
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const toRgb = hex => { const n = parseInt(String(hex || '#000').replace('#', '').padEnd(6, '0').slice(0, 6), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  function toHsl(hex) {
    let [r, g, b] = toRgb(hex).map(v => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return [0, 0, l];
    const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
    const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  }
  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
    const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  }
  const lum = hex => { const [r, g, b] = toRgb(hex).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };

  // one strong colour per team from its jersey: the shirt colour, the trim of a white/black kit, or purple for a plain black/white kit
  function teamColor(t) {
    const [h, s, l] = toHsl(t.primary), [sh, ss, sl] = toHsl(t.secondary);
    const neutral = s < .25 || l < .12 || l > .92, trim = ss > .25 && sl > .12 && sl < .9;
    if (!neutral) return { c: hsl(h, Math.max(s, .7), clamp(l, .4, .56)), plain: false };
    if (trim) return { c: hsl(sh, Math.max(ss, .65), clamp(sl, .38, .5)), plain: false };
    return { c: '#7b3fe4', plain: true };
  }
  // the second, contrasting colour that goes with a team colour (never monochrome)
  function popFor(c, plain) {
    if (plain) return '#f5c542';
    const [h, s] = toHsl(c);
    if (s < .25) return '#22d3ee';
    if (h >= 25 && h < 80) return '#7b3fe4';    // yellow / gold / orange -> purple
    if (h < 25 || h >= 330) return '#ffc23a';   // red -> gold
    if (h < 200) return '#ffd23a';              // green / teal -> warm gold
    if (h < 262) return '#2de2c9';              // blue -> teal
    return '#ff4fd8';                           // purple -> pink
  }
  const deepOf = c => { const [h, s, l] = toHsl(c); return hsl(h, s, l * .42); };
  const onPaper = c => { const [h, s, l] = toHsl(c); return lum(c) > .4 ? hsl(h, s, Math.min(l, .4)) : c; };

  // fixed eFCB templates (same for every jersey) and the colours an uploaded background uses
  const TPL = {
    wave: { a1: '#5b2bff', a1d: '#2a0f8f', a2: '#ff4fd8', b1: '#ff6a2b', b1d: '#d61f4d', b2: '#ffc23a', onA: '#fff', onB: '#fff' },
    ticket: { t1: '#ff2e88', t2: '#2f6bff', t3: '#ffb020', t1d: '#e0136f', t2d: '#2353e0' },
  };
  function wavePalette(top, bot, mode) {
    if (mode !== 'jersey') return TPL.wave;
    const A = teamColor(top), B = teamColor(bot);
    return { a1: A.c, a1d: deepOf(A.c), a2: popFor(A.c, A.plain), b1: B.c, b1d: deepOf(B.c), b2: popFor(B.c, B.plain),
      onA: lum(A.c) > .5 ? '#16121f' : '#fff', onB: lum(B.c) > .5 ? '#16121f' : '#fff' };
  }
  function ticketPalette(t1, t2, mode) {
    if (mode !== 'jersey') return TPL.ticket;
    const A = teamColor(t1), B = teamColor(t2);
    return { t1: A.c, t2: B.c, t3: popFor(A.c, A.plain), t1d: onPaper(A.c), t2d: onPaper(B.c) };
  }
  const cssVars = p => Object.entries(p).map(([k, v]) => `--${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${v}`).join(';');

  // ---- text helpers ----
  const initials = n => String(n || '').split(/\s+/).filter(Boolean).slice(0, 3).map(w => w[0]).join('').toUpperCase();
  function twoLines(n) {   // team name on up to two lines, split at the middle word
    const w = String(n || '').trim().split(/\s+/).filter(Boolean);
    if (w.length < 2) return esc(w.join(' '));
    const cut = Math.ceil(w.length / 2);
    return esc(w.slice(0, cut).join(' ')) + '<br>' + esc(w.slice(cut).join(' '));
  }
  const scorerList = s => String(s || '').split(/[\n,]+/).map(x => x.trim()).filter(Boolean);
  const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  function photoTransform(t, base) {
    const dx = +t.dx || 0, dy = +t.dy || 0, z = +t.zoom || 1;
    return `transform:${base || ''} translate(${dx}px, ${dy}px) scale(${z});`;
  }
  const mv = (k, h) => `<div class="mv" data-move="${k}">${h}</div>`;
  const w = (k, h, c) => `<div${c ? ` class="${c}"` : ''} data-move="${k}">${h}</div>`;
  const crest = t => t.logo ? `<img src="${esc(t.logo)}" alt="">` : esc(initials(t.name));

  function renderWave(d, mode, custom) {
    const [t0, t1] = d.teams;
    const draw = num(t0.score) === num(t1.score);
    const wi = num(t1.score) > num(t0.score) ? 1 : 0;     // winner sits on top (team 1 on a draw)
    const top = d.teams[wi], bot = d.teams[1 - wi];
    const p = wavePalette(top, bot, mode);
    const fill = custom ? '' : `<defs><linearGradient id="mrg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.b1}"/><stop offset="1" stop-color="${p.b1d}"/></linearGradient></defs>`;
    const wave = 'M0 790 C 260 690, 420 920, 700 820 S 1000 740, 1080 800';
    const wave2 = 'M0 812 C 260 712, 420 942, 700 842 S 1000 762, 1080 822';
    const sc = scorerList(top.scorers), sb = scorerList(bot.scorers);
    const brand = d.logo ? `<div class="abs brand logo"><img src="${esc(d.logo)}" alt=""></div>` : `<div class="abs brand">eFCB</div>`;
    const topTag = draw ? w('playerT', `<div class="res">${esc(top.player)}</div>`) : w('playerT', `<div class="wplayer">${esc(top.player)}</div>`) + w('badgeT', '<div class="winbadge"><b></b>WINNER</div>');
    const botTag = draw ? w('playerB', `<div class="res">${esc(bot.player)}</div>`) : `<div class="lrow">${w('playerB', `<div class="wplayer lp">${esc(bot.player)}</div>`)}${w('badgeB', '<div class="losebadge"><b></b>DEFEAT</div>', 'wf')}</div>`;
    const body = `
      ${custom ? `<div class="bgimg" style="background-image:url('${esc(d.bgImage)}')"></div>` : ''}
      <div class="top"></div><div class="contour"></div><div class="abs halo2"></div><div class="abs halo"></div>
      <img class="abs player pa ${top.photo ? '' : 'empty'}" data-p="${wi}" style="${photoTransform(top)}" src="${esc(top.photo)}" alt="">
      <svg class="botwrap" viewBox="0 0 1080 1350" preserveAspectRatio="none">${fill}
        <path d="${wave} L1080 1350 L0 1350 Z" fill="${custom ? 'rgba(11,11,20,.55)' : 'url(#mrg)'}"/>
        <path d="${wave}" fill="none" stroke="#fff" stroke-width="10"/>
        <path d="${wave2}" fill="none" stroke="${p.a2}" stroke-width="5" opacity=".9"/>
      </svg>
      <img class="abs player pb ${bot.photo ? '' : 'empty'}" data-p="${1 - wi}" style="${photoTransform(bot)}" src="${esc(bot.photo)}" alt="">
      ${mv('brand', brand)}${d.tag ? mv('tag', `<div class="abs tag">${esc(d.tag)}</div>`) : ''}${mv('kick', `<div class="abs kick">${esc(d.kicker)}</div>`)}
      <div class="abs ta">${w('crestT', `<div class="crest">${draw ? '' : '<i class="crown">👑</i>'}${crest(top)}</div>`)}${w('nameT', `<div class="tname">${twoLines(top.name)}</div>`)}${topTag}
        ${sc.length ? w('scorersT', `<div class="scorers">${sc.map(esc).join(' · ')}</div>`) : ''}</div>
      <div class="abs tb">${w('crestB', `<div class="crest">${crest(bot)}</div>`)}${w('nameB', `<div class="tname">${twoLines(bot.name)}</div>`)}${botTag}
        ${sb.length ? w('scorersB', `<div class="scorers">${sb.map(esc).join(' · ')}</div>`) : ''}</div>
      ${mv('score', `<div class="abs medal" style="--wc:${p.a2}">${mv('scoreTag', draw ? '<span class="wtag">DRAW</span>' : '<span class="wtag">▲ WINNER</span>')}
        <div class="disc"><div class="ft">${esc(d.label || 'Full time')}</div>
          <div class="sc"><span class="${draw ? '' : 'w'}">${esc(top.score)}</span><i>:</i><span class="${draw ? '' : 'l'}">${esc(bot.score)}</span></div>
          <div class="date">${esc(d.date)}</div></div></div>`)}
      <div class="grain"></div>
      ${mv('partners', `<footer class="spf"><div class="k">${esc(d.partnersLabel || '').toUpperCase()}</div><div class="sprow">${(d.partners || []).map(p => `<div>${p.logo ? `<img src="${esc(p.logo)}" alt="">` : esc(p.name)}</div>`).join('')}</div><div class="w">${esc(d.site || '').toUpperCase()}</div></div>`)}`;
    return { cls: 'wave', vars: cssVars(p), body };
  }

  function renderTicket(d, mode, custom) {
    const [A, B] = d.teams;
    const p = ticketPalette(A, B, mode);
    const sa = num(A.score), sb = num(B.score);
    const tagFor = (i, t) => {
      const c = i === 0 ? 'var(--t1d)' : 'var(--t2d)';
      const tag = sa === sb ? '' : w('result' + (i + 1), (i === 0 ? sa > sb : sb > sa) ? '<span class="tag2 tw"><b></b>WINNER</span>' : '<span class="tag2 tl"><b></b>DEFEAT</span>', 'wf');
      return `<div class="prow" style="--tc:${c}">${tag}${w('player' + (i + 1), `<span class="pn">${esc(t.player)}</span>`, 'wf')}</div>`;
    };
    const half = (i, t) => `<div class="half h${i + 1}"><img class="player ${t.photo ? '' : 'empty'}" data-p="${i}" style="${photoTransform(t, 'translateX(-50%)')}" src="${esc(t.photo)}" alt="">
      ${t.player ? mv('chip' + (i + 1), `<div class="chip">${esc(t.player)}</div>`) : ''}</div>`;
    const li = s => scorerList(s).map(x => `<li>${esc(x)}</li>`).join('');
    const brand = d.logo ? `<div class="brand logo"><img src="${esc(d.logo)}" alt=""></div>` : `<div class="brand">eFCB</div>`;
    const words = String(d.title || 'Match Result').split(' ');
    const title = words.length > 1 ? `${esc(words.slice(0, -1).join(' '))} <span>${esc(words[words.length - 1])}</span>` : `<span>${esc(words[0])}</span>`;
    const body = `
      ${custom ? `<div class="bgimg" style="background-image:url('${esc(d.bgImage)}')"></div>` : '<div class="mesh"></div><div class="grain"></div>'}
      <div class="abs top">${w('brand', brand)}${d.tag ? w('tag', `<div class="tag">${esc(d.tag)}</div>`, 'wr') : ''}</div>
      ${mv('card', `<div class="abs card">
        <div class="head">${w('title', `<div class="title">${title}</div>`)}${w('kick', `<div class="kick">${esc(d.kicker)}</div>`, 'wr')}</div>
        ${mv('photos', `<div class="window">${half(0, A)}${half(1, B)}${mv('vs', '<div class="vs">VS</div>')}</div>`)}
        <div class="stub"><div class="team">${w('name1', `<div class="tname">${twoLines(A.name)}</div>`)}${tagFor(0, A)}</div>
          ${w('score', `<div class="score"><span class="x">${esc(A.score)}</span><i>–</i><span class="y">${esc(B.score)}</span></div>`)}
          <div class="team r">${w('name2', `<div class="tname">${twoLines(B.name)}</div>`)}${tagFor(1, B)}</div></div>
        <div class="details">${w('scorers1', `<ul class="l">${li(A.scorers)}</ul>`)}${w('scorers2', `<ul class="r">${li(B.scorers)}</ul>`)}</div>
        ${mv('line', '<div class="perf"></div>')}
        <div class="meta">${w('info', `<div class="info"><span>${esc(d.label || 'Full time')}</span>${esc(d.date)}<br>${esc(d.kicker)}</div>`)}${w('barcode', '<div class="bar"></div>', 'wr')}</div>
      </div>`)}
      ${mv('partners', `<footer class="spf"><div class="k">${esc(d.partnersLabel || '').toUpperCase()}</div><div class="sprow">${(d.partners || []).map(p => `<div>${p.logo ? `<img src="${esc(p.logo)}" alt="">` : esc(p.name)}</div>`).join('')}</div><div class="w">${esc(d.site || '').toUpperCase()}</div></div>`)}`;
    return { cls: 'ticket', vars: cssVars(p), body };
  }

  // long team names shrink until they fit their space
  function fitNames(root) {
    root.querySelectorAll('.wave .tname').forEach(n => {
      const lo = n.closest('.tb'), max = lo ? 560 : 450;
      let fs = lo ? 54 : 84; n.style.fontSize = fs + 'px';
      while (n.scrollWidth > max && fs > 34) { fs -= 2; n.style.fontSize = fs + 'px'; }
    });
    root.querySelectorAll('.ticket .tname').forEach(n => {
      let fs = 38; n.style.fontSize = fs + 'px';
      while (n.scrollWidth > 300 && fs > 24) { fs -= 2; n.style.fontSize = fs + 'px'; }
    });
  }

  function renderMatch(el, d) {
    const mode = d.bgMode || 'template';
    const custom = mode === 'image' && !!d.bgImage;
    if (window.MR_TEAM_LAYOUTS && MR_TEAM_LAYOUTS.includes(d.layout)) return renderMatchTeam(el, d);   // team mode, js/team.js
    const r = (d.layout === 'ticket' ? renderTicket : renderWave)(d, mode, custom);
    el.innerHTML = `<div class="mr ${r.cls} ${custom ? 'custom-bg' : ''}" style="${r.vars}">${r.body}</div>`;
    fitNames(el);
  }

  window.renderMatch = renderMatch;
  window.matchPhotoTransform = photoTransform;
  window.MR_COLORS = { teamColor, popFor, deepOf, lum, toHsl, hsl };
})();
