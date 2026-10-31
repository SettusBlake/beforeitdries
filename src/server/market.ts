/*
 * Tausch und Markt (festgelegt am 31.10.2026, docs/entwuerfe/tausch-und-markt-plan.md). Nur gegen Pigment, nie gegen Geld
 * oder Reddit Gold. Würfel und Pigment in einem Angebot oder im Markt liegen dort und nicht mehr in der Sammlung, bis es endet.
 * Was ein anderer Spieler bekommt, geht als Lieferung nach deliver:{id} und wird bei seinem nächsten Laden unter seiner
 * Sperre abgeholt. So wartet nie ein Spieler auf die Sperre eines anderen, und nichts geht verloren, wenn er gerade spielt.
 */
import type { MarketFilter, MarketItem, MarketResponse, MarketSort, TradeCollection, TradeGate, TradeOffer, TradeResponse, TradeStatus } from '../shared/api';
import { dayKey } from '../shared/day';
import { defaultBand, dieMonster, KEEP_MIN, marketFee, priceKey, rarityIndex, TRADE, type DiceSave, type DieRec, type Hist, type News, type Rarity } from '../shared/dice';
import { dieUnit } from '../shared/duel/rules';
import { monsterSeed } from '../shared/monster';
import { GameError, withLock, type Deps } from './core';
import { claimPulls, isPlaytest, isTester, loadDice, needUser, playerLock, pullOne, respond, saveDice } from './dice';
import { K } from './keys';

const DAY = 86_400_000;
const FAR = 9e15;
const parse = <T>(raw: string | undefined | null): T | null => (raw ? (JSON.parse(raw) as T) : null);
const isTest = (uid: string): boolean => uid.startsWith('test:');
const unitOf = (x: DieRec) => dieUnit(dieMonster(x), x.mods);
const rarityOfDie = (x: DieRec): Rarity => unitOf(x).rarity;
const dieName = (x: DieRec): string => unitOf(x).name;
const seedOf = (x: DieRec): string => String(monsterSeed(x.sheet, x.idx));
/** u/name für Reddit-Namen, sonst wie gespeichert */
const tag = (n: string): string => (/^[\w-]{2,}$/.test(n) ? `u/${n}` : n || 'a painter');
const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const names = (xs: DieRec[]): string => xs.map(dieName).join(', ');

/** Ein Würfel unterwegs und der Schlüssel seiner Zeichnung beim bisherigen Besitzer (die Freigabe wandert mit) */
type Moving = { die: DieRec; from: string };
/** Lieferung an einen Spieler: Würfel, Pigment und was Sepia ihm sagt */
type Delivery = { id: string; k: News['k']; dice?: Moving[]; pig?: number; text: string; at: number; by?: string };
type MarketRec = { id: string; seller: string; name: string; die: DieRec; from: string; price: number; at: number; until: number; rarity: Rarity };
type TradeRec = { id: string; from: string; fromName: string; to: string; toName: string; give: Moving[]; pig: number; want: DieRec[]; at: number; until: number };

/* ---------- Namen ---------- */

