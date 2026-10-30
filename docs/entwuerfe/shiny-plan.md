# Plan: Shiny (seltene Stile)

Stand 30.10.2026, Fassung 1. Wartet auf Freigabe.

Schon festgelegt am 30.10.2026: Shiny 1 zu 1000 je Zug (Hand-W100 zeigt 100, dann W10 zeigt 10), Stil per W10 (Pencil 3, Comic 2, Bestiary Plate 2, Anime 2, Oil 1), Stile wie im Entwurf docs/entwuerfe/stile-selten-entwurf.png, ein Shiny wird nur nach Rückfrage ausgewaschen.

## Was ein Shiny ist

- Ein Monster, das nicht in Aquarell gemalt ist, sondern in einem von fünf Stilen:

| Stil | Merkmal | Chance je Zug |
|---|---|---|
| **Pencil** | Graphit auf Skizzenpapier, Hilfslinien, Schraffur, radierte Lichter | 1 zu 3333 |
| **Comic** | dicke Kontur, flache Farbe, Rasterpunkte, Textkasten | 1 zu 5000 |
| **Bestiary Plate** | Kupferstich mit Höhenlinien, von Hand koloriert, lateinischer Name | 1 zu 5000 |
| **Anime** | Pastell, harte Zellschatten, große glänzende Augen, Funkeln | 1 zu 5000 |
| **Oil** | pastose Striche entlang der Form, Halbdunkel, Goldrahmen | 1 zu 10 000 |

- Nur Aussehen: gleiche Art, gleiche Werte, gleiche Fähigkeit. Kein Schutz vor Pech, nichts zu kaufen.
- Unabhängig von der Seltenheit: Auch ein Common kann Shiny sein, ein Legendary in Öl ist die Krone.
- Nur neue Züge. Bisherige Würfel bleiben, wie sie sind.

## Schritt 1: Wurf am Server

- Jeder Zug würfelt nach dem W100 fürs Papier einen zweiten W100, die **Hand**. Zeigt sie 100, rollt ein W10. Bei 10 ist das Monster Shiny, ein zweiter W10 wählt den Stil.
- Alle Würfe kommen mit dem Ergebnis zum Handy, damit das Ziehen sie zeigen kann.
- Der Würfel bekommt das Feld `style` (pencil, comic, plate, anime, oil). Seed, Seriennummer und Register wie bei jedem Zug.
- Auch Blank canvas kann Shiny werden: Deine Zeichnung erscheint dann im Stil.
- Auswaschen eines Shiny: ein dritter Tipp mit eigener Warnung. Es gibt Lasur wie für seine Seltenheit, mehr nicht (Shiny ist nur Aussehen). Im Archiv bleibt der Stil erhalten.
- Tests: Verteilung über viele Züge, Felder, Auswaschen mit Rückfrage.

## Schritt 2: Die fünf Stile im Renderer (Entwurf zuerst)

- Die Stile aus dem Entwurf kommen in den Renderer, eine Datei je Stil (src/client/renderer/styles/).
- Sie lernen alles, was der Aquarell-Renderer heute kann: die neuen Formen (Vielecke, Linien), gemalte Monster und die Gesichter aus 2b (Augenzahl, Mund, Brauen), jeweils in der eigenen Technik. Muster und Malereignisse aus 2b sind Aquarell-Techniken und fallen weg.
- Malen nebenbei in Schritten wie beim Aquarell, mit Zwischenspeicher.
- **Entwurfsbogen** (PNG): jeder Stil auf etwa 12 verschiedenen Formen, dazu ein gemaltes Monster, groß und klein, mit Malzeit. Ziel: Öl höchstens 3-mal so lang wie Aquarell, sonst wird Öl sparsamer.

## Schritt 3: Überall sichtbar

- **Sammlung:** Karte mit Glanzrand (Blattgold-Schimmer) und Zeichen ✦ mit Stilnamen.
- **Würfelkarte:** großes Bild mit der Dekoration des Stils (Textkasten bei Comic, Tafelrand mit lateinischem Namen bei Bestiary Plate, Goldrahmen mit Messingschild bei Oil, Randnotiz bei Pencil, Funkeln bei Anime). Zeile „Shiny · Oil · 1 in 10 000“.
- **Kleine Bilder** (Deck, Würfelleiste, Klecks im Duell): nur der Stil ohne Dekoration, damit man das Monster erkennt. Die Farbe auf dem Duell-Blatt bleibt Aquarell, damit das Spiel lesbar bleibt.
- **Kopf der Sammlung:** „12 dice · 9 species · 1 shiny“.

## Schritt 4: Das Ziehen

- Nach dem W100 fürs Papier rollt bei jedem Zug die Hand, klein und schnell (unter einer Sekunde, antippen beschleunigt).
- Zeigt die Hand 100: Es wird still, der W10 rollt langsam.
- Zeigt er 10: Das Bild hält an, der Pinsel wird zum Werkzeug des Stils (Bleistift, Feder, Grabstichel, Zellpinsel, Spachtel) und malt das Monster im neuen Stil neu. Dann rollt der W10 für den Stil, dazu Glitzern und ein eigener Klang.
- Sepia sagt etwas dazu, zum Beispiel: „That is not watercolour. Someone else has been painting on my sheet.“ (passt zur Welt, in der jemand am Blatt arbeitet).
- Zehnerzug: Jeder kleine Klecks zeigt seine Hand. Ein Shiny bekommt danach sein eigenes Ritual in groß.

## Schritt 5: Testen

- Weil 1 zu 1000 im Test nie kommt: Test-Knopf wie beim Blank canvas, nur im Playtest und nur für Mods: „next dip is shiny“ mit Wahl des Stils.

## Reihenfolge

1. Wurf am Server, Tests (noch ohne Bild, Shinys werden vorerst in Aquarell gemalt). Upload.
2. Stile im Renderer, Entwurfsbogen zur Rückmeldung.
3. Nach Rückmeldung: Anzeige überall, Ziehen mit Ritual, Ton, Test-Knopf. Upload.

## Offene Fragen

1. Soll die Hand bei jedem Zug sichtbar rollen (Empfehlung, Würfe sind sichtbar, kostet unter einer Sekunde) oder nur erscheinen, wenn sie 100 zeigt?
2. Kann ein Blank canvas Shiny werden (Empfehlung ja)?
3. Shinys behalten die Gesichter aus 2b in ihrer Technik, ohne Muster und Malereignisse (Empfehlung)?
4. Dekoration (Rahmen, Textkasten, Schild) nur auf der großen Karte und beim Ziehen, kleine Bilder ohne (Empfehlung)?
5. Test-Knopf „next dip is shiny“ für Mods im Playtest (Empfehlung ja)?
6. Auswaschen eines Shiny gibt nur die normale Lasur (Empfehlung) oder mehr?
