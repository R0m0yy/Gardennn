// Headless physics & data tests: `npm test`. These run the same code the game runs.
import test from 'node:test'; import assert from 'node:assert/strict';
import { Aircraft } from '../src/sim/flightModel.js';
import { TEMPLATES, cloneBlueprint, sanitizeBlueprint, PART_DEFAULTS } from '../src/sim/blueprint.js';
import { hprFromQ } from '../src/sim/vec.js';
import { groundHeight, GRID, Weather, makeEnv, collidePoint, addCollider, clearColliders, surfaceAt, WORLD, HOOPS } from '../src/sim/world.js';
import { hoopCrossed, unlocksFor, JOURNEY, TRIALS } from '../src/game/missions.js';

const flat = (o = {}) => ({ ground: () => 0, normal: () => [0, 1, 0], surface: () => ({ mu: 1, roll: 1, rail: !!o.rail }), wind: o.wind ? () => o.wind : null, rain: o.rain || 0 });
const mod = (key, fn) => { const b = cloneBlueprint(TEMPLATES[key]); fn(b); return b; };
const part = (b, pred) => b.parts.find(pred);
const wingOf = (b) => part(b, (p) => p.type === 'surface' && p.role === 'wing');
// hands-off glide from a height; returns distance, time, attitude extremes
function glide(bp, { h = 2, assist = 0, env = flat(), speed, input = {} } = {}) {
  const ac = new Aircraft(bp), an = ac.analyze(); const events = []; ac.onEvent = (e) => events.push(e);
  ac.reset([0, h, 0], 0, 0, speed ?? (an.trimSpeed || an.stallSpeed * 1.3)); if (env.wind) { const w = env.wind(); ac.vel = ac.vel.map((v, i) => v + w[i]); }
  let t = 0, maxRoll = 0, maxPitch = 0, stalled = false;
  while (t < 40 && !ac.onGround) { ac.update(1 / 60, { pitch: 0, roll: 0, yaw: 0, throttle: 0, assist, ...input }, env); t += 1 / 60; const hp = hprFromQ(ac.q); maxRoll = Math.max(maxRoll, Math.abs(hp.roll)); maxPitch = Math.max(maxPitch, Math.abs(hp.pitch)); if (ac.stall > 0.5) stalled = true; }
  return { ac, an, t, dist: Math.hypot(ac.pos[0], ac.pos[2]), maxRoll, maxPitch, stalled, events };
}
// scripted pilot: full power, rotate at flying speed, hold a climb attitude
function takeoff(bp, { secs = 10, env = flat(), assist = 1, climb = 0.12 } = {}) {
  const ac = new Aircraft(bp), an = ac.analyze(); const events = []; ac.onEvent = (e) => events.push(e);
  ac.reset([0, -ac.lowestY + 0.001, 0], 0, 0, 0); let maxAgl = 0, off = null;
  for (let i = 0; i < secs * 60; i++) { const hp = hprFromQ(ac.q), tgt = ac.airspeed > an.stallSpeed * 1.08 ? climb : 0;
    ac.update(1 / 60, { pitch: Math.max(-1, Math.min(1, (tgt - hp.pitch) * 4 - ac.w[2] * 0.3)), roll: 0, yaw: 0, throttle: 1, assist }, env);
    if (off == null && ac.agl > 0.03) off = ac.t; maxAgl = Math.max(maxAgl, ac.agl); }
  return { ac, an, maxAgl, off, events };
}

