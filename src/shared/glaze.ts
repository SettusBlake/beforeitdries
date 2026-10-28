/* Lasieren: Regeln wörtlich aus dem Prototyp. Der Zufall wird hereingereicht, damit nur der Server würfelt. */
import { BAUPLAENE, BP, PIG, STATS, type PigmentId, type StatKey } from './data';
import type { Monster } from './monster';
import { clamp, pick, pickIndex, ri, type Rand } from './rng';

export const MAX_GLAZES = 5;
export const MAX_RESTS = 3;

export type Relation = 'harmonisch' | 'neutral' | 'komplementaer';

interface RelDef {
  label: string;
  ok: number;
  mut: number;
  mud: number;
  min: number;
  max: number;
}

export const REL: Record<Relation, RelDef> = {
  harmonisch: { label: 'harmonious', ok: 0.85, mut: 0.03, mud: 0.02, min: 1, max: 4 },
  neutral: { label: 'neutral', ok: 0.65, mut: 0.08, mud: 0.07, min: 3, max: 7 },
  komplementaer: { label: 'complementary', ok: 0.45, mut: 0.15, mud: 0.22, min: 6, max: 12 },
};

export function relation(a: PigmentId, b: PigmentId): Relation {
  let d = Math.abs(PIG[a].hue - PIG[b].hue) % 360;
  if (d > 180) d = 360 - d;
  return d <= 60 ? 'harmonisch' : d < 130 ? 'neutral' : 'komplementaer';
}

export interface Odds extends RelDef {
  rel: Relation;
  pigCount: number;
  pity: boolean;
}

export function odds(m: Monster, pid: PigmentId): Odds {
  const rel = relation(m.main, pid);
  const o: Odds = { ...REL[rel], rel, pigCount: 0, pity: false };
  o.mut = clamp(o.mut + (m.humidity - 60) / 400, 0.01, 0.5);
  const set = new Set([m.main, ...m.sec, ...m.glazes.map((g) => g.p), pid]);
  o.pigCount = set.size;
  if (set.size > 3) o.mud += 0.1 * (set.size - 3);
  if (m.mud) o.mud = 0;
  o.mud = clamp(o.mud, 0, 0.9);
  o.pity = m.rests >= 3;
  if (o.pity) {
    o.ok = 1;
    o.mud = 0;
  }
  return o;
}

export const FLAVOR: Record<PigmentId, string> = {
  ultra: 'grainy into the tooth of the paper',
  phthalo: 'into the fibers, for good',
  karmin: 'rich over the underlayer',
  kadmium: 'opaque over the edges',
  siena: 'warm into every corner',
  indigo: 'deep into the shadows',
  sepia: 'quietly over the old layers',
  opera: 'bright, but restless, on top',
};

export type Mood = 'start' | 'ok' | 'fail' | 'mud' | 'mut' | 'pity' | 'full' | 'print';

/** Meisterin Sepia / Master Sepia: trockener Humor, kein Klamauk */
export const SEPIA: Record<Mood, readonly string[]> = {
  start: [
    "Don't open with the complementary color. Or do. I'm watching.",
    'A blot is a promise. Usually an empty one.',
    'Water first, courage after.',
    'Every layer has to dry. I do not make the rules. The water does.',
  ],
  ok: ['There. Patience is a pigment too.', "Clean. I'd still have used less water.", 'That is what a glaze looks like when it knows what it wants.'],
  fail: ['The paper said no. The paper often says no.', 'Leftover paint. Keep it. Bad luck has a ceiling.', 'Too wet. Or too dry. Usually both.'],
  mud: ["Congratulations, you've invented mud. Don't throw it away.", 'Mud has a long memory. And a line of its own.'],
  mut: ['Hm. That used to be a different animal. Write down what you did.', 'Sometimes the water paints along. Without asking.'],
  pity: ['See? Bad luck has a ceiling.'],
  full: ['Five layers. No paper takes more, and no teacher either.'],
  print: ["This print isn't yours. And it isn't mine."],
};

