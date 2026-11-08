/* Devvit-Web-Server: /api/* für die Webviews, /internal/* für Menü, Trigger und Scheduler */
import express, { type NextFunction, type Request, type Response } from 'express';
import { context, createServer, getServerPort, reddit, redis, scheduler } from '@devvit/web/server';
import type { MenuItemRequest, OnCommentDeleteRequest, OnPostDeleteRequest, UiResponse } from '@devvit/web/shared';
import { DUEL_PROTOCOL, PROTO_HEADER, type ErrorResponse } from '../shared/api';
import { GameError, type Deps, type RedditLike } from './core';
import { diceBag, diceColor, diceDraw, diceGet, diceGlaze, dicePull, diceSeen, diceTestStage, lessonDone, diceTestBlank, diceTestPigment, diceTestShiny, diceTint, diceWash } from './dice';
import { reportDrawing, reviewList, reviewOk, reviewOver, reviewUnlock } from './drawings';
import { duelAct, duelGet, duelStart } from './duel';
import { bleachAct, bleachGet, bleachShare, bleachStart, ensureSheetPost, sheetGet } from './bleach';
import { galleryCollect, galleryFind, galleryHang, galleryStatus, galleryTestDecks, galleryTestSelf } from './gallery';
import { joinSub, streakFlairSweep, streakFlairToggle } from './daily';
import { marketBuy, marketList, marketSell, marketTestBuy, marketTestList, marketUnlist, tradeAccept, tradeCancel, tradeCollection, tradeDecline, tradeList, tradeMsg, tradeOffer, tradeStatus, tradeTestOffer } from './market';
import { adoptNaming, diceShare, namingGet, speciesNames, withdrawName, type NamingResult } from './naming';
import { cleanTestData, refreshLinks, setupCommunity, setupToast } from './community';
import { giftOpen, giftTestAgain } from './gift';
import { ensurePlayPost, playInfo } from './play';
import { commentGone, postGone } from './deletion';
import { accountCheck, purgeRun } from './accounts';
import { secureUint32 } from './rand';

async function deps(): Promise<Deps> {
  return {
    redis,
    reddit: reddit as unknown as RedditLike,
    now: Date.now(),
    rand: secureUint32,
    subredditName: context.subredditName,
    appSlug: context.appSlug ?? context.appName ?? '',
    appVersion: context.appVersion,
    schedule: async (name, runAt, data) => {
      await scheduler.runJob({ name, runAt, data });
    },
  };
}

/** Name des Spielers für die Mod-Prüfung (Test-Knopf), nur wenn ein Login da ist */
async function username(): Promise<string | undefined> {
  if (!context.userId) return undefined;
  return context.username ?? (await reddit.getCurrentUsername().catch(() => undefined));
}

type Handler = (req: Request, res: Response) => Promise<unknown>;
const wrap =
  (fn: Handler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };

const app = express();
app.use(express.json({ limit: '16kb' }));

/* ---------- API für die Webviews ---------- */


/* ---------- Farbschlacht ---------- */

/** Alte Oberfläche nach einem Update: Regeln und Anzeige passen nicht mehr zusammen, also lieber neu öffnen lassen */
function sameProtocol(req: { get: (h: string) => string | undefined }): void {
  if (req.get(PROTO_HEADER) !== String(DUEL_PROTOCOL)) throw new GameError('outdated', 'Before It Dries was updated. Close this post and open it again.', 409);
}

app.get(
  '/api/duel',
  wrap(async (req, res) => {
    sameProtocol(req);
    res.json(await duelGet(await deps(), context.userId));
  }),
);

app.post(
  '/api/duel/start',
  wrap(async (req, res) => {
    sameProtocol(req);
    const body = (req.body ?? {}) as { level?: unknown; tutorial?: unknown; gallery?: unknown };
    res.json(await duelStart(await deps(), context.userId, body.level, body.tutorial === true, body.gallery === true, await username()));
  }),
);

app.post(
  '/api/duel/act',
  wrap(async (req, res) => {
    sameProtocol(req);
    res.json(await duelAct(await deps(), context.userId, (req.body as { action?: unknown } | undefined)?.action, await username()));
  }),
);

/* ---------- Bleach: das Tagesblatt gegen die Bleiche vom Rand ---------- */

