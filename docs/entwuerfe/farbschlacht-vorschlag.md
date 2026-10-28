# Vorschlag: Farbschlacht, der Kampf anders

Stand 28.10.2026, Fassung 4. Spielbarer Prototyp: https://claude.ai/artifact/TESUwotnDooSiEZMuwoPQ2 (Quelle tools/mockup/farbschlacht4.ts, ältere Fassungen in farbschlacht.ts, farbschlacht2.ts und farbschlacht3.ts). Bilder: docs/entwuerfe/farbschlacht-wuerfel-entwurf.png (Fassung 4) und farbschlacht-entwurf.png (Fassung 3). Nichts davon ist im Spiel. Fragen am Ende.

## Rückmeldungen bisher

- Fassung 1 (nur Stempeln): „Fühlt sich ok an, aber ist noch sehr simpel.“
- Fassung 2 (Monster auf dem Blatt, Spritzer): „Besser, aber der Rivale ist zu stark und es fehlen noch Fähigkeiten usw.“
- Fassung 3 (Fähigkeiten, Eigenschaften, Zweitfarbe, Rivale in drei Stufen): „Würde gern auch Würfel einbauen, so wie bei Dungeon Dice Monsters.“

## Neu in Fassung 4: Würfel wie bei Dungeon Dice Monsters

| Dungeon Dice Monsters | Before It Dries |
|---|---|
| Jedes Monster ist ein Würfel | Jeder Klecks ist ein Würfel, seine Seiten kommen aus seinen Werten |
| 15 Würfel im Pool, 3 pro Zug werfen | 6 Würfel im Beutel, 3 pro Zug werfen |
| Beschwörungssymbole mit Stufe | Sterne ★ mit Stufe |
| Würfel klappt als Netz aufs Spielfeld und wird zum Weg | Würfel klappt als Netz aus sechs Feldern nasser Farbe aufs Blatt |
| Monster laufen nur auf dem Weg | Kleckse bewegen sich nur durch Farbe, blankes Papier ist eine Wand |
| Symbole Bewegung, Angriff, Verteidigung, Magie, Falle | Step, Splash, Guard, Glow, Brush |
| Monster Lord mit 3 Herzen | Palette mit 3 Herzen |

**Der Würfel jedes Kleckses ist einzigartig.** Die Sternseiten hängen von der Stufe ab, die übrigen Seiten werden nach seinen Werten verteilt: Fluss gibt Step, Deckkraft gibt Brush, Sättigung gibt Splash, Körnung gibt Guard, Leuchten gibt Glow. Ist der stärkste Wert 30 oder mehr, ist eine Seite doppelt (×2). Die Karte zeigt den Würfel als Netz, genau so klappt er auf das Blatt. Jeder Bauplan hat eines der elf Würfelnetze.

## Idee

Ein Malduell, in dem die Monster selbst auf dem Blatt stehen. Farbe ist Gelände und Weg, Spritzer sind Angriffe, Deckkraft ist Lebenskraft. Die Würfel entscheiden, was man in einem Zug tun kann, und bringen neue Kleckse aufs Blatt. Gewonnen wird auf zwei Wegen: die Palette des Rivalen dreimal treffen, oder mehr Papier bedecken, wenn es trocknet.

## Regeln im Prototyp