/** Reddit-Name merken (bei jedem Besuch), damit andere per u/Name tauschen können */
export async function rememberName(d: Pick<Deps, 'redis'>, uid: string, name: string | undefined): Promise<void> {
  if (!name) return;
  await d.redis.hSet(K.names, { [name.toLowerCase()]: uid });
  await d.redis.hSet(K.nameOf, { [uid]: name });
}
const nameOf = async (d: Pick<Deps, 'redis'>, uid: string): Promise<string> => (await d.redis.hGet(K.nameOf, uid)) ?? '';
async function uidOf(d: Pick<Deps, 'redis'>, name: string): Promise<string | null> {
  const n = name
    .trim()
    .replace(/^\/?u\//i, '')
    .toLowerCase();
  return n ? ((await d.redis.hGet(K.names, n)) ?? null) : null;
}

/* ---------- Wer darf handeln ---------- */

function today(d: Pick<Deps, 'now'>, s: DiceSave): void {
  const k = dayKey(d.now);
  if (s.tradeDay === k) return;
  s.tradeDay = k;
  s.tradeN = 0;
  s.buyN = 0;
}
/**
 * Handeln ab TRADE.minDuels fertigen Duellen und einem Reddit-Konto von TRADE.minDays Tagen (Schutz vor Zweitkonten).
 * Kennt der Server das Alter nicht, zählen nur die Duelle. Mods im Playtest und Test-Händler dürfen immer
 */
export async function tradeGate(d: Deps, uid: string, s: DiceSave, tester: boolean): Promise<TradeGate> {
  if (tester || isTest(uid)) return { ok: true };
  const n = s.duels ?? 0;
  if (n < TRADE.minDuels) {
    const left = TRADE.minDuels - n;
    return { ok: false, why: `Finish ${left} more duel${left > 1 ? 's' : ''} to trade.` };
  }
  if (s.born === undefined && d.reddit.getUserById && uid.startsWith('t2_')) {
    try {
      const u = await d.reddit.getUserById(uid as `t2_${string}`);
      if (u) s.born = u.createdAt.getTime();
    } catch {
      // Ohne Antwort zählt nur die Zahl der Duelle
    }
  }
  if (s.born !== undefined && d.now - s.born < TRADE.minDays * DAY) return { ok: false, why: `Your Reddit account needs to be ${TRADE.minDays} days old to trade.` };
  return { ok: true };
}
const refuse = (g: TradeGate): never => {
  throw new GameError('forbidden', g.why ?? 'You cannot trade yet.', 403);
};

/** Darf dieser Würfel die Sammlung verlassen? null: ja, sonst der Grund */
async function blocked(d: Pick<Deps, 'redis'>, uid: string, s: DiceSave, die: DieRec): Promise<string | null> {
  if (die.bound) return 'Starter dice stay with you.';
  if (s.bag.includes(die.id)) return 'This die is in your deck. Take it out first.';
  if (die.draw && !(await d.redis.hGet(K.drawnOk, `${uid}:${die.id}`))) return 'A moderator has to look at this drawing first.';
  return null;
}
/** Holo und Legendary fragen beim Abgeben noch einmal nach */
const precious = (x: DieRec): boolean => !!x.holo || rarityOfDie(x) === 'legendary';

/* ---------- Würfel bewegen ---------- */

/** Erster Eintrag der Herkunft, bevor ein Würfel zum ersten Mal die Hand wechselt */
function firstHist(die: DieRec, owner: string): void {
  if (!die.hist?.length) die.hist = [{ u: owner, at: die.at, how: 'pull' }];
}
function takeOut(s: DiceSave, ids: string[]): DieRec[] {
  const out = ids.map((id) => s.dice.find((x) => x.id === id)!);
  s.dice = s.dice.filter((x) => !ids.includes(x.id));
  return out;
}
/** Ein Würfel kommt zu einem neuen Besitzer: neue ID, Register, Herkunft, Freigabe der Zeichnung */
async function takeIn(d: Pick<Deps, 'redis'>, uid: string, s: DiceSave, m: Moving, h: Hist): Promise<DieRec> {
  const die: DieRec = { ...copy(m.die), id: `d${s.next++}` };
  delete die.bound;
  die.hist = [...(die.hist ?? []), h].slice(-TRADE.histMax);
  s.dice.push(die);
  await d.redis.hSet(K.seeds, { [seedOf(die)]: `${uid}:${die.id}` });
  if (die.draw) {
    const ok = await d.redis.hGet(K.drawnOk, m.from);
    if (ok) await d.redis.hSet(K.drawnOk, { [`${uid}:${die.id}`]: ok });
  }
  return die;
}
/** Ein Würfel kommt zurück (abgelaufen, abgelehnt, zurückgezogen): dieselbe ID, das Register zeigt noch auf ihn */
async function restore(d: Pick<Deps, 'redis'>, uid: string, s: DiceSave, die: DieRec): Promise<void> {
  if (!s.dice.some((x) => x.id === die.id)) {
    s.dice.push(die);
    return;
  }
  const again: DieRec = { ...die, id: `d${s.next++}` };
  s.dice.push(again);
  await d.redis.hSet(K.seeds, { [seedOf(again)]: `${uid}:${again.id}` });
}
async function deliver(d: Pick<Deps, 'redis' | 'now' | 'rand'>, uid: string, x: Omit<Delivery, 'id' | 'at'>): Promise<void> {
  const id = `${d.now.toString(36)}-${(d.rand() % 1_000_000).toString(36)}`;
  await d.redis.hSet(K.deliver(uid), { [id]: JSON.stringify({ ...x, id, at: d.now }) });
}
function addNews(s: DiceSave, n: News): void {
  s.news = [...(s.news ?? []), n].slice(-8);
}

async function dropListing(d: Pick<Deps, 'redis'>, r: MarketRec): Promise<void> {
  await d.redis.hDel(K.market, [r.id]);
  await d.redis.zRem(K.marketAt, [r.id]);
  await d.redis.zRem(K.marketBy(r.seller), [r.id]);
}
async function dropTrade(d: Pick<Deps, 'redis'>, r: TradeRec): Promise<void> {
  await d.redis.hDel(K.trades, [r.id]);
  await d.redis.zRem(K.tradeOut(r.from), [r.id]);
  await d.redis.zRem(K.tradeIn(r.to), [r.id]);
}
const loadListing = async (d: Pick<Deps, 'redis'>, id: string) => parse<MarketRec>(await d.redis.hGet(K.market, id));
const loadTrade = async (d: Pick<Deps, 'redis'>, id: string) => parse<TradeRec>(await d.redis.hGet(K.trades, id));

/**
 * Lieferungen abholen und eigene abgelaufene Einträge und Angebote zurücknehmen. Nur innerhalb der eigenen Sperre.
 * Gibt die abgeholten Lieferungen zurück: erst nach dem Speichern löschen
 */
async function settle(d: Deps, uid: string, s: DiceSave, name: string): Promise<{ changed: boolean; done: string[] }> {
  let changed = false;
  const box = Object.values(await d.redis.hGetAll(K.deliver(uid)))
    .map((v) => JSON.parse(v) as Delivery)
    .sort((a, b) => a.at - b.at);
  const seen = new Set(s.postSeen ?? []);
  const done: string[] = [];
  for (const x of box) {
    done.push(x.id);
    if (seen.has(x.id)) continue;
    for (const m of x.dice ?? []) {
      if (x.k === 'traded') await takeIn(d, uid, s, m, { u: name, at: x.at, how: 'trade' });
      else await restore(d, uid, s, m.die);
    }
    s.pigment += x.pig ?? 0;
    addNews(s, { k: x.k, text: x.text, at: x.at, ...(x.pig ? { pig: x.pig } : {}) });
    seen.add(x.id);
    changed = true;
  }
  if (changed) s.postSeen = [...seen].slice(-50);
  // Eigene Markt-Einträge nach der Laufzeit kommen zurück
  for (const { member: id } of await d.redis.zRange(K.marketBy(uid), 0, d.now, { by: 'score' })) {
    await withLock(d, `mk:${id}`, async () => {
      const r = await loadListing(d, id);
      if (!r || r.seller !== uid) return void (await d.redis.zRem(K.marketBy(uid), [id]));
      await dropListing(d, r);
      await restore(d, uid, s, r.die);
      addNews(s, { k: 'back', text: `Nobody bought your ${dieName(r.die)} in ${TRADE.days} days. It is back with you.`, at: d.now });
      changed = true;
    });
  }
  // Eigene Angebote nach der Laufzeit: Würfel und Pigment zurück
  for (const { member: id } of await d.redis.zRange(K.tradeOut(uid), 0, d.now, { by: 'score' })) {
    await withLock(d, `tr:${id}`, async () => {
      const r = await loadTrade(d, id);
      if (!r || r.from !== uid) return void (await d.redis.zRem(K.tradeOut(uid), [id]));
      await dropTrade(d, r);
      for (const m of r.give) await restore(d, uid, s, m.die);
      s.pigment += r.pig;
      addNews(s, { k: 'back', text: `${tag(r.toName)} did not answer your offer in ${TRADE.days} days. Your dice${r.pig ? ' and pigment' : ''} are back.`, at: d.now });
      changed = true;
    });
  }
  // Abgelaufene Angebote an dich verschwinden aus der Liste (der Absender bekommt seins beim nächsten Laden)
  const old = await d.redis.zRange(K.tradeIn(uid), 0, d.now, { by: 'score' });
  if (old.length) await d.redis.zRem(K.tradeIn(uid), old.map((x) => x.member));
  return { changed, done };
}

/**
 * Unter der eigenen Sperre: erst abholen und zurücknehmen (und das sofort speichern, damit nichts verloren geht,
 * wenn der eigentliche Schritt scheitert), dann fn auf dem Stand ausführen und speichern
 */
async function withSave<T>(d: Deps, uid: string, name: string, fn: (s: DiceSave) => Promise<T>): Promise<{ out: T; s: DiceSave }> {
  return withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    const st = await settle(d, uid, s, name);
    if (st.changed) await saveDice(d, uid, s);
    if (st.done.length) await d.redis.hDel(K.deliver(uid), st.done);
    const out = await fn(s);
    await saveDice(d, uid, s);
    return { out, s };
  });
}

