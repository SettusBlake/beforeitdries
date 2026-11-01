# Vorschlag: Würfel-Häute (Farbe sichtbarer, Holo- und Stil-Würfel)

Stand 01.11.2026, Fassung 1. Wartet auf Freigabe.

Wunsch (01.11.2026): Die Farben auf den Würfeln sollen besser sichtbar sein. Ist ein Monster holo oder hat es einen Stil, soll auch sein Würfel holo sein oder den Stil tragen.

Entwurf: docs/entwuerfe/wuerfel-haut-entwurf.png (Quelle tools/mockup/wuerfel-haut.ts, Häute in src/client/duel/faceskin.ts, Holo-Folie in src/client/duel/dieskin.css, noch nicht im Spiel). Echte Würfel aus dem Spiel.

## 1 Farbe sichtbarer

| Variante | Wie die Seite aussieht |
|---|---|
| Heute | blasse Lavierung hinter dem Symbol, Rand in der Farbe |
| A | ganze Seite in ihrem Pigment, das Symbol sitzt auf einem ausgehobenen Fleck Papier (wie nasse Farbe, die man mit einem Tuch abhebt), kräftiger Rand |
| B | wie A, dazu das Kürzel des Pigments oben links (UL, IN, PH, CA, OP, CD, SI, SE) |

- **Sterne und Joker** bleiben weißes Papier. Dadurch fallen die farbigen Seiten noch mehr auf.
- **Ähnliche Farben:** Ultramarin und Indigo sowie Siena und Sepia liegen nah beieinander. A macht sie satter und damit unterscheidbarer, B nennt sie zusätzlich. Das hilft auch bei Farbschwäche.

## 2 Holo-Würfel

- **Wann:** Der Würfel eines Holo-Monsters trägt die Folie.
- **Aussehen:** Regenbogenrand um jede Seite, dazu ein Schimmer, der beim Rollen über die Seiten läuft. Der Schatten unter dem Würfel schimmert ebenfalls.
- **Kombination:** Die Folie liegt über jeder Haut, auch über einem Stil-Würfel.

## 3 Stil-Würfel

Der Würfel eines Monsters mit Stil bekommt die Haut seines Stils. Die Farbe der Seite bleibt in jedem Stil lesbar.

| Stil | Würfel | Wo die Farbe steckt |
|---|---|---|
| Pencil | Papier mit Schraffur, Symbole in Graphit | Buntstift-Kringel um das Symbol |
| Comic | Rasterpunkte, Knall-Stern, dicke schwarze Kontur | Grund und Rasterpunkte |
| Anime | Verlauf, Glitzer, weiße Kontur | Verlauf und Rand |
| Pixel | Kacheln, Symbole als Pixelbild | Kacheln und Rand |
| Neon | dunkel, leuchtende Linien | Leuchtfarbe |
| Bestiary Plate | Pergament, Doppelrand in Sepia-Tinte | handkolorierter Fleck |
| Crayon | Wachsstriche, rauer Rand | Wachsstriche |
| Oil | Pinselstriche, Goldrahmen | Grund |
| Ukiyo-e | Washi, Wellen, Kartusche | Verlauf oben und Kartusche |
| Stained Glass | Bleiglas mit Scheiben | Glasscheiben |
| Blueprint | Rasterpapier, weiße Linien | Ecke und Farbmuster |
| Papercut | geschnittene Lagen mit Schatten | Lagen |
| Mosaic | Steinchen | Steinchen außen |
| Graffiti | Ziegelwand, Sprühfleck mit Läufern | Sprühfleck |
| Art Nouveau | Bogenfeld, Goldranken | Bogenfeld |

- **Sterne und Joker** bleiben auch im Stil ohne Farbe.

## 4 Wo die Häute gelten

Überall, wo Würfelseiten zu sehen sind:
- 3D-Würfel auf der Würfelbühne im Duell
- Netz-Vorschau beim Beschwören auf dem Blatt
- Chips in der Beschwörphase
- Seiten auf der Würfelkarte (Sammlung, Markt, Tausch)
- Karte beim Ziehen

## Leistung

Jede Seite ist ein kleines SVG. Drei Würfel auf der Bühne sind 18 Seiten, das ist am Handy kein Problem. Die Holo-Folie ist reines CSS wie auf der Karte.

## Reihenfolge

1. Farbe nach Wahl (A oder B) überall einbauen
2. Holo-Würfel
3. Stil-Würfel
4. Ein Upload mit Bild

## Fragen

1. Farbe: A (ganze Seite) oder B (A mit Kürzel)? (Empfehlung: B, weil sich Blau und Braun sonst leicht verwechseln)
2. Holo-Würfel wie im Entwurf? (Empfehlung: ja)
3. Stil-Würfel: alle 15 wie im Entwurf, oder soll ein Stil anders aussehen? (Empfehlung: so lassen)
4. Häute überall, wo Seiten zu sehen sind (Bühne, Netz, Chips, Karte, Ziehen)? (Empfehlung: ja)
