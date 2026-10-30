# Sparky's Carnival Quest

A browser game that combines the five requested early-learning activities with small carnival breaks between them. The layout takes inspiration from the bright fairground setting in the supplied reference and uses Sparky's included sprite animation pack.

## Run it

From this folder, start a local web server:

```powershell
python -m http.server 8000
```

Open [http://localhost:8000/](http://localhost:8000/). The animation metadata and JavaScript modules need an HTTP server.

## Continuous play

The five learning booths repeat forever. Each booth tracks 40 asset variations, then cycles its set while play continues:

1. Different One
2. Biggest one
3. Which one has more
4. Select the longest one
5. Match the shapes

The main menu lists all five booths before play begins. The game uses an endless midway rotation with no top progress tracker, so children can keep playing without seeing a finish line. The mystery-box surprise appears between booths 2 and 3. Balloon pop appears between booths 4 and 5, with new balloons continuously rising from the bottom of the play area until five have been popped. Neither minigame uses a timer or a wrong-answer penalty. Shape matching works by dragging or by tapping a piece and its matching outline. The sound button mutes or enables optional sound effects; Main menu returns to the start and Restart carnival begins the learning cycle again.

Biggest and longest questions compare four sizes of the same selected object. Counting questions repeat one picture in both groups so the child only has to compare the counts. Shape art rotates through all 40 shape assets while preserving each shape's matching silhouette.

## Assets and motion

The game uses 200 separate transparent PNGs, 40 for each activity, under `assets/objects/`. Each object is its own file so choices never show neighboring artwork from a sprite sheet. The original atlas sheets are kept in `assets/catalog/` as source art. The split utility is `tools/split-transparent-atlases.ps1`.

Mystery boxes use custom closed/open vector artwork in `assets/mystery-box.svg` and `assets/mystery-box-open.svg`, then reveal a prize from the existing object library.

The midway uses a custom panoramic illustration at `assets/carnival-midway.png`, plus a foreground ferris wheel, tent, balloons, and vector interface icons. The header ticket mark is a lightweight vector asset at `assets/carnival-ticket-badge.svg`. Navigation and menu art use local SVG and transparent PNG files instead of emoji glyphs.

Cards, matching pieces, the mystery boxes, balloons, and Sparky use eased entrance, hover, bounce, and float motion. Correct answers, matches, prize reveals, and balloon pops add small sparkle bursts. Procedural Web Audio effects provide gentle taps, soft retry tones, rising answer chimes, prize fanfares, and balloon pops. Sound starts after the first player interaction and can be muted from the header. The UI respects the device's reduced-motion preference. Sparky's idle, greeting, wow, clapping, and happy-jump animations come from the existing `animations/` pack.
