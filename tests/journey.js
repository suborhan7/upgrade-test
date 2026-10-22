/* User-journey check for every card: does what an admin does with the editor, the way they do it, and reports where they
   would get stuck. For every layout of every card, on every visible section and photo:
     click selects it · − / + buttons resize · arrow buttons and arrow keys move · Majhe centres · Reset puts it back ·
     mouse wheel resizes (and does not scroll the page) · drag moves it and it can be grabbed again where it now is ·
     Ctrl+Z / Ctrl+Y undo and redo the drag · Delete removes it and its tick in the parts list brings it back ·
     Reset to default puts everything back.
   Then per card: upload own pictures in every file box (photo, logo, background...) and check every part can still be
   grabbed, drag a photo with a finger on a phone-sized screen, and download the PNG.
   Run from the repo root:  node tests/journey.js [card ...]   (ONLY=parts|upload|phone for one round)     (needs playwright; serves the repo on :8766 itself) */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');

const ROOT = path.resolve(__dirname, '..'), PORT = +process.env.PORT || 8766;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.wasm': 'application/wasm' };
const ONLY = process.env.ONLY;   // parts | upload | phone: run just that round
const LAYOUT_DIMS = ['#modeSel', '#layoutSel', '[data-k="layout"]'];

const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  fs.readFile(p, (err, buf) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(buf); });
});

// ---- in the page ----
function elOf(t) { return t.kind === 'photo' ? document.querySelector(`#poster [data-p="${t.id.slice(1)}"]`) : document.querySelector(`#poster [data-move="${t.id}"]`); }
// where the part is on screen (union of its painted pieces), or null when it is not shown
function geom(t) {
  const el = (function (t) { return t.kind === 'photo' ? document.querySelector(`#poster [data-p="${t.id.slice(1)}"]`) : document.querySelector(`#poster [data-move="${t.id}"]`); })(t);
  if (!el) return null;
  for (let e = el; e && e.id !== 'frame'; e = e.parentElement) if (getComputedStyle(e).display === 'none') return null;
  const img = t.kind === 'photo' && el.tagName !== 'IMG' ? el.querySelector('img') : null;   // a framed photo sizes its img
  const list = img ? [img] : el.children.length ? [...el.querySelectorAll('*')] : [el];   // a section's .mv layer covers the poster: measure what is in it
  let l = 1e9, tp = 1e9, r = -1e9, b = -1e9;
  list.forEach(c => { const q = c.getBoundingClientRect(); if (q.width < 1 || q.height < 1) return; l = Math.min(l, q.left); tp = Math.min(tp, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); });
  if (r <= l) return null;
  return { cx: (l + r) / 2, cy: (tp + b) / 2, w: r - l, h: b - tp };
}
// every visible part and one point where a press really grabs it
function targets() {
  const frame = document.getElementById('frame'), fr = frame.getBoundingClientRect();
  const shown = el => { for (let e = el; e && e !== frame; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; } return true; };
  const pts = q => { const out = [], n = 9; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out.push([q.left + q.width * (i + .5) / n, q.top + q.height * (j + .5) / n]); return out; };
  const ok = ([x, y]) => x > fr.left + 1 && x < fr.right - 1 && y > fr.top + 1 && y < fr.bottom - 1;
  const at1 = (x, y) => window.StudioEdit.pick ? window.StudioEdit.pick(x, y) : document.elementFromPoint(x, y);
  // a point well inside the part (its neighbours 4px away grab it too), not on a sliver at its edge
  const at = (x, y) => { const h = at1(x, y); if (!h) return h; const k = e => e && (e.closest('[data-p]') || e.closest('[data-move]'));
    return [[4, 0], [-4, 0], [0, 4], [0, -4]].every(([a, b]) => k(at1(x + a, y + b)) === k(h)) ? h : null; };
  const res = [];
  document.querySelectorAll('#poster [data-p]').forEach(el => {
    if (!shown(el)) return;
    const q = el.getBoundingClientRect(); if (q.width < 2 || q.height < 2) return;
    const hit = pts(q).filter(ok).find(p => { const h = at(...p); return h && h.closest('[data-p]') === el; });
    res.push({ kind: 'photo', id: 'p' + el.dataset.p, pt: hit || null });
  });
  document.querySelectorAll('#poster [data-move]').forEach(el => {
    if (!shown(el)) return;
    const pieces = [...el.querySelectorAll('*')].filter(c => { const q = c.getBoundingClientRect(); return q.width >= 2 && q.height >= 2 && shown(c); });
    if (!pieces.length) return;
    let hit = null, viaPhoto = false;
    for (const c of pieces) {
      for (const p of pts(c.getBoundingClientRect()).filter(ok)) {
        const h = at(...p); if (!h) continue;
        if (h.closest('[data-move]') === el && !h.closest('[data-p]')) { hit = p; break; }
        if (h.closest('[data-move]') === el) viaPhoto = true;
      }
      if (hit) break;
    }
    if (!hit && viaPhoto) return;
    res.push({ kind: 'sec', id: el.dataset.move, pt: hit });
  });
  return res;
}
const selected = () => !!document.querySelector('.se-bar.has-sel') || /^Selected:/.test((document.querySelector('.se-name') || {}).textContent || '');

