# Hip_Dance

A simple hands-on-hips dance with a gentle side-to-side hip sway and planted shoes.

## Resources

- Sheet: ./spritesheet-optimized-v1.png
- Timing and grid: ./animation.json
- Player: ../../player.js
- Integration instructions: ../../AGENT_INSTRUCTIONS.md

25 stored poses, 48 timed exposures, 6 columns, 5 rows. Cell: 512 × 640. Root: (256, 592). Duration: 1600 ms. Loop in game: true.

Read the frameDurationsMs array in JSON. For exposure i use cell=frameMap[i] (or i if absent); crop x=(cell%6)*512, y=Math.floor(cell/6)*640. Never play trailing empty cells. Preserve a constant scale and root.

## Browser usage

```js
import {SpriteSheetPlayer} from './player.js';
const player = await SpriteSheetPlayer.load(canvas, './animations/29-hip-dance/animation.json');
player.play();
// player.pause(); player.restart(); player.seekFrame(0); player.destroy();
```

The example paths assume code in the pack root. Adjust them to the game's served asset folder. Motion is contained in the sprite cells.

One intact whole-character drawing is rendered through a continuous smooth hip-sway mapping at 30 fps over 1600 ms. The pelvis moves twelve source pixels each way; the full head and collar band remain fixed. Motion tapers smoothly to zero above the shoes. The vertical map is continuous, with a subpixel settling motion. All pixels sample the original artwork once with premultiplied-alpha bilinear filtering. There are no separated arms, torso, shorts or leg layers, no crossfaded poses and no independently scaled frames. Forty-eight rendered frames are not forty-eight independently drawn poses. The generated pose sheet and rejected pose-switch sequence remain recoverable; stage 1 supplies the intact canonical art. Common scale normalization follows. Scale v6: one fixed whole-character transform per clip, matched to the standing-idle median opaque head silhouette area. It includes eyes/mouth, so blinking does not change the scale estimate. No frame-specific scaling, head/body cuts, or pose-height normalization. Grounded contacts remain y592; flight clearance is transformed about the shared root. Pose projection, breathing and original drawing proportions remain intact.
