/*
 * Duelle am Server. Der Zustand liegt in Redis, alle Würfe passieren hier.
 * Laden, Aktion und Serialisieren laufen ohne await dazwischen, damit sich Anfragen nicht in die Quere kommen.
 */
import type { DuelResponse } from '../shared/api';
import { DuelError, loadState, openDuel, perform, publicState, saveState, wornDice, type DuelAction, type DuelSave } from '../shared/duel/play';
import { dieMonster } from '../shared/dice';
import type { Monster } from '../shared/monster';
import { BAG, drain, mk, newGame, S, type Level } from '../shared/duel/rules';
import { startTutorial, TUTORIAL_SEED, tutorialBags } from '../shared/duel/tutorial';
import { GameError, withLock, type Deps } from './core';
import { bagForDuel, isTester, loadDice, payDuel, playerLock } from './dice';
import { driftDice, hangDeck, payOwner, takePick } from './gallery';
import { COLOR_DEFAULT, COLOR_RIVAL, duelColors } from '../shared/colors';
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
  return s.v === 4 ? s : null;
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

/**
 * Neues Duell. gallery: gegen das Deck, das der Spieler in der Galerie gefunden hat (galleryFind),
 * mit dessen echten Werten, Lasuren, Patina und Malmitteln
 */
export async function duelStart(d: Deps, userId: string | undefined, level: unknown, tutorial = false, gallery = false, username?: string): Promise<DuelResponse> {
  const uid = needUser(userId);
  const lv = LEVELS.find((l) => l === level) ?? 'apprentice';
  return withLock(d, playerLock(uid), async () => {
    // Der Beutel kommt aus der Würfelsammlung (vor newGame, weil danach kein await mehr kommen darf)
    const bag = tutorial ? [] : await bagForDuel(d, uid);
    const mine = tutorial ? null : await loadDice(d, uid);
    const unlocked = mine?.media ?? START_MEDIA;
    const foe = gallery && !tutorial ? await takePick(d, uid) : null;
    // Normales Duell: 1 oder 2 Würfel des Rivalen treiben aus dem Archiv zurück (Test-Schalter: auch die eigenen)
    const drift = !tutorial && !foe ? await driftDice(d, uid, !!mine?.testSelf && (await isTester(d, username))) : [];
    if (tutorial) {
      // Lern-Duell: fester Seed und feste Beutel, Sepia gibt die ersten Runden vor
      // Die Formen sind nur Bild: auch das Lern-Duell zeigt die neuen (Generation 2), die Regeln bleiben gleich
      const [mine, theirs] = tutorialBags().map((b) => b.map((m) => ({ ...m, gen: 2 as const })));
      newGame(TUTORIAL_SEED, 'apprentice', mine!, theirs!, TUTORIAL_SEED);
      startTutorial();
    } else if (foe) {
      newGame(
        d.rand(),
        'gallery',
        bag.map((b) => dieMonster(b)),
        foe.theirs,
        d.rand(),
        bag.map((b) => b.mods),
        foe.mods,
      );
      S.dieIds = bag.map((b) => b.id);
      S.foeName = foe.name || 'a nameless painter';
      S.foeDice = foe.foe;
      S.foeId = foe.owner;
      S.foeKeys = foe.keys;
      S.rivalMedia = [...foe.media];
    } else {
      const rival: Monster[] = Array.from({ length: BAG }, () => ({ ...mk(`rival-${d.rand().toString(36)}`, d.rand() % 12), gen: 2 as const }));
      // Archiv-Würfel auf die letzten Plätze, mit Lasur und Patina, die sie beim Auswaschen hatten
      const slot = (i: number) => BAG - drift.length + i;
      drift.forEach((x, i) => (rival[slot(i)] = dieMonster(x.die)));
      newGame(
        d.rand(),
        lv,
        bag.map((b) => dieMonster(b)),
        rival,
        d.rand(),
        bag.map((b) => b.mods),
        rival.map((_, k) => drift[k - (BAG - drift.length)]?.die.mods ?? []),
      );
      S.dieIds = bag.map((b) => b.id);
      S.foeDice = rival.map((_, k) => {
        const x = drift[k - (BAG - drift.length)];
        return x ? { ...(x.die.no ? { no: x.die.no } : {}), ...(x.die.draw ? { drawn: 1 as const } : {}), drift: x.name } : null;
      });
      S.foeKeys = rival.map((_, k) => {
        const x = drift[k - (BAG - drift.length)];
        return x?.die.draw ? `${x.from}:${x.die.id}` : null;
      });
    }
    // Malmittel zur Wahl kommen aus den freigeschalteten (vorher geladen, nach newGame kein await mehr)
    S.unlocked = [...unlocked];
    // Spielfarben: der Gegner behält seine, du nimmst deine oder die Ausweichfarbe
    S.colors = duelColors(mine?.color, mine?.color2, foe ? (foe.color ?? COLOR_DEFAULT) : COLOR_RIVAL);
    const events = [...drain(), ...openDuel()];
    const out = freeze({ state: publicState(), events });
    const blob = saveState();
    await d.redis.set(K.duel(uid), blob);
    await d.redis.zAdd(K.duelPlayers, { member: uid, score: d.now });
    return out;
  });
}

export async function duelAct(d: Deps, userId: string | undefined, action: unknown, username?: string): Promise<DuelResponse> {
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
    const tutorial = out.state!.tutorial > 0;
    const worn = tutorial ? [] : wornDice();
    // Besitzer des Galerie-Decks (vor dem ersten await festhalten, danach kann S schon einem anderen Duell gehören)
    const owner = S.foeId;
    await d.redis.set(K.duel(uid), blob);
    await d.redis.zAdd(K.duelPlayers, { member: uid, score: d.now });
    // Pigment fürs Duell, genau einmal beim Ende. Danach hängt dein Deck in der Galerie, der Besitzer des Galerie-Decks bekommt seine Gebühr
    if (done) {
      out.reward = await payDuel(d, uid, out.state!.winner, tutorial, worn);
      if (!tutorial) await hangDeck(d, uid, username, await loadDice(d, uid));
      if (owner) await payOwner(d, owner, out.state!.winner, username);
    }
    return out;
  });
}
