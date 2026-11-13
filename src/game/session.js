// A prototype standing in the world (Craft) and one test flight of it (FlightSession):
// controls -> physics -> recording -> post-flight analysis.
import { Aircraft } from '../sim/flightModel.js';
import { ENGINES, MATERIALS } from '../sim/catalog.js';
import { groundHeight, SITES } from '../sim/world.js';
import { hprFromQ, clamp } from '../sim/vec.js';
import { buildAircraftMesh, updateAircraftMesh, disposeAircraftMesh } from '../gfx/aircraftMesh.js';

// The whole miniature world runs in "small-creature time": physics is real, but shown at 0.4x speed,
// the same trick film-makers use to make models look full-size. Reported times/speeds are true values.
export const TIME_SCALE = 0.4;

export class Craft {
  constructor(scene, bp) {
    this.scene = scene; this.bp = bp; this.ac = new Aircraft(bp);
    this.mesh = buildAircraftMesh(bp, this.ac.cg, { showPilot: true }); this.mesh.userData.pilot.visible = false; scene.add(this.mesh);
    this.analysis = this.ac.analyze(); this.carried = false;
  }
  restHeight(x, z) { return groundHeight(x, z) - this.ac.lowestY + 0.0015; }
  place(x, z, heading, y = null) { this.ac.reset([x, y ?? this.restHeight(x, z), z], heading, 0, 0); this.ac.asleep = false; this.sync(0.016); }
  sync(dt) { const a = this.ac; this.mesh.position.set(a.pos[0], a.pos[1], a.pos[2]); this.mesh.quaternion.set(a.q[0], a.q[1], a.q[2], a.q[3]); updateAircraftMesh(this.mesh, a, dt); }
  setPilot(on) { this.mesh.userData.pilot.visible = on; }
  dispose() { this.scene.remove(this.mesh); disposeAircraftMesh(this.mesh); }
}

