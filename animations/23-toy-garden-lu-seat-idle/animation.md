# Toy_Garden/Lu_Seat_Idle

Sit cross-legged with visible gentle chest breathing and a small head-and-shoulder rise.

## Resources

- Sheet: ./spritesheet-optimized-v1.png
- Timing and grid: ./animation.json
- Player: ../../player.js
- Integration instructions: ../../AGENT_INSTRUCTIONS.md

36 stored poses, 70 timed exposures, 7 columns, 6 rows. Cell: 512 × 640. Root: (256, 592). Duration: 2800 ms. Loop in game: true.

Read the frameDurationsMs array in JSON. For exposure i use cell=frameMap[i] (or i if absent); crop x=(cell%7)*512, y=Math.floor(cell/7)*640. Never play trailing empty cells. Preserve a constant scale and root.

## Browser usage

```js
import {SpriteSheetPlayer} from './player.js';
const player = await SpriteSheetPlayer.load(canvas, './animations/23-toy-garden-lu-seat-idle/animation.json');
player.play();
// player.pause(); player.restart(); player.seekFrame(0); player.destroy();
```

The example paths assume code in the pack root. Adjust them to the game's served asset folder. Motion is contained in the sprite cells.

One complete canonical seated drawing sampled through a continuous C1 vertical breathing map. Head and shoulders rise 3.8 px; chest smoothly stretches toward fixed hips. Rows y535 onward are byte-identical, preserving hands, knees, seat and shoes. No separated body layers or neck/waist cuts. 70 frames at 40 ms form a seamless 2800 ms breath. The old weak chest-only breathing is replaced, not layered twice. Scale v6: one fixed whole-character transform per clip, matched to the standing-idle median opaque head silhouette area. It includes eyes/mouth, so blinking does not change the scale estimate. No frame-specific scaling, head/body cuts, or pose-height normalization. Grounded contacts remain y592; flight clearance is transformed about the shared root. Pose projection, breathing and original drawing proportions remain intact.
