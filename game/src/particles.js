// A pooled particle system: sparks, trails, bursts and shockwave rings. Nothing allocates
// after boot; the main loop feeds it events (pickups, hits, flares) and it paints itself
// additively, so everything glows against the dark.

const MAX = 420;

export function createParticles() {
  const pool = [];
  for (let index = 0; index < MAX; index += 1) {
    pool.push({
      active: false, ring: false,
      x: 0, y: 0, vx: 0, vy: 0,
      life: 0, maxLife: 1, size: 2, grow: 0, color: '#ffffff', drag: 0.92,
    });
  }
  let cursor = 0;

  function spawn(x, y, vx, vy, life, size, color, drag, ring, grow) {
    const p = pool[cursor];
    cursor = (cursor + 1) % MAX;
    p.active = true;
    p.ring = ring;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.grow = grow;
    p.color = color;
    p.drag = drag;
  }

  return {
    /** A spray of sparks: pickups, hits, a shade burning out. */
    burst(x, y, color, count = 14, speed = 220) {
      for (let index = 0; index < count; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const s = speed * (0.3 + Math.random() * 0.7);
        spawn(x, y, Math.cos(angle) * s, Math.sin(angle) * s, 0.4 + Math.random() * 0.4, 2 + Math.random() * 3, color, 0.92, false, 0);
      }
    },
    /** An expanding ring: the flare's shockwave. */
    ring(x, y, color, radius = 205) {
      spawn(x, y, 0, 0, 0.45, 10, color, 1, true, radius / 0.45);
    },
    /** The wisp's fading trail, one mote at a time. */
    trail(x, y, color) {
      spawn(x, y, (Math.random() - 0.5) * 24, (Math.random() - 0.5) * 24, 0.35, 2.5, color, 0.9, false, 0);
    },
    /** A mote drifting up off a shard or the gate. */
    sparkle(x, y, color) {
      spawn(x, y, (Math.random() - 0.5) * 12, -18 - Math.random() * 14, 0.7, 2, color, 0.98, false, 0);
    },
    update(dt) {
      for (const p of pool) {
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          continue;
        }
        const drag = Math.pow(p.drag, dt * 60);
        p.vx *= drag;
        p.vy *= drag;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    },
    draw(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of pool) {
        if (!p.active) continue;
        const alpha = Math.max(0, p.life / p.maxLife);
        if (p.ring) {
          const radius = p.size + p.grow * (p.maxLife - p.life);
          ctx.globalAlpha = alpha * 0.8;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3 + 3 * alpha;
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.4, p.size * alpha), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    },
    clear() {
      for (const p of pool) p.active = false;
    },
  };
}
