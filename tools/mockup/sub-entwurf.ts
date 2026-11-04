/*
 * Entwurfsbogen „Subreddit-Auftritt“ (nur für docs/entwuerfe, docs/entwuerfe/publish-plan.md):
 * Banner für Desktop und Handy, Community-Icon, App-Icon. Alles aus dem echten Renderer und Canvas, keine Bilddateien.
 * #pick zeigt Kandidaten zum Aussuchen, #compact die kompakten Banner, #catalog die Katalogbilder (04.11.2026), sonst der Bogen. window.assets liefert die fertigen Bilder als PNG-Daten.
 * Bauen: npx esbuild tools/mockup/sub-entwurf.ts --bundle --format=iife --outfile=tools/mockup/sub-entwurf.js
 */
import { renderMonster, grainTex } from '../../src/client/renderer/watercolor';
import { find, type Face } from '../../src/shared/duel/rules';
import { faceSvg } from '../../src/client/duel/faceskin';
import { PIG, type BlueprintId, type PigmentId } from '../../src/shared/data';
import type { Monster } from '../../src/shared/monster';

const BPS: BlueprintId[] = ['kriecher', 'flatterer', 'schwebeblase', 'vierbeiner', 'schlange', 'turm', 'krabbe', 'qualle', 'huepfer', 'knolle', 'strahler', 'doppelkopf'];
const PIGS: PigmentId[] = ['ultra', 'phthalo', 'karmin', 'kadmium', 'siena', 'indigo', 'sepia', 'opera'];
/* Kandidaten-Suche wie in #pick: Salz S{n} läuft über Bauplan und Pigment */
const mon = (bp: BlueprintId, pig: PigmentId, salt: string): Monster => ({ ...find(bp, pig, salt, true), gen: 2 });
function blot(m: Monster, px: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  renderMonster(cv, m, px, { dpr: 1, paper: false });
  return cv;
}
const root = document.getElementById('root')!;

/* Ausgesuchte Kleckse (aus #pick) */
const PICK = {
  hat: mon('vierbeiner', 'ultra', 'S25'),
  puff: mon('schwebeblase', 'opera', 'S15'),
  bird: mon('flatterer', 'phthalo', 'S6'),
  totem: mon('turm', 'ultra', 'S41'),
  cat: mon('vierbeiner', 'kadmium', 'S28'),
  twins: mon('doppelkopf', 'siena', 'S58'),
  lady: mon('turm', 'opera', 'S30'),
  egg: mon('doppelkopf', 'ultra', 'S89'),
  onion: mon('knolle', 'sepia', 'S79'),
  cap: mon('knolle', 'opera', 'S50'),
};

