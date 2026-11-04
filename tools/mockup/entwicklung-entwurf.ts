/*
 * Entwurfsbogen „Entwicklung“ (nur für docs/entwuerfe, docs/entwuerfe/entwicklung-vorschlag.md): ein Klecks bekommt
 * Schichten (zweite Lasur, eine Richtung, Signatur), dazu Falten als spätere Idee. Echte Kleckse aus dem Spiel,
 * die Schichten sind hier nur nachträglich aufs fertige Bild gemalt (im Spiel kämen sie als eigener Zufallsstrom in den Renderer).
 * Bauen: npx esbuild tools/mockup/entwicklung-entwurf.ts --bundle --format=iife --outfile=tools/mockup/entwicklung-entwurf.js
 */
import { renderMonster } from '../../src/client/renderer/watercolor';
import { humidityFor, makeMonster, type Monster } from '../../src/shared/monster';
import { RNG } from '../../src/shared/rng';

const DPR = 2;
const mon = (sheet: string, idx: number): Monster => ({ ...makeMonster(sheet, idx, humidityFor(sheet)), gen: 2 });
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};
/** Klecks ohne Papier (wie im Duell freigestellt) */
function bare(m: Monster, size: number, zoom = 1): HTMLCanvasElement {
  const c = document.createElement('canvas');
  renderMonster(c, m, size * zoom, { dpr: DPR, paper: false, look: true });
  if (zoom === 1) return c;
  // Größer malen und die Mitte nehmen: der Klecks füllt die Kachel besser
  const out = document.createElement('canvas');
  out.width = out.height = Math.round(size * DPR);
  const o = (c.width - out.width) / 2;
  out.getContext('2d')!.drawImage(c, o, o, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}
const copy = (src: HTMLCanvasElement): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  c.getContext('2d')!.drawImage(src, 0, 0);
  return c;
};
/** Deckkraft als Feld 0..1 und eine weiche Fassung davon (Kastenfilter, zweimal) */
function alphaOf(c: HTMLCanvasElement): Float32Array {
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  const a = new Float32Array(c.width * c.height);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3]! / 255;
  return a;
}
function blur(a: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(a.length);
  let cur = a;
  for (let pass = 0; pass < 2; pass++) {
    const out = new Float32Array(a.length);
    for (let y = 0; y < h; y++) {
      let s = 0;
      for (let x = -r; x <= r; x++) s += cur[y * w + Math.min(w - 1, Math.max(0, x))]!;
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = s / (2 * r + 1);
        s += cur[y * w + Math.min(w - 1, x + r + 1)]! - cur[y * w + Math.max(0, x - r)]!;
      }
    }
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]!;
      for (let y = 0; y < h; y++) {
        out[y * w + x] = s / (2 * r + 1);
        s += tmp[Math.min(h - 1, y + r + 1) * w + x]! - tmp[Math.max(0, y - r) * w + x]!;
      }
    }
    cur = out;
  }
  return cur;
}
/** Mittlere Farbe des Kleckses (für Spritzer) */
function meanColour(c: HTMLCanvasElement): [number, number, number] {
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (let i = 0; i < d.length; i += 4)
    if (d[i + 3]! > 180) {
      // dunkle Augen und Tusche nicht mitzählen
      if (d[i]! + d[i + 1]! + d[i + 2]! < 120) continue;
      r += d[i]!;
      g += d[i + 1]!;
      b += d[i + 2]!;
      n++;
    }
  return n ? [r / n, g / n, b / n] : [120, 100, 90];
}
/** Zufällige Punkte im Klecks (Deckkraft über min) */
function inside(a: Float32Array, w: number, h: number, r: () => number, min = 0.85): [number, number] {
  for (let t = 0; t < 4000; t++) {
    const x = Math.floor(r() * w),
      y = Math.floor(r() * h);
    if (a[y * w + x]! > min) return [x, y];
  }
  return [w / 2, h / 2];
}

/* ---------- Schicht 1: zweite Lasur (tiefer, deckender, Wasserrand) ---------- */
function secondWash(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = copy(src);
  const w = c.width,
    h = c.height;
  const x = c.getContext('2d')!;
  const img = x.getImageData(0, 0, w, h);
  const d = img.data;
  const A = alphaOf(c);
  const B = blur(A, w, h, 5 * DPR);
  for (let i = 0; i < A.length; i++) {
    if (A[i]! <= 0) continue;
    const edge = Math.min(1, Math.max(0, (A[i]! - B[i]!) * 3.2));
    for (let k = 0; k < 3; k++) {
      const v = d[i * 4 + k]!;
      const mult = (v * v) / 255;
      d[i * 4 + k] = (v * 0.55 + mult * 0.45) * (1 - 0.3 * edge);
    }
    d[i * 4 + 3] = Math.min(255, d[i * 4 + 3]! * 1.3);
  }
  x.putImageData(img, 0, 0);
  return c;
}

