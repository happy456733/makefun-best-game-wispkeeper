// The game's rules and state, with no drawing and no browser in it: the wisp, its light, the
// shards and blooms it gathers, the shades and brambles that hunt it, the gate between zones,
// the combo and the score. step() advances one fixed step and returns what happened as bit
// flags, so the caller can react (particles, sound) without the world knowing about them.
// Nothing here allocates after createWorld returns, and every spawn comes from the seeded
// random, so the same seed always plays the same game.

import {
  BLOOM, BRAMBLE, COMBO, FIELD, FLARE, FLARE_PICKUP, GATE, LIGHT, PLAYER, SHADE, SHARD, ZONES,
} from './config.js';
import { range } from './random.js';

export const EVENT_SHARD = 1;
export const EVENT_BLOOM = 2;
export const EVENT_FLARE_PICKUP = 4;
export const EVENT_HIT = 8;
export const EVENT_FLARE = 16;
export const EVENT_SHADE_DOWN = 32;
export const EVENT_GATE_OPEN = 64;
export const EVENT_ZONE = 128;
export const EVENT_WIN = 256;
export const EVENT_OVER = 512;

export const KIND_DRIFTER = 0;
export const KIND_HUNTER = 1;
const KIND_BLOOM = 0;
const KIND_FLARE = 1;

