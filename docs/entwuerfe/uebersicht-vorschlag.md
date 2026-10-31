# Vorschlag: Übersicht im Duell und klarer Siegweg

Stand 31.10.2026, Fassung 2. Freigegeben am 31.10.2026 („eher 16 Farben, rest ok“). Gebaut (siehe unten).

Rückmeldung 31.10.2026: Das Spielfeld ist recht unübersichtlich. Man erkennt nicht, wer was machen kann und wer der Gegner ist. Unklar ist auch, ob es effektiver ist, die Palette zu zerstören, als das Spielfeld voll zu malen.

Rückmeldung zu Fassung 1 (31.10.2026): Statt der Schraffur soll man sich im Menü eine Farbe und eine Ausweichfarbe aussuchen, mit der man spielt. Später sollen dort auch andere Stile für die Farbkleckse wählbar sein. B bis E und das Gleichgewicht: ja. Auf Rückfrage: Die Spielfarbe färbt das ganze Gebiet, der Gegner spielt mit seiner eigenen Farbe.

Entwürfe:
- docs/entwuerfe/uebersicht-entwurf.png (Fassung 1 mit Schraffur, überholt)
- docs/entwuerfe/spielfarbe-entwurf.png (Fassung 2: derselbe Spielstand heute und in drei Farbpaaren, dazu das Menü)

Der Entwurf steckt im Code, ist im Spiel aber aus (Schalter `LOOK2` in src/client/duel/view.ts).

## Gemessen: Palette oder Papier?

Simulation, je 200 Duelle. Der Spieler spielt wie der Computer, aber mit drei Spielweisen:

| Spielweise | gegen Geselle | gegen Meister | Duelle, die über die Palette enden |
|---|---|---|---|
| ausgewogen (wie heute) | 91 % | 40 % | 56 bis 61 % |
| nur auf die Palette | 91 % | 35 % | 56 bis 72 % |
| nur malen, Palette ignorieren | 93 % | 44 % | 2 bis 33 % |

- **Die Palette zu zerstören ist nicht effektiver.** Gegen den Meister ist reines Angreifen sogar am schlechtesten: Die eigenen Kleckse sind weg von der eigenen Palette, und der Meister zerstört sie zuerst.
- Reines Malen ist gleich gut oder etwas besser. Beide Wege sind echte Wege, keiner ist eine Abkürzung.
- **Festgelegt am 31.10.2026:** Gleichgewicht bleibt, es wird nur deutlicher angezeigt.

## Woran die Unübersichtlichkeit liegt

1. **Felder haben die Farbe ihres Pigments.** Beide Seiten malen in denselben Farben. Wem ein Feld gehört, zeigt nur ein dünner blauer oder roter Rand.
2. **Kleckse beider Seiten sehen gleich aus.** Nur der kleine Sockel ist blau oder rot.
3. **Wer schon gehandelt hat,** zeigt nur ein kleiner Haken. Wer noch kann, zeigt nichts.
4. **Das Ziel steht nirgends auf dem Brett.**
5. **Die liegenbleibenden Flecken** machen das Brett zusätzlich unruhig.

## Vorschlag

### A Spielfarbe (neu in Fassung 2)

- **Jede Seite malt ihr Gebiet in ihrer Farbe.** Die Aquarell-Form der Felder bleibt, nur die Farbe ist die der Seite.
- **Pigment als Tropfen:** Welches Pigment auf einem Feld liegt, zeigt ein kleiner Tropfen in der Ecke, bei einer zweiten Schicht (Lasur) mit Ring. Das braucht es, weil Lasur, Verlaufen und Schlamm weiter am Pigment hängen. Schlamm bleibt braun.
- **Alles in der Spielfarbe:** Gebiet, Gebietsrand, Rand der Kleckse, Sockel, Lebensbalken, Palette, Herzen, Stand oben.
- **Auswahl im Menü:** „Your colour“ und „Backup colour“ als Farbpunkte, gespeichert im Spielstand am Server.
- **Farben zur Wahl (16, festgelegt am 31.10.2026):** Ultramarine, Carmine, Viridian, Cadmium, Violet, Cerulean, Sepia, Opera Rose, Lemon, Sap Green, Indigo, Turquoise, Burnt Sienna, Magenta, Payne's Grey, Coral. Standard: du Ultramarine, Ausweichfarbe Viridian.
- **Gegner:** Der Computer-Rivale malt immer in Carmine. Im Galerie-Duell malt der andere Spieler in seiner Farbe. Ist die Farbe des Gegners deiner zu ähnlich, spielst du mit deiner Ausweichfarbe. Ist auch die zu ähnlich, nimmt das Spiel die nächste freie Farbe.
- **Später:** Stile für die Farbkleckse (z. B. Tusche, Kreide) kommen an dieselbe Stelle im Menü. Nicht in diesem Schritt.

