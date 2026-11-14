// dev helper: trace a historical trial in the real game. usage: node tools/dev/dbg.mjs <trialIndex> [pullAfterSimSeconds]
import { open } from '../../tests/e2e/lib.mjs';
const idx = +(process.argv[2] || 1), pull = process.argv[3] ? +process.argv[3] : null;
const { page, step, close } = await open('q=low&manual=1', 480, 360); const ev = (fn, a) => page.evaluate(fn, a);
await ev(async (idx) => { localStorage.clear(); const g = window.__game; const m = await import('./src/game/missions.js'); g.startMode('sandbox'); g.startTrial(m.TRIALS[idx]); }, idx); await page.waitForTimeout(500); await step(2);
await ev(() => window.__game.input.keys.add('ShiftLeft'));
for (let i = 0; i < 22; i++) { await step(30, 1 / 30); const st = await ev((pull) => { const g = window.__game, s = g.session, a = g.craft.ac; if (pull != null && s && s.t > pull) g.input.keys.add('KeyS');
  return `${g.state} t=${s ? s.t.toFixed(1) : '-'} V=${a.airspeed.toFixed(2)} agl=${(a.agl || 0).toFixed(2)} x=${a.pos[0].toFixed(1)} pitch=${(g.hpr.pitch * 57.3).toFixed(0)} roll=${(g.hpr.roll * 57.3).toFixed(0)} a=${(a.alpha * 57.3).toFixed(1)} st=${a.stall.toFixed(2)} T=${a.engines[0] ? a.engines[0].thrust.toFixed(3) : 0} cp=${a.ctrl ? a.ctrl.pitch.toFixed(2) : 0} cond=${a.condition.toFixed(2)}`; }, pull); console.log(st); if (st.startsWith('modal')) break; }
await close();
