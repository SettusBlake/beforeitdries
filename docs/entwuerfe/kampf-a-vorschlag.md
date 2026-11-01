# Vorschlag: Kampf A, Farbseiten, Farb-Kombis, Nässe

Stand 01.11.2026, Fassung 1. Wartet auf Freigabe.

Anlass (01.11.2026): Kampf-Brainstorming, Abgleich in docs/entwuerfe/kampf-brainstorming-abgleich.md. Entschieden „Empfehlungen umsetzen“:
- **Weg C:** erst A (Umbau im Wurf, das Duell bleibt), danach B (Modus „Bleach“).
- **Farbe zusätzlich zum Symbol**, im Duell weiter 3 Würfel je Wurf.
- **Nässe** statt festem Neuwurf.
- **Beute** zum Lasieren zusätzlich zum Auswaschen.
- **Werte** bleiben, wie sie sind.
- **Kürzer** erst nach A messen, den Ergebnis-Post gibt es mit B.

Dieses Dokument macht A konkret: Regeln, Simulation, Reihenfolge.

Entwurf: docs/entwuerfe/kampf-a-entwurf.png (Quelle tools/mockup/farbwurf-entwurf.ts, echte Würfel aus dem Spiel).

## Regeln

### 1 Jede Seite bekommt eine Farbe

- **Farbe der Symbolseiten** (Step, Splash, Guard, Glow, Gold): Sie tragen das Hauptpigment des Kleckses oder, bei etwa jeder dritten Seite, seine Zweitfarbe. Die Farbe ist fest, eigener Zufall aus dem Seed, der Würfelzufall bleibt unberührt.
- **Sterne und Joker** bleiben ohne Farbe.
- **Die Symbole behalten ihre Aufgabe:** Step bewegt, Splash trifft die Palette, Guard halbiert einen Treffer, Glow füllt die Sättigung.
- **Bisherige Würfel** bekommen ihre Farben aus ihrem Seed, ohne etwas zu verlieren.

### 2 Kombis aus der Farblehre

Sie ersetzen Paar, Drilling und Regenbogen. Es zählen nur farbige Seiten, ein Joker zählt als jede Farbe.

| Kombi | Wurf | Wirkung | Anteil der Würfe |
|---|---|---|---|
| Pure (rein) | drei Seiten eines Pigments | ×2 auf jeden Spritzer in diesem Zug, dazu ein Joker | 1 % |
| Burst (Ausbruch) | zwei Gegenfarben | ×2, aber mit 35 % Schlamm: beide Seiten zählen nichts, kein Multiplikator | 13 bis 19 % |
| Glaze (Lasur) | zwei Seiten eines Pigments | ×1,5 | 11 bis 14 % |
| Chain (Kette) | zwei Nachbarfarben im Farbkreis | ×1,25, jeder Treffer in diesem Zug +0,25 | 9 bis 12 % |
| Three stars | drei Sterne gleicher Stufe | ein Joker (wie heute) | 12 bis 18 % |

- **Reihenfolge**, wenn mehrere passen: Pure, Burst, Glaze, Chain, drei Sterne.
- **Dieselbe Farblehre wie auf dem Blatt:** gleiches Pigment lasiert, Nachbarn verlaufen, Gegenfarben machen Schlamm.
- **Insgesamt** gibt es in 50 bis 55 % der Würfe eine Kombi, heute sind es 45 bis 50 %.
- **Der Multiplikator gilt nur für Spritzer** auf Kleckse. Palettentreffer bleiben ein Herz, Stempeln bleibt, wie es ist.
- **Die bisherigen +1 und +2 Symbole aus Paar und Drilling fallen weg.** Der Multiplikator ersetzt sie.

### 3 Nässe statt festem Neuwurf

Man darf bis zu viermal neu werfen. Der erste Neuwurf bleibt trocken (wie heute), jeder weitere macht das Blatt nasser:

| Neuwurf | 1. | 2. | 3. | 4. |
|---|---|---|---|---|
| Chance je Nachbarpaar, dass es ausblutet | 0 % | 25 % | 50 % | 75 % |

- **Was Ausbluten heißt:** Nach jedem Neuwurf prüft der Server jedes Paar nebeneinander liegender Würfel, auch gehaltene.
  - **Nachbarfarben oder gleiches Pigment blühen:** Die rechte Seite nimmt die Farbe der linken an. Das kann eine Kette zur Lasur machen.
  - **Gegenfarben werden Schlamm:** Beide Seiten zählen in diesem Wurf nichts, auch eine gehaltene.
  - **Neutrale Farben** berühren sich nur. Sterne und Joker sind trocken und bluten nie.
- **Anzeige:** Tropfen am Neuwurf-Knopf mit der Chance für den nächsten Neuwurf.
- **In der Simulation** blutet selten etwas aus, weil der Computer nur ohne Kombi ein zweites Mal wirft. Die Nässe ist vor allem die Entscheidung für Spieler, die auf Pure gehen. Nach dem Handytest lässt sich die Stufe nachstimmen.

### 4 Sichtbare Rechnung

