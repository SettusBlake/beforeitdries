# Plan: Bleach, das Tagesblatt gegen die Bleiche vom Rand

Stand 02.11.2026, Fassung 2.

- **Freigegeben** am 02.11.2026 („alles Empfehlung“, alle 8 Fragen).
- **Schritt 1 gebaut** (Regeln, Server, Simulation, Tests, Knopf „Today’s sheet“): Playtest v0.0.1.127, Bild docs/entwuerfe/bleach-schritt1.png.
- **Abweichungen nach der Simulation:** 3 statt 2 Schritte, 14 statt 11 Pales, Wellen erscheinen in der zweiten Reihe, der große Pale kommt in Welle 3 (siehe „Einstimmen“).

Anlass:
- **Weg C** (entschieden am 01.11.2026): Kampf A ist gebaut, jetzt kommt B, der Modus „Bleach“.
- **Teil davon:** Tagesblatt mit gleichem Seed und Rangliste, unter 2 Minuten, Ergebnis-Post mit dem fertigen Blatt.
- **Messung:** Vorher wird gemessen, wie lang ein Duell nach Kampf A dauert („kürzer erst nach A messen“).

Entwurf: docs/entwuerfe/bleach-entwurf.png (Quelle tools/mockup/bleach-entwurf.ts, echte Kleckse, Würfelseiten und Element-Zeichen aus dem Spiel).

## Messung: Wie lang ist ein Duell jetzt?

Gemessen am 02.11.2026: sechs Duelle im Browser, in normalem Tempo, automatisch gespielt (unten der Knopf „Sepia paints“, also ohne Nachdenken). Die Zeit zählt ab dem ersten Zug.

| Gegner | Dauer | Runden | Ende | Taps |
|---|---|---|---|---|
| Geselle | 105 s | 4 | Palette | 19 |
| Meister | 88 s | 4 | Palette | 13 |
| Geselle | 111 s | 5 | Palette | 21 |
| Meister | 142 s | 6 | getrocknet | 26 |
| Geselle | 127 s | 5 | Palette | 21 |
| Meister | 154 s | 6 | getrocknet | 25 |

- **Im Schnitt 2 Minuten** reine Abspielzeit (88 bis 154 s). Vor Kampf A waren es 2,6 Minuten.
- **Volle 6 Runden:** etwa 2,5 Minuten. Endet das Duell früher an der Palette, sind es 1,5 bis 2 Minuten.
- **Wie oft früher:** Laut Simulation (200 Duelle je Gegner) endet gut jedes zweite Duell vorzeitig an der Palette (52 bis 60 %). Jede Seite hat im Schnitt 5,3 Züge.
- **Mit Nachdenken:** eher 3 bis 5 Minuten.
- **Je Zug:** etwa 12 Sekunden Abspielzeit, Rivale eingerechnet.
- **Folgerung:** Unter 2 Minuten mit Nachdenken schafft das Duell nicht. Bleach mit 5 eigenen Zügen und ohne Rivalen schon: etwa 1 Minute automatisch, 1,5 bis 2 Minuten mit Nachdenken.
- **Empfehlung:** Das Duell bleibt bei 6 Runden. Es ist das längere Spiel für Galerie und Rivalen, Bleach wird der kurze Tagesmodus.

## Die Idee in einem Satz

Die Bleiche frisst das Blatt vom oberen Rand her. Du hältst es fünf Wellen lang mit deinen Würfeln und Klecksen. Alle spielen am selben Tag dasselbe Blatt, danach gibt es Punkte und einen Rang.

## 1 Regeln

### Das Blatt

- **Wie im Duell:** 6 breit × 8 hoch, dieselben Würfel, Kleckse, Symbole, Kombis, Elemente und dieselbe Bedienung (Wischen).
- **Kein Rivale:** Statt eines Rivalen kommt die Bleiche.
- **Unten deine Palette:** Sie hat 3 Herzen und liegt am ganzen unteren Rand.
- **Start:** Ein Klecks steht schon unten auf dem Blatt (wie die Eröffnung im Duell).

### Die Bleiche

- **Pales:** ausgebleichte Kleckse mit Lebenskraft und einem Element, ohne Würfel.
- **Wellen:** 5 Wellen mit 3, 3, 3, 3 und 2 Pales (zusammen 14). Welle 3 bringt einen großen Pale (mehr Lebenskraft, trifft härter, 30 Punkte).
- **Lebenskraft:** aus den Werten des Monsters, mal 1,2 in Welle 1 bis mal 2 in Welle 5, der große noch mal 1,3.
- **Ankündigung:** Jede Welle erscheint in der zweiten Reihe von oben (die oberste ist schon ausgebleicht). Wo die nächste Welle auftaucht, zeigen Markierungen über dem Blatt schon eine Runde vorher (Schritt 2).

