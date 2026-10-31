/*
 * Was die Werte eines Kleckses im Duell bewirken, in Spielworten (festgelegt am 31.10.2026, docs/entwuerfe/karte-werte-vorschlag.md).
 * Gerechnet wird gegen einen durchschnittlichen Klecks (Median aus 20 000 Zügen, gemessen am 31.10.2026),
 * im Duell mit dem, was gerade gilt (Stufe des Rivalen, Set-Bonus, Eigenschaften). Nur Anzeige, die Regeln stehen in rules.ts
 */
import { PIG, PIGMENTS, type PigmentId } from '../data';
import { relation } from '../glaze';
import { statRows as monsterStats } from '../monster';
import { baseDamage, FAMILY, FAMILY_TEXT, GAIT, has, HIT, LEVEL_POWER, moveRange, pWin, type Family, type Unit } from './rules';

export type StatKey = 'sat' | 'opa' | 'grn' | 'flo' | 'glw' | 'lf';
export const STAT_KEYS: StatKey[] = ['sat', 'opa', 'grn', 'flo', 'glw', 'lf'];
export const STAT_LABEL: Record<StatKey, string> = { sat: 'Saturation', opa: 'Opacity', grn: 'Grain', flo: 'Flow', glw: 'Glow', lf: 'Lightfast' };

/** Zehntel der Werte über alle Monster (20 000 Züge, 31.10.2026): Index 0 kleinster, 5 Mitte, 10 größter */
export const STAT_DECILES: Record<StatKey, number[]> = {
  sat: [7, 15, 18, 20, 22, 24, 26, 28, 31, 34, 46],
  opa: [9, 15, 18, 20, 23, 25, 27, 29, 31, 34, 47],
  grn: [7, 13, 16, 19, 21, 23, 25, 27, 29, 32, 45],
  flo: [5, 12, 15, 17, 19, 21, 23, 25, 27, 30, 40],
  glw: [7, 14, 17, 20, 22, 24, 26, 28, 31, 34, 47],
  lf: [2, 11, 14, 16, 18, 20, 22, 24, 27, 29, 40],
};
/** Der durchschnittliche Klecks, gegen den die Karte rechnet */
export const AVERAGE: Record<StatKey, number> = { sat: 24, opa: 25, grn: 23, flo: 21, glw: 24, lf: 20 };

/** Anteil aller Kleckse mit einem kleineren Wert, 0 bis 1 (zwischen den Zehnteln gerade verbunden) */
export function share(k: StatKey, v: number): number {
  const d = STAT_DECILES[k];
  if (v <= d[0]!) return 0;
  if (v >= d[10]!) return 1;
  for (let i = 0; i < 10; i++) if (v <= d[i + 1]!) return (i + (v - d[i]!) / Math.max(1, d[i + 1]! - d[i]!)) / 10;
  return 1;
}

/** Eine Zeile: Wert, Anteil, Wirkung als Paare (Wort, Zahl), Erklärung beim Antippen */
export type StatRow = { k: StatKey; label: string; v: number; share: number; parts: [string, string][]; help: string };

const b5 = (v: number) => Math.round(v / 5);
const pc = (p: number) => `${Math.round(p * 100)}%`;
const statOf = (u: Unit, k: StatKey): number => (k === 'lf' ? u.lf : u[k]);

/** Ein durchschnittlicher Gegner mit einem Pigment, das zu diesem Klecks neutral steht */
function averageFoe(u: Unit): Unit {
  const main = PIGMENTS.map((p) => p.id).find((p) => relation(u.m.main, p) === 'neutral') ?? u.m.main;
  return { ...u, side: u.side === 1 ? 2 : 1, sat: AVERAGE.sat, opa: AVERAGE.opa, grn: AVERAGE.grn, flo: AVERAGE.flo, glw: AVERAGE.glw, lf: AVERAGE.lf, traits: [], shield: 0, m: { ...u.m, main } };
}
const dodge = (flo: number, u?: Unit) => Math.min(0.4, flo / 400 + (u && has(u, 'alcohol') ? 0.06 : 0) + (u && has(u, 'bloom4') ? 0.05 : 0));
/** Chance, dass a + W20 mindestens 18 zeigt (Radierer) */
const eraserSave = (lf: number) => Math.min(20, Math.max(0, 3 + b5(lf))) / 20;

/**
 * live: im Duell, mit Set-Bonus und Malmitteln, die gerade gelten. In der Sammlung ohne (der Zustand des Duells
 * kann dort noch von einem früheren Duell stammen)
 */
