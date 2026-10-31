/*
 * Galerie-Duell (docs/entwuerfe/galerie-duell-plan.md, freigegeben am 31.10.2026): Jedes Deck hängt nach einem fertigen
 * Duell als Abzug in der Galerie. Wer ein Galerie-Duell startet, bekommt ein Deck ähnlicher Stärke, der Computer führt es
 * mit den echten Würfeln. Der Besitzer bekommt eine kleine Gebühr, gutgeschrieben mit hIncrBy ohne seine Sperre,
 * damit zwei Spieler, die sich gleichzeitig herausfordern, nicht aufeinander warten.
 */
import type { GalleryRecord, GalleryResponse, GalleryStatus, GalleryView } from '../shared/api';
import { dayKey } from '../shared/day';
import { dieMonster, GALLERY, GALLERY_FEE, type DiceSave, type DieRec, type FaceMod } from '../shared/dice';
import { START_MEDIA, type MediumId } from '../shared/duel/media';
import { BAG, dieUnit, power, type FoeDie } from '../shared/duel/rules';
import type { Monster } from '../shared/monster';
import type { ColorId } from '../shared/colors';
import { GameError, withLock, type Deps } from './core';
import { bagForDuel, isTester, loadDice, needUser, playerLock, respond, saveDice, type Recycled } from './dice';
import { K } from './keys';

/** Abzug eines Decks in der Galerie */
export type GallerySnap = { name: string; dice: DieRec[]; media: MediumId[]; power: number; at: number; color?: ColorId };
/** Galerie-Stand des Herausforderers: gefundenes Deck, wie oft getauscht, wen er heute schon hatte */
export type GalleryMe = { day: string; faced: string[]; pick?: string; swaps: number; reported?: number };

/** Stärke eines Decks: Summe der Werte seiner Würfel (dieselben, aus denen das Duell die Stufe berechnet) */
export const deckPower = (dice: DieRec[]): number => dice.reduce((n, x) => n + power(dieUnit(dieMonster(x), x.mods)), 0);

const DAY = 86_400_000;
const parse = <T>(raw: string | undefined): T | null => (raw ? (JSON.parse(raw) as T) : null);
export const loadSnap = async (d: Pick<Deps, 'redis'>, uid: string): Promise<GallerySnap | null> => parse<GallerySnap>(await d.redis.get(K.gallery(uid)));

export async function loadMe(d: Pick<Deps, 'redis' | 'now'>, uid: string): Promise<GalleryMe> {
  const me = parse<GalleryMe>(await d.redis.get(K.galleryMe(uid))) ?? { day: '', faced: [], swaps: 0 };
  // Gegner des Tages gelten nur heute
  if (me.day !== dayKey(d.now)) Object.assign(me, { day: dayKey(d.now), faced: [], reported: 0 });
  return me;
}
export const saveMe = (d: Pick<Deps, 'redis'>, uid: string, me: GalleryMe) => d.redis.set(K.galleryMe(uid), JSON.stringify(me));

/** Die Würfel im Deck, wie sie gerade sind */
const bagDice = (s: DiceSave): DieRec[] => s.bag.map((id) => s.dice.find((x) => x.id === id)).filter((x): x is DieRec => !!x);

/**
 * Deck als Abzug in die Galerie hängen (nach jedem fertigen Duell, nicht im Lern-Duell). Mit dem Schalter aus
 * bleibt der Abzug liegen, hängt aber nicht. Nur innerhalb der Spielersperre aufrufen
 */
export async function hangDeck(d: Deps, uid: string, name: string | undefined, s: DiceSave): Promise<void> {
  const dice = bagDice(s);
  if (dice.length < BAG) return;
  const snap: GallerySnap = { name: name ?? '', dice: JSON.parse(JSON.stringify(dice)) as DieRec[], media: s.media ?? [...START_MEDIA], power: deckPower(dice), at: d.now, ...(s.color ? { color: s.color } : {}) };
  await d.redis.set(K.gallery(uid), JSON.stringify(snap));
  if (!s.galleryOff) await d.redis.zAdd(K.galleryPower, { member: uid, score: snap.power });
}

/** Bilanz eines Decks */
async function record(d: Pick<Deps, 'redis'>, uid: string): Promise<GalleryRecord> {
  const [w, l, dr] = await Promise.all(['w', 'l', 'd'].map((k) => d.redis.hGet(K.galleryRecord, `${uid}:${k}`)));
  return { w: Number(w ?? 0), l: Number(l ?? 0), d: Number(dr ?? 0) };
}

