// Baut den Einstieg E1 zu einer einzigen Seite (Skript eingebettet) für das Artifact: node tools/mockup/einstieg/build.mjs <ziel.html>
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
const out = process.argv[2] ?? 'erste-schritte.html';
const r = await build({ entryPoints: ['tools/mockup/einstieg/main.ts'], bundle: true, format: 'iife', minify: true, write: false, logLevel: 'warning' });
const js = r.outputFiles[0].text.replaceAll('</script', '<\\/script');
const page = readFileSync('tools/mockup/einstieg/page.html', 'utf8').replace('/*SCRIPT*/', () => js);
writeFileSync(out, page);
console.log(out, (page.length / 1024).toFixed(0) + ' KB');
