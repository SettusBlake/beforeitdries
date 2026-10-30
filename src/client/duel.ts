/*
 * Farbschlacht in der Reddit-App: Titel, Duell auf einem Bildschirm, Ergebnis.
 * Der Server prüft und würfelt jede Aktion und schickt Ereignisse zurück, der Client spielt sie ab.
 * Regelabfragen (Reichweite, Chancen, Netze) laufen lokal auf dem Stand vom Server.
 */
import './lib/fonts';
import './duel.css';
import { showLoginPrompt, showToast } from '@devvit/web/client';
import type { DuelResponse, DuelReward } from '../shared/api';
import { rarityDef } from '../shared/dice';
import { PIG, type PigmentId } from '../shared/data';
import { relation } from '../shared/glaze';
import { lastRolled, loadState, type DuelAction } from '../shared/duel/play';
import { mediumDef, type MediumId } from '../shared/duel/media';
import { bestRoll, tutorialAction, tutorialActive } from '../shared/duel/tutorial';
import * as R from '../shared/duel/rules';
import { ABILITY, COLS, CRESTS, GAIT, HEARTS, ROUNDS, ROWS, S, type Ev, type Face, type Level, type Plan, type Side, type Unit } from '../shared/duel/rules';
import { paintLater } from './lib/painter';
import { api, ApiError } from './lib/api';
import { loadSpecies, speciesName } from './lib/species';
import { makeCube, tumble } from './duel/dice3d';
import { iconSvg, netSvg } from './duel/icons';
import { initAudio, isMuted, setMuted, sfx } from './duel/sound';
import { diceBadge, initDice, openDice } from './duel/collection';
import * as View from './duel/view';
import { V } from './duel/view';

const $ = (id: string) => document.getElementById(id)!;
function el(tag: string, cls = '', text = ''): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}
function html(tag: string, cls: string, inner: string): HTMLElement {
  const e = el(tag, cls);
  e.innerHTML = inner;
  return e;
}
const store = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string): void {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* egal */
    }
  },
};

/* ---------- Zustand der Bedienung ---------- */
let screen: 'title' | 'game' | 'dice' = 'title';
let reward: DuelReward | null = null;
let busy = false;
let level: Level = (['apprentice', 'journeyman', 'master'] as Level[]).find((l) => l === store.get('bid-duel-level')) ?? 'apprentice';
let chosen = new Set<number>();
/** Nach dem Wurf: Würfel, die beim Neuwurf liegen bleiben */
let held = new Set<number>();
/** Deck über dem Brett aufgeklappt (zum Nachsehen außerhalb der Würfelwahl) */
let deckOpen = false;
/** Die 3D-Würfel auf der Bühne, vom Wurf bis der Wurf gilt */
const stageDice = new Map<number, { cube: HTMLElement; box: HTMLElement; fi: number }>();
/** Sepias Aufträge, die in diesem Duell schon erfüllt sind (Runde:Seite) */
const tasksDone = new Set<string>();
let summonU: Unit | null = null,
  orient = 0,
  anchor: number | null = null;
/** Ziehen vom Klecks: wohin der Finger zeigt, was dort passieren würde, und die Vorschau dazu */
type Preview = { path: number[]; cells: { i: number; col: string; pct: number | null }[]; target: number | null; pct: number | null; text: string };
let drag: { u: Unit; start: number; over: number; moved: boolean; plan: Plan | null; pv: Preview | null } | null = null;
/** Angetippter Klecks: der nächste Tipp ist sein Ziel (wie ein Wisch), ein Tipp auf ihn selbst ist Soak */
let armed: Unit | null = null;
/** Fähigkeit zielt: der Klecks, dessen Goldknopf getippt wurde */
let aiming: Unit | null = null;
/** Was ein angefasster Klecks erreicht (einmal berechnet, nicht in jedem Bild) */
let reachHl: { id: number; spots: number[]; hits: number[] } | null = null;
let resumable = false;
const seenTips = new Set((store.get('bid-duel-tips') ?? '').split(',').filter(Boolean));
/** Sepias goldener Ring: am Anfang an, nach dem ersten fertigen Duell aus, außer man schaltet ihn selbst ein (festgelegt am 29.10.2026) */
/** Sepias Ring im normalen Duell: aus, außer man schaltet ihn im Menü selbst ein (geführt wird nur im Lern-Duell) */
let hints = store.get('bid-duel-hints') === '1';
setMuted(store.get('bid-duel-muted') === '1');

const board = $('board') as HTMLCanvasElement;
const me = () => S.teams[0];
const phase = () => (S.teams.length ? S.phase : 'opening');
const myTurn = () => !busy && !S.over && S.turn === 1;
const placing = () => (phase() === 'opening' || phase() === 'summon') && summonU !== null;
/** Im Lern-Duell ist nur der markierte Schritt antippbar */
const tut = () => tutorialActive() && myTurn();
const allowedEl = (e: Element): boolean => {
  if (!tut() || (!!guideNow.el && e.matches(guideNow.el))) return true;
  nudge();
  return false;
};
/** Im Lern-Duell etwas anderes angetippt: der Hinweis und die goldene Markierung zeigen noch einmal, was dran ist */
function nudge(): void {
  if (!tut()) return;
  const h = $('hint');
  h.classList.remove('nudge');
  void h.offsetWidth;
  h.classList.add('nudge');
  const g = guideNow.el ? document.querySelector<HTMLElement>(guideNow.el) : null;
  if (g) {
    g.classList.remove('guide', 'nudge');
    void g.offsetWidth;
    g.classList.add('guide', 'nudge');
  }
}
const rgb = (p: PigmentId) => `rgb(${PIG[p].rgb})`;
/** Kleckse tragen den Namen ihrer Art, sobald die Community ihn vergeben hat (nur Anzeige, die Regeln kennen nur IDs) */
function renameUnits(): void {
  for (const t of S.teams) for (const u of t.units) u.name = speciesName(u.m) ?? u.name;
}

/* ---------- Server ---------- */
async function playEvents(evs: Ev[]): Promise<void> {
  for (const e of evs) {
    // Jeder Zug beginnt im normalen Tempo (Tippen aufs Blatt beschleunigt den Rivalen)
    if (e.k === 'turn') V.speed = 1;
    await View.playEvent(e);
  }
}
/** Eine Anfrage an den Server, danach die Ereignisse abspielen */
async function request(p: Promise<DuelResponse>, onState?: () => void): Promise<boolean> {
  busy = true;
  deckOpen = false;
  renderAll();
  let res: DuelResponse;
  try {
    res = await p;
  } catch (e) {
    busy = false;
    onError(e);
    return false;
  }
  if (res.state) {
    loadState(res.state);
    renameUnits();
  }
  View.prewarm();
  if (res.reward) reward = res.reward;
  armed = null;
  aiming = null;
  drag = null;
  reachHl = null;
  summonU = summonU ? R.unitById(summonU.id) : null;
  onState?.();
  renderAll();
  await playEvents(res.events);
  busy = false;
  V.speed = 1;
  if (phase() === 'roll' && !chosen.size) chosen = defaultPick();
  held = phase() === 'keep' ? defaultHold() : new Set();
  prepSummon();
  renderAll();
  if (S.over) void finishDuel();
  return true;
}
function onError(e: unknown): void {
  if (e instanceof ApiError && e.code === 'login') {
    showLogin();
    return;
  }
  // Oberfläche älter als der Server: nicht weiterspielen, sonst passen Anzeige und Regeln nicht zusammen
  if (e instanceof ApiError && e.code === 'outdated') {
    $('outdated').hidden = false;
    return;
  }
  const msg = e instanceof Error ? e.message : 'Something went wrong.';
  try {
    showToast(msg);
  } catch {
    /* außerhalb von Reddit */
  }
  showTicker(msg, 'rival');
  // Stand neu holen, damit Anzeige und Server wieder übereinstimmen
  void api
    .duel()
    .then((r) => {
      if (!r.state) return;
      loadState(r.state);
      renameUnits();
      R.sync();
      void playEvents(R.drain()).then(renderAll);
    })
    .catch(() => undefined);
  renderAll();
}
function showLogin(): void {
  $('login').hidden = false;
}

View.setup(board, {
  overlay: drawOverlay,
  acted: (id) => S.turn === 1 && phase() === 'act' && !!R.unitById(id)?.acted,
  selected: () => (phase() === 'act' ? (drag?.u.id ?? armed?.id ?? aiming?.id ?? null) : null),
  hud: () => {
    renderTop();
    renderPool();
    renderStatus();
  },
  banner: (text, kind) => {
    showBanner(text, kind);
    // Neuer Zug: der Auftrag oben gehört jetzt der Seite am Zug
    if (kind === 'turn') renderStatus();
  },
  // Ergebnisse stehen am Ziel, der Ticker meldet nur noch den Radierer (alles andere unter „What happened“)
  ticker: (t, c) => {
    if (c === 'eraser') showTicker(t, c);
  },
  roll: playRoll,
  reroll: playReroll,
  apply: playApply,
});

