# Before It Dries: Entwickler-Notizen

Stand 02.11.2026. Das README im Hauptordner ist für Spieler, Mods und die Prüfung durch Reddit (englisch). Hier steht, wie der Code aufgebaut ist. Den Verlauf aller Entscheidungen führt CLAUDE.md, die Pläne liegen in docs/entwuerfe.

## Technik

- Devvit Web 0.15.1, Vite mit `@devvit/start`, TypeScript, Express-Server, Redis von Devvit.
- Kein Spiele-Framework: Blatt, Monster und Effekte sind Canvas 2D, nur die Ziehen-Animation nutzt PixiJS (WebGL, nur dort nachgeladen).
- Grafik komplett aus Code, Schriften lokal (SIL Open Font License), keine Bilddateien.
- Alle Zufallswürfe am Server (kryptografischer Zufall), der Client malt nur. Das Bild wird nie gespeichert, nur Seed und Zustand.

## Aufbau

```
devvit.json                Einstiegsseiten, Server, Rechte, Menü, Trigger, Scheduler
src/shared/                Regeln und Daten für Server und Client
  rng.ts                   mulberry32, FNV-1a, Gauss (wörtlich aus dem Prototyp)
  data.ts                  Werte, Pigmente, Papiere, Baupläne
  monster.ts               Monster aus dem Seed, Werte, Art (Bauplan + Hauptpigment)
  glaze.ts                 Lasur-Regeln und Farbkreis aus dem Prototyp
  forms/                   Formen der Generation 2 (Bausatz, Teile, 200 Vorlagen)
  look.ts                  Aussehen 2b (Farbton, Muster, Gesicht, Malereignisse)
  drawn.ts                 Selbst gemalte Monster (Striche prüfen und kodieren)
  dice.ts                  Würfel, Seltenheit, Ziehen, Stil und Holo, Handel, Grenzwerte
  elements.ts              Elemente im Ring
  colors.ts                Spielfarben
  sheet.ts                 Blatt-Code des Tagesblatts, Quadrate fürs Teilen
  day.ts                   Tageskalender (UTC), Namensvorschläge lesen
  api.ts                   Datenformate, DUEL_PROTOCOL
  duel/rules.ts            Farbschlacht: Regeln, Würfe, Rivale, Ereignisse
  duel/play.ts             Duell als Folge geprüfter Aktionen
  duel/bleach.ts           Tagesblatt gegen die Bleiche (Spielart der Duell-Engine)
  duel/media.ts            Malmittel
  duel/stages.ts           Regeln nach und nach (Stufe 1 bis 6 neuer Spieler, was wann gilt, Ankündigungen)
  duel/tutorial.ts         altes Lern-Duell mit festen Würfen (seit 06.11.2026 nur noch für laufende Lektionen, ersetzt durch die ersten Schritte)
  duel/statinfo.ts         Werte in Spielworten
src/client/
  play.html/.ts            Startbild des Spiel-Posts (inline)
  sheet.html/.ts           Tagespost (inline, ohne Scrollen)
  name.html/.ts            „What do you see?“-Post (inline)
  duel.html/.ts            Spiel (ausgeklappt): Titel, Duell, Tagesblatt, Ergebnis
  duel/                    Blatt (view), 3D-Würfel, Ton, Sammlung, Ziehen (gacha), Zeichnen, Prüfen, Markt, Tausch, Galerie, Farben,
                           erste Schritte (firststeps.ts: Lektion auf wachsendem Blatt, auch Quelle des Artifacts tools/mockup/einstieg),
                           große Karte (bigcard.ts: Antippen des Bilds auf einer Karte, Sammlung und Duell)
  renderer/                Aquarell (watercolor, wörtlich aus dem Prototyp), 2b, Stile
  lib/                     Server-Aufrufe, Mal-Warteschlange, Holo, Artnamen, kleine Blätter, Schriften
src/server/
  index.ts                 Express-Routen: /api/* und /internal/* (Menü, Trigger, Scheduler)
  core.ts                  Schnittstellen zu Redis und Reddit, Fehler, Sperren, Mod-Prüfung
  keys.ts                  alle Redis-Schlüssel und die Sammlungen, in denen ihre IDs stehen
  dice.ts                  Sammlung: Ziehen, Deck, Auswaschen, Lasur, Umfärben, Patina, Belohnung der ersten Schritte, Test-Knöpfe
  duel.ts                  Duelle laden, Aktion prüfen und ausführen, Belohnung
  bleach.ts                Tagesblatt, Rangliste, Tagespost, Teilen
  gallery.ts               Galerie-Duelle, Abzüge, Gebühr, Archiv-Würfel beim Rivalen
  market.ts                Markt und Tausch, Lieferungen
  naming.ts                Benennen per Post, Bestiary
  drawings.ts              Prüfliste, Übermalen, Sperren, Meldungen
  deletion.ts              gelöschte Posts und Kommentare
  community.ts             Auftritt des Subreddits (Regeln, Gründe, Flairs, Seitenleiste, Wiki), Testdaten vor dem Start
  flair.ts                 Flairs auf den eigenen Posts der App
  accounts.ts              gelöschte Konten prüfen und bereinigen
  play.ts                  Spiel-Post anlegen und anpinnen
assets/icon.png            App-Icon für den Katalog (devvit.json marketingAssets, 1024 × 1024, höchstens 500 KB)
prototype/                 abgenommener Browser-Prototyp als Referenz
tests/                     Regeln gegen den Prototyp, Server-Logik
tools/                     Pixelvergleich, lokale Vorschau, Redis- und Reddit-Attrappen, Entwürfe (mockup/)
```

