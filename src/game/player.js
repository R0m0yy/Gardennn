// The one-inch inventor: walking, running, jumping, crouching, wading, carrying an aircraft.
import * as THREE from 'three';
import { groundHeight, groundNormal, surfaceAt, collidePoint, WORLD } from '../sim/world.js';
import { buildFigure, animateFigure, FIG_H } from '../gfx/figure.js';

const WALK = 0.17, RUN = 0.46, R = 0.007;
export class Player {
  constructor(scene) {
    this.mesh = buildFigure(); scene.add(this.mesh);
    this.pos = new THREE.Vector3(0.05, 0, 0.35); this.pos.y = groundHeight(this.pos.x, this.pos.z);
    this.vy = 0; this.yaw = Math.PI; this.onGround = true; this.speed01 = 0; this.crouch = false; this.carrying = false; this.health = 1; this.stepT = 0; this.visible = true; this.surface = 'packed earth'; this.knock = new THREE.Vector3(); this.work = 0;
  }
  // move: {x,z} desired direction in world space (length 0..1)
  update(dt, move, run, jump, crouch, audio, wet) {
    this.crouch = crouch && this.onGround;
    const surf = surfaceAt(this.pos.x, this.pos.z, wet); this.surface = surf.name;
    const wading = surf.water != null ? Math.max(0, surf.water - groundHeight(this.pos.x, this.pos.z)) : 0;
    let sp = (run ? RUN : WALK) * (this.crouch ? 0.45 : 1) * (this.carrying ? 0.75 : 1) * (surf.name.includes('mud') ? 0.55 : 1) * (wading > 0.004 ? 0.5 : 1);
    const mag = Math.min(1, Math.hypot(move.x, move.z));
    let vx = move.x * sp + this.knock.x, vz = move.z * sp + this.knock.z; this.knock.multiplyScalar(Math.max(0, 1 - dt * 6));
    if (mag > 0.05) { const ty = Math.atan2(move.x, move.z); let d = ty - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * Math.min(1, dt * 12); }
    // slopes: too steep to climb
    const nx = this.pos.x + vx * dt, nz = this.pos.z + vz * dt, n = groundNormal(nx, nz);
    if (n[1] < 0.6 && groundHeight(nx, nz) > this.pos.y + 0.002) { vx *= 0.15; vz *= 0.15; }
    this.pos.x += vx * dt; this.pos.z += vz * dt;
    // obstacles: sample a ring around the body and push out
    for (let i = 0; i < 6; i++) { const a = i * 1.047, h = collidePoint([this.pos.x + Math.cos(a) * R, this.pos.y + 0.01, this.pos.z + Math.sin(a) * R]);
      if (h && h.normal[1] < 0.7) { this.pos.x += h.normal[0] * h.depth; this.pos.z += h.normal[2] * h.depth; } }
    const lim = WORLD.half + 1.6; this.pos.x = THREE.MathUtils.clamp(this.pos.x, -lim, lim); this.pos.z = THREE.MathUtils.clamp(this.pos.z, -lim, lim);
    // vertical
    let floor = groundHeight(this.pos.x, this.pos.z);
    const top = collidePoint([this.pos.x, this.pos.y + 0.004, this.pos.z]); if (top && top.normal[1] > 0.7) floor = Math.max(floor, this.pos.y + 0.004 + top.depth);
    if (wading > FIG_H * 0.6) floor = surf.water - FIG_H * 0.6;   // swim: float chest-deep
    if (jump && this.onGround && !this.carrying) { this.vy = 0.24; this.onGround = false; audio.play('jump'); }
    if (!this.onGround) { this.vy -= 1.5 * dt; this.pos.y += this.vy * dt; if (this.pos.y <= floor) { this.pos.y = floor; this.onGround = true; if (this.vy < -0.1) audio.play('land', Math.min(1.5, -this.vy * 3)); this.vy = 0; } }
    else if (this.pos.y - floor > 0.012) { this.onGround = false; this.vy = 0; } else this.pos.y = floor;
    this.speed01 = mag * sp / RUN;
    // footsteps
    if (this.onGround && mag > 0.05) { this.stepT -= dt * (5 + 9 * this.speed01); if (this.stepT <= 0) { this.stepT = 1; audio.play(wading > 0.003 ? 'splashStep' : surf.name.includes('mud') ? 'stepMud' : (top || surf.rail) ? 'stepWood' : 'step'); } }
    this.sync(dt);
  }
  sync(dt) {
    this.mesh.visible = this.visible; this.mesh.position.copy(this.pos); this.mesh.rotation.y = this.yaw;
    animateFigure(this.mesh, { dt, speed: this.speed01, air: !this.onGround, crouch: this.crouch, carry: this.carrying, work: this.work > 0 }); if (this.work > 0) this.work -= dt;
  }
}
