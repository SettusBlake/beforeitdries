# Vorschlag: Farbschlacht, der Kampf anders

Stand 28.10.2026, Fassung 3. Spielbarer Prototyp: https://claude.ai/artifact/TESUwotnDooSiEZMuwoPQ2 (Quelle tools/mockup/farbschlacht3.ts, ältere Fassungen in farbschlacht.ts und farbschlacht2.ts). Bild: docs/entwuerfe/farbschlacht-entwurf.png. Nichts davon ist im Spiel. Fragen am Ende.

## Rückmeldungen bisher

- Fassung 1 (nur Stempeln): „Fühlt sich ok an, aber ist noch sehr simpel.“
- Fassung 2 (Monster auf dem Blatt, Spritzer): „Besser, aber der Rivale ist zu stark und es fehlen noch Fähigkeiten usw.“

## Neu in Fassung 3

- **Rivale in drei Stufen** (Apprentice, Journeyman, Master), oben wählbar, die Wahl bleibt gespeichert. Standard ist Apprentice. Per Simulation abgestimmt (siehe unten).
- **Eine Fähigkeit je Bauplan**, aufgeladen über Leuchten (goldener Ring um den Klecks).
- **Eigenschaften aus dem Monster wirken im Duell:** Salz, Alkohol, Blüten, Fingerabdruck, Pigmente.
- **Zweitfarbe:** Kleckse mit Nebenpigment malen und spritzen wahlweise in ihrer zweiten Farbe.
- **Ausweichen und kritische Treffer** bei jedem Spritzer.
- **Rivalen lesen:** Antippen eines gegnerischen Kleckses zeigt Gangart, Fähigkeit, Ladung und Eigenschaften.

## Idee

Ein Malduell, in dem die Monster selbst auf dem Blatt stehen. Farbe ist Gelände, Spritzer sind Angriffe, Deckkraft ist Lebenskraft. Gewonnen wird auf zwei Wegen: alle Gegner auswaschen, oder mehr Papier bedecken, wenn es trocknet.

## Regeln im Prototyp

- **Blatt:** 7 × 9 Felder, 8 Runden, abwechselnd ein Zug. Jedes Team hat drei Kleckse, die auf dem Blatt stehen.
- **Ein Zug:** ein Klecks bewegt sich (oder bleibt), dann handelt er. Danach trocknet er und ruht einen Zug.
- **Farbe ist Gelände:** freies Papier und eigene Farbe kosten 1 Schritt, fremde Farbe 2, Schlamm hält fest. Reichweite aus Fluss.
- **Handeln, fünf Möglichkeiten:**
  - **Dry:** Stempel in Form des Bauplans, malt über getrocknete Farbe (Deckkraft + W20 gegen Körnung + W20).
  - **Wet** (1 Wasser): Stempel, bleibt 2 Runden nass und verläuft in freies Papier, perlt aber von trockener Farbe ab. Nasse Gegenfarbe wird zu Schlamm.
  - **Splash:** trifft einen gegnerischen Klecks in Reichweite: Sättigung + W20 gegen Körnung + W20. Schaden nimmt Deckkraft, der Klecks verblasst sichtbar. Gegenfarbe × 1,5 und Fleck (2 Runden je 2 Schaden), harmonische Farbe × 0,75.
  - **Soak:** heilt (am meisten auf eigener nasser Farbe), wäscht Flecken aus, gibt 1 Wasser.
  - **Fähigkeit:** sobald der goldene Ring voll ist, siehe Tabelle.
- **Ausweichen und Krit:** jeder Spritzer kann ausweichen (Fluss / 400, höchstens 40 %). Eine natürliche 20 ist ein kritischer Treffer (× 1,5), Salz erhöht die Chance.
- **Boden wirkt:** auf eigener nasser Farbe +1 Reichweite, +1 Deckkraft und +10 Ladung je Runde. In nasser Gegenfarbe −2 je Runde.
- **Der Radierer:** nach Runde 3 und 6 wischt er eine Zeile und streift Kleckse darin (−4). Lichtechtheit rettet.
- **Ende:** alle Gegner ausgewaschen, oder nach 8 Runden mehr Felder (jeder stehende Klecks zählt 3 dazu).
- Alle Würfe stehen offen im Protokoll, vor jedem Zug zeigt das Blatt Chancen und Schaden.