## Gleicher Seed, gleiches Bild

Renderer und Regeln sind aus `prototype/wetbloom-prototyp.html` übernommen, die Reihenfolge aller Zufallsaufrufe ist unverändert. Geprüft wird das doppelt:

- `npm test`: RNG, Hash, Gauss, Monster, Bauplan-Geometrien und Lasuren müssen exakt dem Prototyp entsprechen.
- `npm run compare`: rendert 72 Monster mit Prototyp und Portierung in Chromium, bei Pixeldichte 1 und 2, und vergleicht jedes Pixel (144/144 gleich).

Generation 2 (neue Formen, 2b, Stile) hat eigene Zufallsströme, damit Generation 1 pixelgleich bleibt.

## Server und Speicher

- Alle IDs stehen zusätzlich in bekannten Sammlungen, weil Redis keine Schlüssel auflisten kann. Die Liste steht oben in src/server/keys.ts.
- Laden, Aktion und Speichern eines Duells laufen ohne `await` dazwischen (die Regeln haben einen gemeinsamen Zustand `S`).
- Schreibvorgänge eines Spielers laufen unter seiner Sperre (`playerLock`, Hash `locks`, 15 Sekunden). Eine Sperre gibt nur frei, wer sie hält. Eine liegengebliebene (15 Sekunden und älter) übernimmt genau eine Anfrage.
- Belohnungen fürs Benennen stehen in `naming:paid` (Art und Spieler), damit jeder Name höchstens einmal zahlt, auch wenn Auftrag und Mod-Menü gleichzeitig laufen.
- Übermalte Zeichnungen stehen mit ihrem Monster-Seed in `drawn:over`. Wer einen solchen Würfel bekommt (Markt, Tausch, Archiv), bekommt ihn ohne Zeichnung.
- Tagesblatt: `seed` des Tages folgt aus dem Datum (Farbe, Pales, öffentlicher Seed für Aufträge), `secret` in `bleach:day:{Tag}` nur am Server. Die Würfe kommen aus beiden, damit sie für alle gleich, aber nicht vorausrechenbar sind.
- Tägliche Aktivität (T1, T2, src/server/daily.ts, src/shared/streak.ts): Strähne im Spielstand (`streak`, `sheets`), gezählt nur in `finishRun` (Wertungslauf, UTC-Tag des Blatts), Retarder über die Woche des verpassten Tags (`held`). Flair nur mit Schalter (`streakFlair` mit `was` und `shown`), Spieler mit Flair in `streak:flair` (Score: Tagesnummer des letzten Blatts), der Auftrag `daily-sheet` nimmt getrockneten die Flair ab. Beitreten: `joined`, `joinAsked`, gefragt beim 1. und 5. Ergebnis (`JOIN_AT`), Reddit verrät nicht, wer Mitglied ist. Vorschau: /dev/streak?n=6 (schaltet auch das Lern-Duell frei), /dev/flair
- Tägliche Aktivität Schritt 1 (T8, T9, T3, src/shared/daily.ts, src/server/gift.ts, src/client/duel/gift.ts): Tagesgeschenk im Spielstand (`gift`: Zahl der geöffneten und letzter UTC-Tag), Leiste `GIFTS`, `giftReady` in DiceResponse und PlayInfo, /api/dice/gift (Tropfen in der Farbe des Tagesblatts, Tag 7 ein Zug mit dem Loaded brush), Test-Knopf /api/dice/test-gift. Tagesregel `sheetRule(day)`: Wochentag mit Faktor auf die Lebenskraft der Pales, sonntags `boss2` und `mult` 1,5, Malmittel des Tages `dayMedium` (aus dem Datum, jede Woche jedes einmal), im Tagesblatt als `S.bleach.rule`. Morgen-Zeile `dayLine` im Startbild und im Ergebnis des Tagesblatts
- Tägliche Aktivität Schritt 2 (T10, T11, src/shared/weekly.ts, src/server/gift.ts): Wochenziele im Spielstand (`week`: Woche, drei Ziele, Fortschritt, erfüllt als Bits, `all`), Auswahl `weekGoals(woche, stufe)` je eins aus den Gruppen Tagesblatt, Duell, Sammeln, rückt wöchentlich weiter, Ziele mit späteren Regeln (`stage`) werden übersprungen, beim ersten Laden der Woche festgehalten (`weekFresh` in loadDice). Gezählt in `weekAdd` an diesen Stellen: Zug (`dicePull` außer Startzügen, Geschenk, Willkommens-Zug), Geschenk, Tropfen (Duell, Tagesblatt, Geschenk), Duell-Ende (`payDuel`: Sieg, ausgewaschene Rivalen aus `duelLoot`, Galerie-Sieg, dazu `S.wk` aus den Ereignissen, `weekTally` in duelAct: Herzen, Meisterzüge, Glaze oder Pure, Aufträge, Element ×2; verdeckt im Duell-Speicher als `wk`), Tagesblatt (`finishRun`: Blatt, Pales, alle Herzen). Antworten mit `week` (DiceResponse, DuelReward). Willkommen zurück: `act` (zuletzt aktiv, gesetzt mit `touch` bei Geschenk, Zug, Malen, Duell, Tagesblatt, Lektion), ältere Stände nehmen `freeDay`, `gift.day`, `streak.last`, `rewardDay`. Ab 3 Tagen Pause wartet ein Zug (`welcome` in DiceResponse und PlayInfo), beim ersten Tun festgehalten in `backAway`, genommen über /api/dice/welcome, danach `backDay` (14 Tage Pause). Test-Knöpfe /api/dice/test-welcome, /api/dice/test-week. Vorschau: /dev/week (jedes offene Ziel fast erfüllt)
- Malerrang (H2, src/shared/rank.ts, src/client/duel/rank.ts): Spielstand `xp` (Erfahrung), `rk` (höchster bezahlter Rang), `rankDips` (wartende Züge als Geschenk). Erfahrung über `earn` in src/server/dice.ts (zusammen mit den Wochenzielen, je erfülltem Ziel 50 dazu), `rankAdd` zahlt jeden neuen Rang (20 + 2 · n Pigment) und bei Titeln die Geschenke (leere Würfel, Tropfen in `dayColour`, Züge in `rankDips`). Bedarf `rankNeed` 40 + 20 · n, `rankFrom`, `rankOf`. Ohne `xp` im Stand rechnet `rankFresh` beim Laden einen Startrang aus Duellen, Tagesblättern und Zügen (ohne Lohn). Antworten mit `xp` und `rank` (DiceResponse, DuelReward), dazu `near` (H7, `nearNext`: weitestes offenes Wochenziel, nächste Patina). Rang in der Rangliste (`rk` in `bleach:res:{Tag}` und SheetRow) und im Galerie-Abzug (`rk`). Zug als Geschenk /api/dice/rank-dip, Test-Knopf /api/dice/test-rank (+500 XP). `daySeed` liegt jetzt in src/shared/daily.ts. Vorschau: /dev/xp?xp=… (setzt Erfahrung ohne Lohn)
- Farbplan nach Seltenheit (10.11.2026, src/shared/palette.ts `planOf`, src/client/renderer/palette.ts, Schalter `PALETTE` in watercolor.ts): nur für Generation 2 mit 2b-Aussehen, Stufe aus dem Papier (`tierOf`), eigener Zufallsstrom (immer gleich viele Würfe, damit Holo nur die Stufe hebt). Farben: Hauptpigment, dann Zweitpigmente, sonst Nachbar- und Gegenfarbe (HSL), ab Epic verläuft der Körper in die Nachbarfarbe. `paintsOf` verteilt die Farben auf Körper, große Teile (Fläche ab 30 % des größten), kleine Teile und Glieder, `washP` malt Verläufe mit demselben Formzufall wie `wash`. Ohne Plan (Generation 1, `palette: false`) bleibt jeder Pixel wie vorher
- „Leben“ (10.11.2026, src/shared/life.ts `lifeOf`, src/client/renderer/life.ts, Schalter `LIVELY` in watercolor.ts): nur für Generation 2 mit 2b-Aussehen, eigener Zufallsstrom. `fitGeo` vergrößert die Figur, bis die längere Seite 88 % des Blatts füllt (`LIFE_FIT`, gemalte Monster bleiben, wo sie gemalt wurden), Gesicht 22 bis 42 % größer, neun neue Augenformen (`lifeEye`), Tuschedetails je Wesen (`surface`, auf dunklen Teilen hell ausgehoben), Füße (`feet`), Ränder fransen weniger aus (Faktor 0,62). Frei stehend im Duell und in den ersten Schritten malt der Renderer mit `stand: true` (`LIFE_STAND`: längere Seite 78 %, Unterkante auf 88,5 % der Bildhöhe), damit der Rand des Aufklebers ins Bild passt und jeder Klecks auf seinem Sockel steht. Ohne „Leben“ (Generation 1, `lively: false`) bleibt jeder Pixel wie vorher
- Die Renderer-Dateien laden sich gegenseitig (watercolor, gen2b, life, palette). Keine Konstante einer anderen Datei beim Laden lesen, nur in Funktionen: sonst bricht das gepackte Spiel beim Start ab („Cannot access … before initialization“, so geschehen mit Playtest v0.2.0.18). tests/bundle-load.test.ts packt den Renderer mit Vite und lädt ihn
- `DUEL_PROTOCOL` in src/shared/api.ts bei jeder Änderung an Aktionen, Phasen oder Ereignissen erhöhen: alte Oberflächen bekommen dann „close this post and open it again“.
- Test-Knöpfe nur in Playtest-Versionen (vierte Stelle in der Versionsnummer) und nur für Mods, der Server prüft beides.
- Testlauf vom 02.11.2026 (etwa 1 340 Duelle und Tagesblätter über die Server-Schnittstelle, Wirtschaft, Bedienung im Browser): Befunde und Regressionstests in tests/qa-fixes.test.ts.
- Tagesklecks, Fangen und das alte Malblatt sind seit dem 02.11.2026 aus dem Code. Ihre Redis-Schlüssel (`day:*`, `days`, `post:*`, `user:*:monsters`, `monster:*`) stehen noch in keys.ts, damit die Bereinigung gelöschter Konten alte Fänge findet.

