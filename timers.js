/** Gameplay time freezes while the game is paused, hidden, or portrait. Asset downloads do not. */
export class GameTimers {
  constructor() {
    this.pending = new Set();
    this.paused = false;
  }

  set(callback, delay) {
    const timer = { callback, remaining: delay, started: 0, id: null };
    this.pending.add(timer);
    if (!this.paused) this.start(timer);
    return timer;
  }

  start(timer) {
    timer.started = performance.now();
    timer.id = setTimeout(() => {
      this.pending.delete(timer);
      timer.callback();
    }, timer.remaining);
  }

  clear(timer) {
    if (!timer) return;
    clearTimeout(timer.id);
    this.pending.delete(timer);
  }

  clearAll() {
    for (const timer of this.pending) clearTimeout(timer.id);
    this.pending.clear();
  }

  setPaused(paused) {
    if (this.paused === paused) return;
    this.paused = paused;
    for (const timer of this.pending) {
      if (paused) {
        clearTimeout(timer.id);
        timer.remaining = Math.max(0, timer.remaining - (performance.now() - timer.started));
      } else {
        this.start(timer);
      }
    }
  }
}
