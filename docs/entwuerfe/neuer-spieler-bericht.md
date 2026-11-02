# Bericht: neuer Spieler, Ladezeit, Desktop

Stand 02.11.2026. Release-Plan Schritt 3. Bild docs/entwuerfe/neuer-spieler.png.

Gemessen in der lokalen Vorschau mit leerem Spielstand, Handy 390 × 760, Chromium. Gedrosselt heißt: CPU vierfach langsamer, Netz 1,6 Mbit/s mit 150 ms Verzögerung (ungefähr ein mittleres Handy im Mobilnetz).

## Messung

### Ladezeit

| Seite | Erste Anzeige normal | gedrosselt | längste Blockade gedrosselt | Daten (ungepackt) |
|---|---|---|---|---|
| Spiel-Post im Feed, vorher | 68 ms | 812 ms | 525 ms | 339 KB |
| Spiel-Post im Feed, jetzt | 72 ms | 152 ms | 198 ms | 339 KB |
| Tagespost im Feed | 52 ms | 112 ms | keine | 158 KB |
| Benennen-Post im Feed | 44 ms | 136 ms | keine | |
| Spiel (ausgeklappt) | 64 ms | 188 ms, fertig nach 4,7 s | 153 ms | 755 KB |

- Der Spiel-Post hat beide Kleckse auf einmal gemalt und damit den ersten Bildaufbau eine halbe Sekunde blockiert. **Behoben:** Sie malen sich jetzt in kleinen Schritten auf.
- Über das Netz gehen die Dateien gepackt (etwa ein Drittel). Die Schriften (Caveat in zwei Stärken, 100 KB) sind der größte Brocken im Spiel-Post. Das ist noch kein Problem, später ließe sich eine Stärke sparen.

### Weg eines neuen Spielers

| Abschnitt | Zeit | Tipps |
|---|---|---|
| Lern-Duell, geführte Runden 1 bis 3 | 90 s | 10 Tipps, 7 Wische, 22 Mal „Got it“ |
| Lern-Duell, Runden 4 bis 6 allein (hier mit „Sepia paints“) | 71 s | 9 |
| Neun freie Startwürfel ziehen | 78 s ohne Antippen, 23 bis 31 s mit Antippen | 1 und 16 bis 21 zum Beschleunigen, 1 „Done“ |
| Erstes Duell (Apprentice, mit „Sepia paints“) | 93 s | 14 und 2 Malmittel |

Vom ersten Öffnen bis zum Ende des ersten eigenen Duells vergehen damit gut 6 Minuten, davon fast 3 im Lern-Duell.

### Desktop

Spiel-Post, Tagespost und Benennen-Post bei 736 × 512, das Spiel bei 1280 × 800 und 900 × 640: kein Scrollen, nichts abgeschnitten, keine Fehler. Das Spiel steht als Handy-Spalte in der Mitte, das Brett ist bei 1280 × 800 etwa 350 Pixel breit.

## Behoben (Playtest v0.0.1.139)

- **Spiel-Post im Feed:** Kleckse malen sich in Schritten auf statt am Stück. Am gedrosselten Handy sieht man den Post nach 0,15 s statt nach 0,8 s.
- **Nach dem Lern-Duell:** Der Hauptknopf im Ergebnis heißt „Collect your free dice“ und führt zu den neun freien Würfeln. Vorher stand dort „Again“, das ein Duell ohne eigene Würfel gestartet hätte.
- **Deck-Anzeige unten rechts:** Bei 390 Pixel breiten Handys stand „9 ready 0 …“ abgeschnitten. Jetzt steht dort bis 400 Pixel Breite nur „9 ready“, der Rest beim Antippen.

## Fragen

1. **Startbild für neue Spieler:** „Learn with Sepia“, „Start duel“ und „Gallery duel“ sind gleich stark, dazu „Today’s sheet“ (gesperrt). Vorschlag: Solange das Lern-Duell nicht gemacht ist, ist „Learn with Sepia“ der einzige große Knopf, die anderen sind klein mit „after the lesson“. (Empfehlung: ja)
2. **Lern-Duell kürzer:** 22 Sepia-Blasen und danach noch drei Runden allein, zusammen fast 3 Minuten. Für Reddit ist das lang.
   - a: Blasen zusammenfassen (etwa 12 statt 22), sonst gleich.
   - b: zusätzlich endet das Lern-Duell nach Sepias drei Runden (Ergebnis nach dem Stand), spart gut eine Minute.
   - c: so lassen.
   (Empfehlung: a und b)
3. **Neun Startwürfel:** Das Ritual läuft 78 s, mit Antippen etwa 25 s. Vorschlag: Beim Ziehen mehrerer Würfel (9 und 10) gibt es zusätzlich „Skip“, das gleich zur Übersicht springt. Einzelzüge bleiben, wie sie sind. (Empfehlung: ja)
4. **Erstes eigenes Duell:** beginnt mit der Wahl eines Malmittels (Iridescent, Sponge, Salt), die das Lern-Duell nicht erklärt. Vorschlag: Im ersten Duell nach dem Lern-Duell gibt es keine Malmittel, ab dem zweiten wie bisher. Sepia sagt einmal kurz, was ein Malmittel ist. (Empfehlung: ja)
5. **Your dice für neue Spieler:** Market und Trades stehen ganz oben, sind aber erst nach 7 Tagen und 5 Duellen nutzbar. Vorschlag: unter „Dip the brush“ verschieben. (Empfehlung: ja)
6. **Desktop:** Das Spiel bleibt eine schmale Spalte, das Brett ist bei 1280 × 800 etwa 350 Pixel breit. Vorschlag: so lassen und nach der Freigabe eine breitere Anordnung für Desktop planen. (Empfehlung: ja, später)

## Test mit u/Vegatest (normaler Spieler ohne Mod-Rechte)

Im Playtest r/beforeitdries mit u/Vegatest anmelden:

1. Den angepinnten Spiel-Post öffnen: Es darf kein 🛠 oben rechts zu sehen sein.
2. „Learn with Sepia“ bis zum Ende, dann „Collect your free dice“ und die neun Würfel ziehen.
3. Ein Duell gegen Apprentice, danach „Today’s sheet“ und am Ende „Share as a comment“ (zweiter Tipp). Im Playtest kommt der Kommentar vom App-Konto, nicht von u/Vegatest, das ist von Reddit so vorgesehen.
4. Bei einer Art ohne Namen „What do you see?“ (zweiter Tipp). Auch dieser Post kommt im Playtest vom App-Konto.
5. Blank canvas: etwas zeichnen. Die Zeichnung muss danach bei u/Vegavild unter 🛠, Review drawings auftauchen.
6. Market und Trades: Bei einem neuen Konto steht dort, ab wann Handeln geht (Konto 7 Tage alt, 5 Duelle).
