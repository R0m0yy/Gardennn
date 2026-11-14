// Renders documentation screenshots through the real game. usage: node tools/dev/shots.mjs <outDir> [quality]
import { open } from '../../tests/e2e/lib.mjs';
const out = process.argv[2] || 'docs/screenshots', q = process.argv[3] || 'medium';
const { page, step, errors, close } = await open(`q=${q}&manual=1`, 1200, 900); const ev = (fn, a) => page.evaluate(fn, a);
const shot = async (n) => { await page.screenshot({ path: `${out}/${n}.png` }); console.log('shot', n); };
await ev(() => { localStorage.clear(); const g = window.__game; g.startMode('sandbox'); g.panels.toasts.innerHTML = ''; });
// 1: the inventor in front of the workshop, prototype on the deck
await ev(async () => { const g = window.__game, m = await import('./src/sim/blueprint.js'); g.spawnCraft(m.cloneBlueprint(m.TEMPLATES.wright_1903)); g.player.pos.set(0.12, 0, 0.42); g.player.yaw = 2.2; g.rig.yaw = 0.62; g.rig.pitch = 0.24; g.rig.dist = 0.48; });
await step(40); await ev(() => { window.__game.panels.toasts.innerHTML = ''; }); await step(1); await shot('01-workshop-clearing');
// 2: engineering bench
await ev(() => window.__game.openWorkshop('scout_1917')); await step(4); await shot('02-design-bench');
await ev(() => window.__game.closeWorkshop(true));
// 3: scout airborne over the garden
await ev(async () => { const g = window.__game, m = await import('./src/sim/blueprint.js'); g.spawnCraft(m.cloneBlueprint(m.TEMPLATES.scout_1917)); g.beginFlight('runway', true); g.input.keys.add('ShiftLeft'); });
await step(170); await ev(() => window.__game.input.keys.add('KeyD')); await step(45); await ev(() => { window.__game.panels.toasts.innerHTML = ''; }); await step(1); await shot('03-scout-in-flight');
// 4: cardboard glider on the hill catapult
await ev(async () => { const g = window.__game, m = await import('./src/sim/blueprint.js'); g.input.keys.clear(); g.session = null; g.spawnCraft(m.cloneBlueprint(m.TEMPLATES.card_glider)); g.beginFlight('hill', true); });
await step(10); await ev(() => window.__game.input.keys.add('Space')); await step(22); await ev(() => window.__game.input.keys.delete('Space')); await step(22); await shot('04-cardboard-glider');
console.log('errors', errors.length); await close();