/* ---------- Bausteine ---------- */
const PAPER = '#f4eee2';
function cnv(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}
/** Papier mit Körnung, leichter Abdunklung am Rand und ein paar weichen Lavierungen */
function paper(w: number, h: number, washes: [number, number, number, string, number][]): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const [c, x] = cnv(w, h);
  x.fillStyle = PAPER;
  x.fillRect(0, 0, w, h);
  for (const [cx, cy, r, col, a] of washes) wash(x, cx, cy, r, col, a);
  x.globalAlpha = 0.55;
  x.fillStyle = x.createPattern(grainTex(), 'repeat')!;
  x.fillRect(0, 0, w, h);
  x.globalAlpha = 1;
  const g = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(110,90,70,.14)');
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  return [c, x];
}
/** Weiche Lavierung: viele halbdurchsichtige, unregelmäßige Flecken mit dunklerem Wasserrand */
function wash(x: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string, a: number): void {
  let seed = (cx * 7 + cy * 13 + r) | 0;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  x.save();
  for (let k = 0; k < 7; k++) {
    const pts: [number, number][] = [];
    const ox = cx + (rnd() - 0.5) * r * 0.5,
      oy = cy + (rnd() - 0.5) * r * 0.3;
    const ph = rnd() * 6;
    for (let i = 0; i < 48; i++) {
      const t = (i / 48) * Math.PI * 2;
      const rr = r * (0.62 + 0.12 * rnd()) * (0.85 + 0.1 * Math.sin(t * 3 + ph) + 0.05 * Math.sin(t * 7 + k));
      pts.push([ox + Math.cos(t) * rr * 1.5, oy + Math.sin(t) * rr * 0.6]);
    }
    x.beginPath();
    // Glatte Kurve durch die Mittelpunkte
    const mid = (i: number): [number, number] => {
      const p = pts[i % pts.length]!,
        q = pts[(i + 1) % pts.length]!;
      return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    };
    x.moveTo(...mid(0));
    for (let i = 1; i <= pts.length; i++) x.quadraticCurveTo(pts[i % pts.length]![0], pts[i % pts.length]![1], ...mid(i));
    x.closePath();
    x.filter = k % 2 ? 'blur(3px)' : 'none';
    x.globalAlpha = a / 4;
    x.fillStyle = col;
    x.fill();
    x.globalAlpha = a / 3;
    x.strokeStyle = col;
    x.lineWidth = 1.5;
    x.stroke();
  }
  x.restore();
}
/** Sichtbarer Bereich eines Kleckses (Deckung über 8 %), damit Icons ihn mittig und groß zeigen */
function bbox(c: HTMLCanvasElement): [number, number, number, number] {
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width,
    y0 = c.height,
    x1 = 0,
    y1 = 0;
  for (let y = 0; y < c.height; y++)
    for (let xx = 0; xx < c.width; xx++)
      if (d[(y * c.width + xx) * 4 + 3]! > 20) {
        x0 = Math.min(x0, xx);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, xx);
        y1 = Math.max(y1, y);
      }
  return [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
}
/** Klecks so setzen, dass sein sichtbarer Teil in ein Feld der Größe fit passt, Mitte bei cx, cy */
function putFit(x: CanvasRenderingContext2D, m: Monster, cx: number, cy: number, fit: number): void {
  const b = blot(m, 600);
  const [bx, by, bw, bh] = bbox(b);
  const k = fit / Math.max(bw, bh);
  x.drawImage(b, bx, by, bw, bh, cx - (bw * k) / 2, cy - (bh * k) / 2, bw * k, bh * k);
}
/** Klecks auf das Blatt setzen, leicht gedreht */
function put(x: CanvasRenderingContext2D, m: Monster, cx: number, cy: number, s: number, rot = 0, ghost = 0): void {
  const b = blot(m, s);
  x.save();
  x.translate(cx, cy);
  x.rotate(rot);
  if (ghost) {
    // Ausgebleicht: grau, hell, durchscheinend (die Pales vom Rand)
    x.filter = 'grayscale(1) brightness(1.35) contrast(.7)';
    x.globalAlpha = ghost;
  }
  x.drawImage(b, -s / 2, -s / 2, s, s);
  x.restore();
}
/** Der Rand bleicht aus: weißer Verlauf mit Körnung, wie ausgewaschen */
function bleachEdge(x: CanvasRenderingContext2D, w: number, h: number, from: number, side: 'right' | 'left' | 'both' = 'right'): void {
  const edge = (x0: number, x1: number) => {
    const g = x.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, 'rgba(251,250,246,0)');
    g.addColorStop(0.6, 'rgba(251,250,246,.75)');
    g.addColorStop(1, 'rgba(255,255,255,.97)');
    x.fillStyle = g;
    x.fillRect(Math.min(x0, x1), 0, Math.abs(x1 - x0), h);
  };
  if (side !== 'left') edge(from, w);
  if (side !== 'right') edge(w - from, 0);
  x.globalAlpha = 0.25;
  x.fillStyle = x.createPattern(grainTex(), 'repeat')!;
  if (side !== 'left') x.fillRect(from, 0, w - from, h);
  if (side !== 'right') x.fillRect(0, 0, w - from, h);
  x.globalAlpha = 1;
}
/** Ein paar Farbtropfen mit Wasserrand */
function drops(x: CanvasRenderingContext2D, list: [number, number, number, string][]): void {
  for (const [px, py, r, col] of list) {
    x.save();
    x.globalAlpha = 0.55;
    x.fillStyle = col;
    x.beginPath();
    x.ellipse(px, py, r, r * 0.9, 0.4, 0, Math.PI * 2);
    x.fill();
    x.globalAlpha = 0.7;
    x.lineWidth = Math.max(1, r * 0.18);
    x.strokeStyle = col;
    x.stroke();
    x.restore();
  }
}
function title(x: CanvasRenderingContext2D, tx: number, ty: number, size: number, tag: string | null): void {
  x.fillStyle = '#1d2130';
  x.font = `400 ${size}px "Young Serif", serif`;
  x.textBaseline = 'alphabetic';
  x.fillText('Before It Dries', tx, ty);
  if (tag) {
    x.fillStyle = '#6b4a2f';
    x.font = `700 ${Math.round(size * 0.5)}px Caveat, cursive`;
    x.fillText(tag, tx + 4, ty + size * 0.62);
  }
}

