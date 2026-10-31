/*
 * Würfelsammlung und Ziehen („Dip the brush“). Jeder Wurf passiert hier: der offene W100 für die Seltenheit,
 * das Monster dazu, der Schutz vor Pech. Pigment gibt es nur durchs Spielen.
 * Jedes Monster gibt es nur einmal (festgelegt am 30.10.2026): sein Seed steht im Register, jeder Würfel hat eine Seriennummer.
 */
import { START_MEDIA, UNLOCK_ORDER } from '../shared/duel/media';
import type { DiceResponse, DuelReward, ReviewItem } from '../shared/api';
import { dayKey, weekKey } from '../shared/day';
import { decodeDrawing, encodeDrawing } from '../shared/drawn';
import {
  BLANK,
  dieMonster,
  dieSpecies,
  drawLocked,
  emptyDice,
  GLAZE_COST,
  KEEP_MIN,
  LEGENDARY_PAPERS,
  PATINA,
  PULL_COST,
  PITY,
  RARITIES,
  rarityDef,
  rarityFromRoll,
  rarityIndex,
  REWARD,
  rollHand,
  forcedHand,
  STYLES,
  TEN_COST,
  washGlaze,
  type DiceSave,
  type DieRec,
  type PullKind,
  type PullResult,
  type Rarity,
} from '../shared/dice';
import { BAG, dieUnit, isCrestFace, patinaFaces } from '../shared/duel/rules';
import { humidityFor, makeMonster, monsterSeed, speciesKey } from '../shared/monster';
import { GameError, isMod, withLock, type Deps } from './core';
import { K } from './keys';
import { isColor } from '../shared/colors';

export function needUser(userId: string | undefined): string {
  if (!userId) throw new GameError('login', 'Log in to collect dice.', 401);
  return userId;
}
/** Gleiche Sperre wie das Duell, weil Duell-Belohnungen die Sammlung ändern */
export const playerLock = (uid: string): string => `duel:${uid}`;

export async function loadDice(d: Pick<Deps, 'redis' | 'now'>, uid: string): Promise<DiceSave> {
  const raw = await d.redis.get(K.dice(uid));
  const s = raw ? { ...emptyDice(), ...(JSON.parse(raw) as DiceSave) } : emptyDice();
  weeklyBlank(s, d.now);
  migrateHolo(s);
  migrateBound(s);
  return s;
}
/**
 * Stand 2 auf 3 (31.10.2026): Startwürfel sind gebunden. Die freien Startzüge kommen zuerst, ihre Würfel heißen d1 bis d9.
 * Gespeichert wird mit der nächsten Änderung
 */
function migrateBound(s: DiceSave): void {
  if (s.v === 3) return;
  for (const die of s.dice) if (/^d[1-9]$/.test(die.id)) die.bound = 1;
  s.v = 3;
}
/**
 * Stand 1 auf 2 (31.10.2026): bis dahin war jeder Stil ein Shiny aus dem Wurf 1 zu 1000. Diese Würfel behalten
 * den Stil und bekommen Holo (Seltenheit war schon gehoben). Gespeichert wird mit der nächsten Änderung
 */
function migrateHolo(s: DiceSave): void {
  if (s.v !== 1) return;
  for (const die of s.dice) if (die.style) die.holo = 1;
  Reflect.deleteProperty(s, 'forceShiny');
  s.v = 2;
}
/**
 * Jede Woche ein leerer Würfel, die freien füllen nur bis BLANK.max auf (auch nach Wochen ohne Besuch).
 * Rechnet beim Laden, gespeichert wird mit der nächsten Änderung, bis dahin kommt dasselbe heraus.
 */