### B bis E (freigegeben)

- **B Kleckse:** Rand am ganzen Umriss in der Farbe der Seite.
- **C Wer kann noch:** In deinem Zug pulsiert ein Ring um jeden Klecks, der noch handeln kann. Wer fertig ist, wird blass (mit Haken).
- **D Siegwege:** Zeile unter dem Stand „Win: more paper when it dries, or break all 3 hearts of their palette“, Paletten mit YOU und RIVAL beschriftet.
- **E Ruhe:** Flecken nach Treffern halb so kräftig.

## Reihenfolge

1. Server: Spielfarbe und Ausweichfarbe im Spielstand (`color`, `color2`), Farbe im Galerie-Abzug, Auflösung bei ähnlichen Farben, Tests.
2. Anzeige: A bis E an (Schalter `LOOK2` weg), Menü mit Farbpunkten, Stand und Herzen in den Spielfarben, Prüfung auf 360 Pixel. Upload mit Bild.

## Gebaut (31.10.2026, Playtest v0.0.1.97, Bild docs/entwuerfe/spielfarbe-im-spiel.png)

- **Farben:** src/shared/colors.ts (`TEAM_COLORS` mit 16 Farben, `duelColors`, ähnlich heißt Abstand unter 110 nach der Redmean-Formel). Spielstand-Felder `color` und `color2`, Wahl über /api/dice/color (zwei verschiedene Farben). Galerie-Abzug mit der Farbe des Besitzers (ohne Wahl Ultramarine), Vorschau zeigt sie als Punkt vor dem Namen.
- **Duell:** Server legt `colors` im Duell-Stand fest (du, Gegner). Computer-Rivale Carmine, Galerie-Deck in der Farbe seines Besitzers, du in deiner Farbe, sonst Ausweichfarbe, sonst die nächste freie. DUEL_PROTOCOL 13.
- **Anzeige:** Gebiet in der Spielfarbe, Pigment als Tropfen in der Ecke (Ring bei Lasur), Gebietsrand, Rand der Kleckse, Sockel, Lebensbalken, Palette und Stand oben in den Spielfarben. Wer noch kann, pulsiert, wer fertig ist, wird blass. Zeile „Win: more paper when it dries, or break their 3 hearts“, Paletten mit YOU und RIVAL. Flecken halb so kräftig.
- **Auswahl:** Farbpunkt neben „Your dice“ und „Colours“ im Menü öffnen dieselbe Auswahl (src/client/duel/colors.ts). Gleiche Farbe in beiden Reihen tauscht sie.
- Später: Stile für die Farbkleckse an derselben Stelle.

## Fragen

1. Die acht Farben so? (Empfehlung: ja)
2. Pigment als Tropfen in der Ecke? (Empfehlung: ja, sonst sieht man nicht mehr, warum ein Feld lasiert, verläuft oder zu Schlamm wird)
3. Standard Ultramarine, Ausweichfarbe Viridian, Computer-Rivale Carmine? (Empfehlung: ja)
4. Farbwahl nur im Menü des Duells oder zusätzlich in „Your dice“? (Empfehlung: Menü des Duells und ein Farbpunkt neben „Your dice“, beide öffnen dieselbe Auswahl)
