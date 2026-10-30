/* Ein Monster würfeln und seine Werte berechnen. Logik wörtlich aus dem Prototyp. */
import type { StyleId } from './dice';
import {
  BAUPLAENE,
  BLOOM_TRAITS,
  BP,
  EXTRAS,
  EYES,
  LORE,
  MOUTHS,
  PAPER,
  PAPERS,
  PIG,
  PIGMENTS,
  STATS,
  SYL_A,
  SYL_B,
  type BlueprintId,
  type EyeKind,
  type ExtraKind,
  type MouthKind,
  type PaperId,
  type PigmentId,
  type StatDef,
  type StatKey,
  type StatMap,
} from './data';
import { RNG, clamp, hashStr, pick, pickIndex, ri, weighted, type Rand } from './rng';

export interface Glaze {
  p: PigmentId;
  seed: number;
}

export interface MonsterEvents {
  salt: boolean;
  alcohol: boolean;
  bloom: boolean;
  print: boolean;
}

/** Alles, was Regeln und Renderer brauchen. Das Bild selbst wird nie gespeichert. */
export interface Monster {
  seed: number;
  idx: number;
  humidity: number;
  bp: BlueprintId;
  paper: PaperId;
  main: PigmentId;
  sec: PigmentId[];
  rolls: StatMap;
  events: MonsterEvents;
  /** Index in BLOOM_TRAITS */
  bloomTrait: number;
  /** Index in LORE */
  lore: number;
  face: { eye: EyeKind; mouth: MouthKind; extra: ExtraKind };
  glazes: Glaze[];
  gains: Partial<StatMap>;
  rests: number;
  mud: boolean;
  mutations: number;
  name: string;
  /** Generation der Form: 2 = neue Formen aus Vorlagen (src/shared/forms), fehlt = Bauplan wie im Prototyp */
  gen?: 2;
  /** Selbst gemalt: die Striche als Text (src/shared/drawn.ts), ersetzen die Form */
  draw?: string;
  /** Shiny: anderer Malstil statt Aquarell */
  style?: StyleId;
}

export function makeName(r: Rand): string {
  let a = pick(r, SYL_A),
    b = pick(r, SYL_B);
  if (a.endsWith(b[0] as string)) b = b.slice(1);
  return a + b;
}

/** Luftfeuchte eines Bogens: Ganzzahl 30 bis 95 */
export function humidityFor(sheetSeed: string): number {
  return ri(RNG(hashStr('hum:' + sheetSeed)), 30, 95);
}

export function monsterSeed(sheetSeed: string, idx: number): number {
  return hashStr(sheetSeed + ':' + idx);
}

export function makeMonster(sheetSeed: string, idx: number, humidity: number): Monster {
  const seed = monsterSeed(sheetSeed, idx),
    r = RNG(seed);
  const bp = pick(r, BAUPLAENE),
    paper = weighted(r, PAPERS),
    main = pick(r, PIGMENTS);
  const secN = weighted(r, [
      { v: 0, w: 3 },
      { v: 1, w: 5 },
      { v: 2, w: 2 },
    ]).v,
    sec: PigmentId[] = [];
  while (sec.length < secN) {
    const p = pick(r, PIGMENTS);
    if (p.id !== main.id && !sec.includes(p.id)) sec.push(p.id);
  }
  const rolls = {} as StatMap;
  STATS.forEach((s) => (rolls[s.k] = ri(r, 1, 20)));
  const events: MonsterEvents = {
    salt: r() < 0.1,
    alcohol: r() < 0.085,
    bloom: r() < clamp((humidity - 35) / 150, 0.03, 0.4),
    print: r() < 1 / 90,
  };
  return {
    seed,
    idx,
    humidity,
    bp: bp.id,
    paper: paper.id,
    main: main.id,
    sec,
    rolls,
    events,
    bloomTrait: pickIndex(r, BLOOM_TRAITS.length),
    lore: pickIndex(r, LORE.length),
    face: { eye: pick(r, EYES), mouth: pick(r, MOUTHS), extra: pick(r, EXTRAS) },
    glazes: [],
    gains: {},
    rests: 0,
    mud: false,
    mutations: 0,
    name: makeName(r),
  };
}

export interface StatRow extends StatDef {
  base: number;
  pig: number;
  roll: number;
  paper: number;
  gl: number;
  total: number;
  cap: number;
  capped: boolean;
}

export function statRows(m: Monster): StatRow[] {
  const bp = BP[m.bp],
    pa = PAPER[m.paper];
  return STATS.map((s) => {
    const base = bp.base[s.k];
    const pig = (PIG[m.main].stat[s.k] || 0) + m.sec.reduce((a, id) => a + Math.round((PIG[id].stat[s.k] || 0) / 2), 0);
    const roll = m.rolls[s.k],
      gl = m.gains[s.k] || 0;
    let raw = base + pig + roll + pa.bonus + gl;
    if (m.mud) raw = Math.floor(raw * 0.85);
    const total = clamp(raw, 1, pa.cap);
    return { ...s, base, pig, roll, paper: pa.bonus, gl, total, cap: pa.cap, capped: raw > pa.cap };
  });
}

export const statSum = (m: Monster): number => statRows(m).reduce((a, s) => a + s.total, 0);

export interface Trait {
  t: string;
  c?: 'mud' | 'rare';
}

export function traitsOf(m: Monster): Trait[] {
  const t: Trait[] = [],
    main = PIG[m.main];
  if (m.mud) t.push({ t: 'Mud Line', c: 'mud' });
  if (m.events.print) t.push({ t: 'Fingerprint: signature ability', c: 'rare' });
  if (main.gran >= 0.5) t.push({ t: 'Granulating: grain bonus' });
  if (main.staining || m.sec.includes('phthalo')) t.push({ t: 'Staining: damage over 3 rounds' });
  if (main.fugitive || m.sec.includes('opera') || m.glazes.some((g) => g.p === 'opera')) t.push({ t: 'Fugitive: loses stats without care' });
  if (m.events.salt) t.push({ t: 'Salt Crystals: crit +8%' });
  if (m.events.alcohol) t.push({ t: 'Alcohol Drops: dodge +6%' });
  if (m.events.bloom) t.push({ t: 'Bloom: ' + BLOOM_TRAITS[m.bloomTrait] });
  return t;
}

/** Art = Bauplan + Hauptpigment */
export const speciesKey = (m: Pick<Monster, 'bp' | 'main'>): string => `${m.bp}:${m.main}`;
export const speciesLabel = (m: Pick<Monster, 'bp' | 'main'>): string => `${PIG[m.main].n} ${BP[m.bp].n}`;

export function humidityText(h: number): string {
  if (h < 45) return 'Dry day: crisp edges, more critical hits.';
  if (h <= 70) return 'Mild humidity: the paint behaves.';
  return 'Humid day: edges bleed, more blooms and mutations.';
}
