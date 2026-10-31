# Vorschlag: Werte auf der Würfelkarte in Spielworten

Stand 31.10.2026, Fassung 1. Wartet auf Freigabe.

Anlass (31.10.2026): Frage „Haben Monster unterschiedliche Werte, die das Spiel beeinflussen?“ Ja, alle sechs Werte wirken im Duell. Die Karte zeigt aber nur Kürzel mit Zahl (SAT 29, OPA 24 …). Was sie bewirken, steht verstreut in den Regeln im Menü.

Entwurf: docs/entwuerfe/karte-werte-entwurf.png (heute, Vorschlag in der Sammlung, aufgeklappte Erklärung, Karte im Duell).

Der Entwurf steckt im Code, ist im Spiel aber aus (Schalter `STATS2` in src/client/duel/statcard.ts, Rechnung in src/shared/duel/statinfo.ts).

## Gemessen: wie verschieden die Werte sind

20 000 Züge, Werte und ihre Wirkung gegen einen durchschnittlichen Klecks:

| Wert | schwächste 10 % | Mitte | stärkste 10 % | Wirkung (schwach / Mitte / stark) |
|---|---|---|---|---|
| Sättigung | 15 | 24 | 34 | Spritzschaden 8 / 10 / 13, voller Treffer 52 / 62 / 70 % |
| Deckkraft | 15 | 25 | 34 | Lebenskraft 15 / 18 / 21 |
| Körnung | 13 | 23 | 32 | Spritzer streifen ihn nur 30 / 38 / 43 % |
| Fluss | 12 | 21 | 30 | Ausweichen 3 / 5 / 7,5 %, nasse Farbe verläuft 30 / 53 / 75 %, Reichweite meist 3 (20 % haben 2, 13 % haben 4) |
| Leuchten | 14 | 24 | 34 | nur über Glow-Seiten auf dem Würfel |
| Lichtechtheit | 11 | 20 | 29 | hält dem Radierer 25 / 35 / 45 % stand |

- Stufe 1, 2 und 3 kommen je etwa zu einem Drittel vor.
- Spürbar sind die Werte bei Schaden, Lebenskraft, Treffern und Verlaufen. Kaum spürbar beim Ausweichen und bei der Reichweite.
- Die größten Unterschiede machen Würfelseiten, Bauplan, Farbe und Seltenheit (siehe Frage 5).

## Vorschlag

### A Werte als Wirkung

Je Wert eine Zeile: Name ausgeschrieben, Zahl, Balken, Wirkung.

- **Saturation:** Splash 11 · full hit 63%
- **Opacity:** Life 18 · covers dry paint 48%
- **Grain:** Splashes graze it 38% · its paint holds 62%
- **Flow:** Reach 3 · dodge 6% · wet paint spreads 63% (Turm: Never moves)
- **Glow:** Glow on 1 face (bei Doppelseiten „1 face (2 Glow)“)
- **Lightfast:** Escapes the eraser 45%

Gerechnet wird gegen einen durchschnittlichen Klecks (Mitte aller Werte). Eigenschaften und Gangart sind eingerechnet, zum Beispiel Fugitive +2 Schaden, Twin, Fast, Granulating, Alcohol.

### B Balken

- Die Länge zeigt, wie viele Kleckse einen kleineren Wert haben.
- Ab 90 % steht „top 10%“ in Gold daneben.
- Schwache Werte bekommen keine eigene Markierung.

### C Antippen erklärt

Eine Zeile antippen klappt die Rechnung in ein bis zwei Sätzen auf: die Formel und wofür der Wert sonst noch zählt, zum Beispiel für Würfelseiten.

### D Stufe und Farbe

- **Darüber eine Zeile zur Stufe:** „Level 2 · stat total 118 · Level 3 at 123“. Antippen erklärt, wie die Stufe entsteht und was sie bewirkt.
- **Darunter die Farbe:** gegen welche Pigmente Treffer ×1,5 zählen (in beide Richtungen, und sie färben) und gegen welche ×0,75.
- **Dazu der Set-Bonus** der Farbfamilie (warm, kalt, Erde).

### E Im Duell

- Dieselbe Karte mit dem, was gerade gilt: Stufe des Rivalen (Lehrling Werte × 0,65 bis Meister × 1,15) und der Set-Bonus auf dem Blatt.
- Der Gegner in der Rechnung bleibt der durchschnittliche Klecks.

### Nebenbei

Die Kopfzeile der Karte im Duell bricht auf dem Handy unschön um („Level 1 · Rare · rival · in the bag“, im Entwurfsbild rechts zu sehen). Sie wird mit behoben.

### Später, nicht in diesem Schritt

- **Vergleich mit einem Ziel:** Einen Klecks des Rivalen antippen zeigt dann zum Beispiel „your Carmine Tower: 10 · full hit 50% · washes out in 2“.
- **Sammlung sortieren** nach einem Wert.

## Was gleich bleibt

Regeln und Werte ändern sich nicht, es ist nur Anzeige. DUEL_PROTOCOL bleibt bei 13.

## Reihenfolge

Ein Schritt: Schalter an, Kopfzeile im Duell beheben, auf 360 Pixeln prüfen, Upload mit Bild.

## Fragen

1. A bis E so? (Empfehlung: ja)
2. Wirkung gegen einen durchschnittlichen Klecks, im Duell auch? Die Alternative wäre, im Duell gegen die echten Kleckse des Gegners zu rechnen. (Empfehlung: durchschnittlich, dann ist es überall gleich vergleichbar. Der Vergleich mit einem Ziel kommt später)
3. Die Zahl des Werts neben der Wirkung behalten? (Empfehlung: ja, Sammler vergleichen Zahlen)
4. Wo auf der Karte in der Sammlung? Heute steht der Block unter „Put in deck“ und dem Benennen-Feld. Die Alternative ist direkt unter „Put in deck“, also vor dem Benennen-Feld. (Empfehlung: vor das Benennen-Feld, die Werte braucht man zum Entscheiden, das Benennen einmal)
5. Ausweichen (3 bis 7,5 %) und Reichweite (meist 3) unterscheiden sich kaum zwischen Monstern. Sollen die Werte stärker wirken? (Empfehlung: erst anzeigen und spielen, nach deiner Rückmeldung einen eigenen Vorschlag mit Simulation)