/** Zum Laden der Sammlung: Name merken, Lieferungen abholen, Zähler für die Knöpfe */
export async function tradeStatus(d: Deps, userId: string | undefined, username: string | undefined): Promise<TradeStatus> {
  const uid = needUser(userId);
  await rememberName(d, uid, username);
  const [box, late, lateOut] = await Promise.all([d.redis.hLen(K.deliver(uid)), d.redis.zRange(K.marketBy(uid), 0, d.now, { by: 'score' }), d.redis.zRange(K.tradeOut(uid), 0, d.now, { by: 'score' })]);
  let s: DiceSave;
  if (box || late.length || lateOut.length) s = (await withSave(d, uid, username ?? '', async () => undefined)).s;
  else s = await loadDice(d, uid);
  const [offers, listed, market] = await Promise.all([d.redis.zRange(K.tradeIn(uid), d.now + 1, FAR, { by: 'score' }), d.redis.zCard(K.marketBy(uid)), d.redis.zCard(K.marketAt)]);
  return { offers: offers.length, listed, market, gate: await tradeGate(d, uid, s, await isTester(d, username)) };
}

/* ---------- Markt ---------- */

const toItem = (r: MarketRec, uid: string): MarketItem => ({ id: r.id, seller: r.name, die: r.die, price: r.price, at: r.at, until: r.until, rarity: r.rarity, ...(r.seller === uid ? { mine: true as const } : {}) });
function passes(r: MarketRec, f: MarketFilter): boolean {
  if (f === 'rare') return rarityIndex(r.rarity) >= 2;
  if (f === 'holo') return !!r.die.holo;
  if (f === 'style') return !!r.die.style;
  if (f === 'drawn') return !!r.die.draw;
  return true;
}
const FILTERS: MarketFilter[] = ['all', 'rare', 'holo', 'style', 'drawn'];
const SORTS: MarketSort[] = ['new', 'cheap', 'dear'];