/* ---------- Banner A: Parade der Kleckse, der rechte Rand bleicht aus ---------- */
function bannerA(w = 1920, h = 384): HTMLCanvasElement {
  const [c, x] = paper(w, h, [
    [1180, 250, 260, 'rgb(43,63,163)', 0.18],
    [1500, 120, 220, 'rgb(232,62,128)', 0.14],
    [860, 330, 200, 'rgb(240,172,12)', 0.16],
  ]);
  title(x, 96, 196, 84, '“Every blot is a die.”');
  const row: [Monster, number, number, number, number][] = [
    [PICK.cat, 1040, 222, 270, -0.06],
    [PICK.hat, 1250, 200, 310, 0.04],
    [PICK.puff, 1455, 212, 280, -0.05],
    [PICK.bird, 1640, 190, 280, 0.06],
  ];
  for (const [m, cx, cy, s, r] of row) put(x, m, cx, cy, s, r);
  bleachEdge(x, w, h, 1690);
  put(x, PICK.twins, 1835, 230, 230, 0.1, 0.35);
  drops(x, [
    [930, 80, 9, 'rgb(176,30,62)'],
    [960, 110, 5, 'rgb(176,30,62)'],
    [130, 290, 7, 'rgb(43,63,163)'],
    [1020, 345, 6, 'rgb(12,108,92)'],
  ]);
  return c;
}

/* ---------- Banner B: das Duell, zwei Gebiete auf dem Blatt ---------- */
function bannerB(w = 1920, h = 384): HTMLCanvasElement {
  const [c, x] = paper(w, h, [
    [520, 200, 340, 'rgb(43,63,163)', 0.22],
    [1400, 190, 340, 'rgb(176,30,62)', 0.2],
  ]);
  // Feines Gitter des Blatts in der Mitte
  x.strokeStyle = 'rgba(80,70,60,.13)';
  x.lineWidth = 1;
  for (let gx = 360; gx <= 1560; gx += 75) {
    x.beginPath();
    x.moveTo(gx, 20);
    x.lineTo(gx, h - 20);
    x.stroke();
  }
  for (let gy = 20; gy <= h - 20; gy += 75) {
    x.beginPath();
    x.moveTo(360, gy);
    x.lineTo(1560, gy);
    x.stroke();
  }
  put(x, PICK.hat, 700, 200, 380, -0.05);
  put(x, PICK.puff, 1220, 200, 360, 0.05);
  x.fillStyle = '#6b4a2f';
  x.font = '700 120px Caveat, cursive';
  x.textAlign = 'center';
  x.fillText('vs', 960, 235);
  x.textAlign = 'left';
  bleachEdge(x, w, h, 1720, 'both');
  put(x, PICK.onion, 160, 220, 220, -0.1, 0.3);
  put(x, PICK.egg, 1770, 210, 220, 0.1, 0.3);
  return c;
}

/* ---------- Handy-Banner: Kleckse oben rechts und links, Mitte und unten frei für Icon und Name ---------- */
function mobileA(w = 1600, h = 480): HTMLCanvasElement {
  const [c, x] = paper(w, h, [
    [380, 160, 300, 'rgb(43,63,163)', 0.16],
    [1180, 150, 300, 'rgb(232,62,128)', 0.13],
    [800, 380, 260, 'rgb(240,172,12)', 0.12],
  ]);
  put(x, PICK.cat, 260, 190, 300, -0.08);
  put(x, PICK.hat, 560, 170, 320, 0.04);
  put(x, PICK.puff, 1050, 170, 300, -0.05);
  put(x, PICK.bird, 1340, 175, 310, 0.06);
  bleachEdge(x, w, h, 1450, 'both');
  drops(x, [
    [800, 110, 10, 'rgb(176,30,62)'],
    [830, 140, 6, 'rgb(176,30,62)'],
    [760, 70, 5, 'rgb(12,108,92)'],
  ]);
  return c;
}

