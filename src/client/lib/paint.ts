/*
 * Mal-Warteschlange: Aquarelle erst malen, wenn sie sichtbar werden, und nie länger als
 * 40 ms pro Frame am Stück. Leistungsstufen für schwache Geräte:
 *   0 volle Auflösung (bis devicePixelRatio 2)
 *   1 Auflösung 1x: gleiches Bild, etwa halbe Malzeit
 *   2 zusätzlich halbe Schichtzahl (letzte Stufe, Optik etwas härter)
 */
import { renderMonster, type Paintable, type RenderOptions } from '../renderer/watercolor';

type Nav = Navigator & { deviceMemory?: number };
const nav = navigator as Nav;
let tier = (nav.hardwareConcurrency || 8) <= 4 || (nav.deviceMemory || 8) <= 3 ? 1 : 0;
let ema = 0,
  samples = 0;

/* Grenzwerte für die reine Rechenzeit eines Bildes (Rastern läuft danach und ist nicht gemessen) */
const LIMIT = [45, 90];

function options(): RenderOptions {
  return tier === 0 ? {} : tier === 1 ? { dpr: 1 } : { dpr: 1, quality: 'lite' };
}

function adapt(ms: number): void {
  samples++;
  ema = ema ? ema * 0.7 + ms * 0.3 : ms;
  if (tier < 2 && samples >= 2 && ema > LIMIT[tier]!) {
    tier++;
    ema = 0;
    samples = 0;
  }
}

const pending = new Map<HTMLCanvasElement, Paintable>();
const painted = new Map<HTMLCanvasElement, Paintable>();
const queue: HTMLCanvasElement[] = [];
let busy = false;

const io =
  'IntersectionObserver' in window
    ? new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            io!.unobserve(e.target);
            enqueue(e.target as HTMLCanvasElement, false);
          }
        },
        { rootMargin: '240px 0px' },
      )
    : null;

function enqueue(c: HTMLCanvasElement, front: boolean): void {
  const i = queue.indexOf(c);
  if (i >= 0) queue.splice(i, 1);
  if (front) queue.unshift(c);
  else queue.push(c);
  if (!busy) {
    busy = true;
    requestAnimationFrame(step);
  }
}

function step(): void {
  const t0 = performance.now();
  while (queue.length && performance.now() - t0 < 40) {
    const c = queue.shift()!;
    const m = pending.get(c);
    if (!m || !c.isConnected) continue;
    pending.delete(c);
    const w = c.getBoundingClientRect().width || 260;
    adapt(renderMonster(c, m, w, options()));
    painted.set(c, m);
  }
  for (const c of painted.keys()) if (!c.isConnected) painted.delete(c);
  if (queue.length) requestAnimationFrame(step);
  else busy = false;
}

/** Malt das Monster auf die Leinwand, sobald sie sichtbar ist. now: sofort und zuerst. */
export function paint(canvas: HTMLCanvasElement, m: Paintable, now = false): void {
  pending.set(canvas, m);
  if (now || !io) enqueue(canvas, now);
  else io.observe(canvas);
}

/* Bei deutlicher Größenänderung alles Sichtbare neu malen */
let lastW = window.innerWidth,
  rt = 0;
window.addEventListener('resize', () => {
  clearTimeout(rt);
  rt = window.setTimeout(() => {
    if (Math.abs(window.innerWidth - lastW) < 60) return;
    lastW = window.innerWidth;
    for (const [c, m] of painted) if (c.isConnected) paint(c, m);
  }, 250);
});
