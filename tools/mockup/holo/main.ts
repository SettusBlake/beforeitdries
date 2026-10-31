/*
 * Entwurf Holo (31.10.2026, noch nicht im Spiel): Shiny als Folienglanz über dem Bild, getrennt vom Stil.
 * Karten kippen mit dem Finger, sonst wandert das Licht von selbst. Die Folie ist CSS (Regenbogen mit color-dodge,
 * Muster als Maske aus einer Kachel), das Duell bekommt eine feste Fassung auf dem Canvas.
 * Baut zu einer Seite für das Artifact (tools/mockup/holo/build.mjs).
 */
import { renderStyled } from '../../../src/client/renderer/shiny';
import { renderMore } from '../../../src/client/renderer/styles-more';
import { renderMonster } from '../../../src/client/renderer/watercolor';
import type { StyleId } from '../../../src/shared/dice';
import { humidityFor, makeMonster, type Monster } from '../../../src/shared/monster';
import { RNG, rr } from '../../../src/shared/rng';

type Foil = 'rainbow' | 'stars' | 'diamond' | 'glitter';
const FOIL_NAME: Record<Foil, string> = { rainbow: 'rainbow foil', stars: 'star foil', diamond: 'diamond foil', glitter: 'glitter foil' };
const gen2 = (sheet: string, idx: number): Monster => ({ ...makeMonster(sheet, idx, humidityFor(sheet)), gen: 2 });

/** Musterkachel der Folie: weiße Formen auf Durchsichtig, als Maske für den Regenbogen */
const tiles = new Map<Foil, string>();
function foilTile(kind: Foil): string {
  const hit = tiles.get(kind);
  if (hit) return hit;
  const N = 96;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const x = c.getContext('2d')!;
  const r = RNG(kind.length * 977);
  x.fillStyle = x.strokeStyle = '#fff';
  if (kind === 'rainbow') {
    // Gebürstete Folie: feine Linien, die Fläche bleibt fast ganz offen
    x.globalAlpha = 0.55;
    x.fillRect(0, 0, N, N);
    x.globalAlpha = 1;
    for (let i = 0; i < N; i += 3) x.fillRect(i, 0, 1, N);
  } else if (kind === 'diamond') {
    x.lineWidth = 1.6;
    for (let k = -N; k <= 2 * N; k += 24) {
      x.beginPath();
      x.moveTo(k, 0);
      x.lineTo(k + N, N);
      x.moveTo(k, 0);
      x.lineTo(k - N, N);
      x.stroke();
    }
    for (let i = 0; i < 16; i++) {
      x.beginPath();
      x.arc((i % 4) * 24 + 12, Math.floor(i / 4) * 24, 2.2, 0, 7);
      x.fill();
    }
  } else if (kind === 'stars') {
    for (let i = 0; i < 9; i++) {
      const cx = r() * N,
        cy = r() * N,
        R = rr(r, 4, 11);
      for (const [dx, dy] of [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N]] as const) {
        x.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 - Math.PI / 2,
            d = k % 2 ? R * 0.18 : R;
          k ? x.lineTo(cx + dx + Math.cos(a) * d, cy + dy + Math.sin(a) * d) : x.moveTo(cx + dx + Math.cos(a) * d, cy + dy + Math.sin(a) * d);
        }
        x.closePath();
        x.fill();
      }
    }
  } else {
    for (let i = 0; i < 90; i++) {
      x.globalAlpha = rr(r, 0.5, 1);
      x.beginPath();
      x.arc(r() * N, r() * N, rr(r, 0.5, 2.4), 0, 7);
      x.fill();
    }
  }
  const url = c.toDataURL();
  tiles.set(kind, url);
  return url;
}

/** Bild malen: Aquarell, Stil aus dem Spiel oder Entwurfsstil */
function paint(c: HTMLCanvasElement, m: Monster, style: StyleId | 'graffiti' | 'nouveau' | null, size: number, deco: boolean): void {
  if (!style) renderMonster(c, m, size, { dpr: 2 });
  else if (style === 'graffiti' || style === 'nouveau') renderMore(c, m, style, size, { dpr: 2, deco });
  else renderStyled(c, { ...m, style }, style, size, { dpr: 2, deco });
}

