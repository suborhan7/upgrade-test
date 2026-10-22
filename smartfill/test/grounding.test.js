// node --test test/
const test = require('node:test');
const assert = require('node:assert');
const { grounded, checkFills } = require('../card-smartfill.js');

const SOURCE = `FC Dhaka 3 - 1 Chittagong Kings
Scorers: Rafi 12', 55', Tamim 80' ; Sakib 33'`;
const fields = [
  { id: 'f1', label: 'Team name', section: 'Team 1' },
  { id: 'f2', label: 'Goals', section: 'Team 1', numeric: true },
  { id: 'f3', label: 'Team name', section: 'Team 2' },
  { id: 'f4', label: 'Date', section: 'Poster' },
];

test('values made of source words are grounded', () => {
  assert.ok(grounded('FC Dhaka', SOURCE));
  assert.ok(grounded('chittagong kings', SOURCE));
  assert.ok(grounded("Rafi 12', 55'", SOURCE));
});

test('invented names and numbers are not grounded', () => {
  assert.ok(!grounded('Dhaka Tigers', SOURCE));
  assert.ok(!grounded('4', SOURCE));
  assert.ok(!grounded('Rafiq', SOURCE));        // whole words only
  assert.ok(!grounded('', SOURCE));
});

test('checkFills keeps grounded fills and drops invented ones', () => {
  const { ok, rejected } = checkFills([
    { id: 'f1', value: 'FC Dhaka', quote: 'FC Dhaka 3' },
    { id: 'f2', value: '3', quote: 'Dhaka 3 - 1' },
    { id: 'f3', value: 'Chittagong Kings FC', quote: 'Chittagong Kings' },  // FC added: invented
    { id: 'f4', value: '22 Oct 2026', quote: 'today' },                     // not in source
    { id: 'f9', value: 'x', quote: 'FC' },                                  // unknown field
  ], fields, SOURCE);
  assert.deepStrictEqual(ok.map(o => [o.field.id, o.value]), [['f1', 'FC Dhaka'], ['f2', '3']]);
  assert.deepStrictEqual(rejected.map(r => r.field.id), ['f3', 'f4']);
});

test('numeric fields only take digits, and a quote must really be in the source', () => {
  const { ok } = checkFills([
    { id: 'f2', value: 'three', quote: 'FC Dhaka' },
    { id: 'f1', value: 'FC Dhaka', quote: 'FC Dhaka won' },
  ], fields, SOURCE);
  assert.strictEqual(ok.length, 0);
});

test('garbage from the model is ignored', () => {
  assert.deepStrictEqual(checkFills(null, fields, SOURCE).ok, []);
  assert.deepStrictEqual(checkFills([null, {}, { id: 'f1' }], fields, SOURCE).ok, []);
});
