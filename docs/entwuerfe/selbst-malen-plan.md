# Plan: Monster selbst malen

Stand 30.10.2026, Fassung 2, gebaut. Gewählt: A (eigener Umriss). Leerer Würfel pro Woche oder seltener Fund beim Ziehen ist ok. Andere sollen die Zeichnungen später sehen können.

Freigegeben am 30.10.2026 mit diesen Antworten: Bauplan nicht vorher als Aufgabe zeigen, sondern erst nach dem Malen würfeln. Mirror beim Öffnen an. Vorrat wie vorgeschlagen. Malen jetzt bauen, danach 2b.

Bilder: docs/entwuerfe/selbst-malen-entwurf.png (Entwurf mit sechs Zeichnungen, je dreimal gemalt) und docs/entwuerfe/selbst-malen-im-spiel.png (so sieht es im Spiel aus). Code: src/shared/drawn.ts (Striche zu Formen), src/server/dice.ts (diceDraw, Vorrat, Fund), src/client/duel/draw.ts (Zeichenbildschirm).

## Kurz

Ein **Blank canvas** ist ein leerer Würfel. Du zeichnest mit dem Finger, das Spiel malt deine Zeichnung als Aquarell. Farbe, Papier, Seltenheit, Bauplan und Werte würfelt der Server wie bei jedem Zug. Die Zeichnung bestimmt nur das Aussehen, nie die Stärke.

## Woher

- Jede Woche ein freier Blank canvas (Montag 0 Uhr UTC). Die freien füllen höchstens bis 2 auf, auch nach Wochen ohne Besuch.
- Seltener Fund: Zeigt der W100 beim Ziehen eine 1, gibt es zusätzlich einen Blank canvas. Das ist 1 % je Zug, offen sichtbar, ohne zusätzlichen Würfel. Funde zählen immer, auch über 2.
- Erst nach den freien Startzügen nutzbar, damit das Deck zuerst voll ist.
- Nicht kaufbar, keine anderen Wege.

## Ablauf

1. In „Your dice“ unter den Zügen ein Knopf **Blank canvas** mit Vorrat. Ohne Vorrat steht dort „a new one every Monday · or roll a 1“. Auf dem Startbild zeigt „Your dice“ den Hinweis „blank canvas“, wenn einer bereitliegt.
2. Sepia begrüßt ohne Aufgabe, zum Beispiel: „Draw whatever you like. The dice decide what it is good for.“
3. Zeichnen auf einem quadratischen Blatt:
   - Ein Strich, dessen Ende nah am Anfang liegt, wird eine **Farbfläche** (beim Zeichnen leicht getönt). Offene Striche bleiben **Linien** (Beine, Schwanz, Schnurrhaare, Fühler).
   - **Mirror** (Rorschach, beim Öffnen an): Alles wird an der gestrichelten Mitte gespiegelt. Ein Strich, der an der Mitte beginnt und endet, wird mit seinem Spiegelbild eine Fläche. Was über der Mitte liegt, wird nicht doppelt gemalt.
   - **Eyes:** antippen, dann dorthin tippen, wo das Gesicht hin soll. Ohne Tippen sucht das Spiel die oberste große Fläche.
   - **Undo** und **Clear**. Höchstens 24 Striche.
   - Ohne geschlossene Fläche sagt Sepia: „Close a shape. Paint needs somewhere to pool.“
4. **Paint it:** das gewohnte Ritual. Glas, der Pinsel malt deine Zeichnung, W100 mit Seltenheit, Stempel mit Seriennummer. Danach „Your drawing, painted as …“. Die Karte bekommt ein Pinsel-Zeichen, die Würfelkarte zeigt „drawn by you“.
5. Bis „Paint it“ ist alles änderbar. Zurück behält den Blank canvas und die angefangene Zeichnung. Danach ist die Zeichnung fest.

## Was der Server würfelt

- Wie ein Zug: W100 offen, Seltenheit, Papier, Pigment, Werte, Fähigkeit, später Shiny 1 zu 1000. Zählt beim Schutz vor Pech mit, ein W100 mit 1 bringt auch hier einen neuen Blank canvas.
- Einzigartig wie jeder Zug: Seed ins Register, Seriennummer.
- Aus der Zeichnung kommt nur die Form. Größe, Zahl der Striche und Mirror ändern keine Werte.
- Die Zeichnung geht mit ins Duell, der Klecks auf dem Blatt ist deine Zeichnung.

## Wie es aussieht

- Flächen verlaufen wie Aquarell, bleiben aber erkennbar (Rand etwa halb so weich wie bei Klecksen), mit Tuschekontur. Linien werden Pinselstriche.
- Die Zeichnung wird mittig auf die Karte gesetzt und immer gleich groß gemacht, egal wie klein oder schief gezeichnet.
- Malereignisse (Blüte, Salz, Alkohol, Fingerabdruck) kommen wie bei jedem Monster dazu. Die Blüte sieht wie im Prototyp splittrig aus, auch bei den bisherigen Monstern. Bei großen Flächen ist sie so groß wie bei Klecksen. Schöner machen kann ich sie mit 2b (Malereignisse der Generation 2), die alten Monster bleiben, wie sie sind.

## Speichern

- Nur die Striche, vereinfacht: meist 100 bis 450 Zeichen je Monster, höchstens etwa 4,6 KB. Nie ein Bild.
- Der Server prüft die Striche (Anzahl, Punkte, im Blatt, mindestens eine Fläche) und würfelt erst dann.
- Server und Handy rechnen aus denselben Strichen dieselbe Form (reine Rechnung ohne Zufall).

## Andere sehen es

- Vorerst sieht jeder nur seine eigenen Zeichnungen, weil es noch keine Stelle gibt, an der fremde Monster zu sehen sind (der Rivale ist der Computer).
- Mit der ersten solchen Stelle (Tauschen, Benennen-Posts, Galerie) kommt dazu: **Report** an jeder fremden gemalten Karte, ein Mod-Menü mit den gemeldeten Zeichnungen und **Wash drawing**. Das entfernt die Zeichnung, das Monster bekommt eine zufällige Form, Werte und Seriennummer bleiben. Wer mehrmals gewaschen wird, darf eine Zeit lang nicht malen (Dauer offen).
- Gemalte Monster kommen erst in Benennen-Posts, wenn Melden steht.

## Umfang und Reihenfolge

1. Striche zu Formen (src/shared/drawn.ts, mit Tests). Gebaut.
2. Server: Vorrat (Woche, Fund bei W100 = 1), Endpunkt /api/dice/draw, Prüfung, Würfel mit Zeichnung, Seriennummer. Gebaut.
3. Zeichenbildschirm (Canvas 2D, Finger, Mirror, Eyes, Undo, Clear), Ritual mit deiner Zeichnung, Karte mit Pinsel-Zeichen. Gebaut.
4. Upload und Handy-Test. Hochgeladen als Playtest v0.0.1.47.

Danach 2b. Melden und Mod-Menü kommen mit der ersten Stelle, an der fremde Monster zu sehen sind.

## Offen

- Zum Testen am Handy gibt es nur den einen Blank canvas dieser Woche (plus Funde bei W100 = 1). Soll ich für dich als Mod einen Test-Knopf bauen, der leere Würfel gibt (nur im Playtest-Subreddit)?
