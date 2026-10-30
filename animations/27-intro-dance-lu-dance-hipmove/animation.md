# Cute_Bounce_Dance

A cute little two-beat bounce: happy smile, raised fists, soft knees and tiny hand bops.

## Resources

- Sheet: ./spritesheet-optimized-v1.png
- Timing and grid: ./animation.json
- Player: ../../player.js
- Integration instructions: ../../AGENT_INSTRUCTIONS.md

47 stored poses, 48 timed exposures, 8 columns, 6 rows. Cell: 512 × 640. Root: (256, 592). Duration: 1600 ms. Loop in game: true.

Read the frameDurationsMs array in JSON. For exposure i use cell=frameMap[i] (or i if absent); crop x=(cell%8)*512, y=Math.floor(cell/8)*640. Never play trailing empty cells. Preserve a constant scale and root.

## Browser usage

```js
import {SpriteSheetPlayer} from './player.js';
const player = await SpriteSheetPlayer.load(canvas, './animations/27-intro-dance-lu-dance-hipmove/animation.json');
player.play();
// player.pause(); player.restart(); player.seekFrame(0); player.destroy();
```

The example paths assume code in the pack root. Adjust them to the game's served asset folder. Motion is contained in the sprite cells.

A simple bounce dance alongside the separate Hip_Dance. One intact character drawing provides a rigid head and complete clothing/limb joins. A smooth six-pixel upper-body rise eases into unchanged shoe contacts; alternating 1.5-pixel vertical hand bops use a continuous spatial mapping, without cutout joints, crossfades or model-size changes. The full head translates without stretching. Forty-eight rendered frames at30fps form two gentle beats over1600ms; duplicate poses share atlas cells. Hip_Dance remains a separate active clip. This is a simple planted bounce, not a stepping or hip-sway routine. Scale v6: one fixed whole-character transform per clip, matched to the standing-idle median opaque head silhouette area. It includes eyes/mouth, so blinking does not change the scale estimate. No frame-specific scaling, head/body cuts, or pose-height normalization. Grounded contacts remain y592; flight clearance is transformed about the shared root. Pose projection, breathing and original drawing proportions remain intact.
