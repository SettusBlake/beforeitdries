/*
 * Neue Formen (Entwurf vom 30.10.2026): Vorlagen aus Tieren, Dingen, Maschinen, Pflanzen, Sagen und Kunst.
 * Der Bauplan (Gameplay) kommt weiter aus dem alten Wurf, die Vorlage innerhalb des Bauplans aus einem eigenen Zufall.
 * Jede Vorlage würfelt Pose, Körperbau und Teile frei, Mischwesen tauschen den Kopf.
 */
import type { BlueprintId, Geometry } from '../data';
import type { Rand } from '../rng';
import { ANIMALS, type Arche } from './animals';
import { finish, Kit } from './kit';
import { MORE } from './more';
import { MYTH } from './myth';
import { THINGS } from './things';

/** Alle Vorlagen. Varianten (kinds) werden zu eigenen Vorlagen und teilen sich das Gewicht */
export const ARCHES: Arche[] = [...ANIMALS, ...THINGS, ...MYTH, ...MORE].flatMap((a) =>
  a.kinds
    ? a.kinds.map((v) => ({
        id: `${a.id}:${v.k}`,
        n: v.n,
        bp: v.bp ?? a.bp,
        w: (a.w ?? 1) / a.kinds!.length,
        make: (k: Kit) => {
          k.force = v.k;
          a.make(k);
        },
      }))
    : [a],
);
export type Form = Geometry & { arche: string; name: string };

export function archesOf(bp: BlueprintId): Arche[] {
  return ARCHES.filter((a) => a.bp === bp);
}

/** Eine Form für diesen Bauplan aus einem eigenen Zufall */
export function form(bp: BlueprintId, r: Rand): Form {
  const list = archesOf(bp);
  let x = r() * list.reduce((s, a) => s + (a.w ?? 1), 0);
  let a = list[list.length - 1]!;
  for (const c of list) {
    x -= c.w ?? 1;
    if (x <= 0) {
      a = c;
      break;
    }
  }
  return formOf(a, r);
}

/** Eine Form aus einer bestimmten Vorlage (für Entwürfe und Tests) */
export function formOf(a: Arche, r: Rand): Form {
  const k = new Kit(r);
  a.make(k);
  const g = k.build();
  // Der Renderer braucht mindestens einen Klecks: sonst einer unter dem Gesicht
  if (!g.blobs.length) {
    const f = g.faces[0] ?? { x: 0.5, y: 0.5, r: 0.06 };
    g.blobs.push({ x: f.x, y: f.y, rx: f.r * 1.1, ry: f.r * 1.1, rot: 0 });
  }
  // Jedes Monster braucht ein Gesicht: sonst auf den größten Klecks
  if (!g.faces.length) {
    const b = g.blobs.reduce((p, c) => (c.rx * c.ry > p.rx * p.ry ? c : p), g.blobs[0]!);
    g.faces.push({ x: b.x, y: b.y, r: Math.min(b.rx, b.ry) * 0.8 });
  }
  finish(g, k.chance(0.5) ? -1 : 1, k.rr(0.88, 1.14), k.rr(0.88, 1.14), k.rr(-0.08, 0.08), k.rr(0.66, 0.8));
  return { ...g, top: [], arche: a.id, name: a.n };
}