/* ---------- Würfeln mit 3D-Würfeln: offen hinlegen, halten, neu werfen, dann gilt der Wurf ---------- */
function stageDie(id: number, size: number): { cube: HTMLElement; box: HTMLElement; fi: number } {
  const u = R.unitById(id)!;
  const box = el('div', 'stage-die');
  box.dataset.id = String(id);
  const cube = makeCube(u.faces, size, rgb(u.m.main));
  box.append(cube, el('small', '', u.name.split(' ')[1] ?? u.name));
  box.addEventListener('click', () => toggleHold(id));
  const x = { cube, box, fi: -1 };
  stageDice.set(id, x);
  return x;
}
function openStage(label: string): HTMLElement {
  const stage = $('stage');
  stage.replaceChildren();
  stage.hidden = false;
  stage.classList.remove('pick');
  stageDice.clear();
  stage.append(el('p', 'stage-lbl', label));
  const row = el('div', 'stage-row');
  stage.append(row, el('p', 'stage-combo', ''), el('p', 'stage-task', ''));
  requestAnimationFrame(() => stage.classList.add('on'));
  return row;
}
const dieSize = () => Math.max(46, Math.round(View.cellSize() * 1.2));
/** Seite zeigen: Name der Seite unter dem Würfel, Sterne leuchten */
function landDie(id: number, fi: number): void {
  const d = stageDice.get(id);
  const f = R.unitById(id)?.faces[fi];
  if (!d || !f) return;
  d.fi = fi;
  d.box.classList.add('landed');
  d.box.querySelector('small')!.textContent = R.faceText(f);
  d.box.classList.toggle('star', f.k === 'star' || f.k === 'joker');
  // Doppel-, Dreifach- oder Mischseite: kurz aufleuchten und klingen
  const up = R.isCrestFace(f) && (f.n > 1 || !!f.k2);
  d.box.classList.toggle('upface', up);
  if (up) sfx.upface(f.n >= 3 ? 2 : 1);
}
/** Sepias Auftrag unter der Kombi: erfüllt der Wurf ihn schon? */
function taskPreview(side: Side): void {
  const line = document.querySelector('#stage .stage-task') as HTMLElement | null;
  const t = R.taskOf(side, V.round);
  if (!line || !t) return;
  const met = R.taskMet(t, lastRolled().map((r) => r.face));
  line.textContent = `${side === 2 ? 'Rival task' : 'Sepia’s task'}: ${t.text}${met ? ' ✓' : ''}`;
  line.classList.toggle('met', met);
}
/** Was der Wurf gerade ergeben würde */
function comboPreview(): void {
  const line = document.querySelector('#stage .stage-combo') as HTMLElement | null;
  if (!line) return;
  const c = R.comboOf(lastRolled().map((r) => r.face));
  line.textContent = c ? c.text : phase() === 'keep' && S.turn === 1 ? 'No combo yet' : '';
  line.classList.toggle('has', !!c);
}
async function playRoll(e: Extract<Ev, { k: 'roll' }>): Promise<void> {
  const row = openStage(e.side === 1 ? 'Your roll' : 'Rival roll');
  const size = dieSize();
  const dice = e.dice.map((d) => {
    const x = stageDie(d.id, size);
    row.append(x.box);
    return { ...x, d };
  });
  sfx.dice(dice.length);
  await Promise.all(dice.map((x, k) => tumble(x.cube, x.d.fi, (k * 110) / V.speed, 1050 / V.speed, (k - 1) * 70)));
  for (const x of dice) landDie(x.d.id, x.d.fi);
  taskPreview(e.side);
  await View.wait(e.side === 1 ? 200 : 420);
}
async function playReroll(e: Extract<Ev, { k: 'reroll' }>): Promise<void> {
  const list = e.dice.map((d) => ({ d, x: stageDice.get(d.id) })).filter((y) => y.x);
  for (const y of list) {
    y.x!.box.classList.remove('landed', 'star', 'held');
    y.x!.box.querySelector('small')!.textContent = '…';
  }
  $('stage').classList.remove('pick');
  sfx.dice(list.length);
  await Promise.all(list.map((y, k) => tumble(y.x!.cube, y.d.fi, (k * 110) / V.speed, 900 / V.speed, (k - 1) * 60)));
  for (const y of list) landDie(y.d.id, y.d.fi);
  taskPreview(e.side);
  await View.wait(e.side === 1 ? 250 : 380);
}
async function playApply(e: Extract<Ev, { k: 'apply' }>): Promise<void> {
  const stage = $('stage');
  stage.classList.remove('pick');
  for (const x of stageDice.values()) x.box.classList.remove('held');
  const line = stage.querySelector('.stage-combo') as HTMLElement | null;
  if (e.combo && line) {
    line.textContent = e.combo.text;
    line.classList.add('has', 'pop', `k-${e.combo.kind}`);
    for (const x of stageDice.values()) x.box.classList.add('combo');
    sfx.combo(e.combo.kind);
    await View.wait(e.combo.kind === 'pair' ? 650 : 900);
  }
  // Sepias Auftrag erfüllt: ein Joker
  const tl = stage.querySelector('.stage-task') as HTMLElement | null;
  if (e.task && tl) {
    tasksDone.add(`${V.round}:${e.side}`);
    tl.textContent = `${e.side === 2 ? 'Rival task done' : 'Task done'}: ${e.task.text}. A Joker!`;
    tl.classList.add('met', 'pop');
    sfx.combo('rainbow');
    renderStatus();
    await View.wait(800);
  }
  // Symbole fliegen in den Vorrat: von den Würfelseiten, dazu der Gewinn der Kombi
  const flights: [HTMLElement, Face][] = [];
  for (const [id, x] of stageDice) {
    const f = R.unitById(id)?.faces[x.fi];
    if (!f) continue;
    if (f.k === 'gold') for (const c of CRESTS) flights.push([x.cube, { k: c.k, n: 1 }]);
    else if (R.isCrestFace(f)) {
      // Jedes Symbol fliegt einzeln, auch bei Doppel-, Dreifach- und Mischseiten
      for (let k = 0; k < f.n; k++) flights.push([x.cube, { k: f.k, n: 1 }]);
      if (f.k2) flights.push([x.cube, { k: f.k2, n: 1 }]);
    }
  }
  if (e.combo && line) for (const c of CRESTS) for (let k = 0; k < (e.combo.gain[c.k] ?? 0); k++) flights.push([line, { k: c.k, n: 1 }]);
  await Promise.all(flights.map(([from, f], k) => flyCrest(from, f, e.side, k)));
  const t = V.teams[e.side - 1];
  if (t) t.crests = { ...e.crests };
  renderTop();
  renderPool();
  await View.wait(e.side === 1 ? 380 : 260);
  stage.classList.remove('on');
  await View.wait(260);
  stage.hidden = true;
  stage.replaceChildren();
  stageDice.clear();
}
/** Nach dem Neuladen in der Haltephase: den Wurf ohne Rollen wieder hinlegen */
function ensureKeepStage(): void {
  if (phase() !== 'keep' || S.turn !== 1 || stageDice.size || busy) return;
  const row = openStage('Your roll');
  const size = dieSize();
  for (const r of S.lastRoll) {
    const x = stageDie(r.id, size);
    row.append(x.box);
    void tumble(x.cube, r.fi, 0, 1, 0);
    landDie(r.id, r.fi);
  }
}
/** Haltephase: Würfel antippbar, gehaltene sind angehoben */
function renderKeep(): void {
  const keep = phase() === 'keep' && myTurn();
  ensureKeepStage();
  const stage = $('stage');
  stage.classList.toggle('pick', keep);
  // Die Kombi-Tafel steht unter den Würfeln, solange man hält
  let legend = stage.querySelector('.stage-legend');
  if (keep && !legend) {
    legend = el('div', 'stage-legend');
    for (const [k, t] of [
      ['Pair', '+1 of that symbol'],
      ['Triple', '+2 and a Joker'],
      ['Rainbow', '3 different symbols: a Joker'],
      ['3 stars', 'same level: a Joker'],
    ])
      legend.append(html('div', 'cmb', `<b>${k}</b><span>${t}</span>`));
    stage.append(legend);
  } else if (!keep && legend) legend.remove();
  for (const [id, x] of stageDice) x.box.classList.toggle('held', keep && held.has(id));
  if (keep) {
    comboPreview();
    taskPreview(1);
  }
}
function toggleHold(id: number): void {
  if (phase() !== 'keep' || !myTurn() || S.rerolls < 1) return;
  const box = stageDice.get(id)?.box;
  if (!box || !allowedEl(box)) return;
  sfx.tap();
  if (held.has(id)) held.delete(id);
  else held.add(id);
  renderAll();
}
/** Sepias Vorschlag zum Halten */
const defaultHold = () => new Set(R.aiHold(me(), lastRolled()));
function flyCrest(from: HTMLElement, f: Face, side: Side, k: number): Promise<void> {
  const dest = document.querySelector(`#${side === 1 ? 'crests' : 'rival-crests'} [data-k="${f.k}"]`) as HTMLElement | null;
  if (!dest) return Promise.resolve();
  const a = from.getBoundingClientRect(),
    b = dest.getBoundingClientRect();
  const fl = html('div', 'fly', iconSvg(f, 30));
  document.body.append(fl);
  const x0 = a.left + a.width / 2 - 15,
    y0 = a.top + a.height / 2 - 15,
    x1 = b.left + b.width / 2 - 15,
    y1 = b.top + b.height / 2 - 15;
  const anim = fl.animate(
    [
      { transform: `translate(${x0}px,${y0}px) scale(1)`, opacity: 1 },
      { transform: `translate(${(x0 + x1) / 2}px,${Math.min(y0, y1) - 40}px) scale(1.15)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${x1}px,${y1}px) scale(.55)`, opacity: 0.6 },
    ],
    { duration: 520 / V.speed, delay: (k * 110) / V.speed, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'both' },
  );
  return new Promise((res) => {
    anim.onfinish = () => {
      fl.remove();
      dest.classList.remove('bump');
      void dest.offsetWidth;
      dest.classList.add('bump');
      sfx.crest(k);
      res();
    };
  });
}

/* ---------- Banner und Ticker ---------- */
function showBanner(text: string, kind: 'turn' | 'round' | 'ability' | 'big'): void {
  const b = $('banner');
  b.className = '';
  b.textContent = text;
  void b.offsetWidth;
  b.className = 'show ' + kind;
}
let tickT = 0;
function showTicker(text: string, cls: string): void {
  const t = $('ticker');
  t.textContent = text;
  t.className = 'show ' + cls;
  clearTimeout(tickT);
  tickT = window.setTimeout(() => (t.className = cls), 3200);
}

