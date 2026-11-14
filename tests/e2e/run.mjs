// Browser end-to-end test: drives the real game (headless Chromium, software WebGL) through its core loop.
// usage: npm run e2e [-- <screenshot-dir>]   (needs Playwright + Chromium available to Node)
import { open } from './lib.mjs';
const out = process.argv[2], shots = !!out; let failed = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failed++; };
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
check(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) > 0.1, 'player walks with WASD');
check(mass1 > mass0 * 2, 'changing wing material changes mass in the workshop');
check(r && r.duration > 2 && r.distance > 5 && r.track.length > 10, `cardboard glider flew from the hill (${r && r.distance.toFixed(1)} m) and produced a report`);
check((await ev(() => window.__game.craft.ac.agl)) > 0.3, 'rotary scout took off from the runway under keyboard control');
// ---- UI: menu -> settings -> journey, objective progression
await ev(() => { window.__game.input.keys.clear(); window.__game.toTitle(); }); await step(1);
check(await page.locator('.menu .card').count() === 3, 'title menu shows three modes');
await page.locator('.menu-row .btn', { hasText: 'Settings' }).click(); await page.locator('.dialog select').first().selectOption('simulation'); await page.locator('.dialog .btn.primary').click();
check((await ev(() => window.__game.save.settings.flightModel)) === 'simulation', 'settings dialog changes the flight model'); await ev(() => { window.__game.save.settings.flightModel = 'accessible'; });
await page.locator('.menu .card').first().click(); await step(2);
check((await ev(() => window.__game.state)) === 'explore' && (await page.locator('.objective b').textContent()).includes('Wake up'), 'Journey starts with its first objective');
check((await ev(() => window.__game.unlocks.engines.length)) === 0, 'Journey starts with no engines unlocked');
await ev(() => window.__game.openWorkshop()); await step(1); check((await ev(() => window.__game.save.progress.step)) === 1, 'reaching the bench completes step 1');
await page.locator('.build .btn.primary').click(); await page.waitForTimeout(500); await step(2); check((await ev(() => window.__game.save.progress.step)) === 2, 'building a prototype completes step 2');
// carry the prototype to the hill
await ev(() => { const g = window.__game; g.craftAction('carry'); g.player.pos.set(-2.95, 0, -2.4); }); await step(3);
check((await page.locator('.prompt').textContent()).includes('Glider Hill'), 'carried prototype can be mounted on the hill catapult');
await ev(() => window.__game.input.edge.add('KeyE')); await step(1); await page.waitForTimeout(500); await step(2); check((await ev(() => window.__game.state)) === 'fly', 'mounting starts a flight session');
await ev(() => window.__game.input.keys.add('Space')); await step(24); await ev(() => window.__game.input.keys.delete('Space'));
for (let i = 0; i < 40 && (await ev(() => window.__game.state)) === 'fly'; i++) await step(30);
check((await ev(() => window.__game.save.progress.step)) >= 3, 'first flight completes step 3'); await ev(() => window.__game.reportExit());
// ---- weather: rain wets the world and soaks cardboard
await ev(() => { const g = window.__game; g.weather.set('rain', true); }); await step(300, 1 / 10);
check((await ev(() => window.__game.weather.wet)) > 0.2 && (await ev(() => window.__game.sky.drops.visible)), 'rain makes the ground wet and raindrops fall');
await ev(() => window.__game.beginFlight('hill', true)); await ev(() => window.__game.input.keys.add('Space')); await step(20); await ev(() => window.__game.input.keys.delete('Space')); await step(60);
check((await ev(() => Math.max(...window.__game.craft.ac.surfs.map((s) => s.moisture)))) > 0.01, 'cardboard absorbs rain in flight');
for (let i = 0; i < 40 && (await ev(() => window.__game.state)) === 'fly'; i++) await step(30); await ev(() => { window.__game.reportExit(); window.__game.weather.set('calm', true); });
// ---- historical trial: 1903 Flyer from the rail
await ev(() => window.__game.panels.trials(false)); await page.locator('.trial .btn.primary').nth(1).click(); await page.waitForTimeout(500); await step(2);
check((await ev(() => window.__game.craft.bp.name)) === '1903 Pioneer Flyer' && (await ev(() => window.__game.weather.key)) === 'breeze', '1903 trial sets up the Flyer on the rail in a headwind');
await ev(() => window.__game.input.keys.add('ShiftLeft')); let maxAgl = 0; for (let i = 0; i < 14; i++) { if (i === 4) await ev(() => window.__game.input.keys.add('KeyS')); await step(30); maxAgl = Math.max(maxAgl, await ev(() => window.__game.craft.ac.agl)); } await shot('flyer');
check(maxAgl > 0.2, `the Flyer leaves the rail under its own power (peak ${maxAgl.toFixed(2)} m)`); await ev(() => { window.__game.input.keys.delete('ShiftLeft'); window.__game.input.keys.delete('KeyS'); });
// ---- persistence
await ev(() => window.__game.persist()); const before = await ev(() => ({ j: window.__game.save.journal.length, b: window.__game.save.blueprints.length, step: window.__game.save.progress.step }));
await page.reload(); await page.waitForFunction(() => window.__game); const after = await ev(() => ({ j: window.__game.save.journal.length, b: window.__game.save.blueprints.length, step: window.__game.save.progress.step, craft: !!window.__game.craft }));
check(after.j === before.j && after.b === before.b && after.step === before.step && after.craft, `progress, ${after.b} blueprints and ${after.j} journal entries survive a reload`);
await ev(() => localStorage.setItem('evolution-garden-wars', '{"blueprints":[{"parts":"??"}],"settings":')); await page.reload(); await page.waitForFunction(() => window.__game);
check((await ev(() => window.__game.save.recovered)) === true && (await ev(() => window.__game.state)) === 'menu', 'a corrupted save is set aside and the game still starts');
check(errors.length === 0, `no console or page errors (${errors.length})`);
await close(); console.log(failed ? `\n${failed} check(s) FAILED` : '\nall end-to-end checks passed'); process.exit(failed ? 1 : 0);
