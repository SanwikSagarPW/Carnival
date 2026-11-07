# Sparky's Carnival Quest

A picture-first learning game with five activities, two bonus rounds, and the rigged Sparky companion. The UI combines the carnival background with a cream circus-tent stage, rounded Nunito typography, and shared illustrated controls.

## Run it

From this folder, start a local web server:

```powershell
node scripts\serve.mjs
```

Open [http://localhost:8000/](http://localhost:8000/). The server uses gzip for text resources. Any HTTP server can also serve the game; HTTPS (or localhost) is required for the offline service worker.

## Continuous play

The five learning booths repeat forever. The object games share a set of 40 distinct item pictures, plus 7 long objects and 12 shape pictures. Images are reused for scale and colour variations instead of loading separate files for each size:

1. Different One
2. Biggest one
3. Which one has more
4. Select the longest one
5. Match the shapes

The home screen is deliberately minimal: a stacked "Sparky's / Carnival" wordmark in Baloo 2 (self-hosted, `assets/fonts/baloo2-latin.woff2`) with white outlines, a plum extruded shadow, and multicoloured letters that bounce in (static in reduced-motion mode), over the carnival backdrop, one borderless orange pill **Play** button (solid colour, one raised edge, white play badge, a slow breathing pulse, and a squish-pop with a soft ring when tapped; both motions stay still in reduced-motion mode), and Sparky. Pause, sound, stars, and hints appear only once play begins.

After Play, the five booths run in order with no game-selection menu or finish line. The mystery-box surprise appears between booths 2 and 3. Balloon pop appears between booths 4 and 5, without a board or bordered playfield: balloons rise from below the screen until five have been popped. All seven balloon pictures load before play starts. Reduced-motion mode uses stationary balloons. Neither bonus uses a time limit or wrong-answer penalty.

Balloon lanes adapt to the available width and reserve room for the full pop expansion, gentle side-to-side sway, and a gap. Each lane holds only one balloon, including one still popping. Resizing restarts the floating balloons in new lanes without changing the pop count.

Sound stays top-left, Pause top-right, and Next bottom-right. The pause dialog offers Keep playing, Try again (restart the current round), and Back to start. Pause freezes gameplay timers, audio, the rig, and ambient motion; resuming retains progress. Portrait orientation shows a rotate-device prompt and suspends play, as does hiding the tab. Shapes support dragging, tap-select/tap-target, and keyboard selection with Enter or Space. Hear it repeats the current instruction.

Biggest and longest questions scale one picture to four sizes (biggest also hue-shifts it per round); counting questions reuse one of the 40 item pictures in both groups, with a colour variation. Match the shapes uses 12 shapes: circle, oval, triangle, square, rectangle, diamond, heart, star, moon, pentagon, hexagon, and octagon. Each round asks for four of them plus one spare tray piece, and never more than one of the look-alike polygons (pentagon, hexagon, octagon). Each shape has one picture; the polygon pictures and the pentagon, hexagon, octagon, and rectangle tray pieces are drawn by `scripts/make-shape-art.mjs`. Every tray piece keeps the same silhouette as its pictures, and `tests/shapes.test.mjs` checks that every shape has art and a picture.

## Assets and motion

Learning objects are separate transparent WebP files under `assets/objects/`. The 40 item pictures are individual files (`assets/objects/pics/01.webp` to `40.webp`) with their natural margins, so no object is cut off; the original PNG atlases remain in `assets/catalog/` and are not loaded. Biggest and longest normalize the four displayed widths to 38%, 56%, 74%, and 100%, preserving each picture's aspect ratio and fitting them together to the available space. The winning object is at least 35% wider than the runner-up, even when source crops have almost equal widths. A single resize listener updates the current round. Counting uses equal-sized grid cells in both groups.

Mystery boxes use custom shaded vector artwork in `assets/mystery-box.svg` and `assets/mystery-box-open.svg` (striped body, gold ribbon and bow, glowing opening). The three boxes share one drawing, recoloured with CSS hue shifts, and float gently until one is picked. The pick reveals a prize from the existing object library.

The guide's source artwork from `sparky-picture-play/` is not included in this repository. The tent uses lightweight inline SVG artwork in `index.html`: a steep big-top roof (evenly spaced stripes with side and top shading, gold rope edge, roof height scaled from the tent width), a scalloped awning with gold tassels, and a gold finial with a waving pennant (drawn as its own proportional SVG so it does not stretch with the roof, and hidden on screens under 450px tall where it would collide with the star counter), shaded curtains that part when a round starts, and tassel tie-backs that fade in once they have. The twinkling bulbs are a CSS background (so they stay round at any width) and the tie-backs keep their own proportions while the curtain art stretches. The question hangs under the awning as a painted wooden sign (grain, plank seam, corner nails, ropes). Sign details, the title and subtitle, and the Hear it button are all sized from one scale unit, `--u` in `style.css` (1px at 1280x720, following the screen size), so they stay in proportion from phones to ultrawide displays. The tent is 64% of the screen width (74% on screens under 600px tall, so phones use the free space beside Sparky) but never wider than 1.3x the height, and the roof height scales with the tent width so it never looks squashed. and Sparky is placed beside it, so ultrawide screens keep a tent-shaped tent. The title, Hear it button and play area share a grid, so long titles do not wrap and the play area is never covered. Below 400px tall the tent chrome shrinks, and below 330px the subtitle is hidden visually (still available to screen readers) so the shapes game keeps usable targets (36px instead of 44px). The tent is hidden on the home screen and during balloon pop, and reduced-motion mode skips the curtain opening. Local SVGs in `assets/ui/` supply the illustrated button shell. The `assets/bg-park.webp` backdrop is retained. The Nunito font is self-hosted; its license is in `assets/fonts/Nunito-OFL.txt`. Landscape layouts fill the viewport, including tablets and ultrawide displays; heights up to 600px preserve room between the board and right controls. Narrow layouts use two rows for the four-picture activity. Sparky and the fallback poster share a bottom-aligned, proportionate canvas in the left companion area.

Ambient motion is quiet; card entry and feedback take roughly 300ms. Checks and text supplement colour feedback. Reduced motion removes ambient loops and freezes Sparky on a pose. Audio uses one voice channel and optional Web Audio effects, starting only after interaction. Sparky's action names are mapped in `game.js`; the fixed rig camera and character proportions are unchanged. While a voice clip plays, his mouth follows the voice and, if he is idling, his whole rigged body plays the authored `0Final/Vocal/*` gestures (arms, head, gloves), chaining a different one each time a clip ends and settling back to idle when the voice stops. Celebration and try-again reactions finish first. Reduced-motion mode animates only the mouth.

## Slow connections and offline play

- The board and controls render without waiting for the rig. A 32KB still of Sparky stays visible while animation loads.
- Images retry failed downloads. A round stays non-interactive behind a friendly loading surface until all its pictures are ready; failures expose Try loading again instead of blank answer cards.
- The 34MB mesh model is packed into a 1.34MB gzip payload. Tests bound rest-position error below 0.25 rig units; the original model remains for regeneration. Skeleton data also has a gzip copy, with raw fallbacks for browsers without `DecompressionStream`.
- Speech is mono 48kbps MP3. Runtime textures are WebP at their original dimensions and atlas registrations; rig textures use quality 82 (measured at 1.5/255 mean colour error against the original PNGs), about 24% smaller than quality 92.
- A cold first load on a 1.6 Mbps / 150 ms link makes the home screen usable in about 1 second. Sparky's full animation arrives after roughly 3.8MB (about 22 seconds on that link); the game is fully playable while it downloads.
- `index.html` preloads the backdrop and the game's module dependencies, so they are not discovered late.
- If WebGL is unavailable, the rig is never requested (the static Sparky picture stays). On data-saver or 2G it waits until the child taps Sparky. If the GPU context is lost and restored, the rig keeps animating.
- `sw.js` revalidates only the small app shell (html, js, and css beside `sw.js`, which also works when hosted in a sub-folder). Everything else, including rig scripts and data, is cache-first, so repeat visits transfer almost nothing. It supports audio byte-range requests, and after a full prefetch the whole game, including every round and the voice, runs offline.
- Optional prefetch is skipped on data-saver, 2G/3G, and low-bandwidth connections, so those players cache only what they have played. Bump the service worker `VERSION` when replacing non-shell files under existing names.

To regenerate optimised art/audio, install the development-only tools and run:

```powershell
npm install --no-save --no-package-lock sharp ffmpeg-static
node scripts\optimize-assets.mjs
node scripts\pack-mesh-model.mjs
node --test tests\runtime.test.mjs
```
