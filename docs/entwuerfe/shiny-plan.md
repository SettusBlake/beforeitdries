# Plan: Shiny (seltene Stile)

Stand 30.10.2026, Fassung 3. Rückmeldung zum Entwurf: „passt, bau Schritt 3 ein“. Alles gebaut, Playtest v0.0.1.57. Bild im Spiel: docs/entwuerfe/shiny-im-spiel.png.

Freigegeben am 30.10.2026 (Fassung 2) mit allen Empfehlungen: Hand rollt bei jedem Zug sichtbar, Blank canvas kann Shiny werden, Shinys behalten die Gesichter aus 2b ohne Muster und Malereignisse, Dekoration nur groß, Test-Knopf für Mods im Playtest, Auswaschen gibt die normale Lasur.

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

- Nur Aussehen: gleiche Art, gleiche Werte, gleiche Fähigkeit. Kein Schutz vor Pech, nichts zu kaufen. Geändert am 30.10.2026: Ein Shiny hebt Papier und Seltenheit eine Stufe, damit auch Werte und Seiten (docs/entwuerfe/offen-und-shiny-stufe-plan.md).
- Unabhängig von der Seltenheit: Auch ein Common kann Shiny sein, ein Legendary in Öl ist die Krone.
- Nur neue Züge. Bisherige Würfel bleiben, wie sie sind.

## Schritt 1: Wurf am Server (gebaut, Playtest v0.0.1.55)

- Jeder Zug würfelt nach dem W100 fürs Papier einen zweiten W100, die **Hand**. Zeigt sie 100, rollt ein W10. Bei 10 ist das Monster Shiny, ein zweiter W10 wählt den Stil.
- Alle Würfe kommen mit dem Ergebnis zum Handy, damit das Ziehen sie zeigen kann.
- Der Würfel bekommt das Feld `style` (pencil, comic, plate, anime, oil). Seed, Seriennummer und Register wie bei jedem Zug.
- Auch Blank canvas kann Shiny werden: Deine Zeichnung erscheint dann im Stil.
- Auswaschen eines Shiny: ein dritter Tipp mit eigener Warnung. Es gibt Lasur wie für seine Seltenheit, mehr nicht (Shiny ist nur Aussehen). Im Archiv bleibt der Stil erhalten.
- Tests: Verteilung über viele Züge (200 000 Würfe, etwa 1 zu 1000), Felder, Auswaschen mit Rückfrage.
- Code: `rollShiny` und `STYLES` in src/shared/dice.ts, Wurf in `pullOne` (src/server/dice.ts).

## Schritt 2: Die fünf Stile im Renderer (Entwurf gebaut)

- Die Stile aus dem Entwurf kommen in den Renderer (eine Datei, src/client/renderer/styles.ts).
- Sie lernen alles, was der Aquarell-Renderer heute kann: die neuen Formen (Vielecke, Linien), gemalte Monster und die Gesichter aus 2b (Augenzahl, Mund, Brauen), jeweils in der eigenen Technik. Muster und Malereignisse aus 2b sind Aquarell-Techniken und fallen weg.
- Malen nebenbei in der Warteschlange wie beim Aquarell, mit Zwischenspeicher (gebaut mit Schritt 3).
- **Entwurfsbogen** docs/entwuerfe/shiny-entwurf.png: ein Zug in allen sechs Händen groß mit Dekoration, jeder Stil auf sieben neuen Formen und einem gemalten Falter, klein wie im Deck (46 px) und in der Sammlung (64 px), Malzeit. Quelle tools/mockup/shiny-entwurf.ts.
- Code: src/client/renderer/styles.ts (aus dem Entwurf übernommen), `renderStyled(canvas, monster, style, size, { deco, cutout })`. Der Painter (src/client/lib/painter.ts) malt jedes Monster mit Stil so.
- Gemessen (150 px): Aquarell 17,5 ms, Pencil 12,1 ms, Comic 2,5 ms, Bestiary Plate 3,8 ms, Anime 1,1 ms, Oil 8,3 ms. Alle Stile sind schneller als Aquarell, das Ziel für Öl ist weit erfüllt.

## Schritt 3: Überall sichtbar (gebaut)

- **Sammlung:** Karte mit Glanzrand (Blattgold-Schimmer) und Zeichen ✦ mit Stilnamen.
- **Würfelkarte:** großes Bild mit der Dekoration des Stils (Textkasten bei Comic, Tafelrand mit lateinischem Namen bei Bestiary Plate, Goldrahmen mit Messingschild bei Oil, Randnotiz bei Pencil, Funkeln bei Anime). Zeile „Shiny · Oil · 1 in 10 000“.
- **Kleine Bilder** (Deck, Würfelleiste, Klecks im Duell): nur der Stil ohne Dekoration, damit man das Monster erkennt. Im Duell steht der Klecks freigestellt (ohne Hintergrund des Stils) mit Aufkleber-Rand. Die Farbe auf dem Duell-Blatt bleibt Aquarell, damit das Spiel lesbar bleibt.
- **Kopf der Sammlung:** „12 dice · 9 species · 1 shiny“.

## Schritt 4: Das Ziehen (gebaut)

- Nach dem W100 fürs Papier rollt bei jedem Zug die Hand, klein und schnell (unter einer Sekunde, antippen beschleunigt).
- Zeigt die Hand 100: Es wird still, der W10 rollt langsam.
- Zeigt er 10: Das Bild hält an, „✦ SHINY ✦“, Glitzern und ein eigener Klang. Dann rollt der W10 für den Stil (die Stilnamen wechseln mit), danach wird der Pinsel zum Werkzeug des Stils (Bleistift, Feder, Grabstichel, Zellpinsel, Spachtel) und malt das Monster im neuen Stil neu. Abweichung vom Plan: erst der Stil-Wurf, dann das Werkzeug, sonst würde das Werkzeug den Stil vor dem Wurf verraten.
- Zeigt der W10 nicht 10: „so close“, dann geht es normal weiter.
- Sepia sagt etwas dazu, zum Beispiel: „That is not watercolour. Someone else has been painting on my sheet.“ (passt zur Welt, in der jemand am Blatt arbeitet).
- Zehnerzug: Jeder kleine Klecks zeigt seine Hand (eine 100 leuchtet gold). Ein Shiny bekommt danach sein eigenes Ritual in groß, statt des seltensten Zugs.
- Danach: „✦ Shiny! Oil, 1 in 10 000.“ in der Zeile unter dem Ziehen, in der Übersicht ein Glanzrand mit Stilname.

## Schritt 5: Testen (gebaut)

- Weil 1 zu 1000 im Test nie kommt: Test-Knopf wie beim Blank canvas, nur im Playtest und nur für Mods. Unter „Blank canvas“ steht „next dip shiny:“ mit fünf Stilen zum Antippen. Der gewählte leuchtet gold, der nächste Zug (auch Blank canvas oder der erste im Zehnerzug) wird Shiny in diesem Stil, nochmal tippen nimmt es zurück.

## Reihenfolge

1. Wurf am Server, Tests (noch ohne Bild, Shinys werden vorerst in Aquarell gemalt). Upload. Gebaut.
2. Stile im Renderer, Entwurfsbogen zur Rückmeldung. Gebaut.
3. Nach Rückmeldung: Anzeige überall, Ziehen mit Ritual, Ton, Test-Knopf. Upload. Gebaut, Playtest v0.0.1.57.

## Offene Fragen

Keine.
