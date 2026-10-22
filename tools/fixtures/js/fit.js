/* Scales the poster preview so the whole 1080 × 1350 poster fits the space beside the form. */
(function () {
  const stage = document.querySelector('.stage'), frame = document.getElementById('frame'), poster = document.getElementById('poster');
  function fit() {
    const pad = window.innerWidth <= 620 ? 32 : 48;
    // the Download / Share bar under the poster (js/ui.js) takes its own height
    const bar = stage.querySelector('.act-bar'), bh = bar ? bar.offsetHeight + 12 : 0;
    const maxH = window.innerWidth <= 620 ? window.innerHeight * 0.42 : window.innerHeight - pad - bh;
    const s = Math.max(0.15, Math.min((stage.clientWidth - pad) / 1080, maxH / 1350));
    frame.style.width = Math.floor(1080 * s) + 'px';
    frame.style.height = Math.floor(1350 * s) + 'px';
    poster.style.transform = `scale(${s})`;
  }
  window.addEventListener('resize', fit);
  new ResizeObserver(fit).observe(stage);
  fit();
})();
