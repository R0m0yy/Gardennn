// Keyboard, mouse, gamepad and touch unified into one polled state.
export class Input {
  constructor(el) {
    this.keys = new Set(); this.edge = new Set(); this.look = { dx: 0, dy: 0 }; this.wheel = 0; this.stick = { x: 0, y: 0 }; this.touch = false; this.vkeys = new Set();
    this.enabled = true; this.padPrev = [];
    addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return; if (!this.keys.has(e.code)) this.edge.add(e.code); this.keys.add(e.code); if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault(); });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    let drag = null;
    el.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && this.touchZone(e)) return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', (e) => { if (drag && drag.id === e.pointerId) { this.look.dx += e.clientX - drag.x; this.look.dy += e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; } });
    const end = (e) => { if (drag && drag.id === e.pointerId) drag = null; };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) this.setupTouch();
  }
  touchZone() { return false; }
  setupTouch() {
    this.touch = true;
    const ui = document.createElement('div'); ui.id = 'touch'; document.body.appendChild(ui);
    ui.innerHTML = `<div class="tj" id="tj"><div class="tk" id="tk"></div></div>
      <div class="tb-wrap"><button data-k="KeyE" class="tb big">Use</button><button data-k="Space" class="tb">Jump<br>Launch</button><button data-k="ShiftLeft" class="tb">Run<br>Power+</button><button data-k="ControlLeft" class="tb">Power−</button><button data-k="KeyC" class="tb">View</button><button data-k="Escape" class="tb">Menu</button></div>`;
    const tj = ui.querySelector('#tj'), tk = ui.querySelector('#tk'); let id = null, ox = 0, oy = 0;
    const move = (e) => { const dx = e.clientX - ox, dy = e.clientY - oy, l = Math.hypot(dx, dy), m = 46, k = l > m ? m / l : 1; tk.style.transform = `translate(${dx * k}px,${dy * k}px)`; this.stick.x = dx * k / m; this.stick.y = dy * k / m; };
    tj.addEventListener('pointerdown', (e) => { id = e.pointerId; const r = tj.getBoundingClientRect(); ox = r.left + r.width / 2; oy = r.top + r.height / 2; tj.setPointerCapture(id); move(e); e.stopPropagation(); });
    tj.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
    const up = (e) => { if (e.pointerId === id) { id = null; tk.style.transform = ''; this.stick.x = this.stick.y = 0; } };
    tj.addEventListener('pointerup', up); tj.addEventListener('pointercancel', up);
    ui.querySelectorAll('.tb').forEach((b) => { const k = b.dataset.k;
      b.addEventListener('pointerdown', (e) => { if (!this.keys.has(k)) this.edge.add(k); this.keys.add(k); b.classList.add('on'); e.preventDefault(); e.stopPropagation(); });
      const off = () => { this.keys.delete(k); b.classList.remove('on'); }; b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off); });
  }
  down(...codes) { return this.enabled && codes.some((c) => this.keys.has(c)); }
  pressed(...codes) { return this.enabled && codes.some((c) => this.edge.has(c)); }
  // -1..1 axis from key pairs plus analogue sources
  axis(neg, pos) { return (this.down(...pos) ? 1 : 0) - (this.down(...neg) ? 1 : 0); }
  pollPad() {
    const gp = (navigator.getGamepads ? [...navigator.getGamepads()] : []).find((g) => g && g.connected); this.pad = null; if (!gp) return;
    const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
    this.pad = { lx: dz(gp.axes[0]), ly: dz(gp.axes[1]), rx: dz(gp.axes[2] || 0), ry: dz(gp.axes[3] || 0), lt: gp.buttons[6]?.value || 0, rt: gp.buttons[7]?.value || 0 };
    const map = { 0: 'Space', 1: 'KeyC', 2: 'KeyE', 3: 'KeyX', 4: 'KeyQ', 5: 'KeyR', 9: 'Escape', 8: 'Tab', 12: 'KeyT', 13: 'KeyG' };
    for (const [i, code] of Object.entries(map)) { const on = gp.buttons[i]?.pressed; if (on && !this.padPrev[i]) this.edge.add(code); if (on) this.keys.add(code); else if (this.padPrev[i]) this.keys.delete(code); this.padPrev[i] = on; }
    this.look.dx += this.pad.rx * 9; this.look.dy += this.pad.ry * 6;
  }
  endFrame() { this.edge.clear(); this.look.dx = this.look.dy = 0; this.wheel = 0; }
}
