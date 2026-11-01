/*
 * Farbschlacht in der Reddit-App: Titel, Duell auf einem Bildschirm, Ergebnis.
 * Der Server prüft und würfelt jede Aktion und schickt Ereignisse zurück, der Client spielt sie ab.
 * Regelabfragen (Reichweite, Chancen, Netze) laufen lokal auf dem Stand vom Server.
 */
import { statBlock } from './duel/statcard';
import './lib/fonts';
import './duel.css';
import { showLoginPrompt, showToast } from '@devvit/web/client';
import type { BleachResult, DuelResponse, DuelReward } from '../shared/api';
import { DROP_COST, rarityDef, serialText, TINT_MAX } from '../shared/dice';
import { bleachScore } from '../shared/duel/bleach';
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
import { makeCube, setCubeFace, tumble } from './duel/dice3d';
import { iconSvg, MUD_SVG, netSvg } from './duel/icons';
import { dropIcon, faceImage, faceTile, holoRim, lookOf } from './duel/faceskin';
import { elementBadge, elementIcon, elementText, ringSvg } from './duel/elements';
import { elementDef } from '../shared/elements';
import './duel/dieskin.css';
import { initAudio, isMuted, setMuted, sfx } from './duel/sound';
import { diceBadge, initDice, openDice } from './duel/collection';
import { foeTag, galleryLine, galleryStatus, initGallery, openGallery, setGalleryStatus } from './duel/gallery';
import { initColors, openColors } from './duel/colors';
import { colorDef } from '../shared/colors';
import { applyDiceResponse } from './duel/collection';
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
/** Bleach: Ergebnis des Tagesblatts (Punkte, Rang), kommt mit der letzten Aktion */
let bleachRes: BleachResult | null = null;
/** Aktionen gehen im Tagesblatt an Bleach, sonst ans Duell */
const act = (a: DuelAction) => (S.mode === 'bleach' ? api.bleachAct(a) : api.duelAct(a));
let busy = false;
let level: Level = (['apprentice', 'journeyman', 'master'] as Level[]).find((l) => l === store.get('bid-duel-level')) ?? 'apprentice';
let chosen = new Set<number>();
/** Nach dem Wurf: Würfel, die beim Neuwurf liegen bleiben */
let held = new Set<number>();
/** Deck über dem Brett aufgeklappt (zum Nachsehen außerhalb der Würfelwahl) */
let deckOpen = false;
/** Die 3D-Würfel auf der Bühne, vom Wurf bis der Wurf gilt */
const stageDice = new Map<number, StageDie>();
/** Sepias Aufträge, die in diesem Duell schon erfüllt sind (Runde:Seite) */
const tasksDone = new Set<string>();
let summonU: Unit | null = null,
  orient = 0,
  anchor: number | null = null;
