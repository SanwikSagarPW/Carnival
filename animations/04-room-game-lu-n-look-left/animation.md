# Room_Game/Lu_N_Look_Left

Turn the head left, hold, then return.

## Resources

- Sheet: ./spritesheet-optimized-v1.png
- Timing and grid: ./animation.json
- Player: ../../player.js
- Integration instructions: ../../AGENT_INSTRUCTIONS.md

6 stored poses, 10 timed exposures, 3 columns, 2 rows. Cell: 512 × 640. Root: (256, 592). Duration: 2200 ms. Loop in game: true.

Read the frameDurationsMs array in JSON. For exposure i use cell=frameMap[i] (or i if absent); crop x=(cell%3)*512, y=Math.floor(cell/3)*640. Never play trailing empty cells. Preserve a constant scale and root.

## Browser usage

```js
import {SpriteSheetPlayer} from './player.js';
const player = await SpriteSheetPlayer.load(canvas, './animations/04-room-game-lu-n-look-left/animation.json');
player.play();
// player.pause(); player.restart(); player.seekFrame(0); player.destroy();
```

The example paths assume code in the pack root. Adjust them to the game's served asset folder. The player applies runtime breathing from breathEffect; it is not baked into the PNG.

Existing complete playback cells and their timing are preserved. Integer-pixel vertical translation aligns each opaque sole/floor baseline to y592, without repainting, resizing, body-part separation or changing the breathing/blink/look motion. Scale v6: one fixed whole-character transform per clip, matched to the standing-idle median opaque head silhouette area. It includes eyes/mouth, so blinking does not change the scale estimate. No frame-specific scaling, head/body cuts, or pose-height normalization. Grounded contacts remain y592; flight clearance is transformed about the shared root. Pose projection, breathing and original drawing proportions remain intact.
