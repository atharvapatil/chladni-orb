/**
 * The built-in "sample" track, rendered offline so it loops like a file:
 * a synthesized live-drum groove — kick/snare/hats with a tom fill every
 * fourth bar.
 */

const SR = 44100;
const BARS = 12; // @ 100 BPM
const DUR = BARS * 4 * 0.6 + 0.4;

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const b = ctx.createBuffer(1, SR, SR);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

export async function renderSampleBuffer(): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(DUR * SR), SR);
  const master = ctx.createGain();
  master.gain.value = 0.85;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 8;
  master.connect(comp);
  comp.connect(ctx.destination);
  const noise = noiseBuffer(ctx);

  const kick = (t: number, v = 1) => {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.95 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.32);
  };
  const hit = (t: number, hp: number, dur: number, v: number) => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(master);
    s.start(t);
    s.stop(t + dur + 0.05);
  };
  const snare = (t: number, v = 1) => {
    hit(t, 1400, 0.18, 0.45 * v);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(210, t);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.14);
  };
  const tom = (t: number, f0: number) => {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.5, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.32);
  };

  for (let bar = 0; bar < BARS; bar++) {
    const bt = bar * 2.4;
    const fill = bar % 4 === 3;
    for (let b = 0; b < 4; b++) {
      const t = bt + b * 0.6;
      if (b % 2 === 0) kick(t);
      else snare(t);
      hit(t, 8000, 0.04, 0.22);
      hit(t + 0.3, 8000, b === 3 ? 0.2 : 0.04, 0.18);
    }
    if (bar % 2 === 1) kick(bt + 3 * 0.6 + 0.3, 0.7); // pickup on the and-of-4
    if (fill) {
      [220, 185, 156, 131].forEach((f, i) => tom(bt + 1.2 + i * 0.3, f));
      kick(bt + 1.8, 0.9);
    }
  }

  return ctx.startRendering();
}
