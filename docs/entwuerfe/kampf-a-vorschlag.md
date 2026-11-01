# Vorschlag: Kampf A, Farbseiten, gleiche Farben, Nässe

Stand 01.11.2026, Fassung 2.

- **Fassung 1:** freigegeben am 01.11.2026 und gebaut (Playtest v0.0.1.109, Bild docs/entwuerfe/kampf-a-im-spiel.png). Rückmeldung: „viel undurchsichtiger und komplizierter“.
- **Fassung 2:** am 01.11.2026 gewählt („A stark vereinfachen“). Gebaut, Bild docs/entwuerfe/kampf-a-einfach.png.
- **Schritt 4 (Tropfen und Umfärben):** gebaut am 01.11.2026, Bild docs/entwuerfe/tropfen-im-spiel.png. Damit ist Kampf A vollständig gebaut.
- **Nachgestimmt am 01.11.2026** („weniger Tropfen als Loot und Umfärben etwas begrenzen“): höchstens 2 Tropfen je Duell, nur in den 5 belohnten Duellen am Tag, höchstens 2 umgefärbte Seiten je Würfel. Bild docs/entwuerfe/tropfen-begrenzt.png.
- **Nachgestimmt am 01.11.2026** („es sollte schon ein paar Tage dauern, bis man etwas umfärben kann“): zuerst höchstens 2 Tropfen am Tag gebaut (Playtest v0.0.1.123), danach gewählt: „höhere Kosten ohne Tageslimit find ich besser“. Jetzt 5 Tropfen je Umfärbung, kein Tageslimit. Bild docs/entwuerfe/tropfen-kosten5.png.

Anlass (01.11.2026): Kampf-Brainstorming, Abgleich in docs/entwuerfe/kampf-brainstorming-abgleich.md. Entschieden „Empfehlungen umsetzen“:
- **Weg C:** erst A (Umbau im Wurf, das Duell bleibt), danach B (Modus „Bleach“).
- **Farbe zusätzlich zum Symbol**, im Duell weiter 3 Würfel je Wurf.
- **Nässe** statt festem Neuwurf.
- **Beute** zum Lasieren zusätzlich zum Auswaschen.
- **Werte** bleiben, wie sie sind.
- **Kürzer** erst nach A messen, den Ergebnis-Post gibt es mit B.

## Was Fassung 1 zu schwer machte

- **Man musste den Farbkreis kennen.** Burst, Chain und das Ausbluten hingen davon ab, welche Farben Nachbarn und welche Gegenfarben sind. Das sieht man nicht: Ultramarin und Siena sind Gegenfarben, Ultramarin und Cadmiumgelb nicht.
- **Fünf Kombis mit vier verschiedenen Zahlen**, dazu Nässe mit zwei Folgen (blühen oder Schlamm).
- **Die Kombi-Tafel mit 6 Feldern** verdeckte beim Halten fast das ganze Brett.

## Regeln (Fassung 2)

### 1 Jede Seite hat eine Farbe

- **Farbe der Symbolseiten** (Step, Splash, Guard, Glow, Gold): Sie tragen das Hauptpigment des Kleckses oder, bei etwa jeder dritten Seite, seine Zweitfarbe. Die Farbe ist fest, eigener Zufall aus dem Seed, der Würfelzufall bleibt unberührt.
- **Sterne und Joker** bleiben ohne Farbe.
- **Die Symbole behalten ihre Aufgabe:** Step bewegt, Splash trifft die Palette, Guard halbiert einen Treffer, Glow füllt die Sättigung.
- **Bisherige Würfel** bekommen ihre Farben aus ihrem Seed, ohne etwas zu verlieren.
- **Anzeige:** Lavierung in der Farbe hinter dem Symbol, der Rand der Seite in derselben Farbe.

### 2 Nur gleiche Farbe zählt