function weeklyBlank(s: DiceSave, now: number): void {
  const w = weekKey(now);
  if (s.blankWeek === w) return;
  const weeks = s.blankWeek ? Number(w.slice(1)) - Number(s.blankWeek.slice(1)) : 1;
  s.blankWeek = w;
  if (weeks > 0) s.blank = Math.max(s.blank ?? 0, Math.min(BLANK.max, (s.blank ?? 0) + weeks));
}
export async function saveDice(d: Pick<Deps, 'redis' | 'now'>, uid: string, s: DiceSave): Promise<void> {
  // Ältere Würfel bekommen beim nächsten Speichern ihre Seriennummer und, wenn frei, ihren Platz im Register
  for (const die of s.dice) if (!die.no && !(await claim(d, uid, die))) die.no = await d.redis.incrBy(K.serial, 1);
  await d.redis.set(K.dice(uid), JSON.stringify(s));
  await d.redis.zAdd(K.dicePlayers, { member: uid, score: d.now });
}
export const respond = (d: Pick<Deps, 'now'>, s: DiceSave, pulls: PullResult[] = []): DiceResponse => ({ dice: s, freeReady: s.freeDay !== dayKey(d.now), pulls });

/** Ein Monster mit dem Papier dieser Seltenheit. Legendary: ein Monster auf Cotton Rag bekommt ein seltenes Papier. */
function rollMonster(d: Deps, rarity: Rarity, avoid: Set<string> | null): Pick<DieRec, 'sheet' | 'idx' | 'paper'> {
  const want = rarityDef(rarity).paper ?? 'hadern';
  let sheet = '',
    idx = 0;
  for (let k = 0; k < 2000; k++) {
    sheet = `dip-${d.rand().toString(36)}`;
    idx = d.rand() % 12;
    const m = makeMonster(sheet, idx, humidityFor(sheet));
    if (m.paper === want && !avoid?.has(speciesKey(m))) break;
  }
  return rarity === 'legendary' ? { sheet, idx, paper: LEGENDARY_PAPERS[d.rand() % LEGENDARY_PAPERS.length]! } : { sheet, idx };
}
function dieFor(d: Deps, s: DiceSave, rarity: Rarity, avoid: Set<string> | null): DieRec {
  // Neue Würfel bekommen die Formen der Generation 2 (festgelegt am 30.10.2026)
  return { id: `d${s.next++}`, ...rollMonster(d, rarity, avoid), mods: [], at: d.now, gen: 2 };
}
/** Seed ins Register eintragen und Seriennummer vergeben. false: den Seed hat schon ein anderes Monster */
async function claim(d: Pick<Deps, 'redis'>, uid: string, die: DieRec): Promise<boolean> {
  const ok = (await d.redis.hSetNX(K.seeds, String(monsterSeed(die.sheet, die.idx)), `${uid}:${die.id}`)) === 1;
  if (ok) die.no = await d.redis.incrBy(K.serial, 1);
  return ok;
}
/** Neue Würfel eines Zugs eintragen. Ist ein Seed schon vergeben, wird das Monster mit derselben Seltenheit neu gewürfelt */
export async function claimPulls(d: Deps, uid: string, pulls: PullResult[]): Promise<void> {
  for (const p of pulls) {
    for (let k = 0; k < 20 && !(await claim(d, uid, p.die)); k++) Object.assign(p.die, rollMonster(d, p.rarity, null));
    if (!p.die.no) throw new GameError('server', 'The brush slipped. Try again.', 500);
  }
}
const rarityOfDie = (r: DieRec): Rarity => dieUnit(dieMonster(r)).rarity;

