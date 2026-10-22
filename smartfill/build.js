// Builds dist/install.html: a page with the "Smart fill" bookmarklet to drag to the bookmarks bar.
// Run after changing card-smartfill.js:  node smartfill/build.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'card-smartfill.js'), 'utf8')
  .replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '')          // the header comment
  .replace(/^\s*\/\/.*$/gm, '');                   // whole-line comments (none sit inside strings)
const bookmarklet = 'javascript:' + encodeURIComponent(`(function(){if(window.CardSmartfill){CardSmartfill.mount();return;}${src}})();`);
const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Card Smartfill</title>
<style>
:root{--bg:#11141b;--fg:#e8ebf2;--mut:#9aa4bf;--acc:#3b82f6}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif;padding:32px 16px}
main{max-width:640px;margin:auto}
a.bm{display:inline-block;background:var(--acc);color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px;cursor:grab}
ol li{margin:6px 0} code{background:#1b2030;padding:1px 6px;border-radius:5px} p.mut{color:var(--mut)}
</style></head><body><main>
<h1>✨ Card Smartfill</h1>
<p>AI smart fill for the card studio. It only fills what your text or screenshot says, never made-up teams or numbers.</p>
<p><a class="bm" href="${esc(bookmarklet)}" onclick="alert('Drag this button to your bookmarks bar.');return false">✨ Smart fill</a></p>
<ol>
<li>Show the bookmarks bar (<code>Ctrl+Shift+B</code>) and drag the blue button onto it.</li>
<li>Get a free Gemini API key at <a href="https://aistudio.google.com/apikey" style="color:#8ab4ff">aistudio.google.com/apikey</a>.</li>
<li>Open the studio, pick a card, click the <b>✨ Smart fill</b> bookmark.</li>
<li>Paste your key once, paste the match info (or drop an eFootball result screenshot), press <b>Fill this card</b>.</li>
</ol>
<p class="mut">The key stays in your browser only (Forget key removes it). Built ${new Date().toISOString().slice(0, 10)}, ${Math.round(bookmarklet.length / 1024)} KB.</p>
</main></body></html>
`;
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'install.html'), html);
console.log('dist/install.html written,', bookmarklet.length, 'chars');