/** Dein Deck in der Galerie, für das Laden der Sammlung */
export async function galleryStatus(d: Deps, uid: string, s: DiceSave): Promise<GalleryStatus> {
  const [snap, rec, inbox] = await Promise.all([d.redis.get(K.gallery(uid)), record(d, uid), d.redis.hGetAll(K.galleryInbox(uid))]);
  const n = (k: string) => Number(inbox[k] ?? 0);
  const who = Object.entries(inbox)
    .filter(([k]) => k.startsWith('who:'))
    .sort(([a], [b]) => Number(b.slice(4)) - Number(a.slice(4)))
    .map(([, v]) => v);
  const has = n('w') + n('l') + n('d') > 0 || n('pig') > 0;
  return { hung: !!snap && !s.galleryOff, off: !!s.galleryOff, rec, inbox: has ? { w: n('w'), l: n('l'), d: n('d'), pig: n('pig'), who: [...new Set(who)].slice(0, 5) } : null };
}

/**
 * Zeichnungen sehen andere nur, wenn ein Mod sie freigegeben hat (drawn:ok). Sonst bekommt der Würfel für sie
 * die zufällige Form aus seinem Seed, wie nach dem Übermalen
 */
export async function visibleDice(d: Pick<Deps, 'redis'>, owner: string, dice: DieRec[]): Promise<DieRec[]> {
  return Promise.all(
    dice.map(async (x) => {
      if (!x.draw) return x;
      const ok = await d.redis.hGet(K.drawnOk, `${owner}:${x.id}`);
      if (ok) return x;
      const { draw: _hidden, ...rest } = x;
      return rest;
    }),
  );
}

/** Ein zufälliges Deck aus den Kandidaten, bevorzugt von Spielern, die in den letzten Tagen gespielt haben */
async function pickActive(d: Deps, members: string[]): Promise<string | null> {
  const xs = [...members];
  for (let i = xs.length - 1; i > 0; i--) {
    const j = d.rand() % (i + 1);
    [xs[i], xs[j]] = [xs[j]!, xs[i]!];
  }
  const some = xs.slice(0, 12);
  if (!some.length) return null;
  const snaps = await d.redis.mGet(some.map((u) => K.gallery(u)));
  const fresh = some.filter((_, i) => {
    const s = parse<GallerySnap>(snaps[i] ?? undefined);
    return !!s && d.now - s.at <= GALLERY.activeDays * DAY;
  });
  return fresh[0] ?? some.find((_, i) => !!snaps[i]) ?? null;
}

/** Gegner mit ähnlicher Stärke: erst 10 %, dann 25 % Abstand, dann die nächsten fünf */
async function search(d: Deps, mine: number, skip: Set<string>): Promise<string | null> {
  for (const f of GALLERY.near) {
    const xs = (await d.redis.zRange(K.galleryPower, Math.floor(mine * (1 - f)), Math.ceil(mine * (1 + f)), { by: 'score' })).filter((x) => !skip.has(x.member));
    if (xs.length) return pickActive(d, xs.map((x) => x.member));
  }
  const all = (await d.redis.zRange(K.galleryPower, 0, -1, { by: 'rank' })).filter((x) => !skip.has(x.member));
  all.sort((a, b) => Math.abs(a.score - mine) - Math.abs(b.score - mine));
  return pickActive(
    d,
    all.slice(0, 5).map((x) => x.member),
  );
}

async function viewOf(d: Deps, owner: string, snap: GallerySnap, mine: number, me: GalleryMe, self: boolean): Promise<GalleryView> {
  return {
    name: snap.name,
    dice: await visibleDice(d, owner, snap.dice),
    power: snap.power,
    mine,
    rec: await record(d, owner),
    at: snap.at,
    swaps: Math.max(0, GALLERY.swaps - me.swaps),
    ...(self ? { self: true } : {}),
    ...(snap.color ? { color: snap.color } : {}),
  };
}

/**
 * Deck aus der Galerie suchen. Ein gefundenes Deck bleibt, bis man dagegen spielt (neu öffnen bringt dasselbe),
 * another tauscht es einmal pro Duell. Test-Schalter (Playtest, nur Mods): das eigene Deck
 */
