/* Studio editing kit, shared by every card (each tool keeps its own copy so it also opens on its own).
   It works on the rendered poster: every element with data-move="key" is a section the admin can click to select,
   drag (snaps to the centre line), wheel-resize, nudge with the arrow keys, size with − / +, centre, reset or remove.
   Photos (data-p="i") can be selected, nudged, sized, centred and removed too; the card's own code drags them.
   Undo / redo (Ctrl+Z / Ctrl+Y) covers positions, sizes and removed parts. The selection box and centre guide are
   drawn over the frame, outside the poster, so they never show up in the PNG.

   StudioEdit.init({ frame, poster, state, render, moveKey, panel, partsBox, parts, styleOf?, defaultHidden?,
                     photo?: { get(i), changed(i), box?(el) }, extras?: { get(), set(v) } })
   StudioEdit.afterRender()   call at the end of the card's render()
   StudioEdit.commit()        record an undo step (most changes are picked up on their own) */
(function () {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  let o, sel = null, last = '', drag = null, wheelT = 0;
  const undoStack = [], redoStack = [];

  const scale = () => o.frame.getBoundingClientRect().width / 1080;
  const movesOf = () => (o.state.moves[o.moveKey()] ||= {});
  const secOf = k => (movesOf()[k] ||= { x: 0, y: 0 });
  const hiddenOf = () => {
    const k = o.moveKey();
    return (o.state.hidden[k] ||= JSON.parse(JSON.stringify((o.defaultHidden || {})[k] || {})));
  };
  const styleOf = k => {
    if (o.styleOf) return o.styleOf(k);
    const m = movesOf()[k] || {}, s = m.s || 1;
    return `transform:translate(${m.x || 0}px,${m.y || 0}px)${s !== 1 ? ` scale(${s})` : ''};transform-origin:${m.ox || 540}px ${m.oy || 675}px`;
  };
  const label = k => (o.parts && o.parts[k]) || k;
  const secEl = k => $(`[data-move="${k}"]`, o.poster);
  const photoEl = i => $(`[data-p="${i}"]`, o.poster);

  // on-screen box of a section (union of its visible pieces) or a photo, in client px
  function rectOf(s) {
    if (!s) return null;
    if (s.kind === 'photo') { const el = photoEl(s.i); return el && el.getBoundingClientRect(); }
    const el = secEl(s.key); if (!el) return null;
    let l = 1e9, t = 1e9, r = -1e9, b = -1e9;
    $$('*', el).concat(el.children.length ? [] : [el]).forEach(c => {
      const q = c.getBoundingClientRect(); if (!q.width || !q.height) return;
      l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom);
    });
    return r > l ? { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t } : null;
  }
  // centre of a section in poster px with its current move undone, measured once (the resize origin)
  function originOf(k) {
    const m = secOf(k);
    if (!m.ox) {
      const q = rectOf({ kind: 'sec', key: k }); if (!q) return m;
      const pr = o.frame.getBoundingClientRect(), s = scale(), cur = new DOMMatrix(getComputedStyle(secEl(k)).transform);
      m.ox = Math.round(((q.left + q.right) / 2 - pr.left) / s - cur.e); m.oy = Math.round(((q.top + q.bottom) / 2 - pr.top) / s - cur.f);
    }
    return m;
  }

  // ---- what the mouse really grabs ----
  // Big see-through layers (a full-poster SVG, an empty wrapper div, the clear part of a cut-out) would otherwise catch
  // the click and hide whatever is under them. pick() walks down the stack at the point and returns the first element
  // that actually paints a pixel there; poster-sized layers only win when nothing smaller is under the mouse.
  const SHAPES = /^(path|circle|ellipse|rect|polygon|polyline|line|text|tspan|textPath|image|use)$/;
  const alphaCache = new Map();
  function alphaAt(img, x, y) {
    if (!img.complete || !img.naturalWidth) return true;
    let c = alphaCache.get(img.src);
    if (!c) {
      const w = Math.min(256, img.naturalWidth), h = Math.max(1, Math.round(w * img.naturalHeight / img.naturalWidth));
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      try { const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h); c = { w, h, d: g.getImageData(0, 0, w, h).data }; }
      catch (err) { c = { w: 0 }; }
      if (alphaCache.size > 60) alphaCache.clear();
      alphaCache.set(img.src, c);
    }
    if (!c.w) return true;
    // map the client point into the picture, following object-fit / object-position
    const q = img.getBoundingClientRect(), cs = getComputedStyle(img), fit = cs.objectFit, ar = c.w / c.h;
    let w = q.width, h = q.height;
    if (fit === 'contain' || fit === 'scale-down') { if (q.width / q.height > ar) w = q.height * ar; else h = q.width / ar; }
    else if (fit === 'cover') { if (q.width / q.height > ar) h = q.width / ar; else w = q.height * ar; }
    const pos = cs.objectPosition.split(' ').map(v => v.endsWith('%') ? parseFloat(v) / 100 : null);
    const left = q.left + (q.width - w) * (pos[0] ?? .5), top = q.top + (q.height - h) * (pos[1] ?? .5);
    const px = Math.floor((x - left) / w * c.w), py = Math.floor((y - top) / h * c.h);
    if (px < 0 || py < 0 || px >= c.w || py >= c.h) return false;
    return c.d[(py * c.w + px) * 4 + 3] > 24;
  }
  function painted(el, x, y) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'img') return alphaAt(el, x, y);
    if (tag === 'canvas' || tag === 'video') return true;
    if (el instanceof SVGElement) return SHAPES.test(el.tagName);
    // a photo box whose picture lets clicks through to it: painted where its picture is
    if (el.matches('[data-p]') && el.querySelector('img') && [...el.querySelectorAll('img')].some(i => getComputedStyle(i).pointerEvents === 'none' && alphaAt(i, x, y))) return true;
    const cs = getComputedStyle(el);
    const clip = (cs.backgroundClip || cs.webkitBackgroundClip) === 'text';   // gradient letters paint like text
    if (!clip && (cs.backgroundImage !== 'none' || !/rgba\(.*,\s*0\)|transparent/.test(cs.backgroundColor))) return true;
    if (parseFloat(cs.borderTopWidth) || parseFloat(cs.borderLeftWidth) || parseFloat(cs.borderRightWidth) || parseFloat(cs.borderBottomWidth)) return true;
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return false;
    // text alone: only the band where the letters are, not the empty top / bottom of a big title's line box
    const q = el.getBoundingClientRect(), k = el.offsetHeight ? q.height / el.offsetHeight : scale();
    return Math.abs(y - (q.top + q.bottom) / 2) <= Math.max(0.42 * parseFloat(cs.fontSize) * k, 3);
  }
  function paintedAt(x, y) {
    const fr = o.frame.getBoundingClientRect();
    let big = null;
    for (const el of document.elementsFromPoint(x, y)) {
      if (!o.poster.contains(el) || el === o.poster || !el.closest('[data-move], [data-p]') || !painted(el, x, y)) continue;
      const q = el.getBoundingClientRect();
      if (q.width * q.height > fr.width * fr.height * 0.85 && !el.closest('[data-p]')) { big ||= el; continue; }
      return { el };
    }
    return { big };
  }
  // thin lines and small tags get a few px of slack: with nothing painted right under the mouse, look just around it
  const NEAR = [[5, 0], [-5, 0], [0, 5], [0, -5], [5, 5], [-5, 5], [5, -5], [-5, -5], [10, 0], [-10, 0], [0, 10], [0, -10]];
  const partOf = el => el.closest('[data-p]') || el.closest('[data-move]');
  function pick(x, y) {
    const h = paintedAt(x, y);
    if (h.el) {
      // on a big panel, a thin line of another part a few px away wins (it is too thin to hit exactly)
      const fr = o.frame.getBoundingClientRect(), q = h.el.getBoundingClientRect();
      if (q.width * q.height > fr.width * fr.height * 0.15) for (const [dx, dy] of NEAR) {
        const n = paintedAt(x + dx, y + dy).el; if (!n || partOf(n) === partOf(h.el)) continue;
        const r = n.getBoundingClientRect();
        if (Math.min(r.width, r.height) / scale() < 16) return n;
      }
      return h.el;
    }
    for (const [dx, dy] of NEAR) { const n = paintedAt(x + dx, y + dy); if (n.el) return n.el; }
    return h.big || o.poster;   // nothing painted here: a press on the bare poster (clears the selection)
  }

  // ---- overlay: selection box + centre guide ----
  let box, guide;
  function overlay() {
    if (!box) {
      box = document.createElement('div'); box.className = 'se-box';
      guide = document.createElement('div'); guide.className = 'se-guide';
      o.frame.append(box, guide);
    }
    const q = rectOf(sel);
    if (!q) { box.style.display = 'none'; return; }
    const pr = o.frame.getBoundingClientRect();
    const l = Math.max(0, q.left - pr.left), t = Math.max(0, q.top - pr.top), r = Math.min(pr.width, q.right - pr.left), b = Math.min(pr.height, q.bottom - pr.top);
    Object.assign(box.style, { display: 'block', left: l - 3 + 'px', top: t - 3 + 'px', width: Math.max(0, r - l) + 6 + 'px', height: Math.max(0, b - t) + 6 + 'px' });
  }

  // ---- toolbar ----
  function bar() {
    const el = document.createElement('div'); el.className = 'se-bar';
    el.innerHTML = `<div class="se-row"><button type="button" data-se="undo" title="Ctrl+Z">↶ Undo</button><button type="button" data-se="redo" title="Ctrl+Y">↷ Redo</button>
        <span class="se-name">Poster e click kore kichu select koro</span></div>
      <div class="se-row se-tools" hidden>
        <button type="button" data-se="smaller" title="Choto (−)">−</button><span class="se-pct">100%</span><button type="button" data-se="bigger" title="Boro (+)">+</button>
        <button type="button" data-se="left" title="Bame (←)">←</button><button type="button" data-se="up" title="Upore (↑)">↑</button>
        <button type="button" data-se="down" title="Niche (↓)">↓</button><button type="button" data-se="right" title="Dane (→)">→</button></div>
      <div class="se-row se-tools" hidden><button type="button" data-se="center">Majhe ano</button><button type="button" data-se="resetone">Reset eta</button>
        <button type="button" data-se="hide" class="se-hide">Remove (Del)</button></div>
      <p class="tip">Click = select. Drag ba arrow key e shorao (Shift = 10px), mouse wheel ba − / + e size, Delete e remove, Ctrl+Z undo, Esc = chhere dao.</p>`;
    el.addEventListener('click', e => { const b = e.target.closest('[data-se]'); if (b) act(b.dataset.se); });
    return el;
  }
  function refreshBar() {
    const b = $('.se-bar', o.panel); if (!b) return;
    $('[data-se="undo"]', b).disabled = !undoStack.length; $('[data-se="redo"]', b).disabled = !redoStack.length;
    $$('.se-tools', b).forEach(r => r.hidden = !sel);
    $('.se-name', b).textContent = sel ? 'Selected: ' + label(sel.kind === 'photo' ? 'p' + sel.i : sel.key) : 'Poster e click kore kichu select koro';
    if (sel) $('.se-pct', b).textContent = Math.round((sel.kind === 'photo' ? o.photo.get(sel.i).zoom : (movesOf()[sel.key] || {}).s || 1) * 100) + '%';
  }
  function select(s) { sel = s; overlay(); refreshBar(); }

  // ---- actions on the selection ----
  function nudge(dx, dy) {
    if (sel.kind === 'photo') { const t = o.photo.get(sel.i); t.dx += dx; t.dy += dy; o.render(); o.photo.changed(sel.i); }
    else { const m = secOf(sel.key); m.x += dx; m.y += dy; secEl(sel.key).style.cssText = styleOf(sel.key); overlay(); }
  }
  function resize(f) {
    if (sel.kind === 'photo') { const t = o.photo.get(sel.i); t.zoom = Math.min(2.5, Math.max(0.4, +(t.zoom * f).toFixed(3))); o.render(); o.photo.changed(sel.i); }
    else { const m = originOf(sel.key); m.s = Math.min(3, Math.max(0.3, +((m.s || 1) * f).toFixed(3))); secEl(sel.key).style.cssText = styleOf(sel.key); overlay(); }
    refreshBar();
  }
  // centre: a part on the poster's centre line; a photo inside a frame (a face circle, a slot) in the middle of its frame
  function centre() {
    // (looked up again on every measure: a photo nudge re-renders the poster)
    const imgOf = () => { const el = sel.kind === 'photo' && photoEl(sel.i); return el && (el.tagName === 'IMG' ? el : el.querySelector('img')); };
    const el = sel.kind === 'photo' ? photoEl(sel.i) : null, img = imgOf();
    let box = null;   // the frame the photo sits in: its own box, or the nearest clipping box around it
    if (img && img !== el) box = el;
    else if (img) for (let p = el.parentElement; p && p !== o.poster; p = p.parentElement) if (getComputedStyle(p).overflow !== 'visible') { box = p; break; }
    const mid = () => { const q = img ? imgOf().getBoundingClientRect() : rectOf(sel); return q && (q.left + q.right) / 2; };
    const pr = o.frame.getBoundingClientRect(), goal = box ? (() => { const q = box.getBoundingClientRect(); return (q.left + q.right) / 2; })() : pr.left + 540 * scale();
    const c0 = mid(); if (c0 == null) return;
    const d = Math.round((goal - c0) / scale()); if (!d) return;
    nudge(d, 0);
    // some photos move at a fraction of the poster px (a scaled face): measure and finish the move
    const k = (mid() - c0) / (d * scale());
    if (k > 0.05 && Math.abs(k - 1) > 0.05) for (let i = 0; i < 3; i++) {
      const left = Math.round((goal - mid()) / scale() / k); if (!left) break;
      nudge(left, 0);
    }
  }
  function act(a) {
    if (a === 'undo') return undo();
    if (a === 'redo') return redo();
    if (!sel) return;
    const step = 1;
    if (a === 'smaller') resize(0.95); else if (a === 'bigger') resize(1.05);
    else if (a === 'left') nudge(-step * 5, 0); else if (a === 'right') nudge(step * 5, 0);
    else if (a === 'up') nudge(0, -step * 5); else if (a === 'down') nudge(0, step * 5);
    else if (a === 'center') centre();
    else if (a === 'resetone') {
      if (sel.kind === 'photo') { Object.assign(o.photo.get(sel.i), { dx: 0, dy: 0, zoom: 1 }); o.photo.changed(sel.i); }
      else delete movesOf()[sel.key];
      o.render();
    } else if (a === 'hide') { hiddenOf()[sel.kind === 'photo' ? 'p' + sel.i : sel.key] = true; sel = null; o.render(); }
    commit();
  }

  // ---- undo / redo ----
  // entries made just by looking a part up (empty, or not moved / sized) are not a change: they never become an undo step
  const idle = m => m && typeof m === 'object' && !m.x && !m.y && (!m.s || m.s === 1) && Object.keys(m).every(k => ['x', 'y', 's', 'ox', 'oy'].includes(k));
  const prune = (v, drop) => {
    const out = {};
    for (const [l, parts] of Object.entries(v || {})) {
      const keep = {};
      for (const [k, m] of Object.entries(parts || {})) if (!drop(m)) keep[k] = m;
      if (Object.keys(keep).length) out[l] = keep;
    }
    return out;
  };
  const snap = () => JSON.stringify({ m: prune(o.state.moves, idle), h: prune(o.state.hidden, h => h === undefined), x: o.extras ? o.extras.get() : null });
  function commit() {
    const s = snap();
    if (s !== last) { undoStack.push(last); if (undoStack.length > 100) undoStack.shift(); redoStack.length = 0; last = s; }
    refreshBar();
  }
  function restore(s) {
    const v = JSON.parse(s);
    o.state.moves = v.m; o.state.hidden = v.h; if (o.extras) o.extras.set(v.x);
    o.render(); refreshBar();
  }
  function undo() { if (!undoStack.length) return; redoStack.push(last); last = undoStack.pop(); restore(last); }
  function redo() { if (!redoStack.length) return; undoStack.push(last); last = redoStack.pop(); restore(last); }

  // ---- parts list (on/off) ----
  function parts() {
    const hid = hiddenOf(), keys = $$('[data-move]', o.poster).map(e => e.dataset.move);
    $$('[data-p]', o.poster).forEach(e => { if (!keys.includes('p' + e.dataset.p)) keys.push('p' + e.dataset.p); });
    const known = Object.keys(o.parts || {}), order = known.filter(k => keys.includes(k)).concat(keys.filter(k => !known.includes(k)));
    const bx = o.partsBox;
    if (bx.dataset.keys !== order.join() || bx.dataset.layout !== o.moveKey()) {
      bx.dataset.keys = order.join(); bx.dataset.layout = o.moveKey();
      bx.innerHTML = order.map(k => `<label class="check"><input type="checkbox" data-part="${k}"> ${label(k)}</label>`).join('');
    }
    $$('[data-part]', bx).forEach(c => c.checked = !hid[c.dataset.part]);
  }

  // ---- after every render: moves, hidden parts, list, selection box ----
  function afterRender() {
    const hid = hiddenOf();
    $$('[data-move]', o.poster).forEach(el => { const k = el.dataset.move; el.style.cssText = styleOf(k) + (hid[k] ? ';display:none' : ''); });
    $$('[data-p]', o.poster).forEach(el => { if (hid['p' + el.dataset.p]) ((o.photo && o.photo.box && o.photo.box(el)) || el.closest('.slot') || el).style.display = 'none'; });
    if (sel && !rectOf(sel)) sel = null;
    parts(); overlay(); refreshBar();
  }

  function init(opts) {
    o = opts;
    o.state.moves ||= {}; o.state.hidden ||= {};
    const css = document.createElement('style');
    css.textContent = `.se-box{position:absolute;z-index:5;pointer-events:none;border:2px dashed #19e28a;border-radius:4px;box-shadow:0 0 0 1px rgba(0,0,0,.5)}
      .se-guide{position:absolute;z-index:5;top:0;bottom:0;left:50%;width:0;border-left:1px dashed #ff3d8b;pointer-events:none;display:none}
      .se-bar{position:sticky;top:-20px;z-index:4;margin:0 -20px 8px;padding:10px 20px 4px;background:#181c25;border-bottom:1px solid #262b37}
      .se-row{display:flex;flex-wrap:wrap;align-items:center;gap:5px;margin-bottom:6px}.se-row[hidden]{display:none}
      .se-row button{padding:5px 9px}.se-row button:disabled{opacity:.4;cursor:default}
      .se-name{font-size:12px;color:#19e28a;margin-left:4px}.se-pct{min-width:42px;text-align:center;font-size:12px;color:#cfd6e4}
      .se-hide{color:#ff8a9a}
      .mv{position:absolute;inset:0;pointer-events:none}.mv>*{pointer-events:auto;cursor:move}`;
    document.head.appendChild(css);
    o.panel.insertBefore(bar(), o.panel.querySelector('h2') ? o.panel.querySelector('h2').nextSibling : o.panel.firstChild);

    const f = o.frame;
    // send presses and wheel turns to what is really under the mouse (see pick), for this kit and the card's photo drag
    const redirect = (e, make) => {
      if (e.__se) return;
      let t = pick(e.clientX, e.clientY);
      // on a bare spot inside the selected part's box (between confetti bits, beside a thin line) keep working on that part
      if (t === o.poster && sel) {
        const q = rectOf(sel), el = sel.kind === 'photo' ? photoEl(sel.i) : secEl(sel.key);
        if (q && el && e.clientX >= q.left && e.clientX <= q.right && e.clientY >= q.top && e.clientY <= q.bottom) t = sel.kind === 'photo' ? el : (el.firstElementChild || el);
      }
      if (t === e.target || !o.poster.contains(e.target)) return;
      e.stopImmediatePropagation();
      if (e.type === 'wheel' && t.closest('[data-move], [data-p]')) e.preventDefault();
      const ev = make(e); ev.__se = true; t.dispatchEvent(ev);
    };
    const base = e => ({ bubbles: true, cancelable: true, composed: true, clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY,
      button: e.button, buttons: e.buttons, shiftKey: e.shiftKey, altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey });
    f.addEventListener('pointerdown', e => redirect(e, e => new PointerEvent('pointerdown', { ...base(e), pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: e.isPrimary })), true);
    f.addEventListener('wheel', e => redirect(e, e => new WheelEvent('wheel', { ...base(e), deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode })), { capture: true, passive: false });
    f.addEventListener('pointerdown', e => {
      const p = e.target.closest('[data-p]');
      if (p) { select({ kind: 'photo', i: +p.dataset.p }); return; }   // the card drags photos itself
      const mv = e.target.closest('[data-move]');
      if (!mv) { select(null); return; }
      const k = mv.dataset.move, m = secOf(k), q = rectOf({ kind: 'sec', key: k }), pr = f.getBoundingClientRect();
      select({ kind: 'sec', key: k });
      drag = { k, el: mv, x: e.clientX, y: e.clientY, x0: m.x, y0: m.y, cx: q ? ((q.left + q.right) / 2 - pr.left) / scale() : null };
      f.setPointerCapture(e.pointerId); f.classList.add('dragging');
    });
    f.addEventListener('pointermove', e => {
      if (!drag) return;
      const s = scale(), m = secOf(drag.k);
      let x = Math.round(drag.x0 + (e.clientX - drag.x) / s); const y = Math.round(drag.y0 + (e.clientY - drag.y) / s);
      let snapped = false;
      if (drag.cx != null && !e.altKey) { const c = drag.cx + (x - drag.x0); if (Math.abs(c - 540) < 10) { x += Math.round(540 - c); snapped = true; } }   // snap to the centre line
      guide.style.display = snapped ? 'block' : 'none';
      Object.assign(m, { x, y }); drag.el.style.cssText = styleOf(drag.k); overlay();
    });
    const end = () => { if (drag) { drag = null; f.classList.remove('dragging'); guide.style.display = 'none'; } };
    f.addEventListener('pointerup', end); f.addEventListener('pointercancel', end);
    window.addEventListener('pointerup', () => setTimeout(() => { commit(); overlay(); }, 0));   // also catches the card's own photo drags
    f.addEventListener('wheel', e => {
      const p = e.target.closest('[data-p]');
      if (p) { select({ kind: 'photo', i: +p.dataset.p }); }   // the card resizes photos itself
      else {
        const mv = e.target.closest('[data-move]'); if (!mv) return;
        e.preventDefault(); select({ kind: 'sec', key: mv.dataset.move }); resize(e.deltaY < 0 ? 1.05 : 0.95);
      }
      clearTimeout(wheelT); wheelT = setTimeout(() => { commit(); overlay(); refreshBar(); }, 350);
    }, { passive: false });
    o.partsBox.addEventListener('change', e => { const k = e.target.dataset.part; if (!k) return; hiddenOf()[k] = !e.target.checked; if (sel && (sel.key === k || 'p' + sel.i === k)) sel = null; o.render(); commit(); });
    // sliders, per-photo reset buttons, Reset to default: record whatever they changed
    o.panel.addEventListener('change', () => setTimeout(commit, 0));
    o.panel.addEventListener('click', e => { if (e.target.closest('button') && !e.target.closest('[data-se]')) setTimeout(commit, 0); });
    document.addEventListener('keydown', e => {
      if (e.target.closest('input, textarea, select, [contenteditable]')) return;
      const mod = e.ctrlKey || e.metaKey, k = e.key;
      if (mod && (k === 'z' || k === 'Z')) { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
      if (mod && (k === 'y' || k === 'Y')) { e.preventDefault(); return redo(); }
      if (!sel || mod) return;
      const st = e.shiftKey ? 10 : 1, mv = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[k];
      if (mv) { e.preventDefault(); nudge(...mv); clearTimeout(wheelT); wheelT = setTimeout(commit, 350); return; }
      if (k === '+' || k === '=') { e.preventDefault(); resize(1.05); commit(); }
      else if (k === '-' || k === '_') { e.preventDefault(); resize(0.95); commit(); }
      else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); act('hide'); }
      else if (k === 'Escape') select(null);
    });
    window.addEventListener('resize', () => overlay());
    last = snap();
  }
  // positions settle after fonts/photos load: start the undo history from there
  const reset = () => { last = snap(); undoStack.length = 0; redoStack.length = 0; refreshBar(); };

  window.StudioEdit = { init, afterRender, commit, reset, pick, hiddenOf: () => hiddenOf() };
})();
