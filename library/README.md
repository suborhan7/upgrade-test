# Photo library

One library of player photos and team logos for all 13 cards. Tap **🖼️ Photos** at the bottom right of the studio.

## Where the photos are

In this browser only (IndexedDB, one database for the whole site). Nothing is uploaded and it costs nothing.
**Clearing site data / browsing data for the site deletes the library**, so press **Back up** now and then and keep
the zip (Google Drive is fine). **Import zip** on a new phone brings everything back.
The panel shows how many photos and logos there are and how much space they use.

## In the cards

- Type a saved name in a card's player name box and that player's newest photo goes into the slot next to it by itself.
  Player name or gamer tag: "nova", "Nova_10", "nova 10" and "NOVA-10" all find Nova_10. ("nova" alone finds every Nova;
  when there is more than one, the thumbnails show all of them and nothing is put in by itself.)
- Thumbnails under the slot switch photos; **×** deletes one from the library (Undo for a few seconds).
- Team logos work the same way from the team name box.
- A photo you pick by hand while a name is typed is saved to the library under that name.
- The auto cut-out result is saved with the photo, so the cut-out model does not run again for that photo
  (a card that uses the bigger model cuts it once more and keeps the better result).
- Every photo slot is covered: Comparison A/B, MVP, Match Result (players, captains, both squads of 5), Top 4,
  Player vs Player, Team vs Team captains, Transfer, Best XI (all 11), Points Table leader, Fixtures, Lineup captains,
  Team Performance and Achievement squads of 7. The list is `SLOTS` in `photo-library.js`.
- The Lineup captain photo fills from the Captain box (not from the "(C)" in the player list).

## Adding many at once

- **＋ Add photos**: pick many photos from the gallery, type one name for all (or a name per photo), Save.
  File names that already carry a name (`nova-10-2.jpg`) are filled in for you.
- **Import zip**: normal compressed zips from a phone or computer work (read in the browser, no library or service).

Zip layout:

```
Nova_10/1.jpg              one folder per player (photo 1 is the oldest, the highest number the newest)
Nova_10/2.jpg
rafi-ahmed-2.jpg           or the name in the file name (the last number is the photo number)
logos/Dhaka Strikers.png   team logos in a logos/ folder (or logos/Dhaka Strikers/1.png)
```

Importing the same zip again skips the photos already saved (same picture = same bytes). Camera names like
`IMG_2034.jpg` with no player folder are skipped and counted, never guessed.

**Back up** downloads the whole library as one zip in the same layout, plus each photo's saved cut-out
(`1.cutout-small.png`) and `library.json` (other names of each player). Import it as it is.

## Tests

- `node --test library/test/names.test.js`: name matching and the zip layout rules.
- `node library/test/e2e.js`: the whole thing in a real browser on a phone-sized screen with a fake cut-out (no network):
  import, import again, fill slots in several cards, switch, delete, save a hand-picked photo, back up, wipe, restore.
  Needs playwright.
