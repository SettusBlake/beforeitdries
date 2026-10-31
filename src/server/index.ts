/* Devvit-Web-Server: /api/* für die Webviews, /internal/* für Menü, Trigger und Scheduler */
import express, { type NextFunction, type Request, type Response } from 'express';
import { context, createServer, getServerPort, reddit, redis, scheduler, settings } from '@devvit/web/server';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import { DUEL_PROTOCOL, PROTO_HEADER, type ErrorResponse } from '../shared/api';
import { dryMsFromHours, GameError, type Deps, type RedditLike } from './core';
import { diceBag, diceColor, diceDraw, diceGet, diceGlaze, dicePull, diceSeen, diceTestBlank, diceTestPigment, diceTestShiny, diceWash } from './dice';
import { reportDrawing, reviewList, reviewOk, reviewOver, reviewUnlock } from './drawings';
import { duelAct, duelGet, duelStart } from './duel';
import { galleryCollect, galleryFind, galleryHang, galleryStatus, galleryTestDecks, galleryTestSelf } from './gallery';
import { marketBuy, marketList, marketSell, marketTestBuy, marketTestList, marketUnlist, tradeAccept, tradeCancel, tradeCollection, tradeDecline, tradeList, tradeMsg, tradeOffer, tradeStatus, tradeTestOffer } from './market';
import { adoptNaming, diceShare, namingGet, speciesNames, type NamingResult } from './naming';
import { ensurePlayPost, playInfo } from './play';
import { secureUint32 } from './rand';

async function deps(): Promise<Deps> {
  let dryHours: unknown;
  try {
    dryHours = await settings.get<number>('dryHours');
  } catch {
    dryHours = undefined;
  }
  return {
    redis,
    reddit: reddit as unknown as RedditLike,
    now: Date.now(),
    rand: secureUint32,
    subredditName: context.subredditName,
    appSlug: context.appSlug ?? context.appName ?? '',
    dryMs: dryMsFromHours(dryHours),
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

/*
 * Tagesklecks, Fangen und das alte Malblatt sind seit dem 30.10.2026 aus dem Spiel: jedes Monster ist einzigartig
 * und kommt nur aus einem eigenen Zug. Der Code dafür liegt noch in core.ts, ohne Wege dorthin.
 */

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
    res.json(await dicePull(await deps(), context.userId, (req.body as { kind?: unknown } | undefined)?.kind));
  }),
);

app.post(
  '/api/dice/bag',
  wrap(async (req, res) => {
    res.json(await diceBag(await deps(), context.userId, (req.body as { ids?: unknown } | undefined)?.ids));
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
    const r = await ensurePlayPost(await deps(), true);
    const body: UiResponse = { showToast: { text: 'The play post is up and pinned.', appearance: 'success' }, ...(r.url ? { navigateTo: r.url } : {}) };
    res.json(body);
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

/* Der tägliche Post ist abgeschafft. Falls ein alter Auftrag noch einmal feuert, passiert nichts */
app.post('/internal/scheduler/daily-blot', (_req, res) => {
  res.json({});
});

/* ---------- Fehler ---------- */

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  void _next;
  if (err instanceof GameError) {
    // Abgelehnte Anfragen ins Log (devvit logs), damit man sieht, was am Handy schiefgeht
    console.log(`${req.method} ${req.path} → ${err.code}: ${err.message}`);
    const body: ErrorResponse = { error: err.message, code: err.code, ...(err.dryUntil ? { dryUntil: err.dryUntil } : {}) };
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
