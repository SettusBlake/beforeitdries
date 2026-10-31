/*
 * Lokale Vorschau ohne Reddit: liefert dist/client aus und beantwortet /api/* mit der echten
 * Server-Logik, Redis im Speicher und einem festen Testnutzer.
 * Start: npm run preview  (vorher npm run build)
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { adoptTopName, catchBlot, dayInfo, ensureDailyPost, GameError, glazeMonster, loadCollection, loadMonster, resolveDay, type Deps } from '../src/server/core';
import { diceBag, diceColor, diceDraw, diceGet, diceGlaze, diceSeen, diceTestBlank, diceTestPigment, diceTestShiny, diceWash, dicePull, bagForDuel, loadDice, saveDice, wearDice } from '../src/server/dice';
import { reportDrawing, reviewList, reviewOk, reviewOver, reviewUnlock } from '../src/server/drawings';
import { adoptNaming, diceShare, namingGet, speciesNames } from '../src/server/naming';
import { marketBuy, marketList, marketSell, marketTestBuy, marketTestList, marketUnlist, tradeAccept, tradeCancel, tradeCollection, tradeDecline, tradeList, tradeMsg, tradeOffer, tradeStatus, tradeTestOffer } from '../src/server/market';
import { duelAct, duelGet, duelStart } from '../src/server/duel';
import { galleryCollect, galleryFind, galleryHang, galleryStatus, galleryTestDecks, galleryTestSelf, hangDeck, payOwner } from '../src/server/gallery';
import { DUEL_PROTOCOL, PROTO_HEADER } from '../src/shared/api';
import { loadState } from '../src/shared/duel/play';
import { placements, rollable, ROLL_N, S, suggest } from '../src/shared/duel/rules';
import { K } from '../src/server/keys';
import { ensurePlayPost, playInfo } from '../src/server/play';
import { dayKey } from '../src/shared/day';
import { monsterSeed } from '../src/shared/monster';
import { encodeDrawing } from '../src/shared/drawn';
import { dieSpecies, PITY } from '../src/shared/dice';
import { secureUint32 } from '../src/server/rand';
import { FakeRedis } from './fake-redis';
import { FakeReddit } from './fake-reddit';

const PORT = Number(process.env.PORT ?? 5174);
const ROOT = path.resolve(process.env.DIST ?? 'dist/client');
const DRY_MS = Number(process.env.DRY_MS ?? 8 * 3600000);
const USER = { id: 't2_preview', name: 'preview_painter' };

const redis = new FakeRedis();
const reddit = new FakeReddit();
// Vorschau wie ein Playtest, der Vorschau-Spieler ist Mod (Test-Knopf sichtbar)
reddit.mods.push('preview_painter');
const deps = (): Deps => ({ redis, reddit, now: Date.now(), rand: secureUint32, subredditName: 'beforeitdries', appSlug: 'beforeitdries', dryMs: DRY_MS, appVersion: '0.0.1.99' });

const { postId } = await ensureDailyPost(deps());
// Ein älterer Tag, damit der Bogen mehr als ein Monster zeigt
const OLD = ['2026-10-25', '2026-10-26', '2026-10-27'];
for (const day of OLD) {
  const old = await ensureDailyPost(deps(), day);
  const ref = (await resolveDay(deps(), old.postId, undefined))!;
  await catchBlot({ ...deps(), now: Date.parse(day + 'T10:00:00Z') }, USER.id, USER.name, ref);
  reddit.addComment(old.postId, 'someone', day === OLD[0] ? 'Puddlemoth' : 'Gloamwick', 12);
  await adoptTopName(deps(), day);
}

await ensurePlayPost(deps());

/** Zuletzt geteilter „What do you see?“-Post: die Vorschau von name.html zeigt ihn */
let lastNaming = '';
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.map': 'application/json' };

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  try {
    const d = deps();
    const asUser = req.headers['x-preview-user'] === 'none' ? undefined : USER.id;
    if (url.pathname === '/api/init') {
      const ref = await resolveDay(d, postId, undefined);
      const caught = ref && asUser ? await loadMonster(d, `${ref.day}:${asUser}`) : null;
      return send(200, { user: asUser ? USER : null, day: ref ? await dayInfo(d, ref) : null, caught, todayPostId: postId, collectionCount: asUser ? await redis.zCard(K.userMonsters(asUser)) : 0, serverNow: d.now, dryMs: d.dryMs });
    }
    if (url.pathname === '/api/collection') return send(200, { ...(await loadCollection(d, USER.id)), serverNow: d.now, dryMs: d.dryMs });
    if (url.pathname === '/api/catch') return send(200, await catchBlot(d, asUser, USER.name, await resolveDay(d, postId, undefined)));
    if (url.pathname.startsWith('/api/duel')) {
      // Wie am echten Server: alte Oberflächen werden abgelehnt
      if (req.headers[PROTO_HEADER] !== String(DUEL_PROTOCOL)) return send(409, { code: 'outdated', error: 'Before It Dries was updated. Close this post and open it again.' });
      let raw = '';
      for await (const c of req) raw += c;
      const b = JSON.parse(raw || '{}');
      if (url.pathname === '/api/duel') return send(200, await duelGet(d, asUser));
      if (url.pathname === '/api/duel/start') return send(200, await duelStart(d, asUser, b.level, b.tutorial === true, b.gallery === true, USER.name));
      if (url.pathname === '/api/duel/act') return send(200, await duelAct(d, asUser, b.action, USER.name));
    }
    if (url.pathname === '/api/play') return send(200, await playInfo(d, asUser));
    if (url.pathname.startsWith('/api/dice')) {
      let raw = '';
      for await (const c of req) raw += c;
      const b = JSON.parse(raw || '{}');
      if (url.pathname === '/api/dice') {
        const trade = await tradeStatus(d, asUser, USER.name);
        const r = await diceGet(d, asUser, USER.name);
        return send(200, { ...r, gallery: await galleryStatus(d, USER.id, r.dice), trade });
      }
      if (url.pathname === '/api/dice/color') return send(200, await diceColor(d, asUser, b.color, b.color2));
      if (url.pathname === '/api/dice/test-blank') return send(200, await diceTestBlank(d, asUser, USER.name));
      if (url.pathname === '/api/dice/test-pigment') return send(200, await diceTestPigment(d, asUser, USER.name));
      if (url.pathname === '/api/dice/test-shiny') return send(200, await diceTestShiny(d, asUser, USER.name, b.style ?? null, b.holo ?? false));
      if (url.pathname === '/api/dice/pull') return send(200, await dicePull(d, asUser, b.kind));
      if (url.pathname === '/api/dice/bag') return send(200, await diceBag(d, asUser, b.ids));
      if (url.pathname === '/api/dice/glaze') return send(200, await diceGlaze(d, asUser, b.id, b.face));
      if (url.pathname === '/api/dice/wash') return send(200, await diceWash(d, asUser, b.id, b.confirm, USER.name));
      if (url.pathname === '/api/dice/draw') return send(200, await diceDraw(d, asUser, b.drawing, USER.name));
      if (url.pathname === '/api/dice/seen') return send(200, await diceSeen(d, asUser));
      if (url.pathname === '/api/dice/share') {
        const r = await diceShare(d, asUser, USER.name, b.id);
        lastNaming = r.postId;
        return send(200, r);
      }
    }
    if (url.pathname.startsWith('/api/gallery')) {
      let raw = '';
      for await (const c of req) raw += c;
      const b = JSON.parse(raw || '{}');
      if (url.pathname === '/api/gallery/find') return send(200, await galleryFind(d, asUser, USER.name, b.another));
      if (url.pathname === '/api/gallery/collect') return send(200, await galleryCollect(d, asUser));
      if (url.pathname === '/api/gallery/hang') return send(200, await galleryHang(d, asUser, b.on));
      if (url.pathname === '/api/gallery/test-decks') return send(200, await galleryTestDecks(d, asUser, USER.name));
      if (url.pathname === '/api/gallery/test-self') return send(200, await galleryTestSelf(d, asUser, USER.name, b.on));
    }
    if (url.pathname.startsWith('/api/market') || url.pathname.startsWith('/api/trade')) {
      let raw = '';
      for await (const c of req) raw += c;
      const b = JSON.parse(raw || '{}');
      const n = USER.name;
      const routes: Record<string, () => Promise<unknown>> = {
        '/api/market/list': () => marketList(d, asUser, n, b.filter, b.sort),
        '/api/market/sell': () => marketSell(d, asUser, n, b.id, b.price, b.confirm),
        '/api/market/unlist': () => marketUnlist(d, asUser, n, b.id),
        '/api/market/buy': () => marketBuy(d, asUser, n, b.id),
        '/api/market/test-list': () => marketTestList(d, asUser, n),
        '/api/market/test-buy': () => marketTestBuy(d, asUser, n),
        '/api/trade/list': () => tradeList(d, asUser, n),
        '/api/trade/collection': () => tradeCollection(d, asUser, b.name),
        '/api/trade/offer': () => tradeOffer(d, asUser, n, b.to, b.give, b.pig, b.want, b.confirm),
        '/api/trade/accept': () => tradeAccept(d, asUser, n, b.id, b.confirm),
        '/api/trade/decline': () => tradeDecline(d, asUser, n, b.id),
        '/api/trade/cancel': () => tradeCancel(d, asUser, n, b.id),
        '/api/trade/msg': () => tradeMsg(d, asUser, n, b.on),
        '/api/trade/test-offer': () => tradeTestOffer(d, asUser, n),
      };
      const f = routes[url.pathname];
      if (f) return send(200, await f());
    }
    if (url.pathname === '/api/drawn/report') {
      let raw = '';
      for await (const c of req) raw += c;
      return send(200, await reportDrawing(d, asUser, JSON.parse(raw || '{}').slot));
    }
    // Nur in der Vorschau: das laufende Duell zu Ende spielen lassen (Sepia malt für dich), danach Continue zeigt das Ergebnis
    if (url.pathname === '/dev/finish') {
      let res = await duelGet(d, USER.id);
      // round=n: nur bis Runde n (dein Zug, vor dem Wurf)
      const stop = Number(url.searchParams.get('round') ?? 99);
      for (let g = 0; g < 400 && res.state && !res.state.over; g++) {
        loadState(res.state);
        if (S.round >= stop && S.phase === 'roll') break;
        const ph = S.phase;
        const a =
          ph === 'medium'
            ? { k: 'medium', id: S.offer[0] }
            : ph === 'opening'
              ? (() => {
                  const u = S.teams[0].units[0]!;
                  const p = placements(u)[0]!;
                  return { k: 'open', id: u.id, o: p.o, at: p.at };
                })()
              : ph === 'roll'
                ? { k: 'roll', ids: rollable(S.teams[0]).slice(0, ROLL_N).map((u) => u.id) }
                : { k: 'auto' };
        res = await duelAct(d, USER.id, a, USER.name);
      }
      return send(200, { over: res.state?.over, winner: res.state?.winner, reward: res.reward });
    }
    // Nur in der Vorschau: im eigenen Zug bis zum Handeln weiter und einen Klecks handeln lassen (Sepias Vorschlag)
    if (url.pathname === '/dev/act') {
      let res = await duelGet(d, USER.id);
      for (let g = 0; g < 20 && res.state && !res.state.over; g++) {
        loadState(res.state);
        const ph = S.phase;
        if (S.turn !== 1 && ph !== 'medium') break;
        if (ph === 'act' && S.joker === 0) {
          const sg = suggest(1);
          if (sg) res = await duelAct(d, USER.id, { k: 'go', id: sg.u.id, to: sg.to, a: sg.a, at: sg.at }, USER.name);
          break;
        }
        const a =
          ph === 'medium'
            ? { k: 'medium', id: S.offer[0] }
            : ph === 'roll'
              ? { k: 'roll', ids: rollable(S.teams[0]).slice(0, ROLL_N).map((u) => u.id) }
              : ph === 'keep'
                ? { k: 'keep' }
                : ph === 'summon'
                  ? { k: 'skip' }
                  : { k: 'joker', crest: 'splash' };
        res = await duelAct(d, USER.id, a, USER.name);
      }
      return send(200, { phase: res.state?.phase });
    }
    // Nur in der Vorschau: fremde Farbe überall außer direkt am eigenen Gebiet (zum Ansehen überstehender Netze)
    if (url.pathname === '/dev/crowd') {
      const raw = await redis.get(K.duel(USER.id));
      if (!raw) return send(404, { error: 'no duel' });
      const save = JSON.parse(raw);
      const cells = save.cells as { owner: number; home: number }[];
      const rival = cells.find((c) => c.owner === 2 && !c.home);
      if (!rival) return send(404, { error: 'no rival paint' });
      const W = 6;
      const near = (i: number) => [i - 1, i + 1, i - W, i + W].some((j) => j >= 0 && j < cells.length && (Math.abs((j % W) - (i % W)) <= 1) && cells[j]!.owner === 1);
      cells.forEach((c, i) => {
        if (c.owner === 0 && !c.home && !near(i)) cells[i] = { ...rival };
      });
      await redis.set(K.duel(USER.id), JSON.stringify(save));
      return send(200, { ok: true });
    }
    // Nur in der Vorschau: Kleckse des Rivalen auf dem Blatt fast leer (zum Ansehen von WASH OUT und AGAIN)
    if (url.pathname === '/dev/weak') {
      const raw = await redis.get(K.duel(USER.id));
      if (!raw) return send(404, { error: 'no duel' });
      const save = JSON.parse(raw);
      for (const u of save.teams[1].units) if (u.state === 'sheet') u.hp = Math.min(u.hp, 2);
      await redis.set(K.duel(USER.id), JSON.stringify(save));
      return send(200, { ok: true });
    }
    // Nur in der Vorschau: n andere Spieler hängen ihr Deck in die Galerie, inbox=k: dein Deck wurde k-mal herausgefordert
    if (url.pathname === '/dev/gallery') {
      const n = Number(url.searchParams.get('n') ?? 4);
      for (let i = 1; i <= n; i++) {
        const uid = `t2_gallery${i}`;
        await bagForDuel(d, uid);
        const s = await loadDice(d, uid);
        // draw=1: im ersten Deck ein gemaltes Monster, schon von einem Mod freigegeben (zum Ausprobieren von Report)
        if (i === 1 && url.searchParams.has('draw')) {
          const die = s.dice.find((x) => x.id === s.bag[0])!;
          die.draw = encodeDrawing({ mirror: true, face: [0.5, 0.42], strokes: [[[0.5, 0.15], [0.3, 0.25], [0.22, 0.5], [0.3, 0.8], [0.5, 0.88]], [[0.32, 0.3], [0.18, 0.12]]] });
          await saveDice(d, uid, s);
          await d.redis.hSet(K.drawnOk, { [`${uid}:${die.id}`]: JSON.stringify({ key: `${uid}:${die.id}`, uid, user: 'inkwell', id: die.id, no: die.no, seed: 0, draw: die.draw, at: d.now, by: 'mod', when: d.now }) });
        }
        await hangDeck(d, uid, ['inkwell', 'oldbrush', 'wet_on_wet', 'gamboge_girl', 'sizing', 'deckle_edge'][(i - 1) % 6]! + (i > 6 ? i : ''), s);
      }
      // archive=k: k Würfel des ersten Decks liegen im Archiv (ausgewaschen von inkwell), im normalen Duell treiben sie zurück
      const ar = Number(url.searchParams.get('archive') ?? 0);
      if (ar) {
        const s1 = await loadDice(d, 't2_gallery1');
        for (const die of s1.dice.slice(0, ar)) {
          const seed = String(monsterSeed(die.sheet, die.idx));
          await d.redis.hSet(K.recycled, { [seed]: JSON.stringify({ die, from: 't2_gallery1', at: d.now, rarity: 'common', name: 'inkwell' }) });
          await d.redis.zAdd(K.recycledAt, { member: seed, score: d.now });
        }
      }
      const k = Number(url.searchParams.get('inbox') ?? 0);
      for (let i = 0; i < k; i++) await payOwner({ ...d, now: d.now + i }, USER.id, ([2, 2, 1, 0, 2, 1] as const)[i % 6]!, `painter_${i + 1}`);
      return send(200, { hung: n, inbox: k });
    }
    if (url.pathname === '/api/species') return send(200, await speciesNames(d));
    if (url.pathname === '/api/naming') return send(200, await namingGet(d, url.searchParams.get('post') ?? lastNaming));
    // Nur in der Vorschau: ein Kommentar und sofort benennen (wie das Mod-Menü „name it now“)
    if (url.pathname === '/dev/name') {
      const post = url.searchParams.get('post') ?? lastNaming;
      if (url.searchParams.has('name')) reddit.addComment(post, 'someone_else', url.searchParams.get('name')!, 7);
      return send(200, await adoptNaming(d, post, url.searchParams.has('cancel')));
    }
    if (url.pathname.startsWith('/api/review')) {
      let raw = '';
      for await (const c of req) raw += c;
      const b = JSON.parse(raw || '{}');
      if (url.pathname === '/api/review') return send(200, await reviewList(d, USER.name));
      if (url.pathname === '/api/review/ok') return send(200, await reviewOk(d, USER.name, b.key));
      if (url.pathname === '/api/review/over') return send(200, await reviewOver(d, USER.name, b.key));
      if (url.pathname === '/api/review/unlock') return send(200, await reviewUnlock(d, USER.name, b.uid));
    }
    // Nur in der Vorschau: Pigment und Lasur zum Ausprobieren
    // Patina zum Ansehen: jeder Würfel bekommt n Würfe dazu, wie nach Duellen
    if (url.pathname === '/dev/wear') {
      const s = await loadDice(d, USER.id);
      const n = Number(url.searchParams.get('n') ?? 10);
      const up = wearDice(d, s, s.dice.slice(0, Number(url.searchParams.get('k') ?? s.dice.length)).map((x) => ({ id: x.id, n })));
      await saveDice(d, USER.id, s);
      return send(200, up);
    }
    if (url.pathname === '/dev/pigment') {
      const s = await loadDice(d, USER.id);
      s.pigment += Number(url.searchParams.get('n') ?? 1000);
      for (const x of s.dice) s.glaze[dieSpecies(x)] = (s.glaze[dieSpecies(x)] ?? 0) + 6;
      if (url.searchParams.has('legendary')) s.pity.legendary = PITY.legendary - 1;
      if (url.searchParams.has('blank')) s.blank = Number(url.searchParams.get('blank'));
      await saveDice(d, USER.id, s);
      return send(200, { pigment: s.pigment });
    }
    if (url.pathname === '/api/glaze') {
      let raw = '';
      for await (const c of req) raw += c;
      const b = JSON.parse(raw || '{}');
      return send(200, await glazeMonster(d, USER.id, b.id, b.pigment));
    }
    const file = path.join(ROOT, url.pathname === '/' ? 'game.html' : url.pathname);
    if (!file.startsWith(ROOT)) return send(403, {});
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    if (e instanceof GameError) return send(e.status, { error: e.message, code: e.code, dryUntil: e.dryUntil });
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return send(404, {});
    console.error(e);
    send(500, { error: 'server', code: 'server' });
  }
}).listen(PORT, () => console.log(`Vorschau: http://localhost:${PORT}/game.html (Tag ${dayKey()}, Post ${postId})`));
