/*
 * Würfelsammlung im Client: Ziehen mit offenem W100, Beutel packen, Würfel auswaschen, Lasur auf Würfelseiten.
 * Alle Würfe kommen vom Server, hier wird nur gezeigt und angetippt. Jedes Monster gibt es nur einmal (Seriennummer).
 */
import type { DiceResponse } from '../../shared/api';
import { PAPER } from '../../shared/data';
import { dieMonster, dieSpecies, GLAZE_COST, KEEP_MIN, PITY, PULL_COST, RARITIES, rarityDef, rarityIndex, serialText, TEN_COST, washGlaze, type DiceSave, type DieRec, type PullKind, type PullResult } from '../../shared/dice';
import { ABILITY, BAG, dieUnit, FACE_HELP, faceText, GAIT, isCrestFace, type Unit } from '../../shared/duel/rules';
import { speciesLabel } from '../../shared/monster';
import { renderMonster } from '../renderer/watercolor';
import { api } from '../lib/api';
import { iconSvg, netSvg } from './icons';
import type { Reveal, RevealPull } from './gacha/reveal';
import { initAudio, sfx } from './sound';

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
const dpr = () => Math.min(2, window.devicePixelRatio || 1);
const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

type Hooks = { back: () => void; error: (e: unknown) => void };
let hooks: Hooks = { back: () => undefined, error: () => undefined };
let save: DiceSave | null = null;
let freeReady = false;
let busy = false;
/** Würfel, der in den Beutel soll: nächster Tipp auf einen Beutelplatz tauscht */
let swapIn: string | null = null;
/** Würfel, dessen Auswaschen schon einmal angetippt wurde (zweiter Tipp wäscht) */
let washArmed: string | null = null;

/* ---------- Bilder der Würfel ---------- */
const arts = new Map<string, HTMLCanvasElement>();
function art(d: DieRec, px: number): HTMLCanvasElement {
  const key = `${d.id}:${d.paper ?? ''}:${px}`;
  let c = arts.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 1;
    renderMonster(c, dieMonster(d), px, px < 80 ? { dpr: dpr(), quality: 'lite' } : { dpr: dpr() });
    arts.set(key, c);
  }
  const out = document.createElement('canvas');
  out.width = c.width;
  out.height = c.height;
  out.getContext('2d')!.drawImage(c, 0, 0);
  return out;
}
const unitOfDie = (d: DieRec): Unit => dieUnit(dieMonster(d), d.mods);
const shortName = (u: Unit) => u.name;

/* ---------- Bildschirm ---------- */
function render(): void {
  if (!save) return;
  const s = save;
  $('pigment').textContent = String(s.pigment);
  // Ziehen
  const btns = $('dip-btns');
  btns.replaceChildren();
  const btn = (label: string, sub: string, kind: PullKind, ok: boolean, main = false) => {
    const b = el('button', main ? 'dipbtn main' : 'dipbtn') as HTMLButtonElement;
    b.type = 'button';
    b.dataset.kind = kind;
    b.disabled = !ok || busy;
    b.append(el('b', '', label), el('small', '', sub));
    b.addEventListener('click', () => void pull(kind));
    btns.append(b);
  };
  if (s.starter > 0) btn(`Dip ${s.starter} free dice`, 'fills your deck', 'starter', true, true);
  else {
    btn('Free dip', freeReady ? 'once a day' : 'back tomorrow', 'free', freeReady, freeReady);
    btn('Dip', `${PULL_COST} pigment`, 'one', s.pigment >= PULL_COST);
    btn('Dip ×10', `${TEN_COST} · Rare or better`, 'ten', s.pigment >= TEN_COST);
  }
  $('odds').innerHTML = RARITIES.map((r) => `<span style="--c:${r.col}"><i></i>${r.from === r.to ? r.from : `${r.from}–${r.to}`} ${r.label}</span>`).join('');
  $('pity').textContent = `Bad luck shield: Rare in ${PITY.rare - s.pity.rare} · Epic in ${PITY.epic - s.pity.epic} · Legendary in ${PITY.legendary - s.pity.legendary} dips at most.`;
  // Beutel
  const bag = $('bag');
  bag.replaceChildren();
  for (let k = 0; k < BAG; k++) {
    const d = s.dice.find((x) => x.id === s.bag[k]);
    const b = el('button', 'bslot' + (swapIn ? ' swap' : '') + (d ? '' : ' empty')) as HTMLButtonElement;
    b.type = 'button';
    b.dataset.slot = String(k);
    if (d) {
      const u = unitOfDie(d);
      b.style.setProperty('--c', rarityDef(u.rarity).col);
      b.append(art(d, 46), html('span', 'lvb', iconSvg({ k: 'star', n: u.lv }, 13)));
      b.title = u.name;
    } else b.append(el('span', 'plus', '+'));
    b.addEventListener('click', () => {
      if (swapIn) return void swap(k);
      if (d) openDie(d);
    });
    bag.append(b);
  }
  const free = BAG - s.bag.length;
  $('bag-hint').textContent = swapIn ? 'Tap the die it should replace.' : free > 0 ? `${free} empty: a duel fills ${free > 1 ? 'them' : 'it'} with your other dice.` : `The ${BAG} dice you duel with. Tap one to take it out.`;
  // Sammlung
  const coll = $('coll');
  coll.replaceChildren();
  const sorted = [...s.dice].sort((a, b) => rarityIndex(unitOfDie(b).rarity) - rarityIndex(unitOfDie(a).rarity) || b.at - a.at);
  $('coll-count').textContent = `${s.dice.length} dice · ${new Set(s.dice.map(dieSpecies)).size} species`;
  for (const d of sorted) {
    const u = unitOfDie(d);
    const r = rarityDef(u.rarity);
    const c = el('button', `dcard r-${u.rarity}` + (s.bag.includes(d.id) ? ' inbag' : '')) as HTMLButtonElement;
    c.type = 'button';
    c.dataset.id = d.id;
    c.style.setProperty('--c', r.col);
    const g = s.glaze[dieSpecies(d)] ?? 0;
    c.append(art(d, 64), html('span', 'lvb', iconSvg({ k: 'star', n: u.lv }, 14)), el('b', '', shortName(u)), el('small', '', r.label + (g ? ` · ${g} glaze` : '')));
    if (d.no) c.append(el('span', 'serial', serialText(d.no)));
    if (s.bag.includes(d.id)) c.append(el('span', 'bagmark', 'deck'));
    c.addEventListener('click', () => openDie(d));
    coll.append(c);
  }
  if (!s.dice.length) coll.append(el('p', 'empty', 'No dice yet. Dip the brush.'));
}