## Bauplan: Gangart und Fähigkeit

Ladung: Start 40, jede Handlung +30 plus Leuchten, voll bei 100. Nach der Fähigkeit beginnt sie wieder bei 0.

| Bauplan | Gangart | Fähigkeit |
|---|---|---|
| Crawler | zieht eine trockene Spur | **Seep:** eigene Farbe in der Nähe wird wieder nass und verläuft in alles freie Papier daneben |
| Flutterer | fliegt über Farbe und Schlamm | **Gust:** Gegner im Umkreis 2 werden ein Feld weggeweht und verlieren 3 |
| Floater | schwebt über Schlamm | **Rain:** Regen auf 3 × 3 Felder in Reichweite 3, eigene Farbe wird nass, trockene Gegnerfarbe weich |
| Quadruped | läuft einen Schritt weiter | **Charge:** Sprint in gerader Linie auf einen Gegner bis 4 Felder, Spritzer × 1,5 mit +4 auf den Wurf |
| Serpent | gleitet durch eigene Farbe fast umsonst | **Coil:** umschlingt einen Nachbarn: −4, Fleck, er kann im nächsten Zug nicht ziehen |
| Tower | bewegt sich nie, malt und spritzt weiter | **Bastion:** ganzes Team +5 auf Abwehrwürfe für zwei Runden |
| Crab | +3 Spritzschaden aus nächster Nähe | **Crush:** zerquetscht einen Nachbarn, Körnung zählt nicht, doppelter Schaden |
| Jelly | tropft eine nasse Spur | **Drift:** treibt zu einem eigenen nassen Feld und befleckt jeden Gegner daneben |
| Hopper | springt zwei Felder, über alles | **Bound:** Sprung auf ein freies Feld bis 4 weit, stempelt bei der Landung |
| Tuber | weicht doppelt so gut ein | **Sprout:** ganzes Team +6, die Farbe unter ihnen wird nass |
| Radiant | spritzt zwei Felder weit | **Flare:** nasse Farbe in alle 8 Nachbarfelder, Spritzer × 0,6 auf jeden Gegner daneben |
| Twinhead | spritzt zweimal mit zwei Köpfen | **Howl:** Gegner verliert 2 Wasser, Gegner im Umkreis 2 verlieren 3 und 30 Ladung |

## Eigenschaften aus dem Monster

Sie stehen schon jetzt in den Monsterdaten (Malereignisse, Pigmente) und bekommen im Duell eine Wirkung. Auf der Karte als kleine Marken.

| Herkunft | Wirkung |
|---|---|
| Salz | Krit +8 % |
| Alkohol | Ausweichen +6 % |
| Blüte Rebloomer | heilt 1 je Runde |
| Blüte Edge Runner | nasse Stempel +2 |
| Blüte Dry Edge | trockene Stempel +2 |
| Blüte Absorbent | nimmt 15 % weniger Schaden |
| Blüte Tide Mark | Ausweichen +5 % |
| Fingerabdruck | lädt doppelt so schnell |
| Phthalo (staining) | Spritzer beflecken immer |
| Opera (fugitive) | verblasst 1 je Runde, +2 Schaden |
| Granulierend (Ultramarin, Siena) | eigene trockene Farbe +2 schwerer zu übermalen |

**Zweitfarbe:** Hat ein Klecks ein Nebenpigment, wählt man vor dem Malen oder Spritzen die Farbe. Die zweite Farbe ist um 1 schwächer, lohnt sich aber, wenn die Hauptfarbe zum Ziel harmonisch ist oder nasse Gegenfarbe zu Schlamm werden soll.

## Rivale in drei Stufen

Der Rivale bewertet seine möglichen Züge. Die Stufe legt fest, wie viele er bedenkt und wie stark seine Kleckse sind. Seine Fähigkeit vergisst er auf keiner Stufe, damit man sie sieht.

