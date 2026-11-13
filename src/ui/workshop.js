// The engineering workshop: a live, editable blueprint with physics-derived read-outs.
// Nothing here is cosmetic: every slider edits the blueprint that the flight model is built from.
import * as THREE from 'three';
import { Aircraft } from '../sim/flightModel.js';
import { TEMPLATES, PART_SCHEMA, PART_DEFAULTS, cloneBlueprint, sanitizeBlueprint, partLabel, newId } from '../sim/blueprint.js';
import { MATERIALS, ENGINES, AIRFOILS, FUSELAGE_KINDS } from '../sim/catalog.js';
import { buildAircraftMesh, updateAircraftMesh, disposeAircraftMesh } from '../gfx/aircraftMesh.js';
import { Mat, T } from '../gfx/textures.js';
import { h, fmt, btn } from './dom.js';

const mm = (v) => Math.round(v * 1000);
export class Workshop {
  constructor(game) {
    this.game = game; this.open = false; this.adv = false; this.undo = []; this.redo = []; this.sel = null; this.model = null;
    // ---- bench scene for the orbiting inspection view
    const s = this.scene = new THREE.Scene(); s.background = new THREE.Color(0x2b2218); s.fog = new THREE.Fog(0x2b2218, 0.9, 2.2);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.02, 40), new THREE.MeshStandardMaterial({ map: T.wood('mid'), roughness: 0.8 })); top.position.y = -0.011; top.receiveShadow = true; s.add(top);
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.32), new THREE.MeshStandardMaterial({ map: T.blueprint(), roughness: 0.95 })); sheet.rotation.x = -Math.PI / 2; sheet.position.y = 0.0005; sheet.receiveShadow = true; s.add(sheet);
    s.add(new THREE.HemisphereLight(0xfff0d8, 0x4a3a28, 1.3));
    const key = new THREE.DirectionalLight(0xffe2b4, 3); key.position.set(0.5, 0.9, 0.4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -0.3, right: 0.3, top: 0.3, bottom: -0.3, near: 0.1, far: 3 }); key.shadow.bias = -0.0005; s.add(key);
    const fill = new THREE.PointLight(0xffa860, 0.3, 2); fill.position.set(-0.4, 0.3, -0.3); s.add(fill);
    this.holder = new THREE.Group(); this.holder.position.y = 0.075; s.add(this.holder);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.012, 0.07, 8), Mat.wood('dark')); stand.position.y = 0.035; s.add(stand);
    const ball = (hex) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.0026, 12, 8), new THREE.MeshBasicMaterial({ color: hex, depthTest: false })); m.renderOrder = 9; return m; };
    this.cgBall = ball(0xffd21f); this.npBall = ball(0x38a8ff); this.holder.add(this.cgBall, this.npBall);
    this.selBox = new THREE.BoxHelper(new THREE.Object3D(), 0xffe08a); this.selBox.visible = false; s.add(this.selBox);
    this.focus = new THREE.Vector3(0, 0.075, 0);
    this.el = h('div.ws.hidden'); game.ui.append(this.el);
    this.ray = new THREE.Raycaster(); this.ray.params.Line = { threshold: 0.002 };
    let downAt = null; const cv = game.canvas;
    cv.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
    cv.addEventListener('pointerup', (e) => { if (!this.open || !downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return; this.pick(e.clientX, e.clientY); });
  }
  pick(x, y) {
    const r = this.game.canvas.getBoundingClientRect(), v = new THREE.Vector2((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1);
    this.ray.setFromCamera(v, this.game.camera); const hit = this.ray.intersectObject(this.model, true)[0]; if (!hit) return;
    let o = hit.object; while (o && !o.userData.partId) o = o.parent; if (o) { this.sel = o.userData.partId; this.game.audio.play('click'); this.render(); }
  }
  show(bp) {
    this.open = true; this.el.classList.remove('hidden'); this.bp = JSON.parse(JSON.stringify(bp)); this.undo = []; this.redo = []; this.sel = (this.bp.parts.find((p) => p.type === 'surface') || this.bp.parts[0]).id;
    this.rebuild(); this.game.audio.play('page');
  }
  hide() { this.open = false; this.el.classList.add('hidden'); }
  snapshot() { this.undo.push(JSON.stringify(this.bp)); if (this.undo.length > 60) this.undo.shift(); this.redo = []; }
  change(fn, sound = 'wood') { this.snapshot(); fn(); this.bp.historical = false; this.rebuild(); this.game.audio.play(sound); }
  step(from, to) { if (!from.length) return; to.push(JSON.stringify(this.bp)); this.bp = JSON.parse(from.pop()); if (!this.bp.parts.some((p) => p.id === this.sel)) this.sel = this.bp.parts[0].id; this.rebuild(); this.game.audio.play('page'); }

  rebuild() {
    this.ac = new Aircraft(this.bp); this.an = this.ac.analyze();
    if (this.model) { this.holder.remove(this.model); disposeAircraftMesh(this.model); }
    this.model = buildAircraftMesh(this.bp, this.ac.cg, { showPilot: true }); this.holder.add(this.model);
    const an = this.an; this.cgBall.position.set(0, 0, 0); this.npBall.visible = an.npX != null; if (an.npX != null) this.npBall.position.set(-(an.npX - an.cgX), 0, 0);
    this.render();
  }
  tick(dt) { // gentle demo of the controls so you can see which surface does what
    if (!this.model) return; const t = performance.now() / 1000;
    this.ac.ctrl = { pitch: Math.sin(t * 1.3) * 0.7, roll: Math.sin(t * 0.9 + 1) * 0.7, yaw: Math.sin(t * 1.1 + 2) * 0.7 }; updateAircraftMesh(this.model, this.ac, dt);
    const g = this.model.userData.parts.get(this.sel); if (g && g.children.length) { this.selBox.setFromObject(g); this.selBox.visible = true; } else this.selBox.visible = false;
  }

  // ------------------------------------------------------------ UI
  render() {
    const g = this.game, U = g.unlocks, bp = this.bp, an = this.an, sel = bp.parts.find((p) => p.id === this.sel) || bp.parts[0];
    const el = this.el; el.innerHTML = '';
    const tplSel = h('select', { onchange: (e) => { const k = e.target.value; if (!k) return; this.snapshot(); const c = cloneBlueprint(TEMPLATES[k]); c.historical = TEMPLATES[k].historical; this.bp = c; this.sel = c.parts[1]?.id || c.parts[0].id; this.rebuild(); g.audio.play('paper'); } },
      h('option', { value: '' }, 'Start from a template…'), U.templates.map((k) => h('option', { value: k }, (TEMPLATES[k].year ? TEMPLATES[k].year + ' · ' : '') + TEMPLATES[k].name)));
    const saved = g.save.blueprints;
    const loadSel = h('select', { onchange: (e) => { const b = saved.find((x) => x.id === e.target.value); if (!b) return; this.snapshot(); this.bp = JSON.parse(JSON.stringify(b)); delete this.bp.revisions; this.sel = this.bp.parts[0].id; this.rebuild(); } }, h('option', { value: '' }, `Saved designs (${saved.length})…`), saved.map((b) => h('option', { value: b.id }, b.name)));
    const cur = saved.find((b) => b.id === bp.id), revs = cur ? cur.revisions || [] : [];
    const revSel = h('select', { disabled: !revs.length, onchange: (e) => { const r = revs[+e.target.value]; if (!r) return; this.change(() => { this.bp.parts = JSON.parse(JSON.stringify(r.parts)); this.bp.trim = r.trim || 0; this.sel = this.bp.parts[0].id; }, 'page'); } }, h('option', { value: '' }, `Revisions (${revs.length})…`), revs.map((r, i) => h('option', { value: i }, `#${revs.length - i} · ${r.note}`)));
    el.append(h('div.ws-top.paper',
      h('input.ws-name', { value: bp.name, maxlength: 40, onchange: (e) => { bp.name = e.target.value || 'Untitled'; } }), tplSel, loadSel, revSel,
      btn('Undo', () => this.step(this.undo, this.redo), this.undo.length ? '' : 'dim'), btn('Redo', () => this.step(this.redo, this.undo), this.redo.length ? '' : 'dim'),
      btn(this.adv ? 'Engineering mode' : 'Simple mode', () => { this.adv = !this.adv; this.render(); }, 'toggle'),
      btn('Save', () => { g.saveBlueprint(this.bp, 'Saved at the bench'); g.toast('Blueprint saved'); this.render(); }),
      btn('Copy / paste code', () => this.codeDialog()), btn('Close', () => g.closeWorkshop(), 'quiet')));

    // parts list
    const canAdd = (k) => (k === 'engine' ? U.engines.length > 0 : k === 'gear' ? U.gear : true);
    const add = (k, label) => btn('+ ' + label, () => this.change(() => { const p = { ...PART_DEFAULTS[k](), id: newId() };
      if (p.type === 'engine') p.kind = U.engines[0]; if (p.material && !U.materials.includes(p.material)) p.material = U.materials[0];
      const fus = bp.parts.find((q) => q.type === 'fuselage'); if (fus && 'x' in p && p.x > fus.length) p.x = fus.length * 0.8;
      if (k === 'wing') { const n = bp.parts.filter((q) => q.type === 'surface' && q.role === 'wing').length; p.y = n * 0.024; }
      bp.parts.push(p); this.sel = p.id; }), canAdd(k) ? 'small' : 'small.locked');
    el.append(h('div.ws-left.paper', h('h3', 'Parts'),
      h('div.parts', bp.parts.map((p) => h('div.part' + (p.id === sel.id ? '.on' : ''), { onclick: () => { this.sel = p.id; this.render(); g.audio.play('click'); } },
        h('b', partLabel(p)), h('span', p.material ? MATERIALS[p.material].name : p.type === 'ballast' ? fmt(p.mass * 1000, 1, ' g') : '')))),
      h('h3', 'Add'), h('div.adds', add('wing', 'Wing'), add('stab', 'Tailplane'), add('canard', 'Foreplane'), add('fin', 'Fin'), add('engine', 'Engine'), add('gear', 'Gear'), add('ballast', 'Ballast')),
      h('div.legend', h('i.dot.cg'), 'centre of mass ', h('i.dot.np'), 'neutral point')));

    // selected part properties
    const sch = PART_SCHEMA[sel.type], rows = [];
    for (const [k, f] of Object.entries(sch.fields)) {
      if (f.adv && !this.adv) continue; if (f.onlyVertical && !sel.vertical) continue;
      if (sel.vertical && ['dihedral', 'incidence', 'braced'].includes(k)) continue;
      if (k === 'braced' && !U.bracing) continue; if (k === 'role') continue;
      if (f.type === 'num') {
        const disp = (v) => f.unit === 'mm' ? mm(v) + ' mm' : f.unit === 'g' ? (v * 1000).toFixed(1) + ' g' : f.unit === 'deg' ? v + '°' : v.toFixed(2);
        const out = h('output', disp(sel[k]));
        rows.push(h('label.row', h('span', f.label), h('input', { type: 'range', min: f.min, max: f.max, step: this.adv ? f.step : f.step * 2, value: sel[k],
          oninput: (e) => { out.textContent = disp(+e.target.value); }, onchange: (e) => this.change(() => { sel[k] = +e.target.value; }, sel.material && MATERIALS[sel.material].look === 'paper' ? 'paper' : 'wood') }), out));
      } else if (f.type === 'bool') rows.push(h('label.row.chk', h('span', f.label), h('input', { type: 'checkbox', checked: !!sel[k], onchange: (e) => this.change(() => { sel[k] = e.target.checked; }, 'metal') })));
      else {
        let opts = Object.entries(f.options);
        if (k === 'material') opts = opts.filter(([id]) => U.materials.includes(id) || id === sel[k]);
        if (k === 'kind' && sel.type === 'engine') opts = opts.filter(([id]) => U.engines.includes(id) || id === sel[k]);
        if (k === 'control') opts = opts.filter(([id]) => (sel.vertical ? ['none', 'rudder'] : ['none', 'elevator', 'aileron', 'warp', 'elevon']).includes(id));
        rows.push(h('label.row', h('span', f.label), h('select', { onchange: (e) => this.change(() => { sel[k] = e.target.value; }, k === 'material' ? 'paper' : 'gears') }, opts.map(([id, o]) => h('option', { value: id, selected: id === sel[k] }, o.name)))));
      }
    }
    const note = sel.material ? MATERIALS[sel.material].note : sel.type === 'engine' ? ENGINES[sel.kind].note : '';
    const note2 = sel.airfoil ? AIRFOILS[sel.airfoil].note : sel.type === 'fuselage' ? FUSELAGE_KINDS[sel.kind].note : '';
    const fixed = sel.type === 'fuselage' || sel.type === 'pilot';
    el.append(h('div.ws-right.paper', h('h3', partLabel(sel)), rows, note && h('p.note', note), note2 && h('p.note', note2),
      sel.type === 'engine' && h('p.note.data', `${(ENGINES[sel.kind].mass * 1000).toFixed(1)} g · ${(ENGINES[sel.kind].thrust * 1000).toFixed(0)} mN static · ${ENGINES[sel.kind].endurance} s · throttle: ${ENGINES[sel.kind].throttle}`),
      h('div.rowbtns', btn('Duplicate', () => this.change(() => { const c = { ...JSON.parse(JSON.stringify(sel)), id: newId() }; if ('y' in c) c.y += 0.024; bp.parts.push(c); this.sel = c.id; }), fixed ? 'small.locked' : 'small'),
        btn('Remove', () => this.change(() => { bp.parts = bp.parts.filter((p) => p !== sel); this.sel = bp.parts[0].id; }, 'snap'), fixed ? 'small.locked' : 'small'))));

    // read-outs
    const sm = an.staticMargin, smPct = sm == null ? null : sm * 100;
    const stat = (label, val, cls = '') => h('div.stat' + (cls ? '.' + cls : ''), h('span', label), h('b', val));
    const gauge = h('div.gauge', h('div.zone'), sm != null && h('div.needle', { style: `left:${Math.max(0, Math.min(100, 50 + smPct * 1.6))}%` }));
    el.append(h('div.ws-bottom.paper',
      h('div.stats',
        stat('Mass', fmt(an.mass * 1000, 2, ' g')), stat('Wing area', fmt(an.wingArea * 1e4, 0, ' cm²')), stat('Wing loading', fmt(an.wingLoading, 2, ' kg/m²'), an.wingLoading > 2.2 ? 'warn' : ''),
        stat('Stall speed', fmt(an.stallSpeed, 1, ' m/s')), stat('Trim speed', fmt(an.trimSpeed, 1, ' m/s'), an.trimSpeed == null ? 'warn' : ''), stat('Glide ratio', an.trimGlide ? fmt(an.trimGlide, 1, ' : 1') : fmt(an.bestGlide, 1, ' best')),
        stat('Wing strength', an.gLimit > 50 ? '50+ g' : fmt(an.gLimit, 1, ' g'), an.gLimit < 3 ? 'warn' : ''),
        this.ac.engines.length ? [stat('Thrust / weight', fmt(an.thrustToWeight, 2)), stat('Top speed', fmt(an.maxSpeed, 1, ' m/s'), an.maxSpeed == null ? 'bad' : ''), stat('Climb', fmt(an.climb, 2, ' m/s'), an.climb != null && an.climb < 0.1 ? 'warn' : ''), stat('Endurance', fmt(an.endurance, 0, ' s'))] : stat('Power', 'glider')),
      h('div.balance', h('span', 'Pitch stability'), gauge, h('b' + (sm < 0 ? '.bad' : sm < 0.05 ? '.warn' : ''), sm == null ? 'no wing' : (sm < 0 ? 'unstable ' : 'stable ') + smPct.toFixed(0) + '% chord'),
        h('label.trim', 'Pitch trim', h('input', { type: 'range', min: -1, max: 1, step: 0.05, value: bp.trim || 0, onchange: (e) => this.change(() => { bp.trim = +e.target.value; }, 'click') }))),
      h('div.warns', an.warnings.length ? an.warnings.map((w) => h('div.w.' + w.lvl, w.msg)) : h('div.w.good', 'No engineering concerns. Only a test flight will tell.')),
      h('div.build', h('label', 'Launch from ', h('select', { onchange: (e) => { bp.launch = e.target.value; } }, [['hill', 'Glider Hill catapult'], ['rail', 'Launch rail'], ['runway', 'Grass runway']].map(([k, n]) => h('option', { value: k, selected: bp.launch === k }, n)))),
        btn('Build prototype', () => g.buildPrototype(this.bp), 'primary'))));
  }
  codeDialog() {
    const ta = h('textarea', { rows: 8 }, JSON.stringify(this.bp));
    const d = h('div.modal', h('div.paper.dialog', h('h3', 'Blueprint code'), h('p', 'Copy this text to keep or share a design. Paste one here and press Load.'), ta,
      h('div.rowbtns', btn('Load', () => { let b = null; try { b = sanitizeBlueprint(JSON.parse(ta.value)); } catch {} if (!b) { this.game.toast('That is not a readable blueprint', 'bad'); return; } this.snapshot(); b.id = newId(); this.bp = b; this.sel = b.parts[0].id; d.remove(); this.rebuild(); }), btn('Close', () => d.remove(), 'quiet'))));
    this.game.ui.append(d);
  }
}