/** Ein Zug: W100 offen würfeln, Schutz vor Pech prüfen, Monster erzeugen, Doppelte zu Lasur machen */
export function pullOne(d: Deps, s: DiceSave, starter: boolean, forceRare: boolean): PullResult {
  s.pulls++;
  s.pity.rare++;
  s.pity.epic++;
  s.pity.legendary++;
  const d100 = 1 + (d.rand() % 100);
  let rarity = rarityFromRoll(d100);
  let pity: PullResult['pity'] = null;
  const ri = rarityIndex(rarity);
  if (s.pity.legendary >= PITY.legendary && ri < 4) {
    rarity = 'legendary';
    pity = 'legendary';
  } else if (s.pity.epic >= PITY.epic && ri < 3) {
    rarity = 'epic';
    pity = 'epic';
  } else if (s.pity.rare >= PITY.rare && ri < 2) {
    rarity = 'rare';
    pity = 'rare';
  } else if (forceRare && ri < 2) {
    rarity = 'rare';
    pity = 'ten';
  }
  const fi = rarityIndex(rarity);
  if (fi >= 2) s.pity.rare = 0;
  if (fi >= 3) s.pity.epic = 0;
  if (fi >= 4) s.pity.legendary = 0;
  // Startzüge bringen immer neue Arten, damit der Beutel voll wird
  const owned = new Set(s.dice.map(dieSpecies));
  const die = dieFor(d, s, rarity, starter ? owned : null);
  // Startwürfel bleiben beim Spieler (Tausch und Markt, festgelegt am 31.10.2026)
  if (starter) die.bound = 1;
  const key = dieSpecies(die);
  // Jeder Zug bleibt als eigenes Monster, auch bei einer Art, die man schon hat
  s.dice.push(die);
  // Startzüge füllen den Beutel, spätere Würfel packt man selbst ein
  if (starter && s.bag.length < BAG) s.bag.push(die.id);
  // Die Hand: Stil 1 zu 100, Holo 1 zu 1000, unabhängig voneinander (festgelegt am 31.10.2026)
  const hd = s.forceStyle || s.forceHolo ? forcedHand(s.forceStyle, !!s.forceHolo, d.rand) : rollHand(d.rand);
  delete s.forceStyle;
  delete s.forceHolo;
  const out: PullResult = { d100, rarity, pity, die, dup: owned.has(key) ? key : null, hand: hd.hand, gold: hd.gold };
  if (hd.goldD100) out.goldD100 = hd.goldD100;
  if (hd.style) {
    die.style = hd.style;
    out.styleRoll = hd.styleRoll;
  }
  if (hd.holo) {
    die.holo = 1;
    // Nur Holo hebt das Papier eine Stufe, damit Seltenheit, Werte und Seiten (festgelegt am 31.10.2026). Legendary bleibt.
    // Der Schutz vor Pech hat oben schon nach dem W100 gezählt
    const up = RARITIES[rarityIndex(rarity) + 1];
    if (up) {
      die.paper = up.paper ?? LEGENDARY_PAPERS[d.rand() % LEGENDARY_PAPERS.length]!;
      out.lifted = up.k;
    }
  }
  // Der schlechteste Wurf tröstet: dazu ein leerer Würfel zum Selbstmalen
  if (d100 === BLANK.find) {
    s.blank = (s.blank ?? 0) + 1;
    out.blank = true;
  }
  return out;
}

/** Die offenen Startzüge auf einmal (auch beim ersten Duell ohne Beutel) */
function runStarter(d: Deps, s: DiceSave): PullResult[] {
  const out: PullResult[] = [];
  while (s.starter > 0) {
    s.starter--;
    out.push(pullOne(d, s, true, false));
  }
  return out;
}

/** Playtest-Version (vierte Stelle, z. B. 0.0.1.47). Veröffentlichte Versionen haben drei Stellen */
export const isPlaytest = (v: string | undefined): boolean => !!v && /^\d+\.\d+\.\d+\.[1-9]\d*$/.test(v);
/** Test-Werkzeuge nur im Playtest und nur für Mods des Subreddits */
export async function isTester(d: Deps, username: string | undefined): Promise<boolean> {
  return isPlaytest(d.appVersion) && (await isMod(d, username));
}