| Kombi | Wurf | Wirkung |
|---|---|---|
| Glaze | zwei Seiten einer Farbe | jeder Spritzer auf einen Klecks in diesem Zug ×1,5 |
| Pure | drei Seiten einer Farbe | ×2 und ein Joker |
| Three stars | drei Sterne gleicher Stufe | ein Joker |

- **Ein Joker** zählt als jede Farbe.
- **Kein Farbkreis:** Nachbar- und Gegenfarben spielen beim Würfeln keine Rolle mehr. Auf dem Blatt bleiben die Farbreaktionen, wie sie sind.
- **Der Multiplikator gilt nur für Spritzer** auf Kleckse. Palettentreffer bleiben ein Herz, Stempeln bleibt, wie es ist.
- **Pure und drei Sterne** gelten sofort, wie früher der Drilling.
- **Paar, Drilling und Regenbogen** fallen weg.

### 3 Nässe: ein Würfel kann zu Schlamm werden

Man darf bis zu viermal neu werfen. Der erste Neuwurf bleibt trocken, jeder weitere macht das Blatt nasser:

| Neuwurf | 1. | 2. | 3. | 4. |
|---|---|---|---|---|
| Chance, dass ein Würfel zu Schlamm wird | 0 % | 25 % | 50 % | 75 % |

- **Welcher Würfel:** einer mit farbiger Seite, zufällig, auch ein gehaltener. Sterne und Joker bleiben trocken.
- **Schlamm** zählt in diesem Wurf nichts, bis man den Würfel neu wirft.
- **Anzeige:** Am Neuwurf-Knopf stehen Tropfen und die Chance für den nächsten Neuwurf („○ dry“, „●●● 75% mud“).

### 4 Sichtbare Rechnung

- **Combo-Banner:** Es nennt Kombi, Farbe und Multiplikator („GLAZE ×1.5“). Der Multiplikator steht bis zum Zugende oben am Stand.
- **Jeder Spritzer** zeigt Basis, Multiplikator und Ergebnis und zählt hoch („9 ×1.5 = 14“). Die Vorschau beim Zielen nennt die Rechnung schon vorher.

### 5 Beute: Tropfen (Schritt 4, gebaut)

- **Tropfen sammeln (nachgestimmt):** Ein Sieg gibt einen Tropfen, das Pigment eines eigenen Würfels aus dem Deck. Wäscht man mindestens einen Klecks des Rivalen aus, hinterlässt einer davon (gewürfelt) einen Tropfen seines Hauptpigments. Also höchstens 2 je Duell, nur in den 5 belohnten Duellen am Tag (wie Pigment), nicht im Lern-Duell. Kein eigenes Tageslimit. Alles gewürfelt am Server.
- **Umfärben:** Auf der Würfelkarte färbt man eine Seite mit Farbe für 5 Tropfen (`DROP_COST`, zuerst 3) in dieses Pigment um, auch in eines, das der Klecks sonst nicht trägt. Sterne und Joker haben keine Farbe. So baut man ein Deck, das öfter Glaze und Pure wirft.
- **Höchstens 2 umgefärbte Seiten je Würfel** (`TINT_MAX`). Schon umgefärbte Seiten lassen sich weiter umfärben. Die Karte zeigt „Repainted 1/2“.
- **Je Seite gilt die letzte Umfärbung.** Färbt man zurück in die Farbe aus dem Seed, fällt die Änderung ganz weg (kostet trotzdem 5 Tropfen) und macht einen Platz frei.
- **Doppelt machen** bleibt bei der Lasur aus dem Auswaschen.
- **Spielstand:** `drops`, je Pigment. Umfärbungen stehen wie Lasuren in `mods` (`to: 'c'`, `c` ist das Pigment) und gelten im Duell, im Galerie-Abzug, im Archiv, im Markt und beim Tausch. Sie zählen nicht als Lasur.
- **Anzeige:**
  - Ergebnis: Tropfen in ihrer Farbe, „+2 drops: Carmine, Indigo“, der Siegtropfen extra genannt.
  - Your dice: Zeile „Drops“ über der Sammlung mit dem Vorrat je Pigment.
  - Würfelkarte: Knöpfe je Pigment mit Kürzel und Zahl, ab 5 wählbar. Ist eine Farbe gewählt, leuchten die Seiten, die sich umfärben lassen, in dieser Farbe. Antippen färbt um. Umgefärbte Seiten tragen unten links einen kleinen Tropfen. Zeile „Repainted x/2“, bei 2/2 leuchten nur noch die umgefärbten.
  - Hilfe im Duell: Zeile „Drops“.
