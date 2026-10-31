/*
 * Gemalte Monster prüfen (festgelegt am 30.10.2026): jede neue Zeichnung kommt in eine Prüfliste, Mods geben sie frei
 * oder übermalen sie. Übermalt verliert das Monster nur die Zeichnung und bekommt die zufällige Form aus seinem Seed,
 * Seriennummer, Seltenheit, Papier und Werte bleiben. Wer öfter übermalt wird, darf eine Zeit lang nicht malen.
 */
import type { LockedPlayer, ReviewItem, ReviewResponse } from '../shared/api';
import { GALLERY, PAINT_OVER } from '../shared/dice';
import type { DuelSave } from '../shared/duel/play';
import { GameError, isMod, withLock, type Deps } from './core';
import { loadDice, needUser, playerLock, saveDice, type Recycled } from './dice';
import { loadMe, saveMe } from './gallery';
import { K } from './keys';

const DAY = 86_400_000;
/** Übermalte Zeichnungen eines Spielers seit der letzten Aufhebung und die Sperre daraus */
type Strikes = { user: string; times: number[]; lock?: number | 'mod' };
/** Freigegeben oder übermalt: die Zeichnung mit Mod und Zeit */
type Decided = ReviewItem & { by: string; when: number };
/** Meldungen einer Zeichnung: wie oft, von wem, und ob ein Mod sie nach einer Meldung freigegeben hat */
type Reports = { n: number; by: string[]; cleared?: true };

async function needMod(d: Deps, username: string | undefined): Promise<string> {
  if (!username || !(await isMod(d, username))) throw new GameError('forbidden', 'Only for moderators.', 403);
  return username;
}
const parse = <T>(raw: string | undefined): T | null => (raw ? (JSON.parse(raw) as T) : null);
const active = (lock: Strikes['lock'], now: number): lock is number | 'mod' => lock === 'mod' || (typeof lock === 'number' && lock > now);

/** Sperre nach einer weiteren übermalten Zeichnung */
export function nextLock(times: number[], now: number, old?: number | 'mod'): number | 'mod' | undefined {
  if (old === 'mod' || times.length >= PAINT_OVER.modAt) return 'mod';
  const recent = times.filter((t) => now - t < PAINT_OVER.strikeDays * DAY).length;
  const until = recent >= PAINT_OVER.lockAt ? now + PAINT_OVER.lockDays * DAY : 0;
  const keep = typeof old === 'number' && old > now ? old : 0;
  return Math.max(until, keep) || undefined;
}

export async function reviewList(d: Deps, username: string | undefined): Promise<ReviewResponse> {
  await needMod(d, username);
  const [queue, strikes] = await Promise.all([d.redis.hGetAll(K.drawnQueue), d.redis.hGetAll(K.drawnStrikes)]);
  // Gemeldete zuerst (die meisten Meldungen oben), dann die ältesten
  const items = Object.values(queue)
    .map((x) => JSON.parse(x) as ReviewItem)
    .sort((a, b) => (b.reported ?? 0) - (a.reported ?? 0) || a.at - b.at);
  const locked: LockedPlayer[] = [];
  for (const [uid, raw] of Object.entries(strikes)) {
    const s = JSON.parse(raw) as Strikes;
    if (active(s.lock, d.now)) locked.push({ uid, user: s.user, strikes: s.times.length, lock: s.lock });
  }
  return { items, locked };
}

/** Freigeben: aus der Prüfliste, später dürfen andere sie sehen */
export async function reviewOk(d: Deps, username: string | undefined, key: unknown): Promise<ReviewResponse> {
  const mod = await needMod(d, username);
  if (typeof key !== 'string') throw new GameError('bad_request', 'Unknown drawing.');
  const item = parse<ReviewItem>(await d.redis.hGet(K.drawnQueue, key));
  if (item) {
    const { reported: _n, ...clean } = item;
    const rec: Decided = { ...clean, by: mod, when: d.now };
    await d.redis.hSet(K.drawnOk, { [key]: JSON.stringify(rec) });
    await d.redis.hDel(K.drawnQueue, [key]);
    // Nach einer Meldung freigegeben: weitere Meldungen blenden sie nicht mehr aus, sie kommt nur wieder in die Liste
    const rep = parse<Reports>(await d.redis.hGet(K.drawnReports, key));
    if (rep) await d.redis.hSet(K.drawnReports, { [key]: JSON.stringify({ ...rep, cleared: true }) });
  }
  return reviewList(d, username);
}

/**
 * Übermalen: das Monster verliert die Zeichnung (auch im Archiv, falls schon ausgewaschen), Sepia sagt es dem Spieler,
 * die Striche bleiben nur im Protokoll. Geht aus der Prüfliste und auch nach einer Freigabe.
 */
