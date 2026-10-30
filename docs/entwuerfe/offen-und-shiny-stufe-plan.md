# Plan: Malen ohne geschlossene Form, Shiny hebt die Seltenheit

Stand 30.10.2026, Fassung 1, wartet auf Freigabe.

Wunsch vom 30.10.2026 zum Erstellen: 1. Man soll keine geschlossene Form brauchen. 2. Bekommt man eine spezielle Kunstform (Shiny), wird die Seltenheit eventuell eine Stufe gehoben. Frage dazu: Wie wirkt sich das auf die Würfel aus?

## 1. Keine geschlossene Form nötig

**Heute:** Ohne geschlossene Form malt „Paint it“ nicht, über dem Knopf steht der Grund.

**Neu:** Jede Zeichnung wird gemalt. Zeichnungen mit geschlossener Form bleiben, wie sie sind: Flächen werden Farbe, offene Linien bleiben dünne Pinsellinien (Beine, Schnurrhaare, Fühler). Neu ist nur, was passiert, wenn es gar keine Fläche gibt.

Entwurfsbogen docs/entwuerfe/offen-entwurf.png: fünf Zeichnungen nur aus offenen Linien, je dreimal gemalt.

| | So sieht es aus | Gut für |
|---|---|---|
| Bisher | Der längste Strich wird zur Fläche, der Rest bleibt dünn | Kaum etwas: oft ein schiefer Fetzen |
| **A Pinselstrich** (Empfehlung) | Jede Linie wird ein breiter, nasser Pinselstrich, in der Mitte voll, zu den Enden schmaler | Strichfiguren, Äste, Schlangen, Kritzeleien: die Zeichnung bleibt erkennbar |
| B Lavierung | Die Linien bleiben Tusche, dahinter eine lose Farbfläche um alles | Gesichter, Flügel. Strichfiguren werden zum Farbblock |

**Auf die Würfel:** keine Wirkung. Die Zeichnung ist nur die Form. Bauplan, Pigment, Seltenheit, Papier, Werte und Seiten würfelt der Server wie bei jedem Zug, egal was gezeichnet wurde.

## 2. Shiny hebt die Seltenheit um eine Stufe

**Heute:** Shiny ist nur Aussehen (so im Shiny-Plan freigegeben). Diese Festlegung würde sich ändern.

**Neu:** Wird ein Zug Shiny, steigt sein Papier eine Stufe: Student Paper → Drawing Paper → Handmade Paper → Cotton Rag → Washi oder Vellum. Die Seltenheit hängt am Papier, also steigt sie mit: Common → Uncommon → Rare → Epic → Legendary. Ein Legendary bleibt Legendary.

**Auf die Würfel** (genau das, was ein echter Zug dieser Seltenheit hat):

- **Alle fünf Werte steigen** um den Papierbonus: Common → Uncommon +1, Uncommon → Rare +1, Rare → Epic +2, Epic → Legendary +1, jeweils auf jeden Wert. Die Obergrenze je Wert steigt mit (45, 52, 60, 70, 75).
- **Eine Würfelseite wird besser:** Uncommon macht ein Symbol doppelt, Rare macht eine Seite zum Joker, Epic macht noch ein Symbol doppelt, Legendary macht eine Seite zu Gold.
- **Die Stufe (Sterne) kann steigen**, wenn die Summe der Werte dadurch über 110 oder 123 kommt. Dann zeigt der Würfel mehr Sterne: stärker, aber schwerer zu beschwören. Das passiert nur knapp unter der Grenze.
- **Auswaschen gibt mehr Lasur** (Common 1, Uncommon 2, Rare 3, Epic 5, Legendary 10).
- Karte, Rahmen und Papier zeigen die neue Seltenheit.

**Beim Ziehen:** Nach dem Stil-Wurf hebt sich die Karte sichtbar: „✦ Shiny lifts it: Rare → Epic“, der Rahmen wechselt die Farbe, ein Lichtstreif tauscht das Papier (wie beim Aufdecken der Seltenheit).

**Schutz vor Pech:** Die Zähler richten sich weiter nach dem W100. Die gehobene Stufe ist ein Geschenk obendrauf und setzt keinen Zähler zurück (Empfehlung).

## Umfang und Reihenfolge

1. Pinselstrich (A) für Zeichnungen ohne Fläche, Sperre „Close a shape“ fällt weg, Tests.
2. Shiny hebt das Papier am Server, Tests (Werte, Seiten, Stufe, Lasur).
3. Ziehen: Anzeige der gehobenen Stufe.
4. Upload und Handy-Test.

## Offene Fragen

1. Ohne Fläche: A Pinselstrich oder B Lavierung? (Empfehlung: A. Zeichnungen mit Fläche bleiben wie heute)
2. Shiny hebt die Seltenheit um eine Stufe, mit allen Folgen oben? (Empfehlung: ja)
3. Schutz vor Pech zählt nach dem W100, nicht nach der gehobenen Stufe? (Empfehlung: ja)
4. Legendary Shiny bleibt Legendary, ohne Extra? (Empfehlung: ja, Shiny und Legendary ist schon die Krone)
5. Bisherige Shinys (nur vom Test-Knopf) bleiben, wie sie sind? (Empfehlung: ja)
