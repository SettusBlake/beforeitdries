// Baut den Holo-Entwurf zu einer einzigen Seite (Skript eingebettet) für das Artifact: node tools/mockup/holo/build.mjs <ziel.html>
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
const out = process.argv[2] ?? 'holo.html';
const r = await build({ entryPoints: ['tools/mockup/holo/main.ts'], bundle: true, format: 'iife', minify: true, write: false, logLevel: 'warning' });
const js = r.outputFiles[0].text.replaceAll('</script', '<\\/script');
const page = readFileSync('tools/mockup/holo/page.html', 'utf8').replace('/*SCRIPT*/', () => js);
writeFileSync(out, page);
console.log(out, (page.length / 1024).toFixed(0) + ' KB');
