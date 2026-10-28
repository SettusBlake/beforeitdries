# Vorschlag: Farbschlacht, der Kampf anders

Stand 28.10.2026, Fassung 5 mit Seltenheiten und Sammlung. Im Reddit-Playtest spielbar (Knopf „Duel“ im Post), Quelle src/shared/duel (Regeln), src/shared/dice.ts (Seltenheiten), src/server/duel.ts und dice.ts (Server), src/client/duel.ts und duel/collection.ts (Bedienung). Die animierte Fassung 4 liegt weiter unter https://claude.ai/artifact/TESUwotnDooSiEZMuwoPQ2 (Quelle tools/mockup/duel). Bilder: docs/entwuerfe/wuerfel-gacha.png, farbschlacht-spiel-entwurf.png, farbschlacht-wuerfel-entwurf.png, farbschlacht-entwurf.png. Fragen am Ende.

## Rückmeldungen bisher

- Fassung 1 (nur Stempeln): „Fühlt sich ok an, aber ist noch sehr simpel.“
- Fassung 2 (Monster auf dem Blatt, Spritzer): „Besser, aber der Rivale ist zu stark und es fehlen noch Fähigkeiten usw.“
- Fassung 3 (Fähigkeiten, Eigenschaften, Zweitfarbe, Rivale in drei Stufen): „Würde gern auch Würfel einbauen, so wie bei Dungeon Dice Monsters.“
- Fassung 4 (Würfel): „Ist irgendwie cool jetzt.“
- Animierte Fassung 4: Gefühl ok, aber unverständlich (warum man sich nicht bewegen kann), vielleicht zu lang für Reddit, Grafik muss viel besser werden.

## Neu in Fassung 5

- **Im Reddit-Spiel:** Der Server prüft und würfelt jede Aktion, der Client spielt nur die Ereignisse ab. Das Duell bleibt gespeichert und lässt sich fortsetzen.
- **Bewegen ist frei:** Jeder Klecks darf sich einmal pro Zug bewegen. Ein Step im Vorrat lässt einen Klecks 2 weiter gehen (helle grüne Punkte).
- **Blankes Papier ist begehbar,** kostet aber 2. Eigene Farbe bleibt der schnelle Weg.
- **Quick duel:** Blatt 7 × 7 statt 7 × 9, 6 Runden statt 8, der Radierer kommt nach Runde 2 und 4.
- **Palette bewacht (freigegeben am 28.10.2026):** Eine Palette kann nicht getroffen werden, solange ein eigener Klecks direkt daneben steht.
- **Sepia zeigt den nächsten Schritt:** Ein goldener Ring markiert, was sie tun würde. Im Menü abschaltbar.
- **Lern-Duell (festgelegt am 28.10.2026):** fester Seed, feste Beutel und feste Würfe. In den ersten drei Runden ist nur Sepias Schritt antippbar, sie erklärt jeden Teil, sobald er dran ist.

## Neu: Seltenheiten und Sammlung

- **Seltenheit kommt vom Papier:** Student Paper Common, Drawing Paper Uncommon, Handmade Paper Rare, Cotton Rag Epic. Legendary sind die seltenen Papiere Washi (lange Maulbeerfasern) und Vellum (Blattgold-Flocken). Sie werden nur beim Ziehen vergeben, das Aussehen aller bisherigen Kleckse bleibt gleich.
- **Was die Seltenheit am Würfel ändert:**

| Seltenheit | W100 | Würfel |
|---|---|---|
| Common | 1 bis 50 | sechs Seiten aus den Werten |
| Uncommon | 51 bis 80 | ein Symbol doppelt |
| Rare | 81 bis 95 | dazu ein Joker |
| Epic | 96 bis 99 | dazu ein weiteres Symbol doppelt |
| Legendary | 100 | dazu eine Gold-Seite |

- **Joker:** zählt beim Beschwören als Stern beliebiger Stufe, oder man nimmt ihn als ein Symbol nach Wahl (dann wird in diesem Zug nicht mehr beschworen).
- **Gold:** gibt je ein Symbol jeder Sorte.
- **Ziehen („Dip the brush“):** ein Tropfen fällt, der W100 wird offen gewürfelt, die Grenzen stehen darunter, dann blüht der Klecks auf. Alle Würfe am Server.
  - Neu: 6 freie Startzüge, immer verschiedene Arten. Wer gleich ein Duell startet, bekommt sie automatisch.
  - Einmal am Tag ein freier Zug (UTC).
  - Ein Zug kostet 100 Pigment, ein Zehnerzug 1000 mit mindestens einem Rare.
  - Schutz vor Pech: spätestens jeder 10. Zug Rare oder besser, jeder 40. Epic, nach 90 Zügen Legendary. Die Zähler stehen auf dem Bildschirm.
