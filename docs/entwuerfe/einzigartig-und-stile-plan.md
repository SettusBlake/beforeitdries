# Plan: einzigartige Monster, mehr Zufall, seltene Stile

Stand 30.10.2026, Fassung 3. Rückmeldung:

1. Die Tagesposts in dieser Form nicht. Jedes Monster muss für jeden einzigartig sein. Tauschen soll später gehen, aber nicht, dass viele über den Tagespost dasselbe bekommen.
2. Die Monster sind noch nicht zufällig genug. Es fehlen andere Zeichenstile (Comic, Öl, Anime, Illustration, Bleistift schwarz-weiß), als super seltene oder Shiny-Varianten.

Rückmeldung zu Fassung 1: Shiny muss wesentlich seltener sein. Stile sind ok. Die Formen müssen vielfältiger werden, nicht bei jedem dritten Zug eine ähnliche Form. Der Rest ist ok (Empfehlungen angenommen).

Rückmeldung zum ersten Formen-Entwurf: Die Formen müssen viel, viel besser und vielfältiger werden. Alles an Tieren, Maschinen, Kunstwerken und Anime-Figuren (wenn lizenzrechtlich ok, sonst angedeutet) dazunehmen. Eine Katze ist ok, aber nicht 20 Katzen. Drei vielleicht, und wenn es zehn sind, müssen es völlig verschiedene Katzen sein.

Entwürfe, alles aus Code gemalt, keine Bilder:

- docs/entwuerfe/stile-selten-entwurf.png: ein Klecks in sechs Stilen, darunter jeder Stil auf anderen Klecksen
- docs/entwuerfe/formen-gen2-entwurf.png: Messung, 48 Züge hintereinander, acht Katzen, acht Automaten, je Bauplan acht Züge

## Festgelegt am 30.10.2026

- Der Tagespost fällt ganz weg. Der Spiel-Post bleibt der Einstieg.
- Das alte Malblatt aus dem MVP (Bogen mit Lasieren und Trockenzeit) kommt aus dem Post. Gelasiert wird an den Würfeln. Der Code bleibt für später liegen.
- Jeder Zug bleibt als eigenes Monster. Lasur entsteht durch bewusstes Auswaschen.
- Shiny: 1 zu 1000 je Zug (siehe 3).
- Die fünf Stile bleiben wie im Entwurf.
- Die bisherigen Würfel bleiben Generation 1 und sehen aus wie jetzt.
- Benennen per „What do you see?“-Post, je 50 Pigment für den Finder und den Namensgeber.

## 1. Einzigartig statt Tagesklecks (gebaut, Playtest v0.0.1.41)

