# Farbe und Aufwand nach Seltenheit: Vorschlag

Stand 10.11.2026, Fassung 1. Gewünscht: Die Monster sehen sich zu ähnlich und haben zu wenig Farben. Common soll einfarbig bleiben, höhere Seltenheiten dürfen mehr Farbe und Aufwand haben. Wartet auf Freigabe (Fragen in Abschnitt 5).

Entwurfsbild: docs/entwuerfe/farben-entwurf.png. Je Seltenheit dieselben neun Züge, oben wie bisher, unten neu. Gemalt mit dem echten Renderer, im Spiel ist es noch aus (Schalter `PALETTE` in src/client/renderer/watercolor.ts). Quelle tools/mockup/farben-entwurf.ts.

## 1 Wie heute gemalt wird

- **Eine Farbe für alles:** Körper, Glieder und alle Teile bekommen das Hauptpigment. Es gibt nur 8 Pigmente, der eigene Ton weicht höchstens 12 Grad ab.
- **Zweitpigmente kaum zu sehen:** 70 % der Monster haben ein oder zwei Zweitpigmente. Sie liegen nur als dünner Schleier über einem Teil des Körpers und verlaufen als Dunst aufs Papier.
- **Muster bei 40 %,** meist Ton in Ton.
- **Seltenheit ändert am Bild nichts:** nur das Papier dahinter ist anders. Ein Legendary ist so einfarbig wie ein Common.

## 2 Vorschlag: ein Farbplan je Seltenheit

Jede Seltenheit bekommt eine Farbe mehr und etwas mehr Aufwand. Die Form bleibt, wie sie ist.

| Seltenheit | Farben | Was dazukommt |
| --- | --- | --- |
| Common | 1 | Nur das Hauptpigment, kein Schleier mehr. Kleine Teile bei der Hälfte in einem dunkleren Ton. Muster nur Ton in Ton. |
| Uncommon | 2 | Die zweite Farbe sitzt deutlich: auf Gliedern und kleinen Teilen, auf einem großen Teil (oft der Kopf), als nasser Verlauf im Körper oder als Flecken. Glieder mit farbiger Spitze. |
| Rare | 3 | Dazu eine Akzentfarbe auf kleinen Teilen, im Muster und in der Iris. Muster bei 70 %. Schatten unten und ein ausgehobener heller Bauch. |
| Epic | 4 | Der Körper verläuft immer in eine Nachbarfarbe. Glieder und Details haben eigene Farben. Immer ein Muster, kräftigerer Schatten. |
| Legendary | 5 | Verlauf über das ganze Monster in drei Tönen, Akzentfarbe, Goldstaub und ein dünner Hof auf dem Papier. |

### Woher die Farben kommen

- **Farbe 1** ist immer das Hauptpigment. Es behält die größte Fläche, damit die Art erkennbar bleibt.
- **Zweitpigmente zuerst:** Hat das Monster Zweitpigmente, sind sie bis Rare die zweite und dritte Farbe. Ab Epic werden sie Akzente auf Gliedern und Details.
- **Sonst gemischte Töne:** Fehlt ein Zweitpigment, nehme ich eine Nachbarfarbe des Hauptpigments (40 bis 70 Grad daneben, wie nass in nass gemischt) oder die Gegenfarbe als Akzent. So entstehen auch Violett, Orange, Türkis und Grün, die es als Pigment nicht gibt.
- **Kein Schlamm:** Ein Verlauf zwischen Gegenfarben wird grau. Dann sitzt die zweite Farbe auf Gliedern und kleinen Teilen statt im Verlauf. Ab Epic verläuft der Körper deshalb immer in die Nachbarfarbe.
- **Kräftigkeit:** Jedes Monster hat eine eigene Lasurstärke (82 bis 118 %), damit zwei Monster derselben Farbe nicht gleich aussehen.

## 3 Was gleich bleibt

- **Nur Aussehen:** Werte, Würfelseiten, Zweitpigmente, Arten und Namen ändern sich nicht.
- **Form und Gesicht** bleiben genau gleich, der Plan hat einen eigenen Zufall aus dem Seed.
- **Generation 1** (alte Baupläne) bleibt pixelgleich, 144 von 144 Bildern im Vergleich.
- **Holo** hebt das Papier und damit auch den Farbplan um eine Stufe.
- **Die 15 Stile** malen wie bisher.
- **Malzeit:** im Schnitt 19 ms statt 28 ms je Bild, weil die alten Schleier wegfallen.

## 4 Was ich nicht angefasst habe

- **Formen:** Aufwendigere Formen für höhere Seltenheiten (mehr Schmuck wie Hörner, Kronen, Flügel) wären ein zweiter Schritt. Bei vorhandenen Monstern würde sich dabei die Form ändern.
- **Größe im Bild:** Viele Monster füllen das Blatt nur zur Hälfte. Das ließe sich getrennt ändern.

## 5 Fragen

1. Richtung so: Common einfarbig, je Seltenheit eine Farbe und mehr Aufwand dazu? Empfehlung: ja.
2. Für wen gilt es? A: alle Würfel mit den neuen Formen, auch vorhandene (wie damals bei 2b). B: nur neue Züge. Empfehlung: A, sonst sieht die Sammlung gemischt aus. Vorhandene Common verlieren dabei ihren Zweitfarben-Schleier.
3. Nur Aussehen, Regeln bleiben? Ein Common kann dann weiter eine Zweitfarbe auf den Würfelseiten haben, die man am Monster nicht sieht. Empfehlung: ja.
4. Legendary mit Goldstaub und Hof? Empfehlung: ja.
5. Selbst gemalte Monster bekommen den Farbplan auch, die 15 Stile bleiben? Empfehlung: ja.
6. Danach ein zweiter Schritt für die Formen (mehr Schmuck bei höheren Seltenheiten, Monster größer im Bild)? Empfehlung: erst die Farbe am Handy ansehen, dann entscheiden.
