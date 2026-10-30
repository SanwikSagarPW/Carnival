# Front_Hi

Gradually raise the screen-left hand, give two small wrist waves, and gently lower it to neutral.

## Resources

- Sheet: ./spritesheet-optimized-v1.png
- Timing and grid: ./animation.json
- Player: ../../player.js
- Integration instructions: ../../AGENT_INSTRUCTIONS.md

10 stored poses, 21 timed exposures, 4 columns, 3 rows. Cell: 512 × 640. Root: (256, 592). Duration: 2245 ms. Loop in game: false.

Read the frameDurationsMs array in JSON. For exposure i use cell=frameMap[i] (or i if absent); crop x=(cell%4)*512, y=Math.floor(cell/4)*640. Never play trailing empty cells. Preserve a constant scale and root.

## Browser usage

```js
import {SpriteSheetPlayer} from './player.js';
const player = await SpriteSheetPlayer.load(canvas, './animations/18-front-hi/animation.json');
player.play();
// player.pause(); player.restart(); player.seekFrame(0); player.destroy();
```

The example paths assume code in the pack root. Adjust them to the game's served asset folder. The player applies runtime breathing from breathEffect; it is not baked into the PNG.

Complete, intact character drawings are used for every frame. No isolated arm masks, cutout joints, shoulder rotation, or body-part compositing. Seven gradual lift poses lead into two wrist sweeps using the coherent early source drawings; recovery uses the exact reversed lift. A single clip scale is applied before publication. Original source artwork is retained in front-hi-v7/sources. Small authored drawing differences remain; this repair removes the damaged arm seams. Scale v6: one fixed whole-character transform per clip, matched to the standing-idle median opaque head silhouette area. It includes eyes/mouth, so blinking does not change the scale estimate. No frame-specific scaling, head/body cuts, or pose-height normalization. Grounded contacts remain y592; flight clearance is transformed about the shared root. Pose projection, breathing and original drawing proportions remain intact.