export const statName = (k: StatKey): string => STATS.find((s) => s.k === k)!.n;

export type LogClass = 'ok' | 'bad' | 'warn' | 'mud' | '';
export interface LogEntry {
  c: LogClass;
  h: string;
  t: string;
}

export interface GlazeResult {
  msgs: LogEntry[];
  mood: Mood;
  sepiaIdx: number;
}

/**
 * Trägt eine Lasur auf und verändert m.
 * r: Würfel für diese Lasur, glazeSeed: Seed der Farbschicht (Prototyp: beide aus Math.random).
 */
export function applyGlaze(m: Monster, pid: PigmentId, r: Rand, glazeSeed: number): GlazeResult | null {
  if (m.glazes.length >= MAX_GLAZES) return null;
  const p = PIG[pid],
    o = odds(m, pid),
    msgs: LogEntry[] = [];
  let mood: Mood;
  m.glazes.push({ p: pid, seed: glazeSeed });
  const L = 'L' + m.glazes.length + ' ';
  if (r() < o.mud) {
    m.mud = true;
    m.rests = Math.min(3, m.rests + 1);
    msgs.push({ c: 'mud', h: L + '[Muddied]', t: `Too many pigments on one sheet (${o.pigCount}). All stats -15%. Mud line unlocked.` });
    mood = 'mud';
  } else if (r() < o.ok) {
    const roll = o.pity ? Math.max(15, ri(r, 1, 20)) : ri(r, 1, 20);
    const gain = Math.round(o.min + ((o.max - o.min) * (roll - 1)) / 19),
      g2 = Math.max(1, Math.round(gain * 0.5));
    const pos = (Object.keys(p.stat) as StatKey[]).filter((k) => (p.stat[k] as number) > 0),
      all = STATS.map((s) => s.k);
    const k1 = pick(r, pos.length ? pos : all),
      k2 = pick(
        r,
        all.filter((k) => k !== k1),
      );
    m.gains[k1] = (m.gains[k1] || 0) + gain;
    m.gains[k2] = (m.gains[k2] || 0) + g2;
    if (o.pity) {
      m.rests = 0;
      msgs.push({ c: 'warn', h: L + '[Leftovers cashed in]', t: 'Guaranteed glaze, roll at least 15.' });
    }
    msgs.push({ c: 'ok', h: L + '[Glaze took]', t: `${p.n} settles ${FLAVOR[pid]}. ${statName(k1)} +${gain}, ${statName(k2)} +${g2} (roll ${roll}/20)` });
    mood = o.pity ? 'pity' : 'ok';
  } else {
    m.rests = Math.min(3, m.rests + 1);
    msgs.push({ c: 'bad', h: L + '[Glaze bled]', t: `${p.n} sank into the paper. No effect. Leftovers ${m.rests}/3.` });
    mood = 'fail';
  }
  if (r() < o.mut) {
    const old = BP[m.bp].n;
    let nb = pick(r, BAUPLAENE);
    while (nb.id === m.bp) nb = pick(r, BAUPLAENE);
    m.bp = nb.id;
    m.mutations++;
    msgs.push({ c: 'warn', h: L + '[Mutation]', t: `The glaze rewrote the shape: ${old} → ${nb.n}.` });
    mood = 'mut';
  }
  if (p.fugitive) msgs.push({ c: 'warn', h: L + '[Not lightfast]', t: 'Opera Rose fades. Without care it will lose stats over time.' });
  if (m.glazes.length === 5) {
    msgs.push({ c: '', h: L + '[Sheet full]', t: "Five glazes. The paper won't take more." });
    if (mood === 'ok') mood = 'full';
  }
  const sepiaIdx = pickIndex(r, SEPIA[mood].length);
  return { msgs, mood, sepiaIdx };
}

/** Sepias erster Satz zu einem Monster, wie im Prototyp */
export function sepiaStart(m: Monster): string {
  return m.events.print ? SEPIA.print[0]! : SEPIA.start[m.seed % SEPIA.start.length]!;
}
