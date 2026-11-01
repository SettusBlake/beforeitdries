# Vorschlag: Würfel-Häute (Farbe sichtbarer, Holo- und Stil-Würfel)

Stand 01.11.2026, Fassung 1. Freigegeben am 01.11.2026 („1 b ist ok, 2 ok, 3 ok, 4 ja“). Gebaut, Playtest v0.0.1.113, Bild docs/entwuerfe/wuerfel-haut-im-spiel.png.

Wunsch (01.11.2026): Die Farben auf den Würfeln sollen besser sichtbar sein. Ist ein Monster holo oder hat es einen Stil, soll auch sein Würfel holo sein oder den Stil tragen.

Entwurf: docs/entwuerfe/wuerfel-haut-entwurf.png (Quelle tools/mockup/wuerfel-haut.ts). Code: Häute in src/client/duel/faceskin.ts (`faceSvg`, `lookOf`, `faceTile`, `faceImage`, `holoRim`), Holo-Folie und Kacheln in src/client/duel/dieskin.css, 3D-Würfel in src/client/duel/dice3d.ts.

## 1 Farbe sichtbarer (gewählt: B)

| Variante | Wie die Seite aussieht |
|---|---|
| Früher | blasse Lavierung hinter dem Symbol, Rand in der Farbe |
| A | ganze Seite in ihrem Pigment, das Symbol sitzt auf einem ausgehobenen Fleck Papier (wie nasse Farbe, die man mit einem Tuch abhebt), kräftiger Rand |
| **B (gewählt)** | wie A, dazu das Kürzel des Pigments oben links (UL, IN, PH, CA, OP, CD, SI, SE) |

- **Sterne und Joker** bleiben weißes Papier. Dadurch fallen die farbigen Seiten noch mehr auf.
- **Ähnliche Farben:** Ultramarin und Indigo sowie Siena und Sepia liegen nah beieinander. B macht sie satter und nennt sie zusätzlich. Das hilft auch bei Farbschwäche.

## 2 Holo-Würfel (freigegeben)

- **Wann:** Der Würfel eines Holo-Monsters trägt die Folie.
- **Aussehen:** Regenbogenrand um jede Seite, dazu ein Schimmer mit Lichtstreif, der über die Seiten läuft. Der Schatten unter dem Würfel schimmert ebenfalls.
- **Kombination:** Die Folie liegt über jeder Haut, auch über einem Stil-Würfel.
- **Umsetzung:** Auf dunklen Stil-Würfeln (etwa Neon) war die Folie zuerst zu stark, die Zahl kaum lesbar. Sie mischt jetzt weicher (soft-light), der Rand bleibt kräftig.

## 3 Stil-Würfel (freigegeben)

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

## 4 Wo die Häute gelten (freigegeben: überall)

- 3D-Würfel auf der Würfelbühne im Duell, auch Schlamm und neu geworfene Seiten
- Netz-Vorschau beim Beschwören auf dem Blatt (Seite jetzt größer, Holo mit Regenbogenrand)
- Aufklappen des Netzes auf dem Blatt
- Chips in der Beschwörphase
- Karte im Duell (Netz)
- Würfelkarte in der Sammlung, im Markt und im Tausch (Netz und Seiten)
- Karte beim Ziehen

Klein bleiben nur die Symbole in Zeilen wie der Patina-Meldung im Ergebnis.

## Leistung

Jede Seite ist ein kleines SVG. Drei Würfel auf der Bühne sind 18 Seiten, das ist am Handy kein Problem. Auf dem Blatt und beim Ziehen werden die Seiten einmal als Bild erzeugt und zwischengespeichert. Die Holo-Folie ist reines CSS wie auf der Karte.

## Reihenfolge

1. Farbe B überall: gebaut
2. Holo-Würfel: gebaut
3. Stil-Würfel: gebaut
4. Upload mit Bild: Playtest v0.0.1.113, docs/entwuerfe/wuerfel-haut-im-spiel.png

## Fragen (beantwortet am 01.11.2026)

1. Farbe: A oder B? **B**
2. Holo-Würfel wie im Entwurf? **ja**
3. Stil-Würfel: alle 15 wie im Entwurf? **ja**
4. Häute überall, wo Seiten zu sehen sind? **ja**
