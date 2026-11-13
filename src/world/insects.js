// Garden wildlife with simple, observable state-machine behaviour (not adaptive AI):
// an ant colony foraging along a trail, bees working the flowers, a shy ladybird, a snail, butterflies.
import * as THREE from 'three';
import { WORLD as W, groundHeight as Y, mulberry } from '../sim/world.js';
import { Mat } from '../gfx/textures.js';
import { bake, sph, cyl } from '../gfx/util.js';
import { rod } from '../gfx/aircraftMesh.js';

function antMesh() {
  const g = new THREE.Group(), c = Mat.color(0x5a2416, 0.45), body = new THREE.Group();
  const seg = (r, x, y, sx = 1) => { const m = sph(r, c, x, y, 0, 8); m.scale.x = sx; return m; };
  body.add(seg(0.0022, 0.0042, 0.0034, 1.1), seg(0.0016, 0.0008, 0.003, 1.5), seg(0.003, -0.0042, 0.0036, 1.35));
  body.add(rod([0.006, 0.0038, 0.0008], [0.0092, 0.0058, 0.0024], 0.00018, c, 3), rod([0.006, 0.0038, -0.0008], [0.0092, 0.0058, -0.0024], 0.00018, c, 3));
  g.add(bake(body));
  const legs = [new THREE.Group(), new THREE.Group()];
  for (let i = 0; i < 3; i++) for (const s of [1, -1]) { const x = 0.002 - i * 0.0016, grp = legs[(i + (s > 0 ? 0 : 1)) % 2]; grp.add(rod([x, 0.003, s * 0.001], [x + (i - 1) * -0.001, 0.0042, s * 0.0036], 0.00022, c, 3), rod([x + (i - 1) * -0.001, 0.0042, s * 0.0036], [x + (i - 1) * -0.0022, 0, s * 0.0058], 0.00018, c, 3)); }
  const lg = legs.map((l) => { const b = bake(l); g.add(b); return b; });
  const crumb = sph(0.0022, Mat.color(0xf5efe0, 0.6), 0.0075, 0.0045, 0, 6); crumb.visible = false; g.add(crumb);
  g.userData = { legs: lg, crumb }; return g;
}
function beeMesh() {
  const g = new THREE.Group(), y = Mat.color(0xf2b320, 0.6), k = Mat.color(0x1c1712, 0.6), b = new THREE.Group();
  b.add(sph(0.0035, k, 0.0055, 0, 0, 8), sph(0.0042, y, 0.001, 0.0004, 0, 8)); const ab = sph(0.0048, y, -0.006, 0, 0, 10); ab.scale.x = 1.5; b.add(ab);
  for (const x of [-0.004, -0.0075]) { const s = cyl(0.0046, 0.0044, 0.0014, k, x, 0, 0, 10); s.rotation.z = Math.PI / 2; b.add(s); }
  g.add(bake(b));
  const wm = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, side: THREE.DoubleSide, roughness: 0.2 });
  const wings = [1, -1].map((s) => { const w = new THREE.Mesh(new THREE.CircleGeometry(0.006, 8), wm); w.scale.set(0.5, 1, 1); w.geometry.translate(0, 0.006, 0); const p = new THREE.Group(); p.position.set(0.001, 0.003, s * 0.002); p.add(w); p.userData.s = s; g.add(p); return p; });
  g.userData.wings = wings; return g;
}
function ladybirdMesh() {
  const g = new THREE.Group(), red = Mat.color(0xc62a1e, 0.25), k = Mat.color(0x15120f, 0.4);
  const d = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 12, 8, 0, 6.283, 0, 1.57), red); d.scale.set(1.25, 0.9, 1); g.add(d, sph(0.002, k, 0.0052, 0.001, 0, 8));
  for (const [x, z] of [[0.001, 0.002], [0.001, -0.002], [-0.002, 0.0015], [-0.002, -0.0015], [-0.0005, 0]]) g.add(sph(0.0009, k, x * 1.2, Math.sqrt(Math.max(0, 0.0042 ** 2 - x * x - z * z)) * 0.9, z, 5));
  return bake(g);
}
function snailMesh() {
  const g = new THREE.Group(), body = Mat.color(0xc9a070, 0.35), shell = Mat.color(0x8a5a2a, 0.4), sh2 = Mat.color(0xb07a3c, 0.4);
  const b = sph(0.012, body, 0, 0.007, 0, 10); b.scale.set(3.2, 0.6, 0.9); g.add(b);
  const s = sph(0.02, shell, -0.006, 0.026, 0, 14); s.scale.z = 0.7; g.add(s);
  for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.016 - i * 0.005, 0.0025, 6, 18), sh2); t.position.set(-0.006, 0.026, 0.0142 - i * 0.0006); g.add(t); const t2 = t.clone(); t2.position.z *= -1; g.add(t2); }
  for (const z of [0.005, -0.005]) { g.add(rod([0.034, 0.01, z * 0.6], [0.044, 0.026, z], 0.0011, body, 5), sph(0.002, Mat.color(0x2a2018, 0.4), 0.044, 0.027, z, 6)); }
  return bake(g);
}
function butterflyMesh(hex) {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: hex, side: THREE.DoubleSide, roughness: 0.7 });
  g.add(cyl(0.0008, 0.0008, 0.012, Mat.color(0x2a2018, 0.6), 0, 0, 0, 5)); g.children[0].rotation.z = Math.PI / 2;
  g.userData.wings = [1, -1].map((s) => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.bezierCurveTo(0.004, 0.012, 0.014, 0.014, 0.008, 0.002); sh.bezierCurveTo(0.013, -0.006, 0.003, -0.01, 0, 0); const w = new THREE.Mesh(new THREE.ShapeGeometry(sh), m); w.rotation.x = -Math.PI / 2; const p = new THREE.Group(); p.add(w); p.scale.z = s; g.add(p); return p; });
  return g;
}

