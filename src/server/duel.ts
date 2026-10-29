/*
 * Duelle am Server. Der Zustand liegt in Redis, alle Würfe passieren hier.
 * Laden, Aktion und Serialisieren laufen ohne await dazwischen, damit sich Anfragen nicht in die Quere kommen.
 */
import type { DuelResponse } from '../shared/api';
import { DuelError, loadState, openDuel, perform, publicState, saveState, type DuelAction, type DuelSave } from '../shared/duel/play';
import { dieMonster } from '../shared/dice';
import { BAG, drain, mk, newGame, S, type Level } from '../shared/duel/rules';
import { startTutorial, TUTORIAL_SEED, tutorialBags } from '../shared/duel/tutorial';
import { GameError, withLock, type Deps } from './core';
import { bagForDuel, loadDice, payDuel, playerLock } from './dice';
import { START_MEDIA } from '../shared/duel/media';
import { K } from './keys';

const LEVELS: Level[] = ['apprentice', 'journeyman', 'master'];

function needUser(userId: string | undefined): string {
  if (!userId) throw new GameError('login', 'Log in to duel.', 401);
  return userId;
}
/** Gespeichertes Duell. Duelle nach älteren Regeln (andere Fassung) gelten als beendet */
function parseSave(raw: string | undefined): DuelSave | null {
  if (!raw) return null;
  const s = JSON.parse(raw) as DuelSave;
  return s.v === 3 ? s : null;
}
/** Kopie, damit spätere Anfragen nichts mehr daran ändern */
const freeze = (r: DuelResponse): DuelResponse => JSON.parse(JSON.stringify(r)) as DuelResponse;

export async function duelGet(d: Deps, userId: string | undefined): Promise<DuelResponse> {
  const uid = needUser(userId);
  const save = parseSave(await d.redis.get(K.duel(uid)));
  if (!save) return { state: null, events: [] };
  loadState(save);
  return freeze({ state: publicState(), events: [] });
}

export async function duelStart(d: Deps, userId: string | undefined, level: unknown, tutorial = false): Promise<DuelResponse> {
  const uid = needUser(userId);
  const lv = LEVELS.find((l) => l === level) ?? 'apprentice';
  return withLock(d, playerLock(uid), async () => {
    // Der Beutel kommt aus der Würfelsammlung (vor newGame, weil danach kein await mehr kommen darf)
    const bag = tutorial ? [] : await bagForDuel(d, uid);
    const unlocked = tutorial ? START_MEDIA : ((await loadDice(d, uid)).media ?? START_MEDIA);
    if (tutorial) {
      // Lern-Duell: fester Seed und feste Beutel, Sepia gibt die ersten Runden vor
      const [mine, theirs] = tutorialBags();
      newGame(TUTORIAL_SEED, 'apprentice', mine, theirs, TUTORIAL_SEED);
      startTutorial();
    } else {
      const rival = Array.from({ length: BAG }, () => mk(`rival-${d.rand().toString(36)}`, d.rand() % 12));
      newGame(
        d.rand(),
        lv,
        bag.map((b) => dieMonster(b)),
        rival,
        d.rand(),
        bag.map((b) => b.mods),
      );
    }
    // Malmittel zur Wahl kommen aus den freigeschalteten (vorher geladen, nach newGame kein await mehr)
    S.unlocked = [...unlocked];
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
  return withLock(d, playerLock(uid), async () => {
    const save = parseSave(await d.redis.get(K.duel(uid)));
    if (!save) throw new GameError('not_found', 'No duel running.', 404);
    loadState(save);
    let out: DuelResponse;
    const wasOver = S.over;
    try {
      const events = perform(action as DuelAction);
      out = freeze({ state: publicState(), events });
    } catch (e) {
      if (e instanceof DuelError) throw new GameError('bad_request', e.message);
      throw e;
    }
    const blob = saveState();
    const done = !wasOver && out.state!.over;
    await d.redis.set(K.duel(uid), blob);
    await d.redis.zAdd(K.duelPlayers, { member: uid, score: d.now });
    // Pigment fürs Duell, genau einmal beim Ende
    if (done) out.reward = await payDuel(d, uid, out.state!.winner, out.state!.tutorial > 0);
    return out;
  });
}