test('every template builds, analyses to finite numbers and has sane mass', () => {
  for (const [k, bp] of Object.entries(TEMPLATES)) { const ac = new Aircraft(bp), a = ac.analyze();
    assert.ok(a.mass > 0.0005 && a.mass < 0.03, `${k} mass ${a.mass}`); assert.ok(Number.isFinite(a.cgX));
    if (k !== 'blank') { assert.ok(a.stallSpeed > 1 && a.stallSpeed < 9, `${k} stall ${a.stallSpeed}`); assert.ok(a.yawStable, `${k} should be directionally stable`); } }
});
test('aircraft are mechanically distinct', () => {
  const a = Object.fromEntries(['card_glider', 'paper_dart', 'wright_1903', 'scout_1917', 'racer_1935'].map((k) => [k, new Aircraft(TEMPLATES[k]).analyze()]));
  assert.ok(a.racer_1935.stallSpeed > a.scout_1917.stallSpeed * 1.5); assert.ok(a.scout_1917.maxSpeed > a.wright_1903.maxSpeed * 1.5);
  assert.ok(a.wright_1903.staticMargin < 0, 'the 1903 Flyer is pitch-unstable'); assert.ok(a.scout_1917.staticMargin > 0.1);
  assert.ok(a.wright_1903.climb < 0.4 && a.wright_1903.climb > 0, 'the Flyer is marginally powered'); assert.ok(a.paper_dart.wingLoading < a.card_glider.wingLoading);
});
test('material changes weight, stall speed and glide: cardboard is not steel', () => {
  const card = glide(TEMPLATES.card_glider), steel = glide(mod('card_glider', (b) => { for (const p of b.parts) if (p.material) p.material = 'steel'; }));
  assert.ok(steel.an.mass > card.an.mass * 2.5); assert.ok(steel.an.stallSpeed > card.an.stallSpeed * 1.4); assert.ok(steel.an.gLimit > card.an.gLimit);
  assert.ok(card.t > steel.t * 1.3, `card stays up longer (${card.t.toFixed(1)} vs ${steel.t.toFixed(1)} s)`);
});
test('wing geometry affects performance', () => {
  const base = new Aircraft(TEMPLATES.card_glider).analyze(), small = glide(mod('card_glider', (b) => { wingOf(b).span = 0.09; })), big = new Aircraft(mod('card_glider', (b) => { wingOf(b).span = 0.3; })).analyze();
  assert.ok(small.an.stallSpeed > base.stallSpeed * 1.2); assert.ok(big.stallSpeed < base.stallSpeed); assert.ok(big.gLimit < base.gLimit, 'longer wings are weaker');
  assert.ok(small.dist < glide(TEMPLATES.card_glider).dist * 0.8, 'under-winged glider falls short');
});
test('mass and balance affect stability; a tail-heavy design fails in flight', () => {
  const good = glide(TEMPLATES.card_glider), bad = glide(mod('card_glider', (b) => { part(b, (p) => p.type === 'ballast').x = 0.15; }), { speed: 3.4 });
  assert.ok(bad.an.staticMargin < 0 && good.an.staticMargin > 0.05); assert.ok(bad.an.warnings.some((w) => /Tail-heavy/.test(w.msg)));
  assert.ok(good.maxPitch < 0.35 && good.maxRoll < 0.2, 'stable design flies straight hands-off'); assert.ok(bad.maxPitch > 0.8 || bad.stalled, 'tail-heavy design pitches up / stalls');
  assert.ok(good.dist > bad.dist * 1.5);
});
test('controls: pitch, roll and yaw respond in the right sense', () => {
  const run = (input) => { const ac = new Aircraft(TEMPLATES.scout_1917); ac.reset([0, 5, 0], 0, 0, 5); for (let i = 0; i < 12; i++) ac.update(1 / 60, { pitch: 0, roll: 0, yaw: 0, throttle: 0.7, assist: 0, ...input }, flat()); return { hp: hprFromQ(ac.q), w: ac.w }; };
  const n = run({}), up = run({ pitch: 1 }), right = run({ roll: 1 }), yawR = run({ yaw: 1 });
  assert.ok(up.hp.pitch > n.hp.pitch + 0.08, 'stick back raises the nose'); assert.ok(right.hp.roll > n.hp.roll + 0.12, 'stick right rolls right');
  let dh = yawR.hp.heading - n.hp.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); assert.ok(dh > 0.015, 'right rudder swings the nose right');
});
test('stall: pulling too hard separates the flow and lift collapses', () => {
  const ac = new Aircraft(TEMPLATES.scout_1917); ac.reset([0, 8, 0], 0, 0, 4.2); let stalled = false, minG = 9;
  for (let i = 0; i < 150; i++) { ac.update(1 / 60, { pitch: 1, roll: 0, yaw: 0, throttle: 0, assist: 0 }, flat()); if (ac.stall > 0.5) { stalled = true; minG = Math.min(minG, ac.gLoad); } }
  assert.ok(stalled); assert.ok(minG < 0.8, 'post-stall lift is well below weight');
});
test('accessible assist recovers the same stall attempt', () => {
  const frac = (assist) => { const ac = new Aircraft(TEMPLATES.scout_1917); ac.reset([0, 8, 0], 0, 0, 4.2); let n = 0; for (let i = 0; i < 300; i++) { ac.update(1 / 60, { pitch: 1, roll: 0, yaw: 0, throttle: 1, assist }, flat()); if (ac.stall > 0.5 && !ac.onGround) n++; } return n / 300; };
  const a1 = frac(1), a0 = frac(0); assert.ok(a1 < 0.08 && a1 < a0 * 0.5, `stalled ${(a1 * 100).toFixed(0)}% of the time with assist vs ${(a0 * 100).toFixed(0)}% without`);
});
test('powered aircraft take off; propulsion types differ', () => {
  const scout = takeoff(TEMPLATES.scout_1917), flyer = takeoff(TEMPLATES.wright_1903, { env: flat({ rail: true }), secs: 12, climb: 0.07 }), racer = takeoff(TEMPLATES.racer_1935);
  assert.ok(scout.maxAgl > 3 && scout.ac.condition > 0.95, `scout climbed ${scout.maxAgl.toFixed(1)} m`); assert.ok(racer.maxAgl > 5);
  assert.ok(flyer.off != null && flyer.maxAgl > 0.3 && flyer.maxAgl < scout.maxAgl / 3, `Flyer barely climbs (${flyer.maxAgl.toFixed(2)} m)`); assert.ok(flyer.off > scout.off);
  const rubber = takeoff(mod('card_glider', (b) => { b.parts.push({ ...PART_DEFAULTS.engine(), id: 'e', kind: 'rubber' }, { ...PART_DEFAULTS.gear(), id: 'g', height: 0.03 }); }), { secs: 40 });
  assert.equal(rubber.ac.engines[0].energy, 0, 'a rubber motor unwinds completely and cannot be throttled');
  const e = new Aircraft(mod('card_glider', (b) => { b.parts.push({ ...PART_DEFAULTS.engine(), id: 'e', kind: 'electric' }); }));
  e.reset([0, 5, 0], 0, 0, 4); for (let i = 0; i < 25; i++) e.update(1 / 60, { pitch: 0, roll: 0, yaw: 0, throttle: 0.5, assist: 1 }, flat()); assert.ok(e.engines[0].level > 0.45 && e.engines[0].level < 0.55, 'electric motor follows the throttle');
});
test('rotary engine torque and gyroscopics make the scout asymmetric', () => {
  const ac = new Aircraft(TEMPLATES.scout_1917); ac.reset([0, 5, 0], 0, 0, 5); for (let i = 0; i < 90; i++) ac.update(1 / 60, { pitch: 0, roll: 0, yaw: 0, throttle: 1, assist: 0 }, flat());
  assert.ok(hprFromQ(ac.q).roll < -0.05, 'hands-off at full power it rolls left against the propeller');
});
test('landing softly is free; crashing breaks things; repair restores them', () => {
  const soft = new Aircraft(TEMPLATES.scout_1917); soft.reset([0, 0.06, 0], 0, 0.05, 4.2); for (let i = 0; i < 400; i++) soft.update(1 / 60, { pitch: 0.25, roll: 0, yaw: 0, throttle: 0, assist: 1 }, flat());
  assert.ok(soft.condition > 0.97, `gentle arrival keeps the airframe intact (${soft.condition.toFixed(2)})`);
  const hard = new Aircraft(TEMPLATES.scout_1917), ev = []; hard.onEvent = (e) => ev.push(e.type); hard.reset([0, 1, 0], 0, -1.4, 8); for (let i = 0; i < 200; i++) hard.update(1 / 60, { pitch: 0, roll: 0, yaw: 0, throttle: 1, assist: 0 }, flat());
  assert.ok(hard.destroyed && ev.includes('damage') && hard.condition < 0.7); assert.ok(hard.damageReport().length > 0);
  hard.repair(); assert.equal(hard.condition, 1); assert.equal(hard.destroyed, false); assert.equal(hard.damageReport().length, 0);
});
test('a damaged wing no longer flies like a whole one', () => {
  const a = glide(TEMPLATES.card_glider, { assist: 0 }), bp = cloneBlueprint(TEMPLATES.card_glider), ac = new Aircraft(bp); ac.surfs.find((s) => s.isMain).health = [1, 0.25];
  ac.reset([0, 2, 0], 0, 0, 3.4); let roll = 0; for (let i = 0; i < 120 && !ac.onGround; i++) { ac.update(1 / 60, { pitch: 0, roll: 0, yaw: 0, throttle: 0, assist: 0 }, flat()); roll = Math.max(roll, Math.abs(hprFromQ(ac.q).roll)); }
  assert.ok(roll > a.maxRoll + 0.3, 'asymmetric lift rolls the aircraft');
});
test('structure: an over-stressed weak wing folds', () => {
  const bp = mod('card_glider', (b) => { const w = wingOf(b); w.material = 'paper'; w.span = 0.34; w.chord = 0.04; }), ac = new Aircraft(bp), ev = []; ac.onEvent = (e) => ev.push(e.type);
  assert.ok(ac.analyze().gLimit < 2); ac.reset([0, 10, 0], 0, -0.5, 9); for (let i = 0; i < 120; i++) ac.update(1 / 60, { pitch: 1, roll: 0, yaw: 0, throttle: 0, assist: 0 }, flat());
  assert.ok(ev.includes('structure'), 'wing failure event raised'); assert.ok(ac.surfs.some((s) => s.failed[0] || s.failed[1]));
});
test('weather: rain soaks cardboard but not aluminium; wind changes ground distance', () => {
  const soak = (m) => { const ac = new Aircraft(mod('card_glider', (b) => { for (const p of b.parts) if (p.material) p.material = m; })); const m0 = ac.mass; ac.reset([0, -ac.lowestY, 0], 0, 0, 0); ac.asleep = false; for (let i = 0; i < 1500; i++) ac._step(1 / 60, { pitch: 0, roll: 0, yaw: 0, throttle: 0 }, flat({ rain: 1 })); return ac.mass / m0; };
  assert.ok(soak('card') > 1.2); assert.equal(soak('aluminum'), 1);
  const still = glide(TEMPLATES.card_glider), head = glide(TEMPLATES.card_glider, { env: flat({ wind: [0, 0, 1.5] }) }), tail = glide(TEMPLATES.card_glider, { env: flat({ wind: [0, 0, -1.5] }) });
  assert.ok(head.dist < still.dist * 0.8 && tail.dist > still.dist * 1.2, `head ${head.dist.toFixed(1)} < still ${still.dist.toFixed(1)} < tail ${tail.dist.toFixed(1)}`);
});
test('blueprints: serialisation round-trip, clamping and junk rejection', () => {
  const b = sanitizeBlueprint(JSON.parse(JSON.stringify(TEMPLATES.scout_1917))); assert.equal(b.parts.length, TEMPLATES.scout_1917.parts.length);
  assert.ok(Math.abs(new Aircraft(b).mass - new Aircraft(TEMPLATES.scout_1917).mass) < 1e-9);
  assert.equal(sanitizeBlueprint(null), null); assert.equal(sanitizeBlueprint({ parts: 'x' }), null);
  const w = sanitizeBlueprint({ name: 'x', parts: [{ type: 'surface', span: 999, chord: -5, material: 'unobtainium', airfoil: 'flat' }, { type: 'bogus' }] });
  const s = w.parts.find((p) => p.type === 'surface'); assert.equal(s.span, 0.5); assert.equal(s.chord, 0.008); assert.ok(s.material !== 'unobtainium');
  assert.ok(w.parts.some((p) => p.type === 'fuselage') && w.parts.some((p) => p.type === 'pilot'), 'missing essentials are restored'); assert.doesNotThrow(() => new Aircraft(w).analyze());
});
test('world: terrain grid, surfaces, colliders, weather and course logic', () => {
  assert.ok(Math.abs(groundHeight(0.05, 0.05) - GRID.data[220 * 441 + 220]) < 0.01); assert.ok(groundHeight(WORLD.hill.x, WORLD.hill.z) > 1.2, 'the hill is a hill');
  assert.equal(surfaceAt(WORLD.pond.x, WORLD.pond.z).name, 'water'); assert.equal(surfaceAt(WORLD.rail.x0 + 1, WORLD.rail.z).rail, true); assert.ok(surfaceAt(WORLD.mud.x, WORLD.mud.z).roll > 3);
  clearColliders(); addCollider({ t: 'cyl', x: 5, z: 5, r: 0.1, y0: 0, y1: 1 }); assert.ok(collidePoint([5.05, 0.5, 5]).depth > 0.04); assert.equal(collidePoint([5.2, 0.5, 5]), null); clearColliders();
  const w = new Weather(); w.set('gusty', true); const hi = Math.hypot(...w.wind([0, 3, 8])), lo = Math.hypot(...w.wind([0, groundHeight(0, 8) + 0.02, 8])); assert.ok(hi > lo, 'wind is sheltered near the ground');
  assert.ok(w.wind([WORLD.half + 3, 2, 0])[0] < -3, 'fence draft turns aircraft back'); assert.ok(makeEnv(w).surface(0, 0).name);
  const h = HOOPS[0], n = [Math.sin(h.h), 0, -Math.cos(h.h)]; assert.ok(hoopCrossed(h, [h.x - n[0], h.y, h.z - n[2]], [h.x + n[0], h.y, h.z + n[2]])); assert.ok(!hoopCrossed(h, [h.x - n[0], h.y + 1, h.z - n[2]], [h.x + n[0], h.y + 1, h.z + n[2]]));
  assert.ok(unlocksFor(0, false).engines.length === 0 && unlocksFor(0, true).engines.length >= 6); assert.ok(JOURNEY.length >= 7 && TRIALS.length === 3);
});
