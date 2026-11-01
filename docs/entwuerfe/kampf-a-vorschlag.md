# Vorschlag: Kampf A, Farbseiten, gleiche Farben, Nässe

Stand 01.11.2026, Fassung 2.

- **Fassung 1:** freigegeben am 01.11.2026 und gebaut (Playtest v0.0.1.109, Bild docs/entwuerfe/kampf-a-im-spiel.png). Rückmeldung: „viel undurchsichtiger und komplizierter“.
- **Fassung 2:** am 01.11.2026 gewählt („A stark vereinfachen“). Gebaut, Bild docs/entwuerfe/kampf-a-einfach.png.

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

### 5 Beute: Tropfen (Schritt 4, noch nicht gebaut)

- **Tropfen sammeln:** Jeder ausgewaschene Klecks des Rivalen hinterlässt einen Tropfen seines Hauptpigments. Ein Sieg gibt einen Tropfen dazu, das Pigment eines eigenen Würfels aus dem Deck, zufällig.
- **Umfärben:** Auf der Würfelkarte färbt man eine Seite für 3 Tropfen in dieses Pigment um. So baut man ein Deck, das öfter Glaze und Pure wirft.
- **Doppelt machen** bleibt bei der Lasur aus dem Auswaschen.
- **Neuer Spielstand:** `drops`, je Pigment. Umfärbungen stehen wie Lasuren in `mods` und gelten auch im Galerie-Abzug und beim Tausch.

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

- **Lern-Duell (Schritt 3):** neue feste Würfe, die eine Glaze und einen Neuwurf zeigen. Sepia erklärt Farbe, Kombi und Nässe.
- **Versionsprüfung:** DUEL_PROTOCOL 16, Speicherstand v6. Laufende Duelle aus älteren Versionen (auch Fassung 1) werden verworfen.

## Reihenfolge

1. **Regeln und Server:** gebaut (Fassung 1, dann Fassung 2).
2. **Anzeige:** gebaut.
3. **Lern-Duell:** gebaut (Seed 267, Lern-Deck mit je zwei Ultramarin- und Carmine-Klecksen, Sepia erklärt Farben, Nässe, Glaze, Rechnung und Schlamm). Bild docs/entwuerfe/lern-duell-farbe.png.
4. **Tropfen und Umfärben:** Server, Karte, Ergebnisbild. Upload mit Bild.

Danach der Plan für B (Bleach).
