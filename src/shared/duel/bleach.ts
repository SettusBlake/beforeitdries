/*
 * Bleach (freigegeben am 02.11.2026, docs/entwuerfe/bleach-plan.md): das Tagesblatt gegen die Bleiche vom Rand.
 * Eine Spielart des Duells: Blatt, Würfel, Kleckse, Kombis und Elemente bleiben. Die Seite des Rivalen sind die Pales,
 * ausgebleichte Kleckse ohne Würfel und ohne Palette. Sie kommen in Wellen oben herein und machen jede Runde zwei Schritte
 * nach unten. Deine Farbe kostet sie einen Schritt (sie bleichen das Feld aus), ein Klecks im Weg wird getroffen,
 * wer unten hinausrutscht, bleicht ein Herz deiner Palette (ein Guard fängt das ab).
 */
import type { PigmentId } from '../data';
import type { FaceMod } from '../dice';
import type { Monster } from '../monster';
import { RNG } from '../rng';
import {
  aiOpening,
  aiTurnSteps,
  checkWipe,
  COLS,
  count,
  emit,
  emptyCell,
  endRound,
  idx,
  inside,
  logAdd,
  newGame,
  NO_HOME,
  onSheet,
  randomBag,
  ROWS,
  S,
  setHp,
  snap,
  sync,
  unitAt,
  unitById,
  washOut,
  type Unit,
} from './rules';

/**
 * Alle Zahlen von Bleach. Eingestimmt per Simulation (simulateBleach, 02.11.2026): mit 2 Schritten, 11 Pales und schwacher
 * Lebenskraft kam nie ein Pale durch. Jetzt hält ein starker Spieler meist alle Herzen, ein schwacher verliert öfter eins oder mehr
 */
export const BLEACH = {
  /** Pales je Welle, eine Welle je Runde */
  waves: [3, 3, 3, 3, 2],
  /** Schritte je Pale und Runde */
  steps: 3,
  /** true: ein Schritt auf deine Farbe bleicht sie aus und der Pale bleibt stehen. false: er bleicht sie und rutscht hinein */
  paintStops: true,
  /** Faktor auf die Lebenskraft aller Pales (zum Einstimmen) */
  hpMul: 1,
  /** Reihe, in der eine Welle erscheint (0 = oberste, 1 = die zweite: die oberste ist schon ausgebleicht) */
  spawnRow: 1,
  /** Lebenskraft der Pales je Welle (Faktor auf die Werte des Monsters) und des großen */
  hp: [1.2, 1.4, 1.6, 1.8, 2],
  boss: 1.3,
  /** In welcher Welle der große kommt (1 bis 5), als letzter seiner Welle */
  bossWave: 3,
  /** Treffer eines Pale auf einen Klecks, der im Weg steht (je Welle, der große mehr) */
  hit: [4, 5, 6, 7, 8],
  bossHit: 3,
  /** Flick: ein Splash-Symbol trifft jeden Pale in einer Reihe */
  flick: 4,
  /** Punkte */
  points: { cell: 1, pale: 10, boss: 30, heart: 15 },
  /** Belohnung je Wertungslauf (freigegeben am 02.11.2026): Pigment und Tropfen der Tagesfarbe, zusätzlich zu den Duellen */
  reward: { pigment: 40, drops: 1 },
};

/** Ein Pale der Welle: welcher Klecks, in welcher Spalte er erscheint */
export type WavePale = { id: number; col: number };
export type BleachState = {
  /** Tag (UTC), Seed des Tages, Farbe des Tages */
  day: string;
  colour: PigmentId;
  waves: WavePale[][];
  /** Der große Pale der letzten Welle */
  boss: number;
  /** Pales, die unten hinausgerutscht sind (zählen nicht als ausgewaschen) */
  through: number[];
  /** Wertungslauf (false: Test im Playtest) */
  ranked: boolean;
};
export type BleachScore = { cells: number; layers: number; washed: number; boss: number; hearts: number; total: number };

/** Neues Tagesblatt. deck: die neun Würfel (Sepias Tagesdeck), pales: die Pales in Wellenreihenfolge */
export function newBleach(o: { seed: number; day: string; colour: PigmentId; deck: Monster[]; deckMods?: FaceMod[][]; pales: Monster[]; paleMods?: FaceMod[][]; ranked: boolean }): void {
  // Echte Werte wie im Galerie-Duell, dann wird die Seite des Rivalen zur Bleiche
  newGame(o.seed, 'gallery', o.deck, o.pales, o.seed ^ 0x5eed, o.deckMods ?? [], o.paleMods ?? []);
  S.mode = 'bleach';
  const t2 = S.teams[1];
  // Keine Palette und keine Farbe für die Bleiche
  S.cells.forEach((c, i) => {
    if (c.owner === 2 || c.home === 2) S.cells[i] = emptyCell();
  });
  t2.home = NO_HOME;
  t2.crests = { step: 0, splash: 0, guard: 0, glow: 0 };
  // Wellen: Spalten aus dem Seed, jede Welle in verschiedenen Spalten
  const r = RNG(o.seed ^ 0xb1eac4);
  let k = 0;
  const waves: WavePale[][] = [];
  BLEACH.waves.forEach((n, w) => {
    const cols = Array.from({ length: COLS }, (_, i) => i);
    for (let i = cols.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [cols[i], cols[j]] = [cols[j]!, cols[i]!];
    }
    const wave: WavePale[] = [];
    for (let i = 0; i < n && k < t2.units.length; i++, k++) {
      const u = t2.units[k]!;
      u.hp = u.max = Math.max(4, Math.round(u.max * BLEACH.hp[w]! * BLEACH.hpMul));
      wave.push({ id: u.id, col: cols[i]! });
    }
    waves.push(wave);
  });
  const boss = waves[Math.min(waves.length, BLEACH.bossWave) - 1]?.at(-1)?.id ?? -1;
  const bu = unitById(boss);
  if (bu) bu.hp = bu.max = Math.round(bu.max * BLEACH.boss);
  S.bleach = { day: o.day, colour: o.colour, waves, boss, through: [], ranked: o.ranked };
  spawnWave(1);
  S.phase = 'opening';
  sync();
}

