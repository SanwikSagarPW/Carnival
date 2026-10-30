# N2/Lu_Laugh_03_Tummy_Hand

A gentle laugh beat with a hand on the tummy, followed by recovery.

## Resources

- Sheet: ./spritesheet-optimized-v1.png
- Timing and grid: ./animation.json
- Player: ../../player.js
- Integration instructions: ../../AGENT_INSTRUCTIONS.md

5 stored poses, 8 timed exposures, 3 columns, 2 rows. Cell: 512 × 640. Root: (256, 592). Duration: 490 ms. Loop in game: true.

Read the frameDurationsMs array in JSON. For exposure i use cell=frameMap[i] (or i if absent); crop x=(cell%3)*512, y=Math.floor(cell/3)*640. Never play trailing empty cells. Preserve a constant scale and root.

## Browser usage

```js
import {SpriteSheetPlayer} from './player.js';
const player = await SpriteSheetPlayer.load(canvas, './animations/14-n2-lu-laugh-03-tummy-hand/animation.json');
player.play();
// player.pause(); player.restart(); player.seekFrame(0); player.destroy();
```

The example paths assume code in the pack root. Adjust them to the game's served asset folder. Motion is contained in the sprite cells.

Nine built-in imagegen motion stages. Complete-figure alpha extraction; whole-figure scaling stabilizes head size and sole registration fixes the ground anchor. Reusing the same approach drawings in reverse gives an exact recovery path. No separated body parts, mesh deformation, crossfade or optical flow. Readable contact/terminal holds are explicit in timing. New artwork remains subject to visual review. Scale v6: one fixed whole-character transform per clip, matched to the standing-idle median opaque head silhouette area. It includes eyes/mouth, so blinking does not change the scale estimate. No frame-specific scaling, head/body cuts, or pose-height normalization. Grounded contacts remain y592; flight clearance is transformed about the shared root. Pose projection, breathing and original drawing proportions remain intact.
