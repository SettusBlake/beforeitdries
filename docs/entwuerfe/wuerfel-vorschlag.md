# Vorschlag: Würfel spannender, Fähigkeiten natürlicher

Stand 30.10.2026, Fassung 2, wartet auf Auswahl.

Rückmeldung zu Fassung 1 (30.10.2026): A ist ok, E und F gefallen. B ist zu fix (gelesen als: feste Anzahl Doppelseiten je Seltenheit ist zu vorhersehbar). Die Fähigkeiten der Kleckse, die Glow brauchen, wirken fehl am Platz: Die Kleckse sollen etwas können, aber anders. Dazu Vorschläge.

Entwurfsbogen zu Fassung 1: docs/entwuerfe/wuerfel-entwurf.png (A sichtbare Doppelseiten gilt weiter, B und C sind dort noch die alte Fassung).

## Teil 1: Würfel

### Heute

Ein Würfel hat 6 Seiten: 2 bis 3 Sterne (holen Kleckse aufs Blatt), dazu Symbole aus seinen Werten (Step, Splash, Guard, Glow). Doppelseiten gibt es schon (Rare im Schnitt 1,6, Epic 2,6), man sieht sie aber nur an einer kleinen „2“. Alle Würfel fühlen sich gleich an, und es gibt keinen Moment, auf den man hofft.

### A. Doppelseiten sichtbar (gewählt)

- Eine doppelte Seite zeigt das Symbol zweimal, eine dreifache dreimal. Auf dem 3D-Würfel, im Deck, auf der Karte.
- Landet eine Doppel- oder Dreifachseite, gibt es einen kurzen Klang und die Symbole fliegen einzeln in den Vorrat.

### B neu: Seiten zufällig, Seltenheit erhöht nur die Chance

Statt fester Anzahl würfelt jede Symbolseite beim Entstehen des Würfels (aus seinem Seed, am Server, immer gleich), ob sie besser wird. Seltene Würfel haben bessere Chancen, aber auch ein Rare kann ganz schlicht sein und ein Common Glück haben.

| je Symbolseite | doppelt | dreifach | Mischseite |
|---|---|---|---|
| Common | 12 % | | |
| Uncommon | 25 % | | 5 % |
| Rare | 30 % | 5 % | 10 % |
| Epic | 35 % | 12 % | 15 % |
| Legendary | 35 % | 20 % | 20 % |

- **Mischseite:** zwei verschiedene Symbole auf einer Seite (die zwei stärksten des Kleckses). Gibt beide und zählt für ein Paar als jedes der beiden.
- Joker (ab Rare) und Gold (Legendary) bleiben fest, sie zeigen die Seltenheit. Sterne bleiben, wie sie sind.
- Im Schnitt etwa so viele Doppelseiten wie heute, aber stark gestreut: Es gibt Würfel mit drei Doppelseiten und Würfel ohne. Jeder Würfel ist dadurch auch auf seinen Seiten einzigartig.
- Shiny hebt wie bisher eine Stufe, würfelt also mit den besseren Chancen.

### E. Patina: Würfel wachsen mit (gefällt)

- Jeder Würfel zählt, wie oft er im Duell geworfen wurde. Nach 10, 30 und 60 Würfen wird eine zufällige Seite besser: einfach wird doppelt, doppelt wird Mischseite oder dreifach.
- Auf der Karte sichtbar („Patina 1/3“), beim Aufwerten ein kurzer Moment mit Sepia.
- Der Lieblingswürfel wird mit der Zeit besser. Passt zu „jedes Monster einzigartig“.

### F. Sepias Auftrag pro Runde (gefällt)

- Jede Runde zeigt Sepia oben ein Wurfziel, zum Beispiel „two Guard“, „a triple“, „three colours“. Wer es würfelt, bekommt einen Joker. Der Rivale hat eigene Aufträge.
- Gibt jedem Wurf ein Ziel, ohne neue Regeln auf dem Blatt.

### Nicht weiter

- C (Fähigkeitsseite) hängt an Teil 2 und fällt vorerst weg.
- D (Nachtauchen) war nicht dabei. Falls du mit „zu fix“ D gemeint hast und nicht B, sag es.

## Teil 2: Was die Kleckse können

### Heute

