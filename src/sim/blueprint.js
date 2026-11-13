// Blueprints: plain serialisable descriptions of an aircraft as a list of parts.
// The SAME data drives the physics model (flightModel.js) and the 3D model (aircraftMesh.js).
// Positions: x = metres aft of the nose datum, y = metres above the fuselage centreline, z = lateral.
import { MATERIALS, AIRFOILS, ENGINES, FUSELAGE_KINDS } from './catalog.js';

export const BLUEPRINT_VERSION = 2;
let uid = 1;
export const newId = () => 'p' + Date.now().toString(36) + (uid++).toString(36);

// Parameter schema used by the workshop UI and by validation. [min, max, step, unit, label, advanced?]
export const PART_SCHEMA = {
  fuselage: {
    label: 'Fuselage',
    fields: {
      kind: { type: 'enum', options: FUSELAGE_KINDS, label: 'Structure' },
      material: { type: 'enum', options: MATERIALS, label: 'Material' },
      length: { type: 'num', min: 0.06, max: 0.4, step: 0.005, unit: 'mm', label: 'Length' },
      width: { type: 'num', min: 0.003, max: 0.04, step: 0.001, unit: 'mm', label: 'Width', adv: true },
      height: { type: 'num', min: 0.004, max: 0.05, step: 0.001, unit: 'mm', label: 'Height', adv: true },
    },
  },
  surface: {
    label: 'Flying surface',
    fields: {
      role: { type: 'enum', options: { wing: { name: 'Wing' }, stab: { name: 'Tailplane' }, canard: { name: 'Foreplane' }, fin: { name: 'Fin' } }, label: 'Role' },
      material: { type: 'enum', options: MATERIALS, label: 'Material' },
      airfoil: { type: 'enum', options: AIRFOILS, label: 'Section' },
      x: { type: 'num', min: -0.03, max: 0.4, step: 0.0025, unit: 'mm', label: 'Position aft of nose' },
      y: { type: 'num', min: -0.05, max: 0.07, step: 0.001, unit: 'mm', label: 'Height' },
      span: { type: 'num', min: 0.015, max: 0.5, step: 0.005, unit: 'mm', label: 'Span' },
      chord: { type: 'num', min: 0.008, max: 0.25, step: 0.001, unit: 'mm', label: 'Root chord' },
      taper: { type: 'num', min: 0.05, max: 1.3, step: 0.05, unit: '', label: 'Taper (tip / root)', adv: true },
      sweep: { type: 'num', min: -20, max: 75, step: 1, unit: 'deg', label: 'Sweep', adv: true },
      dihedral: { type: 'num', min: -10, max: 25, step: 0.5, unit: 'deg', label: 'Dihedral', adv: true },
      incidence: { type: 'num', min: -6, max: 8, step: 0.25, unit: 'deg', label: 'Incidence' },
      control: { type: 'enum', options: { none: { name: 'Fixed' }, elevator: { name: 'Elevator (pitch)' }, aileron: { name: 'Ailerons (roll)' }, warp: { name: 'Wing warping (roll)' }, elevon: { name: 'Elevons (pitch + roll)' }, rudder: { name: 'Rudder (yaw)' } }, label: 'Control' },
      ctrlFrac: { type: 'num', min: 0.1, max: 1, step: 0.05, unit: '', label: 'Control size (chord fraction)', adv: true },
      braced: { type: 'bool', label: 'Struts & bracing wires' },
      twin: { type: 'num', min: 0, max: 0.08, step: 0.002, unit: 'mm', label: 'Twin fin spacing', adv: true, onlyVertical: true },
    },
  },
  engine: {
    label: 'Propulsion',
    fields: {
      kind: { type: 'enum', options: ENGINES, label: 'Type' },
      x: { type: 'num', min: -0.02, max: 0.4, step: 0.0025, unit: 'mm', label: 'Position aft of nose' },
      y: { type: 'num', min: -0.03, max: 0.06, step: 0.001, unit: 'mm', label: 'Height' },
      pusher: { type: 'bool', label: 'Pusher (prop behind)' },
    },
  },
  gear: {
    label: 'Landing gear',
    fields: {
      kind: { type: 'enum', options: { wheels: { name: 'Wheels + tail skid' }, skids: { name: 'Twin skids' } }, label: 'Type' },
      x: { type: 'num', min: 0, max: 0.3, step: 0.0025, unit: 'mm', label: 'Position aft of nose' },
      track: { type: 'num', min: 0.01, max: 0.12, step: 0.002, unit: 'mm', label: 'Track width', adv: true },
      height: { type: 'num', min: 0.004, max: 0.04, step: 0.001, unit: 'mm', label: 'Leg height', adv: true },
    },
  },
  ballast: {
    label: 'Ballast',
    fields: {
      mass: { type: 'num', min: 0.0002, max: 0.01, step: 0.0002, unit: 'g', label: 'Mass' },
      x: { type: 'num', min: -0.02, max: 0.4, step: 0.0025, unit: 'mm', label: 'Position aft of nose' },
    },
  },
  pilot: {
    label: 'Pilot seat',
    fields: {
      x: { type: 'num', min: 0, max: 0.35, step: 0.0025, unit: 'mm', label: 'Position aft of nose' },
      y: { type: 'num', min: -0.01, max: 0.04, step: 0.001, unit: 'mm', label: 'Height', adv: true },
      pose: { type: 'enum', options: { seated: { name: 'Seated' }, prone: { name: 'Prone (lying)' } }, label: 'Pose' },
    },
  },
};