### Eine Runde

1. **Die Welle kommt:** Die neuen Pales erscheinen oben.
2. **Dein Zug, wie im Duell:**
   - Würfeln: 3 Würfel, halten, neu werfen, Nässe.
   - Kombis: Glaze, Pure und drei Sterne gelten wie im Duell.
   - Sterne beschwören einen Klecks, sein Netz malt Felder.
   - Kleckse laufen, stempeln und spritzen auf Pales. Element und Kombi zählen.
3. **Die Bleiche zieht:** Jeder Pale macht 3 Schritte nach unten, in seiner Spalte (die untersten zuerst).
   - **Freies Papier:** Er rutscht weiter.
   - **Deine Farbe:** Er bleicht das Feld aus und bleibt stehen, der Schritt ist verbraucht. Lasierte Felder (zwei Schichten) kosten ihn zwei Schritte.
   - **Dein Klecks:** Der Klecks wird getroffen (4 in Welle 1 bis 8 in Welle 5, der große 3 mehr), der Pale bleibt stehen.
   - **Ein anderer Pale:** Er wartet.
   - **Eingewickelt** (Meisterzug Coil): Er steht eine Runde still.
   - **Unterer Rand:** Rutscht er darüber hinaus, bleicht er ein Herz deiner Palette und ist weg.

### Die Symbole in Bleach

| Symbol | Im Duell | In Bleach |
|---|---|---|
| Step | weiter laufen | gleich |
| Splash | trifft die Palette des Rivalen | **Flick:** jeder Pale in einer Reihe deiner Wahl −4 |
| Guard | halbiert einen Treffer | gleich, dazu fängt er den nächsten Durchbruch ab (kein Herz weg) |
| Glow | füllt die Sättigung | gleich (Meisterzug) |
| Joker | jedes Symbol | gleich |

### Ende und Punkte

- **Ende:** nach 5 Wellen (5 Runden), oder früher, wenn alle 3 Herzen weg sind. Aufgeben zählt als fertig.
- **Punkte:**

| Was | Punkte |
|---|---|
| jedes Feld in deiner Farbe | 1 (lasiert 2) |
| jeder ausgewaschene Pale | 10 (der große 30) |
| jedes Herz | 15 |

- **Gleichstand:** Wer zuerst fertig war, steht vorn.
- **Dauer:**
  - Geplant waren 5 eigene Züge zu je etwa 12 Sekunden, kein Zug eines Rivalen, die Bleiche zieht in etwa 2 Sekunden. Zusammen etwa 1 Minute bei automatischem Spiel.
  - Gemessen nach Schritt 1 im Browser (automatisch, normales Tempo): 110 Sekunden. Die Pales ziehen noch einer nach dem anderen, Schritt für Schritt.
  - In Schritt 2 ziehen alle Pales gleichzeitig, das spart etwa die Hälfte.

### Einstimmen (Simulation, 150 Läufe je Spielstärke)

Der Spieler spielt wie der Computer: stark (bedenkt alle Züge), mittel (wie der Geselle), schwach (wie der Lehrling).

| Fassung | stark: alle Herzen | mittel: alle Herzen | schwach: alle Herzen |
|---|---|---|---|
| Plan: 2 Schritte, 11 Pales, schwache Pales | 100 % | | 98 % |
| **gebaut: 3 Schritte, 14 Pales, Lebenskraft ×1,2 bis ×2, zweite Reihe** | 85 % | 71 % | 57 % |

Gebaute Fassung im Einzelnen:

| Spielstärke | Punkte (10 % / Mitte / 90 %) | Herzen 3 / 2 / 1 / 0 | ausgewaschene Pales | der große |
|---|---|---|---|---|
| stark | 134 / 173 / 211 | 85 / 11 / 3 / 1 % | 9,2 von 14 | 60 % |
| mittel | 78 / 125 / 168 | 71 / 17 / 5 / 7 % | 5,3 | 20 % |
| schwach | 40 / 82 / 108 | 57 / 16 / 14 / 13 % | 2,1 | 0 % |

- Mit dem Plan (2 Schritte) kam nie ein Pale durch, Farbe hielt sie fast ganz auf.
- Jetzt hält ein starker Lauf meist alle Herzen, ein schwacher verliert oft eins oder mehr.
- Die Punkte streuen gut, der große Pale lohnt sich für gute Spieler.
- Der große kam zuerst in Welle 5 und war dann nie zu schaffen, deshalb kommt er jetzt in Welle 3.

