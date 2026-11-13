// Procedural textures painted on canvases at start-up. No external image files, nothing to license.
import * as THREE from 'three';
import { vnoise, fbm, mulberry } from '../sim/world.js';

const cache = new Map();
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(key, w, h, draw, repeat = true) {
  if (cache.has(key)) return cache.get(key);
  const c = canvas(w, h), g = c.getContext('2d');
  draw(g, w, h, mulberry(key.length * 7919 + key.charCodeAt(0) * 31));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}
const rgb = (r, g, b, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
function noiseFill(g, w, h, base, amp, scale, oct = 4) {
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // tileable: blend noise across the wrap
    const n = fbm(x / scale, y / scale, oct) - 0.5, i = (y * w + x) * 4;
    d[i] = base[0] + n * amp[0]; d[i + 1] = base[1] + n * amp[1]; d[i + 2] = base[2] + n * amp[2]; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
function speckle(g, w, h, rnd, n, col, r0, r1) { for (let i = 0; i < n; i++) { g.fillStyle = col(rnd); g.beginPath(); g.arc(rnd() * w, rnd() * h, r0 + rnd() * (r1 - r0), 0, 7); g.fill(); } }

export const T = {
  wood: (tone = 'mid') => tex('wood' + tone, 256, 256, (g, w, h, rnd) => {
    const base = { mid: [128, 88, 52], dark: [84, 56, 34], light: [214, 186, 136], grey: [120, 108, 96] }[tone];
    noiseFill(g, w, h, base, [40, 34, 26], 60, 3);
    for (let i = 0; i < 260; i++) { // grain
      const y = rnd() * h; g.strokeStyle = rgb(base[0] * 0.6, base[1] * 0.6, base[2] * 0.6, 0.12 + rnd() * 0.25); g.lineWidth = 0.5 + rnd() * 1.2;
      g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 2.5); g.stroke();
    }
    for (let p = 0; p < 4; p++) { g.fillStyle = 'rgba(20,10,5,0.55)'; g.fillRect(0, p * 64, w, 2.5); g.fillStyle = 'rgba(255,230,190,0.10)'; g.fillRect(0, p * 64 + 3, w, 1.5);
      for (let k = 0; k < 2; k++) { const x = rnd() * w; g.fillStyle = 'rgba(25,14,8,0.6)'; g.beginPath(); g.arc(x, p * 64 + 10, 2, 0, 7); g.arc(x, p * 64 + 54, 2, 0, 7); g.fill(); } }
  }),
  fabric: () => tex('fabric', 256, 256, (g, w, h, rnd) => {
    noiseFill(g, w, h, [226, 212, 182], [26, 26, 30], 70, 3);
    g.globalAlpha = 0.07; for (let i = 0; i < w; i += 2) { g.fillStyle = i % 4 ? '#5a4a30' : '#fff'; g.fillRect(i, 0, 1, h); g.fillRect(0, i, w, 1); } g.globalAlpha = 1;
    for (let i = 0; i < 8; i++) { const x = i * 32 + 16; g.fillStyle = 'rgba(90,70,40,0.28)'; g.fillRect(x - 1.5, 0, 3, h); g.fillStyle = 'rgba(255,250,235,0.25)'; g.fillRect(x + 2, 0, 2, h); } // rib shadows
    speckle(g, w, h, rnd, 30, () => 'rgba(120,95,60,0.10)', 3, 12);
  }),
  card: () => tex('card', 256, 256, (g, w, h, rnd) => {
    noiseFill(g, w, h, [186, 146, 96], [30, 28, 24], 40, 4);
    speckle(g, w, h, rnd, 900, (r) => rgb(110 + r() * 60, 80 + r() * 40, 45 + r() * 30, 0.25), 0.4, 1.4);
    g.strokeStyle = 'rgba(90,60,30,0.2)'; for (let i = 0; i < 40; i++) { g.beginPath(); const x = rnd() * w, y = rnd() * h; g.moveTo(x, y); g.lineTo(x + rnd() * 30 - 15, y + rnd() * 6 - 3); g.stroke(); }
  }),
  corrugated: () => tex('corrugated', 256, 256, (g, w, h, rnd) => {
    noiseFill(g, w, h, [170, 128, 80], [26, 24, 20], 50, 3);
    for (let y = 0; y < h; y += 8) { g.fillStyle = 'rgba(70,45,20,0.28)'; g.fillRect(0, y, w, 3); g.fillStyle = 'rgba(255,230,190,0.16)'; g.fillRect(0, y + 4, w, 2); }
    speckle(g, w, h, rnd, 300, () => 'rgba(100,70,40,0.2)', 0.5, 1.5);
  }),
  paper: () => tex('paper', 128, 128, (g, w, h, rnd) => {
    noiseFill(g, w, h, [244, 240, 228], [14, 14, 16], 30, 3);
    g.strokeStyle = 'rgba(110,140,190,0.35)'; g.lineWidth = 1; for (let y = 8; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  }),
  metal: (tone = 'alu') => tex('metal' + tone, 256, 256, (g, w, h, rnd) => {
    const b = tone === 'alu' ? [196, 201, 207] : tone === 'steel' ? [118, 124, 130] : [150, 120, 70];
    noiseFill(g, w, h, b, [22, 22, 22], 80, 3);
    for (let i = 0; i < 500; i++) { g.strokeStyle = rgb(255, 255, 255, 0.04 + rnd() * 0.05); const y = rnd() * h; g.beginPath(); g.moveTo(rnd() * w, y); g.lineTo(rnd() * w, y); g.stroke(); }
    for (let y = 16; y < h; y += 64) for (let x = 6; x < w; x += 12) { g.fillStyle = 'rgba(30,30,35,0.5)'; g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.arc(x - 0.5, y - 0.5, 0.7, 0, 7); g.fill(); } // rivets
    if (tone !== 'alu') speckle(g, w, h, rnd, 60, () => 'rgba(120,60,25,0.22)', 2, 9); // rust
  }),
  carbon: () => tex('carbon', 64, 64, (g, w, h) => { g.fillStyle = '#1c1e22'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) { g.fillStyle = (x + y) % 16 ? '#2c2f36' : '#15161a'; g.fillRect(x, y, 7, 7); } }),
  plastic: () => tex('plastic', 64, 64, (g, w, h) => { noiseFill(g, w, h, [216, 228, 234], [8, 8, 8], 20, 2); }),
  soil: () => tex('soil', 512, 512, (g, w, h, rnd) => {
    noiseFill(g, w, h, [150, 132, 110], [70, 62, 52], 90, 5);
    speckle(g, w, h, rnd, 2600, (r) => { const v = 60 + r() * 150; return rgb(v, v * 0.88, v * 0.72, 0.35); }, 0.5, 2.6);
    speckle(g, w, h, rnd, 90, (r) => { const v = 150 + r() * 70; return rgb(v, v * 0.95, v * 0.85, 0.6); }, 2, 5);  // pebbles
    g.strokeStyle = 'rgba(40,26,14,0.3)'; for (let i = 0; i < 70; i++) { g.lineWidth = 0.6 + rnd(); g.beginPath(); let x = rnd() * w, y = rnd() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += rnd() * 24 - 12; y += rnd() * 24 - 12; g.lineTo(x, y); } g.stroke(); }
  }),
  stone: () => tex('stone', 256, 256, (g, w, h, rnd) => {
    noiseFill(g, w, h, [142, 136, 126], [46, 44, 42], 50, 4);
    for (let row = 0; row < 8; row++) { const y = row * 32; g.fillStyle = 'rgba(30,26,22,0.6)'; g.fillRect(0, y, w, 3);
      for (let x = (row % 2) * 24 + rnd() * 6; x < w; x += 40 + rnd() * 16) { g.fillRect(x, y, 3, 32); g.fillStyle = rgb(90 + rnd() * 90, 86 + rnd() * 80, 80 + rnd() * 70, 0.22); g.fillRect(x + 3, y + 3, 40, 29); g.fillStyle = 'rgba(30,26,22,0.6)'; } }
    speckle(g, w, h, rnd, 50, () => 'rgba(80,110,50,0.25)', 3, 10);
  }),
  shingle: () => tex('shingle', 256, 256, (g, w, h, rnd) => {
    g.fillStyle = '#3c3026'; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 8; row++) for (let x = -(row % 2) * 16; x < w; x += 32) { const v = 70 + rnd() * 50; g.fillStyle = rgb(v * 1.1, v * 0.9, v * 0.72); g.fillRect(x + 1, row * 32 + 1, 30, 30); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 1, row * 32 + 26, 30, 5); g.fillStyle = 'rgba(255,240,210,0.08)'; g.fillRect(x + 1, row * 32 + 1, 30, 4); }
    speckle(g, w, h, rnd, 70, () => 'rgba(88,128,52,0.5)', 3, 11);
  }),
  terracotta: () => tex('terracotta', 256, 256, (g, w, h, rnd) => { noiseFill(g, w, h, [186, 104, 66], [44, 34, 28], 60, 4); speckle(g, w, h, rnd, 120, () => 'rgba(240,225,200,0.16)', 2, 12); speckle(g, w, h, rnd, 60, () => 'rgba(70,100,50,0.2)', 4, 14); }),
  bark: () => tex('bark', 256, 256, (g, w, h, rnd) => {
    noiseFill(g, w, h, [96, 74, 56], [50, 40, 34], 40, 4);
    for (let i = 0; i < 120; i++) { g.strokeStyle = rgb(30, 20, 12, 0.3 + rnd() * 0.4); g.lineWidth = 1 + rnd() * 3; const x = rnd() * w; g.beginPath(); g.moveTo(x, rnd() * h); g.bezierCurveTo(x + 8, rnd() * h, x - 8, rnd() * h, x + rnd() * 10 - 5, rnd() * h); g.stroke(); }
    speckle(g, w, h, rnd, 50, () => 'rgba(96,140,60,0.35)', 3, 12);
  }),
  leaf: () => tex('leaf', 128, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#dfe8c8'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, '#dfe8c8'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(40,70,20,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke(); g.lineWidth = 1;
    for (let y = 8; y < h; y += 12) { g.beginPath(); g.moveTo(w / 2, y); g.lineTo(4, y - 14); g.moveTo(w / 2, y); g.lineTo(w - 4, y - 14); g.stroke(); }
  }, false),
  sandbag: () => tex('sandbag', 128, 128, (g, w, h, rnd) => { noiseFill(g, w, h, [176, 152, 112], [30, 28, 24], 30, 3); g.globalAlpha = 0.12; for (let i = 0; i < w; i += 3) { g.fillStyle = '#4a3a22'; g.fillRect(i, 0, 1, h); g.fillRect(0, i, w, 1); } g.globalAlpha = 1; }),
  blueprint: () => tex('blueprint', 512, 384, (g, w, h) => {
    g.fillStyle = '#e9dcbb'; g.fillRect(0, 0, w, h); const gr = g.createRadialGradient(w / 2, h / 2, 60, w / 2, h / 2, 330); gr.addColorStop(0, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(120,80,30,0.3)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#3a2c1c'; g.lineWidth = 2; g.strokeRect(14, 14, w - 28, h - 28);
    // front view of a canard biplane
    g.lineWidth = 2.2; const wing = (y) => { g.beginPath(); g.moveTo(60, y); g.lineTo(452, y); g.stroke(); };
    wing(90); wing(140); for (let x = 80; x <= 440; x += 45) { g.beginPath(); g.moveTo(x, 90); g.lineTo(x, 140); g.stroke(); g.lineWidth = 0.7; g.beginPath(); g.moveTo(x, 90); g.lineTo(x + 45, 140); g.moveTo(x + 45, 90); g.lineTo(x, 140); g.stroke(); g.lineWidth = 2.2; }
    g.beginPath(); g.arc(210, 116, 24, 0, 7); g.arc(302, 116, 24, 0, 7); g.stroke();
    // side view
    g.beginPath(); g.moveTo(70, 270); g.lineTo(200, 262); g.lineTo(330, 262); g.lineTo(450, 250); g.moveTo(70, 300); g.lineTo(200, 306); g.lineTo(330, 306); g.lineTo(450, 290); g.moveTo(200, 262); g.lineTo(200, 306); g.moveTo(330, 262); g.lineTo(330, 306); g.moveTo(450, 240); g.lineTo(450, 300); g.moveTo(70, 262); g.lineTo(70, 308); g.stroke();
    g.beginPath(); g.ellipse(265, 262, 70, 6, 0, 0, 7); g.ellipse(265, 306, 70, 6, 0, 0, 7); g.stroke();
    g.font = 'italic 15px Georgia'; g.fillStyle = '#3a2c1c'; g.fillText('Flying Machine No. 1', 30, 40); g.fillText('span 200 · chord 32 · gap 30', 30, 210); g.font = 'italic 12px Georgia'; g.fillText('centre of mass must sit ahead of —', 250, 345);
  }, false),
  banner: () => tex('banner', 128, 256, (g, w, h) => {
    g.fillStyle = '#9a2420'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d9b24a'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.translate(w / 2, h * 0.42); g.fillStyle = '#e2bd55'; for (let i = 0; i < 10; i++) { g.rotate(Math.PI / 5); g.fillRect(-6, -40, 12, 16); }
    g.beginPath(); g.arc(0, 0, 28, 0, 7); g.fill(); g.fillStyle = '#9a2420'; g.beginPath(); g.arc(0, 0, 12, 0, 7); g.fill();
  }, false),
  roundel: () => tex('roundel', 64, 64, (g) => { g.clearRect(0, 0, 64, 64); for (const [r, c] of [[30, '#1f3d8a'], [20, '#f1ead8'], [10, '#b3261e']]) { g.fillStyle = c; g.beginPath(); g.arc(32, 32, r, 0, 7); g.fill(); } }, false),
  disc: () => tex('disc', 64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.0)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.35)'); gr.addColorStop(0.9, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }, false),
  soft: () => tex('soft', 64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }, false),
};