const S = (o) => ({ type: 'surface', role: 'wing', material: 'card', airfoil: 'flat', x: 0.04, y: 0, span: 0.18, chord: 0.05, taper: 1, sweep: 0, dihedral: 0, incidence: 0, control: 'none', ctrlFrac: 0.3, braced: false, vertical: false, twin: 0, ...o });
const FIN = (o) => S({ role: 'fin', vertical: true, control: 'rudder', ctrlFrac: 0.4, ...o });

export const PART_DEFAULTS = {
  fuselage: () => ({ type: 'fuselage', kind: 'keel', material: 'card', length: 0.16, width: 0.006, height: 0.012 }),
  wing: () => S({}),
  stab: () => S({ role: 'stab', x: 0.13, span: 0.07, chord: 0.028, control: 'elevator', ctrlFrac: 0.4 }),
  canard: () => S({ role: 'canard', x: 0.0, span: 0.07, chord: 0.02, control: 'elevator', ctrlFrac: 0.5, incidence: 2 }),
  fin: () => FIN({ x: 0.13, span: 0.03, chord: 0.028 }),
  engine: () => ({ type: 'engine', kind: 'rubber', x: 0, y: 0, pusher: false }),
  gear: () => ({ type: 'gear', kind: 'wheels', x: 0.03, track: 0.04, height: 0.014 }),
  ballast: () => ({ type: 'ballast', mass: 0.001, x: 0.005 }),
  pilot: () => ({ type: 'pilot', x: 0.05, y: 0.006, pose: 'seated' }),
};

function bp(name, o, parts) {
  return { v: BLUEPRINT_VERSION, id: o.id, name, era: o.era ?? 0, year: o.year ?? '', launch: o.launch || 'hill', historical: !!o.historical,
    paint: o.paint || null, trim: o.trim || 0, desc: o.desc || '', parts: parts.map((p, i) => ({ id: o.id + '_' + i, ...p })) };
}

