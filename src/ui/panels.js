// Menus, HUD, flight report with replay, journal, timeline.
import { h, fmt, btn } from './dom.js';
import { JOURNEY, TRIALS, TIMELINE } from '../game/missions.js';
import { WEATHER_PRESETS, WORLD } from '../sim/world.js';
import { TEMPLATES } from '../sim/blueprint.js';

export class Panels {
  constructor(game) {
    this.g = game; const ui = game.ui;
    this.hud = h('div.hud'); this.layer = h('div.layer'); this.toasts = h('div.toasts'); ui.append(this.hud, this.layer, this.toasts);
    this.buildHud();
  }
  clear() { this.layer.innerHTML = ''; this.modal = null; }
  show(name, node) { this.clear(); this.modal = name; this.layer.append(node); this.g.audio.play('page'); }
  toast(msg, cls = 'info') { const t = h('div.toast.' + cls, msg); this.toasts.append(t); while (this.toasts.children.length > 4) this.toasts.firstChild.remove(); setTimeout(() => t.classList.add('out'), 3800); setTimeout(() => t.remove(), 4600); }

  // ------------------------------------------------------------ main menu
  menu() {
    const g = this.g, has = g.save.progress.flights > 0 || g.save.blueprints.length > 0;
    this.show('menu', h('div.menu', h('div.title', h('h1', 'EVOLUTION'), h('h2', 'Garden Wars'), h('p', 'A miniature invention & engineering sandbox')),
      h('div.menu-cards',
        this.card("Inventor's Journey", has && g.save.mode === 'journey' ? `Continue · step ${Math.min(g.save.progress.step + 1, JOURNEY.length)} of ${JOURNEY.length}` : 'Start with cardboard and a hill. Earn materials, engines and history.', () => g.startMode('journey')),
        this.card('Free Invention Sandbox', 'Every material and engine unlocked. No rules, any era, choose the weather.', () => g.startMode('sandbox')),
        this.card('Historical Trials', 'Fly the 1894 glider, the 1903 Flyer and a 1917 scout in their defining moments.', () => this.trials(true))),
      h('div.menu-row', btn('Settings', () => this.settings(true)), btn('How to play', () => this.help(true))),
      h('p.fine', 'Milestone 1 · flight & engineering. Ground vehicles, combat and factions are on the roadmap, not in this build.')));
  }
  card(title, text, fn) { return h('button.card', { onclick: () => { this.g.audio.start(); this.g.audio.play('click'); fn(); } }, h('b', title), h('span', text)); }

  help(fromMenu) {
    const k = (a, b) => h('tr', h('td', a), h('td', b));
    this.show('help', h('div.paper.dialog.wide', h('h2', 'How to play'),
      h('div.cols', h('div', h('h3', 'On foot'), h('table', k('W A S D / left stick', 'move'), k('Shift', 'run'), k('Space', 'jump'), k('C', 'crouch'), k('E', 'use bench, board, journal, aircraft'), k('Drag mouse · wheel', 'rotate & zoom camera'), k('Tab', 'journal'), k('Esc', 'pause'))),
        h('div', h('h3', 'Flying'), h('table', k('S / ↓', 'stick back: nose up'), k('W / ↑', 'stick forward: nose down'), k('A D / ← →', 'roll (or rudder if no ailerons)'), k('Q E', 'rudder'), k('Shift / Ctrl', 'throttle up / down'), k('Space (hold, release)', 'catapult launch on the hill'), k('T G', 'pitch trim'), k('C', 'chase / cockpit view'), k('Enter', 'end flight once stopped'), k('Backspace', 'abandon & reset')))),
      h('p', 'Accessible Flight adds a co-pilot that levels the wings, damps wobbles and guards against stalls. Simulation Flight leaves almost all of it to you. Both use the same physics.'),
      h('div.rowbtns', btn('Back', () => (fromMenu ? this.menu() : this.pause())))));
  }