export async function galleryFind(d: Deps, userId: string | undefined, username: string | undefined, another: unknown = false): Promise<GalleryResponse> {
  const uid = needUser(userId);
  const tester = await isTester(d, username);
  return withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    const bag = await bagForDuel(d, uid);
    const mine = deckPower(bag);
    const me = await loadMe(d, uid);
    if (tester && s.testSelf) {
      // Eigenes Deck: der Abzug vom letzten Duell, sonst das Deck, wie es gerade ist
      if (!(await loadSnap(d, uid))) await hangDeck(d, uid, username, await loadDice(d, uid));
      me.pick = uid;
    } else {
      const keep = me.pick && me.pick !== uid && (await loadSnap(d, me.pick));
      if (another === true) {
        if (me.swaps >= GALLERY.swaps) throw new GameError('bad_request', 'Only one other deck per duel.');
        me.swaps++;
      }
      if (another === true || !keep) {
        const skip = new Set([uid, ...me.faced, ...(another === true && me.pick ? [me.pick] : [])]);
        const found = await search(d, mine, skip);
        // Kein anderes Deck da: das bisherige bleibt, der Tausch zählt nicht
        if (!found && another === true && keep) throw new GameError('not_found', 'No other deck on the wall right now.', 404);
        if (found) me.pick = found;
        else Reflect.deleteProperty(me, 'pick');
      }
    }
    await saveMe(d, uid, me);
    const snap = me.pick ? await loadSnap(d, me.pick) : null;
    if (!me.pick || !snap) return { foe: null };
    return { foe: await viewOf(d, me.pick, snap, mine, me, me.pick === uid) };
  });
}

/** Für den Start des Galerie-Duells: das gefundene Deck. Nur innerhalb der Spielersperre aufrufen */
export async function takePick(
  d: Deps,
  uid: string,
): Promise<{ owner: string; name: string; theirs: Monster[]; mods: FaceMod[][]; foe: (FoeDie | null)[]; keys: (string | null)[]; media: MediumId[]; color?: ColorId }> {
  const me = await loadMe(d, uid);
  if (!me.pick) throw new GameError('bad_request', 'Find a deck in the gallery first.');
  const owner = me.pick;
  const snap = await loadSnap(d, owner);
  // Abgenommen (Schalter aus), seit das Deck gefunden wurde
  const hung = owner === uid || (await d.redis.zScore(K.galleryPower, owner)) !== undefined;
  if (!snap || !hung) {
    Reflect.deleteProperty(me, 'pick');
    await saveMe(d, uid, me);
    throw new GameError('not_found', 'That deck was taken off the wall. Try the gallery again.', 404);
  }
  const dice = await visibleDice(d, owner, snap.dice);
  // Heute nicht noch einmal dieses Deck, der Tausch gilt wieder fürs nächste Duell
  if (owner !== uid) me.faced = [...new Set([...me.faced, owner])];
  Reflect.deleteProperty(me, 'pick');
  me.swaps = 0;
  await saveMe(d, uid, me);
  return {
    owner,
    name: snap.name,
    theirs: dice.map((x) => dieMonster(x)),
    mods: dice.map((x) => x.mods ?? []),
    foe: dice.map((x) => ({ ...(x.no ? { no: x.no } : {}), glaze: (x.mods ?? []).filter((m) => !m.p).length, patina: x.patina ?? 0, ...(x.draw ? { drawn: 1 as const } : {}) })),
    keys: dice.map((x) => (x.draw ? `${owner}:${x.id}` : null)),
    media: snap.media,
    ...(snap.color ? { color: snap.color } : {}),
  };
}

/** Ein Würfel aus dem Archiv, der beim Rivalen zurücktreibt */
export type Drift = { die: DieRec; from: string; name: string };
/**
 * Aus dem Archiv (festgelegt am 31.10.2026): im normalen Duell bringt der Rivale 1 oder 2 ausgewaschene Monster
 * anderer Spieler mit. Nie deine eigenen (außer mit dem Test-Schalter), Zeichnungen nur mit Freigabe
 */
