# Holo-Chance und Gilded weekend: Vorschlag

Stand 07.11.2026, Fassung 2. Entschieden am 07.11.2026 („1 ok, 2 beides, 3 ja, 4 ja“): Holo 1 zu 500, Gilded weekend für Holo und Stil, Samstag und Sonntag nach UTC, Pinsel-Preise bleiben. Gebaut (Bild docs/entwuerfe/grosse-karte-und-gilded.png).

## 1 Wunsch (07.11.2026)

Nach dem Vergleich mit Gacha- und Sammelkartenspielen gewählt:
- **Möglichkeit 2:** Holo auf 1 zu 500, wie ein Shiny in Pokémon GO.
- **Möglichkeit 3:** ein Gilded weekend, aber nicht zu stark.

## 2 Wie es vorher war

- **Holo:** Die Hand wirft einen goldenen W10. Fällt 10, rollt groß der goldene W100, und bei 100 wird es Holo. Das ergab 1 zu 1000 je Zug.
- **Stil:** weißer W100 auf 100, dann der W20. Das ergibt 1 zu 100.
- **Pinsel:** Loaded brush wirft jeden Würfel der Hand zweimal, Dripping brush dreimal, der beste Wurf zählt.
- **Bei etwa 4 Zügen am Tag** kam im Schnitt alle 250 Tage ein Holo.

## 3 Gebaut

### 3.1 Holo 1 zu 500

Der goldene W100 macht Holo bei **99 oder 100**, nicht mehr nur bei 100. Der W10 bleibt bei 10.

- **Warum beim W100:** Der große goldene Wurf kommt weiter bei jedem zehnten Zug und bleibt besonders. Würde stattdessen der W10 schon bei 9 oder 10 treffen, käme der große Wurf bei jedem fünften Zug. Das wäre zu oft und würde das Ziehen bremsen.
- **Anzeige:** Über dem goldenen W100 steht „gold d100 · holo on 99–100“. Daneben wie bisher „so close“.
- **Stil bleibt** unter der Woche bei 1 zu 100.
- **Bisherige Holos** bleiben, wie sie sind. Auf der Karte steht jetzt „1 in 500“.

### 3.2 Gilded weekend

Samstag und Sonntag nach UTC, wie das Tagesblatt, trifft die Hand eine Zahl früher:
- **Holo:** goldener W100 auf **98 bis 100**, also das 1,5-Fache.
- **Stil:** weißer W100 auf **99 oder 100**, also doppelt (festgelegt am 07.11.2026, „beides“).

- **Wie stark:**
  - Übers Jahr gerechnet steigt die Holo-Chance um etwa 14 %, die Stil-Chance um etwa 29 %.
  - Seltenheit, Schutz vor Pech, Stil-W20 und Pinsel-Preise bleiben.
- **Anzeige:**
  - Im Startbild (über „Your dice“) und über „Dip the brush“ steht ein schmales goldenes Band: „Gilded weekend: style on 99–100, holo on 98–100 until Sunday midnight UTC“.
  - Der Satz unter den Pinseln nennt die Wochenend-Chancen.
  - Über dem goldenen W100 steht dann „holo on 98–100“.
  - Im Tagespost am Samstag und Sonntag gibt es eine goldene Zeile, im Spiel-Post wird die Zeile über dem Titel golden („Gilded weekend · style and holo come easier“).
- **Für alle Züge,** auch den freien Tageszug, die Startzüge und Blank canvas.
- **Der Server** entscheidet nach seiner Uhr (UTC), ob Wochenende ist. Die Anzeige zeigt nur, was gilt.

### 3.3 Zahlen

| Zug | Pigment | Holo unter der Woche | Holo am Wochenende | Stil unter der Woche | Stil am Wochenende |
| --- | --- | --- | --- | --- | --- |
| Plain brush | 100 | 0,20 % (1 zu 500) | 0,30 % (1 zu 333) | 1 % | 2 % |
| Loaded brush | 300 | 0,75 % | 1,12 % | 2 % | 4 % |
| Dripping brush | 700 | 1,59 % | 2,37 % | 3 % | 5,9 % |

- **Je 100 Pigment (Holo):** Plain 0,20 %, Loaded 0,25 %, Dripping 0,23 %. Die vollen Pinsel bleiben je Pigment etwa gleich gut, die Preise 300 und 700 passen weiter.
- **Bei etwa 4 Zügen am Tag** kommt im Schnitt etwa alle 4 Monate ein Holo, mit dem Wochenende etwa alle 3,5 Monate. Im ersten Monat bekommt etwa jeder Fünfte eines, vorher etwa jeder Neunte. Ein Stil kommt etwa alle 25 Tage, mit dem Wochenende etwa alle 19 Tage.
- **Holo hebt weiter die Seltenheit.** Dadurch kommen etwas mehr Würfel eine Stufe höher als bisher, im Schnitt einer mehr auf 1000 Züge. Für Markt und Galerie ist das kaum zu spüren.

### 3.4 Technik

- `HAND_AT` (Stil 100, Holo 99), `GILDED_AT` (Stil 99, Holo 98), `handAt(gilded)`, `isGilded(now)` in src/shared/dice.ts.
- `rollHand(rand, throws, gilded)` und `forcedHand(…, gilded)`: Reihenfolge der Zufallsaufrufe wie bisher, nur die Schwellen hängen am Wochenende.
- Server: `pullOne` nimmt `isGilded(d.now)`, PullResult `gilded`, DiceResponse `gilded`, PlayInfo `gilded`, SheetResponse `gilded` (nur im Post des laufenden Tages).
- Anzeige beim Ziehen nimmt Treffer aus dem Monster (Stil, Holo), die Schwelle nur für die Beschriftung.
- Pinsel-Chancen `style`, `holo`, `styleG`, `holoG` in `BRUSHES`, `brushOdds(b, gilded)`.
- Tests in tests/brush.test.ts und tests/dice.test.ts (Chancen, Schwellen, Wochenende, angezeigte Chancen gegen die Rechnung).

## 4 Entscheidungen (07.11.2026)

1. **Holo 1 zu 500 über den goldenen W100** (99 oder 100): ja.
2. **Gilded weekend:** für Holo (98 bis 100) und Stil (99 oder 100), beides.
3. **Wochenende Samstag und Sonntag nach UTC,** wie das Tagesblatt: ja.
4. **Pinsel-Preise** bleiben 300 und 700: ja.