export class Insects {
  constructor(scene, garden) {
    this.scene = scene; this.buzzNear = 0; const rnd = this.rnd = mulberry(99);
    // ---- ant colony
    const N = W.nest, F = W.food; this.trail = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14; this.trail.push([N.x + (F.x - N.x) * t + Math.sin(t * 7) * 0.22 * Math.sin(t * Math.PI), N.z + (F.z - N.z) * t + Math.cos(t * 5) * 0.16 * Math.sin(t * Math.PI)]); }
    const mound = new THREE.Group(); for (let i = 0; i < 40; i++) { const a = rnd() * 6.283, r = 0.02 + rnd() * 0.07; mound.add(sph(0.006 + rnd() * 0.008, Mat.color(0x9a8260, 1), Math.cos(a) * r, 0.004 + (0.09 - r) * 0.35, Math.sin(a) * r, 5)); }
    mound.add(cyl(0.014, 0.014, 0.004, Mat.color(0x1a140e, 1), 0, 0.034, 0, 8)); mound.position.set(N.x, Y(N.x, N.z), N.z); scene.add(bake(mound));
    const sugar = new THREE.Group(); sugar.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.06), Mat.color(0xf7f2e6, 0.5))); sugar.children[0].castShadow = true; for (let i = 0; i < 12; i++) sugar.add(sph(0.004, Mat.color(0xf7f2e6, 0.5), (rnd() - 0.5) * 0.16, -0.022, (rnd() - 0.5) * 0.16, 5));
    sugar.position.set(F.x, Y(F.x, F.z) + 0.024, F.z); sugar.rotation.set(0.1, 0.5, 0.06); scene.add(sugar);
    this.ants = Array.from({ length: 16 }, (_, i) => { const m = antMesh(); scene.add(m); return { m, i: (i * 0.9) % 14, dir: i % 2 ? 1 : -1, x: 0, z: 0, off: (rnd() - 0.5) * 0.03, state: 'trail', t: rnd() * 6, yaw: 0, tx: 0, tz: 0, speed: 0.11 + rnd() * 0.05, guard: i < 3 }; });
    for (const a of this.ants) { const p = this.trailPos(a.i); a.x = p[0]; a.z = p[1]; a.m.userData.crumb.visible = a.dir < 0; }
    // ---- bees
    this.perches = garden.beePerches.length ? garden.beePerches : [[0, 0.5, 0]];
    this.bees = Array.from({ length: 4 }, (_, i) => { const m = beeMesh(); scene.add(m); const p = this.perches[(i * 3) % this.perches.length]; return { m, pos: new THREE.Vector3(p[0], p[1] + 0.03, p[2]), from: new THREE.Vector3(), to: new THREE.Vector3(), t: rnd() * 3, state: 'hover', k: 0, perch: (i * 3) % this.perches.length, dodge: 0 }; });
    // ---- ladybird, snail, butterflies
    this.lady = { m: ladybirdMesh(), x: -0.75, z: 0.7, yaw: 0, state: 'crawl', t: 0, y: 0, tx: 0, tz: 0, fly: 0 }; scene.add(this.lady.m);
    this.snail = { m: snailMesh(), t: 0 }; this.snail.m.position.set(garden.snailRock.x, garden.snailRock.y - 0.012, garden.snailRock.z); this.snail.m.rotation.y = 0.8; scene.add(this.snail.m);
    this.flies = [0xf2a11c, 0x7fb6f0, 0xf4f0e0].map((hex, i) => { const m = butterflyMesh(hex); scene.add(m); return { m, pos: new THREE.Vector3(2 + i * 2, 0.4, 3 + i), vel: new THREE.Vector3(), t: i * 2, tgt: new THREE.Vector3(3, 0.5, 4) }; });
  }
  trailPos(f) { const i = Math.max(0, Math.min(13.999, f)), a = this.trail[i | 0], b = this.trail[(i | 0) + 1], t = i - (i | 0); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }

  // ctx: { player:{pos, knock, health}, craft: {pos:[x,y,z], speed, loud, parked} | null, audio, onNip, onBeeStrike }
  update(dt, ctx) {
    const P = ctx.player.pos, C = ctx.craft, N = W.nest, time = performance.now() / 1000;
    const nearNest = Math.hypot(P.x - N.x, P.z - N.z);
    for (const a of this.ants) {
      a.t += dt; let moving = true, sp = a.speed;
      const dP = Math.hypot(P.x - a.x, P.z - a.z), dC = C ? Math.hypot(C.pos[0] - a.x, C.pos[2] - a.z) : 99;
      if (a.state !== 'flee' && C && dC < 0.45 && (C.loud || C.speed > 0.6)) { a.state = 'flee'; a.t = 0; const d = Math.max(dC, 1e-3); a.tx = a.x + (a.x - C.pos[0]) / d * 0.6; a.tz = a.z + (a.z - C.pos[2]) / d * 0.6; }
      else if (a.guard && a.state === 'trail' && nearNest < 0.2 && ctx.playerActive) { a.state = 'guard'; }
      else if (a.state === 'trail' && C && C.parked && dC < 0.5 && dC > 0.06 && a.i > 2 && (a.m.id % 3 === 0)) { a.state = 'inspect'; a.t = 0; }
      if (a.state === 'trail') {
        if (dP < 0.07 && ctx.playerActive) { moving = false; a.yaw = Math.atan2(P.x - a.x, P.z - a.z) - Math.PI / 2; } // stop and wave antennae at you
        else { a.i += a.dir * sp * dt / 0.3; if (a.i >= 13.9) { a.dir = -1; a.m.userData.crumb.visible = true; } if (a.i <= 0.1) { a.dir = 1; a.m.userData.crumb.visible = false; }
          const p = this.trailPos(a.i), q = this.trailPos(a.i + a.dir * 0.2), nx = -(q[1] - p[1]), nz = q[0] - p[0], nl = Math.hypot(nx, nz) || 1; a.tx = p[0] + nx / nl * a.off * a.dir; a.tz = p[1] + nz / nl * a.off * a.dir; }
      } else if (a.state === 'flee') { sp = 0.32; if (a.t > 2.2) a.state = 'return'; }
      else if (a.state === 'guard') { sp = 0.3; a.tx = P.x; a.tz = P.z; if (nearNest > 0.6 || !ctx.playerActive) a.state = 'return'; else if (dP < 0.016 && a.t > 1.2) { a.t = 0; ctx.onNip(a); } }
      else if (a.state === 'inspect') { const ang = a.t * 1.2 + a.m.id; a.tx = C ? C.pos[0] + Math.cos(ang) * 0.1 : a.x; a.tz = C ? C.pos[2] + Math.sin(ang) * 0.1 : a.z; if (a.t > 9 || !C || !C.parked) a.state = 'return'; }
      else if (a.state === 'return') { const p = this.trailPos(a.i); a.tx = p[0]; a.tz = p[1]; if (Math.hypot(a.x - p[0], a.z - p[1]) < 0.02) a.state = 'trail'; }
      if (moving) { const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz); if (d > 0.004) { const st = Math.min(d, sp * dt * (a.state === 'trail' ? 3 : 1)); a.x += dx / d * st; a.z += dz / d * st; let ty = Math.atan2(dx, dz) - Math.PI / 2, dy = ty - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); a.yaw += dy * Math.min(1, dt * 10); } else moving = false; }
      a.m.position.set(a.x, Y(a.x, a.z), a.z); a.m.rotation.y = a.yaw;
      const sw = moving ? Math.sin(time * 38 * (sp / 0.12) + a.m.id) * 0.5 : 0; a.m.userData.legs[0].rotation.y = sw; a.m.userData.legs[1].rotation.y = -sw;
    }
    // bees: hover on a flower, then commute to another
    let near = 0;
    for (const b of this.bees) {
      b.t -= dt;
      if (b.state === 'hover') { const p = this.perches[b.perch]; b.pos.set(p[0] + Math.sin(time * 2 + b.m.id) * 0.02, p[1] + 0.025 + Math.sin(time * 3.1 + b.m.id) * 0.012, p[2] + Math.cos(time * 1.7 + b.m.id) * 0.02);
        if (b.t < 0) { b.state = 'fly'; b.k = 0; b.from.copy(b.pos); b.perch = (b.perch + 1 + ((this.rnd() * 5) | 0)) % this.perches.length; const q = this.perches[b.perch]; b.to.set(q[0], q[1] + 0.03, q[2]); b.dur = Math.max(1, b.from.distanceTo(b.to) / 0.9); } }
      else { b.k += dt / b.dur; const k = b.k * b.k * (3 - 2 * b.k); const prev = b.pos.clone(); b.pos.lerpVectors(b.from, b.to, k); b.pos.y += Math.sin(Math.PI * k) * 0.25 + Math.sin(time * 9) * 0.01;
        const d = b.pos.clone().sub(prev); if (d.lengthSq() > 1e-10) b.m.rotation.y = Math.atan2(-d.z, d.x); if (b.k >= 1) { b.state = 'hover'; b.t = 3 + this.rnd() * 5; } }
      b.m.position.copy(b.pos); for (const w of b.m.userData.wings) w.rotation.x = w.userData.s * (0.3 + Math.sin(time * 190) * 0.9);
      const ear = ctx.ear; const de = ear ? b.pos.distanceTo(ear) : 9; near = Math.max(near, 1 - Math.min(1, de / 0.8));
      if (C && !C.parked) { const dc = Math.hypot(b.pos.x - C.pos[0], b.pos.y - C.pos[1], b.pos.z - C.pos[2]); b.dodge -= dt; if (dc < 0.07 && b.dodge <= 0) { b.dodge = 3; ctx.onBeeStrike(b); } }
    }
    this.buzzNear = near;
    // ladybird: crawls about; takes off when you come close
    const L = this.lady; L.t -= dt; const dl = Math.hypot(P.x - L.x, P.z - L.z);
    if (L.state === 'crawl') { if (L.t < 0) { L.t = 2 + this.rnd() * 3; L.yaw += (this.rnd() - 0.5) * 2; } L.x += Math.cos(L.yaw) * 0.012 * dt; L.z -= Math.sin(L.yaw) * 0.012 * dt; L.y = Y(L.x, L.z);
      if (dl < 0.09 && ctx.playerActive) { L.state = 'fly'; L.fly = 0; L.fx = L.x; L.fz = L.z; const a = Math.atan2(L.z - P.z, L.x - P.x) + (this.rnd() - 0.5); L.tx = L.x + Math.cos(a) * 0.9; L.tz = L.z + Math.sin(a) * 0.9; L.yaw = -a; ctx.audio.play('paper'); } }
    else { L.fly += dt / 2.2; const k = Math.min(1, L.fly); L.x = L.fx + (L.tx - L.fx) * k; L.z = L.fz + (L.tz - L.fz) * k; L.y = Y(L.x, L.z) + Math.sin(Math.PI * k) * 0.3; if (k >= 1) L.state = 'crawl'; }
    L.m.position.set(L.x, L.y, L.z); L.m.rotation.y = L.yaw;
    // snail: an extremely unhurried neighbour
    this.snail.t += dt; this.snail.m.rotation.y = 0.8 + Math.sin(this.snail.t * 0.05) * 0.6; this.snail.m.scale.x = 1 + Math.sin(this.snail.t * 0.7) * 0.03;
    // butterflies
    for (const f of this.flies) { f.t -= dt; if (f.t < 0) { f.t = 2 + this.rnd() * 4; const p = this.perches[(this.rnd() * this.perches.length) | 0]; f.tgt.set(p[0] + (this.rnd() - 0.5), Math.min(p[1], 0.9) + this.rnd() * 0.3, p[2] + (this.rnd() - 0.5)); }
      f.vel.addScaledVector(f.tgt.clone().sub(f.pos).normalize(), dt * 0.5).multiplyScalar(1 - dt * 0.8); f.vel.y += Math.sin(time * 6 + f.m.id) * dt * 0.3; f.pos.addScaledVector(f.vel, dt);
      f.m.position.copy(f.pos); f.m.rotation.y = Math.atan2(-f.vel.z, f.vel.x); const fl = Math.abs(Math.sin(time * 11 + f.m.id)) * 1.3; f.m.userData.wings[0].rotation.x = -fl; f.m.userData.wings[1].rotation.x = fl; }
  }
}