/* ---------- Hinweise von Meisterin Sepia ---------- */
/** Tipps im normalen Duell: aus, seit Sepia nur im Lern-Duell erklärt. Texte bleiben für später */
const SHOW_TIPS = false;
const TIPS: Record<string, string> = {
  opening: 'Every blot is a die. I put your best one by your palette already. Tap the net to unfold it, or tap a blue dot to move it first.',
  roll: 'Pick three dice from your deck and roll. Rolled dice are used up until the deck is shuffled. Symbols go to your pool and keep, stars bring new blots onto the sheet.',
  keep: 'Your roll lies open. Tap dice to hold them and reroll the rest, once per turn. A pair gives one more of its symbol, a triple two more and a Joker, three different symbols a Joker.',
  summon: 'The stars add up. The net is placed where I would put it. Tap it to unfold.',
  act: 'Drag a blot onto paper to stamp there, onto a rival to splash it. One drag per blot. When all of them are done, your turn ends by itself.',
  medium: 'Mediums bend the rules, one for each of you. Pick one now, another after rounds two and four. More unlock as you play.',
  set: 'Two blots of one colour family work together: warm hits harder, cool walks further, earth heals each round. Three of them even more.',
  glaze: 'Paint reacts. The same pigment over your own dried paint glazes it: a second layer, worth double, harder to paint over. A neighbouring colour bleeds into free paper. A complementary colour turns wet rival paint into mud.',
  palette: 'You can reach their palette. One Splash symbol, one heart, one per turn. It is safe while one of their blots stands within two cells.',
};
function tip(key: string): void {
  // Erklärt wird nur im Lern-Duell (festgelegt am 30.10.2026), im normalen Duell erscheint kein Tipp
  if (!SHOW_TIPS || S.tutorial > 0 || seenTips.has(key) || !TIPS[key]) return;
  seenTips.add(key);
  store.set('bid-duel-tips', [...seenTips].join(','));
  $('tip-text').textContent = TIPS[key]!;
  $('tip').hidden = false;
}
/* Lern-Duell: Sepia erklärt jeden neuen Teil, sobald er dran ist */
const tutGo = () => {
  const a = tutorialAction();
  return a?.k === 'go' ? a : null;
};
const LESSONS: [string, () => boolean, string][] = [
  ['welcome', () => phase() === 'opening', 'This is the sheet, and I am Master Sepia. Today you duel my apprentice. I will tell you exactly what to do: always the gold ring.'],
  ['bag', () => phase() === 'opening', 'This is your deck, nine dice. Every blot is a die, its sides come from the blot itself. Hold a die to read it.'],
  ['net', () => phase() === 'opening' && !!summonU, 'I put the net where I would. A net must touch your own paint. Tap it to unfold.'],
  ['rival', () => phase() === 'roll' && S.round === 1, 'The apprentice unfolded first, up there by its palette. Each palette has three hearts. Break theirs, or cover more paper than them when it dries after six rounds.'],
  ['roll', () => phase() === 'roll' && S.round === 1, 'Each turn you roll three dice from your deck. I picked three for you. Roll them.'],
  ['deck', () => phase() === 'roll' && me().units.some((u) => u.used), 'Rolled dice are used up, like cards: grey in your deck. When fewer than three are ready, I shuffle the used ones back in. Plan which dice you spend.'],
  ['keep', () => phase() === 'keep', 'The roll lies open. Hold what you like and reroll the rest, once per turn. Pairs, triples and three different symbols pay extra. I marked what I would hold.'],
  ['crests', () => (phase() === 'summon' || phase() === 'act') && S.round === 1, 'Symbols go into your pool and stay. Step lets a blot walk further, Splash hits a palette, Guard halves a hit by itself, Glow pours into your blots and fills their brim. I lent you two Glow.'],
  ['summon', () => phase() === 'summon', 'Stars bring blots out. A die may unfold if the other dice show stars worth at least its level. This one qualifies, and the net is already placed.'],
  ['drag', () => phase() === 'act' && !!tutGo() && (tutGo()!.a === 'stamp' || tutGo()!.a === 'splash'), 'Now the fun part. Drag a blot along the gold arrow and let go. Paper means stamp, a rival means splash. One drag per blot, the turn ends by itself.'],
  ['palette', () => { const a = tutGo(); return a?.a === 'splash' && a.at === S.teams[1].home; }, 'Their palette is unguarded. One Splash symbol, one heart, one per turn. A palette is safe while one of its own blots stands within two cells.'],
  ['stamp', () => tutGo()?.a === 'stamp', 'A stamp paints the blot’s shape in wet paint. Over dried paint it needs a roll: your Opacity against their Grain. Wet paint bleeds into free paper when the round ends.'],
  ['splash', () => tutGo()?.a === 'splash', 'Splash hits a rival in reach: Saturation and a d20 against Grain and a d20. A hit paints the cell under the target. Two or three hits and a blot bursts.'],
  ['brim', () => phase() === 'act' && onSheetFull(), 'Paint soaks in. Every stamp, splash and hit fills a blot’s brim, and Glow pours into all of them. I filled this one to the top. A full blot shines gold: its next move is a master stroke.'],
  ['soak', () => tutGo()?.a === 'soak', 'Tap a blot twice to soak: it heals and rinses stains.'],
  ['end', () => tutorialAction()?.k === 'end', 'Nothing worth doing. End your turn.'],
  ['react', () => S.round >= 2 && phase() === 'act', 'Paint reacts. The same pigment over your own dried paint glazes it: a second layer, worth double, harder to paint over. A neighbouring colour bleeds into free paper. A complementary colour turns wet rival paint into mud.'],
  ['eraser', () => S.round >= 3 && phase() === 'roll', 'Did you see the Eraser? Someone keeps wiping rows of my sheet. Lightfastness protects paint and blots.'],
  ['free', () => S.round > S.tutorial && !S.over, 'That is all I can teach without doing it for you. Finish the duel on your own. In a hurry, Sepia paints plays a turn for you. Do not get used to it.'],
];
let lessonsSeen = new Set((store.get('bid-duel-lessons') ?? '').split(',').filter(Boolean));
function lessonCheck(): void {
  if (S.tutorial <= 0 || busy || screen !== 'game' || S.turn !== 1 || !$('tip').hidden) return;
  for (const [key, cond, text] of LESSONS) {
    if (lessonsSeen.has(key) || !cond()) continue;
    lessonsSeen.add(key);
    store.set('bid-duel-lessons', [...lessonsSeen].join(','));
    $('tip-text').textContent = text;
    $('tip').hidden = false;
    return;
  }
}
function tipForPhase(): void {
  const p = phase();
  if (p === 'opening' || p === 'medium' || p === 'roll' || p === 'keep' || p === 'summon' || p === 'act') tip(p);
  if (p === 'act' && R.setBonus(1)) tip('set');
}

