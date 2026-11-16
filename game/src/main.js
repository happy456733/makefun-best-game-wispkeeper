// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The
// game moves between five screens: title, play, paused, game over and victory.
//
// ?seed=N fixes the pattern of shards and shades. ?shot=start|play|end|win (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot.

import { BEST_KEY, STEP, ZONES } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld, EVENT_BLOOM, EVENT_FLARE, EVENT_FLARE_PICKUP, EVENT_GATE_OPEN, EVENT_HIT,
  EVENT_OVER, EVENT_SHADE_DOWN, EVENT_SHARD, EVENT_WIN, EVENT_ZONE,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_FLARE, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput,
} from './input.js';
import {
  createRenderer, MUTE_BUTTON, PAUSE_BUTTON, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY,
  SCREEN_TITLE, SCREEN_WIN,
} from './render.js';
import { createViewport } from './viewport.js';
import { createParticles } from './particles.js';
import { createSound } from './sound.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const viewport = createViewport(canvas);
const renderer = createRenderer(canvas, viewport);
const particles = createParticles();
const sound = createSound();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, seed, particles);
  let painted = 0;
  function paint() {
    renderer.draw(scene.world.state, scene.screen, scene.best, {
      particles, banner: null, muted: sound.muted(), now: performance.now() / 1000,
    });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const world = createWorld(createRandom(seed));
  const input = createInput(canvas, viewport);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let banner = null;
  let trailTimer = 0;
  let flareQueued = false;

  // The audio context starts on the first gesture, as browsers require.
  window.addEventListener('pointerdown', () => sound.unlock(), { once: true });
  window.addEventListener('keydown', () => sound.unlock(), { once: true });

  // Screen readers (and anyone watching the page's text) hear the screen changes and events.
  function announce(message) {
    status.textContent = message;
  }

  function zoneBanner(index) {
    return { title: `Zone ${index + 1} — ${ZONES[index].name}`, sub: ZONES[index].sub, timer: 2.6 };
  }

  function startGame() {
    world.reset();
    particles.clear();
    accumulator = 0;
    flareQueued = false;
    banner = zoneBanner(0);
    screen = SCREEN_PLAY;
    sound.unlock();
    sound.click();
    announce(`Playing. Zone 1, ${ZONES[0].name}. Gather ${ZONES[0].shardGoal} shards to open the gate.`);
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) {
      sound.win();
      announce(`Victory! Score ${world.state.score}. Best ${best}.`);
    } else {
      sound.lose();
      announce(`Game over. Score ${world.state.score}. Best ${best}.`);
    }
  }

  function inside(rect, point) {
    return point && point.x >= rect.x && point.x <= rect.x + rect.w
      && point.y >= rect.y && point.y <= rect.y + rect.h;
  }

  function handleActions() {
    let actions = input.takeActions();
    const click = input.takeClick();
    if (click && screen === SCREEN_PLAY) {
      // A click on a HUD button is a button press, not a flare.
      if (inside(PAUSE_BUTTON, click)) {
        actions &= ~ACTION_FLARE;
        actions |= ACTION_PAUSE;
      } else if (inside(MUTE_BUTTON, click)) {
        actions &= ~ACTION_FLARE;
        actions |= ACTION_MUTE;
      }
    }
    if (actions & ACTION_MUTE) sound.setMuted(!sound.muted());
    if ((actions & ACTION_RESTART) && screen !== SCREEN_TITLE) {
      startGame();
      return;
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & (ACTION_CONFIRM | ACTION_FLARE)) startGame();
      return;
    }
    if (screen === SCREEN_PLAY && (actions & ACTION_FLARE)) flareQueued = true;
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_PAUSED && (actions & ACTION_CONFIRM)) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function reactToEvents(events) {
    const p = world.state.player;
    if (events & EVENT_SHARD) {
      particles.burst(p.x, p.y, '#ffd97a', 12, 200);
      sound.pickup(world.state.mult);
    }
    if (events & EVENT_BLOOM) {
      particles.burst(p.x, p.y, '#6fe3c1', 20, 260);
      sound.bloom();
    }
    if (events & EVENT_FLARE_PICKUP) {
      particles.burst(p.x, p.y, '#ff9d5c', 12, 200);
      sound.gate();
    }
    if (events & EVENT_HIT) {
      particles.burst(p.x, p.y, '#ff5d73', 18, 300);
      sound.hit();
      announce(`Hit! Light ${Math.round(p.light)}.`);
    }
    if (events & EVENT_FLARE) {
      particles.ring(p.x, p.y, '#ffe9a8');
      sound.flare();
    }
    if (events & EVENT_SHADE_DOWN) {
      particles.burst(p.x, p.y, '#b78fe8', 8, 160);
    }
    if (events & EVENT_GATE_OPEN) {
      particles.burst(world.state.gate.x, world.state.gate.y, '#6fe3c1', 24, 240);
      sound.gate();
      announce('The gate is open. Go!');
    }
    if (events & EVENT_ZONE) {
      banner = zoneBanner(world.state.zone);
      sound.zone();
      announce(`Zone ${world.state.zone + 1}, ${ZONES[world.state.zone].name}.`);
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, null, true);
      return;
    }
    const move = input.moveVector(world.state.player.x, world.state.player.y);
    const events = world.step(STEP, { mx: move.x, my: move.y, flare: flareQueued }, false);
    flareQueued = false;
    reactToEvents(events);
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      accumulator += dt;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    if (screen !== SCREEN_PAUSED) {
      particles.update(dt);
      if (banner) {
        banner.timer -= dt;
        if (banner.timer <= 0) banner = null;
      }
    }
    if (screen === SCREEN_PLAY) {
      trailTimer -= dt;
      if (trailTimer <= 0) {
        trailTimer = 0.03;
        particles.trail(world.state.player.x, world.state.player.y, '#ffe9a8');
      }
    }
    renderer.draw(world.state, screen, best, {
      particles, banner, muted: sound.muted(), now: now / 1000,
    });
  }

  // Leaving the tab pauses a running game rather than letting the light drain unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Wispkeeper. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
