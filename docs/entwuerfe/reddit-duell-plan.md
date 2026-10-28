# Plan: Farbschlacht als Reddit-Spiel, mit Seltenheiten und Gacha

Stand 28.10.2026. Vorschlag, nichts davon ist gebaut. Wartet auf Freigabe, Fragen am Ende.

## Rückmeldung zur animierten Fassung

- Vom Gefühl her ok.
- Man versteht nicht, was passiert und warum man sich nicht bewegen kann.
- Vielleicht zu lang für Reddit.
- Grafisch muss es viel besser werden.
- Würfel brauchen Seltenheiten, alles zufällig mit einem Gacha-System.
- Als Reddit-Spiel bauen, um dort zu testen.

## 1. Verständlicher

Reddit verlangt fürs Featuring, dass ein Spiel ohne Erklärung verständlich ist (Analyse in SettusBlake/RedditGame).

Warum man sich oft nicht bewegen konnte: Bewegen kostete ein Step-Symbol, und Kleckse durften nur durch Farbe laufen. Beides sieht man nicht.

Vorschlag:

- **Bewegen kostet nichts.** Jeder Klecks darf sich einmal pro Zug bewegen. Ein Step-Symbol gibt stattdessen +2 Reichweite für einen Klecks.
- **Blankes Papier ist begehbar, kostet aber 2.** Eigene Farbe kostet 1, fremde 2, Schlamm hält fest. Farbe bleibt damit der schnelle Weg, aber niemand steckt fest.
- **Geführtes erstes Duell:** feste Würfe, Sepia zeigt mit einem Pfeil, was man antippen soll, nur ein Knopf ist jeweils aktiv. Danach normale Duelle.
- **Gesperrtes sagt, warum:** ein grauer Knopf zeigt direkt, was fehlt („needs 1 Brush“).

## 2. Kürzer für Reddit

Reddit-Spiele leben von kurzen, täglichen Sitzungen. Das Duell dauert jetzt etwa 10 bis 15 Minuten.

Vorschlag „Quick duel“ als Standard:

- 6 Runden statt 8.
- Blatt 7 × 7 statt 7 × 9, die Paletten liegen näher beieinander.
- Animationen etwas schneller.
- Ziel: 4 bis 6 Minuten. Nach dem Test entscheiden, ob es zusätzlich ein langes Duell gibt.

## 3. Seltenheiten und Gacha

**Seltenheit kommt vom Papier.** Jedes Monster würfelt sein Papier schon heute mit Gewichten. Das wird die Seltenheit des Würfels. Für die höchste Stufe kommen seltene Papiere dazu (festgelegt am 28.10.2026). Sie werden getrennt gewürfelt, damit bestehende Kleckse gleich aussehen.

| Seltenheit | Papier | Chance | Was der Würfel hat |
|---|---|---|---|
| Common | Student Paper | 50 % | sechs normale Seiten |
| Uncommon | Drawing Paper | 30 % | eine Seite doppelt |
| Rare | Handmade Paper | 15 % | dazu eine Joker-Seite (Stern beliebiger Stufe oder Symbol nach Wahl) |
| Epic | Cotton Rag | 4 % | zwei besondere Seiten, Rand mit Büttenkante |
| Legendary | seltenes Papier (z. B. Washi, Blattgold) | 1 % | eine eigene Seite und ein eigener Look des Papiers |

Höheres Papier hebt schon heute die Obergrenze der Werte. Die Würfelseiten kommen aus den Werten, also wird ein seltener Würfel auch etwas stärker.

**Gacha „Dip the brush“:**

- **Ein Zug:** Ein Tropfen fällt aufs Blatt und blüht zu einem Klecks auf. Die Seltenheit wird offen gewürfelt (W100 mit sichtbaren Grenzen), passend zu „Würfe sind sichtbar“. Alle Würfe am Server.
- **Währung Pigment:** gibt es nur durchs Spielen, nie für Geld.
  - einmal am Tag ein freier Zug
  - Duelle, gewonnen mehr als verloren
  - der Tagesklecks und das Benennen von Arten
- **Zehnerzug:** mindestens ein Rare garantiert.
- **Schutz vor Pech:**
  - spätestens jeder 10. Zug Rare oder besser
  - spätestens jeder 40. Zug Epic
  - spätestens nach 90 Zügen Legendary
- **Doppelte Art** (gleicher Bauplan und Hauptpigment) wird zu Lasur für diese Art. Damit verändert man Würfelseiten, wie am 28.10.2026 festgelegt.
- **Wochenbanner:** ein Pigment oder Bauplan mit höherer Chance, passend zum Kapitel-Post der Woche.
- **Der Tagesklecks bleibt** und ist für alle gleich, die Seltenheit würfelt jeder selbst.
- **Kein Pay-to-win.** Echtes Geld höchstens später für Kosmetik, wenn überhaupt.

## 4. Grafik

Vor dem Umbau zeige ich ein Entwurfsbild (PNG) des Duells im neuen Look, erst nach deiner Freigabe wird gebaut. Ideen:

- Größere Kleckse, weniger Text und Zahlen auf dem Schirm.
- Das Blatt als echtes Papier mit Büttenrand und Klebeband statt eines Gitters.
- Bedienung als gemalte Pinselstriche statt grauer Kästen.
- Würfel aus Porzellan mit gemalten Symbolen.
- Kräftigere Effekte: Tinte blüht, Spritzer laufen aus.

## 5. Ablauf auf Reddit

Bleibt bei Devvit Web mit unserem eigenen Canvas-Renderer, wie festgelegt (kein Phaser). Jeder Schritt endet mit Upload in den Playtest und einem Test am Handy.

1. **Duell in der App, Server würfelt.**
   - Die Regeln wandern nach src/shared/duel. Der Server führt Würfe, Gegnerzüge und Prüfungen aus und schickt Ereignisse zurück.
   - Der Client spielt die Ereignisse mit den Animationen ab, die es schon gibt.
   - Der Zustand des Duells liegt in Redis. Fürs Erste bekommt jeder Spieler einen zufälligen Startbeutel mit 6 Würfeln. Ein Knopf „Duel“ im Spiel.
2. **Verständlicher und kürzer**, nach deinen Antworten zu 1 und 2.
3. **Seltenheiten und Gacha:**
   - Sammlung der Würfel, eigener Beutel aus 6 Würfeln
   - Ziehen mit Animation, Pigment und Schutz vor Pech
4. **Grafik**, nach Freigabe des Entwurfsbilds.
5. **Reddit-Funktionen:**
   - täglicher Rivale als Post mit Bestenliste
   - Ergebnis teilen
   - Join-Knopf nach dem ersten Sieg

## Fragen

1. Passen Plan und Reihenfolge?
2. Bewegen frei und Papier begehbar (Empfehlung), oder nur durch Farbe wie bisher?
3. Quick duel mit 7 × 7 und 6 Runden als Standard?
4. Seltenheiten und Gacha so (Stufen, Chancen, Schutz vor Pech, Pigment nur erspielt, Doppelte werden Lasur)?
5. Grafik: Was stört dich am meisten? Gibt es ein Spiel, dessen Look dir gefällt?
6. „Engine dort“: Devvit Web mit unserem Canvas (Empfehlung), oder meintest du etwas anderes, z. B. Phaser?
