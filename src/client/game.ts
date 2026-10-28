/* Ausgeklappter Spielmodus: Tagesklecks fangen, eigener Bogen, Malblatt mit Lasieren */
import './lib/fonts';
import './styles/base.css';
import './game.css';
import { context, navigateToPost, showLoginPrompt, showToast } from '@devvit/web/client';
import type { InitResponse, MonsterRecord, SpeciesInfo } from '../shared/api';
import { BP, css, LORE, PAPER, PIG, PIGMENTS, type PigmentId } from '../shared/data';
import { msUntilDayEnds, prettyDay } from '../shared/day';
import { MAX_GLAZES, odds, REL, sepiaStart } from '../shared/glaze';
import { makeMonster, speciesKey, statRows, statSum, type Monster } from '../shared/monster';
import { api, ApiError, serverNow, syncClock } from './lib/api';
import { $, clear, h } from './lib/dom';
import { paint } from './lib/paint';
import { fmtDuration, humidityChip, pigChips, pips, sepiaBox, speciesTitle, statBars, subLine, traitChips } from './lib/view';

/* ---------- Zustand ---------- */
let init: InitResponse | null = null;
let dryMs = 8 * 3600000;
let collection: MonsterRecord[] | null = null;
const species: Record<string, SpeciesInfo> = {};
let current: MonsterRecord | null = null;
let selPig: PigmentId = 'ultra';
let lastFocus: HTMLElement | null = null;
let newLog = 0;
let ticker = 0;

const loggedIn = (): boolean => !!(init?.user ?? context?.userId);
const speciesOf = (m: Monster): SpeciesInfo | null => species[speciesKey(m)] ?? null;
const shortDay = (day: string): string => prettyDay(day).replace(/^(\w{3})\w*/, '$1');
const dryUntil = (m: MonsterRecord): number => (m.lastGlazeAt === null ? 0 : m.lastGlazeAt + dryMs);

function rememberSpecies(s: SpeciesInfo | null | undefined): void {
  if (s) species[s.key] = s;
}

function toast(text: string): void {
  try {
    showToast(text);
  } catch {
    console.log(text);
  }
}

function fail(e: unknown): void {
  if (e instanceof ApiError && e.code === 'login') {
    try {
      showLoginPrompt();
    } catch {
      toast(e.message);
    }
    return;
  }
  toast(e instanceof Error ? e.message : 'Something went wrong.');
}

/** Ein Monster in allen Ansichten aktualisieren */
function storeMonster(m: MonsterRecord): void {
  if (collection) {
    const i = collection.findIndex((x) => x.id === m.id);
    if (i >= 0) collection[i] = m;
    else collection.unshift(m);
  }
  if (init?.day && m.day === init.day.day) init.caught = m;
}

/* ---------- Reiter ---------- */
function selectTab(which: 'today' | 'sheet'): void {
  $('tab-today').setAttribute('aria-selected', String(which === 'today'));
  $('tab-sheet').setAttribute('aria-selected', String(which === 'sheet'));
  $('view-today').hidden = which !== 'today';
  $('view-sheet').hidden = which !== 'sheet';
  if (which === 'sheet') void showSheet();
}
$('tab-today').addEventListener('click', () => selectTab('today'));
$('tab-sheet').addEventListener('click', () => selectTab('sheet'));

function setCount(n: number): void {
  $('sheet-count').textContent = n ? String(n) : '';
}

