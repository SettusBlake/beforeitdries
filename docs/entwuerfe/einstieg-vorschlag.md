# Einstieg neu: Vorschlag

Stand 06.11.2026, Fassung 4. Entschieden am 06.11.2026: „alles Empfehlung, mach E3 und E1 als Artifact“, zum Artifact: „schaut gut aus. umsetzen und ins dev pushen“, dann „los, mach E2“. E3 und E1 sind im Spiel (Playtest v0.1.0.4), E2 ebenso (Playtest v0.1.0.6).

## 1 Rückmeldung eines Spielers (06.11.2026)

- **Gut:** Das Konzept ist richtig cool. Grafik, Kampf und Stil sind großartig, Bewegung und Würfel sehen gut aus. „I was intrigued from the start.“
- **Besser:** Der Einstieg erschlägt.
  - „Massive walls of text referring to things I've never heard of before, my brain kind of stops working.“
  - Gewünscht: ein Zehntel des Texts, am Anfang vielleicht 4 Felder und ein Würfel, Hand halten.
  - „Feels like that FTUX really needs to get dialed in and this game will pop off.“

## 2 Was das Lern-Duell vorher machte (gemessen)

- **Text:** 14 Blasen von Sepia mit zusammen **477 Wörtern**, jede mit „Got it“. Dazu bei jedem Schritt eine Hinweiszeile unten.
- **Ausgangslage:** gleich das volle Brett 6 × 8, 9 Würfel im Deck, der Rivale mit 6 Würfeln, 3 Runden.
- **Neue Begriffe:** gut 25, alle in den ersten 90 Sekunden:

| Bereich | Begriffe |
| --- | --- |
| Blatt und Ziel | Blatt, Deck, Palette mit drei Herzen, Papier bedecken, Runden |
| Würfeln | drei Würfel werfen, verbrauchte Würfel, Farben auf den Seiten, Kürzel aus zwei Buchstaben, Glaze, Pure, Halten, Neuwurf, Nässe, Schlamm |
| Symbole | Step, Splash, Guard, Glow |
| Beschwören | Sterne, Stufe des Würfels, Netz muss eigene Farbe berühren |
| Handeln | Stempeln, Spritzen, Platzen, Palette ist bewacht im Umkreis 2 |
| Fortgeschrittenes | sechs Elemente im Ring, Sättigung, Meisterzug, Aufsaugen, Farbreaktionen (Lasur, Verlaufen, Schlamm), Radierer, Lichtechtheit |

- **Auf dem Bildschirm** ist von Anfang an mehr zu sehen, als erklärt wird: Element-Abzeichen, Sättigungsring, Kombi-Tafel, Stand und Siegwege.

Der Spieler hat recht: Das ist eine Textwand mit Wörtern, die man noch nie gesehen hat.

## 3 Ziel

- **Erste Minute:** ein Klecks, ein Würfel, ein Wisch. Der erste schöne Moment (Würfel rollt, Netz klappt auf, Rivale platzt) kommt in unter 30 Sekunden.
- **Ein Satz je Schritt:** höchstens 8 bis 10 Wörter, kein Wort für etwas, das noch nicht zu sehen ist. Zusammen etwa 40 bis 50 Wörter statt 477.
- **Kein „Got it“:** Die Blase verschwindet, sobald man das Verlangte tut.
- **Regeln nach und nach:** Neue Regeln kommen erst, wenn man sie braucht, verteilt auf die ersten Duelle.

## 4 Vorschläge

### E1 Erste Schritte auf kleinem Blatt (ersetzt das Lern-Duell)

**Stand:** im Spiel, ersetzt das Lern-Duell (Bild docs/entwuerfe/einstieg-im-spiel.png). Das Artifact https://claude.ai/artifact/6rdYt2zv767ViG25g3Qvnx baut aus derselben Quelle (src/client/duel/firststeps.ts, Seite drumherum in tools/mockup/einstieg/, Bild docs/entwuerfe/einstieg-e1-artifact.png).

Fünf kurze Schritte. Das Blatt wächst mit: Die Kamera zeigt anfangs nur 2 × 2 Felder und zoomt mit jedem Schritt heraus, bis das ganze Blatt zu sehen ist. Ein goldener Ring zeigt immer genau einen Schritt.

| Schritt | Blatt | Was man tut | Sepia sagt |
| --- | --- | --- | --- |
| 1 | 2 × 2 | Ein Klecks steht schon da. Wischen auf das freie Feld daneben malt es an. | „Drag your blot. Paint the paper.“ |
| 2 | 4 × 4 | Ein Würfel. Antippen, er rollt, zeigt einen Stern, das Netz leuchtet, Antippen klappt es auf, ein neuer Klecks erscheint. | „Roll. A star brings a new blot.“ |
| 3 | 6 × 6 | Ein Klecks des Rivalen taucht auf. Wischen auf ihn, er platzt. | „Drag onto the rival. Burst it.“ |
| 4 | 6 × 8 | Näher an die Palette des Rivalen gehen, ein Splash im Wurf, wischen auf die Palette, ein Herz ist weg. | „Walk closer. Splash cracks their palette.“ |
| 5 | 6 × 8 | Der Rivale beschwört einen Klecks. Zwei Würfel in derselben Farbe: Glaze, der Treffer zählt anderthalbfach, der Klecks platzt. | „Same colours hit harder.“ |

