/* Zufall: wörtlich aus dem Prototyp übernommen. Jede Änderung verändert das Aussehen aller Monster. */

export type Rand = () => number;

/** mulberry32 */
export function RNG(seed: number): Rand {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32 Bit */
export function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const rr = (r: Rand, a: number, b: number): number => a + (b - a) * r();
export const ri = (r: Rand, a: number, b: number): number => Math.floor(a + (b - a + 1) * r());
export const pick = <T>(r: Rand, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)] as T;
export const pickIndex = (r: Rand, n: number): number => Math.floor(r() * n);

/** Box-Muller. Wie im Prototyp ohne Begrenzung, damit gleiche Seeds gleich aussehen. */
export function gauss(r: Rand): number {
  let u = 0,
    v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function weighted<T extends { w: number }>(r: Rand, items: readonly T[]): T {
  const t = items.reduce((s, i) => s + i.w, 0);
  let x = r() * t;
  for (const i of items) {
    x -= i.w;
    if (x <= 0) return i;
  }
  return items[items.length - 1] as T;
}

export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
