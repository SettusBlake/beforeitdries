# Vorschlag: Übersicht im Duell und klarer Siegweg

Stand 31.10.2026, Fassung 1. Wartet auf Freigabe.

Rückmeldung 31.10.2026: Das Spielfeld ist recht unübersichtlich. Man erkennt nicht, wer was machen kann und wer der Gegner ist. Unklar ist auch, ob es effektiver ist, die Palette zu zerstören, als das Spielfeld voll zu malen.

Entwurf: docs/entwuerfe/uebersicht-entwurf.png (derselbe Spielstand links heute, rechts der Entwurf). Der Entwurf steckt schon im Code, ist im Spiel aber aus (Schalter `LOOK2` in src/client/duel/view.ts).

## Gemessen: Palette oder Papier?

Simulation, je 200 Duelle. Der Spieler spielt wie der Computer, aber mit drei Spielweisen:

| Spielweise | gegen Geselle | gegen Meister | Duelle, die über die Palette enden |
|---|---|---|---|
| ausgewogen (wie heute) | 91 % | 40 % | 56 bis 61 % |
| nur auf die Palette | 91 % | 35 % | 56 bis 72 % |
| nur malen, Palette ignorieren | 93 % | 44 % | 2 bis 33 % |

- **Die Palette zu zerstören ist nicht effektiver.** Gegen den Meister ist reines Angreifen sogar am schlechtesten: Die eigenen Kleckse sind weg von der eigenen Palette, und der Meister zerstört sie zuerst.
- Reines Malen ist gleich gut oder etwas besser. Beide Wege sind also echte Wege, keiner ist eine Abkürzung.
- Am Gleichgewicht muss nichts geändert werden. Das Spiel sagt es nur nirgends deutlich.

## Woran die Unübersichtlichkeit liegt

1. **Felder haben die Farbe ihres Pigments.** Beide Seiten malen in denselben Farben (im Bild links ist rosa auf beiden Seiten). Wem ein Feld gehört, zeigt nur ein dünner blauer oder roter Rand. Dünn, weil die dicken Ränder am 29.10. gestört haben.
2. **Kleckse beider Seiten sehen gleich aus.** Nur der kleine Sockel ist blau oder rot.
3. **Wer schon gehandelt hat,** zeigt nur ein kleiner Haken. Wer noch kann, zeigt nichts.
4. **Das Ziel steht nirgends auf dem Brett.** Deine Herzen stehen unten, die des Rivalen oben rechts.
5. **Seit gestern** machen die liegenbleibenden Flecken das Brett zusätzlich unruhig.

## Vorschlag

- **A Gebiet:** Felder des Rivalen sind fein rot schraffiert, deine bleiben klar. Die Pigmentfarbe bleibt, sie zählt für Lasur, Verlaufen und Schlamm.
- **B Kleckse:** Der Aufkleber bekommt am ganzen Umriss einen Rand in Blau (du) oder Rot (Rivale), nicht nur am Sockel.
- **C Wer kann noch:** In deinem Zug hat jeder Klecks, der noch handeln kann, einen pulsierenden Ring. Wer fertig ist, wird blass (mit Haken).
- **D Siegwege:** Unter dem Stand eine Zeile „Win: more paper when it dries, or break all 3 hearts of their palette“. Die Paletten sind mit YOU und RIVAL beschriftet. Das Lern-Duell erklärt beide Wege schon, im normalen Duell bleiben Sepias Tipps aus.
- **E Ruhe:** Die Flecken nach Treffern nur halb so kräftig.

## Reihenfolge

Alles in einem Schritt: Schalter an, Feinschliff am Handy-Format (360 Pixel), Upload mit Bild.

## Fragen

1. A bis E so bauen wie im Entwurf? (Empfehlung: ja)
2. A: Gebiet des Rivalen schraffieren (Empfehlung) oder lieber dein eigenes Gebiet markieren?
3. Gleichgewicht zwischen Palette und Papier so lassen, nur deutlicher anzeigen? (Empfehlung: ja)
