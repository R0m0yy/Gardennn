import { Aircraft } from '../src/sim/flightModel.js';
import { TEMPLATES } from '../src/sim/blueprint.js';
import { hprFromQ } from '../src/sim/vec.js';
const env = { ground: () => 0, normal: () => [0, 1, 0], surface: () => ({ mu: 1, roll: 1 }) };
for (const k of Object.keys(TEMPLATES)) {
  if (k === 'blank') continue;
  const ac = new Aircraft(TEMPLATES[k]); const a = ac.analyze();
  const f = (x, d = 2) => x == null ? 'n/a' : x.toFixed(d);
  console.log(`\n== ${k}: m=${f(a.mass * 1000)}g S=${f(a.wingArea * 1e4, 0)}cm2 WL=${f(a.wingLoading)} cg=${f(a.cgX * 1000, 0)}mm np=${f(a.npX * 1000, 0)}mm SM=${f(a.staticMargin)} Vs=${f(a.stallSpeed)} Vtrim=${f(a.trimSpeed)} aTrim=${f(a.trimAlpha, 1)} L/Dtrim=${f(a.trimGlide)} best=${f(a.bestGlide)} T/W=${f(a.thrustToWeight)} Vmax=${f(a.maxSpeed)} climb=${f(a.climb)} g=${f(a.gLimit, 1)} yaw=${a.yawStable} roll=${a.rollStab.toExponential(1)}`);
  a.warnings.forEach((w) => console.log('   ', w.lvl, w.msg));
  // free glide from 2 m, hands off
  ac.reset([0, 2, 0], 0, 0, (a.trimSpeed || a.stallSpeed * 1.3)); ac.onEvent = (e) => e.type !== 'touch' && console.log('    ev', e.t.toFixed(1), e.msg);
  let t = 0; const inp = { pitch: 0, roll: 0, yaw: 0, throttle: 0, assist: 0 };
  while (t < 30 && !(ac.onGround)) { ac.update(1 / 60, inp, env); t += 1 / 60; }
  const h = hprFromQ(ac.q);
  console.log(`   glide: t=${t.toFixed(1)}s dist=${Math.hypot(ac.pos[0], ac.pos[2]).toFixed(1)}m roll=${(h.roll * 57.3).toFixed(0)} hdg=${(h.heading * 57.3).toFixed(0)} cond=${ac.condition.toFixed(2)}`);
}
