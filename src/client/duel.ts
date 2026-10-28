/*
 * Farbschlacht in der Reddit-App: Titel, Duell auf einem Bildschirm, Ergebnis.
 * Der Server prüft und würfelt jede Aktion und schickt Ereignisse zurück, der Client spielt sie ab.
 * Regelabfragen (Reichweite, Chancen, Netze) laufen lokal auf dem Stand vom Server.
 */
import './lib/fonts';
import './duel.css';
import { showLoginPrompt, showToast } from '@devvit/web/client';
import type { DuelResponse } from '../shared/api';
import { PIG, type PigmentId } from '../shared/data';
import { relation } from '../shared/glaze';
import { lastRolled, loadState, type DuelAction } from '../shared/duel/play';
import { tutorialAction, tutorialActive } from '../shared/duel/tutorial';
import * as R from '../shared/duel/rules';
import { ABILITY, COLS, CRESTS, GAIT, HEARTS, ROUNDS, S, WATER_MAX, type Action, type Ev, type Face, type Level, type Side, type Unit } from '../shared/duel/rules';
import { renderMonster } from './renderer/watercolor';
import { api, ApiError } from './lib/api';
import { makeCube, tumble } from './duel/dice3d';
import { iconSvg, netSvg } from './duel/icons';
import { initAudio, isMuted, setMuted, sfx } from './duel/sound';
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
let screen: 'title' | 'game' = 'title';
let busy = false;
let level: Level = (['apprentice', 'journeyman', 'master'] as Level[]).find((l) => l === store.get('bid-duel-level')) ?? 'apprentice';
let chosen = new Set<number>();
let summonU: Unit | null = null,
  orient = 0,
  anchor: number | null = null;
let sel: Unit | null = null,
  moved = false,
  action: Action = 'dry',
  useSec = false,
  target: number | null = null;
let resumable = false;
const seenTips = new Set((store.get('bid-duel-tips') ?? '').split(',').filter(Boolean));
let hints = store.get('bid-duel-hints') !== '0';
setMuted(store.get('bid-duel-muted') === '1');

const board = $('board') as HTMLCanvasElement;
const me = () => S.teams[0];
const phase = () => (S.teams.length ? S.phase : 'opening');
const myTurn = () => !busy && !S.over && S.turn === 1;
const curPig = (u: Unit): PigmentId => (useSec && u.sec ? u.sec : u.m.main);
const placing = () => (phase() === 'opening' || phase() === 'summon') && summonU !== null;
/** Im Lern-Duell ist nur der markierte Schritt antippbar */
const tut = () => tutorialActive() && myTurn();
const allowedEl = (e: Element): boolean => !tut() || (!!guideNow.el && e.matches(guideNow.el));
const rgb = (p: PigmentId) => `rgb(${PIG[p].rgb})`;

/* ---------- Server ---------- */
async function playEvents(evs: Ev[]): Promise<void> {
  for (const e of evs) await View.playEvent(e);
}
/** Eine Anfrage an den Server, danach die Ereignisse abspielen */
async function request(p: Promise<DuelResponse>, onState?: () => void): Promise<boolean> {
  busy = true;
  renderAll();
  let res: DuelResponse;
  try {
    res = await p;
  } catch (e) {
    busy = false;
    onError(e);
    return false;
  }
  if (res.state) loadState(res.state);
  sel = sel ? R.unitById(sel.id) : null;
  summonU = summonU ? R.unitById(summonU.id) : null;
  onState?.();
  renderAll();
  await playEvents(res.events);
  busy = false;
  V.speed = 1;
  renderAll();
  if (S.over) void finishDuel();
  return true;
}
function onError(e: unknown): void {
  if (e instanceof ApiError && e.code === 'login') {
    showLogin();
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
  selected: () => (phase() === 'act' ? (sel?.id ?? null) : null),
  hud: () => {
    renderTop();
    renderPool();
  },
  banner: showBanner,
  ticker: showTicker,
  roll: playRoll,
});