export class FlightSession {
  constructor(game, craft, siteKey) {
    this.game = game; this.craft = craft; this.ac = craft.ac; this.siteKey = siteKey; this.site = SITES[siteKey] || null;
    this.state = this.site && this.site.kind === 'hill' ? 'ready' : 'flying';
    this.charge = 0; this.throttle = 0; this.ctl = { pitch: 0, roll: 0, yaw: 0 };
    this.rec = []; this.recT = 0; this.events = []; this.t = 0; this.air = 0; this.path = 0; this.maxAlt = 0; this.maxV = 0; this.vSum = 0; this.maxG = 1; this.minG = 1; this.stalls = 0; this.wasStalled = false;
    this.everAir = false; this.endT = 0; this.touchV = null; this.launchSpeed = 0; this.start = this.ac.pos.slice(); this.energy0 = this.ac.engines.map((e) => e.energy);
    this.ac.events.length = 0;
    this.ac.onEvent = (e) => this.onEvent(e);
    this.hasThrottle = this.ac.engines.length > 0; this.engKind = this.hasThrottle ? this.ac.engines[0].spec : null;
  }
  onEvent(e) {
    const g = this.game, a = g.audio;
    if (e.type === 'touch') { this.touchV = e.v; a.play(e.v > 1.6 ? 'thud' : 'land', clamp(e.v, 0.3, 2)); if (e.v > 1) g.rig.shake = Math.min(1.5, e.v * 0.5); return; }
    this.events.push({ t: this.t, type: e.type, msg: e.msg, pos: this.ac.pos.slice() });
    if (e.type === 'damage') { a.play('crunch', 0.7); g.rig.shake = 1; } else if (e.type === 'structure') { a.play('snap'); g.rig.shake = 1.2; } else if (e.type === 'destroyed') { a.play('crunch', 1.4); g.rig.shake = 2; } else if (e.type === 'splash') a.play('splash');
    g.toast(e.msg, e.type === 'splash' ? 'info' : 'bad');
  }
  // dt: real seconds
  update(dt, inp) {
    const g = this.game, ac = this.ac, set = g.save.settings, sdt = dt * TIME_SCALE;
    // ---- read controls
    const inv = set.invertPitch ? -1 : 1, pad = inp.pad;
    let tp = inp.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']) * inv + inp.stick.y + (pad ? pad.ly : 0);
    let tr = inp.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']) + inp.stick.x + (pad ? pad.lx : 0);
    let ty = inp.axis(['KeyQ'], ['KeyE']) + (pad ? 0 : 0);
    const k = Math.min(1, dt * 7);
    this.ctl.pitch += (clamp(tp, -1, 1) - this.ctl.pitch) * k; this.ctl.roll += (clamp(tr, -1, 1) - this.ctl.roll) * k; this.ctl.yaw += (clamp(ty, -1, 1) - this.ctl.yaw) * k;
    const up = inp.down('ShiftLeft', 'ShiftRight', 'KeyR') || (pad && pad.rt > 0.3), dn = inp.down('ControlLeft', 'ControlRight', 'KeyF') || (pad && pad.lt > 0.3);
    if (this.hasThrottle) { if (this.engKind.throttle === 'none') { if (up) this.throttle = 1; if (dn) this.throttle = 0; } else this.throttle = clamp(this.throttle + ((up ? 1 : 0) - (dn ? 1 : 0)) * dt * 0.9, 0, 1); }
    if (inp.down('KeyT')) ac.trim = clamp(ac.trim + dt * 0.25, -1, 1); if (inp.down('KeyG')) ac.trim = clamp(ac.trim - dt * 0.25, -1, 1);
    const input = { pitch: this.ctl.pitch, roll: this.ctl.roll, yaw: this.ctl.yaw, throttle: this.throttle, assist: set.flightModel === 'accessible' ? 1 : 0.12 };

    if (this.state === 'ready') { // sitting on the catapult
      if (inp.down('Space')) { this.charge = Math.min(1, this.charge + dt / 1.6); this.charging = true; }
      else if (this.charging) { this.launch(2 + 5.5 * this.charge); }
      this.craft.sync(dt); return;
    }
    if (this.state !== 'flying') return;
    this.t += sdt;
    const p0 = ac.pos.slice();
    ac.update(sdt, input, g.env);
    this.craft.sync(dt);
    // ---- bookkeeping
    const airborne = !ac.onGround && !ac.inWater;
    if (airborne) { this.air += sdt; this.vSum += ac.airspeed * sdt; if (this.air > 0.25) this.everAir = true; }
    this.path += Math.hypot(ac.pos[0] - p0[0], ac.pos[2] - p0[2]);
    this.maxAlt = Math.max(this.maxAlt, ac.pos[1] - this.start[1]); this.maxV = Math.max(this.maxV, ac.airspeed);
    if (airborne) { this.maxG = Math.max(this.maxG, ac.gLoad); this.minG = Math.min(this.minG, ac.gLoad); }
    const st = ac.stall > 0.5 && airborne && ac.airspeed > 1 && ac.agl > 0.04; if (st && !this.wasStalled) { this.stalls++; this.events.push({ t: this.t, type: 'stall', msg: `Stall at ${ac.airspeed.toFixed(1)} m/s`, pos: ac.pos.slice() }); } this.wasStalled = st;
    this.recT -= sdt; if (this.recT <= 0) { this.recT = 0.1; this.rec.push([this.t, ac.pos[0], ac.pos[1], ac.pos[2], ac.airspeed, ac.agl, ac.alpha, ac.stall, this.throttle, ac.gLoad]); }
    // ---- end conditions
    const stopped = ac.asleep || (ac.destroyed && Math.hypot(...ac.vel) < 0.3);
    if (stopped && (this.everAir || ac.destroyed || ac.inWater)) { this.endT += dt; if (this.endT > 1.2) this.finish(); } else this.endT = 0;
  }
  launch(speed) {
    const ac = this.ac, hp = hprFromQ(ac.q); this.launchSpeed = speed;
    ac.reset(ac.pos.slice(), hp.heading, 0.04, speed); ac.pos[1] += 0.02; this.state = 'flying'; this.game.audio.play('twang');
  }
  get canEnd() { return this.state === 'flying' && (this.ac.onGround || this.ac.inWater) && Math.hypot(...this.ac.vel) < 0.4; }
  finish() {
    if (this.state === 'ended') return; this.state = 'ended'; this.ac.onEvent = null;
    this.report = this.buildReport(); this.game.onFlightEnd(this);
  }
  buildReport() {
    const ac = this.ac, an = this.craft.analysis, dist = Math.hypot(ac.pos[0] - this.start[0], ac.pos[2] - this.start[2]);
    const dmg = ac.damageReport(), cond = ac.condition;
    const outcome = ac.destroyed ? 'Destroyed' : ac.inWater ? 'Ditched in the pond' : dmg.length ? 'Landed damaged' : this.everAir ? 'Landed intact' : 'Never left the ground';
    const used = ac.engines.length ? 1 - ac.engines[0].energy / (this.energy0[0] || 1) : 0;
    const r = { when: Date.now(), name: this.craft.bp.name, bpId: this.craft.bp.id, site: this.site ? this.site.name : 'Open field', outcome, ok: !ac.destroyed && this.everAir,
      duration: this.air, distance: dist, path: this.path, maxAlt: this.maxAlt, maxSpeed: this.maxV, avgSpeed: this.air > 0 ? this.vSum / this.air : 0, maxG: this.maxG, minG: this.minG, stalls: this.stalls,
      mass: ac.mass, condition: cond, damage: dmg, energyUsed: used, touchV: this.touchV, launchSpeed: this.launchSpeed, weather: this.game.weather.target.name, wet: Math.max(0, ...ac.surfs.map((s) => s.moisture)),
      events: this.events.map((e) => ({ t: e.t, type: e.type, msg: e.msg, x: e.pos[0], y: e.pos[1], z: e.pos[2] })), mode: this.game.save.settings.flightModel };
    // decimated path for the replay plot
    const step = Math.max(1, Math.ceil(this.rec.length / 240)); r.track = this.rec.filter((_, i) => i % step === 0).map((s) => s.map((v) => +v.toFixed(3)));
    // ---- plain-language explanation of what happened
    const n = [];
    if (this.launchSpeed && an.stallSpeed && this.launchSpeed < an.stallSpeed * 1.05) n.push(`Launched at ${this.launchSpeed.toFixed(1)} m/s, below its ${an.stallSpeed.toFixed(1)} m/s stall speed: the wing could not carry the weight, so it sank until it gained speed. Launch harder, or cut weight / add wing area.`);
    if (this.launchSpeed && an.trimSpeed && this.launchSpeed > an.trimSpeed * 1.7) n.push(`Launched at ${this.launchSpeed.toFixed(1)} m/s, far above its ${an.trimSpeed.toFixed(1)} m/s trim speed: the extra lift ballooned it upward until it ran out of speed.`);
    if (this.stalls) n.push(`The main wing stalled ${this.stalls} time${this.stalls > 1 ? 's' : ''}: its angle of attack passed the point where air stays attached, lift collapsed and drag soared. Fly faster, pull less, or move the centre of mass forward.`);
    const st = this.events.find((e) => e.type === 'structure'); if (st) n.push(`${st.msg}. This wing is rated for about ${an.gLimit.toFixed(1)} g. Bracing, a shorter span, a thicker section or a stiffer material raise that limit.`);
    if (an.staticMargin != null && an.staticMargin < 0) n.push(`The design is tail-heavy (centre of mass ${Math.round(-an.staticMargin * 100)}% of chord behind the neutral point), so any pitch disturbance grows instead of damping out.`);
    if (an.trimSpeed == null && !(an.staticMargin < 0)) n.push(an.noseHeavy ? 'Hands-off, the design noses over: there is no speed at which the pitching moments balance. Add up-trim or shift weight aft.' : 'Hands-off, the design keeps pitching up until it stalls.');
    if (this.touchV != null && this.touchV > 1.5 && this.everAir) n.push(`Touchdown was ${this.touchV.toFixed(1)} m/s downward. Wheels tolerate about 1.5 m/s, skids 1.25. Flare: raise the nose just above the ground to trade speed for a soft arrival.`);
    if (ac.engines.length && ac.engines[0].energy <= 0.001) n.push(`The ${ac.engines[0].spec.name.toLowerCase()} ran out of energy after ${(this.t).toFixed(0)} s.`);
    if (r.wet > 0.25) n.push(`Paper and card soaked up water (${Math.round(r.wet * 100)}% saturated): heavier, weaker and floppier.`);
    if (!this.everAir && ac.engines.length && an.maxSpeed == null) n.push('Thrust never exceeded drag at flying speed, so it could not accelerate to take-off.');
    if (!n.length && r.ok) n.push(an.trimGlide ? `A clean flight. Hands-off this design settles at ${an.trimSpeed.toFixed(1)} m/s with a glide ratio near ${an.trimGlide.toFixed(1)}:1.` : 'A clean flight.');
    r.notes = n;
    return r;
  }
}
