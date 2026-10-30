/* Selbst gemalte Monster (Entwurf): Striche zu Formen, Speichern als Text */
import { describe, expect, it } from 'vitest';
import type { Pt } from '../src/shared/data';
import { DRAW, decodeDrawing, drawnGeometry, encodeDrawing, hasShape, parts, type Drawing } from '../src/shared/drawn';

const circle = (cx: number, cy: number, r: number, n = 40, gap = 0.03): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / (n - 1)) * (1 - gap) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
const line = (a: Pt, b: Pt, n = 10): Pt[] => Array.from({ length: n }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / (n - 1), a[1] + ((b[1] - a[1]) * i) / (n - 1)]);

describe('selbst malen', () => {
  it('geschlossene Striche werden Flächen, offene Linien', () => {
    const d: Drawing = { mirror: false, face: null, strokes: [circle(0.5, 0.5, 0.2), line([0.4, 0.7], [0.38, 0.9])] };
    const ps = parts(d);
    expect(ps.map((p) => p.closed)).toEqual([true, false]);
    const g = drawnGeometry(d);
    expect(g.blobs.length).toBe(1);
    expect(g.limbs.length).toBe(1);
    expect(g.faces.length).toBe(1);
  });

  it('Spiegeln: eine Hälfte an der Mitte wird mit dem Spiegelbild eine Fläche, andere Striche verdoppeln sich', () => {
    const half: Pt[] = [[0.5, 0.2], [0.3, 0.3], [0.2, 0.5], [0.3, 0.7], [0.5, 0.8]];
    const d: Drawing = { mirror: true, face: null, strokes: [half, line([0.3, 0.3], [0.2, 0.1])] };
    const ps = parts(d);
    expect(ps.filter((p) => p.closed).length).toBe(1);
    expect(ps.filter((p) => !p.closed).length).toBe(2);
    // Ein Teil über der Mitte wird nicht doppelt gemalt
    expect(parts({ mirror: true, face: null, strokes: [circle(0.5, 0.5, 0.1)] }).length).toBe(1);
  });

  it('ohne Fläche wird jeder Strich ein breiter Pinselstrich, die Zeichnung sitzt mittig in fester Größe', () => {
    const d: Drawing = { mirror: false, face: null, strokes: [line([0.1, 0.1], [0.2, 0.15]), line([0.1, 0.3], [0.3, 0.32])] };
    expect(hasShape(d)).toBe(false);
    const g = drawnGeometry(d);
    expect(g.blobs.length).toBe(2);
    expect(g.limbs.length).toBe(0);
    expect(g.blobs.every((b) => b.bare && b.pts!.length > 20)).toBe(true);
    expect(g.faces.length).toBe(1);
    const xs = [...g.blobs.flatMap((b) => b.pts!), ...g.limbs.flatMap((l) => l.pts)];
    const span = (k: 0 | 1) => Math.max(...xs.map((p) => p[k])) - Math.min(...xs.map((p) => p[k]));
    // Die Linien sind so groß wie immer, der Pinsel trägt etwas über
    expect(Math.max(span(0), span(1))).toBeGreaterThan(DRAW.size);
    expect(Math.max(span(0), span(1))).toBeLessThan(DRAW.size + 0.08);
    for (const [x, y] of xs) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(1);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(1);
    }
  });

  it('Gesicht dort, wo getippt wurde, sonst auf der obersten großen Fläche', () => {
    const body = circle(0.55, 0.6, 0.2),
      head = circle(0.3, 0.3, 0.1);
    const auto = drawnGeometry({ mirror: false, face: null, strokes: [body, head] }).faces[0]!;
    const tapped = drawnGeometry({ mirror: false, face: [0.55, 0.65], strokes: [body, head] }).faces[0]!;
    expect(auto.y).toBeLessThan(tapped.y);
  });

  it('Text hin und zurück ergibt dieselbe Form und bleibt klein', () => {
    const d: Drawing = { mirror: true, face: [0.5, 0.4], strokes: [circle(0.3, 0.5, 0.15, 200), line([0.4, 0.3], [0.3, 0.1], 30)] };
    const code = encodeDrawing(d);
    expect(code.length).toBeLessThan(500);
    const back = decodeDrawing(code)!;
    expect(back.mirror).toBe(true);
    const a = drawnGeometry(d),
      b = drawnGeometry(back);
    expect(b.blobs.length).toBe(a.blobs.length);
    expect(b.limbs.length).toBe(a.limbs.length);
    expect(b.blobs[0]!.x).toBeCloseTo(a.blobs[0]!.x, 2);
    expect(b.faces[0]!.y).toBeCloseTo(a.faces[0]!.y, 2);
  });

  it('kaputter oder zu großer Text wird abgelehnt', () => {
    for (const bad of ['', 'x.AAAA', 'n.AAA', 'n.', 'nAAAAA.AAAAAAAA', 'n.AA!AAAAA', 'n.' + 'AAAA'.repeat(DRAW.maxPts + 1), 'n' + '.AAAAAAAA'.repeat(DRAW.maxStrokes + 1)])
      expect(decodeDrawing(bad)).toBeNull();
  });
});
