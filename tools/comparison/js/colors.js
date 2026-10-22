/* Jersey colour detection + palette helpers.
   pickJerseyColors(imgSrc) -> Promise<{primary, secondary}> (hex)
   paletteFor(primary, secondary) -> CSS variables for one side of the poster */
(function () {
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgbToHex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  }
  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    if (s === 0) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  }
  const hsl = (h, s, l) => rgbToHex(...hslToRgb(h, clamp(s, 0, 1), clamp(l, 0, 1)));
  function luminance(hex) {
    const c = hexToRgb(hex).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function mix(a, b, t) {
    const x = hexToRgb(a), y = hexToRgb(b);
    return rgbToHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
  }

  function loadImage(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  }

  /* Reads the torso area of a cut-out (transparent PNG) or a normal photo,
     groups pixels into hue buckets and returns the two strongest jersey colours. */
  async function pickJerseyColors(src) {
    const img = await loadImage(src);
    const W = 140, H = Math.round(img.height * W / img.width);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, W, H);
    const px = ctx.getImageData(0, 0, W, H).data;

    // bounding box of the visible subject
    let top = H, bottom = 0, left = W, right = 0, hasAlpha = false;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const a = px[(y * W + x) * 4 + 3];
      if (a < 250) hasAlpha = true;
      if (a > 200) { top = Math.min(top, y); bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x); }
    }
    const bh = bottom - top, bw = right - left;
    // torso = lower part of the subject, middle of the width
    const y0 = top + Math.round(bh * (hasAlpha ? 0.5 : 0.55)), x0 = left + Math.round(bw * 0.15), x1 = right - Math.round(bw * 0.15);

    const buckets = {};
    let total = 0;
    for (let y = y0; y <= bottom; y++) for (let x = x0; x <= x1; x++) {
      const i = (y * W + x) * 4;
      if (px[i + 3] < 200) continue;
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const [h, s, l] = rgbToHsl(r, g, b);
      // skip skin tones (arms / hands in front of the shirt)
      if (h > 4 && h < 36 && s > 0.12 && s < 0.72 && l > 0.18 && l < 0.85) continue;
      let key, w = 1;
      if (l < 0.14) key = 'dark';
      else if (l > 0.86 || (s < 0.14 && l > 0.6)) key = 'light';
      else if (s < 0.18) key = 'grey';
      else { key = 'h' + Math.floor(((h + 7.5) % 360) / 15); w = 0.6 + s; }
      const bk = buckets[key] || (buckets[key] = { n: 0, w: 0, r: 0, g: 0, b: 0 });
      bk.n++; bk.w += w; bk.r += r; bk.g += g; bk.b += b; total++;
    }
    // merge neighbouring hue buckets so one jersey colour is not split in two
    const keys = Object.keys(buckets).filter(k => k[0] === 'h').sort((a, b) => buckets[b].w - buckets[a].w);
    for (const k of keys) {
      if (!buckets[k]) continue;
      const n = +k.slice(1);
      for (const nb of ['h' + ((n + 1) % 24), 'h' + ((n + 23) % 24)]) {
        const o = buckets[nb];
        if (o && buckets[k].w >= o.w) { for (const f of ['n', 'w', 'r', 'g', 'b']) buckets[k][f] += o[f]; delete buckets[nb]; }
      }
    }
    const avg = bk => rgbToHex(bk.r / bk.n, bk.g / bk.n, bk.b / bk.n);
    const ranked = Object.entries(buckets).filter(([, b]) => b.n > total * 0.02).sort((a, b) => b[1].w - a[1].w);
    if (!ranked.length) return { primary: '#1f6f4a', secondary: '#0b0f14' };

    // a coloured bucket wins as primary when it covers a decent share of the shirt
    const chroma = ranked.filter(([k]) => k[0] === 'h');
    // ...but on a mostly black/white shirt a small print or trim stays the accent, not the main colour
    const neutralTop = ranked.find(([k]) => k[0] !== 'h');
    const chromaWins = chroma.length && chroma[0][1].n > total * 0.12 && (!neutralTop || chroma[0][1].n >= neutralTop[1].n * 0.45);
    const primaryEntry = chromaWins ? chroma[0] : ranked[0];
    // black/white/grey shirt: use its trim or print colour (if any) as the second colour, so the accent picks it up
    const trim = !chromaWins && chroma.find(e => e[1].n > total * 0.025);
    const secondaryEntry = trim || ranked.find(e => e !== primaryEntry) || ['dark', null];
    let primary = avg(primaryEntry[1]);
    let secondary = secondaryEntry[1] ? avg(secondaryEntry[1]) : '#0b0f14';
    // vivid-ify the primary a bit so the background pops
    if (primaryEntry[0][0] === 'h') {
      const [h, s, l] = rgbToHsl(...hexToRgb(primary));
      primary = hsl(h, Math.max(s, 0.7), clamp(l, 0.38, 0.58));
    }
    return { primary, secondary };
  }

  /* Builds the colour tokens for one side of the poster from the two jersey colours. */
  function paletteFor(primary, secondary) {
    const [h, s, l] = rgbToHsl(...hexToRgb(primary));
    const neutral = s < 0.25 || l < 0.12 || l > 0.92; // black / white / grey kit
    const base = neutral ? (l < 0.5 ? '#2a2f3a' : '#9aa3b2') : primary;
    const [bh, bs] = rgbToHsl(...hexToRgb(base));
    const deep = neutral ? '#07090d' : hsl(bh, Math.min(bs, 0.85), 0.11);
    const glow = neutral ? '#ffffff' : hsl(bh, 1, 0.72);
    const [sh2, ss2, sl2] = rgbToHsl(...hexToRgb(secondary));
    // stripe colour: secondary if it differs enough from the base, else a darker base
    const stripe = Math.abs(luminance(secondary) - luminance(base)) > 0.08 || Math.abs(sh2 - bh) > 30 ? secondary : hsl(bh, bs, 0.2);
    const accent = neutral ? (ss2 > 0.2 ? hsl(sh2, Math.max(ss2, 0.7), clamp(sl2, 0.45, 0.6)) : '#ffffff') : hsl(bh, Math.max(bs, 0.75), clamp(l, 0.45, 0.6));
    const onAccent = luminance(accent) > 0.4 ? '#0b0d12' : '#ffffff';
    return { base, deep, glow, stripe, accent, onAccent, mid: mix(base, deep, 0.55) };
  }

  /* Crops away empty transparent space around a cut-out so every photo starts at the top of the head. */
  async function trimTransparent(src) {
    const img = await loadImage(src);
    const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const { data, width: W, height: H } = ctx.getImageData(0, 0, cv.width, cv.height);
    let top = H, bottom = -1, left = W, right = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 24) { if (y < top) top = y; if (y > bottom) bottom = y; if (x < left) left = x; if (x > right) right = x; }
    }
    if (bottom < 0 || (top === 0 && left === 0 && bottom === H - 1 && right === W - 1)) return src;
    const out = document.createElement('canvas'); out.width = right - left + 1; out.height = bottom - top + 1;
    out.getContext('2d').drawImage(cv, left, top, out.width, out.height, 0, 0, out.width, out.height);
    return out.toDataURL('image/png');
  }


  /* After AI cut-out: keep only the player. Loose bits the model left behind (water splashes,
     a trophy, text boxes) are separate blobs, so we keep the biggest connected blob plus any
     blob touching it, and clear faint half-transparent haze. */
  async function keepMainSubject(src) {
    const img = await loadImage(src);
    const W = img.naturalWidth, H = img.naturalHeight;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const id = ctx.getImageData(0, 0, W, H), d = id.data;
    // coarse grid (about 300 cells wide) for fast blob labelling
    const step = Math.max(1, Math.round(Math.max(W, H) / 300));
    const gw = Math.ceil(W / step), gh = Math.ceil(H / step);
    const solid = new Uint8Array(gw * gh);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 110) solid[((y / step) | 0) * gw + ((x / step) | 0)] = 1;
    const label = new Int32Array(gw * gh); const sizes = [0]; let n = 0;
    const stack = [];
    for (let i = 0; i < solid.length; i++) {
      if (!solid[i] || label[i]) continue;
      n++; let size = 0; stack.push(i); label[i] = n;
      while (stack.length) {
        const j = stack.pop(); size++;
        const jx = j % gw, jy = (j / gw) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = jx + dx, ny = jy + dy;
          if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
          const k = ny * gw + nx;
          if (solid[k] && !label[k]) { label[k] = n; stack.push(k); }
        }
      }
      sizes.push(size);
    }
    if (n === 0) return src;
    let main = 1; for (let i = 2; i <= n; i++) if (sizes[i] > sizes[main]) main = i;
    // grow the kept area by 2 cells so soft hair/edge pixels survive
    const keep = new Uint8Array(gw * gh);
    for (let i = 0; i < label.length; i++) if (label[i] === main) {
      const ix = i % gw, iy = (i / gw) | 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = ix + dx, ny = iy + dy;
        if (nx >= 0 && ny >= 0 && nx < gw && ny < gh) keep[ny * gw + nx] = 1;
      }
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const a = (y * W + x) * 4 + 3;
      if (!keep[((y / step) | 0) * gw + ((x / step) | 0)] || d[a] < 40) d[a] = 0;
    }
    ctx.putImageData(id, 0, 0);
    return cv.toDataURL('image/png');
  }


  /* Small photos (e.g. 500px) get stretched ~1.7x on the poster. Upscale once with high-quality resampling.
     No sharpening: on compressed photos it brings out blocky artifacts and halos (the "fete" look). */
  async function enhancePhoto(src, targetH = 1100) {
    const img = await loadImage(src);
    let w = img.naturalWidth, h = img.naturalHeight;
    let cur = img;
    const scale = Math.max(1, targetH / h);
    const W = Math.round(w * scale), H = Math.round(h * scale);
    // upscale in steps of at most 1.5x for cleaner edges
    while (w < W) {
      const nw = Math.min(W, Math.round(w * 1.5)), nh = Math.round(nw * H / W);
      const cv = document.createElement('canvas'); cv.width = nw; cv.height = nh;
      const cx = cv.getContext('2d'); cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
      cx.drawImage(cur, 0, 0, nw, nh);
      cur = cv; w = nw; h = nh;
    }
    const out = document.createElement('canvas'); out.width = W; out.height = H;
    const ox = out.getContext('2d'); ox.imageSmoothingEnabled = true; ox.imageSmoothingQuality = 'high';
    ox.drawImage(cur, 0, 0, W, H);
    return out.toDataURL('image/png');
  }

  window.JerseyColors = { pickJerseyColors, paletteFor, luminance, mix, trimTransparent, keepMainSubject, enhancePhoto };
})();
