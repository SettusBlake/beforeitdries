# Plan: Monster selbst malen

Stand 30.10.2026, Fassung 1. Gewählt: A (eigener Umriss). Leerer Würfel pro Woche oder seltener Fund beim Ziehen ist ok. Andere sollen die Zeichnungen später sehen können.

Entwurf: docs/entwuerfe/selbst-malen-entwurf.png (links der Zeichenbildschirm, rechts sechs Zeichnungen, je als Striche und dreimal gemalt mit verschiedenen Würfen). Quelle tools/mockup/selbst-malen.ts, Kern src/shared/drawn.ts (noch nicht im Spiel).

## Kurz

Ein **Blank canvas** ist ein leerer Würfel. Du zeichnest mit dem Finger, das Spiel malt deine Zeichnung als Aquarell. Farbe, Papier, Seltenheit, Bauplan und Werte würfelt der Server wie bei jedem Zug. Die Zeichnung bestimmt nur das Aussehen, nie die Stärke.

## Woher

- Jede Woche ein freier Blank canvas (Montag 0 Uhr UTC), höchstens 2 auf Vorrat.
- Seltener Fund: Zeigt der W100 beim Ziehen eine 1, gibt es zusätzlich einen Blank canvas. Das ist 1 % je Zug, offen sichtbar, ohne zusätzlichen Würfel. Der schlechteste Wurf wird so zum Trost.
- Nicht kaufbar, keine anderen Wege.

## Ablauf

1. In „Your dice“ ein Knopf **Blank canvas** neben den Zügen, mit Vorrat.
2. Der Server würfelt vorher den Bauplan, Sepia gibt ihn als Aufgabe: „Draw me something that flutters. Or don’t. It will flutter regardless.“ Du musst dich nicht daran halten.
3. Zeichnen auf einem quadratischen Blatt:
   - Ein Strich, dessen Ende nah am Anfang liegt, wird eine **Farbfläche**. Offene Striche bleiben **Linien** (Beine, Schwanz, Schnurrhaare, Fühler).
   - **Mirror** (Rorschach): Alles wird an der Mitte gespiegelt. Ein Strich, der an der Mitte beginnt und endet, wird mit seinem Spiegelbild eine Fläche. Was über der Mitte liegt, wird nicht doppelt gemalt.
   - **Eyes:** antippen, dann dorthin tippen, wo das Gesicht hin soll. Ohne Tippen sucht das Spiel die oberste große Fläche.
   - **Undo** und **Clear**. Höchstens 24 Striche.
   - Ohne geschlossene Fläche sagt Sepia: „Close a shape. Paint needs somewhere to pool.“
4. **Paint it:** das gewohnte Ritual. Glas, der Pinsel malt deine Zeichnung, W100 mit Seltenheit, Stempel mit Seriennummer. Die Karte bekommt ein Pinsel-Zeichen („drawn by you“).
5. Bis „Paint it“ ist alles änderbar. Zurück behält den Blank canvas. Danach ist die Zeichnung fest.

## Was der Server würfelt

- Wie ein Zug: W100 offen, Seltenheit, Papier, Pigment, Werte, Fähigkeit, später Shiny 1 zu 1000. Zählt beim Schutz vor Pech mit.
- Einzigartig wie jeder Zug: Seed ins Register, Seriennummer.
- Aus der Zeichnung kommt nur die Form. Größe, Zahl der Striche und Mirror ändern keine Werte.

## Wie es aussieht

- Flächen verlaufen wie Aquarell, bleiben aber erkennbar (Rand etwa halb so weich wie bei Klecksen), mit Tuschekontur. Linien werden Pinselstriche.
- Die Zeichnung wird mittig auf die Karte gesetzt und immer gleich groß gemacht, egal wie klein oder schief gezeichnet.
- Malereignisse (Blüte, Salz, Alkohol, Fingerabdruck) kommen wie bei jedem Monster dazu. Die Blüte sieht wie im Prototyp splittrig aus, auch bei den bisherigen Monstern. Bei großen Flächen ist sie jetzt so groß wie bei Klecksen. Schöner machen kann ich sie mit 2b (Malereignisse der Generation 2), die alten Monster bleiben, wie sie sind.

## Speichern

- Nur die Striche, vereinfacht: im Entwurf 100 bis 450 Zeichen je Monster, höchstens etwa 4,6 KB. Nie ein Bild.
- Der Server prüft die Striche (Anzahl, Punkte, im Blatt, mindestens eine Fläche) und würfelt erst dann.
- Server und Handy rechnen aus denselben Strichen dieselbe Form (reine Rechnung ohne Zufall).

## Andere sehen es

- Vorerst sieht jeder nur seine eigenen Zeichnungen, weil es noch keine Stelle gibt, an der fremde Monster zu sehen sind (der Rivale ist der Computer).
- Mit der ersten solchen Stelle (Tauschen, Benennen-Posts, Galerie) kommt dazu: **Report** an jeder fremden gemalten Karte, ein Mod-Menü mit den gemeldeten Zeichnungen und **Wash drawing**. Das entfernt die Zeichnung, das Monster bekommt eine zufällige Form, Werte und Seriennummer bleiben. Wer mehrmals gewaschen wird, darf eine Zeit lang nicht malen (Dauer offen).
- Gemalte Monster kommen erst in Benennen-Posts, wenn Melden steht.

## Umfang und Reihenfolge

1. Striche zu Formen (src/shared/drawn.ts, mit Tests, gebaut als Entwurf).
2. Server: Vorrat (Woche, Fund bei W100 = 1), Endpunkt zum Malen, Prüfung, Würfel mit Zeichnung, Seriennummer.
3. Zeichenbildschirm (Canvas 2D, Finger, Mirror, Eyes, Undo, Clear), Ritual mit deiner Zeichnung, Karte mit Pinsel-Zeichen.
4. Upload und Handy-Test.

Melden und Mod-Menü kommen mit der ersten Stelle, an der fremde Monster zu sehen sind.

## Offene Fragen

1. Bauplan vorher als Aufgabe zeigen (Empfehlung) oder erst nach dem Malen würfeln?
2. Mirror beim Öffnen an (Empfehlung, passt zum Rorschach-Thema und sieht schnell gut aus) oder aus?
3. Vorrat: 1 pro Woche, höchstens 2, plus Fund bei W100 = 1. Passt das?
4. Reihenfolge: Malen jetzt, danach 2b (Empfehlung), oder erst 2b?
