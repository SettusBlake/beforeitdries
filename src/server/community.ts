/*
 * Auftritt des Subreddits (docs/entwuerfe/publish-plan.md, freigegeben am 02.11.2026): Regeln, Gründe fürs Entfernen,
 * Post-Flairs, Seitenleiste und Wiki legt die App per Mod-Menü „set up the community“ an. Ein zweiter Lauf legt nichts
 * doppelt an, geänderte Texte werden ersetzt. Banner, Icon, Farben und Beschreibung gehen nur in den Mod-Einstellungen.
 * Dazu: Flairs auf den eigenen Posts der App und das Entfernen der Testdaten vor dem Start (nur Playtest, nur Mods).
 */
import type { CleanTestResponse } from '../shared/api';
import { dayKey } from '../shared/day';
import { queuePurge, purgeRun } from './accounts';
import { GameError, type Deps } from './core';
import { loadDice, saveDice, isTester } from './dice';
import { flairPost, type FlairKey } from './flair';
import { K } from './keys';
import { adoptNaming } from './naming';

/* ---------- Texte ---------- */

export const RULES: { shortName: string; description: string; violationReason: string }[] = [
  { shortName: 'Be kind', description: 'No harassment, hate or slurs, in comments, names or drawings.', violationReason: 'Not kind' },
  {
    shortName: 'Keep drawings clean',
    description: 'No obscene drawings, hate symbols or real people. Drawings are reviewed before others see them, and repeated paint-overs lock drawing.',
    violationReason: 'Drawing not okay',
  },
  { shortName: 'Good names only', description: 'Species names are short, family-friendly, and not the names of real people, brands or ads.', violationReason: 'Name not okay' },
  {
    shortName: 'No real money',
    description: 'Dice and pigment are traded for pigment only. Offers of money, gift cards, accounts or Reddit Gold are removed and lead to a ban.',
    violationReason: 'Real money offer',
  },
  { shortName: 'No spam', description: 'Ideas, feedback and bug reports are welcome with the right flair.', violationReason: 'Spam' },
];

export const REASONS: { title: string; message: string }[] = [
  { title: 'Not kind', message: 'Removed under the rule “Be kind”: no harassment, hate or slurs on r/beforeitdries.' },
  { title: 'Drawing not okay', message: 'Removed under the rule “Keep drawings clean”: no obscene drawings, hate symbols or real people.' },
  { title: 'Name not okay', message: 'Removed under the rule “Good names only”: species names are short, family-friendly, and not real people, brands or ads.' },
  { title: 'Real money offer', message: 'Removed under the rule “No real money”: dice and pigment are traded for pigment only.' },
];

/** Post-Flairs. Die ersten drei setzt nur die App (modOnly), die anderen wählen Spieler. Gerades Apostroph, damit man es tippen kann */
export const FLAIRS: { key: FlairKey; text: string; backgroundColor: string; textColor: 'light' | 'dark'; modOnly: boolean }[] = [
  { key: 'play', text: 'Play', backgroundColor: '#6B4A2F', textColor: 'light', modOnly: true },
  { key: 'sheet', text: "Today's sheet", backgroundColor: '#2B3FA3', textColor: 'light', modOnly: true },
  { key: 'name', text: 'What do you see?', backgroundColor: '#B01E3E', textColor: 'light', modOnly: true },
  { key: 'discussion', text: 'Discussion', backgroundColor: '#E8E2D4', textColor: 'dark', modOnly: false },
  { key: 'feedback', text: 'Feedback', backgroundColor: '#0C6C5C', textColor: 'light', modOnly: false },
  { key: 'bug', text: 'Bug', backgroundColor: '#A65428', textColor: 'light', modOnly: false },
];

export const SIDEBAR_TITLE = 'How to play';
export const SIDEBAR_TEXT = [
  '1. Open the pinned post and tap **Play**.',
  '2. **Learn with Sepia**: three guided rounds.',
  '3. Collect nine free dice. Every blot is one of a kind.',
  '4. Duel the rival, or other players’ decks in the **Gallery**.',
  '5. Once a day, hold **Today’s sheet** against the Bleach and share your sheet.',
  '',
  'A blot without a name? Tap **What do you see?** and let the community name its species.',
].join('\n');
export const LINKS_TITLE = 'Links';
export const WIKI_PAGE = 'how-to-play';

