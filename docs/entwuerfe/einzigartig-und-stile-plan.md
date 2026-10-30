# Plan: einzigartige Monster, mehr Zufall, seltene Stile

Stand 30.10.2026, Fassung 2. Rückmeldung:

1. Die Tagesposts in dieser Form nicht. Jedes Monster muss für jeden einzigartig sein. Tauschen soll später gehen, aber nicht, dass viele über den Tagespost dasselbe bekommen.
2. Die Monster sind noch nicht zufällig genug. Es fehlen andere Zeichenstile (Comic, Öl, Anime, Illustration, Bleistift schwarz-weiß), als super seltene oder Shiny-Varianten.

Rückmeldung zu Fassung 1: Shiny muss wesentlich seltener sein. Stile sind ok. Die Formen müssen vielfältiger werden, nicht bei jedem dritten Zug eine ähnliche Form. Der Rest ist ok (Empfehlungen angenommen).

Entwürfe, alles aus Code gemalt, keine Bilder:

- docs/entwuerfe/stile-selten-entwurf.png: ein Klecks in sechs Stilen, darunter jeder Stil auf anderen Klecksen
- docs/entwuerfe/formen-gen2-entwurf.png: dieselben 16 Züge in Generation 1 und 2, dazu je Bauplan acht Züge der Generation 2

## Festgelegt am 30.10.2026

- Der Tagespost fällt ganz weg. Der Spiel-Post bleibt der Einstieg.
- Das alte Malblatt aus dem MVP (Bogen mit Lasieren und Trockenzeit) kommt aus dem Post. Gelasiert wird an den Würfeln. Der Code bleibt für später liegen.
- Jeder Zug bleibt als eigenes Monster. Lasur entsteht durch bewusstes Auswaschen.
- Shiny: 1 zu 1000 je Zug (siehe 3).
- Die fünf Stile bleiben wie im Entwurf.
- Die bisherigen Würfel bleiben Generation 1 und sehen aus wie jetzt.
- Benennen per „What do you see?“-Post, je 50 Pigment für den Finder und den Namensgeber.

## 1. Einzigartig statt Tagesklecks

**Heute:** Der Tagespost zeigt einen Klecks aus dem Datum. Alle fangen dasselbe Monster, nur die Werte-Würfe sind eigen. Gezogene Würfel sind schon eigene Monster, aber eine doppelte Art wird automatisch zu Lasur.

**Neu:**