/** Richtwerte aus den Verkäufen der letzten 7 Tage: mittlere Hälfte der Preise, ab drei Verkäufen */
async function priceHints(d: Pick<Deps, 'redis' | 'now'>): Promise<{ hint: Record<string, [number, number]>; hintN: Record<string, number> }> {
  const by = new Map<string, number[]>();
  for (const x of await d.redis.zRange(K.marketSales, d.now - 7 * DAY, d.now, { by: 'score' })) {
    const v = JSON.parse(x.member) as { k: string; p: number };
    by.set(v.k, [...(by.get(v.k) ?? []), v.p]);
  }
  const hint: Record<string, [number, number]> = {},
    hintN: Record<string, number> = {};
  for (const [k, ps] of by) {
    if (ps.length < 3) continue;
    ps.sort((a, b) => a - b);
    hint[k] = [ps[Math.floor((ps.length - 1) * 0.25)]!, ps[Math.ceil((ps.length - 1) * 0.75)]!];
    hintN[k] = ps.length;
  }
  return { hint, hintN };
}

export async function marketList(d: Deps, userId: string | undefined, username: string | undefined, filter: unknown = 'all', sort: unknown = 'new'): Promise<MarketResponse> {
  const uid = needUser(userId);
  const f = FILTERS.find((x) => x === filter) ?? 'all';
  const o = SORTS.find((x) => x === sort) ?? 'new';
  const s = await loadDice(d, uid);
  today(d, s);
  const all = Object.values(await d.redis.hGetAll(K.market)).map((v) => JSON.parse(v) as MarketRec);
  const live = all.filter((r) => r.until > d.now && r.seller !== uid && passes(r, f));
  live.sort((a, b) => (o === 'cheap' ? a.price - b.price : o === 'dear' ? b.price - a.price : 0) || b.at - a.at);
  return {
    items: live.slice(0, 60).map((r) => toItem(r, uid)),
    mine: all.filter((r) => r.seller === uid).map((r) => toItem(r, uid)),
    ...(await priceHints(d)),
    gate: await tradeGate(d, uid, s, await isTester(d, username)),
    buys: s.buyN ?? 0,
  };
}

/** Einstellen, innerhalb der Sperre des Verkäufers */
async function sellCore(d: Deps, uid: string, name: string, s: DiceSave, id: string, price: number, confirm: boolean): Promise<void> {
  const die = s.dice.find((x) => x.id === id);
  if (!die) throw new GameError('not_found', 'That die is not yours.', 404);
  const why = await blocked(d, uid, s, die);
  if (why) throw new GameError('bad_request', why);
  if (s.dice.length - 1 < KEEP_MIN) throw new GameError('bad_request', `Keep at least ${KEEP_MIN} dice for your deck.`);
  if ((await d.redis.zCard(K.marketBy(uid))) >= TRADE.listings) throw new GameError('bad_request', `At most ${TRADE.listings} dice on the market at once.`);
  if (precious(die) && !confirm) throw new GameError('bad_request', 'This one is precious. Confirm to sell it.');
  firstHist(die, name);
  takeOut(s, [id]);
  const mid = `m${await d.redis.incrBy(K.marketN, 1)}`;
  const r: MarketRec = { id: mid, seller: uid, name, die, from: `${uid}:${id}`, price, at: d.now, until: d.now + TRADE.days * DAY, rarity: rarityOfDie(die) };
  await d.redis.hSet(K.market, { [mid]: JSON.stringify(r) });
  await d.redis.zAdd(K.marketAt, { member: mid, score: r.at });
  await d.redis.zAdd(K.marketBy(uid), { member: mid, score: r.until });
}
const isPrice = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= TRADE.minPrice && (v as number) <= TRADE.maxPrice;

export async function marketSell(d: Deps, userId: string | undefined, username: string | undefined, id: unknown, price: unknown, confirm: unknown = false): Promise<MarketResponse> {
  const uid = needUser(userId);
  if (typeof id !== 'string') throw new GameError('bad_request', 'Unknown die.');
  if (!isPrice(price)) throw new GameError('bad_request', `Pick a price from ${TRADE.minPrice} to ${TRADE.maxPrice.toLocaleString('en')}.`);
  const name = username ?? '';
  const tester = await isTester(d, username);
  const { s } = await withSave(d, uid, name, async (t) => {
    const g = await tradeGate(d, uid, t, tester);
    if (!g.ok) refuse(g);
    await sellCore(d, uid, name, t, id, price, confirm === true);
  });
  return { ...(await marketList(d, userId, username)), dice: respond(d, s) };
}

