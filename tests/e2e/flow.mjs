// Drives the real game through its core loop and saves screenshots for inspection.
import { open } from './lib.mjs';
const out = process.argv[2] || '.', shots = process.argv[3] !== 'noshots';
const { page, step, errors, close } = await open('q=low&manual=1', 960, 720);
const ev = (fn, arg) => page.evaluate(fn, arg); const log = (...a) => console.log(...a);
const shot = async (n) => { if (shots) await page.screenshot({ path: `${out}/${n}.png` }); };
await ev(() => { localStorage.clear(); }); await ev(() => window.__game.startMode('sandbox'));
// walk
const p0 = await ev(() => window.__game.player.pos.toArray()); await ev(() => window.__game.input.keys.add('KeyW')); await step(40); await ev(() => window.__game.input.keys.delete('KeyW'));
const p1 = await ev(() => window.__game.player.pos.toArray()); log('walked', Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(3), 'm');
await ev(() => { const g = window.__game; g.player.pos.set(-0.5, 0, -0.2); g.rig.yaw = 0.2; g.rig.dist = 0.5; }); await step(30); await shot('hut');
// workshop
await ev(() => window.__game.openWorkshop('card_glider')); await step(3); await shot('workshop');
const mass0 = await ev(() => window.__game.workshop.an.mass);
await ev(() => { const w = window.__game.workshop, wing = w.bp.parts.find((p) => p.type === 'surface'); w.change(() => { wing.material = 'steel'; }); });
const mass1 = await ev(() => window.__game.workshop.an.mass); log('mass card->steel wing', (mass0 * 1000).toFixed(2), '->', (mass1 * 1000).toFixed(2), 'g');
await ev(() => window.__game.workshop.step(window.__game.workshop.undo, window.__game.workshop.redo));
log('after undo', (await ev(() => window.__game.workshop.an.mass * 1000)).toFixed(2), 'g; stats boxes:', await page.locator('.ws-bottom .stat').count(), 'warnings:', await page.locator('.ws-bottom .w').count());
await page.locator('.build .btn.primary').click(); await page.waitForTimeout(500); await step(5);
log('prototype:', await ev(() => window.__game.craft && window.__game.craft.bp.name), 'state', await ev(() => window.__game.state)); await shot('pad');
// hill flight
await ev(() => window.__game.beginFlight('hill', true)); await step(3); await shot('hill');
await ev(() => window.__game.input.keys.add('Space')); await step(20, 1 / 30); await ev(() => window.__game.input.keys.delete('Space')); await step(2);
log('launched: speed', (await ev(() => window.__game.session.launchSpeed)).toFixed(2)); await step(30); await shot('glide');
for (let i = 0; i < 40 && (await ev(() => window.__game.state)) === 'fly'; i++) await step(30);
const r = await ev(() => window.__game.lastReport); log('report:', r && { outcome: r.outcome, dur: r.duration.toFixed(1), dist: r.distance.toFixed(1), notes: r.notes.length }); await step(1); await shot('report');
log('journal entries', await ev(() => window.__game.save.journal.length), 'saved blueprints', await ev(() => JSON.parse(localStorage.getItem('evolution-garden-wars')).blueprints.length));
// powered: scout from runway
await ev(() => { const g = window.__game; g.reportExit(); g.startTrial({ id: 'x', year: 1917, title: 't', brief: 'b', bp: 'scout_1917', site: 'runway', weather: 'calm', windDir: 0, score: () => ({ pass: true, value: 'ok', medal: 'bronze' }) }); });
await page.waitForTimeout(500); await step(2); await ev(() => window.__game.input.keys.add('ShiftLeft')); await step(60); await shot('takeoff');
await ev(() => window.__game.input.keys.add('KeyS')); await step(50); await ev(() => window.__game.input.keys.delete('KeyS')); await step(60);
log('scout: agl', (await ev(() => window.__game.craft.ac.agl)).toFixed(2), 'V', (await ev(() => window.__game.craft.ac.airspeed)).toFixed(2)); await shot('scout');
log('errors:', errors.length); await close(); process.exit(errors.length ? 1 : 0);