/** Ziehen vom Klecks: wohin der Finger zeigt, was dort passieren würde, und die Vorschau dazu */
type Preview = { path: number[]; cells: { i: number; col: string; pct: number | null }[]; target: number | null; pct: number | null; text: string; kill?: boolean };
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
  if (res.bleach) bleachRes = res.bleach;
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
  ready: (id) => S.turn === 1 && phase() === 'act' && !busy && !S.over && !R.unitById(id)?.acted,
  selected: () => (phase() === 'act' ? (drag?.u.id ?? armed?.id ?? aiming?.id ?? null) : null),
  hud: () => {
    renderTop();
    renderPool();
    renderStatus();
  },
  banner: (text, kind) => {
    showBanner(kind === 'turn' && text === 'Rival turn' && S.foeName ? `${foeTag(S.foeName)}'s deck plays` : text, kind);
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
type StageDie = { cube: HTMLElement; box: HTMLElement; fi: number; mud?: boolean };
function stageDie(id: number, size: number): StageDie {
  const u = R.unitById(id)!;
  const box = el('div', 'stage-die');
  box.dataset.id = String(id);
  // Würfel-Haut (01.11.2026): Farbe mit Kürzel, Stil des Monsters, Holo-Folie
  const lk = lookOf(u.m);
  const cube = makeCube(u.faces, size, rgb(u.m.main), { skin: lk.skin, holo: lk.holo, tint: lk.tint });
  box.append(cube, el('small', '', u.name.split(' ')[1] ?? u.name));
  box.addEventListener('click', () => toggleHold(id));
  const x: StageDie = { cube, box, fi: -1 };
  stageDice.set(id, x);
  return x;
}
/** Die Seite, wie sie auf der Bühne liegt, dazu Schlamm */
function stageFace(id: number): { face: Face; mud?: boolean } | null {
  const d = stageDice.get(id);
  const f = d && d.fi >= 0 ? R.unitById(id)?.faces[d.fi] : null;
  if (!d || !f) return null;
  return { face: f, ...(d.mud ? { mud: true } : {}) };
}
/** Der Wurf auf der Bühne (in Reihenfolge), für Kombi und Auftrag während des Abspielens */
const stageRoll = (): { face: Face; mud?: boolean }[] => [...stageDice.keys()].map(stageFace).filter((x): x is { face: Face; mud?: boolean } => !!x);
/** Eine liegende Seite wird Schlamm (nasser Neuwurf) */
function mudDie(id: number): void {
  const d = stageDice.get(id);
  const sf = stageFace(id);
  if (!d || !sf) return;
  d.mud = true;
  setCubeFace(d.cube, d.fi, sf.face, true);
  d.box.classList.add('mud');
  d.box.querySelector('small')!.textContent = 'mud';
  void d.box.offsetWidth;
  d.box.classList.add('muddy');
}
function openStage(label: string): HTMLElement {
  const stage = $('stage');
  stage.replaceChildren();
  stage.classList.remove('wet');
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
  // Neu geworfen: wieder die Farbe der Seite
  if (d.fi >= 0 && d.mud) setCubeFace(d.cube, d.fi, R.unitById(id)!.faces[d.fi]!, false);
  d.fi = fi;
  d.mud = false;
  d.box.classList.remove('mud', 'muddy');
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
  const met = R.taskMet(t, R.liveFaces(stageDice.size ? stageRoll() : lastRolled()));
  line.textContent = `${side === 2 ? 'Rival task' : 'Sepia’s task'}: ${t.text}${met ? ' ✓' : ''}`;
  line.classList.toggle('met', met);
}
/** Was der Wurf gerade ergeben würde */
function comboPreview(): void {
  const line = document.querySelector('#stage .stage-combo') as HTMLElement | null;
  if (!line) return;
  const c = R.comboOf(stageDice.size ? stageRoll() : lastRolled());
  line.textContent = c ? c.text : phase() === 'keep' && S.turn === 1 ? 'No combo yet' : '';
  line.classList.toggle('has', !!c);
  for (const k of ['pure', 'glaze', 'stars']) line.classList.toggle(`k-${k}`, c?.kind === k);
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
  // Nasses Blatt: die Bühne glänzt feucht, je nasser, desto mehr
  const stage = $('stage');
  stage.style.setProperty('--wet', String(e.wet ?? 0));
  stage.classList.toggle('wet', !!e.wet);
  await Promise.all(list.map((y, k) => tumble(y.x!.cube, y.d.fi, (k * 110) / V.speed, 900 / V.speed, (k - 1) * 60)));
  for (const y of list) landDie(y.d.id, y.d.fi);
  // Nässe (Kampf A): ein Würfel ist im Wasser zu Schlamm geworden, er zählt in diesem Wurf nichts
  if (e.mud !== undefined) {
    await View.wait(220);
    mudDie(e.mud);
    sfx.dieBleed(true);
    stageNote('Too wet: a die turned to mud', 'mud');
    await View.wait(620);
  }
  taskPreview(e.side);
  if (e.side === 1) comboPreview();
  await View.wait(e.side === 1 ? 250 : 380);
}
/** Kurzer Satz über den Würfeln (Schlamm) */
function stageNote(text: string, cls: string): void {
  const n = document.querySelector('#stage .stage-note') ?? el('p', 'stage-note', '');
  if (!n.parentElement) document.querySelector('#stage .stage-lbl')?.after(n);
  n.textContent = text;
  n.className = `stage-note ${cls}`;
}
async function playApply(e: Extract<Ev, { k: 'apply' }>): Promise<void> {
  const stage = $('stage');
  stage.classList.remove('pick');
  for (const x of stageDice.values()) x.box.classList.remove('held');
  const line = stage.querySelector('.stage-combo') as HTMLElement | null;
  if (e.combo && line) {
    const c = e.combo;
    // Banner mit Kombi, Farbe und Multiplikator (Kampf A, sichtbare Rechnung)
    line.replaceChildren(comboBadge(c));
    line.classList.add('has', 'pop', `k-${c.kind}`);
    const ids = [...stageDice.keys()];
    for (const i of c.at) stageDice.get(ids[i]!)?.box.classList.add('combo');
    sfx.combo(c.kind);
    await View.wait(c.kind === 'glaze' ? 750 : 950);
    if (c.mult > 1) showBanner(`${R.COMBO_NAME[c.kind].toUpperCase()} ×${c.mult}`, 'combo');
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
  // Sterne, die nicht beschwören können, sagen warum (festgelegt am 31.10.2026): fehlende Sterne, kein Platz, Blatt voll
  if (e.side === 1 && S.turn === 1) {
    let pause = false;
    for (const r of lastRolled()) {
      const w = R.summonWhy(me(), lastRolled(), r);
      const d = stageDice.get(r.u.id);
      if (!w || !d) continue;
      d.box.append(el('em', 'why', R.whyText(w)));
      // Ein volles Blatt kennt man schon, dafür nicht extra warten
      if (w.k !== 'full') pause = true;
    }
    if (pause) await View.wait(900);
  }
  // Symbole fliegen in den Vorrat: von den Würfelseiten, dazu der Gewinn der Kombi
  const flights: [HTMLElement, Face][] = [];
  for (const [id, x] of stageDice) {
    const sf = stageFace(id);
    if (!sf || sf.mud) continue;
    const f = sf.face;
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
  stage.classList.remove('wet');
  stageDice.clear();
}
/** Kombi als Banner: Name, Farbe, Multiplikator */
function comboBadge(c: R.Combo): HTMLElement {
  const b = el('span', `cbadge k-${c.kind}`);
  const dot = (p: PigmentId) => `<i style="background:${rgb(p)}"></i>`;
  const pigs = c.pig ? [c.pig] : [];
  const x = c.mult > 1 ? `<em>×${c.mult}</em>` : '';
  const rest = c.joker ? 'and a Joker' : '';
  b.innerHTML = `<b>${R.COMBO_NAME[c.kind]}</b>${pigs.map(dot).join('')}${x}${rest ? `<small>${rest}${c.gain && Object.keys(c.gain).length ? ' · +1' : ''}</small>` : ''}`;
  return b;
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
    if (r.mud) mudDie(r.id);
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
      ['Glaze ×1.5', '2 sides of one colour'],
      ['Pure ×2', '3 of one colour, and a Joker'],
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
function showBanner(text: string, kind: 'turn' | 'round' | 'ability' | 'big' | 'combo'): void {
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

/* ---------- Symbol-Hilfe (01.11.2026): Antippen erklärt, was ein Symbol tut und was es gerade bewirkt ---------- */
type Explain = { icon: string; title: string; text: string; now?: string; fx: string; cells?: number[]; col?: string; side?: Side };
let explainT = 0,
  explainFrom: Element | null = null;
function hideExplain(): void {
  const b = document.getElementById('explain');
  if (b) b.className = '';
  explainFrom = null;
}
function explain(anchor: HTMLElement, x: Explain): void {
  let b = document.getElementById('explain');
  if (!b) {
    b = el('div');
    b.id = 'explain';
    b.setAttribute('role', 'dialog');
    document.body.append(b);
    b.addEventListener('click', hideExplain);
  }
  // Noch einmal dasselbe antippen schließt die Karte
  if (explainFrom === anchor && b.classList.contains('show')) return hideExplain();
  sfx.tap();
  explainFrom = anchor;
  b.innerHTML = `<div class="ex-ic">${x.icon}</div><div class="ex-t"><b>${x.title}</b><p>${x.text}</p>${x.now ? `<p class="now">${x.now}</p>` : ''}</div>`;
  b.className = `show fx-${x.fx}${x.side === 2 ? ' rival' : ''}`;
  // Neben dem Symbol: darunter, wenn es oben liegt, sonst darüber
  const r = anchor.getBoundingClientRect();
  const vw = window.innerWidth,
    vh = window.innerHeight;
  const w = Math.min(320, vw - 24);
  b.style.width = `${w}px`;
  b.style.left = `${Math.max(12, Math.min(vw - w - 12, r.left + r.width / 2 - w / 2))}px`;
  b.style.setProperty('--ax', `${Math.max(16, Math.min(w - 16, r.left + r.width / 2 - Math.max(12, Math.min(vw - w - 12, r.left + r.width / 2 - w / 2))))}px`);
  if (r.top > vh / 2) {
    b.style.top = '';
    b.style.bottom = `${vh - r.top + 10}px`;
    b.classList.add('up');
  } else {
    b.style.bottom = '';
    b.style.top = `${r.bottom + 10}px`;
  }
  // Auf dem Blatt zeigen, worauf es wirkt
  if (x.cells?.length) View.pulse(x.cells, x.col ?? 'rgba(201,150,30,.95)');
  window.clearTimeout(explainT);
  explainT = window.setTimeout(hideExplain, 7000);
}
// Woanders hintippen schließt die Karte
document.addEventListener(
  'pointerdown',
  (e) => {
    const b = document.getElementById('explain');
    if (!b?.classList.contains('show')) return;
    const t = e.target as Node;
    if (b.contains(t) || explainFrom?.contains(t)) return;
    hideExplain();
  },
  true,
);
const cellOf = (u: Unit) => R.idx(u.x, u.y);
const homeCell = (sd: Side) => S.teams[sd - 1]!.home;
/** Was ein Symbol im Vorrat tut, und was es gerade bewirkt */
function crestExplain(k: R.Crest, sd: Side = 1): Explain {
  const t = S.teams[sd - 1]!;
  const n = t.crests[k];
  const who = sd === 1 ? 'You hold' : 'The rival holds';
  const mine = R.onSheet(t);
  const icon = iconSvg({ k, n: 1 }, 46);
  switch (k) {
    case 'step':
      return {
        icon,
        fx: 'step',
        title: 'Step',
        text: 'A blot may walk two cells further. It is only spent when a move needs the extra reach.',
        now: n ? `${who} ${n}: ${n === 1 ? 'one longer walk' : `${n} longer walks`}.` : `${who} none. Roll Step faces to get some.`,
        cells: mine.map(cellOf),
        side: sd,
      };
    case 'splash': {
      const foe = sd === 1 ? 2 : 1;
      const guarded = R.homeGuarded(S.teams[foe - 1]!);
      return {
        icon,
        fx: 'splash',
        title: 'Splash',
        text: 'Breaks one heart of the other palette: drag a blot next to it. At most one heart per turn, and a palette is safe while one of its own blots stands within two cells. Splashing blots is free.',
        now: `${who} ${n}. ${sd === 1 ? 'Their' : 'Your'} palette is ${guarded ? 'guarded right now' : 'open'}.`,
        cells: [homeCell(foe)],
        col: 'rgba(196,52,52,.95)',
        side: sd,
      };
    }
    case 'guard':
      return {
        icon,
        fx: 'guard',
        title: 'Guard',
        text: 'Halves the next hit on any of your blots, all by itself. One Guard per hit.',
        now: n ? `${who} ${n}: the next ${n === 1 ? 'hit is' : `${n} hits are`} halved.` : `${who} none: hits land in full.`,
        cells: mine.map(cellOf),
        col: 'rgba(95,100,116,.95)',
        side: sd,
      };
    case 'glow': {
      const brims = mine.map((u) => `${u.name.split(' ')[1] ?? u.name} ${u.brim}/${R.BRIM.max}`).join(', ');
      return {
        icon,
        fx: 'glow',
        title: 'Glow',
        text: 'Pours into every blot of yours on the sheet the moment you roll it: one brim each. A full brim makes the next fitting move a master stroke.',
        now: n ? `${n} waiting for a blot on the sheet.` : brims ? `Brim now: ${brims}.` : 'No blot on the sheet yet.',
        cells: mine.map(cellOf),
        col: 'rgba(201,150,30,.95)',
        side: sd,
      };
    }
  }
}
function heartsExplain(sd: Side): Explain {
  const t = S.teams[sd - 1]!;
  const guarded = R.homeGuarded(t);
  return {
    icon: '<span class="ex-heart">♥</span>',
    fx: 'heart',
    title: sd === 1 ? 'Your palette' : 'Rival palette',
    text: `Three hearts each. A Splash next to an unguarded palette breaks one, at most one per turn. No hearts left and the duel is lost. Every heart left counts ${R.HEART_BONUS} cells when the paper dries.`,
    now: `${t.hearts} ${t.hearts === 1 ? 'heart' : 'hearts'} left. ${guarded ? 'Guarded: one of its blots stands within two cells.' : sd === 1 ? 'Open: keep a blot within two cells.' : 'Open: a blot of yours next to it can splash it.'}`,
    cells: [t.home],
    col: sd === 1 ? 'rgba(43,63,163,.95)' : 'rgba(196,52,52,.95)',
    side: sd,
  };
}
function scoreExplain(): Explain {
  const [a, b] = R.counts(V.cells);
  return {
    icon: '<span class="ex-score">▦</span>',
    fx: 'score',
    title: 'When the paper dries',
    text: `After round ${ROUNDS} the paper dries. Every cell of your paint counts one, a glazed cell two, and every heart left ${R.HEART_BONUS}. Or break all three hearts of their palette before that.`,
    now: `Now: you ${a + R.HEART_BONUS * S.teams[0].hearts} (${a} paper + ${R.HEART_BONUS * S.teams[0].hearts} hearts), rival ${b + R.HEART_BONUS * S.teams[1].hearts} (${b} + ${R.HEART_BONUS * S.teams[1].hearts}).`,
  };
}
function elementExplain(u: Unit): Explain {
  const ed = elementDef(u.el);
  const foes = R.onSheet(S.teams[u.side === 1 ? 1 : 0]);
  const good = foes.filter((f) => R.elemMult(u, f) > 1);
  return {
    icon: ringSvg(54, u.el),
    fx: 'ring',
    title: `${ed.name}, element of ${u.name}`,
    text: `Six elements stand in a ring. Each hits the next one twice as hard and the one after a little harder. ${ed.name} ${elementText(u.el)}`,
    now: good.length ? `Good targets on the sheet: ${good.map((f) => `${f.name} ×${R.elemMult(u, f)}`).join(', ')}.` : 'No rival blot on the sheet it beats right now.',
    cells: good.map(cellOf),
    col: ed.col,
    side: u.side,
  };
}
function jokerExplain(): Explain {
  return {
    icon: iconSvg({ k: 'joker', n: 3 }, 46),
    fx: 'joker',
    title: 'Joker',
    text: 'Counts as a star of level 3 to unfold a blot, or turn it into any symbol you like. In a roll it also counts as any colour.',
    now: `You hold ${S.joker}.`,
  };
}

/* ---------- Hinweise von Meisterin Sepia ---------- */
/** Tipps im normalen Duell: aus, seit Sepia nur im Lern-Duell erklärt. Texte bleiben für später */
const SHOW_TIPS = false;
const TIPS: Record<string, string> = {
  opening: 'Every blot is a die. I put your best one by your palette already. Tap the net to unfold it, or tap a blue dot to move it first.',
  roll: 'Pick three dice from your deck and roll. Rolled dice are used up until the deck is shuffled. Symbols go to your pool and keep, stars bring new blots onto the sheet.',
  keep: 'Your roll lies open. Same colours pay: two faces of one colour are a Glaze, three are Pure. Hold what matches and reroll the rest. The first reroll is dry, later ones may turn a die to mud.',
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
  ['keep', () => phase() === 'keep', 'The roll lies open. Every face carries a colour, its blot’s pigment, and the two letters name it. Same colours pay: two of one colour make a Glaze, three are Pure. Hold what matches and reroll the rest. I marked what I would hold.'],
  ['mud', () => phase() === 'keep' && S.lastRoll.some((r) => r.mud), 'Mud. That is the water I warned you about: the muddy die counts nothing until it is rerolled. Sometimes the wiser brush stops early.'],
  ['wet', () => phase() === 'keep' && R.rerollsDone() >= 1 && S.rerolls > 0, 'That reroll was dry. The next ones are wet: each may turn one die to mud, held ones too, and mud counts nothing. The drops on the button show the chance. Knowing when to stop is half of painting.'],
  ['crests', () => (phase() === 'summon' || phase() === 'act') && S.round === 1, 'Symbols go into your pool and stay. Step lets a blot walk further, Splash hits a palette, Guard halves a hit by itself, Glow pours into your blots and fills their brim. I lent you two Glow.'],
  ['glaze', () => (phase() === 'summon' || phase() === 'act') && S.turn === 1 && !!S.combo && (S.combo.kind === 'glaze' || S.combo.kind === 'pure'), 'A Glaze. Until your turn ends, every splash on a rival blot hits half again as hard, the number up top says so. Three faces of one colour would be Pure: twice as hard, and a Joker.'],
  ['summon', () => phase() === 'summon', 'Stars bring blots out. A die may unfold if the other dice show stars worth at least its level. This one qualifies, and the net is already placed.'],
  ['drag', () => phase() === 'act' && !!tutGo() && (tutGo()!.a === 'stamp' || tutGo()!.a === 'splash'), 'Now the fun part. Drag a blot along the gold arrow and let go. Paper means stamp, a rival means splash. One drag per blot, the turn ends by itself.'],
  ['palette', () => { const a = tutGo(); return a?.a === 'splash' && a.at === S.teams[1].home; }, 'Their palette is unguarded. One Splash symbol, one heart, one per turn. A palette is safe while one of its own blots stands within two cells.'],
  ['stamp', () => tutGo()?.a === 'stamp', 'A stamp paints the blot’s shape in wet paint. Over dried paint it needs a roll: your Opacity against their Grain. Wet paint bleeds into free paper when the round ends.'],
  ['mult', () => { const a = tutGo(); return a?.a === 'splash' && a.at !== S.teams[1].home && R.turnMult(1) > 1; }, 'Your Glaze still holds. Splash this one and watch the sum: the hit times one and a half, and its element on top if it beats the target.'],
  ['splash', () => tutGo()?.a === 'splash', 'Splash hits a rival in reach: Saturation and a d20 against Grain and a d20. A hit paints the cell under the target. Two or three hits and a blot bursts.'],
  ['elem', () => { const a = tutGo(); if (a?.a !== 'splash' || a.at === S.teams[1].home) return false; const t = R.unitAt(a.at! % COLS, Math.floor(a.at! / COLS)); const u = R.unitById(a.id); return !!t && !!u; }, 'Every blot carries an element: Wash, Vermilion, Gilt, Sap, Ochre or Fluoro, the small badge by its feet. They stand in a ring. Each hits the next one twice as hard and the one after a little harder. Tap a badge on a card to see the ring.'],
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
      s.setAttribute('role', 'button');
      // Antippen erklärt das Symbol (Symbol-Hilfe)
      s.addEventListener('click', () => explain(s, crestExplain(c.k, side)));
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
  const ts = V.turn || S.turn;
  // Multiplikator des Zugs (Kampf A): steht bis zum Zugende bei der Seite am Zug
  const xm = S.combo && S.combo.mult > 1 && ts === S.turn ? { x: R.turnMult(ts), kind: S.combo.kind } : null;
  const key = JSON.stringify([S.teams.map((t) => t.media ?? []), R.setBonus(1), R.setBonus(2), cell, V.round, ts, tasksDone.size, xm]);
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
      b.addEventListener('click', () => explain(b, { icon: bottleSvg(m.col, 46), fx: 'bottle', title: `${sd === 2 ? 'Rival: ' : ''}${m.name}`, text: m.text, now: sd === 1 ? 'Yours until the paper dries.' : 'The rival’s until the paper dries.', side: sd }));
      g.append(b);
    }
    if (xm && sd === ts) {
      const b = html('button', `st-mult s${sd} k-${xm.kind}`, `×${+xm.x.toFixed(2)}`) as HTMLButtonElement;
      b.type = 'button';
      b.addEventListener('click', () =>
        explain(b, {
          icon: `<span class="ex-mult">×${+xm.x.toFixed(2)}</span>`,
          fx: 'mult',
          title: `${sd === 2 ? 'Rival ' : ''}${R.COMBO_NAME[xm.kind]}`,
          text: xm.kind === 'pure' ? 'Three faces of one colour: every splash on a rival blot this turn hits twice as hard.' : 'Two faces of one colour: every splash on a rival blot this turn hits half again as hard.',
          now: `×${+xm.x.toFixed(2)} until the turn ends. Palette hits stay one heart.`,
          cells: R.onSheet(S.teams[sd === 1 ? 1 : 0]).map(cellOf),
          col: 'rgba(106,61,143,.95)',
          side: sd,
        }),
      );
      g.append(b);
    }
    const sb = R.setBonus(sd);
    if (sb) {
      const t = R.FAMILY_TEXT[sb.fam][sb.n >= 3 ? 1 : 0];
      const b = html('button', `st-set f-${sb.fam}`, `<span class="fam">${sb.fam} </span>×${sb.n}`) as HTMLButtonElement;
      b.type = 'button';
      b.addEventListener('click', () =>
        explain(b, {
          icon: `<span class="ex-fam f-${sb.fam}">${sb.fam}</span>`,
          fx: 'set',
          title: `${sd === 2 ? 'Rival ' : ''}${sb.fam} family ×${sb.n}`,
          text: `${sb.n} blots of the ${sb.fam} colours on the sheet work together: ${t}.`,
          now: sb.n >= 3 ? 'Full set: the stronger bonus.' : 'A third one would make it stronger.',
          cells: R.onSheet(S.teams[sd - 1]!).filter((u) => R.FAMILY[u.m.main] === sb.fam).map(cellOf),
          side: sd,
        }),
      );
      g.append(b);
    }
    return g;
  };
  // Sepias Auftrag dieser Runde: der Seite, die am Zug ist
  const task = R.taskOf(ts, V.round);
  if (task) {
    const done = tasksDone.has(`${V.round}:${ts}`);
    const b = html('button', `st-task s${ts}${done ? ' done' : ''}`, `<span class="pre">${ts === 2 ? 'Rival: ' : '✦ '}</span>${task.text}${done ? ' ✓' : ''}`) as HTMLButtonElement;
    b.type = 'button';
    b.addEventListener('click', () =>
      explain(b, {
        icon: iconSvg({ k: 'joker', n: 3 }, 46),
        fx: 'task',
        title: ts === 2 ? 'Rival’s task' : 'Master Sepia’s task',
        text: `This round: roll ${task.text}. Jokers count. If the final roll shows it, ${ts === 2 ? 'the rival gets' : 'you get'} a Joker.`,
        now: done ? 'Done this round.' : 'Not done yet.',
        side: ts,
      }),
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
  const bleach = S.mode === 'bleach';
  $('score-you').textContent = String(bleach ? bleachScore().total : a + R.HEART_BONUS * V.teams[0]!.hearts);
  // Bleach (Schritt 1, schlicht): rechts die Pales, die noch kommen oder auf dem Blatt stehen
  $('score-rival').textContent = String(bleach ? S.teams[1].units.filter((u) => u.state !== 'gone').length : b + R.HEART_BONUS * V.teams[1]!.hearts);
  $('rival-name').textContent = bleach ? 'Pales' : S.foeName ? foeTag(S.foeName) : 'Rival';
  // Entwurf Übersicht: beide Siegwege unter dem Stand, Herzen bei der jeweiligen Seite
  if (View.LOOK2) {
    let g = document.getElementById('goal');
    if (!g) {
      g = el('div', 'goal');
      g.id = 'goal';
      document.querySelector('#game .top')!.after(g);
    }
    g.innerHTML = bleach
      ? `<span class="w">Hold the edge: a Pale that slips off the bottom <b>bleaches a heart</b></span>`
      : `<span class="w">Win: <b>more paper</b> when it dries, or <b>break their 3 hearts</b></span>`;
  }
  const tot = COLS * R.ROWS - 2;
  $('bar-you').style.width = (a / tot) * 100 + '%';
  $('bar-mud').style.width = (m / tot) * 100 + '%';
  $('bar-rival').style.width = (b / tot) * 100 + '%';
  const last = S.bleach ? S.bleach.waves.length : ROUNDS;
  $('round').textContent = S.over ? 'Done' : bleach ? `Wave ${Math.min(V.round, last)}/${last}` : `Round ${Math.min(V.round, ROUNDS)}/${ROUNDS}`;
  const left = last - V.round + 1;
  $('dries').textContent = S.over ? S.winReason : !bleach && R.ERASER_ROUNDS.includes(V.round) ? 'Eraser next' : left <= 1 ? 'last wave' : `dries in ${left}`;
  hearts($('rival-hearts'), V.teams[1]!.hearts);
  const rd = $('rival-dice');
  rd.replaceChildren();
  for (const u of S.teams[1].units) {
    const v = V.units.get(u.id);
    const st = v?.state ?? 'bag';
    const b2 = el('button', `rd st-${st} r-${u.rarity}` + (st === 'bag' && (v?.used ?? u.used) ? ' used' : '') + (S.foeDice[S.teams[1].units.indexOf(u)]?.drift !== undefined ? ' drift' : '')) as HTMLButtonElement;
    b2.type = 'button';
    b2.style.setProperty('--c', rarityDef(u.rarity).col);
    b2.title = u.name;
    b2.append(portraitEl(u.id, 26, st === 'gone' ? 0.3 : 1), html('span', 'lvb', iconSvg({ k: 'star', n: u.lv }, 12)), html('span', 'elc', elementIcon(u.el, 12)));
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
  b.append(portraitEl(u.id, 34, st === 'gone' ? 0.3 : 1), html('span', 'lvb', iconSvg({ k: 'star', n: u.lv }, 15)), html('span', 'elc', elementIcon(u.el, 14)), el('span', 'st', used ? 'used' : st === 'bag' ? 'ready' : st === 'sheet' ? 'on sheet' : 'lost'));
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
        void request(act({ k: 'medium', id })).then((ok) => ok && afterAction());
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
      // Ein Stern, der nicht beschwören kann, sagt, warum (festgelegt am 31.10.2026)
      const why = ok ? null : R.summonWhy(me(), lastRolled(), r);
      b.append(html('span', 'rf', r.mud ? `<svg width="26" height="26" viewBox="0 0 20 20" aria-hidden="true">${MUD_SVG}</svg>` : faceTile(r.face, lookOf(r.u.m), 28)), portraitEl(r.u.id, 22), el('small', why ? 'why' : '', why ? R.whyText(why) : r.mud ? 'mud' : R.faceText(r.face)));
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
  const jl = html('span', 'jlbl', `${iconSvg({ k: 'joker', n: 3 }, 18)} Joker${S.joker > 1 ? ` ×${S.joker}` : ''}${p === 'summon' ? ': summon with it, or take' : ': take'}`);
  jl.addEventListener('click', () => explain(jl, jokerExplain()));
  box.replaceChildren(jl);
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
      void request(act({ k: 'joker', crest: c.k }));
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
      go.textContent = 'Unfold';
      go.disabled = !(anchor !== null && R.netPlace(summonU, orient, anchor));
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
    // Nässe (Kampf A): Tropfen und Chance je Nachbarpaar für den nächsten Neuwurf
    const wet = R.wetChance(1);
    aux.innerHTML = `${n ? `Reroll ${n}` : 'Reroll'}<small class="wetc${wet ? ' on' : ''}">${S.rerolls < 1 ? 'none left' : wet ? `${'●'.repeat(Math.round(wet * 4))} ${Math.round(wet * 100)}% mud` : '○ dry'}</small>`;
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
  const pv: Preview = { path, cells: [], target: null, pct: null, text: '', kill: false };
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
    const [pig, pct, dmg, kill] = R.atSpot(u, p.to, () => {
      const g = R.bestPig(u, 'splash', p.at);
      return [g, Math.round(R.splashOdds(u, t, g) * 100), R.baseDamage(u, t, g, R.cheb(u.x, u.y, t.x, t.y) <= 1), R.splashLethal(u, t, g)] as const;
    });
    pv.pct = pct;
    // G4: reicht der Treffer, steht am Ziel WASH OUT
    pv.kill = kill;
    // Kampf A und Elemente: die Multiplikatoren stehen in der Rechnung
    const x = R.turnMult(1),
      em = R.elemMult(u, t);
    const fs = [em, x].filter((v) => v !== 1).map((v) => ` ×${v}`).join('');
    const xs = fs ? ` (${R.atSpot(u, p.to, () => R.baseDamage(u, t, pig, R.cheb(u.x, u.y, t.x, t.y) <= 1, 1, 1))}${fs})` : '';
    pv.text = `${p.to !== here ? 'Walk and splash' : 'Splash'} ${t.name}: ${pct}% full hit (else a graze), -${dmg}${xs}${GAIT[u.m.bp].key === 'twin' ? ' twice' : ''}, ${R.elemWord(u, t)}${S.teams[1].crests.guard ? '. They hold a Guard' : ''}.${kill ? ' A hit washes it out!' : ''}`;
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
  if (p === 'keep') return setHint(`Same colours pay. Hold dice, reroll the rest (${S.rerolls} left): the first is dry, later ones may turn a die to mud. Or keep.`);
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
/** Spielfarben aus dem Duell-Stand: Blatt, Aufkleber und die Farben oben (--you, --rival) */
function applyColors(): void {
  const [a, b] = S.colors.map((k) => colorDef(k).rgb);
  View.setTeamColors(a!, b!);
  const g = $('game');
  g.style.setProperty('--you', `rgb(${a!.join(',')})`);
  g.style.setProperty('--rival', `rgb(${b!.join(',')})`);
}
function renderAll(): void {
  if (screen !== 'game' || !S.teams.length) return;
  applyColors();
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
/** Eine Seite in der Haut ihres Würfels (lädt nach und malt dann neu) */
const faceImg = (u: Unit, f: Face): HTMLImageElement => faceImage(f, lookOf(u.m));
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
      if (at !== anchor && R.netPlace(u, orient, at)) dot(at, 'rgba(43,63,163,.5)', 0.1);
    }
    if (anchor !== null) {
      const list = R.netAt(u, orient, anchor);
      if (list) {
        // Ganz oder überstehend: gemalte Felder gefüllt, überstehende Seiten nur gestrichelt und blass (sie tropfen ab)
        const pl = R.netPlace(u, orient, anchor);
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 2.5;
        list.forEach((i, k) => {
          const x = (i % COLS) * cell,
            y = Math.floor(i / COLS) * cell;
          const over = !!pl && pl.over.includes(i);
          if (over) {
            // Übersteht: nur gestrichelter Rand und eine blasse Seite mit Tropfen darunter, gemalt wird hier nichts
            ctx.strokeStyle = 'rgba(255,255,255,.95)';
            ctx.lineWidth = 4;
            ctx.strokeRect(x + 5, y + 5, cell - 10, cell - 10);
            ctx.strokeStyle = 'rgba(43,63,163,.9)';
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 5, y + 5, cell - 10, cell - 10);
            ctx.lineWidth = 2.5;
            ctx.globalAlpha = 0.4;
            const img = faceImg(u, u.faces[k]!);
            if (img.complete) ctx.drawImage(img, x + cell * 0.32, y + cell * 0.26, cell * 0.36, cell * 0.36);
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = `rgb(${PIG[u.m.main].rgb})`;
            ctx.beginPath();
            ctx.moveTo(x + cell * 0.5, y + cell * 0.66);
            ctx.quadraticCurveTo(x + cell * 0.58, y + cell * 0.78, x + cell * 0.5, y + cell * 0.82);
            ctx.quadraticCurveTo(x + cell * 0.42, y + cell * 0.78, x + cell * 0.5, y + cell * 0.66);
            ctx.fill();
            ctx.globalAlpha = 1;
            return;
          }
          ctx.fillStyle = !pl ? 'rgba(163,58,58,.18)' : `rgba(${PIG[u.m.main].rgb},.3)`;
          ctx.strokeStyle = pl ? 'rgba(43,63,163,.95)' : 'rgba(163,58,58,.9)';
          ctx.fillRect(x + 3, y + 3, cell - 6, cell - 6);
          ctx.strokeRect(x + 3, y + 3, cell - 6, cell - 6);
          // Die Seite in ihrer Haut, gut lesbar auf dem Feld
          const img = faceImg(u, u.faces[k]!);
          if (img.complete) ctx.drawImage(img, x + cell * 0.2, y + cell * 0.2, cell * 0.6, cell * 0.6);
          if (u.m.holo) holoRim(ctx, x + cell * 0.2, y + cell * 0.2, cell * 0.6, cell * 0.1, performance.now());
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
      // Der Treffer reicht: groß und pulsierend
      if (pv.kill) {
        const pulse = 1 + 0.06 * Math.sin(performance.now() / 110);
        ctx.save();
        ctx.translate(cx(pv.target), cy(pv.target) - cell * 0.95);
        ctx.scale(pulse, pulse);
        label(0, 0, 'WASH OUT', '#8e1f1f', 15);
        ctx.restore();
      }
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
    const list = R.netPlace(u, orient, at)?.list;
    if (!list) continue;
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
    const pl = anchor !== null ? R.netPlace(summonU!, orient, anchor) : null;
    if (pl && (pl.list.includes(i) || pl.over.includes(i))) return void unfold();
    for (let k = 0; k < 8; k++) {
      const o = (orient + k) % 8;
      if (R.netPlace(summonU!, o, i)) {
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
  if (await request(act({ k: 'go', id: u.id, to: p.to, a: p.a, at: p.at }))) afterAction();
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
  if (!R.netPlace(summonU, orient, anchor)) return;
  const a: DuelAction = { k: phase() === 'opening' ? 'open' : 'summon', id: summonU.id, o: orient, at: anchor };
  summonU = null;
  anchor = null;
  if (await request(act(a))) afterAction();
}
async function doRoll(): Promise<void> {
  if (!myTurn() || phase() !== 'roll' || chosen.size !== need()) return;
  const ids = [...chosen];
  chosen = new Set();
  if (await request(act({ k: 'roll', ids }))) afterAction();
}
async function doKeep(): Promise<void> {
  if (!myTurn() || phase() !== 'keep') return;
  sfx.tap();
  if (await request(act({ k: 'keep' }))) afterAction();
}
async function doReroll(): Promise<void> {
  if (!myTurn() || phase() !== 'keep' || S.rerolls < 1) return;
  const hold = [...held].filter((id) => S.lastRoll.some((r) => r.id === id));
  if (hold.length >= S.lastRoll.length) return;
  sfx.tap();
  if (await request(act({ k: 'reroll', hold }))) afterAction();
}
async function endTurn(): Promise<void> {
  if (!myTurn() || (phase() !== 'act' && phase() !== 'summon')) return;
  summonU = null;
  anchor = null;
  if (await request(act({ k: 'end' }))) afterAction();
}
async function autoTurn(): Promise<void> {
  if (!myTurn() || (phase() !== 'act' && phase() !== 'summon')) return;
  summonU = null;
  anchor = null;
  if (await request(act({ k: 'auto' }))) afterAction();
}
async function skipSummon(): Promise<void> {
  summonU = null;
  anchor = null;
  if (await request(act({ k: 'skip' }))) afterAction();
}

// Symbol-Hilfe: Herzen und Stand erklären sich beim Antippen
$('hearts').addEventListener('click', () => S.teams.length && explain($('hearts'), heartsExplain(1)));
$('rival-hearts').addEventListener('click', () => S.teams.length && explain($('rival-hearts'), heartsExplain(2)));
document.querySelector('#game .score')?.addEventListener('click', (e) => S.teams.length && explain(e.currentTarget as HTMLElement, scoreExplain()));
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
    if (anchor === null || !R.netPlace(summonU!, orient, anchor)) anchor = bestAnchor(summonU!);
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
  // Element (01.11.2026): Abzeichen, Antippen zeigt den Ring
  const eb = html('button', 'elb-btn', elementBadge(u.el)) as HTMLButtonElement;
  eb.type = 'button';
  eb.addEventListener('click', () => explain(eb, elementExplain(u)));
  info.append(eb);
  if (st === 'sheet' && v) {
    const hp = el('div', 'card-hp');
    const i = el('i');
    i.style.width = Math.max(0, v.hp / v.max) * 100 + '%';
    hp.append(i);
    info.append(hp, el('small', '', `Opacity ${Math.max(0, v.hp)}/${v.max}`));
  }
  top.append(portraitEl(u.id, 64), info);
  const net = html('div', 'card-net', netSvg(u.net, u.faces, 30, lookOf(u.m)));
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
  box.append(top);
  // Galerie-Duell: wem der Würfel gehört, dazu Melden bei gemalten Monstern
  const k = u.side === 2 ? S.teams[1].units.indexOf(u) : -1;
  const fd = k >= 0 ? (S.foeDice[k] ?? null) : null;
  // Aus dem Archiv zurückgetrieben: ausgewaschen von einem anderen Spieler
  if (fd && fd.drift !== undefined) {
    top.querySelector('canvas')?.classList.add('faded');
    box.append(html('p', 'gal-owner drift', `Drifted back from the margins · washed out by ${fd.drift ? `<b>${esc(foeTag(fd.drift))}</b>` : 'another painter'}${fd.no ? ' · ' + serialText(fd.no) : ''}`));
  } else if (k >= 0 && S.foeName) {
    const bits = [fd?.no ? serialText(fd.no) : '', fd?.glaze ? `glaze ${fd.glaze}` : '', fd?.patina ? `patina ${fd.patina}/3` : ''].filter(Boolean);
    box.append(html('p', 'gal-owner', `From <b>${esc(foeTag(S.foeName))}</b>'s deck${bits.length ? ' · ' + bits.join(' · ') : ''}`));
  }
  box.append(net, statBlock(u, true), lines);
  if (fd?.drawn) {
    const rb = el('button', 'gal-report', reported.has(k) ? 'Reported' : 'Report drawing') as HTMLButtonElement;
    rb.type = 'button';
    rb.disabled = reported.has(k);
    let armedReport = false;
    rb.addEventListener('click', () => {
      if (!armedReport) {
        armedReport = true;
        rb.classList.add('armed');
        rb.textContent = 'Tap again to report';
        return;
      }
      rb.disabled = true;
      api
        .drawReport(k)
        .then(() => {
          reported.add(k);
          rb.classList.remove('armed');
          rb.textContent = 'Reported. A moderator will look.';
        })
        .catch((e) => {
          rb.disabled = false;
          armedReport = false;
          rb.classList.remove('armed');
          rb.textContent = 'Report drawing';
          onError(e);
        });
    });
    box.append(rb, el('small', '', 'For drawings that do not belong here. It disappears for others until a moderator decides.'));
  }
  $('inspect').hidden = false;
}
/** Im laufenden Galerie-Duell schon gemeldete Würfel des Rivalen */
const reported = new Set<number>();
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
function sepiaEnd(): string {
  if (S.winReason === 'palette broken') return S.winner === 1 ? 'You broke their palette. Messy, but effective.' : 'They broke your palette. I did say mind it.';
  if (S.winReason === 'washed out') return S.winner === 1 ? 'Not a single rival die left. Thorough.' : 'Every die washed away. We will speak about this.';
  return S.winner === 1 ? 'The paper remembers who painted it. Today, you.' : S.winner === 2 ? 'The rival covered more paper. Paper keeps score, not excuses.' : 'A draw. The paper cannot decide either.';
}
function sepiaGallery(): string {
  return S.winner === 1 ? 'Their deck goes back on the wall. Slightly lighter.' : S.winner === 2 ? "Someone else's brushwork beat yours. Take notes, not offence." : 'Two painters, one sheet, no verdict.';
}
/** Tropfen im Ergebnis (Kampf A Schritt 4): je Pigment gezählt, der Siegtropfen extra genannt */
function dropsText(drops: { pig: PigmentId; why: 'wash' | 'win' }[]): string {
  if (!drops.length) return '';
  const n = new Map<PigmentId, number>();
  for (const x of drops) n.set(x.pig, (n.get(x.pig) ?? 0) + 1);
  const list = [...n].map(([p, k]) => `${PIG[p].n}${k > 1 ? ` ×${k}` : ''}`).join(', ');
  const win = drops.some((x) => x.why === 'win');
  return (
    `<span class="drops-r">${drops.map((x) => dropIcon(x.pig, 18)).join('')} +${drops.length} drop${drops.length > 1 ? 's' : ''}: <b>${list}</b>` +
    `<br><small>${S.mode === 'bleach' ? 'Today’s colour. ' : win ? 'One for the win. ' : ''}${DROP_COST} of one pigment repaint a face in Your dice, ${TINT_MAX} faces per die.</small></span>`
  );
}
async function finishDuel(): Promise<void> {
  renderAll();
  await View.wait(700);
  const [a, b] = R.scores();
  const foe = S.foeName ? foeTag(S.foeName) : '';
  $('result-title').textContent = foe
    ? S.winner === 1
      ? `You beat ${foe}'s deck`
      : S.winner === 2
        ? `${foe}'s deck beat you`
        : `A draw with ${foe}'s deck`
    : S.winner === 1
      ? 'You win the sheet'
      : S.winner === 2
        ? 'The rival wins the sheet'
        : 'A draw';
  // Bleach (Schritt 1, schlicht): Punkte und Rang statt Sieg und Niederlage
  if (S.mode === 'bleach') {
    const b = bleachRes;
    $('result-title').textContent = S.teams[0].hearts > 0 ? 'The edge held' : 'The Bleach got through';
    if (b) {
      const p = b.parts;
      $('result-fee').hidden = false;
      $('result-fee').textContent = `${p.cells + p.layers} paint + ${p.washed * 10 + p.boss * 30} for Pales washed out + ${p.hearts * 15} for hearts`;
    }
  }
  else $('result-fee').hidden = !foe;
  if (foe) $('result-fee').textContent = `${foe} gets a small fee for hanging it, a bigger one when their deck wins.`;
  if (S.mode === 'bleach')
    $('result-sub').textContent = bleachRes ? `${bleachRes.points} points${bleachRes.rank ? ` · #${bleachRes.rank} of ${bleachRes.players} today` : bleachRes.ranked ? '' : ' · test sheet, not ranked'}` : 'The sheet dried.';
  else $('result-sub').textContent = S.winReason === 'palette broken' ? (S.winner === 1 ? 'Their palette is broken.' : 'Your palette is broken.') : S.winReason === 'washed out' ? 'All dice of one side are lost.' : `The paper dried: ${a} to ${b}.`;
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
  $('result-sepia').textContent = S.foeName ? sepiaGallery() : sepiaEnd();
  const rw = $('result-reward');
  rw.hidden = !reward;
  if (reward)
    rw.innerHTML =
      (reward.pigment ? `<span class="pigi"></span> +${reward.pigment} pigment <small>(${reward.total} in total)</small>` : reward.why === 'capped' ? 'No pigment or drops: five rewarded duels a day.' : '') +
      (reward.unlocked ? `<br>New medium: <b>${mediumDef(reward.unlocked).name}</b>` : '') +
      // Patina: ein Würfel hat durch Gebrauch eine bessere Seite bekommen
      (reward.patina?.length
        ? (reward.patina.length <= 2
            ? reward.patina.map((p) => `<span class="patina-r">Patina ${p.level}/3 · <b>${p.name}</b>: a face grew to ${iconSvg(p.face, 18)} ${R.faceText(p.face)}</span>`).join('')
            : `<span class="patina-r">Patina grew on ${reward.patina.length} dice: ${reward.patina.map((p) => `${iconSvg(p.face, 16)}`).join(' ')}<br><small>See their cards in Your dice.</small></span>`) +
          `<span class="patina-s">Master Sepia: “Wear suits it. That face has learned something.”</span>`
        : '') +
      dropsText(reward.drops ?? []);
  if (reward?.patina?.length) setTimeout(() => sfx.upface(2), 500);
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
  galleryNote();
}
function galleryNote(): void {
  const line = galleryLine();
  $('gal-note').hidden = !line;
  $('gal-note').innerHTML = line;
  $('gallery-m').textContent = galleryStatus()?.off ? 'Gallery: my deck is down' : 'Gallery: my deck hangs';
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

async function startDuel(tutorial = false, gallery = false): Promise<void> {
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
  reported.clear();
  showBanner(tutorial ? 'Lesson duel' : gallery ? 'Gallery duel' : 'Paint duel', 'big');
  const ok = await request(api.duelStart(level, tutorial, gallery), () => layout());
  if (!ok) {
    showScreen('title');
    return;
  }
  resumable = true;
  renderAll();
  tipForPhase();
}
/** Bleach: Tagesblatt starten oder weiterspielen (test: Playtest und Mod, anderes Blatt ohne Wertung) */
async function startBleach(test = false): Promise<void> {
  initAudio();
  resetUi();
  showScreen('game');
  View.reset();
  tasksDone.clear();
  S.teams = [] as unknown as typeof S.teams;
  bleachRes = null;
  busy = true;
  reported.clear();
  showBanner(test ? 'Test sheet' : 'Today’s sheet', 'big');
  let res: DuelResponse;
  try {
    res = await api.bleachStart(test);
  } catch (e) {
    busy = false;
    onError(e);
    showScreen('title');
    return;
  }
  // Weiterspielen: keine Ereignisse, also den Stand einmal ganz zeigen
  if (!res.events.length && res.state) {
    loadState(res.state);
    R.sync();
    res = { ...res, events: R.drain() };
  }
  const ok = await request(Promise.resolve(res), () => layout());
  if (!ok) {
    showScreen('title');
    return;
  }
  renderAll();
  tipForPhase();
}
/** Startbild: Knopf fürs Tagesblatt mit Stand */
async function bleachTitle(): Promise<void> {
  const b = $('bleach-b') as HTMLButtonElement,
    note = $('bleach-note');
  try {
    const i = await api.bleach();
    b.hidden = false;
    $('bleach-test').hidden = !i.tester;
    b.disabled = !i.unlocked || (!!i.played && !i.running);
    $('bleach-sub').textContent = !i.unlocked
      ? 'after the lesson duel'
      : i.running
        ? 'continue'
        : i.played
          ? `${i.played.points} points${i.played.rank ? ` · #${i.played.rank} of ${i.players}` : ''}`
          : `${i.waves} waves · ${i.pales} Pales`;
    note.hidden = !i.top.length;
    note.textContent = i.top.length ? `Today: ${i.top.map((t, k) => `${k + 1}. ${t.name || 'a painter'} ${t.points}`).join(' · ')}` : '';
  } catch {
    b.hidden = true;
  }
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
  if (res.reward) reward = res.reward;
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
$('gallery-b').addEventListener('click', () => {
  initAudio();
  sfx.tap();
  void openGallery();
});
initGallery({ start: () => void startDuel(false, true), error: onError });
initColors({ saved: (r) => applyDiceResponse(r), error: onError });
$('colors-t').addEventListener('click', () => {
  initAudio();
  sfx.tap();
  openColors();
});
$('colors-m').addEventListener('click', () => {
  sfx.tap();
  $('menu').hidden = true;
  openColors();
});
$('gallery-m').addEventListener('click', () => {
  sfx.tap();
  const on = !!galleryStatus()?.off;
  api
    .galleryHang(on)
    .then((r) => {
      setGalleryStatus(r.gallery);
      galleryNote();
      showTicker(on ? 'Your deck hangs in the gallery again.' : 'Your deck is off the wall. Others will not find it.', 'you');
    })
    .catch(onError);
});
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
$('bleach-b').addEventListener('click', () => void startBleach());
$('bleach-test').addEventListener('click', () => void startBleach(true));
$('continue').addEventListener('click', () => void resumeDuel());
$('how-t').addEventListener('click', () => ($('rules').hidden = false));
$('how-m').addEventListener('click', () => {
  $('menu').hidden = true;
  $('rules').hidden = false;
});
$('menu-btn').addEventListener('click', () => {
  sfx.tap();
  galleryNote();
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
// Nach einem Galerie-Duell sucht „Again“ ein neues Deck
$('again').addEventListener('click', () => {
  if (S.mode === 'bleach') {
    $('result').hidden = true;
    resumable = false;
    showScreen('title');
    void bleachTitle();
    return;
  }
  if (S.foeName) {
    $('result').hidden = true;
    void openGallery();
  } else void startDuel();
});
$('to-title').addEventListener('click', () => {
  $('result').hidden = true;
  resumable = false;
  showScreen('title');
  void bleachTitle();
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
void bleachTitle();
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
    units: R.allUnits().map((u) => ({ id: u.id, side: u.side, x: u.x, y: u.y, hp: u.hp, name: u.name, acted: u.acted, brim: u.brim, abT: R.abilityTargets(u), abSelf: ABILITY[u.m.bp].target === 'self', splash: R.splashCells(u), canMove: R.canMove(u), el: u.el })),
    place: summonU ? R.placements(summonU).slice(0, 1) : [],
    score: R.scores(),
    guide: guideNow,
  }),
  speed: (s: number) => (V.speed = s),
};
(window as unknown as { done: boolean }).done = true;
