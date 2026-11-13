// Builds a detailed 3D model of an aircraft directly from its blueprint: the same part list the physics
// uses. Change a wing's span, material or section in the workshop and both the look and the flight change.
import * as THREE from 'three';
import { MATERIALS, AIRFOILS, ENGINES } from '../sim/catalog.js';
import { surfaceDeflection } from '../sim/flightModel.js';
import { Mat, T } from './textures.js';
import { buildFigure, animateFigure, FIG_H } from './figure.js';

const DEG = Math.PI / 180;
const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const UP = new THREE.Vector3(0, 1, 0);

export function rod(a, b, r, mat, seg = 5) {
  const A = a.isVector3 ? a : V3(a), B = b.isVector3 ? b : V3(b), d = B.clone().sub(A), len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg, 1, false), mat);
  m.position.copy(A).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(UP, d.normalize()); m.castShadow = true;
  return m;
}
const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.set(x, y, z); o.castShadow = true; return o; };

// Loft a body along -X through cross-sections {x (aft), w, h, y, e (superellipse exponent: 2 round, 6 boxy)}
function loft(secs, n = 14, capEnds = true) {
  const pos = [], uv = [], idx = [];
  secs.forEach((s, i) => { for (let j = 0; j <= n; j++) { const a = j / n * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), e = 2 / (s.e || 2);
    pos.push(-s.x, (s.y || 0) + Math.sign(sn) * Math.pow(Math.abs(sn), e) * s.h / 2, Math.sign(c) * Math.pow(Math.abs(c), e) * s.w / 2); uv.push(s.x / 0.03, j / n * 3); } });
  for (let i = 0; i < secs.length - 1; i++) for (let j = 0; j < n; j++) { const a = i * (n + 1) + j, b = a + n + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  if (capEnds) for (const i of [0, secs.length - 1]) { const c = pos.length / 3, s = secs[i]; pos.push(-s.x, s.y || 0, 0); uv.push(0, 0); for (let j = 0; j < n; j++) { const a = i * (n + 1) + j; i === 0 ? idx.push(c, a, a + 1) : idx.push(c, a + 1, a); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// One half (root -> tip along +Z) of a lifting surface, chord fractions c0..c1, span fractions e0..e1.
function panelGeom(p, half, e0, e1, c0, c1, foil, plate, origin) {
  const ns = Math.max(2, Math.round((e1 - e0) * 6)), nc = Math.max(2, Math.round((c1 - c0) * 9)), sw = Math.tan(p.sweep * DEG);
  const pt = (eta, s, sgn) => {
    const ch = p.chord * (1 - (1 - p.taper) * eta);
    const cam = 4 * foil.camber * ch * s * (1 - s) * (foil.camber < 0 ? s : 1);
    const th = foil.thick > 0.05 ? foil.thick * ch * 2.6 * Math.sqrt(s) * (1 - s) : plate;
    return [-(sw * half * eta + s * ch) - origin[0], cam + sgn * th / 2 - origin[1], eta * half - origin[2]];
  };
  const pos = [], uv = [], idx = [];
  const layers = (foil.thick > 0.05 || plate > 0.0004) ? [1, -1] : [0];
  layers.forEach((sgn, li) => {
    const base = pos.length / 3;
    for (let i = 0; i <= ns; i++) for (let j = 0; j <= nc; j++) { const eta = e0 + (e1 - e0) * i / ns, s = c0 + (c1 - c0) * j / nc; pos.push(...pt(eta, s, sgn)); uv.push(eta * half / 0.032, s * p.chord / 0.032); }
    for (let i = 0; i < ns; i++) for (let j = 0; j < nc; j++) { const a = base + i * (nc + 1) + j, b = a + nc + 1; sgn >= 0 ? idx.push(a, b, a + 1, a + 1, b, b + 1) : idx.push(a, a + 1, b, a + 1, b + 1, b); }
  });
  if (layers.length === 2) { // close the rim
    const N = (ns + 1) * (nc + 1), at = (l, i, j) => l * N + i * (nc + 1) + j;
    for (let i = 0; i < ns; i++) for (const j of [0, nc]) { const a = at(0, i, j), b = at(0, i + 1, j), c = at(1, i, j), d = at(1, i + 1, j); idx.push(a, c, b, b, c, d); }
    for (let j = 0; j < nc; j++) for (const i of [0, ns]) { const a = at(0, i, j), b = at(0, i, j + 1), c = at(1, i, j), d = at(1, i, j + 1); idx.push(a, b, c, b, d, c); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function buildPropeller(d, blades = 2, tone = 'mid') {
  const g = new THREE.Group(), wood = Mat.wood(tone);
  for (let i = 0; i < blades; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.0012, d / 2, d * 0.11), wood); b.geometry.translate(0, d / 4, 0);
    const pa = b.geometry.attributes.position; for (let k = 0; k < pa.count; k++) { const y = pa.getY(k) / (d / 2), z = pa.getZ(k), x = pa.getX(k), tw = 0.9 - y * 0.6, w = 0.5 + 1.2 * y * (1.25 - y); pa.setXYZ(k, x * Math.cos(tw) - z * w * Math.sin(tw), pa.getY(k), x * Math.sin(tw) + z * w * Math.cos(tw)); }
    b.geometry.computeVertexNormals(); b.rotation.x = i * Math.PI * 2 / blades; b.castShadow = true; g.add(b);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(d * 0.05, d * 0.05, 0.003, 8), Mat.metal('brass')); hub.rotation.z = Math.PI / 2; g.add(hub);
  const blur = new THREE.Mesh(new THREE.CircleGeometry(d / 2, 24), new THREE.MeshBasicMaterial({ map: T.disc(), color: 0xd8c8a8, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  blur.rotation.y = Math.PI / 2;
  const spin = new THREE.Group(); spin.add(g); const out = new THREE.Group(); out.add(spin, blur);
  out.userData = { spin, blur, blades: g };
  return out;
}

export function buildAircraftMesh(bp, cg = [0, 0, 0], opts = {}) {
  const root = new THREE.Group(), inner = new THREE.Group();
  root.add(inner); inner.position.set(-cg[0], -cg[1], -cg[2]);
  const ud = root.userData = { flaps: [], halves: [], props: [], parts: new Map(), inner, pilot: null, gear: null, bp };
  const paint = bp.paint;
  const fabricTint = paint === 'raf' ? 0x8a8458 : paint === 'red' ? 0xb23a2c : null;
  const partGroup = (p) => { const g = new THREE.Group(); g.userData.partId = p.id; inner.add(g); ud.parts.set(p.id, g); return g; };
  const lookMat = (matKey, tint) => { const m = MATERIALS[matKey]; return Mat.look(m.look, tint || (m.look === 'fabric' ? fabricTint : null)); };
  const fus = bp.parts.find((p) => p.type === 'fuselage');
  const L = fus ? fus.length : 0.1, fh = fus ? fus.height : 0.01, fw = fus ? fus.width : 0.005;
  const darkWood = Mat.wood('dark'), lightWood = Mat.wood('light'), wire = Mat.color(0x2a2622, 0.5), steel = Mat.metal('steel'), brass = Mat.metal('brass');
  const horiz = bp.parts.filter((p) => p.type === 'surface' && !p.vertical);

  for (const p of bp.parts) {
    const g = partGroup(p);
    if (p.type === 'fuselage') {
      const mat = lookMat(p.material, paint === 'racer' ? 0xb8322a : null);
      if (p.kind === 'keel') {
        g.add(new THREE.Mesh(loft([{ x: 0, w: fw * 0.5, h: fh * 0.35, e: 4 }, { x: L * 0.12, w: fw, h: fh, e: 5 }, { x: L * 0.6, w: fw, h: fh * 0.8, e: 5 }, { x: L, w: fw * 0.6, h: fh * 0.45, e: 5 }], 8), mat));
      } else if (p.kind === 'truss') {
        const w = Mat.look('wood'), st = (x) => ({ w: fw * (1 - 0.55 * x / L), h: fh * (1 - 0.5 * x / L) });
        const n = Math.max(4, Math.round(L / 0.028));
        for (let i = 0; i <= n; i++) { const x = L * i / n, s = st(x);
          for (const sy of [1, -1]) for (const sz of [1, -1]) {
            if (i < n) { const x2 = L * (i + 1) / n, s2 = st(x2); g.add(rod([-x, sy * s.h / 2, sz * s.w / 2], [-x2, sy * s2.h / 2, sz * s2.w / 2], 0.00045, w, 4)); }
            if (sy > 0) g.add(rod([-x, s.h / 2, sz * s.w / 2], [-x, -s.h / 2, sz * s.w / 2], 0.00035, w, 4));
            if (sz > 0) g.add(rod([-x, sy * s.h / 2, s.w / 2], [-x, sy * s.h / 2, -s.w / 2], 0.00035, w, 4));
          }
          if (i < n) { const x2 = L * (i + 1) / n, s2 = st(x2); for (const sz of [1, -1]) g.add(rod([-x, s.h / 2, sz * s.w / 2], [-x2, -s2.h / 2, sz * s2.w / 2], 0.00012, wire, 3)); }
        }
      } else if (p.kind === 'box') {
        g.add(new THREE.Mesh(loft([{ x: 0, w: fw * 0.85, h: fh * 0.9, e: 3 }, { x: L * 0.14, w: fw, h: fh, e: 5 }, { x: L * 0.5, w: fw * 0.95, h: fh * 0.95, e: 6 }, { x: L, w: fw * 0.18, h: fh * 0.45, e: 6, y: fh * 0.1 }], 12), mat));
        const cowl = new THREE.Mesh(loft([{ x: -0.0005, w: fw * 0.87, h: fh * 0.92, e: 3 }, { x: L * 0.15, w: fw * 1.03, h: fh * 1.03, e: 5 }], 12, false), Mat.metal('alu')); g.add(cowl);
      } else {
        g.add(new THREE.Mesh(loft([{ x: 0, w: fw * 0.3, h: fh * 0.3 }, { x: L * 0.06, w: fw * 0.75, h: fh * 0.75 }, { x: L * 0.25, w: fw, h: fh }, { x: L * 0.55, w: fw * 0.9, h: fh * 0.92 }, { x: L, w: fw * 0.12, h: fh * 0.3, y: fh * 0.12 }], 16), mat));
      }
      g.children.forEach((c) => { c.castShadow = true; });
    } else if (p.type === 'surface') {
      const foil = AIRFOILS[p.airfoil], m = MATERIALS[p.material];
      const mat = lookMat(p.material, m.look === 'metal' && paint === 'racer' ? null : null);
      const plate = m.look === 'corrugated' ? 0.0016 : m.look === 'wood' ? 0.0007 : m.look === 'steel' || m.look === 'metal' ? 0.0005 : 0;
      const half = p.vertical ? p.span : p.span / 2;
      const sg = new THREE.Group(); sg.position.set(-p.x, p.y, 0); sg.rotation.z = p.vertical ? 0 : p.incidence * DEG; g.add(sg);
      const f = p.control === 'none' || p.control === 'warp' ? 0 : p.ctrlFrac, allMoving = f >= 0.85;
      const e0 = p.control === 'aileron' ? 0.4 : 0, sH = allMoving ? 0.25 : 1 - f;
      const sides = p.vertical ? (p.twin > 0 ? [1, -1] : [0]) : [1, -1];
      const aft = p.x + 0.25 * p.chord > -cg[0];
      sides.forEach((side, si) => {
        const hg = new THREE.Group(); sg.add(hg);
        if (p.vertical) { hg.rotation.x = -Math.PI / 2; hg.position.z = side * p.twin / 2; }
        else { hg.scale.z = side; hg.rotation.x = -side * p.dihedral * DEG; ud.halves.push({ grp: hg, id: p.id, sideIdx: si, side, dih: p.dihedral * DEG }); }
        const add = (geo, parent = hg) => { const me = new THREE.Mesh(geo, mat); me.castShadow = true; me.receiveShadow = true; me.userData.partId = p.id; parent.add(me); return me; };
        if (!f) add(panelGeom(p, half, 0, 1, 0, 1, foil, plate, [0, 0, 0]));
        else {
          if (e0 > 0) add(panelGeom(p, half, 0, e0, 0, 1, foil, plate, [0, 0, 0]));
          if (!allMoving) add(panelGeom(p, half, e0, 1, 0, sH, foil, plate, [0, 0, 0]));
          const sw = Math.tan(p.sweep * DEG), ch = (eta) => p.chord * (1 - (1 - p.taper) * eta);
          const h0 = new THREE.Vector3(-(sw * half * e0 + sH * ch(e0)), 0, e0 * half), h1 = new THREE.Vector3(-(sw * half + sH * ch(1)), 0, half);
          const fg = new THREE.Group(); fg.position.copy(h0); hg.add(fg);
          add(panelGeom(p, half, e0, 1, allMoving ? 0 : sH, 1, foil, plate, [h0.x, h0.y, h0.z]), fg);
          ud.flaps.push({ obj: fg, axis: h1.sub(h0).normalize(), part: p, side: side || 1, eta: 0.7, aft, fin: !!p.vertical, a: 0 });
        }
        // visible structure for built-up wings: spars and ribs
        if (m.look === 'fabric' || m.look === 'wood') {
          const sw = Math.tan(p.sweep * DEG);
          hg.add(rod([-0.0004, 0, 0], [-(sw * half + 0.0004), 0, half], 0.00045, darkWood, 4));
          if (m.look === 'fabric') { const nr = Math.max(2, Math.round(half / 0.011)); for (let i = 0; i <= nr; i++) { const eta = i / nr, c = p.chord * (1 - (1 - p.taper) * eta) * (f && eta >= e0 && !allMoving ? sH : 1); const r = box(c, 0.0005, 0.0004, darkWood, -(sw * half * eta + c / 2), foil.camber * c * 0.5 - 0.0002, eta * half); hg.add(r); } }
        }
        if (paint === 'raf' && p.role === 'wing' && !p.vertical && p.y >= Math.max(...horiz.map((o) => o.y)) - 1e-6) {
          const r = new THREE.Mesh(new THREE.CircleGeometry(p.chord * 0.36, 20), new THREE.MeshStandardMaterial({ map: T.roundel(), transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -4 }));
          r.rotation.x = -Math.PI / 2; r.position.set(-p.chord * 0.48, foil.camber * p.chord + 0.0005, half * 0.72); hg.add(r);
        }
      });
    } else if (p.type === 'engine') {
      const e = ENGINES[p.kind], dir = p.pusher ? -1 : 1;
      const eg = new THREE.Group(); eg.position.set(-p.x, p.y, 0); g.add(eg);
      const addProp = (x, y, z, blades, spinDir, tone) => { const pr = buildPropeller(e.prop, blades, tone); pr.position.set(x, y, z); eg.add(pr); ud.props.push({ ...pr.userData, obj: pr, dir: spinDir, eng: ud.props.filter((q) => q.partId === p.id).length ? ud.props.length : ud.props.length, partId: p.id }); return pr; };
      if (p.kind === 'rubber') {
        addProp(dir * 0.004, 0, 0, 2, 1, 'light');
        eg.add(rod([0, -fh * 0.6, 0], [dir * -Math.min(L * 0.7, 0.11), -fh * 0.6, 0], 0.0007, Mat.color(0xb08a50, 0.9), 5), rod([0.002 * dir, 0, 0], [0, -fh * 0.6, 0], 0.0004, steel, 4));
      } else if (p.kind === 'electric' || p.kind === 'electricL') {
        const s = p.kind === 'electricL' ? 1.35 : 1;
        const mo = new THREE.Mesh(new THREE.CylinderGeometry(0.003 * s, 0.003 * s, 0.007 * s, 12), Mat.metal('alu')); mo.rotation.z = Math.PI / 2; mo.castShadow = true; eg.add(mo);
        eg.add(box(0.012 * s, 0.004 * s, 0.007 * s, Mat.color(0x2b5fa8, 0.5), -dir * 0.012 * s, -0.001, 0), box(0.0125 * s, 0.0015, 0.0072 * s, Mat.color(0xe2c84a, 0.5), -dir * 0.012 * s, 0.001 * s, 0));
        addProp(dir * 0.005 * s, 0, 0, 2, 1, 'grey');
      } else if (p.kind === 'wright') {
        eg.add(box(0.012, 0.006, 0.007, steel, 0, 0, 0.008));
        for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.0013, 0.0013, 0.004, 8), Mat.metal('brass')); c.position.set(-0.0045 + i * 0.003, 0.0045, 0.008); c.castShadow = true; eg.add(c); }
        eg.add(box(0.004, 0.009, 0.004, Mat.metal('brass'), 0.004, 0.006, -0.004)); // radiator / tank
        for (const s of [1, -1]) { const px = -0.03, pz = s * 0.034, py = 0.006;
          addProp(px, py, pz, 2, s, 'light');
          eg.add(rod([px + 0.002, py, pz], [px + 0.014, py, pz], 0.0004, steel, 4), rod([px + 0.014, py, pz], [-0.002, 0.001, 0.008], 0.00018, wire, 3), rod([px + 0.014, py - 0.002, pz], [-0.004, -0.002, 0.008], 0.00018, wire, 3),
            rod([px + 0.014, py, pz], [px + 0.02, -0.01, pz * 0.9], 0.0004, lightWood, 4), rod([px + 0.014, py, pz], [px + 0.02, 0.02, pz * 0.9], 0.0004, lightWood, 4)); }
      } else if (p.kind === 'rotary') {
        const rot = new THREE.Group(); rot.position.x = dir * 0.002;
        const crank = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.004, 10), steel); crank.rotation.z = Math.PI / 2; rot.add(crank);
        for (let i = 0; i < 9; i++) { const a = i * Math.PI * 2 / 9, c = new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0013, 0.0045, 7), i % 2 ? steel : Mat.metal('brass')); c.position.set(0, Math.cos(a) * 0.0045, Math.sin(a) * 0.0045); c.rotation.x = a; c.castShadow = true; rot.add(c); }
        eg.add(rot);
        const pr = addProp(dir * 0.0055, 0, 0, 2, 1, 'mid'); ud.props[ud.props.length - 1].extra = rot;
        const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.0078, 0.0078, 0.006, 18, 1, true, Math.PI * 0.75, Math.PI * 1.5), Mat.metal('alu')); cowl.rotation.z = Math.PI / 2; cowl.material.side = THREE.DoubleSide; cowl.position.x = dir * 0.001; cowl.castShadow = true; eg.add(cowl);
      } else if (p.kind === 'inline') {
        eg.add(new THREE.Mesh(loft([{ x: -0.006, w: 0.004, h: 0.004 }, { x: -0.001, w: fw * 0.8, h: fh * 0.8, e: 3 }, { x: 0.02, w: fw * 1.02, h: fh * 1.02, e: 4 }], 12), Mat.metal('alu')));
        for (let i = 0; i < 6; i++) for (const s of [1, -1]) eg.add(rod([-0.003 - i * 0.0026, fh * 0.2, s * fw * 0.5], [-0.0045 - i * 0.0026, fh * 0.15, s * (fw * 0.5 + 0.0018)], 0.0005, steel, 4));
        addProp(dir * 0.0065, 0, 0, 3, 1, 'dark');
      } else if (p.kind === 'jet') {
        const n = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0036, 0.022, 14, 1, true), Mat.metal('alu')); n.rotation.z = Math.PI / 2; n.material.side = THREE.DoubleSide; n.castShadow = true; eg.add(n);
        const glow = new THREE.Mesh(new THREE.CircleGeometry(0.0034, 12), new THREE.MeshBasicMaterial({ color: 0xff8a30 })); glow.rotation.y = -Math.PI / 2; glow.position.x = -0.0105; eg.add(glow);
        const intake = new THREE.Mesh(new THREE.ConeGeometry(0.0022, 0.006, 10), steel); intake.rotation.z = -Math.PI / 2; intake.position.x = 0.01; eg.add(intake);
        ud.props.push({ jet: glow, partId: p.id, dir: 1 });
      }
    } else if (p.type === 'gear') {
      const gg = new THREE.Group(); gg.position.set(-p.x, -fh / 2, 0); g.add(gg); ud.gear = gg;
      if (p.kind === 'wheels') {
        const r = Math.min(0.0055, p.height * 0.42);
        for (const s of [1, -1]) {
          const wz = s * p.track / 2, wy = -p.height + r;
          const tire = new THREE.Mesh(new THREE.TorusGeometry(r * 0.82, r * 0.2, 6, 16), Mat.color(0x2a2a2c, 0.9)); tire.position.set(0, wy, wz); tire.castShadow = true;
          const disc = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r * 0.8, 0.0006, 14), Mat.look('fabric')); disc.rotation.x = Math.PI / 2; disc.position.copy(tire.position);
          gg.add(tire, disc, rod([0.004, 0, s * fw * 0.4], [0, wy, wz * 0.92], 0.0005, lightWood, 4), rod([-0.008, 0, s * fw * 0.4], [0, wy, wz * 0.92], 0.0005, lightWood, 4));
        }
        gg.add(rod([0, -p.height + r, p.track / 2], [0, -p.height + r, -p.track / 2], 0.0004, steel, 4));
        g.add(rod([-L * 0.9, -fh * 0.3, 0], [-L * 0.97, -fh / 2 - 0.003, 0], 0.0005, darkWood, 4));
      } else {
        for (const s of [1, -1]) { const z = s * p.track / 2, y = -p.height;
          gg.add(rod([0.062, y + 0.006, z], [0.05, y, z], 0.0006, lightWood, 4), rod([0.05, y, z], [-0.03, y, z], 0.0006, lightWood, 4));
          for (const dx of [0.03, 0, -0.02]) gg.add(rod([dx, y, z], [dx, 0.002, z * 0.8], 0.0004, lightWood, 4)); }
      }
    } else if (p.type === 'ballast') {
      const s = Math.cbrt(p.mass / 11000);
      g.add(box(s * 1.6, s, s, steel, -p.x, -fh * 0.3, 0));
    } else if (p.type === 'pilot') {
      const seat = new THREE.Group(); seat.position.set(-p.x, p.y, 0); g.add(seat);
      if (p.pose === 'seated') seat.add(box(0.006, 0.0008, 0.007, lightWood, 0, -0.0005, 0), box(0.0008, 0.006, 0.007, lightWood, -0.0035, 0.003, 0));
      const fig = buildFigure(opts.pilotPalette); fig.rotation.y = Math.PI / 2;
      fig.position.set(p.pose === 'prone' ? -0.004 : -0.002, p.pose === 'prone' ? 0.0005 : -0.0045, 0);
      animateFigure(fig, { pose: p.pose, dt: 1 }); fig.visible = !!opts.showPilot; seat.add(fig);
      ud.pilot = fig; ud.pilotPose = p.pose; ud.seat = seat;
    }
  }

  // ---- bracing: interplane struts, cabane struts and wires for braced wings
  const braced = horiz.filter((p) => p.braced).sort((a, b) => a.y - b.y);
  const sp = (p, side, eta, s) => { const half = p.span / 2, ch = p.chord * (1 - (1 - p.taper) * eta); return new THREE.Vector3(-(p.x + Math.tan(p.sweep * DEG) * half * eta + s * ch), p.y + Math.sin(p.dihedral * DEG) * half * eta + Math.sin(p.incidence * DEG) * (0.3 - s) * ch, side * half * eta * Math.cos(p.dihedral * DEG)); };
  const strutMat = Mat.look('wood');
  for (let i = 0; i < braced.length; i++) {
    const A = braced[i], B = braced[i + 1];
    if (B && Math.abs(B.x - A.x) < A.chord && B.y - A.y > 0.006) {
      const etas = A.span > 0.17 ? [0.22, 0.5, 0.82] : [0.3, 0.8];
      for (const side of [1, -1]) { etas.forEach((eta, k) => { for (const s of [0.12, 0.72]) inner.add(rod(sp(A, side, eta, s), sp(B, side, eta, s), 0.00042, strutMat, 4));
          const e2 = k === 0 ? 0.04 : etas[k - 1]; for (const s of [0.12, 0.72]) inner.add(rod(sp(A, side, e2, s), sp(B, side, eta, s), 0.0001, wire, 3), rod(sp(B, side, e2, s), sp(A, side, eta, s), 0.0001, wire, 3)); });
        if (fus && B.y > fh / 2 + 0.003) for (const s of [0.15, 0.7]) inner.add(rod(sp(B, side, 0.07, s), new THREE.Vector3(-(B.x + s * B.chord), fh * 0.45, side * fw * 0.45), 0.0004, strutMat, 4)); }
      i++;
    } else {
      const top = new THREE.Vector3(-(A.x + 0.3 * A.chord), A.y + 0.022, 0), bot = new THREE.Vector3(-(A.x + 0.3 * A.chord), A.y - 0.014, 0);
      inner.add(rod(new THREE.Vector3(top.x, A.y, 0), top, 0.0004, strutMat, 4), rod(new THREE.Vector3(bot.x, A.y, 0), bot, 0.0004, strutMat, 4));
      for (const side of [1, -1]) for (const eta of [0.45, 0.85]) inner.add(rod(top, sp(A, side, eta, 0.3), 0.0001, wire, 3), rod(bot, sp(A, side, eta, 0.3), 0.0001, wire, 3));
    }
  }
  return root;
}

