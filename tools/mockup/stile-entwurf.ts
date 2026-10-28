/* Entwurfsbogen: ein Klecks in acht Stilen auf acht Papieren (nur für docs/entwuerfe) */
import { renderMonster } from '../../src/client/renderer/watercolor';
import { humidityFor, makeMonster, type Monster } from '../../src/shared/monster';
import { RNG } from '../../src/shared/rng';
import { charcoal, drawPaperStyle, gouache, inkWash, linocut, pastel, PAPER_NAMES, PAPER_TONE, risograph, rorschach, type PaperStyle } from './stile';

const SIZE = 300;
const S = SIZE * 2;

type Tile = { style: string; rarity: string; paper: string; draw: (c: HTMLCanvasElement, m: Monster) => void };

function onPaper(kind: PaperStyle, fn: (ctx: CanvasRenderingContext2D, m: Monster) => void) {
  return (c: HTMLCanvasElement, m: Monster) => {
    c.width = c.height = S;
    const ctx = c.getContext('2d')!;
    drawPaperStyle(ctx, S, kind, RNG(m.seed ^ 0x51ed));
    fn(ctx, m);
  };
}

const tiles: Tile[] = [
  { style: 'Watercolor', rarity: 'common', paper: 'Cotton Rag', draw: (c, m) => renderMonster(c, { ...m, paper: 'hadern' }, SIZE, { dpr: 2 }) },
  { style: 'Ink Wash', rarity: 'uncommon', paper: PAPER_NAMES.washi, draw: onPaper('washi', (ctx, m) => inkWash(ctx, m, S)) },
  { style: 'Gouache', rarity: 'uncommon', paper: PAPER_NAMES.kraft, draw: onPaper('kraft', (ctx, m) => gouache(ctx, m, S, 'kraft')) },
  { style: 'Charcoal', rarity: 'common', paper: PAPER_NAMES.graph, draw: onPaper('graph', (ctx, m) => charcoal(ctx, m, S)) },
  { style: 'Pastel', rarity: 'rare', paper: PAPER_NAMES.black, draw: onPaper('black', (ctx, m) => pastel(ctx, m, S)) },
  { style: 'Linocut', rarity: 'rare', paper: PAPER_NAMES.parchment, draw: onPaper('parchment', (ctx, m) => linocut(ctx, m, S, PAPER_TONE.parchment)) },
  { style: 'Risograph', rarity: 'epic', paper: PAPER_NAMES.newsprint, draw: onPaper('newsprint', (ctx, m) => risograph(ctx, m, S)) },
  { style: 'Rorschach Fold', rarity: 'legendary', paper: 'Student Paper', draw: (c, m) => rorschach(c, m, SIZE) },
];

const params = new URLSearchParams(location.search);
const sheet = params.get('sheet') ?? 'B7';
const idx = Number(params.get('idx') ?? 3);
const same = makeMonster(sheet, idx, humidityFor(sheet));
const varied = params.get('varied') === '1';

const grid = document.createElement('div');
grid.className = 'grid';
tiles.forEach((t, i) => {
  const m = varied ? makeMonster('V' + i * 37, i, humidityFor('V' + i * 37)) : same;
  const card = document.createElement('figure');
  const c = document.createElement('canvas');
  c.style.width = c.style.height = SIZE + 'px';
  t.draw(c, m);
  c.style.width = c.style.height = SIZE + 'px';
  const cap = document.createElement('figcaption');
  const b = document.createElement('b');
  b.textContent = t.style;
  const r = document.createElement('span');
  r.className = 'rar ' + t.rarity;
  r.textContent = t.rarity;
  const p = document.createElement('small');
  p.textContent = 'on ' + t.paper;
  cap.append(b, r, p);
  card.append(c, cap);
  grid.append(card);
});
const h = document.createElement('header');
h.innerHTML = varied ? '<p>Entwurf · Stile und Papiere</p><h1>Every blot, its own hand</h1>' : '<p>Entwurf · Stile und Papiere</p><h1>One blot, eight hands</h1>';
document.body.append(h, grid);
(window as unknown as { done: boolean }).done = true;
