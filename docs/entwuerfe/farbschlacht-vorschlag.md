# Vorschlag: Farbschlacht, der Kampf anders

Stand 29.10.2026, Fassung 6 (weniger tippen, mehr Wumms, Plan: docs/entwuerfe/farbschlacht-fassung6-plan.md) mit Seltenheiten und Sammlung. Im Reddit-Playtest spielbar (Knopf „Duel“ im Post), Quelle src/shared/duel (Regeln), src/shared/dice.ts (Seltenheiten), src/server/duel.ts und dice.ts (Server), src/client/duel.ts und duel/collection.ts (Bedienung). Die animierte Fassung 4 liegt weiter unter https://claude.ai/artifact/TESUwotnDooSiEZMuwoPQ2 (Quelle tools/mockup/duel). Bilder: docs/entwuerfe/wuerfel-gacha.png, farbschlacht-spiel-entwurf.png, farbschlacht-wuerfel-entwurf.png, farbschlacht-entwurf.png. Fragen am Ende.

## Rückmeldungen bisher

- Fassung 1 (nur Stempeln): „Fühlt sich ok an, aber ist noch sehr simpel.“
- Fassung 2 (Monster auf dem Blatt, Spritzer): „Besser, aber der Rivale ist zu stark und es fehlen noch Fähigkeiten usw.“
- Fassung 3 (Fähigkeiten, Eigenschaften, Zweitfarbe, Rivale in drei Stufen): „Würde gern auch Würfel einbauen, so wie bei Dungeon Dice Monsters.“
- Fassung 4 (Würfel): „Ist irgendwie cool jetzt.“
- Animierte Fassung 4: Gefühl ok, aber unverständlich (warum man sich nicht bewegen kann), vielleicht zu lang für Reddit, Grafik muss viel besser werden.
- Fassung 5 im Reddit-Playtest: „Der Kampf ist noch recht fade, unübersichtlich und zu viel Geklicke.“ Gemessen: 69 Taps pro Duell, 0,2 ausgewaschene Rivalen.

## Neu in Fassung 6

- **Ein Wisch pro Klecks:** Klecks auf ein Feld ziehen. Papier: hinlaufen und dort stempeln (liegt das Feld zu weit, stempelt er vom nächsten Feld aus). Rivale: hinlaufen und spritzen. Rivalen-Palette: Herz treffen. Oder Klecks antippen und dann das Ziel antippen. Zweimal antippen: Soak. Beim Ziehen zeigt das Blatt Weg, Stempelfelder mit Chancen oder die Trefferchance am Ziel.
- **Fähigkeit:** Goldknopf über dem Klecks, sobald genug Glow da ist. Fähigkeiten wirken von dort, wo der Klecks steht.
- **Ein Tipp für Würfeln und Beschwören:** Die Würfel sind vorgewählt, das Netz liegt schon an der besten Stelle. Ein Tipp aufs Netz klappt es auf, ein Tipp auf einen blauen Punkt verschiebt es.
- **Der Zug endet von selbst,** wenn alle Kleckse gehandelt haben. Der Rivale zieht doppelt so schnell und ohne Banner.
- **„Sepia paints“:** Sepia spielt den Rest des Zuges (nicht im Lern-Duell).
- **Weniger Regeln:** Brush und Wasser fallen weg. Stempeln und Spritzen auf Kleckse sind frei, einmal pro Klecks. Jeder Stempel ist nasse Farbe, über trockene Rivalenfarbe kommt er mit einem Wurf. Die Zweitfarbe wählt das Spiel selbst.
- **4 Symbole:** Step, Splash (nur noch für Treffer auf die Palette), Guard (aus Körnung oder Deckkraft, je nachdem, was größer ist), Glow.
- **Mehr Wumms:** Spritzer reichen 2 Felder. Ein Klecks hält etwa 2 Treffer aus. Ein Treffer färbt das Feld unter dem Ziel. Ein ausgewaschener Klecks platzt, seine Farbe spritzt auf das freie Papier ringsum. Der Wurf (Angriff gegen Abwehr) steht kurz am Ziel.
- **Palette:** bewacht, solange ein eigener Klecks höchstens 2 Felder entfernt steht. Höchstens ein Herz pro Zug.
- **Ergebnisse am Ziel** statt im Ticker. Oben stehen nur noch Herzen und der Gebietsbalken, unten die 4 Symbole und die Würfel.

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
| Symbole Bewegung, Angriff, Verteidigung, Magie, Falle | Step, Splash, Guard, Glow |
| Monster Lord mit 3 Herzen | Palette mit 3 Herzen |