/* ---------- Oberfläche ---------- */
function crestRow(box: HTMLElement, side: Side, small: boolean): void {
  const t = V.teams[side - 1];
  if (!t) return;
  if (box.childElementCount !== CRESTS.length) {
    box.replaceChildren();
    for (const c of CRESTS) {
      const s = html('span', 'crest', iconSvg({ k: c.k, n: 1 }, small ? 15 : 22) + '<b></b>');
      s.dataset.k = c.k;
      s.title = `${c.label}: ${c.use}`;
      box.append(s);
    }
  }
  for (const c of CRESTS) {
    const s = box.querySelector(`[data-k="${c.k}"]`) as HTMLElement;
    const n = t.crests[c.k];
    s.classList.toggle('zero', !n);
    s.querySelector('b')!.textContent = String(n);
  }
}
function hearts(box: HTMLElement, n: number): void {
  box.replaceChildren();
  for (let k = 0; k < HEARTS; k++) box.append(el('i', k < n ? 'on' : '', '♥'));
}
function portraitEl(id: number, px: number, alpha = 1): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = px * 2;
  c.style.opacity = String(alpha);
  c.classList.add('wet');
  // Nebenbei gemalt: sobald fertig, ins Kärtchen
  void View.portrait(id, px).then((src) => {
    if (!src) return;
    c.getContext('2d')!.drawImage(src, 0, 0, px * 2, px * 2);
    c.classList.remove('wet');
  });
  return c;
}
/** Fläschchen für ein Malmittel */
function bottleSvg(col: string, s: number): string {
  return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path d="M9.5 2.5h5v3l-.8.9V9c2.9 1.1 4.8 3.6 4.8 6.6a6.5 6.5 0 0 1-13 0c0-3 1.9-5.5 4.8-6.6V6.4l-.8-.9z" fill="#fffdf8" stroke="#3a3330" stroke-width="1.2"/><path d="M5.6 14.2h12.8a6.4 6.4 0 0 1-12.8.8z" fill="${col}"/><path d="M8.2 11.6c.8-.6 1.6-.9 2.4-1.1" stroke="#fff" stroke-width="1.1" fill="none" stroke-linecap="round"/></svg>`;
}
/** Über dem Blatt: deine Malmittel und dein Set-Bonus links, die des Rivalen rechts. Antippen erklärt */
function renderStatus(): void {
  const box = $('status');
  if (!S.teams.length || screen !== 'game') return;
  const cell = View.cellSize();
  box.style.left = `${board.offsetLeft}px`;
  box.style.top = `${board.offsetTop}px`;
  box.style.width = `${board.offsetWidth}px`;
  box.style.height = `${Math.max(20, View.padTop() - 2)}px`;
  const key = JSON.stringify([S.teams.map((t) => t.media ?? []), R.setBonus(1), R.setBonus(2), cell, V.round, V.turn || S.turn, tasksDone.size]);
  if (box.dataset.key === key) return;
  box.dataset.key = key;
  box.replaceChildren();
  const side = (sd: Side) => {
    const g = el('div', `st-side s${sd}`);
    for (const id of S.teams[sd - 1]!.media ?? []) {
      const m = mediumDef(id as MediumId);
      const b = html('button', 'st-med', bottleSvg(m.col, 20)) as HTMLButtonElement;
      b.type = 'button';
      b.title = m.name;
      b.addEventListener('click', () => showTicker(`${sd === 2 ? 'Rival: ' : ''}${m.name}. ${m.text}`, sd === 1 ? 'you' : 'rival'));
      g.append(b);
    }
    const sb = R.setBonus(sd);
    if (sb) {
      const t = R.FAMILY_TEXT[sb.fam][sb.n >= 3 ? 1 : 0];
      const b = html('button', `st-set f-${sb.fam}`, `<span class="fam">${sb.fam} </span>×${sb.n}`) as HTMLButtonElement;
      b.type = 'button';
      b.addEventListener('click', () => showTicker(`${sd === 2 ? 'Rival ' : ''}${sb.fam} ×${sb.n}: ${t}.`, sd === 1 ? 'you' : 'rival'));
      g.append(b);
    }
    return g;
  };
  // Sepias Auftrag dieser Runde: der Seite, die am Zug ist
  const ts = V.turn || S.turn;
  const task = R.taskOf(ts, V.round);
  if (task) {
    const done = tasksDone.has(`${V.round}:${ts}`);
    const b = html('button', `st-task s${ts}${done ? ' done' : ''}`, `<span class="pre">${ts === 2 ? 'Rival: ' : '✦ '}</span>${task.text}${done ? ' ✓' : ''}`) as HTMLButtonElement;
    b.type = 'button';
    b.addEventListener('click', () =>
      showTicker(ts === 2 ? `Rival’s task this round: ${task.text}. If its roll shows it, it gets a Joker.` : `Master Sepia’s task this round: roll ${task.text}. Jokers count. Done: a Joker.`, ts === 1 ? 'you' : 'rival'),
    );
    box.append(side(1), b, side(2));
    // Zu eng (viele Malmittel): Fläschchen dichter, Set-Bonus nur mit Zahl, damit der Auftrag lesbar bleibt
    box.classList.remove('tight');
    if (b.scrollWidth > b.clientWidth + 1) box.classList.add('tight');
  } else box.append(side(1), side(2));
}
function renderTop(): void {
  if (!V.teams.length || !S.teams.length) return;
  const [a, b, m] = R.counts(V.cells);
  $('score-you').textContent = String(a + R.HEART_BONUS * V.teams[0]!.hearts);
  $('score-rival').textContent = String(b + R.HEART_BONUS * V.teams[1]!.hearts);
  const tot = COLS * R.ROWS - 2;
  $('bar-you').style.width = (a / tot) * 100 + '%';
  $('bar-mud').style.width = (m / tot) * 100 + '%';
  $('bar-rival').style.width = (b / tot) * 100 + '%';
  $('round').textContent = S.over ? 'Done' : `Round ${Math.min(V.round, ROUNDS)}/${ROUNDS}`;
  const left = ROUNDS - V.round + 1;
  $('dries').textContent = S.over ? S.winReason : R.ERASER_ROUNDS.includes(V.round) ? 'Eraser next' : left <= 1 ? 'last round' : `dries in ${left}`;
  hearts($('rival-hearts'), V.teams[1]!.hearts);
  const rd = $('rival-dice');
  rd.replaceChildren();
  for (const u of S.teams[1].units) {
    const v = V.units.get(u.id);
    const st = v?.state ?? 'bag';
    const b2 = el('button', `rd st-${st} r-${u.rarity}` + (st === 'bag' && (v?.used ?? u.used) ? ' used' : '')) as HTMLButtonElement;
    b2.type = 'button';
    b2.style.setProperty('--c', rarityDef(u.rarity).col);
    b2.title = u.name;
    b2.append(portraitEl(u.id, 26, st === 'gone' ? 0.3 : 1), html('span', 'lvb', iconSvg({ k: 'star', n: u.lv }, 12)));
    if (st === 'sheet' && v) {
      const hp = el('span', 'mini-hp');
      const i = el('i');
      i.style.width = Math.max(0, v.hp / v.max) * 100 + '%';
      hp.append(i);
      b2.append(hp);
    }
    b2.addEventListener('click', () => openInspect(u));
    rd.append(b2);
  }
}
function renderPool(): void {
  if (!V.teams.length) return;
  hearts($('hearts'), V.teams[0]!.hearts);
  crestRow($('crests'), 1, false);
  // Deck: bereit und verbraucht (aus der Anzeige, damit es zur Animation passt)
  const us = me().units.map((u) => V.units.get(u.id) ?? u).filter((u) => u.state === 'bag');
  const ready = us.filter((u) => !u.used).length;
  $('deck').innerHTML = `<b>${ready}</b> ready <span>${us.length - ready} used</span>`;
}
const need = () => Math.min(R.ROLL_N, R.rollable(me()).length);
/** Vorschlag: die drei Würfel, die Sepia werfen würde */
function defaultPick(): Set<number> {
  return new Set(bestRoll());
}
function dieChip(u: Unit): HTMLElement {
  const v = V.units.get(u.id);
  const st = v?.state ?? u.state;
  const p = phase();
  const b = el('button', `chip st-${st}` + (chosen.has(u.id) && p === 'roll' ? ' chosen' : '') + (summonU === u ? ' sel' : '')) as HTMLButtonElement;
  b.type = 'button';
  const used = st === 'bag' && (v?.used ?? u.used);
  const pickable = myTurn() && ((p === 'roll' && st === 'bag' && !used) || (p === 'opening' && st === 'bag'));
  if (used) b.classList.add('used');
  b.dataset.id = String(u.id);
  b.classList.add(`r-${u.rarity}`);
  b.style.setProperty('--c', rarityDef(u.rarity).col);
  b.append(portraitEl(u.id, 34, st === 'gone' ? 0.3 : 1), html('span', 'lvb', iconSvg({ k: 'star', n: u.lv }, 15)), el('span', 'st', used ? 'used' : st === 'bag' ? 'ready' : st === 'sheet' ? 'on sheet' : 'lost'));
  // Halten zeigt die Seiten, auch wenn man den Würfel gerade wählen kann
  let hold = 0,
    held = false;
  const stop = () => window.clearTimeout(hold);
  b.addEventListener('pointerdown', () => {
    held = false;
    stop();
    hold = window.setTimeout(() => {
      held = true;
      openInspect(u);
    }, 450);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, stop);
  b.addEventListener('contextmenu', (ev) => ev.preventDefault());
  b.addEventListener('click', () => {
    if (held) return;
    if (!pickable) return openInspect(u);
    if (!allowedEl(b)) return;
    sfx.tap();
    if (p === 'roll') {
      if (chosen.has(u.id)) chosen.delete(u.id);
      else if (chosen.size < need()) chosen.add(u.id);
    } else pickSummon(u);
    renderAll();
  });
  return b;
}
function renderCtx(): void {
  const box = $('ctx');
  const tray = $('tray');
  box.replaceChildren();
  box.className = '';
  const p = phase();
  let where: 'top' | 'bottom' | null = null;
  if (S.turn === 1 && !S.over && p === 'medium') {
    // Malmittel: drei Karten, eine antippen
    box.className = 'media';
    for (const id of S.offer) {
      const m = mediumDef(id);
      const b = html('button', 'mcard', `${bottleSvg(m.col, 30)}<b>${m.name}</b><small>${m.text}</small>`) as HTMLButtonElement;
      b.type = 'button';
      b.dataset.id = id;
      b.addEventListener('click', () => {
        if (!allowedEl(b) || busy) return;
        sfx.ability();
        void request(api.duelAct({ k: 'medium', id })).then((ok) => ok && afterAction());
      });
      box.append(b);
    }
    where = 'top';
  } else if (S.turn === 1 && !S.over && (p === 'opening' || p === 'roll')) {
    box.className = 'chips';
    for (const u of me().units) box.append(dieChip(u));
    where = 'top';
  } else if (S.turn === 1 && p === 'summon') {
    box.className = 'rolled';
    const can = R.summonable(me(), lastRolled());
    for (const r of lastRolled()) {
      const ok = can.includes(r.u) && !busy;
      const b = el('button', 'rchip' + (ok ? ' can' : '') + (summonU === r.u ? ' sel' : '')) as HTMLButtonElement;
      b.type = 'button';
      b.disabled = !ok;
      b.dataset.id = String(r.u.id);
      b.append(html('span', 'rf', iconSvg(r.face, 26)), portraitEl(r.u.id, 22), el('small', '', R.faceText(r.face)));
      b.addEventListener('click', () => {
        if (!allowedEl(b)) return;
        sfx.tap();
        pickSummon(r.u);
        renderAll();
      });
      box.append(b);
    }
    // Liegt das Netz oben, kommt die Leiste nach unten
    const row = anchor !== null ? Math.floor(anchor / COLS) : ROWS - 1;
    where = row < ROWS / 2 ? 'bottom' : 'top';
  } else if (deckOpen && !S.over && p !== 'keep') {
    // Deck zum Nachsehen (Knopf neben den Symbolen)
    box.className = 'chips';
    for (const u of me().units) box.append(dieChip(u));
    where = 'top';
  }
  // Solange Züge abgespielt werden, bleibt das Brett frei
  if (busy) where = null;
  tray.hidden = !where;
  tray.className = where ?? '';
  $('deck').setAttribute('aria-pressed', String(deckOpen));
}
/** Joker aus dem Wurf: als Symbol nach Wahl nehmen (statt als Stern zu beschwören) */
function renderJoker(): void {
  const box = $('joker');
  const p = phase();
  const show = S.turn === 1 && !S.over && S.joker > 0 && (p === 'summon' || p === 'act');
  box.hidden = !show;
  $('hint').hidden = show;
  if (!show) return;
  box.replaceChildren(html('span', 'jlbl', `${iconSvg({ k: 'joker', n: 3 }, 18)} Joker${S.joker > 1 ? ` ×${S.joker}` : ''}${p === 'summon' ? ': summon with it, or take' : ': take'}`));
  for (const c of CRESTS) {
    const b = html('button', 'jc', iconSvg({ k: c.k, n: 1 }, 20)) as HTMLButtonElement;
    b.type = 'button';
    b.dataset.crest = c.k;
    b.title = `${c.label}: ${c.use}`;
    b.disabled = busy;
    b.addEventListener('click', () => {
      if (!allowedEl(b) || busy) return;
      sfx.crest(0);
      summonU = null;
      anchor = null;
      void request(api.duelAct({ k: 'joker', crest: c.k }));
    });
    box.append(b);
  }
}
function setHint(t: string): void {
  $('hint').textContent = t;
}
function renderGo(): void {
  const go = $('go') as HTMLButtonElement,
    aux = $('aux') as HTMLButtonElement,
    end = $('end') as HTMLButtonElement;
  aux.hidden = true;
  end.hidden = true;
  go.disabled = true;
  go.classList.remove('soft');
  const p = phase();
  if (busy) {
    go.textContent = '…';
    return;
  }
  if (S.over) {
    go.textContent = 'Again';
    go.disabled = false;
    return;
  }
  if (S.turn !== 1) {
    go.textContent = 'Wait';
    return;
  }
  if (p === 'opening' || p === 'summon') {
    if (p === 'summon') {
      end.hidden = false;
      end.textContent = 'Skip';
    }
    if (summonU) {
      aux.hidden = false;
      aux.textContent = 'Turn';
      const list = anchor !== null ? R.netAt(summonU, orient, anchor) : null;
      go.textContent = 'Unfold';
      go.disabled = !(list && R.validNet(1, list));
    } else go.textContent = 'Pick a die';
    return;
  }
  if (p === 'medium') {
    go.textContent = 'Pick a medium';
    return;
  }
  if (p === 'roll') {
    go.textContent = `Roll ${need()} dice`;
    go.disabled = chosen.size !== need();
    return;
  }
  if (p === 'keep') {
    const n = S.lastRoll.length - held.size;
    go.textContent = 'Keep';
    go.disabled = false;
    aux.hidden = false;
    aux.textContent = n ? `Reroll ${n}` : 'Reroll';
    aux.disabled = !n || S.rerolls < 1;
    return;
  }
  end.hidden = false;
  end.textContent = 'End turn';
  go.textContent = 'Sepia paints';
  go.classList.add('soft');
  go.disabled = S.tutorial > 0 && tutorialActive();
}
/** Vorschau eines Wischs: Weg, Stempelfelder mit Chancen oder Ziel mit Trefferchance, und ein Satz dazu */
function previewOf(u: Unit, p: Plan | null): Preview | null {
  const pv = previewBase(u, p);
  // Voller Klecks: der Wisch wird ein Meisterzug
  if (pv && p && R.brimFull(u) && R.masterApplies(u, p.a, p.at)) pv.text += ` Master stroke: ${ABILITY[u.m.bp].name}.`;
  return pv;
}
function previewBase(u: Unit, p: Plan | null): Preview | null {
  if (!p) return null;
  const here = R.idx(u.x, u.y);
  const prev = p.to !== here ? R.reachCost(u).prev : null;
  const path: number[] = [];
  if (prev) for (let c: number | undefined = p.to; c !== undefined && c !== -1; c = prev.get(c)) path.unshift(c);
  const pv: Preview = { path, cells: [], target: null, pct: null, text: '' };
  if (p.a === 'soak') {
    pv.text = `Soak: +${R.soakAmount(u)} opacity, rinses stains.`;
    return pv;
  }
  if (p.a === 'stamp' && p.at !== null) {
    const pig = R.atSpot(u, p.to, () => R.bestPig(u, 'stamp', p.at));
    let free = 0,
      mud = 0,
      glaze = 0,
      bleed = 0;
    const odds: number[] = [];
    for (const i of R.stampCells(u, p.at)) {
      const o = R.outcome(u, pig, S.cells[i]!);
      // Farbreaktion, falls die Farbe dort ankommt
      const re = o.kind !== 'none' && o.kind !== 'mud' && o.kind !== 'take' ? R.reactionOf(1, pig, S.cells[i]!) : null;
      if (re === 'glaze') glaze++;
      else if (re === 'bleed') bleed++;
      const col = re === 'glaze' ? '168,120,18' : o.kind === 'take' ? '46,122,87' : o.kind === 'mud' ? '110,75,51' : o.kind === 'none' ? '120,120,130' : o.kind === 'refresh' ? '90,100,120' : '168,108,18';
      const contested = o.kind === 'contest' || o.kind === 'over';
      pv.cells.push({ i, col, pct: contested ? Math.round(o.p * 100) : null });
      if (o.kind === 'take') free++;
      else if (o.kind === 'mud') mud++;
      else if (contested) odds.push(Math.round(o.p * 100));
    }
    const parts = [];
    if (free) parts.push(`${free} free`);
    if (odds.length) parts.push(`${odds.length} contested (${odds.join('%, ')}%)`);
    if (mud) parts.push(`${mud} to mud`);
    if (glaze) parts.push(`${glaze} glazed`);
    if (bleed) parts.push(`bleeds`);
    pv.text = `${p.to !== here ? 'Walk and stamp' : 'Stamp'}${pig !== u.m.main ? ` in ${PIG[pig].n}` : ''}: ${parts.join(' · ') || 'nothing new'}.`;
    return pv;
  }
  if (p.a === 'splash' && p.at !== null) {
    pv.target = p.at;
    if (p.at === S.teams[1].home) {
      pv.pct = 100;
      pv.text = `Hit their palette: one heart (${S.teams[1].hearts} left), costs a Splash.`;
      return pv;
    }
    const t = R.unitAt(p.at % COLS, Math.floor(p.at / COLS))!;
    const [pig, pct, dmg] = R.atSpot(u, p.to, () => {
      const g = R.bestPig(u, 'splash', p.at);
      return [g, Math.round(R.splashOdds(u, t, g) * 100), R.baseDamage(u, t, g, R.cheb(u.x, u.y, t.x, t.y) <= 1)] as const;
    });
    pv.pct = pct;
    pv.text = `${p.to !== here ? 'Walk and splash' : 'Splash'} ${t.name}: ${pct}% to hit, -${dmg}${GAIT[u.m.bp].key === 'twin' ? ' twice' : ''}, ${R.relWord(pig, t.m.main)}${S.teams[1].crests.guard ? '. They hold a Guard' : ''}.`;
  }
  return pv;
}
function renderHint(): void {
  const p = phase();
  if (S.over) return setHint('');
  if (busy && S.turn === 2) return setHint('Rival turn. Tap the sheet to speed it up.');
  if (busy) return setHint('');
  if (S.turn !== 1) return setHint('');
  const th = tut() ? tutHint() : null;
  $('hint').classList.toggle('tut', !!th);
  if (th) return setHint(th);
  if (p === 'opening') return setHint(summonU ? `Tap the net to unfold ${summonU.name}. Tap a blue dot to move it, Turn to rotate it.` : 'Opening: pick one of your dice below to unfold first.');
  if (p === 'roll') return setHint(`Roll ${need()} dice. Tap to swap, hold to read. Rolled dice stay used until you reshuffle.`);
  if (p === 'keep') return setHint('Tap dice to hold them, then reroll the rest once. Or keep the roll as it is.');
  if (p === 'medium') return setHint('Pick a medium. It bends one rule for you until the paper dries.');
  if (p === 'summon') return setHint(summonU ? `Tap the net to unfold ${summonU.name}, or skip. Blue dots move it.` : 'Tap a glowing die to unfold it, or skip.');
  if (drag) return setHint(drag.pv?.text ?? 'Out of reach. Let go to cancel.');
  if (aiming) {
    const ab = ABILITY[aiming.m.bp];
    return setHint(ab.text);
  }
  if (armed && R.brimFull(armed)) return setHint(`${armed.name} is brimming: its next move is a master stroke (${ABILITY[armed.m.bp].name}). Tap a target.`);
  if (armed) return setHint(`${armed.name}: tap a target. Paper: stamp. Rival: splash. Tap it again to soak.`);
  if (!R.onSheet(me()).some((u) => !u.acted)) return setHint('All blots are done. End your turn.');
  setHint('Drag a blot onto paper to stamp, onto a rival to splash. Tap it for its reach.');
}
/** Goldknöpfe der alten Fähigkeiten: aus, Fähigkeiten kommen als Meisterzug */
const SHOW_ABIL = false;
/** Ein eigener Klecks auf dem Blatt ist voll */
const onSheetFull = (): boolean => R.onSheet(me()).some((u) => !u.acted && R.brimFull(u));
/** Lern-Duell: der Hinweis sagt genau, was Sepia jetzt sehen will (nur dieser Schritt ist antippbar) */
function tutHint(): string | null {
  const a = tutorialAction();
  if (!a) return null;
  const name = (id: number) => R.unitById(id)?.name ?? 'the marked blot';
  switch (a.k) {
    case 'open':
    case 'summon':
      if (summonU?.id !== a.id) return `Tap ${name(a.id)}, the die with the gold glow.`;
      if (orient !== a.o) return 'Tap Turn until the net matches the gold ring.';
      return 'Tap the gold ring to unfold the net.';
    case 'roll':
      return 'Tap the dice with the gold glow, then Roll.';
    case 'reroll':
      return 'Tap the glowing dice to hold or free them, then Reroll the rest.';
    case 'keep':
      return 'Keep this roll: tap Keep.';
    case 'skip':
      return 'Nothing to unfold this time: tap Skip.';
    case 'end':
      return 'Nothing worth doing: tap End turn.';
    case 'joker':
      return 'Your Joker: tap the symbol with the gold glow.';
    case 'go': {
      const u = R.unitById(a.id);
      if (!u) return null;
      if (a.a === 'ability') {
        const ab = ABILITY[u.m.bp].name;
        return aiming?.id === u.id ? `Tap the gold ring: ${u.name} uses ${ab} there.` : `Not a drag this time: tap the gold “${ab}” button above ${u.name}.`;
      }
      if (a.a === 'soak') return `Tap ${u.name} twice: it soaks where it stands.`;
      if (armed?.id === u.id) return `Now tap the gold ring.`;
      return `Drag ${u.name} along the gold arrow. Or tap it, then the gold ring.`;
    }
  }
  return null;
}
/** Goldknöpfe für Fähigkeiten über den Klecksen, die eine nutzen können */
function renderAbil(): void {
  const box = $('abil');
  box.replaceChildren();
  // Fähigkeiten gibt es nur noch als Meisterzug (festgelegt am 30.10.2026), keine Goldknöpfe mehr
  if (!SHOW_ABIL || !myTurn() || phase() !== 'act' || drag) return;
  const cell = View.cellSize();
  for (const u of R.onSheet(me())) {
    if (u.acted) continue;
    const b = el('button', 'abil' + (aiming === u ? ' on' : ''), ABILITY[u.m.bp].name) as HTMLButtonElement;
    b.type = 'button';
    b.dataset.id = String(u.id);
    b.style.left = `${board.offsetLeft + (u.x + 0.5) * cell}px`;
    b.style.top = `${board.offsetTop + View.padTop() + u.y * cell - cell * 0.55}px`;
    b.addEventListener('click', () => {
      if (!allowedEl(b) || busy) return;
      sfx.tap();
      const here = R.idx(u.x, u.y);
      if (ABILITY[u.m.bp].target === 'self') return void sendGo(u, { to: here, a: 'ability', at: here });
      aiming = aiming === u ? null : u;
      armed = null;
      renderAll();
    });
    box.append(b);
  }
}
function renderAll(): void {
  if (screen !== 'game' || !S.teams.length) return;
  renderTop();
  renderPool();
  renderStatus();
  renderKeep();
  renderCtx();
  renderJoker();
  renderGo();
  renderHint();
  renderAbil();
  applyGuide();
  lessonCheck();
}

/* ---------- Hervorhebungen auf dem Blatt ---------- */
const faceImgs = new Map<string, HTMLImageElement>();
function faceImg(f: Face): HTMLImageElement {
  const k = R.faceKey(f);
  let i = faceImgs.get(k);
  if (!i) {
    i = new Image();
    i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconSvg(f, 40).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
    faceImgs.set(k, i);
  }
  return i;
}
function drawOverlay(ctx: CanvasRenderingContext2D, cell: number): void {
  if (!myTurn()) return;
  const cx = (i: number) => ((i % COLS) + 0.5) * cell,
    cy = (i: number) => (Math.floor(i / COLS) + 0.5) * cell;
  const dot = (i: number, col: string, r = 0.11) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(cx(i), cy(i), cell * r, 0, 7);
    ctx.fill();
  };
  const ring = (i: number, col: string) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(cx(i), cy(i), cell * 0.52, -performance.now() / 900, 7 - performance.now() / 900);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  if (placing()) {
    const u = summonU!;
    for (let at = 0; at < COLS * R.ROWS; at++) {
      const list = R.netAt(u, orient, at);
      if (list && R.validNet(1, list) && at !== anchor) dot(at, 'rgba(43,63,163,.5)', 0.1);
    }
    if (anchor !== null) {
      const list = R.netAt(u, orient, anchor);
      if (list) {
        const ok = R.validNet(1, list);
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 2.5;
        list.forEach((i, k) => {
          const x = (i % COLS) * cell,
            y = Math.floor(i / COLS) * cell;
          ctx.fillStyle = ok ? `rgba(${PIG[u.m.main].rgb},.3)` : 'rgba(163,58,58,.18)';
          ctx.strokeStyle = ok ? 'rgba(43,63,163,.95)' : 'rgba(163,58,58,.9)';
          ctx.fillRect(x + 3, y + 3, cell - 6, cell - 6);
          ctx.strokeRect(x + 3, y + 3, cell - 6, cell - 6);
          const img = faceImg(u.faces[k]!);
          if (img.complete) ctx.drawImage(img, x + cell * 0.3, y + cell * 0.3, cell * 0.4, cell * 0.4);
        });
        ctx.setLineDash([]);
      }
    }
    drawGuide(ctx, cell);
    return;
  }
  if (phase() !== 'act') return drawGuide(ctx, cell);
  if (aiming) {
    for (const i of R.abilityTargets(aiming)) {
      if (R.unitAt(i % COLS, Math.floor(i / COLS))) ring(i, 'rgba(168,108,18,.95)');
      else dot(i, 'rgba(168,108,18,.55)', 0.12);
    }
    return drawGuide(ctx, cell);
  }
  const u = drag?.u ?? armed;
  if (u) {
    const hl = reachOf(u);
    for (const i of hl.spots) if (i !== R.idx(u.x, u.y)) dot(i, 'rgba(46,122,87,.4)', 0.09);
    for (const i of hl.hits) ring(i, 'rgba(163,58,58,.5)');
  }
  const pv = drag?.pv;
  if (drag && !pv && drag.moved) {
    // Hier geht nichts: rotes Kreuz
    const x = cx(drag.over),
      y = cy(drag.over),
      r = cell * 0.18;
    ctx.strokeStyle = 'rgba(163,58,58,.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - r, y - r);
    ctx.lineTo(x + r, y + r);
    ctx.moveTo(x + r, y - r);
    ctx.lineTo(x - r, y + r);
    ctx.stroke();
  }
  if (drag && pv) {
    if (pv.path.length > 1) {
      ctx.strokeStyle = 'rgba(46,122,87,.9)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.setLineDash([2, 9]);
      ctx.beginPath();
      pv.path.forEach((i, k) => (k ? ctx.lineTo(cx(i), cy(i)) : ctx.moveTo(cx(i), cy(i))));
      ctx.stroke();
      ctx.setLineDash([]);
      const end = pv.path[pv.path.length - 1]!;
      ctx.strokeStyle = 'rgba(43,63,163,.75)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx(end), cy(end), cell * 0.4, 0, 7);
      ctx.stroke();
    }
    for (const c of pv.cells) {
      ctx.strokeStyle = `rgba(${c.col},.95)`;
      ctx.fillStyle = `rgba(${c.col},.14)`;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.fillRect((c.i % COLS) * cell + 4, Math.floor(c.i / COLS) * cell + 4, cell - 8, cell - 8);
      ctx.strokeRect((c.i % COLS) * cell + 4, Math.floor(c.i / COLS) * cell + 4, cell - 8, cell - 8);
      ctx.setLineDash([]);
      if (c.pct !== null) label(cx(c.i), Math.floor(c.i / COLS) * cell + cell - 9, `${c.pct}%`, `rgb(${c.col})`, 11);
    }
    if (pv.target !== null) {
      ring(pv.target, 'rgba(163,58,58,1)');
      if (pv.pct !== null) label(cx(pv.target), cy(pv.target) - cell * 0.62, pv.target === S.teams[1].home ? '♥' : `${pv.pct}%`, '#a33a3a', 16);
    }
  }
  drawGuide(ctx, cell);
  function label(x: number, y: number, t: string, col: string, px: number): void {
    ctx.font = `800 ${px}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(251,250,246,.95)';
    ctx.strokeText(t, x, y);
    ctx.fillStyle = col;
    ctx.fillText(t, x, y);
  }
}
/** Reichweite eines Kleckses: Felder, die er erreicht, und Rivalen (oder die Palette), die er von dort trifft */
function reachOf(u: Unit): { spots: number[]; hits: number[] } {
  if (reachHl?.id === u.id) return reachHl;
  const hits = [...R.onSheet(S.teams[1]).map((t) => R.idx(t.x, t.y)), S.teams[1].home].filter((i) => R.planDrop(u, i)?.a === 'splash');
  reachHl = { id: u.id, spots: R.spots(u), hits };
  return reachHl;
}

