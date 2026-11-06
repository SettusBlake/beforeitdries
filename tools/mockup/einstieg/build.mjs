// Baut den Einstieg E1 zu einer einzigen Seite (Skript und Stil eingebettet) für das Artifact: node tools/mockup/einstieg/build.mjs <ziel.html>
// Die Lektion kommt aus src/client/duel/firststeps.ts (wie im Spiel), ihr Stil aus firststeps.css
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
const out = process.argv[2] ?? 'erste-schritte.html';
const r = await build({ entryPoints: ['tools/mockup/einstieg/main.ts'], bundle: true, format: 'iife', minify: true, write: false, outdir: 'out', logLevel: 'warning' });
const pick = (ext) => r.outputFiles.filter((f) => f.path.endsWith(ext)).map((f) => f.text).join('\n');
const js = pick('.js').replaceAll('</script', '<\\/script');
const css = pick('.css').replaceAll('</style', '<\\/style');
const page = readFileSync('tools/mockup/einstieg/page.html', 'utf8').replace('/*STYLE*/', () => css).replace('/*SCRIPT*/', () => js);
writeFileSync(out, page);
console.log(out, (page.length / 1024).toFixed(0) + ' KB');
