// Hand-built miniature architecture: the inventor's workshop, launch sites, the Garden Fortress and trench line.
import * as THREE from 'three';
import { WORLD as W, groundHeight as Y, addCollider, mulberry } from '../sim/world.js';
import { Mat, T } from '../gfx/textures.js';
import { bake, box, cyl, sph } from '../gfx/util.js';
import { rod } from '../gfx/aircraftMesh.js';

export const HUT = { x: -0.55, z: -0.5, w: 0.52, d: 0.36, wall: 0.2, ridge: 0.34 };
export const PAD = { x: 0.42, z: 0.38 };
// Sunflower Circuit hoops: centre, radius, facing heading
export const HOOPS = [
  { x: 5.2, y: 0.55, z: 2.6, r: 0.24, h: 0.6 }, { x: 8.2, y: 0.85, z: 5.2, r: 0.24, h: 2.2 },
  { x: 6.2, y: 0.95, z: 8.0, r: 0.24, h: 4.2 }, { x: 3.6, y: 0.7, z: 5.6, r: 0.24, h: 5.6 },
];

function lantern(lit = true) {
  const g = new THREE.Group(), br = Mat.metal('brass');
  g.add(cyl(0.006, 0.007, 0.002, br, 0, 0, 0, 8), cyl(0.005, 0.002, 0.004, br, 0, 0.016, 0, 8), rod([0, 0.018, 0], [0, 0.03, 0], 0.0006, br, 4));
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.0048, 0.0055, 0.013, 8), new THREE.MeshStandardMaterial({ color: 0xffc46a, emissive: 0xffa030, emissiveIntensity: lit ? 2.2 : 0.2, roughness: 0.3 })); glass.position.y = 0.0075; glass.userData.noBake = true; glass.userData.lantern = true; g.add(glass);
  return g;
}
function crate(s = 0.03) { const g = new THREE.Group(), w = Mat.wood('mid'), d = Mat.wood('dark'); g.add(box(s, s, s, w, 0, s / 2, 0)); for (const a of [-1, 1]) g.add(box(s * 1.04, s * 0.12, s * 1.04, d, 0, s / 2 + a * s * 0.4, 0), box(s * 0.12, s, s * 1.05, d, a * s * 0.45, s / 2, 0)); return g; }
function barrel(s = 0.02) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.8, s * 0.8, s * 2.2, 12, 3), Mat.wood('mid')); const p = b.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + 0.22 * Math.cos(p.getY(i) / (s * 1.1) * 1.4); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } b.position.y = s * 1.1; g.add(b); for (const y of [0.35, 1.1, 1.85]) g.add(cyl(s * (y === 1.1 ? 1.0 : 0.9), s * (y === 1.1 ? 1.0 : 0.9), s * 0.12, Mat.metal('steel'), 0, s * y, 0, 12)); return g; }
function gearWheel(r) { const g = new THREE.Group(), m = Mat.metal('brass'); g.add(cyl(r, r, r * 0.16, m, 0, 0, 0, 16)); for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; const t = box(r * 0.28, r * 0.16, r * 0.24, m, Math.cos(a) * r * 1.08, 0, Math.sin(a) * r * 1.08, -a); g.add(t); } g.add(cyl(r * 0.25, r * 0.25, r * 0.3, Mat.metal('steel'), 0, 0, 0, 8)); g.rotation.x = Math.PI / 2; return g; }