**Der Würfel jedes Kleckses ist einzigartig.** Die Sternseiten hängen von der Stufe ab, die übrigen Seiten werden nach seinen Werten verteilt: Fluss gibt Step, Sättigung gibt Splash, Körnung oder Deckkraft (der größere Wert) gibt Guard, Leuchten gibt Glow. Ist der stärkste Wert 30 oder mehr, ist eine Seite doppelt (×2). Die Karte zeigt den Würfel als Netz, genau so klappt er auf das Blatt. Jeder Bauplan hat eines der elf Würfelnetze.

## Regeln

- **Blatt:** 7 × 7 Felder, 6 Runden, abwechselnd ein Zug. Jede Seite hat ihre Palette (3 Herzen) in der Mitte ihres Randes, darum ein kleiner Fleck eigener Farbe.
- **Beutel:** 6 Würfel aus der eigenen Sammlung. Die Stufe kommt aus der Stärke des Kleckses (Summe der fünf Kampfwerte): unter 110 Stufe 1, unter 123 Stufe 2, sonst Stufe 3. Sternseiten: Stufe 1 und 2 haben drei, Stufe 3 hat zwei. Der Rivale bekommt 6 zufällige Würfel, auch mit Seltenheiten.
- **Eröffnung:** Jede Seite klappt einen Klecks ihrer Wahl kostenlos auf.
- **Ein Zug:**
  1. **Würfeln:** drei Würfel werfen (vorgewählt, tauschbar). Symbole kommen in den eigenen Vorrat und bleiben dort (höchstens 9 je Sorte). Zum Start liegen 1 Step und 1 Splash im Vorrat.
  2. **Beschwören:** Ein Würfel aus dem Beutel mit Stern (oder Joker) darf aufklappen, wenn die Sterne der anderen geworfenen Würfel zusammen mindestens seine Stufe ergeben. Ein Joker zählt als Stern beliebiger Stufe. Das Netz muss die eigene Farbe berühren und darf nur auf blankes Papier oder eigene Farbe. Es wird zu sechs Feldern nasser Farbe, der Klecks steht darauf. Höchstens drei Kleckse auf dem Blatt.
  3. **Handeln:** Jeder Klecks auf dem Blatt zieht einmal: hinlaufen und handeln in einem Wisch. Haben alle gehandelt, endet der Zug.
- **Bewegen:** Eigene Farbe kostet 1, blankes Papier, fremde Farbe und Schlamm kosten 2, im Schlamm bleibt man stehen. Die Reichweite kommt aus Fluss (2 bis 5). Ein Step im Vorrat erlaubt 2 mehr und wird nur verbraucht, wenn man die zusätzliche Reichweite nutzt.
- **Handeln, vier Möglichkeiten:**
  - **Stamp** (frei): Stempel in Form des Bauplans aus nasser Farbe, in Reichweite 2 um den Klecks. Freies Papier und eigene Farbe nimmt er sofort. Nasse Rivalenfarbe: Sättigung + W20 gegen deren Wert + W20, Gegenfarbe wird Schlamm. Trockene Rivalenfarbe und Schlamm: Deckkraft + W20 gegen Körnung + W20. Nasse Farbe verläuft am Rundenende in freies Papier und trocknet dann.
  - **Splash** (frei auf Kleckse): trifft einen Rivalen in Reichweite 2: Sättigung + 3 + W20 gegen Körnung + W20. Schaden 4 + Sättigung / 4, Gegenfarbe × 1,5 und Fleck, harmonische Farbe × 0,75. Ein Treffer färbt das Feld unter dem Ziel.
  - **Palette** (1 Splash-Symbol): wer neben der Rivalen-Palette steht, trifft sie immer, ein Herz, höchstens eines pro Zug, außer sie ist bewacht.
  - **Fähigkeit** (2 Glow, mit Fingerabdruck 1): siehe Tabelle.
  - **Soak** (frei): heilt (am meisten auf eigener nasser Farbe) und wäscht Flecken aus.
