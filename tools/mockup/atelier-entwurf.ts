/* Entwurf Atelier: Mischauftrag, Karte, gegenseitig benennen (nur für docs/entwuerfe) */
import { renderMonster } from '../../src/client/renderer/watercolor';
import { PIG, type PigmentId } from '../../src/shared/data';
import { humidityFor, makeMonster, statRows, type Monster } from '../../src/shared/monster';
import { RNG } from '../../src/shared/rng';
import { drawPaperStyle, inkWash, pastel } from './stile';

function el(tag: string, cls = '', text = ''): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/* Mischen: gewichtetes geometrisches Mittel in linearem RGB, Wasser hellt zum Papier hin auf */
const lin = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const unlin = (c: number) => Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
function mix(drops: Partial<Record<PigmentId, number>>, water: number): number[] {
  const total = Object.values(drops).reduce((a, b) => a + (b ?? 0), 0);
  const out = [0, 1, 2].map((ch) => {
    let acc = 0;
    for (const [id, n] of Object.entries(drops)) acc += ((n ?? 0) / total) * Math.log(Math.max(1e-4, lin(PIG[id as PigmentId].rgb[ch]!)));
    return Math.exp(acc);
  });
  const w = water / (water + total);
  return out.map((c) => unlin(c + (0.93 - c) * w * 0.9));
}
function lab(rgb: number[]): number[] {
  const [r, g, b] = rgb.map(lin) as [number, number, number];
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047,
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b,
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const deltaE = (a: number[], b: number[]) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]!));

function swatch(rgb: number[], label: string, sub: string): HTMLElement {
  const s = el('div', 'sw');
  const c = document.createElement('canvas');
  c.width = c.height = 240;
  const x = c.getContext('2d')!;
  const r = RNG(rgb[0]! * 7 + rgb[1]! * 13 + rgb[2]!);
  x.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 26; i++) {
    x.fillStyle = `rgba(${rgb},0.09)`;
    x.beginPath();
    const n = 14;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2,
        rad = 82 + (r() - 0.5) * 26;
      const px = 120 + Math.cos(a) * rad,
        py = 120 + Math.sin(a) * rad;
      k ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.closePath();
    x.fill();
  }
  s.append(c, el('b', '', label), el('small', '', sub));
  return s;
}

const tones: Record<string, number[]> = { washi: [244, 239, 226], black: [30, 30, 34] };

function art(m: Monster, style: 'ink' | 'pastel' | 'water', size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.style.width = c.style.height = size + 'px';
  if (style === 'water') {
    renderMonster(c, m, size, { dpr: 2 });
    c.style.width = c.style.height = size + 'px';
    return c;
  }
  const S = size * 2;
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  drawPaperStyle(ctx, S, style === 'ink' ? 'washi' : 'black', RNG(m.seed));
  if (style === 'ink') inkWash(ctx, m, S);
  else pastel(ctx, m, S);
  void tones;
  return c;
}

/* 1: Auftrag des Tages */
function commission(): HTMLElement {
  const p = el('section', 'phone');
  p.append(el('div', 'eyebrow', 'Commission #12 · Oct 29'), el('div', 'title', 'The colour of a pond after rain'));
  const drops = { indigo: 2, siena: 1, kadmium: 2 } as const;
  const mine = mix(drops, 2);
  const target = [mine[0]! - 9, mine[1]! + 4, mine[2]! + 3];
  const dE = deltaE(target, mine);
  const sws = el('div', 'sws');
  sws.append(swatch(target, 'Sepia’s', 'the commission'), swatch(mine, 'Yours', `ΔE ${dE.toFixed(1)} · ★★★☆`));
  p.append(sws);
  const pal = el('div', 'palette');
  pal.append(el('small', '', 'Today’s palette'));
  const wells = el('div', 'wells');
  for (const [id, n] of [['indigo', 2], ['siena', 1], ['kadmium', 2], ['water', 2]] as [string, number][]) {
    const w = el('button', 'well');
    const d = el('span', 'blob');
    d.style.background = id === 'water' ? 'radial-gradient(circle at 35% 35%, #fff, #cfe3f2)' : `rgb(${PIG[id as PigmentId].rgb})`;
    w.append(d, el('b', '', id === 'water' ? 'Water' : PIG[id as PigmentId].n), el('span', 'n', '×' + n));
    wells.append(w);
  }
  pal.append(wells);
  p.append(pal);
  const used = el('div', 'drops');
  used.append(el('small', '', 'Drops 7 of 10'));
  const seq = ['indigo', 'kadmium', 'indigo', 'water', 'siena', 'kadmium', 'water'];
  for (const id of seq) {
    const i = el('i');
    i.style.background = id === 'water' ? '#cfe3f2' : `rgb(${PIG[id as PigmentId].rgb})`;
    used.append(i);
  }
  for (let k = seq.length; k < 10; k++) used.append(el('i', 'empty'));
  p.append(used);
  const act = el('div', 'acts');
  act.append(el('button', 'btn', 'Undo'), el('button', 'btn primary', 'Pour it before it dries'));
  p.append(act);
  const sep = el('div', 'sepia');
  sep.append(el('small', '', 'Master Sepia'), el('p', '', 'Close. The pond is less hopeful than that.'));
  p.append(sep);
  p.append(el('div', 'board', 'Today: 1,204 painters · your ΔE ranks 87th · streak 6 wet days'));
  return p;
}

