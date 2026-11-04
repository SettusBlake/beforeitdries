# Entwicklung: Vorschlag

Stand 04.11.2026, Fassung 2. Nichts davon ist im Spiel. Fragen am Ende.

Rückmeldung zu Fassung 1 (Schichten, die nur obendrauf gemalt werden): „so wie in Pokémon oder Digimon, aber die Farbe oder sonst was verläuft und die Form ändert sich halt“.

Bild: docs/entwuerfe/entwicklung2-entwurf.png (Quelle tools/mockup/entwicklung2-entwurf.ts). Diesmal ist alles mit dem echten Renderer gemalt. Die Formen kommen aus dem Entwurf src/shared/evolve.ts, der Renderer nimmt sie nur im Entwurf an (`geometry` in RenderOptions). Im Spiel ändert sich dadurch nichts. Das Bild zu Fassung 1 bleibt als entwicklung-entwurf.png liegen.

## 1 Idee

- **Wie bei Pokémon:** Nach der gezogenen Form kommen drei Stufen. Jede Stufe ist eine neue Form und eine eigene Art mit eigenem Namen.
- **Wie bei Digimon:** Ab Stufe 2 entscheidet, was der Klecks im Duell meistens getan hat, welche Richtung er nehmen kann.
- **Anders als dort:** Es gibt keine festen Formen. Jedes Monster entwickelt sich aus seinem eigenen Seed.
  - Zwei Kleckse derselben Art mit derselben Richtung bekommen dieselbe Art von Teilen und dieselbe neue Farbe, sehen aber nie gleich aus.
  - Das Gesicht bleibt, so erkennt man den Klecks wieder.
- **Abgrenzung zu Amber Delve:** Dort entwickelt sich lebende Ausrüstung, die mit Bernstein gefüttert wird. Hier entwickelt sich das Monster selbst, durch Einsatz im Spiel. Gefüttert wird nichts.

## 2 Wie sich die Form ändert

Das gilt für alle Formen: Generation 1, Generation 2 und selbst gemalte Monster. Verändert wird nur die fertige Form aus dem Seed, Stufe 0 bleibt genau wie heute.

**Wachsen:**
- Der Körper wächst stärker als der Kopf, um 12, 24 und 34 % je Stufe.
- Beine, Fühler und Schwänze werden länger, um 12, 22 und 30 %.
- Der Klecks steht mit jeder Stufe größer im Bild.

**Stufe 1** (für alle gleich): Das erste Teil sprießt, der Seed wählt aus Hörnchen, Rückenzacken oder Schwanz.

**Stufe 2 und 3** hängen von der Richtung ab:

| Richtung | kommt von | Stufe 2 | Stufe 3 | Farbe, die hineinläuft |
| --- | --- | --- | --- | --- |
| Spatter | oft gespritzt | Stacheln am Rücken, Hörner | mehr und größere Stacheln, große Hörner, Stachelschwanz | Carmine |
| Impasto | oft getroffen und überlebt | Panzerplatten | mehr Platten, Krone, Rückenzacken | Cadmium Yellow (deckt) |
| Bloom | viele Felder gemalt | Flügel, Blüte am Kopf | Schmetterlingsflügel, Mähne aus Blütenblättern | Opera Rose |
| Lift | viel gegangen, ausgewichen | Spiralschwanz, Flügelchen | Pfauenschwanz, schwebende Kugeln, Heiligenschein | Ultramarine |

Ist die neue Farbe schon die eigene, läuft die zweite hinein: Opera, Sienna, Carmine oder Phthalo.

- **Teile:** Sie kommen aus dem vorhandenen Bausatz der Formen (Hüte, Schwänze, Flügel) und neuen Teilen (Stacheln, Platten, Mähne, Kugeln). Gesetzt werden sie an Kopf, Rücken, Schulter und das hintere Ende des Kleckses.
- **Farbe verläuft:**
  - Stufe 1: Die neue Farbe läuft in die Zweitfarbe.
  - Stufe 2: eine Lasur der neuen Farbe darüber.
  - Stufe 3: eine zweite Lasur. Bei Lift nicht, denn Lift hebt Farbe aus.
  - Dazu je Stufe etwas mehr Wasser, damit es nasser verläuft.
