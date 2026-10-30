# Entry_Pointing

Raise and extend one arm to point right, then hold.

## Resources

- Sheet: ./spritesheet-optimized-v1.png
- Timing and grid: ./animation.json
- Player: ../../player.js
- Integration instructions: ../../AGENT_INSTRUCTIONS.md

8 stored poses, 8 timed exposures, 4 columns, 2 rows. Cell: 512 × 640. Root: (256, 592). Duration: 1170 ms. Loop in game: false.

Read the frameDurationsMs array in JSON. For exposure i use cell=frameMap[i] (or i if absent); crop x=(cell%4)*512, y=Math.floor(cell/4)*640. Never play trailing empty cells. Preserve a constant scale and root.

## Browser usage

```js
import {SpriteSheetPlayer} from './player.js';
const player = await SpriteSheetPlayer.load(canvas, './animations/21-entry-pointing/animation.json');
player.play();
// player.pause(); player.restart(); player.seekFrame(0); player.destroy();
```

The example paths assume code in the pack root. Adjust them to the game's served asset folder. The player applies runtime breathing from breathEffect; it is not baked into the PNG.

Built-in imagegen whole-character motion stages. Whole-figure scale registration stabilizes character volume. Ground contacts are fixed; genuine airborne run/jump stages retain explicit vertical clearance. Recovery and loop ordering use reviewed source stages. No separated head/body, frame crossfade or optical flow. New drawings require visual review. Scale v6: one fixed whole-character transform per clip, matched to the standing-idle median opaque head silhouette area. It includes eyes/mouth, so blinking does not change the scale estimate. No frame-specific scaling, head/body cuts, or pose-height normalization. Grounded contacts remain y592; flight clearance is transformed about the shared root. Pose projection, breathing and original drawing proportions remain intact.