- **Palette bewacht:** Steht ein eigener Klecks höchstens 2 Felder neben der Palette, kann sie nicht getroffen werden. Man muss den Wächter erst auswaschen oder wegdrängen.
- **Deckkraft (Lebenskraft):** 10 + Deckkraft / 3, ein Klecks hält etwa 2 Treffer aus.
- **Guard:** Liegt ein Guard im Vorrat, halbiert er von selbst den nächsten Spritzertreffer.
- **Ausweichen und Krit:** jeder Spritzer kann ausweichen (Fluss / 400, höchstens 40 %). Eine natürliche 20 ist ein kritischer Treffer (× 1,5), Salz erhöht die Chance.
- **Boden wirkt:** auf eigener nasser Farbe +1 Reichweite für Spritzer und +1 Deckkraft am Rundenende. In nasser Gegenfarbe −2 am Rundenende.
- **Ausgewaschen:** Ein ausgewaschener Klecks platzt: sein Feld wird Schlamm, seine Farbe spritzt auf das freie Papier ringsum. Sein Würfel ist für immer verloren, man wirft künftig mit weniger Würfeln. Wer keinen Würfel mehr hat, verliert.
- **Der Radierer:** nach Runde 2 und 4 wischt er eine Zeile und streift Kleckse darin (−4). Lichtechtheit rettet.
- **Ende:** Palette ohne Herzen, oder nach 6 Runden mehr Felder (jedes übrige Herz zählt 3 dazu).
- Alle Würfe am Server und offen im Protokoll. Vor jedem Zug zeigt das Blatt Chancen und Schaden.

## Bewusste Abweichungen von Dungeon Dice Monsters

- 6 statt 15 Würfel, damit ein Duell kurz bleibt.
- Beschwören über die Summe der Sterne statt zwei gleiche Stufen. Sonst bliebe der zweite Würfel einer Stufe für immer im Beutel.
- Würfel von Klecksen, die schon auf dem Blatt stehen, werfen weiter mit (für Symbole und als Sterne für andere).
- Bewegen kostet nichts, ein Step gibt zusätzliche Reichweite.
- Stempeln und Spritzen auf Kleckse kosten nichts. Symbole braucht man für Reichweite, Palette, Abwehr und Fähigkeiten.
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
| Radiant | spritzt ein Feld weiter | **Flare:** nasse Farbe in alle 8 Nachbarfelder, Spritzer × 0,6 auf jeden Gegner daneben |
| Twinhead | spritzt zweimal mit zwei Köpfen | **Howl:** Rivale verliert 1 Splash und 1 Glow, Gegner im Umkreis 2 verlieren 3 |

Jeder Bauplan hat ein eigenes Würfelnetz (elf Netze, Twinhead teilt seines mit Flutterer).

## Eigenschaften aus dem Monster

| Herkunft | Wirkung |
|---|---|
| Salz | Krit +8 % |
| Alkohol | Ausweichen +6 % |
| Blüte Rebloomer | heilt 1 je Runde |
| Blüte Edge Runner | Stempel +2 gegen nasse Farbe |
| Blüte Dry Edge | Stempel +2 gegen trockene Farbe |
| Blüte Absorbent | nimmt 15 % weniger Schaden |
| Blüte Tide Mark | Ausweichen +5 % |
| Fingerabdruck | Fähigkeit kostet nur 1 Glow |
| Phthalo (staining) | Spritzer beflecken immer |
| Opera (fugitive) | verblasst 1 je Runde, +2 Schaden |
| Granulierend (Ultramarin, Siena) | eigene trockene Farbe +2 schwerer zu übermalen |