- **Pigment** nur durchs Spielen: Sieg 60, Unentschieden 40, Niederlage 25 (höchstens 5 belohnte Duelle am Tag), Lern-Duell einmal 200, Tagesklecks fangen 50.
- **Doppelte Art** (gleicher Bauplan und Hauptpigment, nicht seltener als die eigene) wird Lasur für diese Art: Common 1, Uncommon 2, Rare 3, Epic 5, Legendary 10. Ein seltenerer Doppelter bleibt ein neuer Würfel.
- **Lasur auf Würfelseiten:** 3 Lasur machen ein einfaches Symbol doppelt. So verändert sich ein Würfel durch Lasuren (festgelegt am 28.10.2026).
- **Beutel:** 6 Würfel aus der Sammlung. Auf der Karte „Put in bag“ tippen, dann den Platz, den er ersetzen soll.

## Idee

Ein Malduell, in dem die Monster selbst auf dem Blatt stehen. Farbe ist Gelände und Weg, Spritzer sind Angriffe, Deckkraft ist Lebenskraft. Die Würfel entscheiden, was man in einem Zug tun kann, und bringen neue Kleckse aufs Blatt. Gewonnen wird auf zwei Wegen: die Palette des Rivalen dreimal treffen, oder mehr Papier bedecken, wenn es trocknet.

## Würfel wie bei Dungeon Dice Monsters

| Dungeon Dice Monsters | Before It Dries |
|---|---|
| Jedes Monster ist ein Würfel | Jeder Klecks ist ein Würfel, seine Seiten kommen aus seinen Werten |
| 15 Würfel im Pool, 3 pro Zug werfen | 6 Würfel im Beutel, 3 pro Zug werfen |
| Beschwörungssymbole mit Stufe | Sterne ★ mit Stufe |
| Würfel klappt als Netz aufs Spielfeld und wird zum Weg | Würfel klappt als Netz aus sechs Feldern nasser Farbe aufs Blatt |
| Monster laufen auf dem Weg | Eigene Farbe ist der schnelle Weg, Papier kostet doppelt |
| Symbole Bewegung, Angriff, Verteidigung, Magie, Falle | Step, Splash, Guard, Glow, Brush |
| Monster Lord mit 3 Herzen | Palette mit 3 Herzen |

**Der Würfel jedes Kleckses ist einzigartig.** Die Sternseiten hängen von der Stufe ab, die übrigen Seiten werden nach seinen Werten verteilt: Fluss gibt Step, Deckkraft gibt Brush, Sättigung gibt Splash, Körnung gibt Guard, Leuchten gibt Glow. Ist der stärkste Wert 30 oder mehr, ist eine Seite doppelt (×2). Die Karte zeigt den Würfel als Netz, genau so klappt er auf das Blatt. Jeder Bauplan hat eines der elf Würfelnetze.

## Regeln

- **Blatt:** 7 × 7 Felder, 6 Runden, abwechselnd ein Zug. Jede Seite hat ihre Palette (3 Herzen) in der Mitte ihres Randes, darum ein kleiner Fleck eigener Farbe.
- **Beutel:** 6 Würfel aus der eigenen Sammlung. Die Stufe kommt aus der Stärke des Kleckses (Summe der fünf Kampfwerte): unter 110 Stufe 1, unter 123 Stufe 2, sonst Stufe 3. Sternseiten: Stufe 1 und 2 haben drei, Stufe 3 hat zwei. Der Rivale bekommt 6 zufällige Würfel, auch mit Seltenheiten.
- **Eröffnung:** Jede Seite klappt einen Klecks ihrer Wahl kostenlos auf.
- **Ein Zug:**
  1. **Würfeln:** drei Würfel wählen und werfen. Symbole kommen in den eigenen Vorrat und bleiben dort (höchstens 9 je Sorte). Zum Start liegen 1 Step und 2 Brush im Vorrat.
  2. **Beschwören:** Ein Würfel aus dem Beutel mit Stern (oder Joker) darf aufklappen, wenn die Sterne der anderen geworfenen Würfel zusammen mindestens seine Stufe ergeben. Ein Joker zählt als Stern beliebiger Stufe. Das Netz muss die eigene Farbe berühren und darf nur auf blankes Papier oder eigene Farbe. Es wird zu sechs Feldern nasser Farbe, der Klecks steht darauf. Höchstens drei Kleckse auf dem Blatt.
  3. **Handeln:** Jeder Klecks auf dem Blatt darf sich einmal bewegen und einmal handeln.
