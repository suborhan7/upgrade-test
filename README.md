# eFCB Admin Studio

One admin page for the eFCB card makers. Open `index.html` in Chrome or Edge.

- **One left column:** a "Choose card type" dropdown at the top; the chosen card's editor sits under it.
  The right side shows only the live poster, sized to fit.
- Switching card types keeps your edits in each maker until you reload the page.
- On a phone the poster sits on top and the column scrolls under it.
- The address remembers the open card (`index.html#comparison`), so you can bookmark one.

## Card types

| Card name | Folder | Status |
|---|---|---|
| Player Comparison | `tools/comparison/` | ready (comparison poster, Option 2 / v2) |
| MVP | `tools/mvp/` | ready |
| Match Result | `tools/match-result/` | ready |
| Top 4 | `tools/top-4/` | ready |
| Player vs Player | `tools/player-vs-player/` | ready |
| Team vs Team | `tools/team-vs-team/` | ready |
| Transfer | `tools/transfer/` | ready |
| Best XI | `tools/best-xi/` | ready |
| Points Table | `tools/points-table/` | ready |
| Fixtures | `tools/fixtures/` | ready |
| Lineup | `tools/lineup/` | ready |
| Team Performance | `tools/team-performance/` | ready |
| Achievement | `tools/achievement/` | ready |

### MVP
One player, 1080 × 1350, "Big MVP" layout: huge MVP letters behind the player, stats row across
the chest (first stat is the coloured headline tile, max 5), name bar with "team · score vs opponent".
Same auto cut-out and drag/size controls as Player Comparison.

Background (dropdown at the top of the form):
- **Template** (default): fixed design, same for every jersey. Shatter (orange + blue, default) or Neon (cyan + magenta).
- **Jersey colours (auto)**: colours come from the player's jersey. Plain black/white jerseys get a
  dark base with a two-colour pair you can pick (gold + purple by default).
- **Upload my own**: admin's 1080 × 1350 image becomes the whole background; letters, stats and
  name bar stay on top in the chosen colour pair.

### Match Result
Two teams, 1080 × 1350. Two layouts (dropdown at the top of the form):
- **Wave Split**: the winner always sits in the big top half (the teams swap on their own when Team 2 wins), with crown,
  WINNER badge and the player's name; the loser sits under the wave with a DEFEAT box. Score medal in the middle.
- **Match Ticket**: a paper match ticket; both players side by side, WINNER / DEFEAT tags with player names, scorers, barcode.

Per team: name, player, goals, goal scorers (comma or new line), photo (auto cut-out, drag/size), optional team logo,
two colours with "Auto from jersey" and "Auto from logo". A draw shows DRAW and no tags.

Background: **Default template** (fixed eFCB colours), **Jersey / logo colours (auto)** (each team's colour; white/black kits
use their trim, plain black/white kits get purple + gold), **Upload my own** (admin's 1080 × 1350 image behind everything).

**Team mode** (Mode dropdown at the top: *Team vs Team (logo + score)*): club crest vs club crest with the score, the partners
strip at the bottom, its own fonts and three layouts (`js/team.js`, `css/team.css`):
- **Crest Clash** (default): two team-colour halves split by a lightning seam, crests on glowing rings, a huge chrome score in a
  hex plate, the result word in giant outline letters behind, WINNER / DEFEAT tags and scorers; captains stand behind their crests.
- **Victory Squad**: the winning team's squad (up to 5 cut-outs, sized by head) in front of a huge italic title (own word, VICTORY
  by default) with a script word, crest watermark, confetti, name tags and a broadcast score bar with both crests.
- **Torn Poster**: a torn paper strip across the poster with the score stamped on it, one team above and one below, halftone
  dots, captains layered over the tear, a WINNER tape on the winner's crest.

Per team: name, short name, goals, scorers, official club crest (a plain background is cut away; colours come from the crest),
two colours, captain name + photo, squad of up to 5 players (name + photo, player 1 in the middle). **Chobi**: squad + captain,
captain only, or logo only. Same 3 backgrounds; every part can be dragged, wheel-resized and removed, Reset puts it back.
Crest Clash, Victory and Torn also work in **Player vs Player** mode: the player photo stands where the captain does, a name
chip shows the player, the team logo (or a colour disc with initials) is the crest; moves are kept apart from team mode.

The Player Stats Card is not in the studio; it lives on the client side of efcb.com
(see efcb-player-cards).

