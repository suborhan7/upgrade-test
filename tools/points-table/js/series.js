/* Tournament tracker (Points Table + Fixtures). Enter a tournament's teams and matches once, add scores after each match,
   then one button fills the card: the Points Table gets W/D/L, goals and form from the results, Fixtures gets the next
   unplayed matches. Saved in this browser (shared by both cards); Backup / Restore keeps a copy as a file. */
(function () {
  const form = document.getElementById('form'), st = window.__posterState;
  const isTable = !!document.getElementById('teams'), isFix = !!document.getElementById('matches');
  if (!form || !st || !(isTable || isFix)) return;

  const KEY = 'efcb-series';
  const uid = () => Math.random().toString(36).slice(2, 9);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  const el = (tag, props = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
      else if (k in e) e[k] = v; else e.setAttribute(k, v);
    }
    kids.flat().forEach(c => c != null && e.append(c));
    return e;
  };

  // ---------- storage ----------
  let db = { list: [], current: null };
  const load = () => { try { db = Object.assign({ list: [], current: null }, JSON.parse(localStorage.getItem(KEY) || 'null') || {}); } catch (e) { /* keep empty */ } };
  let saveNote = '';
  const save = () => {
    saveNote = '';
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) {   // too big for the browser's storage: keep everything except the logos
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...db, list: db.list.map(s => ({ ...s, teams: s.teams.map(t => ({ ...t, logo: '' })) })) }));
        saveNote = 'Jayga kom, tai logo chara save holo.';
      } catch (e2) { saveNote = 'Save hoyni: browser er storage full.'; }
    }
  };
  const cur = () => db.list.find(s => s.id === db.current) || null;
  load();
  // the other card (Points Table / Fixtures) may change the tournament in its own tab of the studio
  window.addEventListener('storage', e => { if (e.key === KEY) { load(); draw(); } });

  // ---------- teams from this card ----------
  function cardTeams() {
    const out = [], add = t => { if (t.name && !out.some(x => same(x.name, t.name))) out.push({ name: t.name, player: t.player || '', color: t.color || '#6a3fd6', logo: t.logo || '' }); };
    if (isTable) st.teams.slice(0, st.count).forEach(add);
    else st.matches.slice(0, st.count).forEach(m => { add(m.a); add(m.b); });
    return out;
  }
  const teamOf = (s, name) => s.teams.find(t => same(t.name, name)) || { name, player: '', color: '#6a3fd6', logo: '' };

  // ---------- numbers ----------
  const played = s => s.matches.filter(m => m.a && m.b && m.ga !== '' && m.gb !== '' && m.ga != null && m.gb != null)
    .sort((x, y) => (x.date || '').localeCompare(y.date || '') || x.no - y.no);
  function table(s) {
    const rows = s.teams.map(t => ({ t, w: 0, d: 0, l: 0, gf: 0, ga: 0, form: '' }));
    const row = n => rows.find(r => same(r.t.name, n));
    for (const m of played(s)) {
      const A = row(m.a), B = row(m.b), a = +m.ga, b = +m.gb;
      if (!A || !B) continue;
      A.gf += a; A.ga += b; B.gf += b; B.ga += a;
      if (a === b) { A.d++; B.d++; A.form += 'D'; B.form += 'D'; }
      else if (a > b) { A.w++; B.l++; A.form += 'W'; B.form += 'L'; }
      else { B.w++; A.l++; B.form += 'W'; A.form += 'L'; }
    }
    return rows.map(r => ({ ...r, form: r.form.slice(-5), pts: r.w * 3 + r.d }))
      .sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf);
  }
  const upcoming = s => s.matches.filter(m => m.a && m.b && (m.ga === '' || m.ga == null || m.gb === '' || m.gb == null))
    .sort((x, y) => (x.date || '9').localeCompare(y.date || '9') || (x.time || '').localeCompare(y.time || '') || x.no - y.no);

  // ---------- filling the card through its own form, so the form, the poster and the summaries stay in step ----------
  const setField = (inp, v) => { if (!inp) return; inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); };
  function fillTable(s) {
    const rows = table(s).slice(0, 16);
    if (!rows.length) return 'Age team add koro.';
    setField($('[data-k="event"]'), s.name);
    const secs = $$('#teams > .pdet');
    rows.forEach((r, i) => {
      const t = st.teams[i], sec = secs[i];
      t.logo = r.t.logo || (same(t.name, r.t.name) ? t.logo : '');
      t.color = r.t.color || t.color;
      const v = { name: r.t.name, player: r.t.player, w: r.w, d: r.d, l: r.l, pts: '', gf: r.gf, ga: r.ga, form: r.form, color: t.color };
      for (const [k, val] of Object.entries(v)) setField($(`[data-f="${k}"]`, sec), val);
    });
    setField($('[data-k="count"]'), rows.length);
    return `Table e ${rows.length} ta team boshano holo (${played(s).length} ta match er result theke).`;
  }
  function fillFixtures(s) {
    const list = upcoming(s).slice(0, 8);
    if (!list.length) return 'Baki kono match nei. Notun match add koro.';
    setField($('[data-k="event"]'), s.name);
    const secs = $$('#matches > .pdet');
    list.forEach((m, i) => {
      const slot = st.matches[i], sec = secs[i];
      setField($('[data-m="date"]', sec), m.date || '');
      setField($('[data-m="time"]', sec), m.time || '');
      setField($('[data-m="label"]', sec), 'Match ' + m.no);
      for (const side of ['a', 'b']) {
        const t = teamOf(s, m[side]), old = slot[side], box = $(`.teamf[data-side="${side}"]`, sec);
        if (!same(old.name, t.name)) Object.assign(old, { photo: '', dx: 0, dy: 0, zoom: 1 });   // a photo belongs to its old team
        old.logo = t.logo || (same(old.name, t.name) ? old.logo : '');
        old.color = t.color || old.color;
        for (const [k, val] of Object.entries({ name: t.name, player: t.player, color: old.color })) setField($(`[data-f="${k}"]`, box), val);
      }
    });
    setField($('[data-k="count"]'), Math.max(2, list.length));
    return `Poster e porer ${list.length} ta match boshano holo.`;
  }

  // ---------- the form section ----------
  let creating = false, note = '';
  const sec = el('section', { className: 'series-sec' });
  const anchor = (isTable ? $('#teams') : $('#matches')).closest('section');
  anchor.parentNode.insertBefore(sec, anchor);

  function teamSelect(s, value, onChange) {
    return el('select', { on: { change: e => onChange(e.target.value) } },
      el('option', { value: '', textContent: '—' }),
      ...s.teams.map(t => el('option', { value: t.name, textContent: t.name, selected: same(t.name, value) })));
  }
  function matchRow(s, m) {
    const upd = (k, v) => { m[k] = v; save(); summary(); };
    const score = k => el('input', { className: 'sr-g', type: 'number', min: '0', inputmode: 'numeric', placeholder: '–', value: m[k] ?? '', on: { input: e => upd(k, e.target.value) } });
    return el('div', { className: 'sr-match' },
      el('div', { className: 'sr-mtop' },
        el('b', { textContent: 'M' + m.no }),
        el('input', { type: 'date', value: m.date || '', on: { input: e => upd('date', e.target.value) } }),
        el('input', { placeholder: '8:30 PM', value: m.time || '', on: { input: e => upd('time', e.target.value) } }),
        el('button', { type: 'button', className: 'sr-x', title: 'Match muche dao', textContent: '✕', on: { click() {
          s.matches = s.matches.filter(x => x !== m); s.matches.forEach((x, i) => { x.no = i + 1; }); save(); draw();
        } } })),
      el('div', { className: 'sr-mbot' }, teamSelect(s, m.a, v => upd('a', v)), score('ga')),
      el('div', { className: 'sr-mbot' }, teamSelect(s, m.b, v => upd('b', v)), score('gb')));
  }
  let statusEl = null;
  function summary() {
    const s = cur(); if (!s || !statusEl) return;
    statusEl.textContent = `${s.teams.length} team · ${played(s).length}/${s.matches.length} match khela hoise` + (saveNote ? ` · ${saveNote}` : '');
  }

  function draw() {
    const s = cur();
    const parts = [el('h3', { textContent: 'Tournament tracker' })];
    if (!s || creating) {
      parts.push(el('p', { className: 'tip', textContent: 'Tournament er team ar match ekbar add koro, protita match er por score dao. Tarpor ek click e ' + (isTable ? 'points table' : 'fixtures') + ' nije nije bhore jabe. Points Table ar Fixtures dui card e eki tournament.' }));
      const name = el('input', { placeholder: 'eFCB Winter Cup 2026', value: st.event || '' });
      parts.push(el('label', {}, 'Tournament er nam', name),
        el('div', { className: 'sr-row' },
          el('button', { type: 'button', className: 'sr-main', textContent: 'Tournament banao', on: { click() {
            const t = { id: uid(), name: name.value.trim() || 'New tournament', teams: cardTeams(), matches: [] };
            db.list.unshift(t); db.current = t.id; creating = false; save(); note = `${t.teams.length} ta team ei card theke neya holo.`; draw();
          } } }),
          db.list.length ? el('button', { type: 'button', textContent: 'Cancel', on: { click() { creating = false; draw(); } } }) : null));
      if (!db.list.length) parts.push(restoreBtn());
      sec.replaceChildren(...parts); return;
    }

    parts.push(el('div', { className: 'sr-row' },
      el('select', { on: { change: e => { db.current = e.target.value; save(); note = ''; draw(); } } },
        ...db.list.map(x => el('option', { value: x.id, textContent: x.name, selected: x.id === s.id }))),
      el('button', { type: 'button', textContent: '+ Notun', on: { click() { creating = true; draw(); } } })));
    statusEl = el('p', { className: 'tip sr-status' }); parts.push(statusEl);

    // the main button
    parts.push(el('button', { type: 'button', className: 'sr-main', textContent: isTable ? '⟳ Result theke table bhoro' : '⟳ Porer match gula poster e boshao', on: { click() {
      note = isTable ? fillTable(s) : fillFixtures(s); draw();
    } } }));
    if (note) parts.push(el('p', { className: 'tip sr-note', textContent: note }));

    // teams
    const teamBox = el('details', { className: 'pdet sr-det' }, el('summary', { textContent: `Team (${s.teams.length})` }));
    const names = el('textarea', { rows: Math.min(10, Math.max(4, s.teams.length + 1)), placeholder: 'Man City | Tanvir\nArsenal | Nayeem',
      value: s.teams.map(t => t.player ? `${t.name} | ${t.player}` : t.name).join('\n') });
    teamBox.append(
      el('p', { className: 'tip', textContent: 'Protita line e ekta team: "Team | Player". Logo ar colour card theke ashe.' }), names,
      el('div', { className: 'sr-row' },
        el('button', { type: 'button', textContent: 'Save team list', on: { click() {
          s.teams = names.value.split('\n').map(l => l.split('|').map(x => x.trim())).filter(([n]) => n)
            .map(([n, p]) => ({ ...teamOf(s, n), name: n, player: p || teamOf(s, n).player || '' }));
          save(); note = 'Team list save holo.'; draw();
        } } }),
        el('button', { type: 'button', textContent: 'Logo/colour ei card theke', on: { click() {
          const ct = cardTeams(); let n = 0;
          for (const c of ct) { const t = s.teams.find(x => same(x.name, c.name)); if (t) { Object.assign(t, { logo: c.logo || t.logo, color: c.color, player: t.player || c.player }); n++; } else { s.teams.push(c); n++; } }
          save(); note = `${n} ta team er logo/colour neya holo.`; draw();
        } } })));
    parts.push(teamBox);

    // matches
    const mBox = el('details', { className: 'pdet sr-det', open: true }, el('summary', { textContent: `Match (${s.matches.length})` }));
    mBox.append(el('p', { className: 'tip', textContent: 'Khela hole score dao. Score khali = ekhono khela hoyni (Fixtures e ashbe).' }),
      el('div', { className: 'sr-list' }, ...s.matches.map(m => matchRow(s, m))),
      el('div', { className: 'sr-row' },
        el('button', { type: 'button', textContent: '+ Match', on: { click() {
          const last = s.matches[s.matches.length - 1] || {};
          s.matches.push({ id: uid(), no: s.matches.length + 1, date: last.date || '', time: last.time || '', a: '', b: '', ga: '', gb: '' });
          save(); draw();
        } } }),
        el('button', { type: 'button', textContent: 'Shobar shathe shobai (auto)', title: 'Round robin: protita team baki shobar shathe ekbar', on: { click(e) {
          const b = e.currentTarget;
          if (s.matches.length && !b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Ager match muche jabe, abar chapo'; return; }
          s.matches = roundRobin(s.teams.map(t => t.name)); save(); note = `${s.matches.length} ta match banano holo.`; draw();
        } } })));
    parts.push(mBox);

    const del = el('button', { type: 'button', className: 'sr-del', textContent: 'Tournament delete', on: { click() {
      if (!del.dataset.sure) { del.dataset.sure = '1'; del.textContent = `Abar chapo: "${s.name}" muche jabe`; return; }
      db.list = db.list.filter(x => x !== s); db.current = db.list[0] ? db.list[0].id : null; save(); note = ''; draw();
    } } });
    parts.push(el('div', { className: 'sr-row' }, el('button', { type: 'button', textContent: 'Backup', on: { click: backup } }), restoreBtn(), del));
    sec.replaceChildren(...parts);
    summary();
  }

  // circle method: every team meets every other team once, spread over rounds
  function roundRobin(names) {
    const t = names.slice(); if (t.length < 2) return [];
    if (t.length % 2) t.push(null);
    const out = [], n = t.length;
    for (let r = 0; r < n - 1; r++) {
      for (let i = 0; i < n / 2; i++) { const a = t[i], b = t[n - 1 - i]; if (a && b) out.push({ id: uid(), no: out.length + 1, date: '', time: '', a, b, ga: '', gb: '' }); }
      t.splice(1, 0, t.pop());
    }
    return out;
  }
  function backup() {
    const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(db, null, 1)], { type: 'application/json' })), download: `efcb-tournament-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a); HTMLAnchorElement.prototype.click.call(a); a.remove();
  }
  function restoreBtn() {
    return el('label', { className: 'sr-file' }, 'Restore', el('input', { type: 'file', accept: '.json,application/json', on: { change(e) {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(t => { const d = JSON.parse(t); if (!Array.isArray(d.list)) throw 0; db = d; save(); creating = false; note = 'Backup theke ferot ana holo.'; draw(); })
        .catch(() => { note = 'Ei file ta tournament backup na.'; draw(); });
    } } }));
  }

  const css = el('style', { textContent: `
