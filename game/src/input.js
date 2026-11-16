// Keyboard and pointer input. Held keys give a steering vector; with no key held the wisp
// glides toward the pointer. One-shot presses (flare, pause, restart, mute, confirm) are
// queued as bit flags and taken once by the loop, so a press between two frames is never lost
// and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_FLARE = 2;
export const ACTION_PAUSE = 4;
export const ACTION_RESTART = 8;
export const ACTION_MUTE = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);

export function createInput(canvas, viewport) {
  const held = new Set();
  let actions = 0;
  let pointerX = 0;
  let pointerY = 0;
  let pointerSeen = false;
  let clicked = false;
  let clickX = 0;
  let clickY = 0;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (event.code === 'Space') {
      actions |= ACTION_FLARE;
      event.preventDefault();
    } else if (event.code === 'Enter') actions |= ACTION_CONFIRM;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'KeyR') actions |= ACTION_RESTART;
    else if (event.code === 'KeyM') actions |= ACTION_MUTE;
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
  });

  canvas.addEventListener('pointermove', (event) => {
    const point = viewport.toLogical(event.clientX, event.clientY);
    pointerX = point.x;
    pointerY = point.y;
    pointerSeen = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const point = viewport.toLogical(event.clientX, event.clientY);
    clickX = point.x;
    clickY = point.y;
    clicked = true;
    // A click confirms on a menu screen and fires a flare in play; the loop decides which.
    actions |= ACTION_CONFIRM | ACTION_FLARE;
  });

  return {
    /** Steering vector: keys first, else glide toward the pointer. */
    moveVector(playerX, playerY) {
      let x = 0;
      let y = 0;
      for (const code of held) {
        if (LEFT.has(code)) x -= 1;
        else if (RIGHT.has(code)) x += 1;
        else if (UP.has(code)) y -= 1;
        else if (DOWN.has(code)) y += 1;
      }
      if (x !== 0 || y !== 0) {
        const length = Math.hypot(x, y);
        return { x: x / length, y: y / length };
      }
      if (!pointerSeen) return { x: 0, y: 0 };
      const dx = pointerX - playerX;
      const dy = pointerY - playerY;
      const dist = Math.hypot(dx, dy);
      if (dist < 12) return { x: 0, y: 0 };
      const strength = Math.min(1, dist / 140);
      return { x: (dx / dist) * strength, y: (dy / dist) * strength };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The last click's playfield position, once; null when there was none. */
    takeClick() {
      if (!clicked) return null;
      clicked = false;
      return { x: clickX, y: clickY };
    },
  };
}