- **Code:** `diceTint` und `dropLoot` in src/server/dice.ts, Endpunkt /api/dice/tint, `DROP_COST` in src/shared/dice.ts, `tintFaces` in rules.ts, `duelLoot` in play.ts. Vorschau: /dev/drops?karmin=5.

**Gemessen (200 Duelle je Gegner, der Spieler spielt wie der Computer):**

| Gegner | Siegquote | ausgewaschene Rivalen je Duell | Tropfen je Duell (erste Fassung) | Tropfen je Duell (höchstens 2) |
|---|---|---|---|---|
| Geselle (apprentice) | 100 % | 3,3 | 4,3 | etwa 2 |
| Geselle (journeyman) | 95 % | 3,6 | 4,6 | etwa 1,9 |
| Meister | 38 % | 2,6 | 3,0 | etwa 1,4 |
| Galerie | 73 % | 3,1 | 3,9 | etwa 1,7 |

- Der Siegtropfen kommt aus dem eigenen Deck und hilft deshalb gezielt, der andere ist Glückssache.

**Tage bis zur ersten Umfärbung** (Modell: Deck aus 9 Würfeln mit zufälligen Pigmenten, Siegquote 70 %, 4000 Spieler):

| Regel | 5 Duelle am Tag | 2 Duelle am Tag | 1 Duell am Tag |
|---|---|---|---|
| Kosten 3, ohne Limit | Median 1 Tag (60 % am 1. Tag) | Median 3 Tage | |
| Kosten 3, höchstens 2 Tropfen am Tag (v0.0.1.123, verworfen) | Median 4 Tage | Median 4 Tage | Median 5 Tage |
| **Kosten 5, ohne Tageslimit (gebaut)** | Median 3 Tage, 2 % am 1. Tag, 49 % bis Tag 2, 94 % bis Tag 3 | Median 6 Tage, 8 % bis Tag 3, 71 % bis Tag 6 | Median 11 Tage, 25 % bis Tag 8 |

- Wer mehr spielt, kommt schneller ans Ziel, gebremst durch die 5 belohnten Duelle am Tag.
- Ein voll umgefärbtes Deck (18 Seiten) braucht 90 Tropfen, bei 5 Duellen am Tag rund 10 Tropfen täglich, also eher Wochen, weil sich die Tropfen auf die Pigmente verteilen.

**Wirkung der Obergrenze je Würfel** (Deck aus 9 gemischten Würfeln, im Schnitt 3,1 Seiten mit Farbe, alles in eine Farbe umgefärbt, soweit erlaubt):

| umgefärbte Seiten je Würfel | Glaze je Wurf | Pure je Wurf |
|---|---|---|
| keine (heute) | 16 % | 0,5 % |
| höchstens 1 | 24 % | 2,5 % |
| **höchstens 2 (gebaut)** | 34 % | 8 % |
| ohne Grenze | 41 % | 17 % |

- Der Computer-Rivale färbt nicht um, Galerie-Decks schon. Ein voll umgefärbtes Deck braucht 90 Tropfen in einer Farbe.

### Malmittel und Sepias Auftrag

