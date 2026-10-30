/*
 * Entwurfsbogen „Selbst malen“ (nur für docs/entwuerfe): links der Zeichenbildschirm,
 * rechts gezeichnete Striche und dieselbe Zeichnung dreimal gemalt mit verschiedenen Würfen.
 * Die Striche sind nachgemachte Fingerzeichnungen (Zittern, nicht ganz geschlossen).
 */
import { renderMonster } from '../../src/client/renderer/watercolor';
import { BP, type Geometry, type PaperId, type Pt } from '../../src/shared/data';
import { decodeDrawing, drawnGeometry, encodeDrawing, parts, type Drawing } from '../../src/shared/drawn';
import { humidityFor, makeMonster } from '../../src/shared/monster';
import { RNG } from '../../src/shared/rng';

const r = RNG(20261030);
const rr = (a: number, b: number) => a + (b - a) * r();

/** Fingerstrich: Grundlinie plus langsames Schwanken plus feines Zittern */
function hand(fn: (t: number) => Pt, n = 60, wob = 0.008, gap = 0): Pt[] {
  const p1 = rr(0, 6.3),
    p2 = rr(0, 6.3),
    f1 = rr(1.5, 3),
    f2 = rr(1.5, 3);
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * (1 - gap);
    const [x, y] = fn(t);
    out.push([x + Math.sin(t * 6.28 * f1 + p1) * wob + (r() - 0.5) * 0.003, y + Math.sin(t * 6.28 * f2 + p2) * wob + (r() - 0.5) * 0.003]);
  }
  return out;
}
const ell = (cx: number, cy: number, rx: number, ry: number, a0 = 0) => (t: number): Pt => [cx + Math.cos(a0 + t * 6.283) * rx, cy + Math.sin(a0 + t * 6.283) * ry];
const line = (a: Pt, b: Pt) => (t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** Glatter Weg durch Punkte (Catmull-Rom) */
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
const closedThrough = (ps: Pt[]) => through([...ps, ps[0]!]);

type Ex = { name: string; note: string; d: Drawing };
const EX: Ex[] = [
  {
    name: 'Cat',
    note: 'head, body, tail, legs, whiskers · eyes tapped on the head',
    d: {
      mirror: false,
      face: [0.27, 0.4],
      strokes: [
        hand(ell(0.54, 0.6, 0.24, 0.12, 3.3), 70, 0.008, 0.03),
        hand(closedThrough([[0.17, 0.42], [0.17, 0.26], [0.22, 0.33], [0.32, 0.33], [0.37, 0.25], [0.38, 0.42], [0.33, 0.5], [0.22, 0.5]]), 70, 0.006, 0.02),
        hand(through([[0.77, 0.56], [0.86, 0.48], [0.88, 0.34], [0.82, 0.28], [0.78, 0.33]]), 30, 0.006),
        ...[0.38, 0.47, 0.62, 0.71].map((x) => hand(line([x, 0.69], [x + rr(-0.02, 0.02), 0.85]), 12, 0.004)),
        hand(line([0.2, 0.45], [0.07, 0.42]), 10, 0.003),
        hand(line([0.2, 0.47], [0.08, 0.5]), 10, 0.003),
        hand(line([0.34, 0.45], [0.46, 0.41]), 10, 0.003),
      ],
    },
  },
  {
    name: 'Rorschach moth',
    note: 'mirror on · one half drawn, closes on the middle line',
    d: {
      mirror: true,
      face: [0.5, 0.33],
      strokes: [
        hand(through([[0.5, 0.32], [0.3, 0.2], [0.12, 0.22], [0.15, 0.48], [0.3, 0.58], [0.18, 0.74], [0.3, 0.86], [0.44, 0.76], [0.5, 0.66]]), 80, 0.007),
        hand(ell(0.5, 0.48, 0.045, 0.2), 50, 0.004, 0.02),
        hand(ell(0.27, 0.4, 0.06, 0.06), 30, 0.004, 0.04),
        hand(through([[0.47, 0.3], [0.42, 0.18], [0.36, 0.1], [0.33, 0.13]]), 20, 0.004),
      ],
    },
  },
  {
    name: 'Teapot bot',
    note: 'boxes and a spout · face found by itself',
    d: {
      mirror: false,
      face: null,
      strokes: [
        hand(closedThrough([[0.3, 0.44], [0.7, 0.43], [0.71, 0.72], [0.31, 0.73]]), 70, 0.006, 0.02),
        hand(closedThrough([[0.37, 0.43], [0.42, 0.35], [0.58, 0.35], [0.63, 0.43]]), 40, 0.004, 0.03),
        hand(ell(0.5, 0.31, 0.03, 0.025), 20, 0.003, 0.05),
        hand(closedThrough([[0.7, 0.52], [0.84, 0.38], [0.89, 0.4], [0.71, 0.62]]), 40, 0.004, 0.02),
        hand(through([[0.31, 0.48], [0.2, 0.5], [0.17, 0.58], [0.21, 0.66], [0.31, 0.67]]), 30, 0.004),
        hand(line([0.41, 0.73], [0.38, 0.86]), 12, 0.003),
        hand(line([0.6, 0.73], [0.63, 0.86]), 12, 0.003),
        hand(line([0.33, 0.87], [0.42, 0.87]), 8, 0.002),
        hand(line([0.6, 0.87], [0.69, 0.87]), 8, 0.002),
        hand(through([[0.5, 0.29], [0.52, 0.2], [0.58, 0.15]]), 12, 0.003),
      ],
    },
  },
  {
    name: 'Fish',
    note: 'body, tail, fin, two bubbles',
    d: {
      mirror: false,
      face: [0.3, 0.48],
      strokes: [
        hand(closedThrough([[0.18, 0.5], [0.3, 0.38], [0.5, 0.36], [0.66, 0.5], [0.5, 0.63], [0.3, 0.62]]), 70, 0.006, 0.02),
        hand(closedThrough([[0.65, 0.5], [0.85, 0.35], [0.8, 0.5], [0.86, 0.66]]), 40, 0.004, 0.02),
        hand(through([[0.38, 0.38], [0.45, 0.26], [0.56, 0.31], [0.57, 0.39]]), 20, 0.004),
        hand(ell(0.12, 0.33, 0.03, 0.03), 20, 0.002, 0.05),
        hand(ell(0.09, 0.22, 0.02, 0.02), 16, 0.002, 0.05),
      ],
    },
  },
  {
    name: 'Ghost',
    note: 'mirror on · wavy hem and arms from one half',
    d: {
      mirror: true,
      face: [0.5, 0.38],
      strokes: [
        hand(through([[0.5, 0.16], [0.36, 0.2], [0.3, 0.36], [0.28, 0.58], [0.22, 0.8], [0.32, 0.72], [0.38, 0.82], [0.44, 0.72], [0.5, 0.8]]), 80, 0.006),
        hand(through([[0.3, 0.45], [0.18, 0.4], [0.12, 0.3], [0.08, 0.31]]), 20, 0.004),
      ],
    },
  },
  {
    name: 'Scribble',
    note: 'one spiky shape, three eye stalks, six legs',
    d: {
      mirror: false,
      face: [0.5, 0.6],
      strokes: [
        hand((t) => {
          const a = t * 6.283,
            rad = 0.21 + 0.05 * Math.sin(a * 7) + 0.02 * Math.sin(a * 3);
          return [0.5 + Math.cos(a) * rad, 0.6 + Math.sin(a) * rad * 0.8];
        }, 120, 0.004, 0.015),
        hand(line([0.42, 0.45], [0.35, 0.22]), 14, 0.004),
        hand(line([0.5, 0.42], [0.5, 0.18]), 14, 0.004),
        hand(line([0.58, 0.45], [0.66, 0.22]), 14, 0.004),
        hand(ell(0.35, 0.2, 0.028, 0.028), 18, 0.002, 0.05),
        hand(ell(0.5, 0.16, 0.028, 0.028), 18, 0.002, 0.05),
        hand(ell(0.66, 0.2, 0.028, 0.028), 18, 0.002, 0.05),
        ...[0.34, 0.5, 0.66].map((x, i) => hand(line([x, 0.76], [x + (i - 1) * 0.06, 0.9]), 12, 0.003)),
      ],
    },
  },
];

/** Bleistiftvorschau: so sieht der Spieler seine Striche beim Zeichnen */
function pencil(c: HTMLCanvasElement, d: Drawing, px: number, showFace = true, live = false): void {
  const dpr = 2;
  c.width = c.height = px * dpr;
  c.style.width = c.style.height = px + 'px';
  const x = c.getContext('2d')!;
  x.scale(px * dpr, px * dpr);
  x.fillStyle = '#fbfaf6';
  x.fillRect(0, 0, 1, 1);
  if (d.mirror) {
    x.strokeStyle = 'rgba(43,63,163,.35)';
    x.lineWidth = 1.2 / px;
    x.setLineDash([5 / px, 5 / px]);
    x.beginPath();
    x.moveTo(0.5, 0.03);
    x.lineTo(0.5, 0.97);
    x.stroke();
    x.setLineDash([]);
  }
  x.lineCap = x.lineJoin = 'round';
  for (const p of parts(d)) {
    x.strokeStyle = 'rgba(40,40,46,.82)';
    x.lineWidth = (live ? 3 : 2.2) / px;
    x.beginPath();
    p.pts.forEach((q, i) => (i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])));
    if (p.closed) {
      x.closePath();
      x.fillStyle = 'rgba(43,63,163,.07)';
      x.fill();
    }
    x.stroke();
  }
  if (showFace && d.face) {
    const [fx, fy] = d.face;
    x.strokeStyle = '#c9961e';
    x.lineWidth = 2 / px;
    x.beginPath();
    x.arc(fx, fy, 0.05, 0, 7);
    x.stroke();
    x.fillStyle = '#1d2130';
    for (const s of [-1, 1]) {
      x.beginPath();
      x.arc(fx + s * 0.018, fy, 0.008, 0, 7);
      x.fill();
    }
  }
}

