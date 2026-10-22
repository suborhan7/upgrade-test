/* Background styles for the Team Performance poster (Default template and Team colours modes). tpArt(layout, style, P, st)
   returns the background HTML/SVG, or '' for the plain gradient. Colours come from the palette P (c1, c2, c3, bgA, bgB).
   arena:  shock (light slashes + shockwave rings + debris)
   neon:   tunnel (holographic portal)
   roster: speed (motion streaks + halftone)
   Shapes are placed with a seeded random, so a poster always comes out the same. */
(function () {
  const rgb = hx => [1, 3, 5].map(i => parseInt(hx.slice(i, i + 2), 16) / 255);
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round((v + (B[i] - v) * t) * 255).toString(16).padStart(2, '0')).join(''); };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const seeded = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  // a smoke layer: fractal noise turned into one colour, alpha from the noise
  const smoke = (id, c, seed, freq, gain, cut) => {
    const [r, g, b] = rgb(c);
    return `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="4" seed="${seed}"/>
      <feColorMatrix values="0 0 0 0 ${r.toFixed(3)}  0 0 0 0 ${g.toFixed(3)}  0 0 0 0 ${b.toFixed(3)}  ${gain} 0 0 0 ${cut}"/></filter>`;
  };
  const svg = (defs, body) => `<svg class="full" viewBox="0 0 1080 1350"><defs>${defs}</defs>${body}</svg>`;
  const radial = (id, c, a) => `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity="${a}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
  // an organic blob around (cx, cy)
  const blob = (R, cx, cy, r, k = 14, wob = .32) => {
    const pts = Array.from({ length: k }, (_, i) => { const a = i / k * Math.PI * 2, rr = r * (1 - wob / 2 + R() * wob); return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; });
    let d = '';
    pts.forEach((p, i) => { const n = pts[(i + 1) % k], m = [(p[0] + n[0]) / 2, (p[1] + n[1]) / 2]; d += (i ? '' : `M${m[0].toFixed(1)} ${m[1].toFixed(1)}`) + ` Q${n[0].toFixed(1)} ${n[1].toFixed(1)} ${((n[0] + pts[(i + 2) % k][0]) / 2).toFixed(1)} ${((n[1] + pts[(i + 2) % k][1]) / 2).toFixed(1)}`; });
    return d + 'Z';
  };

  const ART = {
    arena: {
      shock(P) {
        const R = seeded(19), A = -18, cx = 540, cy = 470;
        // a light slash across the poster: soft glow, a hot core and a thin offset line in the second colour (chromatic split)
        const slash = (y, h, c, c2, o) => `<g transform="rotate(${A} 540 ${y})">
          <rect x="-300" y="${y - h / 2}" width="1680" height="${h}" fill="url(#${c})" opacity="${o * .55}" filter="url(#bl)"/>
          <rect x="-300" y="${y - h / 6}" width="1680" height="${h / 3}" fill="url(#${c})" opacity="${o}"/>
          <rect x="-300" y="${y - 1.5}" width="1680" height="3" fill="url(#sw)" opacity="${o}"/>
          <rect x="-300" y="${y + h / 6 + 3}" width="1680" height="2" fill="url(#${c2})" opacity="${o * .9}"/></g>`;
        const streaks = Array.from({ length: 46 }, () => {
          const x = R() * 1300 - 110, y = R() * 900, l = 40 + R() * 200, w = .8 + R() * 2.4, a = A * Math.PI / 180;
          return `<line x1="${x.toFixed(0)}" y1="${y.toFixed(0)}" x2="${(x + Math.cos(a) * l).toFixed(0)}" y2="${(y + Math.sin(a) * l).toFixed(0)}" stroke="${R() < .45 ? P.c2 : R() < .5 ? P.c1 : '#fff'}" stroke-width="${w.toFixed(1)}" stroke-linecap="round" opacity="${(.25 + R() * .6).toFixed(2)}"/>`;
        }).join('');
        const debris = Array.from({ length: 44 }, () => {
          const ang = R() * Math.PI * 2, d = 300 + R() * 460, x = cx + Math.cos(ang) * d, y = cy + Math.sin(ang) * d * .85, s = 3 + (d / 760) * (6 + R() * 16);
          if (y > 900) return '';
          const c = R() < .5 ? P.c1 : P.c2;
          return `<polygon points="0,${(-s).toFixed(1)} ${(s * .8).toFixed(1)},${(s * .6).toFixed(1)} ${(-s * .7).toFixed(1)},${(s * .5).toFixed(1)}" transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) rotate(${(R() * 360).toFixed(0)})" fill="${c}" stroke="${mix(c, '#ffffff', .6)}" stroke-width="1" opacity="${(.45 + R() * .55).toFixed(2)}"/>`;
        }).join('');
        const flare = (x, y, s, c) => `<g transform="translate(${x} ${y})"><circle r="${s * 1.6}" fill="url(#gw)"/><path d="M${-s * 3} 0 Q0 ${-s * .12} ${s * 3} 0 Q0 ${s * .12} ${-s * 3} 0Z M0 ${-s * 1.6} Q${s * .1} 0 0 ${s * 1.6} Q${-s * .1} 0 0 ${-s * 1.6}Z" fill="${c}"/></g>`;
        // floor shockwave: rings spreading on the ground behind the squad
        const floor = Array.from({ length: 6 }, (_, i) => `<ellipse cx="540" cy="760" rx="${300 + i * 150}" ry="${60 + i * 30}" fill="none" stroke="${i % 2 ? P.c2 : P.c1}" stroke-width="${i < 2 ? 4 : 2}" opacity="${(.85 - i * .12).toFixed(2)}"/>`).join('');
        const grad = (id, c) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c}" stop-opacity="0"/><stop offset=".4" stop-color="${c}" stop-opacity=".95"/><stop offset=".62" stop-color="${c}" stop-opacity=".95"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient>`;
        return `<div class="wash" style="background:radial-gradient(70% 55% at 50% 36%, ${mix(P.bgA, P.c1, .2)}, ${P.bgB} 85%)"></div>` + svg(
          grad('s1', P.c1) + grad('s2', P.c2) + grad('sw', '#ffffff') + radial('ga', P.c1, .75) + radial('gb', P.c2, .55) + radial('gw', '#ffffff', .9) +
          `<filter id="bl" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
           <filter id="bs" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>
           <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .06 0"/></filter>
           <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.bgB}" stop-opacity="0"/><stop offset="1" stop-color="${P.bgB}"/></linearGradient>`,
          `<ellipse cx="${cx}" cy="${cy}" rx="600" ry="520" fill="url(#ga)"/><ellipse cx="${cx}" cy="${cy}" rx="380" ry="340" fill="url(#gb)"/>
           ${slash(250, 150, 's1', 's2', .9)}${slash(640, 190, 's2', 's1', .75)}${slash(110, 26, 's2', 's1', .7)}${slash(860, 30, 's1', 's2', .6)}
           <g filter="url(#bs)">${floor}</g>${floor}
           <circle cx="${cx}" cy="${cy}" r="330" fill="none" stroke="${P.c2}" stroke-width="16" stroke-dasharray="2 13" opacity=".35"/>
           <circle cx="${cx}" cy="${cy}" r="372" fill="none" stroke="${P.c1}" stroke-width="5" stroke-dasharray="320 90 60 90 210 400" transform="rotate(-30 ${cx} ${cy})"/>
           <circle cx="${cx}" cy="${cy}" r="430" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="4 10" opacity=".35"/>
           <circle cx="${cx}" cy="${cy}" r="500" fill="none" stroke="${P.c2}" stroke-width="3" stroke-dasharray="140 60 30 60" opacity=".55" transform="rotate(40 ${cx} ${cy})"/>
           <circle cx="${cx}" cy="${cy}" r="230" fill="url(#gw)" opacity=".55"/>
           ${streaks}${debris}${flare(160, 310, 26, '#ffffff')}${flare(930, 160, 20, mix(P.c2, '#ffffff', .5))}${flare(980, 560, 16, '#ffffff')}
           <rect width="1080" height="1350" filter="url(#grain)"/>
           <rect x="0" y="720" width="1080" height="230" fill="url(#fade)"/><rect x="0" y="950" width="1080" height="400" fill="${P.bgB}"/>`);
      },
    },
    neon: {
      tunnel(P) {
        const R = seeded(53), vx = 540, vy = 470, N = 14;
        // a holographic portal: rounded frames shrinking toward a glowing point behind the heads
        const frames = Array.from({ length: N }, (_, i) => {
          const k = Math.pow(.8, i), w = 1240 * k, h = 1180 * k, c = i % 2 ? P.c2 : P.c1;
          return `<rect x="${(vx - w / 2).toFixed(1)}" y="${(vy - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${(60 * k).toFixed(1)}" fill="none" stroke="${c}" stroke-width="${(5 * k + 1).toFixed(1)}" opacity="${(.95 - i * .055).toFixed(2)}"/>`;
        }).join('');
        const rails = [[-80, -120], [1160, -120], [-80, 1060], [1160, 1060], [540, -120], [-80, 470], [1160, 470]].map(([x, y]) => `<line x1="${x}" y1="${y}" x2="${vx}" y2="${vy}"/>`).join('');
        const bits = Array.from({ length: 60 }, () => { const a = R() * Math.PI * 2, d = 120 + R() * 560, x = vx + Math.cos(a) * d, y = vy + Math.sin(a) * d * .9, s = 2 + R() * 5;
          return `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${(s * (R() < .5 ? 3 : 1)).toFixed(1)}" height="${s.toFixed(1)}" fill="${R() < .5 ? P.c2 : '#ffffff'}" opacity="${(.3 + R() * .6).toFixed(2)}"/>`; }).join('');
        return `<div class="wash" style="background:radial-gradient(60% 50% at 50% 35%, ${mix(P.bgA, P.c1, .25)}, ${P.bgB} 80%)"></div>` + svg(
          radial('gc', '#ffffff', .85) + radial('ga', P.c1, .7) +
          `<filter id="tg" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="8"/></filter>
           <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.bgB}" stop-opacity="0"/><stop offset="1" stop-color="${P.bgB}"/></linearGradient>`,
          `<ellipse cx="${vx}" cy="${vy}" rx="560" ry="480" fill="url(#ga)"/>
           <g stroke="${P.c2}" stroke-width="1.5" opacity=".35">${rails}</g>
           <g filter="url(#tg)">${frames}</g>${frames}
           <circle cx="${vx}" cy="${vy}" r="150" fill="url(#gc)"/>${bits}
           <rect x="0" y="900" width="1080" height="200" fill="url(#fade)"/><rect x="0" y="1100" width="1080" height="250" fill="${P.bgB}"/>
           <g fill="none" stroke="${P.c2}" stroke-width="3" opacity=".85"><path d="M34 90 V34 H90"/><path d="M990 34 H1046 V90"/><path d="M34 1160 V1216 H90"/><path d="M990 1216 H1046 V1160"/></g>`);
      },
    },
  };

  ART.roster = {
    speed(P) {
      const R = seeded(83);
      // dark navy with motion streaks along the band direction, halftone dots in the corners, a glow behind the squad
      const streaks = Array.from({ length: 46 }, () => { const x = R() * 1500 - 200, y = R() * 1500 - 100, l = 80 + R() * 380, c = R() < .3 ? P.c2 : R() < .6 ? P.c1 : '#ffffff';
        return `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${l.toFixed(0)}" height="${(1 + R() * 3).toFixed(1)}" fill="${c}" opacity="${(.12 + R() * .4).toFixed(2)}"/>`; }).join('');
      return `<div class="wash" style="background:linear-gradient(160deg, ${mix(P.bgA, P.c1, .15)}, ${P.bgB} 70%)"></div>` + svg(
        radial('ga', P.c1, .6) + radial('gb', P.c2, .35) + `<pattern id="ht" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="8" cy="8" r="2.6" fill="#fff"/></pattern>
         <radialGradient id="hf" cx="1" cy="0" r="1"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient>
         <filter id="sb"><feGaussianBlur stdDeviation="1.2"/></filter>` + smoke('sm', P.c1, 12, '.003 .008', 1.4, -.75),
        `<rect width="1080" height="1350" filter="url(#sm)" opacity=".5"/><ellipse cx="560" cy="620" rx="560" ry="420" fill="url(#ga)"/><ellipse cx="980" cy="160" rx="380" ry="300" fill="url(#gb)"/>
         <rect width="1080" height="1350" fill="url(#ht)" opacity=".12"/>
         <g transform="rotate(-29.5 540 675)" filter="url(#sb)">${streaks}</g>`);
    },
  };
  window.TP_STYLES = { arena: [['shock', 'Shockwave (light slash + ring)']], neon: [['tunnel', 'Holo Tunnel (neon portal)']], roster: [['speed', 'Speed (gotir dag + halftone)']] };
  window.tpArt = (L, style, P, st) => (ART[L] && ART[L][style] ? ART[L][style](P, st) : '');
})();
