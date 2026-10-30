# Before It Dries

Reddit-Spiel auf Devvit Web (Arbeitstitel war Wetbloom). Jedes Monster ist ein zufälliger Aquarell-Klecks, den es nur einmal gibt. Man zieht sie als Würfel, duelliert sich damit, und die Community gibt den Arten ihre Namen. Grafik komplett prozedural aus Code, keine Bilddateien, keine Libraries im Renderer.

Subreddit: [r/beforeitdries](https://www.reddit.com/r/beforeitdries/)

## Stand

- Spiel-Post (`play` und `default`, inline): eigener, angepinnter Post fürs Duell. Wird bei Installation oder Update angelegt, falls es keinen gibt, Mod-Menü „post a new play post“ legt einen neuen an. Alte Tagesposts zeigen dasselbe Startbild
- Farbschlacht (`duel`, ausgeklappt, aus dem Spiel-Post): Würfelduell gegen einen Rivalen in drei Stufen, Lern-Duell mit Meisterin Sepia, der Server prüft und würfelt jede Aktion. Regeln: docs/entwuerfe/farbschlacht-vorschlag.md
- Würfelsammlung: Ziehen mit offenem W100 und Schutz vor Pech, Seltenheit aus dem Papier, Deck aus 9 Würfeln. Jedes Monster gibt es nur einmal (Seed-Register, Seriennummer), jeder Zug bleibt als eigener Würfel. Auswaschen gibt Lasur für Würfelseiten. Pigment nur durchs Spielen
- Abgeschafft am 30.10.2026: Tagesklecks, Fangen, täglicher Post, altes Malblatt (`game`). Der Code liegt noch in `src/server/core.ts` und `src/client/game.ts`, ohne Wege dorthin

Noch nicht drin: Falten, Käufe (kein Pay-to-win), Verblassen von Opera-Rosa (nur Hinweistext).

## Aufbau

```
devvit.json              App-Konfiguration: Einstiegsseiten, Server, Menü, Trigger, Einstellungen
src/shared/              Regeln und Daten, von Server und Client genutzt
  rng.ts                 mulberry32, FNV-1a, Box-Muller (wörtlich aus dem Prototyp)
  data.ts                Werte, Pigmente, Papiere, Baupläne, Gesichter
  monster.ts             Monster würfeln, Werte-Formel, Eigenschaften
  glaze.ts               Lasieren: Beziehungen, Chancen, Ergebnis, Meisterin Sepia
  day.ts                 Tageskalender (UTC), Namensvorschläge lesen
  dice.ts                Seltenheiten, Chancen, Schutz vor Pech, Preise, Sammlung
  duel/rules.ts          Farbschlacht: Regeln, Würfel, Rivale, Ereignisse
  duel/play.ts           Duell als Folge geprüfter Aktionen
  duel/tutorial.ts       Lern-Duell: fester Seed, nur Sepias Schritt erlaubt
  api.ts                 Datenformate Server und Client
src/client/
  renderer/watercolor.ts Aquarell-Renderer (Canvas 2D), wörtlich aus dem Prototyp
  lib/paint.ts           Mal-Warteschlange: erst bei Sichtbarkeit, Leistungsstufen
  splash.html/.ts        Launch-Screen
  game.html/.ts          Spiel
  play.html/.ts          Startbild des Spiel-Posts
  duel.html/.ts          Farbschlacht und Würfelsammlung (duel/: Blatt, 3D-Würfel, Ton, Symbole, Sammlung)
src/server/
  index.ts               Express-Routen: /api/* und /internal/*
  core.ts                Spiellogik am Server, alle Würfe hier
  duel.ts                Duelle: laden, Aktion prüfen und ausführen, speichern, Pigment beim Ende
  dice.ts                Würfelsammlung: Ziehen, Beutel, Lasur auf Würfelseiten
  play.ts                Spiel-Post anlegen und anpinnen, Stand fürs Startbild
  keys.ts                Redis-Schlüssel
prototype/               Abgenommener Browser-Prototyp als Referenz
tests/                   Regeln gegen den Prototyp, Server-Logik
tools/                   Pixelvergleich, lokale Vorschau, Redis/Reddit-Attrappen
```

## Gleicher Seed, gleiches Bild

Renderer und Regeln sind aus `prototype/wetbloom-prototyp.html` übernommen, Reihenfolge aller Zufallsaufrufe unverändert. Geprüft wird das doppelt:

- `npm test`: RNG, Hash, Gauss, 3.660 Monster, 4.800 Bauplan-Geometrien, Chancen für alle Pigmente und 7.200 Lasuren mit identischen Würfen müssen exakt dem Prototyp entsprechen
- `npm run compare`: rendert 72 Monster (mit Lasuren, Schlamm, Mutation) mit Prototyp und Portierung in Chromium, bei Pixeldichte 1 und 2, und vergleicht jedes Pixel. Stand: 144/144 pixelgleich

Abweichung von der Übergabe: dort steht, Gauss sei auf plus/minus 2 begrenzt. Im Prototyp ist er unbegrenzt. Übernommen ist der Prototyp, sonst sähen manche Monster anders aus.

## Server und Speicher

Der Client malt nur. Züge, Duellwürfe, Lasuren und Mutationen würfelt der Server mit kryptografischem Zufall. Die Schlüssel `day:*`, `post:*`, `user:*:monsters` und `monster:*` stammen vom abgeschafften Tagesklecks.

| Schlüssel | Typ | Inhalt |
|---|---|---|
| `day:{datum}` | Hash | seed, humidity, postId, bp, main, createdAt, named |
| `day:{datum}:catchers` | Hash | userId → monsterId, sperrt doppeltes Fangen |
| `days` | Sorted Set | alle Tage |
| `post:{postId}` | String | Datum des Tagesklecks |
| `user:{id}:monsters` | Sorted Set | Monster-IDs nach Fangzeit |
| `monster:{datum}:{userId}` | String (JSON) | Seed, Bauplan, Papier, Pigmente, Würfe, Ereignisse, Gesicht, Lasuren, Gewinne, Farbreste, Schlamm, Mutationen, Name, Besitzer, letzte Lasur, Protokoll |
| `species:{bauplan}:{pigment}` | Hash | name, namedBy, firstSeen, day, commentId |
| `species:index` | Sorted Set | benannte Arten |
| `species:names` | Hash | Name → Art, jeder Name nur einmal |
| `locks` | Hash | kurze Sperren gegen doppelte Lasuren, Duell- und Würfelaktionen |
| `play:post` | String | ID des Spiel-Posts |
| `duel:{userId}` | String (JSON) | laufendes Duell mit Würfelzufall (bleibt am Server) |
| `duel:players` | Sorted Set | Spieler mit Duell |
| `dice:{userId}` | String (JSON) | Würfel (Bogen-Seed, Nummer, Seriennummer, seltenes Papier, Lasuren), Deck, Pigment, Schutz vor Pech, Lasur je Art, Startzüge, freier Tageszug, Belohnungen |
| `dice:players` | Sorted Set | Spieler mit Würfelsammlung |
| `seeds` | Hash | Monster-Seed → `{userId}:{Würfel-ID}`, jeder Seed nur einmal, auch nach dem Auswaschen |
| `serial` | String | Zähler der Seriennummern |

Das Bild wird nie gespeichert. Ein gezogenes Monster hat einen zufälligen Bogen-Seed (`dip-…`) und eine Nummer, daraus kommt der Monster-Seed.

Endpunkte: `GET /api/play`, `GET /api/duel`, `POST /api/duel/start`, `POST /api/duel/act`, `GET /api/dice`, `POST /api/dice/pull`, `POST /api/dice/bag`, `POST /api/dice/glaze`, `POST /api/dice/wash`. Intern: Trigger bei Installation und Update, Mod-Menü "post a new play post".

Einstellung pro Subreddit: `dryHours` (Trockenzeit, Standard 8, für Playtests 0).

## Befehle

```bash
npm install
npm test
npm run compare
npm run preview
npm run login
npm run deploy
npm run dev
```

- `preview`: lokale Vorschau ohne Reddit unter http://localhost:5174/game.html und /duel.html (Testnutzer, Redis im Speicher, `/dev/pigment?n=1000` gibt Pigment und Lasur)
- `compare` braucht Playwright mit Chromium (in der Cloud-Umgebung vorhanden)
- `login` nutzt `devvit login --copy-paste`: Link im Browser öffnen, Code zurück ins Terminal
- `deploy` baut und lädt die App hoch, `dev` startet einen Playtest in r/beforeitdries

## Handy zuerst

- Aquarelle werden erst gemalt, wenn sie in Sichtweite kommen, höchstens 40 ms pro Frame
- Leistungsstufen: Stufe 1 malt mit Pixeldichte 1 (gleiches Bild, etwa halbe Malzeit), Stufe 2 zusätzlich mit halber Schichtzahl (Optik etwas härter, nur als letzte Stufe). Gemessen: weniger Schichten spart allein nur 8 bis 35 %, die Auflösung ist der größere Hebel
- Schriften liegen lokal im Build (SIL Open Font License), weil der Reddit-Webview externe Quellen blockt

## Offene Punkte

- Verhältnis zu Amberroot
- Trockenzeit: 8 Stunden oder kürzer (per Einstellung änderbar)
- Upload-Weg auf Dauer (Cloud-Sitzung oder GitHub-Action mit Devvit-Token als Secret)
- App-Icon für die Veröffentlichung