/*
 * ---------- Kompakt (02.11.2026, „die Banner sind zu lang“): 3:1 statt 5:1 ----------
 * Alles Wichtige liegt im mittleren Band (Höhe w/5), damit Reddit beim Zuschneiden auf 4:1 oder 5:1 nur Papier wegnimmt.
 */
function compact(withTitle: boolean, w = 1800, h = 600): HTMLCanvasElement {
  const [c, x] = paper(w, h, [
    [withTitle ? 1300 : 560, 330, 300, 'rgb(43,63,163)', 0.17],
    [withTitle ? 1500 : 1240, 250, 240, 'rgb(232,62,128)', 0.14],
    [withTitle ? 520 : 900, 470, 260, 'rgb(240,172,12)', 0.13],
  ]);
  const cy = h / 2;
  if (withTitle) {
    title(x, 110, cy + 8, 92, '“Every blot is a die.”');
    const row: [Monster, number, number, number][] = [
      [PICK.cat, 1040, cy + 22, 290],
      [PICK.hat, 1250, cy, 340],
      [PICK.puff, 1455, cy + 14, 300],
      [PICK.bird, 1650, cy - 6, 300],
    ];
    row.forEach(([m, px, py, sz], k) => put(x, m, px, py, sz, k % 2 ? 0.04 : -0.05));
    drops(x, [
      [955, cy - 130, 9, 'rgb(176,30,62)'],
      [980, cy - 102, 5, 'rgb(176,30,62)'],
      [160, cy + 110, 7, 'rgb(43,63,163)'],
    ]);
  } else {
    const row: [Monster, number, number, number][] = [
      [PICK.cat, 310, cy + 22, 310],
      [PICK.hat, 590, cy, 350],
      [PICK.puff, 1220, cy + 12, 320],
      [PICK.bird, 1500, cy - 6, 320],
    ];
    row.forEach(([m, px, py, sz], k) => put(x, m, px, py, sz, k % 2 ? 0.04 : -0.05));
    drops(x, [
      [880, cy - 60, 10, 'rgb(176,30,62)'],
      [912, cy - 28, 6, 'rgb(176,30,62)'],
      [860, cy - 100, 5, 'rgb(12,108,92)'],
    ]);
  }
  bleachEdge(x, w, h, w - 110, 'both');
  return c;
}
/** Zeigt, was bei 4:1 und 5:1 übrig bleibt (gestrichelte Bänder) */
function cropGuide(c: HTMLCanvasElement): HTMLCanvasElement {
  const [g, x] = cnv(c.width, c.height);
  x.drawImage(c, 0, 0);
  for (const [ratio, col] of [[4, 'rgba(43,63,163,.9)'], [5, 'rgba(176,30,62,.9)']] as [number, string][]) {
    const bh = c.width / ratio,
      y0 = (c.height - bh) / 2;
    x.setLineDash([18, 12]);
    x.lineWidth = 5;
    x.strokeStyle = col;
    x.strokeRect(6, y0, c.width - 12, bh);
    x.setLineDash([]);
    x.fillStyle = col;
    x.font = '700 30px Figtree, sans-serif';
    x.fillText(`${ratio}:1`, 20, y0 + 36);
  }
  return g;
}

