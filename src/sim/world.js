// The garden as the simulation sees it: terrain height, surface types, obstacles, wind and weather.
// Pure maths (no rendering) so the physics tests and the 3D scene share one source of truth.
import { clamp, smooth } from './vec.js';

// ---- deterministic noise
function hash(x, y) { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, oct = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); a *= 0.5; f *= 2.03; } return s; }
export function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---- layout (metres; north is -Z, east is +X). A one-inch inventor is 0.025 tall.
export const WORLD = {
  half: 15,                                   // garden fence at +-16
  workshop: { x: 0, z: 0, r: 0.95 },
  hill: { x: -3.2, z: -2.4, r: 2.3, h: 1.35, top: 0.32 },
  runway: { x0: 1.6, x1: 10.5, z: 1.1, w: 0.8, heading: Math.PI / 2 },
  rail: { x0: 1.6, x1: 7.0, z: -1.1, w: 0.16, heading: Math.PI / 2 },
  pond: { x: 6.2, z: -6.8, r: 2.7, level: -0.06, depth: 0.22 },
  mud: { x: -5.6, z: 4.6, r: 2.2 },
  fortress: { x: -8.6, z: 7.2, r: 1.9, h: 0.38 },
  flowerbed: { x: 7.2, z: 6.2, r: 3.2 },
  nest: { x: -1.9, z: 2.6 }, food: { x: 2.4, z: 3.4 },
};
const W = WORLD;
export const SITES = {
  hill: { name: 'Glider Hill', pos: [W.hill.x + 0.28, 0, W.hill.z], heading: Math.PI / 2, kind: 'hill' },
  rail: { name: 'Launch Rail', pos: [W.rail.x0 + 0.15, 0, W.rail.z], heading: Math.PI / 2, kind: 'rail' },
  runway: { name: 'Grass Runway', pos: [W.runway.x0 + 0.2, 0, W.runway.z], heading: Math.PI / 2, kind: 'runway' },
};

// Sunflower Circuit hoops: centre, radius, facing heading
export const HOOPS = [
  { x: 5.2, y: 0.55, z: 2.6, r: 0.24, h: 0.6 }, { x: 8.2, y: 0.85, z: 5.2, r: 0.24, h: 2.2 },
  { x: 6.2, y: 0.95, z: 8.0, r: 0.24, h: 4.2 }, { x: 3.6, y: 0.7, z: 5.6, r: 0.24, h: 5.6 },
];


const d2 = (x, z, o) => Math.hypot(x - o.x, z - o.z);
const inStrip = (x, z, s, pad = 0) => x > s.x0 - pad && x < s.x1 + pad && Math.abs(z - s.z) < s.w / 2 + pad;
const stripBlend = (x, z, s, pad) => { // 1 inside strip, 0 beyond pad
  const dx = Math.max(s.x0 - x, 0, x - s.x1), dz = Math.max(Math.abs(z - s.z) - s.w / 2, 0);
  return 1 - smooth(0, pad, Math.hypot(dx, dz));
};

