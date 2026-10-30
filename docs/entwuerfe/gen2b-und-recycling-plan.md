# Plan: Generation 2b (Farbe, Muster, Gesichter, Malereignisse) und Recycling

Stand 30.10.2026, Fassung 1. Wartet auf Freigabe.

Wunsch vom 30.10.2026: Monster, die man nicht mehr will, recyceln oder später auf einen Marktplatz stellen. Gelöscht werden sie nicht, weil sie später als Gegner dienen sollen.

## Teil A: Recycling statt Löschen

**Heute:** „Wash out“ auf der Würfelkarte (zweimal tippen) gibt der Art Lasur, der Würfel ist danach endgültig weg. Nur sein Seed bleibt im Register.

**Neu:**

- Der Würfel verlässt deine Sammlung und gibt Lasur wie bisher (Common 1 bis Legendary 10). Er wird aber nicht gelöscht, sondern kommt ins **Archiv** am Server, mit allem: Seriennummer, Seed, Papier, Lasuren auf Seiten, Zeichnung, Generation, früherer Besitzer und Datum.
- Speicher: Redis-Hash `recycled` (Seed → Würfel und Herkunft) und eine sortierte Liste `recycledAt` (nach Zeit), damit man später gezielt oder zufällig auswählen kann. Beides steht in keys.ts.
- Das Seed-Register zeigt dann „recycled“. Das Monster kommt nie als neuer Zug wieder.
- Regeln wie bisher: nicht aus dem Deck, mindestens 9 Würfel bleiben, ein Shiny nur nach Rückfrage (sobald es Shinys gibt).
- Text unter dem Knopf: „It leaves your collection. Blots that drift to the margins sometimes come back.“
- Was heute schon ausgewaschen wurde (nur Playtest), ist weg. Ab dem Einbau bleibt alles.

**Später (eigene Pläne, wenn es so weit ist):**

- **Gegner aus dem Archiv:** Rivalen-Decks mischen Monster aus dem Archiv dazu, nie deine eigenen. Passt zur Welt: irgendwer radiert gezielt, und was an den Rand treibt, kommt verändert zurück.
- **Marktplatz:** Würfel für Pigment anbieten, der Käufer bekommt ihn mit Seriennummer, das Register wechselt den Besitzer.
- Gemalte Monster kommen in beides erst, wenn Melden und Mod-Menü stehen.

## Teil B: Generation 2b

**Grundsätze:**

- Nur Generation 2 (neue Züge und gemalte Monster). Generation 1 bleibt pixelgleich (144 von 144).
- Eigener Zufallsstrom aus dem Seed. Die Formen bleiben genau, wie sie sind.
- Nur Aussehen. Art (Bauplan und Hauptpigment), Werte und Fähigkeiten bleiben. Salz, Alkohol, Blüte und Fingerabdruck behalten ihre Werte.
- Die Generation-2-Würfel, die es schon gibt (nur Playtest), bekommen das neue Aussehen mit.

**1. Farbe**

- Jedes Monster bekommt seinen eigenen Ton: Farbton ±12° im Farbkreis, Helligkeit und Sättigung je ±15 % um das Pigment. Die Zweitfarbe schwankt genauso.
- Das Pigment bleibt erkennbar: Ultramarin bleibt blau, Sienna bleibt erdig.

**2. Muster (etwa 40 % der Monster)**

- Nur innerhalb der Flächen, in der Zweitfarbe oder einer dunkleren Hauptfarbe:
  - Flecken
  - Streifen quer zur Form
  - Ringe
  - Sprenkel (wie mit der Zahnbürste gespritzt)
  - Verlauf von Haupt- in Zweitfarbe
  - Marmor mit Adern
  - Dinge und Maschinen auch Bänder und Karo
- Stärke zufällig, manchmal nur auf einem Teil (Rücken, Schwanz, Deckel).

**3. Gesichter**

- **Augen:** meist 2, sonst 1 bis 7. Formen:
  - rund, Knopf, Mandel, Schlitz, müde
  - groß mit Glanzpunkt (Anime-Art)
  - Pupille als Stern, Spirale oder Ring
  - geschlossen als Bogen
  
  Blick zufällig, selten schielend.
- **Münder:**
  - Lächeln, Grinsen, Zähne, Zunge, Hauer, Fänge
  - O-Mund, Zickzack, Schnabel, keiner
  - manchmal Schnurrhaare dazu
- **Augenbrauen** (etwa 30 %): böse, besorgt, hochgezogen, gelangweilt.
- **Wangen** (etwa 15 %): Röte oder Sommersprossen.
- Gemalte Monster: Die Augen bleiben, wo du hingetippt hast. Art und Anzahl würfelt das Spiel.

**4. Malereignisse (je etwa 10 bis 15 %, nur Aussehen)**

- **Läufer:** Die Farbe läuft in Tropfspuren nach unten.
- **Spritzerkranz:** feine Spritzer rund um das Monster.
- **Wasserrand:** dunkler, harter Rand, wo die Farbe getrocknet ist.
- **Ausgehobene Lichter:** helle Tupfer, als hätte jemand mit Papier Farbe abgenommen.
- **Neue Blüte** für Generation 2: weicher Blumenkohlrand statt der splittrigen Fläche. Die Blüte der Generation 1 bleibt, wie sie ist.

**5. Messen und zeigen**

- Entwurfsbogen (PNG in docs/entwuerfe) mit denselben Zügen vorher und nachher, dazu einzelne Reihen für Farbe, Muster, Gesichter und Ereignisse.
- Malzeit messen. Ziel: höchstens etwa 30 % mehr. Es wird ohnehin nebenbei gemalt.

## Reihenfolge

1. **Recycling** (klein): Archiv am Server, Knopf und Text, Tests, Upload.
2. **2b Entwurf:** Entwurfsbogen zur Rückmeldung, noch nicht im Spiel.
3. **2b einbauen** nach deiner Rückmeldung, Upload.
4. Danach laut Plan: seltene Stile (Shiny), dann Benennen.

## Offene Fragen

1. Neue Malereignisse nur Aussehen (Empfehlung) oder mit kleinen Werten wie Salz und Alkohol?
2. Die Generation-2-Würfel von heute bekommen das neue Aussehen (Empfehlung, gibt es nur im Playtest) oder bleiben, wie sie sind (dann bräuchte es eine Generation 3)?
3. Name des Knopfs: „Wash out“ bleibt (Empfehlung, passt zum Aquarell) oder „Recycle“?
4. Kann man ein ausgewaschenes Monster zurückholen? Empfehlung nein, sonst gäbe es Lasur ohne Verlust.
5. Reihenfolge wie oben: Recycling zuerst, dann 2b (Empfehlung)?