## 2 Gleiches Blatt für alle

- **Tagesseed:** Datum (UTC). Er bestimmt das Blatt, die Wellen, die Pales und das Deck. Der Aufbau des Tages wird beim ersten Lauf einmal angelegt und gespeichert (`bleach:day:{Tag}`), damit alle denselben bekommen, auch wenn sich das Archiv im Lauf des Tages ändert.
- **Tagesdeck:** neun Würfel mit fester Mischung: 3 Common, 3 Uncommon, 2 Rare, 1 Epic, Formen der Generation 2.
- **Sepias Tagesdeck (Empfehlung):**
  - Master Sepia leiht allen dieselben neun Würfel für den Tag. Die Rangliste ist fair, und jeder probiert täglich neue Kleckse aus.
  - Die Würfel gehören niemandem, die Regel „jedes Monster einzigartig“ bleibt.
  - Das eigene Deck bleibt fürs Duell und die Galerie.
- **Gleiche Würfe (Empfehlung):**
  - Der Server würfelt aus Tagesseed, Runde und Wurf. Wer dieselben Entscheidungen trifft, bekommt dieselben Würfe.
  - Glück ist für alle gleich, es zählt nur, wie man spielt (wie bei Wordle).
  - Gewürfelt wird weiter am Server.
- **Ein Wertungslauf am Tag (Empfehlung):**
  - Abbrechen zählt als fertig.
  - Freigeschaltet nach dem Lern-Duell, weil Bleach dieselbe Bedienung hat.

## 3 Woher die Pales kommen

- **Aus dem Archiv:** Die Pales sind ausgewaschene Würfel anderer Spieler, ausgebleicht. Sie treiben vom Rand zurück, wie die Archiv-Würfel im Duell schon heute.
- **Karte:** Ihre Karte nennt, wer sie ausgewaschen hat.
- **Für alle gleich:** Der Tagesseed wählt sie aus dem Archiv. Ist das Archiv zu klein, entstehen sie aus dem Seed.
- **Story:** Sepia kommentiert jeden Tag mit einem Satz. Hier können später die Story-Splitter erscheinen („irgendwer radiert gezielt“).

## 4 Reddit

### Tagespost (der Ergebnis-Post)

- **Ein Post am Tag:** Der Scheduler legt kurz nach Mitternacht UTC „Today’s sheet · Nov 2 · …“ an, vom App-Konto.
- **Inhalt:** Vorschau der Wellen, Knopf „Play today’s sheet“, Rangliste (Top 10 und dein Platz) mit kleinen Blättern, Zahl der Maler.
- **Nach Mitternacht:** Der Post von gestern zeigt die fertige Rangliste und das beste Blatt, gemalt aus dem gespeicherten Endstand (kein Bild gespeichert).
- **Statt eines Posts je Spieler:** Das wäre im Subreddit Spam. Der Tagespost ist der Ergebnis-Post.
- **Der Spiel-Post bleibt der Haupteinstieg.** Sein Startbild bekommt den Knopf „Today’s sheet“, nach dem Lauf mit deinem Ergebnis.

### Teilen als Kommentar

- **Wie:** Nach dem Lauf schreibt der Knopf „Share as a comment“ einen Kommentar unter den Tagespost, im Namen des Spielers.
- **Inhalt:** Dein Blatt als Quadrate, wie bei Wordle, dazu Punkte, Platz und Herzen.
- **Nur auf ausdrücklichen Tipp,** nie nötig, um weiterzuspielen.
- **Reddit-Regeln:** Für „user actions“ muss die App beim Veröffentlichen von Reddit geprüft werden. Im Playtest kommt der Kommentar vom App-Konto, außer bei dir als Besitzer der App.
- **Höchstens einmal am Tag.**

## 5 Belohnung

- **Pro Wertungslauf (Empfehlung):** 40 Pigment und 1 Tropfen der Tagesfarbe, zusätzlich zu den 5 belohnten Duellen.
- **Tagesfarbe:** Das Hauptpigment des Tages, mit dem Tagesseed gewürfelt.
- **Später:** Serie (Tage am Stück) und ein Wochen-Boss (ein Riesen-Pale am Sonntag, alle sammeln gemeinsam Schaden, passt zum Gemeinschaftsbild unter „Später“).

## 6 Technik

- **Regeln:** Bleach wird eine Spielart des Duells (src/shared/duel). Blatt, Würfe, Kleckse, Kombis, Elemente und Anzeige bleiben dieselben.
  - Die Seite des Rivalen sind die Pales, ohne Würfel.
  - Neu sind Wellen, der Zug der Bleiche, Punkte und die Ereignisse dafür.
  - DUEL_PROTOCOL steigt.