function buildHut(scene, out) {
  const g = new THREE.Group(), h = HUT, wd = Mat.wood('mid'), dk = Mat.wood('dark'), lt = Mat.wood('light'), base = Y(h.x, h.z) + 0.004;
  g.position.set(h.x, base, h.z);
  // plank floor + boardwalk
  for (let i = 0; i < 13; i++) g.add(box(0.039, 0.006, h.d + 0.02, i % 2 ? wd : dk, -h.w / 2 + 0.02 + i * 0.04, 0.003, 0));
  for (let i = 0; i < 16; i++) g.add(box(0.05 + (i % 3) * 0.004, 0.005, 0.034, i % 2 ? wd : Mat.wood('grey'), 0.02 + (i % 2) * 0.004, 0.001, h.d / 2 + 0.03 + i * 0.037));
  // timber frame
  const post = (x, z, hh = h.wall) => g.add(box(0.016, hh, 0.016, dk, x, hh / 2, z));
  for (const x of [-h.w / 2, -h.w / 6, h.w / 6, h.w / 2]) { post(x, -h.d / 2); if (Math.abs(x) > 0.2) post(x, h.d / 2); }
  post(-h.w / 2, 0); post(h.w / 2, 0);
  g.add(box(h.w + 0.03, 0.014, 0.014, dk, 0, h.wall, -h.d / 2), box(h.w + 0.03, 0.014, 0.014, dk, 0, h.wall, h.d / 2), box(0.014, 0.014, h.d, dk, -h.w / 2, h.wall, 0), box(0.014, 0.014, h.d, dk, h.w / 2, h.wall, 0));
  // walls: back and left planked, right half-open
  for (let i = 0; i < 9; i++) g.add(box(h.w, 0.021, 0.006, i % 2 ? wd : lt, 0, 0.012 + i * 0.022, -h.d / 2 + 0.004));
  for (let i = 0; i < 9; i++) g.add(box(0.006, 0.021, h.d, i % 2 ? wd : dk, -h.w / 2 + 0.004, 0.012 + i * 0.022, 0));
  for (let i = 0; i < 4; i++) g.add(box(0.006, 0.021, h.d, i % 2 ? wd : dk, h.w / 2 - 0.004, 0.012 + i * 0.022, 0));
  // roof trusses + shingles
  const rise = h.ridge - h.wall, run = h.d / 2 + 0.05, slope = Math.atan2(rise, run), len = Math.hypot(rise, run);
  for (const x of [-h.w / 2, -h.w / 6, h.w / 6, h.w / 2]) for (const s of [-1, 1]) { const r = box(0.012, 0.012, len, dk, x, h.wall + rise / 2, s * run / 2); r.rotation.x = s * slope; g.add(r); }
  for (const x of [-h.w / 2, h.w / 2]) g.add(box(0.012, rise, 0.012, dk, x, h.wall + rise / 2, 0), box(0.01, 0.01, h.d * 0.6, dk, x, h.wall + rise * 0.45, 0));
  const sh = Mat.shingle();
  for (const s of [-1, 1]) { const r = box(h.w + 0.08, 0.008, len + 0.02, sh, 0, h.wall + rise / 2 + 0.008, s * run / 2); r.rotation.x = s * slope; g.add(r); }
  g.add(box(h.w + 0.09, 0.012, 0.02, dk, 0, h.ridge + 0.008, 0));
  const rm = mulberry(5); for (let i = 0; i < 22; i++) { const m = sph(0.012 + rm() * 0.02, Mat.color(0x5f8f32, 1), (rm() - 0.5) * h.w, 0, 0, 6); const s = rm() > 0.5 ? 1 : -1, t = rm(); m.position.y = h.wall + rise * (1 - t) + 0.014; m.position.z = s * run * t; m.scale.y = 0.3; g.add(m); }
  // blueprint board on the back wall
  const bx = -0.04, bp = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.11), new THREE.MeshStandardMaterial({ map: T.blueprint(), roughness: 0.9 })); bp.position.set(bx, 0.115, -h.d / 2 + 0.012); g.add(bp);
  g.add(box(0.162, 0.006, 0.006, dk, bx, 0.172, -h.d / 2 + 0.011), box(0.162, 0.006, 0.006, dk, bx, 0.058, -h.d / 2 + 0.011), box(0.006, 0.12, 0.006, dk, bx - 0.078, 0.115, -h.d / 2 + 0.011), box(0.006, 0.12, 0.006, dk, bx + 0.078, 0.115, -h.d / 2 + 0.011));
  // design bench under it
  g.add(box(0.2, 0.006, 0.05, lt, bx, 0.034, -h.d / 2 + 0.05)); for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.006, 0.032, 0.006, dk, bx + sx * 0.092, 0.016, -h.d / 2 + 0.05 + sz * 0.02));
  g.add(box(0.05, 0.001, 0.035, Mat.color(0xe9dcbb, 0.9), bx - 0.03, 0.0378, -h.d / 2 + 0.05, 0.2), cyl(0.003, 0.003, 0.05, Mat.color(0xe9dcbb, 0.9), bx + 0.05, 0.04, -h.d / 2 + 0.055, 8));
  g.children[g.children.length - 1].rotation.z = Math.PI / 2;
  const gw = gearWheel(0.014); gw.position.set(bx + 0.14, 0.15, -h.d / 2 + 0.014); g.add(gw); const gw2 = gearWheel(0.009); gw2.position.set(bx + 0.162, 0.132, -h.d / 2 + 0.014); g.add(gw2);
  // shelves with jars on the left wall
  for (const y of [0.07, 0.115, 0.16]) { g.add(box(0.03, 0.004, 0.2, wd, -h.w / 2 + 0.022, y, -0.02)); for (let i = 0; i < 7; i++) g.add(cyl(0.005, 0.005, 0.012 + (i % 3) * 0.004, i % 2 ? Mat.metal('brass') : Mat.color([0x7a9bb0, 0xb07a4a, 0x9ab07a][i % 3], 0.3), -h.w / 2 + 0.022, y + 0.009, -0.105 + i * 0.028, 8)); }
  // journal desk + stool on the right, radio set with glowing valves
  const jx = h.w / 2 - 0.06, jz = -0.06;
  g.add(box(0.07, 0.005, 0.05, lt, jx, 0.03, jz), box(0.03, 0.004, 0.022, Mat.color(0x6b2a22, 0.6), jx - 0.01, 0.0345, jz), box(0.028, 0.001, 0.02, Mat.color(0xf1e8cf, 0.9), jx - 0.01, 0.037, jz), cyl(0.008, 0.008, 0.018, wd, jx - 0.02, 0.009, jz + 0.045, 8));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.005, 0.03, 0.005, dk, jx + sx * 0.03, 0.015, jz + sz * 0.02));
  g.add(box(0.03, 0.02, 0.02, Mat.wood('dark'), jx + 0.012, 0.043, jz - 0.012)); for (let i = 0; i < 3; i++) { const v = cyl(0.0025, 0.0025, 0.009, new THREE.MeshStandardMaterial({ color: 0xffb060, emissive: 0xff8020, emissiveIntensity: 1.6 }), jx + 0.004 + i * 0.008, 0.058, jz - 0.012, 6); v.userData.noBake = true; g.add(v); }
  // crates, barrels, ladder
  const c1 = crate(0.034); c1.position.set(h.w / 2 - 0.035, 0.006, 0.1); const c2 = crate(0.026); c2.position.set(h.w / 2 - 0.04, 0.04, 0.105); c2.rotation.y = 0.4; const c3 = crate(0.03); c3.position.set(h.w / 2 + 0.05, 0, 0.14); c3.rotation.y = 0.2;
  const b1 = barrel(0.014); b1.position.set(-h.w / 2 + 0.04, 0.006, h.d / 2 - 0.03); const b2 = barrel(0.012); b2.position.set(-h.w / 2 - 0.03, 0, h.d / 2 + 0.02);
  g.add(c1, c2, c3, b1, b2);
  for (const s of [-1, 1]) g.add(rod([h.w / 2 + 0.012 + s * 0.012, 0, -0.1], [h.w / 2 + 0.03 + s * 0.012, h.wall + 0.03, -0.12], 0.0022, lt, 5)); for (let i = 1; i < 8; i++) g.add(rod([h.w / 2 + 0.002 + i * 0.0026, i * 0.028, -0.1 - i * 0.0026], [h.w / 2 + 0.026 + i * 0.0026, i * 0.028, -0.1 - i * 0.0026], 0.0016, lt, 4));
  // banner with the gear emblem
  const bn = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.09), new THREE.MeshStandardMaterial({ map: T.banner(), side: THREE.DoubleSide, roughness: 0.9 })); bn.position.set(-h.w / 2 - 0.004, 0.135, h.d / 2 + 0.012); g.add(bn);
  // awning + assembly deck (where prototypes are rolled out)
  const ax = PAD.x - h.x, az = PAD.z - h.z;
  for (let i = 0; i < 11; i++) g.add(box(0.036, 0.006, 0.4, i % 2 ? wd : Mat.wood('grey'), ax - 0.18 + i * 0.037, 0.001, az));
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.22, 6, 4), new THREE.MeshStandardMaterial({ map: T.fabric(), color: 0xd98a70, side: THREE.DoubleSide, roughness: 0.9 })); { const p = cloth.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, -Math.cos(p.getX(i) * 9) * 0.012 - Math.cos(p.getY(i) * 12) * 0.008); cloth.geometry.computeVertexNormals(); }
  cloth.rotation.x = -Math.PI / 2 + 0.22; cloth.position.set(h.w / 2 + 0.17, h.wall - 0.012, 0.0); g.add(cloth);
  for (const dz of [-0.1, 0.1]) g.add(rod([h.w / 2 + 0.31, 0, dz], [h.w / 2 + 0.31, h.wall - 0.03 + (dz < 0 ? 0.04 : -0.01), dz], 0.003, lt, 5));
  // lanterns
  const lpos = [[-0.1, h.wall - 0.03, 0.05], [0.12, h.wall - 0.03, -0.02], [h.w / 2 + 0.01, 0.12, h.d / 2 + 0.01]];
  for (const p of lpos) { const l = lantern(); l.position.set(p[0], p[1] - 0.02, p[2]); g.add(l); }
  const baked = bake(g); scene.add(baked);
  out.lanternGlass = []; baked.traverse((o) => { if (o.userData.lantern) out.lanternGlass.push(o); });
  out.lights = [];
  for (const p of [lpos[0], lpos[1]]) { const pl = new THREE.PointLight(0xffb060, 0.05, 0.9, 1.8); pl.position.set(h.x + p[0], base + p[1] - 0.02, h.z + p[2]); scene.add(pl); out.lights.push(pl); }
  // colliders: back wall, left wall, bench, desk, crates
  const bx0 = h.x, bz0 = h.z, y0 = base - 0.05, y1 = base + h.ridge;
  addCollider({ t: 'box', x: bx0, z: bz0 - h.d / 2, hx: h.w / 2 + 0.01, hz: 0.012, y0, y1 }); addCollider({ t: 'box', x: bx0 - h.w / 2, z: bz0, hx: 0.012, hz: h.d / 2, y0, y1 });
  addCollider({ t: 'box', x: bx0 + h.w / 2, z: bz0, hx: 0.012, hz: h.d / 2, y0, y1: base + 0.09 }); addCollider({ t: 'box', x: bx0 + bx, z: bz0 - h.d / 2 + 0.05, hx: 0.1, hz: 0.026, y0, y1: base + 0.04 });
  addCollider({ t: 'box', x: bx0 + jx, z: bz0 + jz, hx: 0.036, hz: 0.026, y0, y1: base + 0.04 }); addCollider({ t: 'box', x: bx0 + h.w / 2 - 0.035, z: bz0 + 0.1, hx: 0.02, hz: 0.02, y0, y1: base + 0.07 });
  // roof (so aircraft cannot fly through the hut)
  addCollider({ t: 'box', x: bx0, z: bz0, hx: h.w / 2 + 0.03, hz: h.d / 2 + 0.04, y0: base + h.wall, y1: base + h.ridge });
  out.stations = [
    { id: 'bench', x: bx0 + bx, z: bz0 - h.d / 2 + 0.1, label: 'Design bench', hint: 'design & build aircraft' },
    { id: 'board', x: bx0 + bx + 0.13, z: bz0 - h.d / 2 + 0.07, label: 'Wall of history', hint: 'timeline & historical trials' },
    { id: 'journal', x: bx0 + jx - 0.02, z: bz0 + jz + 0.05, label: 'Invention journal', hint: 'flight records' },
  ];
}

