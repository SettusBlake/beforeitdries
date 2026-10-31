# Plan: Stil und Holo getrennt

Stand 31.10.2026, Fassung 2. Freigegeben am 31.10.2026 mit allen Empfehlungen (Fragen 1 bis 6 „ja“). Gebaut, Playtest v0.0.1.83, Bild docs/entwuerfe/holo-im-spiel.png.

Rückmeldung 31.10.2026 zu docs/entwuerfe/stile-mehr-plan.md (Fassung 3):
- Graffiti und Jugendstil-Karte ins Spiel: ja.
- Die Stile müssen nicht alle Shiny sein. Shiny soll zusätzlich Glanz bringen, Holo.
- Weitere Ideen ohne Entwurf (Knetfigur, Low-Poly, Kreuzstich, Höhlenmalerei, Risograph): weglassen.

Entwurf zum Anfassen: https://claude.ai/artifact/X4NZReuNkwh5XUFryRVS1i (Karten mit dem Finger kippen). Bild: docs/entwuerfe/holo-entwurf.png. Quelle tools/mockup/holo/ (main.ts, page.html, build.mjs).

## Heute

- Shiny heißt heute: Hand-W100 zeigt 100, dann W10 zeigt 10 (1 zu 1000), dann würfelt ein W20 einen von 13 Stilen. Stil und Shiny sind dasselbe.
- Shiny hebt Papier und Seltenheit eine Stufe.

## Neu: zwei getrennte Dinge

1. **Stil:** eine andere Malweise statt Aquarell. 15 Stile (die 13 von heute, dazu Graffiti und Jugendstil-Karte). Kein Glanz, seltener Fund, aber häufiger als heute.
2. **Holo (Shiny):** Folienglanz über dem Bild. Geht auf jedem Monster, ob Aquarell oder Stil. Sehr selten. Hebt die Seltenheit eine Stufe wie heute.

## Würfe, offen wie bisher

Die Hand wirft bei jedem Zug zwei Würfel:

| Wurf | Folge | je Zug |
|---|---|---|
| weißer W100 zeigt 100 | W20 wählt den Stil | 1 zu 100 |
| goldener W10 zeigt 10 | goldener W100, zeigt er 100: Holo | 1 zu 1000 |
| beides im selben Zug | Stil mit Holo | 1 zu 100 000 |

Bei etwa jedem zehnten Zug rollt also ein zweiter goldener Würfel: kurze Spannung, ohne den Zug lang zu machen.

### Stile auf dem W20 (15 Stile)

| Seiten | Stile | je Zug |
|---|---|---|
| je 2 | Pencil, Comic, Anime, Pixel, Neon | je 1 zu 1000 |
| je 1 | Bestiary Plate, Crayon, Oil, Ukiyo-e, Stained Glass, Blueprint, Papercut, Mosaic, Graffiti, Jugendstil | je 1 zu 2000 |

## Holo-Effekt (im Entwurf)

- **Folie:** Regenbogen, der beim Kippen über das Bild wandert, durch ein Muster in der Folie. Vier Muster je nach Monster: Regenbogen (gebürstet), Sterne, Rauten, Glitzer.
- **Glanz:** heller Lichtfleck folgt dem Finger, sonst wandert er von selbst. Ein leichter Regenbogenschimmer liegt über dem ganzen Bild, auch auf hellem Papier.
- **Rand:** die Karte bekommt einen Regenbogenrand, der beim Kippen die Farbe dreht, dazu das Schild „✦ Holo“.
- **Karte und Ziehen:** Karte kippt mit dem Finger. Beim Ziehen zieht die Folie nach dem Malen einmal über das Bild, mit Klang und Sepias Satz.
- **Sammlung und Deck:** Regenbogenrand und langsamer Schimmer.
- **Duell:** Folie steht still (Regenbogen durch das Muster, Funkeln), Regenbogenring am Sockel.
- Technik: auf Karte, Sammlung und Deck als Lage über dem gemalten Bild (bewegt sich ohne neu zu malen), im Duell und beim Ziehen fest auf dem Bild.

## Was mit bisherigen Würfeln passiert

