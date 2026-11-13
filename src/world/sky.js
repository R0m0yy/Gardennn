// Sun, sky dome, day/night cycle, fog, rain. Golden-hour by default to match the art direction.
import * as THREE from 'three';
import { groundHeight } from '../sim/world.js';

const KEYS = [ // hour, sun colour, sun intensity, sky top, horizon, ambient, fog density
  [0, 0x8fa8ff, 0.25, 0x070b1c, 0x141c33, 0.25, 0.03],
  [5, 0x8fa8ff, 0.25, 0x0c1330, 0x2a2f4a, 0.3, 0.03],
  [6.5, 0xff9a5a, 1.6, 0x35508c, 0xf2a66a, 0.6, 0.028],
  [8.5, 0xffd9a0, 3.3, 0x3f7fd0, 0xf6dcae, 1.0, 0.03],
  [12.5, 0xfff1d8, 3.6, 0x3f86e0, 0xcfe4f2, 1.15, 0.024],
  [16.5, 0xffd08a, 3.4, 0x3f7fd0, 0xf8d9a4, 1.0, 0.03],
  [19, 0xff8448, 1.8, 0x34497e, 0xf0905a, 0.6, 0.026],
  [20.5, 0x8fa8ff, 0.3, 0x0e1634, 0x34304a, 0.32, 0.03],
  [24, 0x8fa8ff, 0.25, 0x070b1c, 0x141c33, 0.25, 0.03],
];
const cA = new THREE.Color(), cB = new THREE.Color();
const lerpHex = (a, b, t, out) => out.copy(cA.set(a)).lerp(cB.set(b), t);