/** Malt mit fremder Geometrie: nur im Entwurf wird build kurz ersetzt */
function paintGeo(c: HTMLCanvasElement, sheet: string, idx: number, paper: PaperId, size: number, g: Geometry): void {
  const m = makeMonster(sheet, idx, humidityFor(sheet));
  m.paper = paper;
  const bp = BP[m.bp],
    orig = bp.build;
  bp.build = () => structuredClone(g);
  try {
    renderMonster(c, { ...m, face: { ...m.face, extra: 'keins' } }, size, { dpr: 2 });
  } finally {
    bp.build = orig;
  }
  c.style.width = c.style.height = size + 'px';
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

/* ---------- Zeichenbildschirm ---------- */
const phone = el('section', 'phone');
const top = el('div', 'top');
top.append(el('span', 'back', '←'), el('h2', '', 'Blank canvas'), el('span', 'left', '1 left'));
const sep = el('div', 'sepia');
sep.append(el('p', 'eyebrow', 'Master Sepia'), el('p', 'hand', 'Draw me something that flutters. Or don’t. It will flutter regardless.'));
const pad = el('canvas', 'pad');
pencil(pad, EX[1]!.d, 358, true, true);
const tools = el('div', 'tools');
for (const [t, on] of [['Mirror', true], ['Eyes', false], ['Undo', false], ['Clear', false]] as const) {
  const b = el('button', on ? 'tool on' : 'tool', t);
  tools.append(b);
}
const hint = el('p', 'hint', 'Closed shapes fill with paint. Open lines stay lines. Tap “Eyes”, then where the face goes.');
const go = el('button', 'primary', 'Paint it');
const cost = el('p', 'fine', 'Colour, paper, rarity and dice are rolled as usual. Your drawing only decides the shape.');
phone.append(top, sep, pad, tools, hint, go, cost);

/* ---------- Beispiele ---------- */
const right = el('section', 'right');
right.append(el('p', 'eyebrow', 'Before It Dries · draft'), el('h1', '', 'Paint your own'));
const PAINT: [string, number, PaperId][] = [
  ['dip-k3x', 4, 'schul'],
  ['dip-q9w', 7, 'buetten'],
  ['dip-z1m', 2, 'washi'],
];
const head = el('div', 'row head');
head.append(el('span', '', 'Your strokes'), el('span', '', 'Painted · roll 1'), el('span', '', 'roll 2'), el('span', '', 'roll 3'));
right.append(head);
EX.forEach((ex, i) => {
  const row = el('div', 'row');
  const fig = el('figure');
  const pc = el('canvas');
  pencil(pc, ex.d, 150, true);
  fig.append(pc);
  row.append(fig);
  const g = drawnGeometry(ex.d);
  PAINT.forEach(([s, k, paper]) => {
    const f = el('figure');
    const c = el('canvas');
    paintGeo(c, `${s}${i}`, (k + i * 3) % 12, paper, 150, g);
    f.append(c);
    row.append(f);
  });
  const cap = el('p', 'cap');
  cap.append(el('b', '', ex.name), document.createTextNode(' · ' + ex.note));
  right.append(row, cap);
});
document.body.append(phone, right);
(window as unknown as { done: boolean; stats: unknown }).done = true;
// Gespeichert wird nur der Text: Größe und ob er dieselbe Form ergibt
(window as unknown as { stats: unknown }).stats = EX.map((e) => {
  const code = encodeDrawing(e.d),
    back = decodeDrawing(code);
  const g = drawnGeometry(e.d);
  return { n: e.name, blobs: g.blobs.length, limbs: g.limbs.length, bytes: code.length, back: !!back && JSON.stringify(drawnGeometry(back)).length > 0 };
});
