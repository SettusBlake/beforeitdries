# Vorschlag: Würfel spannender machen

Stand 30.10.2026, Fassung 1, wartet auf Auswahl.

Wunsch vom 30.10.2026: Rare Würfel und besser sollen Seiten mit Doppelsymbolen haben können. Das Würfelsystem gefällt noch nicht ganz, es ist etwas langweilig.

Entwurfsbogen: docs/entwuerfe/wuerfel-entwurf.png (je Seltenheit ein Würfel, links heute, rechts mit A, B und C). Quelle tools/mockup/wuerfel-entwurf.ts.

## Heute

Ein Würfel hat 6 Seiten: 2 bis 3 Sterne (holen Kleckse aufs Blatt), dazu Symbole aus seinen Werten (Step, Splash, Guard, Glow). Die Seltenheit ändert ein paar Seiten. Gemessen an 1500 Würfeln je Seltenheit (Seiten im Schnitt):

| | Sterne | einfach | doppelt | Joker | Gold |
|---|---|---|---|---|---|
| Common | 2,8 | 2,7 | 0,5 | | |
| Uncommon | 2,6 | 1,8 | 1,6 | | |
| Rare | 2,5 | 1,0 | 1,6 | 1 | |
| Epic | 2,2 | 0,2 | 2,6 | 1 | |
| Legendary | 2,1 | | 1,9 | 1 | 1 |

**Warum es fade wirkt:**

- Doppelseiten gibt es schon, man sieht sie aber kaum: nur eine kleine „2“ in der Ecke.
- Alle Würfel fühlen sich gleich an: ein paar Sterne, ein paar einfache Symbole. Ein Rare-Wurf sieht aus wie ein Common-Wurf.
- Kein Moment, auf den man hofft: keine Seite, die etwas Besonderes auslöst.
- Ein Würfel hat keine eigene Persönlichkeit, nur andere Zahlen.

## Ideen

### A. Doppelseiten sichtbar (S, nur Anzeige) Empfehlung

- Eine doppelte Seite zeigt das Symbol zweimal, eine dreifache dreimal. Auf dem 3D-Würfel, im Deck, auf der Karte.
- Landet eine Doppel- oder Dreifachseite, gibt es einen kurzen Klang und die Symbole fliegen einzeln in den Vorrat.

### B. Neue Seltenheitsleiter mit Dreifach- und Mischseiten (S bis M) Empfehlung

| | heute | neu |
|---|---|---|
| Common | stärkstes Symbol ab 30 doppelt | wie heute |
| Uncommon | 1 doppelt | 1 doppelt |
| Rare | 1 doppelt, Joker | 2 doppelt, Joker, **1 Mischseite** |
| Epic | 2 doppelt, Joker | **1 dreifach**, 1 doppelt, Joker, Mischseite |
| Legendary | 2 doppelt, Joker, Gold | **1 dreifach**, 1 doppelt, Joker, Gold, Mischseite |

- **Mischseite:** zwei verschiedene Symbole auf einer Seite, die zwei stärksten des Kleckses (zum Beispiel Splash und Guard). Gibt beide und zählt für ein Paar als jedes der beiden.
- **Dreifachseite:** zählt dreimal, ab Epic.
- Sterne bleiben, wie sie sind, damit Beschwören gleich schwer bleibt.
- Shiny hebt wie bisher eine Stufe, bekommt also auch die bessere Leiter.

### C. Fähigkeitsseite (M) Empfehlung

- Jeder Würfel bekommt eine goldene Seite mit der Fähigkeit seines Bauplans (Gust, Crush, Coil, Rain …). Sie ersetzt das schwächste einfache Symbol, nur wenn keins da ist einen Stern.
- Liegt sie oben, darf dieser Klecks seine Fähigkeit in diesem Zug ohne Glow einsetzen. Steht er noch nicht auf dem Blatt, gibt sie stattdessen 2 Glow.
- So hat jeder Würfel einen eigenen Moment, auf den man hofft („die Crush-Seite!“), und Würfel desselben Bauplans spielen sich anders als andere.

### D. Nachtauchen: einmal pro Zug Glück herausfordern (M)

- Nach Keep darf man einen vierten Würfel aus dem Deck werfen.
- Zeigt er ein Symbol, das schon im Wurf liegt: Volltreffer, das Symbol zählt doppelt (aus einem Paar wird ein Drilling).
- Passt nichts: Der Wurf verläuft, das schwächste Symbol geht verloren.
- Gibt jedem Zug eine kleine Entscheidung mit Spannung. Der Rivale entscheidet nach einer Faustregel.

### E. Patina: Würfel wachsen mit (M)

- Jeder Würfel zählt, wie oft er im Duell geworfen wurde. Nach 10, 30 und 60 Würfen wird eine Seite besser: einfach wird doppelt, dann eine Mischseite, dann doppelt wird dreifach.
- Passt zu „jedes Monster einzigartig“: Der eigene Lieblingswürfel wird mit der Zeit besser, sichtbar auf der Karte („Patina 2/3“).

### F. Sepias Auftrag pro Runde (S)

- Jede Runde zeigt Sepia ein Wurfziel, zum Beispiel „zwei Guard“, „ein Drilling“, „drei Farben“. Wer es würfelt, bekommt einen Joker.
- Gibt jedem Wurf ein Ziel, ohne neue Regeln auf dem Blatt.

## Empfehlung

1. **A, B und C zusammen.** Das ist genau dein Wunsch (Doppel- und Dreifachseiten bei seltenen Würfeln, gut sichtbar) und gibt jedem Würfel eine eigene Seite, auf die man hofft.
2. Danach **D (Nachtauchen)** für Spannung in jedem Zug.
3. **E (Patina)** später, wenn das Duell steht.
4. F nur, wenn es danach noch zu ruhig ist.

Vor dem Einbau messe ich mit der Simulation, wie sich Siegquoten und Dauer ändern, und gleiche falls nötig aus (zum Beispiel weniger Glow aus der Fähigkeitsseite). Der Rivale bekommt dieselben Regeln. Neue Seiten brauchen eine neue Protokoll-Nummer (alte Oberflächen bitten ums Neuladen), laufende Duelle werden verworfen.

## Fragen

1. Welche Ideen? (Empfehlung: A, B, C jetzt, D danach)
2. Mischseite zählt für ein Paar als jedes der beiden Symbole? (Empfehlung: ja)
3. Fähigkeitsseite auch auf Common-Würfeln? (Empfehlung: ja, jeder Würfel bekommt eine)
4. Sollen bisherige Würfel die neuen Seiten auch bekommen? (Empfehlung: ja, die Seiten werden aus den Werten berechnet, nichts geht verloren, Lasuren bleiben auf ihrer Seite)