app.get(
  '/api/bleach',
  wrap(async (req, res) => {
    sameProtocol(req);
    res.json(await bleachGet(await deps(), context.userId, await username()));
  }),
);
app.post(
  '/api/bleach/start',
  wrap(async (req, res) => {
    sameProtocol(req);
    res.json(await bleachStart(await deps(), context.userId, await username(), (req.body as { test?: unknown } | undefined)?.test === true));
  }),
);
app.post(
  '/api/bleach/act',
  wrap(async (req, res) => {
    sameProtocol(req);
    res.json(await bleachAct(await deps(), context.userId, (req.body as { action?: unknown } | undefined)?.action, await username()));
  }),
);
/* Teilen als Kommentar unter dem Tagespost, im Namen des Spielers (nur auf ausdrücklichen Tipp) */
app.post(
  '/api/bleach/share',
  wrap(async (req, res) => {
    res.json(await bleachShare(await deps(), context.userId, await username(), (req.body as { test?: unknown } | undefined)?.test === true));
  }),
);
/* Tagespost (inline im Feed): Rangliste des Tages, zu dem der Post gehört. ?n=50: volle Liste im Spiel */
app.get(
  '/api/sheet',
  wrap(async (req, res) => {
    res.json(await sheetGet(await deps(), context.userId, context.postId, Number(req.query.n) || undefined));
  }),
);

/* ---------- Galerie: Decks anderer Spieler ---------- */

app.post(
  '/api/dice/color',
  wrap(async (req, res) => {
    const b = (req.body ?? {}) as { color?: unknown; color2?: unknown };
    res.json(await diceColor(await deps(), context.userId, b.color, b.color2));
  }),
);

app.post(
  '/api/drawn/report',
  wrap(async (req, res) => {
    res.json(await reportDrawing(await deps(), context.userId, (req.body as { slot?: unknown } | undefined)?.slot));
  }),
);

app.post(
  '/api/gallery/find',
  wrap(async (req, res) => {
    res.json(await galleryFind(await deps(), context.userId, await username(), (req.body as { another?: unknown } | undefined)?.another));
  }),
);

app.post(
  '/api/gallery/collect',
  wrap(async (_req, res) => {
    res.json(await galleryCollect(await deps(), context.userId));
  }),
);

app.post(
  '/api/gallery/hang',
  wrap(async (req, res) => {
    res.json(await galleryHang(await deps(), context.userId, (req.body as { on?: unknown } | undefined)?.on));
  }),
);

app.post(
  '/api/gallery/test-decks',
  wrap(async (_req, res) => {
    res.json(await galleryTestDecks(await deps(), context.userId, await username()));
  }),
);

app.post(
  '/api/gallery/test-self',
  wrap(async (req, res) => {
    res.json(await galleryTestSelf(await deps(), context.userId, await username(), (req.body as { on?: unknown } | undefined)?.on));
  }),
);

/* ---------- Spiel-Post ---------- */

app.get(
  '/api/play',
  wrap(async (_req, res) => {
    res.json(await playInfo(await deps(), context.userId));
  }),
);

/* ---------- Würfelsammlung ---------- */

app.get(
  '/api/dice',
  wrap(async (_req, res) => {
    const d = await deps();
    const name = await username();
    // Erst Lieferungen aus Markt und Tausch abholen, dann die Sammlung laden
    const trade = await tradeStatus(d, context.userId, name);
    const r = await diceGet(d, context.userId, name);
    // Dazu, wie dein Deck in der Galerie läuft
    res.json({ ...r, gallery: await galleryStatus(d, context.userId!, r.dice), trade });
  }),
);

app.post(
  '/api/dice/pull',
  wrap(async (req, res) => {
    const b = req.body as { kind?: unknown; brush?: unknown } | undefined;
    res.json(await dicePull(await deps(), context.userId, b?.kind, b?.brush ?? 'plain'));
  }),
);

app.post(
  '/api/dice/bag',
  wrap(async (req, res) => {
    res.json(await diceBag(await deps(), context.userId, (req.body as { ids?: unknown } | undefined)?.ids));
  }),
);

app.post(
  '/api/dice/tint',
  wrap(async (req, res) => {
    const body = (req.body ?? {}) as { id?: unknown; face?: unknown; pig?: unknown };
    res.json(await diceTint(await deps(), context.userId, body.id, body.face, body.pig));
  }),
);
app.post(
  '/api/dice/glaze',
  wrap(async (req, res) => {
    const body = (req.body ?? {}) as { id?: unknown; face?: unknown };
    res.json(await diceGlaze(await deps(), context.userId, body.id, body.face));
  }),
);