const MAX_SHADES = 12;
const MAX_PICKUPS = 4;
const SHARD_POOL = 24;
const BRAMBLE_POOL = 6;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2, y: FIELD.height / 2, vx: 0, vy: 0,
    light: LIGHT.max, invulnerable: 0, flares: FLARE.start, flareCooldown: 0,
  };
  const shards = [];
  for (let index = 0; index < SHARD_POOL; index += 1) {
    shards.push({ active: false, x: 0, y: 0, phase: 0 });
  }
  const shades = [];
  for (let index = 0; index < MAX_SHADES; index += 1) {
    shades.push({ active: false, kind: KIND_DRIFTER, x: 0, y: 0, vx: 0, vy: 0, wander: 0, wanderT: 0 });
  }
  const brambles = [];
  for (let index = 0; index < BRAMBLE_POOL; index += 1) {
    brambles.push({ active: false, x: 0, y: 0, phase: 0 });
  }
  const pickups = [];
  for (let index = 0; index < MAX_PICKUPS; index += 1) {
    pickups.push({ active: false, kind: KIND_BLOOM, x: 0, y: 0, phase: 0 });
  }
  const gate = { x: FIELD.width / 2, y: 64, open: false };

  const state = {
    player, shards, shades, brambles, pickups, gate,
    zone: 0, score: 0, combo: 0, comboTimer: 0, mult: 1,
    shardsGot: 0, shardsTotal: 0, shadesDown: 0, elapsed: 0, zoneTime: 0,
    bloomTimer: BLOOM.interval, flareTimer: FLARE_PICKUP.interval, shadeTimer: 0,
    over: false, won: false,
  };

  function zoneDef() {
    return ZONES[state.zone];
  }

  function farFromPlayer(x, y, min) {
    return dist2(x, y, player.x, player.y) > min * min;
  }

  function spawnPoint(minPlayerDist) {
    for (let tries = 0; tries < 24; tries += 1) {
      const x = range(random, 60, FIELD.width - 60);
      const y = range(random, 70, FIELD.height - 60);
      if (farFromPlayer(x, y, minPlayerDist)) return { x, y };
    }
    return { x: range(random, 60, FIELD.width - 60), y: range(random, 70, FIELD.height - 60) };
  }

  function free(list) {
    for (const item of list) if (!item.active) return item;
    return null;
  }

  function countActive(list) {
    let count = 0;
    for (const item of list) if (item.active) count += 1;
    return count;
  }

  function countKind(kind) {
    let count = 0;
    for (const s of shades) if (s.active && s.kind === kind) count += 1;
    return count;
  }

  function spawnShard() {
    const shard = free(shards);
    if (!shard) return;
    const point = spawnPoint(150);
    shard.active = true;
    shard.x = point.x;
    shard.y = point.y;
    shard.phase = random() * Math.PI * 2;
  }

  function spawnShade(kind) {
    const shade = free(shades);
    if (!shade) return;
    // Shades crawl in from the edges, away from the wisp.
    const edge = Math.floor(random() * 4);
    let x = 0;
    let y = 0;
    if (edge === 0) { x = range(random, 40, FIELD.width - 40); y = 30; }
    else if (edge === 1) { x = range(random, 40, FIELD.width - 40); y = FIELD.height - 30; }
    else if (edge === 2) { x = 30; y = range(random, 40, FIELD.height - 40); }
    else { x = FIELD.width - 30; y = range(random, 40, FIELD.height - 40); }
    if (!farFromPlayer(x, y, 220)) {
      x = FIELD.width - x;
      y = FIELD.height - y;
    }
    shade.active = true;
    shade.kind = kind;
    shade.x = x;
    shade.y = y;
    shade.vx = 0;
    shade.vy = 0;
    shade.wander = random() * Math.PI * 2;
    shade.wanderT = 0;
  }

  function placeBrambles() {
    for (const b of brambles) b.active = false;
    for (let index = 0; index < zoneDef().brambles; index += 1) {
      const b = free(brambles);
      if (!b) break;
      const point = spawnPoint(200);
      b.active = true;
      b.x = point.x;
      b.y = point.y;
      b.phase = random() * Math.PI * 2;
    }
  }

  function placeGate() {
    // The gate waits at a far wall until its shards are gathered.
    const side = Math.floor(random() * 4);
    if (side === 0) { gate.x = range(random, 200, FIELD.width - 200); gate.y = 64; }
    else if (side === 1) { gate.x = range(random, 200, FIELD.width - 200); gate.y = FIELD.height - 64; }
    else if (side === 2) { gate.x = 64; gate.y = range(random, 150, FIELD.height - 150); }
    else { gate.x = FIELD.width - 64; gate.y = range(random, 150, FIELD.height - 150); }
    gate.open = false;
  }

  function startZone(index) {
    state.zone = index;
    state.shardsGot = 0;
    state.zoneTime = 0;
    state.bloomTimer = BLOOM.interval * 0.6;
    state.flareTimer = FLARE_PICKUP.interval * 0.6;
    state.shadeTimer = 1.5;
    for (const s of shards) s.active = false;
    for (const s of shades) s.active = false;
    for (const p of pickups) p.active = false;
    for (let index2 = 0; index2 < SHARD.onField; index2 += 1) spawnShard();
    placeBrambles();
    placeGate();
    for (let index2 = 0; index2 < zoneDef().drifters; index2 += 1) spawnShade(KIND_DRIFTER);
    for (let index2 = 0; index2 < zoneDef().hunters; index2 += 1) spawnShade(KIND_HUNTER);
    player.x = FIELD.width / 2;
    player.y = FIELD.height / 2;
    player.vx = 0;
    player.vy = 0;
    player.invulnerable = Math.max(player.invulnerable, 1);
  }

  function reset() {
    player.light = LIGHT.max;
    player.flares = FLARE.start;
    player.flareCooldown = 0;
    player.invulnerable = 0;
    state.score = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.mult = 1;
    state.shardsTotal = 0;
    state.shadesDown = 0;
    state.elapsed = 0;
    state.over = false;
    state.won = false;
    startZone(0);
  }

  function addScore(base) {
    state.score += base * state.mult;
  }

  function raiseCombo() {
    state.combo += 1;
    state.comboTimer = COMBO.window;
    state.mult = Math.min(COMBO.maxMult, 1 + Math.floor(state.combo / COMBO.perStep));
  }

  function hitPlayer(events) {
    if (player.invulnerable > 0) return events;
    player.light -= LIGHT.hitCost;
    player.invulnerable = PLAYER.invulnerable;
    state.combo = 0;
    state.mult = 1;
    state.comboTimer = 0;
    return events | EVENT_HIT;
  }

  function driftShades(dt, gentle) {
    for (const s of shades) {
      if (!s.active) continue;
      const spec = s.kind === KIND_HUNTER ? SHADE.hunter : SHADE.drifter;
      const speed = (spec.speed + spec.speedPerZone * state.zone) * (gentle ? 0.4 : 1);
      let dx;
      let dy;
      if (gentle) {
        // Behind the title screen the shades only wander; they never hunt.
        s.wanderT -= dt;
        if (s.wanderT <= 0) {
          s.wanderT = 1.2 + random() * 1.2;
          s.wander = random() * Math.PI * 2;
        }
        dx = Math.cos(s.wander);
        dy = Math.sin(s.wander);
      } else {
        dx = player.x - s.x;
        dy = player.y - s.y;
        const d = Math.hypot(dx, dy) || 1;
        dx /= d;
        dy /= d;
        if (s.kind === KIND_DRIFTER) {
          s.wanderT -= dt;
          if (s.wanderT <= 0) {
            s.wanderT = 0.9 + random() * 0.9;
            s.wander = random() * Math.PI * 2;
          }
          dx += Math.cos(s.wander) * 0.7;
          dy += Math.sin(s.wander) * 0.7;
          const len = Math.hypot(dx, dy) || 1;
          dx /= len;
          dy /= len;
        }
      }
      s.vx += (dx * speed - s.vx) * Math.min(1, dt * 3);
      s.vy += (dy * speed - s.vy) * Math.min(1, dt * 3);
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.x < 16) { s.x = 16; s.vx = Math.abs(s.vx); }
      if (s.x > FIELD.width - 16) { s.x = FIELD.width - 16; s.vx = -Math.abs(s.vx); }
      if (s.y < 16) { s.y = 16; s.vy = Math.abs(s.vy); }
      if (s.y > FIELD.height - 16) { s.y = FIELD.height - 16; s.vy = -Math.abs(s.vy); }
    }
  }

  function step(dt, input, attract) {
    // A finished world stays finished: no more drain, no more spawns.
    if (state.won || state.over) return 0;
    let events = 0;
    const def = zoneDef();
    state.elapsed += dt;
    state.zoneTime += dt;

    // --- the wisp glides ---
    const mx = input ? input.mx : 0;
    const my = input ? input.my : 0;
    player.vx += mx * PLAYER.accel * dt;
    player.vy += my * PLAYER.accel * dt;
    const damp = Math.pow(PLAYER.damping, dt * 60);
    player.vx *= damp;
    player.vy *= damp;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > PLAYER.maxSpeed) {
      player.vx = (player.vx / speed) * PLAYER.maxSpeed;
      player.vy = (player.vy / speed) * PLAYER.maxSpeed;
    }
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    if (player.x < PLAYER.radius) { player.x = PLAYER.radius; player.vx = Math.abs(player.vx) * 0.4; }
    if (player.x > FIELD.width - PLAYER.radius) { player.x = FIELD.width - PLAYER.radius; player.vx = -Math.abs(player.vx) * 0.4; }
    if (player.y < PLAYER.radius) { player.y = PLAYER.radius; player.vy = Math.abs(player.vy) * 0.4; }
    if (player.y > FIELD.height - PLAYER.radius) { player.y = FIELD.height - PLAYER.radius; player.vy = -Math.abs(player.vy) * 0.4; }
    if (player.invulnerable > 0) player.invulnerable -= dt;
    if (player.flareCooldown > 0) player.flareCooldown -= dt;

    // Shimmer phases always advance, so the title screen lives.
    for (const s of shards) if (s.active) s.phase += dt * 3;
    for (const b of brambles) if (b.active) b.phase += dt * 2;
    for (const p of pickups) if (p.active) p.phase += dt * 3;

    if (attract) {
      driftShades(dt, true);
      return 0;
    }

    // --- light drains; gathering restores it ---
    player.light -= def.drain * dt;

    // --- the combo fades ---
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.combo = 0;
        state.mult = 1;
      }
    }

    // --- a flare burns the near shades away ---
    if (input && input.flare && player.flares > 0 && player.flareCooldown <= 0) {
      player.flares -= 1;
      player.flareCooldown = FLARE.cooldown;
      events |= EVENT_FLARE;
      const radius2 = FLARE.radius * FLARE.radius;
      for (const s of shades) {
        if (!s.active) continue;
        if (dist2(s.x, s.y, player.x, player.y) <= radius2) {
          s.active = false;
          state.shadesDown += 1;
          addScore(FLARE.points);
          events |= EVENT_SHADE_DOWN;
        }
      }
    }

    driftShades(dt, false);

    // --- spawns keep the field stocked ---
    if (countActive(shards) < SHARD.onField) spawnShard();
    state.shadeTimer -= dt;
    if (state.shadeTimer <= 0) {
      state.shadeTimer = 2.5;
      if (countKind(KIND_DRIFTER) < def.drifters) spawnShade(KIND_DRIFTER);
      else if (countKind(KIND_HUNTER) < def.hunters) spawnShade(KIND_HUNTER);
    }
    state.bloomTimer -= dt;
    if (state.bloomTimer <= 0) {
      state.bloomTimer = BLOOM.interval;
      const pickup = free(pickups);
      if (pickup) {
        const point = spawnPoint(140);
        pickup.active = true;
        pickup.kind = KIND_BLOOM;
        pickup.x = point.x;
        pickup.y = point.y;
        pickup.phase = 0;
      }
    }
    state.flareTimer -= dt;
    if (state.flareTimer <= 0) {
      state.flareTimer = FLARE_PICKUP.interval;
      if (player.flares < FLARE.max) {
        const pickup = free(pickups);
        if (pickup) {
          const point = spawnPoint(140);
          pickup.active = true;
          pickup.kind = KIND_FLARE;
          pickup.x = point.x;
          pickup.y = point.y;
          pickup.phase = 0;
        }
      }
    }

    // --- gathering shards opens the gate ---
    for (const s of shards) {
      if (!s.active) continue;
      const reach = PLAYER.radius + SHARD.radius;
      if (dist2(s.x, s.y, player.x, player.y) <= reach * reach) {
        s.active = false;
        raiseCombo();
        addScore(SHARD.points);
        player.light = Math.min(LIGHT.max, player.light + LIGHT.shardRestore);
        state.shardsGot += 1;
        state.shardsTotal += 1;
        events |= EVENT_SHARD;
        if (!gate.open && state.shardsGot >= def.shardGoal) {
          gate.open = true;
          events |= EVENT_GATE_OPEN;
        }
      }
    }
    for (const p of pickups) {
      if (!p.active) continue;
      const radius = p.kind === KIND_BLOOM ? BLOOM.radius : FLARE_PICKUP.radius;
      const reach = PLAYER.radius + radius;
      if (dist2(p.x, p.y, player.x, player.y) <= reach * reach) {
        p.active = false;
        if (p.kind === KIND_BLOOM) {
          raiseCombo();
          addScore(BLOOM.points);
          player.light = Math.min(LIGHT.max, player.light + LIGHT.bloomRestore);
          events |= EVENT_BLOOM;
        } else {
          player.flares = Math.min(FLARE.max, player.flares + 1);
          events |= EVENT_FLARE_PICKUP;
        }
      }
    }

    // --- the gate carries the wisp onward ---
    if (gate.open) {
      const reach = PLAYER.radius + GATE.radius;
      if (dist2(gate.x, gate.y, player.x, player.y) <= reach * reach) {
        if (state.zone >= ZONES.length - 1) {
          state.won = true;
          return events | EVENT_WIN;
        }
        player.light = Math.min(LIGHT.max, player.light + LIGHT.gateHeal);
        startZone(state.zone + 1);
        return events | EVENT_ZONE;
      }
    }

    // --- hits: a shade burns out on the wisp; thorns throw it clear ---
    if (player.invulnerable <= 0) {
      for (const s of shades) {
        if (!s.active) continue;
        const radius = s.kind === KIND_HUNTER ? SHADE.hunter.radius : SHADE.drifter.radius;
        const reach = PLAYER.radius + radius - 4;
        if (dist2(s.x, s.y, player.x, player.y) <= reach * reach) {
          s.active = false;
          state.shadesDown += 1;
          events = hitPlayer(events);
          break;
        }
      }
      if (!(events & EVENT_HIT)) {
        for (const b of brambles) {
          if (!b.active) continue;
          const reach = PLAYER.radius + BRAMBLE.radius - 6;
          if (dist2(b.x, b.y, player.x, player.y) <= reach * reach) {
            const dx = player.x - b.x;
            const dy = player.y - b.y;
            const d = Math.hypot(dx, dy) || 1;
            player.vx = (dx / d) * 420;
            player.vy = (dy / d) * 420;
            events = hitPlayer(events);
            break;
          }
        }
      }
    }

    if (player.light <= 0) {
      player.light = 0;
      state.over = true;
      return events | EVENT_OVER;
    }
    return events;
  }

  reset();
  return { state, reset, step, startZone };
}
