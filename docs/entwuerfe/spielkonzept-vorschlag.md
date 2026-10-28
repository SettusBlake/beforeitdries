# Vorschlag: Spielkonzept

Stand 28.10.2026. Vorschlag, nichts davon ist gebaut. Fragen am Ende. Entwurfsbild: docs/entwuerfe/kampf-entwurf.png.

Baut auf der Übergabe auf (Werte, Pigmente, Papiere, Lasieren, „Kampf 3 gegen 3 mit Farbkreis als Typensystem und Wasser als Ressource“) und auf der Reddit-Analyse (docs/entwuerfe/reddit-paket-vorschlag.md). Der Kampf war für später geplant. Ohne ihn haben die Werte keinen Zweck, deshalb kommt er nach vorne.

## 1. In einem Satz

Fang lebende Aquarell-Kleckse, bevor sie trocknen, lass die Community sie benennen, mal sie Schicht für Schicht stärker und führe ein Team aus drei gegen den Radierer, der das Blatt ausbleicht.

## 2. Was heute fehlt

- Fangen ist ein Tipp, Lasieren ein Tipp und dann 8 Stunden warten.
- Es gibt keine Entscheidung mit Folgen, kein Können, kein Ziel.
- Die Werte (Deckkraft, Sättigung, Körnung, Fluss, Leuchten, Lichtechtheit) wirken nirgends.

## 3. Der Kern: Kampf 3 gegen 3

Rundenbasiert, nur Tippen, ein Kampf dauert 1 bis 2 Minuten.

**Werte im Kampf** (Startwerte, alle in JSON):

| Wert | Wirkung |
|---|---|
| Deckkraft | Lebenspunkte: 30 + Deckkraft × 3 (Mittel heute etwa 100) |
| Sättigung | Kraft von Trockenpinsel |
| Körnung | Verteidigung: Schaden × 30 / (30 + Körnung) |
| Fluss | Reihenfolge in der Runde, Ausweichen Fluss / 4 % |
| Leuchten | Kraft von Nass in Nass und Abheben |
| Lichtechtheit | Widerstand gegen Ausbleichen des Radierers und gegen Flecken |

**Wasser** ist die gemeinsame Ressource des Teams: Start 3, +1 je Runde, höchstens 6.

**Jeder Klecks hat vier Züge:**

| Zug | Wasser | Wirkung |
|---|---|---|
| Dry brush (Trockenpinsel) | 0, gibt +1 zurück | ein Ziel, Sättigung |
| Wet-in-wet (Nass in Nass) | 2 | alle Gegner, Leuchten, 60 % Kraft, Nass-Effekte (Phthalo färbt 3 Runden) |
| Lift (Abheben) | 1 | heilt einen eigenen Klecks mit Leuchten, entfernt Flecken |
| Zug des Bauplans | 1 bis 3 | je Bauplan eigen, siehe unten |

**Würfe sind offen:** Jeder Treffer zeigt seinen W20. Schadensfaktor 0,6 + 0,04 × W20, eine 20 ist ein Krit (× 1,5). Salzkristalle +8 % Krit, Alkoholtropfen +6 % Ausweichen, die Blüte-Eigenschaften wirken wie im Prototyp beschrieben.

**Farbkreis als Typensystem:** dieselbe Beziehung wie beim Lasieren, nur umgekehrt.

| Hauptpigment Angreifer zu Ziel | Lasieren | Kampf |
|---|---|---|
| harmonisch (bis 60) | sicher, wenig Gewinn | × 0,75, die Farben verschwimmen |
| neutral (bis 130) | mittel | × 1 |
| komplementär (darüber) | riskant, viel Gewinn | × 1,5, die Gegenfarbe trübt |

Verschlammte Kleckse (Schlammlinie) sind zu allem neutral, geben und nehmen × 1.

**Züge der Baupläne** (eine Mutation wechselt den Zug mit):

| Bauplan | Zug | Wasser | Wirkung |
|---|---|---|---|
| Crawler | Seep | 1 | Ziel verliert 2 Runden lang Fluss |
| Flutterer | Flick | 1 | handelt sofort, kann nicht ausgewichen werden |
| Floater | Drift | 1 | weicht dem nächsten Angriff aus, +1 Wasser |
| Quadruped | Charge | 2 | Trockenpinsel × 1,6, danach 1 Runde weniger Körnung |
| Serpent | Coil | 2 | Fleck: Schaden 3 Runden lang |
| Tower | Stack | 2 | ganzes Team +30 % Körnung für 2 Runden |
| Crab | Pinch | 1 | senkt die Körnung des Ziels für den Rest des Kampfs |
| Jelly | Trail | 3 | Nass in Nass mit Fleck auf alle |
| Hopper | Hop | 2 | zweimal Trockenpinsel |
| Tuber | Root | 1 | heilt sich 3 Runden lang |
| Radiant | Radiate | 3 | starker Leuchten-Schlag auf alle |
| Twinhead | Twin bite | 2 | zwei Ziele, je 70 % |