export const TEMPLATES = {
  card_glider: bp('Cereal-Box Glider', { id: 'card_glider', era: 0, launch: 'hill', desc: 'A cardboard glider with a paper-clip nose weight. Simple, forgiving, and yours to improve.' }, [
    { type: 'fuselage', kind: 'keel', material: 'card', length: 0.16, width: 0.005, height: 0.014 },
    S({ x: 0.042, y: 0.007, span: 0.2, chord: 0.055, taper: 0.75, sweep: 4, dihedral: 7, incidence: 2, airfoil: 'cambered', material: 'card' }),
    S({ role: 'stab', x: 0.13, y: 0.004, span: 0.08, chord: 0.03, taper: 0.8, incidence: 1, control: 'elevator', ctrlFrac: 0.4 }),
    FIN({ x: 0.132, y: 0.004, span: 0.034, chord: 0.028, taper: 0.7 }),
    { type: 'ballast', mass: 0.0014, x: 0.004 },
    { type: 'pilot', x: 0.05, y: 0.009, pose: 'prone' },
  ]),
  paper_dart: bp('Paper Dart', { id: 'paper_dart', era: 0, launch: 'hill', desc: 'The classic folded dart. Fast, slippery, and floppy when pushed hard.' }, [
    { type: 'fuselage', kind: 'keel', material: 'paper', length: 0.2, width: 0.004, height: 0.022 },
    S({ x: 0.008, y: 0.01, span: 0.13, chord: 0.185, taper: 0.06, sweep: 69.5, dihedral: 6, incidence: 0, airfoil: 'reflex', material: 'paper', control: 'elevon', ctrlFrac: 0.15 }),
    FIN({ x: 0.13, y: -0.03, span: 0.028, chord: 0.07, taper: 0.8, material: 'paper', control: 'none' }),
    { type: 'pilot', x: 0.065, y: 0.012, pose: 'prone' },
  ]),
  hill_glider: bp('1894 Hill Glider', { id: 'hill_glider', era: 0, year: 1894, launch: 'hill', historical: true, desc: 'Willow, cotton and courage: a bat-winged glider in the spirit of the 1890s hill flights.' }, [
    { type: 'fuselage', kind: 'truss', material: 'fabric', length: 0.14, width: 0.006, height: 0.01 },
    S({ x: 0.05, y: 0.006, span: 0.21, chord: 0.062, taper: 0.55, sweep: 6, dihedral: 5, incidence: 2, airfoil: 'deep', material: 'fabric', braced: true }),
    S({ role: 'stab', x: 0.112, y: 0.004, span: 0.075, chord: 0.03, taper: 0.7, incidence: -3.5, material: 'fabric', control: 'elevator', ctrlFrac: 0.3 }),
    FIN({ x: 0.112, y: 0.004, span: 0.035, chord: 0.028, taper: 0.7, material: 'fabric', ctrlFrac: 0.3 }),
    { type: 'pilot', x: 0.022, y: -0.004, pose: 'seated' },
  ]),
  wright_1903: bp('1903 Pioneer Flyer', { id: 'wright_1903', era: 1, year: 1903, launch: 'rail', historical: true, desc: 'A canard biplane of spruce and muslin with wing-warping and twin pusher propellers. Barely enough power, barely stable — and it flies.' }, [
    { type: 'fuselage', kind: 'truss', material: 'fabric', length: 0.19, width: 0.012, height: 0.018 },
    S({ role: 'canard', x: 0.0, y: 0.004, span: 0.095, chord: 0.024, incidence: 1, airfoil: 'cambered', material: 'fabric', control: 'elevator', ctrlFrac: 0.9 }),
    S({ x: 0.07, y: -0.004, span: 0.2, chord: 0.032, dihedral: -1, incidence: 3, airfoil: 'deep', material: 'fabric', braced: true, control: 'warp', ctrlFrac: 0.3 }),
    S({ x: 0.07, y: 0.026, span: 0.2, chord: 0.032, dihedral: -1, incidence: 3, airfoil: 'deep', material: 'fabric', braced: true, control: 'warp', ctrlFrac: 0.3 }),
    FIN({ x: 0.168, y: -0.002, span: 0.03, chord: 0.014, material: 'fabric', twin: 0.012, ctrlFrac: 0.9 }),
    { type: 'engine', kind: 'wright', x: 0.06, y: 0.008, pusher: true },
    { type: 'gear', kind: 'skids', x: 0.06, track: 0.04, height: 0.008 },
    { type: 'pilot', x: 0.05, y: 0.0, pose: 'prone' },
  ]),
  scout_1917: bp('1917 Rotary Scout', { id: 'scout_1917', era: 2, year: 1917, launch: 'runway', historical: true, paint: 'raf', desc: 'A wire-braced tractor biplane with a spinning rotary engine. Quick, twitchy, and it turns far better one way than the other.' }, [
    { type: 'fuselage', kind: 'box', material: 'fabric', length: 0.108, width: 0.014, height: 0.016 },
    S({ x: 0.018, y: 0.021, span: 0.15, chord: 0.027, dihedral: 0, incidence: 2, airfoil: 'cambered', material: 'fabric', braced: true, control: 'aileron', ctrlFrac: 0.25 }),
    S({ x: 0.026, y: -0.005, span: 0.15, chord: 0.027, dihedral: 3, incidence: 2, airfoil: 'cambered', material: 'fabric', braced: true, control: 'aileron', ctrlFrac: 0.25 }),
    S({ role: 'stab', x: 0.088, y: 0.004, span: 0.052, chord: 0.02, taper: 0.8, incidence: -3, material: 'fabric', control: 'elevator', ctrlFrac: 0.45 }),
    FIN({ x: 0.09, y: 0.004, span: 0.022, chord: 0.018, taper: 0.7, material: 'fabric', ctrlFrac: 0.55 }),
    { type: 'engine', kind: 'rotary', x: 0.0, y: 0.0, pusher: false },
    { type: 'gear', kind: 'wheels', x: 0.02, track: 0.036, height: 0.017 },
    { type: 'pilot', x: 0.046, y: 0.006, pose: 'seated' },
  ]),
  racer_1935: bp('1935 Metal Racer', { id: 'racer_1935', era: 3, year: 1935, launch: 'runway', paint: 'racer', desc: 'A stressed-skin aluminium monoplane with a big inline engine. Fast, heavy on its wing, unforgiving when slow.' }, [
    { type: 'fuselage', kind: 'tube', material: 'aluminum', length: 0.125, width: 0.013, height: 0.015 },
    S({ x: 0.03, y: -0.004, span: 0.17, chord: 0.036, taper: 0.5, sweep: 4, dihedral: 5, incidence: 1.5, airfoil: 'cambered', material: 'aluminum', control: 'aileron', ctrlFrac: 0.25 }),
    S({ role: 'stab', x: 0.103, y: 0.003, span: 0.06, chord: 0.022, taper: 0.6, incidence: -1.5, material: 'aluminum', airfoil: 'flat', control: 'elevator', ctrlFrac: 0.4 }),
    FIN({ x: 0.103, y: 0.004, span: 0.026, chord: 0.022, taper: 0.5, material: 'aluminum' }),
    { type: 'engine', kind: 'inline', x: 0.0, y: 0.0, pusher: false },
    { type: 'gear', kind: 'wheels', x: 0.03, track: 0.04, height: 0.015 },
    { type: 'pilot', x: 0.055, y: 0.006, pose: 'seated' },
  ]),
  blank: bp('Untitled Invention', { id: 'blank', era: 0, launch: 'hill', desc: 'An empty bench. Start with a spine and see what happens.' }, [
    { type: 'fuselage', kind: 'keel', material: 'card', length: 0.15, width: 0.005, height: 0.012 },
    { type: 'pilot', x: 0.05, y: 0.008, pose: 'seated' },
  ]),
};