function buildSites(scene, out) {
  const g = new THREE.Group(), wd = Mat.wood('light'), dk = Mat.wood('dark');
  // launch rail: twin rails on sleepers
  const r = W.rail, ry = Y(r.x0, r.z);
  for (let x = r.x0; x <= r.x1; x += 0.09) g.add(box(0.03, 0.006, 0.2, dk, x, Y(x, r.z) + 0.001, r.z));
  for (const s of [-1, 1]) g.add(box(r.x1 - r.x0, 0.008, 0.012, wd, (r.x0 + r.x1) / 2, ry + 0.006, r.z + s * 0.045));
  g.add(box(0.012, 0.03, 0.2, dk, r.x0 - 0.02, ry + 0.015, r.z));
  // runway: whitewashed pebbles along the edges and a threshold line of planks
  const rw = W.runway, peb = Mat.color(0xeeeadf, 0.8);
  for (let x = rw.x0; x <= rw.x1; x += 0.5) for (const s of [-1, 1]) g.add(sph(0.014, peb, x, Y(x, rw.z + s * rw.w / 2) + 0.004, rw.z + s * rw.w / 2, 6));
  for (let i = 0; i < 6; i++) g.add(box(0.03, 0.004, 0.1, Mat.wood('grey'), rw.x0 + 0.05, Y(rw.x0, rw.z) + 0.002, rw.z - 0.3 + i * 0.12));
  // glider hill: launch deck with a bungee catapult pointing east
  const hx = W.hill.x, hz = W.hill.z, hy = Y(hx, hz);
  for (let i = 0; i < 12; i++) g.add(box(0.045, 0.008, 0.34, i % 2 ? wd : Mat.wood('mid'), hx - 0.1 + i * 0.047, hy + 0.012, hz));
  for (const s of [-1, 1]) { g.add(box(0.5, 0.01, 0.012, dk, hx + 0.16, hy + 0.02, hz + s * 0.03)); g.add(rod([hx + 0.42, hy, hz + s * 0.13], [hx + 0.42, hy + 0.09, hz + s * 0.13], 0.005, dk, 6)); }
  for (const [px, pz] of [[-0.1, -0.16], [-0.1, 0.16], [0.42, -0.16], [0.42, 0.16]]) g.add(cyl(0.008, 0.008, 0.2, dk, hx + px, hy - 0.08, hz + pz, 6));
  // steps up the east face
  for (let i = 0; i < 26; i++) { const t = i / 26, x = hx + 0.5 + t * 1.5, z = hz + 0.25 + Math.sin(t * 3) * 0.25; g.add(box(0.05, 0.006, 0.1, Mat.wood('grey'), x, Y(x, z) + 0.003, z, 0.3)); }
  // course hoops: bent-twig rings on poles, with ribbons
  for (const h of HOOPS) { const gy = Y(h.x, h.z), hg = new THREE.Group(); const ring = new THREE.Mesh(new THREE.TorusGeometry(h.r, 0.012, 6, 28), Mat.color(0xd8483a, 0.6)); hg.add(ring);
    for (const s of [-1, 1]) hg.add(rod([s * h.r, 0, 0], [s * h.r * 1.15, -(h.y - gy), 0], 0.008, wd, 6)); hg.position.set(h.x, h.y, h.z); hg.rotation.y = -h.h + Math.PI / 2; g.add(hg);
    const c = Math.cos(h.h - Math.PI / 2), sn = Math.sin(h.h - Math.PI / 2);
    for (const s of [-1, 1]) addCollider({ t: 'cyl', x: h.x + s * h.r * 1.08 * c, z: h.z + s * h.r * 1.08 * sn, r: 0.02, y0: gy - 0.1, y1: h.y + 0.05 }); }
  scene.add(bake(g));
  // windsock (animated)
  const ws = new THREE.Group(), wx = rw.x0 - 0.15, wz = rw.z - 0.6; ws.position.set(wx, Y(wx, wz), wz);
  ws.add(cyl(0.004, 0.005, 0.32, wd, 0, 0.16, 0, 6));
  const sock = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.12, 10, 4, true), new THREE.MeshStandardMaterial({ color: 0xe8743a, side: THREE.DoubleSide, roughness: 0.9 })); sock.geometry.rotateZ(Math.PI / 2); sock.geometry.translate(-0.06, 0, 0);
  const sockG = new THREE.Group(); sockG.position.y = 0.31; sockG.add(sock); ws.add(sockG); scene.add(ws); out.windsock = sockG;
}