- **Blatt:** 7 × 9 Felder, 8 Runden, abwechselnd ein Zug. Jede Seite hat ihre Palette (3 Herzen) in der Mitte ihres Randes, darum ein kleiner Fleck eigener Farbe.
- **Beutel:** 6 Würfel. Die zwei schwächsten sind Stufe 1, die zwei mittleren Stufe 2, die zwei stärksten Stufe 3. Sternseiten: Stufe 1 und 2 haben drei, Stufe 3 hat zwei.
- **Eröffnung:** Jede Seite klappt einen Klecks ihrer Wahl kostenlos auf.
- **Ein Zug:**
  1. **Würfeln:** drei Würfel wählen und werfen. Symbole kommen in den eigenen Vorrat und bleiben dort (höchstens 9 je Sorte).
  2. **Beschwören:** Ein Würfel aus dem Beutel mit Stern darf aufklappen, wenn die Sterne der anderen geworfenen Würfel zusammen mindestens seine Stufe ergeben. Das Netz muss die eigene Farbe berühren und darf nur auf blankes Papier oder eigene Farbe. Es wird zu sechs Feldern nasser Farbe, der Klecks steht darauf. Höchstens drei Kleckse auf dem Blatt.
  3. **Handeln:** Jeder Klecks auf dem Blatt darf sich einmal bewegen (1 Step) und einmal handeln.
- **Handeln, fünf Möglichkeiten:**
  - **Dry** (1 Brush): Stempel in Form des Bauplans, malt über getrocknete Farbe (Deckkraft + W20 gegen Körnung + W20).
  - **Wet** (1 Brush, 1 Wasser): Stempel, bleibt 2 Runden nass und verläuft in freies Papier, perlt aber von trockener Farbe ab. Nasse Gegenfarbe wird zu Schlamm.
  - **Splash** (1 Splash): trifft einen gegnerischen Klecks in Reichweite: Sättigung + W20 gegen Körnung + W20. Gegenfarbe × 1,5 und Fleck, harmonische Farbe × 0,75. Wer direkt neben der gegnerischen Palette steht, kann sie treffen: immer ein Herz.
  - **Fähigkeit** (2 Glow, mit Fingerabdruck 1): siehe Tabelle.
  - **Soak** (frei): heilt (am meisten auf eigener nasser Farbe), wäscht Flecken aus, gibt 1 Wasser.
- **Guard:** Liegt ein Guard im Vorrat, halbiert er von selbst den nächsten Spritzertreffer.
- **Ausweichen und Krit:** jeder Spritzer kann ausweichen (Fluss / 400, höchstens 40 %). Eine natürliche 20 ist ein kritischer Treffer (× 1,5), Salz erhöht die Chance.
- **Wege:** Kleckse bewegen sich nur durch Farbe. Eigene Farbe kostet 1, fremde 2, Schlamm hält fest. Flutterer fliegen und Hopper springen auch über blankes Papier.
- **Boden wirkt:** auf eigener nasser Farbe +1 Reichweite und +1 Deckkraft je Runde. In nasser Gegenfarbe −2 je Runde.
- **Ausgewaschen:** Ein ausgewaschener Klecks verliert seinen Würfel für immer, man wirft künftig mit weniger Würfeln. Wer keinen Würfel mehr hat, verliert.
- **Der Radierer:** nach Runde 3 und 6 wischt er eine Zeile und streift Kleckse darin (−4). Lichtechtheit rettet.
- **Ende:** Palette ohne Herzen, oder nach 8 Runden mehr Felder (jedes übrige Herz zählt 3 dazu).
- Alle Würfe stehen offen im Protokoll, vor jedem Zug zeigt das Blatt Chancen und Schaden.

## Bewusste Abweichungen von Dungeon Dice Monsters

- 6 statt 15 Würfel, damit ein Duell in 8 Runden passt.
- Beschwören über die Summe der Sterne statt zwei gleiche Stufen. Sonst bliebe der zweite Würfel einer Stufe für immer im Beutel.
- Würfel von Klecksen, die schon auf dem Blatt stehen, werfen weiter mit (für Symbole und als Sterne für andere).
- Ein Step zahlt einen ganzen Weg, nicht jedes einzelne Feld.
- Brush statt Fallen: Stempeln ist das Gelände dieses Spiels.
- Guard wird von selbst ausgegeben, damit man im Zug des Rivalen nichts antippen muss.

## Bauplan: Gangart, Würfelnetz und Fähigkeit

