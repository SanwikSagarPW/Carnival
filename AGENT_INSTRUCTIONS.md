# Animation pack — agent integration instructions

Read this file before integrating. All paths below are relative to this extracted folder.

1. Read manifest.json to discover the selected clips. Each entry points to an animation.json and animation.md.
2. Keep the animations/ directory structure. Each clip has an RGBA PNG sprite sheet, JSON playback metadata and its guide.
3. Use cellWidth/cellHeight, columns, frameCount, atlasFrameCount, frameMap, frameDurationsMs, loop and root from JSON. For playback exposure i use cell=frameMap[i] (or i when frameMap is absent), then crop that cell in row-major order. Repeated poses share one stored cell. Empty trailing cells are not animation frames.
4. Keep the shared (256,592) root and one display scale across clips. Do not fit each pose to its individual bounds.
5. Preserve loop:false for one-shots; hold their last frame until the game changes state. Gallery previews repeat for browsing only.
6. For browser games import SpriteSheetPlayer from ./player.js. Set the canvas size through the player, not per-frame bounds. Call destroy() when removing a character.
7. breathEffect is part of playback: the bundled player implements it. Other engines must port that effect or use the base sheet without claiming it is baked.
8. Use assetRevision to invalidate cached sheets. Do not invent frame indices, filenames, timing or missing actions.
9. Map game states explicitly to clip IDs. This pack includes no game-specific state machine.

Open preview.html through a local HTTP server for a dependency-free integration example. Serve the parent game directory, for example with python3 -m http.server 8000, and open this pack's preview.html.

For Phaser, Unity, Godot or another engine, translate the JSON timing and crop rectangles into the engine's sprite animation API. The sheets contain no required external runtime; player.js is an optional browser Canvas player.