/* 2: Die Karte */
function card(): HTMLElement {
  const p = el('section', 'phone');
  p.append(el('div', 'eyebrow', 'It dried into'), el('div', 'title small', 'A card nobody else has'));
  const m = makeMonster('Card-4217', 4, humidityFor('Card-4217'));
  const c = el('div', 'card rare');
  const head = el('div', 'chead');
  head.append(el('b', '', 'Untitled, the crowd decides'), el('span', 'serial', 'No. 004 217'));
  c.append(head, el('div', 'cmeta', 'Ink Wash on Washi · Oct 29, 2026 · u/Vegavild'));
  const a = art(m, 'ink', 300);
  a.className = 'cart';
  c.append(a);
  const q = el('div', 'quals');
  for (const s of statRows(m)) {
    const row = el('div', 'q');
    const bar = el('span', 'bar');
    const i = el('i');
    i.style.width = Math.round((s.total / 70) * 100) + '%';
    bar.append(i);
    row.append(el('span', 'ql', s.n), bar, el('span', 'qv', `${s.total}`), el('em', '', `d${s.roll}`));
    q.append(row);
  }
  c.append(q);
  const st = el('div', 'stamps');
  st.append(el('span', 'stamp', 'Salt Crystals'), el('span', 'stamp gold', 'First of its kind'), el('span', 'stamp', 'Seal 7F'));
  c.append(st);
  c.append(el('div', 'crit', '“Grain: commendable. Courage: absent.” — Sepia'.replace(' — ', ', ')));
  p.append(c);
  const act = el('div', 'acts');
  act.append(el('button', 'btn', 'Hang in the Salon'), el('button', 'btn primary', 'Ask Reddit: what do you see?'));
  p.append(act);
  return p;
}

/* 3: Was siehst du? Die anderen benennen */
function crowd(): HTMLElement {
  const p = el('section', 'phone');
  p.append(el('div', 'eyebrow', 'What do you see? · 3 of 5'), el('div', 'title small', 'u/inkfox poured this an hour ago'));
  const m = makeMonster('Crowd-88', 9, humidityFor('Crowd-88'));
  const a = art(m, 'pastel', 300);
  a.className = 'cart solo';
  p.append(a);
  const tiles = (words: string[], picked: string) => {
    const t = el('div', 'tiles');
    for (const w of words) t.append(el('button', 'tile' + (w === picked ? ' on' : ''), w));
    return t;
  };
  p.append(el('small', 'lbl', 'Pick a word'), tiles(['Polite', 'Damp', 'Furious', 'Ancient', 'Tiny', 'Sleepy'], 'Sleepy'), el('small', 'lbl', 'and a thing'), tiles(['Moth', 'Teacup', 'Uncle', 'Cloud', 'Lantern', 'Spoon'], 'Cloud'));
  const res = el('div', 'result');
  res.append(el('b', '', 'Most see: Sleepy Cloud (38%)'), el('span', '', 'You matched the crowd. +2 pigment · your eye: 41 matches'));
  p.append(res);
  p.append(el('button', 'btn primary wide', 'Next blot'));
  return p;
}

document.body.append(commission(), card(), crowd());
(window as unknown as { done: boolean }).done = true;
