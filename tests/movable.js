/* Movable-elements check for every card.
   Opens each tools/<id>/ page, walks every layout x background (and the other selects that change what is on the poster),
   and for every visible section (data-move) and photo (data-p) checks that a real mouse can grab it
   (some point of it is on top, not covered by another layer), that the click selects it, and that a drag moves it.
   Run from the repo root:  node tests/movable.js [card ...]     (needs playwright; serves the repo on :8765 itself) */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '..'), PORT = +process.env.PORT || 8765;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.wasm': 'application/wasm', '.onnx': 'application/octet-stream' };
// selects that change which parts are on the poster (colour-only and text-only selects are left out)
const DIMS = ['#layoutSel', '#modeSel', '[data-k="layout"]', '[data-k="bgMode"]', '[data-k="bgStyle"]', '[data-k="arrange"]',
  '[data-k="photoMode"]', '[data-tm="photoMode"]', '#styleSel', '[data-k="formation"]', '[data-bg]', '[data-tpl]'];

const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  fs.readFile(p, (err, buf) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(buf); });
});

// in the page: every grabbable thing and one point where a mouse would really hit it
function targets() {
  const frame = document.getElementById('frame'), fr = frame.getBoundingClientRect();
  const shown = el => { for (let e = el; e && e !== frame; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; } return true; };
  const pts = q => { const out = [], n = 9; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out.push([q.left + q.width * (i + .5) / n, q.top + q.height * (j + .5) / n]); return out; };
  const inFrame = ([x, y]) => x > fr.left + 1 && x < fr.right - 1 && y > fr.top + 1 && y < fr.bottom - 1;
  const at1 = (x, y) => window.StudioEdit.pick ? window.StudioEdit.pick(x, y) : document.elementFromPoint(x, y);   // what a press there grabs
  // a point well inside the part (its neighbours 4px away grab it too), not on a sliver at its edge
  const at = (x, y) => { const h = at1(x, y); if (!h) return h; const k = e => e && (e.closest('[data-p]') || e.closest('[data-move]'));
    return [[4, 0], [-4, 0], [0, 4], [0, -4]].every(([a, b]) => k(at1(x + a, y + b)) === k(h)) ? h : null; };
  const res = [];
  document.querySelectorAll('#poster [data-p]').forEach(el => {
    if (!shown(el)) return;
    const q = el.getBoundingClientRect(); if (q.width < 2 || q.height < 2) return;
    const hit = pts(q).filter(inFrame).find(([x, y]) => { const h = at(x, y); return h && h.closest('[data-p]') === el; });
    const top = (() => { const c = pts(q).filter(inFrame)[40]; const h = c && at(...c); return h ? (h.closest('[data-move]') || {}).dataset?.move || h.className : ''; })();
    res.push({ kind: 'photo', id: 'p' + el.dataset.p, pt: hit || null, coveredBy: hit ? '' : String(top) });
  });
  document.querySelectorAll('#poster [data-move]').forEach(el => {
    if (!shown(el)) return;
    const pieces = [...el.querySelectorAll('*')].filter(c => { const q = c.getBoundingClientRect(); return q.width >= 2 && q.height >= 2 && shown(c); });
    if (!pieces.length) return;
    let hit = null, viaPhoto = false, coveredBy = '';
    for (const c of pieces) {
      for (const p of pts(c.getBoundingClientRect()).filter(inFrame)) {
        const h = at(...p); if (!h) continue;
        if (h.closest('[data-move]') === el && !h.closest('[data-p]')) { hit = p; break; }
        if (h.closest('[data-move]') === el) viaPhoto = true;
        else if (!coveredBy) coveredBy = (h.closest('[data-move]') || {}).dataset?.move || h.tagName;
      }
      if (hit) break;
    }
    if (!hit && viaPhoto) return;   // a section that is only a photo is grabbed as that photo
    res.push({ kind: 'sec', id: el.dataset.move, pt: hit, coveredBy: hit ? '' : coveredBy });
  });
  return res;
}
function where(t) {
  const el = t.kind === 'photo' ? document.querySelector(`#poster [data-p="${t.id.slice(1)}"]`) : document.querySelector(`#poster [data-move="${t.id}"]`);
  if (!el) return null; const q = el.getBoundingClientRect(), img = el.querySelector('img');   // a framed photo moves its img inside the frame
  return [Math.round(q.left), Math.round(q.top), getComputedStyle(el).transform, el.getAttribute('style'), img && img.getAttribute('style')].join('|');
}

