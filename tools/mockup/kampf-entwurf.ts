/* Entwurfsbild Kampf (nur für docs/entwuerfe, nicht im Spiel). Zeichnet zwei Handy-Bildschirme mit dem echten Renderer. */
import { renderMonster } from '../../src/client/renderer/watercolor';
import { BP, PIG, type PigmentId } from '../../src/shared/data';
import { relation } from '../../src/shared/glaze';
import { humidityFor, makeMonster, statRows, type Monster } from '../../src/shared/monster';

const hp = (m: Monster) => 30 + statRows(m)[0]!.total * 3;
const mk = (sheet: string, idx: number) => makeMonster(sheet, idx, humidityFor(sheet));
/** Erstes Monster mit diesem Bauplan und Hauptpigment */
function find(bp: string, main: string): Monster {
  for (let i = 0; i < 20000; i++) {
    const m = mk('M' + i, i % 12);
    if (m.bp === bp && m.main === main) return m;
  }
  throw new Error(bp + main);
}
const MOVES: Record<string, string> = { kriecher: 'Seep', flatterer: 'Flick', schwebeblase: 'Drift', vierbeiner: 'Charge', schlange: 'Coil', turm: 'Stack', krabbe: 'Pinch', qualle: 'Trail', huepfer: 'Hop', knolle: 'Root', strahler: 'Radiate', doppelkopf: 'Twin bite' };

function el(tag: string, cls = '', text = ''): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function blot(m: Monster, size: number, bleached = false): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.className = 'blot' + (bleached ? ' bleached' : '');
  c.style.width = c.style.height = size + 'px';
  renderMonster(c, m, size, { dpr: 2 });
  return c;
}

function unit(m: Monster, name: string, cur: number, size: number, opts: { bleached?: boolean; active?: boolean; status?: string; max?: number } = {}): HTMLElement {
  const max = opts.max ?? hp(m);
  const u = el('div', 'unit' + (opts.active ? ' active' : ''));
  u.append(blot(m, size, opts.bleached));
  u.append(el('div', 'uname', name));
  const bar = el('div', 'hp');
  const fill = el('i');
  fill.style.width = Math.round((cur / max) * 100) + '%';
  bar.append(fill);
  u.append(bar);
  const meta = el('div', 'umeta');
  const dot = el('span', 'dot');
  dot.style.background = `rgb(${PIG[m.main].rgb})`;
  meta.append(dot, `${cur}/${max}`);
  if (opts.status) meta.append(el('span', 'st', opts.status));
  u.append(meta);
  return u;
}

function water(n: number, max = 6): HTMLElement {
  const w = el('div', 'water');
  w.append(el('small', '', 'Water'));
  for (let i = 0; i < max; i++) w.append(el('i', i < n ? 'on' : ''));
  return w;
}

function actions(list: [string, string, string, boolean?][]): HTMLElement {
  const a = el('div', 'actions');
  for (const [name, cost, desc, primary] of list) {
    const b = el('button', 'act' + (primary ? ' primary' : ''));
    b.append(el('b', '', name), el('span', 'cost', cost), el('small', '', desc));
    a.append(b);
  }
  return a;
}

const relLabel = (a: PigmentId, b: PigmentId) => {
  const r = relation(a, b);
  return r === 'komplementaer' ? 'complementary ×1.5' : r === 'neutral' ? 'neutral ×1' : 'harmonious ×0.75';
};

/* Team und Gegner */
const team = [find('kriecher', 'kadmium'), find('schlange', 'ultra'), find('huepfer', 'phthalo')];
const foes = [find('qualle', 'karmin'), find('krabbe', 'siena'), find('flatterer', 'indigo')];
const wild = mk('2026-10-28', 0);
const tn = (m: Monster) => `${PIG[m.main].n.split(' ')[0]} ${BP[m.bp].n}`;

