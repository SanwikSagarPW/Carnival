# Sequence/4/Sleep

Sleep on the side while a translucent nose bubble gently inflates and deflates with each breath.

## Resources

- Sheet: ./spritesheet-optimized-v1.png
- Timing and grid: ./animation.json
- Player: ../../player.js
- Integration instructions: ../../AGENT_INSTRUCTIONS.md

41 stored poses, 80 timed exposures, 8 columns, 6 rows. Cell: 512 × 640. Root: (256, 592). Duration: 3200 ms. Loop in game: true.

Read the frameDurationsMs array in JSON. For exposure i use cell=frameMap[i] (or i if absent); crop x=(cell%8)*512, y=Math.floor(cell/8)*640. Never play trailing empty cells. Preserve a constant scale and root.

## Browser usage

```js
import {SpriteSheetPlayer} from './player.js';
const player = await SpriteSheetPlayer.load(canvas, './animations/24-sequence-4-sleep/animation.json');
player.play();
// player.pause(); player.restart(); player.seekFrame(0); player.destroy();
```

The example paths assume code in the pack root. Adjust them to the game's served asset folder. Motion is contained in the sprite cells.

Existing 80 breathing drawings and 40 ms exposures are preserved. A native SVG teardrop bubble is attached at nose (213,475), with a cosine-eased radius of 8–22 px over the same seamless 3200 ms cycle. It is baked into the RGBA cells, so any sprite player can use it without extra runtime effects. Character pixels outside the bubble remain unchanged. Source and vector artwork are preserved. Scale v6: one fixed whole-character transform per clip, matched to the standing-idle median opaque head silhouette area. It includes eyes/mouth, so blinking does not change the scale estimate. No frame-specific scaling, head/body cuts, or pose-height normalization. Grounded contacts remain y592; flight clearance is transformed about the shared root. Pose projection, breathing and original drawing proportions remain intact.