export async function diceGet(d: Deps, userId: string | undefined, username?: string): Promise<DiceResponse> {
  const uid = needUser(userId);
  const [mod, loaded] = await Promise.all([isMod(d, username), loadDice(d, uid)]);
  // Mods sehen, wie viele Zeichnungen auf sie warten
  const extra = { tester: mod && isPlaytest(d.appVersion), ...(mod ? { mod, review: await d.redis.hLen(K.drawnQueue) } : {}) };
  if (loaded.dice.every((x) => x.no)) return { ...respond(d, loaded), ...extra };
  // Ältere Würfel ohne Seriennummer: einmal unter der Sperre nachtragen
  return withLock(d, playerLock(uid), async () => {
    const t = await loadDice(d, uid);
    await saveDice(d, uid, t);
    return { ...respond(d, t), ...extra };
  });
}

/** Sepia hat gesagt, welche Zeichnungen übermalt wurden und was Markt und Tausch gebracht haben: die Hinweise kommen nicht wieder */
export async function diceSeen(d: Deps, userId: string | undefined): Promise<DiceResponse> {
  const uid = needUser(userId);
  return withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    delete s.paintedOver;
    // Sepias Nachrichten zu Markt und Tausch sind gelesen
    delete s.news;
    await saveDice(d, uid, s);
    return respond(d, s);
  });
}

/** Test-Knopf (Playtest, nur Mods): der nächste Zug hat diesen Stil (null: keinen) und, wenn holo, Holo */
export async function diceTestShiny(d: Deps, userId: string | undefined, username: string | undefined, style: unknown, holo: unknown = false): Promise<DiceResponse> {
  const uid = needUser(userId);
  if (!(await isTester(d, username))) throw new GameError('forbidden', 'Only for moderators in a playtest.', 403);
  const k = STYLES.find((x) => x.k === style)?.k ?? null;
  if (style !== null && !k) throw new GameError('bad_request', 'Unknown style.');
  return withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    if (k) s.forceStyle = k;
    else delete s.forceStyle;
    if (holo === true) s.forceHolo = true;
    else delete s.forceHolo;
    await saveDice(d, uid, s);
    return { ...respond(d, s), tester: true };
  });
}

/** Test-Knopf (Playtest, nur Mods): ein leerer Würfel mehr, ohne Wochengrenze */
export async function diceTestBlank(d: Deps, userId: string | undefined, username: string | undefined): Promise<DiceResponse> {
  const uid = needUser(userId);
  if (!(await isTester(d, username))) throw new GameError('forbidden', 'Only for moderators in a playtest.', 403);
  return withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    s.blank = (s.blank ?? 0) + 1;
    await saveDice(d, uid, s);
    return { ...respond(d, s), tester: true };
  });
}

/** Spielfarbe und Ausweichfarbe wählen (Menü), zwei verschiedene aus TEAM_COLORS */
export async function diceColor(d: Deps, userId: string | undefined, color: unknown, color2: unknown): Promise<DiceResponse> {
  const uid = needUser(userId);
  if (!isColor(color) || !isColor(color2)) throw new GameError('bad_request', 'Unknown colour.');
  if (color === color2) throw new GameError('bad_request', 'Pick two different colours.');
  return withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    s.color = color;
    s.color2 = color2;
    await saveDice(d, uid, s);
    return respond(d, s);
  });
}

/** Test-Knopf (Playtest, nur Mods): Pigment gutschreiben, je Tipp TEST_PIGMENT */
export const TEST_PIGMENT = 1000;
export async function diceTestPigment(d: Deps, userId: string | undefined, username: string | undefined): Promise<DiceResponse> {
  const uid = needUser(userId);
  if (!(await isTester(d, username))) throw new GameError('forbidden', 'Only for moderators in a playtest.', 403);
  return withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    s.pigment += TEST_PIGMENT;
    await saveDice(d, uid, s);
    return { ...respond(d, s), tester: true };
  });
}