| Stufe | bedenkt | Lebenskraft | Sättigung, Deckkraft, Körnung | Startwasser |
|---|---|---|---|---|
| Apprentice | 3 zufällige Züge | × 0,7 | × 0,65 | 1 |
| Journeyman | 15 zufällige Züge | × 0,85 | × 0,85 | 2 |
| Master | alle | voll | voll | 3 (wie du) |

Fassung 2 entsprach dem Master.

**Simulation**, je 200 Duelle mit zufälligen Teams. Die Spielerseite spielt dabei als Computer, einmal stark (bedenkt jeden Zug), einmal schwach (bedenkt 4 zufällige Züge). Siege des Spielers:

| Spieler | gegen Apprentice | gegen Journeyman | gegen Master |
|---|---|---|---|
| stark | 91 % | 69 % | 57 % |
| schwach | 60 % | 35 % | 20 % |

Fähigkeiten kommen ein- bis zweimal pro Duell und Seite zum Einsatz.

## Was die Simulation noch zeigt

- **Auswaschen bringt wenig.** Ein Team zieht einmal pro Zug, egal wie viele Kleckse noch stehen. Ein ausgewaschener Klecks kostet also nur 3 Punkte. Es fallen 0,2 bis 0,8 Kleckse pro Duell, ein ganzes Team fast nie.
- **Krits können hart sein:** Gegenfarbe und Krit ergeben × 2,25 (im Testlauf −18 auf einen Schlag).
- **Der erste Zug hilft:** Bei gleich starken Seiten gewinnt der Anziehende etwa 57 %.

## Warum das nicht Standard ist

- Lebenspunkte sind Deckkraft: Getroffene Kleckse verblassen auf dem Blatt.
- Das Spielfeld entsteht im Kampf: Wer malt, baut sich Wege, Heilstellen und Fallen (nasse Gegenfarbe).
- Typen ergeben sich aus echter Farbmischung: Gegenfarben trüben sich und hinterlassen Flecken.
- Jeder Bauplan hat Stempel, Gangart und Fähigkeit. Eine Mutation ändert alles drei.
- Was beim Malen des Monsters passiert ist (Salz, Blüten, Fingerabdruck), wirkt im Kampf. Dadurch kämpft jedes Exemplar anders.
- Zwei Siegwege: angreifen oder Papier gewinnen.
- „Before it dries“ ist der Takt: nasse Farbe verläuft, trockene hält, nach 8 Runden trocknet alles.

## Wie es ins Spiel passen könnte

- **Tagesduell:** gleiches Blatt und gleicher Rivale für alle, Bestenliste.
- **Herausforderung als Post:** dein Team wird zum Rivalen für andere (Posts von Spielern).
- **Gemeinschaftsblatt:** gewonnene Duelle malen ein Stück des großen Blatts im Subreddit, der Radierer nimmt nachts Stücke weg.
- **Wöchentlich** der Riesenklecks des Radierers als Gegner für alle.
- **Mit dem Atelier (Konzept Fassung 2):** Wesen aus dem Atelier sind die Kämpfer. Der Stil könnte eine Fähigkeit bringen, z. B. Pastell streut, Linocut druckt doppelt, Rorschach spiegelt den Stempel.

## Fragen

1. Ist der Apprentice jetzt schlagbar? Soll er der Standard bleiben?
2. Fähigkeiten: passt die Menge (ein- bis zweimal pro Duell)? Welche gefallen dir, welche nicht?
3. Soll Auswaschen mehr bringen, z. B. der Gegner verliert einen Zug oder Wasser, oder jeder stehende Klecks zählt 5 statt 3?
4. Sind die Eigenschaften auf den Karten zu viel Kleinkram, oder genau das, was jedes Monster einzigartig macht?
5. Krits mit × 2,25: spannend oder zu zufällig?
6. Gegen wen: Tagesrivale für alle gleich, andere Spieler (asynchron), oder beides?
7. Soll der Stil eine eigene Fähigkeit im Duell bringen?
