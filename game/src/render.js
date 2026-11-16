// Everything the eye sees: the dark Hollow, the wisp's light, the shades, the HUD and every
// screen. Drawing only — it never changes the world. The playfield is painted in logical
// 1280x720 coordinates through the viewport, so the picture is the same at any window size.

import {
  BLOOM, BRAMBLE, FIELD, FLARE, FLARE_PICKUP, FONT, GATE, LIGHT, PALETTE, PLAYER, SHADE, SHARD,
  ZONES, ZONE_TINTS,
} from './config.js';
import { KIND_HUNTER } from './world.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;
export const SCREEN_WIN = 4;

/** The two clickable HUD buttons, bottom right; the loop hit-tests against these rects. */
export const PAUSE_BUTTON = { x: FIELD.width - 104, y: FIELD.height - 52, w: 40, h: 40 };
export const MUTE_BUTTON = { x: FIELD.width - 56, y: FIELD.height - 52, w: 40, h: 40 };

// Rock silhouettes that frame the Hollow, fixed so every zone feels like one cave.
const ROCKS = [
  { x: 60, y: 40, rx: 190, ry: 90 },
  { x: 1220, y: 30, rx: 210, ry: 100 },
  { x: 40, y: 690, rx: 220, ry: 80 },
  { x: 1240, y: 700, rx: 200, ry: 90 },
  { x: 640, y: -30, rx: 320, ry: 70 },
  { x: 640, y: 750, rx: 340, ry: 70 },
  { x: 1180, y: 360, rx: 90, ry: 220 },
  { x: 100, y: 360, rx: 80, ry: 200 },
];

