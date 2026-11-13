// Six-degree-of-freedom rigid-body flight model built from a blueprint.
// Every aircraft - paper dart, 1903 canard biplane, rotary scout, or a player invention - runs through
// this one class. Behaviour differences come only from the blueprint's parts and the catalog data.
//
// Method: the airframe is broken into lifting panels. Each panel sees its own local airflow
// (aircraft velocity + rotation + wind + propwash), produces lift/drag/pitching moment from a section
// polar with stall, and applies it at its own position. Stability, control response, spins, adverse
// yaw, dihedral effect etc. are therefore emergent rather than scripted.
import { MATERIALS, AIRFOILS, ENGINES, FUSELAGE_KINDS, RHO, NU, G, PILOT_MASS } from './catalog.js';
import { add, sub, scale, dot, cross, len, clamp, smooth, DEG, qRot, qInvRot, qIntegrate, qFromHPR, hprFromQ } from './vec.js';

const H = 1 / 600;             // physics sub-step (s)
const E_OSWALD = 0.8;

// Control-surface deflection (radians, positive = trailing edge down / more lift) for a surface part.
// Shared by the physics and by the 3D model so what you see is what the air feels.
export function surfaceDeflection(p, side, eta, aft, ctrl) {
  const allMoving = p.ctrlFrac >= 0.85, tau = Math.sqrt(p.ctrlFrac);
  if (p.control === 'elevator') return ctrl.pitch * (aft ? -1 : 1) * (allMoving ? 11 : 24) * DEG;
  if (p.control === 'rudder') return -ctrl.yaw * (aft ? 1 : -1) * (allMoving ? 14 : 26) * DEG;
  if (p.control === 'aileron') return eta > 0.4 ? -ctrl.roll * side * 20 * DEG : 0;
  if (p.control === 'warp') return -ctrl.roll * side * eta * 9 * DEG / Math.max(tau, 0.3);
  if (p.control === 'elevon') return (ctrl.pitch * (aft ? -1 : 1) * 0.6 - ctrl.roll * side * 0.55) * 24 * DEG;
  return 0;
}

export class Aircraft {
  constructor(blueprint) {
    this.bp = blueprint;
    this.events = [];
    this.onEvent = null;
    this.build();
    this.reset([0, 1, 0], 0, 0, 0);
  }