- **Combo-Banner:** Es nennt Kombi, Farbe und Multiplikator („GLAZE · ULTRAMARINE ×1.5“). Der Multiplikator steht bis zum Zugende oben am Stand.
- **Jeder Spritzer** zeigt Basis, Multiplikator und Ergebnis und zählt hoch („10 × 1.5 = 15“). Bei der Kette wächst der Multiplikator sichtbar mit jedem Treffer.

### 5 Beute: Tropfen

- **Tropfen sammeln:** Jeder ausgewaschene Klecks des Rivalen hinterlässt einen Tropfen seines Hauptpigments. Ein Sieg gibt einen Tropfen dazu, das Pigment eines eigenen Würfels aus dem Deck, zufällig.
- **Umfärben:** Auf der Würfelkarte färbt man eine Seite für 3 Tropfen in dieses Pigment um. So baut man ein Deck, das öfter Pure wirft.
- **Doppelt machen** bleibt bei der Lasur aus dem Auswaschen.
- **Neuer Spielstand:** `drops`, je Pigment. Umfärbungen stehen wie Lasuren in `mods` und gelten auch im Galerie-Abzug und beim Tausch.

### Malmittel und Sepias Auftrag

- **Sponge:** Die ersten zwei Neuwürfe sind trocken, statt ein Neuwurf mehr.
- **Masking Fluid:** Gehaltene Würfel bluten nicht aus, zusätzlich zur heutigen Wirkung.
- **Iridescent Medium:** gibt bei jeder Kombi weiter +1 Symbol.
- **Sepias Auftrag:** „three colours“ heißt künftig „three symbols“. Neu dazu kommt „two of one pigment“.

## Simulation

200 Duelle je Gegner. Der Spieler spielt wie der Computer, der höchstens zweimal neu wirft und den zweiten Neuwurf nur ohne Kombi wagt.

| Gegner | Siegquote heute | mit A | Ende über die Palette heute | mit A | Schaden je Duell heute (du / Rivale) | mit A |
|---|---|---|---|---|---|---|
| Geselle | 93 % | 98 % | 66 % | 56 % | 64 / 19 | 75 / 20 |
| Meister | 41 % | 42 % | 57 % | 49 % | 59 / 75 | 59 / 80 |
| Galerie (gleich stark) | 64 % | 65 % | 52 % | 45 % | 68 / 57 | 73 / 59 |

- **Gleichgewicht:** bleibt, gegen den Geselle wird es etwas leichter.
- **Ausgang:** Duelle enden öfter über das Papier, seltener über die Palette.
- **Schlamm aus dem Ausbruch:** etwa 0,4 bis 0,5 Mal pro Duell und Seite.
- **Dauer:** gleich (5,2 bis 5,5 Züge pro Seite, gemessen 2,6 Minuten reine Abspielzeit). Kürzer machen erst nach dem Handytest, wie entschieden.

## Was sonst noch zu tun ist

- **Rivale:** hält Farben, die zueinander passen, und wagt den zweiten Neuwurf nur ohne Kombi (in der Probe schon so).
- **Lern-Duell:** neue feste Würfe, die eine Farb-Kombi und einen Neuwurf zeigen. Sepia erklärt Farbe, Kombi und Nässe.
- **Hilfe** im Menü neu.
- **Versionsprüfung:** DUEL_PROTOCOL wird 15. Laufende Duelle werden verworfen, wie beim Brett 6 × 8.

## Reihenfolge

1. **Regeln und Server:**
   - Farben, Kombis, Nässe, Multiplikator, Schlamm, Kette
   - Rivale, Malmittel, Sepias Auftrag
   - Tests und Simulation
   - Upload
2. **Anzeige:**
   - Farbige Seiten auf Würfeln, Chips und Karten
   - Tropfen am Neuwurf
   - Ausbluten und Schlamm auf der Würfelbühne
   - Combo-Banner, hochzählende Spritzer, Multiplikator am Stand
   - Upload mit Bild
3. **Lern-Duell und Hilfe:** Upload.
4. **Tropfen und Umfärben:** Server, Karte, Ergebnisbild. Upload mit Bild.

Danach der Plan für B (Bleach).

## Fragen

1. Kombis und Werte wie in der Tabelle (Pure ×2 und Joker, Burst ×2 mit 35 % Schlamm, Glaze ×1,5, Chain ×1,25 und +0,25 je Treffer, drei Sterne Joker)? (Empfehlung: ja)
2. Nässe mit 0, 25, 50 und 75 % je Nachbarpaar, höchstens 4 Neuwürfe? (Empfehlung: ja, nach dem Handytest nachstimmen)
3. Multiplikator nur auf Spritzer gegen Kleckse? (Empfehlung: ja)
4. Tropfen: je ausgewaschenem Rivalen-Klecks einer seines Hauptpigments, ein Sieg einer dazu? (Empfehlung: ja)
5. Umfärben für 3 Tropfen in jedes Pigment, von dem man Tropfen hat (auch in eines, das der Klecks sonst nicht hat)? (Empfehlung: ja)
6. Sponge: die ersten zwei Neuwürfe trocken. Masking Fluid: gehaltene Würfel bluten nicht? (Empfehlung: ja)
7. Sepias Auftrag: „three symbols“ statt „three colours“, neu „two of one pigment“? (Empfehlung: ja)
