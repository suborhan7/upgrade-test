/* Team vs Team poster renderer: renderTvt(el, state). Club crest vs club crest, four layouts from shifty's references:
   ball (crests wrapped round 3D footballs), smoke (team-colour smoke over a pitch), stad (floodlit stadium, crests on
   shield cards), brush (neon panels with paint strokes), clash (Crest Clash: team-colour halves split by a lightning seam,
   crests on glowing rings, a chrome VS in a hex plate, the stage title in giant outline letters behind) and torn (Torn
   Poster: a torn paper strip with VS stamped on it, one team above it and one below, halftone dots). In smoke and brush a
   team can show its captain's photo instead of the crest; the crest then sits next to the team name. In clash and torn the
   captain stands behind (or in front of) the crest, which stays.
   Every text block sits in a .mv wrapper so the admin can drag it and wheel-resize it; see tvtMoveStyle. */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dk = (hx, k) => { const n = parseInt(hx.slice(1), 16), f = c => Math.round(c * k).toString(16).padStart(2, '0'); return '#' + f(n >> 16) + f(n >> 8 & 255) + f(n & 255); };
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const hue = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255), mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
    if (!d) return [0, 0]; const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(h * 60 + 360) % 360, d / mx]; };

  // fixed colours per layout in "Default template" mode: [team 1, team 1 light, team 2, team 2 light]
  const TPL = {
    ball: null,   // the balls always wear the team colours
    smoke: ['#1f6bff', '#7fb0ff', '#ff2d7a', '#ff8fb8'],
    stad: ['#1f7a34', '#3fae5a', '#1f7a34', '#3fae5a'],
    brush: ['#e0213f', '#ff6b80', '#3fc3f0', '#a8e6ff'],
    clash: ['#ff2e63', '#ff8fa8', '#19c7ff', '#9fe6ff'],
    torn: ['#ff5a1f', '#ffa47a', '#2453ff', '#8fa6ff'],
  };

  /* Where each team's crest (box: centre + size) or captain photo (slot: body centre x, head-top line, head width,
     floor where the photo is cut; clip = the panel it lives in) goes. */
  const ITEMS = {
    ball:  [{ box: { cx: 262, cy: 660, s: 400 } }, { box: { cx: 818, cy: 660, s: 400 } }],
    smoke: [{ box: { cx: 260, cy: 575, s: 340 }, slot: { x: 262, top: 420, head: 132, floor: 868 } },
            { box: { cx: 820, cy: 575, s: 340 }, slot: { x: 818, top: 420, head: 132, floor: 868 } }],
    stad:  [{ box: { cx: 250, cy: 655, s: 250 } }, { box: { cx: 830, cy: 655, s: 250 } }],
    brush: [{ box: { cx: 270, cy: 640, s: 340 }, slot: { x: 270, top: 430, head: 140, floor: 990 }, clip: 'inset(290px 600px 360px 60px)' },
            { box: { cx: 810, cy: 640, s: 340 }, slot: { x: 810, top: 430, head: 140, floor: 990 }, clip: 'inset(290px 60px 360px 600px)' }],
    // box = the crest spot without a captain (the crest itself is a movable section in these two)
    // (cut = where the photo is cut off when it is lower than the floor it stands on)
    clash: [{ box: { cx: 250, cy: 600, s: 250 }, slot: { x: 250, top: 300, head: 118, floor: 872, cut: 900 } },
            { box: { cx: 830, cy: 600, s: 250 }, slot: { x: 830, top: 300, head: 118, floor: 872, cut: 900 } }],
    // a vs card: both captains get the same head size
    torn:  [{ box: { cx: 540, cy: 220, s: 240 }, slot: { x: 270, top: 300, head: 112, floor: 900 } },
            { box: { cx: 185, cy: 1075, s: 230 }, slot: { x: 830, top: 780, head: 112, floor: 1255 } }],
  };
  const CAPTAIN = { smoke: 1, brush: 1, clash: 1, torn: 1 };
  const showCaptain = (st, t) => CAPTAIN[st.layout] && t.captain && t.photo;
  window.tvtSlots = st => ITEMS[st.layout];
  window.tvtHasCaptain = L => !!CAPTAIN[L];

  // admin's own drags/sizes of text sections, kept apart for each layout
  window.tvtMoveKey = st => st.layout;
  window.tvtMoveStyle = (st, key) => {
    const o = ((st.moves || {})[tvtMoveKey(st)] || {})[key] || {}, sc = o.s || 1;
    return `transform:translate(${o.x || 0}px,${o.y || 0}px)${sc !== 1 ? ` scale(${sc})` : ''};transform-origin:${o.ox || 540}px ${o.oy || 675}px`;
  };

  // captain photo placed by head size (m = head measurement from maker.js)
  function place(t, slot) {
    const m = t.m;
    if (!m) return null;
    const s = slot.head / m.head * t.zoom;
    let top = slot.top - m.top * s;
    const bottom = top + m.h * s;
    if (bottom < slot.floor + 4 && t.zoom >= 1) top += slot.floor + 4 - bottom;   // short chest-up crop: push down so it never floats
    return { left: slot.x - m.cx * s + t.dx, top: top + t.dy, w: m.w * s, h: m.h * s };
  }
  const css = p => `left:${p.left.toFixed(1)}px;top:${p.top.toFixed(1)}px;width:${p.w.toFixed(1)}px;height:${p.h.toFixed(1)}px`;
  window.tvtPhotoStyle = (t, slot) => { const p = place(t, slot); return p ? css(p) : ''; };
  const boxOf = (t, it) => { const s = it.box.s * t.zoom; return { left: it.box.cx - s / 2 + t.dx, top: it.box.cy - s / 2 + t.dy, w: s, h: s }; };
  // style of whatever stands for the team (photo or crest/ball) — maker.js uses it while dragging
  window.tvtItemStyle = (t, it, st) => (st && showCaptain(st, t) && it.slot) ? tvtPhotoStyle(t, it.slot) : css(boxOf(t, it));

  /* Wrapped ball: the crest and football panels are painted on a flat skin (longitude x latitude), then every pixel of
     the ball looks its colour up on that skin through a sphere projection, so the crest bends round the ball like a
     flag. A crest in the team's own colour (red Liverpool bird) would vanish on a ball of that colour, so such balls
     are white with team-colour seams. Results are cached; a new ball redraws the poster when it is ready. */
  const sphereCache = {};
  const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  async function makeSphere(t, turn) {
    const logo = await loadImg(t.logo), TW = 1600, TH = 1000;
    const tx = document.createElement('canvas'); tx.width = TW; tx.height = TH;
    const g = tx.getContext('2d', { willReadFrequently: true });
    // crest colour vs team colour
    g.drawImage(logo, 0, 0, 200, 200);
    const px = g.getImageData(0, 0, 200, 200).data; let hx = 0, hy = 0, n = 0;
    for (let i = 0; i < px.length; i += 16) {
      if (px[i + 3] < 200) continue;
      const mx = Math.max(px[i], px[i + 1], px[i + 2]), mn = Math.min(px[i], px[i + 1], px[i + 2]);
      if (mx < 50 || (mx - mn) / mx < 0.35) continue;
      const [h] = hue('#' + [px[i], px[i + 1], px[i + 2]].map(v => v.toString(16).padStart(2, '0')).join(''));
      hx += Math.cos(h * Math.PI / 180); hy += Math.sin(h * Math.PI / 180); n++;
    }
    const [th, ts] = hue(t.c), lh = (Math.atan2(hy, hx) * 180 / Math.PI + 360) % 360;
    const strength = n ? Math.hypot(hx, hy) / n : 0, diff = Math.min(Math.abs(lh - th), 360 - Math.abs(lh - th));
    const white = ts > 0.35 && strength > 0.6 && diff < 28;
    g.clearRect(0, 0, TW, TH);
    const lg = g.createLinearGradient(0, 0, 0, TH);
    if (white) { lg.addColorStop(0, '#ffffff'); lg.addColorStop(.5, '#f2f2f4'); lg.addColorStop(1, '#a9a9ae'); }
    else { lg.addColorStop(0, t.c2); lg.addColorStop(.5, t.c); lg.addColorStop(1, dk(t.c, .55)); }
    g.fillStyle = lg; g.fillRect(0, 0, TW, TH);
    g.strokeStyle = white ? t.c : dk(t.c, .35); g.lineWidth = 7; g.globalAlpha = white ? .35 : .55;
    const hs = 120, rt = Math.sqrt(3);
    for (let row = -1; row < TH / (hs * 1.5) + 1; row++) for (let col = -1; col < TW / (hs * rt) + 1; col++) {
      const x = col * hs * rt + (row % 2 ? hs * rt / 2 : 0), y = row * hs * 1.5;
      g.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k + Math.PI / 6; g.lineTo(x + hs * Math.cos(a), y + hs * Math.sin(a)); } g.closePath(); g.stroke();
    }
    g.globalAlpha = 1;
    // skin spans longitude -150..150 and latitude -90..90; the crest covers about -55..55 by -50..50
    const lw = TW * 110 / 300, lh2 = TH * 100 / 180, k = Math.min(lw / logo.width, lh2 / logo.height);
    g.drawImage(logo, TW / 2 - logo.width * k / 2, TH / 2 - logo.height * k / 2, logo.width * k, logo.height * k);
    const src = g.getImageData(0, 0, TW, TH).data;
    const D = 800, R = D / 2, tilt = -0.18, out = document.createElement('canvas'); out.width = out.height = D;
    const o = out.getContext('2d'), od = o.createImageData(D, D);
    for (let py = 0; py < D; py++) for (let qx = 0; qx < D; qx++) {
      const x = (qx + .5 - R) / R, y = (py + .5 - R) / R, d2 = x * x + y * y;
      if (d2 > 1) continue;
      const z = Math.sqrt(1 - d2), yy = y * Math.cos(tilt) - z * Math.sin(tilt), zz = y * Math.sin(tilt) + z * Math.cos(tilt);   // tipped back a little
      const lon = Math.atan2(x, zz) + turn, lat = Math.asin(Math.max(-1, Math.min(1, yy)));
      const u = Math.max(0, Math.min(TW - 1, Math.round((lon / (Math.PI * 300 / 180) + .5) * (TW - 1))));
      const v = Math.max(0, Math.min(TH - 1, Math.round((lat / Math.PI + .5) * (TH - 1))));
      const si = (v * TW + u) * 4, di = (py * D + qx) * 4;
      od.data[di] = src[si]; od.data[di + 1] = src[si + 1]; od.data[di + 2] = src[si + 2];
      od.data[di + 3] = d2 > .985 ? Math.round(255 * (1 - d2) / .015) : 255;   // soft round edge
    }
    o.putImageData(od, 0, 0);
    o.globalCompositeOperation = 'source-atop';   // key light top-left, dark rim, small specular spot
    let gr = o.createRadialGradient(R * .7, R * .6, R * .1, R, R, R);
    gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(.5, 'rgba(255,255,255,0)'); gr.addColorStop(.82, 'rgba(0,0,0,.12)'); gr.addColorStop(1, 'rgba(0,0,0,.7)');
    o.fillStyle = gr; o.fillRect(0, 0, D, D);
    gr = o.createRadialGradient(R * .62, R * .5, 0, R * .62, R * .5, R * .32);
    gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    o.fillStyle = gr; o.fillRect(0, 0, D, D);
    return out.toDataURL('image/png');
  }
  function sphereOf(t, turn) {
    if (!t.logo) return null;
    const key = [t.logo.length, t.logo.slice(-40), t.c, t.c2, turn].join('|');
    if (!(key in sphereCache)) {
      sphereCache[key] = null;
      makeSphere(t, turn).then(url => { sphereCache[key] = url; document.dispatchEvent(new Event('tvt-redraw')); })
        .catch(e => console.warn('Ball failed', e));
    }
    return sphereCache[key];
  }
  window.tvtSpheresReady = () => Object.values(sphereCache).every(Boolean);

  function renderTvt(root, st) {
    const L = st.layout, [A, B] = st.teams, R = rng(7);
    const tpl = st.bgMode === 'template' && TPL[L];
    const [a, a2, b, b2] = tpl || [A.c, A.c2, B.c, B.c2];
    const isUp = st.bgMode === 'image' && st.bgImage;
    const up = isUp ? `<div class="upbg" style="background-image:url('${st.bgImage}')"></div><div class="wash"></div>` : '';
    const mv = (key, html) => `<div class="mv" data-move="${key}" style="${tvtMoveStyle(st, key)}">${html}</div>`;
    const sp = `<div class="sp"><div class="k">${esc(st.partnersLabel).toUpperCase()}</div><div class="row">${st.partners.map(p =>
      `<div>${p.logo ? `<img src="${p.logo}" alt="">` : esc(p.name)}</div>`).join('')}</div><div class="w">${esc(st.site).toUpperCase()}</div></div>`;
    const brand = `<div class="brand">${st.logo ? `<img src="${st.logo}" alt="">` : 'eFCB'}</div>`;
    const hdr = mv('head', `<div class="hdr">${brand}<div class="ev"><b>${esc(st.tag)}</b>${esc(st.date)}</div></div>`)
      + mv('title', `<div class="ttl"><b>${esc(st.title)}</b><span>${esc(st.event)}</span></div>`);
    const its = ITEMS[L];
    // team name, with the small crest in front when the captain's photo has the big spot; captain line under it
    const tn = t => `${showCaptain(st, t) && t.logo ? `<img class="tl" src="${t.logo}" alt="">` : ''}${esc(t.team)}`;
    const pn = t => showCaptain(st, t) ? esc(t.player) : '';
    const crest = (t, i, extra = '') => showCaptain(st, t)
      ? `<div class="slot" style="${its[i].clip ? `clip-path:${its[i].clip};` : `height:${its[i].slot.floor}px;`}"><img data-p="${i}" src="${t.photo}" style="${tvtPhotoStyle(t, its[i].slot)}" alt=""></div>`
      : t.logo ? `<div class="slot" style="${its[i].clip ? `clip-path:${its[i].clip}` : 'height:1200px'}"><img class="lg" data-p="${i}" src="${t.logo}" style="${css(boxOf(t, its[i]))};${extra}" alt=""></div>` : '';
    const time = esc(st.time), date = esc(st.date), extra = esc(st.extra);
    let h = '';

    if (L === 'ball') {
      const balls = [A, B].map((t, i) => {
        const url = sphereOf(t, i ? -.2 : .2), p = boxOf(t, its[i]);
        if (!url) return '';
        return `<div class="slot" style="height:1200px"><img class="refl" src="${url}" style="${css({ ...p, top: p.top + p.h })}" alt="">
          <div class="shadow" style="left:${p.left + p.w * .075}px;top:${p.top + p.h - p.h * .05}px;width:${p.w * .85}px;height:${p.h * .1}px"></div>
          <img class="lg ball3d" data-p="${i}" src="${url}" style="${css(p)}" alt=""></div>`;
      }).join('');
      h = `${up || `<svg class="full" viewBox="0 0 1080 1350"><defs>
          <radialGradient id="tvbg" cx="50%" cy="35%" r="80%"><stop offset="0" stop-color="#3a3d44"/><stop offset=".55" stop-color="#17191d"/><stop offset="1" stop-color="#08090b"/></radialGradient>
          <linearGradient id="tvfl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1d22"/><stop offset="1" stop-color="#050506"/></linearGradient>
          <filter id="tvtex"><feTurbulence type="fractalNoise" baseFrequency=".006" numOctaves="4" seed="4"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .5 -.12"/></filter>
          <radialGradient id="tvsA" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${A.c}" stop-opacity=".45"/><stop offset="1" stop-color="${A.c}" stop-opacity="0"/></radialGradient>
          <radialGradient id="tvsB" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${B.c}" stop-opacity=".45"/><stop offset="1" stop-color="${B.c}" stop-opacity="0"/></radialGradient></defs>
          <rect width="1080" height="1200" fill="url(#tvbg)"/><rect width="1080" height="1200" filter="url(#tvtex)" opacity=".5"/>
          <rect y="860" width="1080" height="340" fill="url(#tvfl)"/>
          <ellipse cx="270" cy="640" rx="380" ry="330" fill="url(#tvsA)"/><ellipse cx="810" cy="640" rx="380" ry="330" fill="url(#tvsB)"/></svg>`}
        <svg class="full" viewBox="0 0 1080 1350"><defs><linearGradient id="tvgold" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#7a4b0c" stop-opacity="0"/><stop offset=".45" stop-color="#ffd27a"/><stop offset=".55" stop-color="#fff3d1"/><stop offset="1" stop-color="#7a4b0c" stop-opacity="0"/></linearGradient></defs>
          <polygon points="640,430 652,430 444,880 432,880" fill="url(#tvgold)"/><polygon points="660,470 664,470 470,860 466,860" fill="url(#tvgold)" opacity=".6"/></svg>
        ${hdr}${balls}
        ${mv('vs', `<div class="vs"><b>VS</b></div>`)}
        ${mv('teamA', `<div class="nm nmA"><b>${tn(A)}</b><i style="background:${A.c}"></i></div>`)}${mv('teamB', `<div class="nm nmB"><b>${tn(B)}</b><i style="background:${B.c}"></i></div>`)}
        ${mv('info', `<div class="info">${date}${time ? `<em>${time}</em>` : ' · '}${extra}</div>`)}`;
    }
    if (L === 'smoke') {
      const clouds = (side, c1, c2) => Array.from({ length: 14 }, () => {
        const x = side === 'L' ? -60 + R() * 470 : 1140 - R() * 470, y = 380 + R() * 620, rx = 120 + R() * 170, ry = 90 + R() * 140;
        return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${R() > .5 ? c1 : c2}" opacity="${.45 + R() * .45}"/>`;
      }).join('');
      const sparks = Array.from({ length: 26 }, () => `<circle cx="${470 + R() * 140}" cy="${360 + R() * 260}" r="${1 + R() * 2.5}" opacity="${.4 + R() * .6}"/>`).join('');
      h = `${up || `<svg class="full" viewBox="0 0 1080 1350"><defs>
          <linearGradient id="tvsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b2a2e"/><stop offset=".55" stop-color="#0a1416"/><stop offset="1" stop-color="#050809"/></linearGradient>
          <filter id="tvsm" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".011" numOctaves="5" seed="9" result="n"/>
            <feDisplacementMap in="SourceGraphic" in2="n" scale="190" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="16"/></filter></defs>
          <rect width="1080" height="1200" fill="url(#tvsky)"/>
          <g filter="url(#tvsm)">${clouds('L', a, a2)}</g><g filter="url(#tvsm)">${clouds('R', b, b2)}</g></svg>`}
        <svg class="full" viewBox="0 0 1080 1350"><defs>
          <linearGradient id="tvgr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#173d1e"/><stop offset="1" stop-color="#0b2410"/></linearGradient>
          <radialGradient id="tvgc" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ff9a2e" stop-opacity=".55"/><stop offset="1" stop-color="#ff5a00" stop-opacity="0"/></radialGradient>
          <filter id="tvb6"><feGaussianBlur stdDeviation="3"/></filter></defs>
          ${up ? '' : `<path d="M0 960 L1080 960 L1080 1200 L0 1200 Z" fill="url(#tvgr)"/>
          <g opacity=".5">${Array.from({ length: 9 }, (_, i) => i % 2 ? `<path d="M${-200 + i * 185} 1200 L${380 + i * 40} 960" stroke="#1f5226" stroke-width="40" opacity=".5"/>` : '').join('')}</g>
          <path d="M0 990 L1080 990" stroke="#e8f2e8" stroke-width="4" opacity=".75"/><path d="M528 1200 L536 960 L544 960 L552 1200 Z" fill="#e8f2e8" opacity=".8"/>`}
          <ellipse cx="540" cy="640" rx="260" ry="200" fill="url(#tvgc)"/><g fill="#ffcf5a">${sparks}</g>
          <ellipse cx="540" cy="1048" rx="70" ry="12" fill="#000" opacity=".6" filter="url(#tvb6)"/>
          <g transform="translate(540 990)"><circle r="56" fill="#f4f4f4"/><polygon points="0,-20 19,-6 12,16 -12,16 -19,-6" fill="#1b1b1b"/>
            ${[0, 72, 144, 216, 288].map(r => `<g transform="rotate(${r})"><path d="M0 -20 L0 -40" stroke="#1b1b1b" stroke-width="3"/><path d="M-14 -52 L0 -40 L14 -52 L9 -56 L-9 -56 Z" fill="#1b1b1b"/></g>`).join('')}
            <circle r="56" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="5"/><circle cx="-18" cy="-20" r="26" fill="#fff" opacity=".35"/></g></svg>
        ${hdr}${crest(A, 0, 'filter:drop-shadow(0 0 30px rgba(0,0,0,.6)) drop-shadow(0 18px 24px rgba(0,0,0,.55))')}${crest(B, 1, 'filter:drop-shadow(0 0 30px rgba(0,0,0,.6)) drop-shadow(0 18px 24px rgba(0,0,0,.55))')}
        ${mv('vs', `<div class="vs"><b>VS</b></div>`)}
        ${mv('teamA', `<div class="nm nmA"><b>${tn(A)}</b><span>${pn(A)}</span></div>`)}${mv('teamB', `<div class="nm nmB"><b>${tn(B)}</b><span>${pn(B)}</span></div>`)}
        ${mv('info', `<div class="info"><div>${date}${time ? `<em>${time}</em>` : ' · '}${extra}</div></div>`)}`;
    }
    if (L === 'stad') {
      const card = (t, i, col) => {
        const x = i ? 650 : 70, p = boxOf(t, its[i]), lx = p.left - x, ly = p.top - 430;
        return `<div class="card" style="left:${x}px">
          <svg width="360" height="470" viewBox="0 0 360 470" style="position:absolute;left:0;top:0;overflow:visible">
            <path d="M14 40 H346 V270 Q346 400 180 462 Q14 400 14 270 Z" fill="rgba(0,0,0,.45)" transform="translate(10 16)" filter="url(#tvbl)"/>
            <path d="M14 40 H346 V270 Q346 400 180 462 Q14 400 14 270 Z" fill="url(#tvsh)" stroke="#c9a54a" stroke-width="7"/>
            <path d="M30 56 H330 V268 Q330 386 180 444 Q30 386 30 268 Z" fill="none" stroke="${col}" stroke-width="3" opacity=".55"/></svg>
          ${t.logo ? `<img class="lg" data-p="${i}" data-in-card="${x}" src="${t.logo}" style="position:absolute;left:${lx.toFixed(1)}px;top:${ly.toFixed(1)}px;width:${p.w.toFixed(1)}px;height:${p.h.toFixed(1)}px;object-fit:contain" alt="">` : ''}
          <div class="ban" style="background:linear-gradient(180deg,${col},${dk(col, .7)})">${esc(t.team)}</div></div>`;
      };
      h = `${up || `<svg class="full" viewBox="0 0 1080 1350"><defs>
          <linearGradient id="tvsk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#06122e"/><stop offset=".55" stop-color="#0d2c5a"/><stop offset="1" stop-color="#1d5a7a"/></linearGradient>
          <radialGradient id="tvfo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff"/><stop offset=".12" stop-color="#e6f4ff" stop-opacity=".9"/><stop offset=".45" stop-color="#8fc8ff" stop-opacity=".25"/><stop offset="1" stop-color="#8fc8ff" stop-opacity="0"/></radialGradient>
          <linearGradient id="tvpi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f8a3a"/><stop offset="1" stop-color="#145a22"/></linearGradient></defs>
          <rect width="1080" height="1200" fill="url(#tvsk)"/>
          ${[[40, 330], [1040, 330]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="300" fill="url(#tvfo)"/>${Array.from({ length: 4 }, (_, r) => Array.from({ length: 5 }, (_, c) => `<circle cx="${x - 44 + c * 22}" cy="${y - 30 + r * 20}" r="7" fill="#fff"/>`).join('')).join('')}`).join('')}
          <path d="M0 760 L1080 760 L1080 1200 L0 1200 Z" fill="url(#tvpi)"/>
          ${Array.from({ length: 12 }, (_, i) => i % 2 ? `<path d="M${-660 + i * 200} 1200 L${-60 + i * 100} 760 L${40 + i * 100} 760 L${-460 + i * 200} 1200 Z" fill="#000" opacity=".08"/>` : '').join('')}
          <g fill="none" stroke="#fff" stroke-opacity=".65" stroke-width="5"><path d="M540 760 L540 1200"/><ellipse cx="540" cy="930" rx="230" ry="70"/><path d="M60 800 L1020 800"/></g></svg>`}
        <svg class="full" viewBox="0 0 1080 1350"><defs><linearGradient id="tvsh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e3e7ee"/></linearGradient>
          <filter id="tvbl"><feGaussianBlur stdDeviation="10"/></filter></defs><path d="M610 520 L622 520 L470 860 L458 860 Z" fill="#fff" opacity=".9"/></svg>
        ${hdr}${mv('teamA', card(A, 0, a))}${mv('teamB', card(B, 1, b))}
        ${mv('vs', `<div class="vs"><b>VS</b></div>`)}
        ${mv('info', `<div class="info"><div>${date}${time ? `<em style="color:${a}">${time}</em>` : ' · '}${extra}</div></div>`)}`;
    }
    if (L === 'brush') {
      const strokes = (c1, c2, seed) => `<svg width="420" height="700" viewBox="0 0 420 700" style="position:absolute;left:0;top:0"><defs>
        <filter id="tvro${seed}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".02 .004" numOctaves="2" seed="${seed}"/><feDisplacementMap in="SourceGraphic" scale="44"/><feGaussianBlur stdDeviation="1.2"/></filter></defs>
        <g filter="url(#tvro${seed})"><path d="M-40 480 L460 260 L470 340 L-30 580 Z" fill="${c1}"/><path d="M-30 600 L450 430 L460 460 L-20 650 Z" fill="${c2}" opacity=".85"/>
        <path d="M-20 200 L300 90 L310 120 L-10 240 Z" fill="${c1}" opacity=".6"/></g></svg>`;
      const panel = (t, x, c1, c2, seed) => `<div class="panel" style="left:${x}px;border-color:${c1};box-shadow:0 0 22px ${c1},inset 0 0 40px rgba(0,0,0,.6)">
        ${up ? '' : strokes(c1, c2, seed)}</div>`;
      // big outline word: its own section (drag, wheel, remove), still clipped to its panel
      const word = (t, k, x) => `<div class="bigclip" style="clip-path:inset(290px ${1020 - x - 420 + 60}px 360px ${x}px)">${mv(k, `<div class="big" style="left:${x + 10}px">${esc(t.short || t.team.split(' ')[0])}</div>`)}</div>`;
      h = `${up}${hdr}${panel(A, 60, a, a2, 3)}${panel(B, 600, b, b2, 8)}${word(A, 'wordA', 60)}${word(B, 'wordB', 600)}
        ${crest(A, 0, 'filter:drop-shadow(0 20px 30px rgba(0,0,0,.7))')}${crest(B, 1, 'filter:drop-shadow(0 20px 30px rgba(0,0,0,.7))')}
        <svg class="full" viewBox="0 0 1080 1350"><defs><radialGradient id="tvgb" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fff2b8"/><stop offset=".35" stop-color="#e6b143"/><stop offset=".8" stop-color="#8a5a12"/><stop offset="1" stop-color="#3d2405"/></radialGradient>
          <radialGradient id="tvha" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffcf6a" stop-opacity=".5"/><stop offset="1" stop-color="#ffcf6a" stop-opacity="0"/></radialGradient></defs>
          <circle cx="540" cy="620" r="150" fill="url(#tvha)"/>
          <g transform="translate(540 620)"><circle r="78" fill="url(#tvgb)"/><polygon points="0,-26 25,-8 15,21 -15,21 -25,-8" fill="#3d2405" opacity=".85"/>
            ${[0, 72, 144, 216, 288].map(r => `<g transform="rotate(${r})"><path d="M0 -26 L0 -50" stroke="#3d2405" stroke-width="4" opacity=".8"/><path d="M-18 -68 L0 -50 L18 -68 L12 -76 L-12 -76 Z" fill="#3d2405" opacity=".75"/></g>`).join('')}
            <circle cx="-24" cy="-28" r="30" fill="#fff" opacity=".35"/></g></svg>
        ${mv('vs', `<div class="vs" style="--a:${a};--b:${b}"><b>VS</b></div>`)}
        ${mv('teamA', `<div class="nm nmA"><b style="color:${a2}">${tn(A)}</b><span>${pn(A)}</span></div>`)}${mv('teamB', `<div class="nm nmB"><b style="color:${b2}">${tn(B)}</b><span>${pn(B)}</span></div>`)}
        ${mv('info', `<div class="info">${date}${time ? `<em>${time}</em>` : ' · '}${extra}</div>`)}`;
    }

    // ---- Crest Clash and Torn Poster (shifty's two favourites from the Match Result team mode, made pre-match) ----
    // kick-off time in 12-hour format ("21:00" -> "9:00 PM"); anything that is not HH:MM is shown as typed
    const t12 = (() => { const m = String(st.time || '').trim().match(/^(\d{1,2})[:.](\d{2})$/); if (!m || +m[1] > 23) return time;
      return `${(+m[1] % 12) || 12}:${m[2]} ${+m[1] < 12 ? 'AM' : 'PM'}`; })();
    const pal = () => {
      if (tpl) return { c1: a, c2: b, pop: L === 'torn' ? '#ffe14a' : '#ffd23a' };
      let c2 = B.c;
      const [h1] = hue(A.c), [h2, s2] = hue(c2), dh = Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2));
      if (dh < 28) c2 = h1 > 150 && h1 < 270 ? '#ff4f6d' : '#2f7bff';   // same-colour clubs: team 2 gets a contrast colour
      const gold = c => { const [h, s] = hue(c); return s > .4 && h > 30 && h < 70; };
      return { c1: A.c, c2, pop: gold(A.c) || gold(c2) ? '#ffffff' : '#ffd23a' };
    };
    const mixc = (x, y, k) => { const p = [x, y].map(c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))); return '#' + p[0].map((v, i) => Math.round(v + (p[1][i] - v) * k).toString(16).padStart(2, '0')).join(''); };
    const crestImg = (t, s, c) => t.logo ? `<img class="cr" src="${t.logo}" style="width:${s}px;height:${s}px" alt="">`
      : `<div class="cr mono" style="width:${s}px;height:${s}px;background:${c};font-size:${Math.round(s * .3)}px">${esc((t.short || t.team || '').slice(0, 3).toUpperCase())}</div>`;
    // no z-index here: every .mv section is its own layer, so the order in the HTML decides what sits in front
    const capImg = (t, i, clip = '') => showCaptain(st, t) ? `<div class="slot" style="height:${its[i].slot.cut || its[i].slot.floor}px;${clip}"><img data-p="${i}" src="${t.photo}" style="${tvtPhotoStyle(t, its[i].slot)}" alt=""></div>` : '';
    const chip = (t, k, x, y) => showCaptain(st, t) && t.player ? mv(k, `<div class="pchip" style="left:${x}px;top:${y}px">${esc(t.player)}</div>`) : '';
    const head2 = mv('head', `<div class="hd l">${st.logo ? `<div class="brand2 logo"><img src="${st.logo}" alt=""></div>` : '<div class="brand2">eFCB</div>'}</div>${st.tag ? `<div class="hd r"><div class="tag">${esc(st.tag)}</div></div>` : ''}`);
    let vars = '';

    if (L === 'clash') {
      const P = pal(), capA = !!showCaptain(st, A), capB = !!showCaptain(st, B), cap = capA || capB, R2 = rng(5);
      vars = `--c1:${P.c1};--c2:${P.c2};--pop:${P.pop}`;
      let x = 600, seam = 'M600 -20';
      for (let y = 40; y <= 1370; y += 60) { x = 600 - (y / 1350) * 120 + (R2() - .5) * 70; seam += ` L${x.toFixed(0)} ${y}`; }
      const dots = cx => Array.from({ length: 12 }, (_, r) => Array.from({ length: 12 }, (_, k) => { const s = Math.max(0, 5.4 - Math.hypot(r, k) * .5);
        return s > .5 ? `<circle cx="${cx + (cx < 540 ? k : -k) * 17}" cy="${150 + r * 17}" r="${s.toFixed(1)}" fill="#fff"/>` : ''; }).join('')).join('');
      const y0 = cap ? 690 : 600, rr = cap ? 112 : 150, cs = cap ? 190 : 250;
      const ring = (cx, cy, r, c, n) => `<svg class="full rings" viewBox="0 0 1080 1350"><circle cx="${cx}" cy="${cy}" r="${r + 40}" fill="url(#ccg${n})"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c}" stroke-width="10" filter="url(#ccglow)"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${mixc(c, '#ffffff', .6)}" stroke-width="3"/>
        <circle cx="${cx}" cy="${cy}" r="${r + 22}" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="4 10" opacity=".8"/></svg>`;
      /* With a captain the crest sits under the club name, no rings (shifty: a crest on the chest, or ringed badges, looked
         wrong). Without one, the crest stands on its big glowing ring. */
      const crestSec = (t, k, cx, c, n) => showCaptain(st, t)
        ? mv(k, `<div class="crw" style="left:${cx - 60}px;top:${ny + 92}px">${crestImg(t, 120, c)}</div>`)
        : mv(k, `<div class="ringbox">${ring(cx, y0, rr, c, n)}<div class="crw" style="left:${cx - cs / 2}px;top:${y0 - cs / 2}px">${crestImg(t, cs, c)}</div></div>`);
      const ny = cap ? 900 : 830;
      h = `${isUp ? `<div class="upbg" style="background-image:url('${st.bgImage}')"></div><div class="wash" style="background:linear-gradient(180deg,rgba(5,5,16,.25),rgba(5,5,16,.85) 75%)"></div>` : ''}
        <svg class="full" viewBox="0 0 1080 1350"><defs>
          <linearGradient id="cchl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P.c1}" stop-opacity=".95"/><stop offset="1" stop-color="${mixc(P.c1, '#070716', .7)}" stop-opacity=".9"/></linearGradient>
          <linearGradient id="cchr" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.c2}" stop-opacity=".95"/><stop offset="1" stop-color="${mixc(P.c2, '#070716', .7)}" stop-opacity=".9"/></linearGradient>
          <radialGradient id="ccg1"><stop offset="0" stop-color="${P.c1}" stop-opacity=".7"/><stop offset="1" stop-color="${P.c1}" stop-opacity="0"/></radialGradient>
          <radialGradient id="ccg2"><stop offset="0" stop-color="${P.c2}" stop-opacity=".7"/><stop offset="1" stop-color="${P.c2}" stop-opacity="0"/></radialGradient>
          <linearGradient id="ccbeam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
          <linearGradient id="ccbot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070716" stop-opacity="0"/><stop offset="1" stop-color="#070716" stop-opacity=".95"/></linearGradient>
          <filter id="ccglow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="9"/></filter>
          <filter id="ccsoft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="22"/></filter></defs>
          <path d="M0 0 H600 L480 1350 H0 Z" fill="url(#cchl)" opacity="${isUp ? .38 : 1}"/><path d="M600 0 H1080 V1350 H480 Z" fill="url(#cchr)" opacity="${isUp ? .38 : 1}"/>
          ${isUp ? '' : `<g filter="url(#ccsoft)"><polygon points="-40,-40 60,-40 520,900 300,900" fill="url(#ccbeam)" opacity=".5"/><polygon points="1020,-40 1120,-40 780,900 560,900" fill="url(#ccbeam)" opacity=".5"/></g>
          <g opacity=".35">${dots(30)}${dots(1050)}</g>`}
          <rect x="0" y="780" width="1080" height="570" fill="url(#ccbot)"/></svg>
        ${mv('seam', `<svg class="full seam" viewBox="0 0 1080 1350"><path d="${seam}" fill="none" stroke="${P.pop}" stroke-width="22" filter="url(#ccglow)" opacity=".85"/><path d="${seam}" fill="none" stroke="#fff" stroke-width="5"/></svg>`)}
        ${mv('title', `<div class="ghost">${esc(st.title)}</div>`)}
        ${capImg(A, 0)}${capImg(B, 1)}<div class="floor"></div>
        ${crestSec(A, 'crestA', 250, P.c1, 1)}${crestSec(B, 'crestB', 830, P.c2, 2)}
        ${mv('vs', `<div class="vsp" style="top:${cap ? 300 : 475}px"><b>VS</b></div>`)}
        ${chip(A, 'capA', 250, ny - 46)}${chip(B, 'capB', 830, ny - 46)}
        ${mv('teamA', `<div class="cn l" style="top:${ny}px">${esc(A.team)}</div>`)}${mv('teamB', `<div class="cn r" style="top:${ny}px">${esc(B.team)}</div>`)}
        ${mv('info', `<div class="info" style="top:${cap ? 1150 : 1010}px">${date ? `<span>${date}</span>` : ''}${t12 ? `<span class="tm">${t12}</span>` : ''}${extra ? `<em></em>${extra}` : ''}</div>`)}
        ${head2}${mv('event', `<div class="kick">${esc(st.event)}</div>`)}`;
    }
    if (L === 'torn') {
      const P = pal(), capA = !!showCaptain(st, A), capB = !!showCaptain(st, B), R2 = rng(29);
      vars = `--c1:${P.c1};--c2:${P.c2};--pop:${P.pop}`;
      // the tear runs from (0, 1000) up to (1080, 520); the paper strip is ±95px around it with ragged edges
      const yAt = (x, off) => 1000 - x * 480 / 1080 + off;
      const edge = (off, j) => { const pts = []; for (let x = -20; x <= 1100; x += 18) pts.push(`${x},${(yAt(x, off) + (R2() - .5) * j).toFixed(1)}`); return pts; };
      const top = edge(-95, 16), bot = edge(95, 16), topIn = edge(-80, 10), botIn = edge(80, 10);
      const paper = `M${top.join(' L')} L${bot.slice().reverse().join(' L')} Z`, paper2 = `M${topIn.join(' L')} L${botIn.slice().reverse().join(' L')} Z`;
      const dot = (id, c) => `<pattern id="${id}" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="8" cy="8" r="3.2" fill="${c}"/></pattern>`;
      // team 1 block: top right next to its captain, else centred; team 2 block: bottom left
      const b1 = capA ? { cx: 795, w: 470, cy: 110, cs: 170 } : { cx: 540, w: 700, cy: 100, cs: 240 };
      const b2 = capB ? { x: 50, y: 1060, cs: 170, tx: 220, tw: 380, ny: 1000 } : { x: 70, y: 960, cs: 230, tx: 330, tw: 680, ny: 1040 };
      h = `${isUp ? `<div class="upbg" style="background-image:url('${st.bgImage}')"></div>` : ''}
        <svg class="full" viewBox="0 0 1080 1350"><defs>
          <linearGradient id="tpa" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mixc(P.c1, '#ffffff', .12)}"/><stop offset="1" stop-color="${mixc(P.c1, '#000000', .45)}"/></linearGradient>
          <linearGradient id="tpb" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${mixc(P.c2, '#000000', .55)}"/><stop offset="1" stop-color="${mixc(P.c2, '#ffffff', .08)}"/></linearGradient>
          ${dot('tpd1', 'rgba(0,0,0,.16)')}${dot('tpd2', 'rgba(255,255,255,.1)')}
          <filter id="tpgrit"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .22 0"/></filter>
          <filter id="tpsh" x="-5%" y="-20%" width="110%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="10" flood-opacity=".45"/></filter></defs>
          <path d="M0 0 H1080 V${yAt(1080, 0)} L0 ${yAt(0, 0)} Z" fill="url(#tpa)" opacity="${isUp ? .42 : 1}"/>
          <path d="M0 ${yAt(0, 0)} L1080 ${yAt(1080, 0)} V1350 H0 Z" fill="url(#tpb)" opacity="${isUp ? .42 : 1}"/>
          ${isUp ? '' : `<path d="M0 0 H1080 V${yAt(1080, 0)} L0 ${yAt(0, 0)} Z" fill="url(#tpd1)" opacity=".8"/><path d="M0 ${yAt(0, 0)} L1080 ${yAt(1080, 0)} V1350 H0 Z" fill="url(#tpd2)"/>
          <rect width="1080" height="1350" filter="url(#tpgrit)"/>`}
          <path d="M0 1180 H1080 V1350 H0 Z" fill="#000" opacity=".35"/></svg>
        ${capImg(A, 0, `clip-path:polygon(0 0,1080px 0,1080px ${yAt(1080, 0)}px,0 ${yAt(0, 0)}px)`)}
        ${mv('paper', `<svg class="full paper" viewBox="0 0 1080 1350"><path d="${paper}" fill="#f1ece1" filter="url(#tpsh)"/><path d="${paper2}" fill="none" stroke="#d9d1bf" stroke-width="2" stroke-dasharray="2 7"/><path d="${paper}" fill="url(#tpd1)" opacity=".18"/></svg>`)}
        ${capImg(B, 1)}
        ${mv('crestA', `<div class="tcr" style="left:${b1.cx - b1.cs / 2}px;top:${b1.cy}px">${crestImg(A, b1.cs, P.c1)}</div>`)}
        ${mv('crestB', `<div class="tcr" style="left:${b2.x}px;top:${b2.y}px">${crestImg(B, b2.cs, P.c2)}</div>`)}
        ${mv('teamA', `<div class="tn t1" style="left:${b1.cx - b1.w / 2}px;width:${b1.w}px;top:${b1.cy + b1.cs + 14}px">${esc(A.team)}</div>`)}
        ${mv('teamB', `<div class="tn t2" style="left:${b2.tx}px;width:${b2.tw}px;top:${b2.ny}px">${esc(B.team)}</div>`)}
        ${chip(A, 'capA', 270, 735)}${chip(B, 'capB', 830, 1190)}
        ${mv('vs', `<div class="stamp"><div class="sn">VS</div><div class="sd">${st.title ? `<b>${esc(st.title)}</b>` : ''}${[date, t12].filter(Boolean).join(' · ')}</div></div>`)}
        ${extra ? mv('info', `<div class="tape">${extra}</div>`) : ''}
        ${head2}${mv('event', `<div class="tk">${esc(st.event)}</div>`)}`;
    }

    root.innerHTML = `<div class="tvt ${L}${isUp ? ' up' : ''}"${vars ? ` style="${vars}"` : ''}>${h}${mv('partners', sp)}</div>`;
    fitNames(root.firstElementChild);
  }

  // long team names shrink until they fit their space
  const FIT = { ball: [['.nm b', 440]], smoke: [['.nm b', 440]], stad: [['.ban', 370]], brush: [['.nm b', 420], ['.big', 400]],
    clash: [['.cn', 470], ['.ghost', 1000], ['.kick', 560], ['.info', 900]], torn: [['.tn', 0], ['.tk', 520], ['.stamp .sd', 760]] };
  function fitNames(p) {
    const L = [...p.classList].find(c => FIT[c]);
    for (const [sel, mx] of FIT[L]) p.querySelectorAll(sel).forEach(el => {
      const max = mx || parseFloat(el.style.width);   // 0 = the block's own width
      el.style.fontSize = '';
      let f = parseFloat(getComputedStyle(el).fontSize);
      const w0 = el.style.width, d0 = el.style.display;
      el.style.width = 'max-content'; el.style.display = 'inline-block';
      while (el.offsetWidth > max && f > 16) { f -= 1; el.style.fontSize = f + 'px'; }
      el.style.width = w0; el.style.display = d0;
    });
    const t = p.querySelector('.ttl b');
    if (t) { t.style.fontSize = ''; let f = parseFloat(getComputedStyle(t).fontSize); t.style.display = 'inline-block'; while (t.offsetWidth > 980 && f > 30) { f -= 2; t.style.fontSize = f + 'px'; } t.style.display = ''; }
  }

  window.renderTvt = renderTvt;
})();
