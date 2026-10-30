# Plan: Benennen mit „What do you see?“

Stand 30.10.2026, Fassung 2. Freigegeben am 30.10.2026 mit allen Empfehlungen („alles ok“). Gebaut, Playtest v0.0.1.69. Bild im Spiel: docs/entwuerfe/benennen-im-spiel.png.

Schon freigegeben am 30.10.2026 (Plan „Einzigartig und Stile“): Benennen per „What do you see?“-Post, je 50 Pigment für den Finder und den Namensgeber. Wie bisher: Art = Bauplan + Hauptpigment (96 Arten), der erste Name bleibt, jeden Namen gibt es nur einmal.

## Heute

- Benannt wurde in den Kommentaren des Tagesposts. Der ist weg, also bekommt gerade keine Art einen Namen.
- Monster heißen nach Pigment und Bauplan, zum Beispiel „Opera Jelly“.
- Vom alten Benennen liegt noch Code bereit: Namen aus Kommentaren lesen (Regeln wie bisher), jeder Name nur einmal, Kommentar der Bestiary unter dem Post.

## Ablauf

1. **Finden:** Ziehst oder malst du ein Monster einer Art ohne Namen, steht auf seiner Karte „Unnamed species“ und der Knopf **What do you see?**. Auch nach dem Ziehen erscheint er in der Zeile unter der Karte.
2. **Teilen:** Ein Tipp legt einen Post im Subreddit an, gepostet von der App: „What do you see? A new blot found by u/name“. Der Post zeigt dein Monster groß, gemalt aus dem Seed (kein Bild gespeichert), dazu Seltenheit, Papier und Seriennummer.
3. **Vorschlagen:** Die Community schreibt Namen als Kommentare und stimmt ab. Im Post steht, wie lange es noch läuft, und die Regeln für Namen.
4. **Benennen:** Nach 24 Stunden wird der oberste Kommentar mit gültigem Namen der Name der Art, für alle Spieler. Die Bestiary schreibt darunter: „The Bestiary records **Name**, found by u/finder, named by u/namer.“ Der Post zeigt danach den Namen.
5. **Belohnung:** Finder und Namensgeber bekommen je 50 Pigment. Wer noch nie gespielt hat, bekommt es beim ersten Öffnen.

## Regeln

- **Gültiger Name** (wie beim Tagespost): erste Zeile eines Kommentars direkt unter dem Post, 3 bis 28 Zeichen, nur Buchstaben, Leerzeichen, Bindestrich und Apostroph, höchstens drei Wörter, noch keiner anderen Art vergeben. Mods entfernen unpassende Kommentare, entfernte zählen nicht.
- **Ein offener Post je Art:** Zieht jemand dieselbe Art, während ihr Post läuft, zeigt der Knopf „Being named“ und öffnet den laufenden Post.
- **Kein gültiger Name nach 24 Stunden:** Die Art bleibt namenlos, der nächste Finder kann sie wieder teilen. Die Bestiary schreibt einen kurzen Satz von Sepia darunter.
- **Höchstens ein Post pro Spieler und Tag** (UTC), damit der Subreddit nicht vollläuft.
- **Gemalte Monster** (Blank canvas) erst, wenn ein Mod die Zeichnung in der Prüfliste freigegeben hat. Bis dahin steht am Knopf „waiting for a moderator“. Gemeldet wird über die normale Reddit-Meldung am Post, eine Meldung im Spiel kommt später mit Tauschen oder Galerie.
- **Shiny:** Der Post zeigt das Monster im Stil, mit Rahmen und Schild.

## Wo man den Namen sieht

- Überall, wo heute „Opera Jelly“ steht: Sammlung, Würfelkarte, Deck, Duell, Ziehen. Darunter klein die Art und „named by u/namer“.
- Die Namen holt das Spiel einmal beim Laden (höchstens 96, klein).
- Namen aus dem alten Tagespost (nur Playtest) bleiben.

## Für Mods

- Mod-Menü am Post „name it now“: übernimmt sofort den obersten gültigen Namen (zum Testen und für Notfälle).
- Mod-Menü „cancel naming“: schließt den Post ohne Namen (zum Beispiel bei Ärger in den Kommentaren).

## Umfang und Reihenfolge

1. **Server:** Namen aller Arten abrufen, Post anlegen (Prüfungen oben), Zustand je Post in Redis (in keys.ts geführt), Auftrag nach 24 Stunden über den Scheduler, Name übernehmen, Pigment gutschreiben, Kommentar der Bestiary. Tests. Gebaut: src/server/naming.ts, Endpunkte /api/species, /api/dice/share, /api/naming, Scheduler-Auftrag `name-species` (devvit.json), Redis `naming:{post}`, `naming:posts`, `naming:open`, Speicher-Feld `nameDay`, Tests tests/naming.test.ts.
2. **Post-Ansicht:** neuer Einstieg `name` mit Monster groß, Restzeit, Regeln, danach der Name. Gebaut: src/client/name.html, name.ts, name.css (Shiny im Stil mit Rahmen, Restzeit zählt mit, Stand alle 5 Minuten neu).
3. **Spiel:** Knopf auf Karte und nach dem Ziehen, Namen überall anzeigen. Gebaut: Feld „Unnamed species“ mit „What do you see?“ auf der Würfelkarte (oder „Being named · open the post“), Knopf neben Done nach einem Einzelzug, Namen in Sammlung, Karte, Deck, Ziehen und Duell (src/client/lib/species.ts), Karte mit „Species named by u/…“.
4. **Mod-Menüs**, Upload und Handy-Test. Gebaut: „Before It Dries: name it now“ und „Before It Dries: cancel naming“ am Post. Hochgeladen als Playtest v0.0.1.69.

## Offene Fragen

Keine. Später vielleicht: Spitzname fürs eigene Exemplar, Meldung im Spiel (mit Tauschen oder Galerie).
