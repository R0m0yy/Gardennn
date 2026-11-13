// Minimal vector / quaternion maths for the simulation core.
// Vectors are [x,y,z]; quaternions are [x,y,z,w] and rotate BODY -> WORLD.
// Body frame: +X nose, +Y up, +Z starboard (right wing).
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
export const DEG = Math.PI / 180;

export function qRot(q, v) { // body -> world
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
}
export function qInvRot(q, v) { return qRot([-q[0], -q[1], -q[2], q[3]], v); }
export function qMul(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}
export function qNorm(q) { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; }
export function qIntegrate(q, wBody, dt) {
  const d = qMul(q, [wBody[0], wBody[1], wBody[2], 0]);
  return qNorm([q[0] + 0.5 * d[0] * dt, q[1] + 0.5 * d[1] * dt, q[2] + 0.5 * d[2] * dt, q[3] + 0.5 * d[3] * dt]);
}
export function qAxis(axis, ang) { const s = Math.sin(ang / 2); return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(ang / 2)]; }
// heading: compass degrees-style radians, clockwise from north (-Z). pitch: nose up. roll: right wing down.
export function qFromHPR(heading, pitch, roll) {
  // yaw about +Y is counter-clockwise; nose at +X means heading 90deg (east) at yaw 0.
  const yaw = Math.PI / 2 - heading;
  return qMul(qMul(qAxis([0, 1, 0], yaw), qAxis([0, 0, 1], pitch)), qAxis([1, 0, 0], roll));
}
export function hprFromQ(q) {
  const f = qRot(q, [1, 0, 0]), r = qRot(q, [0, 0, 1]), u = qRot(q, [0, 1, 0]);
  const heading = Math.atan2(f[0], -f[2]);
  const pitch = Math.asin(clamp(f[1], -1, 1));
  const roll = Math.atan2(-r[1], u[1]);
  return { heading: (heading + 2 * Math.PI) % (2 * Math.PI), pitch, roll };
}
