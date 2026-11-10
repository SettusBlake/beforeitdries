# Hokusai: der Stil nur fürs Wochenende

Stand 10.11.2026, Fassung 1. Gewünscht: Stile doppelt so oft, dazu ein besonderer Hokusai-Stil, den es nur am Wochenende gibt. Die doppelte Chance ist gebaut (Abschnitt 1), der Hokusai-Stil ist ein Entwurf und wartet auf Freigabe (Fragen in Abschnitt 5).

Entwurfsbilder, gezeichnet mit dem echten Code (noch nicht im Spiel, `hokusai` in src/client/renderer/styles-more.ts, Quelle tools/mockup/hokusai-entwurf.ts):
- docs/entwuerfe/hokusai-entwurf.png: fünf Monster in beiden Ansichten, klein wie in der Sammlung, zum Vergleich der bestehende Ukiyo-e-Stil.
- docs/entwuerfe/hokusai-nah.png: ein Monster nah in beiden Ansichten.

## 1 Gebaut: Stile doppelt so oft

- **Unter der Woche:** Der weiße W100 bringt einen Stil bei 99 oder 100 (vorher nur bei 100). Das sind 2 % je Zug statt 1 %.
- **Am Gilded weekend:** bei 97 bis 100 (vorher 99 bis 100). Das sind 4 % statt 2 %.
- **Mit den Pinseln:**

  | Pinsel | unter der Woche | am Wochenende |
  |---|---|---|
  | Plain | 2 % | 4 % |
  | Loaded | 4 % | 7,8 % |
  | Dripping | 5,9 % | 11,5 % |

- **Je Stil und Zug:** die fünf häufigeren Stile 1 zu 500 (vorher 1 zu 1000), die zehn selteneren 1 zu 1000 (vorher 1 zu 2000).
- Holo bleibt, wie es ist.

## 2 Entwurf: der Hokusai-Stil

Ein Blatt wie aus Hokusais „36 Ansichten des Fuji“. Die Vorbilder sind gemeinfrei (Hokusai starb 1849), alles ist aus Code gezeichnet.

- **Die große Welle:** Die Welle steigt links auf und überschlägt sich mit Schaumkrallen und Gischt über der Figur. Der Fuji steht klein in der Ferne, die Figur im Wellental wie die Boote im Vorbild.
- **Der rote Fuji:** klarer Morgen, der Berg in Rot mit Schneerinnen, Schäfchenwolken im tiefen Blau, Wald am Fuß.
- **Die Figur:** flache Farben wie im Holzschnitt, Linien in Preußischblau statt Schwarz, heller Saum aus unbedrucktem Papier.
- **Groß** dazu ein Titelkasten mit dem Namen und daneben eine angedeutete Signatur.
- **Unterschied zu Ukiyo-e**, den es schon gibt: Dort steht die Figur groß vor Nebelbändern und Wellenmuster, mit schwarzer Linie und rotem Siegel. Hokusai ist eine ganze Szene, die Figur steht kleiner darin.

## 3 Wie er nur am Wochenende auftaucht (Vorschlag)

- Am Gilded weekend (Samstag und Sonntag UTC) trägt der Stil-W20 auf der **1** die Welle: Zeigt er 1, wird es Hokusai. Pencil behält seine zweite Seite (die 2) und bleibt auch am Wochenende möglich.
- Unter der Woche ist die 1 wie bisher Pencil. Hokusai kann dann nicht fallen.
- Chance je Zug am Wochenende:

  | Pinsel | eine Seite (Vorschlag) | zwei Seiten |
  |---|---|---|
  | Plain | 0,2 % (1 zu 500) | 0,4 % (1 zu 250) |
  | Loaded | 0,39 % | 0,78 % |
  | Dripping | 0,58 % | 1,15 % |

- Zum Vergleich: Holo liegt unter der Woche bei 1 zu 500 je Zug.
- Hokusai ist ein Stil wie die anderen: nur Aussehen, lässt sich mit Holo verbinden, tauschen und verkaufen.

## 4 Was beim Einbauen dazukommt

- Stil `hokusai` in der Liste, Wurfregel am Server, Tests.
- Würfel-Haut in Preußischblau mit Schaumkrallen, im Duell steht die Figur frei im Holzschnitt-Look.
- Beim Ziehen: ein Druckstock mit Reibekissen druckt das Blatt, Sepia sagt einen Satz dazu.
- Test-Knopf für Mods, Hinweis im goldenen Wochenend-Band, README.

## 5 Fragen

1. Aussehen: passt der Entwurf? Empfehlung: ja.
2. Ansichten: beide (aus dem Seed, etwa 7 von 10 die Welle, 3 von 10 der rote Fuji) oder nur die Welle? Empfehlung: beide.
3. Chance: eine Seite des W20 (1 zu 500 je Zug am Wochenende) oder zwei (1 zu 250)? Empfehlung: eine Seite, er soll etwas Besonderes bleiben.
4. Name im Spiel: „Hokusai“ oder „Great Wave“? Empfehlung: „Hokusai“.
5. Sepias Satz beim Ziehen, Vorschlag: „An old master’s wave. It only comes in on weekends.“ Passt das? Empfehlung: ja.
6. Stile am Wochenende noch einmal doppelt (4 %), wie gebaut, oder dort bei 2 % lassen? Empfehlung: so lassen, das Wochenende soll sich weiter lohnen.