/* ---------- Führung: Sepia zeigt, was sie tun würde ---------- */
let guideNow: { cell?: number; el?: string; from?: number } = {};
/** Bester Anker für das Netz in der aktuellen Drehung: möglichst weit vorne, viel freies Papier */
function bestAnchor(u: Unit): number | null {
  const h = S.teams[1].home;
  let best: number | null = null,
    bv = -Infinity;
  for (let at = 0; at < COLS * R.ROWS; at++) {
    const list = R.netAt(u, orient, at);
    if (!list || !R.validNet(1, list)) continue;
    const v = list.filter((i) => S.cells[i]!.owner === 0).length - R.cheb(at % COLS, Math.floor(at / COLS), h % COLS, Math.floor(h / COLS)) * 0.8;
    if (v > bv) {
      bv = v;
      best = at;
    }
  }
  return best;
}
type Guide = { cell?: number; el?: string; from?: number };
/** Halten wie Sepia: erst die Würfel richtig antippen, dann Neuwurf. hold = null heißt behalten */
function keepGuide(hold: number[] | null): Guide {
  if (!hold) return { el: '#go' };
  const wrong = S.lastRoll.map((r) => r.id).find((id) => held.has(id) !== hold.includes(id));
  if (wrong !== undefined) return { el: `#stage .stage-die[data-id="${wrong}"]` };
  return { el: '#aux' };
}
/** Führung für einen Klecks-Zug: Wisch (Pfeil vom Klecks zum Ziel), Doppeltipp (Soak) oder Goldknopf */
function goGuide(g: { id: number; to: number; a: string; at: number | null }): Guide {
  const u = R.unitById(g.id);
  if (!u) return {};
  const here = R.idx(u.x, u.y);
  if (g.a === 'ability') return ABILITY[u.m.bp].target === 'self' || aiming?.id !== u.id ? { el: `#abil .abil[data-id="${u.id}"]` } : { cell: g.at ?? here };
  if (g.a === 'soak') return { cell: here };
  if (armed?.id === u.id) return { cell: g.at ?? here };
  return { from: here, cell: g.at ?? here };
}
/** Im Lern-Duell: der vorgegebene Schritt, zerlegt in einzelne Tipps */
function tutorialGuide(): Guide {
  const exp = tutorialAction();
  if (!exp) return {};
  switch (exp.k) {
    case 'open':
    case 'summon':
      if (summonU?.id !== exp.id) return { el: exp.k === 'open' ? `#ctx .chip[data-id="${exp.id}"]` : `#ctx .rchip[data-id="${exp.id}"]` };
      if (orient !== exp.o) return { el: '#aux' };
      return { cell: exp.at };
    case 'roll': {
      const missing = exp.ids.find((id) => !chosen.has(id));
      if (missing !== undefined) return { el: `#ctx .chip[data-id="${missing}"]` };
      return { el: '#go' };
    }
    case 'reroll':
    case 'keep':
      return keepGuide(exp.k === 'reroll' ? exp.hold : null);
    case 'skip':
    case 'end':
      return { el: '#end' };
    case 'joker':
      return { el: `#joker [data-crest="${exp.crest}"]` };
    case 'go':
      return goGuide(exp);
  }
  return {};
}
function computeGuide(): Guide {
  if (tut() && screen === 'game') return tutorialGuide();
  if (!hints || !myTurn() || screen !== 'game') return {};
  const p = phase();
  if (p === 'opening' || p === 'summon') {
    if (!summonU) return { el: p === 'opening' ? '#ctx .chip.st-bag' : '#ctx .rchip.can' };
    if (anchor === null) {
      const a = bestAnchor(summonU);
      return a === null ? { el: '#aux' } : { cell: a };
    }
    return { cell: anchor };
  }
  if (p === 'roll') return chosen.size === need() ? { el: '#go' } : { el: '#ctx .chip:not(.chosen):not(.st-gone):not(.used):not(.st-sheet)' };
  if (p === 'medium') return S.offer.length ? { el: `#ctx .mcard[data-id="${R.aiMedium(S.offer)}"]` } : {};
  if (p === 'keep') {
    const hold = R.aiHold(me(), lastRolled());
    return keepGuide(S.rerolls > 0 && hold.length < S.lastRoll.length ? hold : null);
  }
  if (p !== 'act' || drag) return {};
  if (S.joker > 0) return { el: `#joker [data-crest="${R.aiJokerCrest(me())}"]` };
  const sug = R.suggest(1, aiming ?? armed ?? undefined, false, R.byGesture);
  if (!sug) return armed || aiming ? {} : { el: '#end' };
  return goGuide({ id: sug.u.id, to: sug.to, a: sug.a, at: sug.at });
}
/** Sepias Gold: hell genug für Aquarellfarben, mit dunklem Rand */
const GOLD = '#ffcf3f';
function drawGuide(ctx: CanvasRenderingContext2D, cell: number): void {
  if (guideNow.cell === undefined || drag) return;
  const i = guideNow.cell;
  const t = performance.now();
  const x = ((i % COLS) + 0.5) * cell,
    y = (Math.floor(i / COLS) + 0.5) * cell;
  const r = cell * (0.42 + 0.06 * Math.sin(t / 180));
  // Feld leicht aufhellen, dann dunkler Rand und helles Gold darüber: auf jeder Farbe gut zu sehen
  ctx.fillStyle = `rgba(255,214,90,${0.22 + 0.12 * Math.sin(t / 180)})`;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 7);
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(29,33,48,.8)';
  ctx.stroke();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = GOLD;
  ctx.stroke();
  if (guideNow.from === undefined || guideNow.from === i) return;
  // Pfeil vom Klecks zum Ziel: so wird gewischt
  const fx = ((guideNow.from % COLS) + 0.5) * cell,
    fy = (Math.floor(guideNow.from / COLS) + 0.5) * cell;
  const ang = Math.atan2(y - fy, x - fx);
  const len = Math.hypot(x - fx, y - fy) - cell * 0.5;
  const sx = fx + Math.cos(ang) * cell * 0.45,
    sy = fy + Math.sin(ang) * cell * 0.45;
  const ex = fx + Math.cos(ang) * len,
    ey = fy + Math.sin(ang) * len;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.lineWidth = 9;
  ctx.strokeStyle = 'rgba(29,33,48,.75)';
  ctx.stroke();
  ctx.setLineDash([10, 7]);
  ctx.lineDashOffset = -t / 40;
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = GOLD;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  ctx.beginPath();
  ctx.moveTo(ex + Math.cos(ang) * 13, ey + Math.sin(ang) * 13);
  ctx.lineTo(ex + Math.cos(ang + 2.4) * 13, ey + Math.sin(ang + 2.4) * 13);
  ctx.lineTo(ex + Math.cos(ang - 2.4) * 13, ey + Math.sin(ang - 2.4) * 13);
  ctx.closePath();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(29,33,48,.8)';
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.fill();
  // Ein Punkt wandert den Weg entlang wie ein Finger
  const k = (t % 1400) / 1400;
  ctx.globalAlpha = 1 - k;
  ctx.beginPath();
  ctx.arc(fx + (x - fx) * k, fy + (y - fy) * k, cell * 0.16, 0, 7);
  ctx.fillStyle = GOLD;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(29,33,48,.8)';
  ctx.stroke();
  ctx.globalAlpha = 1;
}
function applyGuide(): void {
  guideNow = computeGuide();
  for (const e of document.querySelectorAll('.guide')) e.classList.remove('guide');
  if (guideNow.el) document.querySelector(guideNow.el)?.classList.add('guide');
}