/* ---------- Heute ---------- */
function renderToday(fresh = false): void {
  const view = $('view-today');
  const r = init;
  if (!r) return;
  if (!r.day) {
    clear(
      view,
      h(
        'div',
        { class: 'empty' },
        h('p', { text: 'There is no blot on this post.' }),
        r.todayPostId ? h('button', { class: 'btn primary', text: 'Go to today’s blot', on: { click: () => navigateToPost(r.todayPostId as `t3_${string}`) } }) : null,
      ),
    );
    return;
  }
  const day = r.day;
  const m: Monster = r.caught ?? makeMonster(day.day, 0, day.humidity);
  rememberSpecies(day.species);
  const canvas = h('canvas', { class: 'blot', attrs: { 'aria-label': 'Watercolor of today’s blot' } });
  const pa = PAPER[m.paper];

  const naming = day.species
    ? h('p', { class: 'p-naming' }, 'Species named ', h('b', { text: day.species.name }), ` by u/${day.species.namedBy}.`)
    : h('p', { class: 'p-naming' }, h('b', { text: 'What do you see? ' }), 'Comment a name on this post. The top-voted name at midnight UTC goes into the Bestiary.');

  clear(
    view,
    h(
      'div',
      { class: 'today' },
      h('div', { class: 'col t-art' }, canvas, traitChips(m), m.events.print ? h('p', { class: 'lore', text: 'Fragment: ' + loreOf(m) }) : null),
      h(
        'div',
        { class: 'col' },
        h('div', { class: 'p-head' }, h('h2', { text: speciesTitle(m, day.species) }), subLine(m, `Stat cap ${pa.cap}`, `${day.catches} caught`), h('div', { class: 'p-pigs' }, pigChips(m)), naming),
        catchBox(fresh),
        sepiaBox(r.caught?.sepia ?? sepiaStart(m)),
      ),
    ),
  );
  paint(canvas, m, true);
}

function loreOf(m: Monster): string {
  return LORE[m.lore] ?? '';
}

function catchBox(fresh: boolean): HTMLElement {
  const r = init!,
    day = r.day!;
  if (r.caught) {
    const m = r.caught;
    const dice = h('div', { class: 'dice' + (fresh ? ' fresh' : '') }, ...statRows(m).map((s) => h('span', { class: 'die' }, h('small', { text: s.short }), `d${s.roll}`)));
    return h(
      'div',
      { class: 'box' },
      h('p', null, fresh ? h('b', { text: 'Caught! ' }) : null, 'Same shape for everyone, but these dice are yours:'),
      dice,
      statBars(m, true),
      h('button', { class: 'btn primary', text: m.glazes.length ? 'Keep painting' : 'Open painting sheet', on: { click: (e) => openSheet(m, e.currentTarget as HTMLElement) } }),
    );
  }
  if (!day.catchable) {
    return h(
      'div',
      { class: 'box' },
      h('p', { text: 'This blot has dried. Nobody can catch it anymore.' }),
      r.todayPostId && r.todayPostId !== day.postId ? h('button', { class: 'btn primary', text: 'Go to today’s blot', on: { click: () => navigateToPost(r.todayPostId as `t3_${string}`) } }) : null,
    );
  }
  if (!loggedIn()) {
    return h('div', { class: 'box' }, h('p', { text: 'Log in to catch this blot before it dries.' }), h('button', { class: 'btn primary', text: 'Log in', on: { click: () => showLoginPrompt() } }));
  }
  const btn = h('button', { class: 'btn primary', text: 'Catch it' });
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Catching…';
    try {
      const res = await api.catchBlot();
      syncClock(res.serverNow);
      rememberSpecies(res.species);
      init!.caught = res.monster;
      if (res.fresh) {
        init!.collectionCount++;
        init!.day!.catches++;
      }
      storeMonster(res.monster);
      setCount(init!.collectionCount);
      renderToday(res.fresh);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'Catch it';
      fail(e);
      if (e instanceof ApiError && e.code === 'dried') void reload();
    }
  });
  return h(
    'div',
    { class: 'box' },
    h('p', null, h('b', { text: 'Still wet. ' }), `Dries in ${fmtDuration(msUntilDayEnds(serverNow()))}. Everyone catches the same shape, but every catch rolls its own dice.`),
    btn,
  );
}

