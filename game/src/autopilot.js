// The pilot that plays the game for the screenshots: it steers toward the nearest shard (or
// the open gate), leans away from shades and thorns, and spends a flare when one gets too
// close. A reckless twin chases shards and ignores danger, for the game-over shot.

import { BRAMBLE, FIELD, PLAYER, SHADE } from './config.js';
import { KIND_HUNTER } from './world.js';

export function createAutopilot(mode) {
  const reckless = mode === 'reckless';
  return {
    decide(state) {
      const p = state.player;
      let targetX;
      let targetY;
      if (state.gate.open) {
        targetX = state.gate.x;
        targetY = state.gate.y;
      } else {
        // Nearest shard; a bloom nearby is worth the detour.
        let best = null;
        let bestD = Infinity;
        for (const s of state.shards) {
          if (!s.active) continue;
          const d = (s.x - p.x) ** 2 + (s.y - p.y) ** 2;
          if (d < bestD) {
            bestD = d;
            best = s;
          }
        }
        for (const pickup of state.pickups) {
          if (!pickup.active) continue;
          const d = (pickup.x - p.x) ** 2 + (pickup.y - p.y) ** 2;
          if (d < 200 * 200 && d < bestD) {
            bestD = d;
            best = pickup;
          }
        }
        if (best) {
          targetX = best.x;
          targetY = best.y;
        } else {
          targetX = FIELD.width / 2;
          targetY = FIELD.height / 2;
        }
      }
      let mx = targetX - p.x;
      let my = targetY - p.y;
      const targetLen = Math.hypot(mx, my) || 1;
      mx /= targetLen;
      my /= targetLen;

      let flare = false;
      if (!reckless) {
        // Lean away from every near shade and thorn.
        for (const s of state.shades) {
          if (!s.active) continue;
          const dx = p.x - s.x;
          const dy = p.y - s.y;
          const d = Math.hypot(dx, dy) || 1;
          const radius = s.kind === KIND_HUNTER ? SHADE.hunter.radius : SHADE.drifter.radius;
          if (d < 170) {
            const weight = ((170 - d) / 170) * 2.2;
            mx += (dx / d) * weight;
            my += (dy / d) * weight;
          }
          if (d < radius + PLAYER.radius + 26 && p.flares > 0) flare = true;
        }
        for (const b of state.brambles) {
          if (!b.active) continue;
          const dx = p.x - b.x;
          const dy = p.y - b.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < 110) {
            const weight = ((110 - d) / 110) * 1.8;
            mx += (dx / d) * weight;
            my += (dy / d) * weight;
          }
        }
        // Keep off the walls.
        const margin = 70;
        if (p.x < margin) mx += (margin - p.x) / margin;
        if (p.x > FIELD.width - margin) mx -= (p.x - (FIELD.width - margin)) / margin;
        if (p.y < margin) my += (margin - p.y) / margin;
        if (p.y > FIELD.height - margin) my -= (p.y - (FIELD.height - margin)) / margin;
      }

      const len = Math.hypot(mx, my) || 1;
      return { mx: mx / len, my: my / len, flare };
    },
  };
}