function rawHeight(x, z) {
  // rolling soil
  let h = (fbm(x * 0.35 + 11.3, z * 0.35 - 4.2, 3) - 0.5) * 0.5 + (fbm(x * 1.7, z * 1.7, 2) - 0.5) * 0.06;
  // flattened working areas
  let flat = Math.max(1 - smooth(W.workshop.r, W.workshop.r + 1.2, d2(x, z, W.workshop)), stripBlend(x, z, W.runway, 0.9), stripBlend(x, z, W.rail, 0.6));
  h *= 1 - flat;
  // launch hill: a mound of dug soil with a flat top
  const dh = d2(x, z, W.hill);
  h += W.hill.h * (1 - smooth(W.hill.top, W.hill.r, dh)) * (1 - 0.0 * flat);
  // fortress rock shelf
  h += W.fortress.h * (1 - smooth(W.fortress.r * 0.75, W.fortress.r * 1.25, d2(x, z, W.fortress)));
  // pond basin
  const dp = d2(x, z, W.pond);
  h = h * smooth(W.pond.r * 0.8, W.pond.r * 1.5, dp) - W.pond.depth * (1 - smooth(W.pond.r * 0.35, W.pond.r * 1.05, dp));
  // churned mud: ruts and shell holes
  const dm = d2(x, z, W.mud);
  if (dm < W.mud.r * 1.3) h += (1 - smooth(W.mud.r * 0.7, W.mud.r * 1.3, dm)) * ((vnoise(x * 2.6, z * 2.6) - 0.5) * 0.07 - 0.03);
  // raised banks beyond the fence line
  const edge = Math.max(Math.abs(x), Math.abs(z));
  h += smooth(W.half + 0.5, W.half + 6, edge) * 1.2;
  return h;
}
// The terrain is sampled once onto a grid; physics and the rendered mesh both read this grid, so wheels
// and feet sit exactly on the ground you see.
export const GRID = { half: 22, step: 0.1, n: 441, data: null };
function gridData() {
  if (GRID.data) return GRID.data;
  const { half, step, n } = GRID, d = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) d[j * n + i] = rawHeight(-half + i * step, -half + j * step);
  return (GRID.data = d);
}
export function groundHeight(x, z) {
  const { half, step, n } = GRID;
  const fx = (x + half) / step, fz = (z + half) / step;
  if (!(fx >= 0 && fz >= 0 && fx < n - 1 && fz < n - 1)) return rawHeight(x, z);
  const d = gridData(), i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * n + i;
  return (d[k] * (1 - u) + d[k + 1] * u) * (1 - v) + (d[k + n] * (1 - u) + d[k + n + 1] * u) * v;
}
export function groundNormal(x, z) {
  const e = 0.02, hx = groundHeight(x + e, z) - groundHeight(x - e, z), hz = groundHeight(x, z + e) - groundHeight(x, z - e);
  const n = [-hx, 2 * e, -hz], l = Math.hypot(n[0], n[1], n[2]);
  return [n[0] / l, n[1] / l, n[2] / l];
}

// Surface classes: mu = sliding friction multiplier, roll = rolling resistance multiplier, soft = impact cushioning
const SURF = {
  grass: { name: 'grass', mu: 1, roll: 1.6, soft: 1.3 },
  dirt: { name: 'packed earth', mu: 0.9, roll: 1, soft: 1 },
  moss: { name: 'moss', mu: 1.1, roll: 1.3, soft: 1.8 },
  mud: { name: 'mud', mu: 1.5, roll: 5, soft: 2.2 },
  rail: { name: 'launch rail', mu: 0.9, roll: 1, soft: 1, rail: true },
  water: { name: 'water', mu: 1, roll: 1, soft: 3, water: W.pond.level },
  rock: { name: 'rock', mu: 0.8, roll: 1, soft: 0.8 },
};
export function surfaceAt(x, z, wet = 0) {
  if (d2(x, z, W.pond) < W.pond.r * 1.05 && groundHeight(x, z) < W.pond.level) return SURF.water;
  if (inStrip(x, z, W.rail)) return SURF.rail;
  let s;
  if (inStrip(x, z, W.runway)) s = SURF.dirt;
  else if (d2(x, z, W.workshop) < W.workshop.r) s = SURF.dirt;
  else if (d2(x, z, W.mud) < W.mud.r) s = SURF.mud;
  else if (d2(x, z, W.fortress) < W.fortress.r) s = SURF.rock;
  else if (d2(x, z, W.hill) < W.hill.r) s = SURF.moss;
  else s = SURF.grass;
  if (wet > 0.3 && (s === SURF.dirt || s === SURF.grass)) return { ...s, name: 'wet ' + s.name, mu: s.mu * (1 - 0.25 * wet), roll: s.roll * (1 + 2.5 * wet) };
  return s;
}
// how much tall grass may grow here (0..1)
export function grassDensity(x, z) {
  if (Math.max(Math.abs(x), Math.abs(z)) > W.half + 2.5) return 0;
  let d = 1;
  d *= smooth(W.workshop.r, W.workshop.r + 0.5, d2(x, z, W.workshop));
  d *= 1 - stripBlend(x, z, W.runway, 0.35);
  d *= 1 - stripBlend(x, z, W.rail, 0.3);
  d *= 0.45 + 0.55 * smooth(W.hill.r * 0.7, W.hill.r * 1.05, d2(x, z, W.hill)); d *= smooth(W.hill.top * 1.6, W.hill.top * 3.2, d2(x, z, W.hill));
  d *= smooth(W.pond.r * 1.0, W.pond.r * 1.35, d2(x, z, W.pond));
  d *= smooth(W.mud.r * 0.8, W.mud.r * 1.2, d2(x, z, W.mud));
  d *= smooth(W.fortress.r * 1.0, W.fortress.r * 1.4, d2(x, z, W.fortress));
  // trodden paths: workshop -> hill, workshop -> ant nest, workshop -> runway
  const path = (ax, az, bx, bz, w) => { const vx = bx - ax, vz = bz - az, t = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz), 0, 1); return smooth(w, w * 2.2, Math.hypot(x - ax - vx * t, z - az - vz * t)); };
  d *= path(0, 0, W.hill.x + 1.6, W.hill.z + 0.3, 0.14) * path(0, 0, W.runway.x0, W.runway.z, 0.2) * path(0, 0, W.rail.x0, W.rail.z, 0.2) * path(-0.4, 0.8, W.nest.x, W.nest.z, 0.07);
  // natural meadow patchiness
  d *= smooth(0.28, 0.5, fbm(x * 0.6 + 3, z * 0.6 + 9, 2)) * 0.75 + 0.25;
  return d;
}

