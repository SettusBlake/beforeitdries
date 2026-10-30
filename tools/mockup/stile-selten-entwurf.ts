/* Entwurfsbogen: seltene Stile (Shiny) für einzigartige Kleckse (nur für docs/entwuerfe) */
import { renderMonster } from '../../src/client/renderer/watercolor';
import { BP, PIG } from '../../src/shared/data';
import { humidityFor, makeMonster, type Monster } from '../../src/shared/monster';
import { comic, oil, pencil, plate } from './stile-selten';
import { anime2 } from '../../src/client/renderer/styles-more';

type Tile = { style: string; tag: string; odds: string; draw: (c: HTMLCanvasElement, m: Monster, size: number) => void };

function canvasOf(c: HTMLCanvasElement, size: number): CanvasRenderingContext2D {
  c.width = c.height = size * 2;
  return c.getContext('2d')!;
}
const serial = (m: Monster): string => '#' + String(m.seed % 100000).padStart(5, '0');

const tiles: Tile[] = [
  { style: 'Watercolor', tag: 'normal', odds: '99 in 100 dips', draw: (c, m, s) => renderMonster(c, m, s, { dpr: 2 }) },
  { style: 'Pencil', tag: 'shiny', odds: '1 in 333 dips', draw: (c, m, s) => pencil(canvasOf(c, s), m, s * 2, `${m.name.toLowerCase()}, ${serial(m)}`) },
  { style: 'Comic', tag: 'shiny', odds: '1 in 500 dips', draw: (c, m, s) => comic(canvasOf(c, s), m, s * 2, `${m.name.toUpperCase()}!`) },
  { style: 'Bestiary Plate', tag: 'shiny', odds: '1 in 500 dips', draw: (c, m, s) => plate(canvasOf(c, s), m, s * 2) },
  { style: 'Anime', tag: 'shiny', odds: '1 in 500 dips', draw: (c, m, s) => anime2(canvasOf(c, s), m, s * 2, 'sky', false) },
  { style: 'Oil', tag: 'shiny', odds: '1 in 1000 dips', draw: (c, m, s) => oil(canvasOf(c, s), m, s * 2, `${m.name}  ${serial(m)}`) },
];

const params = new URLSearchParams(location.search);
const mon = (sheet: string, idx: number): Monster => makeMonster(sheet, idx, humidityFor(sheet));

function figure(t: Tile, m: Monster, size: number, small: boolean): HTMLElement {
  const card = document.createElement('figure');
  const c = document.createElement('canvas');
  t.draw(c, m, size);
  c.style.width = c.style.height = size + 'px';
  const cap = document.createElement('figcaption');
  const b = document.createElement('b');
  b.textContent = small ? m.name : t.style;
  const r = document.createElement('span');
  r.className = 'rar ' + t.tag;
  r.textContent = small ? t.style : t.tag;
  const p = document.createElement('small');
  p.textContent = small ? `${PIG[m.main].n} ${BP[m.bp].n}` : t.odds;
  cap.append(b, r, p);
  card.append(c, cap);
  return card;
}

async function main(): Promise<void> {
  await Promise.all(['40px Caveat', '400 20px "Young Serif"', 'italic 20px "Young Serif"', '900 20px Figtree'].map((f) => document.fonts.load(f)));
  if (params.get('pick')) {
    const grid = document.createElement('div');
    grid.className = 'grid pick';
    for (let i = 0; i < 40; i++) {
      const sheet = 'P' + (i * 7 + Number(params.get('pick')));
      const m = mon(sheet, i % 12);
      const card = document.createElement('figure');
      const c = document.createElement('canvas');
      renderMonster(c, m, 150, { dpr: 1 });
      const cap = document.createElement('figcaption');
      cap.textContent = `${sheet}/${i % 12} ${m.bp} ${m.face.extra}`;
      card.append(c, cap);
      grid.append(card);
    }
    document.body.append(grid);
  } else {
    const hero = mon(params.get('sheet') ?? 'P31', Number(params.get('idx') ?? 4));
    const h1 = document.createElement('header');
    h1.innerHTML = '<p>Entwurf · seltene Stile (Shiny)</p><h1>One blot, six hands</h1>';
    const g1 = document.createElement('div');
    g1.className = 'grid big';
    for (const t of tiles) g1.append(figure(t, hero, 400, false));
    const h2 = document.createElement('header');
    h2.innerHTML = '<p>Entwurf · jeder Stil auf anderen Klecksen</p><h1>Every blot, its own hand</h1>';
    const g2 = document.createElement('div');
    g2.className = 'grid small';
    const others = (params.get('others') ?? 'Q1/0,Q2/5,Q3/8,Q4/2,Q5/10,Q6/3,Q7/6,Q8/9,Q9/1,Q10/11').split(',').map((s) => {
      const [sh, ix] = s.split('/');
      return mon(sh!, Number(ix));
    });
    for (let row = 0; row < 2; row++) for (let k = 1; k < tiles.length; k++) g2.append(figure(tiles[k]!, others[row * 5 + k - 1]!, 232, true));
    document.body.append(h1, g1, h2, g2);
  }
  (window as unknown as { done: boolean }).done = true;
}
void main();
