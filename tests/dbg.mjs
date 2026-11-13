import { Aircraft } from '../src/sim/flightModel.js';
import { TEMPLATES } from '../src/sim/blueprint.js';
import { hprFromQ } from '../src/sim/vec.js';
const env = { ground: () => 0, normal: () => [0, 1, 0], surface: () => ({ mu: 1, roll: 1 }) };
const k = process.argv[2] || 'card_glider', assist = +(process.argv[3] || 0);
const ac = new Aircraft(TEMPLATES[k]); const a = ac.analyze();
ac.reset([0, 3, 0], 0, 0, a.trimSpeed || a.stallSpeed * 1.3);
const inp = { pitch: 0, roll: 0, yaw: 0, throttle: +(process.argv[4] || 0), assist };
for (let i = 0; i < 400 && !ac.onGround; i++) { ac.update(1 / 60, inp, env); const h = hprFromQ(ac.q);
  if (i % 12 === 0) console.log(`t=${ac.t.toFixed(2)} V=${ac.airspeed.toFixed(2)} y=${ac.pos[1].toFixed(2)} pitch=${(h.pitch * 57.3).toFixed(1)} roll=${(h.roll * 57.3).toFixed(1)} hdg=${(h.heading * 57.3).toFixed(0)} a=${(ac.alpha * 57.3).toFixed(1)} slip=${(ac.slip * 57.3).toFixed(1)} w=${ac.w.map((x) => x.toFixed(2))} g=${ac.gLoad.toFixed(2)}`); }