// ---- static obstacles. Filled by the scene builder so visuals and collisions stay in lockstep.
// {t:'cyl', x, z, r, y0, y1} | {t:'sph', x, y, z, r} | {t:'box', x, z, hx, hz, y0, y1, rot}
export const colliders = [];
const CELL = 1; const grid = new Map();
export function addCollider(c) {
  colliders.push(c);
  const r = c.t === 'box' ? Math.hypot(c.hx, c.hz) : c.r;
  for (let gx = Math.floor((c.x - r) / CELL); gx <= Math.floor((c.x + r) / CELL); gx++) for (let gz = Math.floor((c.z - r) / CELL); gz <= Math.floor((c.z + r) / CELL); gz++) {
    const k = gx + ',' + gz; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(c);
  }
  return c;
}
export function clearColliders() { colliders.length = 0; grid.clear(); }
// point query -> {depth, normal} of deepest penetration, or null
export function collidePoint(p) {
  const list = grid.get(Math.floor(p[0] / CELL) + ',' + Math.floor(p[2] / CELL));
  if (!list) return null;
  let best = null;
  for (const c of list) {
    if (c.off) continue;
    let depth, n;
    if (c.t === 'cyl') {
      if (p[1] < c.y0 || p[1] > c.y1) continue;
      const dx = p[0] - c.x, dz = p[2] - c.z, d = Math.hypot(dx, dz);
      if (d >= c.r) continue;
      const top = c.y1 - p[1];
      if (top < c.r - d) { depth = top; n = [0, 1, 0]; } else { depth = c.r - d; n = d > 1e-6 ? [dx / d, 0, dz / d] : [1, 0, 0]; }
    } else if (c.t === 'sph') {
      const dx = p[0] - c.x, dy = p[1] - c.y, dz = p[2] - c.z, d = Math.hypot(dx, dy, dz);
      if (d >= c.r) continue;
      depth = c.r - d; n = d > 1e-6 ? [dx / d, dy / d, dz / d] : [0, 1, 0];
    } else {
      if (p[1] < c.y0 || p[1] > c.y1) continue;
      const cs = Math.cos(c.rot || 0), sn = Math.sin(c.rot || 0), dx = p[0] - c.x, dz = p[2] - c.z;
      const lx = dx * cs + dz * sn, lz = -dx * sn + dz * cs;
      if (Math.abs(lx) >= c.hx || Math.abs(lz) >= c.hz) continue;
      const px = c.hx - Math.abs(lx), pz = c.hz - Math.abs(lz), py = c.y1 - p[1];
      if (py < px && py < pz) { depth = py; n = [0, 1, 0]; }
      else if (px < pz) { depth = px; const s = Math.sign(lx) || 1; n = [s * cs, 0, s * sn]; }
      else { depth = pz; const s = Math.sign(lz) || 1; n = [-s * sn, 0, s * cs]; }
    }
    if (!best || depth > best.depth) best = { depth, normal: n, c };
  }
  return best;
}

