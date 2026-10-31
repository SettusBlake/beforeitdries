/*
 * Holo (das Shiny seit 31.10.2026, docs/entwuerfe/stil-und-holo-plan.md): Folie über dem gemalten Bild.
 * Karte, Sammlung und Deck bekommen Lagen aus CSS, die mit dem Finger kippen und sonst von selbst wandern
 * (Regenbogen mit color-dodge durch ein Muster als Maske, Schimmer, Lichtfleck). Duell und Ziehen bekommen
 * eine feste Fassung auf dem Canvas (holoBake). Das Muster kommt aus dem Seed (foilOf).
 */
import './holo.css';
import { foilOf, type FoilId } from '../../shared/dice';
import { RNG, rr } from '../../shared/rng';

const N = 96;
const tiles = new Map<FoilId, HTMLCanvasElement>();
const urls = new Map<FoilId, string>();
/** Musterkachel der Folie: weiße Formen auf Durchsichtig */
export function foilTile(kind: FoilId): HTMLCanvasElement {
  const hit = tiles.get(kind);
  if (hit) return hit;
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
      // Über den Rand hinaus wiederholt, damit die Kachel nahtlos ist
      for (const [dx, dy] of [
        [0, 0],
        [N, 0],
        [-N, 0],
        [0, N],
        [0, -N],
      ] as const) {
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
  tiles.set(kind, c);
  return c;
}
const foilUrl = (kind: FoilId): string => {
  let u = urls.get(kind);
  if (!u) urls.set(kind, (u = foilTile(kind).toDataURL()));
  return u;
};

/**
 * Feste Holo-Fassung auf dem Canvas: Regenbogen durch das Muster (color-dodge), leichter Schimmer, Funkeln.
 * shape: nur dort, wo das Bild deckt (Aufkleber im Duell). Gibt ein neues Canvas zurück, das Bild bleibt
 */
export function holoBake(src: HTMLCanvasElement, seed: number, o: { shape?: boolean; phase?: number } = {}): HTMLCanvasElement {
  const S = src.width,
    H = src.height;
  const foil = foilOf(seed);
  const out = document.createElement('canvas');
  out.width = S;
  out.height = H;
  const x = out.getContext('2d')!;
  x.drawImage(src, 0, 0);
  const rain = document.createElement('canvas');
  rain.width = S;
  rain.height = H;
  const rx = rain.getContext('2d')!;
  const ph = (o.phase ?? (seed % 97) / 97) * S;
  const g = rx.createLinearGradient(-ph, 0, S * 1.4 - ph, H * 0.8);
  const hues = [0, 45, 90, 160, 210, 270, 330, 360];
  hues.forEach((h, i) => g.addColorStop(i / (hues.length - 1), `hsl(${h} 95% 62%)`));
  rx.fillStyle = g;
  rx.fillRect(0, 0, S, H);
  // Leichter Schimmer über allem, auch auf hellem Papier
  x.globalCompositeOperation = 'multiply';
  x.globalAlpha = 0.16;
  x.drawImage(rain, 0, 0);
  // Das Muster leuchtet stark
  const pat = rx.createPattern(foilTile(foil), 'repeat')!;
  try {
    pat.setTransform(new DOMMatrix().scale(Math.max(0.5, S / 640)));
  } catch {
    /* egal */
  }
  rx.globalCompositeOperation = 'destination-in';
  rx.fillStyle = pat;
  rx.fillRect(0, 0, S, H);
  x.globalCompositeOperation = 'color-dodge';
  x.globalAlpha = 0.75;
  x.drawImage(rain, 0, 0);
  x.globalCompositeOperation = 'source-over';
  x.globalAlpha = 1;
  if (o.shape) {
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-over';
  }
  // Funkeln
  const r = RNG(seed + 4711);
  for (let i = 0; i < 5; i++) {
    const px = rr(r, 0.2, 0.8) * S,
      py = rr(r, 0.15, 0.75) * H,
      R = rr(r, 0.025, 0.05) * S;
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

/* ---------- Bewegte Folie im DOM ---------- */
type Live = { el: HTMLElement; phase: number; held: boolean; mx: number; my: number; tilt: boolean };
const live: Live[] = [];
let running = false;
const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
function loop(t: number): void {
  for (let i = live.length - 1; i >= 0; i--) if (!live[i]!.el.isConnected) live.splice(i, 1);
  if (!live.length) {
    running = false;
    return;
  }
  for (const h of live) {
    if (!h.held) {
      const k = still ? 0 : t;
      h.mx += (50 + 42 * Math.sin(k * 0.00055 + h.phase) - h.mx) * 0.08;
      h.my += (50 + 34 * Math.cos(k * 0.0004 + h.phase * 1.3) - h.my) * 0.08;
    }
    const s = h.el.style;
    s.setProperty('--mx', h.mx.toFixed(1) + '%');
    s.setProperty('--my', h.my.toFixed(1) + '%');
    s.setProperty('--hue', ((h.mx + h.my) * 1.8).toFixed(0) + 'deg');
    if (h.tilt) {
      s.setProperty('--rx', (((h.mx - 50) / 50) * 8).toFixed(2) + 'deg');
      s.setProperty('--ry', (((50 - h.my) / 50) * 6).toFixed(2) + 'deg');
    }
  }
  requestAnimationFrame(loop);
}
/**
 * Folie über ein Bild legen: face ist der Rahmen um das Bild (position: relative), host bekommt Licht und Kippen.
 * tilt: die Karte kippt mit dem Finger (nur die große Karte), sonst wandert nur das Licht
 */
export function addHolo(face: HTMLElement, seed: number, host: HTMLElement = face, tilt = false): void {
  face.classList.add('holo-face');
  face.style.setProperty('--mask', `url(${foilUrl(foilOf(seed))})`);
  for (const k of ['holo-foil', 'holo-sheen', 'holo-glare']) {
    const d = document.createElement('div');
    d.className = k;
    d.setAttribute('aria-hidden', 'true');
    face.append(d);
  }
  host.classList.add('holo');
  const h: Live = { el: host, phase: (seed % 1000) / 160, held: false, mx: 50, my: 50, tilt };
  live.push(h);
  if (tilt) {
    host.classList.add('holo-tilt');
    const at = (e: PointerEvent) => {
      const b = host.getBoundingClientRect();
      h.mx = Math.max(0, Math.min(100, ((e.clientX - b.left) / b.width) * 100));
      h.my = Math.max(0, Math.min(100, ((e.clientY - b.top) / b.height) * 100));
    };
    face.addEventListener('pointerdown', (e) => {
      h.held = true;
      face.setPointerCapture(e.pointerId);
      at(e);
    });
    face.addEventListener('pointermove', (e) => h.held && at(e));
    const up = () => (h.held = false);
    face.addEventListener('pointerup', up);
    face.addEventListener('pointercancel', up);
  }
  if (!running) {
    running = true;
    requestAnimationFrame(loop);
  }
}