export async function marketUnlist(d: Deps, userId: string | undefined, username: string | undefined, id: unknown): Promise<MarketResponse> {
  const uid = needUser(userId);
  if (typeof id !== 'string') throw new GameError('bad_request', 'Unknown listing.');
  const { s } = await withSave(d, uid, username ?? '', async (t) => {
    await withLock(d, `mk:${id}`, async () => {
      const r = await loadListing(d, id);
      if (!r || r.seller !== uid) throw new GameError('not_found', 'That listing is gone.', 404);
      await dropListing(d, r);
      await restore(d, uid, t, r.die);
    });
  });
  return { ...(await marketList(d, userId, username)), dice: respond(d, s) };
}

/** Kaufen, innerhalb der Sperre des Käufers: der Verkäufer bekommt den Erlös als Lieferung */
async function buyCore(d: Deps, uid: string, name: string, s: DiceSave, id: string): Promise<void> {
  await withLock(d, `mk:${id}`, async () => {
    const r = await loadListing(d, id);
    if (!r || r.until <= d.now) throw new GameError('not_found', 'Someone was quicker, or it went back to its painter.', 404);
    if (r.seller === uid) throw new GameError('bad_request', 'That is your own. Take it back instead.');
    if (s.pigment < r.price) throw new GameError('bad_request', `Not enough pigment (${r.price} needed).`);
    s.pigment -= r.price;
    s.buyN = (s.buyN ?? 0) + 1;
    await takeIn(d, uid, s, { die: r.die, from: r.from }, { u: name, at: d.now, how: 'market', p: r.price });
    await dropListing(d, r);
    const fee = marketFee(r.price);
    await deliver(d, r.seller, { k: 'sold', pig: r.price - fee, by: name, text: `${tag(name)} bought your ${dieName(r.die)} for ${r.price}. The market kept ${fee}, ${r.price - fee} are yours.` });
    await d.redis.zAdd(K.marketSales, { member: JSON.stringify({ id: r.id, k: priceKey(r.rarity, !!r.die.holo, !!r.die.style), p: r.price }), score: d.now });
    // Nur die letzten 300 Verkäufe bleiben
    const n = await d.redis.zCard(K.marketSales);
    if (n > 300) {
      const old = await d.redis.zRange(K.marketSales, 0, n - 301, { by: 'rank' });
      await d.redis.zRem(
        K.marketSales,
        old.map((x) => x.member),
      );
    }
  });
}

export async function marketBuy(d: Deps, userId: string | undefined, username: string | undefined, id: unknown): Promise<MarketResponse> {
  const uid = needUser(userId);
  if (typeof id !== 'string') throw new GameError('bad_request', 'Unknown listing.');
  const name = username ?? '';
  const tester = await isTester(d, username);
  const { s } = await withSave(d, uid, name, async (t) => {
    const g = await tradeGate(d, uid, t, tester);
    if (!g.ok) refuse(g);
    today(d, t);
    if ((t.buyN ?? 0) >= TRADE.buysPerDay) throw new GameError('bad_request', `${TRADE.buysPerDay} purchases a day. The market opens again tomorrow.`);
    await buyCore(d, uid, name, t, id);
  });
  return { ...(await marketList(d, userId, username)), dice: respond(d, s) };
}

/* ---------- Tausch ---------- */

const toOffer = (r: TradeRec, dir: 'in' | 'out'): TradeOffer => ({ id: r.id, from: r.fromName, to: r.toName, give: r.give.map((m) => m.die), pig: r.pig, want: r.want, at: r.at, until: r.until, dir });

export async function tradeList(d: Deps, userId: string | undefined, username: string | undefined): Promise<TradeResponse> {
  const uid = needUser(userId);
  const s = await loadDice(d, uid);
  today(d, s);
  const [ins, outs] = await Promise.all([d.redis.zRange(K.tradeIn(uid), d.now + 1, FAR, { by: 'score' }), d.redis.zRange(K.tradeOut(uid), d.now + 1, FAR, { by: 'score' })]);
  const offers: TradeOffer[] = [];
  for (const [list, dir] of [
    [ins, 'in'],
    [outs, 'out'],
  ] as const)
    for (const x of list) {
      const r = await loadTrade(d, x.member);
      if (r) offers.push(toOffer(r, dir));
    }
  offers.sort((a, b) => b.at - a.at);
  return { offers, gate: await tradeGate(d, uid, s, await isTester(d, username)), trades: s.tradeN ?? 0 };
}

/** Die handelbaren Würfel eines anderen Spielers (ohne Startwürfel, Deck und nicht freigegebene Zeichnungen) */
async function tradeable(d: Pick<Deps, 'redis'>, uid: string, s: DiceSave): Promise<DieRec[]> {
  const out: DieRec[] = [];
  for (const x of s.dice) if (!(await blocked(d, uid, s, x))) out.push(x);
  return out.sort((a, b) => rarityIndex(rarityOfDie(b)) - rarityIndex(rarityOfDie(a)) || (b.no ?? 0) - (a.no ?? 0));
}

