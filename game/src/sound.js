// Every sound is synthesized with the Web Audio API: no audio files, no network. Short
// oscillator blips with an envelope for effects, and a low drone for the Hollow's hum.
// The context starts on the first user gesture, as browsers require.

import { MUTE_KEY } from './config.js';

function readMuted() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function createSound() {
  let ctx = null;
  let master = null;
  let muted = readMuted();

  function startDrone() {
    // Two detuned low sines: the Hollow breathing underneath everything.
    const gain = ctx.createGain();
    gain.gain.value = 0.045;
    gain.connect(master);
    for (const freq of [55, 55.6, 110.3]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start();
    }
  }

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') void ctx.resume();
      return;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      startDrone();
    } catch {
      ctx = null;
    }
  }

  function tone(freq, dur, type, vol, slideTo, delay = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  return {
    unlock,
    setMuted(value) {
      muted = value;
      try {
        window.localStorage.setItem(MUTE_KEY, value ? '1' : '0');
      } catch {
        // Storage can be off: the mute then lasts this visit only.
      }
      if (master) master.gain.value = value ? 0 : 0.5;
    },
    muted() {
      return muted;
    },
    click() {
      tone(660, 0.08, 'sine', 0.15);
    },
    /** The chime climbs with the combo multiplier. */
    pickup(mult) {
      const base = 520 * (1 + 0.09 * (mult - 1));
      tone(base, 0.16, 'sine', 0.22, base * 1.5);
      tone(base * 2, 0.1, 'sine', 0.08);
    },
    bloom() {
      tone(392, 0.14, 'sine', 0.2);
      tone(523, 0.14, 'sine', 0.2, null, 0.08);
      tone(784, 0.22, 'sine', 0.2, null, 0.16);
    },
    hit() {
      tone(150, 0.25, 'sawtooth', 0.28, 55);
      tone(90, 0.2, 'square', 0.12, 45);
    },
    flare() {
      tone(300, 0.35, 'sine', 0.25, 1400);
      tone(1200, 0.2, 'triangle', 0.12, 2400, 0.05);
    },
    gate() {
      tone(523, 0.18, 'sine', 0.2);
      tone(784, 0.3, 'sine', 0.2, null, 0.12);
    },
    zone() {
      tone(392, 0.14, 'triangle', 0.18);
      tone(523, 0.14, 'triangle', 0.18, null, 0.1);
      tone(659, 0.14, 'triangle', 0.18, null, 0.2);
      tone(784, 0.3, 'triangle', 0.2, null, 0.3);
    },
    win() {
      const notes = [523, 659, 784, 1047, 784, 1047];
      notes.forEach((freq, i) => tone(freq, 0.28, 'triangle', 0.2, null, i * 0.13));
    },
    lose() {
      tone(392, 0.3, 'sine', 0.2, 370);
      tone(311, 0.35, 'sine', 0.2, 294, 0.25);
      tone(233, 0.6, 'sine', 0.2, 220, 0.5);
    },
  };
}
