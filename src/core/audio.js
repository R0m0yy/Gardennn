// All sound is synthesised live with WebAudio: no samples, nothing to license.
export class Audio {
  constructor() { this.ctx = null; this.vol = 0.7; this.engine = null; this.loops = {}; }
  // must be called from a user gesture
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.vol;
    const comp = c.createDynamicsCompressor(); this.master.connect(comp); comp.connect(c.destination);
    // shared noise buffers
    const mk = (pink) => { const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; l = pink ? l * 0.97 + w * 0.03 : w; d[i] = pink ? l * 6 : w; } return b; };
    this.white = mk(false); this.pink = mk(true);
    this.loops.wind = this.noiseLoop(this.pink, 'bandpass', 500, 0.6);
    this.loops.air = this.noiseLoop(this.white, 'bandpass', 1400, 0.8);
    this.loops.rain = this.noiseLoop(this.white, 'highpass', 2600, 0.5);
    this.loops.buzz = this.oscLoop('sawtooth', 190, 900);
    this.birdT = 2;
  }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; }
  noiseLoop(buf, type, f, q) { const c = this.ctx, s = c.createBufferSource(); s.buffer = buf; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(this.master); s.start(); return { g, fl }; }
  oscLoop(type, f, lp) { const c = this.ctx, o = c.createOscillator(); o.type = type; o.frequency.value = f; const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; const g = c.createGain(); g.gain.value = 0; o.connect(fl); fl.connect(g); g.connect(this.master); o.start(); return { o, g, fl }; }
  set(p, v, t = 0.08) { p.setTargetAtTime(v, this.ctx.currentTime, t); }

  // one-shot helpers
  tone(f0, f1, dur, vol = 0.2, type = 'sine', delay = 0) { if (!this.ctx) return; const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02); }
  burst(f, q, dur, vol = 0.3, type = 'bandpass', delay = 0, f1 = null) { if (!this.ctx) return; const c = this.ctx, t = c.currentTime + delay, s = c.createBufferSource(); s.buffer = this.white; s.playbackRate.value = 0.8 + Math.random() * 0.4; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur); fl.Q.value = q; const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur); s.connect(fl); fl.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.02); }
  play(name, k = 1) {
    if (!this.ctx) return;
    const r = Math.random;
    switch (name) {
      case 'step': this.burst(500 + r() * 500, 1.2, 0.06, 0.05 * k, 'bandpass'); break;
      case 'stepWood': this.tone(170 + r() * 60, 90, 0.07, 0.08 * k, 'triangle'); this.burst(1200, 1, 0.03, 0.03 * k); break;
      case 'stepMud': this.burst(260, 2, 0.12, 0.1 * k, 'lowpass'); break;
      case 'splashStep': this.burst(1500, 0.8, 0.14, 0.06 * k, 'bandpass', 0, 600); break;
      case 'jump': this.tone(240, 420, 0.1, 0.05, 'sine'); break;
      case 'land': this.burst(220, 1, 0.1, 0.12 * k, 'lowpass'); break;
      case 'click': this.tone(900, 700, 0.04, 0.06, 'square'); break;
      case 'page': this.burst(3000, 0.6, 0.18, 0.07, 'bandpass', 0, 900); break;
      case 'wood': this.tone(380 + r() * 140, 180, 0.09, 0.14, 'triangle'); this.burst(2200, 2, 0.03, 0.06); break;
      case 'paper': this.burst(4200, 0.5, 0.22, 0.09, 'highpass', 0, 1800); break;
      case 'metal': this.tone(1900 + r() * 500, 1700, 0.3, 0.05, 'sine'); this.tone(3100 + r() * 400, 2900, 0.22, 0.03, 'sine'); break;
      case 'gears': for (let i = 0; i < 6; i++) this.tone(600 + i * 40, 500, 0.03, 0.05, 'square', i * 0.05); break;
      case 'hammer': for (let i = 0; i < 3; i++) { this.tone(300, 140, 0.08, 0.16, 'triangle', i * 0.16); this.burst(2500, 3, 0.03, 0.08, 'bandpass', i * 0.16); } break;
      case 'twang': this.tone(320, 70, 0.35, 0.22, 'sawtooth'); this.burst(900, 0.7, 0.25, 0.12, 'bandpass', 0, 250); break;
      case 'thud': this.tone(120, 45, 0.18, 0.3 * k, 'sine'); this.burst(300, 0.8, 0.12, 0.2 * k, 'lowpass'); break;
      case 'crunch': this.burst(900, 0.6, 0.35, 0.4 * k, 'bandpass', 0, 200); this.tone(160, 40, 0.3, 0.3 * k, 'sawtooth'); for (let i = 0; i < 5; i++) this.burst(2000 + r() * 2500, 4, 0.05, 0.15 * k, 'bandpass', 0.05 + r() * 0.3); break;
      case 'snap': this.burst(3200, 2, 0.07, 0.35, 'bandpass'); this.tone(700, 120, 0.12, 0.2, 'square'); break;
      case 'splash': this.burst(2200, 0.5, 0.6, 0.3, 'bandpass', 0, 400); this.tone(200, 60, 0.3, 0.15); break;
      case 'creak': this.tone(90 + r() * 60, 150 + r() * 80, 0.25, 0.05 * k, 'sawtooth'); break;
      case 'chime': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.5, 0.09, 'sine', i * 0.11)); break;
      case 'fail': this.tone(300, 150, 0.4, 0.1, 'triangle'); this.tone(220, 110, 0.5, 0.08, 'triangle', 0.18); break;
      case 'hoop': this.tone(880, 1320, 0.18, 0.1, 'sine'); break;
      case 'chirp': { const f = 2400 + r() * 1800; for (let i = 0; i < 2 + (r() * 3 | 0); i++) this.tone(f, f * (1.1 + r() * 0.3), 0.07, 0.025 * k, 'sine', i * 0.11); break; }
      case 'nip': this.tone(1500, 500, 0.08, 0.1, 'square'); break;
    }
  }

  // ---- engine voices: each type has its own mechanical identity
  setEngine(kind) {
    if (!this.ctx) return; if (this.engine && this.engine.kind === kind) return; this.stopEngine(); if (!kind) return;
    const c = this.ctx, out = c.createGain(); out.gain.value = 0; out.connect(this.master);
    const e = { kind, out, oscs: [], t: 0 };
    const osc = (type, lp, gain) => { const o = c.createOscillator(); o.type = type; const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; const g = c.createGain(); g.gain.value = gain; o.connect(fl); fl.connect(g); g.connect(out); o.start(); e.oscs.push({ o, fl, g }); return o; };
    const noise = (type, f, q, gain) => { const s = c.createBufferSource(); s.buffer = this.white; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = gain; s.connect(fl); fl.connect(g); g.connect(out); s.start(); e.oscs.push({ o: s, fl, g, noise: true }); };
    const spec = { rubber: () => { osc('triangle', 600, 0.5); noise('bandpass', 900, 1.5, 0.35); e.f = [38, 30]; },
      electric: () => { osc('sawtooth', 3000, 0.12); osc('sine', 4000, 0.2); noise('bandpass', 1800, 2, 0.12); e.f = [340, 520]; e.mul = [1, 2.01]; },
      wright: () => { osc('sawtooth', 260, 0.9); osc('square', 180, 0.5); noise('bandpass', 2600, 3, 0.1); e.f = [15, 9]; e.mul = [1, 0.5]; },
      rotary: () => { osc('sawtooth', 700, 0.6); osc('square', 420, 0.35); osc('sawtooth', 1200, 0.15); e.f = [48, 30]; e.mul = [1, 0.5, 2.02]; },
      inline: () => { osc('sawtooth', 900, 0.55); osc('sawtooth', 1400, 0.3); osc('square', 300, 0.3); e.f = [62, 58]; e.mul = [1, 1.5, 0.5]; },
      jet: () => { noise('bandpass', 3200, 6, 0.5); noise('lowpass', 300, 0.5, 0.9); osc('sine', 6000, 0.08); e.f = [1500, 2500]; } }[kind];
    spec(); this.engine = e;
  }
  stopEngine() { if (!this.engine) return; const e = this.engine; this.engine = null; e.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); setTimeout(() => { e.oscs.forEach((x) => { try { x.o.stop(); } catch {} }); e.out.disconnect(); }, 500); }
  // rpm 0..~1.6, load 0..1 (how hard it is working), dist: listener distance factor 0..1
  updateEngine(rpm, load = 0.5, gain = 1) {
    const e = this.engine; if (!e || !this.ctx) return;
    const f = e.f[0] + e.f[1] * rpm, mul = e.mul || [1];
    let oi = 0; for (const x of e.oscs) { if (x.noise) { if (e.kind === 'jet') this.set(x.fl.frequency, x.fl.type === 'bandpass' ? e.f[0] + e.f[1] * rpm : 200 + 300 * rpm); continue; } this.set(x.o.frequency, f * (mul[oi] || 1) * (1 - 0.04 * load)); oi++; }
    this.set(e.out.gain, rpm > 0.02 ? (0.05 + 0.13 * Math.min(rpm, 1.2)) * gain : 0, 0.1);
  }

  // per-frame ambience. s: {wind, airspeed, rain, buzz (0..1 nearness of bees), night, stress, flying}
  ambient(dt, s) {
    if (!this.ctx) return;
    this.set(this.loops.wind.g.gain, 0.02 + Math.min(s.wind, 3) * 0.035, 0.4); this.set(this.loops.wind.fl.frequency, 350 + s.wind * 160, 0.4);
    this.set(this.loops.air.g.gain, s.flying ? Math.min(0.16, s.airspeed * s.airspeed * 0.0022) : 0, 0.15); this.set(this.loops.air.fl.frequency, 700 + s.airspeed * 170, 0.15);
    this.set(this.loops.rain.g.gain, s.rain * 0.09, 0.5);
    this.set(this.loops.buzz.g.gain, s.buzz * 0.07, 0.1); this.set(this.loops.buzz.o.frequency, 170 + s.buzz * 50 + Math.sin(performance.now() / 40) * 14, 0.02);
    this.birdT -= dt; if (this.birdT < 0) { this.birdT = (s.night > 0.5 ? 6 : 1.2) + Math.random() * 5; if (s.rain < 0.5) this.play('chirp', s.night > 0.5 ? 0.4 : 1); }
    if (s.stress > 0.75 && Math.random() < dt * 5) this.play('creak', Math.min(2, s.stress));
  }
}