**Zweitfarbe:** Hat ein Klecks ein Nebenpigment, nimmt das Spiel von selbst die bessere Farbe gegen das Ziel. Die zweite Farbe ist um 1 schwächer, lohnt sich aber, wenn die Hauptfarbe zum Ziel harmonisch ist oder nasse Gegenfarbe zu Schlamm werden soll.

## Rivale in drei Stufen

| Stufe | bedenkt | Lebenskraft | Sättigung, Deckkraft, Körnung |
|---|---|---|---|
| Apprentice | 3 zufällige Züge, Würfel zufällig | × 0,7 | × 0,65 |
| Journeyman | 15 zufällige Züge | × 0,85 | × 0,85 |
| Master | alle | voll | voll |

**Simulation** mit den Regeln von Fassung 6, je 200 Duelle mit zufälligen Beuteln. Die Spielerseite spielt dabei als Computer, einmal stark (bedenkt jeden Zug), einmal schwach (bedenkt 4 zufällige Züge). Siege des Spielers (in Klammern Fassung 5):

| Spieler | gegen Apprentice | gegen Journeyman | gegen Master |
|---|---|---|---|
| stark | 85 % (88) | 73 % (77) | 56 % (65) |
| schwach | 69 % (65) | 47 % (44) | 44 % (26) |

- Ausgewaschene Kleckse pro Duell (beide Seiten): bei starkem Spiel 1,9 bis 2,8 statt 0,2 bis 0,4.
- 28 bis 52 % der Duelle enden an der Palette, der Rest beim Trocknen.
- Ein Duell dauert etwa 5 bis 6 Würfe pro Seite.
- Bedienung im Browser gemessen (ein Bot folgt Sepias Pfeil): 14 Taps für ein ganzes Duell gegen den Lehrling statt 69, 3 bis 5 pro Zug. Das Lern-Duell braucht 29 Taps über 6 Runden.

## Warum das nicht Standard ist

- Jeder Würfel entsteht aus einem gemalten Monster und ist deshalb einzigartig. Sein Netz ist zugleich die Form, die es aufs Blatt bringt.
- Lebenspunkte sind Deckkraft: Getroffene Kleckse verblassen auf dem Blatt.
- Das Spielfeld entsteht im Kampf: aufgeklappte Würfel und Stempel bauen Wege, Heilstellen und Fallen (nasse Gegenfarbe).
- Typen ergeben sich aus echter Farbmischung: Gegenfarben trüben sich und hinterlassen Flecken.
- Was beim Malen des Monsters passiert ist (Salz, Blüten, Fingerabdruck), wirkt im Kampf.
- Zwei Siegwege: die Palette treffen oder Papier gewinnen.
- „Before it dries“ ist der Takt: frische Farbe ist nass und angreifbar, verläuft am Rundenende und trocknet, nach 6 Runden trocknet alles.

## Wie es weitergeht

Plan Fassung 6 in docs/entwuerfe/farbschlacht-fassung6-plan.md: Schritt 1 (Regeln, Simulation) und 2 (Bedienung) sind gebaut. Als Nächstes Schritt 3: mehr Wumms in der Darstellung und größere Kleckse, dafür zuerst ein Entwurfsbild. Danach täglicher Rivale, Teilen und Join-Knopf.

Aus dem Gacha-Plan noch offen: Wochenbanner und Pigment fürs Benennen von Arten.

## Fragen

1. Fühlt sich das Wischen gut an, oder lieber antippen und Ziel antippen?
2. Splash als Symbol nur noch für die Palette: verständlich, oder soll es einen anderen Namen bekommen?
3. Gegen den Meister gewinnt man jetzt öfter als vorher (schwach 44 % statt 26 %). Soll der Meister stärker werden?
4. Platzen färbt das Papier in der Farbe des geplatzten Kleckses (so stand es im Plan). Oder lieber in der Farbe dessen, der getroffen hat?
