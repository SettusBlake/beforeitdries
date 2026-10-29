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
- Offen: Spielkonzept Fassung 2 docs/entwuerfe/spielkonzept-vorschlag.md (Atelier: Mischrätsel, Gießen, einzigartige Karten, Rorschach-Benennen, Salon, Stile und Papiere) mit Entwurfsbildern stile-entwurf.png und atelier-entwurf.png, wartet auf Freigabe. Fassung 1 (Kampf 3 gegen 3) abgelehnt am 28.10.2026
- Kampf: gewünscht, aber anders (28.10.2026). Farbschlacht Fassung 1 (nur Stempeln) war „ok, aber sehr simpel“. Fassung 2 (Monster auf dem Blatt, Farbe als Gelände, Spritzer, Deckkraft als Lebenskraft) war „besser, aber Rivale zu stark, Fähigkeiten fehlen“. Fassung 3 mit Fähigkeit je Bauplan, Eigenschaften aus den Monsterdaten, Zweitfarbe und Rivale in drei Stufen. Wunsch danach: Würfel wie bei Dungeon Dice Monsters. Fassung 4: jeder Klecks ist ein Würfel (Seiten aus seinen Werten), 3 aus 6 werfen, Symbole sammeln, mit Sternen beschwören, Würfelnetz klappt als Farbe aufs Blatt, Palette mit 3 Herzen: docs/entwuerfe/farbschlacht-vorschlag.md, spielbar unter https://claude.ai/artifact/TESUwotnDooSiEZMuwoPQ2. Rückmeldung „irgendwie cool jetzt“
- Festgelegt am 28.10.2026 zur Farbschlacht: Palette bleibt Siegweg neben dem Papier (Empfehlung angenommen), Würfel werden Sammelobjekt und verändern sich durch Lasuren, Umfang bleibt (Fähigkeiten, Eigenschaften, Zweitfarbe nicht zu viel), Beutel mit 6 Würfeln ist ok (höchstens 3 Kleckse auf dem Blatt)
- Freigegeben am 28.10.2026: Farbschlacht als richtiges Spiel mit Animationen, zuerst im Artifact (gleicher Link), mit Ton (prozedural). Schritte: Spielbildschirm ohne Scrollen mit Titel- und Ergebnisbild, 3D-Würfel, Aufklappen beim Beschwören, Bewegen/Stempeln/Spritzen mit Effekten und Schadenszahlen, Fähigkeiten/Palette/Radierer, Ton und Hinweise von Sepia. Quelle tools/mockup/duel/ (rules.ts Regeln mit Ereignissen, view.ts Blatt und Effekte, dice3d.ts, sound.ts, main.ts Bedienung)
- Animierte Fassung gebaut und veröffentlicht (28.10.2026), gleicher Link, Bild docs/entwuerfe/farbschlacht-spiel-entwurf.png. Regeln wie Fassung 4, Simulation unverändert
- Rückmeldung dazu (28.10.2026): Gefühl ok, aber unverständlich (warum man sich nicht bewegen kann), vielleicht zu lang für Reddit, Grafik muss viel besser werden. Gewünscht: Würfel mit Seltenheiten, alles zufällig mit Gacha, als Reddit-Spiel zum Testen bauen. Plan mit Gacha-Vorschlag: docs/entwuerfe/reddit-duell-plan.md
- Freigegeben am 28.10.2026: Plan und Reihenfolge, Bewegen frei (Step gibt +2), blankes Papier begehbar für 2, Quick duel 7 × 7 mit 6 Runden, Seltenheiten und Gacha wie vorgeschlagen. Kein Phaser (bringt für uns vor allem Ladezeit). Grafik: Monster sind zu klein, und es gibt nur Symbole
- Schritt 1 und 2 gebaut (28.10.2026): Duell in der App (duel.html, Knopf „Duel“ im Post), Server prüft und würfelt jede Aktion (src/shared/duel, src/server/duel.ts, Zustand in Redis), Sepia zeigt mit goldenem Ring den nächsten Schritt. Playtest v0.0.1.5. Regeln: docs/entwuerfe/farbschlacht-vorschlag.md (Fassung 5)
- Festgelegt am 28.10.2026: Palette ist geschützt, solange ein eigener Klecks daneben steht. Ein fest vorgegebenes Lern-Duell, in dem Sepia alles erklärt (feste Würfe, nur der nächste Schritt ist antippbar). Danach weiter mit Schritt 3 (Seltenheiten und Gacha)
- Schritt 3 gebaut (28.10.2026): Würfelsammlung im Duell-Bildschirm („Your dice“). Seltenheit aus dem Papier (Legendary: Washi, Vellum), Joker (Stern beliebiger Stufe oder Symbol nach Wahl), Gold (je ein Symbol), Stufe absolut aus der Stärke. Ziehen mit offenem W100, 6 freie Startzüge, freier Tageszug, Zug 100 Pigment, Zehnerzug 1000, Schutz vor Pech 10/40/90, Doppelte werden Lasur, 3 Lasur machen ein Symbol doppelt. Pigment: Sieg 60, Unentschieden 40, Niederlage 25 (5 Duelle am Tag), Lern-Duell 200, Fangen 50. Bild docs/entwuerfe/wuerfel-gacha.png. Playtest v0.0.1.11. Offen aus dem Plan: Wochenbanner, Pigment fürs Benennen
- Eigener Spiel-Post (28.10.2026, gewünscht): Einstieg `play` mit Startbild (zwei Kleckse, Play öffnet das Duell, Hinweis auf freie Würfel oder laufendes Duell). Wird bei Installation oder Update einmal angelegt und angepinnt, Mod-Menü „post a new play post“ legt einen neuen an
- Rückmeldung 29.10.2026: Kampf ist fade, unübersichtlich, zu viel Geklicke (gemessen 69 Taps pro Duell, 0,2 Auswaschungen). Plan Fassung 6 (Wischen, Ein-Tipp-Würfeln, weniger Regeln, mehr Wumms): docs/entwuerfe/farbschlacht-fassung6-plan.md. Freigegeben am 29.10.2026 („probieren wir“) mit den Empfehlungen
- Fassung 6 gebaut (29.10.2026): ein Wisch pro Klecks (oder antippen und Ziel antippen), Goldknopf für Fähigkeiten, Netz vorgesetzt, Würfel vorgewählt, Zug endet von selbst, „Sepia paints“, Rivale doppelt so schnell. Regeln: Brush und Wasser weg, Stempel immer nass, Stempeln und Spritzen auf Kleckse frei, Splash-Symbol nur für die Palette, Guard aus Körnung oder Deckkraft, Zweitfarbe automatisch, Spritzreichweite 2, etwa 2 Treffer pro Klecks, Treffer färben das Zielfeld, Platzen färbt ringsum, Palette bewacht im Umkreis 2 und höchstens ein Herz pro Zug. Gemessen 14 Taps pro Duell statt 69. Playtest v0.0.1.15. Regeln: docs/entwuerfe/farbschlacht-vorschlag.md (Fassung 6), Bild docs/entwuerfe/farbschlacht-fassung6.png
- Rückmeldung und Festlegungen 29.10.2026 zu Fassung 6: Wischen gut, Splash nur für die Palette passt, Meister stärker (jetzt Lebenskraft × 1,25, Werte × 1,15, 2 Guard und 2 Glow zum Start), Platzen färbt in der Farbe des Treffers. Gewünscht: mehr Animationen, Rivalenzüge langsamer, Würfel aus dem Beutel nehmen. Gebaut: Rivale in normalem Tempo mit Banner und rotem Fokus-Ring vor jedem Zug, Animationen (Wippen, Hüpfen, Drücken beim Stempeln, Ausholen und Rückstoß, ×1.5, Platzen, Palettensplitter), Beutel mit Herausnehmen und freien Plätzen. Playtest v0.0.1.17. Bild docs/entwuerfe/farbschlacht-animationen.png
- Rückmeldung 29.10.2026: Animationen beim Ziehen (Gacha) müssen viel besser werden, Würfel sollen verbraucht werden können wie bei einem Kartendeck. Plan mit Varianten: docs/entwuerfe/gacha-und-deck-plan.md
- Festgelegt am 29.10.2026: Würfel als Deck (A), aber Würfel selbst wählen statt zufällig ziehen. Kein Austrocknen (B), kein Verlust beim Auswaschen (C). Ziehen-Animation zuerst als Artifact. Gebaut: Deck mit 9 Würfeln, geworfene Würfel verbraucht bis zum Mischen, Würfel auf dem Blatt werden nicht geworfen, Sepia schlägt 3 vor, 9 Startzüge, „Deck“ statt „Bag“. Offen: Canvas 2D oder WebGL (PixiJS, etwa 160 KB gepackt, nur beim Ziehen geladen) für die Ziehen-Animation
- Festgelegt am 28.10.2026: weitere Stile außer Aquarell, seltene Papiere, jedes Monster und jede Karte einzigartig, Drumherum spaßiger als reines Sammeln oder Kämpfen
- App `beforeitdries` angelegt (28.10.2026, Konto u/Vegavild). Playtest v0.0.1.1 in r/beforeitdries: https://www.reddit.com/r/beforeitdries/?playtest=beforeitdries

## Arbeitsweise
- Vor jedem Meilenstein einen kurzen Plan zeigen und auf Freigabe warten
- Kleine, testbare Schritte. Nach jedem Feature kurz sagen, was sich geändert hat und wie ich es am Handy teste
- Nichts einbauen, was hier oder in einem freigegebenen Vorschlag nicht steht, ohne vorher zu fragen. Offene Designfragen sammeln statt selbst entscheiden
- Überarbeitete Dokumente immer komplett ausgeben, keine Teilstücke
- Knapp und befehlsorientiert, kurze Erklärungen
- Dieses Dokument aktuell halten, wenn wir etwas festlegen
