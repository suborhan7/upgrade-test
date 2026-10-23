/* Photo library in a real browser, on a phone-sized screen. No network: the cut-out model is replaced by a fake that counts calls.
   Imports a compressed zip (made like a phone makes it), imports it again (all skipped), fills photo and logo slots by typing names
   in several cards (comparison A/B, Best XI player 11, a 7-player squad, Match Result team squad), switches and deletes with the
   thumbnails, saves a hand-picked photo, backs up, wipes the library and brings the backup back (cut-outs included).
   Run:  node library/test/e2e.js        (needs playwright; screenshots go to library/test/out/) */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');

const ROOT = path.join(__dirname, '..', '..'), OUT = path.join(__dirname, 'out');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/json' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  fs.readFile(p, (err, buf) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(buf); });
});

/* ---------- test pictures and a phone-style zip (deflate + data descriptors) ---------- */
const crcT = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function png(r, g, b, w = 120, h = 160) {   // a solid colour, opaque, so the cards try to cut it out
  const row = Buffer.alloc(1 + w * 3); for (let x = 0; x < w; x++) row.set([r, g, b], 1 + x * 3);
  const raw = Buffer.concat(Array(h).fill(row));
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function phoneZip(files) {
  const parts = [], cd = []; let off = 0;
  for (const [name, data] of files) {
    const n = Buffer.from(name), z = zlib.deflateRawSync(data), c = crc(data);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x808, 6); h.writeUInt16LE(8, 8); h.writeUInt16LE(n.length, 26);
    const dd = Buffer.alloc(16); dd.writeUInt32LE(0x08074b50, 0); dd.writeUInt32LE(c, 4); dd.writeUInt32LE(z.length, 8); dd.writeUInt32LE(data.length, 12);
    parts.push(h, n, z, dd);
    const e = Buffer.alloc(46); e.writeUInt32LE(0x02014b50, 0); e.writeUInt16LE(20, 4); e.writeUInt16LE(20, 6); e.writeUInt16LE(0x808, 8); e.writeUInt16LE(8, 10);
    e.writeUInt32LE(c, 16); e.writeUInt32LE(z.length, 20); e.writeUInt32LE(data.length, 24); e.writeUInt16LE(n.length, 28); e.writeUInt32LE(off, 42);
    cd.push(e, n); off += 30 + n.length + z.length + 16;
  }
  const cds = Buffer.concat(cd), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cds.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cds, end]);
}
const zipNames = buf => { const out = []; let p = buf.readUInt32LE(buf.length - 6); while (buf.readUInt32LE(p) === 0x02014b50) { const n = buf.readUInt16LE(p + 28), x = buf.readUInt16LE(p + 30), c = buf.readUInt16LE(p + 32); out.push(buf.slice(p + 46, p + 46 + n).toString()); p += 46 + n + x + c; } return out; };

