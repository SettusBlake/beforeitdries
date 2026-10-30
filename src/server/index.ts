/* Devvit-Web-Server: /api/* für die Webviews, /internal/* für Menü, Trigger und Scheduler */
import express, { type NextFunction, type Request, type Response } from 'express';
import { context, createServer, getServerPort, reddit, redis, settings } from '@devvit/web/server';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import { DUEL_PROTOCOL, PROTO_HEADER, type ErrorResponse } from '../shared/api';
import { dryMsFromHours, GameError, type Deps, type RedditLike } from './core';
import { diceBag, diceDraw, diceGet, diceGlaze, dicePull, diceSeen, diceTestBlank, diceTestShiny, diceWash } from './dice';
import { reviewList, reviewOk, reviewOver, reviewUnlock } from './drawings';
import { duelAct, duelGet, duelStart } from './duel';
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
    const body = (req.body ?? {}) as { level?: unknown; tutorial?: unknown };
    res.json(await duelStart(await deps(), context.userId, body.level, body.tutorial === true));
  }),
);

app.post(
  '/api/duel/act',
  wrap(async (req, res) => {
    sameProtocol(req);
    res.json(await duelAct(await deps(), context.userId, (req.body as { action?: unknown } | undefined)?.action));
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
    res.json(await diceGet(await deps(), context.userId, await username()));
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
    res.json(await diceWash(await deps(), context.userId, body.id, body.confirm));
  }),
);
app.post(
  '/api/dice/test-shiny',
  wrap(async (req, res) => {
    res.json(await diceTestShiny(await deps(), context.userId, await username(), (req.body as { style?: unknown } | undefined)?.style ?? null));
  }),
);
app.post(
  '/api/dice/test-blank',
  wrap(async (_req, res) => {
    res.json(await diceTestBlank(await deps(), context.userId, await username()));
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

/* Der tägliche Post ist abgeschafft. Falls ein alter Auftrag noch einmal feuert, passiert nichts */
app.post('/internal/scheduler/daily-blot', (_req, res) => {
  res.json({});
});

/* ---------- Fehler ---------- */

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  void _next;
  if (err instanceof GameError) {
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