app.post(
  '/api/dice/wash',
  wrap(async (req, res) => {
    const body = (req.body ?? {}) as { id?: unknown; confirm?: unknown };
    res.json(await diceWash(await deps(), context.userId, body.id, body.confirm, await username()));
  }),
);
app.post(
  '/api/dice/test-shiny',
  wrap(async (req, res) => {
    const b = req.body as { style?: unknown; holo?: unknown } | undefined;
    res.json(await diceTestShiny(await deps(), context.userId, await username(), b?.style ?? null, b?.holo ?? false));
  }),
);
app.post(
  '/api/dice/test-blank',
  wrap(async (_req, res) => {
    res.json(await diceTestBlank(await deps(), context.userId, await username()));
  }),
);
app.post(
  '/api/dice/test-stage',
  wrap(async (req, res) => {
    res.json(await diceTestStage(await deps(), context.userId, await username(), (req.body as { stage?: unknown } | undefined)?.stage ?? null));
  }),
);
app.post(
  '/api/dice/test-pigment',
  wrap(async (_req, res) => {
    res.json(await diceTestPigment(await deps(), context.userId, await username()));
  }),
);
app.post(
  '/api/dice/draw',
  wrap(async (req, res) => {
    res.json(await diceDraw(await deps(), context.userId, (req.body as { drawing?: unknown } | undefined)?.drawing, await username()));
  }),
);
// Tagesgeschenk (T8): öffnen, Test-Knopf zum erneuten Öffnen (Playtest, nur Mods)
app.post(
  '/api/dice/gift',
  wrap(async (_req, res) => {
    res.json(await giftOpen(await deps(), context.userId));
  }),
);
app.post(
  '/api/dice/test-gift',
  wrap(async (_req, res) => {
    res.json(await giftTestAgain(await deps(), context.userId, await username()));
  }),
);
app.post(
  '/api/dice/lesson',
  wrap(async (_req, res) => {
    res.json(await lessonDone(await deps(), context.userId));
  }),
);
app.post(
  '/api/dice/seen',
  wrap(async (_req, res) => {
    res.json(await diceSeen(await deps(), context.userId));
  }),
);

/* ---------- Markt und Tausch (docs/entwuerfe/tausch-und-markt-plan.md) ---------- */

type Body = Record<string, unknown>;
const body = (req: Request): Body => (req.body ?? {}) as Body;
const route = (path: string, fn: (d: Deps, uid: string | undefined, name: string | undefined, b: Body) => Promise<unknown>) =>
  app.post(
    path,
    wrap(async (req, res) => {
      res.json(await fn(await deps(), context.userId, await username(), body(req)));
    }),
  );
route('/api/market/list', (d, u, n, b) => marketList(d, u, n, b.filter, b.sort));
route('/api/market/sell', (d, u, n, b) => marketSell(d, u, n, b.id, b.price, b.confirm));
route('/api/market/unlist', (d, u, n, b) => marketUnlist(d, u, n, b.id));
route('/api/market/buy', (d, u, n, b) => marketBuy(d, u, n, b.id));
route('/api/market/test-list', (d, u, n) => marketTestList(d, u, n));
route('/api/market/test-buy', (d, u, n) => marketTestBuy(d, u, n));
route('/api/trade/list', (d, u, n) => tradeList(d, u, n));
route('/api/trade/collection', (d, u, _n, b) => tradeCollection(d, u, b.name));
route('/api/trade/offer', (d, u, n, b) => tradeOffer(d, u, n, b.to, b.give, b.pig, b.want, b.confirm));
route('/api/trade/accept', (d, u, n, b) => tradeAccept(d, u, n, b.id, b.confirm));
route('/api/trade/decline', (d, u, n, b) => tradeDecline(d, u, n, b.id));
route('/api/trade/cancel', (d, u, n, b) => tradeCancel(d, u, n, b.id));
route('/api/trade/msg', (d, u, n, b) => tradeMsg(d, u, n, b.on));
/* Tägliche Aktivität (T1, T2): Beitreten und Strähne als Flair */
route('/api/join', (d, u) => joinSub(d, u));
route('/api/streak/flair', (d, u, n, b) => streakFlairToggle(d, u, n, b.on));
route('/api/trade/test-offer', (d, u, n) => tradeTestOffer(d, u, n));

/* ---------- Benennen: „What do you see?“-Posts ---------- */