/* ---------- Schicht 2: vier Richtungen ---------- */
/** Bloom: Blumenkohl-Ränder, wo nasse Farbe zurückläuft (heller innen, dunkler Saum) */
function bloom(src: HTMLCanvasElement, seed: number): HTMLCanvasElement {
  const c = copy(src);
  const w = c.width,
    h = c.height;
  const x = c.getContext('2d')!;
  const img = x.getImageData(0, 0, w, h);
  const d = img.data;
  const A = alphaOf(c);
  const r = RNG(seed);
  const blooms = Array.from({ length: 4 }, () => {
    const [bx, by] = inside(A, w, h, r);
    return { bx, by, R: w * (0.07 + r() * 0.07), p1: r() * 6, p2: r() * 6, f1: 5 + Math.floor(r() * 3), f2: 11 + Math.floor(r() * 4) };
  });
  for (let y = 0; y < h; y++)
    for (let xx = 0; xx < w; xx++) {
      const i = y * w + xx;
      if (A[i]! <= 0.05) continue;
      for (const b of blooms) {
        const dx = xx - b.bx,
          dy = y - b.by;
        const dist = Math.hypot(dx, dy);
        const ang = Math.atan2(dy, dx);
        const Rn = b.R * (1 + 0.14 * Math.sin(b.f1 * ang + b.p1) + 0.07 * Math.sin(b.f2 * ang + b.p2));
        if (dist > Rn + 3 * DPR) continue;
        const ring = Math.max(0, 1 - Math.abs(dist - Rn) / (2.2 * DPR));
        const inner = dist < Rn ? 0.3 * (1 - (dist / Rn) ** 2) + 0.1 : 0;
        for (let k = 0; k < 3; k++) {
          let v = d[i * 4 + k]!;
          v = v + (250 - v) * inner;
          v = v * (1 - 0.5 * ring);
          d[i * 4 + k] = v;
        }
      }
    }
  x.putImageData(img, 0, 0);
  return c;
}
/** Spatter: Spritzerkranz in der Farbe des Kleckses, ein paar große Tropfen mit Trabanten */
function spatter(src: HTMLCanvasElement, seed: number): HTMLCanvasElement {
  const c = copy(src);
  const w = c.width,
    h = c.height;
  const x = c.getContext('2d')!;
  const A = alphaOf(c);
  const r = RNG(seed);
  const [cr, cg, cb] = meanColour(src);
  const deep = `rgb(${cr * 0.7},${cg * 0.7},${cb * 0.7})`;
  let sx = 0,
    sy = 0,
    n = 0;
  for (let i = 0; i < A.length; i++)
    if (A[i]! > 0.5) {
      sx += i % w;
      sy += Math.floor(i / w);
      n++;
    }
  const mx = sx / n,
    my = sy / n;
  const drops = (k: number, big: boolean) => {
    for (let j = 0; j < k; j++) {
      const [px, py] = inside(A, w, h, r, 0.4);
      const a = Math.atan2(py - my, px - mx) + (r() - 0.5) * 0.6;
      const far = (big ? 18 : 6) * DPR + r() * (big ? 26 : 44) * DPR;
      const qx = px + Math.cos(a) * far,
        qy = py + Math.sin(a) * far;
      if (qx < 4 || qy < 4 || qx > w - 4 || qy > h - 4) continue;
      const rad = (big ? 3.2 + r() * 3 : 0.6 + r() * 2) * DPR;
      x.globalAlpha = 0.55 + r() * 0.4;
      x.fillStyle = r() < 0.35 ? deep : `rgb(${cr},${cg},${cb})`;
      x.beginPath();
      x.ellipse(qx, qy, rad * (1 + r() * 0.6), rad, a, 0, Math.PI * 2);
      x.fill();
      if (big)
        for (let s = 0; s < 4; s++) {
          const b2 = a + (r() - 0.5) * 1.4;
          x.beginPath();
          x.arc(qx + Math.cos(b2) * rad * (1.6 + r() * 2), qy + Math.sin(b2) * rad * (1.6 + r() * 2), rad * (0.15 + r() * 0.25), 0, Math.PI * 2);
          x.fill();
        }
    }
  };
  drops(70, false);
  drops(5, true);
  x.globalAlpha = 1;
  return c;
}
/** Impasto: dicke Farbe mit Pinselrelief (Licht von oben links) */
function impasto(src: HTMLCanvasElement, seed: number): HTMLCanvasElement {
  const c = copy(src);
  const w = c.width,
    h = c.height;
  const x = c.getContext('2d')!;
  const r = RNG(seed);
  const hm = document.createElement('canvas');
  hm.width = w;
  hm.height = h;
  const hx = hm.getContext('2d')!;
  hx.fillStyle = '#808080';
  hx.fillRect(0, 0, w, h);
  hx.lineCap = 'round';
  for (let k = 0; k < 140; k++) {
    const px = r() * w,
      py = r() * h,
      a = -0.6 + (r() - 0.5) * 0.9,
      len = (8 + r() * 18) * DPR;
    const g = Math.floor(70 + r() * 120);
    hx.strokeStyle = `rgb(${g},${g},${g})`;
    hx.lineWidth = (4 + r() * 6) * DPR;
    hx.beginPath();
    hx.moveTo(px, py);
    hx.quadraticCurveTo(px + Math.cos(a) * len * 0.5 + (r() - 0.5) * 6, py + Math.sin(a) * len * 0.5 + (r() - 0.5) * 6, px + Math.cos(a) * len, py + Math.sin(a) * len);
    hx.stroke();
  }
  const H0 = hx.getImageData(0, 0, w, h).data;
  const H = new Float32Array(w * h);
  for (let i = 0; i < H.length; i++) H[i] = H0[i * 4]! / 255;
  const Hs = blur(H, w, h, 1 * DPR);
  const img = x.getImageData(0, 0, w, h);
  const d = img.data;
  const A = alphaOf(c);
  for (let y = 1; y < h - 1; y++)
    for (let xx = 1; xx < w - 1; xx++) {
      const i = y * w + xx;
      if (A[i]! <= 0.08) continue;
      const shade = (Hs[i - 2 * w - 2]! - Hs[i + 2 * w + 2]!) * 330;
      for (let k = 0; k < 3; k++) d[i * 4 + k] = d[i * 4 + k]! * 0.9 + shade;
      d[i * 4 + 3] = A[i]! > 0.25 ? 255 : d[i * 4 + 3]! * 2;
    }
  x.putImageData(img, 0, 0);
  return c;
}
/** Lift: ausgehobene Lichter (nasser Pinsel nimmt Farbe wieder weg), Papier scheint durch */
function lift(src: HTMLCanvasElement, seed: number): HTMLCanvasElement {
  const c = copy(src);
  const w = c.width,
    h = c.height;
  const x = c.getContext('2d')!;
  const A = alphaOf(c);
  const r = RNG(seed);
  x.save();
  x.globalCompositeOperation = 'source-atop';
  x.lineCap = 'round';
  x.filter = `blur(${1.6 * DPR}px)`;
  for (let k = 0; k < 9; k++) {
    const [px, py] = inside(A, w, h, r, 0.9);
    const a = -0.9 + (r() - 0.5) * 0.8,
      len = (14 + r() * 22) * DPR;
    x.strokeStyle = `rgba(253,250,242,${0.75 + r() * 0.2})`;
    x.lineWidth = (4 + r() * 6) * DPR;
    x.beginPath();
    x.moveTo(px, py);
    x.quadraticCurveTo(px + Math.cos(a + 0.6) * len * 0.6, py + Math.sin(a + 0.6) * len * 0.6, px + Math.cos(a) * len, py + Math.sin(a) * len);
    x.stroke();
  }
  x.restore();
  return c;
}

