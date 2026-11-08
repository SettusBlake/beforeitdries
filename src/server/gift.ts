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
import { claimPulls, isTester, learned, loadDice, needUser, playerLock, pullOne, respond, saveDice } from './dice';

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
    await saveDice(d, uid, s);
    return { ...respond(d, s, pulls), gift: res };
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