function buildFortress(scene) {
  const f = W.fortress, g = new THREE.Group(), st = Mat.stone(), dk = Mat.wood('dark'), wd = Mat.wood('mid'), by = Y(f.x, f.z);
  g.position.set(f.x, by - 0.02, f.z);
  const tower = (x, z, r, h, roof) => { const t = new THREE.Group(); t.add(cyl(r, r * 1.08, h, st, 0, h / 2, 0, 18), cyl(r * 1.12, r * 1.12, 0.05, st, 0, h + 0.02, 0, 18));
    for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; t.add(box(r * 0.42, 0.08, 0.05, st, Math.cos(a) * r * 1.08, h + 0.085, Math.sin(a) * r * 1.08, -a + Math.PI / 2)); }
    if (roof) { t.add(cyl(0.001, r * 1.25, r * 1.5, Mat.shingle(), 0, h + 0.2 + r * 0.75, 0, 14)); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; t.add(cyl(0.012, 0.012, 0.2, dk, Math.cos(a) * r, h + 0.14, Math.sin(a) * r, 5)); } }
    t.position.set(x, 0, z); g.add(t); addCollider({ t: 'cyl', x: f.x + x, z: f.z + z, r: r * 1.1, y0: by - 0.2, y1: by + h + (roof ? 0.2 + r * 1.5 : 0.13) }); };
  tower(-0.55, -0.35, 0.3, 1.0, true); tower(0.6, -0.4, 0.26, 0.8, false); tower(0.75, 0.55, 0.22, 0.65, false); tower(-0.7, 0.55, 0.2, 0.6, false);
  const wall = (x0, z0, x1, z1, h) => { const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), a = Math.atan2(dz, dx); g.add(box(len, h, 0.12, st, (x0 + x1) / 2, h / 2, (z0 + z1) / 2, -a));
    const n = Math.floor(len / 0.12); for (let i = 0; i < n; i += 2) { const t = (i + 0.5) / n; g.add(box(0.1, 0.07, 0.13, st, x0 + dx * t, h + 0.035, z0 + dz * t, -a)); }
    addCollider({ t: 'box', x: f.x + (x0 + x1) / 2, z: f.z + (z0 + z1) / 2, hx: len / 2, hz: 0.07, rot: a, y0: by - 0.2, y1: by + h + 0.07 }); };
  wall(-0.55, -0.35, 0.6, -0.4, 0.5); wall(0.6, -0.4, 0.75, 0.55, 0.45); wall(-0.7, 0.55, -0.55, -0.35, 0.45); wall(-0.7, 0.55, -0.25, 0.6, 0.45); wall(0.3, 0.6, 0.75, 0.55, 0.45);
  // gatehouse with portcullis
  g.add(box(0.62, 0.62, 0.2, st, 0.03, 0.31, 0.6), box(0.26, 0.34, 0.21, Mat.color(0x17120e, 1), 0.03, 0.17, 0.605)); for (let i = 0; i < 6; i++) g.add(box(0.012, 0.34, 0.012, Mat.metal('steel'), -0.08 + i * 0.044, 0.17, 0.712));
  for (let i = 0; i < 5; i++) g.add(box(0.09, 0.07, 0.21, st, -0.23 + i * 0.13, 0.655, 0.6));
  addCollider({ t: 'box', x: f.x + 0.03, z: f.z + 0.6, hx: 0.31, hz: 0.1, y0: by - 0.2, y1: by + 0.7 });
  // keep, banners, flag
  g.add(box(0.5, 0.75, 0.45, st, 0, 0.375, 0), cyl(0.001, 0.4, 0.3, Mat.shingle(), 0, 0.9, 0, 4)); g.children[g.children.length - 1].rotation.y = Math.PI / 4;
  addCollider({ t: 'box', x: f.x, z: f.z, hx: 0.26, hz: 0.24, y0: by - 0.2, y1: by + 1.0 });
  const banM = new THREE.MeshStandardMaterial({ map: T.banner(), side: THREE.DoubleSide, roughness: 0.9 });
  for (const [x, y, z] of [[-0.2, 0.42, 0.706], [0.26, 0.42, 0.706], [0, 0.5, 0.232]]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.2), banM); b.position.set(x, y, z); g.add(b); }
  g.add(cyl(0.006, 0.006, 0.5, dk, -0.55, 1.75, -0.35, 5)); const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.12), banM); flag.position.set(-0.44, 1.92, -0.35); g.add(flag);
  // wooden hoarding and scaffold
  for (let i = 0; i < 5; i++) g.add(box(0.2, 0.012, 0.16, wd, -0.3 + i * 0.2, 0.52, -0.5), rod([-0.38 + i * 0.2, 0.3, -0.42], [-0.38 + i * 0.2, 0.52, -0.56], 0.008, dk, 5));
  // palisade stakes around the shelf
  for (let i = 0; i < 70; i++) { const a = i / 70 * 6.283; if (Math.abs(a - 1.52) < 0.35) continue; const R = f.r * 1.02, x = Math.cos(a) * R, z = Math.sin(a) * R; g.add(cyl(0.004, 0.014, 0.2 + (i % 3) * 0.03, wd, x, Y(f.x + x, f.z + z) - by + 0.1, z, 5)); }
  // torches
  for (const sx of [-1, 1]) { const t = sph(0.012, new THREE.MeshStandardMaterial({ color: 0xffb060, emissive: 0xff7a20, emissiveIntensity: 2 }), 0.03 + sx * 0.19, 0.36, 0.72, 6); t.userData.noBake = true; g.add(t, rod([0.03 + sx * 0.19, 0.28, 0.71], [0.03 + sx * 0.19, 0.35, 0.72], 0.004, dk, 4)); }
  scene.add(bake(g));

  // siege park + trench line between the fortress and the workshop (set dressing for the warfare milestone)
  const d = new THREE.Group(), m = W.mud;
  const treb = new THREE.Group(); for (const s of [-1, 1]) { treb.add(rod([-0.1, 0, s * 0.05], [0, 0.2, s * 0.03], 0.008, wd, 5), rod([0.1, 0, s * 0.05], [0, 0.2, s * 0.03], 0.008, wd, 5), box(0.3, 0.014, 0.016, dk, 0, 0.007, s * 0.05)); }
  treb.add(rod([-0.2, 0.08, 0], [0.12, 0.3, 0], 0.007, Mat.wood('light'), 5), box(0.05, 0.05, 0.05, dk, 0.12, 0.25, 0), rod([0, 0.2, -0.04], [0, 0.2, 0.04], 0.006, Mat.metal('steel'), 5));
  for (let i = 0; i < 4; i++) treb.add(sph(0.014, Mat.color(0x77726a, 0.9), -0.14 + (i % 2) * 0.03, 0.014 + (i > 1 ? 0.02 : 0), 0.11 + (i % 2) * 0.012, 7));
  treb.position.set(f.x + 1.5, Y(f.x + 1.5, f.z - 1.3), f.z - 1.3); treb.rotation.y = 0.6; d.add(treb);
  const cannon = new THREE.Group(); const brl = cyl(0.012, 0.016, 0.12, Mat.metal('steel'), 0.02, 0.04, 0, 10); brl.rotation.z = Math.PI / 2 - 0.15; cannon.add(brl);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.004, 5, 14), dk); w.position.set(-0.01, 0.03, s * 0.03); cannon.add(w); for (let k = 0; k < 4; k++) { const sp = box(0.054, 0.003, 0.003, wd, -0.01, 0.03, s * 0.03); sp.rotation.z = k * Math.PI / 4; cannon.add(sp); } }
  cannon.add(box(0.12, 0.01, 0.03, dk, -0.05, 0.02, 0)); cannon.position.set(m.x + 1.2, Y(m.x + 1.2, m.z - 1.4) + 0.002, m.z - 1.4); cannon.rotation.y = -0.9; d.add(cannon);
  const bag = T.sandbag(), bagM = new THREE.MeshStandardMaterial({ map: bag, roughness: 1 });
  for (let i = 0; i < 46; i++) { const t = i / 46, a = -0.6 + t * 2.4, R = m.r * 0.72, x = m.x + Math.cos(a) * R, z = m.z + Math.sin(a) * R * 0.8;
    for (let k = 0; k < 2; k++) { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.017, 0.04, 2, 6), bagM); b.rotation.z = Math.PI / 2; b.rotation.y = -a + Math.PI / 2 + (k ? 0.1 : -0.1); b.position.set(x + (k ? 0.012 : 0), Y(x, z) + 0.016 + k * 0.03, z); b.scale.y = 0.75; d.add(b); }
    if (i % 3 === 0) d.add(box(0.012, 0.11, 0.012, dk, x - Math.cos(a) * 0.05, Y(x, z) + 0.02, z - Math.sin(a) * 0.05), box(0.14, 0.012, 0.006, wd, x - Math.cos(a) * 0.045, Y(x, z) + 0.04, z - Math.sin(a) * 0.045, -a + Math.PI / 2)); }
  scene.add(bake(d));
  addCollider({ t: 'sph', x: treb.position.x, y: treb.position.y + 0.1, z: treb.position.z, r: 0.16 });
}

export function buildStructures(scene) {
  const out = {};
  buildHut(scene, out); buildSites(scene, out); buildFortress(scene);
  return out;
}
