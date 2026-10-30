# Blowing_Whistle

Sparky blows a rainbow party whistle: the paper tube extends, holds its curled tip, and retracts in a repeating cycle.

## Resources

- Sheet: ./spritesheet-optimized-v1.png
- Timing and grid: ./animation.json
- Player: ../../player.js
- Integration instructions: ../../AGENT_INSTRUCTIONS.md

46 stored poses, 47 timed exposures, 8 columns, 6 rows. Cell: 512 × 640. Root: (256, 592). Duration: 2000 ms. Loop in game: true.

Read the frameDurationsMs array in JSON. For exposure i use cell=frameMap[i] (or i if absent); crop x=(cell%8)*512, y=Math.floor(cell/8)*640. Never play trailing empty cells. Preserve a constant scale and root.

## Browser usage

```js
import {SpriteSheetPlayer} from './player.js';
const player = await SpriteSheetPlayer.load(canvas, './animations/28-blowing-whistle/animation.json');
player.play();
// player.pause(); player.restart(); player.seekFrame(0); player.destroy();
```

The example paths assume code in the pack root. Adjust them to the game's served asset folder. Motion is contained in the sprite cells.

One intact generated Sparky blowing pose. Character, mouthpiece, grip, clothes and feet are byte-identical throughout. Only the paper tube beyond the glove changes length; its curled tip retains its original size. An eased unroll, short fully-open hold and smooth recoil are rendered at 30 fps. Paper stripes are revealed at original width, and the curled tip moves at subpixel precision instead of integer steps. The 2000 ms cycle is losslessly deduplicated for export. No audio is bundled. The character model is scaled once and normalized to the library reference before publishing. Scale v6: one fixed whole-character transform per clip, matched to the standing-idle median opaque head silhouette area. It includes eyes/mouth, so blinking does not change the scale estimate. No frame-specific scaling, head/body cuts, or pose-height normalization. Grounded contacts remain y592; flight clearance is transformed about the shared root. Pose projection, breathing and original drawing proportions remain intact.