  // ---------------------------------------------------------------- build
  build() {
    const bp = this.bp;
    const masses = [], panels = [], surfs = [], drags = [], contacts = [], engines = [];
    const fus = bp.parts.find((p) => p.type === 'fuselage') || { id: 'nofus', kind: 'keel', material: 'card', length: 0.1, width: 0.004, height: 0.008 };
    const fk = FUSELAGE_KINDS[fus.kind], fm = MATERIALS[fus.material];
    const L = fus.length;
    this.fus = { part: fus, health: 1, mat: fm, moisture: 0 };
    const fusMass = L * fm.lin * fk.massF * (0.5 + 0.5 * (fus.width + fus.height) / 0.02);
    masses.push({ m: fusMass, r: [-L / 2, 0, 0], ext: [L, fus.height, fus.width], id: fus.id, soak: fm.soak });
    drags.push({ r: [-L * 0.45, 0, 0], cda: [fus.width * fus.height * fk.cdFront + (fus.kind === 'truss' ? L * 0.0012 : 0), L * fus.width * 1.0, L * fus.height * fk.sideF * 1.1] });
    contacts.push({ r: [0.001, 0, 0], kind: 'nose', id: fus.id }, { r: [-L, 0, 0], kind: 'hull', id: fus.id });
    const hasGear = bp.parts.some((p) => p.type === 'gear');
    if (!hasGear) contacts.push({ r: [-L * 0.3, -fus.height / 2, 0], kind: 'hull', id: fus.id }, { r: [-L * 0.75, -fus.height / 2, 0], kind: 'hull', id: fus.id });

    const horiz = bp.parts.filter((p) => p.type === 'surface' && !p.vertical);
    const areaOf = (p) => p.span * p.chord * (1 + p.taper) / 2 * (p.vertical && p.twin > 0 ? 2 : 1);
    const main = horiz.slice().sort((a, b) => areaOf(b) - areaOf(a))[0] || null;
    this.mainPart = main;

    for (const p of bp.parts) {
      if (p.type === 'surface') {
        const mat = MATERIALS[p.material], foil = AIRFOILS[p.airfoil];
        const area = areaOf(p);
        const half = p.vertical ? p.span : p.span / 2;
        const AR = p.vertical ? 1.6 * p.span * p.span / (area / (p.twin > 0 ? 2 : 1)) : p.span * p.span / area;
        const braceF = p.braced ? 3.2 : 1;
        // biplane / multiplane interference
        let multi = 1;
        if (!p.vertical) for (const o of horiz) {
          if (o === p) continue;
          const gap = Math.abs(o.y - p.y), overlap = Math.min(o.x + o.chord, p.x + p.chord) - Math.max(o.x, p.x);
          if (overlap > 0 && gap < 1.6 * p.chord && o.span > 0.6 * p.span) multi *= 0.86 + 0.1 * gap / (1.6 * p.chord);
        }
        const surf = { part: p, mat, foil, area, half, AR, vertical: !!p.vertical, isMain: p === main,
          cap: mat.strength * p.chord * braceF * foil.structF, EI: mat.stiff * p.chord * (p.braced ? 4 : 1) * foil.structF,
          softK: 8 * mat.stiff * foil.structF * (p.braced ? 3 : 1), health: [1, 1], failed: [false, false], bend: [0, 0], flex: [0, 0], stress: [0, 0], moisture: 0, panels: [] };
        const m = area * mat.areal * (foil.thick > 0.05 ? 1.25 : 1) * (p.braced ? 1.18 : 1);
        const dih = p.dihedral * DEG, sw = Math.tan(p.sweep * DEG);
        const cMean = p.chord * (1 + p.taper) / 2;
        masses.push({ m, r: p.vertical ? [-(p.x + sw * half * 0.45 + 0.42 * cMean), p.y + half * 0.45, 0] : [-(p.x + sw * half * 0.45 + 0.42 * cMean), p.y + Math.sin(dih) * half * 0.45, 0],
          ext: p.vertical ? [cMean, p.span, p.twin || 0.001] : [cMean, 0.002, p.span * 0.58], id: p.id, soak: mat.soak });
        if (p.braced) drags.push({ r: [-(p.x + 0.4 * p.chord), p.y, 0], cda: [0.014 * area, 0.004 * area, 0.01 * area] });
        const n = half > 0.05 ? 3 : 2;
        const sides = p.vertical ? (p.twin > 0 ? [1, -1] : [0]) : [1, -1];
        const downwashed = !p.vertical && main && p !== main && p.x > main.x + main.chord * 0.8;
        const aft = true; // resolved after CG is known
        for (const side of sides) for (let j = 0; j < n; j++) {
          const eta = (j + 0.5) / n, chord = p.chord * (1 - (1 - p.taper) * eta);
          const xqc = p.x + sw * half * eta + 0.25 * chord;
          const pa = { surf, side, sideIdx: side < 0 ? 1 : 0, eta, arm: eta * half, chord, area: area / (n * sides.length), AR, multi, downwashed, aft,
            xqc, eta0: eta, wash: false, sigma: 0, cl: 0, alpha: 0 };
          pa.base = p.vertical ? [-xqc, p.y + eta * half, side * p.twin / 2] : [-xqc, p.y, 0];
          panels.push(pa); surf.panels.push(pa);
        }
        surfs.push(surf);
        // tips / fin top touch the world
        if (p.vertical) contacts.push({ r: [-(p.x + sw * half + 0.5 * p.chord * p.taper), p.y + p.span, 0], kind: 'tip', id: p.id, surf, sideIdx: 0 });
        else for (const side of [1, -1]) contacts.push({ r: [-(p.x + sw * half + 0.4 * p.chord * p.taper), p.y + Math.sin(dih) * half, side * half * Math.cos(dih)], kind: 'tip', id: p.id, surf, sideIdx: side < 0 ? 1 : 0 });
      } else if (p.type === 'engine') {
        const e = ENGINES[p.kind];
        masses.push({ m: e.mass, r: [-p.x, p.y, 0], ext: [0.012, 0.01, 0.01], id: p.id, soak: 0 });
        drags.push({ r: [-p.x, p.y, 0], cda: [2.2e-5, 1e-5, 1e-5] });
        const eng = { part: p, spec: e, r: [-p.x, p.y, 0], level: 0, energy: 1, running: false, runtime: 0, health: 1, thrust: 0, wash: 0, rpm: 0 };
        engines.push(eng);
        if (e.prop > 0) contacts.push({ r: [-p.x + (p.pusher ? -0.006 : 0.004), p.y - e.prop / 2, e.props === 2 ? 0.03 : 0], kind: 'prop', id: p.id, eng });
      } else if (p.type === 'gear') {
        const yb = -fus.height / 2 - p.height;
        masses.push({ m: 0.00025 + p.track * 0.004 + p.height * 0.006, r: [-p.x, yb * 0.6, 0], ext: [0.01, p.height, p.track], id: p.id, soak: 0 });
        drags.push({ r: [-p.x, yb * 0.6, 0], cda: [p.kind === 'wheels' ? 3.2e-5 : 2e-5, 1e-5, 2e-5] });
        const gear = { part: p, health: 1 };
        this.gear = gear;
        if (p.kind === 'wheels') {
          for (const s of [1, -1]) contacts.push({ r: [-p.x, yb, s * p.track / 2], kind: 'wheel', id: p.id, gear });
          contacts.push({ r: [-L * 0.96, -fus.height / 2 - 0.003, 0], kind: 'skid', id: p.id, gear, tail: true });
        } else {
          for (const s of [1, -1]) for (const dx of [-0.02, 0.05]) contacts.push({ r: [-p.x + dx, yb, s * p.track / 2], kind: 'skid', id: p.id, gear });
        }
      } else if (p.type === 'ballast') {
        masses.push({ m: p.mass, r: [-p.x, 0, 0], ext: [0.004, 0.004, 0.004], id: p.id, soak: 0 });
      } else if (p.type === 'pilot') {
        masses.push({ m: PILOT_MASS, r: [-p.x, p.y + 0.003, 0], ext: [0.01, 0.008, 0.006], id: p.id, soak: 0 });
        const shielded = fus.kind === 'box' || fus.kind === 'tube';
        drags.push({ r: [-p.x, p.y + 0.004, 0], cda: [p.pose === 'prone' ? 2.4e-5 : shielded ? 2e-5 : 6.5e-5, 4e-5, 5e-5] });
        this.pilotPart = p;
      }
    }
    // propwash flags (tractor propellers blow on what is behind them)
    for (const e of engines) if (e.spec.prop > 0 && !e.part.pusher) for (const pa of panels) {
      const r = e.spec.prop * 0.6;
      if (pa.xqc > e.part.x && Math.abs(pa.base[2] + (pa.surf.vertical ? 0 : pa.side * pa.arm)) < r && Math.abs(pa.base[1] - e.part.y) < r * 1.6) pa.wash = e;
    }
    // mass properties
    let M = 0, cg = [0, 0, 0];
    for (const m of masses) { M += m.m; cg = add(cg, scale(m.r, m.m)); }
    cg = scale(cg, 1 / M);
    let Ixx = 0, Iyy = 0, Izz = 0;
    for (const m of masses) {
      const r = sub(m.r, cg), [ex, ey, ez] = m.ext;
      Ixx += m.m * (r[1] * r[1] + r[2] * r[2] + (ey * ey + ez * ez) / 12);
      Iyy += m.m * (r[0] * r[0] + r[2] * r[2] + (ex * ex + ez * ez) / 12);
      Izz += m.m * (r[0] * r[0] + r[1] * r[1] + (ex * ex + ey * ey) / 12);
    }
    this.dryMass = M; this.mass = M; this.cg = cg; this.I = [Math.max(Ixx, 2e-9), Math.max(Iyy, 2e-9), Math.max(Izz, 2e-9)];
    this.masses = masses; this.panels = panels; this.surfs = surfs; this.drags = drags; this.contacts = contacts; this.engines = engines;
    for (const d of drags) d.r = sub(d.r, cg);
    for (const c of contacts) c.r0 = sub(c.r, cg), c.r = c.r0.slice(), c.touching = false;
    for (const e of engines) e.r = sub(e.r, cg);
    for (const pa of panels) { pa.aft = -pa.xqc < cg[0]; }
    this.wingArea = surfs.filter((s) => !s.vertical && (s.part.role === 'wing' || s.isMain)).reduce((a, s) => a + s.area, 0) || 1e-6;
    this.mainSurf = surfs.find((s) => s.isMain) || null;
    this.hasRoll = bp.parts.some((p) => p.type === 'surface' && ['aileron', 'warp', 'elevon'].includes(p.control));
    this.hasPitch = bp.parts.some((p) => p.type === 'surface' && ['elevator', 'elevon'].includes(p.control));
    this.hasYaw = bp.parts.some((p) => p.type === 'surface' && p.control === 'rudder');
    this.lowestY = Math.min(...contacts.filter((c) => c.kind !== 'tip' && c.kind !== 'prop').map((c) => c.r0[1]));
    this.clMain = 0; this.fusLen = L;
    this._panelGeometry();
    // quick static-margin estimate (used by the pilot-assist to tame unstable designs)
    { const mac = main ? main.chord * (1 + main.taper) / 2 : 0.03, e0 = this.staticEval(4, 1 * DEG), e1 = this.staticEval(4, 3 * DEG);
      const dL = e1.L - e0.L; this.smEst = dL > 1e-9 ? -(e1.Mp - e0.Mp) / dL / mac : 0.2; }
  }

