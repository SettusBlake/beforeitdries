# Vorschlag: Elemente (Schere-Stein-Papier in Malersprache)

Stand 01.11.2026, Fassung 1. Freigegeben am 01.11.2026 („passt“, alle fünf Empfehlungen). Gebaut, Bild docs/entwuerfe/elemente-im-spiel.png.

Wunsch (01.11.2026): Jedes Monster bekommt ein Element (Blitz, Wasser, Feuer, Erde, Holz, Metall …) mit Namen aus der Farb- und Malersprache. Die Elemente schlagen sich wie bei Schere-Stein-Papier, der Treffer macht dann 1,25- bis 2-fachen Schaden.

Entwurf: docs/entwuerfe/elemente-entwurf.png (Quelle tools/mockup/elemente-entwurf.ts, echte Kleckse aus dem Spiel). Code: src/shared/elements.ts (Ring, Wurf, Multiplikator), src/client/duel/elements.ts (Zeichen, Abzeichen, Ring-Bild).

## 1 Sechs Elemente

| Element | Name im Spiel | Malerbild |
|---|---|---|
| Wasser | **Wash** | eine nasse Lavierung |
| Feuer | **Vermilion** | Zinnoberrot, das feurige Rot |
| Metall | **Gilt** | Blattgold |
| Holz | **Sap** | Saftgrün |
| Erde | **Ochre** | die Erdfarben |
| Blitz | **Fluoro** | leuchtende Fluoreszenzfarben |

- **Jedes Element hat ein eigenes Zeichen und eine eigene Farbe** auf dem Abzeichen (Tropfen, Flamme, Barren, Blatt, Berg, Blitz).
- **„Burnt“ für Feuer** habe ich verworfen, weil man es mit dem Pigment Burnt Sienna verwechselt (es gibt Kleckse namens „Burnt Quadruped“).

## 2 Der Ring

Die sechs stehen in einem Ring. Jedes schlägt das nächste hart und das übernächste ein wenig:

| Element | schlägt hart (×2) | schlägt ein wenig (×1,25) |
|---|---|---|
| Wash | löscht Vermilion | lässt Gilt rosten |
| Vermilion | schmilzt Gilt | verbrennt Sap |
| Gilt | schneidet Sap | gräbt Ochre um |
| Sap | sprengt Ochre (Wurzeln) | saugt Fluoro auf |
| Ochre | erdet Fluoro | dämmt Wash |
| Fluoro | schlägt in Wash ein | überstrahlt Vermilion |

- **Alles andere** trifft normal (×1).
- **Keine Schwäche (Variante A):** kein ×0,75 gegen das „falsche“ Element.

## 3 Woher das Element kommt

- **Eigener Wurf:** Jedes Monster hat sein Element aus dem Seed (1 zu 6, eigener Zufall, kein anderer Wurf verschiebt sich). Jedes Pigment und jede Form kann jedes Element tragen.
- **Bisherige Monster** haben ihr Element ebenfalls aus dem Seed. Niemand verliert etwas.
- **Gemalte Monster** (Blank canvas), Galerie-Decks, Archiv-Würfel und der Rivale genauso.

## 4 Was es im Kampf ändert

- **Nur Spritzer auf Kleckse** bekommen den Element-Multiplikator, auch Meisterzüge und Abgänge, die treffen. Palettentreffer und Stempeln bleiben gleich.
- **Der versteckte Farbkreis fällt beim Spritzen weg** (früher Gegenfarbe ×1,5, Nachbarfarbe ×0,75). Auf dem Blatt bleibt der Farbkreis für Lasur, Verlaufen und Schlamm.
- **Abfärben:** Früher färbte ein Treffer mit der Gegenfarbe den Getroffenen ab. Jetzt färbt ein harter Element-Treffer (×2) ab.
- **Zusammen mit Glaze und Pure** wird multipliziert: Wash gegen Vermilion mit Glaze ist ×2 ×1,5 = ×3.
- **Rivale und Sepia** wählen Ziele nach dem Schaden, sie berücksichtigen das Element dadurch von selbst.

## 5 Anzeige

- **Zeichen am Sockel** jedes Kleckses auf dem Blatt, links unten.
- **Zeichen auf den Chips:** in deinem Deck und bei den Würfeln des Rivalen oben.
- **Abzeichen** auf der Karte im Duell (antippen zeigt den Ring, wen es schlägt, wer es schlägt und welche Ziele auf dem Blatt gerade gut sind, die dann aufleuchten), auf der Würfelkarte in Sammlung, Markt und Tausch mit einer Zeile dazu.
- **Werte-Teil der Karte:** Die Zeile „Colour“ mit Gegen- und Nachbarfarben ist durch „Element“ ersetzt.
- **Kacheln** in Sammlung und Markt mit kleinem Zeichen.
- **Vorschau beim Zielen:** „-11 (9 ×1.25), Vermilion burns Sap ×1.25“.
- **Beim Treffer:** Schild „WASH ▸ VERMILION ×2“ in der Farbe des Angreifers, darunter die Rechnung, die hochzählt („9 ×2 = 18“, mit Glaze „9 ×2 ×1.5 = 27“).
- **Hilfe** mit dem Ring, Sepia erklärt Elemente im Lern-Duell beim ersten Spritzer auf einen Klecks.
- **Markt:** Filter je Element.

## Simulation

Probe vor dem Bau, 300 Duelle je Gegner und Variante. Der Spieler spielt wie der Computer.

| Variante | Geselle | Meister | Galerie | Schaden je Duell gegen den Meister (du / Rivale) |
|---|---|---|---|---|
| vorher (Farbkreis ×1,5 / ×0,75) | 94 % | 40 % | 71 % | 72 / 94 |
| **A: nächstes ×2, übernächstes ×1,25 (gebaut)** | 96 % | 40 % | 72 % | 75 / 97 |
| B: nächstes ×1,5, übernächstes ×1,25 | 96 % | 40 % | 76 % | 73 / 95 |
| C: wie A, rückwärts ×0,75 | 96 % | 42 % | 72 % | 71 / 95 |

Mit den eingebauten Regeln (400 Duelle je Gegner): Geselle 96 %, Meister 42 %, Galerie 74 %. Dauer gleich (5,1 bis 5,5 Züge pro Seite).

## Reihenfolge

1. **Regeln und Server:** gebaut. DUEL_PROTOCOL 17, Speicherstand v7 (laufende Duelle werden verworfen).
2. **Anzeige:** gebaut.
3. **Lern-Duell:** gebaut (Sepia erklärt den Ring, neuer Seed, weil sich der Schaden geändert hat).

## Fragen (beantwortet am 01.11.2026, „passt“)

1. Sechs Elemente mit diesen Namen (Wash, Vermilion, Gilt, Sap, Ochre, Fluoro)? **ja**
2. Stärke A, B oder C? **A**
3. Das Element ersetzt beim Spritzen den versteckten Farbkreis? **ja**
4. Element als eigener Wurf je Monster, auch für bisherige? **ja**
5. Mit Glaze und Pure multiplizieren? **ja**