async function combos(page) {
  // depth-first over the visible dimension selects, re-reading which are visible after each choice
  const out = [];
  async function walk(i, picked) {
    if (i === DIMS.length) { out.push(picked); return; }
    const info = await page.evaluate(s => { const el = document.querySelector('#form ' + s); if (!el) return null; let vis = !!el.offsetParent; return { vis, opts: [...el.options].map(o => o.value) }; }, DIMS[i]);
    if (!info || !info.vis) return walk(i + 1, picked);
    for (const v of info.opts) { await choose(page, DIMS[i], v); await walk(i + 1, { ...picked, [DIMS[i]]: v }); }
  }
  await walk(0, {});
  return out;
}
async function choose(page, sel, v) { await page.selectOption('#form ' + sel, v); await page.waitForTimeout(60); }

async function runCard(browser, card) {
  const page = await browser.newPage({ viewport: { width: 1900, height: 1500 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/tools/${card}/`);
  await page.evaluate(() => window.__ready).catch(() => {});
  await page.waitForTimeout(300);
  const all = await combos(page), fails = [];
  let checked = 0;
  for (const c of all) {
    for (const [s, v] of Object.entries(c)) await choose(page, s, v);
    await page.click('#resetAll'); await page.waitForTimeout(150);
    const label = Object.values(c).join(' / ');
    const ts = await page.evaluate(targets);
    for (const t of ts) {
      checked++;
      if (!t.pt) { fails.push(`${card} [${label}] ${t.id}: can't be grabbed (covered by ${t.coveredBy || '?'})`); continue; }
      const before = await page.evaluate(where, t);
      const [x, y] = t.pt;
      await page.mouse.move(x, y); await page.mouse.down();
      const name = await page.$eval('.se-name', e => e.textContent).catch(() => '');
      await page.mouse.move(x + 25, y + 18, { steps: 4 }); await page.mouse.move(x + 50, y + 35, { steps: 4 }); await page.mouse.up();
      await page.waitForTimeout(40);
      const after = await page.evaluate(where, t);
      if (!/^Selected:/.test(name)) fails.push(`${card} [${label}] ${t.id}: click doesn't select it ("${name}")`);
      else if (before === after) fails.push(`${card} [${label}] ${t.id}: drag doesn't move it`);
      await page.keyboard.press('Escape');
      await page.click('#resetAll'); await page.waitForTimeout(60);
    }
  }
  await page.close();
  return { card, combos: all.length, checked, fails, errors: [...new Set(errors)] };
}

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? {} : {});
  const cards = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(path.join(ROOT, 'tools')).filter(d => fs.existsSync(path.join(ROOT, 'tools', d, 'index.html')));
  let bad = 0;
  for (const card of cards) {
    const r = await runCard(browser, card);
    bad += r.fails.length;
    console.log(`${r.fails.length ? 'FAIL' : 'ok  '} ${card}: ${r.combos} combos, ${r.checked} parts checked, ${r.fails.length} failures`);
    r.fails.forEach(f => console.log('   - ' + f));
    r.errors.forEach(e => console.log('   ! page error: ' + e));
  }
  await browser.close(); server.close();
  console.log(bad ? `\n${bad} failures` : '\nAll parts movable');
  process.exit(bad ? 1 : 0);
})();