/* ---------- Schicht 3: Signatur (Tusche, Blattgold) ---------- */
function signed(src: HTMLCanvasElement, seed: number): HTMLCanvasElement {
  const w = src.width,
    h = src.height;
  const A = alphaOf(src);
  const Bs = blur(A, w, h, Math.round(3 * DPR));
  const ink = document.createElement('canvas');
  ink.width = w;
  ink.height = h;
  const ix = ink.getContext('2d')!;
  const img = ix.createImageData(w, h);
  const d = img.data;
  const r = RNG(seed);
  const p1 = r() * 9,
    p2 = r() * 9;
  for (let y = 0; y < h; y++)
    for (let xx = 0; xx < w; xx++) {
      const i = y * w + xx;
      const band = Bs[i]! > 0.08 && A[i]! < 0.6;
      if (!band) continue;
      // Tuschelinie mit Druck: mal dünner, mal ganz weg
      const press = Math.sin(xx * 0.031 + p1) + Math.sin(y * 0.027 + p2) + Math.sin((xx + y) * 0.013);
      if (press < -1.4) continue;
      const k = Math.min(1, (Bs[i]! - 0.08) * 5) * Math.min(1, (press + 1.4) / 0.9);
      d[i * 4] = 38;
      d[i * 4 + 1] = 27;
      d[i * 4 + 2] = 22;
      d[i * 4 + 3] = 235 * k;
    }
  ix.putImageData(img, 0, 0);
  const c = copy(src);
  const x = c.getContext('2d')!;
  x.drawImage(ink, 0, 0);
  // Blattgold: unregelmäßige Plättchen nah am Rand
  for (let k = 0; k < 7; k++) {
    let px = 0,
      py = 0;
    for (let t = 0; t < 3000; t++) {
      const [qx, qy] = inside(A, w, h, r, 0.6);
      const e = A[qy * w + qx]! - Bs[qy * w + qx]!;
      px = qx;
      py = qy;
      if (e > 0.05 || t > 2900) break;
    }
    const rad = (4 + r() * 6) * DPR;
    const g = x.createLinearGradient(px - rad, py - rad, px + rad, py + rad);
    g.addColorStop(0, '#f8e4a0');
    g.addColorStop(0.45, '#c9982e');
    g.addColorStop(0.7, '#f2d27a');
    g.addColorStop(1, '#9c7220');
    x.fillStyle = g;
    x.globalAlpha = 0.92;
    x.beginPath();
    const nV = 5 + Math.floor(r() * 3);
    for (let v = 0; v < nV; v++) {
      const a = (v / nV) * Math.PI * 2 + r() * 0.5;
      const rr = rad * (0.6 + r() * 0.5);
      if (v) x.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr);
      else x.moveTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr);
    }
    x.closePath();
    x.fill();
    x.globalAlpha = 1;
  }
  return c;
}