app.get(
  '/api/species',
  wrap(async (_req, res) => {
    res.json(await speciesNames(await deps()));
  }),
);
app.post(
  '/api/dice/share',
  wrap(async (req, res) => {
    res.json(await diceShare(await deps(), context.userId, await username(), (req.body as { id?: unknown } | undefined)?.id));
  }),
);
app.get(
  '/api/naming',
  wrap(async (_req, res) => {
    res.json(await namingGet(await deps(), context.postId));
  }),
);

/* ---------- Zeichnungen prüfen (nur Mods) ---------- */

app.get(
  '/api/review',
  wrap(async (_req, res) => {
    res.json(await reviewList(await deps(), await username()));
  }),
);
app.post(
  '/api/review/ok',
  wrap(async (req, res) => {
    res.json(await reviewOk(await deps(), await username(), (req.body as { key?: unknown } | undefined)?.key));
  }),
);
app.post(
  '/api/review/over',
  wrap(async (req, res) => {
    res.json(await reviewOver(await deps(), await username(), (req.body as { key?: unknown } | undefined)?.key));
  }),
);
app.post(
  '/api/review/unlock',
  wrap(async (req, res) => {
    res.json(await reviewUnlock(await deps(), await username(), (req.body as { uid?: unknown } | undefined)?.uid));
  }),
);

/* ---------- Menü, Trigger, Scheduler ---------- */

app.post(
  '/internal/menu/post-play',
  wrap(async (_req, res) => {
    const d = await deps();
    const r = await ensurePlayPost(d, true);
    await refreshLinks(d);
    const body: UiResponse = { showToast: { text: 'The play post is up and pinned.', appearance: 'success' }, ...(r.url ? { navigateTo: r.url } : {}) };
    res.json(body);
  }),
);

/* Auftritt des Subreddits: Regeln, Gründe, Flairs, Seitenleiste, Wiki (docs/entwuerfe/publish-plan.md) */
app.post(
  '/internal/menu/setup-community',
  wrap(async (_req, res) => {
    const r = await setupCommunity(await deps());
    res.json({ showToast: { text: setupToast(r), appearance: r.errors.length ? 'neutral' : 'success' } } satisfies UiResponse);
  }),
);
/* Testdaten vor dem Start entfernen (Playtest, nur Mods) */
app.post(
  '/api/mod/clean-test',
  wrap(async (_req, res) => {
    res.json(await cleanTestData(await deps(), context.userId, await username()));
  }),
);

app.post(
  '/internal/triggers/on-app-install',
  wrap(async (_req, res) => {
    await ensurePlayPost(await deps());
    res.json({});
  }),
);

/* Bei jedem Update (auch Playtest-Upload): Spiel-Post anlegen, falls es noch keinen gibt */
app.post(
  '/internal/triggers/on-app-upgrade',
  wrap(async (_req, res) => {
    const d = await deps();
    try {
      await ensurePlayPost(d);
    } catch (e) {
      console.error('ensurePlayPost', e);
    }
    res.json({});
  }),
);

/* Löschpflichten: gelöschte oder entfernte Posts und Kommentare */
app.post(
  '/internal/triggers/on-post-delete',
  wrap(async (req, res) => {
    const b = req.body as Partial<OnPostDeleteRequest> | undefined;
    const done = await postGone(await deps(), b?.postId);
    if (done.length) console.log('post deleted', b?.postId, done.join(', '));
    res.json({});
  }),
);
app.post(
  '/internal/triggers/on-comment-delete',
  wrap(async (req, res) => {
    const b = req.body as Partial<OnCommentDeleteRequest> | undefined;
    const done = await commentGone(await deps(), b?.commentId, b?.postId);
    if (done.length) console.log('comment deleted', b?.commentId, done.join(', '));
    res.json({});
  }),
);

/* Gelöschte Konten: täglich reihum bei Reddit nachfragen, nach 21 Tagen am Stück bereinigen (src/server/accounts.ts) */
app.post(
  '/internal/scheduler/account-check',
  wrap(async (_req, res) => {
    const r = await accountCheck(await deps());
    console.log('account check', JSON.stringify(r));
    res.json({});
  }),
);
/* Angefangene Bereinigung fortsetzen (plant sich selbst eine Minute später, solange etwas offen ist) */
app.post(
  '/internal/scheduler/account-purge',
  wrap(async (_req, res) => {
    const done = await purgeRun(await deps());
    if (done.length) console.log('accounts purged', done.length);
    res.json({});
  }),
);

