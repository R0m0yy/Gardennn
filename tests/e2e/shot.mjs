// usage: node tests/e2e/shot.mjs out.png "query" [waitMs] [w] [h]
import { createRequire } from 'node:module'; import { spawn } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)('playwright'); // resolved from the global install (NODE_PATH) when not local
const [out, query = '', wait = '4000', w = '1280', h = '960'] = process.argv.slice(2);
const srv = spawn('node', ['tools/serve.mjs'], { env: { ...process.env, PORT: '8123' }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 500));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.type(), m.text().slice(0, 600)); });
p.on('pageerror', (e) => console.log('[pageerror]', e.message, (e.stack || '').split('\n').slice(0, 4).join(' | ')));
await p.goto('http://localhost:8123/?' + query); await p.waitForTimeout(+wait);
console.log('frames', await p.evaluate(() => window.__frames));
await p.screenshot({ path: out }); await b.close(); srv.kill();
