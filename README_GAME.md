# Sparky's Carnival Quest

A picture-first learning game with five activities, two bonus rounds, and the rigged Sparky companion. The UI combines the original carnival background with the handoff's illustrated blue/cream board, rounded Nunito typography, and shared blue controls.

## Run it

From this folder, start a local web server:

```powershell
node scripts\serve.mjs
```

Open [http://localhost:8000/](http://localhost:8000/). The server uses gzip for text resources. Any HTTP server can also serve the game; HTTPS (or localhost) is required for the offline service worker.

## Continuous play

The five learning booths repeat forever. Each booth tracks 40 asset variations, then cycles its set while play continues:

1. Different One
2. Biggest one
3. Which one has more
4. Select the longest one
5. Match the shapes

After Play, the five booths run in order with no game-selection menu or finish line. The mystery-box surprise appears between booths 2 and 3. Balloon pop appears between booths 4 and 5, without a board or bordered playfield: balloons rise from below the screen until five have been popped. All seven balloon pictures load before play starts. Reduced-motion mode uses stationary balloons. Neither bonus uses a time limit or wrong-answer penalty.

Balloon lanes adapt to the available width and reserve room for the full pop expansion, gentle side-to-side sway, and a gap. Each lane holds only one balloon, including one still popping. Resizing restarts the floating balloons in new lanes without changing the pop count.

Sound stays top-left, Pause top-right, and Next bottom-right. The pause dialog offers Keep playing, Try again (restart the current round), and Back to start. Pause freezes gameplay timers, audio, the rig, and ambient motion; resuming retains progress. Portrait orientation shows a rotate-device prompt and suspends play, as does hiding the tab. Shapes support dragging, tap-select/tap-target, and keyboard selection with Enter or Space. Hear it repeats the current instruction.

Biggest and longest questions compare four sizes of the same selected object. Counting questions repeat one picture in both groups so the child only has to compare the counts. Shape art rotates through all 40 shape assets while preserving each shape's matching silhouette.

## Assets and motion

Learning objects are separate transparent WebP files under `assets/objects/`, with the original pixel dimensions preserved. Biggest and longest normalize the four displayed widths to 38%, 56%, 74%, and 100%, preserving each picture's aspect ratio and fitting them together to the available space. The winning object is at least 35% wider than the runner-up, even when source crops have almost equal widths. A single resize listener updates the current round. Counting uses equal-sized grid cells in both groups. Original PNG atlases remain in `assets/catalog/`.

Mystery boxes use custom closed/open vector artwork in `assets/mystery-box.svg` and `assets/mystery-box-open.svg`, then reveal a prize from the existing object library.

The guide's source artwork from `sparky-picture-play/` is not included in this repository. Local SVGs in `assets/ui/` implement its bevelled frame and blue button shell without introducing large downloads. The earlier `assets/carnival-midway.webp` backdrop is retained, without extra meadow decorations. The Nunito font is self-hosted; its license is in `assets/fonts/Nunito-OFL.txt`. Landscape layouts fill the viewport, including tablets and ultrawide displays; heights up to 600px preserve 12px between the board and right controls. Narrow layouts use two rows for the four-picture activity. Sparky and the fallback poster share a bottom-aligned, proportionate canvas in the left companion area.

Ambient motion is quiet; card entry and feedback take roughly 300ms. Checks and text supplement colour feedback. Reduced motion removes ambient loops and freezes Sparky on a pose. Audio uses one voice channel and optional Web Audio effects, starting only after interaction. Sparky's action names are mapped in `game.js`; the fixed rig camera and character proportions are unchanged.

## Slow connections and offline play

- The board and controls render without waiting for the rig. A 32KB still of Sparky stays visible while animation loads.
- Images retry failed downloads. A round stays non-interactive behind a friendly loading surface until all its pictures are ready; failures expose Try loading again instead of blank answer cards.
- The 34MB mesh model is packed into a 1.34MB gzip payload. Tests bound rest-position error below 0.25 rig units; the original model remains for regeneration. Skeleton data also has a gzip copy, with raw fallbacks for browsers without `DecompressionStream`.
- Speech is mono 48kbps MP3. Runtime textures are WebP at their original dimensions and atlas registrations.
- `sw.js` caches successful local assets, supports audio byte-range requests, and serves cached code immediately while refreshing it. Previously loaded rounds can work offline; an uncached round still needs a connection.
- Optional prefetch is skipped on data-saver, 2G/3G, and low-bandwidth connections. Bump the service worker `VERSION` when replacing assets under existing names.

To regenerate optimised art/audio, install the development-only tools and run:

```powershell
npm install --no-save --no-package-lock sharp ffmpeg-static
node scripts\optimize-assets.mjs
node scripts\pack-mesh-model.mjs
node --test tests\runtime.test.mjs
```
