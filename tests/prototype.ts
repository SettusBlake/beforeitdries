/* Lädt die Spiellogik des Prototyps (prototype/wetbloom-prototyp.html) in eine Node-Sandbox */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const file = fileURLToPath(new URL('../prototype/wetbloom-prototyp.html', import.meta.url));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Proto = Record<string, any>;

export function loadPrototype(random: () => number = Math.random): Proto {
  const html = readFileSync(file, 'utf8');
  const start = html.indexOf('/* ---------- Zufall');
  const end = html.indexOf('/* ---------- Oberfläche');
  if (start < 0 || end < 0) throw new Error('Prototyp-Marker nicht gefunden');
  const code =
    '"use strict";\nMath.random = __random;\n' +
    html.slice(start, end) +
    '\n({ RNG, hashStr, gauss, ri, makeMonster, statRows, traitsOf, odds, relation, applyGlaze, SEPIA, BAUPLAENE, BP, PIGMENTS, PIG, PAPERS, BLOOM_TRAITS, LORE });';
  const ctx = vm.createContext({ __random: random });
  return vm.runInContext(code, ctx) as Proto;
}

/** Plain JSON, damit Objekte aus der Sandbox vergleichbar werden */
export const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