- **Am Ende:** „Now a real duel.“ Eine Karte mit „+200 pigment. First, 9 free dice for your deck.“, dem Knopf „Collect your free dice“ und „Again“. Nach den freien Würfeln steht im Startbild „Start duel“ für das erste richtige Duell (E2). Wer die Würfel schon hat, bekommt gleich „Start duel“.
- **Umfang:** etwa 60 Sekunden mit Lesen, ein schneller Durchlauf 23 Sekunden. Sepia sagt 6 Sätze mit 33 Wörtern.
- **Hinweis unten:** erscheint erst, wenn man 5 Sekunden nicht weiterweiß oder etwas Falsches tippt (Zeile ruckt). Sonst reicht Sepias Satz.
- **Bedienung wie im Spiel:** wischen oder antippen und Ziel antippen. Kleckse aus dem echten Renderer, 3D-Würfel mit der Würfel-Haut aus dem Spiel, Klänge aus dem Spiel.
- **Abweichungen vom Vorschlag:** Schritt 2 auf 4 × 4 statt 3 × 3 (das Netz braucht 4 Felder Höhe), Schritt 3 auf 6 × 6 statt 3 × 3 (der Rivale steht weiter weg), Schritt 4 mit einem Schritt näher zur Palette. Das Ziel in Schritt 1 liegt rechts neben dem Klecks, weil der Klecks ins Feld darüber ragt und den Ring sonst verdeckt.
- **In der App gebaut:**
  - „Learn with Sepia“ im Startbild öffnet die ersten Schritte statt des Lern-Duells. Die Lektion läuft gescriptet im Spiel mit festen Würfen, verlieren kann man nicht. Die Kleckse werden nebenbei gemalt (bis dahin ein Farbfleck), die Spielfarben sind deine und die des Rivalen.
  - Belohnung wie bisher: Am Ende zahlt der Server einmal 200 Pigment (/api/dice/lesson, `tutorialPaid`), damit sind Duell, Galerie und Tagesblatt frei. Ein zweiter Durchlauf zahlt nichts mehr. Klappt die Verbindung nicht, steht „Try again“ auf der Karte.
  - Abweichung vom Plan: Der Server prüft nicht jeden Schritt einzeln, sondern zahlt am Ende. In einer Lektion ohne Zufall und ohne Verlieren bringt die Prüfung je Schritt nichts, die Belohnung gibt es trotzdem nur einmal.
  - Das alte Lern-Duell ist nicht mehr zu erreichen. Sein Code bleibt liegen, ein schon laufendes Lern-Duell lässt sich noch zu Ende spielen.

### E2 Regeln kommen nach und nach

**Stand:** gebaut (Bild docs/entwuerfe/regeln-nach-und-nach.png).

Das erste richtige Duell nach der Lektion läuft mit den Grundregeln: Würfeln, Beschwören, Stempeln, Spritzen, Palette, Glaze und Pure.

Jedes weitere Duell schaltet eine Sache frei. Dazu kommt oben auf dem Blatt eine Karte „New“ mit einem Satz und dem Knopf „?“, der die Regel in „How to play“ zeigt.

| Duell | Neu | Bis dahin |
| --- | --- | --- |
| 1 | Grundregeln | Neuwürfe bleiben trocken, Elemente zählen nicht, kein Sättigungsring, kein Auftrag, kein Set-Bonus |
| 2 | Nässe und Schlamm beim Neuwurf | |
| 3 | Elemente | Abzeichen erscheinen erst jetzt |
| 4 | Sättigung und Meisterzug | Ring am Sockel erst jetzt |
| 5 | Malmittel | |
| 6 | Sepias Auftrag und Set-Bonus | danach alles wie heute |

- **Für beide Seiten gleich:** Was noch nicht freigeschaltet ist, gilt auch für den Rivalen und ist nicht zu sehen. Versteckte Regeln, die trotzdem wirken, würden mehr verwirren.
- **Galerie-Duelle:** erst, wenn alles freigeschaltet ist.
- **Tagesblatt:** entschieden A, wie heute gleich nach der Lektion, mit allen Regeln und Sepias drei Sätzen.

**Wie es gebaut ist:**

- **Stufe je Spieler:** Neue Spieler beginnen bei Stufe 1 (Feld `stage` im Spielstand), jedes fertige Duell gibt eine Stufe mehr bis 6. Wer schon vorher gespielt hat, hat keine Stufe im Spielstand und behält alle Regeln. Lern-Duell, Galerie-Duell und Tagesblatt laufen immer mit allem. Regeln in src/shared/duel/stages.ts, im Duell `ruleOn` in rules.ts.
- **Für beide Seiten:**
  - Neuwürfe bleiben trocken.
  - Elemente zählen nicht (×1).
  - Der Ring füllt sich nicht, dadurch gibt es keinen Meisterzug und kein Überlaufen.
  - Kein Auftrag, kein Set-Bonus, keine Malmittel.
  - Der Rivale wertet Glow ohne Ring mit null.