- Bisherige Shinys (Stil aus dem alten Wurf 1 zu 1000) behalten ihren Stil und bekommen Holo dazu. Sie waren 1 zu 1000 und wurden schon eine Stufe gehoben.
- Nur Holo hebt die Seltenheit. Ein Stil allein hebt nicht.
- Auswaschen: Holo fragt nach wie heute Shiny, ein Stil allein nicht.

## Weitere Änderungen

- Pixel zeigt auf der großen Karte „★ SHINY“: wird zur Seriennummer, weil ein Stil allein kein Shiny mehr ist.
- Test-Knopf (Playtest, nur Mods): Stil wählen und Holo an oder aus, getrennt.
- Werkzeuge beim Ziehen für Graffiti (Sprühdose mit Nebel) und Jugendstil (Feder mit goldener Spitze).
- Karte: Zeile „✦ Holo · rainbow foil · 1 in 1000“ und darunter der Stil, wenn es einen gibt.

## Reihenfolge

1. Server: zwei Würfe, Würfel-Feld `holo` (mit Muster aus dem Seed), bisherige Shinys bekommen Holo, Seltenheit hebt nur Holo, Test-Knopf, Tests.
2. Graffiti und Jugendstil in den Renderer, W20 mit 15 Stilen, Werkzeuge.
3. Holo auf Karte, Sammlung, Deck, Duell und beim Ziehen. Upload und Bild.

## Gebaut (31.10.2026)

- **Würfe:** `rollHand` in src/shared/dice.ts: weißer W100 (100: W20 für den Stil), goldener W10 (10: goldener W100, 100: Holo). PullResult `hand`, `styleRoll`, `gold`, `goldD100`, `lifted`. Würfel-Felder `style` und `holo`, Folie aus dem Seed (`foilOf`).
- **Stile:** 15 auf dem W20 (`STYLES`), Pencil, Comic, Anime, Pixel, Neon je 2 Seiten (1 zu 1000), die übrigen zehn je 1 Seite (1 zu 2000). Graffiti und Art Nouveau im Renderer (src/client/renderer/shiny.ts), Werkzeuge Sprühdose und Feder.
- **Umzug:** Stand 2 der Sammlung. Würfel mit Stil aus Stand 1 bekommen Holo, alles andere bleibt. Nur Holo hebt die Seltenheit, nur Holo fragt beim Auswaschen nach.
- **Anzeige:** src/client/lib/holo.ts und holo.css. Würfelkarte groß mit Folie, kippt mit dem Finger, Zeilen „✦ Holo · Muster · 1 in 1000“ und „Style · Name · 1 in …“. Sammlung mit Regenbogenrand und Schild „✦ Holo“, Deck mit Regenbogenring, Übersicht nach dem Zehnerzug ebenso. Duell: Folie fest auf dem Aufkleber, drehender Regenbogenring am Sockel. Benennen-Post mit Folie.
- **Ziehen:** Hand zeigt beide Würfel. Weiß 100: W20 mit den Stilnamen, Sepia, Werkzeug malt neu. Gold 10: goldener W100 groß, bei 100 „✦ HOLO ✦“, Sepia („It catches the light. I did not paint that.“), die Folie zieht schräg mit Lichtstreif über das Bild, dann „✦ HOLO LIFTS IT ✦“. Karte mit Regenbogenrahmen. Zehnerzug: Hand mit beiden Würfeln auf jedem Klecks, Holo vor Stil auf der großen Bühne.
- **Test-Knopf:** „✦ Holo“ und die 15 Stile getrennt wählbar (Playtest, nur Mods).
- Pixel zeigt auf der großen Karte die Nummer statt „★ SHINY“.

## Fragen

1. Stil und Holo getrennt wie beschrieben, Holo auf jedem Monster? (Empfehlung: ja)
2. Stil 1 zu 100 je Zug? (Empfehlung: ja, ein Stil fällt dann etwa alle zwei Zehnerzüge. Alternative 1 zu 200)
3. Holo 1 zu 1000 je Zug, über den goldenen W10 und W100? (Empfehlung: ja)
4. Holo-Look aus dem Entwurf passt, mit vier Mustern je nach Monster? (Empfehlung: ja)
5. Bisherige Shinys behalten den Stil und bekommen Holo? (Empfehlung: ja)
6. Nur Holo hebt die Seltenheit eine Stufe? (Empfehlung: ja)
