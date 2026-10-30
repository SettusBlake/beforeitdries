/*
 * Lokale Vorschau ohne Reddit: liefert dist/client aus und beantwortet /api/* mit der echten
 * Server-Logik, Redis im Speicher und einem festen Testnutzer.
 * Start: npm run preview  (vorher npm run build)
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { adoptTopName, catchBlot, dayInfo, ensureDailyPost, GameError, glazeMonster, loadCollection, loadMonster, resolveDay, type Deps } from '../src/server/core';
import { diceBag, diceDraw, diceGet, diceGlaze, diceTestBlank, diceTestShiny, diceWash, dicePull, loadDice, saveDice } from '../src/server/dice';
import { duelAct, duelGet, duelStart } from '../src/server/duel';
import { DUEL_PROTOCOL, PROTO_HEADER } from '../src/shared/api';
import { K } from '../src/server/keys';
import { ensurePlayPost, playInfo } from '../src/server/play';
import { dayKey } from '../src/shared/day';
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
      if (url.pathname === '/api/duel/start') return send(200, await duelStart(d, asUser, b.level, b.tutorial === true));
      if (url.pathname === '/api/duel/act') return send(200, await duelAct(d, asUser, b.action));
    }
    if (url.pathname === '/api/play') return send(200, await playInfo(d, asUser));
    if (url.pathname.startsWith('/api/dice')) {
      let raw = '';
      for await (const c of req) raw += c;
      const b = JSON.parse(raw || '{}');
      if (url.pathname === '/api/dice') return send(200, await diceGet(d, asUser, USER.name));
      if (url.pathname === '/api/dice/test-blank') return send(200, await diceTestBlank(d, asUser, USER.name));
      if (url.pathname === '/api/dice/test-shiny') return send(200, await diceTestShiny(d, asUser, USER.name, b.style ?? null));
      if (url.pathname === '/api/dice/pull') return send(200, await dicePull(d, asUser, b.kind));
      if (url.pathname === '/api/dice/bag') return send(200, await diceBag(d, asUser, b.ids));
      if (url.pathname === '/api/dice/glaze') return send(200, await diceGlaze(d, asUser, b.id, b.face));
      if (url.pathname === '/api/dice/wash') return send(200, await diceWash(d, asUser, b.id, b.confirm));
      if (url.pathname === '/api/dice/draw') return send(200, await diceDraw(d, asUser, b.drawing));
    }
    // Nur in der Vorschau: Pigment und Lasur zum Ausprobieren
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