- **Festes Bild:** gleicher Seed, gleiche Stufe, gleiche Richtung, gleiches Bild. Gespeichert werden nur Stufe und Richtung, nie das Bild.
- **Was im Entwurf noch nicht stimmt:**
  - Manche Kleckse werden zu dunkel (Lift auf Braun).
  - Teile sitzen nicht immer gut, zum Beispiel Hörner zwischen Ohren.
  - Das stimme ich in Schritt 1 mit vielen Zufallsmonstern ab.

## 3 Wann sich ein Klecks entwickelt

- **Erfahrung:** Jedes Beschwören zählt, die Stufen kommen bei 5, 15 und 30 Beschwörungen.
  - Gerechnet sind das etwa 0,4 Beschwörungen je Würfel und Duell.
  - Mit 5 Duellen und dem Tagesblatt am Tag dauert es bis Stufe 1 etwa 2 Tage, bis Stufe 3 etwa 2 Wochen.
- **Kosten:** Pigment, 100, 250 und 500.
- **Richtung:** Der Server zählt je Würfel Spritzer, eingesteckte Treffer, gemalte Felder und Schritte. Bei Stufe 2 bietet Sepia die zwei häufigsten an, du wählst.
- **Der Moment:**
  - Die Würfelkarte leuchtet, ein Tipp startet die Verwandlung.
  - Das Papier wird nass, die neue Farbe läuft hinein, die alte Form verblasst, die neue wird Schritt für Schritt gemalt.
  - Danach zählen die Werte sichtbar hoch, dazu Ton und Sepia.
- **Ablehnen:** „Keep it as it is“ lässt die Stufe aus, wie bei Pokémon. Später geht es trotzdem noch.

## 4 Was die Entwicklung bewirkt

**Werte** (Vorschlag, vor dem Bau simuliert):

| Stufe | Wirkung |
| --- | --- |
| 1 | +2 Lebenskraft, eine Seite wird besser (wie bei der Patina) |
| 2 | Wert der Richtung: Spatter Schaden +2, Impasto Lebenskraft +4, Bloom verläuft 1 Feld weiter, Lift Ausweichen +5 % und 1 Schritt weiter |
| 3 | Meisterzug schon ab 5 statt 6 Sättigung, die Stufe (Tier) kann steigen |

**Neue Arten:**
- Art heißt dann Bauplan, Hauptpigment, Stufe und Richtung.
- Wer als Erster eine neue Stufe einer Art erreicht, kann einen Post „What does it become?“ anlegen. Der Ablauf ist wie beim Benennen: Nach 24 Stunden wird der oberste gültige Kommentar der Name.
- So entsteht mit der Zeit ein Bestiarium mit Entwicklungsreihen wie im Pokédex.

**Gilt überall:**
- Duell und Tagesblatt.
- Galerie: die Stärke zählt mit.
- Archiv: Pales behalten ihre Form.
- Markt und Tausch: Stufe und Richtung wandern mit.

## 5 Umsetzung in Schritten

1. **Formen und Farbe fertig:** evolve.ts abstimmen und einen Entwurfsbogen mit etwa 30 Zufallsmonstern je Richtung zeigen. Dabei Ausreißer beheben: zu dunkel, Teile an falscher Stelle, zu viele Kleckse für das Handy. Danach deine Rückmeldung.
2. **Server:** Zähler je Würfel, Stufen, Werte, Simulation der Siegquoten.
3. **Verwandlung:** das Ritual, die Würfelkarte mit Fortschritt, Sepias Angebot.
4. **Arten:** „What does it become?“ und die Namen der Stufen.

Falten (zwei Kleckse zu einem, aus „Später“) danach als eigener Vorschlag.

## 6 Fragen

1. Passt die Richtung: wachsen, Teile sprießen, die Farbe läuft hinein? Oder soll sich die Form noch stärker ändern, zum Beispiel ein anderer Kopf, mehr Beine oder ein ganz anderer Körper bei Stufe 3?
2. Drei Stufen nach der gezogenen Form oder nur zwei? Empfehlung: drei.
3. Erfahrung durch Beschwören, Kosten in Pigment? Empfehlung: ja, beides.
4. Richtung: Sepia bietet zwei passende an und du wählst? Empfehlung: ja.
5. Jede Stufe eine eigene Art mit Namen aus der Community? Empfehlung: ja.
6. Verwandlung ablehnen können wie bei Pokémon? Empfehlung: ja.
7. Entwickeln sich Stil-Würfel (Pencil, Oil, Anime und so weiter) mit, also neue Form und gleicher Stil? Empfehlung: ja, die Stile malen dieselbe Form.
8. Falten später als eigener Vorschlag? Empfehlung: ja.
