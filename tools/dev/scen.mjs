// scripted "player" flights used for tuning: ground start, throttle up, rotate, climb, cut, glide, land
import { Aircraft } from '../../src/sim/flightModel.js';
import { TEMPLATES } from '../../src/sim/blueprint.js';
import { hprFromQ } from '../../src/sim/vec.js';
const k = process.argv[2], assist = +(process.argv[3] ?? 1), rail = process.argv[4] === 'rail', wind = +(process.argv[5] || 0);
const env = { ground: () => 0, normal: () => [0, 1, 0], surface: () => ({ mu: 1, roll: 1, rail }), wind: () => [0, 0, wind] }; // heading 0 = -Z, so +Z wind is a headwind
const ac = new Aircraft(TEMPLATES[k]); const a = ac.analyze();
ac.reset([0, -ac.lowestY + 0.001, 0], 0, 0, 0); ac.onEvent = (e) => e.type !== 'touch' && console.log('  ev', e.t.toFixed(1), e.msg);
const inp = { pitch: 0, roll: 0, yaw: 0, throttle: 1, assist };
let maxAlt = 0, liftoff = null;
for (let i = 0; i < 60 * 40; i++) {
  const h = hprFromQ(ac.q), t = ac.t;
  const cut = t > 14;
  inp.throttle = cut ? 0 : 1;
  const tgt = cut ? -0.06 : (ac.airspeed > a.stallSpeed * 1.08 ? 0.12 : 0.0);
  inp.pitch = Math.max(-1, Math.min(1, (tgt - h.pitch) * 4 - ac.w[2] * 0.3));
  if (cut && ac.agl < 0.15) inp.pitch = Math.max(-1, Math.min(1, (0.06 - h.pitch) * 4 - ac.w[2] * 0.3)); // flare
  inp.roll = (t > 5 && t < 9) ? 0.5 : 0;
  ac.update(1 / 60, inp, env);
  if (!ac.onGround && liftoff == null && ac.agl > 0.02) liftoff = { t: ac.t, d: Math.hypot(ac.pos[0], ac.pos[2]) };
  maxAlt = Math.max(maxAlt, ac.agl);
  if (i % 60 === 0) console.log(`t=${t.toFixed(1)} V=${ac.airspeed.toFixed(2)} gs=${Math.hypot(ac.vel[0], ac.vel[2]).toFixed(2)} agl=${ac.agl.toFixed(2)} pitch=${(h.pitch * 57.3).toFixed(0)} roll=${(h.roll * 57.3).toFixed(0)} hdg=${(h.heading * 57.3).toFixed(0)} a=${(ac.alpha * 57.3).toFixed(1)} st=${ac.stall.toFixed(2)} thr=${ac.engines[0]?.thrust.toFixed(3)} e=${ac.engines[0]?.energy.toFixed(2)} g=${ac.gLoad.toFixed(1)} str=${ac.maxStress.toFixed(2)}`);
  if (ac.asleep && t > 3) break;
}
console.log('liftoff', liftoff, 'maxAlt', maxAlt.toFixed(2), 'cond', ac.condition.toFixed(2), 'final dist', Math.hypot(ac.pos[0], ac.pos[2]).toFixed(1));
