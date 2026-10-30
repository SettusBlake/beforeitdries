# Plan: einzigartige Monster, mehr Zufall, seltene Stile

Stand 30.10.2026. Rückmeldung:

1. Die Tagesposts in dieser Form nicht. Jedes Monster muss für jeden einzigartig sein. Tauschen soll später gehen, aber nicht, dass viele über den Tagespost dasselbe bekommen.
2. Die Monster sind noch nicht zufällig genug. Es fehlen andere Zeichenstile (Comic, Öl, Anime, Illustration, Bleistift schwarz-weiß), als super seltene oder Shiny-Varianten.

Entwurf: docs/entwuerfe/stile-selten-entwurf.png. Oben ein Klecks in sechs Stilen, unten jeder Stil auf anderen Klecksen. Alles aus Code gemalt, keine Bilder.

## 1. Einzigartig statt Tagesklecks

**Heute:** Der Tagespost zeigt einen Klecks aus dem Datum. Alle fangen dasselbe Monster, nur die Werte-Würfe sind eigen. Gezogene Würfel sind schon eigene Monster, aber eine doppelte Art wird automatisch zu Lasur.

**Neu:**

- Tagesklecks und Fangen fallen weg, ebenso der tägliche Post per Scheduler und der Mod-Menüpunkt „post today's blot“. Der angepinnte Spiel-Post bleibt der Einstieg.
- Jedes Monster entsteht nur aus einem eigenen Zug und hat einen eigenen Seed vom Server. Der Server führt ein Register aller vergebenen Seeds (bekannte Sammlung in Redis) und würfelt bei einer Dopplung neu. So gibt es jedes Monster genau einmal.
- Jedes Monster bekommt eine Seriennummer (#00427), den Tag des Zugs und den Besitzer. Das braucht später das Tauschen.
- Der freie Tageszug bleibt und ersetzt das tägliche Fangen.
- **Doppelte Art:** Jeder Zug bleibt als eigenes Monster. Lasur entsteht, wenn man ein Monster bewusst auswäscht („Wash out“), für ein anderes derselben Art. Ein Shiny wird nie von selbst ausgewaschen.

## 2. Mehr Zufall: Generation 2

**Heute:**

- 12 Baupläne
- 8 Pigmente in je genau einem Farbton
- 4 Papiere
- 6 Augen, 6 Münder, 4 Extras

Viele Züge sehen sich deshalb ähnlich: gleiche Grundform, gleiche Farbe.

**Neu für alle neuen Monster (Generation 2),** jeder Wurf am Server:

- **Farbe:** Farbton, Helligkeit und Sättigung schwanken um das Pigment (etwa ±12° im Farbkreis, ±15 %). Die Art bleibt Bauplan plus Hauptpigment.
- **Muster** (etwa 40 %): Flecken, Streifen, Ringe, Sprenkel, Verlauf von Haupt- in Zweitfarbe, Marmor.
- **Körper:**
  - größere Spannen bei Größe, Proportionen und der Zahl der Beine und Arme
  - Strecken und Stauchen, Neigung, leichte Asymmetrie
- **Anbauteile** (0 bis 3 je Monster): Hörner in mehreren Formen, Fühler, Schwanz, Flossen, Kamm, Ohren, Stacheln, Zusatzaugen am Körper, kleine Flügel, Tentakel.
- **Chimären** (selten, etwa 5 %): Kopf oder Hinterteil eines zweiten Bauplans.
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

Ergebnis: Millionen sichtbar verschiedener Kombinationen statt weniger ähnlicher Typen je Art.

**Regel „gleicher Seed muss gleich aussehen“ bleibt:**

- Monster bekommen eine Generation.
- Generation 1 (alle bisherigen) wird genau wie heute gemalt. `npm test` und `npm run compare` prüfen weiter gegen den Prototyp.
- Generation 2 würfelt die neuen Merkmale aus einem eigenen Zufallsstrom. Die alten Zufallsaufrufe bleiben unberührt.

Vor dem Einbau zeige ich einen Entwurfsbogen: 24 Monster Generation 1 neben 24 Monstern Generation 2.

## 3. Seltene Stile (Shiny)

Fünf Stile, alle aus Code gemalt (siehe Entwurf):

| Stil | Merkmal |
|---|---|
| **Pencil** | Graphit auf Skizzenpapier, nur Schwarz und Weiß, Hilfslinien, Schraffur, radierte Lichter, Notiz am Rand |
| **Comic** | dicke Kontur, flache kräftige Farbe, Rasterpunkte im Schatten, Strahlen, Textkasten mit Namen |
| **Bestiary Plate** (Illustration) | alte Tafel aus einem Bestiarium, Kupferstich mit Höhenlinien, von Hand koloriert, lateinischer Name, Maßstab |
| **Anime** | Pastellfarben, harte Zellschatten, große glänzende Augen, Wangen, Funkeln |
| **Oil** | pastose Pinselstriche entlang der Form, warmes Halbdunkel, Goldrahmen mit Messingschild |

**Wurf:** Jeder Zug würfelt neben dem W100 fürs Papier einen zweiten offenen W100, die Hand. Bei 100 ist das Monster Shiny, dann entscheidet ein W10 den Stil:

| W10 | Stil | Chance je Zug |
|---|---|---|
| 1 bis 3 | Pencil | 1 zu 333 |
| 4 bis 5 | Comic | 1 zu 500 |
| 6 bis 7 | Bestiary Plate | 1 zu 500 |
| 8 bis 9 | Anime | 1 zu 500 |
| 10 | Oil | 1 zu 1000 |

Bei 3 bis 4 Zügen am Tag kommt etwa einmal im Monat ein Shiny.

- **Unabhängig von der Seltenheit:** Auch ein Common kann Shiny sein. Ein Legendary in Öl ist die Krone.
- **Fair:** Kein Schutz vor Pech, nichts zu kaufen. Nur Optik, keine besseren Werte.
- **Überall sichtbar:** Sammlung, Deck, Klecks auf dem Duell-Blatt, Ziehen.
- **Beim Ziehen:**
  - Nach dem W100 fürs Papier rollt der Hand-Wurf.
  - Bei 100 hält das Bild an, der Pinsel wechselt das Werkzeug und malt den Klecks im neuen Stil neu.
  - Dazu ein eigener Klang und Glitzern.
- **Am Handy schnell genug:** Das Stilbild wird einmal gemalt und zwischengespeichert. Öl ist am teuersten.

## 4. Benennen ohne Tagespost

**Heute:** Die Art wird in den Kommentaren des Tagesposts benannt. Das fällt mit dem Tagespost weg.

**Vorschlag „What do you see?“:**

- Ziehst du eine Art, die noch keinen Namen hat, kannst du deinen Klecks mit einem Tipp als Post teilen.
- Die Kommentare schlagen Namen vor. Nach 24 Stunden wird der Kommentar mit den meisten Stimmen der Name der Art für alle.
- Wie bisher: Der erste Name bleibt, jeden Namen gibt es nur einmal.
- Du und der Namensgeber bekommt je 50 Pigment. Das sind die 50, die bisher das Fangen gab.

So bleibt der Rorschach-Kern, jeder Post zeigt ein einzigartiges Monster, und die Community bekommt eigene Posts von Spielern.

## Reihenfolge

Jeder Schritt endet mit Upload und Handy-Test.

1. **Einzigartig:** Tagesklecks, Fangen und Tagespost raus, Seed-Register, Seriennummer, Doppelte behalten, Auswaschen.
2. **Vielfalt:** zuerst der Entwurfsbogen (Generation 1 gegen 2), nach Freigabe einbauen.
3. **Seltene Stile:** Hand-Wurf, fünf Stile im Renderer, Stilwechsel beim Ziehen, Anzeige im Duell.
4. **Benennen** mit „What do you see?“.

## Fragen

1. Tagespost ganz weg, der Spiel-Post bleibt Einstieg? Empfehlung: ja. Alternative: Ein Tagespost bleibt als Treffpunkt, aber jeder zieht dort sein eigenes Monster.
2. Das alte Malblatt aus dem MVP (Bogen mit Lasieren und Trockenzeit) aus dem Post nehmen? Empfehlung: ja, gelasiert wird an den Würfeln. Der Code bleibt für später liegen.
3. Doppelte Art: jedes Monster behalten und Lasur durch bewusstes Auswaschen (Empfehlung), oder wie heute automatisch zu Lasur?
4. Shiny-Chance 1 zu 100 mit der Verteilung oben: passt das, oder seltener oder häufiger?
5. Gefallen die fünf Stile im Entwurf? Was soll anders werden? Illustration als Bestiarium-Tafel, oder lieber wie ein Kinderbuch?
6. Die bisherigen Würfel bleiben Generation 1 und sehen aus wie jetzt (Empfehlung), oder die Sammlung einmal zurücksetzen?
7. Benennen per „What do you see?“-Post mit je 50 Pigment für dich und den Namensgeber: ja?