export class Sky {
  constructor(scene, renderer, q) {
    this.scene = scene; this.renderer = renderer; this.hour = 8.6; this.dayMinutes = 24; this.paused = false;
    this.sun = new THREE.DirectionalLight(0xffffff, 3); this.sun.castShadow = true;
    const sc = this.sun.shadow; sc.mapSize.set(q.shadow, q.shadow); sc.bias = -0.0004; sc.normalBias = 0.004;
    this.shadowHalf = 2.2; Object.assign(sc.camera, { left: -2.2, right: 2.2, top: 2.2, bottom: -2.2, near: 0.5, far: 40 });
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x6a5a3a, 1); scene.add(this.hemi);
    this.fog = new THREE.FogExp2(0xf6dcae, 0.018); scene.fog = this.fog;
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(60, 24, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, haze: { value: 0 } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }',
      fragmentShader: `varying vec3 vD; uniform vec3 top, hor, sunDir, sunCol; uniform float haze;
        void main(){ vec3 d = normalize(vD); float h = clamp(d.y, 0.0, 1.0); vec3 c = mix(hor, top, pow(h, 0.55));
          c = mix(c, hor, haze * 0.8);
          float s = max(dot(d, sunDir), 0.0); c += sunCol * (pow(s, 600.0) * 6.0 + pow(s, 24.0) * 0.35 + pow(s, 4.0) * 0.12) * (1.0 - haze * 0.8);
          // soft cloud bands
          float cl = smoothstep(0.55, 0.9, sin(d.x * 5.0 + d.z * 3.0) * 0.5 + sin(d.z * 9.0 - d.x * 4.0) * 0.3 + 0.55) * smoothstep(0.05, 0.4, d.y) * (1.0 - smoothstep(0.5, 0.9, d.y));
          c = mix(c, mix(hor, vec3(1.0), 0.6), cl * 0.35);
          gl_FragColor = vec4(c, 1.0); }`,
    }));
    this.dome.renderOrder = -10; this.dome.frustumCulled = false; scene.add(this.dome);
    this.sunDir = new THREE.Vector3(); this.night = 0;
    // rain: fat drops (a raindrop is as big as your head down here) + splash rings
    const n = q.pr > 1 ? 420 : 200; this.rainN = n;
    this.drops = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 5), new THREE.MeshStandardMaterial({ color: 0xcfe4ff, roughness: 0.05, transparent: true, opacity: 0.55, envMapIntensity: 2 }), n);
    this.drops.frustumCulled = false; this.drops.visible = false; scene.add(this.drops);
    this.dropP = Array.from({ length: n }, () => ({ x: 0, y: -1, z: 0, v: 0 }));
    this.rings = Array.from({ length: 36 }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); return m; });
    this.ringI = 0; this._o = new THREE.Object3D();
    this.pmrem = new THREE.PMREMGenerator(renderer); this._envHour = -99;
    this.apply(0, { fog: 0, rain: 0 });
  }
  apply(dt, w) {
    const h = this.hour; let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1][0] <= h) i++;
    const a = KEYS[i], b = KEYS[i + 1], t = (h - a[0]) / (b[0] - a[0]);
    const gloom = Math.max(w.rain * 0.55, w.fog * 0.35);
    lerpHex(a[1], b[1], t, this.sun.color); this.sun.intensity = THREE.MathUtils.lerp(a[2], b[2], t) * (1 - gloom * 0.8);
    const U = this.dome.material.uniforms; lerpHex(a[3], b[3], t, U.top.value); lerpHex(a[4], b[4], t, U.hor.value);
    if (gloom > 0) { U.top.value.lerp(cA.set(0x8c96a0), gloom); U.hor.value.lerp(cA.set(0xb9bfc2), gloom); }
    U.haze.value = gloom; U.sunCol.value.copy(this.sun.color);
    this.hemi.intensity = THREE.MathUtils.lerp(a[5], b[5], t) * (1 + gloom * 0.25); this.hemi.color.copy(U.top.value).lerp(cA.set(0xffffff), 0.45); this.hemi.groundColor.set(0x6a5a3a).lerp(U.hor.value, 0.3);
    this.fog.color.copy(U.hor.value).lerp(cA.set(0xffffff), 0.08); this.fog.density = THREE.MathUtils.lerp(a[6], b[6], t) + w.fog * 0.11 + w.rain * 0.02;
    // sun path: rises east (+X), culminates south, sets west. At night the "sun" becomes the moon.
    const day = h > 5.5 && h < 20.3, ph = day ? (h - 5.5) / 14.8 : ((h + 24 - 20.3) % 24) / 9.2, el = Math.sin(ph * Math.PI) * (day ? 1.0 : 0.8) + 0.12, az = Math.PI * (1 - ph);
    this.sunDir.set(Math.cos(az) * Math.cos(el), Math.sin(el), 0.45 * Math.cos(el) + 0.2).normalize(); U.sunDir.value.copy(this.sunDir);
    this.night = day ? THREE.MathUtils.smoothstep(Math.abs(h - 12.9), 5.6, 7.4) : 1;
    if (Math.abs(h - this._envHour) > 0.75 || Math.abs(gloom - (this._envGloom || 0)) > 0.2) this.refreshEnv(gloom);
  }
  refreshEnv(gloom) {
    this._envHour = this.hour; this._envGloom = gloom;
    const s = new THREE.Scene(), d = this.dome.clone(); s.add(d);
    const old = this.scene.environment; const rt = this.pmrem.fromScene(s, 0.02); this.scene.environment = rt.texture; this.scene.environmentIntensity = 0.55; if (this._envRT) this._envRT.dispose(); this._envRT = rt;
  }
  update(dt, focus, weather, simDt) {
    if (!this.paused) this.hour = (this.hour + dt / 60 * 24 / this.dayMinutes) % 24;
    this.apply(dt, weather.cur);
    // shadow frustum follows the action, snapped to texels to avoid shimmer
    const half = this.shadowHalf, tex = half * 2 / this.sun.shadow.mapSize.x;
    const tx = Math.round(focus.x / tex) * tex, tz = Math.round(focus.z / tex) * tex;
    this.sun.target.position.set(tx, focus.y, tz); this.sun.position.set(tx, focus.y, tz).addScaledVector(this.sunDir, 20);
    this.dome.position.copy(focus);
    // rain
    const rain = weather.cur.rain; this.drops.visible = rain > 0.05;
    if (this.drops.visible) {
      const o = this._o, active = Math.floor(this.rainN * rain);
      for (let i = 0; i < this.rainN; i++) { const p = this.dropP[i];
        if (i >= active) { o.position.set(0, -50, 0); o.updateMatrix(); this.drops.setMatrixAt(i, o.matrix); continue; }
        p.y -= 3.2 * simDt;
        const g = groundHeight(p.x, p.z);
        if (p.y < g) { if (p.y > g - 1 && Math.random() < 0.5) this.splash(p.x, g, p.z); p.x = focus.x + (Math.random() - 0.5) * 5; p.z = focus.z + (Math.random() - 0.5) * 5; p.y = focus.y + 1.5 + Math.random() * 2.5; }
        o.position.set(p.x, p.y, p.z); o.scale.set(0.0035, 0.009, 0.0035); o.updateMatrix(); this.drops.setMatrixAt(i, o.matrix); }
      this.drops.instanceMatrix.needsUpdate = true;
    }
    for (const r of this.rings) if (r.visible) { r.userData.t += dt * 2.2; const t = r.userData.t; r.scale.setScalar(0.01 + t * 0.05); r.material.opacity = 0.5 * (1 - t); if (t >= 1) r.visible = false; }
  }
  splash(x, y, z) { const r = this.rings[this.ringI++ % this.rings.length]; r.position.set(x, y + 0.003, z); r.userData.t = 0; r.visible = true; }
  setShadowRange(half) { if (Math.abs(half - this.shadowHalf) < 0.05) return; this.shadowHalf = half; const c = this.sun.shadow.camera; c.left = -half; c.right = half; c.top = half; c.bottom = -half; c.updateProjectionMatrix(); }
}