// ---- weather & wind
export const WEATHER_PRESETS = {
  calm:   { name: 'Calm morning',  wind: 0.25, gust: 0.1, turb: 0.05, rain: 0, fog: 0.0 },
  breeze: { name: 'Light breeze',  wind: 1.0,  gust: 0.35, turb: 0.15, rain: 0, fog: 0.0 },
  gusty:  { name: 'Gusty afternoon', wind: 1.9, gust: 1.0, turb: 0.45, rain: 0, fog: 0.0 },
  rain:   { name: 'Rain shower',   wind: 1.3,  gust: 0.6, turb: 0.3, rain: 1, fog: 0.35 },
  fog:    { name: 'Morning fog',   wind: 0.3,  gust: 0.1, turb: 0.05, rain: 0, fog: 1 },
};
export class Weather {
  constructor() { this.dir = Math.PI * 1.5; this.set('calm', true); this.wet = 0; this.t = 0; }
  // dir: compass direction the wind blows FROM (radians, 0 = north)
  set(key, instant) { this.key = key; this.target = { ...WEATHER_PRESETS[key] }; if (instant) this.cur = { ...this.target }; }
  update(dt) {
    this.t += dt;
    for (const k of ['wind', 'gust', 'turb', 'rain', 'fog']) this.cur[k] += (this.target[k] - this.cur[k]) * Math.min(1, dt * 0.25);
    this.wet = clamp(this.wet + (this.cur.rain > 0.2 ? dt / 40 : -dt / 150), 0, 1);
  }
  get rain() { return this.cur.rain; }
  // wind velocity vector (m/s) at a point
  wind(p, t = this.t) {
    const c = this.cur, g = groundHeight(p[0], p[2]), agl = Math.max(0, p[1] - g);
    const gustK = 1 + c.gust / Math.max(c.wind, 0.3) * (Math.sin(t * 0.37 + p[0] * 0.2) * 0.6 + Math.sin(t * 0.83 + 1.7 + p[2] * 0.25) * 0.4);
    const speed = c.wind * Math.max(gustK, 0) * (0.25 + 0.75 * smooth(0, 0.9, agl));    // sheltered near the ground
    const a = this.dir + Math.sin(t * 0.11) * 0.25;
    let wx = -Math.sin(a) * speed, wz = Math.cos(a) * speed, wy = 0;
    // slope lift: air deflected up the windward side of hills
    const e = 0.15, gx = (groundHeight(p[0] + e, p[2]) - groundHeight(p[0] - e, p[2])) / (2 * e), gz = (groundHeight(p[0], p[2] + e) - groundHeight(p[0], p[2] - e)) / (2 * e);
    wy += (wx * gx + wz * gz) * Math.exp(-agl / 0.8);
    // turbulence
    if (c.turb > 0) {
      const s = c.turb * (0.4 + 0.6 * smooth(0, 0.5, agl));
      wx += s * (vnoise(t * 1.3 + p[0], p[2] * 0.9) - 0.5) * 2; wy += s * (vnoise(p[0] * 0.9 + 40, t * 1.5 + p[2]) - 0.5) * 1.6; wz += s * (vnoise(t * 1.1 + 80, p[0] + p[2]) - 0.5) * 2;
    }
    // sun-warmed bare ground makes weak thermals over the runway and workshop clearing
    if (c.rain < 0.1) wy += 0.18 * (1 - smooth(0.8, 2.2, d2(p[0], p[2], { x: 5, z: 1.1 }))) * smooth(0.1, 0.6, agl);
    // the fence draft: air piles up against the fence and turns you back
    const over = Math.max(Math.abs(p[0]), Math.abs(p[2])) - WORLD.half;
    if (over > 0) { const k = Math.min(over, 3) * 2.5; wx -= Math.sign(p[0]) * (Math.abs(p[0]) > Math.abs(p[2]) ? k : 0); wz -= Math.sign(p[2]) * (Math.abs(p[2]) >= Math.abs(p[0]) ? k : 0); }
    return [wx, wy, wz];
  }
}

// Environment adaptor handed to Aircraft.update()
export function makeEnv(weather) {
  return {
    ground: groundHeight, normal: groundNormal,
    surface: (x, z) => surfaceAt(x, z, weather ? weather.wet : 0),
    collide: collidePoint,
    wind: weather ? (p, t) => weather.wind(p) : null,
    get rain() { return weather ? weather.rain : 0; },
  };
}
