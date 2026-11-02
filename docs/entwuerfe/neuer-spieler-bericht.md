# Bericht: neuer Spieler, Ladezeit, Desktop

Stand 02.11.2026, Fassung 2. Release-Plan Schritt 3. Bilder docs/entwuerfe/neuer-spieler.png (Messung) und docs/entwuerfe/neuer-spieler-gebaut.png (Umsetzung).

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

| Abschnitt | vorher | jetzt (Playtest v0.0.1.141) |
|---|---|---|
| Lern-Duell, geführte Runden 1 bis 3 | 90 s, 10 Tipps, 7 Wische, 22 Mal „Got it“ | 87 s, 10 Tipps, 7 Wische, 12 Mal „Got it“ |
| Lern-Duell, Runden 4 bis 6 allein | 71 s, 9 Tipps | entfällt, das Lern-Duell endet nach Runde 3 |
| Neun freie Startwürfel ziehen | 78 s ohne Antippen, 23 bis 31 s mit Antippen | dazu „Skip“: Übersicht etwa 2 s nach dem Tipp |
| Erstes Duell (Apprentice, mit „Sepia paints“) | 93 s, 14 Tipps und 2 Malmittel | ohne Malmittel, 70 bis 175 s je nach Verlauf |

Vom ersten Öffnen bis zum Ende des Lern-Duells vergehen jetzt knapp 1,5 Minuten statt fast 3.

### Desktop

Spiel-Post, Tagespost und Benennen-Post bei 736 × 512, das Spiel bei 1280 × 800 und 900 × 640: kein Scrollen, nichts abgeschnitten, keine Fehler. Das Spiel steht als Handy-Spalte in der Mitte, das Brett ist bei 1280 × 800 etwa 350 Pixel breit.

## Behoben (Playtest v0.0.1.139)

- **Spiel-Post im Feed:** Kleckse malen sich in Schritten auf statt am Stück. Am gedrosselten Handy sieht man den Post nach 0,15 s statt nach 0,8 s.
- **Nach dem Lern-Duell:** Der Hauptknopf im Ergebnis heißt „Collect your free dice“ und führt zu den neun freien Würfeln. Vorher stand dort „Again“, das ein Duell ohne eigene Würfel gestartet hätte.
- **Deck-Anzeige unten rechts:** Bei 390 Pixel breiten Handys stand „9 ready 0 …“ abgeschnitten. Jetzt steht dort bis 400 Pixel Breite nur „9 ready“, der Rest beim Antippen.

## Entscheidungen (02.11.2026, „alles Empfehlung, bau es“)

1. **Startbild für neue Spieler:** ja.
2. **Lern-Duell kürzer:** a und b.
3. **Skip beim Mehrfachzug:** ja.
4. **Erstes Duell ohne Malmittel:** ja.
5. **Market und Trades nach unten:** ja.
6. **Desktop:** so lassen, nach der Freigabe durch Reddit eine breitere Anordnung planen.

## Gebaut (Playtest v0.0.1.141)

Bild docs/entwuerfe/neuer-spieler-gebaut.png.

- **Startbild:** Solange das Lern-Duell nicht gemacht ist (gleiche Regel wie beim Tagesblatt: Lern-Duell bezahlt oder schon ein Duell gespielt), ist „Learn with Sepia“ der einzige große Knopf. „Start duel“, „Gallery duel“ und „Today’s sheet“ stehen klein und gesperrt in einer Reihe mit „after the lesson“, die Wahl der Rivalenstärke ist ausgeblendet. Nach dem Lern-Duell sieht das Startbild aus wie bisher. Dabei behoben: Kam man nach dem Lern-Duell über „Your dice“ zurück, blieb „Today’s sheet“ gesperrt, bis man neu lud.
- **Lern-Duell:** Sepias Blasen zusammengefasst, 14 statt 24 Texte, gezeigt werden 12 (zwei erscheinen nur, wenn der Schritt verlangt ist). Das Lern-Duell endet nach Sepias drei Runden, die Kopfzeile zeigt „Round 1/3“, das Ergebnis zählt nach dem Stand wie sonst (feste Würfe: immer 49 zu 16 gewonnen). Sepia sagt im Ergebnis, dass ein echtes Duell sechs Runden dauert und niemand den nächsten Schritt zeigt. Der alte Text „Finish the duel on your own“ ist weg.
- **Skip:** Beim Ziehen von 9 Startwürfeln und beim Zehnerzug steht oben rechts „Skip“. Der Tipp bricht die Animation ab und zeigt sofort die Übersicht. Einzelzüge laufen wie bisher ganz. „Tap to speed up“ bleibt.
- **Erstes Duell ohne Malmittel:** Im ersten Duell nach dem Lern-Duell wählen weder du noch der Rivale ein Malmittel, auch nicht nach Runde 2 und 4 (Duell-Feld `noMedia`, der Server setzt es, solange noch kein Duell fertig ist). Ab dem zweiten Duell wie bisher. Beim ersten Malmittel sagt Sepia einmal: „Mediums. A drop in the water and the rules bend a little, for the rest of the duel. Pick one of these three, the rival takes one too. Another comes after rounds two and four.“
- **Your dice:** Market und Trades stehen unter „Dip the brush“.
- DUEL_PROTOCOL 20 (Lern-Duell endet anders). Laufende Duelle bleiben gültig.

## Test mit u/Vegatest (normaler Spieler ohne Mod-Rechte)

Im Playtest r/beforeitdries mit u/Vegatest anmelden:

1. Den angepinnten Spiel-Post öffnen: Es darf kein 🛠 oben rechts zu sehen sein. Nur „Learn with Sepia“ ist groß, darunter die drei kleinen gesperrten Knöpfe.
2. „Learn with Sepia“ bis zum Ende (drei Runden), dann „Collect your free dice“ und die neun Würfel ziehen, dabei einmal „Skip“ probieren.
3. Zurück zum Startbild: jetzt sind alle Knöpfe groß und „Today’s sheet“ ist offen.
4. Ein Duell gegen Apprentice (ohne Malmittel), danach ein zweites (mit Malmittel und Sepias Satz dazu).
5. „Today’s sheet“ und am Ende „Share as a comment“ (zweiter Tipp). Im Playtest kommt der Kommentar vom App-Konto, nicht von u/Vegatest, das ist von Reddit so vorgesehen.
6. Bei einer Art ohne Namen „What do you see?“ (zweiter Tipp). Auch dieser Post kommt im Playtest vom App-Konto.
7. Blank canvas: etwas zeichnen. Die Zeichnung muss danach bei u/Vegavild unter 🛠, Review drawings auftauchen.
8. Market und Trades (jetzt unter „Dip the brush“): Bei einem neuen Konto steht dort, ab wann Handeln geht (Konto 7 Tage alt, 5 Duelle).
