/* Geräusche, komplett aus Code erzeugt (Rauschen und Töne), lizenzfrei */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted = false;

export function initAudio(): void {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.7;
      master.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}
export function setMuted(m: boolean): void {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.7;
}
export const isMuted = () => muted;

function env(g: GainNode, t: number, a: number, peak: number, d: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
/** Gefiltertes Rauschen */
function hiss(at: number, dur: number, type: BiquadFilterType, f0: number, f1: number, peak: number, q = 1): void {
  if (!ctx || !master || !noise) return;
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  env(g, t, Math.min(0.01, dur / 4), peak, dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}
/** Ein Ton mit Tonhöhenverlauf */
function tone(at: number, f0: number, f1: number, dur: number, type: OscillatorType, peak: number): void {
  if (!ctx || !master) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  env(g, t, 0.008, peak, dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const sfx = {
  tap: () => tone(0, 880, 760, 0.05, 'sine', 0.05),
  /** Würfel klappern auf dem Tisch */
  dice(n = 3): void {
    let t = 0;
    for (let k = 0; k < 9 + n * 2; k++) {
      t += 0.025 + Math.random() * 0.07 * (1 + k / 8);
      const v = 0.22 * Math.pow(0.88, k);
      hiss(t, 0.03, 'bandpass', 1800 + Math.random() * 2400, 1500, v, 4);
      if (k % 3 === 0) tone(t, 190 + Math.random() * 60, 120, 0.05, 'triangle', v * 0.5);
    }
  },
  crest: (i = 0) => tone(0, 620 + i * 90, 900 + i * 90, 0.09, 'sine', 0.07),
  brush: () => hiss(0, 0.24, 'bandpass', 700, 2600, 0.16, 1.5),
  /** Eine Würfelseite klappt um */
  flip: (i = 0) => {
    hiss(0, 0.045, 'highpass', 3000, 2500, 0.08);
    tone(0.01, 440 + i * 70, 520 + i * 70, 0.12, 'sine', 0.04);
  },
  rise: () => tone(0, 300, 600, 0.25, 'triangle', 0.06),
  step: () => hiss(0, 0.05, 'lowpass', 700, 300, 0.07),
  launch: () => hiss(0, 0.16, 'bandpass', 500, 1500, 0.08, 2),
  hit(crit = false): void {
    hiss(0, 0.18, 'lowpass', 1100, 300, crit ? 0.4 : 0.28);
    tone(0, crit ? 360 : 230, 70, crit ? 0.28 : 0.2, 'sine', crit ? 0.3 : 0.22);
    if (crit) hiss(0.02, 0.12, 'highpass', 3500, 2000, 0.12);
  },
  miss: () => hiss(0, 0.2, 'bandpass', 1200, 500, 0.06, 2),
  guard: () => {
    tone(0, 1250, 1180, 0.18, 'triangle', 0.07);
    tone(0, 1880, 1800, 0.14, 'sine', 0.04);
  },
  heal: () => tone(0, 420, 820, 0.22, 'sine', 0.06),
  heart(): void {
    hiss(0, 0.07, 'highpass', 1800, 1400, 0.25);
    hiss(0.04, 0.05, 'highpass', 2600, 2000, 0.18);
    tone(0, 95, 38, 0.45, 'sine', 0.35);
    tone(0.02, 233, 220, 0.4, 'sawtooth', 0.03);
  },
  wash(): void {
    tone(0, 520, 120, 0.6, 'sine', 0.12);
    for (let k = 0; k < 4; k++) tone(0.15 + k * 0.11, 900 - k * 120, 700 - k * 120, 0.06, 'sine', 0.04);
  },
  ability(): void {
    [523, 659, 784, 1047].forEach((f, k) => tone(k * 0.06, f, f, 0.32, 'sine', 0.06));
  },
  eraser(): void {
    tone(0, 260, 680, 0.35, 'sine', 0.05);
    tone(0.35, 680, 300, 0.35, 'sine', 0.05);
    hiss(0, 0.75, 'bandpass', 900, 1400, 0.05, 3);
  },
  bleed: () => hiss(0, 0.4, 'lowpass', 500, 900, 0.04),
  turn: () => tone(0, 660, 660, 0.35, 'sine', 0.05),
  win(): void {
    [523, 659, 784, 1047, 1319].forEach((f, k) => tone(k * 0.09, f, f, 0.45, 'sine', 0.07));
  },
  /** Ein Tropfen fällt aufs Blatt */
  drop(): void {
    tone(0, 1400, 520, 0.12, 'sine', 0.12);
    hiss(0.02, 0.18, 'lowpass', 900, 300, 0.08);
  },
  /** Der W100 rattert */
  tick: (i = 0) => tone(0, 1500 + (i % 3) * 120, 1400, 0.025, 'square', 0.015),
  /** Seltenheit wird sichtbar: je seltener, desto länger der Akkord */
  reveal(rank = 0): void {
    const notes = [392, 494, 587, 784, 988, 1175, 1568];
    notes.slice(0, 2 + rank).forEach((f, k) => tone(k * 0.08, f, f, 0.5 + rank * 0.1, rank >= 3 ? 'triangle' : 'sine', 0.06));
    if (rank >= 3) for (let k = 0; k < 6; k++) tone(0.35 + k * 0.07, 2200 + k * 180, 2600 + k * 180, 0.08, 'sine', 0.03);
  },
  /* ---------- Ziehen (Gacha) ---------- */
  /** Pinsel taucht ins Glas: Blubbern */
  dip(): void {
    hiss(0, 0.35, 'lowpass', 600, 200, 0.12);
    [0, 0.07, 0.15, 0.24].forEach((t, k) => tone(t, 260 + k * 40, 520 + k * 60, 0.07, 'sine', 0.05));
  },
  /** Pinsel hebt sich, ein Tropfen hängt an der Spitze */
  lift: () => tone(0, 520, 980, 0.35, 'sine', 0.05),
  /** Der Tropfen fällt in Zeitlupe */
  fall(): void {
    tone(0, 1700, 600, 0.9, 'sine', 0.035);
    hiss(0.1, 0.8, 'bandpass', 3000, 900, 0.03, 6);
  },
  /** Aufschlag aufs nasse Blatt */
  splash(): void {
    hiss(0, 0.5, 'lowpass', 2200, 300, 0.32);
    tone(0, 110, 40, 0.45, 'sine', 0.35);
    hiss(0.03, 0.18, 'highpass', 4000, 2500, 0.08);
  },
  /** Die Tinte blüht auf: ein Rauschen, das anschwillt, und ein weicher Akkord */
  swell(rank = 0): void {
    hiss(0, 1.3, 'bandpass', 300, 1800 + rank * 400, 0.06, 1.2);
    [262, 330, 392].forEach((f, k) => tone(0.15 + k * 0.05, f * (1 + rank * 0.06), f * (1 + rank * 0.06), 1.2, 'triangle', 0.025));
  },
  /** Der W100 schlägt auf */
  land: () => {
    tone(0, 160, 60, 0.25, 'sine', 0.3);
    hiss(0, 0.12, 'lowpass', 1200, 400, 0.15);
  },
  /** Die Farbe im Glas springt eine Seltenheit höher */
  upgrade(): void {
    [784, 988, 1319, 1568].forEach((f, k) => tone(k * 0.05, f, f * 1.01, 0.4, 'sine', 0.06));
    hiss(0, 0.3, 'highpass', 5000, 3000, 0.06);
  },
  /** Karte dreht sich */
  cardFlip: () => hiss(0, 0.28, 'bandpass', 900, 3200, 0.1, 2),
  /** Stempel auf die Karte */
  stamp(): void {
    tone(0, 140, 70, 0.18, 'sine', 0.32);
    hiss(0, 0.09, 'lowpass', 2500, 800, 0.2);
  },
  /** Funkeln für Epic und Legendary */
  shimmer(): void {
    for (let k = 0; k < 9; k++) tone(k * 0.06, 1800 + Math.random() * 1600, 2400 + Math.random() * 1400, 0.25, 'sine', 0.025);
  },
  lose(): void {
    [440, 392, 349, 294, 262].forEach((f, k) => tone(k * 0.12, f, f * 0.98, 0.5, 'triangle', 0.06));
  },
};