- **Bewegen:** Eigene Farbe kostet 1, blankes Papier, fremde Farbe und Schlamm kosten 2, im Schlamm bleibt man stehen. Die Reichweite kommt aus Fluss (2 bis 5). Ein Step im Vorrat erlaubt 2 mehr und wird nur verbraucht, wenn man die zusätzliche Reichweite nutzt.
- **Handeln, fünf Möglichkeiten:**
  - **Dry** (1 Brush): Stempel in Form des Bauplans, malt über getrocknete Farbe (Deckkraft + W20 gegen Körnung + W20).
  - **Wet** (1 Brush, 1 Wasser): Stempel, bleibt 2 Runden nass und verläuft in freies Papier, perlt aber von trockener Farbe ab. Nasse Gegenfarbe wird zu Schlamm.
  - **Splash** (1 Splash): trifft einen gegnerischen Klecks in Reichweite: Sättigung + W20 gegen Körnung + W20. Gegenfarbe × 1,5 und Fleck, harmonische Farbe × 0,75. Wer direkt neben der gegnerischen Palette steht, kann sie treffen: immer ein Herz, außer sie ist bewacht.
  - **Fähigkeit** (2 Glow, mit Fingerabdruck 1): siehe Tabelle.
  - **Soak** (frei): heilt (am meisten auf eigener nasser Farbe), wäscht Flecken aus, gibt 1 Wasser.
- **Palette bewacht:** Steht ein eigener Klecks direkt neben der Palette, kann sie nicht getroffen werden. Man muss den Wächter erst auswaschen oder wegdrängen.
- **Guard:** Liegt ein Guard im Vorrat, halbiert er von selbst den nächsten Spritzertreffer.
- **Ausweichen und Krit:** jeder Spritzer kann ausweichen (Fluss / 400, höchstens 40 %). Eine natürliche 20 ist ein kritischer Treffer (× 1,5), Salz erhöht die Chance.
- **Boden wirkt:** auf eigener nasser Farbe +1 Reichweite für Spritzer und +1 Deckkraft je Runde. In nasser Gegenfarbe −2 je Runde.
- **Ausgewaschen:** Ein ausgewaschener Klecks verliert seinen Würfel für immer, man wirft künftig mit weniger Würfeln. Wer keinen Würfel mehr hat, verliert.
- **Der Radierer:** nach Runde 2 und 4 wischt er eine Zeile und streift Kleckse darin (−4). Lichtechtheit rettet.
- **Ende:** Palette ohne Herzen, oder nach 6 Runden mehr Felder (jedes übrige Herz zählt 3 dazu).
- Alle Würfe am Server und offen im Protokoll. Vor jedem Zug zeigt das Blatt Chancen und Schaden.

## Bewusste Abweichungen von Dungeon Dice Monsters

- 6 statt 15 Würfel, damit ein Duell kurz bleibt.
- Beschwören über die Summe der Sterne statt zwei gleiche Stufen. Sonst bliebe der zweite Würfel einer Stufe für immer im Beutel.
- Würfel von Klecksen, die schon auf dem Blatt stehen, werfen weiter mit (für Symbole und als Sterne für andere).
- Bewegen kostet nichts, ein Step gibt zusätzliche Reichweite.
- Brush statt Fallen: Stempeln ist das Gelände dieses Spiels.
- Guard wird von selbst ausgegeben, damit man im Zug des Rivalen nichts antippen muss.

## Bauplan: Gangart, Würfelnetz und Fähigkeit