- **Sponge:** Die Nässe beginnt eine Stufe später. Die ersten zwei Neuwürfe sind trocken, der dritte 25 %, der vierte 50 %.
- **Masking Fluid:** Gehaltene Würfel werden nie zu Schlamm, zusätzlich zur heutigen Wirkung.
- **Iridescent Medium:** Jede Kombi gibt ein Symbol mehr (das der ersten Seite der Kombi, sonst Glow).
- **Sepias Auftrag:** „three colours“ heißt jetzt „three symbols“. Neu dazu kommt „two of one pigment“.

## Simulation (Fassung 2)

400 Duelle je Gegner. Der Spieler spielt wie der Computer, der höchstens zweimal neu wirft und den zweiten Neuwurf nur ohne Kombi wagt.

| Gegner | Siegquote vor Kampf A | Fassung 1 | Fassung 2 | Kombis je Wurf (Fassung 2) |
|---|---|---|---|---|
| Geselle | 93 % | 93 % | 93 % | 31 % |
| Meister | 41 % | 43 % | 42 % | 29 % |
| Galerie | 64 % | 69 % | 69 % | 30 % |

- **Gleichgewicht:** bleibt.
- **Kombis:** in etwa jedem dritten Wurf (Glaze 16 bis 21 %, drei Sterne 9 bis 12 %, Pure 1 %). Vor Kampf A war es etwa jeder zweite, eine Kombi brachte damals aber nur +1 Symbol.
- **Mehr Wumms:** mehr Schaden und Auswaschungen je Duell als vor Kampf A (gegen den Meister 72 zu 93 statt 59 zu 75 Schaden), weil öfter mit Multiplikator gespritzt wird.
- **Schlamm:** Der Computer wagt den nassen Neuwurf selten (0,07 Mal pro Duell). Die Nässe ist die Entscheidung für Spieler, die auf Pure gehen. Nach dem Handytest lässt sich die Stufe nachstimmen.
- **Dauer:** gleich (5,1 bis 5,5 Züge pro Seite).

## Was sonst noch zu tun ist

- **Lern-Duell (Schritt 3):** gebaut. Feste Würfe zeigen eine Glaze und einen Neuwurf. Sepia erklärt Farbe, Kombi und Nässe.
- **Versionsprüfung:** DUEL_PROTOCOL 16, Speicherstand v6 (mit den Elementen 17 und v7). Laufende Duelle aus älteren Versionen (auch Fassung 1) werden verworfen. Schritt 4 ändert am Duell nichts.

## Reihenfolge

1. **Regeln und Server:** gebaut (Fassung 1, dann Fassung 2).
2. **Anzeige:** gebaut.
3. **Lern-Duell:** gebaut (Seed 267, Lern-Deck mit je zwei Ultramarin- und Carmine-Klecksen, Sepia erklärt Farben, Nässe, Glaze, Rechnung und Schlamm). Bild docs/entwuerfe/lern-duell-farbe.png.
4. **Tropfen und Umfärben:** gebaut (Server, Würfelkarte, Ergebnis, Hilfe, Tests). Playtest v0.0.1.119, Bild docs/entwuerfe/tropfen-im-spiel.png. Nachgestimmt (weniger Tropfen, höchstens 2 Seiten je Würfel): Playtest v0.0.1.121, Bild docs/entwuerfe/tropfen-begrenzt.png. Höchstens 2 Tropfen am Tag: Playtest v0.0.1.123 (verworfen). Kosten 5 ohne Tageslimit: Playtest v0.0.1.125, Bild docs/entwuerfe/tropfen-kosten5.png.

Danach der Plan für B (Bleach).

## Fragen zu Schritt 4

1. Obergrenze fürs Umfärben? **Beantwortet am 01.11.2026: „etwas begrenzen“, gebaut mit höchstens 2 Seiten je Würfel.** Mit 1 wäre es Glaze 24 %, Pure 2,5 %.
2. Test-Knopf für Mods im Playtest („+3 drops of each pigment“), damit man das Umfärben ohne viele Duelle ausprobieren kann? Offen.
