# Leben: größer, lebhaftere Gesichter, Tuschedetails

Stand 10.11.2026, Fassung 1. Gewünscht: mehr Variation und Genauigkeit bei den Formen, Augen-Varianten, lebhafter. Wartet auf Freigabe (Fragen in Abschnitt 5).

Entwurfsbilder, gemalt mit dem echten Renderer (im Spiel noch aus, Schalter `LIVELY` in src/client/renderer/watercolor.ts, Quelle tools/mockup/leben-entwurf.ts):
- docs/entwuerfe/leben-entwurf.png: 32 Monster, oben wie jetzt im Spiel, unten neu.
- docs/entwuerfe/leben-augen-tusche.png: die neuen Augenformen und die Tuschedetails einzeln.

## 1 Was mir an den Monstern auffällt

Gemessen an 2 000 Formen:
- **Klein im Bild:** Die längere Seite der Figur füllt im Mittel 73 % des Blatts, die kürzere nur 53 %.
- **Winzige Gesichter:** Das Gesicht hat im Mittel einen Radius von 8 % des Blatts. Auf einer Kachel der Sammlung sind die Augen damit etwa einen Pixel groß.
- **Vage Ränder:** Die Lasuren fransen stark aus, kleine Teile verschwimmen.
- **Keine Oberfläche:** Man sieht nicht, ob etwas Fell, Schuppen oder Blech ist.

## 2 Vorschlag

### A Größer
- Die Figur wird so vergrößert, dass die längere Seite 88 % des Blatts füllt. Die Form selbst bleibt gleich.

### B Lebhaftere Gesichter
- **Größer:** Das Gesicht wird 22 bis 42 % größer gemalt, die Augen dazu noch einmal ein Viertel. Zusammen mit A sind die Augen etwa doppelt so groß wie heute.
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

## 3 Was gleich bleibt

- **Nur Aussehen:** Werte, Würfelseiten, Arten, Namen und der Farbplan ändern sich nicht.
- **Eigener Zufall** aus dem Seed, die Formen bleiben dieselben.
- **Generation 1** bleibt pixelgleich (144 von 144 Bildern).
- **Malzeit:** im Schnitt 18 ms je Bild, wie jetzt.

## 4 Was ich bewusst noch nicht gemacht habe

- **Neue Formvorlagen:** Es gibt 200. Mehr Vorlagen oder genauere Vorlagen (zum Beispiel Finger, Schnäbel, Gelenke) sind ein eigener, größerer Schritt.
- **Mehr Schmuck bei höheren Seltenheiten** (Hörner, Kronen, Flügel): das ändert die Form vorhandener Monster.
- **Posen und Bewegung im Duell** (Blinzeln, Wippen der Augen): das wäre Animation, nicht Malen.

## 5 Fragen

1. A bis D zusammen einbauen? Empfehlung: ja.
2. Für wen gilt es? A: alle Würfel mit den neuen Formen, auch vorhandene (wie beim Farbplan). B: nur neue Züge. Empfehlung: A.
3. Augen: Passt die Mischung, oder willst du einzelne Formen öfter, seltener oder gar nicht (zum Beispiel cross und heart)? Empfehlung: so lassen.
4. Tuschedetails so dezent, oder kräftiger? Empfehlung: so lassen, am Handy ansehen.
5. Selbst gemalte Monster bekommen größere Gesichter und Tuschedetails, bleiben aber dort, wo sie gemalt wurden? Empfehlung: ja.
6. Danach neue und genauere Formvorlagen als nächster Schritt? Empfehlung: erst A bis D am Handy ansehen.