| Bauplan | Gangart | Fähigkeit |
|---|---|---|
| Crawler | zieht eine trockene Spur | **Seep:** eigene Farbe in der Nähe wird wieder nass und verläuft in alles freie Papier daneben |
| Flutterer | fliegt, jedes Feld kostet 1 | **Gust:** Gegner im Umkreis 2 werden ein Feld weggeweht und verlieren 3 |
| Floater | schwebt über Schlamm | **Rain:** Regen auf 3 × 3 Felder in Reichweite 3, eigene Farbe wird nass, trockene Gegnerfarbe weich |
| Quadruped | läuft einen Schritt weiter | **Charge:** Sprint in gerader Linie auf einen Gegner bis 4 Felder, Spritzer × 1,5 mit +4 auf den Wurf |
| Serpent | gleitet durch eigene Farbe fast umsonst | **Coil:** umschlingt einen Nachbarn: −4, Fleck, er kann im nächsten Zug nicht ziehen |
| Tower | bewegt sich nie, malt und spritzt weiter | **Bastion:** ganzes Team +5 auf Abwehrwürfe für zwei Runden |
| Crab | +3 Spritzschaden aus nächster Nähe | **Crush:** zerquetscht einen Nachbarn, Körnung zählt nicht, doppelter Schaden |
| Jelly | tropft eine nasse Spur | **Drift:** treibt zu einem eigenen nassen Feld und befleckt jeden Gegner daneben |
| Hopper | springt zwei Felder, über alles | **Bound:** Sprung auf ein freies Feld bis 4 weit, stempelt bei der Landung |
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

**Simulation** mit den Regeln von Fassung 5 samt Seltenheiten, je 200 Duelle mit zufälligen Beuteln. Die Spielerseite spielt dabei als Computer, einmal stark (bedenkt jeden Zug), einmal schwach (bedenkt 4 zufällige Züge). Siege des Spielers (in Klammern vor den Seltenheiten):

| Spieler | gegen Apprentice | gegen Journeyman | gegen Master |
|---|---|---|---|
| stark | 88 % (89) | 77 % (74) | 65 % (60) |
| schwach | 65 % (62) | 44 % (43) | 26 % (26) |

- 18 bis 38 % der Duelle enden an der Palette, der Rest beim Trocknen. Ohne Wächterregel wären es fast zwei Drittel.
- Ein Duell dauert etwa 5 bis 6 Würfe pro Seite.
- Pro Seite und Duell kommen 2,2 bis 2,7 Kleckse aufs Blatt, Fähigkeiten etwa einmal.

## Warum das nicht Standard ist

- Jeder Würfel entsteht aus einem gemalten Monster und ist deshalb einzigartig. Sein Netz ist zugleich die Form, die es aufs Blatt bringt.
- Lebenspunkte sind Deckkraft: Getroffene Kleckse verblassen auf dem Blatt.
- Das Spielfeld entsteht im Kampf: aufgeklappte Würfel und Stempel bauen Wege, Heilstellen und Fallen (nasse Gegenfarbe).
- Typen ergeben sich aus echter Farbmischung: Gegenfarben trüben sich und hinterlassen Flecken.
- Was beim Malen des Monsters passiert ist (Salz, Blüten, Fingerabdruck), wirkt im Kampf.
- Zwei Siegwege: die Palette treffen oder Papier gewinnen.
- „Before it dries“ ist der Takt: nasse Farbe verläuft, trockene hält, nach 6 Runden trocknet alles.

## Wie es weitergeht

Plan in docs/entwuerfe/reddit-duell-plan.md: Schritt 1 bis 3 sind gebaut. Als Nächstes die Grafik (erst ein Entwurfsbild: größere Monster, weniger nackte Symbole), dann täglicher Rivale, Teilen und Join-Knopf.

Aus dem Plan noch offen: Wochenbanner (höhere Chance für ein Pigment oder einen Bauplan) und Pigment fürs Benennen von Arten.

## Fragen

1. Passen die Preise (Zug 100, Sieg 60, Niederlage 25, 5 belohnte Duelle am Tag, freier Tageszug)?
2. Lasur: 3 für ein doppeltes Symbol. Soll man mit Lasur später mehr machen können (z. B. einen Stern heben oder einen Joker setzen)?
3. Sollen gefangene Tageskleckse auch Würfel werden (gleiche Form für alle, Seltenheit würfelt jeder selbst)?
4. Wochenbanner und Pigment fürs Benennen jetzt einbauen oder nach der Grafik?