export async function dicePull(d: Deps, userId: string | undefined, kind: unknown): Promise<DiceResponse> {
  const uid = needUser(userId);
  const k = (['starter', 'free', 'one', 'ten'] as PullKind[]).find((x) => x === kind);
  if (!k) throw new GameError('bad_request', 'Unknown dip.');
  return withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    const today = dayKey(d.now);
    let pulls: PullResult[] = [];
    if (k === 'starter') {
      if (s.starter < 1) throw new GameError('bad_request', 'Your free starter dips are used up.');
      pulls = runStarter(d, s);
    } else if (k === 'free') {
      if (s.freeDay === today) throw new GameError('bad_request', 'The free dip is back tomorrow.');
      s.freeDay = today;
      pulls = [pullOne(d, s, false, false)];
    } else {
      const n = k === 'ten' ? 10 : 1;
      const cost = k === 'ten' ? TEN_COST : PULL_COST;
      if (s.pigment < cost) throw new GameError('bad_request', `Not enough pigment (${cost} needed).`);
      s.pigment -= cost;
      for (let i = 0; i < n; i++) {
        // Zehnerzug: der letzte wird Rare, falls bis dahin keiner Rare oder besser war
        const last = n === 10 && i === 9 && pulls.every((p) => rarityIndex(p.rarity) < 2);
        pulls.push(pullOne(d, s, false, last));
      }
    }
    await claimPulls(d, uid, pulls);
    await saveDice(d, uid, s);
    return respond(d, s, pulls);
  });
}

/**
 * Selbst malen (Blank canvas): die Striche bestimmen nur die Form. Alles andere würfelt der Server wie bei einem Zug
 * (W100, Seltenheit, Papier, Pigment, Werte, Schutz vor Pech), danach ist die Zeichnung fest.
 */
export async function diceDraw(d: Deps, userId: string | undefined, code: unknown, username = ''): Promise<DiceResponse> {
  const uid = needUser(userId);
  const dr = typeof code === 'string' ? decodeDrawing(code) : null;
  if (!dr) throw new GameError('bad_request', 'That drawing did not survive the trip. Try again.');
  // Eine geschlossene Form ist nicht nötig (festgelegt am 30.10.2026): nur Linien werden breite Pinselstriche
  return withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    if (s.starter > 0) throw new GameError('bad_request', 'Dip your free dice first, then paint.');
    if ((s.blank ?? 0) < 1) throw new GameError('bad_request', 'No blank canvas left. A new one comes every Monday.');
    if (drawLocked(s, d.now)) throw new GameError('forbidden', 'Master Sepia has taken your brush for now.', 403);
    s.blank! -= 1;
    const p = pullOne(d, s, false, false);
    // Gespeichert wird die geprüfte, vereinfachte Fassung, nie ein Bild
    p.die.draw = encodeDrawing(dr);
    await claimPulls(d, uid, [p]);
    await saveDice(d, uid, s);
    // Jede neue Zeichnung kommt in die Prüfliste der Mods
    const key = `${uid}:${p.die.id}`;
    const item: ReviewItem = { key, uid, user: username, id: p.die.id, no: p.die.no ?? 0, seed: monsterSeed(p.die.sheet, p.die.idx), draw: p.die.draw, at: d.now };
    await d.redis.hSet(K.drawnQueue, { [key]: JSON.stringify(item) });
    return respond(d, s, [p]);
  });
}

/** Beutel neu packen: eigene, verschiedene Würfel, höchstens 6. Leere Plätze füllt das Duell mit den übrigen Würfeln */
export async function diceBag(d: Deps, userId: string | undefined, ids: unknown): Promise<DiceResponse> {
  const uid = needUser(userId);
  if (!Array.isArray(ids) || ids.some((x) => typeof x !== 'string')) throw new GameError('bad_request', 'Unknown dice.');
  return withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    const set = [...new Set(ids as string[])];
    if (set.length > BAG) throw new GameError('bad_request', `At most ${BAG} dice fit in the bag.`);
    if (!set.every((id) => s.dice.some((x) => x.id === id))) throw new GameError('bad_request', 'That die is not yours.');
    s.bag = set;
    await saveDice(d, uid, s);
    return respond(d, s);
  });
}

