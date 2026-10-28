/*
 * Lern-Duell: fester Seed, feste Beutel und in den ersten Runden genau ein erlaubter Schritt.
 * Der Schritt wird aus dem Zustand berechnet (wie der Meister spielen würde). Server und Client
 * rechnen dasselbe, der Server lässt nur diesen Schritt zu. Dadurch sind auch alle Würfe fest.
 */
import type { Monster } from '../monster';
import type { DuelAction } from './play';
import { bestOpening, bestPlacement, find, living, onSheet, ROLL_N, S, suggest, summonable, unitById, idx, type Rolled } from './rules';

/** Bis zu dieser Runde gibt Sepia jeden Schritt vor */
export const TUTORIAL_ROUNDS = 3;
/** Per Suche gewählt: der erste Wurf beschwört, dann wird trocken und nass gestempelt, gespritzt, die Palette getroffen und eine Fähigkeit genutzt */
export const TUTORIAL_SEED = 262;

export function tutorialBags(): [Monster[], Monster[]] {
  return [
    [find('schlange', 'ultra', 'A', true), find('flatterer', 'kadmium', 'B'), find('huepfer', 'phthalo', 'C'), find('vierbeiner', 'karmin', 'G'), find('knolle', 'sepia', 'H'), find('strahler', 'indigo', 'I')],
    [find('krabbe', 'siena', 'D'), find('qualle', 'karmin', 'E'), find('strahler', 'opera', 'F'), find('kriecher', 'indigo', 'J'), find('turm', 'phthalo', 'K'), find('doppelkopf', 'kadmium', 'L')],
  ];
}

export const tutorialActive = (): boolean => S.tutorial > 0 && !S.over && S.round <= S.tutorial;

/** Lern-Duell vorbereiten: Sepia leiht zwei Glow, damit man eine Fähigkeit sieht */
export function startTutorial(): void {
  S.tutorial = TUTORIAL_ROUNDS;
  S.teams[0].crests.glow = 2;
}

function rolledNow(): Rolled[] {
  return S.lastRoll.map((r) => {
    const u = unitById(r.id)!;
    return { u, fi: r.fi, face: u.faces[r.fi]! };
  });
}

/** Der eine erlaubte nächste Schritt im Lern-Duell */
export function tutorialAction(): DuelAction | null {
  const me = S.teams[0];
  switch (S.phase) {
    case 'opening': {
      const b = bestOpening(1);
      return b ? { k: 'open', id: b.u.id, o: b.o, at: b.at } : null;
    }
    case 'roll': {
      const l = living(me);
      const ids = [...l.filter((u) => u.state === 'bag'), ...l.filter((u) => u.state === 'sheet')].slice(0, Math.min(ROLL_N, l.length)).map((u) => u.id);
      return { k: 'roll', ids };
    }
    case 'summon': {
      const u = summonable(me, rolledNow())[0];
      const p = u ? bestPlacement(u) : null;
      return u && p ? { k: 'summon', id: u.id, o: p.o, at: p.at } : { k: 'skip' };
    }
    case 'act': {
      // Erst den Klecks fertig machen, der schon gezogen hat (oder gerade aufgeklappt wurde)
      for (const u of onSheet(me)) {
        if (!u.moved || u.acted) continue;
        const s = suggest(1, u, true);
        if (s) return { k: 'act', id: u.id, a: s.a, pig: s.pig, at: s.at };
      }
      const pending = onSheet(me).filter((u) => !u.acted && !u.moved);
      for (const u of pending) {
        const s = suggest(1, u);
        if (!s) continue;
        if (s.to !== idx(u.x, u.y)) return { k: 'move', id: u.id, to: s.to };
        return { k: 'act', id: u.id, a: s.a, pig: s.pig, at: s.at };
      }
      return { k: 'end' };
    }
    default:
      return null;
  }
}

export function sameAction(a: DuelAction, b: DuelAction): boolean {
  if (a.k !== b.k) return false;
  switch (a.k) {
    case 'open':
    case 'summon': {
      const o = b as typeof a;
      return a.id === o.id && a.o === o.o && a.at === o.at;
    }
    case 'roll': {
      const o = b as typeof a;
      return Array.isArray(o.ids) && [...a.ids].sort().join() === [...o.ids].sort().join();
    }
    case 'move': {
      const o = b as typeof a;
      return a.id === o.id && a.to === o.to;
    }
    case 'act': {
      const o = b as typeof a;
      return a.id === o.id && a.a === o.a && a.at === o.at && (a.a === 'soak' || a.a === 'ability' || a.pig === o.pig);
    }
    default:
      return true;
  }
}