| Bauplan | Gangart | Fähigkeit |
|---|---|---|
| Crawler | zieht eine trockene Spur | **Seep:** eigene Farbe in der Nähe wird wieder nass und verläuft in alles freie Papier daneben |
| Flutterer | fliegt, auch über blankes Papier | **Gust:** Gegner im Umkreis 2 werden ein Feld weggeweht und verlieren 3 |
| Floater | schwebt über Schlamm | **Rain:** Regen auf 3 × 3 Felder in Reichweite 3, eigene Farbe wird nass, trockene Gegnerfarbe weich |
| Quadruped | läuft einen Schritt weiter | **Charge:** Sprint in gerader Linie auf einen Gegner bis 4 Felder, Spritzer × 1,5 mit +4 auf den Wurf |
| Serpent | gleitet durch eigene Farbe fast umsonst | **Coil:** umschlingt einen Nachbarn: −4, Fleck, er kann im nächsten Zug nicht ziehen |
| Tower | bewegt sich nie, malt und spritzt weiter | **Bastion:** ganzes Team +5 auf Abwehrwürfe für zwei Runden |
| Crab | +3 Spritzschaden aus nächster Nähe | **Crush:** zerquetscht einen Nachbarn, Körnung zählt nicht, doppelter Schaden |
| Jelly | tropft eine nasse Spur | **Drift:** treibt zu einem eigenen nassen Feld und befleckt jeden Gegner daneben |
| Hopper | springt zwei Felder, auch auf Papier | **Bound:** Sprung auf ein freies Feld bis 4 weit, stempelt bei der Landung |
| Tuber | weicht doppelt so gut ein | **Sprout:** ganzes Team +6, die Farbe unter ihnen wird nass |
| Radiant | spritzt zwei Felder weit | **Flare:** nasse Farbe in alle 8 Nachbarfelder, Spritzer × 0,6 auf jeden Gegner daneben |
| Twinhead | spritzt zweimal mit zwei Köpfen | **Howl:** Rivale verliert 2 Wasser und 1 Glow, Gegner im Umkreis 2 verlieren 3 |

Jeder Bauplan hat ein eigenes Würfelnetz (elf Netze, Twinhead teilt seines mit Flutterer).

## Eigenschaften aus dem Monster

| Herkunft | Wirkung |
|---|---|
| Salz | Krit +8 % |
| Alkohol | Ausweichen +6 % |
| Blüte Rebloomer | heilt 1 je Runde |
| Blüte Edge Runner | nasse Stempel +2 |
| Blüte Dry Edge | trockene Stempel +2 |
| Blüte Absorbent | nimmt 15 % weniger Schaden |
| Blüte Tide Mark | Ausweichen +5 % |
| Fingerabdruck | Fähigkeit kostet nur 1 Glow |
| Phthalo (staining) | Spritzer beflecken immer |
| Opera (fugitive) | verblasst 1 je Runde, +2 Schaden |
| Granulierend (Ultramarin, Siena) | eigene trockene Farbe +2 schwerer zu übermalen |

**Zweitfarbe:** Hat ein Klecks ein Nebenpigment, wählt man vor dem Malen oder Spritzen die Farbe. Die zweite Farbe ist um 1 schwächer, lohnt sich aber, wenn die Hauptfarbe zum Ziel harmonisch ist oder nasse Gegenfarbe zu Schlamm werden soll.

## Rivale in drei Stufen

| Stufe | bedenkt | Lebenskraft | Sättigung, Deckkraft, Körnung | Startwasser |
|---|---|---|---|---|
| Apprentice | 3 zufällige Züge, Würfel zufällig | × 0,7 | × 0,65 | 1 |
| Journeyman | 15 zufällige Züge | × 0,85 | × 0,85 | 2 |
| Master | alle | voll | voll | 3 (wie du) |

