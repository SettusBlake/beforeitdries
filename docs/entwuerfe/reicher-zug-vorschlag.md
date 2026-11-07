# Reicher Zug: Vorschlag

Stand 07.11.2026, Fassung 2. Entschieden am 07.11.2026: Richtung A, Preise 300 und 700, Namen mit „brush“. Gebaut (Bild docs/entwuerfe/pinsel-im-spiel.png).

## 1 Wunsch (07.11.2026)

Man soll mehr Pigment für ein Monster ausgeben können, damit die Chance auf Holo und andere Stile etwas steigt.

## 2 Wie es vorher war

- **Zug:** 100 Pigment, der Zehnerzug 1000. Dazu gibt es einen freien Tageszug und die freien Startzüge.
- **Stil:** Die Hand wirft einen weißen W100. Fällt 100, entscheidet ein W20, welcher der 15 Stile es wird. Die Chance auf einen Stil liegt bei 1 zu 100.
- **Holo:** Dazu wirft die Hand einen goldenen W10. Fällt 10, kommt ein goldener W100, und bei 100 wird es Holo. Die Chance liegt bei 1 zu 1000. Nur Holo hebt die Seltenheit um eine Stufe.
- **Einnahmen:** etwa 250 bis 300 Pigment am Tag. Das sind 5 belohnte Duelle mit 25 bis 60, das Tagesblatt mit 40 und die Strähne mit bis zu 50.
- **Bei 100 Pigment je Zug** kostet ein Holo im Schnitt 100 000 Pigment, ein Stil 10 000.

## 3 Gebaut: drei Pinsel, mehr Würfe in einer Hand

Bei bezahlten Zügen wählt man den Pinsel. Ein vollerer Pinsel wirft jeden Würfel der Hand zwei- oder dreimal, der beste Wurf zählt. Alle Würfe sind beim Ziehen zu sehen, der zählende leuchtet.

| Pinsel | Pigment | Würfe je Würfel | Stil | Holo | Holo je 100 Pigment |
| --- | --- | --- | --- | --- | --- |
| Plain brush (wie vorher) | 100 | 1 | 1 % | 0,10 % | 0,10 % |
| Loaded brush | 300 | 2 | 2 % | 0,38 % | 0,13 % |
| Dripping brush | 700 | 3 | 3 % | 0,80 % | 0,11 % |

- **Was gleich bleibt:**
  - Die Seltenheit kommt weiter aus dem offenen W100, ebenso der Schutz vor Pech. Nur Holo hebt sie wie bisher.
  - Welcher Stil es wird, entscheidet weiter ein einziger W20. Seltene Stile bleiben selten.
- **Freie Züge** (Tageszug, Startzüge, leere Würfel) bleiben beim Plain brush.
- **Zehnerzug:** Der Pinsel gilt für alle zehn, also 1000, 3000 oder 7000 Pigment. Rare oder besser bleibt garantiert.
- **Bedienung:**
  - In „Your dice“ unter „Dip the brush“ steht eine Zeile mit den drei Pinseln (Name, Preis, Würfe). Der gewählte ist golden umrandet und bleibt auf dem Gerät gemerkt.
  - Die Knöpfe „Dip“ und „Dip ×10“ zeigen den Preis des gewählten Pinsels.
  - Darunter steht ein Satz, zum Beispiel „The hand throws twice, the best counts: style 2 %, holo 0.38 %.“
- **Beim Ziehen:**
  - Die Hand zeigt alle Würfe, zum Beispiel „hand 43 91 94 ✦10 ✦4 ✦7“. Der beste Wurf jeder Reihe bleibt hell, die anderen werden blass.
  - Bei einem Treffer verschwinden die blassen Würfe, der Treffer wird groß.
  - Beim goldenen W100 steht unter der Zahl „best of 3: 34 · 100 · 33“.
  - Nach dem Zug sagt die Übersicht zum Beispiel „Loaded brush: the hand threw 2 times, the best counted.“
- **Technik:**
  - Pinsel in `BRUSHES` (src/shared/dice.ts), Wurf `rollHand(rand, throws)`.
  - /api/dice/pull mit `brush`, PullResult mit `brush`, `hands`, `golds`, `goldD100s`.
  - Der Test-Knopf für Stil und Holo setzt den besten Wurf.
  - Der Plain brush würfelt genau wie vorher, also in derselben Reihenfolge.
- **Wirtschaft:**
  - Pigment wird zusätzlich ausgegeben. Das ist gut, weil sich bei Spielern, die viel spielen, Pigment ansammelt.
  - Pigment ist weiter nur zu verdienen, nie zu kaufen. Nur so bleibt es nach den Devvit-Regeln erlaubt.

## 4 Nicht gebaut: ein vorhandenes Monster vergolden

Die Hand würde für ein Monster, das man schon hat, noch einmal den goldenen W10 und den goldenen W100 werfen.

- **Dagegen:**
  - Holo hebt die Seltenheit, also würden vorhandene Decks mit genug Pigment stärker.
  - Ein Stil würde das bekannte Aussehen eines Monsters nachträglich ändern.
  - Preise und Herkunft im Markt würden weniger aussagen.
- **Stand:** nicht jetzt, höchstens später und nur für Holo, mit Obergrenze.

## 5 Nicht vorgeschlagen

- **Stil aussuchen:** Dann wären seltene Stile nichts Besonderes mehr.
- **Sicheres Holo ab einer Menge Pigment** (wie der Schutz vor Pech): Das macht Holo planbar und nimmt den Moment, in dem der goldene W100 fällt.

## 6 Entscheidungen (07.11.2026)

1. **Richtung:** A, mehr Würfe in einer Hand beim Ziehen.
2. **Preise:** 300 und 700.
3. **Zehnerzug:** mit Pinsel, 3000 und 7000. Nicht ausdrücklich beantwortet, gebaut nach Empfehlung.
4. **Variante B:** nicht jetzt. Nicht ausdrücklich beantwortet, gebaut nach Empfehlung.
5. **Namen:** mit „brush“: Plain brush, Loaded brush, Dripping brush.