Fingerabdruck (1 zu 90): ein fünfter Zug, die Signatur-Fähigkeit.

**Gegner sind gebleichte Kleckse:** Kleckse, die der Radierer genommen hat. Gleicher Renderer, nur entsättigt. Sie heißen nach ihrer Art, z. B. „Bleached Puddlemoth“, sobald die Community die Art benannt hat. Ihr Zug „Bleach“ senkt einen Wert für 2 Runden, Lichtechtheit hält dagegen. Wer einen gebleichten Klecks besiegt, gibt ihm die Farbe zurück: Er hinterlässt Pigment.

## 4. Fangen: ein Kampf gegen die Zeit

Der Name des Spiels wird zur Regel.

- Der wilde Klecks kämpft allein gegen dein Team, mit doppelten Lebenspunkten.
- Er ist nur ein paar Runden nass: 4 bis 7, je nach Luftfeuchte des Tages (feucht = länger). Danach ist er getrocknet und weg.
- Statt anzugreifen kann ein Klecks des Teams **Press** wählen: Papier aufdrücken, ein Abklatsch wie beim Rorschach-Test. Chance 20 % + 70 % × fehlende Deckkraft, minus Papier-Abzug (Student 0, Drawing 5, Handmade 10, Cotton Rag 20 Prozentpunkte), mindestens 5 %. Die Chance steht offen da.
- Fällt seine Deckkraft auf 0, ist er ausgewaschen: zu viel Wasser, weg.
- Du kämpfst gegen genau das Exemplar, das du bekommst: Seine Würfe stehen vorher da („Its dice: d17 d4 d12 …“). Starke Würfe heißt schwerer zu fangen.
- Für den Tagesklecks gibt es 3 Löschblätter am Tag, also 3 Versuche.

Lore-Check: Sepia: „Too much water and it's gone. Too little and it's dry. That's the whole craft.“

## 5. Der Rand des Blatts: der Tageslauf

Jeden Tag bleicht der Rand weiter aus. Alle spielen denselben Rand (Tages-Seed), einmal am Tag.

- 3 Kämpfe nacheinander gegen 1, 2 und 3 gebleichte Kleckse, dann der Rand selbst: ein großer gebleichter Klecks.
- Lebenspunkte bleiben zwischen den Kämpfen. Nach jedem Kampf wählst du einen von zwei Tipps von Sepia: „Fresh water“ (+2 Wasser zum Start), „Rest“ (30 % heilen), „Salt“ (+10 % Krit im nächsten Kampf) und weitere.
- Punkte für zurückgemalte Deckkraft und überlebende Kleckse. Tagesbestenliste, Wochensumme.
- Lohn: Pigmente der besiegten Kleckse (Hauptpigment sicher, Nebenpigment zur Hälfte), am Rand ein seltener Splitter der Geschichte.
- Gemeinschaftsziel: Alles, was die Spieler eines Tages zurückmalen, schiebt den Rand zurück. Die Startkarte zeigt, ob der Rand diese Woche wächst oder weicht. Das wöchentliche Kapitel erzählt, was am Rand passiert ist.

Lore-Check: Das Blatt bleicht von den Rändern, jemand radiert gezielt. Wer kämpft, malt zurück. Wer radiert, bleibt unsichtbar. Passt und verrät nichts.

## 6. Lasieren mit Pigmenten

- Eine Lasur kostet 1 Pigment der gewählten Farbe. Pigmente gibt es am Rand und von verschütteten Klecksen (siehe 9).
- Regeln wie im Prototyp: Beziehung zum Hauptpigment, Gelingen, Schlamm, Mutation, Farbreste, höchstens 5 Lasuren.
- Die Trockenzeit bleibt je Monster. Weil Pigment jetzt bremst, schlage ich 4 statt 8 Stunden vor.
- Entscheidung mit Folgen: sichere harmonische Lasur oder riskante Gegenfarbe mit mehr Gewinn und Mutationsgefahr. Eine Mutation wechselt Bauplan und damit den Kampfzug.

## 7. Einstieg

- Erster Besuch: Sepia legt dir ein Schmierblatt mit 6 Klecksen hin, du wählst 3. Das ist dein erstes Team, mit offenen Würfen.
- Erster Kampf direkt danach: ein schwacher gebleichter Klecks, Sepia erklärt in drei Sätzen Wasser, Trockenpinsel, Farbkreis.
- Danach der Tagesklecks: erster Fang.

## 8. Ein Tag (5 bis 8 Minuten)