  // panel position and axes (re-evaluated as wings flex)
  _panelGeometry() {
    for (const s of this.surfs) {
      const p = s.part, inc = p.incidence * DEG, ci = Math.cos(inc), si = Math.sin(inc);
      for (const pa of s.panels) {
        if (s.vertical) { pa.c = [1, 0, 0]; pa.n = [0, 0, 1]; pa.r = sub(pa.base, this.cg); continue; }
        const dih = p.dihedral * DEG + s.flex[pa.sideIdx], cd = Math.cos(dih), sd = Math.sin(dih);
        pa.c = [ci, si, 0]; pa.n = [-si * cd, ci * cd, -pa.side * ci * sd];
        pa.r = sub([pa.base[0], pa.base[1] + pa.arm * sd, pa.side * pa.arm * cd], this.cg);
      }
    }
  }

  reset(pos, heading = 0, pitch = 0, speed = 0) {
    this.pos = pos.slice(); this.q = qFromHPR(heading, pitch, 0);
    this.vel = qRot(this.q, [speed, 0, 0]); this.w = [0, 0, 0];
    this.t = 0; this.destroyed = false; this.onGround = false; this.inWater = false; this.gLoad = 1; this.stall = 0; this.alpha = 0; this.slip = 0;
    this.airspeed = speed; this._rollI = 0; this.maxStress = 0; this.asleep = false; this.trim = this.bp.trim || 0;
    for (const e of this.engines) { e.level = 0; e.running = false; e.thrust = 0; e.runtime = 0; }
    for (const c of this.contacts) c.touching = false;
  }
  refuel() { for (const e of this.engines) e.energy = 1; }
  repair() {
    for (const s of this.surfs) { s.health = [1, 1]; s.failed = [false, false]; s.flex = [0, 0]; }
    for (const e of this.engines) e.health = 1;
    if (this.gear) this.gear.health = 1;
    this.fus.health = 1; this.destroyed = false;
    for (const c of this.contacts) c.r = c.r0.slice();
    this._panelGeometry();
  }
  get condition() {
    let h = this.fus.health, n = 1;
    for (const s of this.surfs) { h += (s.health[0] + s.health[1]) / 2; n++; }
    for (const e of this.engines) { h += e.health; n++; }
    if (this.gear) { h += this.gear.health; n++; }
    return clamp(h / n, 0, 1);
  }
  damageReport() {
    const out = [];
    const pct = (h) => Math.round((1 - h) * 100);
    if (this.fus.health < 0.99) out.push({ id: this.fus.part.id, label: 'Fuselage', dmg: pct(this.fus.health) });
    for (const s of this.surfs) for (const i of (s.vertical ? [0] : [0, 1])) if (s.health[i] < 0.99)
      out.push({ id: s.part.id, label: (s.vertical ? 'Fin' : (i ? 'Left ' : 'Right ') + s.part.role), dmg: pct(s.health[i]), failed: s.failed[i] });
    for (const e of this.engines) if (e.health < 0.99) out.push({ id: e.part.id, label: e.spec.prop ? 'Propeller / engine' : 'Engine', dmg: pct(e.health) });
    if (this.gear && this.gear.health < 0.99) out.push({ id: this.gear.part.id, label: 'Landing gear', dmg: pct(this.gear.health) });
    return out;
  }
  _emit(type, msg, extra) {
    const ev = { t: this.t, type, msg, ...extra };
    this.events.push(ev); if (this.onEvent) this.onEvent(ev);
  }