/* ---------- Eingaben: Wisch vom Klecks aufs Ziel, oder antippen und dann das Ziel antippen ---------- */
function cellAt(e: PointerEvent): number | null {
  const rect = board.getBoundingClientRect();
  const cell = View.cellSize();
  const x = Math.floor((e.clientX - rect.left) / cell),
    y = Math.floor((e.clientY - rect.top - View.padTop()) / cell);
  return R.inside(x, y) ? R.idx(x, y) : null;
}
/**
 * Kleckse ragen nach oben ins nächste Feld und überdecken sich: getroffen wird der eigene Klecks, den man an der Stelle sieht
 * (Umriss oder Sockel, der vordere zuerst). Im Lern-Duell gewinnt der markierte, sobald der Finger auf seinem Bild liegt
 */
function grabAt(e: PointerEvent): number | null {
  const rect = board.getBoundingClientRect();
  const cell = View.cellSize();
  const px = e.clientX - rect.left,
    py = e.clientY - rect.top - View.padTop();
  const g = tut() && guideNow.from !== undefined ? R.unitAt(guideNow.from % COLS, Math.floor(guideNow.from / COLS)) : null;
  const id = View.pickUnit(px, py, 1, g?.side === 1 ? g.id : null);
  const u = id === null ? null : R.unitById(id);
  if (u) return R.idx(u.x, u.y);
  const fx = px / cell,
    fy = py / cell;
  const x = Math.floor(fx),
    y = Math.floor(fy);
  const mine = (yy: number) => (R.inside(x, yy) && R.unitAt(x, yy)?.side === 1 ? R.idx(x, yy) : null);
  return mine(y) ?? (fy - y > 0.3 ? mine(y + 1) : null) ?? cellAt(e);
}
board.addEventListener('pointerdown', (e) => {
  if (busy && S.turn === 2) {
    V.speed = 3;
    return;
  }
  if (!myTurn() || phase() !== 'act' || aiming) return;
  const i = grabAt(e);
  if (i === null) return;
  const u = R.unitAt(i % COLS, Math.floor(i / COLS));
  if (!u || u.side !== 1 || u.acted || (armed && armed !== u)) return;
  if (tut() && guideNow.from !== i && guideNow.cell !== i) return nudge();
  // over: das Feld unter dem Finger (beim Griff am Kopf das Feld darüber), erst ein Wechsel zählt als Wisch
  drag = { u, start: i, over: cellAt(e) ?? i, moved: false, plan: null, pv: null };
  try {
    board.setPointerCapture(e.pointerId);
  } catch {
    /* egal */
  }
  renderAll();
});
board.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const i = cellAt(e);
  if (i === null || i === drag.over) return;
  drag.over = i;
  drag.moved = true;
  drag.plan = i === drag.start ? null : R.planDrop(drag.u, i);
  drag.pv = previewOf(drag.u, drag.plan);
  renderHint();
});
board.addEventListener('pointerup', (e) => {
  const i = cellAt(e);
  if (drag) {
    const d = drag;
    drag = null;
    if (!d.moved || i === d.start || i === null) {
      // Nur angetippt: auswählen, ein zweiter Tipp auf ihn ist Soak
      if (armed === d.u) return void tapCell(d.start);
      armed = d.u;
      sfx.tap();
      return renderAll();
    }
    if (tut() && (guideNow.from !== d.start || guideNow.cell !== i)) {
      renderAll();
      return nudge();
    }
    if (d.plan) return void sendGo(d.u, d.plan);
    return renderAll();
  }
  if (i !== null) tapCell(i);
});
board.addEventListener('pointercancel', () => {
  drag = null;
  renderAll();
});
function tapCell(i: number): void {
  if (busy && S.turn === 2) return;
  if (!myTurn()) return;
  const u = R.unitAt(i % COLS, Math.floor(i / COLS));
  const p = phase();
  if (tut() && guideNow.cell !== i && guideNow.from !== i) return nudge();
  if (placing()) {
    // Tipp aufs Netz klappt auf, Tipp auf einen anderen Punkt verschiebt es dorthin
    const list = anchor !== null ? R.netAt(summonU!, orient, anchor) : null;
    if (list && list.includes(i) && R.validNet(1, list)) return void unfold();
    for (let k = 0; k < 8; k++) {
      const o = (orient + k) % 8;
      const l2 = R.netAt(summonU!, o, i);
      if (l2 && R.validNet(1, l2)) {
        orient = o;
        anchor = i;
        sfx.tap();
        break;
      }
    }
    return renderAll();
  }
  if (p !== 'act') {
    if (u) openInspect(u);
    return;
  }
  if (aiming) {
    const a = aiming;
    if (R.abilityTargets(a).includes(i)) return void sendGo(a, { to: R.idx(a.x, a.y), a: 'ability', at: i });
    aiming = null;
    return renderAll();
  }
  if (armed) {
    const a = armed;
    if (u && u.side === 1 && u !== a) {
      armed = u.acted ? null : u;
      reachHl = null;
      return renderAll();
    }
    const plan = R.planDrop(a, i);
    armed = null;
    if (plan) return void sendGo(a, plan);
    return renderAll();
  }
  if (u && u.side === 2) openInspect(u);
}
/** Einen Klecks-Zug an den Server schicken */
async function sendGo(u: Unit, p: Plan): Promise<void> {
  armed = null;
  aiming = null;
  drag = null;
  sfx.tap();
  if (await request(api.duelAct({ k: 'go', id: u.id, to: p.to, a: p.a, at: p.at }))) afterAction();
}
function afterAction(): void {
  renderAll();
  tipForPhase();
  if (phase() === 'act' && R.onSheet(me()).some((v) => !v.acted && R.planDrop(v, S.teams[1].home))) tip('palette');
  if (phase() === 'act' && S.round >= 2) tip('glaze');
}
/** Netz schon an die beste Stelle legen: ein Tipp klappt auf */
function prepSummon(): void {
  if (!myTurn() || summonU) return;
  const p = phase();
  if (p === 'opening') {
    const b = R.bestOpening(1);
    if (b) {
      summonU = b.u;
      orient = b.o;
      anchor = b.at;
    }
  } else if (p === 'summon') {
    const u = R.summonable(me(), lastRolled())[0];
    if (u) pickSummon(u);
  }
}
function pickSummon(u: Unit): void {
  summonU = u;
  const b = R.bestPlacement(u);
  orient = b?.o ?? 0;
  anchor = b?.at ?? null;
}
async function unfold(): Promise<void> {
  if (!summonU || anchor === null || busy) return;
  const list = R.netAt(summonU, orient, anchor);
  if (!list || !R.validNet(1, list)) return;
  const a: DuelAction = { k: phase() === 'opening' ? 'open' : 'summon', id: summonU.id, o: orient, at: anchor };
  summonU = null;
  anchor = null;
  if (await request(api.duelAct(a))) afterAction();
}
async function doRoll(): Promise<void> {
  if (!myTurn() || phase() !== 'roll' || chosen.size !== need()) return;
  const ids = [...chosen];
  chosen = new Set();
  if (await request(api.duelAct({ k: 'roll', ids }))) afterAction();
}
async function doKeep(): Promise<void> {
  if (!myTurn() || phase() !== 'keep') return;
  sfx.tap();
  if (await request(api.duelAct({ k: 'keep' }))) afterAction();
}
async function doReroll(): Promise<void> {
  if (!myTurn() || phase() !== 'keep' || S.rerolls < 1) return;
  const hold = [...held].filter((id) => S.lastRoll.some((r) => r.id === id));
  if (hold.length >= S.lastRoll.length) return;
  sfx.tap();
  if (await request(api.duelAct({ k: 'reroll', hold }))) afterAction();
}
async function endTurn(): Promise<void> {
  if (!myTurn() || (phase() !== 'act' && phase() !== 'summon')) return;
  summonU = null;
  anchor = null;
  if (await request(api.duelAct({ k: 'end' }))) afterAction();
}
async function autoTurn(): Promise<void> {
  if (!myTurn() || (phase() !== 'act' && phase() !== 'summon')) return;
  summonU = null;
  anchor = null;
  if (await request(api.duelAct({ k: 'auto' }))) afterAction();
}
async function skipSummon(): Promise<void> {
  summonU = null;
  anchor = null;
  if (await request(api.duelAct({ k: 'skip' }))) afterAction();
}