## Reddit-Regeln, die der Code einhält

- Kein Scrollen in Inline-Posts (Spiel-Post, Tagespost, Benennen-Post).
- Aktionen im Namen des Spielers nur auf ausdrücklichen Tipp mit Hinweis: Benennen-Post (`runAs: 'USER'` mit `userGeneratedContent`), geteiltes Tagesblatt als Antwort auf den angehefteten Kommentar der App, Beitreten (`subscribeToCurrentSubreddit`, eigener Knopf, nie Bedingung zum Weiterspielen).
- Löschpflichten: `onPostDelete`, `onCommentDelete` (src/server/deletion.ts), gelöschte Konten (src/server/accounts.ts, tägliche Prüfung, 21 Tage Frist, weil Reddit gesperrte und gelöschte Konten gleich meldet).
- Handel nur gegen Pigment, Pigment nie für Geld.

## Befehle

```bash
npm install
npm test
npm run type-check
npm run compare
npm run preview
npm run playtest:upload
```

- `preview`: lokale Vorschau ohne Reddit unter http://localhost:5174/duel.html, dazu sheet.html, play.html und name.html (Testnutzer ist Mod, Redis im Speicher). Hilfen: `/dev/pigment?n=1000&unlock=1`, `/dev/sheet?n=11` (Maler fürs Tagesblatt), `/dev/sheet?later=1` (Tagespost am nächsten Tag), `/dev/drops?karmin=5`, `/dev/wear?n=10`, `/dev/comments`.
- `compare` braucht Playwright mit Chromium (in der Cloud-Umgebung vorhanden).
- `playtest:upload` baut und lädt eine Playtest-Version in das private Test-Subreddit r/beforeitdries_dev (seit 02.11.2026, devvit.json `dev.subreddit`). Ein Playtest ersetzt dort die installierte Version, deshalb nie in r/beforeitdries. Node-Programme brauchen in der Cloud `NODE_USE_ENV_PROXY=1`.
- Login: `NODE_USE_ENV_PROXY=1 npx devvit login --copy-paste`, Link im Browser öffnen, Code zurück ins Terminal.
- Veröffentlichen: `npx devvit publish` (siehe docs/entwuerfe/release-plan.md).

## Handy zuerst

- Monster werden nebenbei gemalt (Warteschlange src/client/lib/painter.ts, 6 ms pro Bild, nach Wichtigkeit, Zwischenspeicher).
- Das Blatt im Duell malt nur, solange es zu sehen ist.
- Schriften liegen lokal im Build, weil der Reddit-Webview externe Quellen blockt.
