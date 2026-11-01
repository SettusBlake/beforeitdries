/*
 * Elemente (freigegeben am 01.11.2026, docs/entwuerfe/elemente-vorschlag.md): jedes Monster trägt ein Element, sein eigener
 * Wurf aus dem Seed (1 zu 6, unabhängig von Pigment und Form). Die sechs stehen in einem Ring: jedes schlägt das nächste ×2
 * und das übernächste ×1,25, alles andere trifft normal. Gilt für Spritzer auf Kleckse und ersetzt dort den Farbkreis.
 */
import { RNG } from './rng';

export type ElementId = 'wash' | 'vermilion' | 'gilt' | 'sap' | 'ochre' | 'fluoro';
export type ElementDef = { k: ElementId; name: string; col: string; beats: string; little: string };
/** In Ringreihenfolge: jedes schlägt das nächste hart und das übernächste ein wenig */
export const ELEMENTS: ElementDef[] = [
  { k: 'wash', name: 'Wash', col: '#2f74b5', beats: 'puts out', little: 'rusts' },
  { k: 'vermilion', name: 'Vermilion', col: '#c8502a', beats: 'melts', little: 'burns' },
  { k: 'gilt', name: 'Gilt', col: '#a8842c', beats: 'cuts', little: 'digs up' },
  { k: 'sap', name: 'Sap', col: '#3f8a3a', beats: 'splits', little: 'soaks up' },
  { k: 'ochre', name: 'Ochre', col: '#a8701f', beats: 'grounds', little: 'dams' },
  { k: 'fluoro', name: 'Fluoro', col: '#d6337e', beats: 'strikes', little: 'outshines' },
];
/** Stärke (Variante A): das nächste im Ring ×2, das übernächste ×1,25 */
export const ELEMENT_MULT = { next: 2, after: 1.25 };
const at = (k: ElementId): number => ELEMENTS.findIndex((e) => e.k === k);
export const elementDef = (k: ElementId): ElementDef => ELEMENTS[at(k)]!;
/** Das Element eines Monsters: eigener Zufall aus dem Seed, kein anderer Wurf wird dadurch verschoben */
export const elementOf = (m: { seed: number }): ElementId => ELEMENTS[Math.floor(RNG(m.seed ^ 0xe1e3)() * ELEMENTS.length)]!.k;
/** Abstand im Ring von a nach b (1: a schlägt b hart, 2: ein wenig) */
const step = (a: ElementId, b: ElementId): number => (at(b) - at(a) + ELEMENTS.length) % ELEMENTS.length;
/** Multiplikator, wenn a auf b spritzt */
export function elementMult(a: ElementId, b: ElementId): number {
  const d = step(a, b);
  return d === 1 ? ELEMENT_MULT.next : d === 2 ? ELEMENT_MULT.after : 1;
}
/** „Wash puts out Vermilion“, „Wash rusts Gilt“, sonst null */
export function elementLine(a: ElementId, b: ElementId): string | null {
  const d = step(a, b);
  if (d !== 1 && d !== 2) return null;
  return `${elementDef(a).name} ${d === 1 ? elementDef(a).beats : elementDef(a).little} ${elementDef(b).name}`;
}
/** Wen ein Element schlägt: hart (×2) und ein wenig (×1,25) */
export function elementPrey(a: ElementId): { hard: ElementId; little: ElementId } {
  const i = at(a);
  return { hard: ELEMENTS[(i + 1) % ELEMENTS.length]!.k, little: ELEMENTS[(i + 2) % ELEMENTS.length]!.k };
}
/** Wer dieses Element schlägt (für die Karte) */
export function elementFoes(b: ElementId): { hard: ElementId; little: ElementId } {
  const i = at(b);
  const n = ELEMENTS.length;
  return { hard: ELEMENTS[(i - 1 + n) % n]!.k, little: ELEMENTS[(i - 2 + n) % n]!.k };
}
export const isElement = (v: unknown): v is ElementId => ELEMENTS.some((e) => e.k === v);