- Tagesklecks und Fangen fallen weg, ebenso der tägliche Post per Scheduler und der Mod-Menüpunkt „post today's blot“. Der angepinnte Spiel-Post bleibt der Einstieg.
- Jedes Monster entsteht nur aus einem eigenen Zug und hat einen eigenen Seed vom Server. Der Server führt ein Register aller vergebenen Seeds (bekannte Sammlung in Redis) und würfelt bei einer Dopplung neu. So gibt es jedes Monster genau einmal.
- Jedes Monster bekommt eine Seriennummer (#00427), den Tag des Zugs und den Besitzer. Das braucht später das Tauschen.
- Der freie Tageszug bleibt und ersetzt das tägliche Fangen.
- **Doppelte Art:** Jeder Zug bleibt als eigenes Monster. Wäschst du ein Monster aus („Wash out“), verschwindet es und gibt seiner Art so viel Lasur, wie heute ein Doppelter gibt (Common 1 bis Legendary 10). Würfel im Deck lassen sich nicht auswaschen, ein Shiny nur nach Rückfrage.

## 2. Mehr Zufall: Generation 2

**Heute:**

- 12 Baupläne mit je einer festen Silhouette
- 8 Pigmente in je genau einem Farbton
- 4 Papiere
- 6 Augen, 6 Münder, 4 Extras

Gemessen an 400 Zügen sieht heute jeder sechste Zug einem der zwei Züge davor ähnlich, und jeder zweite einem der zehn davor.

**Regel „gleicher Seed muss gleich aussehen“ bleibt:**

- Monster bekommen eine Generation.
- Generation 1 (alle bisherigen) wird genau wie heute gemalt. `npm test` und `npm run compare` prüfen weiter gegen den Prototyp.
- Generation 2 würfelt die neuen Merkmale aus einem eigenen Zufallsstrom. Die alten Zufallsaufrufe bleiben unberührt.
- Bauplan, Pigment, Werte und Fähigkeit im Duell kommen weiter aus dem alten Wurf. Die Art bleibt Bauplan plus Hauptpigment.

### 2a. Formen (Entwurf gebaut, src/shared/shape2.ts)

- **Fünf Grundformen je Bauplan**, 60 insgesamt:

| Bauplan | Grundformen |
|---|---|
| Crawler | Raupe, Schnecke mit oder ohne Haus, Tausendfüßer, Käfer, Spannerraupe im Bogen |
| Flutterer | Schmetterling, Fledermaus, Vogel, Motte, Libelle |
| Floater | Blase mit Fäden, Blasentraube, Wolke mit Tropfen, tropfende Kugel, Laterne |
| Quadruped | Hund, Langhals, Echse, Bär, Sechsbeiner |
| Serpent | Welle, Spirale mit aufgerichtetem Kopf, Kobra mit Haube, Aal mit Flossen, Seeschlange mit Buckeln |
| Tower | Stapel (Gesicht auch in der Mitte), Totem, Kaktus, schiefer Turm, Schneemann mit Hut |
| Crab | Krabbe (auch mit einer großen Schere), Spinne, Hummer, Einsiedler, Skorpion |
| Jelly | Qualle, Kalmar, Krake, Anemone, Glockenkette |
| Hopper | Hase, Frosch, Känguru, Grashüpfer, Sprungfeder |
| Tuber | Kartoffel, Pilz, Zwiebel, Karotte, Zwillingsknollen |
| Radiant | Seestern (auch gedreht), Sonne, Seeigel, Blume, Stern mit Ästen |
| Twinhead | zwei Köpfe, Hydra mit 3 bis 5 Köpfen, Kopf auf Kopf, siamesische Zwillinge, ein Kopf mit zwei Gesichtern |

- **Jede Grundform würfelt frei:** Zahl der Glieder, Beine, Arme und Köpfe, Längen, Krümmung, Größenverhältnisse.
- **Anbauteile** (0 bis 3, je Grundform erlaubt):
  - am Kopf höchstens eins: Hörner (Spitzen, Widderhorn, Einhorn, Geweih, Stummel), Ohren (lang, rund, spitz, Schlappohren), Fühler, Schopf, Mähne
  - am Körper: Kamm oder Platten, Schwanz (dünn, mit Quaste, dick, Fischflosse), Flossen, kleine Flügel, Beulen, Arme
- **Ganzes Monster:** gespiegelt (Kopf links oder rechts), gestreckt oder gestaucht, leicht geneigt, verschieden groß auf dem Blatt.
- **Gemessen an denselben 400 Zügen:** Ein Zug sieht einem der zwei Züge davor in 3 % der Fälle ähnlich statt 16 %, einem der zehn davor in 15 % statt 54 %. Ähnlich heißt: Die Umrisse decken sich zu mehr als 60 %, auch gespiegelt.
- **Malzeit:** etwa doppelt so lang wie heute, weil die Formen aus mehr Klecksen bestehen (höchstens 16 statt 8). Das Bild wird wie bisher einmal gemalt und zwischengespeichert.

### 2b. Farbe, Muster, Gesichter, Malereignisse (danach)

- **Farbe:** Farbton, Helligkeit und Sättigung schwanken um das Pigment (etwa ±12° im Farbkreis, ±15 %).
- **Muster** (etwa 40 %): Flecken, Streifen, Ringe, Sprenkel, Verlauf von Haupt- in Zweitfarbe, Marmor.
- **Gesichter:**
  - 1 bis 7 Augen in mehr Formen
  - Pupillen als Stern, Spirale oder Schlitz
  - Münder mit Zunge, Hauern oder Schnurrhaaren
  - Augenbrauen für die Laune
- **Malereignisse:** Zu Salz, Alkohol, Blüte und Fingerabdruck kommen dazu:
  - Läufer (Farbe läuft nach unten)
  - Spritzerkranz
  - Wasserrand
  - ausgehobene Lichter

## 3. Seltene Stile (Shiny)

Fünf Stile, alle aus Code gemalt (siehe Entwurf):

| Stil | Merkmal |
|---|---|
| **Pencil** | Graphit auf Skizzenpapier, nur Schwarz und Weiß, Hilfslinien, Schraffur, radierte Lichter, Notiz am Rand |
| **Comic** | dicke Kontur, flache kräftige Farbe, Rasterpunkte im Schatten, Strahlen, Textkasten mit Namen |
| **Bestiary Plate** (Illustration) | alte Tafel aus einem Bestiarium, Kupferstich mit Höhenlinien, von Hand koloriert, lateinischer Name, Maßstab |
| **Anime** | Pastellfarben, harte Zellschatten, große glänzende Augen, Wangen, Funkeln |
| **Oil** | pastose Pinselstriche entlang der Form, warmes Halbdunkel, Goldrahmen mit Messingschild |

**Wurf, offen und in zwei Stufen:**

1. Jeder Zug würfelt neben dem W100 fürs Papier einen zweiten W100, die Hand.
2. Zeigt die Hand 100, rollt ein W10. Bei 10 ist das Monster Shiny, also 1 zu 1000 je Zug.
3. Ein zweiter W10 wählt den Stil:

| W10 | Stil | Chance je Zug |
|---|---|---|
| 1 bis 3 | Pencil | 1 zu 3333 |
| 4 bis 5 | Comic | 1 zu 5000 |
| 6 bis 7 | Bestiary Plate | 1 zu 5000 |
| 8 bis 9 | Anime | 1 zu 5000 |
| 10 | Oil | 1 zu 10 000 |

Bei 3 bis 4 Zügen am Tag zieht ein Spieler etwa alle 9 Monate ein Shiny. In der ganzen Community kommen sie regelmäßig vor und werden später beim Tauschen wertvoll.

- **Unabhängig von der Seltenheit:** Auch ein Common kann Shiny sein. Ein Legendary in Öl ist die Krone.
- **Fair:** Kein Schutz vor Pech, nichts zu kaufen. Nur Optik, keine besseren Werte.
- **Überall sichtbar:** Sammlung, Deck, Klecks auf dem Duell-Blatt, Ziehen.
- **Beim Ziehen:**
  - Nach dem W100 fürs Papier rollt der Hand-Wurf.
  - Zeigt er 100, wird es still, und der W10 rollt langsam.
  - Bei Shiny hält das Bild an, der Pinsel wechselt das Werkzeug und malt den Klecks im neuen Stil neu.
  - Dazu ein eigener Klang und Glitzern.
- **Am Handy schnell genug:** Das Stilbild wird einmal gemalt und zwischengespeichert. Öl ist am teuersten.

## 4. Benennen ohne Tagespost

**Heute:** Die Art wird in den Kommentaren des Tagesposts benannt. Das fällt mit dem Tagespost weg.

**Neu „What do you see?“:**

- Ziehst du eine Art, die noch keinen Namen hat, kannst du deinen Klecks mit einem Tipp als Post teilen.
- Die Kommentare schlagen Namen vor. Nach 24 Stunden wird der Kommentar mit den meisten Stimmen der Name der Art für alle.
- Wie bisher: Der erste Name bleibt, jeden Namen gibt es nur einmal.
- Du und der Namensgeber bekommt je 50 Pigment. Das sind die 50, die bisher das Fangen gab.

So bleibt der Rorschach-Kern, jeder Post zeigt ein einzigartiges Monster, und die Community bekommt eigene Posts von Spielern.

## Reihenfolge

Jeder Schritt endet mit Upload und Handy-Test.

1. **Einzigartig:** Tagesklecks, Fangen, Tagespost und altes Malblatt raus, Seed-Register, Seriennummer, Doppelte behalten, Auswaschen.
2. **Vielfalt:** 2a Formen nach deinem Blick auf den Entwurf einbauen, danach 2b.
3. **Seltene Stile:** Hand-Wurf, fünf Stile im Renderer, Stilwechsel beim Ziehen, Anzeige im Duell.
4. **Benennen** mit „What do you see?“.

## Offen

- Formen-Entwurf ansehen: passt die Richtung, fehlt eine Grundform, wirkt eine zu wirr?
