/*
 * Entwurfsbogen „Ohne geschlossene Form“ (nur für docs/entwuerfe): fünf Zeichnungen nur aus offenen Linien,
 * jeweils die Striche und dreimal gemalt: bisher (längster Strich wird Fläche), Pinselstrich, Lavierung.
 */
import { renderMonster } from '../../src/client/renderer/watercolor';
import type { Pt } from '../../src/shared/data';
import { encodeDrawing, OPEN, parts, type Drawing, type OpenMode } from '../../src/shared/drawn';
import { humidityFor, makeMonster } from '../../src/shared/monster';
import { RNG } from '../../src/shared/rng';

const r = RNG(31102026);
const rr = (a: number, b: number) => a + (b - a) * r();
/** Fingerstrich: Grundlinie plus Schwanken plus feines Zittern */
function hand(fn: (t: number) => Pt, n = 50, wob = 0.006): Pt[] {
  const p1 = rr(0, 6.3),
    f1 = rr(1.5, 3);
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const [x, y] = fn(t);
    return [x + Math.sin(t * 6.28 * f1 + p1) * wob + (r() - 0.5) * 0.003, y + Math.cos(t * 6.28 * f1 + p1) * wob + (r() - 0.5) * 0.003] as Pt;
  });
}
const line = (a: Pt, b: Pt) => (t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number) => (t: number): Pt => [cx + Math.cos(a0 + (a1 - a0) * t) * rx, cy + Math.sin(a0 + (a1 - a0) * t) * ry];
function through(ps: Pt[]): (t: number) => Pt {
  return (t) => {
    const n = ps.length - 1,
      u = Math.min(t * n, n - 1e-9),
      i = Math.floor(u),
      f = u - i;
    const p0 = ps[Math.max(i - 1, 0)]!,
      p1 = ps[i]!,
      p2 = ps[i + 1]!,
      p3 = ps[Math.min(i + 2, n)]!;
    const c = (a: number, b: number, c2: number, d: number) => 0.5 * (2 * b + (-a + c2) * f + (2 * a - 5 * b + 4 * c2 - d) * f * f + (-a + 3 * b - 3 * c2 + d) * f * f * f);
    return [c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])];
  };
}

type Ex = { name: string; note: string; d: Drawing };
const EX: Ex[] = [
  {
    name: 'Stick creature',
    note: 'back, four legs, neck, open head, tail',
    d: {
      mirror: false,
      face: null,
      strokes: [
        hand(through([[0.3, 0.5], [0.45, 0.45], [0.6, 0.47], [0.72, 0.5]])),
        ...[0.33, 0.42, 0.6, 0.69].map((x) => hand(line([x, 0.49], [x + rr(-0.03, 0.03), 0.72]), 14)),
        hand(through([[0.3, 0.5], [0.24, 0.4], [0.22, 0.32]]), 20),
        hand(arc(0.2, 0.26, 0.07, 0.06, 0.9, 5.3), 30),
        hand(through([[0.72, 0.5], [0.82, 0.42], [0.85, 0.3], [0.8, 0.27]]), 26),
      ],
    },
  },
  {
    name: 'Coral',
    note: 'a trunk and branches, nothing closed',
    d: {
      mirror: false,
      face: null,
      strokes: [
        hand(through([[0.5, 0.88], [0.48, 0.65], [0.52, 0.45], [0.5, 0.2]]), 40),
        hand(through([[0.49, 0.66], [0.36, 0.55], [0.28, 0.38], [0.3, 0.28]]), 30),
        hand(through([[0.51, 0.55], [0.65, 0.46], [0.72, 0.3]]), 26),
        hand(through([[0.33, 0.47], [0.2, 0.44], [0.15, 0.33]]), 18),
        hand(through([[0.66, 0.44], [0.8, 0.45], [0.86, 0.36]]), 18),
      ],
    },
  },
  {
    name: 'Snake',
    note: 'one long S, a forked tongue',
    d: { mirror: false, face: null, strokes: [hand(through([[0.2, 0.25], [0.5, 0.2], [0.7, 0.35], [0.45, 0.55], [0.3, 0.7], [0.55, 0.85], [0.82, 0.8]]), 90), hand(through([[0.2, 0.25], [0.12, 0.24], [0.08, 0.2]]), 10), hand(line([0.12, 0.24], [0.08, 0.29]), 8)] },
  },
  {
    name: 'Moth (Mirror)',
    note: 'half a wing that stops short of the middle, a feeler',
    d: { mirror: true, face: null, strokes: [hand(through([[0.47, 0.35], [0.3, 0.2], [0.12, 0.3], [0.2, 0.5], [0.12, 0.7], [0.25, 0.8], [0.3, 0.68]]), 70), hand(through([[0.48, 0.3], [0.43, 0.15], [0.38, 0.1]]), 14)] },
  },
  {
    name: 'Doodle (Mirror)',
    note: 'half a head with a gap, an eye, half a grin',
    d: { mirror: true, face: null, strokes: [hand(arc(0.5, 0.5, 0.32, 0.3, 2.2, 4.3), 50), hand(line([0.38, 0.42], [0.4, 0.46]), 6), hand(arc(0.5, 0.58, 0.14, 0.08, 1.6, 2.9), 20)] },
  },
];
const MODES: { k: OpenMode; label: string }[] = [
  { k: 'close', label: 'Today: longest line becomes the body' },
  { k: 'brush', label: 'A · Brush: every line a broad wet stroke' },
  { k: 'wash', label: 'B · Line and wash: ink lines, loose wash behind' },
];

