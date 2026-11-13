import * as THREE from 'three';
// Bake a static group into one mesh per material (cuts draw calls by 10-50x).
export function bake(group, { cast = true, receive = true } = {}) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert(), by = new Map(), keep = [];
  group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.noBake) { if ((o.isInstancedMesh || o.userData.noBake || o.isLight) && o !== group) keep.push(o); return; }
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!by.has(o.material)) by.set(o.material, []);
    by.get(o.material).push(g);
  });
  const out = new THREE.Group();
  for (const [mat, gs] of by) {
    let n = 0; for (const g of gs) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
    for (const g of gs) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; g.dispose(); }
    const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const mesh = new THREE.Mesh(m, mat); mesh.castShadow = cast; mesh.receiveShadow = receive; out.add(mesh);
  }
  for (const k of keep) { const wm = new THREE.Matrix4().multiplyMatrices(inv, k.matrixWorld); out.add(k); wm.decompose(k.position, k.quaternion, k.scale); }
  out.position.copy(group.position); out.quaternion.copy(group.quaternion); out.scale.copy(group.scale);
  return out;
}
export const box = (w, h, d, mat, x = 0, y = 0, z = 0, ry = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.set(x, y, z); o.rotation.y = ry; return o; };
export const cyl = (r0, r1, h, mat, x = 0, y = 0, z = 0, seg = 10) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat); o.position.set(x, y, z); return o; };
export const sph = (r, mat, x = 0, y = 0, z = 0, seg = 10) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)), mat); o.position.set(x, y, z); return o; };