- Tagesklecks, Fangen, der tägliche Post und die Mod-Menüs dafür sind weg. Der angepinnte Spiel-Post ist der Einstieg, alte Tagesposts zeigen sein Startbild.
- Jedes Monster entsteht nur aus einem eigenen Zug. Der Server führt ein Register aller vergebenen Seeds und würfelt bei einer Dopplung neu. So gibt es jedes Monster genau einmal.
- Jedes Monster hat eine Seriennummer (#00427), den Tag des Zugs und den Besitzer. Das braucht später das Tauschen.
- Der freie Tageszug bleibt und ersetzt das tägliche Fangen.
- **Doppelte Art:** Jeder Zug bleibt als eigenes Monster. Wäschst du ein Monster aus („Wash out“), verschwindet es und gibt seiner Art so viel Lasur, wie früher ein Doppelter gab (Common 1 bis Legendary 10). Würfel im Deck lassen sich nicht auswaschen, und es bleiben immer mindestens 9 Würfel. Ein Shiny wird nur nach Rückfrage ausgewaschen.

## 2. Mehr Zufall: Generation 2

**Regel „gleicher Seed muss gleich aussehen“ bleibt:**

- Monster bekommen eine Generation.
- Generation 1 (alle bisherigen) wird genau wie heute gemalt. `npm test` und `npm run compare` prüfen weiter gegen den Prototyp (144 von 144 Bildern gleich).
- Generation 2 würfelt die Form aus einem eigenen Zufallsstrom. Die alten Zufallsaufrufe bleiben unberührt.
- Bauplan, Pigment, Werte und Fähigkeit im Duell kommen weiter aus dem alten Wurf. Die Art bleibt Bauplan plus Hauptpigment.

### 2a. Formen aus Vorlagen (Entwurf gebaut, src/shared/forms/)

**200 Vorlagen,** jede einem Bauplan zugeordnet, der zu ihr passt:

| Bauplan | Vorlagen | Beispiele |
|---|---|---|
| Quadruped | 23 | Katze, Hund, Fuchs, Pferd, Langhals, Elefant, Schwein, Rind, Schaf, Hirsch, Löwe, Bär, Maus, Capybara, Nashorn, Kamel, Stegosaurus, Langhals-Riese, Springer (Schach), Stuhl, Tisch, Badewanne, Klavier |
| Crawler | 15 | Schildkröte, Igel, Käfer, Marienkäfer, Schnecke (auch mit Haus), Raupe, Auto, Lok, Traktor, Krokodil, Gürteltier, Maulwurf, Bus, Schuh, Robbe |
| Crab | 13 | Krabbe, Spinne, Skorpion, Gottesanbeterin, Ameise, Vielbeiner, Laufmaschine, Hummer, Einsiedler (in Schneckenhaus, Teekanne, Dose oder Schädel), Hirschkäfer, Pfeilschwanz, Turmkran, Bagger |
| Tower | 22 | Pinguin, Bauer, Turm, König, Läufer, Leuchtturm, Rakete, Kerze, Lampe, Sanduhr, Automat, Torte, Baum, Tanne, Bonsai, Kaktus, Matroschka, Kokeshi, Moai, Totem, Schreiender, Golem |
| Flutterer | 17 | Eule, Vogel, Biene, Mantarochen, Propellerflugzeug, Hubschrauber, Papierkranich, Papierflieger, Drachen, Greif, Wasserspeier, Schmetterling, Fledermaus, Untertasse, Fee, Flugsaurier, Fliegender Fisch |
| Hopper | 15 | Küken, Tyrannosaurus, Känguru, Ente, Wecker, Winkekatze, Schirmgeist, Hasenhirsch, Hase, Frosch, Grashüpfer, Sprungfeder, Springteufel, Pogo-Reiter, Ball |
| Serpent | 16 | Schlange, Ringelnatter, Kobra, Seeschlange, Knotenschlange, Drache (östlich und westlich), Tausendfüßer, Seepferdchen, Banane, Bandgeist, Aal, Ringelwurm, Seil, Gartenschlauch, Spirale, Kette |
| Floater | 15 | Fisch, Kugelfisch, Wal, Meeresschildkröte, Segelboot, Papierboot, U-Boot, Luftschiff, Ballon, Laternengeist, Laken-Gespenst, Mobile, Wolke, kleiner Planet, schwebendes Auge |
| Tuber | 22 | Gefäß (Vase, Amphore, Flasche, Glocke …), Teekanne, Tasse, Grammophon, Kamera, Cupcake, Teigtasche, Apfel, Birne, Zitrone, Erdbeere, Ananas, Aubergine, Kürbis, Pilz, Karotte, Radieschen, Zwiebel, Kartoffel, Rübe, Topfpflanze, Daruma |
| Radiant | 17 | Seestern, Sonne, Seeigel, Blume, Sonnenblume, Schneeflocke, Windrad, Windmühle, Zahnrad, Palme, Riesenrad, Ventilator, Pusteblume, Feuerwerk, Kompassrose, Netzweber, Wagenrad |
| Jelly | 13 | Qualle, Glockenqualle, Kalmar, Krake, Anemone, Glockenkette, Kronleuchter, Zottel, Fallschirm, Windspiel, Hängepflanze, Fransenlampe, Trauerweide |
| Twinhead | 12 | Zwei Hälse, Kopf auf Kopf, Siamesische Zwillinge, Doppelgesicht, Zerberus, Hydra, Kirschenpaar, Doppeladler, Reiter mit Reittier, verbundene Gefäße, Doppeldotter-Ei, kubistische Maske |

- **Lizenz:** Keine geschützten Figuren. Anime nur als allgemeine Archetypen (Maskottchen mit großem Kopf, Mecha, Fee, Untertasse). Dazu Volkskunst und Sagen, die frei sind (Daruma, Matroschka, Kokeshi, Moai, Totem, Winkekatze, Karakasa-Schirmgeist, Laternengeist, Kitsune mit vielen Schwänzen, Greif, Zerberus, Hydra, Hasenhirsch) und gemeinfreie Kunstmotive (Schreiender nach Munch, kubistische Maske, Mobile, Origami).
- **Jede Vorlage würfelt frei:** Tiere stehen, gehen, sitzen, liegen, strecken sich oder richten sich auf. Körperlänge, Dicke, Beinlänge, Halslänge und Kopfgröße schwanken. Dazu passende Teile: 24 Köpfe, 9 Hüte, 12 Schwänze (auch Fuchs mit bis zu 7 Schwänzen), 8 Beinarten, 7 Flügelarten, Muster wie Streifen, Flecken, Punkte.
- **Mischwesen:** 12 % der Monster bekommen einen ganz anderen Kopf (Kuhkopf auf Teekanne, Roboterkopf auf Spinne). Manche bekommen einen Hut oder Flügel.
- **Ganzes Monster:** gespiegelt, leicht gestreckt oder gestaucht, leicht geneigt, verschieden groß.
- **Neue Malmittel im Renderer** (nur für die neuen Formen, Generation 1 unverändert): Vielecke mit festeren Kanten für Dinge und Maschinen, Tuschekontur auch für kleine Teile, kleine Teile mit weniger Lasurschichten.
- **Gemessen an 400 Zügen:**

| | heute | neu |
|---|---|---|
| Umriss ähnlich zu einem der 2 Züge davor | 16 % | 4 % |
| Umriss ähnlich zu einem der 10 Züge davor | 54 % | 19 % |
| dieselbe Vorlage unter den 2 Zügen davor | | 1 % |
| dieselbe Vorlage unter den 10 Zügen davor | | 4 % |

  Ähnlich heißt: Die Umrisse decken sich zu mehr als 60 %, auch gespiegelt. Eine Katze kommt im Schnitt einmal in etwa 200 Zügen.
- **Malzeit:** etwa 2,5- bis 3-mal so lang wie heute (höchstens 28 Kleckse und 60 Linien je Monster). Das Bild wird wie bisher einmal gemalt und zwischengespeichert.

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
- Die Stile müssen danach auch die neuen Formen (Vielecke) malen können.

## 4. Benennen ohne Tagespost

**Heute:** Die Art wurde in den Kommentaren des Tagesposts benannt. Das ist mit dem Tagespost weggefallen.

**Neu „What do you see?“:**

- Ziehst du eine Art, die noch keinen Namen hat, kannst du deinen Klecks mit einem Tipp als Post teilen.
- Die Kommentare schlagen Namen vor. Nach 24 Stunden wird der Kommentar mit den meisten Stimmen der Name der Art für alle.
- Wie bisher: Der erste Name bleibt, jeden Namen gibt es nur einmal.
- Du und der Namensgeber bekommt je 50 Pigment. Das sind die 50, die bisher das Fangen gab.

So bleibt der Rorschach-Kern, jeder Post zeigt ein einzigartiges Monster, und die Community bekommt eigene Posts von Spielern.

## Reihenfolge

Jeder Schritt endet mit Upload und Handy-Test.

1. **Einzigartig** (gebaut).
2. **Vielfalt:** 2a Formen nach deinem Blick auf den Entwurf einbauen, danach 2b.
3. **Seltene Stile:** Hand-Wurf, fünf Stile im Renderer, Stilwechsel beim Ziehen, Anzeige im Duell.
4. **Benennen** mit „What do you see?“.

## Offen

- Formen-Entwurf ansehen: Passt die Richtung? Welche Vorlagen gefallen nicht, was fehlt noch?
- Malzeit: 2,5- bis 3-mal so lang wie heute. Am Handy prüfe ich das nach dem Einbau. Wird es zäh, male ich kleine Teile noch sparsamer.