export function statRows(u: Unit, live: boolean): StatRow[] {
  const gait = GAIT[u.m.bp].key;
  const dmg = live
    ? baseDamage(u, averageFoe(u), u.m.main, false)
    : Math.max(1, Math.round((HIT.base + u.sat / HIT.satDiv + (has(u, 'fugitive') ? 2 : 0)) * (gait === 'twin' ? 0.6 : 1)));
  const full = pWin(b5(u.sat) + HIT.toHit, b5(AVERAGE.grn)) * (1 - dodge(AVERAGE.flo));
  const cover = pWin(b5(u.opa) + (has(u, 'bloom2') ? 2 : 0), b5(AVERAGE.grn));
  const grazed = 1 - pWin(b5(AVERAGE.sat) + HIT.toHit, b5(u.grn + (u.shield > 0 ? 25 : 0)));
  const holds = 1 - pWin(b5(AVERAGE.opa), b5(u.grn) + (has(u, 'granulating') ? 2 : 0));
  const reach = live ? moveRange(u) : gait === 'tower' ? 0 : Math.min(5, 2 + Math.floor(u.flo / 15) + (gait === 'fast' ? 1 : 0));
  const glowFaces = u.faces.filter((f) => f.k === 'glow' || f.k2 === 'glow' || f.k === 'gold');
  const glowN = glowFaces.reduce((a, f) => a + (f.k === 'glow' ? f.n : 1), 0);
  const parts: Record<StatKey, [string, string][]> = {
    sat: [
      ['Splash', String(dmg)],
      ['full hit', pc(full)],
    ],
    opa: [
      ['Life', String(u.max)],
      ['covers dry paint', pc(cover)],
    ],
    grn: [
      ['Splashes graze it', pc(grazed)],
      ['its paint holds', pc(holds)],
    ],
    flo: [
      gait === 'tower' ? ['Never moves', ''] : ['Reach', String(reach)],
      ['dodge', pc(dodge(u.flo, u))],
      ['wet paint spreads', pc(Math.min(0.85, u.flo / 40))],
    ],
    glw: glowFaces.length
      ? [['Glow on', `${glowFaces.length} face${glowFaces.length > 1 ? 's' : ''}${glowN > glowFaces.length ? ` (${glowN} Glow)` : ''}`]]
      : [['No Glow face', '']],
    lf: [['Escapes the eraser', pc(eraserSave(u.lf))]],
  };
  const help: Record<StatKey, string> = {
    sat: `Splash damage is ${HIT.base} + Saturation/4. A splash rolls Saturation/5 + ${HIT.toHit} + d20 against the target's Grain/5 + d20: win for a full hit, lose for a graze at half. Saturation also brings Splash faces.`,
    opa: `Opacity is its life: ${HIT.hpBase} + Opacity/3. Stamping over dried rival paint rolls Opacity/5 + d20 against that paint's Grain/5 + d20. Opacity or Grain, whichever is higher, brings Guard faces.`,
    grn: 'Grain defends: Grain/5 + d20 against every splash, and its dried paint defends the same way against stamps. Grain or Opacity, whichever is higher, brings Guard faces.',
    flo: 'Reach is 2 + Flow/15, at most 5. Own paint costs 1 a cell, blank paper 2. Dodge is Flow/400. When a round ends, its wet paint spreads to free paper with Flow/40. Flow also brings Step faces.',
    glw: 'Glow works through the die: a rolled Glow pours 1 into the brim of each of your blots on the sheet. A full brim turns the next move into a master stroke.',
    lf: 'When the eraser sweeps a row, the blot and its paint roll d20 + Lightfast/5 and stay at 18 or more.',
  };
  return STAT_KEYS.map((k) => ({ k, label: STAT_LABEL[k], v: statOf(u, k), share: share(k, statOf(u, k)), parts: parts[k], help: help[k] }));
}

/**
 * Stufe aus der Summe der fünf Duell-Werte (Lichtechtheit zählt nicht). Gezählt werden die Werte des Würfels selbst:
 * beim Rivalen des Computers sind sie im Duell je nach Stufe des Rivalen verändert, seine Stufe bleibt aber die seines Würfels
 */
export function levelInfo(u: Unit): { lv: number; total: number; next: number | null; help: string } {
  const base = Object.fromEntries(monsterStats(u.m).map((r) => [r.k, r.total]));
  const total = (base.saettigung ?? 0) + (base.deckkraft ?? 0) + (base.koernung ?? 0) + (base.fluss ?? 0) + (base.leuchten ?? 0);
  return {
    lv: u.lv,
    total,
    next: u.lv < 3 ? LEVEL_POWER[u.lv - 1]! : null,
    help: `Saturation, Opacity, Grain, Flow and Glow add up to its level: ${LEVEL_POWER[0]} for Level 2, ${LEVEL_POWER[1]} for Level 3. A higher level needs more stars to summon, and its own star faces count more.`,
  };
}

/** Farbe: Familie, Set-Bonus und gegen welche Pigmente Treffer stärker oder schwächer sind (gilt in beide Richtungen) */
export function colourInfo(u: Unit): { name: string; fam: Family; strong: string[]; weak: string[]; set: [string, string] } {
  const ids = PIGMENTS.map((p) => p.id);
  const pick = (r: string) => ids.filter((p: PigmentId) => p !== u.m.main && relation(u.m.main, p) === r).map((p) => PIG[p].n);
  return { name: PIG[u.m.main].n, fam: FAMILY[u.m.main], strong: pick('komplementaer'), weak: pick('harmonisch'), set: FAMILY_TEXT[FAMILY[u.m.main]] };
}
