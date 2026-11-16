// The screenshot scenes behind ?shot=start|play|end|win. Each one plays the real rules
// forward from a fresh world, steered by the autopilot, so the frame is what a real game
// looks like and the same seed always gives the same frame. The play and win scenes retry
// with later seeds until the pilot survives, so the shot always shows its screen.

import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createAutopilot } from './autopilot.js';
import {
  createWorld, EVENT_BLOOM, EVENT_FLARE, EVENT_OVER, EVENT_SHARD, EVENT_WIN,
} from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 4;
const PLAY_SECONDS = 26;
const LIMIT_SECONDS = 900;
const MAX_TRIES = 8;

/** Run the world forward, feeding the particle system as the real loop would. */
function runFor(world, pilot, particles, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    const input = pilot ? pilot.decide(world.state) : { mx: 0, my: 0, flare: false };
    const events = world.step(STEP, input, false);
    const p = world.state.player;
    if (events & EVENT_SHARD) particles.burst(p.x, p.y, '#ffd97a', 10, 180);
    if (events & EVENT_BLOOM) particles.burst(p.x, p.y, '#6fe3c1', 16, 240);
    if (events & EVENT_FLARE) particles.ring(p.x, p.y, '#ffe9a8');
    if (index % 3 === 0) particles.trail(p.x, p.y, '#ffe9a8');
    particles.update(STEP);
    if (events & EVENT_OVER) return 'over';
    if (events & EVENT_WIN) return 'win';
  }
  return 'time';
}

function tryPlay(seed, particles) {
  for (let attempt = 0; attempt < MAX_TRIES; attempt += 1) {
    const world = createWorld(createRandom(seed + attempt));
    particles.clear();
    const outcome = runFor(world, createAutopilot('careful'), particles, PLAY_SECONDS);
    if (outcome === 'time' && world.state.score > 200) {
      return { world, screen: SCREEN_PLAY, best: world.state.score };
    }
  }
  // Fallback: the first attempt's world, whatever became of it.
  const world = createWorld(createRandom(seed));
  particles.clear();
  runFor(world, createAutopilot('careful'), particles, PLAY_SECONDS);
  return {
    world,
    screen: world.state.over ? SCREEN_OVER : SCREEN_PLAY,
    best: world.state.score,
  };
}

function tryWin(seed, particles) {
  for (let attempt = 0; attempt < MAX_TRIES; attempt += 1) {
    const world = createWorld(createRandom(seed + attempt));
    particles.clear();
    const outcome = runFor(world, createAutopilot('careful'), particles, LIMIT_SECONDS);
    if (outcome === 'win') {
      return { world, screen: SCREEN_WIN, best: world.state.score };
    }
  }
  const world = createWorld(createRandom(seed));
  particles.clear();
  runFor(world, createAutopilot('careful'), particles, LIMIT_SECONDS);
  return {
    world,
    screen: world.state.won ? SCREEN_WIN : SCREEN_OVER,
    best: world.state.score,
  };
}

function tryEnd(seed, particles) {
  // A hurried run that gets somewhere, then stops and lets the dark take the wisp.
  for (let attempt = 0; attempt < MAX_TRIES; attempt += 1) {
    const world = createWorld(createRandom(seed + attempt));
    particles.clear();
    const outcome = runFor(world, createAutopilot('reckless'), particles, 30);
    if (outcome === 'win') continue;
    if (outcome === 'over') return { world, screen: SCREEN_OVER, best: world.state.score };
    const idle = runFor(world, null, particles, LIMIT_SECONDS);
    if (idle === 'over') return { world, screen: SCREEN_OVER, best: world.state.score };
  }
  const world = createWorld(createRandom(seed));
  particles.clear();
  runFor(world, null, particles, LIMIT_SECONDS);
  return { world, screen: SCREEN_OVER, best: world.state.score };
}

/**
 * Stage the named scene (start, play, end or win; any other name is start) and return the
 * world to draw, the screen to draw over it and the best score to show.
 */
export function stageShot(name, seed, particles) {
  if (name === 'play') return tryPlay(seed, particles);
  if (name === 'win') return tryWin(seed, particles);
  if (name === 'end') return tryEnd(seed, particles);
  const world = createWorld(createRandom(seed));
  particles.clear();
  for (let index = 0; index < START_SECONDS / STEP; index += 1) {
    world.step(STEP, null, true);
    if (index % 4 === 0) particles.trail(world.state.player.x, world.state.player.y, '#ffe9a8');
    particles.update(STEP);
  }
  return { world, screen: SCREEN_TITLE, best: 0 };
}