/** Die Pales einer Welle erscheinen oben (ist ihre Spalte besetzt, die nächste freie) */
export function spawnWave(w: number): void {
  const wave = S.bleach?.waves[w - 1];
  if (!wave) return;
  let n = 0;
  for (const p of wave) {
    const u = unitById(p.id);
    if (!u || u.state !== 'bag') continue;
    const spot = freeTop(p.col);
    if (!spot) continue;
    u.state = 'sheet';
    u.x = spot[0];
    u.y = spot[1];
    n++;
    // Erscheint er auf deiner Farbe, ist sie ausgebleicht
    const i = idx(u.x, u.y);
    if (S.cells[i]!.owner !== 0 && !S.cells[i]!.home) {
      S.cells[i] = emptyCell();
      emit({ k: 'cells', how: 'bleach', cells: [snap(i)] });
    }
  }
  if (n) logAdd(`Wave ${w}: ${n} Pale${n > 1 ? 's' : ''} seep${n > 1 ? '' : 's'} in from the top edge.`, 'rival');
  sync();
}
function freeTop(col: number): [number, number] | null {
  for (let y = BLEACH.spawnRow; y < BLEACH.spawnRow + 3; y++)
    for (const dx of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5]) {
      const x = col + dx;
      if (inside(x, y) && !unitAt(x, y)) return [x, y];
    }
  return null;
}

/** Die Bleiche zieht: jeder Pale zwei Schritte nach unten, die untersten zuerst */
export function bleachMove(): void {
  if (!S.bleach) return;
  for (let step = 0; step < BLEACH.steps && !S.over; step++) {
    const pales = onSheet(S.teams[1]).sort((a, b) => b.y - a.y || a.x - b.x);
    for (const p of pales) {
      if (S.over) break;
      if (p.state !== 'sheet' || p.rooted > 0) continue;
      paleStep(p);
    }
  }
  // Eingewickelte Pales (Coil) sind eine Runde gebunden
  for (const p of S.teams[1].units) if (p.rooted > 0) p.rooted--;
  sync();
}
function paleStep(p: Unit): void {
  const from = idx(p.x, p.y);
  const ny = p.y + 1;
  // Unten hinaus oder auf die Palette: ein Herz (oder ein Guard)
  if (ny >= ROWS || S.cells[idx(p.x, ny)]!.home === 1) return breakthrough(p);
  const o = unitAt(p.x, ny);
  if (o) {
    if (o.side === 1) hitBlot(p, o);
    return;
  }
  const i = idx(p.x, ny);
  const c = S.cells[i]!;
  if (c.owner !== 0) {
    // Deine Farbe kostet ihn den Schritt: eine Schicht weniger oder ausgebleicht
    if ((c.layer ?? 0) > 0) c.layer = (c.layer ?? 0) - 1;
    else S.cells[i] = emptyCell();
    count('2bleach');
    emit({ k: 'cells', how: 'bleach', cells: [snap(i)] });
    if (BLEACH.paintStops) return;
  }
  p.y = ny;
  emit({ k: 'move', id: p.id, path: [from, i], trail: [] });
}
function hitBlot(p: Unit, o: Unit): void {
  const wave = waveOf(p.id);
  const dmg = (BLEACH.hit[wave] ?? 6) + (p.id === S.bleach?.boss ? BLEACH.bossHit : 0);
  emit({ k: 'shot', id: p.id, at: idx(o.x, o.y), res: 'hit', dmg, guard: false, rgb: [214, 210, 198], text: 'bleach' });
  setHp(o, o.hp - dmg, 'bleach');
  count('2hit');
  logAdd(`A Pale bleached into your ${o.name} (-${dmg}).`, 'rival');
  if (o.hp <= 0) logAdd(`Your ${o.name} faded: ${washOut(o).slice(2)}.`, 'rival');
  checkWipe();
}
function breakthrough(p: Unit): void {
  const me = S.teams[0];
  const at = idx(p.x, p.y);
  p.state = 'gone';
  S.bleach!.through.push(p.id);
  count('2through');
  emit({ k: 'pos', id: p.id, x: p.x, y: ROWS, how: 'drift' });
  if (me.crests.guard > 0) {
    me.crests.guard--;
    count('1caught');
    logAdd('A Pale slipped off the bottom edge. Your Guard caught it.', 'you');
    return;
  }
  me.hearts--;
  emit({ k: 'heart', side: 1, hearts: me.hearts, from: at });
  logAdd(`A Pale slipped off the bottom edge and bleached a heart: ${Math.max(0, me.hearts)} left.`, 'rival');
  if (me.hearts <= 0) {
    S.over = true;
    S.winner = 2;
    S.winReason = 'palette bleached';
  }
}
const waveOf = (id: number): number => Math.max(0, S.bleach?.waves.findIndex((w) => w.some((p) => p.id === id)) ?? 0);

