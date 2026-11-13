// usage: node tests/try.mjs template 'json-patch: {partIndex:{field:val}, trim:x}'
import { Aircraft } from '../src/sim/flightModel.js';
import { TEMPLATES } from '../src/sim/blueprint.js';
const b = JSON.parse(JSON.stringify(TEMPLATES[process.argv[2]])); const patch = JSON.parse(process.argv[3] || '{}');
for (const [k, v] of Object.entries(patch)) { if (k === 'trim') b.trim = v; else Object.assign(b.parts[+k], v); }
const ac = new Aircraft(b), a = ac.analyze(); const f = (x, d = 2) => x == null ? 'n/a' : x.toFixed(d);
console.log(`m=${f(a.mass * 1000)}g cg=${f(a.cgX * 1000, 0)} np=${f(a.npX * 1000, 0)} SM=${f(a.staticMargin)} Vs=${f(a.stallSpeed)} Vtrim=${f(a.trimSpeed)} aTrim=${f(a.trimAlpha, 1)} L/D=${f(a.trimGlide)} best=${f(a.bestGlide)} T/W=${f(a.thrustToWeight)} Vmax=${f(a.maxSpeed)} climb=${f(a.climb)} g=${f(a.gLimit, 1)} yaw=${a.yawStable}`);
a.warnings.forEach((w) => console.log('   ', w.lvl, w.msg));