/** Lasur auf eine Würfelseite: ein einfaches Symbol wird doppelt. Kostet Lasur der eigenen Art. */
export async function diceGlaze(d: Deps, userId: string | undefined, id: unknown, face: unknown): Promise<DiceResponse> {
  const uid = needUser(userId);
  if (typeof id !== 'string' || !Number.isInteger(face) || (face as number) < 0 || (face as number) > 5) throw new GameError('bad_request', 'Unknown face.');
  return withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    const die = s.dice.find((x) => x.id === id);
    if (!die) throw new GameError('not_found', 'That die is not yours.', 404);
    const f = dieUnit(dieMonster(die), die.mods).faces[face as number]!;
    if (!isCrestFace(f) || f.n !== 1 || f.k2) throw new GameError('bad_request', 'Only a single crest takes a glaze.');
    const key = dieSpecies(die);
    if ((s.glaze[key] ?? 0) < GLAZE_COST) throw new GameError('bad_request', `Needs ${GLAZE_COST} glaze of this species.`);
    s.glaze[key]! -= GLAZE_COST;
    die.mods.push({ i: face as number, to: 'x2' });
    await saveDice(d, uid, s);
    return respond(d, s);
  });
}

/** Ein ausgewaschener Würfel im Archiv: alles, was ihn ausmacht, und woher er kommt */
/** Ausgewaschener Würfel im Archiv: von wem (name seit 31.10.2026, für die Karte, wenn er beim Rivalen zurücktreibt) */
export type Recycled = { die: DieRec; from: string; at: number; rarity: Rarity; name?: string };

/**
 * Würfel auswaschen: er verlässt die Sammlung und gibt seiner Art Lasur (so viel wie ein Doppelter früher).
 * Nicht im Deck, und es bleiben immer genug Würfel für ein volles Deck. Gelöscht wird er nicht (festgelegt am 30.10.2026):
 * er kommt ins Archiv, später für Gegner und Marktplatz. Das Register zeigt recycled, als neuer Zug kommt er nie wieder.
 */
export async function diceWash(d: Deps, userId: string | undefined, id: unknown, confirm?: unknown, username?: string): Promise<DiceResponse> {
  const uid = needUser(userId);
  if (typeof id !== 'string') throw new GameError('bad_request', 'Unknown die.');
  return withLock(d, playerLock(uid), async () => {
    const s = await loadDice(d, uid);
    const die = s.dice.find((x) => x.id === id);
    if (!die) throw new GameError('not_found', 'That die is not yours.', 404);
    if (s.bag.includes(id)) throw new GameError('bad_request', 'This die is in your deck. Take it out first.');
    if (s.dice.length <= KEEP_MIN) throw new GameError('bad_request', `Keep at least ${KEEP_MIN} dice for your deck.`);
    // Ein Shiny nur nach Rückfrage (festgelegt am 30.10.2026)
    if (die.holo && confirm !== true) throw new GameError('bad_request', 'This one is holo. Confirm to wash it out.');
    const key = dieSpecies(die);
    const rarity = rarityOfDie(die);
    s.dice = s.dice.filter((x) => x !== die);
    s.glaze[key] = (s.glaze[key] ?? 0) + washGlaze(rarity);
    // Erst ins Archiv, dann aus der Sammlung: geht etwas schief, ist der Würfel lieber doppelt als weg
    const seed = String(monsterSeed(die.sheet, die.idx));
    const rec: Recycled = { die, from: uid, at: d.now, rarity, ...(username ? { name: username } : {}) };
    await d.redis.hSet(K.recycled, { [seed]: JSON.stringify(rec) });
    await d.redis.zAdd(K.recycledAt, { member: seed, score: d.now });
    await d.redis.hSet(K.seeds, { [seed]: `recycled:${uid}:${die.id}` });
    await saveDice(d, uid, s);
    return respond(d, s);
  });
}

