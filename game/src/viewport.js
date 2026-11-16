// The letterbox between the fixed 1280x720 playfield and the browser window: one scale and
// offset, shared by the renderer (to paint) and the input (to turn a pointer position into
// playfield coordinates).

import { FIELD } from './config.js';

export function createViewport(canvas) {
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function devicePixels() {
    return Math.min(window.devicePixelRatio || 1, 2);
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = devicePixels();
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    scale = Math.min(width / FIELD.width, height / FIELD.height) * dpr;
    offsetX = (canvas.width - FIELD.width * scale) / 2;
    offsetY = (canvas.height - FIELD.height * scale) / 2;
  }

  resize();
  window.addEventListener('resize', resize);

  return {
    /** Paint the playfield: call before drawing anything in logical coordinates. */
    apply(ctx) {
      ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    },
    /** Turn a client (mouse) position into playfield coordinates. */
    toLogical(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const dpr = devicePixels();
      return {
        x: ((clientX - rect.left) * dpr - offsetX) / scale,
        y: ((clientY - rect.top) * dpr - offsetY) / scale,
      };
    },
  };
}