Each maker also works on its own: open `tools/<name>/index.html` directly.

**Smart fill (AI):** `smartfill/` holds an add-on that fills any card from a match report or an eFootball result
screenshot with Gemini, and never invents teams or numbers. See `smartfill/README.md`.

**Photo library:** `library/` holds the photo and logo library shared by all 13 cards. See `library/README.md`.

## Editing (every card)
Every card loads `js/studio-edit.js` (the same file in each tool folder). Click any text block, panel or photo on the
poster to select it, then:
- drag it (text snaps to the centre line; hold Alt to stop snapping), or nudge with the arrow keys (Shift = 10px);
- resize with the mouse wheel, the − / + buttons or the + / − keys;
- **Majhe ano** centres it, **Reset eta** puts just that part back, **Remove** / Delete hides it;
- **Undo / Redo** (Ctrl+Z / Ctrl+Y) cover moves, sizes and removed parts.
The **Poster e ki ki thakbe** list switches parts on/off per layout, and **Reset to default** brings everything back.
Downloads are HD (2160 × 2700). In a new card, wrap each block as `<div class="mv" data-move="key">` and mark photos `data-p`.
A click goes to whatever is really painted under the mouse: see-through layers (full-poster SVGs, empty wrappers, the clear
part of a cut-out) are skipped, so a decoration lying over a player never blocks grabbing that player.

**Test:** `node tests/movable.js [card ...]` (needs Playwright) opens every card, walks every layout × background (and
photo mode / arrangement / formation), and checks that each visible section and photo can be clicked, selected and dragged.
Run it after adding a card or a layout.
`node tests/journey.js [card ...]` does what an admin does on every part of every layout: select, − / +, arrows (buttons and
keys), Majhe, Reset, mouse wheel, drag and grab again, Ctrl+Z / Ctrl+Y, Delete and bring back from the parts list, Reset to
default; then uploads own pictures into every file box, finger-drags on a phone-sized screen, and downloads the PNG.

## Adding a new card type

1. Put the new maker in `tools/<id>/` with its own `index.html`.
2. In `index.html`, find `CARD_TYPES` and add one line:
   `{ id: "mvp", name: "MVP", src: "tools/mvp/index.html" },`
3. In `library/photo-library.js`, find `SLOTS` and list the card's photo / logo inputs with their name boxes.

## Notes

- Auto cut-out (Player Comparison and MVP) needs internet (downloads a model the first time).

Each maker draws the "Choose card type" dropdown itself (`js/studio-nav.js`, copy it into a new tool and add
`<script src="js/studio-nav.js"></script>` to its index.html). Opened on its own, a maker shows only its form.

Every maker also loads `css/ui.css` (after maker.css) and `js/ui.js` (after studio-nav.js): the shared form look
(inputs, buttons, file pickers with the file name, sticky Download button, short dropdown names with a hint line, a "?"
for the editor help). Same file in every tool folder; copy both into a new tool.