export function cloneBlueprint(b, rename) {
  const c = JSON.parse(JSON.stringify(b));
  c.id = newId();
  c.parts.forEach((p) => { p.id = newId(); });
  if (rename) c.name = rename;
  c.historical = false;
  return c;
}

// Version-aware loading: fill defaults, clamp to schema, drop junk. Never throws.
export function sanitizeBlueprint(raw) {
  try {
    if (!raw || !Array.isArray(raw.parts)) return null;
    const out = { v: BLUEPRINT_VERSION, id: String(raw.id || newId()), name: String(raw.name || 'Recovered design').slice(0, 40), era: raw.era | 0,
      year: raw.year || '', launch: ['hill', 'rail', 'runway'].includes(raw.launch) ? raw.launch : 'hill', historical: !!raw.historical, paint: raw.paint || null, trim: Math.max(-1, Math.min(1, Number(raw.trim) || 0)), desc: String(raw.desc || ''), parts: [] };
    for (const p of raw.parts) {
      const sch = PART_SCHEMA[p.type];
      if (!sch) continue;
      const defKey = p.type === 'surface' ? (p.vertical ? 'fin' : 'wing') : p.type;
      const q = { ...PART_DEFAULTS[defKey](), id: String(p.id || newId()) };
      if (p.type === 'surface') q.vertical = !!p.vertical;
      for (const [k, f] of Object.entries(sch.fields)) {
        if (!(k in p)) continue;
        if (f.type === 'num') { const n = Number(p[k]); if (Number.isFinite(n)) q[k] = Math.min(f.max, Math.max(f.min, n)); }
        else if (f.type === 'bool') q[k] = !!p[k];
        else if (f.type === 'enum' && p[k] in f.options) q[k] = p[k];
      }
      out.parts.push(q);
    }
    if (!out.parts.some((p) => p.type === 'fuselage')) out.parts.unshift({ ...PART_DEFAULTS.fuselage(), id: newId() });
    if (!out.parts.some((p) => p.type === 'pilot')) out.parts.push({ ...PART_DEFAULTS.pilot(), id: newId() });
    return out;
  } catch { return null; }
}

export function partLabel(p) {
  if (p.type === 'surface') return ({ wing: 'Wing', stab: 'Tailplane', canard: 'Foreplane', fin: 'Fin' })[p.role] || 'Surface';
  if (p.type === 'engine') return ENGINES[p.kind].name;
  return PART_SCHEMA[p.type].label;
}
