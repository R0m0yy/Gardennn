// Builds a self-contained static copy with no import map (bare 'three' imports rewritten to relative paths).
// usage: node tools/build-static.mjs <outDir> [--fragment]   (--fragment writes a body-only index for hosts that wrap pages)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), out = path.resolve(process.argv[2] || 'dist'), fragment = process.argv.includes('--fragment');
const files = []; const walk = (d) => { for (const f of fs.readdirSync(path.join(root, d))) { const p = path.join(d, f); fs.statSync(path.join(root, p)).isDirectory() ? walk(p) : files.push(p); } };
['src', 'vendor', 'css'].forEach(walk);
fs.rmSync(out, { recursive: true, force: true });
for (const f of files) {
  if (f.endsWith('THREE_LICENSE')) { fs.mkdirSync(path.join(out, 'vendor'), { recursive: true }); fs.copyFileSync(path.join(root, f), path.join(out, 'vendor/THREE_LICENSE.txt')); continue; }
  let buf = fs.readFileSync(path.join(root, f));
  if (f.endsWith('.js')) { const rel = (target) => { let r = path.relative(path.dirname(f), target).split(path.sep).join('/'); return r.startsWith('.') ? r : './' + r; };
    buf = buf.toString().replace(/from\s+'three\/addons\/([^']+)'/g, (_, p) => `from '${rel('vendor/addons/' + p)}'`).replace(/from\s+'three'/g, () => `from '${rel('vendor/three.module.js')}'`); }
  fs.mkdirSync(path.dirname(path.join(out, f)), { recursive: true }); fs.writeFileSync(path.join(out, f), buf);
}
const body = `<canvas id="view"></canvas>\n<div id="ui"></div>\n<div id="boot"><div class="boot-card"><h1>EVOLUTION</h1><h2>Garden Wars</h2><p id="boot-msg">Growing the garden…</p></div></div>\n<script type="module" src="src/main.js"></script>\n`;
const head = `<title>EVOLUTION: Garden Wars</title>\n<link rel="stylesheet" href="css/style.css">\n`;
fs.writeFileSync(path.join(out, 'index.html'), fragment ? head + body : `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">\n${head}</head><body>\n${body}</body></html>\n`);
console.log(JSON.stringify(Object.fromEntries(files.map((f) => [f.endsWith('THREE_LICENSE') ? 'vendor/THREE_LICENSE.txt' : f.split(path.sep).join('/'), f.endsWith('THREE_LICENSE') ? 'vendor/THREE_LICENSE.txt' : f.split(path.sep).join('/')]))));