export const WIKI_TEXT = `# How to play Before It Dries

Before It Dries is a watercolour dice game. Every monster is a one-of-a-kind blot, and every blot is also a die.

## Start

1. Open the pinned **Play** post and tap **Play**.
2. **Learn with Sepia**: a guided lesson of three rounds. Only the next step can be tapped.
3. **Collect your free dice**: nine new blots for your deck.

## Duels

* A sheet of 6 × 8 fields, six rounds. Roll three dice from your deck of nine, hold what you like and reroll the rest. Later rerolls are wet and may turn a die to mud.
* Symbols go into your pool: **Step** moves, **Splash** hits a palette, **Guard** halves a hit, **Glow** fills your blots until they can do a master stroke. Stars unfold a blot from your deck onto the sheet.
* Drag a blot onto paper to stamp its shape, onto a rival to splash it.
* Matching colours pay: two faces of one colour are a **Glaze** (×1.5), three are **Pure** (×2 and a Joker).
* Every blot has an element: Wash, Vermilion, Gilt, Sap, Ochre, Fluoro. Each hits the next one twice as hard and the one after a little harder.
* Win by covering more paper when it dries, or by breaking all three hearts of the rival’s palette.
* From your second duel on, both sides pick **mediums** that bend the rules a little.
* **Gallery duel**: play against the deck another player left in the gallery. They earn a little pigment from it.

## Today’s sheet

Pale, bleached blots slide down from the top edge in five waves. Paint slows them, blots in their way take hits, and every Pale that slips off the bottom bleaches a heart. Everyone gets the same sheet, the same dice and the same rolls. One ranked run per day. **Share as a comment** posts your sheet as a reply under today’s post, in your name, and only after a second tap.

## Your dice

* **Dip the brush**: one free dip a day, more for pigment. A visible d100 decides the paper and with it the rarity. Rare style and holo dice exist.
* **Deck**: the nine dice you duel with.
* **Blank canvas**: draw your own monster once a week. Moderators look at every drawing before other players can see it.
* **Wash out**: give a blot up for glaze on its species. It drifts into an archive and may come back as a pale opponent.
* **Drops**: won in duels, used to repaint a face of a die.
* **Market and Trades**: dice for pigment, or dice for dice. Trading needs a Reddit account older than 7 days and 5 finished duels. Starter dice stay with you.

## Naming species

A species without a name shows **What do you see?** on its card. That creates a post in your name. After 24 hours the top comment with a valid name names the species for everyone, and finder and namer get 50 pigment each.

## Questions

* **Can I buy pigment?** No. Nothing in the game is sold for money or Reddit Gold. Pigment comes from playing only.
* **Are the rolls fair?** Every roll happens on the server. Pictures are never stored: each blot is painted on your device from its seed.
* **What happens to my data if I delete my Reddit account?** The game removes it. Mentions elsewhere, like the history of a die, become “a painter”.
* **Something broke.** Post with the **Bug** flair, or send modmail.
`;

/* ---------- Einrichtung ---------- */

export type SetupResult = { rules: number; reasons: number; flairs: number; widgets: number; wiki: boolean; posts: number; errors: string[] };

const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e)).slice(0, 120);
const postUrl = (sub: string, id: string) => `https://www.reddit.com/r/${sub}/comments/${id.replace(/^t3_/, '')}/`;