1. Im Feed: der Klecks des Tages groß, „What do you see?“, Rand-Zustand, eigene Strähne. Ein Knopf: Play.
2. Fangen (1 bis 2 Minuten, bis zu 3 Versuche).
3. Rand (3 bis 5 Minuten, einmal).
4. Lasieren mit den gewonnenen Pigmenten (1 Minute).
5. Namen für den Klecks kommentieren, Ergebnis teilen.

## 9. Reddit

Aus der Analyse übernommen:

- **Tagespost** mit Klecks und Rand, Titel aus mehreren Sätzen.
- **Namen** als Antworten auf einen angehefteten Kommentar der App.
- **Strähne** „Wet days“: Tage in Folge mit einem Randlauf, ein verpasster Tag je Woche verziehen. Lohn alle 3 Tage: ein Föhn, der eine Trockenzeit überspringt.
- **Join** nach dem ersten Fang, **Teilen** nach dem Rand („Repainted the Edge: 3 of 4, 1,240 points. What do you see in today's blot?“).
- **Posts von Spielern: Klecks verschütten.** Wer heute den Rand gespielt hat, darf einen wilden Klecks als Post anlegen. Andere fangen ihn mit demselben Fangkampf, 24 Stunden lang. Der Verschütter bekommt Pigment für jeden Fänger, höchstens 10 am Tag.
- **Ohne Login:** Probe-Kampf mit einem geliehenen Team.

## 10. Langzeit

- Sammlung: 12 Baupläne × 8 Pigmente = 96 Arten, 4 Papiere, Fingerabdrücke. Bestiarium mit allen benannten Arten.
- Stärker werden: seltene Papiere heben den Werte-Deckel, Lasuren, Mutationen auf der Suche nach dem richtigen Zug.
- Wöchentliche Kapitel-Posts mit Splittern der Geschichte, abhängig davon, wie weit der Rand gewichen ist.
- Später, wie in der Übergabe: Falten (zwei Kleckse spiegelsymmetrisch verschmelzen), Galerie-Duelle (dein Team als Post, andere kämpfen dagegen), Riesenklecks als Gemeinschaftsboss, Farbspende.

## 11. Technik in Kürze

- Kampfregeln in src/shared, alle Zahlen in JSON.
- Der Server führt den Kampf: Zustand in Redis, jeder Zug ein Aufruf, der Server würfelt und schickt die Würfe zur Anzeige zurück. So lässt sich nichts vorausberechnen. Ein Zug braucht etwa eine Viertelsekunde Antwortzeit, für Runden reicht das.
- Ein Simulator (npm run sim) spielt tausende Kämpfe, damit Werte und Formeln stimmen, bevor du testest.
- Gegner: gleicher Renderer, entsättigt per Filter. Die Kleckse selbst bleiben unverändert.

## 12. Meilensteine

1. **Spielbar** (jeder Schritt mit Upload und Handy-Test):
   1. Kampf gegen einen gebleichten Klecks mit Team, Wasser, vier Zügen, Farbkreis.
   2. Schmierblatt: 3 aus 6 wählen.
   3. Fangen als Kampf mit Nässe und Press.
   4. Rand mit 3 Kämpfen und Randklecks, Tipps, Punkte, Tagesbestenliste.
   5. Pigmente, Lasieren kostet Pigment.
2. **Reddit-Paket:** angehefteter Kommentar für Namen, Strähne mit Föhn, Join, Teilen, Bestiarium, Probe ohne Login, dann Klecks verschütten.
3. **Prüfung:** Löschpflicht, englisches README, Startkarte messen, Journeys, Flairs.
4. **Später:** Falten, Galerie-Duelle, Riesenklecks, Kapitel.

## 13. Bewusst nicht

- Leben oder Energie, die das Spielen begrenzen.
- Kampf, der von selbst läuft.
- Bezahlschranken und Pay-to-win.
- Freitext über die App.

## 14. Fragen

1. Kern Kampf 3 gegen 3 mit Wasser, vier Zügen und Farbkreis: ja?
2. Fangen als Kampf mit Nässe-Runden und Press: ja? 3 Versuche am Tag?
3. Rand: einmal am Tag mit Bestenliste? Oder beliebig oft, aber nur der erste Lauf zählt?
4. Lasieren kostet Pigment, dafür Trockenzeit 4 statt 8 Stunden: ja?
5. Gegner als gebleichte Kleckse: ja?
6. Neue Monster nur über Tagesklecks und verschüttete Kleckse? Oder bleibt nach einem gewonnenen Randkampf manchmal ein Klecks (z. B. 10 %)?
7. Erster Artname bleibt für immer: ja?
8. Subreddit: r/beforeitdries bleibt vorerst Test-Sub und wird später öffentlich?
9. Reihenfolge: erst „Spielbar“, dann Reddit-Paket?