let failed = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) failed++; };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise(r => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/`;
  const zipPath = path.join(OUT, 'phone.zip');
  fs.writeFileSync(zipPath, phoneZip([
    ['Nova_10/1.png', png(200, 30, 30)], ['Nova_10/2.png', png(30, 200, 30)],
    ['rafi-ahmed-1.png', png(30, 30, 200)], ['IMG_0001.png', png(90, 90, 90)],
    ['logos/Dhaka Strikers.png', png(250, 200, 0, 80, 80)], ['notes.txt', Buffer.from('hi')],
  ]));
  fs.writeFileSync(path.join(OUT, 'sakib.png'), png(120, 0, 160));

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => { console.log('page error:', e.message); failed++; });
  const msg = () => page.locator('#plib [data-msg]').innerText();
  const open = async () => { if (await page.locator('#plib').isHidden()) await page.click('#plib-pill'); };

  // every card: a fake cut-out that counts its calls
  async function card(id) {
    await page.evaluate(i => { location.hash = i; }, id);
    const fr = await (async () => { for (let t = 0; t < 100; t++) { const f = page.frames().find(x => x.url().includes(`/tools/${id}/`)); if (f) { try { if (await f.evaluate(() => !!window.__plibCutout)) return f; } catch {} } await page.waitForTimeout(100); } throw new Error('card did not load: ' + id); })();
    await fr.evaluate(() => {
      if (window.__fakeCut) return;
      window.__fakeCut = true; window.cutCalls = 0;
      window.__plibCutout = async () => { window.cutCalls++; const c = document.createElement('canvas'); c.width = 40; c.height = 60; c.getContext('2d').fillRect(10, 10, 20, 40); return await new Promise(r => c.toBlob(r, 'image/png')); };
    });
    return fr;
  }
  const typeName = (fr, sel, i, v) => fr.evaluate(([s, i, v]) => { const el = document.querySelectorAll(s)[i]; el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, [sel, i, v]);
  const fileName = (fr, sel, i) => fr.evaluate(([s, i]) => { const f = document.querySelectorAll(s)[i].files[0]; return f ? f.name : ''; }, [sel, i]);
  const settle = () => page.waitForTimeout(1200);
  // thumbnails in the strip under one slot (-1 when the strip is hidden)
  const thumbs = (fr, sel, i = 0) => fr.evaluate(([s, i]) => { const inp = document.querySelectorAll(s)[i], a = inp.closest('label') || inp.parentElement, st = a.nextElementSibling;
    return !st || !st.classList.contains('plib-strip') || st.hidden ? -1 : st.querySelectorAll('.plib-th').length; }, [sel, i]);

  await page.goto(base + 'index.html#comparison');
  await page.evaluate(() => new Promise(r => { const q = indexedDB.deleteDatabase('efcb-photo-library'); q.onsuccess = q.onerror = q.onblocked = r; }));
  await page.reload();
  await page.waitForSelector('#plib-pill');

  /* import, then import again */
  await open();
  await page.setInputFiles('#plib [data-zipin]', zipPath);
  await page.waitForFunction(() => /Added/.test(document.querySelector('#plib [data-msg]').innerText));
  let m = await msg();
  check(/Added 3 photos and 1 logo/.test(m), 'phone zip imported: 3 photos, 1 logo  (' + m.replace(/\n/g, ' / ') + ')');
  check(/1 had no name/.test(m), 'IMG_0001 without a name is reported, not guessed');
  await page.setInputFiles('#plib [data-zipin]', zipPath);
  await page.waitForFunction(() => /Skipped/.test(document.querySelector('#plib [data-msg]').innerText));
  m = await msg();
  check(/Added 0 photos and 0 logos/.test(m) && /Skipped 4/.test(m), 'same zip again: everything skipped  (' + m.replace(/\n/g, ' / ') + ')');
  check(/3 photos of 2 players · 1 logo of 1 team/.test(await page.locator('#plib [data-stats]').innerText()), 'photo count shown');
  await page.screenshot({ path: path.join(OUT, 'panel-phone.png') });
  await page.fill('#plib [data-q]', 'nova');
  check(await page.locator('#plib .ent').count() === 1, 'search "nova" finds Nova_10');
  await page.fill('#plib [data-q]', '');
  await page.click('#plib [data-close]');

  /* comparison A / B */
  let fr = await card('comparison');
  await typeName(fr, '[data-player="a"] [data-p="name"]', 0, 'nova 10'); await settle();
  check(await fileName(fr, '[data-player="a"] [data-photo]', 0) === '2.png', 'Comparison A: "nova 10" puts Nova_10\'s newest photo in');
  check(await fr.evaluate(() => window.cutCalls) === 1, 'cut-out ran once for a new photo');
  check(await thumbs(fr, '[data-player="a"] [data-photo]') === 2, 'two thumbnails under the slot');
  check(await thumbs(fr, '[data-player="a"] [data-logo]') === -1, 'the strip of a hidden slot (team logo in this layout) is hidden');
  await typeName(fr, '[data-player="b"] [data-p="name"]', 0, 'Nova_10'); await settle();
  check(await fileName(fr, '[data-player="b"] [data-photo]', 0) === '2.png', 'Comparison B: "Nova_10" fills too');
  check(await fr.evaluate(() => window.cutCalls) === 1, 'the same photo again: saved cut-out used, model not run');
  await fr.locator('[data-player="b"] .plib-th').nth(1).click(); await settle();
  check(await fileName(fr, '[data-player="b"] [data-photo]', 0) === '1.png', 'thumbnail switches to the older photo');
  check(await fr.locator('[data-player="b"] .plib-th.on').count() === 1, 'the photo in use is marked');
  await fr.locator('[data-player="b"] .plib-th').nth(1).locator('.plib-x').click(); await page.waitForTimeout(300);
  check(await thumbs(fr, '[data-player="b"] [data-photo]') === 1, '× deletes a photo');
  check(await thumbs(fr, '[data-player="a"] [data-photo]') === 1, 'the other slot sees the delete too');
  await fr.locator('[data-player="b"] [data-undo]').click(); await page.waitForTimeout(300);
  check(await thumbs(fr, '[data-player="b"] [data-photo]') === 2, 'Undo puts it back');
  await page.screenshot({ path: path.join(OUT, 'comparison-phone.png') });

  /* Best XI: player 11 + team logo */
  fr = await card('best-xi');
  await typeName(fr, '[data-f="name"]', 10, 'Rafi Ahmed'); await settle();
  check(await fileName(fr, '[data-photo]', 10) === 'rafi-ahmed-1.png', 'Best XI player 11: "Rafi Ahmed" (from rafi-ahmed-1.png) fills');
  await typeName(fr, '[data-f="team"]', 10, 'dhaka strikers'); await settle();
  check(await fileName(fr, '[data-logo]', 10) === 'Dhaka Strikers.png', 'Best XI: team logo filled from the team name');

  /* Team Performance: squad player 7 */
  fr = await card('team-performance');
  await typeName(fr, '[data-pn]', 6, 'nova'); await settle();
  check(await fileName(fr, '[data-pp]', 6) === '2.png', 'Team Performance squad player 7: "nova" fills');
  await typeName(fr, '[data-t="name"]', 0, 'Dhaka Strikers'); await settle();
  check(await fileName(fr, '#teamLogo', 0) === 'Dhaka Strikers.png', 'Team Performance: team logo filled');

  /* Match Result team mode: squad row + captain */
  fr = await card('match-result');
  await typeName(fr, '[data-sn]', 9, 'nova10'); await settle();
  check(await fileName(fr, '[data-sp]', 9) === '2.png', 'Match Result team 2 squad player 5 fills');
  await typeName(fr, '[data-tt="captain"]', 1, 'rafi ahmed'); await settle();
  check(await fileName(fr, '[data-tphoto]', 1) === 'rafi-ahmed-1.png', 'Match Result team 2 captain fills');

  /* MVP: a photo picked by hand with a name typed is saved */
  fr = await card('mvp');
  await typeName(fr, '[data-p="name"]', 0, 'Sakib'); await settle();
  await fr.setInputFiles('[data-photo]', path.join(OUT, 'sakib.png')); await settle();
  check(/Saved to the library/.test(await fr.locator('.plib-strip').first().innerText()), 'hand-picked photo saved under the typed name');
  check(await fr.evaluate(() => window.cutCalls) === 1, 'its cut-out ran once');

  /* every card: every slot has its name box */
  const want = { comparison: 4, mvp: 1, 'match-result': 18, 'top-4': 8, 'player-vs-player': 4, 'team-vs-team': 4, transfer: 3, 'best-xi': 22, 'points-table': 17, fixtures: 32, lineup: 4, 'team-performance': 8, achievement: 8 };
  for (const [id, n] of Object.entries(want)) {
    const f = await card(id);
    const got = await page.evaluate(i => { const fr = [...document.querySelectorAll('iframe')].find(x => x.src.includes(`/tools/${i}/`)); return fr.contentDocument.querySelectorAll('.plib-strip').length; }, id);
    check(got === n, `${id}: ${got} photo / logo slots linked (want ${n})`);
    void f;
  }

  /* backup, wipe, restore */
  await open();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#plib [data-backup]')]);
  const bk = path.join(OUT, 'backup.zip'); await dl.saveAs(bk);
  const names = zipNames(fs.readFileSync(bk));
  check(['Nova_10/1.png', 'Nova_10/2.png', 'rafi-ahmed/1.png', 'Sakib/1.png', 'logos/Dhaka Strikers/1.png', 'library.json'].every(n => names.includes(n)) && names.some(n => /^Nova_10\/2\.cutout-(small|medium)\.png$/.test(n)), 'backup zip layout: ' + names.join(', '));
  await page.evaluate(() => new Promise(r => { const q = indexedDB.deleteDatabase('efcb-photo-library'); q.onsuccess = q.onerror = q.onblocked = r; }));
  await page.goto(base + 'index.html#comparison'); await page.reload();
  await open();
  await page.setInputFiles('#plib [data-zipin]', bk);
  await page.waitForFunction(() => /Added/.test(document.querySelector('#plib [data-msg]').innerText));
  m = await msg();
  check(/Added 4 photos and 1 logo/.test(m) && /cut-out/.test(m), 'backup imported on a "new phone", with cut-outs  (' + m.replace(/\n/g, ' / ') + ')');
  await page.click('#plib [data-close]');
  fr = await card('comparison');
  await typeName(fr, '[data-player="a"] [data-p="name"]', 0, 'nova'); await settle();
  check(await fileName(fr, '[data-player="a"] [data-photo]', 0) === '2.png' && await fr.evaluate(() => window.cutCalls) === 0, 'after restore: photo fills and the saved cut-out is used (model not run)');

  await browser.close(); server.close();
  console.log(failed ? `\n${failed} FAILED` : '\nall ok');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