async function load(): Promise<void> {
  try {
    apply(await api.dice());
  } catch (e) {
    hooks.error(e);
  }
}
function apply(r: DiceResponse): void {
  save = r.dice;
  freeReady = r.freeReady;
  render();
}

/* ---------- Beutel ---------- */
async function swap(slot: number): Promise<void> {
  if (!save || !swapIn || busy) return;
  const ids = [...save.bag];
  if (ids.includes(swapIn)) {
    swapIn = null;
    return render();
  }
  if (slot < ids.length) ids[slot] = swapIn;
  else ids.push(swapIn);
  swapIn = null;
  await packBag(ids);
}
async function packBag(ids: string[]): Promise<void> {
  busy = true;
  sfx.tap();
  try {
    apply(await api.diceBag(ids));
  } catch (e) {
    hooks.error(e);
  }
  busy = false;
  render();
}

/* ---------- Karte eines Würfels, mit Lasur ---------- */
function openDie(d: DieRec): void {
  if (!save) return;
  sfx.tap();
  const s = save;
  const u = unitOfDie(d);
  const r = rarityDef(u.rarity);
  const key = dieSpecies(d);
  const glaze = s.glaze[key] ?? 0;
  const box = $('inspect-body');
  box.replaceChildren();
  const top = el('div', 'card-top');
  const info = el('div', 'card-id');
  const big = art(d, 88);
  big.className = 'dieart';
  big.style.setProperty('--c', r.col);
  info.append(
    el('b', '', u.name),
    html('span', 'lv', `${iconSvg({ k: 'star', n: u.lv }, 15)} Level ${u.lv} · <b class="rlabel" style="color:${r.col}">${r.label}</b>`),
    el('small', '', `${PAPER[u.m.paper].n} · ${speciesLabel(u.m)}`),
    el('small', 'serial-line', d.no ? `${serialText(d.no)} · one of a kind` : 'one of a kind'),
  );
  top.append(big, info);
  const net = html('div', 'card-net', netSvg(u.net, u.faces, 26));
  // Seiten mit Lasur: ein einfaches Symbol wird doppelt
  const faces = el('div', 'faces');
  const canGlaze = glaze >= GLAZE_COST;
  u.faces.forEach((f, i) => {
    const ok = canGlaze && isCrestFace(f) && f.n === 1;
    const b = el('button', 'face' + (ok ? ' can' : '')) as HTMLButtonElement;
    b.type = 'button';
    b.disabled = !ok || busy;
    b.dataset.face = String(i);
    b.title = faceText(f);
    b.innerHTML = iconSvg(f, 30);
    b.addEventListener('click', () => void glazeFace(d, i));
    faces.append(b);
  });
  const kin = s.dice.filter((x) => x !== d && dieSpecies(x) === key).length;
  const gl = el(
    'p',
    'glazeline',
    canGlaze ? `Glaze ${glaze}: tap a single crest to double it (${GLAZE_COST} glaze).` : `Glaze ${glaze}/${GLAZE_COST}. Wash out another ${speciesLabel(u.m)} to gain glaze${kin ? ` (you have ${kin})` : ''}.`,
  );
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
  lines.append(html('p', '', `<b>Die</b> ${u.faces.map(faceText).join(', ')}`));
  for (const k of ['joker', 'gold'] as const) if (u.faces.some((f) => f.k === k)) lines.append(html('p', 'special', FACE_HELP[k]));
  lines.append(html('p', '', `<b>Moves</b> ${GAIT[u.m.bp].text}`), html('p', 'ab', `<b>${ab.name}</b> ${ab.text}`));
  for (const t of u.traits) lines.append(html('p', 'trait', `<b>${t.label}</b> ${t.text}`));
  const row = el('div', 'trow');
  if (s.bag.includes(d.id)) {
    // Im Beutel: herausnehmen
    const b = el('button', 'ghost', 'Take out of deck') as HTMLButtonElement;
    b.type = 'button';
    b.id = 'take-bag';
    b.addEventListener('click', () => {
      $('inspect').hidden = true;
      void packBag(s.bag.filter((x) => x !== d.id));
    });
    row.append(el('span', 'inbag-lbl', 'In your deck'), b);
  } else {
    const b = el('button', 'primary', s.bag.length < BAG ? 'Put in deck' : 'Swap into deck') as HTMLButtonElement;
    b.type = 'button';
    b.id = 'put-bag';
    b.addEventListener('click', () => {
      $('inspect').hidden = true;
      // Freier Platz: gleich hinein. Sonst den Würfel antippen, den er ersetzen soll
      if (s.bag.length < BAG) return void packBag([...s.bag, d.id]);
      swapIn = d.id;
      render();
      $('bag').scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    row.append(b);
  }
  // Auswaschen: der Würfel verschwindet und gibt seiner Art Lasur. Zweimal tippen, damit nichts aus Versehen verschwindet
  const wash = el('div', 'trow wash');
  if (!s.bag.includes(d.id)) {
    const n = washGlaze(u.rarity);
    const wb = el('button', 'ghost danger', washArmed === d.id ? `Tap again: wash out for +${n} glaze` : `Wash out · +${n} glaze`) as HTMLButtonElement;
    wb.type = 'button';
    wb.id = 'wash';
    wb.disabled = busy || s.dice.length <= KEEP_MIN;
    wb.addEventListener('click', () => {
      if (washArmed !== d.id) {
        washArmed = d.id;
        sfx.tap();
        return openDie(d);
      }
      washArmed = null;
      void washOut(d);
    });
    wash.append(wb, el('small', '', s.dice.length <= KEEP_MIN ? `Keep at least ${KEEP_MIN} dice for your deck.` : `It is gone for good. ${speciesLabel(u.m)} gains ${n} glaze.`));
  }
  box.append(top, net, faces, gl, row, stats, lines, wash);
  $('inspect').hidden = false;
}
async function washOut(d: DieRec): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    apply(await api.diceWash(d.id));
    sfx.ability();
    $('inspect').hidden = true;
  } catch (e) {
    hooks.error(e);
  }
  busy = false;
  render();
}
async function glazeFace(d: DieRec, i: number): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    apply(await api.diceGlaze(d.id, i));
    sfx.ability();
    const nd = save?.dice.find((x) => x.id === d.id);
    busy = false;
    if (nd) openDie(nd);
  } catch (e) {
    hooks.error(e);
  }
  busy = false;
}

