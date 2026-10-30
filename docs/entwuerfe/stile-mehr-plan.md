# Plan: Anime neu und weitere Stilrichtungen für Shinys

Stand 30.10.2026, Fassung 1. Wartet auf Freigabe.

Wunsch 30.10.2026: Mit dem Anime-Stil noch nicht zufrieden, dazu fehlen noch andere Stilrichtungen.

Entwurfsbogen: docs/entwuerfe/stile-mehr-entwurf.png (Quelle tools/mockup/stile-mehr.ts, Stile im Entwurf in src/client/renderer/styles-more.ts, noch nicht im Spiel).

## Heute

- Shiny 1 zu 1000 je Zug, danach würfelt ein W10 den Stil: Pencil 3, Comic 2, Bestiary Plate 2, Anime 2, Oil 1.
- Je Stil also 1 zu 3333 (Pencil), 1 zu 5000 (Comic, Plate, Anime) und 1 zu 10 000 (Oil).

## Was am bisherigen Anime nicht stimmt

- Weiche Glanzlichter mit Verlauf: wirkt wie eine glänzende Vinylfigur, nicht wie gezeichneter Anime.
- Dünne, überall gleich dicke Linie.
- Kleine Augen ohne Wimpernbogen, auf großen Körpern verlieren sie sich.
- Pastellverlauf mit Streifen als Hintergrund: keine Szene, nichts Typisches.

## Anime neu (Entwurf, erste Zeilen im Bogen)

- **Zellschatten mit harter Kante:** eine flache Grundfarbe, ein Schattenton ohne Verlauf, kühler gedreht (Richtung Blauviolett), wie im Fernseh-Anime.
- **Randlicht:** schmale helle Kante auf der Schattenseite, als käme Licht von hinten.
- **Lichtkante und harter Glanzstreif** oben links statt weichem Schein.
- **Linie:** in einem dunklen Ton der Körperfarbe, außen kräftig, innen fein.
- **Große Augen:** hohes Oval, Iris in harten Farbstufen, große und kleine Glanzlichter, Wimpernbogen mit Schwung nach außen, Unterlid angedeutet. Zwei Augen rücken etwas auseinander. Müde Augen werden zum geschlossenen Bogen.
- **Wangen** mit Röte und drei kleinen Strichen.
- **Karte groß:** Titel wie eine Folge, „EPISODE #42414“ und der Name in weißer Schrift mit Kontur.
- **Szene 1, Himmel:** tiefblauer Himmel, Gegenlicht, Lichtstrahlen, Haufenwolken mit hartem Schatten, Linsenreflexe. Das Monster steht auf der Wolkenbank.
- **Szene 2, Speedlines:** Konzentrationslinien zur Mitte, Grund in der Gegenfarbe, Aufprall-Striche am Kopf.

Malzeit: etwa ein Drittel vom Aquarell.

## Neue Stilrichtungen (acht Kandidaten im Bogen)

| | Stil | Was man sieht | Karte groß |
|---|---|---|---|
| A | **Pixel** | 16-Bit-Figur aus 48 × 48 Bildpunkten, eigene kleine Palette, dunkle Kontur, Himmel in Stufen mit Raster, Grasboden | Fenster wie in einem alten Rollenspiel mit Name und Seriennummer |
| B | **Ukiyo-e** | japanischer Farbholzschnitt: Washi-Papier, Himmel in Preußischblau, Nebelbänder, Berg, Wellenschuppen, flache Farben mit Stoffmuster, schwarze Linie | Kartusche mit dem Namen, rotes Siegel |
| C | **Stained glass** | Bleiglas: Scheiben mit Licht von oben, Bleiruten, Augen als runde Scheiben | Spitzbogen aus Stein, Name darunter |
| D | **Neon** | Leuchtröhren an einer dunklen Ziegelwand, Schein, kleine Lücken in den Röhren, Kabel, Gesicht in der zweiten Farbe | Name als Neonschrift |
| E | **Blueprint** | Bauplan auf Blaupapier: weiße Linien, Raster, Mittellinien, Maße, Augen mit Fadenkreuz. Passt zu „Bauplan“ im Spiel | Schriftfeld „drawn: M. Sepia“ mit Name und Seriennummer |
| F | **Crayon** | Wachsmalkreide wie von einem Kind: Kritzelflächen über den Rand, Strichbeine, Sonne mit Gesicht, Gras | Name in Kinderschrift |
| G | **Papercut** | geschnittenes Papier in Lagen mit weichen Schatten, Hügel, Mond, Augen aus weißem und schwarzem Papier | Papierschild mit Name |
| H | **Mosaic** | römisches Mosaik: Steinchen im Raster, helle Fugen, Augen aus eigenen Steinchen | Rahmen mit Band, Name oben |

Alle schneller als Aquarell (Mosaik etwa halb so schnell, die anderen deutlich schneller).

Bewusst nicht im Bogen: Pop Art (zu nah an Comic), Sumi-e-Tusche (zu nah an Aquarell und Ukiyo-e).

Weitere Ideen ohne Entwurf, falls dich eine reizt: Graffiti, Knetfigur, Low-Poly, Kreuzstich, Höhlenmalerei, Risograph-Druck, Jugendstil-Karte.

## Seltenheit

Shiny bleibt 1 zu 1000. Mit mehr Stilen würfelt ein W20 statt W10 den Stil, offen wie bisher. Beispiel, wenn alle acht dazukommen (13 Stile, Summe 20):

| Stil | Seiten auf dem W20 | je Zug |
|---|---|---|
| Pencil, Comic, Bestiary Plate, Anime, Pixel, Neon, Crayon | je 2 | je 1 zu 10 000 |
| Oil, Ukiyo-e, Stained glass, Blueprint, Papercut, Mosaic | je 1 | je 1 zu 20 000 |

Werden es weniger, verteile ich die Seiten neu, immer mit 1 oder 2 Seiten je Stil.

## Was sich ändert

- Bisherige Shinys behalten ihren Stil. Anime-Shinys sehen danach neu aus, weil das Bild nie gespeichert ist, nur der Stil.
- Beim Ziehen malt das Werkzeug des Stils das Monster neu, wie bisher. Neue Werkzeuge:
  - Pixel: Zeiger im Raster
  - Ukiyo-e: Holzstock und Druckballen
  - Stained glass: Lötkolben
  - Neon: Brenner, der die Röhre biegt
  - Blueprint: Tuschefüller am Lineal
  - Crayon: Kreide
  - Papercut: Schere
  - Mosaic: Pinzette mit Steinchen
- Test-Knopf „next dip shiny“ (Playtest, nur Mods) bekommt alle Stile.

## Reihenfolge

1. Anime neu einbauen (gewählte Szene).
2. Gewählte neue Stile in den Renderer, W20 am Server, Anzeige auf Karte und in der Sammlung, Tests.
3. Werkzeuge beim Ziehen, Test-Knopf, Upload und Bild.

## Fragen

1. Anime: Szene 1 (Himmel), Szene 2 (Speedlines) oder beide, je nach Monster gewürfelt? (Empfehlung: beide, das macht jedes Anime-Shiny etwas anders)
2. Welche der acht Kandidaten sollen ins Spiel? (Empfehlung: alle acht, sie sind deutlich verschieden und schnell)
3. Seltenheit mit W20 wie in der Tabelle? (Empfehlung: ja)
4. Reizt dich eine der weiteren Ideen ohne Entwurf, die ich als Nächstes zeichnen soll?
