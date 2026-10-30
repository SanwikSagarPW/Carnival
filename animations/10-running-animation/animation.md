# Running_Animation

Right-facing run with a stable horizontal head anchor, alternating supports and two flight phases.

## Resources

- Sheet: ./spritesheet-optimized-v1.png
- Timing and grid: ./animation.json
- Player: ../../player.js
- Integration instructions: ../../AGENT_INSTRUCTIONS.md

8 stored poses, 8 timed exposures, 4 columns, 2 rows. Cell: 512 × 640. Root: (256, 592). Duration: 640 ms. Loop in game: true.

Read the frameDurationsMs array in JSON. For exposure i use cell=frameMap[i] (or i if absent); crop x=(cell%4)*512, y=Math.floor(cell/4)*640. Never play trailing empty cells. Preserve a constant scale and root.

## Browser usage

```js
import {SpriteSheetPlayer} from './player.js';
const player = await SpriteSheetPlayer.load(canvas, './animations/10-running-animation/animation.json');
player.play();
// player.pause(); player.restart(); player.seekFrame(0); player.destroy();
```

The example paths assume code in the pack root. Adjust them to the game's served asset folder. Motion is contained in the sprite cells.

Original eight complete drawings translated by integer pixels using the midpoint of the warm flame-head bounds. The old neck detector selected arm pixels in flight, producing 46–52 px horizontal jumps. Vertical placement, original RGBA, connected anatomy, scale and airborne clearance are preserved. Both four-pose steps use matching contact/compression/passing/flight exposures of 80/65/65/110 ms (640 ms loop). No body slicing, repainting, morphing or added breathing transform. This registration repair does not redraw residual pose-to-pose anatomy changes. Scale v6: one fixed whole-character transform per clip, matched to the standing-idle median opaque head silhouette area. It includes eyes/mouth, so blinking does not change the scale estimate. No frame-specific scaling, head/body cuts, or pose-height normalization. Grounded contacts remain y592; flight clearance is transformed about the shared root. Pose projection, breathing and original drawing proportions remain intact.
