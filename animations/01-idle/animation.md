# Idle

A quiet standing breathing loop.

## Resources

- Sheet: ./spritesheet-optimized-v1.png
- Timing and grid: ./animation.json
- Player: ../../player.js
- Integration instructions: ../../AGENT_INSTRUCTIONS.md

31 stored poses, 60 timed exposures, 7 columns, 5 rows. Cell: 512 × 640. Root: (256, 592). Duration: 2400 ms. Loop in game: true.

Read the frameDurationsMs array in JSON. For exposure i use cell=frameMap[i] (or i if absent); crop x=(cell%7)*512, y=Math.floor(cell/7)*640. Never play trailing empty cells. Preserve a constant scale and root.

## Browser usage

```js
import {SpriteSheetPlayer} from './player.js';
const player = await SpriteSheetPlayer.load(canvas, './animations/01-idle/animation.json');
player.play();
// player.pause(); player.restart(); player.seekFrame(0); player.destroy();
```

The example paths assume code in the pack root. Adjust them to the game's served asset folder. Motion is contained in the sprite cells.

Existing complete playback cells and their timing are preserved. Integer-pixel vertical translation aligns each opaque sole/floor baseline to y592, without repainting, resizing, body-part separation or changing the breathing/blink/look motion. Scale v6: one fixed whole-character transform per clip, matched to the standing-idle median opaque head silhouette area. It includes eyes/mouth, so blinking does not change the scale estimate. No frame-specific scaling, head/body cuts, or pose-height normalization. Grounded contacts remain y592; flight clearance is transformed about the shared root. Pose projection, breathing and original drawing proportions remain intact.