export async function driftDice(d: Deps, uid: string, own: boolean): Promise<Drift[]> {
  const total = await d.redis.zCard(K.recycledAt);
  if (!total) return [];
  const want = 1 + (d.rand() % 2);
  const out: Drift[] = [];
  const seen = new Set<string>();
  for (let t = 0; t < 12 && out.length < want; t++) {
    const k = d.rand() % total;
    const m = (await d.redis.zRange(K.recycledAt, k, k, { by: 'rank' }))[0];
    if (!m || seen.has(m.member)) continue;
    seen.add(m.member);
    const rec = parse<Recycled>(await d.redis.hGet(K.recycled, m.member));
    if (!rec || (!own && rec.from === uid)) continue;
    const [die] = await visibleDice(d, rec.from, [rec.die]);
    out.push({ die: die!, from: rec.from, name: rec.name ?? (await loadSnap(d, rec.from))?.name ?? '' });
  }
  return out;
}

/** Gebühr und Bilanz für den Besitzer nach einem Galerie-Duell. winner aus Sicht des Herausforderers */
export async function payOwner(d: Deps, owner: string, winner: 0 | 1 | 2, challenger: string | undefined): Promise<void> {
  const k = winner === 2 ? 'w' : winner === 1 ? 'l' : 'd';
  const fee = winner === 2 ? GALLERY_FEE.win : winner === 1 ? GALLERY_FEE.loss : GALLERY_FEE.draw;
  const box = K.galleryInbox(owner);
  // Höchstens perDay am Tag: der Zähler des Tages zeigt, wie viel davon noch passt
  const today = await d.redis.hIncrBy(box, `p:${dayKey(d.now)}`, fee);
  const pay = Math.max(0, fee - Math.max(0, today - GALLERY_FEE.perDay));
  await d.redis.hIncrBy(box, k, 1);
  if (pay) await d.redis.hIncrBy(box, 'pig', pay);
  if (challenger) await d.redis.hSet(box, { [`who:${d.now}`]: challenger });
  await d.redis.hIncrBy(K.galleryRecord, `${owner}:${k}`, 1);
}

/** Was das Deck in der Galerie erlebt hat, abholen: Pigment gutschreiben, Zähler abziehen (was dazwischen kommt, bleibt) */
export async function galleryCollect(d: Deps, userId: string | undefined) {
  const uid = needUser(userId);
  return withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    const box = K.galleryInbox(uid);
    const inbox = await d.redis.hGetAll(box);
    const pig = Number(inbox.pig ?? 0);
    s.pigment += pig;
    for (const k of ['pig', 'w', 'l', 'd']) {
      const n = Number(inbox[k] ?? 0);
      if (n) await d.redis.hIncrBy(box, k, -n);
    }
    const old = Object.keys(inbox).filter((k) => k.startsWith('who:') || (k.startsWith('p:') && k !== `p:${dayKey(d.now)}`));
    if (old.length) await d.redis.hDel(box, old);
    await saveDice(d, uid, s);
    return { ...respond(d, s), gallery: await galleryStatus(d, uid, s), collected: pig };
  });
}

/** Schalter im Menü: Deck in der Galerie aufhängen oder abnehmen */
export async function galleryHang(d: Deps, userId: string | undefined, on: unknown) {
  const uid = needUser(userId);
  if (typeof on !== 'boolean') throw new GameError('bad_request', 'On or off?');
  return withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    if (on) {
      Reflect.deleteProperty(s, 'galleryOff');
      const snap = await loadSnap(d, uid);
      if (snap) await d.redis.zAdd(K.galleryPower, { member: uid, score: snap.power });
    } else {
      s.galleryOff = true;
      await d.redis.zRem(K.galleryPower, [uid]);
    }
    await saveDice(d, uid, s);
    return { ...respond(d, s), gallery: await galleryStatus(d, uid, s) };
  });
}

/** Test-Schalter (Playtest, nur Mods): Galerie-Duelle gegen das eigene Deck, die Gebühr geht an dich */
export async function galleryTestSelf(d: Deps, userId: string | undefined, username: string | undefined, on: unknown) {
  const uid = needUser(userId);
  if (!(await isTester(d, username))) throw new GameError('forbidden', 'Only for moderators in a playtest.', 403);
  return withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    if (on === true) s.testSelf = true;
    else Reflect.deleteProperty(s, 'testSelf');
    const me = await loadMe(d, uid);
    Reflect.deleteProperty(me, 'pick');
    await saveMe(d, uid, me);
    await saveDice(d, uid, s);
    return { ...respond(d, s), tester: true, gallery: await galleryStatus(d, uid, s) };
  });
}