- **Nicht zu sehen, solange es nicht gilt:**
  - Element-Zeichen am Sockel, auf den Chips und auf der Karte im Duell, dazu der Element-Teil der Zielvorschau.
  - Der Ring am Sockel und der Meisterzug auf der Karte.
  - Glow im Vorrat. Antippen eines Glow sagt „Not in play yet“.
  - Die Nässe-Anzeige am Neuwurf-Knopf.
  - Set-Bonus und Auftrag.
  - In „How to play“ die Abschnitte, die noch nicht gelten.
- **Ankündigung:** Im ersten Duell einer neuen Stufe erscheint oben „New · Wet rerolls / Elements / The gold ring / Tasks and sets“ mit einem Satz. Sie verschwindet mit der ersten Handlung oder nach 8 Sekunden. „?“ öffnet die Hilfe an dieser Stelle. Bei den Malmitteln (Stufe 5) sagt es Sepia schon bei der Wahl, dort gibt es keine Karte.
- **Malmittel:** Bisher war nur das erste Duell ohne, jetzt die ersten vier. Neue Malmittel werden erst freigeschaltet, wenn Malmittel im Spiel sind.
- **Galerie:** Der Knopf im Startbild ist blass mit „after n more duels“, der Server lehnt Galerie-Duelle vorher ab.
- **Simulation** (Computer als Spieler, je 300 Duelle, Stufe 1 bis 6 und alles):

| Rivale | 1 | 2 | 3 | 4 | 5 | 6 | alles |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Apprentice | 100 % | 100 % | 100 % | 99 % | 99 % | 99 % | 99 % |
| Journeyman | 96 % | 97 % | 97 % | 97 % | 96 % | 97 % | 97 % |
| Master | 47 % | 48 % | 44 % | 42 % | 47 % | 46 % | 46 % |

  Der Apprentice bleibt auf jeder Stufe schlagbar, die Stufen verschieben das Gleichgewicht kaum.
- **Zum Testen:** In den Moderator-Werkzeugen (🛠, nur Playtest und Mods) gibt es „Rules from the next duel: 1 2 3 4 5 6 all“. Alte Konten haben sonst alle Regeln.

### E3 Weniger Text überall

**Stand:** gebaut, Playtest v0.1.0.4. Die Blasen gelten nur noch für ein schon laufendes altes Lern-Duell, die Sätze zu Malmitteln und Tagesblatt für alle.

- **Kurze Blasen:** 12 Blasen mit zusammen 117 Wörtern statt 14 mit 477, keine länger als 12 Wörter. Einzelheiten stehen in den Erklärkarten, die es schon gibt (Symbol antippen).
- **Ohne „Got it“:** Die Blase sitzt oben über dem Blatt, lässt Tipps durch und verschwindet mit der nächsten Handlung.
- **Weggefallen:** die Blasen zu Farbreaktionen und zum Radierer (stehen weiter in der Hilfe).
- **Auch kürzer:** Sepias Satz zu den Malmitteln (10 Wörter) und zum Tagesblatt (13 Wörter).
- **Sepias Ton:** Ihre trockenen Sprüche bleiben, aber nur an Meilensteinen (erster Sieg, erstes Platzen), nicht als Erklärung.

## 5 Reihenfolge

1. **E3:** gebaut.
2. **E1:** gebaut, als Artifact abgestimmt und in der App.
3. **E2:** gebaut, mit Simulation.

## 6 Entscheidungen (06.11.2026)

1. **Richtung:** kleines Blatt am Anfang, ein Satz je Schritt, Regeln kommen nach und nach. Ja.
2. **Artifact:** E1 erst als Artifact zum Ausprobieren. Ja.
3. **Freischalten:** über 6 Duelle wie in der Tabelle.
4. **Tagesblatt:** A, gleich nach der Lektion mit allen Regeln.
5. **Sepias Sprüche:** nur noch an Meilensteinen. Ja.

## 7 Offen

1. **Glow vor Duell 4:** Ohne Ring tut eine Glow-Seite noch nichts. Sie ist im Vorrat ausgeblendet, und Antippen sagt „Not in play yet“. Wie bisher lassen, oder soll Glow bis dahin etwas Einfaches tun, zum Beispiel jeden eigenen Klecks um 1 heilen? Empfehlung: so lassen, die Simulation zeigt keinen Nachteil.
2. **Würfelkarten außerhalb des Duells:** In „Your dice“, Markt und Tausch zeigen die Karten weiter Element und Set. Erst ab Stufe 3 beziehungsweise 6 zeigen? Empfehlung: so lassen, dort liest man in Ruhe nach.