function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function formatNumber(n) {
  return n.toLocaleString('en-US');
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function createRenderer(canvas, viewport) {
  const ctx = canvas.getContext('2d');

  // The darkness is painted on its own canvas, then holes are punched where the light is.
  const dark = document.createElement('canvas');
  dark.width = FIELD.width;
  dark.height = FIELD.height;
  const dctx = dark.getContext('2d');

  const fireflies = [];
  for (let index = 0; index < 42; index += 1) {
    fireflies.push({
      x: hash(index) * FIELD.width,
      y: hash(index + 100) * FIELD.height,
      r: 1 + hash(index + 200) * 1.6,
      speed: 0.2 + hash(index + 300) * 0.5,
      phase: hash(index + 400) * Math.PI * 2,
    });
  }

  function drawBackdrop(zoneIndex, now) {
    const tint = ZONE_TINTS[zoneIndex];
    const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, tint);
    gradient.addColorStop(0.55, '#0b0918');
    gradient.addColorStop(1, PALETTE.backdrop);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Distant pools of glow, breathing slowly.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let index = 0; index < 4; index += 1) {
      const x = 200 + hash(index + 50) * (FIELD.width - 400);
      const y = 140 + hash(index + 60) * (FIELD.height - 280);
      const radius = 150 + 60 * Math.sin(now * 0.3 + index * 2);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
      glow.addColorStop(0, index % 2 ? 'rgba(111, 227, 193, 0.05)' : 'rgba(255, 157, 92, 0.05)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Rock silhouettes around the edge.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    for (const rock of ROCKS) {
      ctx.beginPath();
      ctx.ellipse(rock.x, rock.y, rock.rx, rock.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function punchHole(x, y, radius, strength) {
    const glow = dctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
    glow.addColorStop(0.55, `rgba(0, 0, 0, ${strength * 0.6})`);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    dctx.fillStyle = glow;
    dctx.beginPath();
    dctx.arc(x, y, radius, 0, Math.PI * 2);
    dctx.fill();
  }

  function drawDarkness(state) {
    dctx.save();
    dctx.globalCompositeOperation = 'source-over';
    dctx.clearRect(0, 0, FIELD.width, FIELD.height);
    dctx.fillStyle = 'rgba(3, 2, 10, 0.88)';
    dctx.fillRect(0, 0, FIELD.width, FIELD.height);
    dctx.globalCompositeOperation = 'destination-out';
    const p = state.player;
    punchHole(p.x, p.y, 240, 1);
    for (const s of state.shards) if (s.active) punchHole(s.x, s.y, 64, 0.85);
    for (const p2 of state.pickups) if (p2.active) punchHole(p2.x, p2.y, 88, 0.9);
    punchHole(state.gate.x, state.gate.y, state.gate.open ? 150 : 70, state.gate.open ? 0.95 : 0.6);
    dctx.restore();
    ctx.drawImage(dark, 0, 0, FIELD.width, FIELD.height);
  }

  function drawGate(state, now) {
    const gate = state.gate;
    const pulse = 1 + 0.05 * Math.sin(now * 2.4);
    ctx.save();
    ctx.translate(gate.x, gate.y);
    if (gate.open) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, GATE.radius * 2.2);
      glow.addColorStop(0, 'rgba(111, 227, 193, 0.5)');
      glow.addColorStop(1, 'rgba(111, 227, 193, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, GATE.radius * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      const inner = ctx.createRadialGradient(0, 0, 0, 0, 0, GATE.radius);
      inner.addColorStop(0, 'rgba(255, 249, 220, 0.95)');
      inner.addColorStop(0.6, 'rgba(111, 227, 193, 0.75)');
      inner.addColorStop(1, 'rgba(111, 227, 193, 0.15)');
      ctx.fillStyle = inner;
      ctx.beginPath();
      ctx.arc(0, 0, GATE.radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PALETTE.teal;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, GATE.radius * pulse, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(155, 147, 184, 0.75)';
      ctx.lineWidth = 5;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, GATE.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(155, 147, 184, 0.5)';
      ctx.font = `600 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('SEALED', 0, GATE.radius + 22);
    }
    ctx.restore();
  }

  function drawShards(state) {
    for (const s of state.shards) {
      if (!s.active) continue;
      const scale = 1 + 0.14 * Math.sin(s.phase);
      const size = SHARD.radius * scale;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(Math.PI / 4);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2.4);
      glow.addColorStop(0, 'rgba(255, 217, 122, 0.55)');
      glow.addColorStop(1, 'rgba(255, 217, 122, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, size * 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(-size / 5, -size / 5, size * 0.4, size * 0.4);
      ctx.restore();
    }
  }

  function drawPickups(state, now) {
    for (const p of state.pickups) {
      if (!p.active) continue;
      const bob = Math.sin(p.phase) * 3;
      ctx.save();
      ctx.translate(p.x, p.y + bob);
      if (p.kind === 0) {
        // A star-bloom: five petals around a bright heart.
        for (let petal = 0; petal < 5; petal += 1) {
          const angle = (petal / 5) * Math.PI * 2 + now * 0.6;
          ctx.fillStyle = '#ff8fb0';
          ctx.beginPath();
          ctx.arc(Math.cos(angle) * 9, Math.sin(angle) * 9, 7, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#fff3c4';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // A spare flare: a little bottled sun.
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
        glow.addColorStop(0, 'rgba(255, 157, 92, 0.7)');
        glow.addColorStop(1, 'rgba(255, 157, 92, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = PALETTE.ember;
        ctx.beginPath();
        ctx.arc(0, 0, FLARE_PICKUP.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff3c4';
        ctx.beginPath();
        ctx.arc(0, -2, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawBrambles(state) {
    for (const b of state.brambles) {
      if (!b.active) continue;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(Math.sin(b.phase) * 0.1);
      ctx.fillStyle = PALETTE.bramble;
      ctx.beginPath();
      for (let spike = 0; spike < 8; spike += 1) {
        const angle = (spike / 8) * Math.PI * 2;
        const next = ((spike + 0.5) / 8) * Math.PI * 2;
        const tipX = Math.cos(angle) * BRAMBLE.radius;
        const tipY = Math.sin(angle) * BRAMBLE.radius;
        const baseX = Math.cos(next) * BRAMBLE.radius * 0.55;
        const baseY = Math.sin(next) * BRAMBLE.radius * 0.55;
        if (spike === 0) ctx.moveTo(tipX, tipY);
        else ctx.lineTo(tipX, tipY);
        ctx.lineTo(baseX, baseY);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#8e5aa8';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawShades(state, now) {
    for (const s of state.shades) {
      if (!s.active) continue;
      const spec = s.kind === KIND_HUNTER ? SHADE.hunter : SHADE.drifter;
      const wobble = 1 + 0.06 * Math.sin(now * 5 + s.x);
      ctx.save();
      ctx.translate(s.x, s.y);
      const body = ctx.createRadialGradient(-4, -5, 2, 0, 0, spec.radius * 1.4);
      body.addColorStop(0, s.kind === KIND_HUNTER ? '#5c2f4e' : '#4a3566');
      body.addColorStop(1, 'rgba(20, 12, 34, 0.95)');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(0, 0, spec.radius * wobble, 0, Math.PI * 2);
      ctx.fill();
      if (s.kind === KIND_HUNTER) {
        // Horns mark the hunter: faster, and it comes straight for the wisp.
        ctx.fillStyle = '#5c2f4e';
        ctx.beginPath();
        ctx.moveTo(-spec.radius * 0.55, -spec.radius * 0.6);
        ctx.lineTo(-spec.radius * 0.85, -spec.radius * 1.25);
        ctx.lineTo(-spec.radius * 0.15, -spec.radius * 0.85);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(spec.radius * 0.55, -spec.radius * 0.6);
        ctx.lineTo(spec.radius * 0.85, -spec.radius * 1.25);
        ctx.lineTo(spec.radius * 0.15, -spec.radius * 0.85);
        ctx.closePath();
        ctx.fill();
      }
      // Two glowing eyes, looking toward the wisp.
      const dx = state.player.x - s.x;
      const dy = state.player.y - s.y;
      const d = Math.hypot(dx, dy) || 1;
      const lookX = (dx / d) * 3;
      const lookY = (dy / d) * 3;
      ctx.fillStyle = PALETTE.shadeEye;
      ctx.shadowColor = PALETTE.shadeEye;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(-5 + lookX, -2 + lookY, 2.6, 0, Math.PI * 2);
      ctx.arc(5 + lookX, -2 + lookY, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPlayer(state, now) {
    const p = state.player;
    // A hit wisp blinks while it is invulnerable.
    if (p.invulnerable > 0 && Math.floor(now * 12) % 2 === 0) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 90);
    halo.addColorStop(0, 'rgba(255, 233, 168, 0.55)');
    halo.addColorStop(0.4, 'rgba(255, 200, 110, 0.22)');
    halo.addColorStop(1, 'rgba(255, 200, 110, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const body = ctx.createRadialGradient(-4, -5, 1, 0, 0, PLAYER.radius + 2);
    body.addColorStop(0, '#fffbe8');
    body.addColorStop(0.55, PALETTE.wisp);
    body.addColorStop(1, '#ffb85c');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER.radius, 0, Math.PI * 2);
    ctx.fill();
    // Two little eyes, looking where the wisp is headed.
    const speed = Math.hypot(p.vx, p.vy);
    const lookX = speed > 20 ? (p.vx / speed) * 3.5 : 0;
    const lookY = speed > 20 ? (p.vy / speed) * 3.5 : 0;
    ctx.fillStyle = '#2a1a33';
    ctx.beginPath();
    ctx.arc(-5 + lookX, -2 + lookY, 2.4, 0, Math.PI * 2);
    ctx.arc(5 + lookX, -2 + lookY, 2.4, 0, Math.PI * 2);
    ctx.fill();
    if (p.invulnerable > 0) {
      ctx.strokeStyle = 'rgba(255, 233, 168, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, PLAYER.radius + 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFireflies(now) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of fireflies) {
      const x = f.x + Math.sin(now * f.speed + f.phase) * 14;
      const y = f.y + Math.cos(now * f.speed * 0.8 + f.phase) * 10;
      const twinkle = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(now * 1.4 + f.phase * 3));
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(x, y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawButton(rect, drawIcon) {
    ctx.save();
    ctx.fillStyle = 'rgba(12, 10, 26, 0.7)';
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 9);
    ctx.fill();
    ctx.stroke();
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    drawIcon();
    ctx.restore();
  }

  function drawHud(state, best, muted) {
    const p = state.player;
    const zone = ZONES[state.zone];
    const lowLight = p.light < 25;

    // Light meter, top left.
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = lowLight ? PALETTE.danger : PALETTE.gold;
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText('LIGHT', 24, 30);
    roundRect(ctx, 24, 38, 240, 18, 9);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
    const fillW = 236 * Math.max(0, p.light / LIGHT.max);
    if (fillW > 0) {
      const gradient = ctx.createLinearGradient(26, 0, 262, 0);
      gradient.addColorStop(0, lowLight ? '#ff5d73' : '#ffb85c');
      gradient.addColorStop(1, lowLight ? '#ff8f5c' : '#ffe9a8');
      ctx.fillStyle = gradient;
      roundRect(ctx, 26, 40, fillW, 14, 7);
      ctx.fill();
    }
    // Flares beneath the meter.
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `700 12px ${FONT}`;
    ctx.fillText('FLARES', 24, 78);
    for (let index = 0; index < FLARE.max; index += 1) {
      ctx.fillStyle = index < p.flares ? PALETTE.ember : 'rgba(155, 147, 184, 0.3)';
      ctx.beginPath();
      ctx.arc(92 + index * 22, 73, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Zone and shard progress, top centre.
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 15px ${FONT}`;
    ctx.fillText(`ZONE ${state.zone + 1} · ${zone.name.toUpperCase()}`, FIELD.width / 2, 30);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `600 14px ${FONT}`;
    let pips = '';
    for (let index = 0; index < zone.shardGoal; index += 1) {
      pips += index < state.shardsGot ? '◆ ' : '◇ ';
    }
    ctx.fillText(`${pips} ${state.shardsGot}/${zone.shardGoal} SHARDS`, FIELD.width / 2, 52);
    if (state.gate.open) {
      ctx.fillStyle = PALETTE.teal;
      ctx.font = `700 13px ${FONT}`;
      ctx.fillText('THE GATE IS OPEN — GO!', FIELD.width / 2, 72);
    }

    // Score, top right.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText(formatNumber(state.score), FIELD.width - 24, 38);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText(`BEST ${formatNumber(Math.max(best, state.score))}`, FIELD.width - 24, 56);
    if (state.mult > 1) {
      ctx.fillStyle = PALETTE.ember;
      ctx.font = `800 16px ${FONT}`;
      ctx.fillText(`COMBO x${state.mult}`, FIELD.width - 24, 78);
    }
    ctx.restore();

    // Controls hint, bottom left; buttons, bottom right.
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(155, 147, 184, 0.8)';
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText('WASD / ARROWS or MOUSE to glide  ·  SPACE / CLICK to flare  ·  P to pause  ·  M to mute', 24, FIELD.height - 26);
    ctx.restore();

    drawButton(PAUSE_BUTTON, () => {
      ctx.fillStyle = PALETTE.text;
      ctx.fillRect(-7, -8, 5, 16);
      ctx.fillRect(2, -8, 5, 16);
    });
    drawButton(MUTE_BUTTON, () => {
      ctx.fillStyle = PALETTE.text;
      ctx.beginPath();
      ctx.moveTo(-9, -3);
      ctx.lineTo(-3, -3);
      ctx.lineTo(3, -8);
      ctx.lineTo(3, 8);
      ctx.lineTo(-3, 3);
      ctx.lineTo(-9, 3);
      ctx.closePath();
      ctx.fill();
      if (muted) {
        ctx.strokeStyle = PALETTE.danger;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(6, -6);
        ctx.lineTo(11, 6);
        ctx.moveTo(11, -6);
        ctx.lineTo(6, 6);
        ctx.stroke();
      } else {
        ctx.strokeStyle = PALETTE.text;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(4, 0, 6, -0.9, 0.9);
        ctx.stroke();
      }
    });
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, 18);
    ctx.fill();
    ctx.stroke();
  }

  function drawTitle(state, best) {
    ctx.save();
    ctx.fillStyle = 'rgba(4, 3, 12, 0.45)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(255, 217, 122, 0.8)';
    ctx.shadowBlur = 34;
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `800 84px ${FONT}`;
    ctx.fillText('WISPKEEPER', FIELD.width / 2, 218);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 26px ${FONT}`;
    ctx.fillText('Light the Hollow', FIELD.width / 2, 258);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `500 16px ${FONT}`;
    ctx.fillText('Your light is your life. Gather shards, dodge the shades,', FIELD.width / 2, 296);
    ctx.fillText('open the gate — and carry the last light home through five zones.', FIELD.width / 2, 320);

    panel(FIELD.width / 2 - 300, 356, 600, 118);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 17px ${FONT}`;
    ctx.fillText('WASD / ARROWS or MOUSE  —  glide', FIELD.width / 2, 392);
    ctx.fillText('SPACE / CLICK  —  flare (burns near shades away)', FIELD.width / 2, 420);
    ctx.fillText('P  —  pause      M  —  sound      R  —  restart', FIELD.width / 2, 448);

    const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 300);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `800 22px ${FONT}`;
    ctx.fillText('PRESS SPACE OR CLICK TO BEGIN', FIELD.width / 2, 530);
    ctx.globalAlpha = 1;
    if (best > 0) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 15px ${FONT}`;
      ctx.fillText(`BEST SCORE  ${formatNumber(best)}`, FIELD.width / 2, 562);
    }
    ctx.fillStyle = 'rgba(155, 147, 184, 0.7)';
    ctx.font = `500 12px ${FONT}`;
    ctx.fillText('An original game made for make.fun', FIELD.width / 2, FIELD.height - 24);
    ctx.restore();
  }

  function drawPaused() {
    ctx.save();
    ctx.fillStyle = 'rgba(4, 3, 12, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(FIELD.width / 2 - 260, 240, 520, 220);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText('PAUSED', FIELD.width / 2, 300);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `500 16px ${FONT}`;
    ctx.fillText('The Hollow waits for no wisp — but it waits for you.', FIELD.width / 2, 334);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `700 18px ${FONT}`;
    ctx.fillText('P / ESC / CLICK  —  resume        R  —  restart', FIELD.width / 2, 386);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `500 14px ${FONT}`;
    ctx.fillText('WASD / mouse to glide · SPACE / click to flare · M to mute', FIELD.width / 2, 420);
    ctx.restore();
  }

  function drawStats(state, best, y) {
    const rows = [
      ['SCORE', formatNumber(state.score)],
      ['BEST', formatNumber(Math.max(best, state.score))],
      ['ZONE REACHED', `${state.zone + 1} of ${ZONES.length} · ${ZONES[state.zone].name}`],
      ['SHARDS GATHERED', String(state.shardsTotal)],
      ['SHADES BURNED', String(state.shadesDown)],
      ['TIME', formatTime(state.elapsed)],
    ];
    ctx.font = `600 17px ${FONT}`;
    rows.forEach(([label, value], index) => {
      const rowY = y + index * 30;
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText(label, FIELD.width / 2 - 190, rowY);
      ctx.textAlign = 'right';
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(value, FIELD.width / 2 + 190, rowY);
    });
  }

  function drawOver(state, best) {
    ctx.save();
    ctx.fillStyle = 'rgba(4, 3, 12, 0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.danger;
    ctx.font = `800 52px ${FONT}`;
    ctx.fillText('THE LIGHT FADES', FIELD.width / 2, 168);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `500 17px ${FONT}`;
    ctx.fillText('The Hollow keeps its dark — this time.', FIELD.width / 2, 202);
    panel(FIELD.width / 2 - 250, 232, 500, 220);
    drawStats(state, best, 272);
    const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 300);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `800 20px ${FONT}`;
    ctx.fillText('PRESS SPACE OR CLICK TO TRY AGAIN', FIELD.width / 2, 500);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawWin(state, best) {
    ctx.save();
    ctx.fillStyle = 'rgba(4, 3, 12, 0.5)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(255, 233, 168, 0.9)';
    ctx.shadowBlur = 30;
    ctx.fillStyle = PALETTE.wisp;
    ctx.font = `800 52px ${FONT}`;
    ctx.fillText('DAWN BREAKS', FIELD.width / 2, 168);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `500 17px ${FONT}`;
    ctx.fillText('You carried the last light home. The Hollow wakes in gold.', FIELD.width / 2, 202);
    panel(FIELD.width / 2 - 250, 232, 500, 220);
    drawStats(state, best, 272);
    const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 300);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `800 20px ${FONT}`;
    ctx.fillText('PRESS SPACE OR CLICK TO PLAY AGAIN', FIELD.width / 2, 500);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawBanner(banner) {
    const alpha = Math.min(1, banner.timer / 0.6, (2.6 - banner.timer) / 0.3 + 1);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(255, 217, 122, 0.7)';
    ctx.shadowBlur = 22;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 44px ${FONT}`;
    ctx.fillText(banner.title, FIELD.width / 2, 200);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `500 18px ${FONT}`;
    ctx.fillText(banner.sub, FIELD.width / 2, 232);
    ctx.restore();
  }

  function draw(state, screen, best, opts) {
    const now = opts.now;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    viewport.apply(ctx);
    drawBackdrop(state.zone, now);
    drawGate(state, now);
    drawShards(state);
    drawPickups(state, now);
    drawBrambles(state);
    drawShades(state, now);
    drawPlayer(state, now);
    if (opts.particles) opts.particles.draw(ctx);
    drawDarkness(state);
    drawFireflies(now);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state, best, opts.muted);
    if (opts.banner) drawBanner(opts.banner);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawOver(state, best);
    else if (screen === SCREEN_WIN) drawWin(state, best);
  }

  return { draw };
}
