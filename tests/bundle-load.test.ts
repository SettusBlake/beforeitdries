/*
 * Lädt der gepackte Renderer überhaupt? Die Renderer-Dateien laden sich gegenseitig (watercolor, gen2b, life, palette).
 * Liest eine davon beim Laden eine Konstante der anderen, ist die noch nicht da: im gepackten Spiel bricht dann alles ab
 * („Cannot access … before initialization“, so geschehen mit Playtest v0.2.0.18). Typprüfung und die anderen Tests sehen das nicht,
 * deshalb hier einmal echt packen und laden. Gepackt wird mit Vite wie das Spiel (esbuild allein macht aus const ein var
 * und verdeckt den Fehler).
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';

const ENTRIES = ['src/client/renderer/watercolor.ts', 'src/client/renderer/shiny.ts', 'src/client/lib/painter.ts'];

async function bundle(entry: string): Promise<string> {
  const res = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: { entry: resolve(entry), formats: ['es'], fileName: 'bundle' },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  const outs = Array.isArray(res) ? res : [res];
  for (const o of outs) {
    if (!('output' in o)) continue;
    for (const c of o.output) if (c.type === 'chunk' && c.isEntry) return c.code;
  }
  throw new Error(`kein Bündel für ${entry}`);
}

describe('gepackter Renderer', () => {
  for (const entry of ENTRIES) {
    it(`${entry} lädt ohne Fehler`, async () => {
      const code = await bundle(entry);
      const dir = mkdtempSync(join(tmpdir(), 'bid-bundle-'));
      try {
        const file = join(dir, 'bundle.mjs');
        writeFileSync(file, code);
        const mod: Record<string, unknown> = await import(pathToFileURL(file).href);
        expect(Object.keys(mod).length).toBeGreaterThan(0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }
});