/* ---------- Icons ---------- */
function icon(m: Monster, s: number, ring: string, wcol: string, scale = 0.86, dy = 0.02): HTMLCanvasElement {
  const [c, x] = paper(s, s, [[s * 0.5, s * 0.6, s * 0.36, wcol, 0.28]]);
  putFit(x, m, s / 2, s * (0.5 + dy), s * scale);
  // Ring als Pinselstrich, zeigt die Kreisform, in der Reddit das Icon zuschneidet
  x.strokeStyle = ring;
  x.globalAlpha = 0.85;
  x.lineWidth = s * 0.03;
  x.beginPath();
  x.arc(s / 2, s / 2, s * 0.47, 0, Math.PI * 2);
  x.stroke();
  x.globalAlpha = 1;
  return c;
}
const iconA = (s = 512) => icon(PICK.hat, s, '#6b4a2f', 'rgb(176,30,62)', 0.7, 0.01);
const iconB = (s = 512) => icon(PICK.puff, s, '#6b4a2f', 'rgb(43,63,163)', 0.68, 0);
/** App-Icon für den Katalog: quadratisch, abgerundet zeigt Reddit selbst */
function appIcon(m: Monster, s = 1024, wcol = 'rgb(176,30,62)', scale = 0.78): HTMLCanvasElement {
  const [c, x] = paper(s, s, [[s * 0.5, s * 0.62, s * 0.36, wcol, 0.3]]);
  putFit(x, m, s / 2, s * 0.5, s * scale);
  return c;
}


