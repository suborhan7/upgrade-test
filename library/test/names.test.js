// node --test library/test/names.test.js : name matching and zip layout rules of the Photo library
const test = require('node:test'), assert = require('node:assert');
const L = require('../photo-library.js');

const nova = { id: 'a', kind: 'photo', name: 'Nova_10', aliases: [] };
const nova7 = { id: 'b', kind: 'photo', name: 'Nova 7', aliases: [] };
const rafi = { id: 'c', kind: 'photo', name: 'Rafi Ahmed', aliases: ['R4FI'] };
const team = { id: 'd', kind: 'logo', name: 'Dhaka Strikers', aliases: [] };

test('"nova", "Nova_10" and "nova 10" all find Nova_10', () => {
  for (const t of ['nova', 'Nova_10', 'nova 10', 'NOVA-10', 'nova10', ' Nova_10 ']) assert.deepStrictEqual(L.find([nova, rafi], t, 'photo'), [nova], t);
});
test('a name without its number finds every player with that name; the exact name wins', () => {
  assert.strictEqual(L.find([nova, nova7], 'nova', 'photo').length, 2);
  assert.deepStrictEqual(L.find([nova, nova7], 'nova 7', 'photo'), [nova7]);
  assert.deepStrictEqual(L.find([nova, nova7], 'nova 1', 'photo'), []);
});
test('other names (gamer tag / real name) match too, accents ignored', () => {
  assert.deepStrictEqual(L.find([nova, rafi], 'r4fi', 'photo'), [rafi]);
  assert.deepStrictEqual(L.find([nova, rafi], 'Rafí Ahmed', 'photo'), [rafi]);
});
test('logos are found by team name only, not by a shorter name', () => {
  assert.deepStrictEqual(L.find([team, nova], 'dhaka strikers', 'logo'), [team]);
  assert.deepStrictEqual(L.find([team], 'dhaka', 'logo'), []);
  assert.deepStrictEqual(L.find([team], 'Nova_10', 'logo'), []);
});
test('search finds any part of a name', () => {
  assert.deepStrictEqual(L.search([nova, rafi, nova7], 'ov', 'photo').map(e => e.id), ['a', 'b']);
});
test('names from file names', () => {
  assert.deepStrictEqual(L.fromFile('nova-10-2.jpg'), { name: 'nova-10', n: 2 });
  assert.deepStrictEqual(L.fromFile('Nova_10 (3).png'), { name: 'Nova_10', n: 3 });
  assert.deepStrictEqual(L.fromFile('rafi.jpg'), { name: 'rafi', n: 0 });
  assert.deepStrictEqual(L.fromFile('nova-10.jpg', s => L.compact(s) === 'nova10'), { name: 'nova-10', n: 0 });
  for (const g of ['IMG_2034.jpg', 'PXL_20261020_101010.jpg', '20261020_101010.jpg', 'Screenshot_2026.png', 'WhatsApp Image 2026-10-20 at 10.00.00.jpeg', '1.jpg'])
    assert.strictEqual(L.fromFile(g), null, g);
});
test('zip layout: player folders, names in file names, logos/, cut-outs, a zipped root folder', () => {
  const p = L.plan([
    'library/Nova_10/1.jpg', 'library/Nova_10/2.jpg', 'library/Nova_10/1.cutout-small.png',
    'library/nova-10-3.jpg', 'library/nova-10.jpg', 'library/rafi-2.jpg', 'library/IMG_0001.jpg',
    'library/logos/Dhaka Strikers.png', 'library/logos/Sylhet Kings/1.png', 'library/notes.txt',
    '__MACOSX/library/._1.jpg', 'library/.DS_Store',
  ]);
  const got = p.add.map(a => `${a.kind}:${a.name}:${a.n}`).sort();
  assert.deepStrictEqual(got, ['logo:Dhaka Strikers:0', 'logo:Sylhet Kings:1', 'photo:Nova_10:1', 'photo:Nova_10:2', 'photo:nova-10:0', 'photo:nova-10:3', 'photo:rafi:2']);
  assert.deepStrictEqual(p.cutouts.map(c => [c.of, c.model]), [['Nova_10/1', 'small']]);
  assert.deepStrictEqual(p.skipped, ['library/IMG_0001.jpg']);
});
test('a zip that is just one player folder keeps the folder as the name', () => {
  const p = L.plan(['Nova_10/1.jpg', 'Nova_10/2.jpg']);
  assert.deepStrictEqual(p.add.map(a => a.name), ['Nova_10', 'Nova_10']);
});
test('backup layout reads back with the names from library.json', () => {
  const p = L.plan(['library.json', 'Rafi Ahmed/1.jpg', 'logos/Dhaka Strikers/1.png'], { photo: [{ folder: 'Rafi Ahmed', name: 'Rafi Ahmed', aliases: ['R4FI'] }], logo: [] });
  assert.deepStrictEqual(p.add.map(a => [a.kind, a.name, a.aliases]), [['photo', 'Rafi Ahmed', ['R4FI']], ['logo', 'Dhaka Strikers', []]]);
});
test('every card maker has its slots listed', () => {
  const fs = require('fs'), path = require('path');
  const tools = fs.readdirSync(path.join(__dirname, '..', '..', 'tools'));
  assert.strictEqual(tools.length, 13);
  for (const t of tools) assert.ok(L.SLOTS[t], t);
});