  // ---------------------------------------------------------------- aerodynamics
  // vAir: velocity of the aircraft through the air, body frame. Returns force & moment (body, about CG).
  _aero(vAir, w, ctrl, altAGL = 10) {
    let F = [0, 0, 0], Mo = [0, 0, 0];
    let clSum = 0, aSum = 0, sigSum = 0, alphaSum = 0;
    const eps = this.mainSurf ? clamp(this.clMain, -1.5, 1.5) * 2 / (Math.PI * this.mainSurf.AR) * 0.85 : 0;
    for (const s of this.surfs) { s.bend[0] = 0; s.bend[1] = 0; }
    for (const pa of this.panels) {
      const s = pa.surf, p = s.part, foil = s.foil;
      const V = add(vAir, cross(w, pa.r));
      if (pa.wash) V[0] += pa.wash.wash;
      const Vc = dot(V, pa.c), Vn = dot(V, pa.n), q2 = Vc * Vc + Vn * Vn;
      if (q2 < 1e-5) continue;
      const sp = Math.sqrt(q2);
      let alpha = Math.atan2(-Vn, Vc);
      if (pa.downwashed) alpha -= eps;
      // control deflection as an effective change of angle of attack
      const q = 0.5 * RHO * q2;
      let dA = 0, defl = 0;
      const tau = Math.sqrt(p.ctrlFrac);
      if (p.control !== 'none') {
        // soft structures twist under load and lose control authority
        const soft = 1 / (1 + q * s.half * s.half / (s.softK * (1 - 0.8 * s.moisture)));
        defl = surfaceDeflection(p, pa.side, pa.eta, pa.aft, ctrl);
        dA = defl * tau * soft;
      }
      const aEff = alpha + dA;
      const Re = sp * pa.chord / NU;
      let clmax = foil.clmax, cd0 = (foil.cd0 + s.mat.rough) * clamp(Math.pow(20000 / Math.max(Re, 500), 0.35), 0.75, 2.6);
      if (foil.reCrit && Re < foil.reCrit) { const k = clamp(1 - Re / foil.reCrit, 0, 1); clmax *= 1 - 0.45 * k; cd0 *= 1 + 1.6 * k; }
      const a = 2 * Math.PI * s.AR / (s.AR + 2) * 0.9 * pa.multi;
      const cl0 = foil.cl0 * pa.multi;
      const clLin = cl0 + a * aEff;
      const aSp = (clmax - cl0) / a, aSn = (-(0.7 * clmax - 0.3 * cl0) - cl0) / a;
      const wd = (4 + 6 / s.AR) * DEG;
      const sigma = clamp(smooth(aSp, aSp + wd, aEff) + smooth(-aSn, -aSn + wd, -aEff), 0, 1);
      const sA = Math.sin(aEff);
      // ground effect trims induced drag when a wing skims the surface
      const ge = s.vertical ? 1 : (() => { const hb = Math.max(altAGL, 0.002) / (2 * s.half); const k = 16 * hb; return (k * k) / (1 + k * k); })();
      let cl = (1 - sigma) * clLin + sigma * 1.05 * Math.sin(2 * aEff);
      let cd = (1 - sigma) * (cd0 + clLin * clLin / (Math.PI * s.AR * E_OSWALD) * ge) + sigma * (cd0 + 1.25 * sA * sA + 0.015) + 0.5 * Math.abs(defl) * tau * 0.08;
      const hlt = s.health[pa.sideIdx];
      if (s.failed[pa.sideIdx]) { cl *= 0.12; cd += 0.35; } else { cl *= 0.35 + 0.65 * hlt; cd += (1 - hlt) * 0.07; }
      if (this.fus.health <= 0) cl *= 0.3;
      const qS = q * pa.area;
      const d = [(Vc * pa.c[0] + Vn * pa.n[0]) / sp, (Vc * pa.c[1] + Vn * pa.n[1]) / sp, (Vc * pa.c[2] + Vn * pa.n[2]) / sp];
      const l = [(Vc * pa.n[0] - Vn * pa.c[0]) / sp, (Vc * pa.n[1] - Vn * pa.c[1]) / sp, (Vc * pa.n[2] - Vn * pa.c[2]) / sp];
      const f = [qS * (cl * l[0] - cd * d[0]), qS * (cl * l[1] - cd * d[1]), qS * (cl * l[2] - cd * d[2])];
      F = add(F, f);
      Mo = add(Mo, cross(pa.r, f));
      if (foil.cm0) Mo = add(Mo, scale(cross(pa.c, pa.n), foil.cm0 * qS * pa.chord * (1 - sigma) * (0.35 + 0.65 * hlt)));
      if (!s.vertical) s.bend[pa.sideIdx] += dot(f, pa.n) * pa.arm;
      pa.sigma = sigma; pa.cl = cl; pa.alpha = aEff;
      if (s.isMain) { clSum += cl * pa.area; aSum += pa.area; sigSum += sigma * pa.area; alphaSum += alpha * pa.area; }
    }
    for (const dgb of this.drags) {
      const V = add(vAir, cross(w, dgb.r)), sp = len(V);
      const f = [-0.5 * RHO * sp * V[0] * dgb.cda[0], -0.5 * RHO * sp * V[1] * dgb.cda[1], -0.5 * RHO * sp * V[2] * dgb.cda[2]];
      F = add(F, f); Mo = add(Mo, cross(dgb.r, f));
    }
    if (aSum > 0) { this._clMainNew = clSum / aSum; this._stallNew = sigSum / aSum; this._alphaNew = alphaSum / aSum; }
    return { F, M: Mo };
  }