type Holo = { el: HTMLElement; phase: number; held: boolean; mx: number; my: number };
const holos: Holo[] = [];
/** Karte mit Folie, Glanz und Licht. foil null: ohne Holo zum Vergleich */
function card(m: Monster, style: Parameters<typeof paint>[2], foil: Foil | null, title: string, sub: string, rarity: string): HTMLElement {
  const fig = document.createElement('figure');
  fig.className = `card r-${rarity}` + (foil ? ' holo' : '');
  const face = document.createElement('div');
  face.className = 'face';
  const c = document.createElement('canvas');
  c.className = 'art';
  paint(c, m, style, 220, true);
  face.append(c);
  if (foil) {
    face.style.setProperty('--mask', `url(${foilTile(foil)})`);
    for (const k of ['foil', 'sheen', 'glare']) {
      const d = document.createElement('div');
      d.className = k;
      face.append(d);
    }
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = '✦ Holo';
    face.append(badge);
  }
  const cap = document.createElement('figcaption');
  const b = document.createElement('b');
  b.textContent = title;
  const s = document.createElement('span');
  s.textContent = sub + (foil ? ` · holo, ${FOIL_NAME[foil]}` : '');
  cap.append(b, s);
  fig.append(face, cap);
  if (foil) track(fig);
  return fig;
}
function track(el: HTMLElement): void {
  const h: Holo = { el, phase: holos.length * 1.7, held: false, mx: 50, my: 50 };
  holos.push(h);
  const at = (e: PointerEvent) => {
    const b = el.getBoundingClientRect();
    h.mx = Math.max(0, Math.min(100, ((e.clientX - b.left) / b.width) * 100));
    h.my = Math.max(0, Math.min(100, ((e.clientY - b.top) / b.height) * 100));
  };
  el.addEventListener('pointerdown', (e) => {
    h.held = true;
    el.setPointerCapture(e.pointerId);
    at(e);
  });
  el.addEventListener('pointermove', (e) => h.held && at(e));
  const up = () => (h.held = false);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
function animate(t: number): void {
  for (const h of holos) {
    if (!h.held) {
      const k = still ? 0 : t;
      h.mx += (50 + 42 * Math.sin(k * 0.00055 + h.phase) - h.mx) * 0.08;
      h.my += (50 + 34 * Math.cos(k * 0.0004 + h.phase * 1.3) - h.my) * 0.08;
    }
    const s = h.el.style;
    s.setProperty('--mx', h.mx.toFixed(1) + '%');
    s.setProperty('--my', h.my.toFixed(1) + '%');
    s.setProperty('--rx', ((h.mx - 50) / 50) * 9 + 'deg');
    s.setProperty('--ry', ((50 - h.my) / 50) * 7 + 'deg');
    s.setProperty('--hue', ((h.mx + h.my) * 1.8).toFixed(0) + 'deg');
  }
  requestAnimationFrame(animate);
}

/** Feste Holo-Fassung auf dem Canvas (Duell, Ziehen): Regenbogen durch das Muster, nur auf dem Monster, Funkeln */
function holoStatic(src: HTMLCanvasElement, foil: Foil, seed: number): HTMLCanvasElement {
  const S = src.width;
  const out = document.createElement('canvas');
  out.width = out.height = S;
  const x = out.getContext('2d')!;
  x.drawImage(src, 0, 0);
  const [rain, rx] = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    return [c, c.getContext('2d')!] as const;
  })();
  const g = rx.createLinearGradient(0, 0, S, S * 0.6);
  const hues = [0, 45, 90, 160, 210, 270, 330, 360];
  hues.forEach((hh, i) => g.addColorStop(i / (hues.length - 1), `hsl(${hh} 95% 62%)`));
  rx.fillStyle = g;
  rx.fillRect(0, 0, S, S);
  const pat = rx.createPattern(tileCanvas(foil), 'repeat')!;
  rx.globalCompositeOperation = 'destination-in';
  rx.fillStyle = pat;
  rx.fillRect(0, 0, S, S);
  x.globalCompositeOperation = 'color-dodge';
  x.globalAlpha = 0.75;
  x.drawImage(rain, 0, 0);
  x.globalCompositeOperation = 'source-over';
  x.globalAlpha = 1;
  // Nur dort, wo Monster ist
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-over';
  const r = RNG(seed);
  for (let i = 0; i < 5; i++) {
    const px = rr(r, 0.2, 0.8) * S,
      py = rr(r, 0.15, 0.75) * S,
      R = rr(r, 0.03, 0.06) * S;
    x.save();
    x.shadowColor = '#fff';
    x.shadowBlur = R * 0.8;
    x.fillStyle = '#fff';
    x.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2,
        d = k % 2 ? R * 0.15 : R;
      k ? x.lineTo(px + Math.cos(a) * d, py + Math.sin(a) * d) : x.moveTo(px + Math.cos(a) * d, py + Math.sin(a) * d);
    }
    x.closePath();
    x.fill();
    x.restore();
  }
  return out;
}
/** Musterkacheln als Canvas (in main vorab dekodiert) */
const tileCanvases = new Map<Foil, HTMLCanvasElement>();
const tileCanvas = (kind: Foil): HTMLCanvasElement => tileCanvases.get(kind)!;

