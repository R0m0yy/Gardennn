// Inventor's Journey steps, Historical Trials and the technology timeline. Pure data + small predicates.
import { HOOPS } from '../sim/world.js';

// What the Journey has unlocked at each step (Sandbox ignores this and unlocks everything).
const BASE = { materials: ['paper', 'card', 'corrugated'], engines: [], templates: ['card_glider', 'paper_dart', 'blank'], gear: false, bracing: false };
const UNLOCKS = [
  {}, {}, {},
  { materials: ['balsa', 'timber'], engines: ['rubber'], note: 'Balsa, spruce and the rubber-band motor' },
  { materials: ['fabric'], engines: ['wright'], templates: ['hill_glider', 'wright_1903'], bracing: true, gear: true, note: 'Wood-and-fabric construction, wire bracing, skids and the 1903 engine' },
  { engines: ['rotary'], templates: ['scout_1917'], note: 'Wheels and the rotary engine' },
  { materials: ['plastic', 'aluminum', 'steel', 'composite'], engines: ['electric', 'electricL', 'inline', 'jet'], templates: ['racer_1935'], note: 'Every material and engine in the catalogue' },
];
export function unlocksFor(step, sandbox) {
  const u = { materials: [...BASE.materials], engines: [], templates: [...BASE.templates], gear: false, bracing: false };
  const upTo = sandbox ? UNLOCKS.length - 1 : Math.min(step, UNLOCKS.length - 1);
  for (let i = 0; i <= upTo; i++) { const s = UNLOCKS[i]; if (s.materials) u.materials.push(...s.materials); if (s.engines) u.engines.push(...s.engines); if (s.templates) u.templates.push(...s.templates); if (s.gear) u.gear = true; if (s.bracing) u.bracing = true; }
  return u;
}
export const unlockNote = (step) => (UNLOCKS[step] && UNLOCKS[step].note) || null;

// Each step: title, text, and done(ev) where ev = {type:'station'|'build'|'flight', ...}
export const JOURNEY = [
  { title: 'Wake up, inventor', text: 'Walk to the design bench at the back of the workshop and open it.', hint: 'WASD / stick to move, Shift to run, E to use', done: (e) => e.type === 'station' && e.id === 'bench' },
  { title: 'Your first flying machine', text: 'Pick the Cereal-Box Glider or the Paper Dart, change anything you like, then press Build prototype.', hint: 'Watch the mass, balance and stability read-outs change as you edit', done: (e) => e.type === 'build' },
  { title: 'Leap of faith', text: 'Take the prototype to Glider Hill and launch it. Any flight counts - even a bad one teaches you something.', hint: 'Use the prototype on the deck (E). Hold Space to draw the catapult, release to launch', done: (e) => e.type === 'flight' && e.r.duration > 0.6 },
  { title: 'Make it better', text: 'Glide at least 9 metres from the hill. Read the flight report, then change the design: wing area, balance, tail, trim.', hint: 'A glider flies furthest near its best glide speed - not too slow, not diving', done: (e) => e.type === 'flight' && e.r.distance >= 9 && e.r.energyUsed === 0, goal: (e) => `${e.r.distance.toFixed(1)} / 9 m` },
  { title: 'Add power', text: 'Fit a rubber-band motor and stay airborne for 8 seconds of powered flight.', hint: 'Engines add weight up front or behind: re-check the balance', done: (e) => e.type === 'flight' && e.r.duration >= 8 && e.r.energyUsed > 0, goal: (e) => `${e.r.duration.toFixed(1)} / 8 s` },
  { title: '1903: twelve seconds', text: 'Fly the Pioneer Flyer from the launch rail: stay airborne for 12 seconds and bring it down in one piece.', hint: 'It has no throttle and is unstable in pitch. Small, early corrections', done: (e) => e.type === 'flight' && e.r.base === 'wright_1903' && e.r.duration >= 12 && e.r.ok, goal: (e) => `${e.r.duration.toFixed(1)} / 12 s` },
  { title: '1917: the Sunflower Circuit', text: 'Take the Rotary Scout off the grass runway, fly through all four red hoops and land.', hint: 'The spinning engine drags it left. Hold a little right stick on take-off', done: (e) => e.type === 'flight' && e.r.hoops >= 4 && e.r.ok, goal: (e) => `${e.r.hoops || 0} / 4 hoops` },
  { title: 'The garden is yours', text: 'Everything is unlocked. Invent something history never tried.', hint: 'Three wings? A steel glider? A jet-powered cereal box? Test it.', done: () => false },
];

