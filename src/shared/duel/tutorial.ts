/*
 * Lern-Duell: fester Seed, feste Beutel und in den ersten Runden genau ein erlaubter Schritt.
 * Der Schritt wird aus dem Zustand berechnet (wie der Meister spielen würde). Server und Client
 * rechnen dasselbe, der Server lässt nur diesen Schritt zu. Dadurch sind auch alle Würfe fest.
 */
import type { Monster } from '../monster';
import type { DuelAction } from './play';
import { RNG } from '../rng';
import { ABILITY, aiChooseDice, aiHold, aiJokerCrest, bestOpening, byGesture, bestPlacement, currentRoll, find, onSheet, S, suggest, summonable, unitById, idx } from './rules';

/** Bis zu dieser Runde gibt Sepia jeden Schritt vor */
export const TUTORIAL_ROUNDS = 3;
/** Per Suche gewählt (Fassung 6): der erste Wurf beschwört, es wird gestempelt, gespritzt, zwei Rivalen platzen, die Palette wird getroffen, eine Fähigkeit genutzt */
export const TUTORIAL_SEED = 626;

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

/** Der eine erlaubte nächste Schritt im Lern-Duell */
export function tutorialAction(): DuelAction | null {
  const me = S.teams[0];
  switch (S.phase) {
    case 'opening': {
      const b = bestOpening(1);
      return b ? { k: 'open', id: b.u.id, o: b.o, at: b.at } : null;
    }
    case 'roll':
      return { k: 'roll', ids: bestRoll() };
    case 'keep':
      return keepOrReroll();
    case 'summon': {
      const u = summonable(me, currentRoll())[0];
      const p = u ? bestPlacement(u) : null;
      return u && p ? { k: 'summon', id: u.id, o: p.o, at: p.at } : { k: 'skip' };
    }
    case 'act': {
      if (S.joker > 0) return { k: 'joker', crest: aiJokerCrest(me) };
      // Der beste Zug, der sich mit einem Wisch (oder dem Goldknopf) machen lässt
      const s = suggest(1, undefined, false, byGesture);
      return s ? { k: 'go', id: s.u.id, to: s.to, a: s.a, at: s.at } : { k: 'end' };
    }
    default:
      return null;
  }
}

/** Sepias Wahl nach dem Wurf: alles halten heißt behalten, sonst den Rest neu werfen */
export function keepOrReroll(): DuelAction {
  const rolled = currentRoll();
  const hold = aiHold(S.teams[0], rolled);
  return S.rerolls > 0 && hold.length < rolled.length ? { k: 'reroll', hold } : { k: 'keep' };
}
/** Die drei Würfel, die Sepia werfen würde (aus denen, die im Deck bereitliegen) */
export function bestRoll(): number[] {
  return aiChooseDice(S.teams[0], 0, RNG(1)).map((u) => u.id);
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
    case 'reroll': {
      const o = b as typeof a;
      return Array.isArray(o.hold) && [...a.hold].sort().join() === [...o.hold].sort().join();
    }
    case 'go': {
      const o = b as typeof a;
      const self = a.a === 'ability' && ABILITY[unitById(a.id)?.m.bp ?? 'kriecher'].target === 'self';
      return a.id === o.id && a.to === o.to && a.a === o.a && (a.a === 'soak' || self || a.at === o.at);
    }
    case 'joker': {
      const o = b as typeof a;
      return a.crest === o.crest;
    }
    default:
      return true;
  }
}
