/* Sicherer Zufall für alle Würfe am Server */
export function secureUint32(): number {
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    const a = new Uint32Array(1);
    c.getRandomValues(a);
    return a[0]!;
  }
  return (Math.random() * 4294967296) >>> 0;
}