// Shared PBR materials keyed by look
const mats = new Map();
export function M(key, make) { if (!mats.has(key)) mats.set(key, make()); return mats.get(key); }
const std = (o) => new THREE.MeshStandardMaterial(o);
export const Mat = {
  wood: (tone = 'mid', rep = 1) => M('wood' + tone + rep, () => { const t = T.wood(tone); return std({ map: t, bumpMap: t, bumpScale: 0.6, roughness: 0.8 }); }),
  stone: () => M('stone', () => std({ map: T.stone(), bumpMap: T.stone(), bumpScale: 1.2, roughness: 0.95 })),
  shingle: () => M('shingle', () => std({ map: T.shingle(), bumpMap: T.shingle(), bumpScale: 1.5, roughness: 0.9 })),
  metal: (tone = 'steel') => M('metal' + tone, () => std({ map: T.metal(tone), roughness: tone === 'alu' ? 0.32 : 0.5, metalness: tone === 'brass' ? 0.9 : 0.8 })),
  color: (hex, rough = 0.8, extra = {}) => M('c' + hex + rough + JSON.stringify(extra), () => std({ color: hex, roughness: rough, ...extra })),
  // material for an aircraft part made of a catalog material
  look: (look, tint) => M('look' + look + (tint || ''), () => {
    const o = { paper: { map: T.paper(), roughness: 0.9, side: THREE.DoubleSide }, card: { map: T.card(), roughness: 0.95, side: THREE.DoubleSide }, corrugated: { map: T.corrugated(), roughness: 0.95, side: THREE.DoubleSide },
      wood: { map: T.wood('light'), roughness: 0.7, side: THREE.DoubleSide }, fabric: { map: T.fabric(), roughness: 0.85, side: THREE.DoubleSide, transparent: !tint, opacity: tint ? 1 : 0.93 },
      plastic: { map: T.plastic(), roughness: 0.35, side: THREE.DoubleSide }, metal: { map: T.metal('alu'), roughness: 0.3, metalness: 0.85, side: THREE.DoubleSide },
      steel: { map: T.metal('steel'), roughness: 0.5, metalness: 0.8, side: THREE.DoubleSide }, carbon: { map: T.carbon(), roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide } }[look] || { color: 0xffffff };
    if (tint) o.color = tint;
    return std(o);
  }),
};
