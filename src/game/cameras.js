// Camera rig: isometric exploration, chase, cockpit and workshop orbit views with smoothing.
import * as THREE from 'three';
import { groundHeight } from '../sim/world.js';

const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
export class CameraRig {
  constructor(camera) {
    this.cam = camera; this.mode = 'explore';
    this.yaw = 0.55; this.pitch = 0.62; this.dist = 0.55;        // explore
    this.chaseDist = 0.42; this.target = new THREE.Vector3(); this.lookAt = new THREE.Vector3(); this.shake = 0;
    this.orbit = { yaw: 0.7, pitch: 0.45, dist: 0.5 };
  }
  // heading of the camera's forward direction on the ground plane (for camera-relative movement)
  get forward() { return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) }; }
  input(inp) {
    if (this.mode === 'explore') { this.yaw -= inp.look.dx * 0.006; this.pitch = THREE.MathUtils.clamp(this.pitch + inp.look.dy * 0.004, 0.18, 1.35); this.dist = THREE.MathUtils.clamp(this.dist * (1 + inp.wheel * 0.12), 0.16, 2.6); this.yaw += inp.axis(['ArrowRight'], ['ArrowLeft']) * 0.03; }
    else if (this.mode === 'chase') { this.chaseDist = THREE.MathUtils.clamp(this.chaseDist * (1 + inp.wheel * 0.12), 0.18, 2.5); this.orbit.yaw -= inp.look.dx * 0.006; this.orbit.pitch = THREE.MathUtils.clamp(this.orbit.pitch + inp.look.dy * 0.004, -0.3, 1.2); }
    else if (this.mode === 'orbit') { this.orbit.yaw -= inp.look.dx * 0.008; this.orbit.pitch = THREE.MathUtils.clamp(this.orbit.pitch + inp.look.dy * 0.006, -0.25, 1.4); this.orbit.dist = THREE.MathUtils.clamp(this.orbit.dist * (1 + inp.wheel * 0.12), 0.08, 1.2); }
  }
  // focus: Vector3; q: aircraft quaternion (flight modes); speed for FOV effect
  update(dt, focus, q, speed = 0, snap = false) {
    const cam = this.cam, k = snap ? 1 : 1 - Math.exp(-dt * 7);
    let fov = 38;
    if (this.mode === 'explore') {
      this.target.lerp(tmp.copy(focus).add(tmp2.set(0, 0.02, 0)), snap ? 1 : 1 - Math.exp(-dt * 9));
      const cp = Math.cos(this.pitch); tmp.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp).multiplyScalar(this.dist).add(this.target);
      cam.position.lerp(tmp, k); this.lookAt.copy(this.target);
    } else if (this.mode === 'chase') {
      // behind and above along the velocity/heading, with mouse-look offset that springs back
      this.orbit.yaw *= Math.exp(-dt * 1.2); this.orbit.pitch += (0.22 - this.orbit.pitch) * (1 - Math.exp(-dt * 1.2));
      const f = tmp.set(1, 0, 0).applyQuaternion(q); const hd = Math.atan2(f.x, f.z) + Math.PI + this.orbit.yaw, cp = Math.cos(this.orbit.pitch);
      tmp2.set(Math.sin(hd) * cp, Math.sin(this.orbit.pitch) - f.y * 0.35, Math.cos(hd) * cp).multiplyScalar(this.chaseDist).add(focus);
      cam.position.lerp(tmp2, snap ? 1 : 1 - Math.exp(-dt * 4.5)); this.target.lerp(tmp.copy(focus).addScaledVector(f, 0.08), snap ? 1 : 1 - Math.exp(-dt * 10)); this.lookAt.copy(this.target);
      fov = 42 + Math.min(16, speed * 1.6);
    } else if (this.mode === 'cockpit') {
      tmp.set(-0.004, 0.011, 0).applyQuaternion(q).add(focus); cam.position.copy(tmp);
      this.lookAt.copy(tmp2.set(1, -0.06, 0).applyQuaternion(q).add(tmp)); cam.up.set(0, 1, 0).applyQuaternion(q); fov = 62;
    } else if (this.mode === 'orbit') {
      const o = this.orbit, cp = Math.cos(o.pitch); this.target.lerp(focus, k);
      tmp.set(Math.sin(o.yaw) * cp, Math.sin(o.pitch), Math.cos(o.yaw) * cp).multiplyScalar(o.dist).add(this.target); cam.position.lerp(tmp, snap ? 1 : 1 - Math.exp(-dt * 10)); this.lookAt.copy(this.target);
    }
    if (this.mode !== 'cockpit') cam.up.set(0, 1, 0);
    // never let the camera sink into the soil
    if (this.mode !== 'orbit' || !this.noGround) { const g = groundHeight(cam.position.x, cam.position.z) + 0.03; if (cam.position.y < g) cam.position.y = g; }
    if (this.shake > 0.001) { cam.position.x += (Math.random() - 0.5) * this.shake * 0.02; cam.position.y += (Math.random() - 0.5) * this.shake * 0.02; this.shake *= Math.exp(-dt * 6); }
    cam.lookAt(this.lookAt);
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix(); }
  }
}