/** Flick: ein Splash-Symbol, jeder Pale in dieser Reihe verliert etwas Farbe */
export function doFlick(row: number): string {
  const me = S.teams[0];
  me.crests.splash--;
  const hit = onSheet(S.teams[1]).filter((u) => u.y === row);
  count('1flick');
  const gone: string[] = [];
  for (const u of hit) {
    emit({ k: 'shot', id: u.id, at: idx(u.x, u.y), res: 'hit', dmg: BLEACH.flick, guard: false, rgb: [43, 63, 163], text: 'flick' });
    setHp(u, u.hp - BLEACH.flick, 'flick');
    if (u.hp <= 0) {
      washOut(u);
      gone.push(u.name);
    }
  }
  checkWipe();
  sync();
  return `flicked row ${row + 1}: ${hit.length} Pale${hit.length === 1 ? '' : 's'} hit${gone.length ? `, ${gone.length} washed out` : ''}`;
}
/** Der Computer (Sepia und die Simulation): Flick auf die Reihe, in der er am meisten erreicht */
export function aiFlick(): void {
  const me = S.teams[0];
  while (me.crests.splash > 0 && !S.over) {
    let best = -1,
      bv = 0;
    for (let row = 0; row < ROWS; row++) {
      const v = onSheet(S.teams[1])
        .filter((u) => u.y === row)
        .reduce((a, u) => a + Math.min(u.hp, BLEACH.flick) + (u.hp <= BLEACH.flick ? BLEACH.points.pale : 0) + row * 0.5, 0);
      if (v > bv) {
        bv = v;
        best = row;
      }
    }
    if (best < 0 || bv < BLEACH.flick) return;
    logAdd(`You ${doFlick(best)}.`, 'you');
  }
}

/** Ende einer Runde: die Bleiche zieht, die Runde trocknet, die nächste Welle kommt */
export function bleachRoundEnd(): void {
  bleachMove();
  if (!S.over && !checkWipe()) endRound();
  if (!S.over) spawnWave(S.round);
}

/** Punkte: Felder in deiner Farbe (jede Lasur-Schicht zählt mit), ausgewaschene Pales, Herzen */
export function bleachScore(): BleachScore {
  const b = S.bleach;
  let cells = 0,
    layers = 0;
  for (const c of S.cells)
    if (!c.home && c.owner === 1) {
      cells++;
      layers += c.layer ?? 0;
    }
  const gone = S.teams[1].units.filter((u) => u.state === 'gone' && !b?.through.includes(u.id));
  const boss = gone.some((u) => u.id === b?.boss) ? 1 : 0;
  const washed = gone.length - boss;
  const hearts = Math.max(0, S.teams[0].hearts);
  const P = BLEACH.points;
  return { cells, layers, washed, boss, hearts, total: (cells + layers) * P.cell + washed * P.pale + boss * P.boss + hearts * P.heart };
}

/** Viele Läufe ohne Darstellung, zum Einstimmen. look: wie viele Züge der Spieler bedenkt (0 = alle) */
export function simulateBleach(n: number, look = 0): { runs: BleachScore[]; through: number; rounds: number; flicks: number; caught: number } {
  S.headless = true;
  S.tally = {};
  const runs: BleachScore[] = [];
  let through = 0,
    rounds = 0;
  for (let g = 0; g < n; g++) {
    const seed = 5000 + g * 7919;
    const r = RNG(seed);
    const pales = [...randomBag(r, 'P'), ...randomBag(r, 'Q')].slice(0, BLEACH.waves.reduce((a, b) => a + b, 0));
    newBleach({ seed, day: 'sim', colour: 'ultra', deck: randomBag(r, 'Y'), pales, ranked: false });
    aiOpening(1, 'master');
    let guard = 0;
    while (!S.over && guard++ < 12) {
      const step = aiTurnSteps(1, look);
      while (step()) {
        /* der Spieler zieht */
      }
      if (S.over) break;
      aiFlick();
      if (S.over) break;
      bleachRoundEnd();
    }
    runs.push(bleachScore());
    through += S.bleach!.through.length;
    rounds += Math.min(S.round, BLEACH.waves.length);
  }
  S.headless = false;
  return { runs, through: through / n, rounds: rounds / n, flicks: (S.tally['1flick'] ?? 0) / n, caught: (S.tally['1caught'] ?? 0) / n };
}