/** Alles anlegen oder auf den neuen Stand bringen. Jeder Teil für sich: scheitert einer, laufen die anderen weiter */
export async function setupCommunity(d: Deps): Promise<SetupResult> {
  const r = d.reddit;
  const sub = d.subredditName;
  const out: SetupResult = { rules: 0, reasons: 0, flairs: 0, widgets: 0, wiki: false, posts: 0, errors: [] };
  const part = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      console.error('setup', name, e);
      out.errors.push(`${name}: ${errText(e)}`);
    }
  };

  await part('rules', async () => {
    const have = (await r.getRules?.(sub)) ?? [];
    for (const rule of RULES) {
      const old = have.find((x) => x.shortName.toLowerCase() === rule.shortName.toLowerCase());
      if (old) await old.update({ shortName: rule.shortName, description: rule.description, kind: 'all', violationReason: rule.violationReason });
      else await r.createRule?.(sub, { shortName: rule.shortName, description: rule.description, kind: 'all', violationReason: rule.violationReason });
      out.rules++;
    }
  });

  await part('removal reasons', async () => {
    const have = (await r.getSubredditRemovalReasons?.(sub)) ?? [];
    for (const x of REASONS) {
      const old = have.find((h) => h.title.toLowerCase() === x.title.toLowerCase());
      if (old) await r.updateSubredditRemovalReason?.(sub, old.id, x);
      else await r.addSubredditRemovalReason?.(sub, x);
      out.reasons++;
    }
  });

  await part('flairs', async () => {
    const have = (await r.getPostFlairTemplates?.(sub)) ?? [];
    const ids: Record<string, string> = {};
    for (const f of FLAIRS) {
      const old = have.find((h) => h.text.toLowerCase() === f.text.toLowerCase());
      const opts = { subredditName: sub, text: f.text, backgroundColor: f.backgroundColor, textColor: f.textColor, modOnly: f.modOnly };
      const t = old ? await r.editFlairTemplate?.({ ...opts, id: old.id }) : await r.createPostFlairTemplate?.(opts);
      const id = t?.id ?? old?.id;
      if (id) ids[f.key] = id;
      out.flairs++;
    }
    if (Object.keys(ids).length) await d.redis.hSet(K.communityFlair, ids);
  });

  await part('sidebar', async () => {
    const have = (await r.getWidgets?.(sub)) ?? [];
    const find = (name: string) => have.find((w) => w.name === name);
    const text = { type: 'textarea' as const, subreddit: sub, shortName: SIDEBAR_TITLE, text: SIDEBAR_TEXT };
    const old = find(SIDEBAR_TITLE);
    if (old) await r.updateWidget?.({ ...text, id: old.id });
    else await r.addWidget?.(text);
    out.widgets++;
    const btn = await linksWidget(d);
    const oldB = find(LINKS_TITLE);
    if (oldB) await r.updateWidget?.({ ...btn, id: oldB.id });
    else await r.addWidget?.(btn);
    out.widgets++;
  });

  await part('wiki', async () => {
    let exists = false;
    try {
      exists = !!(await r.getWikiPage?.(sub, WIKI_PAGE));
    } catch {
      exists = false;
    }
    const opts = { subredditName: sub, page: WIKI_PAGE, content: WIKI_TEXT, reason: 'Before It Dries: how to play' };
    if (exists) await r.updateWikiPage?.(opts);
    else await r.createWikiPage?.(opts);
    out.wiki = true;
  });

  // Flairs auf die Posts, die schon da sind: Spiel-Post, heutiger Tagespost, laufende Benennen-Posts
  await part('post flairs', async () => {
    const play = await d.redis.get(K.playPost);
    if (play && (await flairPost(d, play, 'play'))) out.posts++;
    const sheet = await d.redis.get(K.bleachPost(dayKey(d.now)));
    if (sheet) {
      const id = (JSON.parse(sheet) as { id: string }).id;
      if (await flairPost(d, id, 'sheet')) out.posts++;
    }
    for (const id of Object.values(await d.redis.hGetAll(K.namingOpen)))
      if (id.startsWith('t3_') && (await flairPost(d, id, 'name'))) out.posts++;
  });
  return out;
}

/** Knöpfe der Seitenleiste: zum Spiel-Post und zum Wiki */
async function linksWidget(d: Pick<Deps, 'redis' | 'subredditName'>) {
  const sub = d.subredditName;
  const play = await d.redis.get(K.playPost);
  const buttons = [
    ...(play ? [{ kind: 'text', text: 'Play', url: postUrl(sub, play), color: '#6B4A2F' }] : []),
    { kind: 'text', text: 'Full guide', url: `https://www.reddit.com/r/${sub}/wiki/${WIKI_PAGE}`, color: '#6B4A2F' },
  ];
  return { type: 'button' as const, subreddit: sub, shortName: LINKS_TITLE, description: 'Start here.', buttons };
}
/** Neuer Spiel-Post: Knopf „Play“ in der Seitenleiste nachziehen (nur wenn die Einrichtung schon lief) */
export async function refreshLinks(d: Deps): Promise<void> {
  try {
    const old = ((await d.reddit.getWidgets?.(d.subredditName)) ?? []).find((w) => w.name === LINKS_TITLE);
    if (old) await d.reddit.updateWidget?.({ ...(await linksWidget(d)), id: old.id });
  } catch (e) {
    console.error('refresh links', e);
  }
}

export function setupToast(r: SetupResult): string {
  const done = `Rules ${r.rules}, removal reasons ${r.reasons}, flairs ${r.flairs}, sidebar ${r.widgets}, wiki ${r.wiki ? 'ok' : 'missing'}.`;
  return r.errors.length ? `${done} Problems: ${r.errors.join(' · ')}` : `${done} All set.`;
}

/* ---------- Testdaten vor dem Start (Playtest, nur Mods) ---------- */

export type CleanResult = CleanTestResponse;