async function main(): Promise<void> {
  await Promise.all(['40px Caveat', '400 20px "Young Serif"', '900 20px Figtree', '700 20px "JetBrains Mono"'].map((f) => document.fonts.load(f).catch(() => null)));
  // Kacheln vorab dekodieren
  await Promise.all(
    (['rainbow', 'stars', 'diamond', 'glitter'] as Foil[]).map(
      (k) =>
        new Promise<void>((res) => {
          const im = new Image();
          im.onload = () => {
            const c = document.createElement('canvas');
            c.width = c.height = 96;
            c.getContext('2d')!.drawImage(im, 0, 0);
            tileCanvases.set(k, c);
            res();
          };
          im.src = foilTile(k);
        }),
    ),
  );
  const pulls = Array.from({ length: 8 }, (_, i) => gen2(`dip-${(65537 * (i + 5)).toString(36)}`, (i * 5 + 2) % 12));
  const hero = gen2('dip-shiny7', 3),
    dab = gen2(`dip-${(65537 * 6).toString(36)}`, 7);
  const grid = document.getElementById('cards')!;
  grid.append(
    card(hero, null, null, 'Carmine Tower', 'Watercolour, no holo', 'rare'),
    card(hero, null, 'stars', 'Carmine Tower', 'Watercolour', 'epic'),
    card(dab, 'anime', 'rainbow', 'Carmine Hopper', 'Anime', 'epic'),
    card(pulls[2]!, 'nouveau', 'glitter', 'Sienna Crawler', 'Art Nouveau', 'legendary'),
    card(pulls[4]!, 'pixel', 'diamond', 'Opera Umbrella', 'Pixel', 'rare'),
    card(pulls[5]!, 'graffiti', null, 'Sienna Quadruped', 'Graffiti, style only', 'uncommon'),
  );
  // Sammlung: kleine Kacheln, die Folie läuft langsam
  const coll = document.getElementById('coll')!;
  const kinds: [Monster, Parameters<typeof paint>[2], Foil | null][] = [
    [pulls[0]!, null, null],
    [pulls[1]!, null, 'rainbow'],
    [pulls[3]!, 'neon', null],
    [pulls[6]!, 'crayon', 'stars'],
    [pulls[7]!, null, null],
    [pulls[2]!, 'ukiyoe', null],
    [hero, null, 'glitter'],
    [pulls[4]!, null, null],
  ];
  for (const [m, st, foil] of kinds) {
    const t = document.createElement('div');
    t.className = 'tile' + (foil ? ' holo' : '');
    const f = document.createElement('div');
    f.className = 'face';
    const c = document.createElement('canvas');
    c.className = 'art';
    paint(c, m, st, 72, false);
    f.append(c);
    if (foil) {
      f.style.setProperty('--mask', `url(${foilTile(foil)})`);
      for (const k of ['foil', 'sheen']) {
        const d = document.createElement('div');
        d.className = k;
        f.append(d);
      }
      track(t);
    }
    t.append(f);
    coll.append(t);
  }
  // Duell: Aufkleber ohne und mit Holo (feste Fassung), auf Papier
  const duel = document.getElementById('duel') as HTMLCanvasElement;
  const W = 640,
    H = 300;
  duel.width = W;
  duel.height = H;
  const dx = duel.getContext('2d')!;
  dx.fillStyle = '#f4efe3';
  dx.fillRect(0, 0, W, H);
  const cols = ['rgba(196,67,47,.35)', 'rgba(40,70,111,.3)', 'rgba(207,154,60,.32)'];
  for (let i = 0; i < 6; i++)
    for (let j = 0; j < 3; j++) {
      dx.fillStyle = cols[(i + j) % 3]!;
      if ((i * 7 + j * 3) % 4) dx.fillRect(i * 107 + 3, j * 100 + 3, 101, 94);
    }
  const blots: [Monster, Parameters<typeof paint>[2], Foil | null, number][] = [
    [dab, null, null, 110],
    [dab, null, 'stars', 320],
    [pulls[4]!, 'pixel', 'diamond', 530],
  ];
  for (const [m, st, foil, x] of blots) {
    const c = document.createElement('canvas');
    if (!st) renderMonster(c, m, 180, { dpr: 1, paper: false });
    else renderStyled(c, { ...m, style: st as StyleId }, st as StyleId, 180, { dpr: 1, cutout: true });
    const img = foil ? holoStatic(c, foil, m.seed) : c;
    dx.fillStyle = 'rgba(43,63,163,.85)';
    dx.beginPath();
    dx.ellipse(x, 255, 60, 16, 0, 0, 7);
    dx.fill();
    if (foil) {
      // Regenbogenrand am Sockel
      const g = dx.createLinearGradient(x - 64, 0, x + 64, 0);
      [0, 60, 120, 200, 280, 340].forEach((hh, i) => g.addColorStop(i / 5, `hsl(${hh} 90% 60%)`));
      dx.strokeStyle = g;
      dx.lineWidth = 5;
      dx.beginPath();
      dx.ellipse(x, 255, 66, 20, 0, 0, 7);
      dx.stroke();
    }
    dx.drawImage(img, x - 90, 255 - 175, 180, 180);
  }
  requestAnimationFrame(animate);
  document.body.classList.add('ready');
  (window as unknown as { done: boolean }).done = true;
}
void main();