export async function reviewOver(d: Deps, username: string | undefined, key: unknown): Promise<ReviewResponse> {
  const mod = await needMod(d, username);
  if (typeof key !== 'string') throw new GameError('bad_request', 'Unknown drawing.');
  const item = parse<ReviewItem>(await d.redis.hGet(K.drawnQueue, key)) ?? parse<Decided>(await d.redis.hGet(K.drawnOk, key));
  if (!item) throw new GameError('not_found', 'That drawing is already decided.', 404);
  const old = parse<Strikes>(await d.redis.hGet(K.drawnStrikes, item.uid));
  const times = [...(old?.times ?? []), d.now];
  const lock = nextLock(times, d.now, old?.lock);
  // Unter der Sperre des Spielers, damit sein eigenes Speichern nichts überschreibt
  await withLock(d, playerLock(item.uid), async () => {
    const s = await loadDice(d, item.uid);
    const die = s.dice.find((x) => x.id === item.id);
    if (die?.draw) {
      delete die.draw;
      s.paintedOver = [...(s.paintedOver ?? []), item.no];
    }
    if (lock) s.drawLock = lock;
    await saveDice(d, item.uid, s);
  });
  // Schon ausgewaschen: im Archiv übermalen
  const arch = parse<Recycled>(await d.redis.hGet(K.recycled, String(item.seed)));
  if (arch?.die.draw && arch.die.id === item.id) {
    delete arch.die.draw;
    await d.redis.hSet(K.recycled, { [String(item.seed)]: JSON.stringify(arch) });
  }
  const strikes: Strikes = { user: item.user || old?.user || '', times, ...(lock ? { lock } : {}) };
  await d.redis.hSet(K.drawnStrikes, { [item.uid]: JSON.stringify(strikes) });
  const rec: Decided = { ...item, by: mod, when: d.now };
  await d.redis.hSet(K.drawnWashed, { [key]: JSON.stringify(rec) });
  await d.redis.hDel(K.drawnQueue, [key]);
  await d.redis.hDel(K.drawnOk, [key]);
  await d.redis.hDel(K.drawnReports, [key]);
  return reviewList(d, username);
}

/**
 * Eine fremde Zeichnung im laufenden Duell melden (slot: Würfel des Rivalen). Die erste Meldung blendet sie für alle
 * anderen aus, bis ein Mod entscheidet. Hat ein Mod sie nach einer Meldung freigegeben, kommt sie nur wieder in die Liste.
 * Höchstens GALLERY.reportsPerDay Meldungen am Tag, jede Zeichnung zählt je Spieler einmal
 */
export async function reportDrawing(d: Deps, userId: string | undefined, slot: unknown): Promise<{ reported: number; left: number }> {
  const uid = needUser(userId);
  if (!Number.isInteger(slot)) throw new GameError('bad_request', 'Unknown die.');
  return withLock(d, playerLock(uid), async () => {
    const save = parse<DuelSave>(await d.redis.get(K.duel(uid)));
    const key = save?.foeKeys?.[slot as number];
    if (!key) throw new GameError('bad_request', 'There is no drawing to report on that die.');
    const me = await loadMe(d, uid);
    const rep = parse<Reports>(await d.redis.hGet(K.drawnReports, key)) ?? { n: 0, by: [] };
    if (rep.by.includes(uid)) return { reported: rep.n, left: GALLERY.reportsPerDay - (me.reported ?? 0) };
    if ((me.reported ?? 0) >= GALLERY.reportsPerDay) throw new GameError('bad_request', 'That is enough reports for today. The moderators will catch up.');
    me.reported = (me.reported ?? 0) + 1;
    await saveMe(d, uid, me);
    rep.n++;
    rep.by.push(uid);
    await d.redis.hSet(K.drawnReports, { [key]: JSON.stringify(rep) });
    // In die Prüfliste (oben), ohne Freigabe nach der Meldung sofort ausgeblendet
    const item = parse<ReviewItem>(await d.redis.hGet(K.drawnQueue, key)) ?? parse<Decided>(await d.redis.hGet(K.drawnOk, key));
    if (item) {
      const { by: _by, when: _when, ...clean } = item as Decided;
      await d.redis.hSet(K.drawnQueue, { [key]: JSON.stringify({ ...clean, reported: rep.n }) });
      if (!rep.cleared) await d.redis.hDel(K.drawnOk, [key]);
    }
    return { reported: rep.n, left: GALLERY.reportsPerDay - me.reported };
  });
}

/** Sperre aufheben: der Spieler darf wieder malen, die Zählung beginnt neu */
export async function reviewUnlock(d: Deps, username: string | undefined, uid: unknown): Promise<ReviewResponse> {
  await needMod(d, username);
  if (typeof uid !== 'string') throw new GameError('bad_request', 'Unknown player.');
  const old = parse<Strikes>(await d.redis.hGet(K.drawnStrikes, uid));
  if (old) await d.redis.hSet(K.drawnStrikes, { [uid]: JSON.stringify({ user: old.user, times: [] }) });
  await withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    delete s.drawLock;
    await saveDice(d, uid, s);
  });
  return reviewList(d, username);
}
