# Gemälde: mehr wie ein echtes Aquarellbild

Stand 10.11.2026, Fassung 1. Frage: „Wie würde das Ganze mehr in Richtung Aquarell-Gemälde gehen?“ Wartet auf Freigabe (Fragen in Abschnitt 6).

Entwurfsbilder, gemalt mit dem echten Renderer (im Spiel aus, Schalter `PAINTERLY` in src/client/renderer/watercolor.ts, Quelle tools/mockup/gemaelde-entwurf.ts):
- docs/entwuerfe/gemaelde-entwurf.png: 16 Monster wie jetzt und als Gemälde, vier groß, drei in Stufen.
- docs/entwuerfe/gemaelde-nah.png: ein Paar ganz nah, links jetzt, rechts Gemälde.

## 1 Warum es noch nicht wie ein Gemälde aussieht

- **Viele dünne, gezackte Schichten:** Jede Fläche besteht aus 22 dünnen Schichten, jede mit eigenem, gezacktem Rand. Das gibt Fransen. Eine echte Lasur hat eine klare, geschwungene Kante.
- **Kein Pigmentrand:** Wenn Aquarellfarbe trocknet, wandert das Pigment an den Rand der Lasur. Dieser dunkle Saum ist das deutlichste Merkmal eines Aquarells. Bisher gibt es dafür nur drei dünne Striche.
- **Körnung als Punkte:** Die Körnung ist aufgestreut, statt dass die Farbe in den Tälern des Papiers liegen bleibt.
- **Alles gleich scharf:** Ein gemaltes Bild mischt harte Kanten und weich verlaufene (nass in nass).
- **Tusche überall:** Schwarze Konturen und Details lassen es wie eine Tuschezeichnung wirken.
- **Die Figur schwebt:** kein Schatten, kein Grund, nur leeres Blatt.

## 2 Vorschlag

### A Lasuren und Pigment (der Kern)
- **Eine Lasur je Teil** mit klarer, geschwungener Kante statt 22 gezackter Schichten.
- **Pigmentrand:** Am Rand jeder Lasur sammelt sich Farbe, die Fläche innen wird etwas heller und leuchtender.
- **Körnung aus dem Papier:** stärker bei Pigmenten, die wirklich körnen (Ultramarin, Sienna, Sepia), und auf rauem Papier.
- **Pfützen:** Die Farbe liegt unregelmäßig dicht, wie nach dem Trocknen.
- **Nasse Kanten:** Stellenweise läuft die Farbe weich aus. Je nasser das Monster (Feuchte), desto öfter.
- **Schatten ab Rare** als zweite Lasur mit eigener Kante (Sichel unten rechts) statt als weicher Verlauf.

### B Bleistift statt Tusche
- Konturen und Details (Fell, Schuppen, Nieten, Füße) als dünne Vorzeichnung in Graphit. Die Gesichter bleiben, wie sie sind.

### C Schlagschatten
- Eine kühle Lasur unter der Figur. Nur auf dem Blatt (Karten, Sammlung), nicht im Duell, dort steht der Klecks auf dem Sockel.

### D Loser Grund
- Zwei große, helle Lasuren hinter der Figur, wie mit breitem Pinsel angelegt. Im Bogen als letzte Stufe zu sehen.

## 3 Was gleich bleibt

- **Nur Aussehen:** Werte, Würfelseiten, Arten und Namen ändern sich nicht.
- **Formen, Farben, Farbplan, Gesichter und Augen** bleiben dieselben.
- **Generation 1** bleibt pixelgleich (144 von 144 Bildern), die 15 Stile bleiben.
- **Das Spiel ist unverändert:** Mit ausgeschaltetem Schalter sind die Bilder pixelgleich wie vorher (geprüft an 40 Bildern).

## 4 Was noch offen ist

- **Malzeit:** Eine kleine Kachel braucht im Entwurf 53 ms statt 21 ms. Vor dem Einbau würde ich die Rechenstufe in Scheiben teilen und Hilfsfelder in halber Auflösung rechnen, Ziel höchstens das 1,5-Fache.
- **Dünne Glieder** können an nassen Stellen fast verschwinden (im nahen Bild die Hinterbeine). Das lässt sich begrenzen.
- **Duell:** Frei stehend gibt es Rand, Körnung und Pfützen, aber keine weichen Kanten und keinen Schatten, der Aufkleber braucht einen klaren Umriss. Im Duell habe ich es noch nicht angesehen.
- **Ziehen:** Der Pinsel malt weiter in Bahnen, am Ende steht das fertige Bild.

## 5 Was man später noch tun könnte

- Muster (Streifen, Waben) als Pinselstriche mit wechselndem Druck statt gleichmäßiger Linien.
- Papier mit Büttenrand oder Klebeband-Spuren, kleine Signatur von Sepia bei Legendary.
- Gesichter lockerer malen (eigener Entwurf).

## 6 Fragen

1. Richtung: A bis C so einbauen? Empfehlung: ja.
2. D loser Grund: für niemanden, ab Epic oder für alle? Empfehlung: ab Epic, passend zu „mehr Aufwand bei höherer Seltenheit“.
3. Linien: ganz Bleistift, oder Tusche behalten und nur dünner? Empfehlung: Bleistift.
4. Stärke von Rand und Körnung: so, kräftiger oder dezenter? Empfehlung: so lassen, am Handy ansehen.
5. Gilt für alle Würfel mit den neuen Formen, auch vorhandene (wie Farbplan und „Leben“)? Empfehlung: ja.
6. Gesichter bleiben, wie sie sind? Empfehlung: ja.