  // ---------------------------------------------------------------- one physics sub-step
  _step(h, input, env) {
    const q = this.q;
    const wind = env.wind ? env.wind(this.pos, this.t) : [0, 0, 0];
    const vAir = qInvRot(q, sub(this.vel, wind));
    const w = this.w;
    const gH = env.ground(this.pos[0], this.pos[2]);
    const agl = this.pos[1] + this.lowestY - gH;
    this.agl = agl;
    const hpr = hprFromQ(q);

    // ----- pilot aids ("Accessible Flight"): only ever moves the same control surfaces the pilot has
    const ctrl = { pitch: clamp(input.pitch + this.trim, -1, 1), roll: input.roll, yaw: input.yaw };
    if (!this.hasRoll) ctrl.yaw = clamp(ctrl.yaw + input.roll, -1, 1); // no ailerons: steer with rudder + dihedral
    const assist = input.assist || 0;
    if (assist > 0 && this.airspeed > 1) {
      const sp = Math.max(this.airspeed, 1.5), air = !this.onGround;
      if (air) {
        ctrl.pitch += assist * (-0.10 * w[2] * (5 / sp));
        // stall protection: ease the nose down as the main wing nears separation
        if (this.stall > 0.02 || this.alpha > 0.14) ctrl.pitch -= assist * clamp(this.stall * 2.2 + Math.max(0, this.alpha - 0.14) * 5, 0, 1.2);
        // artificial stability for tail-heavy designs: hold angle of attack near a safe value
        const unst = clamp(0.1 - this.smEst, 0, 0.35);
        if (unst > 0) ctrl.pitch -= assist * unst * 14 * (this.alpha - (0.06 + 0.08 * input.pitch));
        // in a banked turn hold the nose up a little
        ctrl.pitch += assist * clamp(1 / Math.max(Math.cos(hpr.roll), 0.5) - 1, 0, 1) * 0.5;
      }
      const bankTarget = input.roll * 0.9;       // stick commands bank angle, releases to wings-level
      const err = bankTarget - hpr.roll;
      this._rollI = clamp((this._rollI || 0) + err * h * 1.2, -0.5, 0.5);   // trims out engine torque
      const rollCmd = clamp(err * 1.8 - w[0] * 0.25 + this._rollI, -1, 1);
      if (this.hasRoll) ctrl.roll = ctrl.roll * (1 - 0.8 * assist) + assist * 0.8 * rollCmd;
      else ctrl.yaw = clamp(input.yaw + assist * rollCmd * 0.8 + (1 - assist) * input.roll, -1, 1);
      ctrl.yaw += assist * ((air ? 0.12 : 0.6) * w[1] + clamp(this.slip * 1.5, -0.5, 0.5)) * (this.hasRoll ? 1 : 0.3);
    }
    ctrl.pitch = clamp(ctrl.pitch, -1, 1); ctrl.roll = clamp(ctrl.roll, -1, 1); ctrl.yaw = clamp(ctrl.yaw, -1, 1);
    this.ctrl = ctrl;

    let { F, M } = this._aero(vAir, w, ctrl, agl);
    this.clMain += ((this._clMainNew ?? 0) - this.clMain) * Math.min(1, h * 30);
    this.stall = this._stallNew ?? 0; this.alpha = this._alphaNew ?? 0;
    this.gLoad = F[1] / (this.mass * G);

    // ----- structure: bending, flex, overstress
    for (const s of this.surfs) {
      if (s.vertical) continue;
      const wetF = 1 - 0.7 * s.moisture;
      let changed = false;
      for (let i = 0; i < 2; i++) {
        const cap = s.cap * wetF * (0.3 + 0.7 * s.health[i]);
        const ratio = Math.abs(s.bend[i]) / cap;
        s.stress[i] += (ratio - s.stress[i]) * Math.min(1, h * 25);
        const target = s.failed[i] ? 1.1 : clamp(s.bend[i] * s.half / (s.EI * (1 - 0.8 * s.moisture) * 3), -0.6, 0.6);
        const nf = s.flex[i] + (target - s.flex[i]) * Math.min(1, h * 18);
        if (Math.abs(nf - s.flex[i]) > 1e-4) { s.flex[i] = nf; changed = true; }
        if (!s.failed[i] && s.stress[i] > 1) {
          s.health[i] -= (s.stress[i] - 1) * 6 * h + (s.stress[i] > 1.6 ? 1 : 0);
          if (s.health[i] <= 0) { s.health[i] = 0; s.failed[i] = true; this._emit('structure', `${i ? 'Left' : 'Right'} ${s.part.role} folded under load (${this.gLoad.toFixed(1)} g)`, { id: s.part.id }); }
        }
        this.maxStress = Math.max(this.maxStress * (1 - h), s.stress[i]);
      }
      if (changed) this._needGeom = true;
    }
    if (this._needGeom) { this._panelGeometry(); this._needGeom = false; }

    // ----- propulsion
    for (const e of this.engines) {
      const sp = e.spec, thr = input.throttle;
      if (sp.throttle === 'none') { if (thr > 0.05 && e.energy > 0) e.running = true; else if (sp === ENGINES.wright && thr <= 0.05) e.running = false; }
      else e.running = thr > 0.02 && e.energy > 0;
      if (e.energy <= 0 || e.health < 0.3) e.running = false;
      const target = !e.running ? 0 : sp.throttle === 'none' ? 1 : sp.throttle === 'blip' ? (thr < 0.12 ? 0 : thr < 0.6 ? 0.55 : 1) : thr;
      e.level += (target - e.level) * Math.min(1, h / sp.spool);
      if (e.level > 0.01) { e.energy = Math.max(0, e.energy - Math.pow(e.level, 1.4) * h / sp.endurance); e.runtime += h; }
      let fac = 1;
      if (sp === ENGINES.rubber) fac = (0.72 + 0.95 * Math.pow(e.energy, 3)) * smooth(0, 0.1, e.energy);
      if (sp.fade) fac = 1 - sp.fade * (1 - Math.exp(-e.runtime / 15));
      const Vax = vAir[0] + (w[1] * e.r[2] - w[2] * e.r[1]);
      let T = sp.thrust * e.level * fac * e.health * (1 - Vax / sp.vPitch);
      T = Math.max(T, -0.2 * sp.thrust * e.level);
      if (sp.prop > 0 && e.level < 0.05) T = -0.5 * RHO * Vax * Math.abs(Vax) * Math.PI * sp.prop * sp.prop / 4 * 0.1 * sp.props; // windmilling prop
      e.thrust = T; e.rpm = e.level * fac;
      e.wash = T > 0 && sp.prop > 0 ? Math.sqrt(2 * T / (RHO * Math.PI * sp.prop * sp.prop / 4)) * 0.6 : 0;
      F[0] += T; M = add(M, cross(e.r, [T, 0, 0]));
      M[0] -= sp.torque * Math.max(T, 0);
      if (sp.gyro) { const hg = sp.gyro * Math.sqrt(Math.max(e.level, 0)); M[1] -= w[2] * hg; M[2] += w[1] * hg; }
    }

    // ----- gravity + contacts (world frame)
    let Fw = qRot(q, F); Fw[1] -= this.mass * G;
    let Mw = [0, 0, 0];
    let ground = false, water = false;
    const kS = this.mass * 9000, cS = this.mass * 95;
    const fwd = qRot(q, [1, 0, 0]);
    for (const c of this.contacts) {
      const rw = qRot(q, c.r), p = add(this.pos, rw);
      const surf = env.surface ? env.surface(p[0], p[2]) : null;
      let depth = env.ground(p[0], p[2]) - p[1], nrm = env.normal ? env.normal(p[0], p[2]) : [0, 1, 0];
      let wet = false;
      if (surf && surf.water != null && p[1] < surf.water) wet = true;
      const hit = env.collide ? env.collide(p) : null;
      if (hit && hit.depth > depth) { depth = hit.depth; nrm = hit.normal; }
      const vP = add(this.vel, qRot(q, cross(w, c.r)));
      if (wet) { // water: buoyancy + heavy drag, no hard surface
        water = true;
        const dW = Math.min(surf.water - p[1], 0.012);
        const f = [-vP[0] * this.mass * 14, dW * this.mass * 900 - vP[1] * this.mass * 25, -vP[2] * this.mass * 14];
        Fw = add(Fw, f); Mw = add(Mw, cross(rw, f));
        if (!c.touching && len(vP) > 0.8) this._emit('splash', 'Splashdown!', {});
        c.touching = true;
        continue;
      }
      if (depth <= 0) { if (depth < -0.003) c.touching = false; continue; }
      const vn = dot(vP, nrm);
      if (!c.touching) { c.touching = true; this._impact(c, Math.max(0, -vn), len(vP), surf); }
      if (c.kind !== 'tip' && c.kind !== 'prop') ground = true;
      if (c.kind === 'prop') { if (c.eng.level > 0.2 && c.eng.health > 0.3) { c.eng.health = 0.1; this._emit('damage', 'Propeller struck the ground and shattered', { id: c.id }); } continue; }
      const Fn = Math.max(0, kS * Math.min(depth, 0.02) - cS * vn);
      const vt = sub(vP, scale(nrm, vn));
      const sm = surf ? surf.mu : 1;
      let fT;
      if (c.kind === 'wheel' && c.gear.health > 0.5) {
        const roll = sub(fwd, scale(nrm, dot(fwd, nrm))), rl = len(roll) || 1, rd = scale(roll, 1 / rl);
        const vr = dot(vt, rd), vs = sub(vt, scale(rd, vr));
        const muR = 0.07 * (surf ? surf.roll : 1), muS = 0.45 * sm;
        fT = add(scale(rd, -muR * Fn * vr / (Math.abs(vr) + 0.03)), scale(vs, -muS * Fn / (len(vs) + 0.03)));
      } else {
        const mu = (c.kind === 'skid' ? (surf && surf.rail ? 0.05 : 0.38) : c.kind === 'tip' ? 0.3 : 0.55) * (surf && surf.rail && c.kind === 'skid' ? 1 : sm);
        fT = scale(vt, -mu * Fn / (len(vt) + 0.03));
      }
      const f = add(scale(nrm, Fn), fT);
      Fw = add(Fw, f); Mw = add(Mw, cross(rw, f));
    }
    this.onGround = ground; this.inWater = water;
    M = add(M, qInvRot(q, Mw));

    // ----- moisture: rain and pond water soak paper and card
    const rain = env.rain || 0;
    if (rain > 0 || water || this._wet) {
      let wetMass = 0; this._wet = false;
      const soakUp = (o, soak, m) => {
        if (soak > 0) o.moisture = clamp(o.moisture + soak * h * (water ? 0.35 : rain / 45) - (rain || water ? 0 : h / 240), 0, 1);
        if (o.moisture > 0) this._wet = true;
        wetMass += m * o.moisture * 0.9;
      };
      for (const s of this.surfs) soakUp(s, s.mat.soak, s.area * s.mat.areal);
      soakUp(this.fus, this.fus.mat.soak, this.masses[0].m);
      this.mass = this.dryMass + wetMass;
    }

    // ----- integrate
    const I = this.I;
    const wd = [
      (M[0] - (I[2] - I[1]) * w[1] * w[2]) / I[0],
      (M[1] - (I[0] - I[2]) * w[2] * w[0]) / I[1],
      (M[2] - (I[1] - I[0]) * w[0] * w[1]) / I[2],
    ];
    this.w = [clamp(w[0] + wd[0] * h, -60, 60), clamp(w[1] + wd[1] * h, -60, 60), clamp(w[2] + wd[2] * h, -60, 60)];
    this.vel = add(this.vel, scale(Fw, h / this.mass));
    this.pos = add(this.pos, scale(this.vel, h));
    this.q = qIntegrate(q, this.w, h);
    this.airspeed = len(vAir);
    this.slip = this.airspeed > 0.5 ? Math.asin(clamp(vAir[2] / this.airspeed, -1, 1)) : 0;
    this.t += h;
    // rest: stop micro-creep once parked
    const thrusting = this.engines.some((e) => e.level > 0.05);
    if ((ground || water) && !thrusting && len(this.vel) < 0.06 && len(this.w) < 0.6) { this.restT = (this.restT || 0) + h; if (this.restT > 0.4) { this.vel = [0, 0, 0]; this.w = [0, 0, 0]; this.asleep = true; } }
    else { this.restT = 0; this.asleep = false; }
  }