$('deck').addEventListener('click', () => {
  if (busy || tut()) return;
  sfx.tap();
  deckOpen = !deckOpen;
  renderAll();
});
$('go').addEventListener('click', () => {
  if (busy) return;
  if (S.over) return void startDuel();
  if (!allowedEl($('go'))) return;
  if (!myTurn()) return;
  if (placing()) return void unfold();
  if (phase() === 'roll') return void doRoll();
  if (phase() === 'keep') return void doKeep();
  if (phase() === 'act') return void autoTurn();
});
$('aux').addEventListener('click', () => {
  if (busy || !allowedEl($('aux'))) return;
  if (phase() === 'keep') return void doReroll();
  sfx.tap();
  if (placing()) {
    orient = (orient + 1) % 8;
    const list = anchor !== null ? R.netAt(summonU!, orient, anchor) : null;
    if (!list || !R.validNet(1, list)) anchor = bestAnchor(summonU!);
  }
  renderAll();
});
$('end').addEventListener('click', () => {
  if (busy || !allowedEl($('end'))) return;
  sfx.tap();
  if (phase() === 'summon') return void skipSummon();
  void endTurn();
});

/* ---------- Karten, Menü, Regeln, Ergebnis ---------- */
function openInspect(u: Unit): void {
  sfx.tap();
  const v = V.units.get(u.id);
  const st = v?.state ?? u.state;
  const box = $('inspect-body');
  box.replaceChildren();
  const top = el('div', 'card-top');
  const info = el('div', 'card-id');
  const rd = rarityDef(u.rarity);
  info.append(el('b', '', u.name), html('span', 'lv', `${iconSvg({ k: 'star', n: u.lv }, 15)} Level ${u.lv} · <b style="color:${rd.col}">${rd.label}</b> · ${u.side === 1 ? 'yours' : 'rival'} · ${st === 'bag' ? 'in the bag' : st === 'sheet' ? 'on the sheet' : 'washed out'}`));
  if (st === 'sheet' && v) {
    const hp = el('div', 'card-hp');
    const i = el('i');
    i.style.width = Math.max(0, v.hp / v.max) * 100 + '%';
    hp.append(i);
    info.append(hp, el('small', '', `Opacity ${Math.max(0, v.hp)}/${v.max}`));
  }
  top.append(portraitEl(u.id, 64), info);
  const net = html('div', 'card-net', netSvg(u.net, u.faces, 26));
  const stats = el('div', 'card-stats');
  for (const [k, n] of [
    ['SAT', u.sat],
    ['OPA', u.opa],
    ['GRN', u.grn],
    ['FLO', u.flo],
    ['GLW', u.glw],
    ['LFT', u.lf],
  ] as [string, number][])
    stats.append(html('span', '', `<small>${k}</small><b>${n}</b>`));
  const ab = ABILITY[u.m.bp];
  const lines = el('div', 'card-lines');
  lines.append(
    html('p', '', `<b>Die</b> ${u.faces.map(R.faceText).join(', ')}`),
    ...(['joker', 'gold'] as const).filter((k) => u.faces.some((f) => f.k === k)).map((k) => html('p', 'special', R.FACE_HELP[k])),
    html('p', '', `<b>Moves</b> ${GAIT[u.m.bp].text}`),
    html('p', 'ab', `<b>Master stroke · ${ab.name}</b> <span>Brim ${u.brim}/${R.BRIM.max}</span> ${ab.text}`),
    html('p', '', 'Stamps, splashes, soaks and hits fill the brim, Glow pours in. Full, its next move does this on top. Bursting at least half full, it spills once more.'),
  );
  for (const t of u.traits) lines.append(html('p', 'trait', `<b>${t.label}</b> ${t.text}`));
  box.append(top, net, stats, lines);
  $('inspect').hidden = false;
}
function sepiaEnd(): string {
  if (S.winReason === 'palette broken') return S.winner === 1 ? 'You broke their palette. Messy, but effective.' : 'They broke your palette. I did say mind it.';
  if (S.winReason === 'washed out') return S.winner === 1 ? 'Not a single rival die left. Thorough.' : 'Every die washed away. We will speak about this.';
  return S.winner === 1 ? 'The paper remembers who painted it. Today, you.' : S.winner === 2 ? 'The rival covered more paper. Paper keeps score, not excuses.' : 'A draw. The paper cannot decide either.';
}
async function finishDuel(): Promise<void> {
  renderAll();
  await View.wait(700);
  const [a, b] = R.scores();
  $('result-title').textContent = S.winner === 1 ? 'You win the sheet' : S.winner === 2 ? 'The rival wins the sheet' : 'A draw';
  $('result-sub').textContent = S.winReason === 'palette broken' ? (S.winner === 1 ? 'Their palette is broken.' : 'Your palette is broken.') : S.winReason === 'washed out' ? 'All dice of one side are lost.' : `The paper dried: ${a} to ${b}.`;
  const st = $('result-stats');
  st.replaceChildren();
  const [ca, cb] = R.counts();
  for (const [k, x, y] of [
    ['Cells', ca, cb],
    ['Hearts', S.teams[0].hearts, S.teams[1].hearts],
    ['Blots unfolded', S.teams[0].units.filter((u) => u.state !== 'bag').length, S.teams[1].units.filter((u) => u.state !== 'bag').length],
    ['Dice lost', S.teams[0].units.filter((u) => u.state === 'gone').length, S.teams[1].units.filter((u) => u.state === 'gone').length],
  ] as [string, number, number][])
    st.append(html('div', '', `<span>${k}</span><b class="y">${x}</b><b class="r">${y}</b>`));
  $('result-sepia').textContent = sepiaEnd();
  const rw = $('result-reward');
  rw.hidden = !reward;
  if (reward) rw.innerHTML = (reward.pigment ? `<span class="pigi"></span> +${reward.pigment} pigment <small>(${reward.total} in total)</small>` : reward.why === 'capped' ? 'No pigment: five rewarded duels a day.' : '') + (reward.unlocked ? `<br>New medium: <b>${mediumDef(reward.unlocked).name}</b>` : '');
  reward = null;
  $('result').hidden = false;
  $('result').className = S.winner === 1 ? 'overlay win' : 'overlay';
  if (S.winner === 1) sfx.win();
  else sfx.lose();
  if (S.tutorial > 0) store.set('bid-duel-learned', '1');
}

