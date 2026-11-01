# Vorschlag: Elemente (Schere-Stein-Papier in Malersprache)

Stand 01.11.2026, Fassung 1. Wartet auf Freigabe.

Wunsch (01.11.2026): Jedes Monster bekommt ein Element (Blitz, Wasser, Feuer, Erde, Holz, Metall …) mit Namen aus der Farb- und Malersprache. Die Elemente schlagen sich wie bei Schere-Stein-Papier, der Treffer macht dann 1,25- bis 2-fachen Schaden.

Entwurf: docs/entwuerfe/elemente-entwurf.png (Quelle tools/mockup/elemente-entwurf.ts, echte Kleckse aus dem Spiel).

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
- **Keine Schwäche:** In Variante A gibt es kein ×0,75, wenn man gegen das „falsche“ Element spritzt. Jedes Element hat nur Vorteile, das ist leichter zu merken.

## 3 Woher das Element kommt

- **Eigener Wurf:** Jedes Monster würfelt sein Element beim Entstehen (1 zu 6, eigener Zufall aus dem Seed). Jedes Pigment und jede Form kann jedes Element tragen.
- **Bisherige Monster** bekommen ihr Element ebenfalls aus dem Seed. Niemand verliert etwas.
- **Gemalte Monster** (Blank canvas) würfeln es genauso.

## 4 Was es im Kampf ändert

- **Nur Spritzer auf Kleckse** bekommen den Element-Multiplikator. Palettentreffer und Stempeln bleiben gleich.
- **Der versteckte Farbkreis fällt beim Spritzen weg.** Heute trifft eine Gegenfarbe ×1,5 und eine Nachbarfarbe ×0,75, ohne dass man das sieht. Das Element ersetzt diese Regel. Auf dem Blatt bleibt der Farbkreis für Lasur, Verlaufen und Schlamm.
- **Zusammen mit Glaze und Pure** wird multipliziert: Wash gegen Vermilion mit Glaze ist ×2 ×1,5 = ×3.
- **Rivale und Sepia** wählen ihre Ziele schon nach dem Schaden, sie berücksichtigen das Element dann von selbst.

## 5 Anzeige

- **Abzeichen** mit Zeichen und Namen auf der Würfelkarte, in der Sammlung, im Markt und am Sockel des Kleckses auf dem Blatt. Antippen zeigt den Ring.
- **Vorschau beim Zielen:** „-18 (9 ×2, Wash puts out Vermilion)“.
- **Beim Treffer:** Schild „WASH ▸ VERMILION ×2“, darunter die Rechnung, die hochzählt („9 ×2 = 18“, mit Glaze „9 ×2 ×1.5 = 27“).
- **Hilfe** mit dem Ring, Sepia erklärt es im Lern-Duell.
- **Markt:** Filter nach Element.

## Simulation (Probe, zurückgesetzt)

300 Duelle je Gegner und Variante. Der Spieler spielt wie der Computer.

| Variante | Geselle | Meister | Galerie | Schaden je Duell gegen den Meister (du / Rivale) |
|---|---|---|---|---|
| heute (Farbkreis ×1,5 / ×0,75) | 94 % | 40 % | 71 % | 72 / 94 |
| **A: nächstes ×2, übernächstes ×1,25** | 96 % | 40 % | 72 % | 75 / 97 |
| B: nächstes ×1,5, übernächstes ×1,25 | 96 % | 40 % | 76 % | 73 / 95 |
| C: wie A, rückwärts ×0,75 | 96 % | 42 % | 72 % | 71 / 95 |

- **Gleichgewicht:** bleibt in allen Varianten.
- **Dauer:** gleich (5,1 bis 5,5 Züge pro Seite).
- **A** bringt etwas mehr Schaden und deutlich mehr Entscheidung beim Zielen, weil ein ×2-Ziel oft einen Klecks auf einen Schlag auswäscht.

## Reihenfolge nach Freigabe

1. **Regeln und Server:** Element aus dem Seed, Ring, Multiplikator statt Farbkreis beim Spritzen, Rivale. Tests und Simulation.
2. **Anzeige:** Abzeichen überall, Vorschau, Schild und Rechnung beim Treffer, Hilfe, Markt-Filter. Upload mit Bild.
3. **Lern-Duell:** Sepia erklärt den Ring an einem Treffer mit ×2.

## Fragen

1. Sechs Elemente mit diesen Namen (Wash, Vermilion, Gilt, Sap, Ochre, Fluoro)? Oder andere Namen, oder mehr Elemente? (Empfehlung: diese sechs)
2. Stärke: A (×2 und ×1,25), B (×1,5 und ×1,25) oder C (wie A, dazu rückwärts ×0,75)? (Empfehlung: A)
3. Das Element ersetzt beim Spritzen den versteckten Farbkreis (Gegenfarbe ×1,5, Nachbarfarbe ×0,75)? Der Farbkreis bleibt nur für Farbe auf dem Blatt. (Empfehlung: ja)
4. Element als eigener Wurf je Monster (1 zu 6, unabhängig von Pigment und Form), auch für bisherige Monster? (Empfehlung: ja)
5. Mit Glaze und Pure multiplizieren (bis ×4 bei Pure gegen das richtige Element)? (Empfehlung: ja, die Simulation zeigt kein Ungleichgewicht)
