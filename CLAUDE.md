# Before It Dries - Reddit-Spiel

Arbeitstitel war Wetbloom. Name festgelegt am 28.10.2026: Before It Dries, Subreddit r/beforeitdries, App-Name `beforeitdries`.

## Ziel
Monster sammeln und entwickeln auf Reddit (Devvit Web), Handy zuerst. Jedes Monster ist ein zufälliger Aquarell-Klecks, die Community deutet ihn wie einen Rorschach-Test und gibt der Art ihren Namen, der Spieler malt sein Exemplar Schicht für Schicht (Lasuren) stärker. Maximale Zufälligkeit, offene Werte, Würfe sind sichtbar.

## Arbeitsumgebung
- Entwicklung komplett in Claude Code in der Cloud, ich arbeite vom Handy und will am PC nichts einrichten
- Ich teste auf Reddit am Handy (Playtest). Nach jedem Schritt mit `npm run playtest:upload` hochladen
- Alles, was ich ansehen soll (Entwürfe, Screenshots), als PNG in docs/entwuerfe committen und pushen
- Nach jedem Arbeitsschritt committen und pushen
- Der Devvit-Login liegt nur in der Cloud-VM (~/.devvit). Ist er weg: `NODE_USE_ENV_PROXY=1 npx devvit login --copy-paste`, mir den Link schicken, ich schicke den Code zurück
- Node-Programme (Devvit-CLI) erreichen das Netz in der Cloud nur mit `NODE_USE_ENV_PROXY=1`
- Analysen anderer Reddit-Spiele liegen im Repo SettusBlake/RedditGame (Amber Delve), docs/entwuerfe/reddit-spiele-analyse.md und sword-and-supper-analyse.md

## Technik
- Devvit Web 0.15.1, Vite mit `@devvit/start`, TypeScript, Express-Server. Kein Phaser, der Renderer ist reines Canvas 2D
- Renderer (src/client/renderer/watercolor.ts) und Regeln (src/shared) sind wörtlich aus prototype/wetbloom-prototyp.html übernommen. Gleicher Seed muss gleich aussehen: `npm test` und `npm run compare` prüfen das gegen den Prototyp. Reihenfolge der Zufallsaufrufe nie ändern
- Alle Zufallswürfe (Fangen, Würfe, Lasuren, Mutationen) am Server, der Client malt nur
- Das Bild wird nie gespeichert, nur Seed, Lasuren und Zustand
- Redis kann keine Keys auflisten: alle IDs in bekannten Sammlungen führen (src/server/keys.ts)
- Grafik komplett prozedural aus Code, lizenzfrei, keine KI-Bilder. Schriften lokal (SIL OFL)
- npm braucht `legacy-peer-deps` (steht in .npmrc)

## Welt und Ton
- Die Welt ist ein riesiges, unfertiges Aquarell, „das Blatt“. Es bleicht von den Rändern her aus, irgendwer radiert gezielt. Story in Splittern über seltene Kleckse und wöchentliche Kapitel-Posts
- Mentorin Meisterin Sepia (englisch Master Sepia): trockener Humor, kein Klamauk. Plot leicht düster, nicht leicht durchschaubar
- Abgrenzung: kein Licht-Schatten-Thema (Glintborne), keine lebende Ausrüstung und kein Bernstein (Amber Delve), Team aus 3 statt 4
- Spieltexte auf Englisch, Kommunikation mit mir auf Deutsch, mit Umlauten, ohne Gedankenstriche

## Regeln
Stehen vollständig in src/shared (data.ts, monster.ts, glaze.ts) und im README. Festgelegt am 28.10.2026:
- Tagesklecks: Bogen-Seed ist das Datum (UTC), Klecks ist Monster Nr. 1 des Bogens. Form und Farbe für alle gleich, Würfe pro Exemplar eigen
- Fangen nur, solange der Tag läuft (UTC), danach ist der Klecks getrocknet
- Art = Bauplan + Hauptpigment. Erster Name bleibt, jeder Name nur einmal
- Trockenzeit zwischen Lasuren: Einstellung `dryHours`, Standard 8

## Später, nicht im MVP
Falten (zwei Monster spiegelsymmetrisch verschmelzen, auch mit Faltpartnern aus den Kommentaren), Kampf 3 gegen 3 mit Farbkreis als Typensystem und Wasser als Ressource, Galerie-Duelle als Posts, Gemeinschaftsbild pro Subreddit mit Riesenklecks als Boss, Farbspende für die ganze Community, kein Pay-to-win.

## Aktueller Stand (28.10.2026)
- MVP gebaut: Launch-Screen, Fangen, Bogen, Malblatt mit Lasieren und Trockenzeit, Artname aus Kommentaren, täglicher Post per Scheduler
- Offen: Vorschlag docs/entwuerfe/reddit-paket-vorschlag.md (Analyse auf Before It Dries übertragen), wartet auf Freigabe
- App `beforeitdries` angelegt (28.10.2026, Konto u/Vegavild). Playtest v0.0.1.1 in r/beforeitdries: https://www.reddit.com/r/beforeitdries/?playtest=beforeitdries

## Arbeitsweise
- Vor jedem Meilenstein einen kurzen Plan zeigen und auf Freigabe warten
- Kleine, testbare Schritte. Nach jedem Feature kurz sagen, was sich geändert hat und wie ich es am Handy teste
- Nichts einbauen, was hier oder in einem freigegebenen Vorschlag nicht steht, ohne vorher zu fragen. Offene Designfragen sammeln statt selbst entscheiden
- Überarbeitete Dokumente immer komplett ausgeben, keine Teilstücke
- Knapp und befehlsorientiert, kurze Erklärungen
- Dieses Dokument aktuell halten, wenn wir etwas festlegen