/* ---------- Würfeln mit 3D-Würfeln ---------- */
async function playRoll(e: Extract<Ev, { k: 'roll' }>): Promise<void> {
  const stage = $('stage');
  stage.replaceChildren();
  stage.hidden = false;
  stage.append(el('p', 'stage-lbl', e.side === 1 ? 'Your roll' : 'Rival roll'));
  const row = el('div', 'stage-row');
  stage.append(row);
  requestAnimationFrame(() => stage.classList.add('on'));
  const size = Math.max(46, Math.round(View.cellSize() * 1.2));
  const dice = e.dice.map((d) => {
    const u = R.unitById(d.id)!;
    const box = el('div', 'stage-die');
    const cube = makeCube(u.faces, size, rgb(u.m.main));
    box.append(cube, el('small', '', u.name.split(' ')[1] ?? u.name));
    row.append(box);
    return { cube, box, d, u, f: u.faces[d.fi]! };
  });
  sfx.dice(dice.length);
  await Promise.all(dice.map((x, k) => tumble(x.cube, x.d.fi, (k * 110) / V.speed, 1050 / V.speed, (k - 1) * 70)));
  for (const x of dice) {
    x.box.classList.add('landed');
    x.box.querySelector('small')!.textContent = R.faceText(x.f);
    if (x.f.k === 'star') x.box.classList.add('star');
  }
  await View.wait(380);
  await Promise.all(dice.filter((x) => x.f.k !== 'star').map((x, k) => flyCrest(x.cube, x.f, e.side, k)));
  const t = V.teams[e.side - 1];
  if (t) t.crests = { ...e.crests };
  renderTop();
  renderPool();
  await View.wait(e.side === 1 ? 420 : 260);
  stage.classList.remove('on');
  await View.wait(260);
  stage.hidden = true;
  stage.replaceChildren();
}
function flyCrest(from: HTMLElement, f: Face, side: Side, k: number): Promise<void> {
  const dest = document.querySelector(`#${side === 1 ? 'crests' : 'rival-crests'} [data-k="${f.k}"]`) as HTMLElement | null;
  if (!dest) return Promise.resolve();
  const a = from.getBoundingClientRect(),
    b = dest.getBoundingClientRect();
  const fl = html('div', 'fly', iconSvg(f, 30) + (f.n > 1 ? '<b>×2</b>' : ''));
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
const TIPS: Record<string, string> = {
  opening: 'Every blot is a die. Pick one from your bag below: its net is the shape it unfolds into. Put it next to your palette.',
  roll: 'Pick three dice and roll. Symbols go to your pool and keep. Stars bring new blots onto the sheet.',
  summon: 'The stars add up. Tap a glowing die and unfold it, or skip if you are feeling modest.',
  act: 'Each blot moves once and acts once. Your own paint is the fast road, bare paper costs double. A Step in your pool lets one blot go further. The gold ring shows what I would do.',
  palette: 'You are touching their palette. One Splash, one heart. It is safe only while one of their blots stands next to it.',
};
function tip(key: string): void {
  if (S.tutorial > 0 || seenTips.has(key) || !TIPS[key]) return;
  seenTips.add(key);
  store.set('bid-duel-tips', [...seenTips].join(','));
  $('tip-text').textContent = TIPS[key]!;
  $('tip').hidden = false;
}
/* Lern-Duell: Sepia erklärt jeden neuen Teil, sobald er dran ist */
const LESSONS: [string, () => boolean, string][] = [
  ['welcome', () => phase() === 'opening' && !summonU, 'This is the sheet, and I am Master Sepia. Today you duel my apprentice. I will tell you exactly what to tap: always the gold ring.'],
  ['bag', () => phase() === 'opening' && !summonU, 'Down there is your bag: six dice. Every blot is a die, its sides come from the blot itself. Tap ⓘ on a die to see the net it unfolds into.'],
  ['net', () => phase() === 'opening' && !!summonU, 'A net must touch your own paint. Turn it until it fits, then tap where the blot should stand. Tap there once more to unfold it.'],
  ['rival', () => phase() === 'roll' && S.round === 1, 'The apprentice unfolded first, up there by its palette. Each palette has three hearts. Break theirs, or cover more paper than them when it dries after six rounds.'],
  ['roll', () => phase() === 'roll' && S.round === 1, 'Each turn you roll three dice. I picked three for you. Roll them.'],
  ['crests', () => (phase() === 'summon' || phase() === 'act') && S.round === 1, 'Symbols go into your pool and stay. Step lets a blot walk further, Brush pays for a stamp, Splash for a hit, Guard blocks a hit by itself, two Glow buy an ability. I lent you two Glow.'],
  ['summon', () => phase() === 'summon', 'Stars bring blots out. A die may unfold if the other dice show stars worth at least its level. This one qualifies.'],
  ['move', () => phase() === 'act' && !sel && ['move', 'act'].includes(tutorialAction()?.k ?? ''), 'Each blot moves once and acts once per turn. Your own paint is the fast road. Bare paper and rival paint cost double.'],
  ['palette', () => { const a = tutorialAction(); return a?.k === 'act' && a.a === 'splash' && a.at === S.teams[1].home; }, 'Their palette is unguarded. One splash, one heart. A palette is only safe while one of its own blots stands next to it.'],
  ['stamp', () => { const a = tutorialAction(); return a?.k === 'act' && (a.a === 'dry' || a.a === 'wet'); }, 'A stamp paints the blot’s shape. Dry paint covers dried paint if your Opacity beats their Grain. Wet paint costs a drop of water and spreads next round, but slides off dry paint.'],
  ['splash', () => { const a = tutorialAction(); return a?.k === 'act' && a.a === 'splash'; }, 'Splash hits a rival in reach: your Saturation plus a d20 against its Grain plus a d20. Complementary colours hit harder and stain.'],
  ['ability', () => { const a = tutorialAction(); return a?.k === 'act' && a.a === 'ability'; }, 'Two Glow buy an ability. Every blueprint has its own. You can read them on the dice cards.'],
  ['soak', () => { const a = tutorialAction(); return a?.k === 'act' && a.a === 'soak'; }, 'Soak is free. It heals, rinses stains and gives a drop of water.'],
  ['end', () => tutorialAction()?.k === 'end', 'Nothing more worth doing. End your turn and watch the apprentice. Tap the sheet if it is too slow for you.'],
  ['eraser', () => S.round >= 3 && phase() === 'roll', 'Did you see the Eraser? Someone keeps wiping rows of my sheet. Lightfastness protects paint and blots.'],
  ['free', () => S.round > S.tutorial && !S.over, 'That is all I can teach without doing it for you. Finish the duel on your own. The gold ring stays, if you want it.'],
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
  if (p === 'opening' || p === 'roll' || p === 'summon' || p === 'act') tip(p);
}

/* ---------- Oberfläche ---------- */
function crestRow(box: HTMLElement, side: Side, small: boolean): void {
  const t = V.teams[side - 1];
  if (!t) return;
  if (box.childElementCount !== CRESTS.length) {
    box.replaceChildren();
    for (const c of CRESTS) {
      const s = html('span', 'crest', iconSvg({ k: c.k, n: 1 }, small ? 15 : 20) + '<b></b>');
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
function drops(box: HTMLElement, n: number): void {
  box.replaceChildren();
  for (let k = 0; k < WATER_MAX; k++) box.append(el('i', k < n ? 'on' : ''));
}
function portraitEl(id: number, px: number, alpha = 1): HTMLCanvasElement {
  const src = View.portrait(id, px);
  const c = document.createElement('canvas');
  c.width = c.height = px * 2;
  c.getContext('2d')!.drawImage(src, 0, 0, px * 2, px * 2);
  c.style.opacity = String(alpha);
  return c;
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
  drops($('rival-water'), V.teams[1]!.water);
  crestRow($('rival-crests'), 2, true);
  const rd = $('rival-dice');
  rd.replaceChildren();
  for (const u of S.teams[1].units) {
    const v = V.units.get(u.id);
    const st = v?.state ?? 'bag';
    const b2 = el('button', `rd st-${st}`) as HTMLButtonElement;
    b2.type = 'button';
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
  drops($('water'), V.teams[0]!.water);
  crestRow($('crests'), 1, false);
}
const need = () => Math.min(R.ROLL_N, R.living(me()).length);
function defaultPick(): Set<number> {
  const l = R.living(me());
  return new Set([...l.filter((u) => u.state === 'bag'), ...l.filter((u) => u.state === 'sheet')].slice(0, R.ROLL_N).map((u) => u.id));
}
function dieChip(u: Unit): HTMLElement {
  const v = V.units.get(u.id);
  const st = v?.state ?? u.state;
  const p = phase();
  const b = el('button', `chip st-${st}` + (chosen.has(u.id) && p === 'roll' ? ' chosen' : '') + (summonU === u ? ' sel' : '')) as HTMLButtonElement;
  b.type = 'button';
  const pickable = myTurn() && ((p === 'roll' && st !== 'gone') || (p === 'opening' && st === 'bag'));
  b.dataset.id = String(u.id);
  b.append(portraitEl(u.id, 30, st === 'gone' ? 0.3 : 1), html('span', 'lvb', iconSvg({ k: 'star', n: u.lv }, 14)), el('span', 'st', st === 'bag' ? 'bag' : st === 'sheet' ? 'sheet' : 'lost'), el('span', 'info', 'i'));
  b.addEventListener('click', (ev) => {
    if ((ev.target as HTMLElement).closest('.info') || !pickable) return openInspect(u);
    if (!allowedEl(b)) return;
    sfx.tap();
    if (p === 'roll') {
      if (chosen.has(u.id)) chosen.delete(u.id);
      else if (chosen.size < need()) chosen.add(u.id);
    } else {
      summonU = u;
      orient = 0;
      anchor = null;
    }
    renderAll();
  });
  return b;
}
function renderCtx(): void {
  const box = $('ctx');
  box.replaceChildren();
  box.className = '';
  const p = phase();
  if (S.turn === 1 && !S.over && (p === 'opening' || p === 'roll')) {
    box.className = 'chips';
    for (const u of me().units) box.append(dieChip(u));
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
        summonU = r.u;
        orient = 0;
        anchor = null;
        renderAll();
      });
      box.append(b);
    }
  } else if (S.turn === 1 && p === 'act') {
    box.className = 'acts';
    const acts: [Action, string, string][] = [
      ['dry', 'Dry', '1 Brush'],
      ['wet', 'Wet', '+1 water'],
      ['splash', 'Splash', '1 Splash'],
      ['soak', 'Soak', 'free'],
      ['ability', sel ? ABILITY[sel.m.bp].name : 'Ability', sel ? `${R.abilityCost(sel)} Glow` : '2 Glow'],
    ];
    for (const [a, label, sub] of acts) {
      const b = el('button', 'act' + (a === 'ability' ? ' ab' : '')) as HTMLButtonElement;
      b.type = 'button';
      b.dataset.a = a;
      b.setAttribute('aria-pressed', String(action === a && !!sel));
      b.disabled = busy || !sel || !R.canAct(sel, a) || (a === 'splash' && R.splashCells(sel).length === 0) || (a === 'ability' && R.abilityTargets(sel).length === 0);
      b.append(el('b', '', label), el('small', '', sub));
      b.addEventListener('click', () => {
        if (!allowedEl(b)) return;
        sfx.tap();
        action = a;
        target = null;
        // Eine Aktion wählen heißt: dieser Klecks bleibt stehen
        moved = true;
        renderAll();
      });
      box.append(b);
    }
  } else {
    box.className = 'waiting';
    box.append(el('p', '', S.turn === 2 && !S.over ? 'The rival is rolling and painting…' : ''));
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
      aux.textContent = 'Turn net';
      const list = anchor !== null ? R.netAt(summonU, orient, anchor) : null;
      go.textContent = 'Unfold';
      go.disabled = !(list && R.validNet(1, list));
    } else go.textContent = 'Pick a die';
    return;
  }
  if (p === 'roll') {
    go.textContent = `Roll ${need()} dice`;
    go.disabled = chosen.size !== need();
    return;
  }
  end.hidden = false;
  end.textContent = 'End turn';
  if (sel && sel.sec && moved && (action === 'dry' || action === 'wet' || action === 'splash')) {
    aux.hidden = false;
    aux.innerHTML = `<span class="dot" style="background:${rgb(curPig(sel))}"></span>${PIG[curPig(sel)].n.split(' ')[0]}`;
  }
  if (!sel) go.textContent = 'Pick a blot';
  else if (!moved) {
    go.textContent = 'Stay here';
    go.disabled = false;
  } else if (action === 'soak') {
    go.textContent = 'Soak';
    go.disabled = false;
  } else if (action === 'ability') {
    const ab = ABILITY[sel.m.bp];
    go.textContent = ab.name;
    go.disabled = !R.canAct(sel, 'ability') || (ab.target === 'self' ? R.abilityTargets(sel).length === 0 : target === null || !R.abilityTargets(sel).includes(target));
  } else if (action === 'splash') {
    go.textContent = 'Splash';
    go.disabled = target === null;
  } else {
    go.textContent = action === 'wet' ? 'Paint wet' : 'Paint dry';
    go.disabled = target === null;
  }
}
function renderHint(): void {
  const p = phase();
  if (S.over) return setHint('');
  if (busy && S.turn === 2) return setHint('Rival turn. Tap the sheet to speed it up.');
  if (busy) return setHint('');
  if (S.turn !== 1) return setHint('');
  if (p === 'opening') return setHint(summonU ? `${summonU.name}: tap a blue dot where it should stand. Turn the net to fit.` : 'Opening: pick one of your dice below to unfold first.');
  if (p === 'roll') return setHint(`Pick ${need()} dice (${chosen.size} picked), then roll. Tap ⓘ to read a die.`);
  if (p === 'summon') {
    if (!summonU) return setHint('The stars add up. Tap a glowing die to unfold that blot, or skip.');
    const list = anchor !== null ? R.netAt(summonU, orient, anchor) : null;
    return setHint(anchor === null ? `${summonU.name}: tap a blue dot. The net must touch your paint.` : list && R.validNet(1, list) ? `Unfold ${summonU.name} here? Tap again or press Unfold.` : 'It does not fit there.');
  }
  const t = me();
  if (!sel) return setHint(R.onSheet(t).some((u) => !u.acted) ? 'Tap one of your blots on the sheet. Tap a rival to read it.' : 'All blots are done. End your turn.');
  if (!moved) {
    if (!R.canMove(sel)) return setHint(`${sel.name}: ${sel.rooted ? 'rooted this turn' : sel.moved ? 'already moved' : 'towers never move'}. Tap it again to act.`);
    return setHint(`${sel.name}: tap a green dot to move. Light dots use a Step from your pool. Or tap it again to stay.`);
  }
  if (action === 'soak') return setHint(`Soak: +${R.soakAmount(sel)} opacity, +1 water, rinses stains. Free.`);
  if (action === 'ability') {
    const ab = ABILITY[sel.m.bp];
    return setHint(`${ab.name}: ${ab.text}${ab.target !== 'self' && target === null ? ' Tap a gold target.' : ''}`);
  }
  if (action === 'splash') {
    const h = S.teams[1].home;
    if (target === h) return setHint(`Splash their palette: always hits, one heart (${S.teams[1].hearts} left).`);
    const tg = target !== null ? R.unitAt(target % COLS, Math.floor(target / COLS)) : null;
    if (tg) {
      const pig = curPig(sel);
      const pr = Math.round(R.splashOdds(sel, tg, pig) * 100);
      const dmg = R.baseDamage(sel, tg, pig, R.cheb(sel.x, sel.y, tg.x, tg.y) <= 1);
      return setHint(`${tg.name}: ${pr}% to hit, -${dmg}${GAIT[sel.m.bp].key === 'twin' ? ' twice' : ''}, ${R.relWord(pig, tg.m.main)}${relation(pig, tg.m.main) === 'komplementaer' || R.has(sel, 'staining') ? ', stains' : ''}${S.teams[1].crests.guard ? '. They hold a Guard' : ''}.`);
    }
    if (R.touchesHome(sel) && R.homeGuarded(S.teams[1])) return setHint('Their palette is guarded by a blot next to it. Wash that blot out first, or splash a circled rival.');
    return setHint(`Tap a circled rival in reach ${R.splashRange(sel)}, or their palette when you stand next to it.`);
  }
  if (target === null) return setHint(`Tap the paper within ${R.paintRange(sel)} to aim the stamp.`);
  let free = 0,
    mud = 0,
    none = 0;
  const odds: number[] = [];
  for (const i of R.stampCells(sel, target)) {
    const o = R.outcome(sel, curPig(sel), action === 'wet', S.cells[i]!);
    if (o.kind === 'take') free++;
    else if (o.kind === 'mud') mud++;
    else if (o.kind === 'none') none++;
    else if (o.kind === 'contest' || o.kind === 'over') odds.push(Math.round(o.p * 100));
  }
  const parts = [];
  if (free) parts.push(`${free} free`);
  if (odds.length) parts.push(`${odds.length} contested (${odds.join('%, ')}%)`);
  if (mud) parts.push(`${mud} to mud`);
  if (none) parts.push(`${none} no effect`);
  setHint((parts.join(' · ') || 'Nothing to gain here.') + ' Tap again to paint.');
}
function renderAll(): void {
  if (screen !== 'game' || !S.teams.length) return;
  renderTop();
  renderPool();
  renderCtx();
  renderGo();
  renderHint();
  applyGuide();
  lessonCheck();
}

/* ---------- Hervorhebungen auf dem Blatt ---------- */
const faceImgs = new Map<string, HTMLImageElement>();
function faceImg(f: Face): HTMLImageElement {
  const k = f.k + f.n;
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
  if (phase() !== 'act' || !sel) return drawGuide(ctx, cell);
  if (!moved) {
    if (R.canMove(sel)) {
      const rc = R.reachCost(sel);
      const base = R.moveRange(sel);
      for (const [i, c] of rc.cost) if (i !== R.idx(sel.x, sel.y)) dot(i, c > base ? 'rgba(46,122,87,.25)' : 'rgba(46,122,87,.6)', 0.12);
    }
    drawGuide(ctx, cell);
    return;
  }
  if (action === 'dry' || action === 'wet') {
    const rr = R.paintRange(sel);
    ctx.strokeStyle = 'rgba(43,63,163,.28)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect((sel.x - rr) * cell + 1, (sel.y - rr) * cell + 1, (rr * 2 + 1) * cell - 2, (rr * 2 + 1) * cell - 2);
    if (target !== null)
      for (const i of R.stampCells(sel, target)) {
        const o = R.outcome(sel, curPig(sel), action === 'wet', S.cells[i]!);
        const col = o.kind === 'take' ? '46,122,87' : o.kind === 'mud' ? '110,75,51' : o.kind === 'none' ? '120,120,130' : o.kind === 'refresh' ? '90,100,120' : '168,108,18';
        ctx.strokeStyle = `rgba(${col},.95)`;
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect((i % COLS) * cell + 4, Math.floor(i / COLS) * cell + 4, cell - 8, cell - 8);
        ctx.setLineDash([]);
        if (o.kind === 'contest' || o.kind === 'over') {
          ctx.fillStyle = `rgba(${col},1)`;
          ctx.font = '700 11px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(Math.round(o.p * 100) + '%', cx(i), Math.floor(i / COLS) * cell + cell - 7);
        }
      }
  } else if (action === 'splash') {
    for (const i of R.splashCells(sel)) ring(i, i === target ? 'rgba(163,58,58,1)' : 'rgba(163,58,58,.7)');
  } else if (action === 'ability' && ABILITY[sel.m.bp].target !== 'self') {
    for (const i of R.abilityTargets(sel)) {
      if (R.unitAt(i % COLS, Math.floor(i / COLS))) ring(i, 'rgba(168,108,18,.95)');
      else dot(i, i === target ? 'rgba(168,108,18,.95)' : 'rgba(168,108,18,.45)', i === target ? 0.16 : 0.1);
    }
    if (target !== null && sel.m.bp === 'schwebeblase') {
      ctx.strokeStyle = 'rgba(168,108,18,.95)';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(((target % COLS) - 1) * cell + 3, (Math.floor(target / COLS) - 1) * cell + 3, cell * 3 - 6, cell * 3 - 6);
      ctx.setLineDash([]);
    }
  }
  drawGuide(ctx, cell);
}

/* ---------- Führung: Sepia zeigt, was sie tun würde ---------- */
let guideNow: { cell?: number; el?: string } = {};
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
/** Im Lern-Duell: der vorgegebene Schritt, zerlegt in einzelne Tipps */
function tutorialGuide(): { cell?: number; el?: string } {
  const exp = tutorialAction();
  if (!exp) return {};
  const pos = (id: number) => {
    const u = R.unitById(id);
    return u ? R.idx(u.x, u.y) : undefined;
  };
  switch (exp.k) {
    case 'open':
    case 'summon':
      if (summonU?.id !== exp.id) return { el: exp.k === 'open' ? `#ctx .chip[data-id="${exp.id}"]` : `#ctx .rchip[data-id="${exp.id}"]` };
      if (orient !== exp.o) return { el: '#aux' };
      if (anchor !== exp.at) return { cell: exp.at };
      return { el: '#go' };
    case 'roll': {
      const missing = exp.ids.find((id) => !chosen.has(id));
      if (missing !== undefined) return { el: `#ctx .chip[data-id="${missing}"]` };
      return { el: '#go' };
    }
    case 'skip':
    case 'end':
      return { el: '#end' };
    case 'move':
      if (sel?.id !== exp.id) return { cell: pos(exp.id) };
      return { cell: exp.to };
    case 'act': {
      if (sel?.id !== exp.id) return { cell: pos(exp.id) };
      if (!moved) return { cell: pos(exp.id) };
      if (action !== exp.a) return { el: `#ctx .act[data-a="${exp.a}"]` };
      if ((exp.a === 'dry' || exp.a === 'wet' || exp.a === 'splash') && curPig(sel) !== exp.pig) return { el: '#aux' };
      const needsTarget = exp.a === 'dry' || exp.a === 'wet' || exp.a === 'splash' || (exp.a === 'ability' && ABILITY[sel.m.bp].target !== 'self');
      if (needsTarget && exp.at !== null && target !== exp.at) return { cell: exp.at };
      return { el: '#go' };
    }
  }
  return {};
}
function computeGuide(): { cell?: number; el?: string } {
  if (tut() && screen === 'game') return tutorialGuide();
  if (!hints || !myTurn() || screen !== 'game') return {};
  const p = phase();
  if (p === 'opening' || p === 'summon') {
    if (!summonU) return { el: p === 'opening' ? '#ctx .chip.st-bag' : '#ctx .rchip.can' };
    if (anchor === null) {
      const a = bestAnchor(summonU);
      return a === null ? { el: '#aux' } : { cell: a };
    }
    return { el: '#go' };
  }
  if (p === 'roll') return chosen.size === need() ? { el: '#go' } : { el: '#ctx .chip:not(.chosen):not(.st-gone)' };
  if (p !== 'act') return {};
  const sug = R.suggest(1, sel ?? undefined, moved);
  if (!sug) return { el: '#end' };
  if (!sel) return { cell: R.idx(sug.u.x, sug.u.y) };
  if (!moved) return sug.to !== R.idx(sel.x, sel.y) ? { cell: sug.to } : { cell: R.idx(sel.x, sel.y) };
  if (action !== sug.a) return { el: `#ctx .act[data-a="${sug.a}"]` };
  const needsTarget = sug.a === 'dry' || sug.a === 'wet' || sug.a === 'splash' || (sug.a === 'ability' && ABILITY[sel.m.bp].target !== 'self');
  if (needsTarget && sug.at !== null && target !== sug.at) return { cell: sug.at };
  return { el: '#go' };
}
function drawGuide(ctx: CanvasRenderingContext2D, cell: number): void {
  if (guideNow.cell === undefined) return;
  const i = guideNow.cell;
  const t = performance.now();
  const x = ((i % COLS) + 0.5) * cell,
    y = (Math.floor(i / COLS) + 0.5) * cell;
  ctx.strokeStyle = `rgba(201,150,30,${0.65 + 0.35 * Math.sin(t / 180)})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, cell * (0.42 + 0.06 * Math.sin(t / 180)), 0, 7);
  ctx.stroke();
}
function applyGuide(): void {
  guideNow = computeGuide();
  for (const e of document.querySelectorAll('.guide')) e.classList.remove('guide');
  if (guideNow.el) document.querySelector(guideNow.el)?.classList.add('guide');
}

/* ---------- Eingaben ---------- */
board.addEventListener('click', (e) => {
  if (busy && S.turn === 2) {
    V.speed = 2.5;
    return;
  }
  if (!myTurn()) return;
  const rect = board.getBoundingClientRect();
  const cell = View.cellSize();
  const x = Math.floor((e.clientX - rect.left) / cell),
    y = Math.floor((e.clientY - rect.top) / cell);
  if (!R.inside(x, y)) return;
  const i = R.idx(x, y);
  const u = R.unitAt(x, y);
  const p = phase();
  if (tut() && guideNow.cell !== i) return;
  if (placing()) {
    const list = R.netAt(summonU!, orient, i);
    if (list && R.validNet(1, list)) {
      sfx.tap();
      if (anchor === i) return void unfold();
      anchor = i;
    }
    return renderAll();
  }
  if (p !== 'act') {
    if (u) openInspect(u);
    return;
  }
  if (u && u.side === 2 && (!sel || !moved || action === 'soak')) return openInspect(u);
  if (!sel) {
    if (u && u.side === 1) selectUnit(u);
    return;
  }
  if (!moved) {
    if (u === sel) {
      moved = true;
      sfx.tap();
      return renderAll();
    }
    if (u && u.side === 1) return selectUnit(u);
    if (!R.canMove(sel)) return;
    if (!u && R.reach(sel).has(i)) void moveSel(i);
    return;
  }
  if (action === 'splash') {
    if (R.splashCells(sel).includes(i)) {
      if (target === i) return void commit();
      target = i;
      sfx.tap();
    }
  } else if (action === 'ability') {
    if (ABILITY[sel.m.bp].target === 'self' || !R.abilityTargets(sel).includes(i)) return;
    if (target === i) return void commit();
    target = i;
    sfx.tap();
  } else if (action === 'dry' || action === 'wet') {
    if (!R.canPaintAt(sel, i)) return;
    if (target === i) return void commit();
    target = i;
    sfx.tap();
  } else if (u === sel) return void commit();
  renderAll();
});
function selectUnit(u: Unit): void {
  if (!myTurn() || u.state !== 'sheet' || u.side !== 1 || u.acted) return;
  if (moved && sel !== u) return;
  if (sel !== u) useSec = false;
  sel = u;
  target = null;
  sfx.tap();
  if (!R.canAct(u, action)) action = R.canAct(u, 'dry') ? 'dry' : R.canAct(u, 'splash') && R.splashCells(u).length ? 'splash' : 'soak';
  renderAll();
}
async function moveSel(to: number): Promise<void> {
  if (!sel) return;
  const ok = await request(api.duelAct({ k: 'move', id: sel.id, to }), () => (moved = true));
  if (ok && sel && R.touchesHome(sel) && R.canAct(sel, 'splash')) {
    action = 'splash';
    tip('palette');
    renderAll();
  }
}
async function unfold(): Promise<void> {
  if (!summonU || anchor === null || busy) return;
  const list = R.netAt(summonU, orient, anchor);
  if (!list || !R.validNet(1, list)) return;
  const a: DuelAction = { k: phase() === 'opening' ? 'open' : 'summon', id: summonU.id, o: orient, at: anchor };
  summonU = null;
  anchor = null;
  if (await request(api.duelAct(a))) {
    if (phase() === 'roll') chosen = defaultPick();
    renderAll();
    tipForPhase();
  }
}
async function doRoll(): Promise<void> {
  if (!myTurn() || phase() !== 'roll' || chosen.size !== need()) return;
  const ids = [...chosen];
  chosen = new Set();
  if (await request(api.duelAct({ k: 'roll', ids }))) tipForPhase();
}
async function commit(): Promise<void> {
  if (!sel || !myTurn() || phase() !== 'act') return;
  if (action === 'ability') {
    if (!R.canAct(sel, 'ability')) return;
    if (ABILITY[sel.m.bp].target !== 'self' && target === null) return;
  } else if ((action === 'dry' || action === 'wet' || action === 'splash') && target === null) return;
  if (!R.canAct(sel, action)) return;
  const a: DuelAction = { k: 'act', id: sel.id, a: action, pig: curPig(sel), at: action === 'soak' ? null : action === 'ability' && ABILITY[sel.m.bp].target === 'self' ? R.idx(sel.x, sel.y) : target };
  sel = null;
  moved = false;
  target = null;
  useSec = false;
  await request(api.duelAct(a));
}
async function endTurn(): Promise<void> {
  if (!myTurn() || (phase() !== 'act' && phase() !== 'summon')) return;
  sel = null;
  moved = false;
  target = null;
  summonU = null;
  anchor = null;
  if (await request(api.duelAct({ k: 'end' }))) {
    chosen = defaultPick();
    renderAll();
  }
}
async function skipSummon(): Promise<void> {
  summonU = null;
  anchor = null;
  if (await request(api.duelAct({ k: 'skip' }))) tipForPhase();
}

$('go').addEventListener('click', () => {
  if (busy) return;
  if (S.over) return void startDuel();
  if (!allowedEl($('go'))) return;
  if (!myTurn()) return;
  if (placing()) return void unfold();
  if (phase() === 'roll') return void doRoll();
  if (phase() !== 'act' || !sel) return;
  if (!moved) {
    moved = true;
    sfx.tap();
    return renderAll();
  }
  void commit();
});
$('aux').addEventListener('click', () => {
  if (busy || !allowedEl($('aux'))) return;
  sfx.tap();
  if (placing()) {
    orient = (orient + 1) % 8;
    if (anchor !== null && !R.netAt(summonU!, orient, anchor)) anchor = null;
  } else if (sel && sel.sec) useSec = !useSec;
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
  info.append(el('b', '', u.name), html('span', 'lv', `${iconSvg({ k: 'star', n: u.lv }, 15)} Level ${u.lv} · ${u.side === 1 ? 'yours' : 'rival'} · ${st === 'bag' ? 'in the bag' : st === 'sheet' ? 'on the sheet' : 'washed out'}`));
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
    html('p', '', `<b>Moves</b> ${GAIT[u.m.bp].text}`),
    html('p', 'ab', `<b>${ab.name}</b> <span>${R.abilityCost(u)} Glow</span> ${ab.text}`),
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
  $('result').hidden = false;
  $('result').className = S.winner === 1 ? 'overlay win' : 'overlay';
  if (S.winner === 1) sfx.win();
  else sfx.lose();
  if (S.tutorial > 0) store.set('bid-duel-learned', '1');
}

function showScreen(id: 'title' | 'game'): void {
  screen = id;
  $('title').hidden = id !== 'title';
  $('game').hidden = id !== 'game';
  if (id === 'game') layout();
  else $('continue').hidden = !resumable;
}
function layout(): void {
  const w = $('boardwrap');
  View.resize(w.clientWidth, w.clientHeight);
}
window.addEventListener('resize', () => {
  if (screen === 'game') layout();
});
function resetUi(): void {
  for (const id of ['result', 'menu', 'rules', 'inspect', 'tip', 'logview']) $(id).hidden = true;
  sel = null;
  moved = false;
  target = null;
  summonU = null;
  anchor = null;
  action = 'dry';
  chosen = new Set();
}

async function startDuel(tutorial = false): Promise<void> {
  initAudio();
  resetUi();
  showScreen('game');
  View.reset();
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
    renderMonster(c, m, 140, { dpr: Math.min(2, window.devicePixelRatio || 1) });
    box.append(c);
  }
  box.append(el('span', 'vs', 'vs'));
}
setLevel(level);
soundLabel();
titleArt();
showScreen('title');
api
  .duel()
  .then((r) => {
    resumable = !!r.state && !r.state.over;
    if (screen === 'title') $('continue').hidden = !resumable;
  })
  .catch((e) => {
    if (e instanceof ApiError && e.code === 'login') showLogin();
  });

/* Nur für automatische Probeläufe */
(window as unknown as { __duel: unknown }).__duel = {
  state: () => S.teams.length < 2 ? { busy: true, phase: 'none', guide: {}, over: false } : ({
    phase: phase(),
    busy,
    sel: sel?.id ?? null,
    moved,
    action,
    round: S.round,
    over: S.over,
    winner: S.winner,
    turn: S.turn,
    crests: { ...S.teams[0]?.crests },
    water: S.teams[0]?.water,
    hearts: S.teams.map((t) => t.hearts),
    summonable: phase() === 'summon' ? R.summonable(me(), lastRolled()).map((u) => u.id) : [],
    units: R.allUnits().map((u) => ({ id: u.id, side: u.side, x: u.x, y: u.y, hp: u.hp, name: u.name, acted: u.acted, canAbility: R.abilityReady(u), abT: R.abilityTargets(u), abSelf: ABILITY[u.m.bp].target === 'self', splash: R.splashCells(u), canMove: R.canMove(u) })),
    place: summonU ? R.placements(summonU).slice(0, 1) : [],
    score: R.scores(),
    guide: guideNow,
  }),
  speed: (s: number) => (V.speed = s),
};
(window as unknown as { done: boolean }).done = true;