- **Server (src/server/bleach.ts):**
  - Lauf je Spieler und Tag.
  - Rangliste als sortierte Menge in Redis (`bleach:board:{Tag}`), Zahl der Spieler, Endstände der besten Blätter für den Post.
  - Punkte nur vom Server.
- **Scheduler:** Tagespost, dazu ein Mod-Menü „post today's sheet now“.
- **Teilen:** devvit.json bekommt `asUser: SUBMIT_COMMENT`, der Kommentar geht mit `runAs: 'USER'`.
- **Test-Knopf für Mods im Playtest:** „new test sheet (not ranked)“ im Startbild (anderer Seed, ohne Rangliste und ohne Belohnung), damit du mehr als einmal am Tag testen kannst. Schon in Schritt 1 gebaut.
- **Gebaut in Schritt 1:**
  - Regeln: src/shared/duel/bleach.ts (`BLEACH` mit allen Zahlen, `newBleach`, `spawnWave`, `bleachMove`, `doFlick`, `aiFlick`, `bleachRoundEnd`, `bleachScore`, `simulateBleach`). Bleach hängt an der Duell-Engine (`S.mode`, `S.bleach`, die Bleiche hat keine Palette: `NO_HOME`), Aktionen `flick` und `giveup` in play.ts.
  - Server: src/server/bleach.ts (`bleachDay`, `bleachGet`, `bleachStart`, `bleachAct`), Routen /api/bleach, /api/bleach/start, /api/bleach/act.
  - Redis: `bleach:day:{Tag}`, `bleach:days`, `bleach:run:{Spieler}`, `bleach:players`, `bleach:board:{Tag}`, `bleach:res:{Tag}`.
  - DUEL_PROTOCOL 18. Tests tests/bleach.test.ts.
  - Anzeige vorerst schlicht über das Duell: Pales ausgebleicht, oben „Wave 2/5“, deine Punkte und die übrigen Pales, Ergebnis mit Punkten, Rang und Belohnung.

## Reihenfolge

1. **Regeln, Server, Simulation, Tests:** gebaut. Bleach mit Tagesseed, Tagesdeck, gleichen Würfen, Wertung und Rangliste. Simulation zum Einstimmen. Upload mit Knopf „Today’s sheet“ im Startbild, noch ohne Post.
2. **Bedienung:**
   - Pales mit Bahnen, Markierungen der nächsten Welle, Wellenzähler und Punkte.
   - Alle Pales ziehen gleichzeitig (kürzer).
   - Knopf für Flick (bisher nur über „Sepia paints“) und für Aufgeben.
   - Ergebnis mit Punkten und Rang.
   - Sepia erklärt beim ersten Mal in drei Sätzen.
3. **Tagespost und Teilen:** Scheduler, Rangliste und beste Blätter im Post, Kommentar als Spieler.

## Fragen (beantwortet am 02.11.2026, „alles Empfehlung“)

1. **Regeln** wie oben: Pales rutschen in ihrer Spalte 2 Schritte pro Runde, Farbe kostet sie einen Schritt (Lasur zwei), ein Klecks im Weg wird getroffen, ein Durchbruch kostet ein Herz, 5 Wellen? Splash als Flick auf eine Reihe, Guard fängt einen Durchbruch ab? (Empfehlung: ja, die Zahlen nach der Simulation in Schritt 1)
2. **Deck:** Sepias Tagesdeck für alle mit gleichen Würfen bei gleichen Entscheidungen (Empfehlung) oder das eigene Deck (dann gewinnt eher, wer die stärkeren Würfel hat)?
3. **Ein Wertungslauf am Tag,** freigeschaltet nach dem Lern-Duell? (Empfehlung: ja)
4. **Belohnung:** 40 Pigment und 1 Tropfen der Tagesfarbe je Lauf, zusätzlich zu den Duellen? (Empfehlung: ja)
5. **Pales aus dem Archiv** (ausgewaschene Würfel anderer Spieler, ausgebleicht, die Karte nennt, wer sie ausgewaschen hat)? (Empfehlung: ja)
6. **Tagespost als Ergebnis-Post** (Rangliste und beste Blätter) statt eines Posts je Spieler? (Empfehlung: ja)
7. **Teilen als Kommentar** im Namen des Spielers mit dem Blatt als Quadrate? (Empfehlung: ja)
8. **Duell-Länge:** bleibt bei 6 Runden (im Schnitt 2 Minuten automatisch, gut jedes zweite endet früher), Bleach ist der kurze Modus? (Empfehlung: ja)