**Simulation**, je 200 Duelle mit zufälligen Beuteln. Die Spielerseite spielt dabei als Computer, einmal stark (bedenkt jeden Zug), einmal schwach (bedenkt 4 zufällige Züge). Siege des Spielers:

| Spieler | gegen Apprentice | gegen Journeyman | gegen Master |
|---|---|---|---|
| stark | 84 % | 66 % | 48 % |
| schwach | 66 % | 38 % | 27 % |

## Was die Simulation noch zeigt

- **Die Palette entscheidet oft:** 34 bis 55 % der Duelle enden mit einer zerbrochenen Palette, der Rest beim Trocknen.
- **Beschwörungen:** pro Seite und Duell 2,3 bis 2,9 Kleckse auf dem Blatt (mit Eröffnung).
- **Kleckse fallen selten:** 0,1 bis 0,3 pro Duell. Wenn doch, kostet es jetzt einen Würfel.
- **Fähigkeiten:** etwa einmal pro Duell und Seite, seltener als in Fassung 3, weil Glow auch aus den Würfeln kommen muss.
- Ein Duell dauert etwa 7 Würfe pro Seite.

## Warum das nicht Standard ist

- Jeder Würfel entsteht aus einem gemalten Monster und ist deshalb einzigartig. Sein Netz ist zugleich die Form, die es aufs Blatt bringt.
- Lebenspunkte sind Deckkraft: Getroffene Kleckse verblassen auf dem Blatt.
- Das Spielfeld entsteht im Kampf: aufgeklappte Würfel und Stempel bauen Wege, Heilstellen und Fallen (nasse Gegenfarbe).
- Typen ergeben sich aus echter Farbmischung: Gegenfarben trüben sich und hinterlassen Flecken.
- Was beim Malen des Monsters passiert ist (Salz, Blüten, Fingerabdruck), wirkt im Kampf.
- Zwei Siegwege: die Palette treffen oder Papier gewinnen.
- „Before it dries“ ist der Takt: nasse Farbe verläuft, trockene hält, nach 8 Runden trocknet alles.

## Wie es ins Spiel passen könnte

- **Würfel als Sammelobjekt:** Wer einen Klecks fängt, bekommt seinen Würfel. Lasuren könnten Seiten verändern, Mutationen das Netz.
- **Tagesduell:** gleiches Blatt und gleicher Rivale für alle, Bestenliste.
- **Herausforderung als Post:** dein Beutel wird zum Rivalen für andere (Posts von Spielern).
- **Gemeinschaftsblatt:** gewonnene Duelle malen ein Stück des großen Blatts im Subreddit, der Radierer nimmt nachts Stücke weg.
- **Wöchentlich** der Riesenklecks des Radierers als Gegner für alle.
- **Mit dem Atelier (Konzept Fassung 2):** Wesen aus dem Atelier sind die Würfel. Der Stil könnte eine Würfelseite oder Fähigkeit bringen, z. B. Pastell streut, Linocut druckt doppelt, Rorschach spiegelt das Netz.

## Fragen

1. Fühlen sich die Würfel nach Dungeon Dice Monsters an? Was fehlt dir davon (z. B. Fallen, mehr Würfel, Bewegung pro Feld)?
2. Beutel mit 6 Würfeln, höchstens 3 Kleckse auf dem Blatt: passt das zur Festlegung „Team aus 3“?
3. Die Palette entscheidet etwa jedes zweite Duell. Gut so, oder soll das Papier wichtiger sein?
4. Sollen Würfel von Klecksen auf dem Blatt weiter mitwürfeln dürfen (Abweichung von Dungeon Dice Monsters)?
5. Würfel als Sammelobjekt, das sich durch Lasuren verändert: Interesse?
6. Ist das zusammen mit Fähigkeiten, Eigenschaften und Zweitfarbe zu viel auf einmal? Was würdest du streichen?
7. Gegen wen: Tagesrivale für alle gleich, andere Spieler (asynchron), oder beides?