export async function tradeCollection(d: Deps, userId: string | undefined, name: unknown): Promise<TradeCollection> {
  const uid = needUser(userId);
  if (typeof name !== 'string' || !name.trim()) throw new GameError('bad_request', 'Type a Reddit name.');
  const other = await uidOf(d, name);
  if (!other) throw new GameError('not_found', `Nobody called ${tag(name.trim().replace(/^\/?u\//i, ''))} has opened the game yet.`, 404);
  if (other === uid) throw new GameError('bad_request', 'That is you.');
  const s = await loadDice(d, other);
  const left = TRADE.minDuels - (s.duels ?? 0);
  const can = isTest(other) || left <= 0;
  return { name: await nameOf(d, other), dice: await tradeable(d, other, s), can, ...(can ? {} : { why: `They need ${left} more duel${left > 1 ? 's' : ''} before they can trade.` }) };
}

const idList = (v: unknown, max: number): string[] | null => (Array.isArray(v) && v.length <= max && v.every((x) => typeof x === 'string') ? [...new Set(v as string[])] : null);

/** Angebot anlegen, innerhalb der Sperre des Absenders. Seine Würfel und sein Pigment gehen ins Angebot */
async function offerCore(d: Deps, uid: string, name: string, s: DiceSave, to: string, toName: string, give: string[], pig: number, want: string[], confirm: boolean): Promise<string> {
  today(d, s);
  if ((s.tradeN ?? 0) >= TRADE.perDay) throw new GameError('bad_request', `${TRADE.perDay} trades a day. Try again tomorrow.`);
  const open = await d.redis.zRange(K.tradeOut(uid), d.now + 1, FAR, { by: 'score' });
  if (open.length >= TRADE.openOffers) throw new GameError('bad_request', `At most ${TRADE.openOffers} open offers.`);
  if (pig > s.pigment) throw new GameError('bad_request', 'Not enough pigment.');
  const mine = give.map((id) => s.dice.find((x) => x.id === id));
  if (mine.some((x) => !x)) throw new GameError('not_found', 'That die is not yours.', 404);
  for (const x of mine) {
    const why = await blocked(d, uid, s, x!);
    if (why) throw new GameError('bad_request', why);
  }
  if (s.dice.length - give.length < KEEP_MIN) throw new GameError('bad_request', `Keep at least ${KEEP_MIN} dice for your deck.`);
  if (mine.some((x) => precious(x!)) && !confirm) throw new GameError('bad_request', 'You are giving away something precious. Confirm to send.');
  // Die gewünschten Würfel des anderen: jetzt noch seine und handelbar (geprüft wird beim Annehmen noch einmal)
  const other = await loadDice(d, to);
  const theirs = want.map((id) => other.dice.find((x) => x.id === id));
  if (theirs.some((x) => !x)) throw new GameError('not_found', 'That die is not theirs any more.', 404);
  for (const x of theirs) if (await blocked(d, to, other, x!)) throw new GameError('bad_request', `${tag(toName)} cannot trade ${dieName(x!)} right now.`);
  for (const x of mine) firstHist(x!, name);
  takeOut(s, give);
  s.pigment -= pig;
  s.tradeN = (s.tradeN ?? 0) + 1;
  const id = `t${await d.redis.incrBy(K.tradeN, 1)}`;
  const r: TradeRec = { id, from: uid, fromName: name, to, toName, give: mine.map((x) => ({ die: x!, from: `${uid}:${x!.id}` })), pig, want: theirs.map((x) => copy(x!)), at: d.now, until: d.now + TRADE.days * DAY };
  await d.redis.hSet(K.trades, { [id]: JSON.stringify(r) });
  await d.redis.zAdd(K.tradeOut(uid), { member: id, score: r.until });
  await d.redis.zAdd(K.tradeIn(to), { member: id, score: r.until });
  return id;
}

export async function tradeOffer(d: Deps, userId: string | undefined, username: string | undefined, to: unknown, give: unknown, pig: unknown, want: unknown, confirm: unknown = false): Promise<TradeResponse> {
  const uid = needUser(userId);
  const g = idList(give, TRADE.maxDice),
    w = idList(want, TRADE.maxDice);
  const p = pig === undefined ? 0 : pig;
  if (!g || !w) throw new GameError('bad_request', `Up to ${TRADE.maxDice} dice on each side.`);
  if (!Number.isInteger(p) || (p as number) < 0 || (p as number) > TRADE.maxPig) throw new GameError('bad_request', `Up to ${TRADE.maxPig} pigment in an offer.`);
  if (!w.length) throw new GameError('bad_request', 'Pick at least one of their dice.');
  if (!g.length && !p) throw new GameError('bad_request', 'Offer a die or some pigment.');
  if (typeof to !== 'string') throw new GameError('bad_request', 'Who is it for?');
  const other = await uidOf(d, to);
  if (!other) throw new GameError('not_found', 'Nobody by that name has opened the game yet.', 404);
  if (other === uid) throw new GameError('bad_request', 'That is you.');
  const toName = await nameOf(d, other);
  const name = username ?? '';
  const tester = await isTester(d, username);
  const otherSave = await loadDice(d, other);
  if (!isTest(other) && (otherSave.duels ?? 0) < TRADE.minDuels) throw new GameError('bad_request', `${tag(toName)} cannot trade yet.`);
  const { out: id } = await withSave(d, uid, name, async (s) => {
    const gt = await tradeGate(d, uid, s, tester);
    if (!gt.ok) refuse(gt);
    return offerCore(d, uid, name, s, other, toName, g, p as number, w, confirm === true);
  });
  // Test-Händler (Playtest) nehmen sofort an
  if (isTest(other) && isPlaytest(d.appVersion)) await withSave(d, other, toName, async (t) => acceptCore(d, other, toName, t, id, true));
  else if (otherSave.tradeMsg && d.reddit.sendPrivateMessage && toName) {
    // Nur wer das im Menü eingeschaltet hat, bekommt eine Nachricht (keine ungefragten Nachrichten)
    try {
      await d.reddit.sendPrivateMessage({
        to: toName,
        subject: 'A trade offer in Before It Dries',
        text: `${tag(name)} offers you a trade in r/${d.subredditName}. Open the game and look under Trades. The offer stays for ${TRADE.days} days.\n\n(You turned these messages on in the game menu.)`,
      });
    } catch {
      // Die Nachricht ist nur ein Hinweis, das Angebot steht trotzdem
    }
  }
  return { ...(await tradeList(d, userId, username)), dice: respond(d, (await withSave(d, uid, name, async () => undefined)).s) };
}

