# Katalog und Feedback-Posts

Stand 04.11.2026, Fassung 1. Publish-Plan Schritt 5. Version 0.1.0 ist freigegeben und in r/beforeitdries installiert.

Quelle: Devvit-Doku (In-app Catalog Assets, Feature Guide, Launch Guide). Die Bildmaße stehen dort nicht, die zeigt erst der Editor im Developer Portal.

## 1 Katalog im Developer Portal

**Wo:** developers.reddit.com, App „beforeitdries“, Developer Settings, Abschnitt **In-app catalog**. Geht im Handy-Browser. Der Editor hat eine Vorschau. Fehlt der Abschnitt, hat die App den Zugang noch nicht.

**Was Reddit verlangt:**

| Feld | Pflicht | Was ich vorschlage |
| --- | --- | --- |
| App icon | ja | `assets/icon.png` (Klecks mit Hut, 1024 × 1024), liegt auch in docs/entwuerfe/subreddit/app-icon.png |
| Featuring asset | ja | großes Bild: Duell mit Klecksen, Würfeln und Aquarell-Blatt, wenig Text. Male ich aus dem Renderer, sobald ich die Maße habe |
| Fallback asset | nur bei Video | entfällt, wir nehmen ein Bild |
| Tile image | ja | kleines Bild: zwei Kleckse über einem Würfel, ohne Text. Male ich ebenso |
| Featuring description | ja | siehe unten |
| Tile tagline | ja | siehe unten |
| Game category | ja (Spiel) | Strategy, falls es sie gibt, sonst die nächstpassende |
| App subreddit | ja | r/beforeitdries |
| Post sort order | nein | Hot (Standard) |
| Post flairs | nein, empfohlen | `Play` und `Today's sheet` (ohne Emojis) |

**Texte:**

- **Tile tagline:** Every blot is a die.
- **Featuring description:** Collect one-of-a-kind watercolour monsters, roll them as dice and paint the sheet before it dries. Duel rivals, hold the daily sheet against the Bleach, and name new species with your community.

**Hinweise aus der Doku:** wenig Text im Bild (kleine Plätze schneiden zu), genug Kontrast auch in Graustufen, kein Flackern. Eine falsche Kategorie kann zur Ablehnung führen. Die Bilder werden noch einmal geprüft, bevor sie im Katalog erscheinen.

**Was ich von dir brauche:** die Maße, die der Editor bei Featuring asset und Tile image anzeigt (Screenshot reicht). Dann male ich beide Bilder und lege sie als PNG in docs/entwuerfe/katalog/.

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
