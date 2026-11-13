// A one-inch-tall articulated inventor: flat cap, goggles, waistcoat, braces. Procedurally animated.
import * as THREE from 'three';
import { Mat } from './textures.js';

export const FIG_H = 0.025;

export function buildFigure(palette = {}) {
  const P = { shirt: 0xe8e0cf, vest: 0x5b4a3a, trousers: 0x4a4f58, skin: 0xe2b48c, cap: 0x6a5846, boots: 0x2e2018, ...palette };
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body); body.scale.setScalar(FIG_H);
  const m = (hex, r = 0.85) => Mat.color(hex, r);
  const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.set(x, y, z); o.castShadow = true; return o; };
  const cap = (r, len, mat) => { const o = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 8), mat); o.castShadow = true; return o; };
  const hips = new THREE.Group(); hips.position.y = 0.5; body.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  torso.add(box(0.25, 0.3, 0.15, m(P.shirt), 0, 0.17, 0), box(0.265, 0.24, 0.165, m(P.vest), 0, 0.15, -0.004), box(0.24, 0.1, 0.15, m(P.trousers), 0, -0.02, 0));
  torso.add(box(0.03, 0.3, 0.17, m(0x7a2e22), 0.07, 0.17, 0), box(0.03, 0.3, 0.17, m(0x7a2e22), -0.07, 0.17, 0)); // braces
  const head = new THREE.Group(); head.position.y = 0.4; torso.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), m(P.skin, 0.7)); skull.castShadow = true; head.add(skull);
  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.1, 0.045, 12), m(P.cap)); capTop.position.set(0, 0.06, -0.01); capTop.castShadow = true;
  const brim = box(0.13, 0.012, 0.08, m(P.cap), 0, 0.04, 0.09);
  const gog = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.008, 6, 10), Mat.metal('brass')); gog.position.set(0.035, 0.012, 0.075); const gog2 = gog.clone(); gog2.position.x = -0.035;
  head.add(capTop, brim, gog, gog2, box(0.05, 0.03, 0.03, m(P.skin, 0.7), 0, -0.02, 0.085));
  const limb = (x, y, upLen, loLen, r, matU, matL, foot) => {
    const j = new THREE.Group(); j.position.set(x, y, 0);
    const up = cap(r, upLen - r, matU); up.position.y = -upLen / 2; j.add(up);
    const k = new THREE.Group(); k.position.y = -upLen; j.add(k);
    const lo = cap(r * 0.9, loLen - r, matL); lo.position.y = -loLen / 2; k.add(lo);
    if (foot) k.add(box(0.075, 0.05, 0.14, m(P.boots, 0.6), 0, -loLen - 0.0, 0.03)); else { const h = new THREE.Mesh(new THREE.SphereGeometry(r * 1.15, 8, 6), m(P.skin, 0.7)); h.position.y = -loLen; k.add(h); }
    return { j, k };
  };
  const armL = limb(0.16, 0.3, 0.17, 0.16, 0.035, m(P.shirt), m(P.shirt)), armR = limb(-0.16, 0.3, 0.17, 0.16, 0.035, m(P.shirt), m(P.shirt));
  torso.add(armL.j, armR.j);
  const legL = limb(0.07, 0, 0.24, 0.24, 0.045, m(P.trousers), m(P.trousers), true), legR = limb(-0.07, 0, 0.24, 0.24, 0.045, m(P.trousers), m(P.trousers), true);
  hips.add(legL.j, legR.j);
  root.userData.fig = { body, hips, torso, head, armL, armR, legL, legR, phase: 0 };
  return root;
}

// s: { speed (0..1 of run), dt, air, crouch, carry, pose: 'stand'|'seated'|'prone', work }
export function animateFigure(root, s) {
  const f = root.userData.fig, L = THREE.MathUtils.lerp, k = Math.min(1, (s.dt || 0.016) * 12);
  let hipY = 0.5, tilt = 0, aL = 0, aR = 0, eL = -0.15, eR = -0.15, lL = 0, lR = 0, kL = 0, kR = 0, bodyRX = 0, armOut = 0;
  if (s.pose === 'seated') { hipY = 0.2; lL = lR = -1.45; kL = kR = 1.3; aL = aR = -0.9; eL = eR = -0.7; }
  else if (s.pose === 'prone') { hipY = 0.12; bodyRX = Math.PI / 2 - 0.12; aL = aR = -2.6; eL = eR = -0.3; lL = lR = 0.05; kL = kR = 0.1; }
  else {
    f.phase += (s.dt || 0.016) * (6 + 12 * s.speed) * (s.speed > 0.02 ? 1 : 0);
    const sw = Math.sin(f.phase), amp = 0.25 + 0.75 * Math.min(s.speed, 1);
    if (s.air) { lL = -0.5; lR = 0.3; kL = 0.9; kR = 0.5; aL = -2.2; aR = -2.0; tilt = 0.1; }
    else if (s.speed > 0.02) {
      lL = sw * 0.9 * amp; lR = -sw * 0.9 * amp; kL = Math.max(0, -Math.cos(f.phase)) * 1.3 * amp; kR = Math.max(0, Math.cos(f.phase)) * 1.3 * amp;
      aL = -sw * 0.8 * amp; aR = sw * 0.8 * amp; eL = eR = -0.3 - 0.6 * amp; tilt = 0.08 + 0.2 * s.speed; hipY += Math.abs(Math.cos(f.phase)) * 0.025 * amp;
    } else { const b = Math.sin(performance.now() / 900); hipY += b * 0.004; aL = 0.03 * b; aR = -0.03 * b; }
    if (s.crouch) { hipY -= 0.17; lL -= 0.9; lR -= 0.9; kL += 1.6; kR += 1.6; tilt += 0.35; }
    if (s.carry) { aL = aR = -2.9; eL = eR = -0.25; armOut = 0.25; }
    if (s.work) { const t = performance.now() / 160; aR = -1.2 + Math.sin(t) * 0.5; eR = -0.9; aL = -0.7; eL = -0.8; tilt = 0.25; }
  }
  f.hips.position.y = L(f.hips.position.y, hipY, k);
  f.body.rotation.x = L(f.body.rotation.x, bodyRX, k);
  f.torso.rotation.x = L(f.torso.rotation.x, tilt, k);
  const set = (limb, a, e, out = 0, side = 1) => { limb.j.rotation.x = L(limb.j.rotation.x, a, k); limb.k.rotation.x = L(limb.k.rotation.x, e, k); limb.j.rotation.z = L(limb.j.rotation.z, out * side, k); };
  set(f.armL, aL, eL, armOut, 1); set(f.armR, aR, eR, armOut, -1); set(f.legL, lL, kL); set(f.legR, lR, kR);
}
