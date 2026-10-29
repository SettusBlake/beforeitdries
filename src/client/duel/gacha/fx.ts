/*
 * Bausteine für die Ziehen-Inszenierung: Texturen aus Code (Leuchten, Strahlen, Ringe, Funkeln, Papier, Rauschen)
 * und ein kleines Partikelsystem. Alles prozedural, keine Bilddateien.
 */
import { Container, Sprite, Texture } from 'pixi.js';
import { grainTex } from '../../renderer/watercolor';

function canvas(w: number, h = w): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}
const cache = new Map<string, Texture>();
function once(key: string, make: () => HTMLCanvasElement): Texture {
  let t = cache.get(key);
  if (!t) {
    t = Texture.from(make());
    cache.set(key, t);
  }
  return t;
}

/** Weiches, rundes Leuchten (zum Einfärben mit tint) */
export const glowTex = () =>
  once('glow', () => {
    const [c, x] = canvas(256);
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,.55)');
    g.addColorStop(0.6, 'rgba(255,255,255,.14)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    return c;
  });

/** Lichtstrahlen um die Mitte, außen ausgeblendet */
export const raysTex = () =>
  once('rays', () => {
    const [c, x] = canvas(512);
    x.translate(256, 256);
    const n = 18;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const w = k % 2 ? 0.07 : 0.12;
      const g = x.createLinearGradient(0, 0, Math.cos(a) * 256, Math.sin(a) * 256);
      g.addColorStop(0, 'rgba(255,255,255,.9)');
      g.addColorStop(0.55, 'rgba(255,255,255,.25)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(0, 0);
      x.arc(0, 0, 256, a - w, a + w);
      x.closePath();
      x.fill();
    }
    return c;
  });

/** Ring für Druckwellen */
export const ringTex = () =>
  once('ring', () => {
    const [c, x] = canvas(256);
    x.strokeStyle = 'white';
    x.lineWidth = 10;
    x.shadowColor = 'white';
    x.shadowBlur = 14;
    x.beginPath();
    x.arc(128, 128, 104, 0, Math.PI * 2);
    x.stroke();
    return c;
  });

/** Vierzackiges Funkeln */
export const sparkTex = () =>
  once('spark', () => {
    const [c, x] = canvas(64);
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,.4)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    x.fillStyle = 'white';
    x.beginPath();
    x.moveTo(32, 2);
    x.quadraticCurveTo(35, 29, 62, 32);
    x.quadraticCurveTo(35, 35, 32, 62);
    x.quadraticCurveTo(29, 35, 2, 32);
    x.quadraticCurveTo(29, 29, 32, 2);
    x.fill();
    return c;
  });

/** Runder Farbtropfen mit Glanzpunkt */
export const dropTex = () =>
  once('drop', () => {
    const [c, x] = canvas(64);
    x.fillStyle = 'white';
    x.beginPath();
    x.arc(32, 32, 28, 0, Math.PI * 2);
    x.fill();
    return c;
  });

/** Blattgold-Flocke: unregelmäßiges Viereck */
export const flakeTex = () =>
  once('flake', () => {
    const [c, x] = canvas(32);
    x.fillStyle = 'white';
    x.beginPath();
    x.moveTo(4, 8);
    x.lineTo(26, 3);
    x.lineTo(29, 24);
    x.lineTo(7, 29);
    x.closePath();
    x.fill();
    return c;
  });

/** Rauschen für die Verzerrung (rot und grün sind die Verschiebung) */
export const noiseTex = () =>
  once('noise', () => {
    const [c, x] = canvas(256);
    x.fillStyle = 'rgb(128,128,128)';
    x.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 90; k++) {
      const px = Math.random() * 256,
        py = Math.random() * 256,
        r = 12 + Math.random() * 40;
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      const cr = Math.floor(Math.random() * 255),
        cg = Math.floor(Math.random() * 255);
      g.addColorStop(0, `rgba(${cr},${cg},128,.55)`);
      g.addColorStop(1, `rgba(${cr},${cg},128,0)`);
      x.fillStyle = g;
      x.fillRect(px - r, py - r, r * 2, r * 2);
    }
    return c;
  });

