# Katalog und Feedback-Posts

Stand 04.11.2026, Fassung 3. Publish-Plan Schritt 5. Version 0.1.0 ist freigegeben und in r/beforeitdries installiert.

Quelle: Devvit-Doku (In-app Catalog Assets, Feature Guide, Launch Guide) und der Editor im Developer Portal (Screenshot vom 04.11.2026).

## 1 Katalog im Developer Portal

**Wo:** developers.reddit.com, App „beforeitdries“, Developer Settings, Abschnitt **In-app catalog**. Geht im Handy-Browser. Der Editor hat eine Vorschau.

**Vorgaben des Editors:** JPG oder PNG, bis 800 KB empfohlen, höchstens 3 MB. Featuring 1500 × 1000 (mindestens 1000 × 667), Kachel 560 × 256 (mindestens 280 × 128). Featuring description höchstens 35 Zeichen, Tile tagline höchstens 20.

**Was hochladen** (alles in docs/entwuerfe/katalog/, Vorschau in docs/entwuerfe/katalog-entwurf.png):

| Feld | Datei | Größe |
| --- | --- | --- |
| Promotional icon | `icon-1024.png` (Klecks mit Hut, wie das App-Icon, wird rund geschnitten) | 1024 × 1024, 472 KB |
| Featuring asset | `featuring-video-1500x1000.mp4` (Video, siehe unten) oder als Bild `featuring-1500x1000.jpg` | 1500 × 1000, 2,5 MB oder 258 KB |
| Fallback asset | `featuring-1500x1000.jpg` (zwei Kleckse auf dem Blatt, Spritzer, drei Würfel, rechts bleicht der Rand aus, ein Pale) | 1500 × 1000, 258 KB |
| Tile image | `tile-560x256.png` (die beiden Kleckse und ein Würfel) | 560 × 256, 262 KB |

Kein Text im Bild, weil der Katalog Name und Beschreibung darunter setzt und kleine Plätze zuschneiden. In Graustufen geprüft: Kleckse und Würfel bleiben gut unterscheidbar.

**Video** (gewählt am 04.11.2026, der Editor bevorzugt MP4): 11,5 Sekunden, 30 Bilder pro Sekunde, ohne Ton. Das erste Bild ist das Featuring-Bild (falls nichts abspielt). Dann ein echtes Duell aus der Vorschau im Handy-Rahmen neben dem Klecks mit Hut: Würfel fallen, ein Netz klappt auf, Treffer mit Zahlen, „WASHED OUT“, „PALETTE HIT“, Meisterzug „Rain“. Am Ende Titel und Tagline. Kein schnelles Flackern. Übersicht docs/entwuerfe/katalog-video-entwurf.png, Herstellung tools/mockup/video/LIESMICH.md.

**Texte:**

- **Featuring description** (35): `Roll watercolour monsters as dice` (33 Zeichen). Andere Möglichkeit: `Watercolour monsters. Dice duels.` (33)
- **Tile tagline** (20): `Every blot is a die.` (genau 20)
- **Game category:** Strategy (steht in der Vorschau schon so)

**Featured surfaces:**

- App subreddit: r/beforeitdries
- Post sort order: Hot (Standard)
- Post flairs: `Play` und `Today's sheet` (ohne Emojis)

Die Bilder werden von Reddit noch einmal geprüft, bevor sie im Katalog erscheinen.

## 2 Feedback-Posts

Laut Launch Guide: den Spiel-Post nach r/Devvit mit Flair **Feedback Friday** crossposten und nach r/GamesOnReddit mit Flair **Feedback**. Crossposten geht in der Reddit-App am angepinnten Play-Post über „Teilen“, „Crosspost“. Danach einen ersten Kommentar unter den Crosspost setzen.

### r/GamesOnReddit (Flair: Feedback)

**Titel:** Before It Dries: every watercolour monster is also a die. Roll, paint the sheet, outlast the Bleach

**Erster Kommentar:**

> Hi! I made Before It Dries, a short dice duel for phones and desktop.
>
> Every monster is a one-of-a-kind watercolour blot painted from its own seed, and every blot is a die. You roll three dice, hold and reroll (careful, the paper gets wet), summon blots onto the sheet and paint it. Most paper when it dries wins, or break the rival's palette.
>
> There is also a daily sheet, the same for everyone, where pale bleached blots slide down from the top edge, and you can name new species together in the comments.
>
> A guided lesson with Master Sepia takes about 90 seconds. I would love to hear what is unclear, too slow or too easy. Thanks for playing!

### r/Devvit (Flair: Feedback Friday, am Freitag)

**Titel:** Feedback Friday: Before It Dries, a watercolour dice duel with procedural monsters (Devvit Web, Canvas 2D)

**Erster Kommentar:**

> Before It Dries is my first Devvit Web game. A few things that might interest other developers:
>
> - Every monster is painted on the client from a seed (Canvas 2D, no images stored), all rolls happen on the server.
> - A daily sheet with the same rolls for everyone and a ranked board, plus a daily post by the scheduler.
> - Species are named by the community: the top comment under a "What do you see?" post becomes the name.
> - Players can draw their own monster; drawings are reviewed by moderators before others see them.
>
> Feedback on the first minutes (lesson, first dice, first duel) and on performance on older phones is very welcome.

## 3 Danach

- Rhythmus: Playtests jederzeit in r/beforeitdries_dev, Releases gesammelt höchstens einmal pro Woche (`npx devvit publish`, dann `npx devvit install beforeitdries`).
- Nächste kleine Punkte: Kleckse am Rand leicht abgeschnitten, Benennen-Post unter 512 Pixel Höhe, nie gezeigtes Ergebnis, Node 24.
- Quelle der Bilder: tools/mockup/sub-entwurf.ts, Modus `#catalog`.