/* ---------- Falten: zwei Kleckse auf einer Hälfte, Blatt zuklappen ---------- */
function fold(a: HTMLCanvasElement, b: HTMLCanvasElement): HTMLCanvasElement {
  const w = a.width,
    h = a.height;
  const half = document.createElement('canvas');
  half.width = w;
  half.height = h;
  const hx = half.getContext('2d')!;
  hx.drawImage(a, -w * 0.2, -h * 0.04, w * 0.95, h * 0.95);
  // Wo beide übereinanderliegen, mischen sich die Farben
  hx.globalCompositeOperation = 'multiply';
  hx.globalAlpha = 0.9;
  hx.drawImage(b, -w * 0.02, h * 0.1, w * 0.8, h * 0.8);
  hx.globalAlpha = 1;
  hx.globalCompositeOperation = 'destination-out';
  hx.fillRect(w / 2, 0, w / 2, h);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ox = out.getContext('2d')!;
  ox.drawImage(half, 0, 0);
  ox.save();
  ox.translate(w, 0);
  ox.scale(-1, 1);
  // Der Abdruck ist etwas blasser als die Seite, auf die gemalt wurde
  ox.globalAlpha = 0.82;
  ox.drawImage(half, 0, 0);
  ox.restore();
  return secondWash(out);
}

/* ---------- Bogen ---------- */
const grid = document.getElementById('grid')!;
function card(title: string, sub: string, wide = true): HTMLElement {
  const c = el('div', 'card' + (wide ? ' wide' : ''), `<h2>${title}</h2>${sub ? `<p class="note top">${sub}</p>` : ''}`);
  grid.append(c);
  return c;
}
function tile(canvas: HTMLCanvasElement, size: number, title: string, lines: string[], tag = ''): HTMLElement {
  const f = el('figure', 'tile');
  const frame = el('div', 'paper');
  canvas.style.width = canvas.style.height = size + 'px';
  frame.append(canvas);
  if (tag) frame.append(el('span', 'tag', tag));
  f.append(frame, el('b', '', title), el('div', 'lines', lines.map((l) => `<span>${l}</span>`).join('')));
  return f;
}
const SIZE = 196;
const hero = mon('evo4', 36);
const base = bare(hero, SIZE, 1.35);
const w1 = secondWash(base);
const seed = hero.seed;