/* Benennen nach 24 Stunden */
app.post(
  '/internal/scheduler/name-species',
  wrap(async (req, res) => {
    const postId = (req.body as { data?: { postId?: unknown } } | undefined)?.data?.postId;
    if (typeof postId === 'string') console.log('naming', postId, JSON.stringify(await adoptNaming(await deps(), postId)));
    res.json({});
  }),
);
const namingToast = (r: NamingResult): string =>
  r.status === 'named'
    ? `Named: ${r.name} (by u/${r.namedBy})`
    : r.status === 'empty'
      ? 'No valid name in the comments. The species stays open.'
      : r.status === 'cancelled'
        ? 'Naming closed without a name.'
        : r.status === 'closed'
          ? `This naming is already over${r.name ? `: ${r.name}` : ''}.`
          : 'This is not a naming post.';
app.post(
  '/internal/menu/name-now',
  wrap(async (req, res) => {
    const target = (req.body as MenuItemRequest | undefined)?.targetId ?? '';
    res.json({ showToast: namingToast(await adoptNaming(await deps(), target)) } satisfies UiResponse);
  }),
);
app.post(
  '/internal/menu/cancel-naming',
  wrap(async (req, res) => {
    const target = (req.body as MenuItemRequest | undefined)?.targetId ?? '';
    res.json({ showToast: namingToast(await adoptNaming(await deps(), target, true)) } satisfies UiResponse);
  }),
);
/* Mod-Menü am Kommentar: einen anstößigen Artnamen zurücknehmen, die Art wird wieder offen */
app.post(
  '/internal/menu/withdraw-name',
  wrap(async (req, res) => {
    const target = (req.body as MenuItemRequest | undefined)?.targetId ?? '';
    const r = await withdrawName(await deps(), target);
    console.log('withdraw name', target, r.text);
    res.json({ showToast: r.text } satisfies UiResponse);
  }),
);

/* Bleach: Tagespost kurz nach Mitternacht UTC */
app.post(
  '/internal/scheduler/daily-sheet',
  wrap(async (_req, res) => {
    const d = await deps();
    try {
      const r = await ensureSheetPost(d);
      console.log('daily sheet', r.created ? 'created' : 'exists', r.id);
      // Strähnen, die getrocknet sind, nehmen die Flair wieder ab (nur bei Spielern mit dem Schalter)
      const off = await streakFlairSweep(d).catch((e: unknown) => (console.error('streak flair sweep', e), 0));
      if (off) console.log('streak flairs dried', off);
    } catch (e) {
      // Gerade baut jemand den Tag auf: in einer Minute noch einmal, sonst gäbe es heute keinen Tagespost (QA 02.11.2026)
      if (!(e instanceof GameError && e.code === 'busy')) throw e;
      console.log('daily sheet busy, again in a minute');
      await d.schedule?.('daily-sheet', new Date(d.now + 60_000), {});
    }
    res.json({});
  }),
);
app.post(
  '/internal/menu/post-sheet',
  wrap(async (_req, res) => {
    const r = await ensureSheetPost(await deps(), undefined, true);
    res.json({ showToast: { text: 'Today’s sheet is up.', appearance: 'success' }, navigateTo: r.url } satisfies UiResponse);
  }),
);

/* ---------- Fehler ---------- */

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  void _next;
  // Kaputtes oder zu großes JSON: eine abgelehnte Anfrage, kein Serverfehler
  const type = (err as { type?: string } | null)?.type;
  if (type === 'entity.parse.failed' || type === 'entity.too.large') {
    const body: ErrorResponse = { error: 'That request did not make sense.', code: 'bad_request' };
    res.status(400).json(body);
    return;
  }
  if (err instanceof GameError) {
    // Abgelehnte Anfragen ins Log (devvit logs), damit man sieht, was am Handy schiefgeht
    console.log(`${req.method} ${req.path} → ${err.code}: ${err.message}`);
    const body: ErrorResponse = { error: err.message, code: err.code };
    res.status(err.status).json(body);
    return;
  }
  console.error(err);
  const body: ErrorResponse = { error: 'Something went wrong. The paint is fine.', code: 'server' };
  res.status(500).json(body);
});

const server = createServer(app);
server.on('error', (err) => console.error(`server error: ${err.stack ?? err}`));
server.listen(getServerPort());
