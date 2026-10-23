/* photo-library: one Photo library for every card maker in the studio.
 *
 * Player photos (by player name / gamer tag) and team logos (by team name) are kept in this browser's
 * IndexedDB, one database for the whole site, so nothing is uploaded. Wherever a card has a name box next
 * to a photo or logo slot, typing a saved name puts the newest picture into that slot; thumbnails under the
 * slot switch pictures and × deletes one. The auto cut-out result is saved with each photo, so the cut-out
 * model does not run again for a photo it has already cut.
 *
 * The studio page loads it once (index.html); it reaches into each maker's iframe (same site), so the
 * makers themselves are not changed. Bulk add, zip import and the zip backup are in the "Photos" panel.
 * Zips are read and written here with the browser's own DecompressionStream, no library.
 */
(function (root) {
  'use strict';

  /* ---------- names: "nova", "Nova_10" and "nova 10" all find Nova_10 ---------- */

  // lower case, no accents, every run of other characters becomes one space
  const norm = s => String(s == null ? '' : s).normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const compact = s => norm(s).replace(/ /g, '');
  // the name without its number: "Nova_10" -> "nova"
  const bare = s => { const n = norm(s), b = n.replace(/ ?\d+$/, '').trim(); return b && b !== n ? b : ''; };
  const namesOf = e => [e.name, ...(e.aliases || [])].filter(Boolean);

  function same(e, typed) {
    const t = norm(typed), c = compact(typed);
    return !!t && namesOf(e).some(n => norm(n) === t || compact(n) === c);
  }

  // entities a name box points to: exact names first, then (photos only) the name without its number
  function find(entities, typed, kind) {
    const list = entities.filter(e => e.kind === kind);
    const exact = list.filter(e => same(e, typed));
    if (exact.length || kind !== 'photo') return exact;
    const t = norm(typed);
    return t ? list.filter(e => namesOf(e).some(n => bare(n) === t)) : [];
  }

  // the panel's search box: any part of any name
  function search(entities, q, kind) {
    const t = norm(q), c = compact(q);
    return entities.filter(e => e.kind === kind && (!t || namesOf(e).some(n => norm(n).includes(t) || compact(n).includes(c))));
  }

  /* ---------- file and folder names ---------- */

  const IMAGE = /\.(jpe?g|png|webp|gif|avif|heic|heif|bmp)$/i;
  // camera / gallery names that say nothing about who is in the photo
  const GENERIC_FILE = /^(img|image|pxl|dsc[nf]?|dcim|mvimg|photo|pic|picture|screenshot|screen ?shot|whatsapp image|fb_img|received|signal|snapchat|edited|download|untitled|cover|file)(?![a-z])|^[\d\s_\-.()]*$/i;
  const GENERIC_DIR = /^(photos?|players?|images?|pictures?|pics|gallery|library|backup|export|camera|dcim|downloads?|efcb.*|efcob.*|photo.?library.*)$/i;
  const LOGO_DIR = /^(logos?|team ?logos?|crests?|badges?)$/i;
  const stemOf = f => f.replace(/\.[^.]+$/, '').trim();

  // "nova-10-2" -> Nova 10, photo 2; "Nova_10 (2)" -> Nova_10, photo 2; "IMG_2034" -> no name.
  // A name that itself ends in a number ("nova-10") is kept whole when that name is already known.
  function fromFile(file, known) {
    const s = stemOf(file);
    if (!s || GENERIC_FILE.test(s)) return null;
    if (known && known(s)) return { name: s, n: 0 };
    const m = s.match(/^(.*?\p{L}.*?)(?:[\s_-]+|\s*\()(\d{1,3})\)?$/u);
    return m ? { name: m[1].replace(/[\s_-]+$/, ''), n: +m[2] } : { name: s, n: 0 };
  }

  // a zip's (or a folder pick's) paths -> what to add. Layout: Nova_10/1.jpg, nova-10-2.jpg, logos/Dhaka Strikers.png
  // (or logos/Dhaka Strikers/1.png). "1.cutout-small.png" next to "1.jpg" is that photo's saved cut-out.
  function plan(paths, meta) {
    let list = paths.map(p => p.replace(/\\/g, '/').replace(/^\/+/, ''))
      .filter(p => !/(^|\/)(__MACOSX|\.)/.test(p) && !p.endsWith('/'));
    const json = list.find(p => /(^|\/)library\.json$/i.test(p));
    let rootDir = json ? json.slice(0, -'library.json'.length) : '';
    const imgs = list.filter(p => IMAGE.test(p));
    if (!json && imgs.length) {
      // a zipped folder: "efcb-library/Nova_10/1.jpg" -> strip "efcb-library/"
      const first = imgs[0].split('/')[0];
      const all = imgs.every(p => p.split('/').length >= 2 && p.split('/')[0] === first);
      if (all && (imgs.some(p => p.split('/').length >= 3) || GENERIC_DIR.test(first))) rootDir = first + '/';
    }
    const folders = { photo: {}, logo: {} };
    for (const k of ['photo', 'logo']) for (const f of (meta && meta[k]) || []) folders[k][f.folder] = f;
    const out = [], cutouts = [], skipped = [];
    for (const p of imgs) {
      if (rootDir && !p.startsWith(rootDir)) { skipped.push(p); continue; }
      let parts = p.slice(rootDir.length).split('/');
      let kind = 'photo';
      if (parts.length > 1 && LOGO_DIR.test(parts[0])) { kind = 'logo'; parts = parts.slice(1); }
      const file = parts[parts.length - 1], dir = parts.length > 1 ? parts[parts.length - 2] : '';
      const cut = stemOf(file).match(/^(.*)\.cutout(?:-(\w+))?$/i);
      if (cut) { cutouts.push({ path: p, of: (parts.slice(0, -1).concat(cut[1])).join('/'), model: (cut[2] || 'medium').toLowerCase() }); continue; }
      const key = parts.slice(0, -1).concat(stemOf(file)).join('/');
      if (dir && !GENERIC_DIR.test(dir)) {
        const m = folders[kind][dir];
        out.push({ path: p, key, kind, name: m ? m.name : dir, aliases: m ? m.aliases || [] : [], n: +(stemOf(file).match(/(\d+)\)?$/) || [0, 0])[1] });
      } else out.push({ path: p, key, kind, file, name: null, n: 0 });
    }
    // names from file names; a second pass keeps "nova-10" whole when "nova-10-1.jpg" (or a Nova_10 folder) is there too
    const loose = out.filter(o => o.name == null);
    loose.forEach(o => { const g = fromFile(o.file); if (g) { o.name = g.name; o.n = g.n; } });
    const known = new Set(out.filter(o => o.name).map(o => o.kind + ':' + compact(o.name)));
    loose.forEach(o => {
      const g = fromFile(o.file, s => known.has(o.kind + ':' + compact(s)));
      if (g) { o.name = g.name; o.n = g.n; }
      if (!o.name) skipped.push(o.path);
    });
    return { add: out.filter(o => o.name), cutouts, skipped, other: list.filter(p => !IMAGE.test(p) && p !== json) };
  }

  /* ---------- zip, read and write (no library) ---------- */

  const u32 = (dv, o) => dv.getUint32(o, true), u16 = (dv, o) => dv.getUint16(o, true);
  const big = (dv, o) => Number(dv.getBigUint64(o, true));

  // reads only the parts it needs (file.slice), so a big zip on a phone is not loaded whole into memory
  async function readZip(file) {
    const tailLen = Math.min(file.size, 65557);
    const tailAt = file.size - tailLen;
    const tail = new DataView(await file.slice(tailAt).arrayBuffer());
    let e = -1;
    for (let i = tailLen - 22; i >= 0; i--) if (u32(tail, i) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('This is not a zip file.');
    let count = u16(tail, e + 10), cdSize = u32(tail, e + 12), cdAt = u32(tail, e + 16);
    if ((count === 0xffff || cdAt === 0xffffffff) && e >= 20 && u32(tail, e - 20) === 0x07064b50) {   // zip64
      const z = new DataView(await file.slice(big(tail, e - 12), big(tail, e - 12) + 56).arrayBuffer());
      count = big(z, 32); cdSize = big(z, 40); cdAt = big(z, 48);
    }
    const cd = new DataView(await file.slice(cdAt, cdAt + cdSize).arrayBuffer());
    const dec = new TextDecoder();
    const entries = [];
    for (let p = 0, i = 0; i < count && p + 46 <= cd.byteLength; i++) {
      if (u32(cd, p) !== 0x02014b50) throw new Error('This zip is damaged.');
      const flags = u16(cd, p + 8), method = u16(cd, p + 10), nlen = u16(cd, p + 28), xlen = u16(cd, p + 30), clen = u16(cd, p + 32);
      let csize = u32(cd, p + 20), size = u32(cd, p + 24), at = u32(cd, p + 42);
      for (let x = p + 46 + nlen; x + 4 <= p + 46 + nlen + xlen;) {   // zip64 sizes live in the extra field
        const id = u16(cd, x), l = u16(cd, x + 2);
        if (id === 1) {
          let q = x + 4;
          if (size === 0xffffffff) { size = big(cd, q); q += 8; }
          if (csize === 0xffffffff) { csize = big(cd, q); q += 8; }
          if (at === 0xffffffff) at = big(cd, q);
        }
        x += 4 + l;
      }
      const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nlen));
      entries.push({ name, method, csize, size, encrypted: !!(flags & 1), blob: () => entryBlob(file, at, csize, method) });
      p += 46 + nlen + xlen + clen;
    }
    return entries;
  }

  async function entryBlob(file, at, csize, method) {
    const h = new DataView(await file.slice(at, at + 30).arrayBuffer());
    if (u32(h, 0) !== 0x04034b50) throw new Error('This zip is damaged.');
    const start = at + 30 + u16(h, 26) + u16(h, 28);
    const raw = file.slice(start, start + csize);
    if (method === 0) return raw;
    if (method === 8) {
      if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open compressed zips. Update it (Chrome, or iPhone iOS 16.4+).');
      return new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
    }
    throw new Error('Unsupported zip compression (method ' + method + ').');
  }

  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8, c = 0xffffffff) { for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return c; }

  // stored (not compressed) zip: photos are already compressed, and any phone or computer can open it
  async function makeZip(files, when = new Date()) {
    const enc = new TextEncoder(), parts = [], cd = [];
    const time = (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1);
    const date = ((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
    let off = 0;
    for (const f of files) {
      const data = new Uint8Array(await f.blob.arrayBuffer()), name = enc.encode(f.path), crc = (crc32(data) ^ 0xffffffff) >>> 0;
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true);
      h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
      parts.push(h, name, f.blob);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true);
      c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      cd.push(c, name);
      off += 30 + name.length + data.length;
    }
    const cdSize = cd.reduce((s, x) => s + x.byteLength, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...cd, e], { type: 'application/zip' });
  }

  /* ---------- the database ---------- */

  const DB_NAME = 'efcb-photo-library';
  const RANK = { small: 1, medium: 2, large: 3 };
  const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'image/heic': 'heic', 'image/bmp': 'bmp' };
  const TYPE = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', heic: 'image/heic', heif: 'image/heic', bmp: 'image/bmp' };

  const req = r => new Promise((ok, bad) => { r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error); });
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((ok, bad) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('people', { keyPath: 'id' });            // a player or a team: name + other names
        const it = d.createObjectStore('items', { keyPath: 'id' });  // one photo or logo
        it.createIndex('owner', 'owner'); it.createIndex('hash', 'hash');
        d.createObjectStore('cutouts', { keyPath: 'hash' });         // the cut-out of a photo, by the photo's hash
      };
      r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error);
    });
    return dbp;
  }
  async function tx(stores, mode, fn) {
    const d = await db(), t = d.transaction(stores, mode), s = [].concat(stores).map(n => t.objectStore(n));
    const out = fn(...s);
    await new Promise((ok, bad) => { t.oncomplete = ok; t.onerror = () => bad(t.error); t.onabort = () => bad(t.error); });
    return out instanceof IDBRequest ? out.result : out;
  }
  const all = store => tx(store, 'readonly', s => s.getAll());

  async function hashBlob(blob) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    if (root.crypto && crypto.subtle) {
      const d = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
      return [...d.slice(0, 16)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return 'c' + ((crc32(buf) ^ 0xffffffff) >>> 0).toString(16) + '-' + buf.length;   // file:// pages without crypto.subtle
  }

  async function thumbOf(blob) {
    try {
      let img;
      if (root.createImageBitmap) img = await createImageBitmap(blob);
      else img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = URL.createObjectURL(blob); });
      const s = Math.min(1, 200 / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(img.width * s)); cv.height = Math.max(1, Math.round(img.height * s));
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      if (img.close) img.close();
      const alpha = !/jpe?g/i.test(blob.type);
      return await new Promise(ok => cv.toBlob(ok, alpha ? 'image/png' : 'image/jpeg', 0.8));
    } catch { return null; }
  }

  const lib = {
    people: [], items: [], cutHashes: new Set(), loaded: null, listeners: new Set(),
    load() {
      return this.loaded || (this.loaded = (async () => {
        const [p, i, c] = await Promise.all([all('people'), all('items'), all('cutouts')]);
        this.people = p; this.items = i;
        const used = new Set(i.map(x => x.hash));
        const orphans = c.filter(x => !used.has(x.hash)).map(x => x.hash);   // cut-outs of photos that were never saved
        if (orphans.length) await tx('cutouts', 'readwrite', s => orphans.forEach(h => s.delete(h)));
        this.cutHashes = new Set(c.map(x => x.hash).filter(h => used.has(h)));
      })());
    },
    changed() { this.listeners.forEach(f => { try { f(); } catch (e) { console.warn(e); } }); },
    byId(id) { return this.people.find(p => p.id === id); },
    itemsOf(id) { return this.items.filter(i => i.owner === id).sort((a, b) => b.added - a.added); },
    find(typed, kind) { return find(this.people, typed, kind); },
    // the entity a saved picture goes to: an existing one with that name, or a new one
    async entity(kind, name, aliases) {
      const hit = this.people.find(p => p.kind === kind && same(p, name));
      if (hit) return hit;
      const e = { id: kind + ':' + compact(name) + ':' + Date.now().toString(36), kind, name: String(name).trim(), aliases: aliases || [], added: Date.now() };
      await tx('people', 'readwrite', s => s.put(e));
      this.people.push(e);
      return e;
    },
    // add one picture; the same picture (same bytes) saved before is skipped
    async add(kind, name, blob, opts = {}) {
      await this.load();
      const hash = await hashBlob(blob);
      const dup = this.items.find(i => i.hash === hash && i.kind === kind);
      if (dup) return { item: dup, dup: true };
      const e = await this.entity(kind, name, opts.aliases);
      const type = blob.type || TYPE[(String(opts.file || '').split('.').pop() || '').toLowerCase()] || 'image/jpeg';
      const item = { id: 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8), owner: e.id, kind, hash, type,
        blob: blob.type === type ? blob : new Blob([blob], { type }), thumb: await thumbOf(blob), file: opts.file || '', added: opts.added || Date.now() };
      await tx('items', 'readwrite', s => s.put(item));
      this.items.push(item);
      if (opts.cutout) await this.putCutout(hash, opts.cutout.blob, opts.cutout.model);
      persist();
      if (!opts.quiet) this.changed();
      return { item, dup: false };
    },
    async remove(itemId) {
      const item = this.items.find(i => i.id === itemId); if (!item) return null;
      const lastOfHash = !this.items.some(i => i !== item && i.hash === item.hash);
      const cut = lastOfHash ? await tx('cutouts', 'readonly', s => s.get(item.hash)) : null;
      const owner = this.byId(item.owner), lastOfOwner = this.itemsOf(item.owner).length === 1;
      await tx(['items', 'cutouts', 'people'], 'readwrite', (it, cs, ps) => {
        it.delete(item.id);
        if (lastOfHash) cs.delete(item.hash);
        if (lastOfOwner) ps.delete(item.owner);
      });
      this.items = this.items.filter(i => i !== item);
      if (lastOfHash) this.cutHashes.delete(item.hash);
      if (lastOfOwner) this.people = this.people.filter(p => p.id !== item.owner);
      dropUrl(item.id);
      this.changed();
      return { item, cut, owner: lastOfOwner ? owner : null };
    },
    async restore(undo) {
      if (!undo) return;
      await tx(['items', 'cutouts', 'people'], 'readwrite', (it, cs, ps) => {
        it.put(undo.item); if (undo.cut) cs.put(undo.cut); if (undo.owner) ps.put(undo.owner);
      });
      if (undo.owner) this.people.push(undo.owner);
      this.items.push(undo.item); if (undo.cut) this.cutHashes.add(undo.cut.hash);
      this.changed();
    },
    async rename(id, names) {
      const e = this.byId(id); if (!e) return;
      const list = names.map(s => s.trim()).filter(Boolean);
      if (!list.length) return;
      e.name = list[0]; e.aliases = list.slice(1);
      await tx('people', 'readwrite', s => s.put(e));
      this.changed();
    },
    async removeEntity(id) {
      const items = this.itemsOf(id);
      const gone = new Set(items.map(i => i.hash).filter(h => !this.items.some(i => i.owner !== id && i.hash === h)));
      await tx(['items', 'cutouts', 'people'], 'readwrite', (it, cs, ps) => {
        items.forEach(i => it.delete(i.id)); gone.forEach(h => cs.delete(h)); ps.delete(id);
      });
      this.items = this.items.filter(i => i.owner !== id); this.people = this.people.filter(p => p.id !== id);
      gone.forEach(h => this.cutHashes.delete(h)); items.forEach(i => dropUrl(i.id));
      this.changed();
    },
    getCutout(hash) { return tx('cutouts', 'readonly', s => s.get(hash)); },
    async putCutout(hash, blob, model) {
      await tx('cutouts', 'readwrite', s => s.put({ hash, blob, model, rank: RANK[model] || 2, added: Date.now() }));
      this.cutHashes.add(hash);
    },
    async bytes() {
      const cuts = await all('cutouts');
      return this.items.reduce((s, i) => s + i.blob.size + (i.thumb ? i.thumb.size : 0), 0) + cuts.reduce((s, c) => s + c.blob.size, 0);
    },
  };

  let persisted = false;
  function persist() {
    if (persisted || !(navigator.storage && navigator.storage.persist)) return;
    persisted = true;
    navigator.storage.persist().catch(() => {});   // asks the browser not to clear the library when space runs low
  }

  const urls = new Map();
  const urlOf = item => { if (!urls.has(item.id)) urls.set(item.id, URL.createObjectURL(item.thumb || item.blob)); return urls.get(item.id); };
  function dropUrl(id) { if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); } }

  /* ---------- import and backup ---------- */

  // files from a zip -> library. Returns counts for the message.
  async function importZip(file, progress = () => {}) {
    await lib.load();
    const entries = await readZip(file);
    const byName = new Map(entries.map(e => [e.name.replace(/\\/g, '/').replace(/^\/+/, ''), e]));
    const jsonPath = [...byName.keys()].find(p => /(^|\/)library\.json$/i.test(p));
    let meta = null;
    if (jsonPath) try { meta = JSON.parse(await (await byName.get(jsonPath).blob()).text()); } catch { meta = null; }
    const p = plan([...byName.keys()], meta);
    // oldest first: photo 1 of a folder is the oldest, the highest number is the newest
    p.add.sort((a, b) => a.kind.localeCompare(b.kind) || compact(a.name).localeCompare(compact(b.name)) || a.n - b.n || a.path.localeCompare(b.path, undefined, { numeric: true }));
    const cutFor = new Map(p.cutouts.map(c => [c.of, c]));
    const res = { photos: 0, logos: 0, skipped: 0, noName: p.skipped.length, failed: 0, cutouts: 0 };
    const t0 = Date.now() - p.add.length;
    for (let i = 0; i < p.add.length; i++) {
      const a = p.add[i], e = byName.get(a.path);
      progress(i + 1, p.add.length);
      try {
        if (e.encrypted) throw new Error('password zip');
        const raw = await e.blob();
        const blob = new Blob([raw], { type: TYPE[a.path.split('.').pop().toLowerCase()] || 'image/jpeg' });
        const c = cutFor.get(a.key);
        let cutout = null;
        if (c) cutout = { blob: new Blob([await byName.get(c.path).blob()], { type: 'image/png' }), model: c.model };
        const r = await lib.add(a.kind, a.name, blob, { file: a.path.split('/').pop(), added: t0 + i, aliases: a.aliases, cutout, quiet: true });
        if (r.dup) res.skipped++;
        else { res[a.kind === 'logo' ? 'logos' : 'photos']++; if (cutout) res.cutouts++; }
      } catch (err) { console.warn('Photo library: could not add', a.path, err); res.failed++; }
    }
    lib.changed();
    return res;
  }

  const safe = s => String(s).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/^\.+/, '_').trim().slice(0, 80) || 'unnamed';

  async function backup() {
    await lib.load();
    const files = [], meta = { app: 'eFCB studio photo library', version: 1, made: new Date().toISOString(), photo: [], logo: [] };
    for (const kind of ['photo', 'logo']) {
      const used = new Set();
      for (const e of lib.people.filter(p => p.kind === kind).sort((a, b) => a.name.localeCompare(b.name))) {
        let folder = safe(e.name), k = 2;
        while (used.has(folder.toLowerCase())) folder = safe(e.name) + ' (' + k++ + ')';
        used.add(folder.toLowerCase());
        meta[kind].push({ folder, name: e.name, aliases: e.aliases || [] });
        const dir = (kind === 'logo' ? 'logos/' : '') + folder + '/';
        const items = lib.itemsOf(e.id).reverse();   // oldest = 1
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          files.push({ path: dir + (i + 1) + '.' + (EXT[it.type] || 'jpg'), blob: it.blob });
          if (lib.cutHashes.has(it.hash)) {
            const c = await lib.getCutout(it.hash);
            if (c) files.push({ path: dir + (i + 1) + '.cutout-' + (c.model || 'medium') + '.png', blob: c.blob });
          }
        }
      }
    }
    files.push({ path: 'library.json', blob: new Blob([JSON.stringify(meta, null, 1)], { type: 'application/json' }) });
    return makeZip(files);
  }

  /* ---------- the card makers: which name box belongs to which photo / logo slot ---------- */

  // per maker: [file input, name box(es) in order of preference, kind]. The name box is the nearest one around the slot.
  const SQUAD = [['[data-pp]', ['[data-pn]'], 'photo'], ['#teamLogo', ['[data-t="name"]'], 'logo']];
  const SLOTS = {
    'comparison': [['[data-photo]', ['[data-p="name"]'], 'photo'], ['[data-logo]', ['[data-p="team"]'], 'logo']],
    'mvp': [['[data-photo]', ['[data-p="name"]'], 'photo']],
    'match-result': [['[data-photo]', ['[data-t="player"]'], 'photo'], ['[data-logo]', ['[data-t="name"]'], 'logo'],
      ['[data-tphoto]', ['[data-tt="captain"]'], 'photo'], ['[data-tlogo]', ['[data-tt="name"]'], 'logo'], ['[data-sp]', ['[data-sn]'], 'photo']],
    'top-4': [['[data-photo]', ['[data-t="player"]'], 'photo'], ['[data-logo]', ['[data-t="team"]'], 'logo']],
    'player-vs-player': [['[data-photo]', ['[data-t="player"]'], 'photo'], ['[data-logo]', ['[data-t="team"]'], 'logo']],
    'team-vs-team': [['[data-photo]', ['[data-t="player"]'], 'photo'], ['[data-logo]', ['[data-t="team"]'], 'logo']],
    'transfer': [['[data-photo]', ['[data-k="player"]'], 'photo'], ['[data-logo]', ['[data-c="full"]', '[data-c="name"]'], 'logo']],
    'best-xi': [['[data-photo]', ['[data-f="name"]'], 'photo'], ['[data-logo]', ['[data-f="team"]'], 'logo']],
    'points-table': [['#spPhoto', ['#spName'], 'photo'], ['[data-logo]', ['[data-f="name"]'], 'logo']],
    'fixtures': [['[data-photo]', ['[data-f="player"]'], 'photo'], ['[data-logo]', ['[data-f="name"]'], 'logo']],
    'lineup': [['[data-photo]', ['[data-f="gamer"]'], 'photo'], ['[data-logo]', ['[data-f="name"]'], 'logo']],
    'team-performance': SQUAD,
    'achievement': SQUAD,
  };

  // the one name box nearest to the slot (the first parent that holds exactly one)
  function nearest(input, sel) {
    for (let el = input.parentElement; el && el.tagName !== 'HTML'; el = el.parentElement) {
      const m = el.querySelectorAll(sel);
      if (m.length === 1) return m[0];
      if (m.length > 1) return null;
    }
    return null;
  }

  const SLOT_CSS = `
.plib-strip{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:4px 0 6px;font:12px/1.3 system-ui,sans-serif;color:#9aa4bf}
.plib-strip:empty,.plib-strip[hidden]{display:none}
.plib-strip .plib-who{flex-basis:100%}
.plib-strip .plib-th{position:relative;width:46px;height:46px;padding:0;border:2px solid #333b52;border-radius:8px;background:#11141b center/cover no-repeat;cursor:pointer}
.plib-strip .plib-th.on{border-color:#22c55e}
.plib-strip .plib-x{position:absolute;top:-7px;right:-7px;width:20px;height:20px;border-radius:50%;background:#ef4444;color:#fff;font:700 13px/20px system-ui;text-align:center;cursor:pointer}
.plib-strip .plib-btn{border:1px solid #3d4766;background:#2b334a;color:#e8ebf2;border-radius:7px;padding:4px 8px;font:inherit;cursor:pointer}
.plib-strip .plib-ok{color:#22c55e}`;

  const frames = new WeakSet(), slotsByDoc = new Map();

  function toolOf(win) { const m = String(win.location.pathname).match(/tools\/([^/]+)\//); return m && m[1]; }

  function attach(frame) {
    let win, doc;
    try { win = frame.contentWindow; doc = frame.contentDocument; } catch { return; }
    if (!doc || !doc.body || frames.has(doc)) return;
    const tool = toolOf(win), rules = SLOTS[tool];
    if (!rules) return;
    frames.add(doc);
    wrapCutout(win);
    const st = doc.createElement('style'); st.textContent = SLOT_CSS; doc.head.appendChild(st);
    const slots = new Map(), byName = new Map();
    slotsByDoc.set(doc, slots);

    // finds the slots (again when a maker adds rows, like more matches or squad players)
    function scan() {
      const added = [];
      for (const [fileSel, nameSels, kind] of rules) for (const input of doc.querySelectorAll(fileSel)) {
        if (slots.has(input) || input.type !== 'file') continue;
        const names = nameSels.map(s => nearest(input, s)).filter(Boolean);
        if (!names.length) continue;
        const slot = { input, names, kind, win, doc, current: null, pending: null, note: '', timer: 0 };
        slots.set(input, slot); added.push(slot);
        names.forEach(n => { if (!byName.has(n)) byName.set(n, []); byName.get(n).push(slot); });
      }
      for (const s of slots.values()) if (!s.input.isConnected) slots.delete(s.input);
      return added;
    }
    scan();
    let scanTimer = 0;
    const hasFile = n => n.nodeType === 1 && !n.classList.contains('plib-strip') && (n.matches('input[type=file]') || !!n.querySelector('input[type=file]'));
    new win.MutationObserver(recs => {
      if (!recs.some(r => [...r.addedNodes].some(hasFile) || [...r.removedNodes].some(hasFile))) return;   // poster redraws, our strips
      clearTimeout(scanTimer); scanTimer = setTimeout(() => scan().forEach(render), 300);
    }).observe(doc.body, { childList: true, subtree: true });

    // typing a name: fill the slot with that player's newest photo (after a short pause)
    doc.addEventListener('input', e => {
      const list = byName.get(e.target); if (!list) return;
      list.forEach(s => { clearTimeout(s.timer); s.timer = setTimeout(() => autofill(s), 450); });
    }, true);
    // a photo picked by hand with a name typed: save it to the library
    doc.addEventListener('change', e => {
      const s = slots.get(e.target);
      if (!s || s.setting) return;
      const f = s.input.files && s.input.files[0];
      s.current = null; s.pending = f || null; s.note = '';
      if (f && nameOf(s)) saveSlot(s); else render(s);
    }, true);
    lib.load().then(() => slots.forEach(render));
    // a strip hides with its slot (a layout or mode that does not use that photo, a folded section)
    win.setInterval(() => slots.forEach(s => {
      if (!s.strip) return;
      const a = s.input.closest('label') || s.input.parentElement, off = !a.getClientRects().length;
      if (s.strip.hidden !== off) s.strip.hidden = off;
    }), 700);
  }

  const nameOf = s => (s.names.find(n => n.value.trim()) || { value: '' }).value.trim();

  async function autofill(s) {
    await lib.load();
    const typed = nameOf(s), hits = typed ? lib.find(typed, s.kind) : [];
    s.note = '';
    if (hits.length === 1 || (hits.length > 1 && hits.filter(h => same(h, typed)).length === 1)) {
      const e = hits.length === 1 ? hits[0] : hits.find(h => same(h, typed));
      const newest = lib.itemsOf(e.id)[0];
      if (newest && !lib.itemsOf(e.id).some(i => i.id === s.current)) setSlot(s, newest);
    }
    render(s);
  }

  function setSlot(s, item) {
    const { win, input } = s;
    try {
      const f = new win.File([item.blob], item.file || ('photo.' + (EXT[item.type] || 'jpg')), { type: item.type });
      const dt = new win.DataTransfer(); dt.items.add(f);
      s.setting = true;
      input.files = dt.files;
      input.dispatchEvent(new win.Event('input', { bubbles: true }));
      input.dispatchEvent(new win.Event('change', { bubbles: true }));
    } finally { s.setting = false; }
    s.current = item.id; s.pending = null;
    render(s);
  }

  async function saveSlot(s) {
    const f = s.pending, name = nameOf(s);
    if (!f || !name) return;
    try {
      const r = await lib.add(s.kind, name, f, { file: f.name });
      s.current = r.item.id; s.pending = null;
      s.note = r.dup ? 'Already in the library ✓' : 'Saved to the library ✓';
    } catch (e) { s.note = 'Could not save: ' + (e.message || e); }
    render(s);
  }

  function render(s) {
    if (!s.input.isConnected) return;
    const { doc } = s;
    let strip = s.strip;
    if (!strip || !strip.isConnected) {
      strip = s.strip = doc.createElement('div'); strip.className = 'plib-strip';
      // under the slot: after its label, or after the row it shares with its name box
      const anchor = s.input.closest('label') || s.input.parentElement;
      anchor.after(strip);
      strip.addEventListener('click', e => onStripClick(s, e));
    }
    strip.textContent = '';
    strip.hidden = !(s.input.closest('label') || s.input.parentElement).getClientRects().length;
    if (!lib.loaded) return;
    const typed = nameOf(s);
    const hits = typed ? lib.find(typed, s.kind).slice(0, 3) : [];
    const el = (tag, cls, text) => { const x = doc.createElement(tag); if (cls) x.className = cls; if (text) x.textContent = text; return x; };
    for (const e of hits) {
      const items = lib.itemsOf(e.id);
      strip.append(el('span', 'plib-who', `📷 ${e.name} · ${items.length} ${s.kind === 'logo' ? 'logo' : 'photo'}${items.length === 1 ? '' : 's'}`));
      for (const it of items) {
        const b = el('button', 'plib-th' + (it.id === s.current ? ' on' : ''));
        b.type = 'button'; b.dataset.item = it.id; b.title = 'Use this ' + (s.kind === 'logo' ? 'logo' : 'photo');
        b.style.backgroundImage = `url("${urlOf(it)}")`;
        const x = el('span', 'plib-x', '×'); x.dataset.del = it.id; x.title = 'Delete from the library';
        b.append(x); strip.append(b);
      }
    }
    if (s.pending && typed && !hits.some(e => same(e, typed))) {
      const b = el('button', 'plib-btn', `＋ Save to library as “${typed}”`); b.type = 'button'; b.dataset.save = '1'; strip.append(b);
    }
    if (s.undo) {
      strip.append(el('span', '', 'Deleted. '));
      const u = el('button', 'plib-btn', 'Undo'); u.type = 'button'; u.dataset.undo = '1'; strip.append(u);
    }
    if (s.note) strip.append(el('span', 'plib-ok', s.note));
  }

  async function onStripClick(s, e) {
    const t = e.target.closest('[data-del], button'); if (!t) return;
    e.preventDefault(); e.stopPropagation();
    if (t.dataset.del) {
      const undo = await lib.remove(t.dataset.del);
      s.undo = undo; clearTimeout(s.undoTimer);
      s.undoTimer = setTimeout(() => { s.undo = null; render(s); }, 6000);
      render(s);
    } else if (t.dataset.undo) {
      const u = s.undo; s.undo = null; await lib.restore(u);
    } else if (t.dataset.save) saveSlot(s);
    else if (t.dataset.item) { const it = lib.items.find(i => i.id === t.dataset.item); if (it) setSlot(s, it); }
  }

  lib.listeners.add(() => { for (const slots of slotsByDoc.values()) slots.forEach(render); });

  /* ---------- cut-out: saved with the photo, so the model runs once per photo ---------- */

  function wrapCutout(win) {
    const B = win.BgRemoval;
    if (!B || B.__photoLibrary) return;
    win.__plibCutout = B.removeBackground;   // the real one (tests swap in a fake here)
    const w = { __photoLibrary: true };
    for (const k of Object.keys(B)) { try { w[k] = B[k]; } catch { /* getter */ } }
    w.removeBackground = async (image, config) => {
      const model = (config && config.model) || 'medium', want = RANK[model] || 2;
      let hash = null;
      try { if (image && typeof image.arrayBuffer === 'function') hash = await hashBlob(image); } catch { hash = null; }
      if (hash) {
        try {
          const c = await lib.getCutout(hash);
          if (c && c.rank >= want) return c.blob;
        } catch { /* no database: just cut */ }
      }
      const out = await win.__plibCutout(image, config);
      if (hash && out) lib.putCutout(hash, out, model).catch(() => {});
      return out;
    };
    win.BgRemoval = w;
  }

  /* ---------- the Photos panel ---------- */

  const PANEL_CSS = `
#plib-pill{position:fixed;right:16px;bottom:152px;z-index:2147482999;border:0;border-radius:999px;padding:12px 18px;background:#f59e0b;color:#231400;font:600 15px/1 system-ui,sans-serif;box-shadow:0 6px 20px #f59e0b55;cursor:pointer}
#plib{position:fixed;z-index:2147483001;top:0;right:0;bottom:0;width:440px;max-width:100vw;display:flex;flex-direction:column;background:#151925;color:#e8ebf2;font:14px/1.45 system-ui,sans-serif;border-left:1px solid #333b52;box-shadow:-10px 0 30px #0008}
#plib[hidden]{display:none}
@media (max-width:640px){#plib{width:100vw;border-left:0}}
#plib header{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid #262d42}
#plib header h2{flex:1;margin:0;font-size:17px}
#plib .plib-scroll{flex:1;overflow:auto;padding:12px 16px 32px;display:grid;gap:12px;align-content:start}
#plib button{font:inherit;color:inherit;background:#2b334a;border:1px solid #3d4766;border-radius:9px;padding:9px 12px;cursor:pointer}
#plib button.go{background:#f59e0b;border-color:#f59e0b;color:#231400;font-weight:600}
#plib button:disabled{opacity:.5}
#plib .close{background:none;border:0;font-size:24px;line-height:1;padding:4px 8px}
#plib .stats{font-weight:600}
#plib .warn{background:#3a2a0c;border:1px solid #6b4a12;color:#fcd9a0;border-radius:10px;padding:10px 12px;font-size:13px}
#plib .acts{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
#plib .acts button{padding:10px 6px}
#plib .msg{white-space:pre-wrap;font-size:13px;color:#c4cbe0}
#plib .msg.err{color:#ff8a8a}
#plib .tabs{display:flex;gap:6px}
#plib .tabs button{flex:1}
#plib .tabs button.on{background:#e8ebf2;color:#11141b;border-color:#e8ebf2;font-weight:600}
#plib input[type=search],#plib input[type=text]{width:100%;box-sizing:border-box;background:#0f1219;color:inherit;border:1px solid #333b52;border-radius:9px;padding:10px;font:inherit}
#plib .ent{border:1px solid #262d42;border-radius:12px;padding:10px;display:grid;gap:8px}
#plib .ent-h{display:flex;gap:8px;align-items:center}
#plib .ent-h b{flex:1;overflow-wrap:anywhere}
#plib .ent-h small,#plib small{color:#8590ad}
#plib .ent-h button{padding:5px 9px;font-size:13px}
#plib .ths{display:flex;flex-wrap:wrap;gap:8px}
#plib .th{position:relative;width:64px;height:64px;border-radius:10px;border:1px solid #333b52;background:#0f1219 center/cover no-repeat}
#plib .th .x{position:absolute;top:-8px;right:-8px;width:24px;height:24px;border-radius:50%;padding:0;border:0;background:#ef4444;color:#fff;font:700 15px/24px system-ui}
#plib .th .cut{position:absolute;left:3px;bottom:3px;font-size:10px;background:#000a;border-radius:4px;padding:0 3px}
#plib .review{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}
#plib .review figure{margin:0;display:grid;gap:4px}
#plib .review img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;background:#0f1219}
#plib .review input.bad{border-color:#ef4444}
#plib .empty{color:#8590ad;text-align:center;padding:24px 0}
#plib .more{text-align:center}`;

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mb = n => n >= 1e9 ? (n / 1e9).toFixed(2) + ' GB' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(0, Math.round(n / 1e3)) + ' KB';

  function mountPanel() {
    if (document.getElementById('plib')) return;
    const st = document.createElement('style'); st.textContent = PANEL_CSS; document.head.appendChild(st);
    const pill = document.createElement('button');
    pill.id = 'plib-pill'; pill.type = 'button'; pill.textContent = '🖼️ Photos';
    document.body.appendChild(pill);
    const box = document.createElement('section');
    box.id = 'plib'; box.hidden = true; box.setAttribute('aria-label', 'Photo library');
    box.innerHTML = `
      <header><h2>Photo library</h2><button type="button" class="close" data-close title="Close">×</button></header>
      <div class="plib-scroll">
        <div class="stats" data-stats>…</div>
        <div class="warn">Saved only in this browser on this device, nothing is uploaded. <b>Clearing site data or browsing data for this site deletes the library.</b> Tap <b>Back up</b> now and then and keep the zip (for example in Google Drive); <b>Import zip</b> brings it back on a new phone.</div>
        <div class="acts">
          <button type="button" class="go" data-add>＋ Add photos</button>
          <button type="button" data-zip>Import zip</button>
          <button type="button" data-backup>Back up</button>
        </div>
        <input type="file" accept="image/*" multiple hidden data-addin>
        <input type="file" accept=".zip,application/zip,application/x-zip-compressed" hidden data-zipin>
        <input type="file" accept="image/*" multiple hidden data-morein>
        <div class="msg" data-msg><small>Zip layout: one folder per player (<b>Nova_10/1.jpg</b>), or the name in the file name (<b>nova-10-2.jpg</b>). Team logos go in a <b>logos/</b> folder (<b>logos/Dhaka Strikers.png</b>). Photos already saved are skipped.</small></div>
        <div data-review hidden></div>
        <div class="tabs"><button type="button" class="on" data-tab="photo">Players</button><button type="button" data-tab="logo">Team logos</button></div>
        <input type="search" data-q placeholder="Search player name or gamer tag" autocomplete="off">
        <div data-list></div>
      </div>`;
    document.body.appendChild(box);
    const $ = s => box.querySelector(s);
    let tab = 'photo', shown = 40, moreFor = null;
    const say = (html, err) => { $('[data-msg]').innerHTML = html; $('[data-msg]').classList.toggle('err', !!err); };

    pill.addEventListener('click', () => { box.hidden = false; pill.hidden = true; lib.load().then(draw); });
    $('[data-close]').addEventListener('click', () => { box.hidden = true; pill.hidden = false; });
    box.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
      tab = b.dataset.tab; shown = 40;
      box.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b));
      $('[data-q]').placeholder = tab === 'logo' ? 'Search team name' : 'Search player name or gamer tag';
      draw();
    }));
    $('[data-q]').addEventListener('input', () => { shown = 40; draw(); });

    async function stats() {
      const photos = lib.items.filter(i => i.kind === 'photo').length, logos = lib.items.length - photos;
      const players = lib.people.filter(p => p.kind === 'photo').length, teams = lib.people.length - players;
      let used = await lib.bytes(), extra = '';
      try {
        if (navigator.storage && navigator.storage.estimate) {
          const est = await navigator.storage.estimate();
          if (est.quota) extra = ` · site uses ${mb(est.usage)} of ${mb(est.quota)}`;
        }
        if (navigator.storage && navigator.storage.persisted && await navigator.storage.persisted()) extra += ' · protected from auto clean-up';
      } catch { /* no estimate */ }
      $('[data-stats]').innerHTML = `${photos} photo${photos === 1 ? '' : 's'} of ${players} player${players === 1 ? '' : 's'} · ${logos} logo${logos === 1 ? '' : 's'} of ${teams} team${teams === 1 ? '' : 's'}<br><small>Library ${mb(used)}${extra}</small>`;
    }

    function draw() {
      if (box.hidden) return;
      stats();
      const list = search(lib.people, $('[data-q]').value, tab)
        .map(e => ({ e, items: lib.itemsOf(e.id) }))
        .sort((a, b) => ((b.items[0] || {}).added || 0) - ((a.items[0] || {}).added || 0));
      const out = $('[data-list]');
      out.textContent = '';
      if (!list.length) { out.innerHTML = `<div class="empty">${$('[data-q]').value ? 'No match.' : tab === 'logo' ? 'No team logos yet.' : 'No player photos yet.'}</div>`; return; }
      for (const { e, items } of list.slice(0, shown)) {
        const d = document.createElement('div'); d.className = 'ent'; d.dataset.id = e.id;
        d.innerHTML = `<div class="ent-h"><b>${esc(e.name)}${(e.aliases || []).length ? ` <small>(${esc(e.aliases.join(', '))})</small>` : ''}</b>
          <small>${items.length}</small><button type="button" data-names>✎ Names</button><button type="button" data-more>＋</button></div>
          <div class="ths">${items.map(i => `<div class="th" style="background-image:url('${urlOf(i)}')">${lib.cutHashes.has(i.hash) ? '<span class="cut">cut ✓</span>' : ''}<button type="button" class="x" data-del="${i.id}" title="Delete">×</button></div>`).join('')}</div>`;
        out.appendChild(d);
      }
      if (list.length > shown) {
        const m = document.createElement('div'); m.className = 'more';
        m.innerHTML = `<button type="button" data-showmore>Show more (${list.length - shown})</button>`; out.appendChild(m);
      }
    }

    $('[data-list]').addEventListener('click', async ev => {
      const b = ev.target.closest('button'); if (!b) return;
      const ent = b.closest('.ent'), id = ent && ent.dataset.id;
      if (b.dataset.showmore) { shown += 40; draw(); }
      else if (b.dataset.del) {
        const undo = await lib.remove(b.dataset.del);
        say('Deleted. <button type="button" data-undo>Undo</button>');
        $('[data-msg] [data-undo]').onclick = () => { lib.restore(undo); say('<small>Put back.</small>'); };
      } else if (b.dataset.names) {
        const e = lib.byId(id);
        const v = prompt('Names for this ' + (tab === 'logo' ? 'team' : 'player') + ', separated by commas (gamer tag, real name…). Leave empty to delete them with all their pictures.', namesOf(e).join(', '));
        if (v == null) return;
        if (!v.trim()) { if (confirm(`Delete ${e.name} and all ${lib.itemsOf(id).length} pictures?`)) lib.removeEntity(id); }
        else lib.rename(id, v.split(','));
      } else if (b.dataset.more) { moreFor = lib.byId(id); $('[data-morein]').click(); }
    });
    $('[data-morein]').addEventListener('change', async ev => {
      const files = [...ev.target.files]; ev.target.value = '';
      if (!moreFor || !files.length) return;
      let n = 0, dup = 0;
      for (const f of files) { const r = await lib.add(moreFor.kind, moreFor.name, f, { file: f.name, quiet: true }); r.dup ? dup++ : n++; }
      lib.changed();
      say(`Added ${n} to ${esc(moreFor.name)}${dup ? `, ${dup} already saved` : ''}.`);
    });

    // bulk add from the gallery: pick many, check the names, save
    $('[data-add]').addEventListener('click', () => $('[data-addin]').click());
    $('[data-addin]').addEventListener('change', ev => {
      const files = [...ev.target.files].filter(f => /^image\//.test(f.type) || IMAGE.test(f.name)); ev.target.value = '';
      if (files.length) review(files);
    });
    function review(files) {
      const r = $('[data-review]'); r.hidden = false;
      const known = s => lib.people.some(p => same(p, s));
      const guesses = files.map(f => (fromFile(f.name, known) || { name: '' }).name);
      const opts = [...new Set(lib.people.filter(p => p.kind === tab).flatMap(namesOf))].slice(0, 300);
      r.innerHTML = `<div class="ent"><b>Add ${files.length} picture${files.length === 1 ? '' : 's'}</b>
        <div class="tabs"><button type="button" data-k="photo" class="${tab === 'photo' ? 'on' : ''}">Player photos</button><button type="button" data-k="logo" class="${tab === 'logo' ? 'on' : ''}">Team logos</button></div>
        <label><small data-alllab>Name for all (player name or gamer tag)</small><input type="text" data-all list="plib-names" placeholder="e.g. Nova_10" autocomplete="off"></label>
        <datalist id="plib-names">${opts.map(o => `<option value="${esc(o)}">`).join('')}</datalist>
        <small>Or give each its own name below (a name below wins).</small>
        <div class="review">${files.map((f, i) => `<figure><img alt="" data-i="${i}"><input type="text" data-n="${i}" list="plib-names" value="${esc(guesses[i])}" placeholder="name" autocomplete="off"></figure>`).join('')}</div>
        <div class="acts" style="grid-template-columns:2fr 1fr"><button type="button" class="go" data-save>Save to library</button><button type="button" data-cancel>Cancel</button></div></div>`;
      const shownUrls = files.map(f => URL.createObjectURL(f));
      r.querySelectorAll('img[data-i]').forEach(img => { img.src = shownUrls[+img.dataset.i]; });
      let kind = tab;
      r.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
        kind = b.dataset.k; r.querySelectorAll('[data-k]').forEach(x => x.classList.toggle('on', x === b));
        r.querySelector('[data-alllab]').textContent = kind === 'logo' ? 'Team name for all' : 'Name for all (player name or gamer tag)';
      }));
      const close = () => { shownUrls.forEach(u => URL.revokeObjectURL(u)); r.hidden = true; r.innerHTML = ''; };
      r.querySelector('[data-cancel]').addEventListener('click', close);
      r.querySelector('[data-save]').addEventListener('click', async ev => {
        const all = r.querySelector('[data-all]').value.trim();
        const names = files.map((f, i) => r.querySelector(`[data-n="${i}"]`).value.trim() || all);
        r.querySelectorAll('[data-n]').forEach((inp, i) => inp.classList.toggle('bad', !names[i]));
        if (names.some(n => !n)) return say('Type a name for every picture (or one name for all).', true);
        ev.target.disabled = true;
        let n = 0, dup = 0;
        const t0 = Date.now();
        for (let i = 0; i < files.length; i++) {
          say(`<small>Saving ${i + 1} / ${files.length}…</small>`);
          try { const res = await lib.add(kind, names[i], files[i], { file: files[i].name, added: t0 + i, quiet: true }); res.dup ? dup++ : n++; }
          catch (e) { console.warn(e); }
        }
        close(); lib.changed();
        say(`Added ${n} ${kind === 'logo' ? 'logo' : 'photo'}${n === 1 ? '' : 's'}${dup ? `, skipped ${dup} already saved` : ''}.`);
      });
    }

    $('[data-zip]').addEventListener('click', () => $('[data-zipin]').click());
    $('[data-zipin]').addEventListener('change', async ev => {
      const f = ev.target.files[0]; ev.target.value = '';
      if (!f) return;
      const btn = $('[data-zip]'); btn.disabled = true;
      try {
        const r = await importZip(f, (i, n) => say(`<small>Importing ${i} / ${n}…</small>`));
        const parts = [`Added ${r.photos} photo${r.photos === 1 ? '' : 's'} and ${r.logos} logo${r.logos === 1 ? '' : 's'}.`];
        if (r.cutouts) parts.push(`${r.cutouts} saved cut-out${r.cutouts === 1 ? '' : 's'} came with them.`);
        if (r.skipped) parts.push(`Skipped ${r.skipped} already in the library.`);
        if (r.noName) parts.push(`${r.noName} had no name (put them in a player folder, or the name in the file name).`);
        if (r.failed) parts.push(`${r.failed} could not be read.`);
        say(parts.join('\n'));
      } catch (e) { say(esc(e.message || e), true); } finally { btn.disabled = false; }
    });

    $('[data-backup]').addEventListener('click', async () => {
      if (!lib.items.length) return say('The library is empty, nothing to back up.', true);
      const btn = $('[data-backup]'); btn.disabled = true;
      try {
        say('<small>Making the zip…</small>');
        const zip = await backup();
        const name = `efcb-photo-library-${new Date().toISOString().slice(0, 10)}.zip`;
        const a = document.createElement('a'); a.href = URL.createObjectURL(zip); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 60000);
        let html = `Downloaded <b>${esc(name)}</b> (${mb(zip.size)}). Keep it in Google Drive; on a new phone use <b>Import zip</b>.`;
        const file = new File([zip], name, { type: 'application/zip' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          html += '\n<button type="button" data-share>Share / save to Drive…</button>';
          say(html);
          $('[data-msg] [data-share]').onclick = () => navigator.share({ files: [file], title: name }).catch(() => {});
        } else say(html);
      } catch (e) { say(esc(e.message || e), true); } finally { btn.disabled = false; }
    });

    lib.listeners.add(draw);
  }

  /* ---------- start ---------- */

  function start() {
    mountPanel();
    const hook = f => { if (f.__plib) return; f.__plib = true; f.addEventListener('load', () => attach(f)); attach(f); };
    document.querySelectorAll('iframe').forEach(hook);
    new MutationObserver(() => document.querySelectorAll('iframe').forEach(hook)).observe(document.body, { childList: true, subtree: true });
    lib.load().catch(e => console.warn('Photo library: no IndexedDB here', e));
  }

  const api = { norm, compact, bare, same, find, search, fromFile, plan, readZip, makeZip, crc32, importZip, backup, lib, SLOTS, attach };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    root.PhotoLibrary = api;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  }
})(typeof window !== 'undefined' ? window : globalThis);