/* ---------- Katalog (04.11.2026, docs/entwuerfe/katalog-und-feedback.md): Featuring 1500 × 1000, Kachel 560 × 256 ---------- */
async function faceImg(f: Face, pig: PigmentId | null, px = 256): Promise<HTMLImageElement> {
  const img = new Image();
  const tint = pig ? PIG[pig].rgb : PIG.ultra.rgb;
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(faceSvg(f, 'tag', px, tint).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
  await img.decode();
  return img;
}
type Dice = [HTMLImageElement, HTMLImageElement, HTMLImageElement];
/** Ein Würfel schräg von oben: Vorderseite, Deckel, rechte Seite, mit weichem Schatten */
function cube(x: CanvasRenderingContext2D, cx: number, cy: number, s: number, rot: number, [front, top, side]: Dice): void {
  const dx = s * 0.34,
    dy = s * 0.26;
  x.save();
  x.translate(cx, cy);
  x.rotate(rot);
  // Schatten auf dem Papier
  x.save();
  x.filter = `blur(${Math.round(s * 0.08)}px)`;
  x.fillStyle = 'rgba(60,45,30,.32)';
  x.beginPath();
  x.ellipse(dx * 0.4, s * 0.52, s * 0.62, s * 0.13, 0, 0, Math.PI * 2);
  x.fill();
  x.restore();
  const ox = -s / 2,
    oy = -s / 2 + dy / 2;
  const face = (img: HTMLImageElement, a: number, b: number, c: number, d: number, e: number, f: number, shade: number) => {
    x.save();
    x.transform(a, b, c, d, e, f);
    x.drawImage(img, 0, 0, s, s);
    if (shade) {
      x.fillStyle = `rgba(30,20,10,${shade})`;
      x.fillRect(0, 0, s, s);
    }
    x.strokeStyle = 'rgba(40,30,20,.45)';
    x.lineWidth = s * 0.012;
    x.strokeRect(0, 0, s, s);
    x.restore();
  };
  // Deckel: hintere Kante oben rechts, vordere Kante an der Oberkante der Vorderseite
  face(top, 1, 0, -dx / s, dy / s, ox + dx, oy - dy, 0.02);
  // Rechte Seite
  face(side, dx / s, -dy / s, 0, 1, ox + s, oy, 0.2);
  // Vorderseite
  face(front, 1, 0, 0, 1, ox, oy, 0);
  x.restore();
}
function featuring(d: Dice[], w = 1500, h = 1000): HTMLCanvasElement {
  const [c, x] = paper(w, h, [
    [400, 650, 470, 'rgb(43,63,163)', 0.24],
    [1120, 330, 430, 'rgb(176,30,62)', 0.22],
    [760, 860, 220, 'rgb(240,172,12)', 0.12],
  ]);
  // Feines Gitter des Blatts
  x.strokeStyle = 'rgba(80,70,60,.12)';
  x.lineWidth = 1.5;
  for (let gx = 150; gx <= 1350; gx += 120) {
    x.beginPath();
    x.moveTo(gx, 70);
    x.lineTo(gx, h - 70);
    x.stroke();
  }
  for (let gy = 70; gy <= h - 70; gy += 120) {
    x.beginPath();
    x.moveTo(150, gy);
    x.lineTo(1350, gy);
    x.stroke();
  }
  bleachEdge(x, w, h, 1390, 'both');
  put(x, PICK.twins, 1430, 170, 230, 0.1, 0.32);
  put(x, PICK.hat, 470, 440, 600, -0.05);
  put(x, PICK.puff, 1080, 390, 540, 0.05);
  // Spritzer fliegt vom Klecks links zum rechten
  drops(x, [
    [735, 300, 16, 'rgb(43,63,163)'],
    [790, 268, 10, 'rgb(43,63,163)'],
    [835, 252, 6, 'rgb(43,63,163)'],
    [700, 335, 7, 'rgb(43,63,163)'],
    [1310, 640, 9, 'rgb(176,30,62)'],
    [180, 880, 8, 'rgb(12,108,92)'],
  ]);
  cube(x, 600, 815, 185, -0.12, d[0]!);
  cube(x, 885, 850, 160, 0.13, d[1]!);
  cube(x, 1150, 820, 145, -0.06, d[2]!);
  return c;
}
function tile(d: Dice[], w = 560, h = 256): HTMLCanvasElement {
  const [c, x] = paper(w, h, [
    [170, 150, 150, 'rgb(43,63,163)', 0.2],
    [420, 110, 140, 'rgb(232,62,128)', 0.16],
  ]);
  bleachEdge(x, w, h, w - 40, 'both');
  put(x, PICK.hat, 150, 120, 220, -0.05);
  put(x, PICK.puff, 405, 112, 205, 0.05);
  drops(x, [
    [262, 82, 7, 'rgb(43,63,163)'],
    [284, 70, 4, 'rgb(43,63,163)'],
  ]);
  cube(x, 278, 188, 74, -0.1, d[0]!);
  return c;
}
/** So ungefähr zeigt der Katalog die Bilder: Karte mit Name, Kategorie, Beschreibung und Play, dazu Kachel und Icon */
function catalogCard(img: HTMLCanvasElement, desc: string): HTMLElement {
  const f = document.createElement('figure');
  f.className = 'fig';
  f.innerHTML = `<div class="cc"><img src="${img.toDataURL()}"><div class="cc-b"><b>beforeitdries</b><small>STRATEGY · 999K PLAYERS</small><p>${desc}</p><span>Play</span></div></div><figcaption><b>Featuring-Karte</b> wie in der Vorschau des Editors</figcaption>`;
  return f;
}
function catalogTile(t: HTMLCanvasElement, ic: string, tag: string): HTMLElement {
  const f = document.createElement('figure');
  f.className = 'fig';
  f.innerHTML = `<div class="ct"><div class="ct-r"><img class="ct-i" src="${ic}"><div><b>beforeitdries</b><small>${tag}</small></div><span class="ct-p">Play</span></div><img class="ct-t" src="${t.toDataURL()}"><b>beforeitdries</b></div><figcaption><b>Icon und Kachel</b> wie in der Vorschau</figcaption>`;
  return f;
}
function grey(c: HTMLCanvasElement): HTMLCanvasElement {
  const [g, x] = cnv(c.width, c.height);
  x.filter = 'grayscale(1)';
  x.drawImage(c, 0, 0);
  return g;
}

/* ---------- Bogen ---------- */
const OUT: Record<string, HTMLCanvasElement> = {};
function show(id: string, c: HTMLCanvasElement, label: string, cssW: number, round = false): HTMLElement {
  OUT[id] = c;
  const f = document.createElement('figure');
  f.className = 'fig';
  const img = document.createElement('img');
  img.src = c.toDataURL('image/png');
  img.style.width = cssW + 'px';
  if (round) img.style.borderRadius = '50%';
  const cap = document.createElement('figcaption');
  cap.innerHTML = label;
  f.append(img, cap);
  return f;
}
/** So ungefähr sieht es in der Reddit-App aus: Banner oben, rundes Icon, Name, Beitreten */
function phone(banner: HTMLCanvasElement, ic: HTMLCanvasElement, label: string): HTMLElement {
  const f = document.createElement('figure');
  f.className = 'fig';
  f.innerHTML = `<div class="ph"><div class="ph-b" style="background-image:url(${banner.toDataURL()})"></div>
    <div class="ph-row"><img class="ph-i" src="${ic.toDataURL()}"><div><b>r/beforeitdries</b><small>412 members · 23 online</small></div><span class="ph-j">Join</span></div>
    <p class="ph-d">A watercolour dice game. Every monster is a one-of-a-kind blot and a die. Duel, collect, hold the sheet against the Bleach, and name new species together.</p>
    <div class="ph-post"><small>📌 Pinned · u/beforeitdries</small><b>Before It Dries · Play</b></div></div><figcaption>${label}</figcaption>`;
  return f;
}

if (location.hash === '#pick') {
  root.style.cssText = 'display:grid;grid-template-columns:repeat(8,150px);gap:6px';
  let n = 0;
  for (const bp of BPS)
    for (const pig of PIGS) {
      if (!['karmin', 'opera', 'phthalo', 'indigo', 'siena'].includes(pig) || (n++ + BPS.indexOf(bp)) % 2) continue;
      const salt = 'S' + n;
      const d = document.createElement('div');
      d.style.cssText = 'background:#f6f1e6;font:10px monospace;text-align:center';
      d.append(blot(mon(bp, pig, salt), 150), `${bp} ${pig} ${salt}`);
      root.append(d);
    }
} else if (location.hash === '#catalog') {
  void (async () => {
    await Promise.all(['400 104px "Young Serif"', '700 52px Caveat'].map((f) => document.fonts.load(f)));
    const F = (k: Face['k'], n: number, c?: PigmentId): Face => ({ k, n, ...(c ? { c } : {}) });
    const dice: Dice[] = [
      [await faceImg(F('star', 3), 'ultra'), await faceImg(F('splash', 1, 'ultra'), 'ultra'), await faceImg(F('step', 2, 'ultra'), 'ultra')],
      [await faceImg(F('splash', 2, 'karmin'), 'karmin'), await faceImg(F('star', 2), 'karmin'), await faceImg(F('guard', 1, 'karmin'), 'karmin')],
      [await faceImg(F('joker', 0), 'kadmium'), await faceImg(F('glow', 1, 'kadmium'), 'kadmium'), await faceImg(F('step', 1, 'kadmium'), 'kadmium')],
    ];
    const feat = featuring(dice),
      tl = tile(dice),
      ic = appIcon(PICK.hat, 512).toDataURL();
    root.innerHTML = `<p class="eyebrow">Entwurf · In-app catalog</p><h1>Bilder für den Spiele-Katalog</h1>
      <p class="sub">Featuring 1500 × 1000 und Kachel 560 × 256, ohne Text im Bild. Alles aus dem Renderer, Würfelseiten aus dem Spiel. Unten in Graustufen zum Prüfen des Kontrasts.</p>`;
    const g1 = document.createElement('div');
    g1.className = 'col';
    g1.append(show('featuring', feat, '<b>Featuring asset</b> 1500 × 1000 · auch als Fallback', 760));
    const g2 = document.createElement('div');
    g2.className = 'row';
    g2.append(show('tile', tl, '<b>Tile image</b> 560 × 256', 420), catalogCard(feat, 'Roll watercolour monsters as dice'), catalogTile(tl, ic, 'Every blot is a die.'));
    const g3 = document.createElement('div');
    g3.className = 'row';
    const gf = show('grey-f', grey(feat), '<b>Graustufen</b> Featuring', 360);
    const gt = show('grey-t', grey(tl), '<b>Graustufen</b> Kachel', 280);
    delete OUT['grey-f'];
    delete OUT['grey-t'];
    g3.append(gf, gt);
    root.append(g1, g2, g3);
    const w = window as unknown as { assets: Record<string, string> };
    w.assets = Object.fromEntries(Object.entries(OUT).map(([k, v]) => [k, v.toDataURL('image/png')]));
  })();
} else if (location.hash === '#compact') {
  void Promise.all(['400 104px "Young Serif"', '700 52px Caveat'].map((f) => document.fonts.load(f))).then(() => {
    const cT = compact(true),
      cN = compact(false),
      iA = iconA();
    root.innerHTML = `<p class="eyebrow">Entwurf · Banner kompakt</p><h1>Banner 3:1 statt 5:1</h1>
      <p class="sub">1800 × 600. Titel und Kleckse stehen im mittleren Band. Schneidet Reddit auf 4:1 (blau) oder 5:1 (rot) zu, fällt nur Papier weg.</p>`;
    const g1 = document.createElement('div');
    g1.className = 'col';
    g1.append(
      show('banner-3x1', cT, '<b>Banner mit Titel</b> 1800 × 600 · für Desktop', 1160),
      show('banner-3x1-plain', cN, '<b>Banner ohne Titel</b> 1800 × 600 · fürs Handy, Mitte frei', 1160),
    );
    const g2 = document.createElement('div');
    g2.className = 'row';
    const guide = (c: HTMLCanvasElement, label: string) => {
      const f = show('guide-' + label, cropGuide(c), `<b>Zuschnitt</b> ${label}`, 570);
      delete OUT['guide-' + label];
      return f;
    };
    g2.append(guide(cT, 'mit Titel'), guide(cN, 'ohne Titel'));
    const g3 = document.createElement('div');
    g3.className = 'row';
    g3.append(phone(cN, iA, 'Reddit-App: Banner ohne Titel, Icon A'), phone(cT, iA, 'Reddit-App: Banner mit Titel'));
    root.append(g1, g2, g3);
    const w = window as unknown as { assets: Record<string, string> };
    w.assets = Object.fromEntries(Object.entries(OUT).map(([k, v]) => [k, v.toDataURL('image/png')]));
  });
} else {
  void Promise.all(['400 104px "Young Serif"', '700 52px Caveat', '700 120px Caveat'].map((f) => document.fonts.load(f))).then(() => {
    const bA = bannerA(),
      bB = bannerB(),
      mA = mobileA(),
      iA = iconA(),
      iB = iconB(),
      app = appIcon(PICK.hat),
      appB = appIcon(PICK.puff, 1024, 'rgb(43,63,163)');
    root.innerHTML = `<p class="eyebrow">Entwurf · Subreddit-Auftritt</p><h1>r/beforeitdries für den Release</h1>
      <p class="sub">Alles aus dem Renderer des Spiels gemalt, keine Bilddateien, keine KI. Rechts bleicht das Blatt aus, dort stehen ausgebleichte Pales.</p>`;
    const g1 = document.createElement('div');
    g1.className = 'col';
    g1.append(
      show('banner-a', bA, '<b>Banner A · Parade</b> 1920 × 384 · Titel links, Kleckse ziehen nach rechts, der Rand bleicht aus', 1160),
      show('banner-b', bB, '<b>Banner B · Duell</b> 1920 × 384 · zwei Gebiete auf dem Blatt, ohne Titel', 1160),
    );
    const g2 = document.createElement('div');
    g2.className = 'row';
    g2.append(
      show('mobile-a', mA, '<b>Handy-Banner</b> 1600 × 480 · Mitte unten frei für Icon und Name', 380),
      show('icon-a', iA, '<b>Icon A</b> · 512', 130, true),
      show('icon-b', iB, '<b>Icon B</b> · 512', 130, true),
      show('app-icon-a', app, '<b>App-Icon A</b> · 1024', 130),
      show('app-icon-b', appB, '<b>App-Icon B</b> · 1024', 130),
    );
    // So klein erscheinen Icons im Feed und in Listen
    const small = document.createElement('figure');
    small.className = 'fig';
    small.innerHTML =
      [iA, iB].map((c) => [64, 40, 32, 24].map((px) => `<img src="${c.toDataURL()}" style="width:${px}px;height:${px}px;border-radius:50%;display:inline-block;vertical-align:middle;margin:3px;box-shadow:none">`).join('')).join('<br>') +
      '<figcaption><b>Feed-Größe</b> A oben, B unten</figcaption>';
    g2.append(small);
    const g3 = document.createElement('div');
    g3.className = 'row';
    g3.append(phone(mA, iA, 'Vorschau Reddit-App mit Handy-Banner und Icon A'), phone(mA, iB, 'mit Icon B'));
    root.append(g1, g2, g3);
    const w = window as unknown as { assets: Record<string, string> };
    w.assets = Object.fromEntries(Object.entries(OUT).map(([k, v]) => [k, v.toDataURL('image/png')]));
  });
}