function showScreen(id: 'title' | 'game' | 'dice'): void {
  screen = id;
  $('title').hidden = id !== 'title';
  $('game').hidden = id !== 'game';
  $('dice').hidden = id !== 'dice';
  $('draw').hidden = true;
  $('review').hidden = true;
  View.show(id === 'game');
  if (id === 'game') layout();
  if (id === 'title') {
    $('continue').hidden = !resumable;
    void updateBadge();
  }
  if (id === 'dice') openDice();
}
async function updateBadge(): Promise<void> {
  const t = await diceBadge();
  $('dice-badge').hidden = !t;
  $('dice-badge').textContent = t;
}
function layout(): void {
  const w = $('boardwrap');
  View.resize(w.clientWidth, w.clientHeight);
  // Kleckse beider Seiten schon nebenbei malen, bevor sie aufs Blatt kommen
  View.prewarm();
}
window.addEventListener('resize', () => {
  if (screen === 'game') layout();
});
// Das Menü unten wächst und schrumpft je nach Phase: das Blatt passt sich an
new ResizeObserver(() => {
  if (screen === 'game') layout();
}).observe($('boardwrap'));
function resetUi(): void {
  for (const id of ['result', 'menu', 'rules', 'inspect', 'tip', 'logview']) $(id).hidden = true;
  reward = null;
  drag = null;
  armed = null;
  aiming = null;
  reachHl = null;
  summonU = null;
  anchor = null;
  chosen = new Set();
}

async function startDuel(tutorial = false): Promise<void> {
  initAudio();
  resetUi();
  showScreen('game');
  View.reset();
  tasksDone.clear();
  S.teams = [] as unknown as typeof S.teams;
  busy = true;
  if (tutorial) {
    lessonsSeen = new Set();
    store.set('bid-duel-lessons', '');
  }
  showBanner(tutorial ? 'Lesson duel' : 'Paint duel', 'big');
  const ok = await request(api.duelStart(level, tutorial), () => layout());
  if (!ok) {
    showScreen('title');
    return;
  }
  resumable = true;
  renderAll();
  tipForPhase();
}
async function resumeDuel(): Promise<void> {
  initAudio();
  resetUi();
  busy = true;
  let res: DuelResponse;
  try {
    res = await api.duel();
  } catch (e) {
    busy = false;
    onError(e);
    return;
  }
  busy = false;
  if (!res.state) return void startDuel();
  loadState(res.state);
  renameUnits();
  showScreen('game');
  View.reset();
  R.sync();
  await playEvents(R.drain());
  layout();
  if (phase() === 'roll') chosen = defaultPick();
  renderAll();
  if (S.over) void finishDuel();
}

function setLevel(lv: Level): void {
  level = lv;
  store.set('bid-duel-level', lv);
  for (const p of ['t-', 'm-'])
    for (const l of ['apprentice', 'journeyman', 'master'] as Level[]) document.getElementById(p + 'lv-' + l)?.setAttribute('aria-pressed', String(l === lv));
}
for (const p of ['t-', 'm-'])
  for (const l of ['apprentice', 'journeyman', 'master'] as Level[])
    $(p + 'lv-' + l).addEventListener('click', () => {
      sfx.tap();
      const changed = l !== level;
      setLevel(l);
      if (p === 'm-' && changed) void startDuel();
    });
function soundLabel(): void {
  for (const id of ['sound-t', 'sound-m']) $(id).textContent = isMuted() ? 'Sound: off' : 'Sound: on';
  $('hints-m').textContent = hints ? 'Hints: on' : 'Hints: off';
}
$('hints-m').addEventListener('click', () => {
  hints = !hints;
  store.set('bid-duel-hints', hints ? '1' : '0');
  soundLabel();
  renderAll();
});
for (const id of ['sound-t', 'sound-m'])
  $(id).addEventListener('click', () => {
    initAudio();
    setMuted(!isMuted());
    store.set('bid-duel-muted', isMuted() ? '1' : '0');
    soundLabel();
    sfx.tap();
  });
$('start').addEventListener('click', () => void startDuel());
$('dice-t').addEventListener('click', () => {
  initAudio();
  sfx.tap();
  showScreen('dice');
});
let diceFrom: 'title' | 'game' = 'title';
$('dice-m').addEventListener('click', () => {
  $('menu').hidden = true;
  diceFrom = 'game';
  showScreen('dice');
});
initDice({
  back: () => {
    showScreen(diceFrom);
    diceFrom = 'title';
    renderAll();
  },
  error: onError,
});
$('learn').addEventListener('click', () => void startDuel(true));
$('continue').addEventListener('click', () => void resumeDuel());
$('how-t').addEventListener('click', () => ($('rules').hidden = false));
$('how-m').addEventListener('click', () => {
  $('menu').hidden = true;
  $('rules').hidden = false;
});
$('menu-btn').addEventListener('click', () => {
  sfx.tap();
  $('menu').hidden = false;
});
$('close-m').addEventListener('click', () => ($('menu').hidden = true));
$('new-m').addEventListener('click', () => void startDuel());
$('title-m').addEventListener('click', () => {
  $('menu').hidden = true;
  showScreen('title');
});
$('log-m').addEventListener('click', () => {
  const l = $('log-list');
  l.replaceChildren();
  for (const e of S.log.slice(0, 40)) l.append(el('li', e.c, e.t));
  $('menu').hidden = true;
  $('logview').hidden = false;
});
$('log-close').addEventListener('click', () => ($('logview').hidden = true));
$('rules-close').addEventListener('click', () => ($('rules').hidden = true));
$('inspect-close').addEventListener('click', () => ($('inspect').hidden = true));
$('inspect').addEventListener('click', (e) => {
  if (e.target === $('inspect')) $('inspect').hidden = true;
});
$('tip-ok').addEventListener('click', () => {
  sfx.tap();
  $('tip').hidden = true;
  lessonCheck();
});
$('again').addEventListener('click', () => void startDuel());
$('to-title').addEventListener('click', () => {
  $('result').hidden = true;
  resumable = false;
  showScreen('title');
});
$('login-btn').addEventListener('click', () => {
  try {
    showLoginPrompt();
  } catch {
    /* außerhalb von Reddit */
  }
});

/* Titelbild: zwei Kleckse stehen sich gegenüber */
function titleArt(): void {
  const [a, b] = R.titleBlots();
  const box = $('title-art');
  box.replaceChildren();
  for (const [m, cls] of [
    [a!, 'you'],
    [b!, 'rival'],
  ] as const) {
    const c = document.createElement('canvas');
    c.className = 'tblot ' + cls;
    c.width = c.height = 1;
    // Malt sich vor den Augen auf (nebenbei, in kleinen Schritten)
    void paintLater(c, { ...m, gen: 2 }, 140, { dpr: Math.min(2, window.devicePixelRatio || 1) }, 4);
    box.append(c);
  }
  box.append(el('span', 'vs', 'vs'));
}
setLevel(level);
soundLabel();
titleArt();
showScreen('title');
// Namen der Arten früh holen: Duell, Sammlung und Ziehen zeigen sie
void loadSpecies().then(() => {
  renameUnits();
  renderAll();
});
api
  .duel()
  .then((r) => {
    resumable = !!r.state && !r.state.over;
    if (screen === 'title') $('continue').hidden = !resumable;
  })
  .catch((e) => {
    if (e instanceof ApiError && e.code === 'login') showLogin();
    if (e instanceof ApiError && e.code === 'outdated') $('outdated').hidden = false;
  });

/* Nur für automatische Probeläufe */
(window as unknown as { __duel: unknown }).__duel = {
  state: () => S.teams.length < 2 ? { busy: true, phase: 'none', guide: {}, over: false } : ({
    phase: phase(),
    busy,
    armed: armed?.id ?? null,
    aiming: aiming?.id ?? null,
    round: S.round,
    over: S.over,
    winner: S.winner,
    turn: S.turn,
    crests: { ...S.teams[0]?.crests },
    hearts: S.teams.map((t) => t.hearts),
    summonable: phase() === 'summon' ? R.summonable(me(), lastRolled()).map((u) => u.id) : [],
    units: R.allUnits().map((u) => ({ id: u.id, side: u.side, x: u.x, y: u.y, hp: u.hp, name: u.name, acted: u.acted, brim: u.brim, abT: R.abilityTargets(u), abSelf: ABILITY[u.m.bp].target === 'self', splash: R.splashCells(u), canMove: R.canMove(u) })),
    place: summonU ? R.placements(summonU).slice(0, 1) : [],
    score: R.scores(),
    guide: guideNow,
  }),
  speed: (s: number) => (V.speed = s),
};
(window as unknown as { done: boolean }).done = true;