  settings(fromMenu) {
    const g = this.g, s = g.save.settings;
    const row = (label, ctl) => h('label.row', h('span', label), ctl);
    const sel = (key, opts, after) => h('select', { onchange: (e) => { s[key] = e.target.value; g.applySettings(); after && after(); } }, opts.map(([v, n]) => h('option', { value: v, selected: String(s[key]) === String(v) }, n)));
    const rng = (key, min, max, step) => h('input', { type: 'range', min, max, step, value: s[key], oninput: (e) => { s[key] = +e.target.value; g.applySettings(); } });
    const chk = (key) => h('input', { type: 'checkbox', checked: !!s[key], onchange: (e) => { s[key] = e.target.checked; g.applySettings(); } });
    this.show('settings', h('div.paper.dialog', h('h2', 'Settings'),
      row('Flight model', sel('flightModel', [['accessible', 'Accessible Flight (assisted)'], ['simulation', 'Simulation Flight']])),
      row('Graphics quality', sel('quality', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], () => this.toast('Quality changes apply after reloading the page'))),
      row('Glow (bloom)', chk('bloom')), row('Miniature lens blur', chk('lens')),
      row('Volume', rng('master', 0, 1, 0.05)), row('Invert pitch', chk('invertPitch')), row('Tutorial hints', chk('hints')),
      row('Length of a day', sel('dayMinutes', [[12, '12 minutes'], [24, '24 minutes'], [60, '1 hour'], [0, 'Frozen at golden hour']])),
      h('div.rowbtns', btn('Erase all progress', (e) => { if (e.target.dataset.sure) g.eraseSave(); else { e.target.dataset.sure = '1'; e.target.textContent = 'Tap again to erase everything'; } }, 'quiet'), btn('Done', () => { g.persist(); fromMenu ? this.menu() : this.pause(); }, 'primary'))));
  }

  pause() {
    const g = this.g, sandbox = g.save.mode === 'sandbox';
    this.show('pause', h('div.paper.dialog', h('h2', 'Paused'),
      sandbox && h('div.rowbtns.wrap', h('span', 'Weather: '), Object.entries(WEATHER_PRESETS).map(([k, w]) => btn(w.name, () => { g.weather.set(k); this.pause(); }, g.weather.key === k ? 'small.on' : 'small'))),
      sandbox && h('div.rowbtns.wrap', h('span', 'Wind from: '), [['N', 0], ['E', Math.PI / 2], ['S', Math.PI], ['W', Math.PI * 1.5]].map(([n, a]) => btn(n, () => { g.weather.dir = a; this.pause(); }, Math.abs(g.weather.dir - a) < 0.1 ? 'small.on' : 'small')),
        h('span', ' Time: '), [['Dawn', 6.6], ['Morning', 8.6], ['Noon', 12.5], ['Dusk', 18.8], ['Night', 23]].map(([n, t]) => btn(n, () => { g.sky.hour = t; this.pause(); }, 'small'))),
      h('div.col', btn('Resume', () => g.resume(), 'primary'), btn('Settings', () => this.settings(false)), btn('How to play', () => this.help(false)), btn('Save & return to title', () => g.toTitle()))));
  }

  // ------------------------------------------------------------ HUD
  buildHud() {
    const H = this.hud;
    this.obj = h('div.objective.paper'); this.prompt = h('div.prompt'); this.env = h('div.envinfo');
    this.fl = h('div.flight.hidden',
      h('div.inst', h('span', 'SPEED'), this.vSpd = h('b', '0.0'), h('i', 'm/s'), this.vStall = h('em', '')),
      h('div.inst', h('span', 'HEIGHT'), this.vAlt = h('b', '0.00'), h('i', 'm')),
      h('div.inst', h('span', 'HEADING'), this.vHdg = h('b', '090'), this.vCard = h('i', 'E')),
      h('div.inst', h('span', 'CLIMB'), this.vVs = h('b', '0.0'), h('i', 'm/s')),
      h('div.inst', h('span', 'LOAD'), this.vG = h('b', '1.0'), h('i', 'g')),
      this.att = h('canvas.att', { width: 96, height: 96 }),
      h('div.bars', h('div.bar', h('span', 'POWER'), this.bThr = h('div.fill')), h('div.bar', h('span', this.lEnergy = h('i', 'ENERGY')), this.bEn = h('div.fill.en')), h('div.bar', h('span', 'AIRFRAME'), this.bCond = h('div.fill.cond')), h('div.bar', h('span', 'WING STRESS'), this.bStress = h('div.fill.stress'))),
      this.warn = h('div.warnlamp'), this.fmode = h('div.fmode'));
    this.charge = h('div.charge.hidden', h('span', 'CATAPULT'), this.chargeFill = h('div.fill'));
    this.health = h('div.health', h('div.fill'));
    H.append(this.obj, this.env, this.health, this.fl, this.charge, this.prompt);
  }
  setObjective(title, text, hint) { this.obj.innerHTML = ''; if (!title) { this.obj.classList.add('hidden'); return; } this.obj.classList.remove('hidden'); this.obj.append(h('b', title), h('span', text)); if (hint && this.g.save.settings.hints) this.obj.append(h('i', hint)); }
  setPrompt(text) { if (this._p === text) return; this._p = text; this.prompt.textContent = text || ''; this.prompt.classList.toggle('hidden', !text); }
  updateHud(dt) {
    const g = this.g, w = g.weather, s = g.session, flying = g.state === 'fly' && s;
    this.hud.classList.toggle('hidden', ['menu', 'workshop'].includes(g.state));
    this.fl.classList.toggle('hidden', !flying); this.charge.classList.toggle('hidden', !(flying && s.state === 'ready'));
    this.health.firstChild.style.width = Math.round(g.player.health * 100) + '%'; this.health.classList.toggle('hidden', flying || g.player.health > 0.999);
    const wv = w.wind(flying ? s.ac.pos : [g.player.pos.x, g.player.pos.y + 0.3, g.player.pos.z]), ws = Math.hypot(wv[0], wv[2]), from = (Math.atan2(-wv[0], wv[2]) * 180 / Math.PI + 360) % 360;
    const hr = g.sky.hour, hh = Math.floor(hr), mmn = Math.floor((hr - hh) * 60);
    this.env.textContent = `${String(hh).padStart(2, '0')}:${String(mmn).padStart(2, '0')} · ${w.target.name} · wind ${ws.toFixed(1)} m/s from ${['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(from / 45) % 8]}${flying ? '' : ' · ' + g.player.surface}`;
    if (!flying) return;
    const ac = s.ac, an = s.craft.analysis, hp = g.hpr;
    this.vSpd.textContent = ac.airspeed.toFixed(1); this.vStall.textContent = an.stallSpeed ? `stall ${an.stallSpeed.toFixed(1)}` : '';
    this.vAlt.textContent = Math.max(0, ac.agl || 0).toFixed(2); const hd = Math.round(hp.heading * 180 / Math.PI) % 360; this.vHdg.textContent = String(hd).padStart(3, '0'); this.vCard.textContent = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(hd / 45) % 8];
    this.vVs.textContent = (ac.vel[1] >= 0 ? '+' : '') + ac.vel[1].toFixed(1); this.vG.textContent = ac.gLoad.toFixed(1);
    this.bThr.style.width = Math.round(s.throttle * 100) + '%';
    const e = ac.engines[0]; this.bEn.style.width = e ? Math.round(e.energy * 100) + '%' : '0%'; this.lEnergy.textContent = !e ? 'NO ENGINE' : e.spec.sound === 'rubber' ? 'RUBBER TURNS' : e.spec.sound === 'electric' ? 'BATTERY' : 'FUEL';
    this.bCond.style.width = Math.round(ac.condition * 100) + '%'; this.bStress.style.width = Math.round(Math.min(1, ac.maxStress) * 100) + '%'; this.bStress.classList.toggle('hot', ac.maxStress > 0.75);
    const stall = ac.stall > 0.25 && !ac.onGround, low = an.stallSpeed && ac.airspeed < an.stallSpeed * 1.12 && !ac.onGround;
    this.warn.textContent = ac.destroyed ? 'WRECKED' : stall ? 'STALL' : low ? 'LOW SPEED' : ac.maxStress > 0.85 ? 'OVERSTRESS' : s.state === 'ready' ? 'HOLD SPACE TO DRAW · RELEASE TO LAUNCH' : (s.canEnd && s.everAir) ? 'ENTER: END FLIGHT' : (ac.onGround && !s.everAir && e && s.throttle < 0.05) ? (e.spec.throttle === 'none' ? 'SHIFT: START ENGINE' : 'HOLD SHIFT: THROTTLE UP') : '';
    this.warn.className = 'warnlamp' + (stall || ac.destroyed || ac.maxStress > 0.85 ? ' red' : low ? ' amber' : '');
    this.fmode.textContent = (g.save.settings.flightModel === 'accessible' ? 'Accessible Flight' : 'Simulation Flight') + (ac.hasRoll ? '' : ' · rudder steering') + (Math.abs(ac.trim) > 0.01 ? ` · trim ${ac.trim > 0 ? '+' : ''}${ac.trim.toFixed(2)}` : '');
    if (s.state === 'ready') this.chargeFill.style.width = Math.round(s.charge * 100) + '%';
    // attitude indicator
    const c = this.att.getContext('2d'), R = 48; c.save(); c.clearRect(0, 0, 96, 96); c.beginPath(); c.arc(R, R, R - 2, 0, 7); c.clip(); c.translate(R, R); c.rotate(-hp.roll); const off = hp.pitch * 70;
    c.fillStyle = '#6fa7d8'; c.fillRect(-90, -90 + off, 180, 90); c.fillStyle = '#8a6a3c'; c.fillRect(-90, off, 180, 90); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-90, off); c.lineTo(90, off);
    for (const d of [-20, -10, 10, 20]) { const y = off - d / 57.3 * 70; c.moveTo(-12, y); c.lineTo(12, y); } c.stroke(); c.restore();
    c.strokeStyle = '#ffd21f'; c.lineWidth = 3; c.beginPath(); c.moveTo(22, R); c.lineTo(40, R); c.moveTo(56, R); c.lineTo(74, R); c.stroke(); c.fillStyle = '#ffd21f'; c.fillRect(R - 2, R - 2, 4, 4);
    c.strokeStyle = 'rgba(30,22,12,.9)'; c.lineWidth = 3; c.beginPath(); c.arc(R, R, R - 2, 0, 7); c.stroke();
  }

  // ------------------------------------------------------------ flight report + replay
  report(r, extra = {}) {
    const g = this.g, cv = h('canvas.replay', { width: 620, height: 250 }), info = h('div.scrubinfo', 'Drag across the plot to inspect the flight');
    const stat = (l, v) => h('div.stat', h('span', l), h('b', v));
    const node = h('div.paper.dialog.wide.report', h('h2', r.name, h('small', ` · ${r.site} · ${r.weather}`)),
      h('div.outcome.' + (r.ok && !r.damage.length ? 'good' : r.ok ? 'warn' : 'bad'), r.outcome),
      extra.banner && h('div.banner.' + extra.banner.cls, extra.banner.text),
      h('div.stats', stat('Time airborne', fmt(r.duration, 1, ' s')), stat('Distance', fmt(r.distance, 1, ' m')), stat('Path flown', fmt(r.path, 1, ' m')), stat('Max height', fmt(r.maxAlt, 2, ' m')), stat('Max speed', fmt(r.maxSpeed, 1, ' m/s')), stat('Avg speed', fmt(r.avgSpeed, 1, ' m/s')),
        stat('Load', `${fmt(r.minG, 1)} … ${fmt(r.maxG, 1)} g`), stat('Stalls', r.stalls), stat('Mass', fmt(r.mass * 1000, 2, ' g')), stat('Energy used', r.energyUsed ? Math.round(r.energyUsed * 100) + '%' : '—'), stat('Touchdown', r.touchV != null ? fmt(r.touchV, 1, ' m/s') : '—'), stat('Airframe', Math.round(r.condition * 100) + '%')),
      cv, info,
      h('div.cols', h('div', h('h3', 'What happened'), h('ul', r.notes.map((n) => h('li', n)))),
        h('div', h('h3', 'Damage'), r.damage.length ? h('ul', r.damage.map((d) => h('li', `${d.label}: ${d.failed ? 'failed' : d.dmg + '% damaged'}`))) : h('p', 'None.'), r.events.length ? [h('h3', 'Events'), h('ul.ev', r.events.slice(0, 8).map((e) => h('li', `${e.t.toFixed(1)} s — ${e.msg}`)))] : null)),
      extra.live ? h('div.rowbtns.wrap', btn(r.damage.length ? 'Repair & fly again' : 'Fly again', () => g.flyAgain(), 'primary'), btn('Back to the bench', () => g.reportToBench()), btn('Step out', () => g.reportExit()))
        : h('div.rowbtns', btn('Back', () => this.journal())));
    this.show('report', node); this.drawReplay(cv, r, null);
    const scrub = (e) => { const b = cv.getBoundingClientRect(), k = Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)), i = Math.round(k * (r.track.length - 1)), s = r.track[i]; if (!s) return; this.drawReplay(cv, r, i);
      info.textContent = `t ${s[0].toFixed(1)} s · speed ${s[4].toFixed(1)} m/s · height ${Math.max(0, s[5]).toFixed(2)} m · angle of attack ${(s[6] * 57.3).toFixed(0)}° · ${s[7] > 0.5 ? 'STALLED' : 'flying'} · power ${Math.round(s[8] * 100)}% · ${s[9].toFixed(1)} g`; };
    cv.addEventListener('pointermove', scrub); cv.addEventListener('pointerdown', scrub);
  }
  drawReplay(cv, r, cursor) {
    const c = cv.getContext('2d'), W = cv.width, H = cv.height, tr = r.track; c.fillStyle = '#f4ead0'; c.fillRect(0, 0, W, H); if (tr.length < 2) { c.fillStyle = '#5a4a30'; c.font = 'italic 14px Georgia'; c.fillText('No flight data recorded.', 20, 30); return; }
    // top: map view (x east, z south). bottom: height + speed against time.
    const mapH = 130, pad = 14; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, yMax = 0.2, vMax = 1; for (const s of tr) { x0 = Math.min(x0, s[1]); x1 = Math.max(x1, s[1]); z0 = Math.min(z0, s[3]); z1 = Math.max(z1, s[3]); yMax = Math.max(yMax, s[2] - tr[0][2] + 0.3, s[5]); vMax = Math.max(vMax, s[4]); }
    const sc = Math.min((W - 2 * pad) / Math.max(x1 - x0, 1), (mapH - 2 * pad) / Math.max(z1 - z0, 0.6)), mx = (x) => pad + (x - x0) * sc + ((W - 2 * pad) - (x1 - x0) * sc) / 2, mz = (z) => pad + (z - z0) * sc + ((mapH - 2 * pad) - (z1 - z0) * sc) / 2;
    c.strokeStyle = 'rgba(90,70,40,.25)'; c.lineWidth = 1; for (let gx = Math.ceil(x0); gx <= x1; gx++) { c.beginPath(); c.moveTo(mx(gx), 4); c.lineTo(mx(gx), mapH - 4); c.stroke(); }
    c.font = '10px Georgia'; c.fillStyle = '#7a6a48'; c.fillText('PLAN VIEW · grid 1 m · north up', 8, 12);
    const line = (fn, col, w = 2) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); tr.forEach((s, i) => { const [x, y] = fn(s); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); };
    for (let i = 1; i < tr.length; i++) { c.strokeStyle = tr[i][7] > 0.5 ? '#c0392b' : tr[i][5] < 0.01 ? '#8a6a3c' : '#2f5f9e'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(mx(tr[i - 1][1]), mz(tr[i - 1][3])); c.lineTo(mx(tr[i][1]), mz(tr[i][3])); c.stroke(); }
    for (const e of r.events) { c.fillStyle = e.type === 'stall' ? '#c0392b' : '#1e160c'; c.beginPath(); c.arc(mx(e.x), mz(e.z), 4, 0, 7); c.fill(); }
    c.fillStyle = '#2e7d32'; c.beginPath(); c.arc(mx(tr[0][1]), mz(tr[0][3]), 5, 0, 7); c.fill();
    const T = tr[tr.length - 1][0] || 1, py = (v, max) => H - 16 - v / max * (H - mapH - 34), px = (t) => pad + t / T * (W - 2 * pad);
    c.strokeStyle = '#5a4a30'; c.lineWidth = 1; c.strokeRect(pad, mapH + 10, W - 2 * pad, H - mapH - 26);
    line((s) => [px(s[0]), py(Math.max(0, s[2] - tr[0][2] + Math.max(0, tr[0][5])), yMax)], '#2f5f9e'); line((s) => [px(s[0]), py(s[4], vMax)], '#c77d1e', 1.5);
    c.fillStyle = '#2f5f9e'; c.fillText(`height (max ${yMax.toFixed(1)} m)`, pad + 6, mapH + 24); c.fillStyle = '#c77d1e'; c.fillText(`speed (max ${vMax.toFixed(1)} m/s)`, pad + 130, mapH + 24); c.fillStyle = '#7a6a48'; c.fillText(`${T.toFixed(1)} s`, W - pad - 34, H - 4); c.fillText('0', pad, H - 4);
    for (const e of r.events) { c.strokeStyle = e.type === 'stall' ? 'rgba(192,57,43,.6)' : 'rgba(30,22,12,.6)'; c.beginPath(); c.moveTo(px(e.t), mapH + 10); c.lineTo(px(e.t), H - 16); c.stroke(); }
    if (cursor != null) { const s = tr[cursor]; c.strokeStyle = '#1e160c'; c.lineWidth = 1; c.beginPath(); c.moveTo(px(s[0]), mapH + 10); c.lineTo(px(s[0]), H - 16); c.stroke(); c.fillStyle = '#ffd21f'; c.strokeStyle = '#1e160c'; c.beginPath(); c.arc(mx(s[1]), mz(s[3]), 6, 0, 7); c.fill(); c.stroke(); }
  }

  // ------------------------------------------------------------ journal
  journal() {
    const g = this.g, J = g.save.journal, P = g.save.progress, best = (fn) => J.length ? Math.max(...J.map(fn)) : 0;
    this.show('journal', h('div.paper.dialog.wide', h('h2', 'Invention Journal'),
      h('div.stats', h('div.stat', h('span', 'Test flights'), h('b', P.flights)), h('div.stat', h('span', 'Longest flight'), h('b', fmt(best((r) => r.duration), 1, ' s'))), h('div.stat', h('span', 'Furthest'), h('b', fmt(best((r) => r.distance), 1, ' m'))), h('div.stat', h('span', 'Highest'), h('b', fmt(best((r) => r.maxAlt), 2, ' m'))), h('div.stat', h('span', 'Fastest'), h('b', fmt(best((r) => r.maxSpeed), 1, ' m/s'))), h('div.stat', h('span', 'Blueprints'), h('b', g.save.blueprints.length))),
      h('h3', 'Historical trials'), h('div.trialrow', TRIALS.map((t) => h('span.medal.' + (P.trials[t.id]?.medal || 'none'), `${t.year} ${t.title}: ${P.trials[t.id] ? P.trials[t.id].value : 'not yet flown'}`))),
      h('h3', 'Experiments (newest first). Failures are data.'),
      h('div.jlist', J.length ? J.map((r) => h('button.jrow', { onclick: () => this.report(r) }, h('b', r.name), h('span', `${r.outcome} · ${fmt(r.duration, 1)} s · ${fmt(r.distance, 1)} m · ${new Date(r.when).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`))) : h('p', 'No flights yet. Build something and throw it off the hill.')),
      h('div.rowbtns', btn('Close', () => g.resume(), 'primary'))));
  }

  // ------------------------------------------------------------ timeline + trials
  timeline() {
    const g = this.g;
    this.show('timeline', h('div.paper.dialog.wide', h('h2', 'The Wall of History'), h('p', 'Each machine solved a problem the last one could not.'),
      h('div.tl', TIMELINE.map((e) => h('div.tl-item', h('div.yr', e.year), h('div', h('b', e.title), h('p', e.text), h('p.prob', 'The problem: ' + e.problem),
        h('div.rowbtns', e.template && (g.unlocks.templates.includes(e.template) ? btn(`Study the ${TEMPLATES[e.template].name}`, () => g.openWorkshop(e.template), 'small') : h('span.lock', 'Blueprint locked: advance the Journey')),
          e.trial && btn('Fly the trial', () => this.trials(false, e.trial), 'small')))))),
      h('div.rowbtns', btn('Close', () => g.resume(), 'primary'))));
  }
  trials(fromMenu, focus) {
    const g = this.g, P = g.save.progress;
    this.show('trials', h('div.paper.dialog.wide', h('h2', 'Historical Trials'), h('p', 'Period aircraft, period conditions. The machines are flown as built: no modifications.'),
      h('div.trials', TRIALS.map((t) => h('div.trial' + (t.id === focus ? '.focus' : ''), h('div.yr', t.year), h('div', h('b', t.title), h('p', t.brief), h('p.prob', P.trials[t.id] ? `Best: ${P.trials[t.id].value} · ${P.trials[t.id].medal}` : 'Not yet completed')), btn('Fly', () => g.startTrial(t), 'primary')))),
      h('div.rowbtns', btn('Back', () => (fromMenu ? this.menu() : g.resume())))));
  }
  craftMenu(craft, onPick) {
    const g = this.g, d = craft.ac.damageReport(), an = craft.analysis;
    this.show('craft', h('div.paper.dialog', h('h2', craft.bp.name), h('p', `${fmt(an.mass * 1000, 2)} g · stall ${fmt(an.stallSpeed, 1)} m/s · airframe ${Math.round(craft.ac.condition * 100)}%`),
      h('div.col', btn('Fly from Glider Hill (catapult)', () => onPick('hill'), craft.bp.launch === 'hill' ? 'primary' : ''), btn('Fly from the launch rail', () => onPick('rail'), craft.bp.launch === 'rail' ? 'primary' : ''), btn('Fly from the grass runway', () => onPick('runway'), craft.bp.launch === 'runway' ? 'primary' : ''),
        btn('Climb in right here', () => onPick('here')), btn('Pick it up and carry it', () => onPick('carry')), d.length ? btn(`Repair (${d.length} damaged part${d.length > 1 ? 's' : ''})`, () => onPick('repair')) : null, btn('Take it back to the bench', () => onPick('bench')), btn('Cancel', () => g.resume(), 'quiet'))));
  }
}