/* ---------- Ziehen: der Pinsel malt, der offene W100 entscheidet (PixiJS, erst beim Öffnen der Würfel geladen) ---------- */
type Gacha = typeof import('./gacha');
let gachaP: Promise<Gacha> | null = null;
function loadGacha(): Promise<Gacha> {
  gachaP ??= import('./gacha').catch((e: unknown) => {
    gachaP = null;
    throw e;
  });
  return gachaP;
}
let stage: Reveal | null = null;
let animating = false;
/** Die Bühne einmal aufbauen. Ohne WebGL schlägt das fehl, dann gibt es nur die Übersicht */
async function stageReady(): Promise<Reveal> {
  const g = await loadGacha();
  if (!stage) {
    // Schriften vor dem ersten Text laden, sonst malt Pixi mit Ersatzschrift
    await Promise.race([Promise.all(['16px "Young Serif"', '700 16px Figtree', '600 16px "JetBrains Mono"'].map((f) => document.fonts.load(f))).catch(() => undefined), sleep(2500)]);
    const r = new g.Reveal();
    await r.init($('dip-stage'));
    $('dip-stage').addEventListener('pointerdown', () => {
      if (animating && stage) stage.speed = 7;
    });
    stage = r;
  }
  stage.show();
  return stage;
}
function toReveal(p: PullResult): RevealPull {
  const m = dieMonster(p.die);
  const u = dieUnit(m, p.die.mods);
  return { rarity: p.rarity, d100: p.d100, pity: p.pity, monster: m, name: u.name, lv: u.lv, faces: u.faces, dup: !!p.dup, no: p.die.no ?? 0 };
}

