# Gemälde: mehr wie ein echtes Aquarellbild

Stand 10.11.2026, Fassung 2. Frage: „Wie würde das Ganze mehr in Richtung Aquarell-Gemälde gehen?“ Freigegeben am 10.11.2026 („empfehlung“, alle sechs Empfehlungen) und im Spiel (Schalter `PAINTERLY` in src/client/renderer/watercolor.ts ist an).

Bilder:
- docs/entwuerfe/gemaelde-im-spiel.png: Sammlung, große Karte, Duell und erste Schritte in der App.
- docs/entwuerfe/gemaelde-entwurf.png: 16 Monster wie vorher und als Gemälde, vier groß, drei in Stufen (Quelle tools/mockup/gemaelde-entwurf.ts).
- docs/entwuerfe/gemaelde-nah.png: ein Paar ganz nah, links vorher, rechts Gemälde.

## 1 Warum es vorher nicht wie ein Gemälde aussah

- **Viele dünne, gezackte Schichten:** Jede Fläche bestand aus 22 dünnen Schichten, jede mit eigenem, gezacktem Rand. Das gab Fransen. Eine echte Lasur hat eine klare, geschwungene Kante.
- **Kein Pigmentrand:** Wenn Aquarellfarbe trocknet, wandert das Pigment an den Rand der Lasur. Dieser dunkle Saum ist das deutlichste Merkmal eines Aquarells. Dafür gab es nur drei dünne Striche.
- **Körnung als Punkte:** Die Körnung war aufgestreut, statt dass die Farbe in den Tälern des Papiers liegen bleibt.
- **Alles gleich scharf:** Ein gemaltes Bild mischt harte Kanten und weich verlaufene (nass in nass).
- **Tusche überall:** Schwarze Konturen und Details ließen es wie eine Tuschezeichnung wirken.
- **Die Figur schwebte:** kein Schatten, kein Grund, nur leeres Blatt.

## 2 Was gebaut ist

### A Lasuren und Pigment (der Kern)
- **Eine Lasur je Teil** mit klarer, geschwungener Kante statt 22 gezackter Schichten.
- **Pigmentrand:** Am Rand jeder Lasur sammelt sich Farbe, die Fläche innen wird etwas heller und leuchtender.
- **Körnung aus dem Papier:** stärker bei Pigmenten, die wirklich körnen (Ultramarin, Sienna, Sepia), und auf rauem Papier.
- **Pfützen:** Die Farbe liegt unregelmäßig dicht, wie nach dem Trocknen.
- **Nasse Kanten:** Stellenweise läuft die Farbe weich aus. Je nasser das Monster (Feuchte), desto öfter.
- **Schatten ab Rare** als zweite Lasur mit eigener Kante (Sichel unten rechts) statt als weicher Verlauf.

### B Bleistift statt Tusche
- Konturen und Details (Fell, Schuppen, Nieten, Füße) als dünne Vorzeichnung in Graphit. Die Gesichter bleiben, wie sie waren.

### C Schlagschatten
- Eine kühle Lasur unter der Figur. Nur auf dem Blatt (Karten, Sammlung), nicht im Duell, dort steht der Klecks auf dem Sockel.

### D Loser Grund ab Epic
- Zwei große, helle Lasuren hinter der Figur, wie mit breitem Pinsel angelegt. Für Epic und Legendary, bei Legendary zusätzlich zum Hof.

## 3 Entscheidungen (10.11.2026)

1. A bis C eingebaut.
2. D loser Grund ab Epic.
3. Linien ganz in Bleistift.
4. Rand und Körnung so stark wie im Entwurf.
5. Gilt für alle Würfel mit den neuen Formen, auch vorhandene und selbst gemalte.
6. Gesichter bleiben, wie sie waren.

## 4 Die offenen Punkte aus Fassung 1

- **Malzeit:** gelöst. Die Rechenstufe rechnet nur noch im Bereich der Farbe, weiche Hilfsfelder auf einem groben Raster, und gibt zwischendurch ab, damit andere Bilder weitermalen. Fair gemessen (das Malen wird wirklich ausgeführt, nicht nur vorgemerkt) ist „Gemälde“ gleich schnell oder schneller als vorher, weil eine Lasur statt 22 Schichten gemalt wird:
  - kleine Kachel: 22 statt 29 ms
  - mittlere Kachel: 28 statt 32 ms
  - große Karte: 55 statt 68 ms
  - Die Zahl aus Fassung 1 (53 statt 21 ms) verglich unfair: Das alte Malen war dort nur vorgemerkt, nicht ausgeführt.
- **Dünne Glieder** bleiben jetzt stehen: Wo ein Teil viel dichter ist als sein Umkreis (Beine, Fühler, Schwänze), läuft die Farbe nicht weich aus.
- **Duell:** angesehen. Frei stehend gibt es Rand, Körnung und Pfützen, der Umriss bleibt klar, es gibt keine weichen Kanten, keinen Schatten und keinen Grund.
- **Ziehen:** Der Pinsel malt weiter in Bahnen, am Ende steht das fertige Bild.

## 5 Was gleich bleibt

- **Nur Aussehen:** Werte, Würfelseiten, Arten und Namen ändern sich nicht.
- **Formen, Farben, Farbplan, Gesichter und Augen** bleiben dieselben.
- **Generation 1** bleibt pixelgleich (144 von 144 Bildern), die 15 Stile bleiben.

## 6 Was man später noch tun könnte

- Muster (Streifen, Waben) als Pinselstriche mit wechselndem Druck statt gleichmäßiger Linien.
- Papier mit Büttenrand oder Klebeband-Spuren, kleine Signatur von Sepia bei Legendary.
- Gesichter lockerer malen (eigener Entwurf).
