/*
 * Lokale Vorschau ohne Reddit: liefert dist/client aus und beantwortet /api/* mit der echten
 * Server-Logik, Redis im Speicher und einem festen Testnutzer.
 * Start: npm run preview  (vorher npm run build)
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { GameError, type Deps } from '../src/server/core';
import { diceBag, diceColor, diceDraw, diceGet, diceGlaze, diceTint, diceSeen, diceTestStage, lessonDone, diceTestBlank, diceTestPigment, diceTestShiny, diceWash, dicePull, bagForDuel, loadDice, saveDice, wearDice } from '../src/server/dice';
import { reportDrawing, reviewList, reviewOk, reviewOver, reviewUnlock } from '../src/server/drawings';
import { adoptNaming, diceShare, namingGet, speciesNames } from '../src/server/naming';
import { marketBuy, marketList, marketSell, marketTestBuy, marketTestList, marketUnlist, tradeAccept, tradeCancel, tradeCollection, tradeDecline, tradeList, tradeMsg, tradeOffer, tradeStatus, tradeTestOffer } from '../src/server/market';
import { duelAct, duelGet, duelStart } from '../src/server/duel';
import { bleachAct, bleachGet, bleachShare, bleachStart, ensureSheetPost, sheetGet } from '../src/server/bleach';
import { galleryCollect, galleryFind, galleryHang, galleryStatus, galleryTestDecks, galleryTestSelf, hangDeck, payOwner } from '../src/server/gallery';
import { DUEL_PROTOCOL, PROTO_HEADER, type DuelReward } from '../src/shared/api';
import { loadState } from '../src/shared/duel/play';
import { placements, rollable, ROLL_N, S, suggest } from '../src/shared/duel/rules';
import { K } from '../src/server/keys';
import { cleanTestData } from '../src/server/community';
import { ensurePlayPost, playInfo } from '../src/server/play';
import { dayKey } from '../src/shared/day';
import { monsterSeed } from '../src/shared/monster';
import { encodeDrawing } from '../src/shared/drawn';
import { dieSpecies, PITY } from '../src/shared/dice';
import { isPigment } from '../src/shared/data';
import { secureUint32 } from '../src/server/rand';
import { FakeRedis } from './fake-redis';
import { FakeReddit } from './fake-reddit';
import { joinSub, streakFlairToggle } from '../src/server/daily';

const PORT = Number(process.env.PORT ?? 5174);
const ROOT = path.resolve(process.env.DIST ?? 'dist/client');
const USER = { id: 't2_preview', name: 'preview_painter' };
/** Vorschau des Tagesposts am nächsten Tag (fertige Rangliste) */
let sheetLater = false;

const redis = new FakeRedis();
const reddit = new FakeReddit();
// Vorschau wie ein Playtest, der Vorschau-Spieler ist Mod (Test-Knopf sichtbar)
reddit.mods.push('preview_painter');
const deps = (): Deps => ({ redis, reddit, now: Date.now(), rand: secureUint32, subredditName: 'beforeitdries', appSlug: 'beforeitdries', appVersion: '0.0.1.99' });

// Zwei benannte Arten, damit Sammlung und Karten Namen zeigen
for (const [key, name] of [
  ['kriecher:ultra', 'Puddlemoth'],
  ['flatterer:karmin', 'Gloamwick'],
] as const) {
  await redis.hSet(K.species(key), { name, namedBy: 'someone', firstSeen: dayKey() });
  await redis.zAdd(K.speciesIndex, { member: key, score: Date.now() });
}
await ensurePlayPost(deps());