/* Bildschirm 1: Fangen */
function catchScreen(): HTMLElement {
  const s = el('section', 'phone');
  const paperMalus: Record<string, number> = { schul: 0, zeichen: 5, buetten: 10, hadern: 20 };
  const press = Math.max(5, Math.round(20 + 70 * 0.66 - paperMalus[wild.paper]!));
  const top = el('div', 'top');
  top.append(el('div', 'eyebrow', 'Today’s blot · Oct 28'), el('div', 'title', 'Catch it before it dries'));
  s.append(top);
  const wet = el('div', 'wet');
  wet.append(el('small', '', 'Wet'));
  for (let i = 0; i < 6; i++) wet.append(el('i', i < 3 ? 'on' : ''));
  wet.append(el('span', '', '3 rounds left · humidity 79%'));
  s.append(wet);
  const w = el('div', 'wild');
  const max = hp(wild) * 2;
  w.append(unit(wild, 'Unnamed Opera Rose Tower', Math.round(max * 0.34), 176, { max }));
  s.append(w);
  const dice = el('div', 'dice');
  dice.append(el('small', '', 'Its dice'));
  for (const r of statRows(wild)) dice.append(el('span', 'die', `${r.short} d${r.roll}`));
  s.append(dice);
  const odds = el('div', 'odds');
  odds.append(el('b', '', `Press the paper: ${press}%`), el('span', '', 'At 0 opacity it washes out. Blotting paper 2 of 3.'));
  s.append(odds);
  const row = el('div', 'row');
  row.append(unit(team[0]!, tn(team[0]!), 61, 92, { active: true }), unit(team[1]!, tn(team[1]!), 88, 92), unit(team[2]!, tn(team[2]!), 40, 92));
  s.append(row);
  s.append(water(4));
  s.append(
    actions([
      ['Press', '0', `catch, ${press}%`, true],
      ['Dry brush', '0 → +1', relLabel(team[0]!.main, wild.main)],
      ['Wet-in-wet', '2', 'all, Glow'],
      [MOVES[team[0]!.bp]!, '1', `${BP[team[0]!.bp].n} move`],
    ]),
  );
  return s;
}

/* Bildschirm 2: Rand */
function edgeScreen(): HTMLElement {
  const s = el('section', 'phone');
  const top = el('div', 'top');
  top.append(el('div', 'eyebrow', 'The Edge · fight 3 of 4 · round 2'), el('div', 'title', 'Repaint what was erased'));
  s.append(top);
  const foesRow = el('div', 'row');
  foesRow.append(
    unit(foes[0]!, 'Bleached ' + BP[foes[0]!.bp].n, 34, 96, { bleached: true, status: 'stained 2' }),
    unit(foes[1]!, 'Bleached ' + BP[foes[1]!.bp].n, 77, 96, { bleached: true }),
    unit(foes[2]!, 'Bleached ' + BP[foes[2]!.bp].n, 58, 96, { bleached: true, status: 'slowed' }),
  );
  s.append(foesRow);
  const log = el('div', 'log');
  const a = team[1]!,
    t = foes[0]!;
  log.append(
    el('div', '', `${tn(a)} dry-brushes Bleached ${BP[t.bp].n}: d17, ${relLabel(a.main, t.main)} → 27 opacity back to color.`),
    el('div', 'muted', `Bleached ${BP[foes[1]!.bp].n} bleaches ${tn(team[2]!)}: Saturation -20% for 2 rounds (Lightfastness held: no).`),
  );
  s.append(log);
  const row = el('div', 'row');
  row.append(unit(team[0]!, tn(team[0]!), 61, 92), unit(team[1]!, tn(team[1]!), 88, 92, { active: true }), unit(team[2]!, tn(team[2]!), 40, 92, { status: 'bleached' }));
  s.append(row);
  s.append(water(2));
  s.append(
    actions([
      ['Dry brush', '0 → +1', relLabel(a.main, t.main)],
      ['Wet-in-wet', '2', 'all three, Glow'],
      ['Lift', '1', 'heal one, clear stains'],
      [MOVES[a.bp]!, '2', `${BP[a.bp].n} move`],
    ]),
  );
  const sep = el('div', 'sepia');
  sep.append(el('small', '', 'Master Sepia'), el('p', '', 'Two drops left. Spend them, or listen to the water.'));
  s.append(sep);
  return s;
}

document.body.append(catchScreen(), edgeScreen());
(window as unknown as { done: boolean }).done = true;
