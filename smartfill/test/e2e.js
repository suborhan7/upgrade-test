/* Loads the studio, adds card-smartfill the way the bookmarklet does, and fills the Match Result card
   with a fake Gemini (no key, no network). Checks that grounded values land in the form and on the poster,
   and that the made-up values the fake model slips in are thrown away.
   Run:  node smartfill/test/e2e.js [studio folder]   (default: this repo; pass ../efcob-studio to test that one) */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
const ADDON = path.join(__dirname, '..', 'card-smartfill.js');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  fs.readFile(p, (err, buf) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(buf); });
});

const SOURCE = `Dhaka Dynamos 3 - 1 Sylhet Strikers
Dhaka Dynamos player: Rafi Ahmed, scorers Rafi 12', Tanvir 55', Rafi 80'
Sylhet Strikers player: Sakib Hasan, scorer Nayeem 33'`;

// fake Gemini: answers by field label, plus two values that are NOT in the source
function fakeFills(fields) {
  const teams = fields.filter(f => /team name/i.test(f.label));
  const by = (re, n) => fields.filter(f => re.test(f.label))[n];
  const out = [];
  const add = (f, value, quote) => f && out.push({ id: f.id, value, quote });
  add(teams[0], 'Dhaka Dynamos', 'Dhaka Dynamos 3');
  add(teams[1], 'Sylhet Strikers FC', 'Sylhet Strikers');            // invented "FC"
  add(by(/^player/i, 0), 'Rafi Ahmed', 'player: Rafi Ahmed');
  add(by(/^player/i, 1), 'Sakib Hasan', 'player: Sakib Hasan');
  add(by(/goals/i, 0), '3', '3 - 1');
  add(by(/goals/i, 1), '1', '3 - 1');
  add(by(/scorers/i, 0), "Rafi 12', Tanvir 55', Rafi 80'", "scorers Rafi 12', Tanvir 55', Rafi 80'");
  add(by(/scorers/i, 1), "Nayeem 33'", "scorer Nayeem 33'");
  add(by(/^date/i, 0), '22 Oct 2026', 'today');                       // invented date
  return out;
}

let failed = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) failed++; };

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  let calls = 0, shotCalls = 0;
  await page.route('https://generativelanguage.googleapis.com/**', async route => {
    calls++;
    const req = route.request();
    const parts = JSON.parse(req.postData()).contents[0].parts;
    if (parts[1] && parts[1].inlineData) {       // phase 2: the screenshot is read to plain text first
      shotCalls++;
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: SOURCE }] } }] }) });
    }
    const prompt = parts[0].text;
    const fields = JSON.parse(prompt.split('FIELDS (JSON):\n')[1].split('\n')[0]);
    check(req.headers()['x-goog-api-key'] === 'test-key', 'key is sent in a header, not in the URL');
    check(prompt.includes(SOURCE), 'prompt carries the pasted source');
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ fills: fakeFills(fields) }) }] } }] }) });
  });

  await page.goto(base + 'index.html#match-result');
  const frame = () => page.frames().find(f => f.url().includes('tools/match-result/'));
  await page.waitForFunction(() => document.querySelector('iframe.on'));
  await page.waitForTimeout(1500);
  const before = await frame().$eval('#teams', el => [...el.querySelectorAll('input[data-t="name"]')].map(i => i.value));
  await page.addScriptTag({ path: ADDON });                // what the bookmarklet does

  await page.fill('#card-smartfill [data-key]', 'test-key');
  await page.fill('#card-smartfill [data-src]', SOURCE);
  await page.click('#card-smartfill [data-fill]');
  await page.waitForFunction(() => /Filled \d+/.test(document.querySelector('#card-smartfill [data-msg]').textContent), null, { timeout: 10000 });
  const msg = await page.textContent('#card-smartfill [data-msg]');

  const f = frame();
  await page.waitForTimeout(800);   // let the poster redraw
  const vals = await f.$$eval('#teams .team-sec', secs => secs.map(s => ({
    name: s.querySelector('[data-t="name"]').value, player: s.querySelector('[data-t="player"]').value,
    score: s.querySelector('[data-t="score"]').value, scorers: s.querySelector('[data-t="scorers"]').value })));
  const date = await f.$eval('[data-k="date"]', i => i.value);
  const dateBefore = await f.$eval('[data-k="date"]', i => i.defaultValue || '');
  const poster = await f.$eval('#poster', el => el.textContent);

  check(calls === 1, 'one Gemini call');
  check(vals[0].name === 'Dhaka Dynamos' && vals[0].player === 'Rafi Ahmed' && vals[0].score === '3', 'team 1 filled from source');
  check(vals[1].player === 'Sakib Hasan' && vals[1].score === '1' && vals[1].scorers === "Nayeem 33'", 'team 2 filled from source');
  check(vals[1].name === '', `invented "Sylhet Strikers FC" thrown away and the sample name "${before[1]}" emptied`);
  check(date !== '22 Oct 2026', `invented date thrown away (date stays "${date}")`);
  check(/Thrown away 2/.test(msg), 'panel reports the 2 thrown-away values');
  check(/Dhaka/i.test(poster) && /Sakib Hasan/i.test(poster) && !new RegExp(before[1], 'i').test(poster), 'poster redraws with the filled values: ' + poster.replace(/\s+/g, ' ').slice(0, 160));
  check(!fs.readFileSync(ADDON, 'utf8').match(/AIza[0-9A-Za-z_-]{20,}/), 'no API key in the add-on source');

  await page.click('#card-smartfill [data-undo]');
  const undone = await f.$$eval('#teams [data-t="name"]', l => l.map(i => i.value));
  check(undone[0] === before[0], 'Undo puts the old values back');

  // phase 2: same fill, from a screenshot
  calls = 0;
  await page.fill('#card-smartfill [data-src]', '');
  await page.setInputFiles('#card-smartfill [data-img]', { name: 'result.png', mimeType: 'image/png', buffer: fs.readFileSync(path.join(ROOT, 'icons', 'icon-192.png')) });
  await page.click('#card-smartfill [data-fill]');
  await page.waitForFunction(() => /Filled \d+/.test(document.querySelector('#card-smartfill [data-msg]').textContent), null, { timeout: 10000 });
  const shotVals = await f.$$eval('#teams [data-t="name"]', l => l.map(i => i.value));
  check(shotCalls === 1 && calls === 2, 'screenshot: one read call, then one fill call');
  check(shotVals[0] === 'Dhaka Dynamos' && shotVals[1] === '', 'screenshot: same strict fill as text');
  check(await page.inputValue('#card-smartfill [data-src]') === SOURCE, 'screenshot: what was read is shown in the box');

  await page.screenshot({ path: path.join(__dirname, 'e2e-shot.png') });
  await browser.close(); server.close();
  console.log(failed ? `${failed} FAILED` : 'all passed');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
