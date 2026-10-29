# Plan: Ziehen mit richtiger Animation, Würfel als Deck

Stand 29.10.2026. Vorschlag, nichts davon ist gebaut. Wartet auf Freigabe, Fragen am Ende.

## Rückmeldung

- Die Animationen beim Ziehen (Gacha) gehören viel besser gemacht. Vermutung: Die Engine hat Grenzen.
- Würfel müssen irgendwie verbraucht werden können, wie bei einem Kartendeck.

## Hat die Technik Grenzen?

Wir benutzen keine Spiel-Engine. Das Blatt ist reines Canvas 2D, Bildschirme und Knöpfe sind HTML und CSS.

- **Die Ziehen-Animation ist heute schlicht gebaut,** daran liegt es vor allem. Sie besteht aus ein paar CSS-Übergängen: ein Tropfen fällt, eine Zahl rattert, das Bild wird scharf.
- **Canvas 2D kann deutlich mehr:**
  - Tinte, die sich ausbreitet
  - Licht und Glanz über vorgerenderte Leucht-Bilder mit additiver Mischung
  - viele Partikel
  - 3D-Würfel und Kartendrehungen per CSS (die 3D-Würfel im Duell sind schon so gebaut)
- **Echte Grenzen von Canvas 2D:**
  - keine Shader, also kein echtes Bloom-Leuchten über den ganzen Schirm
  - keine Verzerrung (Hitzeflimmern, Wellen)
  - Weichzeichnen in jedem Bild ist auf dem Handy teuer
  - Leuchten lässt sich nur mit Tricks nachbauen. Das sieht gut aus, aber nicht so weich wie mit Shadern.
- **Wenn das nicht reicht:** WebGL über PixiJS (MIT-Lizenz). PixiJS würde nur geladen, wenn man „Your dice“ öffnet, das Duell bleibt so schnell wie jetzt. Phaser ist dafür zu groß.

**Empfehlung:** erst mit Canvas 2D und CSS eine richtige Inszenierung bauen. PixiJS nur, wenn dir das Ergebnis nicht reicht.

## 1. Ziehen neu inszenieren

Ein Zug als kleines Ritual in fünf Takten. Ein Tipp überspringt jederzeit zum Ergebnis.

1. **Eintauchen:** Ein Pinsel taucht in ein Farbglas. Das Glas leuchtet in einer Farbe, die die Seltenheit andeutet. Bei Rare und besser kann die Farbe noch umspringen, so wie in bekannten Gacha-Spielen.
2. **Der Tropfen:** Er fällt in Zeitlupe mit Lichtspur und trifft das nasse Blatt. Dann gibt es eine Druckwelle, Spritzer und ein kurzes Wackeln.
3. **Die Tinte blüht:** Der Klecks wächst aus dem Tropfen. Die Farbe läuft in Fasern aus, die Ränder dunkeln nach wie bei echtem Aquarell. Gemalt wird mit unserem eigenen Renderer, schrittweise aufgedeckt.
4. **Der Wurf:** Ein 3D-W100 rollt über das Blatt und bleibt liegen. Die Seltenheitsleiste füllt sich bis zur gewürfelten Zahl.
   - Ab Rare: Lichtstrahlen hinter dem Blatt.
   - Epic: violetter Schimmer.
   - Legendary: Blattgold-Flocken regnen, und der Schutz vor Pech wird als Siegel gestempelt.
   - Ton steigert sich mit der Seltenheit.
5. **Die Karte:** Das Blatt dreht sich zur Würfelkarte mit Rahmen, Name und Stufe. Dann klappt das Würfelnetz Seite für Seite auf, so wie im Duell. „New!“ oder „+3 glaze“ wird aufgestempelt.

**Zehnerzug:** Zehn Tropfen regnen auf ein großes Blatt und blühen nacheinander. Der seltenste bekommt am Ende die große Enthüllung, danach siehst du alle zehn Karten.

**Vorgehen:** zuerst als Artifact (gleicher Weg wie bei der Farbschlacht), damit du es am Handy anschauen kannst. Danach in die App.

## 2. Würfel verbrauchen

Drei Möglichkeiten, die sich auch verbinden lassen.

### A. Der Beutel wird ein Deck (Empfehlung)

Wie Karten im Duell: Würfel werden gezogen, benutzt und abgelegt.

- **Deck:** 9 statt 6 Würfel.
- **Ziehen statt wählen:** Jeder Zug zieht 3 zufällige Würfel aus dem Ziehstapel und wirft sie. Du musst nicht mehr wählen, das spart wieder Taps.
- **Ablage:** Geworfene Würfel kommen auf den Ablagestapel. Ist der Ziehstapel leer, wird die Ablage neu gemischt.
- **Beschwören:** Ein beschworener Würfel liegt auf dem Blatt und wird nicht mehr gezogen, solange sein Klecks lebt (so wie bei Dungeon Dice Monsters).
- **Ausgewaschen:** Ist ein Klecks ausgewaschen, ist sein Würfel für dieses Duell weg.
- **Anzeige:** Ziehstapel und Ablage mit Zahl unten am Rand.
- **Strategie:** Man baut sein Deck. Viele Sterne bringen schnelle Beschwörungen, viele Symbole mehr Kraft. Der Rivale spielt auch mit Deck.

### B. Würfel trocknen aus (Verbrauch in der Sammlung)

Passt zum Namen „Before It Dries“.

- **Ladungen:** Jeder Würfel hat Ladungen nasser Farbe. Common 3, Uncommon 4, Rare 5, Epic 7, Legendary 10.
- **Verbrauch:** Jedes Duell kostet jeden Würfel, der geworfen wurde, eine Ladung.
- **Trocken:**
  - Der Würfel ist nicht mehr spielbar.
  - Er bleibt als getrocknetes Bild in deiner Galerie.
  - Er gibt Lasur für seine Art.
- **Neu befeuchten:** mit Lasur, zum Beispiel 3 Lasur für eine Ladung.
- **Wirkung auf das Ziehen:** Ziehen wird wichtiger, weil Würfel ausgehen. Gleichzeitig fühlt es sich weniger nach „Besitz für immer“ an.

### C. Risiko: Ausgewaschen heißt für immer weg

Wird ein Klecks im Duell ausgewaschen, ist sein Würfel aus der Sammlung verloren.

- Das ist sehr spannend, aber hart.
- Nur sinnvoll in einem eigenen Modus, zum Beispiel „Risk duel“ mit mehr Pigment.

## Ablauf

Jeder Schritt endet mit Upload und einem Test am Handy.

1. Ziehen-Inszenierung als Artifact, du schaust sie dir an.
2. Nach deiner Rückmeldung in die App.
3. Würfel verbrauchen nach deiner Wahl. Zuerst Regeln und Simulation, dann die Bedienung, das Lern-Duell anpassen.

## Fragen

1. Würfel verbrauchen: A (Deck im Duell, Empfehlung), B (Austrocknen), C (Risiko), oder eine Verbindung, zum Beispiel A und B?
2. Bei A: Deck mit 9 Würfeln (Empfehlung), oder eine andere Größe?
3. Ziehen-Animation zuerst als Artifact zum Anschauen (Empfehlung)?
4. Technik: bei Canvas 2D und CSS bleiben (Empfehlung) oder gleich WebGL mit PixiJS nur für das Ziehen?