function sketch(d: Drawing, px: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = px * 2;
  c.style.width = c.style.height = px + 'px';
  const x = c.getContext('2d')!;
  x.setTransform(px * 2, 0, 0, px * 2, 0, 0);
  x.fillStyle = '#fbfaf6';
  x.fillRect(0, 0, 1, 1);
  if (d.mirror) {
    x.strokeStyle = 'rgba(43,63,163,.35)';
    x.lineWidth = 1 / px;
    x.setLineDash([4 / px, 4 / px]);
    x.beginPath();
    x.moveTo(0.5, 0.03);
    x.lineTo(0.5, 0.97);
    x.stroke();
    x.setLineDash([]);
  }
  x.lineCap = x.lineJoin = 'round';
  x.lineWidth = 2.4 / px;
  x.strokeStyle = 'rgba(40,40,46,.85)';
  for (const p of parts(d)) {
    x.beginPath();
    p.pts.forEach((q, i) => (i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])));
    x.stroke();
  }
  return c;
}

const PX = 200;
const grid = document.getElementById('grid')!;
const head = document.createElement('div');
head.className = 'row head';
head.append(Object.assign(document.createElement('div'), { textContent: 'What you draw' }), ...MODES.map((m) => Object.assign(document.createElement('div'), { textContent: m.label })));
grid.append(head);
EX.forEach((ex, i) => {
  const row = document.createElement('div');
  row.className = 'row';
  const cell = (el: HTMLElement, cap?: string) => {
    const w = document.createElement('div');
    w.className = 'cell';
    w.append(el);
    if (cap) w.append(Object.assign(document.createElement('p'), { className: 'cap', textContent: cap }));
    return w;
  };
  row.append(cell(sketch(ex.d, PX), `${ex.name} · ${ex.note}`));
  for (const mo of MODES) {
    OPEN.mode = mo.k;
    const sheet = `OPEN-${i * 7 + 3}`;
    const m = makeMonster(sheet, (i * 5) % 12, humidityFor(sheet));
    m.gen = 2;
    m.draw = encodeDrawing(ex.d);
    const c = document.createElement('canvas');
    renderMonster(c, m, PX, { dpr: 2 });
    c.style.width = c.style.height = PX + 'px';
    row.append(cell(c));
  }
  grid.append(row);
});
OPEN.mode = 'close';
(window as unknown as { done: boolean }).done = true;