/* ---------- Bogen ---------- */
async function showSheet(): Promise<void> {
  const view = $('view-sheet');
  if (!loggedIn()) {
    clear(view, h('div', { class: 'empty' }, h('p', { text: 'Log in to keep a sheet of your monsters.' }), h('button', { class: 'btn primary', text: 'Log in', on: { click: () => showLoginPrompt() } })));
    return;
  }
  if (!collection) {
    clear(view, h('p', { class: 'hint', text: 'Leafing through your sheet…' }));
    try {
      const res = await api.collection();
      syncClock(res.serverNow);
      dryMs = res.dryMs;
      Object.values(res.species).forEach(rememberSpecies);
      collection = res.monsters;
      setCount(collection.length);
    } catch (e) {
      clear(view, h('p', { class: 'hint', text: e instanceof Error ? e.message : 'Could not load your sheet.' }));
      return;
    }
  }
  renderSheet();
}

function renderSheet(): void {
  const view = $('view-sheet');
  if (!collection) return;
  if (!collection.length) {
    clear(view, h('div', { class: 'empty' }, h('p', { text: 'Your sheet is empty. Catch today’s blot first.' }), h('button', { class: 'btn primary', text: 'Go to today', on: { click: () => selectTab('today') } })));
    return;
  }
  const board = h('div', { class: 'board', attrs: { 'aria-label': 'Your monsters' } });
  for (const m of collection) board.append(card(m));
  clear(view, h('p', { class: 'hint' }, h('b', { text: 'Tap a monster' }), ' to open its painting sheet. Every glaze needs time to dry.'), board);
}

function card(m: MonsterRecord): HTMLButtonElement {
  const canvas = h('canvas', { class: 'blot', attrs: { 'aria-hidden': 'true' } });
  const wet = dryUntil(m) - serverNow();
  const state = m.glazes.length >= MAX_GLAZES ? 'full' : wet > 0 ? `wet ${fmtDuration(wet)}` : 'dry';
  const sp = speciesOf(m);
  const b = h(
    'button',
    { class: 'card', attrs: { type: 'button', 'data-id': m.id, 'aria-label': `${speciesTitle(m, sp)}, ${BP[m.bp].n}, ${PAPER[m.paper].n}. Open painting sheet` } },
    canvas,
    h('div', { class: 'card-head' }, h('span', { class: 'card-no', text: shortDay(m.day) }), h('span', { class: 'card-name' + (sp ? '' : ' unnamed'), text: sp ? sp.name : `Unnamed ${BP[m.bp].n}` })),
    subLine(m),
    pigChips(m),
    statBars(m, true, true),
    traitChips(m, 2, true),
    h('div', { class: 'card-foot' }, h('span', null, 'Sum ', h('b', { text: String(statSum(m)) })), h('span', null, h('b', { text: `${m.glazes.length}/${MAX_GLAZES}` }), ` ${state}`)),
  );
  b.addEventListener('click', () => openSheet(m, b));
  paint(canvas, m);
  return b;
}

function refreshCard(m: MonsterRecord): void {
  const old = document.querySelector<HTMLButtonElement>(`.card[data-id="${CSS.escape(m.id)}"]`);
  if (!old) return;
  const nb = card(m);
  old.replaceWith(nb);
  if (lastFocus === old) lastFocus = nb;
}

/* ---------- Malblatt ---------- */
const overlay = $('overlay');

function openSheet(m: MonsterRecord, from: HTMLElement | null): void {
  current = m;
  selPig = m.main;
  lastFocus = from;
  newLog = 0;
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
  fillDetail(true);
  $('btn-close').focus({ preventScroll: true });
  clearInterval(ticker);
  ticker = window.setInterval(() => current && fillAction(), 1000);
}

function closeSheet(): void {
  overlay.hidden = true;
  document.body.style.overflow = '';
  clearInterval(ticker);
  current = null;
  if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
}

$('btn-close').addEventListener('click', closeSheet);
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeSheet();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay.hidden) closeSheet();
});

