// The living garden: terrain, towering grass, flowers, rocks, pond and landmarks. Everything is procedural.
import * as THREE from 'three';
import { WORLD as W, GRID, groundHeight, grassDensity, surfaceAt, addCollider, fbm, vnoise, mulberry } from '../sim/world.js';
import { Mat, T } from '../gfx/textures.js';
import { bake, box, cyl, sph } from '../gfx/util.js';
import { rod } from '../gfx/aircraftMesh.js';

export const QUALITY = {
  low: { grass: 22000, clover: 3000, leaves: 900, shadow: 1024, grassShadow: false, dew: 0, pr: 1 },
  medium: { grass: 55000, clover: 7000, leaves: 2200, shadow: 2048, grassShadow: false, dew: 120, pr: 1.5 },
  high: { grass: 110000, clover: 12000, leaves: 4000, shadow: 4096, grassShadow: true, dew: 260, pr: 2 },
};

// ---------------------------------------------------------------- swaying vegetation material
export const vegU = { uTime: { value: 0 }, uWind: { value: new THREE.Vector3(1, 0, 0.2) }, uPush: { value: [new THREE.Vector4(0, 0, 0.1, 0), new THREE.Vector4(0, 0, 0.1, 0), new THREE.Vector4(0, 0, 0.1, 0)] }, uFocus: { value: new THREE.Vector3() }, uSee: { value: 0 } };
function vegMaterial(opts) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.75, side: THREE.DoubleSide, ...opts });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, vegU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      uniform float uTime; uniform vec3 uWind; uniform vec4 uPush[3]; varying vec3 vWPos; varying float vH;`)
      .replace('#include <project_vertex>', `
      vec4 wp = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        wp = instanceMatrix * wp; vec3 base = instanceMatrix[3].xyz; float hgt = length(instanceMatrix[1].xyz);
      #else
        vec3 base = vec3(0.0); float hgt = 1.0;
      #endif
      wp = modelMatrix * wp;
      float bend = position.y * position.y, ph = base.x * 1.3 + base.z * 0.9;
      float sway = (sin(uTime * 1.6 + ph) * 0.6 + sin(uTime * 2.7 + ph * 1.7) * 0.25 + 0.35) * uWind.z;
      wp.xz += uWind.xy * sway * bend * hgt * 0.35;
      for (int i = 0; i < 3; i++) { vec2 dv = base.xz - uPush[i].xy; float dd = length(dv); float f = (1.0 - smoothstep(0.0, uPush[i].z, dd)) * uPush[i].w;
        wp.xz += normalize(dv + 1e-5) * f * bend * hgt * 0.8; wp.y -= f * bend * hgt * 0.5; }
      vWPos = wp.xyz; vH = position.y;
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform vec3 uFocus; uniform float uSee; varying vec3 vWPos; varying float vH;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb *= mix(0.3, 1.25, vH);
      if (uSee > 0.0) { vec3 cf = uFocus - cameraPosition; float L = length(cf); vec3 d = cf / L; vec3 cp = vWPos - cameraPosition; float t = dot(cp, d);
        float r = length(cp - d * t); float R = uSee * (0.3 + 0.7 * clamp(t / L, 0.0, 1.0));
        if (t < L + 0.03 && r < R) { float a = smoothstep(R * 0.5, R, r); float dth = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453); if (dth > a) discard; } }`);
  };
  return m;
}

function bladeGeo() { // height 1, base width 1, tapering, slight arc
  const seg = 5, pos = [], idx = [], uv = [];
  for (let i = 0; i <= seg; i++) { const y = i / seg, w = 0.5 * (1 - y * y * 0.92), z = y * y * 0.22; pos.push(-w, y, z, 0, y, z - 0.06 * (1 - y), w, y, z); uv.push(0, y, 0.5, y, 1, y); }
  for (let i = 0; i < seg; i++) { const a = i * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
export function leafGeo(arch = 0.35, wid = 0.28, fold = 0.25) { // a broad leaf rising from the origin, length ~1
  const nu = 7, nv = 4, pos = [], idx = [], uv = [];
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { const u = i / nu, v = j / nv * 2 - 1, w = wid * Math.pow(Math.sin(Math.PI * Math.min(u * 0.97 + 0.03, 1)), 0.7);
    pos.push(v * w, u * (1 - arch * u) + Math.abs(v) * w * fold, u * u * arch * 1.6); uv.push(j / nv, u); }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function cloverGeo() {
  const g = new THREE.Group(), m = new THREE.MeshBasicMaterial();
  g.add(cyl(0.02, 0.03, 0.9, m, 0, 0.45, 0, 4));
  for (let i = 0; i < 3; i++) { const a = i * 2.094, l = new THREE.Mesh(new THREE.CircleGeometry(0.42, 8), m); l.rotation.x = -Math.PI / 2 + 0.25; l.rotation.z = 0; l.position.set(Math.cos(a) * 0.4, 0.93, Math.sin(a) * 0.4); l.rotation.order = 'YXZ'; l.rotation.y = -a + Math.PI / 2; g.add(l); }
  const b = bake(g); const geo = b.children[0].geometry; return geo;
}

function scatter(scene, geo, mat, count, rnd, place, cast) {
  const im = new THREE.InstancedMesh(geo, mat, count), d = new THREE.Object3D(), c = new THREE.Color(); let n = 0, tries = 0;
  while (n < count && tries++ < count * 30) { const r = place(rnd, d, c); if (!r) continue; d.updateMatrix(); im.setMatrixAt(n, d.matrix); im.setColorAt(n, c); n++; }
  im.count = n; im.castShadow = !!cast; im.receiveShadow = true; im.frustumCulled = false; scene.add(im); return im;
}

// ---------------------------------------------------------------- flowers (each returns a baked group, origin at the stem base)
const petalMat = (hex) => Mat.color(hex, 0.6, { side: THREE.DoubleSide });
const stemMat = () => Mat.color(0x5d8a3a, 0.7);
function stem(h, r, lean = 0.1, mat = stemMat()) {
  const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(new THREE.Vector3(Math.sin(t * 1.4) * lean * h, t * h, Math.sin(t * 2.1) * lean * h * 0.4)); }
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, r, 7), mat); m.userData.top = pts[6]; return m;
}
function leafMesh(len, mat, arch, wid) { const m = new THREE.Mesh(leafGeo(arch, wid), mat); m.scale.setScalar(len); return m; }
function sunflower(h = 1.5) {
  const g = new THREE.Group(), st = stem(h, 0.022, 0.06), top = st.userData.top, leafM = Mat.color(0x4f8f34, 0.7, { side: THREE.DoubleSide, map: T.leaf() });
  g.add(st);
  for (let i = 0; i < 7; i++) { const l = leafMesh(0.3 + 0.1 * Math.sin(i * 3), leafM, 0.5, 0.36); const t = 0.2 + i * 0.1; l.position.set(Math.sin(t * 1.4) * 0.06 * h, t * h, 0); l.rotation.set(1.0, i * 2.4, 0, 'YXZ'); g.add(l); }
  const head = new THREE.Group(); head.position.copy(top); head.rotation.set(-1.1, 0.5, 0);
  head.add(cyl(0.15, 0.15, 0.03, Mat.color(0x3e2a14, 0.95), 0, 0, 0, 20), cyl(0.09, 0.1, 0.035, Mat.color(0x5a3c18, 0.95), 0, 0.004, 0, 16), cyl(0.17, 0.05, 0.05, stemMat(), 0, -0.035, 0, 14));
  for (let r = 0; r < 2; r++) for (let i = 0; i < 22; i++) { const a = i / 22 * 6.283 + r * 0.14, p = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), petalMat(r ? 0xf2b21c : 0xf7c832)); p.scale.set(0.085, 0.006, 0.03); p.position.set(Math.cos(a) * (0.2 - r * 0.012), 0.004 - r * 0.008, Math.sin(a) * (0.2 - r * 0.012)); p.rotation.y = -a; p.rotation.z = 0.12 + r * 0.1; g.userData; head.add(p); }
  g.add(head); g.userData.headPos = top.clone(); return g;
}
function dandelion(h = 0.3) {
  const g = new THREE.Group(), st = stem(h, 0.004, 0.05, Mat.color(0x8fae5a, 0.7)); g.add(st);
  const top = st.userData.top;
  for (let r = 0; r < 3; r++) for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283 + r, p = new THREE.Mesh(new THREE.SphereGeometry(1, 5, 3), petalMat(0xf6cf1f)); const R = 0.03 - r * 0.008; p.scale.set(R, 0.0025, 0.005); p.position.set(top.x + Math.cos(a) * R, top.y + r * 0.004, top.z + Math.sin(a) * R); p.rotation.y = -a; p.rotation.z = 0.15 + r * 0.35; g.add(p); }
  g.add(sph(0.012, Mat.color(0xe8b010, 0.8), top.x, top.y + 0.004, top.z, 8));
  const lm = Mat.color(0x4c8a30, 0.7, { side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) { const l = leafMesh(0.11, lm, 0.9, 0.14); l.rotation.set(1.25, i * 1.05, 0, 'YXZ'); g.add(l); }
  return g;
}
function cloverBlossom(h = 0.12, hex = 0xd978a8) {
  const g = new THREE.Group(), st = stem(h, 0.0028, 0.05); g.add(st); const top = st.userData.top, rnd = mulberry(7);
  for (let i = 0; i < 34; i++) { const a = rnd() * 6.283, e = rnd() * 2.2 - 0.5, R = 0.016; const p = new THREE.Mesh(new THREE.ConeGeometry(0.0035, 0.012, 4), petalMat(e > 0.9 ? 0xf6e6ee : hex));
    const d = new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)); p.position.copy(top).addScaledVector(d, R).add(new THREE.Vector3(0, 0.012, 0)); p.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); g.add(p); }
  g.add(sph(0.014, petalMat(hex), top.x, top.y + 0.012, top.z, 8)); return g;
}
function violet(h = 0.09) {
  const g = new THREE.Group(), st = stem(h, 0.002, 0.18); g.add(st); const top = st.userData.top, fl = new THREE.Group(); fl.position.copy(top); fl.rotation.x = 0.9;
  for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283, p = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), petalMat(i === 0 ? 0x8e5fd6 : 0x6a3fb8)); p.scale.set(0.016, 0.002, 0.012); p.position.set(Math.cos(a) * 0.014, 0, Math.sin(a) * 0.014); p.rotation.y = -a; fl.add(p); }
  fl.add(sph(0.004, Mat.color(0xf5d142, 0.6), 0, 0.002, 0, 6)); g.add(fl);
  const lm = Mat.color(0x3f7d2c, 0.7, { side: THREE.DoubleSide, map: T.leaf() });
  for (let i = 0; i < 4; i++) { const l = leafMesh(0.06, lm, 0.7, 0.42); l.rotation.set(0.9, i * 1.6 + 0.4, 0, 'YXZ'); g.add(l); }
  return g;
}
function daisy(h = 0.16) {
  const g = new THREE.Group(), st = stem(h, 0.003, 0.08); g.add(st); const top = st.userData.top, fl = new THREE.Group(); fl.position.copy(top); fl.rotation.x = 0.35;
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, p = new THREE.Mesh(new THREE.SphereGeometry(1, 5, 3), petalMat(0xf7f4ea)); p.scale.set(0.02, 0.0015, 0.005); p.position.set(Math.cos(a) * 0.024, 0, Math.sin(a) * 0.024); p.rotation.y = -a; fl.add(p); }
  fl.add(sph(0.009, Mat.color(0xf0c020, 0.7), 0, 0.002, 0, 8)); g.add(fl); return g;
}
function mushroom(s = 1) { const g = new THREE.Group(); g.add(cyl(0.012 * s, 0.016 * s, 0.07 * s, Mat.color(0xeee3cc, 0.8), 0, 0.035 * s, 0, 8)); const c = new THREE.Mesh(new THREE.SphereGeometry(0.045 * s, 12, 6, 0, 6.283, 0, 1.6), Mat.color(0xb5281e, 0.5)); c.position.y = 0.06 * s; g.add(c);
  const r = mulberry(s * 100); for (let i = 0; i < 9; i++) { const a = r() * 6.28, e = 0.2 + r() * 1.1; g.add(sph(0.005 * s, Mat.color(0xf4efe0, 0.6), Math.sin(e) * Math.cos(a) * 0.045 * s, 0.06 * s + Math.cos(e) * 0.045 * s, Math.sin(e) * Math.sin(a) * 0.045 * s, 5)); } return g; }

function rock(r, seed, moss = 0.6) {
  const g = new THREE.IcosahedronGeometry(1, 3), p = g.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 0.72 + 0.55 * fbm(x * 1.3 + seed, z * 1.3 + y * 1.7 + seed * 2, 3); p.setXYZ(i, x * n, y * n * 0.72, z * n); }
  g.computeVertexNormals(); const nr = g.attributes.normal;
  for (let i = 0; i < p.count; i++) { const up = nr.getY(i), k = THREE.MathUtils.smoothstep(up + (vnoise(p.getX(i) * 4 + seed, p.getZ(i) * 4) - 0.5) * 0.6, 0.45, 0.8) * moss, v = 0.75 + 0.3 * vnoise(p.getX(i) * 3, p.getY(i) * 3 + seed);
    col.push(THREE.MathUtils.lerp(0.56 * v, 0.33, k), THREE.MathUtils.lerp(0.54 * v, 0.5, k), THREE.MathUtils.lerp(0.5 * v, 0.2, k)); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, Mat.color(0xffffff, 0.9, { vertexColors: true })); m.scale.setScalar(r); m.castShadow = m.receiveShadow = true; return m;
}

// ---------------------------------------------------------------- build
export function buildGarden(scene, q) {
  const rnd = mulberry(20240613), out = { animated: [], beePerches: [], dewMat: null };
  const Y = groundHeight;

  // ---- terrain mesh straight from the physics grid
  {
    const { half, step, n, data } = (groundHeight(0, 0), GRID);
    const pos = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2), idx = new Uint32Array((n - 1) * (n - 1) * 6);
    const c = new THREE.Color(), mix = (hex, k) => c.lerp(new THREE.Color(hex), k);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = -half + i * step, z = -half + j * step, k = j * n + i, h = data[k];
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z; uv[k * 2] = x / 0.9; uv[k * 2 + 1] = z / 0.9;
      const gd = grassDensity(x, z), s = surfaceAt(x, z).name, nz = fbm(x * 0.9, z * 0.9, 3);
      c.set(0xa08a62); mix(0x5f8a34, Math.min(1, gd * 1.1) * 0.9); mix(0x86a045, Math.max(0, nz - 0.4) * 0.9 * gd);
      if (s === 'packed earth') mix(0xb09a74, 0.75); if (s === 'launch rail') mix(0xa48c66, 0.8);
      if (s === 'mud') mix(0x54402c, 0.85); if (s === 'moss') mix(0x6f7f3c, 0.5); if (s === 'rock') mix(0x8b8880, 0.8);
      if (h < W.pond.level + 0.03) mix(0x3d4a36, THREE.MathUtils.smoothstep(W.pond.level + 0.03 - h, 0, 0.08));
      const v = 0.85 + 0.3 * vnoise(x * 6, z * 6); col[k * 3] = c.r * v; col[k * 3 + 1] = c.g * v; col[k * 3 + 2] = c.b * v;
    }
    let o = 0; for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i; idx[o++] = a; idx[o++] = a + n; idx[o++] = a + 1; idx[o++] = a + 1; idx[o++] = a + n; idx[o++] = a + n + 1; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
    const soil = T.soil(); out.groundMat = new THREE.MeshStandardMaterial({ map: soil, bumpMap: soil, bumpScale: 1.4, vertexColors: true, roughness: 0.95 });
    const m = new THREE.Mesh(g, out.groundMat); m.receiveShadow = true; scene.add(m); out.ground = m;
  }

  // ---- tall grass, broad leaves, clover
  const grassMat = vegMaterial({ color: 0xffffff }), tints = [0x7fb23c, 0x6aa332, 0x8cc04a, 0x5d962e, 0x9ac552, 0xb0b84e];
  out.grass = scatter(scene, bladeGeo(), grassMat, q.grass, rnd, (r, d, c) => {
    // denser near the heart of the garden
    const rad = Math.pow(r(), 0.75) * 19, a = r() * 6.283, x = Math.cos(a) * rad + 1.5, z = Math.sin(a) * rad;
    const gd = grassDensity(x, z); if (r() > gd) return false;
    const h = (0.1 + r() * 0.3) * (0.55 + 0.45 * gd) * (0.7 + 0.6 * fbm(x * 0.4, z * 0.4, 2));
    d.position.set(x, Y(x, z) - 0.004, z); d.rotation.set((r() - 0.5) * 0.5, r() * 6.283, (r() - 0.5) * 0.5); d.scale.set(0.016 + r() * 0.022, h, h);
    c.set(tints[(r() * tints.length) | 0]).multiplyScalar(0.8 + r() * 0.4); return true;
  }, q.grassShadow);
  const leafMat = vegMaterial({ color: 0xffffff, map: T.leaf() });
  out.leaves = scatter(scene, leafGeo(0.45, 0.2, 0.3), leafMat, q.leaves, rnd, (r, d, c) => {
    const x = (r() - 0.5) * 34, z = (r() - 0.5) * 34, gd = grassDensity(x, z); if (gd < 0.3 || r() > gd) return false;
    const s = 0.14 + r() * 0.26; d.position.set(x, Y(x, z) - 0.003, z); d.rotation.set(0.25 + r() * 0.5, r() * 6.283, 0, 'YXZ'); d.scale.set(s, s, s);
    c.set(r() > 0.5 ? 0x4f9a36 : 0x62a83e).multiplyScalar(0.8 + r() * 0.35); return true;
  }, true);
  out.clover = scatter(scene, cloverGeo(), vegMaterial({ color: 0xffffff }), q.clover, rnd, (r, d, c) => {
    const rad = Math.pow(r(), 0.6) * 15, a = r() * 6.283, x = Math.cos(a) * rad + 1, z = Math.sin(a) * rad;
    const gd = grassDensity(x, z), s0 = surfaceAt(x, z).name; if (s0 === 'water' || s0 === 'launch rail' || s0 === 'packed earth' || s0 === 'mud') return false;
    if (gd > 0.85 && r() > 0.3) return false;
    const s = 0.018 + r() * 0.028; d.position.set(x, Y(x, z) - 0.002, z); d.rotation.set(0, r() * 6.283, 0); d.scale.set(s, s, s);
    c.set(r() > 0.3 ? 0x4e9a3a : 0x67ad45).multiplyScalar(0.75 + r() * 0.4); return true;
  }, false);

  // ---- flowers
  const statics = new THREE.Group(); scene.add(statics);
  const put = (proto, x, z, s = 1, ry = rnd() * 6.283, colR = 0, colH = 0) => { const o = proto.clone(); o.position.set(x, Y(x, z) - 0.004, z); o.rotation.y = ry; o.scale.setScalar(s); statics.add(o); if (colR) addCollider({ t: 'cyl', x, z, r: colR * s, y0: Y(x, z) - 0.1, y1: Y(x, z) + colH * s }); return o; };
  const sunP = bake(sunflower(1.5)), danP = bake(dandelion(0.3)), cloP = bake(cloverBlossom(0.12)), cloW = bake(cloverBlossom(0.11, 0xf2ecf0)), vioP = bake(violet(0.09)), daiP = bake(daisy(0.16)), mushP = bake(mushroom(1));
  out.sunflowers = [];
  for (const [x, z, s] of [[W.flowerbed.x - 1.4, W.flowerbed.z + 0.6, 1.1], [W.flowerbed.x + 1.2, W.flowerbed.z - 0.8, 0.95], [W.flowerbed.x + 0.4, W.flowerbed.z + 1.9, 1.2], [-1.3, -1.25, 0.7], [-9.5, -3.5, 1.0], [11, -1.5, 1.15]]) {
    put(sunP, x, z, s, rnd() * 6.283, 0.03, 1.5); out.sunflowers.push({ x, z, top: Y(x, z) + 1.5 * s }); out.beePerches.push([x, Y(x, z) + 1.45 * s, z]);
  }
  for (let i = 0; i < 90; i++) {
    const inBed = i < 45, x = inBed ? W.flowerbed.x + (rnd() - 0.5) * 6 : (rnd() - 0.5) * 26, z = inBed ? W.flowerbed.z + (rnd() - 0.5) * 6 : (rnd() - 0.5) * 26;
    const sName = surfaceAt(x, z).name; if (sName !== 'grass' || grassDensity(x, z) < 0.15) continue;
    const k = rnd();
    if (k < 0.2) { put(danP, x, z, 0.8 + rnd() * 0.6, undefined, 0.006, 0.3); out.beePerches.push([x, Y(x, z) + 0.3, z]); }
    else if (k < 0.5) put(rnd() > 0.3 ? cloP : cloW, x, z, 0.9 + rnd() * 0.9);
    else if (k < 0.75) put(daiP, x, z, 0.8 + rnd() * 0.7);
    else put(vioP, x, z, 1 + rnd() * 1.2);
  }
  // framing clusters around the workshop clearing (violets + pink clover as in the concept art)
  for (let i = 0; i < 26; i++) { const a = rnd() * 6.283, r = W.workshop.r + 0.05 + rnd() * 0.5, x = Math.cos(a) * r, z = Math.sin(a) * r; if (x > 0.9 && Math.abs(z) < 1.5) continue; put(i % 3 === 0 ? cloP : i % 3 === 1 ? vioP : daiP, x, z, 1 + rnd() * 0.8); }

  // ---- rocks
  for (const [x, z, r, moss] of [[-1.75, 1.35, 0.3, 0.9], [-2.1, 1.1, 0.17, 0.7], [1.2, -2.3, 0.22, 0.6], [4.4, 2.7, 0.35, 0.8], [-6.5, -5.5, 0.6, 0.8], [9.2, -3.5, 0.45, 0.5], [-3.5, 6.2, 0.3, 0.3], [8.8, 9.2, 0.5, 0.9], [W.pond.x - 2.9, W.pond.z + 1.2, 0.3, 0.7], [W.pond.x + 2.6, W.pond.z + 1.9, 0.38, 0.8], [-12, 2, 0.7, 0.7], [3, -11, 0.6, 0.6]]) {
    const m = rock(r, x * 3.1 + z, moss); m.position.set(x, Y(x, z) + r * 0.2, z); m.rotation.y = rnd() * 6; scene.add(m); addCollider({ t: 'sph', x, y: Y(x, z) + r * 0.1, z, r: r * 0.82 });
  }
  out.snailRock = { x: -1.75, z: 1.35, y: Y(-1.75, 1.35) + 0.3 * 0.2 + 0.3 * 0.62 };

  // ---- fallen log with moss and mushrooms
  { const g = new THREE.Group(), L = 2.4, r = 0.17, bark = new THREE.MeshStandardMaterial({ map: T.bark(), bumpMap: T.bark(), bumpScale: 2, roughness: 1 });
    const lg = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, L, 18, 6), bark); lg.rotation.z = Math.PI / 2; lg.material.map.repeat?.set(3, 2); g.add(lg);
    g.add(cyl(r * 0.99, r * 0.99, 0.002, Mat.color(0xc9a878, 0.9), L / 2 + 0.001, 0, 0, 18)); g.children[1].rotation.z = Math.PI / 2;
    for (let i = 0; i < 26; i++) { const m = sph(0.05 + rnd() * 0.07, Mat.color(0x5f8f32, 1), (rnd() - 0.5) * L * 0.9, r * (0.8 + rnd() * 0.15), (rnd() - 0.5) * r, 7); m.scale.y = 0.3; g.add(m); }
    const x = 3.3, z = 3.75, ry = 0.5; g.position.set(x, Y(x, z) + r * 0.72, z); g.rotation.y = ry; const b = bake(g); scene.add(b);
    for (let i = -4; i <= 4; i++) addCollider({ t: 'sph', x: x + Math.cos(ry) * i * 0.27, y: g.position.y, z: z - Math.sin(ry) * i * 0.27, r: r * 1.02 });
    for (const [dx, dz, s] of [[0.9, 0.35, 1], [1.02, 0.3, 0.6], [-0.5, 0.33, 0.8], [-0.62, -0.3, 1.2], [0.2, -0.36, 0.7]]) put(mushP, x + dx, z + dz, s);
  }
  // ---- terracotta flowerpot (a tower at this scale)
  { const x = 2.7, z = -3.7, pts = [[0.001, 0], [0.34, 0], [0.37, 0.02], [0.5, 0.74], [0.56, 0.76], [0.57, 0.9], [0.5, 0.9], [0.47, 0.8], [0.001, 0.8]].map((p) => new THREE.Vector2(p[0], p[1]));
    const tc = T.terracotta(), pot = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), new THREE.MeshStandardMaterial({ map: tc, bumpMap: tc, bumpScale: 1.5, roughness: 0.9 })); pot.castShadow = pot.receiveShadow = true;
    const g = new THREE.Group(); g.add(pot, cyl(0.46, 0.46, 0.01, Mat.color(0x4a3524, 1), 0, 0.81, 0, 24));
    for (let i = 0; i < 14; i++) { const l = leafMesh(0.5 + rnd() * 0.5, Mat.color(0x3f8a3a, 0.6, { side: THREE.DoubleSide, map: T.leaf() }), 0.6, 0.2); l.position.set((rnd() - 0.5) * 0.4, 0.8, (rnd() - 0.5) * 0.4); l.rotation.set(0.3 + rnd() * 0.7, rnd() * 6.283, 0, 'YXZ'); g.add(l); }
    g.position.set(x, Y(x, z) - 0.02, z); g.rotation.z = 0.04; scene.add(g); addCollider({ t: 'cyl', x, z, r: 0.56, y0: Y(x, z) - 0.1, y1: Y(x, z) + 1.0 });
  }
  // ---- a forgotten garden trowel, stuck in the soil
  { const x = -2.6, z = 4.3, g = new THREE.Group(), sh = new THREE.Shape(); sh.moveTo(-0.11, 0); sh.lineTo(0.11, 0); sh.quadraticCurveTo(0.12, -0.3, 0, -0.5); sh.quadraticCurveTo(-0.12, -0.3, -0.11, 0);
    const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: false }), Mat.metal('steel')); blade.castShadow = true; g.add(blade);
    g.add(cyl(0.015, 0.015, 0.2, Mat.metal('steel'), 0, 0.1, 0.004, 8), cyl(0.032, 0.026, 0.36, Mat.wood('mid'), 0, 0.38, 0.004, 12), sph(0.033, Mat.color(0xb3261e, 0.5), 0, 0.56, 0.004));
    g.position.set(x, Y(x, z) + 0.33, z); g.rotation.set(0.35, 0.8, 0.2); scene.add(g); addCollider({ t: 'cyl', x, z, r: 0.1, y0: Y(x, z), y1: Y(x, z) + 0.8 });
  }

  // ---- pond
  { const p = W.pond, water = new THREE.Mesh(new THREE.CircleGeometry(p.r * 1.12, 48), new THREE.MeshStandardMaterial({ color: 0x3b6a66, roughness: 0.06, metalness: 0.35, transparent: true, opacity: 0.82 }));
    water.rotation.x = -Math.PI / 2; water.position.set(p.x, p.level, p.z); water.receiveShadow = true; scene.add(water); out.water = water;
    const g = new THREE.Group(), pad = Mat.color(0x4d8f3f, 0.5), reed = Mat.color(0x6c8f3c, 0.8), head = Mat.color(0x5a3a22, 0.9);
    for (let i = 0; i < 16; i++) { const a = rnd() * 6.283, r = rnd() * p.r * 0.75, s = 0.09 + rnd() * 0.1, m = new THREE.Mesh(new THREE.CircleGeometry(s, 14, 0.3, 5.7), pad); m.rotation.x = -Math.PI / 2; m.rotation.z = rnd() * 6; m.position.set(p.x + Math.cos(a) * r, p.level + 0.003, p.z + Math.sin(a) * r); g.add(m);
      if (i % 5 === 0) { const f = new THREE.Group(); for (let k = 0; k < 8; k++) { const pe = new THREE.Mesh(new THREE.SphereGeometry(1, 5, 3), petalMat(0xf6dce6)); pe.scale.set(0.03, 0.004, 0.012); pe.position.set(Math.cos(k * 0.785) * 0.025, 0.012, Math.sin(k * 0.785) * 0.025); pe.rotation.y = -k * 0.785; pe.rotation.z = 0.5; f.add(pe); } f.position.copy(m.position); g.add(f); } }
    for (let i = 0; i < 40; i++) { const a = rnd() * 6.283, r = p.r * (0.92 + rnd() * 0.25), x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r, h = 0.35 + rnd() * 0.45; g.add(rod([x, Y(x, z) - 0.05, z], [x + (rnd() - 0.5) * 0.06, Y(x, z) + h, z + (rnd() - 0.5) * 0.06], 0.005, reed, 5)); if (i % 2) g.add(cyl(0.012, 0.012, 0.09, head, x, Y(x, z) + h - 0.03, z, 6)); }
    // a plank jetty
    for (let i = 0; i < 9; i++) g.add(box(0.07, 0.008, 0.26, Mat.wood('grey'), p.x - p.r * 1.02 + i * 0.075, p.level + 0.035, p.z + 0.4 + Math.sin(i) * 0.004));
    for (const i of [0, 4, 8]) for (const s of [-1, 1]) g.add(cyl(0.012, 0.012, 0.3, Mat.wood('dark'), p.x - p.r * 1.02 + i * 0.075, p.level - 0.08, p.z + 0.4 + s * 0.11, 6));
    scene.add(bake(g, { cast: true }));
  }

  // ---- dew drops clinging to blades
  if (q.dew) { out.dewMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.02, metalness: 0.1, transparent: true, opacity: 0.6, envMapIntensity: 2.5 });
    scatter(scene, new THREE.SphereGeometry(1, 10, 8), out.dewMat, q.dew, rnd, (r, d, c) => { const a = r() * 6.283, rad = 1 + r() * 4.5, x = Math.cos(a) * rad, z = Math.sin(a) * rad; if (grassDensity(x, z) < 0.5) return false; const s = 0.004 + r() * 0.007; d.position.set(x, Y(x, z) + 0.05 + r() * 0.2, z); d.rotation.set(0, 0, 0); d.scale.set(s, s * 1.15, s); c.set(0xffffff); return true; }, false); }

  // ---- garden fence + the blurry giants beyond it
  { const n = 4 * 46, im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.74, 2.6, 0.06), new THREE.MeshStandardMaterial({ map: T.wood('grey'), roughness: 1, color: 0x9a927e }), n), d = new THREE.Object3D(); let k = 0;
    for (let s = 0; s < 4; s++) for (let i = 0; i < 46; i++) { const t = -17.2 + i * 0.76, x = s === 0 ? t : s === 1 ? t : s === 2 ? -17.2 : 17.2, z = s === 0 ? -17.2 : s === 1 ? 17.2 : t; d.position.set(x, Y(x, z) + 1.1 + (hashI(i, s) - 0.5) * 0.1, z); d.rotation.set(0, s > 1 ? Math.PI / 2 : 0, (hashI(i + 9, s) - 0.5) * 0.03); d.updateMatrix(); im.setMatrixAt(k++, d.matrix); }
    im.castShadow = im.receiveShadow = true; scene.add(im);
    const far = new THREE.Group(), fm = [Mat.color(0x3d6b2e, 1), Mat.color(0x4d7c35, 1), Mat.color(0x2f5a2a, 1)];
    for (let i = 0; i < 46; i++) { const a = i / 46 * 6.283 + rnd() * 0.1, r = 24 + rnd() * 10, s = 3 + rnd() * 4.5; const m = sph(s, fm[i % 3], Math.cos(a) * r, 1.5 + rnd() * 3, Math.sin(a) * r, 9); m.scale.y = 0.8 + rnd() * 0.7; far.add(m); }
    // a tree trunk towering in the north-west corner, with roots
    const bark = new THREE.MeshStandardMaterial({ map: T.bark(), roughness: 1 }); const tx = -13.5, tz = -12.5;
    far.add(cyl(1.5, 2.3, 14, bark, tx, 6.5, tz, 16)); for (let i = 0; i < 7; i++) { const a = i * 0.9, r0 = rod([tx + Math.cos(a) * 1.6, 0.9, tz + Math.sin(a) * 1.6], [tx + Math.cos(a) * 5, -0.2, tz + Math.sin(a) * 5], 0.35, bark, 8); far.add(r0); }
    far.add(sph(8, fm[0], tx, 17, tz, 10), sph(6, fm[1], tx + 5, 15, tz + 3, 10));
    scene.add(bake(far, { cast: false })); addCollider({ t: 'cyl', x: tx, z: tz, r: 2.2, y0: -1, y1: 14 });
  }
  return out;
}
function hashI(a, b) { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); }
