/*
 * Tagesgeschenk (T8, freigegeben am 08.11.2026, docs/entwuerfe/taegliche-aktivitaet-vorschlag.md Fassung 3):
 * einmal am Tag (UTC) antippen, sieben Töpfe, danach von vorn. Wer einen Tag auslässt, macht einfach weiter.
 * Erst nach den ersten Schritten. Ein Tropfen hat die Farbe des heutigen Tagesblatts, Tag 7 ist ein Zug mit dem Loaded brush.
 */
import type { DiceResponse, GiftResult } from '../shared/api';
import { GIFTS, giftIndex, giftOpened } from '../shared/daily';
import { dayKey } from '../shared/day';
import type { PullResult } from '../shared/dice';
import { GameError, withLock, type Deps } from './core';
import { bleachDay } from './bleach';
import { claimPulls, earn, isTester, learned, loadDice, needUser, playerLock, pullOne, respond, saveDice, touch, withEarned } from './dice';
import { XP } from '../shared/rank';
import { goalDef, welcomeAway } from '../shared/weekly';

/** Das heutige Geschenk öffnen. Der Server würfelt und zahlt, ein Zug kommt wie jeder Zug in pulls */
export async function giftOpen(d: Deps, userId: string | undefined): Promise<DiceResponse & { gift: GiftResult }> {
  const uid = needUser(userId);
  const today = dayKey(d.now);
  // Farbe des Tages vor der Spielersperre (der Tagesaufbau hat seine eigene Sperre)
  const colour = (await bleachDay(d, today)).colour;
  return withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    if (!learned(s)) throw new GameError('bad_request', 'Finish your first steps with Master Sepia first.');
    if (giftOpened(s.gift, today)) throw new GameError('bad_request', 'Today’s gift is open. The next one comes at midnight UTC.');
    const i = giftIndex(s.gift);
    const g = GIFTS[i]!;
    const res: GiftResult = { day: i + 1, gift: g };
    let pulls: PullResult[] = [];
    if (g.k === 'pigment') s.pigment += g.n;
    else if (g.k === 'drop') {
      s.drops = { ...s.drops, [colour]: (s.drops?.[colour] ?? 0) + 1 };
      res.pig = colour;
    } else pulls = [pullOne(d, s, false, false, g.brush)];
    s.gift = { n: (s.gift?.n ?? 0) + 1, day: today };
    if (pulls.length) await claimPulls(d, uid, pulls);
    touch(d, s);
    // Wochenziele (T11): Geschenk, Tropfen, Zug. Erfahrung (H2) nur für den Zug
    const e = earn(d, s, XP.dip * pulls.length, { gifts: 1, drops: g.k === 'drop' ? 1 : 0, dips: pulls.length });
    await saveDice(d, uid, s);
    return withEarned({ ...respond(d, s, pulls), gift: res }, e);
  });
}

/**
 * Willkommen zurück (T10, freigegeben am 08.11.2026): nach 3 Tagen Pause ein Zug mit dem Plain brush gratis, höchstens alle 14 Tage.
 * Der Zug kommt wie jeder Zug in pulls
 */
export async function welcomeTake(d: Deps, userId: string | undefined): Promise<DiceResponse> {
  const uid = needUser(userId);
  const today = dayKey(d.now);
  return withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    if (!welcomeAway(s, today)) throw new GameError('bad_request', 'Nothing waiting. Master Sepia is busy.');
    const pulls = [pullOne(d, s, false, false, 'plain')];
    await claimPulls(d, uid, pulls);
    s.backDay = today;
    delete s.backAway;
    touch(d, s);
    const e = earn(d, s, XP.dip, { dips: 1 });
    await saveDice(d, uid, s);
    return withEarned(respond(d, s, pulls), e);
  });
}

/** Malerrang (H2): ein Zug, der als Geschenk eines neuen Titels wartet (Loaded oder Dripping brush), läuft wie jeder Zug */
export async function rankDipTake(d: Deps, userId: string | undefined): Promise<DiceResponse> {
  const uid = needUser(userId);
  return withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    const brush = s.rankDips?.[0];
    if (!brush) throw new GameError('bad_request', 'No gift dip waiting.');
    s.rankDips = s.rankDips!.slice(1);
    if (!s.rankDips.length) delete s.rankDips;
    const pulls = [pullOne(d, s, false, false, brush)];
    await claimPulls(d, uid, pulls);
    touch(d, s);
    const e = earn(d, s, XP.dip, { dips: 1 });
    await saveDice(d, uid, s);
    return withEarned(respond(d, s, pulls), e);
  });
}

/** Test-Knopf (Playtest, nur Mods): Erfahrung dazu (500), zahlt Ränge wie echt */
export async function rankTest(d: Deps, userId: string | undefined, username: string | undefined): Promise<DiceResponse> {
  const uid = needUser(userId);
  if (!(await isTester(d, username))) throw new GameError('forbidden', 'Only for moderators in a playtest.', 403);
  return withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    s.tutorialPaid = true;
    const e = earn(d, s, RANK_TEST);
    await saveDice(d, uid, s);
    return withEarned({ ...respond(d, s), tester: true }, e);
  });
}
export const RANK_TEST = 500;

/** Test-Knopf (Playtest, nur Mods): so tun, als wärst du 4 Tage weg gewesen (der Willkommens-Zug wartet dann) */
export async function welcomeTest(d: Deps, userId: string | undefined, username: string | undefined): Promise<DiceResponse> {
  const uid = needUser(userId);
  if (!(await isTester(d, username))) throw new GameError('forbidden', 'Only for moderators in a playtest.', 403);
  return withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    s.tutorialPaid = true;
    delete s.backDay;
    s.backAway = 4;
    await saveDice(d, uid, s);
    return { ...respond(d, s), tester: true };
  });
}

/** Test-Knopf (Playtest, nur Mods): das nächste offene Wochenziel gilt als erfüllt (zahlt wie echt) */
export async function weekTest(d: Deps, userId: string | undefined, username: string | undefined): Promise<DiceResponse> {
  const uid = needUser(userId);
  if (!(await isTester(d, username))) throw new GameError('forbidden', 'Only for moderators in a playtest.', 403);
  return withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    s.tutorialPaid = true;
    const wk = s.week!;
    const i = wk.ids.findIndex((_, k) => !(wk.got & (1 << k)));
    const e = earn(d, s, 0, i < 0 ? {} : { [wk.ids[i]!]: goalDef(wk.ids[i]!).n });
    await saveDice(d, uid, s);
    return withEarned({ ...respond(d, s), tester: true }, e);
  });
}

/** Test-Knopf (Playtest, nur Mods): das heutige Geschenk noch einmal öffnen können (Leiste läuft weiter) */
export async function giftTestAgain(d: Deps, userId: string | undefined, username: string | undefined): Promise<DiceResponse> {
  const uid = needUser(userId);
  if (!(await isTester(d, username))) throw new GameError('forbidden', 'Only for moderators in a playtest.', 403);
  return withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    if (s.gift) s.gift.day = '';
    await saveDice(d, uid, s);
    return { ...respond(d, s), tester: true };
  });
}