export const TRIALS = [
  { id: 'hill1894', year: 1894, title: 'The Hill', bp: 'hill_glider', site: 'hill', weather: 'breeze', windDir: Math.PI / 2,
    brief: 'Before engines there were hills. Launch the bat-winged glider into the breeze and glide at least 7 metres, landing intact.',
    score: (r) => ({ pass: r.distance >= 7 && r.ok && r.condition > 0.8, value: `${r.distance.toFixed(1)} m`, medal: r.distance >= 14 ? 'gold' : r.distance >= 10 ? 'silver' : 'bronze' }) },
  { id: 'flyer1903', year: 1903, title: 'Twelve Seconds', bp: 'wright_1903', site: 'rail', weather: 'breeze', windDir: Math.PI / 2,
    brief: 'A cold December headwind, a sixty-foot rail, twelve horsepower. Stay in the air for 12 seconds and land without wrecking the machine. The first flight lasted exactly that long.',
    score: (r) => ({ pass: r.duration >= 12 && r.ok, value: `${r.duration.toFixed(1)} s`, medal: r.duration >= 59 ? 'gold' : r.duration >= 25 ? 'silver' : 'bronze' }) },
  { id: 'scout1917', year: 1917, title: 'Sunflower Circuit', bp: 'scout_1917', site: 'runway', weather: 'calm', windDir: Math.PI / 2,
    brief: 'Fourteen years later aircraft could climb, turn and fight. Take off, thread all four hoops in any order, and land on the grass.',
    score: (r) => ({ pass: r.hoops >= 4 && r.ok, value: `${r.hoops || 0}/4 hoops in ${r.duration.toFixed(0)} s`, medal: r.duration <= 45 ? 'gold' : r.duration <= 70 ? 'silver' : 'bronze' }) },
];

// hoop pass detection: did the segment a->b cross the hoop plane inside the ring?
export function hoopCrossed(h, a, b) {
  const nx = Math.sin(h.h), nz = -Math.cos(h.h);
  const da = (a[0] - h.x) * nx + (a[2] - h.z) * nz, db = (b[0] - h.x) * nx + (b[2] - h.z) * nz;
  if (da * db > 0) return false;
  const t = da / (da - db || 1e-9), x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t;
  return Math.hypot(x - h.x, y - h.y, z - h.z) < h.r;
}
export { HOOPS };

export const TIMELINE = [
  { year: '1799', title: 'The idea of the aeroplane', text: 'George Cayley separates lift, thrust and control into three problems and engraves a fixed-wing glider on a silver disc. Everything afterwards follows this split.', problem: 'Flapping like a bird could never carry a person.' },
  { year: '1891-96', title: 'Hill gliders', text: 'Otto Lilienthal makes some two thousand glides on arched cotton wings, steering by swinging his body. He proves curved wings out-lift flat ones, and that control is the unsolved problem.', problem: 'How do you stay balanced in moving air?', template: 'hill_glider', trial: 'hill1894' },
  { year: '1903', title: 'Powered, controlled flight', text: 'The Wright brothers add three things: wing-warping for roll, a light petrol engine, and efficient propellers treated as rotating wings. Their Flyer is barely stable and barely powered, yet it flies four times on 17 December.', problem: 'Roll control, and an engine light enough to lift itself.', template: 'wright_1903', trial: 'flyer1903' },
  { year: '1909-13', title: 'Tractor monoplanes & ailerons', text: 'Engines move to the nose, tails move to the back, hinged ailerons replace warping. The layout still used today takes shape and aircraft become stable enough to fly hands-off.', problem: 'Canards and warping were twitchy and structurally weak.' },
  { year: '1914-18', title: 'The Great War', text: 'In four years speed doubles and climb triples. Rotary engines spin with the propeller for cooling; their gyroscopic kick makes fighters turn viciously one way. Wire-braced biplanes give stiffness that single wings could not yet manage.', problem: 'Power, agility and strength at the same time.', template: 'scout_1917', trial: 'scout1917' },
  { year: '1920s-30s', title: 'Metal, streamlining, speed', text: 'Stressed aluminium skin carries the loads, so struts and wires disappear. Retractable gear, cowlings and flaps follow. Drag falls by half; racers pass 600 km/h.', problem: 'Bracing wires were strong but cost enormous drag.', template: 'racer_1935' },
  { year: '1939-45', title: 'Piston peak and the first jets', text: 'Piston engines reach two thousand horsepower and propellers hit their limit as blade tips approach the speed of sound. The turbojet, with no propeller at all, breaks through.', problem: 'Propellers lose their grip on the air at high speed.' },
  { year: '1950s-today', title: 'Jets, rotors and composites', text: 'Swept wings, helicopters, carbon fibre and electric motors. Small electric aircraft now do what rubber bands did for model builders a century ago.', problem: 'Lighter, stronger, cleaner.' },
];