/** Alle erfundenen Maler: Test-Decks der Galerie und Test-Händler (Spieler-IDs test:deck{n}, test:trader{n}) */
async function testPainters(d: Pick<Deps, 'redis'>): Promise<string[]> {
  const n = Number((await d.redis.get(K.galleryTestN)) ?? 0),
    m = Number((await d.redis.get(K.tradeTestN)) ?? 0);
  return [...Array.from({ length: n }, (_, k) => `test:deck${k + 1}`), ...Array.from({ length: m }, (_, k) => `test:trader${k + 1}`)];
}

/**
 * Testdaten weg (Variante A im Plan): erfundene Maler samt Galerie, Markt, Angeboten und Lieferungen (über die Bereinigung
 * gelöschter Konten), dazu die Test-Schalter im eigenen Stand. Alte Posts der App außer dem Spiel-Post und dem heutigen
 * Tagespost werden entfernt (nicht gelöscht, die Lösch-Trigger legen deshalb nichts neu an), offene Benennen dabei abgesagt.
 * Echte Spielstände, Würfel und vergebene Namen bleiben.
 */
export async function cleanTestData(d: Deps, userId: string | undefined, username: string | undefined): Promise<CleanResult> {
  if (!userId) throw new GameError('login', 'Log in first.', 401);
  if (!(await isTester(d, username))) throw new GameError('forbidden', 'Only for moderators in a playtest.', 403);
  const out: CleanResult = { painters: 0, pending: 0, posts: 0, namings: 0, errors: [] };

  // Erfundene Maler: Name merken (Test-Decks haben ihn nur im Galerie-Abzug), dann wie ein gelöschtes Konto bereinigen
  for (const uid of await testPainters(d)) {
    const known = (await d.redis.hGet(K.nameOf, uid)) ?? '';
    const snap = await d.redis.get(K.gallery(uid));
    const name = known || (snap ? ((JSON.parse(snap) as { name?: string }).name ?? '') : '');
    if (!name && !snap && !(await d.redis.get(K.dice(uid)))) continue;
    if (name) await d.redis.hSet(K.nameOf, { [uid]: name });
    await queuePurge(d, uid);
    out.painters++;
  }
  const until = Date.now() + 12_000;
  while ((await d.redis.hLen(K.purgeQueue)) > 0 && Date.now() < until) await purgeRun(d);
  out.pending = await d.redis.hLen(K.purgeQueue);

  // Test-Schalter im eigenen Stand (würden sonst den ersten echten Zug erzwingen)
  const s = await loadDice(d, userId);
  for (const k of ['forceStyle', 'forceHolo', 'forceShiny', 'testSelf'] as const) Reflect.deleteProperty(s, k);
  await saveDice(d, userId, s);

  // Alte Posts: alle der App und alle bekannten Benennen- und Tagesposts, außer Spiel-Post und heutigem Tagespost
  try {
    const keep = new Set<string>();
    const play = await d.redis.get(K.playPost);
    if (play) keep.add(play);
    const today = await d.redis.get(K.bleachPost(dayKey(d.now)));
    if (today) keep.add((JSON.parse(today) as { id: string }).id);
    const known = new Set<string>([
      ...(await d.redis.zRange(K.namingPosts, 0, -1, { by: 'rank' })).map((x) => x.member),
      ...Object.keys(await d.redis.hGetAll(K.bleachPostDay)),
    ]);
    const app = (await d.reddit.getAppUser?.())?.username?.toLowerCase();
    const posts = (await d.reddit.getNewPosts?.({ subredditName: d.subredditName, limit: 1000, pageSize: 100 }).all()) ?? [];
    for (const p of posts) {
      if (keep.has(p.id) || p.removed) continue;
      if (!known.has(p.id) && (!app || p.authorName.toLowerCase() !== app)) continue;
      // Ein offenes Benennen absagen, sonst würde es nach 24 Stunden aus einem entfernten Post einen Namen vergeben
      const naming = await d.redis.get(K.naming(p.id));
      if (naming && (JSON.parse(naming) as { status?: string }).status === 'open') {
        await adoptNaming(d, p.id, true).catch((e: unknown) => out.errors.push(`naming ${p.id}: ${errText(e)}`));
        out.namings++;
      }
      try {
        await p.remove(false);
        out.posts++;
      } catch (e) {
        out.errors.push(`post ${p.id}: ${errText(e)}`);
      }
    }
  } catch (e) {
    out.errors.push(`posts: ${errText(e)}`);
  }
  return out;
}
