/** Canvas sprite-sheet player. Uses real elapsed time and per-frame exposures. */
export class SpriteSheetPlayer {
  static async load(canvas, metadataURL, options = {}) {
    const url = new URL(metadataURL, document.baseURI);
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Animation data: HTTP ${response.status}`);
    const data = await response.json();
    validate(data);
    const image = new Image();
    const imageURL = new URL(data.sheet, response.url || url);
    if (data.assetRevision) imageURL.searchParams.set("revision", data.assetRevision);
    image.src = imageURL.href;
    await image.decode();
    if (image.naturalWidth !== data.sheetWidth || image.naturalHeight !== data.sheetHeight) {
      throw new Error("Sprite-sheet dimensions do not match animation.json.");
    }
    // A newer character pose may have been requested while these assets loaded.
    // Check before constructing the player, since construction draws to the canvas.
    if (options.isCurrent && !options.isCurrent()) return null;
    return new SpriteSheetPlayer(canvas, image, data, options);
  }

  constructor(canvas, image, data, options = {}) {
    validate(data);
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    if (!this.context) throw new Error("A 2D canvas is required.");
    this.image = image;
    this.data = data;
    this.loop = options.loop ?? data.loop;
    this.elapsedMs = 0;
    this.breathingMs = 0;
    this.resting = false;
    this.currentFrame = -1;
    this.playing = false;
    this.destroyed = false;
    this.request = null;
    this.previousTime = null;
    this.setSpeed(options.speed ?? 1);
    this.canvas.width = data.cellWidth;
    this.canvas.height = data.cellHeight;
    this.context.imageSmoothingEnabled = true;
    this.context.imageSmoothingQuality = "high";
    this.tick = this.tick.bind(this);
    this.draw(0);
  }

  play() {
    if (this.destroyed) throw new Error("Player has been destroyed.");
    if (this.playing) return;
    if (this.request !== null) cancelAnimationFrame(this.request);
    this.resting = false;
    if (this.elapsedMs >= this.data.durationMs) this.elapsedMs = 0;
    this.playing = true;
    this.previousTime = null;
    this.request = requestAnimationFrame(this.tick);
  }

  pause() {
    this.playing = false;
    this.resting = false;
    this.previousTime = null;
    if (this.request !== null) cancelAnimationFrame(this.request);
    this.request = null;
  }

  restart() {
    this.pause();
    this.elapsedMs = 0;
    this.breathingMs = 0;
    this.draw(0);
    this.play();
  }

  seekFrame(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.data.frameCount) {
      throw new RangeError("Frame index is outside the animation.");
    }
    this.pause();
    this.elapsedMs = this.data.frameDurationsMs.slice(0, index).reduce((a, b) => a + b, 0);
    this.breathingMs = this.elapsedMs;
    this.draw(index);
  }

  setSpeed(speed) {
    if (!Number.isFinite(speed) || speed <= 0) throw new RangeError("Speed must be positive.");
    this.speed = speed;
  }

  destroy() {
    this.pause();
    this.destroyed = true;
  }

  tick(now) {
    if (!this.playing && !this.resting) return;
    this.request = null;
    const delta = this.previousTime === null ? 0 : (now - this.previousTime) * this.speed;
    if (this.playing) this.elapsedMs += delta;
    this.breathingMs += delta;
    this.previousTime = now;
    if (this.resting) {
      this.draw(this.data.frameCount - 1);
      this.request = requestAnimationFrame(this.tick);
      return;
    }
    const total = this.data.durationMs;
    if (this.elapsedMs >= total) {
      if (this.loop) this.elapsedMs %= total;
      else {
        this.elapsedMs = total;
        this.draw(this.data.frameCount - 1);
        if (this.data.breathEffect?.enabled) {
          this.playing = false;
          this.resting = true;
          this.request = requestAnimationFrame(this.tick);
        } else this.pause();
        return;
      }
    }
    let end = 0;
    for (let i = 0; i < this.data.frameCount; i++) {
      end += this.data.frameDurationsMs[i];
      if (this.elapsedMs < end) { this.draw(i); break; }
    }
    this.request = requestAnimationFrame(this.tick);
  }

  draw(index) {
    if (index === this.currentFrame && !this.data.breathEffect?.enabled) return;
    const { columns, cellWidth: w, cellHeight: h } = this.data;
    this.context.clearRect(0, 0, w, h);
    const cell=this.data.frameMap?.[index] ?? index;
    drawBreathingFrame(this.context, this.image,
      (cell % columns) * w, Math.floor(cell / columns) * h, w, h,
      this.data.breathEffect, this.breathingMs, index);
    this.currentFrame = index;
  }
}

/** One continuous vertical mapping: rigid upper body, smooth chest stretch, fixed contacts. */
export function drawBreathingFrame(ctx, image, sx, sy, w, h, effect, timeMs, index = 0) {
  if (!effect?.enabled) { ctx.drawImage(image, sx, sy, w, h, 0, 0, w, h); return; }
  const pose = effect.poses[index] || effect.poses[0];
  const { upperY, fixedY } = pose;
  const lift = effect.amplitudePx * (1 - Math.cos(2 * Math.PI * timeMs / effect.periodMs)) / 2;
  const map = y => {
    const t = Math.max(0, Math.min(1, (y - upperY) / (fixedY - upperY)));
    return y - lift * (1 - t * t * (3 - 2 * t));
  };
  ctx.drawImage(image, sx, sy, w, upperY, 0, -lift, w, upperY);
  // Shared mapped boundaries keep the collar and waist connected; no independent part layers.
  const count = 20;
  for (let k = 0; k < count; k++) {
    const a = upperY + (fixedY - upperY) * k / count;
    const b = upperY + (fixedY - upperY) * (k + 1) / count;
    ctx.drawImage(image, sx, sy + a, w, b - a, 0, map(a), w, map(b) - map(a));
  }
  ctx.drawImage(image, sx, sy + fixedY, w, h - fixedY, 0, fixedY, w, h - fixedY);
}

function validate(data) {
  if (data.schemaVersion !== 1 || typeof data.sheet !== "string" || !data.sheet) {
    throw new Error("Unsupported animation metadata.");
  }
  const integers = [data.columns, data.rows, data.cellWidth, data.cellHeight,
    data.sheetWidth, data.sheetHeight, data.frameCount];
  if (!integers.every(n => Number.isInteger(n) && n > 0)
      || (!data.frameMap && data.frameCount > data.columns * data.rows)
      || data.sheetWidth !== data.columns * data.cellWidth
      || data.sheetHeight !== data.rows * data.cellHeight) {
    throw new Error("Invalid sprite-sheet grid.");
  }
  if (!Array.isArray(data.frameDurationsMs)
      || data.frameDurationsMs.length !== data.frameCount
      || data.frameDurationsMs.some(n => !Number.isFinite(n) || n <= 0)
      || typeof data.loop !== "boolean") throw new Error("Invalid frame timing or loop setting.");
  if(data.frameMap && (!Array.isArray(data.frameMap)||data.frameMap.length!==data.frameCount
      ||data.frameMap.some(i=>!Number.isInteger(i)||i<0||i>=(data.atlasFrameCount||data.columns*data.rows))
      ||!Number.isInteger(data.atlasFrameCount)||data.atlasFrameCount<1||data.atlasFrameCount>data.columns*data.rows))throw new Error("Invalid atlas frame map.");
  const total = data.frameDurationsMs.reduce((a, b) => a + b, 0);
  if (!Number.isFinite(total) || !Number.isFinite(data.durationMs)
      || Math.abs(total - data.durationMs) > 0.001) throw new Error("Duration does not match frame holds.");
  const b = data.breathEffect;
  if (b?.enabled && (!Number.isFinite(b.amplitudePx) || b.amplitudePx < 0 || b.amplitudePx > 8
      || !Number.isFinite(b.periodMs) || b.periodMs <= 0 || !Array.isArray(b.poses)
      || b.poses.length !== data.frameCount || b.poses.some(p => !Number.isFinite(p.upperY)
        || !Number.isFinite(p.fixedY) || p.upperY <= 0 || p.fixedY <= p.upperY || p.fixedY >= data.cellHeight))) {
    throw new Error("Invalid breathing parameters.");
  }
}