// 1 Schichten
{
  const c = card('Schichten: derselbe Klecks, drei Schichten mehr', 'Jede Schicht kommt nach Erfahrung im Spiel und kostet etwas. Aussehen und Werte ändern sich sichtbar, der Klecks bleibt erkennbar derselbe.');
  const row = el('div', 'row4');
  row.append(
    tile(base, SIZE, 'First wash', ['wie heute', 'jeder Würfel beginnt hier'], 'Layer 0'),
    tile(w1, SIZE, 'Second wash', ['Farbe tiefer, dunkler Wasserrand', '+2 Lebenskraft', 'eine Seite besser'], 'Layer 1'),
    tile(bloom(w1, seed ^ 0xb100), SIZE, 'Bloom', ['Richtung gewählt (hier Bloom)', 'Wert der Richtung +2'], 'Layer 2'),
    tile(signed(bloom(w1, seed ^ 0xb100), seed ^ 0x5161), SIZE, 'Signed', ['Tuschelinie, Blattgold', 'Meisterzug ab 5 statt 6 Sättigung', 'dein Name auf der Karte'], 'Layer 3'),
  );
  c.append(row);
}
// 2 Richtungen
{
  const c = card('Schicht 2: die Richtung', 'Sepia bietet zwei von vier an, je nachdem, was der Klecks im Duell meistens getan hat. Du wählst eine.');
  const row = el('div', 'row4');
  row.append(
    tile(spatter(w1, seed ^ 0x5a77), SIZE, 'Spatter', ['oft gespritzt', 'Schaden +2', 'Spritzerkranz'], 'Splash'),
    tile(impasto(w1, seed ^ 0x1a90), SIZE, 'Impasto', ['oft getroffen und überlebt', 'Lebenskraft +4', 'dicke, deckende Farbe'], 'Guard'),
    tile(bloom(w1, seed ^ 0xb100), SIZE, 'Bloom', ['viel Papier gemalt', 'Farbe verläuft 1 Feld weiter', 'Blumenkohl-Ränder'], 'Paint'),
    tile(lift(w1, seed ^ 0x11f7), SIZE, 'Lift', ['viel bewegt, ausgewichen', 'Ausweichen +5 %, 1 Schritt weiter', 'ausgehobene Lichter'], 'Step'),
  );
  c.append(row);
}
// 3 Bedienung
{
  const c = card('Am Handy: Karte und Sepias Angebot', '', false);
  const k = el('div', 'mock');
  const small = bare(hero, 92, 1.35);
  const mini = secondWash(small);
  mini.style.width = mini.style.height = '92px';
  const cardEl = el('div', 'dcard');
  const pic = el('div', 'dpic');
  pic.append(mini);
  cardEl.append(
    pic,
    el(
      'div',
      'dtxt',
      `<b>Shellmoss</b> <small>#00427 · Rare</small><div class="layer">Layer 1/3 · Second wash</div><div class="bar"><i style="width:60%"></i></div><small>Unfolded 9/15 times · next layer 250 <span class="pig"></span></small>`,
    ),
  );
  k.append(cardEl);
  const offer = el('div', 'offer');
  offer.append(el('p', 'sep', 'Master Sepia: “It keeps throwing paint at things. Shall we lean into that, or let it bloom?”'));
  const two = el('div', 'two');
  const o1 = spatter(secondWash(bare(hero, 70, 1.35)), seed ^ 0x5a77);
  const o2 = bloom(secondWash(bare(hero, 70, 1.35)), seed ^ 0xb100);
  for (const [cv, t, s] of [
    [o1, 'Spatter', 'Splash +2'],
    [o2, 'Bloom', 'Paint bleeds 1 further'],
  ] as const) {
    cv.style.width = cv.style.height = '70px';
    const b = el('button', 'opt');
    b.append(cv, el('b', '', t), el('small', '', s));
    two.append(b);
  }
  offer.append(two);
  k.append(offer);
  c.append(k, el('p', 'note', 'Fortschritt steht auf der Würfelkarte. Ist die Schicht bereit, leuchtet die Karte, ein Tipp malt sie: Pinsel, Lasur, Ton wie beim Ziehen, die Werte zählen sichtbar hoch.'));
}
// 4 Falten
{
  const c = card('Später: Falten (aus „Später“ in CLAUDE.md)', '', false);
  const a = mon('evo5', 29),
    b = mon('evo4', 20);
  const ca = bare(a, 120),
    cb = bare(b, 120);
  const folded = fold(bare(a, 150), bare(b, 150));
  const row = el('div', 'frow');
  for (const cv of [ca, cb]) cv.style.width = cv.style.height = '96px';
  folded.style.width = folded.style.height = '150px';
  const pa = el('div', 'paper sm');
  pa.append(ca);
  const pb = el('div', 'paper sm');
  pb.append(cb);
  const pf = el('div', 'paper');
  pf.append(folded);
  row.append(pa, el('span', 'op', '+'), pb, el('span', 'op', '→'), pf);
  c.append(row, el('p', 'note', 'Zwei Kleckse kommen auf eine Hälfte des Blatts, das Blatt klappt zu: ein neuer, spiegelgleicher Klecks wie beim Rorschach-Test. Beide alten gehen ins Archiv. Neue Art, also neuer „What do you see?“-Post.'));
}
