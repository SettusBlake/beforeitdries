/*
 * Duelle am Server. Der Zustand liegt in Redis, alle Würfe passieren hier.
 * Laden, Aktion und Serialisieren laufen ohne await dazwischen, damit sich Anfragen nicht in die Quere kommen.
 */
import type { DuelResponse } from '../shared/api';
import { DuelError, loadState, openDuel, perform, publicState, saveState, type DuelAction, type DuelSave } from '../shared/duel/play';
import { BAG, drain, mk, newGame, type Level } from '../shared/duel/rules';
import { startTutorial, TUTORIAL_SEED, tutorialBags } from '../shared/duel/tutorial';
import { GameError, withLock, type Deps } from './core';
import { K } from './keys';

type BagRef = { sheet: string; idx: number };
const LEVELS: Level[] = ['apprentice', 'journeyman', 'master'];

function needUser(userId: string | undefined): string {
  if (!userId) throw new GameError('login', 'Log in to duel.', 401);
  return userId;
}
/** Startbeutel: 6 zufällige Würfel, einmal pro Spieler (bis es Sammlung und Gacha gibt) */
async function bagOf(d: Deps, userId: string): Promise<BagRef[]> {
  const raw = await d.redis.get(K.duelBag(userId));
  if (raw) return JSON.parse(raw) as BagRef[];
  const bag = Array.from({ length: BAG }, () => ({ sheet: `bag-${d.rand().toString(36)}`, idx: d.rand() % 12 }));
  await d.redis.set(K.duelBag(userId), JSON.stringify(bag));
  return bag;
}
/** Kopie, damit spätere Anfragen nichts mehr daran ändern */
const freeze = (r: DuelResponse): DuelResponse => JSON.parse(JSON.stringify(r)) as DuelResponse;

export async function duelGet(d: Deps, userId: string | undefined): Promise<DuelResponse> {
  const uid = needUser(userId);
  const raw = await d.redis.get(K.duel(uid));
  if (!raw) return { state: null, events: [] };
  loadState(JSON.parse(raw) as DuelSave);
  return freeze({ state: publicState(), events: [] });
}

export async function duelStart(d: Deps, userId: string | undefined, level: unknown, tutorial = false): Promise<DuelResponse> {
  const uid = needUser(userId);
  const lv = LEVELS.find((l) => l === level) ?? 'apprentice';
  return withLock(d, `duel:${uid}`, async () => {
    if (tutorial) {
      // Lern-Duell: fester Seed und feste Beutel, Sepia gibt die ersten Runden vor
      const [mine, theirs] = tutorialBags();
      newGame(TUTORIAL_SEED, 'apprentice', mine, theirs, TUTORIAL_SEED);
      startTutorial();
    } else {
      const bag = await bagOf(d, uid);
      const rival = Array.from({ length: BAG }, () => mk(`rival-${d.rand().toString(36)}`, d.rand() % 12));
      newGame(d.rand(), lv, bag.map((b) => mk(b.sheet, b.idx)), rival, d.rand());
    }
    const events = [...drain(), ...openDuel()];
    const out = freeze({ state: publicState(), events });
    const blob = saveState();
    await d.redis.set(K.duel(uid), blob);
    await d.redis.zAdd(K.duelPlayers, { member: uid, score: d.now });
    return out;
  });
}

export async function duelAct(d: Deps, userId: string | undefined, action: unknown): Promise<DuelResponse> {
  const uid = needUser(userId);
  if (!action || typeof action !== 'object' || typeof (action as { k?: unknown }).k !== 'string') throw new GameError('bad_request', 'Unknown action.');
  return withLock(d, `duel:${uid}`, async () => {
    const raw = await d.redis.get(K.duel(uid));
    if (!raw) throw new GameError('not_found', 'No duel running.', 404);
    loadState(JSON.parse(raw) as DuelSave);
    let out: DuelResponse;
    try {
      const events = perform(action as DuelAction);
      out = freeze({ state: publicState(), events });
    } catch (e) {
      if (e instanceof DuelError) throw new GameError('bad_request', e.message);
      throw e;
    }
    const blob = saveState();
    await d.redis.set(K.duel(uid), blob);
    await d.redis.zAdd(K.duelPlayers, { member: uid, score: d.now });
    return out;
  });
}
