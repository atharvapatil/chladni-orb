/**
 * The audible "simulated voice": synthesized pseudo-speech. A sawtooth
 * glottal buzz runs through three parallel formant bandpass filters;
 * consonant onsets (nasal murmur, plosive burst, fricative noise, liquid
 * glide) turn the vowels into CV syllables, chained into short babble
 * words with word-level intonation. Rendered offline, loops.
 */

const SR = 44100;
const DUR = 28;

// male-ish formant targets F1/F2/F3 per vowel
const VOWELS: Record<string, [number, number, number]> = {
  a: [730, 1090, 2440],
  e: [530, 1840, 2480],
  i: [270, 2290, 3010],
  o: [570, 840, 2410],
  u: [300, 870, 2240],
};
const NASAL = new Set(["m", "n"]);
const LIQUID = new Set(["l", "r", "w", "y"]);
const FRIC: Record<string, number> = { s: 5200, f: 1800, h: 1200, z: 4500 };

// babble words as [consonant, vowel] syllable pairs
const WORDS: [string, string][][] = [
  [
    ["m", "a"],
    ["m", "a"],
  ],
  [
    ["d", "a"],
    ["d", "a"],
  ],
  [
    ["b", "a"],
    ["n", "a"],
    ["n", "a"],
  ],
  [
    ["l", "a"],
    ["l", "a"],
  ],
  [
    ["l", "u"],
    ["l", "u"],
  ],
  [
    ["s", "o"],
    ["l", "o"],
  ],
  [
    ["m", "o"],
    ["m", "o"],
  ],
  [
    ["n", "a"],
    ["n", "a"],
  ],
  [
    ["d", "o"],
    ["d", "o"],
  ],
  [
    ["h", "e"],
    ["l", "o"],
  ],
  [
    ["w", "a"],
    ["w", "a"],
  ],
  [
    ["b", "a"],
    ["l", "u"],
  ],
  [
    ["g", "a"],
    ["g", "a"],
  ],
  [
    ["m", "i"],
    ["m", "i"],
  ],
];

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const b = ctx.createBuffer(1, SR, SR);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

export async function renderVoiceBuffer(): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(DUR * SR), SR);
  const master = ctx.createGain();
  master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 8;
  master.connect(comp);
  comp.connect(ctx.destination);
  const noise = noiseBuffer(ctx);
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);

  const env = (t: number, d: number, amp: number): GainNode => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp, t + 0.025);
    g.gain.setValueAtTime(amp, t + Math.max(0.03, d - 0.07));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    g.connect(master);
    return g;
  };

  // vowel: glottal buzz through three formant bandpasses
  const vowel = (
    t: number,
    d: number,
    v: string,
    f0a: number,
    f0b: number,
    amp: number,
    glide: boolean,
  ) => {
    const Fs = VOWELS[v]!;
    const out = env(t, d, amp);
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f0a, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(45, f0b), t + d);
    const fGain = [1, 0.42, 0.16];
    Fs.forEach((f, k) => {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 7;
      bp.frequency.setValueAtTime(glide ? f * 0.7 : f, t);
      if (glide) bp.frequency.linearRampToValueAtTime(f, t + Math.min(0.09, d * 0.5));
      const g = ctx.createGain();
      g.gain.value = fGain[k]!;
      o.connect(bp);
      bp.connect(g);
      g.connect(out);
    });
    o.start(t);
    o.stop(t + d + 0.02);
  };

  // nasal murmur: voiced hum through a lowpass
  const nasal = (t: number, d: number, f0: number, amp: number) => {
    const out = env(t, d, amp);
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = f0;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 450;
    o.connect(lp);
    lp.connect(out);
    o.start(t);
    o.stop(t + d);
  };

  // plosive release: a short noise burst near F2
  const burst = (t: number, f: number, amp: number) => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = f;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    s.connect(bp);
    bp.connect(g);
    g.connect(master);
    s.start(t);
    s.stop(t + 0.05);
  };

  // fricative / breath: noise through a bandpass
  const fric = (t: number, d: number, cf: number, amp: number) => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = cf;
    bp.Q.value = 1.4;
    const g = env(t, d, amp);
    s.connect(bp);
    bp.connect(g);
    s.start(t);
    s.stop(t + d + 0.05);
  };

  const syllable = (
    t: number,
    d: number,
    c: string,
    v: string,
    f0a: number,
    f0b: number,
    amp: number,
  ) => {
    let vt = t;
    if (NASAL.has(c)) {
      nasal(t, 0.09, f0a, amp * 0.5);
      vt = t + 0.07;
    } else if (LIQUID.has(c)) {
      vt = t; // vowel itself glides in
    } else if (c in FRIC) {
      fric(t, 0.1, FRIC[c]!, amp * 0.55);
      vt = t + 0.1;
    } else {
      vt = t + 0.05;
      burst(vt, VOWELS[v]![1], amp * 0.7);
    }
    vowel(vt, Math.max(0.06, d - (vt - t)), v, f0a, f0b, amp, LIQUID.has(c));
  };

  let t = 0.15;
  while (t < DUR - 2) {
    // a phrase: a few words, one intonation arc, then a breath
    const words = 3 + Math.floor(rnd(0, 4));
    const f0base = rnd(105, 135);
    for (let w = 0; w < words && t < DUR - 2; w++) {
      const word = WORDS[Math.floor(rnd(0, WORDS.length))]!;
      const question = w === words - 1 && Math.random() < 0.15;
      const n = word.length;
      for (let i = 0; i < n; i++) {
        const [c, v] = word[i]!;
        const stress = i === 0 ? 1 : 0.72;
        const pos = i / Math.max(1, n - 1);
        const f0a = f0base * (1.22 - 0.3 * pos) * (stress + 0.1);
        const f0b = f0a * (question && i === n - 1 ? 1.18 : 0.82);
        const sd = rnd(0.16, 0.24) * (i === n - 1 ? 1.35 : 1);
        syllable(t, sd, c, v, f0a, f0b, 0.8 * stress);
        t += sd;
      }
      t += rnd(0.22, 0.5); // gap between words
    }
    t += rnd(0.7, 1.4); // breath between phrases
  }

  return ctx.startRendering();
}