// ---- helpers ----
const near = (a, b, d = 2) => Math.abs(a - b) <= d;
const same = (a, b) => a && b && near(a.cx, b.cx) && near(a.cy, b.cy) && near(a.w, b.w) && near(a.h, b.h);
async function choose(page, sel, v) { await page.selectOption('#form ' + sel, v); await page.waitForTimeout(80); }
async function layouts(page) {
  const out = [];
  async function walk(i, picked) {
    if (i === LAYOUT_DIMS.length) { out.push(picked); return; }
    const opts = await page.evaluate(s => { const el = document.querySelector('#form ' + s); return el && el.offsetParent ? [...el.options].map(o => o.value) : null; }, LAYOUT_DIMS[i]);
    if (!opts) return walk(i + 1, picked);
    for (const v of opts) { await choose(page, LAYOUT_DIMS[i], v); await walk(i + 1, { ...picked, [LAYOUT_DIMS[i]]: v }); }
  }
  await walk(0, {});
  return out;
}
async function open(browser, card, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1900, height: 1500 }, acceptDownloads: true, ...opts });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/tools/${card}/`);
  await page.evaluate(() => window.__ready).catch(() => {});
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}
const se = (page, a) => page.click(`.se-bar [data-se="${a}"]`);
const resetAll = async page => { await page.$eval('#resetAll', b => b.click()); await page.waitForTimeout(120); };   // a helper between steps, not a step under test

// one part, the whole round of things an admin does with it
async function journey(page, t, say) {
  const g = () => page.evaluate(geom, t);
  let [x, y] = t.pt;
  const g0 = await g(); if (!g0) return;
  const scale = await page.evaluate(() => document.getElementById('frame').getBoundingClientRect().width / 1080);
  const fail = m => say(`${t.id}: ${m}` + (process.env.DEBUG ? ` @${t.pt.map(Math.round)}` : ""));

  // click to select
  await page.mouse.click(x, y);
  if (!(await page.evaluate(selected))) return fail('click does not select it');
  // + / −
  await se(page, 'bigger'); await se(page, 'bigger');
  let g1 = await g();
  if (!g1 || g1.w <= g0.w * 1.03) fail('+ button does not make it bigger');
  await se(page, 'smaller'); await se(page, 'smaller');
  g1 = await g(); if (!g1 || g1.w >= g0.w * 1.02 + 2) { const g2 = await g(); if (!g2 || g2.w > g0.w * 1.05) fail('− button does not make it smaller'); }
  // arrow buttons
  let a = await g(); await se(page, 'right'); let b = await g();
  if (!b || b.cx - a.cx < 1) fail('→ button does not move it');
  a = b; await se(page, 'down'); b = await g();
  if (!b || b.cy - a.cy < 1) fail('↓ button does not move it');
  // arrow keys (Shift = 10px)
  a = b; await page.keyboard.press('Shift+ArrowLeft'); b = await g();
  if (!b || a.cx - b.cx < 1) fail('Shift+← key does not move it');
  // centre
  await se(page, 'center'); b = await g();
  // a part goes to the poster's centre line, a photo in a frame (face circle, slot) to the middle of its frame
  const fr = await page.evaluate(t => {
    const el = t.kind === 'photo' && document.querySelector(`#poster [data-p="${t.id.slice(1)}"]`), poster = document.getElementById('poster');
    let box = document.getElementById('frame');
    if (el && el.tagName !== 'IMG' && el.querySelector('img')) box = el;
    else if (el) for (let p = el.parentElement; p && p !== poster; p = p.parentElement) if (getComputedStyle(p).overflow !== 'visible') { box = p; break; }
    const q = box.getBoundingClientRect(); return q.left + q.width / 2; }, t);
  if (!b || !near(b.cx, fr, 3)) fail(`Majhe does not centre it (off by ${b ? Math.round(b.cx - fr) : '?'}px)`);
  // reset this one
  await se(page, 'resetone'); await page.waitForTimeout(60); b = await g();
  if (!same(b, g0)) fail('Reset does not put it back');
  // mouse wheel, page must not scroll
  const sy = await page.evaluate(() => [scrollY, document.getElementById('form').scrollTop, (document.querySelector('.stage') || {}).scrollTop]);
  await page.mouse.move(x, y); await page.mouse.wheel(0, -100); await page.waitForTimeout(60); await page.mouse.wheel(0, -100); await page.waitForTimeout(400);
  b = await g();
  if (!b || b.w <= g0.w * 1.03) fail(`mouse wheel does not resize it (${Math.round(g0.w)} -> ${b ? Math.round(b.w) : 'gone'})`);
  const sy2 = await page.evaluate(() => [scrollY, document.getElementById('form').scrollTop, (document.querySelector('.stage') || {}).scrollTop]);
  if (JSON.stringify(sy) !== JSON.stringify(sy2)) fail('mouse wheel on it scrolls the page');
  await se(page, 'resetone'); await page.waitForTimeout(60);
  // drag, grab it again at its new spot, undo / redo (from a fresh grab point: tiny pieces like confetti shift when resized)
  const fresh = (await page.evaluate(targets)).find(q => q.id === t.id);
  if (fresh && fresh.pt) [x, y] = fresh.pt;
  const before = await g(), mx = Math.min(60, Math.max(8, before.w * .25)), my = Math.min(40, Math.max(6, before.h * .25));   // a nudge an admin would make, small photos in small frames too
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + mx / 2, y + my / 2, { steps: 4 }); await page.mouse.move(x + mx, y + my, { steps: 4 }); await page.mouse.up();
  await page.waitForTimeout(80);
  const moved = await g();
  if (same(moved, before)) fail('drag does not move it' + (process.env.DEBUG ? ' ' + JSON.stringify([before, moved, await page.evaluate(() => [document.querySelector('.se-name').textContent, JSON.stringify(window.__posterState && window.__posterState.moves)])]) : ''));
  else {
    await page.keyboard.press('Escape');
    // grab it again wherever it now shows (it may now lie under another part: then it is grabbed where it peeks out)
    const again = (await page.evaluate(targets)).find(q => q.id === t.id);
    if (again && again.pt) await page.mouse.click(...again.pt);
    if (!again || !again.pt) fail('after dragging it, it is fully hidden under other parts and cannot be grabbed again');
    else if (!(await page.evaluate(selected))) fail('after dragging it, it cannot be clicked again where it now is');
    else {
      const w = (await g()).w; await se(page, 'bigger'); const w2 = ((await g()) || {}).w;
      if (!(w2 > w * 1.02)) fail('after dragging it, clicking it again selects something else');
      await page.keyboard.press('Control+z'); await page.waitForTimeout(80);
    }
    await page.keyboard.press('Control+z'); await page.waitForTimeout(80);
    if (!same(await g(), before)) fail('Ctrl+Z does not undo the drag');
    await page.keyboard.press('Control+y'); await page.waitForTimeout(80);
    if (!same(await g(), moved)) fail('Ctrl+Y does not redo the drag');
  }
  await resetAll(page);
  // remove with Delete, bring back from the parts list
  await page.mouse.click(x, y);
  await page.keyboard.press('Delete'); await page.waitForTimeout(80);
  if (await g()) fail('Delete does not remove it');
  else {
    const box = await page.$(`#form [data-part="${t.id}"]`);
    if (!box) fail('removed, but it has no tick in the parts list to bring it back');
    else {
      // the parts list may be folded: open it by its heading, as an admin would
      if (!(await box.isVisible())) await box.evaluate(b => { const h = b.closest('section') && b.closest('section').querySelector(':scope > h3'); if (h) h.click(); });
      await box.scrollIntoViewIfNeeded(); await box.check(); await page.waitForTimeout(80);
      if (!(await g())) fail('ticking it in the parts list does not bring it back');
    }
  }
  await resetAll(page);
  if (!same(await g(), g0)) fail('Reset to default does not put it back');
}

