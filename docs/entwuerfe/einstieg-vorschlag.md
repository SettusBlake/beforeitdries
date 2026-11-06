# Einstieg neu: Vorschlag

Stand 06.11.2026, Fassung 2. Entschieden am 06.11.2026: „alles Empfehlung, mach E3 und E1 als Artifact“. E3 ist im Spiel (Playtest), E1 ist als Artifact zum Ausprobieren gebaut, E2 kommt danach.

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

**Stand:** als Artifact gebaut, https://claude.ai/artifact/6rdYt2zv767ViG25g3Qvnx (Quelle tools/mockup/einstieg/, Bild docs/entwuerfe/einstieg-e1-artifact.png). Wartet auf deine Rückmeldung, erst danach kommt es in die App.

Fünf kurze Schritte. Das Blatt wächst mit: Die Kamera zeigt anfangs nur 2 × 2 Felder und zoomt mit jedem Schritt heraus, bis das ganze Blatt zu sehen ist. Ein goldener Ring zeigt immer genau einen Schritt.

| Schritt | Blatt | Was man tut | Sepia sagt |
| --- | --- | --- | --- |
| 1 | 2 × 2 | Ein Klecks steht schon da. Wischen auf das freie Feld daneben malt es an. | „Drag your blot. Paint the paper.“ |
| 2 | 4 × 4 | Ein Würfel. Antippen, er rollt, zeigt einen Stern, das Netz leuchtet, Antippen klappt es auf, ein neuer Klecks erscheint. | „Roll. A star brings a new blot.“ |
| 3 | 6 × 6 | Ein Klecks des Rivalen taucht auf. Wischen auf ihn, er platzt. | „Drag onto the rival. Burst it.“ |
| 4 | 6 × 8 | Näher an die Palette des Rivalen gehen, ein Splash im Wurf, wischen auf die Palette, ein Herz ist weg. | „Walk closer. Splash cracks their palette.“ |
| 5 | 6 × 8 | Der Rivale beschwört einen Klecks. Zwei Würfel in derselben Farbe: Glaze, der Treffer zählt anderthalbfach, der Klecks platzt. | „Same colours hit harder.“ |

- **Am Ende:** „Now a real duel.“ Im Artifact eine Karte mit „Start duel“ und „Again“, in der App geht es direkt ins erste richtige Duell (E2).
- **Umfang:** etwa 60 Sekunden mit Lesen, ein schneller Durchlauf 23 Sekunden. Sepia sagt 6 Sätze mit 33 Wörtern.
- **Hinweis unten:** erscheint erst, wenn man 5 Sekunden nicht weiterweiß oder etwas Falsches tippt (Zeile ruckt). Sonst reicht Sepias Satz.
- **Bedienung wie im Spiel:** wischen oder antippen und Ziel antippen. Kleckse aus dem echten Renderer, 3D-Würfel mit der Würfel-Haut aus dem Spiel, Klänge aus dem Spiel.
- **Abweichungen vom Vorschlag:** Schritt 2 auf 4 × 4 statt 3 × 3 (das Netz braucht 4 Felder Höhe), Schritt 3 auf 6 × 6 statt 3 × 3 (der Rivale steht weiter weg), Schritt 4 mit einem Schritt näher zur Palette. Das Ziel in Schritt 1 liegt rechts neben dem Klecks, weil der Klecks ins Feld darüber ragt und den Ring sonst verdeckt.
- **Für die App geplant:**
  - Feste Würfe wie heute: Der Server prüft jeden Schritt, verlieren kann man nicht.
  - Belohnung wie heute: 200 Pigment und die freien Startwürfel.
  - Technik: Das Blatt bleibt in den Regeln 6 × 8. Die Lektion zeigt einen Ausschnitt und sperrt den Rest.

### E2 Regeln kommen nach und nach

**Stand:** kommt nach E1, mit Simulation.

Das erste richtige Duell nach der Lektion läuft mit den Grundregeln: Würfeln, Beschwören, Stempeln, Spritzen, Palette, Glaze und Pure. Ohne Malmittel ist es heute schon.

Jedes weitere Duell schaltet eine Sache frei. Dazu kommt ein Banner mit einem Satz („New: Elements. Fire beats Metal.“) und dem Knopf „?“ für Einzelheiten.

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

### E3 Weniger Text überall

**Stand:** gebaut, Playtest v0.1.0.3.

- **Kurze Blasen:** 12 Blasen mit zusammen 117 Wörtern statt 14 mit 477, keine länger als 12 Wörter. Einzelheiten stehen in den Erklärkarten, die es schon gibt (Symbol antippen).
- **Ohne „Got it“:** Die Blase sitzt oben über dem Blatt, lässt Tipps durch und verschwindet mit der nächsten Handlung.
- **Weggefallen:** die Blasen zu Farbreaktionen und zum Radierer (stehen weiter in der Hilfe).
- **Auch kürzer:** Sepias Satz zu den Malmitteln (10 Wörter) und zum Tagesblatt (13 Wörter).
- **Sepias Ton:** Ihre trockenen Sprüche bleiben, aber nur an Meilensteinen (erster Sieg, erstes Platzen), nicht als Erklärung.

## 5 Reihenfolge

1. **E3:** gebaut.
2. **E1:** Artifact ausprobieren, Text und Tempo abstimmen, dann in die App.
3. **E2:** danach, mit Simulation, damit der Apprentice im ersten Duell schlagbar bleibt.

## 6 Entscheidungen (06.11.2026)

1. **Richtung:** kleines Blatt am Anfang, ein Satz je Schritt, Regeln kommen nach und nach. Ja.
2. **Artifact:** E1 erst als Artifact zum Ausprobieren. Ja.
3. **Freischalten:** über 6 Duelle wie in der Tabelle.
4. **Tagesblatt:** A, gleich nach der Lektion mit allen Regeln.
5. **Sepias Sprüche:** nur noch an Meilensteinen. Ja.

## 7 Fragen zum Artifact

1. Passt das Tempo (Zoom, Pausen zwischen den Schritten)?
2. Passen die sechs Sätze von Sepia, oder soll ein Schritt weg oder dazu (zum Beispiel Neuwurf)?
3. Hinweis unten erst nach 5 Sekunden: passt das, oder lieber gleich?
