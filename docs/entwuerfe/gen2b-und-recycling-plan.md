# Plan: Generation 2b (Farbe, Muster, Gesichter, Malereignisse) und Recycling

Stand 30.10.2026, Fassung 2. Freigegeben am 30.10.2026 mit diesen Antworten: neue Malereignisse nur Aussehen, die Generation-2-Würfel von heute bekommen das neue Aussehen, der Knopf heißt weiter „Wash out“, Zurückholen vielleicht (nur unter erschwerten Bedingungen oder durch Mods, Vorschlag unten), Reihenfolge Recycling, dann 2b.

Wunsch vom 30.10.2026: Monster, die man nicht mehr will, recyceln oder später auf einen Marktplatz stellen. Gelöscht werden sie nicht, weil sie später als Gegner dienen sollen.

## Teil A: Recycling statt Löschen (gebaut)

**Vorher:** „Wash out“ auf der Würfelkarte (zweimal tippen) gab der Art Lasur, der Würfel war danach endgültig weg. Nur sein Seed blieb im Register.

**Jetzt:**

- Der Würfel verlässt deine Sammlung und gibt Lasur wie bisher (Common 1 bis Legendary 10). Er wird aber nicht gelöscht, sondern kommt ins **Archiv** am Server, mit allem: Seriennummer, Seed, Papier, Lasuren auf Seiten, Zeichnung, Generation, früherer Besitzer, Datum und Seltenheit.
- Speicher: Redis-Hash `recycled` (Seed → Würfel und Herkunft) und eine sortierte Liste `recycled:at` (nach Zeit), damit man später gezielt oder zufällig auswählen kann. Beides steht in keys.ts.
- Das Seed-Register zeigt dann `recycled:{Spieler}:{Würfel}`. Das Monster kommt nie als neuer Zug wieder.
- Regeln wie bisher: nicht aus dem Deck, mindestens 9 Würfel bleiben, ein Shiny nur nach Rückfrage (sobald es Shinys gibt).
- Text unter dem Knopf: „It leaves your collection, … gains 2 glaze. Blots that drift to the margins sometimes come back.“
- Was vor dem Einbau ausgewaschen wurde (nur Playtest), ist weg. Ab jetzt bleibt alles.

**Zurückholen (offen, Vorschlag):**

- **Für Spieler, erschwert:** „Rescue“ im Würfelbildschirm, nur die eigenen ausgewaschenen Monster der letzten 7 Tage. Kostet die Lasur doppelt zurück (fehlt sie, geht es nicht) und 300 Pigment, höchstens einmal pro Woche.
- **Für Mods:** Mod-Menü „restore a washed-out die“ mit Seriennummer, gibt das Monster seinem letzten Besitzer zurück, ohne Kosten (für Fehler und Hilfe).
- Beides lässt sich jederzeit nachrüsten, weil im Archiv alles liegt.

**Später (eigene Pläne, wenn es so weit ist):**

- **Gegner aus dem Archiv:** Rivalen-Decks mischen Monster aus dem Archiv dazu, nie deine eigenen. Passt zur Welt: Irgendwer radiert gezielt, und was an den Rand treibt, kommt verändert zurück.
- **Marktplatz:** Würfel für Pigment anbieten, der Käufer bekommt ihn mit Seriennummer, das Register wechselt den Besitzer.
- Gemalte Monster kommen in beides erst, wenn Melden und Mod-Menü stehen.

## Teil B: Generation 2b

**Grundsätze:**

- Nur Generation 2 (neue Züge und gemalte Monster). Generation 1 bleibt pixelgleich (144 von 144).
- Eigener Zufallsstrom aus dem Seed. Die Formen bleiben genau, wie sie sind.
- Nur Aussehen. Art (Bauplan und Hauptpigment), Werte und Fähigkeiten bleiben. Salz, Alkohol, Blüte und Fingerabdruck behalten ihre Werte, die neuen Malereignisse haben keine.
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

**5. Messen und zeigen (Entwurf gebaut)**

- Entwurfsbogen docs/entwuerfe/gen2b-entwurf.png: 16 Züge vorher und nachher, dazu Reihen für Farbton, Muster, Gesichter (1,8-mal vergrößert) und Malereignisse. Quelle tools/mockup/gen2b-entwurf.ts.
- Gemessen an 48 Zügen: Malzeit praktisch gleich (0 bis 1 % mehr, Ziel war höchstens 30 %).
- Anteile an 2000 Zügen: Muster 41 %, nicht zwei Augen 40 %, Augenbrauen 31 %, mindestens ein neues Malereignis 42 %.
- Code: Würfe in src/shared/look.ts (eigener Zufallsstrom), Malen in src/client/renderer/gen2b.ts. Im Spiel noch aus (Schalter `GEN2B` in watercolor.ts), Generation 1 weiter 144 von 144 gleich.

## Reihenfolge

1. **Recycling:** Archiv am Server, Text, Tests, Upload. Gebaut.
2. **2b Entwurf:** Entwurfsbogen zur Rückmeldung, noch nicht im Spiel. Gebaut.
3. **2b einbauen** nach deiner Rückmeldung, Upload.
4. Danach laut Plan: seltene Stile (Shiny), dann Benennen.

## Offene Fragen

1. Zurückholen: Passt der Vorschlag (Rescue für Spieler mit doppelter Lasur, 300 Pigment, 7 Tage, einmal pro Woche, dazu Wiederherstellen durch Mods)? Nur eins von beiden? Oder später?
2. Entwurf 2b: Was gefällt, was nicht? Sind die Muster kräftig genug?
3. 40 % der Monster haben nicht zwei Augen (1 bis 7). Ist das zu oft? Sonst würde ich auf etwa 25 % gehen.