- Jeder Bauplan hat eine Fähigkeit (Seep, Gust, Rain, Charge, Coil, Bastion, Crush, Drift, Bound, Sprout, Flare, Howl).
- Sie kostet 2 Glow aus dem Wurf, erscheint als Goldknopf über dem Klecks, oft muss man danach noch ein Ziel antippen.
- Dazu hat jeder Bauplan eine kleine Gangart (fliegt, hüpft, gleitet durch eigene Farbe …) und manche Kleckse Eigenarten aus ihren Malereignissen.

**Warum es fehl am Platz wirkt:** ein eigener Knopf, ein eigener Rohstoff und ein eigenes Ziel, neben dem eigentlichen Spiel (Wischen). Man muss sparen, warten, extra tippen. Die Fähigkeit gehört nicht zum Klecks, sie hängt an ihm dran.

### Ideen

**1. Sättigung: aufladen durch Tun, entladen beim Wisch** Empfehlung

- Jeder Klecks saugt sich voll, wenn er stempelt, trifft oder getroffen wird. Man sieht es: Er wird satter und dunkler, ein Ring am Sockel füllt sich.
- Ist er voll, ist sein **nächster Wisch der Meisterzug**: die Fähigkeit passiert dabei von selbst, gezielt durch den Wisch. Rain fällt, wo er landet. Coil wickelt sich um den Rivalen, auf den man wischt. Charge rennt die Wischlinie entlang. Gust bläst beim Ankommen.
- Kein Knopf, kein Ziel extra, kein Glow. Glow-Seiten im Wurf füllen stattdessen die Sättigung aller eigenen Kleckse ein Stück (Glow bleibt also nützlich).
- Passt zum Aquarell: Farbe sättigt sich, bis sie überläuft.

**2. Auftritt: beim Aufklappen**

- Die Fähigkeit passiert einmal, wenn der Klecks aufs Blatt kommt. Wohin man das Netz legt, entscheidet, wen sie trifft.
- Kein Knopf, kein Glow. Macht das Beschwören zum großen Moment. Dafür nur einmal pro Klecks.

**3. Fähigkeit in der Bewegung**

- Die Gangart wird zur Fähigkeit: jeder Bauplan wischt anders und immer mit seinem Kniff. Der Hüpfer stempelt beim Landen, die Schlange schnürt im Vorbeigleiten, die Krabbe zwickt beim Stempeln daneben.
- Am natürlichsten, aber immer an. Die Fähigkeiten müssten dafür deutlich kleiner werden.

**4. Mischen: zwei Kleckse nebeneinander**

- Stehen zwei eigene Kleckse nebeneinander, mischen sich ihre Farben zu einem Effekt, je nach Farbfamilie (warm und kalt: Dampf, der Rivalen schwächt; kalt und Erde: Felder wachsen zu; warm und Erde: Glut, die stempelt).
- Fähigkeiten aus Farbpaaren statt aus Bauplänen. Ganz im Aquarell-Thema, aber eine neue Regel-Tabelle (sechs Paare).

**5. Abgang: beim Platzen**

- Platzt ein Klecks, löst seine Fähigkeit aus (Flare platzt in alle Richtungen, Sprout heilt die Nachbarn). Ein Trost- und Rache-Moment. Gut als Ergänzung, allein zu wenig.

### Empfehlung Teil 2

**1 (Sättigung)**, dazu vielleicht **5 (Abgang)** als kleine Ergänzung. Der Goldknopf und die Glow-Kosten fallen weg, die zwölf Fähigkeiten bleiben im Kern, werden aber an den Wisch gebunden. Danach Simulation: Siegquoten, wie oft ein Meisterzug kommt (Ziel: etwa einmal pro Klecks und Duell), Dauer.

## Fragen

1. B neu (zufällige Seiten, Seltenheit erhöht nur die Chance): passt das? Prozente wie in der Tabelle? (Empfehlung: ja, Feinschliff nach der Simulation)
2. Mischseite zählt für ein Paar als jedes der beiden Symbole? (Empfehlung: ja)
3. Bisherige Würfel bekommen die neuen Seiten auch? (Empfehlung: ja, die Seiten werden ohnehin aus dem Seed berechnet, Lasuren bleiben auf ihrer Seite)
4. Teil 2: welche Idee für die Fähigkeiten? (Empfehlung: 1 Sättigung, vielleicht mit 5 Abgang)
5. Reihenfolge? (Empfehlung: A und B zuerst, dann Fähigkeiten, dann F, dann E)
