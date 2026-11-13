import { createRequire } from 'node:module'; import { spawn } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)('playwright'); // global install via NODE_PATH
export async function open(query = 'q=low&manual=1', w = 800, h = 600) {
  const port = 8100 + Math.floor(Math.random() * 800);
  const srv = spawn('node', ['tools/serve.mjs'], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 600));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.log('[console.error]', m.text().slice(0, 500)); } });
  page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message, (e.stack || '').split('\n').slice(1, 4).join(' | ')); });
  await page.goto(`http://localhost:${port}/?${query}`); await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
  // advance n frames; render only the last one unless told otherwise
  const step = (n, dt = 1 / 30, render = false) => page.evaluate(([n, dt, render]) => { const g = window.__game; for (let i = 0; i < n; i++) { g.skipRender = !(render || i === n - 1); g.frame(dt); } }, [n, dt, render]);
  const close = async () => { await browser.close(); srv.kill(); };
  return { page, step, errors, close };
}
