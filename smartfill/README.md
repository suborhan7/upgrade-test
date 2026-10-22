# Card Smartfill

AI smart fill for every card in the studio (works on eFCB studio and, unchanged, on efcob-studio).
Paste the match info or drop an eFootball result screenshot, press **Fill this card**, and the form fills itself.

## It never makes things up

- Gemini must quote your text for every value it fills.
- Every value is then checked in the browser: each name / number has to be written in your text word for word.
  "Sylhet Strikers FC" is thrown away when you only wrote "Sylhet Strikers"; a date or score you never gave is thrown away.
- Anything not in your text stays empty and is listed under **Not in source**, for you to type.
- With the tick on (default), the other text fields of a section it fills are emptied, so no sample name like
  "AC Milan" is left next to your real score. **Undo** puts everything back.
- Photos, logos, colours and dropdowns are never touched.

## Screenshot (phase 2)

Drop, pick or paste (Ctrl+V into the text box) an eFootball result screenshot. Gemini first writes down only the
text it can see; that text appears in the box so you can check it, and the same strict fill runs on it.

## Use it

In **eFCB studio** it is built in: the **✨ Smart fill** button sits at the bottom right of the studio page.
Click it, paste your free key once (https://aistudio.google.com/apikey), then paste the match info or a screenshot.

On any other studio (like efcob-studio), use the bookmark instead:

1. Open `smartfill/dist/install.html` and drag the **✨ Smart fill** button to your bookmarks bar.
2. Get a free key at https://aistudio.google.com/apikey.
3. Open the studio, pick a card, click the bookmark, paste the key once.

To build it into another studio, add one line to its `index.html`: `<script src="smartfill/card-smartfill.js" data-start="min"></script>`.

The key is kept only in your browser (localStorage, or this tab only if you untick "remember").
**Forget key** removes it. It is never in this repo; please never commit it.

## Develop

- `card-smartfill.js` is the whole add-on. After a change run `node smartfill/build.js` to rebuild the bookmarklet.
- `node --test smartfill/test/grounding.test.js`: the "no invented data" checks.
- `node smartfill/test/e2e.js [studio folder]`: fills the Match Result card in a real browser with a fake Gemini
  (no key, no network), from text and from a screenshot. Needs playwright.
- Model: `gemini-2.5-flash` (free tier), temperature 0.