/** Beutel fürs Duell. Ohne Würfel laufen zuerst die freien Startzüge. Nur innerhalb der Spielersperre aufrufen. */
export async function bagForDuel(d: Deps, uid: string): Promise<DieRec[]> {
  const s = await loadDice(d, uid);
  let changed = false;
  if (s.dice.length < BAG && s.starter > 0) {
    await claimPulls(d, uid, runStarter(d, s));
    changed = true;
  }
  const bag = s.bag.map((id) => s.dice.find((x) => x.id === id)).filter((x): x is DieRec => !!x);
  for (const x of s.dice) if (bag.length < BAG && !bag.includes(x)) bag.push(x);
  if (bag.length !== s.bag.length) {
    s.bag = bag.map((x) => x.id);
    changed = true;
  }
  if (changed) await saveDice(d, uid, s);
  return bag;
}

/**
 * Patina: Würfe aus dem Duell zählen, an jeder Schwelle wird eine zufällige Seite besser
 * (einfach wird doppelt, doppelt wird dreifach oder Mischseite). Gewürfelt am Server
 */
export function wearDice(d: Deps, s: DiceSave, worn: { id: string; n: number }[]): NonNullable<DuelReward['patina']> {
  const out: NonNullable<DuelReward['patina']> = [];
  for (const w of worn) {
    const die = s.dice.find((x) => x.id === w.id);
    if (!die || !(w.n > 0)) continue;
    die.rolls = (die.rolls ?? 0) + Math.min(w.n, 60);
    while ((die.patina ?? 0) < PATINA.length && die.rolls >= PATINA[die.patina ?? 0]!) {
      die.patina = (die.patina ?? 0) + 1;
      const faces = dieUnit(dieMonster(die), die.mods).faces;
      const can = patinaFaces(faces);
      if (!can.length) continue;
      const i = can[d.rand() % can.length]!;
      const to = faces[i]!.n === 1 ? 'x2' : d.rand() % 2 ? 'x3' : 'mix';
      die.mods.push({ i, to, p: 1 });
      const u = dieUnit(dieMonster(die), die.mods);
      out.push({ id: die.id, level: die.patina, i, to, name: u.name, face: u.faces[i]! });
    }
  }
  return out;
}

/** Pigment nach einem Duell, dazu die Patina der geworfenen Würfel. Nur innerhalb der Spielersperre aufrufen. */
export async function payDuel(d: Deps, uid: string, winner: 0 | 1 | 2, tutorial: boolean, worn: { id: string; n: number }[] = []): Promise<DuelReward> {
  const s = await loadDice(d, uid);
  let reward: DuelReward;
  if (tutorial) {
    const p = s.tutorialPaid ? 0 : REWARD.tutorial;
    s.tutorialPaid = true;
    reward = { pigment: p, why: p ? 'tutorial' : 'capped', total: 0 };
  } else {
    const today = dayKey(d.now);
    if (s.rewardDay !== today) {
      s.rewardDay = today;
      s.rewardN = 0;
    }
    const why = winner === 1 ? 'win' : winner === 0 ? 'draw' : 'loss';
    if (s.rewardN < REWARD.perDay) {
      s.rewardN++;
      reward = { pigment: REWARD[why], why, total: 0 };
    } else reward = { pigment: 0, why: 'capped', total: 0 };
  }
  s.pigment += reward.pigment;
  reward.total = s.pigment;
  const patina = wearDice(d, s, worn);
  if (patina.length) reward.patina = patina;
  // Jedes fertige Duell schaltet das nächste Malmittel frei und zählt fürs Handeln
  if (!tutorial) {
    s.duels = (s.duels ?? 0) + 1;
    const have = s.media ?? [...START_MEDIA];
    const next = UNLOCK_ORDER.find((m) => !have.includes(m));
    if (next) {
      s.media = [...have, next];
      reward.unlocked = next;
    }
  }
  await saveDice(d, uid, s);
  return reward;
}

