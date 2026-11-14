// EVOLUTION: Garden Wars - game bootstrap, state machine and main loop.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildGarden, QUALITY, vegU } from './world/garden.js';
import { buildStructures, PAD, HUT } from './world/structures.js';
import { Sky } from './world/sky.js';
import { Insects } from './world/insects.js';
import { Weather, makeEnv, groundHeight, SITES, WORLD } from './sim/world.js';
import { TEMPLATES, cloneBlueprint, sanitizeBlueprint } from './sim/blueprint.js';
import { hprFromQ } from './sim/vec.js';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import * as Save from './core/save.js';
import { Player } from './game/player.js';
import { CameraRig } from './game/cameras.js';
import { Craft, FlightSession, TIME_SCALE } from './game/session.js';
import { JOURNEY, unlocksFor, unlockNote, hoopCrossed, HOOPS } from './game/missions.js';
import { Panels } from './ui/panels.js';
import { Workshop } from './ui/workshop.js';

const LensShader = {
  uniforms: { tDiffuse: { value: null }, px: { value: new THREE.Vector2(1 / 1280, 1 / 720) }, amount: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 px; uniform float amount; varying vec2 vUv;
    void main(){ float b = amount * 3.2 * smoothstep(0.27, 0.52, abs(vUv.y - 0.5));
      vec4 c = texture2D(tDiffuse, vUv) * 0.2;
      c += (texture2D(tDiffuse, vUv + vec2(1.0, 0.4) * px * b) + texture2D(tDiffuse, vUv + vec2(-1.0, -0.4) * px * b) + texture2D(tDiffuse, vUv + vec2(0.4, -1.0) * px * b) + texture2D(tDiffuse, vUv + vec2(-0.4, 1.0) * px * b)) * 0.125;
      c += (texture2D(tDiffuse, vUv + vec2(0.7, 0.7) * px * b * 1.8) + texture2D(tDiffuse, vUv + vec2(-0.7, 0.7) * px * b * 1.8) + texture2D(tDiffuse, vUv + vec2(0.7, -0.7) * px * b * 1.8) + texture2D(tDiffuse, vUv + vec2(-0.7, -0.7) * px * b * 1.8)) * 0.075;
      float l = dot(c.rgb, vec3(0.3, 0.59, 0.11)); c.rgb = mix(vec3(l), c.rgb, 1.14);          // a touch more saturation
      vec2 d = vUv - 0.5; c.rgb *= 1.0 - dot(d, d) * 0.55;                                      // vignette
      gl_FragColor = c; }`,
};

class Game {
  constructor() {
    const params = new URLSearchParams(location.search);
    this.save = Save.load(); this.ui = document.getElementById('ui'); this.canvas = document.getElementById('view');
    if (this.save.fresh && (navigator.maxTouchPoints > 0 || innerWidth < 800)) this.save.settings.quality = 'low';   // first run on phones/tablets
    const qKey = params.get('q') || this.save.settings.quality; this.q = QUALITY[qKey] || QUALITY.medium; this.qKey = qKey;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, this.q.pr)); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.08;
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(38, 1, 0.008, 160);
    this.weather = new Weather(); this.env = makeEnv(this.weather);
    this.garden = buildGarden(this.scene, this.q); this.struct = buildStructures(this.scene); this.sky = new Sky(this.scene, r, this.q); this.sky.hour = this.save.hour;
    this.insects = new Insects(this.scene, this.garden);
    this.player = new Player(this.scene); if (this.save.player) { this.player.pos.set(this.save.player.x, 0, this.save.player.z); this.player.pos.y = groundHeight(this.save.player.x, this.save.player.z); }
    this.rig = new CameraRig(this.camera); this.input = new Input(this.canvas); this.audio = new Audio();
    this.panels = new Panels(this); this.workshop = new Workshop(this);
    this.fade = document.createElement('div'); this.fade.id = 'fade'; document.body.append(this.fade);
    if (qKey !== 'low') {
      this.composer = new EffectComposer(r); this.renderPass = new RenderPass(this.scene, this.camera); this.composer.addPass(this.renderPass);
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.7, 0.92); this.composer.addPass(this.bloom);
      this.lens = new ShaderPass(LensShader); this.composer.addPass(this.lens); this.composer.addPass(new OutputPass());
    }
    this.state = 'menu'; this.craft = null; this.session = null; this.trial = null; this.carry = false; this.hoops = new Set(); this.focus = new THREE.Vector3(); this.time = 0; this.saveT = 0; this.weatherT = 150; this.hpr = { heading: 0, pitch: 0, roll: 0 }; this.menuAng = 0;
    this.applySettings(); addEventListener('resize', () => this.resize()); this.resize();
    addEventListener('pointerdown', () => this.audio.start(), { once: false });
    if (this.save.activeId) { const b = this.save.blueprints.find((x) => x.id === this.save.activeId); if (b) this.spawnCraft(b); }
    if (this.save.recovered) setTimeout(() => this.toast('Your save file could not be read, so a fresh one was started. The old data was kept aside.', 'bad'), 1500);
    this.panels.menu();
    document.getElementById('boot')?.remove();
    this.last = performance.now(); this.frames = 0;
    const loop = (now) => { requestAnimationFrame(loop); const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.frame(dt); this.frames++; window.__frames = this.frames; };
    if (params.get('manual') !== '1') requestAnimationFrame(loop);
  }
  get unlocks() { return unlocksFor(this.save.progress.step, this.save.mode === 'sandbox' || !!this.trial); }
  toast(m, c) { this.panels.toast(m, c); }
  persist() { this.save.player = { x: this.player.pos.x, z: this.player.pos.z }; this.save.hour = this.sky.hour; Save.store(this.save); }
  eraseSave() { Save.wipe(); location.reload(); }
  resize() { const w = innerWidth, h = innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); if (this.composer) { this.composer.setSize(w, h); this.lens.uniforms.px.value.set(1 / w, 1 / h); } }
  applySettings() { const s = this.save.settings; this.audio.setVolume(s.master); this.sky.paused = +s.dayMinutes === 0; this.sky.dayMinutes = +s.dayMinutes || 24; if (this.bloom) { this.bloom.enabled = !!s.bloom; this.lens.uniforms.amount.value = s.lens ? 1 : 0; } }

  // ---------------------------------------------------------------- flow
  startMode(mode) { this.save.mode = mode; this.trial = null; this.state = 'explore'; this.panels.clear(); this.rig.mode = 'explore'; this.updateObjective(); this.persist();
    if (mode === 'sandbox') this.toast('Sandbox: everything is unlocked. Pause (Esc) to choose weather, wind and time of day.'); }
  toTitle() { this.persist(); if (this.session) this.endSession(false); this.state = 'menu'; this.panels.menu(); }
  resume() { this.panels.clear(); if (this.state === 'modal') this.state = this.prevState || 'explore'; }
  modal(fn) { if (this.state !== 'modal') this.prevState = this.state; this.state = 'modal'; fn(); }
  updateObjective() {
    if (this.trial) { this.panels.setObjective(`${this.trial.year} · ${this.trial.title}`, this.trial.brief, this.trial.id === 'scout1917' ? `Hoops: ${this.hoops.size} / 4` : null); return; }
    if (this.save.mode !== 'journey') { this.panels.setObjective('Free Invention Sandbox', 'Design at the bench, test anywhere. Nothing is locked.', null); return; }
    const st = JOURNEY[Math.min(this.save.progress.step, JOURNEY.length - 1)]; this.panels.setObjective(st.title, st.text, st.hint);
  }
  event(ev) {
    if (this.save.mode !== 'journey' || this.trial) return null; const P = this.save.progress, st = JOURNEY[P.step]; if (!st) return null;
    if (st.done(ev)) { P.step++; this.audio.play('chime'); const n = unlockNote(P.step); this.toast(`Step complete: ${st.title}` + (n ? ` — unlocked: ${n}` : ''), 'good'); this.updateObjective(); this.persist(); return { cls: 'good', text: `Journey step complete: ${st.title}` + (n ? `. Unlocked: ${n}.` : '') }; }
    if (ev.type === 'flight' && st.goal) return { cls: 'warn', text: `${st.title}: ${st.goal(ev)}` };
    return null;
  }
  transition(fn) { this.fade.classList.add('on'); setTimeout(() => { fn(); this.fade.classList.remove('on'); }, 320); }

  // ---------------------------------------------------------------- blueprints & prototypes
  saveBlueprint(bp, note) {
    const list = this.save.blueprints, copy = JSON.parse(JSON.stringify(bp)), i = list.findIndex((b) => b.id === bp.id);
    if (i >= 0) { const old = list[i], revs = old.revisions || []; if (JSON.stringify(old.parts) !== JSON.stringify(copy.parts) || (old.trim || 0) !== (copy.trim || 0)) revs.unshift({ t: Date.now(), note: `${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ${note}`, parts: old.parts, trim: old.trim || 0 }); copy.revisions = revs.slice(0, 12); list[i] = copy; }
    else { copy.revisions = []; list.unshift(copy); if (list.length > 30) list.pop(); }
    this.save.activeId = bp.id; this.persist();
  }
  spawnCraft(bp) { if (this.craft) this.craft.dispose(); const clean = sanitizeBlueprint(bp); this.craft = new Craft(this.scene, clean); this.craft.place(PAD.x, PAD.z, Math.PI * 0.75); this.carry = false; this.player.carrying = false; return this.craft; }
  buildPrototype(bp) {
    this.saveBlueprint(bp, 'Built prototype'); this.audio.play('hammer');
    this.transition(() => { this.spawnCraft(bp); this.closeWorkshop(true); this.player.pos.set(PAD.x - 0.12, 0, PAD.z + 0.12); this.player.pos.y = groundHeight(this.player.pos.x, this.player.pos.z); this.player.work = 1.2;
      this.toast(`${bp.name} rolled out onto the assembly deck`, 'good'); this.event({ type: 'build', bp }); });
  }
  openWorkshop(templateKey) {
    let bp = templateKey ? (() => { const c = cloneBlueprint(TEMPLATES[templateKey]); c.historical = TEMPLATES[templateKey].historical; return c; })() : this.craft ? this.craft.bp : cloneBlueprint(TEMPLATES.card_glider);
    this.panels.clear(); this.state = 'workshop'; this.rig.mode = 'orbit'; this.rig.noGround = true; this.rig.orbit = { yaw: 0.7, pitch: 0.42, dist: 0.5 }; this.workshop.show(bp); this.rig.update(0.016, this.workshop.focus, null, 0, true);
    this.event({ type: 'station', id: 'bench' });
  }
  closeWorkshop(silent) { this.workshop.hide(); this.state = 'explore'; this.rig.mode = 'explore'; this.rig.noGround = false; this.rig.update(0.016, this.player.pos, null, 0, true); if (!silent) this.audio.play('page'); }

  // ---------------------------------------------------------------- flying
  startTrial(t) {
    this.audio.start(); this.panels.clear(); this.trial = t; this.hoops.clear();
    const bp = cloneBlueprint(TEMPLATES[t.bp]); bp.historical = true; bp.name = TEMPLATES[t.bp].name;
    this.transition(() => { this.spawnCraft(bp); this.weather.set(t.weather, true); this.weather.dir = t.windDir; this.beginFlight(t.site, true); this.updateObjective(); });
  }
  beginFlight(siteKey, now) {
    const go = () => {
      const c = this.craft, s = SITES[siteKey]; this.panels.clear(); this.carry = false; this.player.carrying = false;
      c.ac.repairIfWrecked?.(); c.ac.refuel();
      if (s) { const y = s.kind === 'hill' ? groundHeight(s.pos[0], s.pos[2]) + 0.022 - c.ac.lowestY : null; c.place(s.pos[0], s.pos[2], s.heading, y); } else { const hp = hprFromQ(c.ac.q); c.place(c.ac.pos[0], c.ac.pos[2], hp.heading); }
      for (const srf of c.ac.surfs) srf.moisture *= 1; this.hoops.clear();
      this.session = new FlightSession(this, c, siteKey); this.siteKey = siteKey; this.state = 'fly'; this.rig.mode = 'chase'; this.player.visible = false; this.player.sync(0); c.setPilot(true);
      this.audio.setEngine(c.ac.engines[0] ? c.ac.engines[0].spec.sound : null); this.prevPos = c.ac.pos.slice();
      this.rig.update(0.016, this.focus.set(...c.ac.pos), c.mesh.quaternion, 0, true);
    };
    now ? go() : this.transition(go);
  }
  endSession(showPlayer = true) {
    const c = this.craft; this.session = null; this.audio.setEngine(null); c.setPilot(false); this.rig.mode = 'explore'; this.player.visible = true;
    if (showPlayer) { const p = c.ac.pos, hp = hprFromQ(c.ac.q), ox = Math.cos(hp.heading) * 0.07, oz = Math.sin(hp.heading) * 0.07; this.player.pos.set(p[0] + ox, 0, p[2] + oz); this.player.pos.y = groundHeight(this.player.pos.x, this.player.pos.z); this.player.vy = 0.12; this.player.onGround = false; }
    if (this.trial) { this.trial = null; this.weather.set('calm'); } this.updateObjective();
  }
  onFlightEnd(s) {
    const r = s.report, P = this.save.progress; r.base = s.craft.bp.base || s.craft.bp.id; r.hoops = this.hoops.size; r.engine = s.ac.engines[0] ? s.ac.engines[0].part.kind : null;
    P.flights++; P.bestGlide = Math.max(P.bestGlide, r.energyUsed ? 0 : r.distance);
    this.save.journal.unshift(r); if (this.save.journal.length > 40) this.save.journal.pop();
    let banner = null;
    if (this.trial) { const sc = this.trial.score(r); if (sc.pass) { const old = P.trials[this.trial.id], rank = { bronze: 1, silver: 2, gold: 3 }; if (!old || rank[sc.medal] >= rank[old.medal]) P.trials[this.trial.id] = { value: sc.value, medal: sc.medal }; banner = { cls: 'good', text: `Trial passed — ${sc.medal} · ${sc.value}` }; this.audio.play('chime'); } else { banner = { cls: 'bad', text: `Trial not passed · ${sc.value}` }; this.audio.play('fail'); } }
    else { banner = this.event({ type: 'flight', r }); if (!banner) this.audio.play(r.ok ? 'chime' : 'fail'); }
    this.persist(); this.prevState = 'explore'; this.state = 'modal'; this.audio.setEngine(null); this.lastReport = r;
    this.panels.report(r, { live: true, banner });
  }
  flyAgain() { const c = this.craft, t = this.trial, site = this.siteKey; if (c.ac.damageReport().length || c.ac.destroyed) { c.ac.repair(); this.audio.play('hammer'); } for (const s of c.ac.surfs) s.moisture = 0; c.ac.fus.moisture = 0; c.ac.mass = c.ac.dryMass; this.session = null; this.trial = t; this.beginFlight(site === 'here' ? c.bp.launch : site); }
  reportToBench() { this.panels.clear(); this.endSession(true); this.craft.ac.repair(); this.openWorkshop(); }
  reportExit() { this.panels.clear(); this.endSession(true); this.state = 'explore'; }
  craftAction(a) {
    const c = this.craft; this.panels.clear(); this.state = 'explore';
    if (a === 'carry') { this.carry = true; this.player.carrying = true; this.audio.play('wood'); this.toast('Carrying the prototype. E to set it down — on a launch site it mounts automatically.'); }
    else if (a === 'repair') { c.ac.repair(); this.player.work = 1.5; this.audio.play('hammer'); this.toast('Repaired', 'good'); }
    else if (a === 'bench') this.transition(() => this.openWorkshop());
    else if (a === 'here') { // hop into the seat
      const seat = c.mesh.userData.seat.getWorldPosition(new THREE.Vector3()), from = this.player.pos.clone(); this.state = 'boarding'; this.board = { t: 0, from, to: seat, go: () => this.beginFlight('here', true) }; this.audio.play('jump'); }
    else this.beginFlight(a);
  }

  // ---------------------------------------------------------------- per-frame
  frame(dt) {
    const inp = this.input, P = this.player, pan = this.panels; inp.pollPad(); this.time += dt; const sdt = dt * TIME_SCALE;
    const live = ['explore', 'fly', 'boarding'].includes(this.state);
    if (live) { this.weather.update(sdt);
      if (this.save.mode === 'journey' && !this.trial && this.state === 'explore') { this.weatherT -= dt; if (this.weatherT < 0) { this.weatherT = 150 + Math.random() * 120; const k = Math.random(), w = k < 0.35 ? 'calm' : k < 0.7 ? 'breeze' : k < 0.86 ? 'gusty' : 'rain'; this.weather.set(w); this.weather.dir = Math.random() * 6.283; this.toast(`Weather: ${this.weather.target.name}`); } } }
    if (inp.pressed('Escape')) { if (this.state === 'workshop') this.closeWorkshop(); else if (this.state === 'modal' && ['pause', 'journal', 'timeline', 'craft'].includes(pan.modal)) this.resume(); else if (live) this.modal(() => pan.pause()); }

    if (this.state === 'menu') { this.menuAng += dt * 0.05; this.focus.set(0.1, 0.12, 0.1); const a = this.menuAng + 0.6; this.camera.position.set(Math.sin(a) * 1.5, 0.5 + Math.sin(this.menuAng * 2) * 0.1, Math.cos(a) * 1.5); this.camera.lookAt(this.focus); }
    else if (this.state === 'explore') this.explore(dt, inp);
    else if (this.state === 'boarding') { const b = this.board; b.t += dt / 0.45; const k = Math.min(1, b.t); P.pos.lerpVectors(b.from, b.to, k); P.pos.y += Math.sin(k * Math.PI) * 0.03; P.onGround = false; P.sync(dt); this.focus.copy(P.pos); this.rig.update(dt, this.focus, null); if (k >= 1) { this.board = null; b.go(); } }
    else if (this.state === 'fly') this.fly(dt, inp);
    else if (this.state === 'workshop') { this.rig.input(inp); this.rig.update(dt, this.workshop.focus, null); this.workshop.tick(dt); }
    else if (this.state === 'modal') { /* world frozen behind a panel */ }

    if (live) {
      const c = this.craft, flying = this.state === 'fly';
      this.insects.update(dt, { player: P, playerActive: this.state === 'explore', ear: this.camera.position, audio: this.audio,
        craft: c ? { pos: c.ac.pos, speed: Math.hypot(...c.ac.vel), loud: flying && c.ac.engines.some((e) => e.level > 0.1), parked: !flying && !this.carry } : null,
        onNip: () => { const d = P.pos.clone().sub(new THREE.Vector3(WORLD.nest.x, P.pos.y, WORLD.nest.z)).normalize(); P.knock.copy(d.multiplyScalar(0.6)); P.health = Math.max(0.1, P.health - 0.08); this.audio.play('nip'); this.rig.shake = 0.6; this.toast('The ants are defending their nest!', 'bad'); },
        onBeeStrike: () => { if (!flying) return; const s = c.ac.surfs.find((x) => !x.vertical); if (s) { const i = Math.random() < 0.5 ? 0 : 1; s.health[i] = Math.max(0.05, s.health[i] - 0.3); } c.ac.w[0] += (Math.random() - 0.5) * 6; c.ac.w[1] += (Math.random() - 0.5) * 4; this.audio.play('thud'); this.rig.shake = 1; this.session.events.push({ t: this.session.t, type: 'damage', msg: 'Collided with a bee', pos: c.ac.pos.slice() }); this.toast('Bee strike! Wing damaged', 'bad'); } });
      P.health = Math.min(1, P.health + dt * 0.02);
      // vegetation reacts to wind, feet and wheels
      const wv = this.weather.wind([this.focus.x, this.focus.y + 0.2, this.focus.z]), ws = Math.hypot(wv[0], wv[2]);
      vegU.uTime.value = this.time; vegU.uWind.value.set(ws > 0.01 ? wv[0] / ws : 1, ws > 0.01 ? wv[2] / ws : 0, 0.12 + Math.min(ws, 3) * 0.3);
      vegU.uPush.value[0].set(P.pos.x, P.pos.z, 0.07, P.visible ? 1 : 0);
      if (c) { const low = (c.ac.agl ?? 0) < 0.1 || !flying; vegU.uPush.value[1].set(c.ac.pos[0], c.ac.pos[2], 0.16, low && !this.carry ? 1 : 0); }
      vegU.uFocus.value.copy(this.focus).y += 0.012; vegU.uSee.value = this.state === 'fly' ? (this.rig.mode === 'chase' ? 0.07 : 0) : 0.1;
      this.struct.windsock.rotation.y = Math.atan2(-wv[2], wv[0]); this.struct.windsock.rotation.z = -Math.max(0, 1.1 - ws * 0.9);
      if (this.garden.water) this.garden.water.position.y = WORLD.pond.level + Math.sin(this.time * 0.8) * 0.002;
      this.garden.groundMat.color.setScalar(1 - 0.32 * this.weather.wet); this.garden.groundMat.roughness = 0.95 - 0.45 * this.weather.wet;
      this.audio.ambient(dt, { wind: ws, airspeed: flying ? c.ac.airspeed : 0, flying, rain: this.weather.rain, buzz: this.insects.buzzNear, night: this.sky.night, stress: flying ? c.ac.maxStress : 0 });
      this.saveT += dt; if (this.saveT > 20 && this.state === 'explore') { this.saveT = 0; this.persist(); }
    }
    const inWorld = this.state !== 'workshop';
    if (inWorld) { this.sky.setShadowRange(this.state === 'fly' ? Math.min(9, 2.5 + (this.craft.ac.agl || 0) * 1.5) : this.state === 'menu' ? 2.6 : 1.5 + this.rig.dist * 1.2); this.sky.update(live ? dt : 0, this.focus, this.weather, live ? sdt : 0);
      const n = this.sky.night; for (const l of this.struct.lights) l.intensity = 0.03 + n * 0.5; for (const gl of this.struct.lanternGlass) gl.material.emissiveIntensity = 1.2 + n * 3; }
    pan.updateHud(dt);
    const scene = inWorld ? this.scene : this.workshop.scene;
    if (this.skipRender) { inp.endFrame(); return; }
    if (this.composer) { this.renderPass.scene = scene; this.lens.enabled = inWorld; this.composer.render(dt); } else this.renderer.render(scene, this.camera);
    inp.endFrame();
  }

  explore(dt, inp) {
    const P = this.player, rig = this.rig, pan = this.panels, c = this.craft;
    rig.input(inp);
    const f = rig.forward, ax = inp.axis(['KeyA'], ['KeyD']) + inp.stick.x + (inp.pad ? inp.pad.lx : 0), az = inp.axis(['KeyS'], ['KeyW']) - inp.stick.y - (inp.pad ? inp.pad.ly : 0);
    const mv = { x: f.x * az - f.z * ax, z: f.z * az + f.x * ax }, ml = Math.hypot(mv.x, mv.z); if (ml > 1) { mv.x /= ml; mv.z /= ml; }
    P.update(dt, mv, inp.down('ShiftLeft', 'ShiftRight') || ml > 0.9 && (inp.touch || !!inp.pad), inp.pressed('Space'), inp.down('KeyC'), this.audio, this.weather.wet);
    this.focus.copy(P.pos); rig.update(dt, this.focus, null);
    if (c) { if (this.carry) { c.ac.pos = [P.pos.x, P.pos.y + 0.034 - c.ac.lowestY * 0.2, P.pos.z]; c.mesh.position.set(...c.ac.pos); c.mesh.rotation.set(0, Math.PI / 2 - (Math.PI / 2 - P.yaw) + Math.PI / 2 - Math.PI / 2, 0); c.mesh.rotation.y = P.yaw - Math.PI / 2; }
      else if (!c.ac.asleep) { c.ac.update(dt * TIME_SCALE, { pitch: 0, roll: 0, yaw: 0, throttle: 0, assist: 0 }, this.env); c.sync(dt); }
      else c.ac.soak(dt * TIME_SCALE, Math.hypot(c.ac.pos[0] - HUT.x, c.ac.pos[2] - HUT.z) < 0.5 ? 0 : this.weather.rain); }   // left out in the rain (the hut and awning keep it dry)
    // interactions
    let prompt = null, act = null;
    if (this.carry) { const site = Object.entries(SITES).find(([, s]) => Math.hypot(P.pos.x - s.pos[0], P.pos.z - s.pos[2]) < 0.45);
      prompt = site ? `E — mount on the ${site[1].name}` : 'E — set the prototype down'; act = () => { this.carry = false; P.carrying = false; this.audio.play('wood');
        if (site) this.beginFlight(site[0]); else { const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw); c.place(P.pos.x + fx * 0.1, P.pos.z + fz * 0.1, Math.atan2(fx, -fz)); } }; }
    else {
      if (c) { const d = Math.hypot(P.pos.x - c.ac.pos[0], P.pos.z - c.ac.pos[2]); if (d < 0.16) { prompt = `E — ${c.bp.name}`; act = () => this.modal(() => pan.craftMenu(c, (a) => this.craftAction(a))); } }
      if (!prompt) for (const s of this.struct.stations) if (Math.hypot(P.pos.x - s.x, P.pos.z - s.z) < 0.085) { prompt = `E — ${s.label}: ${s.hint}`; act = () => { this.audio.play('click'); if (s.id === 'bench') this.transition(() => this.openWorkshop()); else if (s.id === 'board') this.modal(() => pan.timeline()); else this.modal(() => pan.journal()); }; break; }
    }
    pan.setPrompt(prompt); if (act && inp.pressed('KeyE', 'Enter')) act();
    if (inp.pressed('Tab')) this.modal(() => pan.journal());
  }

  fly(dt, inp) {
    const s = this.session, c = this.craft, ac = c.ac, rig = this.rig; rig.input(inp);
    if (inp.pressed('KeyC')) { rig.mode = rig.mode === 'chase' ? 'cockpit' : 'chase'; c.setPilot(rig.mode === 'chase'); }
    s.update(dt, inp); if (this.state !== 'fly') return;
    this.hpr = hprFromQ(ac.q);
    // hoops
    for (let i = 0; i < HOOPS.length; i++) if (!this.hoops.has(i) && hoopCrossed(HOOPS[i], this.prevPos, ac.pos)) { this.hoops.add(i); this.audio.play('hoop'); this.toast(`Hoop ${this.hoops.size} of 4`, 'good'); this.updateObjective(); }
    this.prevPos = ac.pos.slice();
    const e = ac.engines[0]; if (e) this.audio.updateEngine(e.rpm * (0.75 + 0.5 * Math.min(1, ac.airspeed / e.spec.vPitch)), e.level, rig.mode === 'cockpit' ? 1.3 : 1);
    this.focus.set(ac.pos[0], ac.pos[1], ac.pos[2]); rig.update(dt, this.focus, c.mesh.quaternion, ac.airspeed * TIME_SCALE);
    this.panels.setPrompt(null);
    if (inp.pressed('Enter') && s.canEnd) { if (s.everAir) s.finish(); else { this.endSession(true); this.state = 'explore'; } }
    else if (inp.pressed('Backspace')) { this.toast('Flight abandoned'); const t = this.trial; ac.repair(); this.session = null; this.trial = t; this.beginFlight(this.siteKey === 'here' ? c.bp.launch : this.siteKey); }
  }
}

window.__game = new Game();