/** Annehmen, innerhalb der Sperre des Empfängers. Der Absender bekommt die gewünschten Würfel als Lieferung */
async function acceptCore(d: Deps, uid: string, name: string, s: DiceSave, id: string, confirm: boolean): Promise<void> {
  await withLock(d, `tr:${id}`, async () => {
    const r = await loadTrade(d, id);
    if (!r || r.to !== uid || r.until <= d.now) throw new GameError('not_found', 'This offer is gone.', 404);
    const mine = r.want.map((w) => s.dice.find((x) => x.id === w.id && seedOf(x) === seedOf(w)));
    if (mine.some((x) => !x)) throw new GameError('bad_request', 'One of the dice they want is no longer with you.');
    for (const x of mine) {
      const why = await blocked(d, uid, s, x!);
      if (why) throw new GameError('bad_request', `${dieName(x!)}: ${why}`);
    }
    if (s.dice.length - mine.length + r.give.length < KEEP_MIN) throw new GameError('bad_request', `Keep at least ${KEEP_MIN} dice for your deck.`);
    if (mine.some((x) => precious(x!)) && !confirm) throw new GameError('bad_request', 'You are giving away something precious. Confirm to accept.');
    for (const x of mine) firstHist(x!, name);
    takeOut(
      s,
      mine.map((x) => x!.id),
    );
    for (const m of r.give) await takeIn(d, uid, s, m, { u: name, at: d.now, how: 'trade' });
    s.pigment += r.pig;
    await dropTrade(d, r);
    const gave = names(mine.map((x) => x!));
    const got = [names(r.give.map((m) => m.die)), r.pig ? `${r.pig} pigment` : ''].filter(Boolean).join(' and ');
    await deliver(d, r.from, { k: 'traded', dice: mine.map((x) => ({ die: x!, from: `${uid}:${x!.id}` })), by: name, text: `${tag(name)} took your offer: ${gave} for your ${got}.` });
    addNews(s, { k: 'traded', text: `You traded ${gave} for ${got} with ${tag(r.fromName)}.`, at: d.now });
  });
}

export async function tradeAccept(d: Deps, userId: string | undefined, username: string | undefined, id: unknown, confirm: unknown = false): Promise<TradeResponse> {
  const uid = needUser(userId);
  if (typeof id !== 'string') throw new GameError('bad_request', 'Unknown offer.');
  const name = username ?? '';
  const tester = await isTester(d, username);
  const { s } = await withSave(d, uid, name, async (t) => {
    const g = await tradeGate(d, uid, t, tester);
    if (!g.ok) refuse(g);
    today(d, t);
    if ((t.tradeN ?? 0) >= TRADE.perDay) throw new GameError('bad_request', `${TRADE.perDay} trades a day. Try again tomorrow.`);
    await acceptCore(d, uid, name, t, id, confirm === true);
    t.tradeN = (t.tradeN ?? 0) + 1;
  });
  return { ...(await tradeList(d, userId, username)), dice: respond(d, s) };
}

/** Ablehnen: der Absender bekommt seine Würfel und sein Pigment als Lieferung zurück */
export async function tradeDecline(d: Deps, userId: string | undefined, username: string | undefined, id: unknown): Promise<TradeResponse> {
  const uid = needUser(userId);
  if (typeof id !== 'string') throw new GameError('bad_request', 'Unknown offer.');
  await withLock(d, `tr:${id}`, async () => {
    const r = await loadTrade(d, id);
    if (!r || r.to !== uid) throw new GameError('not_found', 'This offer is gone.', 404);
    await dropTrade(d, r);
    await deliver(d, r.from, { k: 'declined', dice: r.give, pig: r.pig, by: username ?? '', text: `${tag(username ?? '')} declined your offer. Your dice${r.pig ? ' and pigment' : ''} are back.` });
  });
  return tradeList(d, userId, username);
}

