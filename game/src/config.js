// Every tuning number, colour and zone of Wispkeeper in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends on
// the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  accel: 3000,
  maxSpeed: 345,
  /** Velocity kept each step with no input: a smooth glide that still stops quickly. */
  damping: 0.86,
  invulnerable: 1.2,
};

/** Light is the wisp's life: it drains with time and is restored by gathering shards. */
export const LIGHT = {
  max: 100,
  shardRestore: 9,
  bloomRestore: 16,
  gateHeal: 12,
  hitCost: 20,
};

export const SHARD = { radius: 10, points: 50, onField: 7 };

export const BLOOM = { radius: 13, points: 250, interval: 20 };

export const FLARE_PICKUP = { radius: 12, interval: 26 };

/** A flare is a burst of light that burns the near shades away. */
export const FLARE = { max: 3, start: 1, radius: 205, points: 25, cooldown: 0.7 };

/** Gathering shards quickly chains a multiplier: every 4 in a row raises it, up to x5. */
export const COMBO = { window: 3, perStep: 4, maxMult: 5 };

export const SHADE = {
  drifter: { radius: 16, speed: 66, speedPerZone: 7 },
  hunter: { radius: 14, speed: 148, speedPerZone: 9 },
};

export const BRAMBLE = { radius: 19 };

export const GATE = { radius: 34 };

/** The five zones of the Hollow: each darker, hungrier and busier than the last. */
export const ZONES = [
  { name: 'Ember Hollow', sub: 'Where the light first fades', shardGoal: 5, drifters: 3, hunters: 0, brambles: 2, drain: 1.4 },
  { name: 'Mosslight Grotto', sub: 'The green dark below', shardGoal: 6, drifters: 4, hunters: 1, brambles: 3, drain: 1.6 },
  { name: 'The Sunken Choir', sub: 'Something hums in the deep', shardGoal: 6, drifters: 4, hunters: 2, brambles: 3, drain: 1.8 },
  { name: 'Frostfall Deep', sub: 'Cold that drinks the light', shardGoal: 7, drifters: 5, hunters: 3, brambles: 4, drain: 2.0 },
  { name: 'Dawn Gate', sub: 'One last climb to morning', shardGoal: 8, drifters: 5, hunters: 4, brambles: 4, drain: 2.2 },
];

/** One backdrop tint per zone, from warm ember dark to cold morning dark. */
export const ZONE_TINTS = ['#241a33', '#122735', '#1c2140', '#182233', '#2e2129'];

export const PALETTE = {
  backdrop: '#07060f',
  panel: 'rgba(12, 10, 26, 0.84)',
  panelEdge: 'rgba(255, 214, 130, 0.35)',
  text: '#f5eedd',
  muted: '#9b93b8',
  gold: '#ffd97a',
  ember: '#ff9d5c',
  teal: '#6fe3c1',
  wisp: '#ffe9a8',
  shade: '#3a2b52',
  shadeEye: '#ff5d73',
  bramble: '#5c3a6e',
  danger: '#ff5d73',
};

export const FONT = '"Avenir Next", "Segoe UI", system-ui, -apple-system, sans-serif';

/** Where the best score (and the mute setting) are kept between visits, this browser only. */
export const BEST_KEY = 'wispkeeper.best';
export const MUTE_KEY = 'wispkeeper.muted';