/** Ein Blatt Aquarellpapier mit Körnung und leicht ausgefranstem Rand */
export function paperCanvas(w: number, h: number, tone: readonly number[], deckle: boolean): HTMLCanvasElement {
  const [c, x] = canvas(w, h);
  const m = 6;
  x.beginPath();
  const pts: [number, number][] = [];
  const steps = 26;
  const jitter = deckle ? 2.6 : 0.6;
  for (let k = 0; k < steps; k++) pts.push([m + ((w - 2 * m) * k) / steps, m + (Math.random() - 0.5) * jitter]);
  for (let k = 0; k < steps; k++) pts.push([w - m + (Math.random() - 0.5) * jitter, m + ((h - 2 * m) * k) / steps]);
  for (let k = 0; k < steps; k++) pts.push([w - m - ((w - 2 * m) * k) / steps, h - m + (Math.random() - 0.5) * jitter]);
  for (let k = 0; k < steps; k++) pts.push([m + (Math.random() - 0.5) * jitter, h - m - ((h - 2 * m) * k) / steps]);
  pts.forEach(([px, py], k) => (k ? x.lineTo(px, py) : x.moveTo(px, py)));
  x.closePath();
  x.fillStyle = `rgb(${tone.join(',')})`;
  x.fill();
  x.save();
  x.clip();
  x.globalAlpha = 0.5;
  x.fillStyle = x.createPattern(grainTex(), 'repeat')!;
  x.fillRect(0, 0, w, h);
  x.globalAlpha = 1;
  const g = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.7);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(120,100,80,.12)');
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  x.restore();
  return c;
}

/** Weich leuchtender Rahmen um ein Blatt der Größe s (weiß, zum Einfärben) */
export function edgeGlowCanvas(s: number): HTMLCanvasElement {
  const pad = 44;
  const [c, x] = canvas(s + pad * 2);
  x.strokeStyle = 'white';
  x.shadowColor = 'white';
  x.lineWidth = 8;
  for (const blur of [26, 14, 6]) {
    x.shadowBlur = blur;
    x.beginPath();
    x.roundRect(pad - 6, pad - 6, s + 12, s + 12, 10);
    x.stroke();
  }
  return c;
}

/** Hintergrund: dunkler Arbeitstisch, über dem Blatt ein warmer Lichtkegel */
export function backdropCanvas(w: number, h: number): HTMLCanvasElement {
  const [c, x] = canvas(Math.max(2, Math.round(w)), Math.max(2, Math.round(h)));
  const g = x.createRadialGradient(w / 2, h * 0.42, 10, w / 2, h * 0.45, Math.max(w, h) * 0.75);
  g.addColorStop(0, '#3b302b');
  g.addColorStop(0.45, '#221c22');
  g.addColorStop(1, '#0d0b12');
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  x.globalAlpha = 0.18;
  x.fillStyle = x.createPattern(grainTex(), 'repeat')!;
  x.fillRect(0, 0, w, h);
  return c;
}

/* ---------- Partikel ---------- */
export type Part = {
  s: Sprite;
  vx: number;
  vy: number;
  g: number;
  drag: number;
  life: number;
  age: number;
  spin: number;
  flip: number;
  a0: number;
  s0: number;
  s1: number;
};
export class Particles {
  readonly layer = new Container();
  private list: Part[] = [];
  spawn(o: { tex: Texture; x: number; y: number; vx?: number; vy?: number; g?: number; drag?: number; life: number; tint?: number; alpha?: number; scale?: number; scaleEnd?: number; add?: boolean; spin?: number; flip?: number; rot?: number }): Part {
    const s = new Sprite(o.tex);
    s.anchor.set(0.5);
    s.position.set(o.x, o.y);
    s.tint = o.tint ?? 0xffffff;
    s.alpha = o.alpha ?? 1;
    s.rotation = o.rot ?? 0;
    if (o.add) s.blendMode = 'add';
    const sc = o.scale ?? 1;
    s.scale.set(sc);
    this.layer.addChild(s);
    const p: Part = { s, vx: o.vx ?? 0, vy: o.vy ?? 0, g: o.g ?? 0, drag: o.drag ?? 0, life: o.life, age: 0, spin: o.spin ?? 0, flip: o.flip ?? 0, a0: s.alpha, s0: sc, s1: o.scaleEnd ?? sc };
    this.list.push(p);
    return p;
  }
  /** dt in Millisekunden */
  update(dt: number): void {
    const t = dt / 1000;
    this.list = this.list.filter((p) => {
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) {
        p.s.destroy();
        return false;
      }
      p.vy += p.g * t;
      const d = Math.pow(1 - p.drag, t * 60);
      p.vx *= d;
      p.vy *= d;
      p.s.x += p.vx * t;
      p.s.y += p.vy * t;
      p.s.rotation += p.spin * t;
      const sc = p.s0 + (p.s1 - p.s0) * k;
      p.s.scale.set(p.flip ? sc * Math.cos(p.age / 1000 * p.flip) : sc, sc);
      p.s.alpha = p.a0 * (k > 0.7 ? (1 - k) / 0.3 : 1);
      return true;
    });
  }
  clear(): void {
    for (const p of this.list) p.s.destroy();
    this.list = [];
  }
}
