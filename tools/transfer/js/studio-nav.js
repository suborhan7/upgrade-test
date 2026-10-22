/* Inside the eFCB Admin Studio: a "Choose card type" dropdown at the top of the left column; the chosen card's form sits under it.
   Opened on its own (not in the studio) nothing changes. */
(function () {
  if (window.parent === window) return;
  const form = document.getElementById('form');
  let installBox = null;
  // "Install app" button: shown when the browser offers to install the studio, or a how-to hint on iPhone
  function showInstall(state) {
    if (!installBox) return;
    installBox.hidden = !state;
    installBox.querySelector('button').hidden = state !== 'ready';
    installBox.querySelector('p').hidden = state !== 'ios';
  }
  window.addEventListener('message', e => {
    const m = e.data || {};
    if (m.type === 'studio-install-state') return showInstall(m.install);
    if (m.type !== 'studio-cards') return;
    form.querySelectorAll('.studio-nav').forEach(n => n.remove());
    const cur = m.cards.find(c => c.id === m.current) || m.cards[0];
    const nav = document.createElement('div');
    nav.className = 'studio-nav';
    const v = m.version ? `<small class="studio-ver">Version ${m.version.date} · v${m.version.n}</small>` : '';
    nav.innerHTML = `<div class="studio-brand">eFCB Admin Studio${v}</div>
      <button type="button" class="card-pick" aria-expanded="false"><span>Choose card type</span><b></b><i>▾</i></button>
      <div class="card-list" hidden></div>
      <div class="studio-install" hidden><button type="button">⤓ Install app</button>
        <p>iPhone e app er moto use korte: Safari te Share chapo, tarpor "Add to Home Screen".</p></div>`;
    nav.querySelector('.card-pick b').textContent = cur.name;
    const pick = nav.querySelector('.card-pick'), list = nav.querySelector('.card-list');
    for (const c of m.cards) {
      const o = document.createElement('button');
      o.type = 'button';
      o.className = 'card-opt' + (c.id === cur.id ? ' on' : '');
      o.textContent = c.name;
      o.addEventListener('click', () => {
        list.hidden = true; pick.setAttribute('aria-expanded', 'false');
        if (c.id !== cur.id) parent.postMessage({ type: 'studio-select', id: c.id }, '*');
      });
      list.appendChild(o);
    }
    pick.addEventListener('click', () => {
      list.hidden = !list.hidden;
      pick.setAttribute('aria-expanded', String(!list.hidden));
    });
    installBox = nav.querySelector('.studio-install');
    installBox.querySelector('button').addEventListener('click', () => parent.postMessage({ type: 'studio-install' }, '*'));
    showInstall(m.install);
    form.prepend(nav);
    document.body.classList.add('in-studio');
  });
  parent.postMessage({ type: 'studio-ready' }, '*');
  const st = document.createElement('style');
  st.textContent = `.studio-install{margin:10px 0 2px}.studio-install button{width:100%;padding:10px 12px;border-radius:8px;border:1px solid #19e28a;background:transparent;color:#19e28a;font:inherit;font-size:14px;font-weight:700;cursor:pointer}
.studio-install button:hover{background:rgba(25,226,138,.12)}.studio-brand{flex-wrap:wrap;row-gap:2px}.studio-ver{display:block;flex-basis:100%;padding-left:18px;margin-top:0;font-size:12px;font-weight:500;color:#8590a6;letter-spacing:.02em}
.studio-install p{margin:6px 0 0;font-size:12.5px;line-height:1.4;color:#9aa3b2}`;
  document.head.appendChild(st);
})();