async function pull(kind: PullKind): Promise<void> {
  if (busy) return;
  initAudio();
  busy = true;
  render();
  let res: DiceResponse;
  try {
    res = await api.dicePull(kind);
  } catch (e) {
    busy = false;
    render();
    hooks.error(e);
    return;
  }
  const before = save;
  save = res.dice;
  freeReady = res.freeReady;
  await reveal(res.pulls, before);
  busy = false;
  render();
}
async function reveal(pulls: PullResult[], before: DiceSave | null): Promise<void> {
  const ov = $('dip');
  const body = $('dip-body');
  body.replaceChildren();
  body.hidden = true;
  ov.hidden = false;
  let r: Reveal | null = null;
  try {
    r = await stageReady();
  } catch (e) {
    console.warn('dip animation unavailable', e);
  }
  if (r) {
    animating = true;
    $('dip-hint').hidden = false;
    try {
      if (pulls.length > 1) await r.ten(pulls.map(toReveal));
      else await r.single(toReveal(pulls[0]!));
    } catch (e) {
      console.error(e);
    }
    animating = false;
    $('dip-hint').hidden = true;
  }
  body.hidden = false;
  if (pulls.length > 1 || !r) await summary(pulls);
  else await doneBar(pulls[0]!, before);
  r?.hide();
  ov.hidden = true;
  body.replaceChildren();
}
/** Nach einem einzelnen Zug: was daraus wurde, und weiter */
function doneBar(p: PullResult, before: DiceSave | null): Promise<void> {
  return new Promise((done) => {
    const body = $('dip-body');
    body.className = 'dipwrap bar';
    const u = unitOfDie(p.die);
    void before;
    const lines: string[] = [];
    if (p.pity) lines.push(p.pity === 'ten' ? 'Ten dips: Rare or better guaranteed.' : `Bad luck shield: ${rarityDef(p.pity).label} guaranteed.`);
    lines.push(p.dup ? `Another ${speciesLabel(u.m)}, but no other blot looks like this one (${serialText(p.die.no)}).` : `A new species for you: ${speciesLabel(u.m)} ${serialText(p.die.no)}.`);
    const ok = el('button', 'primary', 'Done') as HTMLButtonElement;
    ok.type = 'button';
    ok.id = 'dip-next';
    ok.addEventListener('click', () => {
      sfx.tap();
      done();
    });
    body.append(el('p', 'dnote', lines.join(' ')), ok);
  });
}
function summary(pulls: PullResult[]): Promise<void> {
  return new Promise((done) => {
    const body = $('dip-body');
    body.className = 'dipwrap';
    body.replaceChildren();
    const grid = el('div', 'dsum');
    for (const p of pulls) {
      const u = unitOfDie(p.die);
      const r = rarityDef(p.rarity);
      const c = el('div', `dcard r-${p.rarity}`);
      c.style.setProperty('--c', r.col);
      c.append(art(p.die, 64), html('span', 'lvb', iconSvg({ k: 'star', n: u.lv }, 14)), el('b', '', u.name), el('small', '', `${r.label} · ${p.pity ? 'shield' : `d${p.d100}`}`));
      if (!p.dup) c.append(el('span', 'bagmark new', 'new'));
      grid.append(c);
    }
    const best = pulls.reduce((a, p) => Math.max(a, rarityIndex(p.rarity)), 0);
    sfx.reveal(best);
    const ok = el('button', 'primary', 'Done') as HTMLButtonElement;
    ok.type = 'button';
    ok.id = 'dip-next';
    ok.addEventListener('click', () => {
      sfx.tap();
      done();
    });
    body.append(el('p', 'eyebrow', `${pulls.length} dips`), grid, ok);
  });
}

/* ---------- Einstieg ---------- */
export function initDice(h: Hooks): void {
  hooks = h;
  $('dice-back').addEventListener('click', () => {
    sfx.tap();
    swapIn = null;
    hooks.back();
  });
}
export function openDice(): void {
  swapIn = null;
  washArmed = null;
  render();
  void load();
  // PixiJS schon laden, während man die Würfel ansieht
  void loadGacha().catch(() => undefined);
}
/** Für den Titel: gibt es etwas Freies zu ziehen? */
export async function diceBadge(): Promise<string> {
  try {
    const r = await api.dice();
    save = r.dice;
    freeReady = r.freeReady;
    if (r.dice.starter > 0) return `${r.dice.starter} free`;
    if (r.freeReady) return 'free dip';
    return '';
  } catch {
    return '';
  }
}
