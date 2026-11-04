# Katalog-Video (04.11.2026)

Ergebnis: docs/entwuerfe/katalog/featuring-video-1500x1000.mp4 (1500 × 1000, 11,5 s, 30 fps, ohne Ton).

1. Bauen: `npx vite build` und `npx esbuild tools/preview-server.ts --bundle --platform=node --format=esm --outfile=dist/preview-server.mjs`
2. Bilder: tools/mockup/sub-entwurf.ts `#catalog` liefert featuring, video-bg und video-end (Export wie bei den Bannern).
3. Aufnahme: `QPORT=5180 node tools/mockup/video/rec-duel.cjs <Ordner> 80` spielt ein Duell gegen den Lehrling mit „Sepia paints“ (540 × 1050) und speichert die Bilder des Screencasts samt Zeitstempeln (frames.json).
4. Schnitt: Bilder mit dem concat-Demuxer zu full.mp4 (30 fps), dann ffmpeg mit dem Filter in schnitt.txt. Eingänge: 0 featuring.png, 1 video-bg.png, 2 full.mp4, 3 video-end.png, 4 Maske 540 × 900 mit runden Ecken. Die Szenen (trim) passen nur zu der damaligen Aufnahme, bei einer neuen neu wählen.