  _impact(c, vn, vTot, surf) {
    const soft = surf && surf.soft ? surf.soft : 1;          // mud and moss cushion
    if (this.t - (c.lastHit ?? -9) < 0.6) return;
    c.lastHit = this.t;
    const v = c.kind === 'nose' ? Math.max(vn, vTot * 0.55) : c.kind === 'tip' ? Math.max(vn, vTot * 0.3) : vn;
    const E = 0.5 * this.mass * v * v / soft;
    if (v > 0.25) this._emit('touch', c.kind, { v, kind: c.kind });
    let tol;
    if (c.kind === 'wheel') tol = 0.5 * this.mass * 1.5 * 1.5;
    else if (c.kind === 'skid') tol = 0.5 * this.mass * 1.25 * 1.25;
    else if (c.kind === 'prop') return;
    else tol = (c.surf ? c.surf.mat.tough * 0.7 : this.fus.mat.tough);
    if (E <= tol) return;
    const d = clamp((E / tol - 1) * 0.55, 0.05, 1);
    if (c.gear) {
      const was = c.gear.health; c.gear.health = Math.max(0, was - d);
      if (was > 0.5 && c.gear.health <= 0.5) {
        for (const o of this.contacts) if (o.gear === c.gear && !o.tail) o.r = [o.r0[0], o.r0[1] + c.gear.part.height * 0.75, o.r0[2]];
        this._emit('damage', `Landing gear collapsed (touchdown at ${v.toFixed(1)} m/s)`, { id: c.id });
      } else this._emit('damage', `Hard landing bent the gear (${v.toFixed(1)} m/s)`, { id: c.id });
      if (d > 0.6) this.fus.health = Math.max(0, this.fus.health - (d - 0.6));
    } else if (c.surf) {
      const i = c.sideIdx; c.surf.health[i] = Math.max(0, c.surf.health[i] - d);
      if (c.surf.health[i] <= 0 && !c.surf.failed[i]) { c.surf.failed[i] = true; this._needGeom = true; }
      this._emit('damage', `${c.surf.vertical ? 'Fin' : (i ? 'Left' : 'Right') + ' wingtip'} hit at ${v.toFixed(1)} m/s`, { id: c.id });
    } else {
      this.fus.health = Math.max(0, this.fus.health - d);
      if (c.kind === 'nose') for (const e of this.engines) if (!e.part.pusher && e.part.x < 0.03) e.health = Math.max(0, e.health - d);
      this._emit('damage', `${c.kind === 'nose' ? 'Nose' : 'Fuselage'} impact at ${v.toFixed(1)} m/s`, { id: c.id });
    }
    if (this.fus.health <= 0 && !this.destroyed) { this.destroyed = true; this._emit('destroyed', 'Airframe destroyed', {}); }
  }

