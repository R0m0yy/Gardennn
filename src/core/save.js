// Versioned, corruption-tolerant persistence in localStorage.
import { sanitizeBlueprint } from '../sim/blueprint.js';
const KEY = 'evolution-garden-wars', VERSION = 3;
export const defaults = () => ({
  v: VERSION,
  settings: { quality: 'medium', flightModel: 'accessible', master: 0.7, music: 0.5, invertPitch: false, dayMinutes: 24, bloom: true, lens: true, hints: true },
  progress: { step: 0, trials: {}, bestGlide: 0, flights: 0 },
  mode: 'journey',
  blueprints: [],           // [{...blueprint, revisions:[{t, note, parts, trim}]}]
  activeId: null,
  journal: [],              // newest first
  player: null, hour: 8.6,
});
export function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); if (!raw) return defaults(); const d = JSON.parse(raw), out = defaults();
    if (typeof d !== 'object' || !d) throw new Error('not an object');
    Object.assign(out.settings, d.settings || {}); Object.assign(out.progress, d.progress || {});
    out.mode = ['journey', 'sandbox'].includes(d.mode) ? d.mode : 'journey';
    out.blueprints = (Array.isArray(d.blueprints) ? d.blueprints : []).map((b) => { const s = sanitizeBlueprint(b); if (s) s.revisions = Array.isArray(b.revisions) ? b.revisions.slice(0, 12).filter((r) => r && Array.isArray(r.parts)) : []; return s; }).filter(Boolean);
    out.activeId = out.blueprints.some((b) => b.id === d.activeId) ? d.activeId : null;
    out.journal = Array.isArray(d.journal) ? d.journal.slice(0, 40) : [];
    if (d.player && Number.isFinite(d.player.x) && Number.isFinite(d.player.z)) out.player = { x: d.player.x, z: d.player.z };
    if (Number.isFinite(d.hour)) out.hour = d.hour;
    return out;
  } catch (e) { // keep the broken data for recovery, start clean
    try { if (raw) localStorage.setItem(KEY + '-corrupt-' + Date.now(), raw); } catch {}
    console.warn('Save data was unreadable and has been set aside:', e.message); const d = defaults(); d.recovered = true; return d;
  }
}
export function store(data) { try { const { recovered, ...d } = data; localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch (e) { console.warn('Could not save:', e.message); return false; } }
export function wipe() { try { localStorage.removeItem(KEY); } catch {} }