async function pngFile(dir, name, w, h, draw, page) {
  const data = await page.evaluate(([w, h, draw]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); new Function('g', 'w', 'h', draw)(g, w, h); return c.toDataURL('image/png').split(',')[1]; }, [w, h, draw]);
  const p = path.join(dir, name); fs.writeFileSync(p, Buffer.from(data, 'base64')); return p;
}

async function runCard(browser, card, files) {
  const fails = [];
  // 1. every layout, every part
  if (!ONLY || ONLY === 'parts') {
    const { ctx, page, errors } = await open(browser, card);
    for (const c of await layouts(page)) {
      for (const [s, v] of Object.entries(c)) await choose(page, s, v);
      await resetAll(page);
      const label = Object.values(c).join(' / ') || 'default';
      for (const t of await page.evaluate(targets)) {
        if (!t.pt) { fails.push(`[${label}] ${t.id}: cannot be grabbed`); continue; }
        await journey(page, t, m => fails.push(`[${label}] ${m}`));
        await page.keyboard.press('Escape'); await resetAll(page);
      }
    }
    errors.forEach(e => fails.push('page error: ' + e));
    await ctx.close();
  }
  // 2. own pictures in every file box, then every part must still be grabbable, then download
  if (!ONLY || ONLY === 'upload') {
    const { ctx, page, errors } = await open(browser, card);
    for (const c of await layouts(page)) {
      for (const [s, v] of Object.entries(c)) await choose(page, s, v);
      if (await page.$('#form [data-k="bgMode"]')) await choose(page, '[data-k="bgMode"]', 'image').catch(() => {});
      const inputs = await page.$$('#form input[type=file]');
      for (const inp of inputs) {
        if (!(await inp.isVisible())) continue;
        const accept = (await inp.getAttribute('accept')) || '';
        if (accept && !/image/.test(accept)) continue;
        const big = await inp.evaluate(i => /bg|background/i.test((i.dataset.file || '') + (i.closest('label') || {}).textContent));
        await inp.setInputFiles(big ? files.bg : files.player);
        await page.waitForTimeout(250);
      }
      await page.waitForTimeout(800); await resetAll(page);
      const label = (Object.values(c).join(' / ') || 'default') + ' + own pictures';
      for (const t of await page.evaluate(targets)) {
        if (!t.pt) { fails.push(`[${label}] ${t.id}: cannot be grabbed`); continue; }
        const b = await page.evaluate(geom, t), [x, y] = t.pt;
        await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 40, y + 30, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(40);
        if (same(await page.evaluate(geom, t), b)) fails.push(`[${label}] ${t.id}: drag does not move it`);
        await page.keyboard.press('Escape'); await resetAll(page);
      }
    }
    // download (last layout, own pictures, one part selected so the selection box is on screen)
    const t = (await page.evaluate(targets)).find(t => t.pt);
    if (t) await page.mouse.click(...t.pt);
    try {
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#download')]);
      const p = await dl.path(), size = p ? fs.statSync(p).size : 0;
      if (size < 50000) fails.push(`download: PNG looks empty (${size} bytes)`);
    } catch (e) { fails.push('download: no PNG after 60s'); }
    errors.forEach(e => fails.push('page error (own pictures): ' + e));
    await ctx.close();
  }
  // 3. phone: drag every photo and section with a finger on the default layout
  if (!ONLY || ONLY === 'phone') {
    const { ctx, page, errors } = await open(browser, card, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const cdp = await ctx.newCDPSession(page);
    const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await page.evaluate(() => document.getElementById('frame').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(200);
    for (const t0 of await page.evaluate(targets)) {
      const t = (await page.evaluate(targets)).find(q => q.id === t0.id) || t0;   // the page may have scrolled since
      if (!t.pt) { fails.push(`[phone] ${t.id}: cannot be grabbed`); continue; }
      const b = await page.evaluate(geom, t), [x, y] = t.pt, sy = await page.evaluate(() => scrollY);
      await touch('touchStart', x, y); for (let i = 1; i <= 5; i++) await touch('touchMove', x + i * 6, y + i * 4); await touch('touchEnd');
      await page.waitForTimeout(60);
      const a = await page.evaluate(geom, t);
      if (same(a, b)) fails.push(`[phone] ${t.id}: finger drag does not move it (at ${t.pt.map(Math.round)}, scrollY ${sy}, ${await page.evaluate(() => document.querySelector('.se-name').textContent)})`);
      if (await page.evaluate(sy => scrollY !== sy, sy)) fails.push(`[phone] ${t.id}: finger drag scrolls the page`);
      await resetAll(page);
      await page.evaluate(() => document.getElementById('frame').scrollIntoView({ block: 'center' }));
    }
    errors.forEach(e => fails.push('page error (phone): ' + e));
    await ctx.close();
  }
  return [...new Set(fails)];
}

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'journey-'));
  const p0 = await browser.newPage();
  const files = {
    // a cut-out (transparent around a body shape) and a full background picture
    player: await pngFile(tmp, 'player.png', 600, 800, `g.fillStyle='#c33';g.beginPath();g.arc(300,200,110,0,7);g.fill();g.fillStyle='#246';g.fillRect(140,320,320,480);`, p0),
    bg: await pngFile(tmp, 'bg.png', 1080, 1350, `const r=g.createLinearGradient(0,0,w,h);r.addColorStop(0,'#123');r.addColorStop(1,'#a52');g.fillStyle=r;g.fillRect(0,0,w,h);`, p0),
  };
  await p0.close();
  const cards = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(path.join(ROOT, 'tools')).filter(d => fs.existsSync(path.join(ROOT, 'tools', d, 'index.html')));
  let bad = 0;
  for (const card of cards) {
    const f = await runCard(browser, card, files);
    bad += f.length;
    console.log(`${f.length ? 'FAIL' : 'ok  '} ${card}: ${f.length} problems`);
    f.forEach(m => console.log('   - ' + m));
  }
  await browser.close(); server.close();
  console.log(bad ? `\n${bad} problems` : '\nNo problems found');
  process.exit(bad ? 1 : 0);
})();