  // advance by dt seconds of simulation time
  update(dt, input, env) {
    let n = Math.min(60, Math.ceil(dt / H)); const h = dt / n;
    if (this.asleep && input.throttle < 0.05 && !(env.wind && len(env.wind(this.pos, this.t)) > 3)) { this.t += dt; return; }
    while (n--) this._step(h, input, env);
  }

  // ---------------------------------------------------------------- engineering analysis (workshop)
  // Static evaluation at airspeed V, angle of attack alpha (rad), sideslip beta, controls -> lift, drag, moments.
  staticEval(V, alpha, pitch = this.bp.trim || 0, beta = 0) {
    const vAir = [V * Math.cos(alpha) * Math.cos(beta), -V * Math.sin(alpha) * Math.cos(beta), V * Math.sin(beta)];
    let r;
    const save = this.clMain;
    for (let i = 0; i < 4; i++) { r = this._aero(vAir, [0, 0, 0], { pitch, roll: 0, yaw: 0 }); this.clMain = this._clMainNew ?? 0; }
    const bend = this.surfs.map((s) => Math.max(Math.abs(s.bend[0]), Math.abs(s.bend[1])) / s.cap);
    this.clMain = save;
    const ca = Math.cos(alpha), sa = Math.sin(alpha);
    return { L: r.F[1] * ca + r.F[0] * sa, D: -r.F[0] * ca + r.F[1] * sa, Mp: r.M[2], Y: r.F[2], N: r.M[1], Lr: r.M[0], stall: this._stallNew ?? 0, bend: Math.max(0, ...bend) };
  }

