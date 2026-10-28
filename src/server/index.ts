/* Devvit-Web-Server: /api/* für die Webviews, /internal/* für Menü, Trigger und Scheduler */
import express, { type NextFunction, type Request, type Response } from 'express';
import { context, createServer, getServerPort, reddit, redis, settings } from '@devvit/web/server';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import type { CollectionResponse, ErrorResponse, GlazeRequest, InitResponse } from '../shared/api';
import { dayKey, isDayKey, shiftDay } from '../shared/day';
import { adoptTopName, catchBlot, dayInfo, dryMsFromHours, ensureDailyPost, GameError, glazeMonster, loadCollection, loadMonster, resolveDay, type Deps, type RedditLike } from './core';
import { duelAct, duelGet, duelStart } from './duel';
import { K } from './keys';
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
  };
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

app.get(
  '/api/init',
  wrap(async (_req, res) => {
    const d = await deps();
    const { userId, username, postId, postData } = context;
    const ref = await resolveDay(d, postId, postData);
    const [day, todayPostId, collectionCount] = await Promise.all([
      ref ? dayInfo(d, ref) : Promise.resolve(null),
      d.redis.hGet(K.day(dayKey(d.now)), 'postId'),
      userId ? d.redis.zCard(K.userMonsters(userId)) : Promise.resolve(0),
    ]);
    const caught = ref && userId ? await loadMonster(d, `${ref.day}:${userId}`) : null;
    const body: InitResponse = {
      user: userId ? { id: userId, name: username ?? '' } : null,
      day,
      caught,
      todayPostId: todayPostId ?? null,
      collectionCount,
      serverNow: d.now,
      dryMs: d.dryMs,
    };
    res.json(body);
  }),
);

app.get(
  '/api/collection',
  wrap(async (_req, res) => {
    const d = await deps();
    if (!context.userId) throw new GameError('login', 'Log in to see your sheet.', 401);
    const { monsters, species } = await loadCollection(d, context.userId);
    const body: CollectionResponse = { monsters, species, serverNow: d.now, dryMs: d.dryMs };
    res.json(body);
  }),
);

app.post(
  '/api/catch',
  wrap(async (_req, res) => {
    const d = await deps();
    const ref = await resolveDay(d, context.postId, context.postData);
    res.json(await catchBlot(d, context.userId, context.username, ref));
  }),
);

app.post(
  '/api/glaze',
  wrap(async (req, res) => {
    const d = await deps();
    const body = (req.body ?? {}) as Partial<GlazeRequest>;
    res.json(await glazeMonster(d, context.userId, body.id, body.pigment));
  }),
);

/* ---------- Farbschlacht ---------- */

app.get(
  '/api/duel',
  wrap(async (_req, res) => {
    res.json(await duelGet(await deps(), context.userId));
  }),
);

app.post(
  '/api/duel/start',
  wrap(async (req, res) => {
    res.json(await duelStart(await deps(), context.userId, (req.body as { level?: unknown } | undefined)?.level));
  }),
);

app.post(
  '/api/duel/act',
  wrap(async (req, res) => {
    res.json(await duelAct(await deps(), context.userId, (req.body as { action?: unknown } | undefined)?.action));
  }),
);

/* ---------- Menü, Trigger, Scheduler ---------- */

app.post(
  '/internal/menu/post-blot',
  wrap(async (_req, res) => {
    const d = await deps();
    const r = await ensureDailyPost(d);
    const body: UiResponse = r.created
      ? { showToast: { text: 'Today’s blot is up.', appearance: 'success' }, ...(r.url ? { navigateTo: r.url } : {}) }
      : { showToast: 'Today’s blot is already posted.' };
    res.json(body);
  }),
);

app.post(
  '/internal/menu/adopt-name',
  wrap(async (req, res) => {
    const d = await deps();
    const target = (req.body as MenuItemRequest | undefined)?.targetId ?? '';
    const day = target ? await d.redis.get(K.post(target)) : undefined;
    if (!isDayKey(day)) {
      res.json({ showToast: 'This is not a daily blot post.' } satisfies UiResponse);
      return;
    }
    const r = await adoptTopName(d, day);
    const text =
      r.status === 'named'
        ? `Named: ${r.name} (by u/${r.namedBy})`
        : r.status === 'already_named'
          ? `Already named: ${r.name}`
          : r.status === 'no_suggestions'
            ? 'No valid name suggestions yet.'
            : 'No daily post found.';
    res.json({ showToast: text } satisfies UiResponse);
  }),
);

app.post(
  '/internal/triggers/on-app-install',
  wrap(async (_req, res) => {
    const d = await deps();
    await ensureDailyPost(d);
    res.json({});
  }),
);

app.post(
  '/internal/scheduler/daily-blot',
  wrap(async (_req, res) => {
    const d = await deps();
    const today = dayKey(d.now);
    try {
      const r = await adoptTopName(d, shiftDay(today, -1));
      console.log('Naming', shiftDay(today, -1), JSON.stringify(r));
    } catch (e) {
      console.error('Naming failed', e);
    }
    await ensureDailyPost(d, today);
    res.json({});
  }),
);

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