/** Zuletzt geteilter „What do you see?“-Post: die Vorschau von name.html zeigt ihn */
let lastNaming = '';
let pendingReward: DuelReward | undefined;
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
    if (url.pathname.startsWith('/api/duel') || url.pathname.startsWith('/api/bleach')) {
      // Wie am echten Server: alte Oberflächen werden abgelehnt
      if (req.headers[PROTO_HEADER] !== String(DUEL_PROTOCOL)) return send(409, { code: 'outdated', error: 'Before It Dries was updated. Close this post and open it again.' });
      let raw = '';
      for await (const c of req) raw += c;
      const b = JSON.parse(raw || '{}');
      if (url.pathname === '/api/duel') {
        // Vorschau: nach /dev/finish kommt die Belohnung einmal mit, damit das Ergebnis sie zeigt
        const r = await duelGet(d, asUser);
        if (pendingReward && r.state?.over) r.reward = pendingReward;
        return send(200, r);
      }
      if (url.pathname === '/api/duel/start') pendingReward = undefined;
      if (url.pathname === '/api/duel/start') return send(200, await duelStart(d, asUser, b.level, b.tutorial === true, b.gallery === true, USER.name));
      if (url.pathname === '/api/duel/act') return send(200, await duelAct(d, asUser, b.action, USER.name));
      if (url.pathname === '/api/bleach') return send(200, await bleachGet(d, asUser, USER.name));
      if (url.pathname === '/api/bleach/start') return send(200, await bleachStart(d, asUser, USER.name, b.test === true));
      if (url.pathname === '/api/bleach/act') return send(200, await bleachAct(d, asUser, b.action, USER.name));
      if (url.pathname === '/api/bleach/share') return send(200, await bleachShare(d, asUser, USER.name, b.test === true));
    }
    // Tagespost: Vorschau zeigt den Post des Tages, mit /dev/sheet?later=1 den Stand am nächsten Tag (fertige Rangliste)
    if (url.pathname === '/api/sheet') {
      const post = await ensureSheetPost(d);
      return send(200, await sheetGet(sheetLater ? { ...d, now: d.now + 86_400_000 } : d, asUser, post.id, Number(url.searchParams.get("n")) || undefined));
    }
    if (url.pathname === '/dev/sheet') {
      sheetLater = url.searchParams.get('later') === '1';
      // n Maler spielen das Tagesblatt (Sepia spielt für sie)
      const n = Number(url.searchParams.get('n') ?? 0);
      const names = ['inkwell', 'oldbrush', 'gumdrop', 'saltmarsh', 'umberella', 'washday', 'deckle', 'cotman', 'hake', 'sable', 'mopbrush', 'rigger'];
      for (let k = 0; k < n; k++) {
        const uid = `t2_sheet${Date.now()}_${k}`;
        const s = await loadDice(d, uid);
        s.tutorialPaid = true;
        s.color = (['carmine', 'viridian', 'cadmium', 'violet', 'cerulean', 'sepia', 'rose', 'lemon', 'sap', 'turquoise', 'magenta', 'coral'] as const)[k % 12];
        await saveDice(d, uid, s);
        const dk = { ...d, now: d.now + k * 1000 };
        let r = await bleachStart(dk, uid, names[k % names.length]);
        loadState(r.state!);
        const u = S.teams[0].units[0]!;
        const p = placements(u)[0]!;
        r = await bleachAct(dk, uid, { k: 'open', id: u.id, o: p.o, at: p.at }, names[k % names.length]);
        for (let g = 0; g < 60 && !r.state!.over; g++) {
          loadState(r.state!);
          const a = S.phase === 'roll' ? { k: 'roll' as const, ids: S.teams[0].units.filter((x) => x.state === 'bag' && !x.used).slice(0, 3).map((x) => x.id) } : { k: 'auto' as const };
          r = await bleachAct(dk, uid, a, names[k % names.length]);
        }
      }
      return send(200, { later: sheetLater, played: n });
    }
    if (url.pathname === '/dev/comments') return send(200, reddit.appComments);
    if (url.pathname === '/api/play') return send(200, await playInfo(d, asUser));
    // Tägliche Aktivität: Beitreten und Strähne als Flair (die Flair steht in reddit.userFlairs, /dev/flair zeigt sie)
    if (url.pathname === '/api/join') return send(200, await joinSub(d, asUser));
    if (url.pathname === '/api/streak/flair') {
      let raw = '';
      for await (const c of req) raw += c;
      return send(200, await streakFlairToggle(d, asUser, USER.name, JSON.parse(raw || '{}').on));
    }
    if (url.pathname === '/dev/flair') return send(200, { flair: reddit.userFlairs.get(USER.name) ?? null, subscribed: reddit.subscribed });
    // Nur in der Vorschau: Strähne setzen (/dev/streak?n=6&last=2026-11-03), damit der heutige Lauf Tag 7 wird. Schaltet das Lern-Duell frei
    if (url.pathname === '/dev/streak') {
      const s = await loadDice(d, USER.id);
      const n = Number(url.searchParams.get('n') ?? 0);
      const last = url.searchParams.get('last') ?? dayKey(Date.now() - 86_400_000);
      s.tutorialPaid = true;
      if (n > 0) s.streak = { n, last, best: Math.max(n, Number(url.searchParams.get('best') ?? n)) };
      else delete s.streak;
      await saveDice(d, USER.id, s);
      return send(200, s.streak ?? null);
    }
    // Nur in der Vorschau: Regelstufe setzen (/dev/stage?n=3, ohne n: alles wie ein Spieler von vorher). Schaltet die Lektion frei
    if (url.pathname === '/dev/stage') {
      const s = await loadDice(d, USER.id);
      const n = Number(url.searchParams.get('n') ?? 0);
      s.tutorialPaid = true;
      if (n >= 1 && n <= 6) s.stage = n;
      else delete s.stage;
      await saveDice(d, USER.id, s);
      return send(200, { stage: s.stage ?? 'all' });
    }
    if (url.pathname === '/api/mod/clean-test') return send(200, await cleanTestData(d, asUser, USER.name));
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
      if (url.pathname === '/api/dice/test-stage') return send(200, await diceTestStage(d, asUser, USER.name, b.stage ?? null));
      if (url.pathname === '/api/dice/test-shiny') return send(200, await diceTestShiny(d, asUser, USER.name, b.style ?? null, b.holo ?? false));
      if (url.pathname === '/api/dice/pull') return send(200, await dicePull(d, asUser, b.kind, b.brush ?? 'plain'));
      if (url.pathname === '/api/dice/bag') return send(200, await diceBag(d, asUser, b.ids));
      if (url.pathname === '/api/dice/glaze') return send(200, await diceGlaze(d, asUser, b.id, b.face));
      if (url.pathname === '/api/dice/tint') return send(200, await diceTint(d, asUser, b.id, b.face, b.pig));
      if (url.pathname === '/api/dice/wash') return send(200, await diceWash(d, asUser, b.id, b.confirm, USER.name));
      if (url.pathname === '/api/dice/draw') return send(200, await diceDraw(d, asUser, b.drawing, USER.name));
      if (url.pathname === '/api/dice/seen') return send(200, await diceSeen(d, asUser));
      if (url.pathname === '/api/dice/lesson') return send(200, await lessonDone(d, asUser));
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
      pendingReward = res.reward;
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
    // Nur in der Vorschau: Tropfen setzen (/dev/drops?karmin=5&ultra=3)
    if (url.pathname === '/dev/drops') {
      const s = await loadDice(d, USER.id);
      s.drops = { ...s.drops };
      for (const [k, v] of url.searchParams) if (isPigment(k)) s.drops[k] = Number(v);
      await saveDice(d, USER.id, s);
      return send(200, s.drops);
    }
    if (url.pathname === '/dev/pigment') {
      const s = await loadDice(d, USER.id);
      s.pigment += Number(url.searchParams.get('n') ?? 1000);
      for (const x of s.dice) s.glaze[dieSpecies(x)] = (s.glaze[dieSpecies(x)] ?? 0) + 6;
      if (url.searchParams.has('legendary')) s.pity.legendary = PITY.legendary - 1;
      if (url.searchParams.has('blank')) s.blank = Number(url.searchParams.get('blank'));
      // Bleach freischalten (sonst erst nach dem Lern-Duell)
      if (url.searchParams.has('unlock')) s.tutorialPaid = true;
      await saveDice(d, USER.id, s);
      return send(200, { pigment: s.pigment });
    }
    const file = path.join(ROOT, url.pathname === '/' ? 'duel.html' : url.pathname);
    if (!file.startsWith(ROOT)) return send(403, {});
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    if (e instanceof GameError) return send(e.status, { error: e.message, code: e.code });
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return send(404, {});
    console.error(e);
    send(500, { error: 'server', code: 'server' });
  }
}).listen(PORT, () => console.log(`Vorschau: http://localhost:${PORT}/duel.html (Tag ${dayKey()})`));
