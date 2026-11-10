# Leben: größer, lebhaftere Gesichter, Tuschedetails

Stand 10.11.2026, Fassung 2. Gewünscht: mehr Variation und Genauigkeit bei den Formen, Augen-Varianten, lebhafter. Freigegeben am 10.11.2026 („mach“, alle sechs Empfehlungen) und im Spiel (Schalter `LIVELY` in src/client/renderer/watercolor.ts ist an).

Bilder:
- docs/entwuerfe/leben-im-spiel.png: Sammlung, große Karte, Duell und erste Schritte in der App.
- docs/entwuerfe/leben-entwurf.png: 32 Monster, oben wie vorher, unten neu (Quelle tools/mockup/leben-entwurf.ts).
- docs/entwuerfe/leben-augen-tusche.png: die neuen Augenformen und die Tuschedetails einzeln.

## 1 Was mir an den Monstern auffiel

Gemessen an 2 000 Formen:
- **Klein im Bild:** Die längere Seite der Figur füllte im Mittel 73 % des Blatts, die kürzere nur 53 %.
- **Winzige Gesichter:** Das Gesicht hatte im Mittel einen Radius von 8 % des Blatts. Auf einer Kachel der Sammlung waren die Augen damit etwa einen Pixel groß.
- **Vage Ränder:** Die Lasuren fransten stark aus, kleine Teile verschwammen.
- **Keine Oberfläche:** Man sah nicht, ob etwas Fell, Schuppen oder Blech ist.

## 2 Was gebaut ist

### A Größer
- Die Figur wird so vergrößert, dass die längere Seite 88 % des Blatts füllt. Die Form selbst bleibt gleich.

### B Lebhaftere Gesichter
- **Größer:** Das Gesicht wird 22 bis 42 % größer gemalt, die Augen dazu noch einmal ein Viertel. Zusammen mit A sind die Augen etwa doppelt so groß wie vorher.
- **Neun neue Augenformen** zu den acht bisherigen:
  - big (große runde Augen mit farbiger Iris und zwei Glanzpunkten)
  - oval (hohe Ovale)
  - cat (Mandelform mit Schlitzpupille)
  - angry (schräges Lid)
  - happy (zusammengekniffen)
  - dots (Knopfpunkte)
  - goat (Querbalken als Pupille)
  - cross (Kreuze)
  - heart (Herzaugen)
- **Dazu:** Zwinkern (6 %), Wimpern (16 %), ungleich große Augen (10 %), zwei Augenfarben (7 %), acht Augenfarben.
- **Verteilung:** 26 % behalten ihre bisherige Augenform, 18 % big, 12 % oval, 9 % cat, 8 % angry, je 7 % happy und dots, 5 % goat, je 3 % cross und heart.

### C Tuschedetails
- **Oberfläche je nach Wesen:** Tiere bekommen Fell (kurze Striche über den Rand hinaus), Schuppen, Federn oder Schraffur. Dinge und Maschinen bekommen Nieten mit Naht, Maserung oder Schraffur. Etwa jedes fünfte bleibt glatt.
- **Auf dunkler Farbe** werden die Linien hell ausgehoben statt mit Tusche gezogen, sonst sähe man sie nicht.
- **Füße:** Glieder, die nach unten enden, bekommen drei Zehen (bei 70 %).

### D Klarere Ränder
- Die Lasuren fransen um gut ein Drittel weniger aus. Die Form liest sich genauer, bleibt aber Aquarell.

## 3 Entscheidungen (10.11.2026)

1. A bis D zusammen eingebaut.
2. Gilt für alle Würfel mit den neuen Formen, auch vorhandene (wie beim Farbplan).
3. Augen: Mischung wie im Entwurf.
4. Tuschedetails dezent wie im Entwurf.
5. Selbst gemalte Monster bekommen größere Gesichter und Tuschedetails, bleiben aber dort, wo sie gemalt wurden.
6. Neue und genauere Formvorlagen erst, nachdem A bis D am Handy angesehen sind.

## 4 Beim Einbauen dazugekommen

- **Im Duell und in den ersten Schritten** stehen die Kleckse frei als Aufkleber mit farbigem Rand. Mit 88 % des Bildes hätte bei fast allen (88 von 100) der Rand nicht mehr ins Bild gepasst, und hohe Figuren hingen bis unter den Sockel. Deshalb malt der Renderer dort etwas kleiner (längere Seite 78 % des Bildes, das sind etwa 1,3 Felder, vorher im Mittel 1,24) und stellt jede Figur mit der Unterkante auf den Sockel. Vorher schwebten flache Figuren über dem Sockel. Karten und Sammlung bleiben bei 88 %.
- **Ladefehler behoben:** Der Playtest v0.2.0.18 (Entwurf noch ausgeschaltet) lud nicht, weil sich zwei Renderer-Dateien gegenseitig laden und eine davon beim Laden eine Farbe der anderen las. Behoben, dazu ein Test, der den gepackten Renderer lädt (tests/bundle-load.test.ts).

## 5 Was gleich bleibt

- **Nur Aussehen:** Werte, Würfelseiten, Arten, Namen und der Farbplan ändern sich nicht.
- **Eigener Zufall** aus dem Seed, die Formen bleiben dieselben.
- **Generation 1** bleibt pixelgleich (144 von 144 Bildern).
- **Die 15 Stile** haben ihren eigenen Renderer und bleiben, wie sie sind.
- **Malzeit:** im Schnitt 18 ms je Bild, wie vorher.

## 6 Offen für später

- **Neue Formvorlagen:** Es gibt 200. Mehr Vorlagen oder genauere Vorlagen (zum Beispiel Finger, Schnäbel, Gelenke) sind ein eigener, größerer Schritt.
- **Mehr Schmuck bei höheren Seltenheiten** (Hörner, Kronen, Flügel): das ändert die Form vorhandener Monster.
- **Posen und Bewegung im Duell** (Blinzeln, Wippen der Augen): das wäre Animation, nicht Malen.