function fillDetail(redraw: boolean): void {
  const m = current!;
  const pa = PAPER[m.paper],
    sp = speciesOf(m);
  $('p-name').textContent = speciesTitle(m, sp);
  clear($('p-sub'), subLine(m, `Stat cap ${pa.cap}`, `Humidity ${m.humidity}%`));
  clear($('p-pigs'), pigChips(m));
  clear($('p-naming'), ...(sp ? ['Named ', h('b', { text: sp.name }), ` by u/${sp.namedBy}.`] : ['Unnamed species. ', h('b', { text: 'What do you see?' }), ' Name ideas go in the comments of a daily post.']));

  const rows = statRows(m);
  const head = h('thead', null, h('tr', null, ...[
          ['Stat', 'Stat'],
          ['Base', 'Blueprint base'],
          ['Pigm.', 'Pigment bonus'],
          ['Paper', 'Paper bonus'],
          ['Roll', 'Your d20 roll'],
          ['Glaze', 'Glaze gains'],
          ['Total', 'Total'],
        ].map(([t, title]) => h('th', { text: t!, attrs: { title: title! } }))));
  const body = h('tbody');
  for (const s of rows) {
    body.append(
      h(
        'tr',
        null,
        h('td', null, s.n, h('small', { text: s.s })),
        h('td', { text: String(s.base) }),
        h('td', { class: s.pig < 0 ? 'neg' : '', text: (s.pig > 0 ? '+' : '') + s.pig }),
        h('td', { text: '+' + s.paper }),
        h('td', { text: `${s.roll}/20` }),
        h('td', { text: s.gl ? '+' + s.gl : '0' }),
        h('td', { class: 'sum' }, String(s.total), s.capped ? h('small', { class: 'capnote', text: `Cap ${s.cap}` }) : null, m.mud ? h('small', { text: 'Mud -15%' }) : null),
      ),
    );
  }
  body.append(h('tr', null, h('td', null, h('b', { text: 'Total' })), h('td', { attrs: { colspan: '5' } }), h('td', { class: 'sum', text: String(statSum(m)) })));
  clear($('p-table'), head, body);

  clear($('p-traits'), traitChips(m) ?? h('div', { class: 'traits' }, h('span', { class: 'trait', text: 'Nothing special. Not yet.' })));
  const lore = $('p-lore');
  lore.hidden = !m.events.print;
  lore.textContent = m.events.print ? 'Fragment: ' + loreOf(m) : '';

  clear(
    $('swatches'),
    ...PIGMENTS.map((p) =>
      h(
        'button',
        { class: 'sw', attrs: { type: 'button', 'data-p': p.id, 'aria-pressed': String(p.id === selPig), title: `${p.n}: ${p.note}` } },
        h('span', { class: 'dot', vars: { '--c': css(p.rgb) } }),
        h('span', { text: p.n }),
      ),
    ),
  );
  fillOdds();
  fillAction();
  clear($('p-sepia'), sepiaBox(m.sepia));
  const log = $('log');
  clear(log, ...(m.log.length ? m.log.map((e, i) => h('li', { class: [e.c, i < newLog ? 'new' : ''].filter(Boolean).join(' ') }, h('b', { text: e.h }), ' ' + e.t)) : [h('li', { class: 'none', text: 'No glaze yet. Pick a pigment and lay down the first layer.' })]));
  if (redraw) paint($<HTMLCanvasElement>('big-canvas'), m, true);
}