const zeroCtrl = { pitch: 0, roll: 0, yaw: 0 };
// Animate a model from a live Aircraft (or just spin things for display when ac is null)
export function updateAircraftMesh(root, ac, dt) {
  const ud = root.userData, ctrl = (ac && ac.ctrl) || zeroCtrl, k = Math.min(1, dt * 14);
  for (const f of ud.flaps) {
    const target = surfaceDeflection(f.part, f.side, f.eta, f.aft, ctrl) * (f.fin ? -1 : 1);
    f.a += (target - f.a) * k; f.obj.quaternion.setFromAxisAngle(f.axis, f.a);
  }
  if (ac) {
    for (const h of ud.halves) { const s = ac.surfs.find((q) => q.part.id === h.id); if (s) h.grp.rotation.x = -h.side * (h.dih + s.flex[h.sideIdx]); }
    if (ud.gear && ac.gear) ud.gear.scale.y += ((ac.gear.health > 0.5 ? 1 : 0.35) - ud.gear.scale.y) * k;
  }
  for (const p of ud.props) {
    const e = ac ? ac.engines.find((q) => q.part.id === p.partId) : null, rpm = e ? Math.max(e.rpm, e.health < 0.3 ? 0 : 0) : 0;
    if (p.jet) { p.jet.material.color.setHSL(0.07, 1, 0.25 + 0.4 * rpm); continue; }
    const wind = ac && rpm < 0.05 ? Math.min(ac.airspeed * 0.06, 0.4) : 0;
    p.spin.rotation.x += p.dir * (rpm * 55 + wind * 20) * dt;
    if (p.extra) p.extra.rotation.x = p.spin.rotation.x;
    p.blur.material.opacity = Math.min(0.55, rpm * 0.8); p.blades.visible = rpm < 0.75 || (e && e.health < 0.3);
    if (e && e.health < 0.3) p.blades.scale.set(1, 0.45, 1); else p.blades.scale.set(1, 1, 1);
  }
}

export function disposeAircraftMesh(root) { root.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