  analyze() {
    const W = this.mass * G, V0 = 5, out = { mass: this.mass, weight: W, cgX: -this.cg[0], cgY: this.cg[1], wingArea: this.wingArea };
    const mac = this.mainPart ? this.mainPart.chord * (1 + this.mainPart.taper) / 2 : 0.03;
    out.mac = mac; out.wingLoading = this.mass / this.wingArea;
    const e0 = this.staticEval(V0, 1 * DEG), e1 = this.staticEval(V0, 3 * DEG);
    const dL = (e1.L - e0.L) / (2 * DEG), dM = (e1.Mp - e0.Mp) / (2 * DEG);
    out.liftSlope = dL;
    out.npX = dL > 1e-6 ? out.cgX - dM / dL : null;
    out.staticMargin = out.npX != null ? (out.npX - out.cgX) / mac : null;
    const b0 = this.staticEval(V0, 3 * DEG, undefined, 4 * DEG), bz = this.staticEval(V0, 3 * DEG);
    out.yawStab = (b0.N - bz.N);      // positive sideslip (air from the right)... want nose to swing right => N < 0
    out.yawStable = out.yawStab < -1e-10; out.rollStab = b0.Lr - bz.Lr; // want roll away from slip: Lr < 0
    // sweep alpha for stall speed, trim and best glide (repeated at the trim speed: Reynolds number and
    // control softness both change with airspeed)
    let Vref = V0;
    for (let pass = 0; pass < 3; pass++) {
      let Lmax = 0, best = null, trim = null, prev = null;
      for (let a = -4; a <= 24; a += 0.5) {
        const e = this.staticEval(Vref, a * DEG);
        if (e.L > Lmax) Lmax = e.L;
        if (e.L > 0 && (!best || e.L / e.D > best.ld)) best = { ld: e.L / e.D, a, e };
        if (prev && prev.e.Mp > 0 && e.Mp <= 0 && !trim && e.L > 0) { const t = prev.e.Mp / (prev.e.Mp - e.Mp); trim = { a: prev.a + 0.5 * t, L: prev.e.L + (e.L - prev.e.L) * t, D: prev.e.D + (e.D - prev.e.D) * t, stall: e.stall, bend: e.bend }; }
        prev = { a, e };
      }
      const k = (V0 / Vref) ** 2;   // normalise forces back to V0
      out.stallSpeed = Lmax > 0 ? Vref * Math.sqrt(W / Lmax) : null;
      out.bestGlide = best ? best.ld : 0;
      if (trim && trim.L > 0) { out.trimSpeed = Vref * Math.sqrt(W / trim.L); out.trimAlpha = trim.a; out.trimGlide = trim.L / trim.D; out.trimStalled = trim.stall > 0.3; out.gLimit = trim.bend > 0 ? 1 / (trim.bend * W / trim.L) : 99; }
      else { out.trimSpeed = null; const e = this.staticEval(Vref, 4 * DEG); out.gLimit = e.bend > 0 && e.L > 0 ? 1 / (e.bend * W / e.L) : 99; out.noseHeavy = this.staticEval(Vref, 2 * DEG).Mp < 0; }
      const next = clamp(out.trimSpeed || (out.stallSpeed || V0) * 1.3, 1, 25);
      if (Math.abs(next - Vref) < 0.1) break;
      Vref = next;
    }
    // powered performance
    const T0 = this.engines.reduce((s, e) => s + e.spec.thrust * (e.spec.fade ? 1 - e.spec.fade : 1) * (e.spec === ENGINES.rubber ? 0.85 : 1), 0);
    out.thrust = T0; out.thrustToWeight = T0 / W;
    out.endurance = this.engines.length ? Math.min(...this.engines.map((e) => e.spec.endurance)) : 0;
    out.maxSpeed = null; out.climb = null;
    if (T0 > 0 && out.stallSpeed) {
      let bestClimb = -9;
      for (let V = out.stallSpeed * 1.05; V < 30; V += 0.25) {
        // angle of attack for level flight at this speed
        let lo = -6 * DEG, hi = 14 * DEG;
        for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (this.staticEval(V, mid).L < W) lo = mid; else hi = mid; }
        const D = this.staticEval(V, hi).D;
        const T = this.engines.reduce((s, e) => s + e.spec.thrust * (e.spec.fade ? 1 - e.spec.fade : 1) * (e.spec === ENGINES.rubber ? 0.85 : 1) * Math.max(0, 1 - V / e.spec.vPitch), 0);
        const climb = (T - D) * V / W;
        if (climb > bestClimb) bestClimb = climb;
        if (T >= D) out.maxSpeed = V; else if (out.maxSpeed) break;
      }
      out.climb = bestClimb;
    }
    // warnings: plain-language engineering notes
    const wr = []; const bp = this.bp;
    const surfs = bp.parts.filter((p) => p.type === 'surface');
    if (!surfs.some((p) => !p.vertical)) wr.push({ lvl: 'bad', msg: 'No wing: nothing here will make lift.' });
    if (out.staticMargin != null && out.staticMargin < 0) wr.push({ lvl: 'bad', msg: `Tail-heavy: centre of mass is ${(-(out.staticMargin) * 100).toFixed(0)}% chord behind the neutral point. It will pitch up or tumble unless actively flown.` });
    else if (out.staticMargin != null && out.staticMargin < 0.05) wr.push({ lvl: 'warn', msg: 'Marginal pitch stability: twitchy in pitch.' });
    else if (out.staticMargin > 0.45) wr.push({ lvl: 'warn', msg: 'Very nose-heavy: stable like a dart, but it will need lots of up-elevator and dive steeply.' });
    if (out.trimSpeed == null && !(out.staticMargin < 0) && surfs.some((p) => !p.vertical)) wr.push({ lvl: 'warn', msg: out.noseHeavy ? 'Will not trim hands-off: it noses down. Add up-incidence at the front or down at the tail, or move weight aft.' : 'Will not trim hands-off: it pitches up into a stall. Move weight forward or reduce wing incidence.' });
    if (out.trimStalled) wr.push({ lvl: 'warn', msg: 'Trims at a stalled angle of attack - expect mushing flight.' });
    if (!this.hasPitch) wr.push({ lvl: 'warn', msg: 'No pitch control (elevator / elevons): it flies wherever its trim takes it.' });
    if (!this.hasRoll && !this.hasYaw) wr.push({ lvl: 'warn', msg: 'No roll or yaw control: you cannot steer.' });
    else if (!this.hasRoll && this.mainPart && this.mainPart.dihedral < 2) wr.push({ lvl: 'warn', msg: 'Rudder-only steering needs wing dihedral to roll into turns.' });
    if (!out.yawStable) wr.push({ lvl: 'warn', msg: 'Directionally unstable: not enough fin area behind the centre of mass. It will swap ends.' });
    if (out.gLimit < 1.6) wr.push({ lvl: 'bad', msg: `Wing can only carry ${out.gLimit.toFixed(1)} g - it may fold in a turn or gust. Brace it, shorten it, or use a stiffer material.` });
    else if (out.gLimit < 3) wr.push({ lvl: 'warn', msg: `Wing strength is ${out.gLimit.toFixed(1)} g. Fly gently.` });
    if (this.engines.length && out.maxSpeed == null) wr.push({ lvl: 'bad', msg: 'Not enough thrust for level flight: it will only prolong the glide.' });
    for (const p of bp.parts) if ('x' in p && p.type !== 'ballast' && p.x > this.fusLen + 0.02) wr.push({ lvl: 'warn', msg: `A part sits ${Math.round((p.x - this.fusLen) * 1000)} mm beyond the end of the fuselage (unsupported).` });
    if (bp.parts.some((p) => p.type === 'engine' && ENGINES[p.kind].prop > 0) && !bp.parts.some((p) => p.type === 'gear')) wr.push({ lvl: 'info', msg: 'No landing gear: the propeller is at risk on every landing.' });
    if (surfs.some((p) => MATERIALS[p.material].soak > 0.5)) wr.push({ lvl: 'info', msg: 'Paper and cardboard soften and gain weight in rain.' });
    if (out.wingLoading > 2.2) wr.push({ lvl: 'warn', msg: 'High wing loading: needs a long, fast take-off run and lands hot.' });
    out.warnings = wr;
    return out;
  }
}

export { H as SIM_STEP };
