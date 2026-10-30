/*
 * Ziehen zum Anschauen (Artifact): Einzelzug, Zehnerzug, Seltenheit erzwingen, Schutz vor Pech zeigen.
 * Die Würfe sind hier zufällig im Browser, in der App kommen sie vom Server. Nicht Teil des Spiels.
 */
import { renderMonster } from '../../../src/client/renderer/watercolor';
import { initAudio, isMuted, setMuted } from '../../../src/client/duel/sound';
import { LEGENDARY_PAPERS, RARITIES, rarityDef, rarityFromRoll, rarityIndex, serialText, type Rarity } from '../../../src/shared/dice';
import { dieUnit } from '../../../src/shared/duel/rules';
import { humidityFor, makeMonster } from '../../../src/shared/monster';
import { Reveal, type RevealPull } from '../../../src/client/duel/gacha/reveal';

const $ = (id: string) => document.getElementById(id)!;
const rand = (n: number) => Math.floor(Math.random() * n);

/* ---------- Demo-Würfe ---------- */
function monsterFor(r: Rarity) {
  const want = rarityDef(r).paper ?? 'hadern';
  for (let k = 0; k < 4000; k++) {
    const sheet = 'dip-' + Math.random().toString(36).slice(2, 9);
    const m = makeMonster(sheet, rand(12), humidityFor(sheet));
    if (m.paper !== want) continue;
    if (r === 'legendary') m.paper = LEGENDARY_PAPERS[rand(LEGENDARY_PAPERS.length)]!;
    return m;
  }
  throw new Error('no monster');
}
function d100For(r: Rarity): number {
  const d = rarityDef(r);
  return d.from + rand(d.to - d.from + 1);
}
function pullOf(rarity: Rarity, d100: number, pity: RevealPull['pity']): RevealPull {
  const m = monsterFor(rarity);
  const u = dieUnit(m);
  return { rarity, d100, pity, monster: m, name: u.name, lv: u.lv, faces: u.faces, dup: Math.random() < 0.3, no: 1 + rand(99999) };
}
/** Ein Zug: echte Chancen, oder die gewählte Seltenheit. Mit Schild greift der Schutz vor Pech nach einem schwachen Wurf */
function demoPull(force: Rarity | null, shield: boolean): RevealPull {
  if (shield) {
    const r = force && rarityIndex(force) >= 2 ? force : (['rare', 'epic', 'legendary'] as const)[rand(3)]!;
    const pity: RevealPull['pity'] = r === 'rare' || r === 'epic' || r === 'legendary' ? r : null;
    return pullOf(r, 1 + rand(70), pity);
  }
  if (force) return pullOf(force, d100For(force), null);
  const d = 1 + rand(100);
  return pullOf(rarityFromRoll(d), d, null);
}
/** Zehn Züge: mindestens einer Rare oder besser. Eine gewählte Seltenheit kommt einmal vor */
function demoTen(force: Rarity | null): RevealPull[] {
  const ds = Array.from({ length: 10 }, () => 1 + rand(100));
  const ps: (RevealPull | null)[] = ds.map(() => null);
  if (force) {
    const k = rand(10);
    ps[k] = pullOf(force, d100For(force), null);
  }
  let best = Math.max(...ds.map((d, k) => (ps[k] ? rarityIndex(ps[k]!.rarity) : rarityIndex(rarityFromRoll(d)))));
  return ds.map((d, k) => {
    if (ps[k]) return ps[k]!;
    if (best < 2 && k === 9) {
      best = 2;
      return pullOf('rare', d, 'ten');
    }
    return pullOf(rarityFromRoll(d), d, null);
  });
}

/* ---------- Bedienung ---------- */
const reveal = new Reveal();
let force: Rarity | null = null;
let shield = false;
let busy = false;

function chips(): void {
  const box = $('chips');
  const opts: [string, Rarity | null][] = [['Any', null], ...RARITIES.map((r) => [r.label, r.k] as [string, Rarity])];
  for (const [label, k] of opts) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.setAttribute('aria-pressed', String(k === force));
    if (k) b.style.setProperty('--c', rarityDef(k).col);
    b.addEventListener('click', () => {
      force = k;
      for (const x of box.children) x.setAttribute('aria-pressed', String(x === b));
    });
    box.appendChild(b);
  }
}
function setBusy(on: boolean): void {
  busy = on;
  document.body.classList.toggle('busy', on);
  $('skip').hidden = !on;
}
function card(p: RevealPull): HTMLElement {
  const d = rarityDef(p.rarity);
  const el = document.createElement('div');
  el.className = 'mini';
  el.style.setProperty('--c', d.col);
  const c = document.createElement('canvas');
  renderMonster(c, p.monster, 96, { dpr: Math.min(2, window.devicePixelRatio || 1), quality: 'lite' });
  const tag = document.createElement('span');
  tag.className = 'tag' + (p.dup ? ' dup' : '');
  tag.textContent = p.dup ? serialText(p.no) : 'New';
  const n = document.createElement('b');
  n.textContent = p.name;
  const r = document.createElement('small');
  r.textContent = `${d.label} · ${p.d100}`;
  el.append(c, tag, n, r);
  return el;
}

async function run(ten: boolean): Promise<void> {
  if (busy) return;
  initAudio();
  $('intro').hidden = true;
  $('summary').hidden = true;
  setBusy(true);
  try {
    if (ten) {
      const ps = demoTen(force);
      await reveal.ten(ps);
      const grid = $('grid');
      grid.replaceChildren(...ps.map(card));
      setBusy(false);
      $('summary').hidden = false;
    } else {
      await reveal.single(demoPull(force, shield));
    }
  } finally {
    setBusy(false);
    $('dip').textContent = 'Dip again';
  }
}

async function main(): Promise<void> {
  chips();
  const shieldBtn = $('shield');
  shieldBtn.addEventListener('click', () => {
    shield = !shield;
    shieldBtn.setAttribute('aria-pressed', String(shield));
  });
  const soundBtn = $('sound');
  soundBtn.addEventListener('click', () => {
    initAudio();
    setMuted(!isMuted());
    soundBtn.setAttribute('aria-pressed', String(!isMuted()));
    soundBtn.textContent = isMuted() ? 'Sound off' : 'Sound on';
  });
  $('dip').addEventListener('click', () => void run(false));
  $('ten').addEventListener('click', () => void run(true));
  $('close').addEventListener('click', () => ($('summary').hidden = true));
  // Ein Tipp aufs Blatt beschleunigt
  $('stage').addEventListener('pointerdown', () => {
    if (busy) reveal.speed = 7;
  });
  // Schriften vor dem ersten Text laden, sonst malt Pixi mit Ersatzschrift
  try {
    await Promise.race([
      Promise.all(['16px "Young Serif"', '800 16px Figtree', '900 16px Figtree', '700 16px "JetBrains Mono"', '800 16px "JetBrains Mono"'].map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* Ersatzschrift ist ok */
  }
  await reveal.init($('stage'));
  // Für Tests: Bild für Bild weiterschalten
  Object.assign(window, { gacha: reveal });
  document.body.classList.add('ready');
}
void main();