.series-sec .sr-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}
.series-sec .sr-row select{flex:1;min-width:140px;margin:0}
.series-sec .sr-main{width:100%;margin:6px 0 4px;padding:11px;background:#19a463;border-color:#19a463;color:#fff;font-weight:700}
.series-sec .sr-row .sr-main{width:auto;flex:1}
.series-sec .sr-note{color:#5ee6a8}
.series-sec .sr-det{margin-top:8px}
.series-sec .sr-list{display:grid;gap:8px;max-height:420px;overflow:auto;padding-right:2px}
.series-sec .sr-match{padding:8px;border:1px solid #2a303d;border-radius:8px;background:#141821}
.series-sec .sr-mtop,.series-sec .sr-mbot{display:flex;gap:6px;align-items:center}
.series-sec .sr-mtop{margin-bottom:6px}.series-sec .sr-mtop b{font-size:12px;color:#8f9bb3;min-width:30px}
.series-sec .sr-match input,.series-sec .sr-match select{margin:0!important;min-width:0}
.series-sec .sr-mtop input[type=date]{flex:1.6}.series-sec .sr-mtop input:not([type=date]){flex:1}
.series-sec .sr-mbot{margin-top:6px}.series-sec .sr-mbot select{flex:1}
.series-sec input.sr-g{width:56px!important;flex:0 0 56px;text-align:center;font-weight:700}
.series-sec .sr-x{padding:4px 9px;flex:0 0 auto}
.series-sec .sr-del{color:#ff8a8a;margin-left:auto}
.series-sec .sr-file{display:inline-flex;align-items:center;margin:0;padding:7px 12px;border:1px solid #2f3544;border-radius:6px;background:#232836;color:#e8ecf3;font-size:inherit;cursor:pointer}
.series-sec .sr-file input{display:none}` });
  document.head.append(css);
  draw();
})();
