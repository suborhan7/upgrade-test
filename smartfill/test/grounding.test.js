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

test('the way people really type: "mbappe at 23 and 27"', () => {
  const src = `FCB 3- 4 RMA
Scorers mbappe at 23 and 27 and guler at 56 and 69.
For FCB RAPINHA 3,6,9`;
  const f = [{ id: 'a', label: 'Goal scorers' }, { id: 'b', label: 'Goal scorers' }, { id: 'c', label: 'Team name' }];
  const { ok, rejected } = checkFills([
    { id: 'a', value: "Mbappe 23', 27', Guler 56', 69'", quote: 'Scorers mbappe at 23 and 27 and guler at 56 and 69' },
    { id: 'b', value: "Raphinha 3', 6', 9'", quote: 'For FCB RAPINHA 3,6,9' },   // spelling "fixed": not allowed
    { id: 'c', value: 'Real Madrid', quote: 'RMA' },                            // expanded: not allowed
  ], f, src);
  assert.deepStrictEqual(ok.map(o => o.field.id), ['a']);
  assert.deepStrictEqual(rejected.map(r => r.field.id), ['b', 'c']);
});

const { rankModels, tryNext, gemini } = require('../card-smartfill.js');

test('models from ListModels: newest stable flash first, no tts/image/embedding', () => {
  const m = n => ({ name: 'models/' + n, supportedGenerationMethods: ['generateContent'] });
  const ranked = rankModels([m('gemini-2.5-flash'), m('gemini-3.8-flash'), m('gemini-3.8-pro'), m('gemini-3.8-flash-lite'),
    m('gemini-3.9-flash-preview'), m('gemini-3.8-flash-tts'), m('gemini-3.8-flash-image'), { name: 'models/text-embedding-9', supportedGenerationMethods: ['embedContent'] }]);
  assert.deepStrictEqual(ranked, ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-3.9-flash-preview', 'gemini-3.8-pro', 'gemini-3.8-flash-lite']);
});

test('which errors move on to the next model', () => {
  assert.ok(tryNext(404, 'This model models/gemini-2.5-flash is no longer available to new users.'));
  assert.ok(tryNext(429, 'Resource has been exhausted (e.g. check quota).'));
  assert.ok(tryNext(503, 'The model is overloaded.'));
  assert.ok(!tryNext(400, 'API key not valid. Please pass a valid API key.'));
});

test('falls back through models and follows "use models/X" hints', async () => {
  const calls = [];
  global.localStorage = { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = v; } };
  global.fetch = async (url, init) => {
    calls.push(url.replace('https://generativelanguage.googleapis.com/v1beta/', ''));
    const json = (status, body) => ({ ok: status < 400, status, json: async () => body });
    if (!init || !init.method) return json(200, { models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }] });
    if (url.includes('gemini-2.5-flash:')) return json(400, { error: { message: 'This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.8-flash.' } });
    if (url.includes('gemini-3.8-flash:')) return json(200, { candidates: [{ content: { parts: [{ text: 'hi' }] } }] });
    return json(404, { error: { message: 'not found' } });
  };
  assert.strictEqual(await gemini('k', [{ text: 'x' }]), 'hi');
  assert.deepStrictEqual(calls, ['models?pageSize=200', 'models/gemini-2.5-flash:generateContent', 'models/gemini-3.8-flash:generateContent']);
  assert.strictEqual(localStorage.getItem('cardSmartfill.model'), 'gemini-3.8-flash');
  calls.length = 0;
  await gemini('k', [{ text: 'x' }]);
  assert.deepStrictEqual(calls, ['models/gemini-3.8-flash:generateContent'], 'second call goes straight to the working model');
});