/** Zurückziehen: Würfel und Pigment kommen sofort zurück */
export async function tradeCancel(d: Deps, userId: string | undefined, username: string | undefined, id: unknown): Promise<TradeResponse> {
  const uid = needUser(userId);
  if (typeof id !== 'string') throw new GameError('bad_request', 'Unknown offer.');
  const { s } = await withSave(d, uid, username ?? '', async (t) => {
    await withLock(d, `tr:${id}`, async () => {
      const r = await loadTrade(d, id);
      if (!r || r.from !== uid) throw new GameError('not_found', 'This offer is gone.', 404);
      await dropTrade(d, r);
      for (const m of r.give) await restore(d, uid, t, m.die);
      t.pigment += r.pig;
    });
  });
  return { ...(await tradeList(d, userId, username)), dice: respond(d, s) };
}

/** Private Nachricht bei Angeboten ein oder aus (Menü) */
export async function tradeMsg(d: Deps, userId: string | undefined, username: string | undefined, on: unknown) {
  const uid = needUser(userId);
  const { s } = await withSave(d, uid, username ?? '', async (t) => {
    if (on === true) t.tradeMsg = true;
    else delete t.tradeMsg;
  });
  return respond(d, s);
}

/* ---------- Test-Händler (Playtest, nur Mods) ---------- */

const TEST_NAMES = ['Inkwell', 'Oldbrush', 'Palette_Knife', 'Gesso', 'Wetonwet', 'Sable', 'Gouache', 'Deckle'];

/** Ein neuer Test-Händler mit 12 gezogenen Würfeln (keine Startwürfel) und viel Pigment */
async function testTrader(d: Deps): Promise<{ uid: string; name: string }> {
  const n = await d.redis.incrBy(K.tradeTestN, 1);
  const uid = `test:trader${n}`;
  const name = `Test_${TEST_NAMES[(n - 1) % TEST_NAMES.length]}`;
  await rememberName(d, uid, name);
  await withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    s.starter = 0;
    const pulls = Array.from({ length: 12 }, () => pullOne(d, s, false, false));
    await claimPulls(d, uid, pulls);
    s.duels = 99;
    s.pigment = 100_000;
    await saveDice(d, uid, s);
  });
  return { uid, name };
}
const needTester = async (d: Deps, username: string | undefined) => {
  if (!(await isTester(d, username))) throw new GameError('forbidden', 'Only for moderators in a playtest.', 403);
};
const bandPrice = (d: Deps, x: DieRec): number => {
  const [a, b] = defaultBand(rarityOfDie(x), !!x.holo, !!x.style);
  return Math.round((a + ((d.rand() % 1000) / 1000) * (b - a)) / 5) * 5;
};

/** Drei Test-Händler stellen je einen Würfel in den Markt */
export async function marketTestList(d: Deps, userId: string | undefined, username: string | undefined): Promise<MarketResponse> {
  needUser(userId);
  await needTester(d, username);
  for (let k = 0; k < 3; k++) {
    const t = await testTrader(d);
    await withSave(d, t.uid, t.name, async (s) => {
      const x = s.dice[d.rand() % s.dice.length]!;
      await sellCore(d, t.uid, t.name, s, x.id, bandPrice(d, x), true);
    });
  }
  return marketList(d, userId, username);
}

/** Ein Test-Händler kauft deinen günstigsten Eintrag */
export async function marketTestBuy(d: Deps, userId: string | undefined, username: string | undefined): Promise<MarketResponse> {
  const uid = needUser(userId);
  await needTester(d, username);
  const all = Object.values(await d.redis.hGetAll(K.market)).map((v) => JSON.parse(v) as MarketRec);
  const mine = all.filter((r) => r.seller === uid && r.until > d.now).sort((a, b) => a.price - b.price)[0];
  if (!mine) throw new GameError('bad_request', 'Put a die on the market first.');
  const t = await testTrader(d);
  await withSave(d, t.uid, t.name, async (s) => buyCore(d, t.uid, t.name, s, mine.id));
  return marketList(d, userId, username);
}

/** Ein Test-Händler bietet einen seiner Würfel und etwas Pigment für einen deiner handelbaren Würfel */
export async function tradeTestOffer(d: Deps, userId: string | undefined, username: string | undefined): Promise<TradeResponse> {
  const uid = needUser(userId);
  await needTester(d, username);
  const me = await loadDice(d, uid);
  const can = await tradeable(d, uid, me);
  if (!can.length) throw new GameError('bad_request', 'All your dice are starter dice or in your deck. Dip the brush for one more first.');
  const want = can[d.rand() % can.length]!;
  const t = await testTrader(d);
  await rememberName(d, uid, username);
  await withSave(d, t.uid, t.name, async (s) => {
    const give = s.dice[d.rand() % s.dice.length]!;
    await offerCore(d, t.uid, t.name, s, uid, username ?? '', [give.id], 100, [want.id], true);
  });
  return tradeList(d, userId, username);
}