function fillOdds(): void {
  const m = current!,
    o = odds(m, selPig),
    p = PIG[selPig];
  const pct = (v: number) => Math.round(v * 100) + '%';
  const meter = (cls: string, label: string, v: number) =>
    h('div', { class: 'meter ' + cls }, h('span', { text: label }), h('span', { class: 'bar' }, h('i', { vars: { '--w': (v * 100).toFixed(0) + '%' } })), h('span', { class: 'val', text: pct(v) }));
  const humNote = m.humidity > 60 ? `Humidity ${m.humidity}% raises the mutation chance.` : `Humidity ${m.humidity}% lowers the mutation chance.`;
  const mudNote = m.mud ? 'Already muddy: it can’t get worse.' : o.pigCount > 3 ? `${o.pigCount} pigments on the sheet: each one above three raises the mud risk.` : '';
  clear(
    $('odds'),
    h('div', { class: 'odds-top' }, h('span', null, `${p.n} on ${PIG[m.main].n}: `, h('span', { class: 'rel ' + o.rel, text: REL[o.rel].label })), h('span', { text: `Gain +${o.min} to +${o.max}` })),
    meter('ok', 'Success', o.ok),
    meter('mut', 'Mutation', o.mut),
    meter('mud', 'Mud', o.mud),
    h('div', { class: 'rests' }, 'Leftovers ', ...[0, 1, 2].map((i) => h('i', { class: i < m.rests ? 'on' : '' })), h('span', { text: o.pity ? 'The next glaze is guaranteed.' : 'At three, the next glaze is guaranteed.' })),
    h('div', { class: 'rests note', text: `${humNote} ${mudNote}`.trim() }),
  );
}

function fillAction(): void {
  const m = current!;
  const btn = $<HTMLButtonElement>('btn-glaze');
  const full = m.glazes.length >= MAX_GLAZES;
  const wet = dryUntil(m) - serverNow();
  if (btn.dataset.busy === '1') return;
  btn.disabled = full || wet > 0;
  btn.textContent = full ? 'Sheet full' : wet > 0 ? `Drying · ${fmtDuration(wet)}` : 'Apply glaze';
  $('p-layers').textContent = `Glazes ${m.glazes.length}/${MAX_GLAZES}` + (m.glazes.length ? ': ' + m.glazes.map((g) => PIG[g.p].n).join(', ') : '');
}

$('swatches').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('.sw');
  if (!b || !current) return;
  selPig = b.dataset.p as PigmentId;
  $('swatches')
    .querySelectorAll<HTMLElement>('.sw')
    .forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.p === selPig)));
  fillOdds();
});

$('btn-glaze').addEventListener('click', async () => {
  if (!current) return;
  const btn = $<HTMLButtonElement>('btn-glaze');
  btn.dataset.busy = '1';
  btn.disabled = true;
  btn.textContent = 'Painting…';
  try {
    const res = await api.glaze(current.id, selPig);
    syncClock(res.serverNow);
    dryMs = res.dryMs;
    rememberSpecies(res.species);
    current = res.monster;
    newLog = res.messages.length;
    storeMonster(res.monster);
    delete btn.dataset.busy;
    fillDetail(true);
    refreshCard(res.monster);
    if (init?.caught?.id === res.monster.id) renderToday();
  } catch (e) {
    delete btn.dataset.busy;
    if (e instanceof ApiError && e.code === 'drying' && e.dryUntil && current) {
      current.lastGlazeAt = e.dryUntil - dryMs;
    }
    fillAction();
    fail(e);
  }
});

/* ---------- Start ---------- */
async function reload(): Promise<void> {
  try {
    init = await api.init();
  } catch (e) {
    clear($('view-today'), h('p', { class: 'hint', text: e instanceof Error ? e.message : 'Could not load the blot.' }));
    return;
  }
  syncClock(init.serverNow);
  dryMs = init.dryMs;
  setCount(init.collectionCount);
  if (init.day) {
    $('g-eyebrow').textContent = `Daily blot · ${prettyDay(init.day.day)}`;
    clear($('g-tools'), humidityChip(init.day.humidity), h('span', { class: 'chip' }, h('small', { text: 'Paper' }), h('span', { class: 'pips', text: pips(PAPER[makeMonster(init.day.day, 0, init.day.humidity).paper].pips) })));
  }
  renderToday();
}

void reload();