### Top 4
Final standings, 1080 × 1350. Two layouts: **Podium** (four glass steps, champion on the highest) and
**Leaderboard** (champion hero with points, wins, goal difference and prize, then 2nd to 4th as rows).
Background: **Default template** with a theme (Navy is the default; Jewel, Ocean, Emerald, Ember are toned mesh
themes with two diagonal bands), **Jersey colours** (blocks/rows take each player's kit colour) or **Upload my own**.
Per player: name, team, points, W/D/L, photo (auto cut-out, drag/size), optional team logo, kit colour.
Photos are auto-fitted by head size, so every head comes out the same size for its place.
Partners strip at the bottom: up to 5 names or logos plus a website line.

### Player vs Player
Pre-match poster, 1080 × 1350 (downloads in HD, 2160 × 2700). Seven layouts:
**Lightning Split**, **Neon Frames**, **Slash Plates**, **Chrome Bar**, **Halftone Slash**, **Smoke** and **Brush** (the last
two are shared with Team vs Team; Brush shows a big outline short name per player, taken from the "Short name" field or
the first part of the player name). Lightning, Slash and Halftone
also have a **Players** choice: *Side by side* or *Upor-nich* (team 1 high on the left, team 2 low on the right, names follow
their player). Neon Frames, Chrome Bar, Smoke and Brush are side by side only.
Two more layouts come from the Match Result team mode: **Crest Clash** (team-colour halves split by a lightning seam, both
players fading out behind their team crest on a glowing ring, a chrome VS in a hex plate, the stage title in giant outline
letters, player name + team chip under each crest) and **Torn Poster** (a torn paper strip across the poster with VS, the
event, title and date stamped on it, both players the same size, player 1 above the tear (cut along the tear, under the paper) with crest + name top right, player 2 below it in front of the
paper with crest + name bottom left, halftone dots, the small tag on a tape). The team logo is the crest; without a logo a
disc in the team colour shows the team's initials. Both use the slim partners strip.
Background: **Default template** (fixed colours for each layout), **Jersey / logo colours (auto)** (each side takes its
team colour; white/black kits use their trim, plain black/white kits get purple) or **Upload my own**.
Poster fields: title (stage), event, small tag, date, kick-off time, the text after the time, optional eFCB logo.
Per team: team, player, photo (auto cut-out, drag/size), optional team logo (sets the colours), main + light colour.
Photos are fitted by head size and are not sharpened, so faces stay clean; use photos at least about 1000 px tall.
Every text block (header, title, VS, team names, date line) can be dragged on the poster and resized with the mouse
wheel, like the photos; this is kept separately for each layout and arrangement.
**Reset to default** puts all sections and both photos of the current layout back.
Partners strip at the bottom: up to 5 names or logos plus a website line.

Every part (header, title, photos/crests, Brush outline words, VS, names, date line, partners strip) can be switched off
under **Poster e ki ki thakbe**, per layout; **Reset to default** brings back positions, sizes and hidden parts.

### Team vs Team
Club crest vs club crest, 1080 × 1350 (HD download 2160 × 2700), with the partner strip. Six layouts:
- **Ball**: each crest is wrapped round a 3D football in the team colours (a crest in the same colour as its team gets a white ball).
- **Smoke**: team-colour smoke over a pitch, fiery VS.
- **Stadium Shield**: floodlit stadium, crests on white shield cards with a team-colour banner.
- **Brush**: neon panels with paint strokes and a big outline short name; chrome cyberpunk (Orbitron) VS under a gold ball.
- **Crest Clash** (from the Match Result team mode): team-colour halves split by a lightning seam, crests on glowing rings, a
  chrome VS with the kick-off time in a hex plate, the stage title in giant outline letters behind, date strip under the names.
- **Torn Poster** (from the Match Result team mode): a torn paper strip with VS, a red title stamp and the date/time stamped on
  it, team 1 above the tear and team 2 below, halftone dots, a tape with the "after the time" line.

Background: Default template (fixed colours), Team colours (auto from the logo) or Upload my own. Per team: team name, logo
(a plain white/black background is cut away automatically; colours come from the logo), and a short name for Brush.
In Crest Clash and Torn Poster the same tick puts the captain behind the crest (Torn: team 2's captain stands in front of
the paper) with a name chip; the crest stays. In Smoke and Brush, tick **Captain er chobi soho** to show the captain's cut-out photo instead of the crest; the crest then
sits next to the team name, with the captain's name below. Crests, photos and every text block can be dragged and resized
with the mouse wheel; **Reset to default** puts them back.

Every part (header, title, photos/crests, Brush outline words, VS, names, date line, partners strip) can be switched off
under **Poster e ki ki thakbe**, per layout; **Reset to default** brings back positions, sizes and hidden parts.

### Transfer
One player moving from an old club to a new one ("Done Deal"), 1080 × 1350 (HD download 2160 × 2700), with the partner
strip. Three layouts:
- **Arrow**: chevrons flowing from the old club's colour into the new club's, gradient DONE DEAL, FROM → TO box, name and stat tiles.
- **Contract**: a signed transfer agreement on a pinstripe desk (club letterhead, paper clip, stats table, clause line,
  script signature) with an inked DONE DEAL stamp; the player on the right with a "Welcome to …" name block.
- **Breaking News**: TV broadcast look, BREAKING NEWS / EXCLUSIVE tags, big "Here we go!", news name bar with both logos,
  a headline line and a stats ticker.

Background: Default template, Club colours (old club colour + the new club's two colours, from the logos or the jersey)
or Upload my own. Fields: title, small line, window name, date, time (News), contract number and stamp line (Contract),
the two big News words, player name and photo (auto cut-out, head-size auto-fit), both clubs (short + full name, logo,
colours) and up to 4 stats (an empty stat is hidden). Every part can be dragged, wheel-resized and switched off under
**Poster e ki ki thakbe**; **Reset to default** puts everything back.

### Best XI
Team of the Week: eleven players in a formation, 1080 × 1350 (HD download 2160 × 2700), with the partner strip.
Formation dropdown: **4-3-3**, **4-4-2**, **4-2-3-1**, **3-5-2**, **3-4-3**, **5-3-2**; every player moves to their spot on their own.
The form lists the players in formation order (1 = keeper, then defenders, midfielders and forwards, left to right), and each
box shows the spot (GK / DF / MF / FW) the player takes in the chosen formation. Two layouts:
- **Tactics Board** (default): a flat green board on a bright blue page; photo tiles with colour-coded position tags (FW red, MF green,
  DF blue, GK yellow), rating chip and name card; average rating and top player boxes at the top.
- **Tactic Pitch**: a tilted 3D pitch; round photo badges with a ring in the player's kit colour, rating chip, name plate with
  position, team and logo; average rating box bottom left.

Background: **Default template**, **Jersey / logo colours** (from the star player's kit; yellow/orange kits get purple, plain
black/white kits get gold + purple) or **Upload my own**. Fields: title, event, week, small tag, the two box labels, optional eFCB
logo; per player: name, team, rating, photo (auto cut-out; the head is auto-fitted in the badge), team logo (given to every player
of the same team), kit colour (auto from the jersey) and **Week er star** (gold badge). Drag a photo to move the face inside its
badge, wheel to size it; drag a name plate to move the whole player. Every part can be dragged, wheel-resized and switched off
under **Poster e ki ki thakbe**; **Reset to default** puts everything back.

### Points Table
League standings, 1080 × 1350 (HD download 2160 × 2700), with the partner strip. 2 to 16 teams; rows grow or shrink to fit.
Per team: name, player / manager, W, D, L, GF, GA, form (last 5, like WWDLW), logo (a plain background is cut away; the colour
comes from the logo) and team colour. Played, goal difference and points (3 × W + D) are worked out on their own; a number in the
**Pts** box overrides the points (for deductions). **Auto sort** orders by points, then goal difference, then goals scored.
Top zone (green, "Next round") and bottom zone (red, "Eliminated"): how many teams and the label are both editable.
GF / GA and form columns switch on/off per layout; the player name under each team switches on/off. Three layouts:
- **Spotlight** (default): gold table on the left, the leader's player cut-out on the right (auto cut-out, drag/size) with a
  "Table topper" box and a big outline #1 behind.
- **Neon Grid**: full-width slanted neon rows (magenta + cyan), gold / silver / bronze numbers for the top three, form squares.
- **LED Scoreboard**: a stadium LED board with dot-matrix (Doto) text, green / red position numbers for the zones and LED form lights.

Background: **Default template**, **Team colours** (from the leader's team colour; yellow/orange teams get purple, plain black/white
teams gold + purple) or **Upload my own**. Every part (header, legend, table heading, each row, photo, topper box, #1, scoreboard
frame, partners) can be dragged, wheel-resized and switched off under **Poster e ki ki thakbe**; **Reset to default** puts it all back.

### Fixtures
Match schedule, 1080 × 1350 (HD download 2160 × 2700), with the partner strip. 2 to 8 matches; rows grow or shrink to fit.
Per match: date, time and a small label (like "Match 1"); per team: name, player, logo (a plain background is cut away; the colour
comes from the logo), team colour and an optional player photo (auto cut-out, drag/size on the poster). Poster fields: title, event,
round / matchweek, format line, start line, live-on line, optional eFCB logo. Three layouts:
- **Clash Rows** (default): slanted logo tiles, the player over a white name plate, a big VS with date and time in the middle (violet + amber).
- **Matchday Calendar**: a tear-off date block (month, day, weekday) and a light match card per row, kick-off time in the middle
  (coral + mint). Title style **A** (small first word over a big last word) or **B** (one line with a two-colour underline).
- **Timeline**: a glowing line down the left with the time and date at each node; each match is a pill in the two team colours with
  round photo badges (gold + blue).

Background: **Default template**, **Team colours** (each match takes its two team colours; the background is tinted from match 1)
or **Upload my own**. Every part (header, each match row, each photo, timeline line, info lines, partners) can be dragged,
wheel-resized and switched off under **Poster e ki ki thakbe**; **Reset to default** puts it all back.

### Lineup
Starting XI of both teams before a match, 1080 × 1350 (HD download 2160 × 2700), with the partner strip.
Per team: name, logo (a plain background is cut away; the colour comes from the logo), team colour, formation, the captain
with a photo (auto cut-out, drag/size on the poster), the starters (one per line: number, name, position, like `9 Lewandowski ST`;
add (C) for the captain; up to 11) and the subs (comma separated). Poster fields: title, event, stage, date, kick-off, live-on line,
the word under each photo (Captain by default; the captain's name comes from the (C) player unless typed), optional eFCB logo. Number, position, captain badge, subs and photos switch on/off.
Three layouts:
- **Face-Off** (default): both crests with a big X on top, the two lists mirrored on a glowing centre line (number chips, positions),
  the captains' cut-outs at the edges on name plates (magenta + cyan).
- **Shirt Wall**: a dressing-room wall, every player a shirt on a hanger with name and number (keepers in volt green), the two
  teams above and below a slanted VS band with the stage and kick-off (orange + blue).
- **Holo Panels**: two glass panels, each captain rising out of their panel, neon number boxes and position tags (violet + mint).

Background: **Default template**, **Team colours** (each side takes its team colour; plain black/white teams keep the layout colour)
or **Upload my own**. Every part can be dragged, wheel-resized and switched off under **Poster e ki ki thakbe**;
**Reset to default** puts it all back.

### Team Performance
One team's result after a match day or a stage, 1080 × 1350 (HD download 2160 × 2700), with the partner strip.
Team: name, short name, logo (a plain background is cut away), two colours (auto from the logo or the star's jersey).
Up to 5 stats (empty ones are hidden). Photos: up to 7 player cut-outs that are arranged into a squad on their own (every head
fitted to the same size, player 1 is the star in the middle), or one group photo. A name tag on each player (or one names line),
optional confetti, optional eFCB logo. Fields: result line, big title (Roster), event, corner tag (Arena).
Three layouts:
- **Arena Shockwave** (default): light slashes and shockwave rings, a 2-row squad, huge italic team name, slanted result ribbon and big
  italic numbers (crimson + amber).
- **Diagonal Roster**: a team-colour diagonal band with speed stripes and the team name repeated faintly, all players
  in one row in front of it, the team name in script over a huge slanted title, skewed stat boxes (blue + pink).
- **Neon Tunnel**: a holographic tunnel, the short name huge behind the heads, the squad behind a glowing platform with the
  crest, angled HUD stat tiles (violet + lime).

Background: **Default template**, **Team colours** (gold/yellow and plain kits get purple as the second colour) or
**Upload my own**. Every part and photo can be dragged, wheel-resized and switched off under **Poster e ki ki thakbe**;
**Reset to default** puts it all back.

### Achievement
Trophy poster for one team, 1080 × 1350 (HD download 2160 × 2700), with the partner strip. Award: **Champions**, **Runners Up**,
**3rd Place** or an own title. Fields: script word over the title (Grand Final), event, season / date line, optional eFCB logo;
team name, short name, logo (a plain background is cut away), two colours (auto from the logo or the star's jersey); up to 3
highlights (Final 3-1, Prize, Record; empty ones are hidden). Photos: up to 7 player cut-outs arranged into a squad on their own
(every head fitted to the same size, player 1 is the star), or one group photo; a name tag on each player (or one names line),
an **MVP badge** on one player, confetti (on by default). Three layouts:
- **Golden Glory** (default): sunburst rays and corner brackets, a two-row squad, a huge medal-coloured title IN FRONT of the
  players (gold for champions, silver for runners up, bronze for 3rd) with the script word across it, a trophy seal with the place.
- **Neon Spotlight**: stage spotlights and haze, a neon script word over a huge condensed title BEHIND the heads, one row of
  players, lightning bolts at the bottom corners (teal + magenta).
- **Ink Splash**: light paper with brush strokes and paint drops, the star big in front with the rest stepping up behind, a dark
  ink pool at the bottom with a slanted chrome title and a light streak (indigo + pink).

Background: **Default template**, **Team colours** (gold/yellow and plain kits get purple as the second colour) or
**Upload my own**. Every part and photo can be dragged, wheel-resized and switched off under **Poster e ki ki thakbe**;
**Reset to default** puts it all back.
