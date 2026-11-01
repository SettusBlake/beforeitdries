# Plan: erster Release

Stand 02.11.2026, Fassung 1. Wartet auf Freigabe (6 Fragen unten).

## Ziel

Before It Dries wird als Version 0.1.0 bei Reddit eingereicht und läuft danach in r/beforeitdries für alle. Playtests laufen weiter, aber in einem eigenen Test-Subreddit.

## Was Reddit verlangt

Geprüft in der offiziellen Doku (reddit/devvit-docs: Launch Guide, Feature Guide, Devvit Rules, User Actions, Trigger).

- **Einreichen:** `npx devvit publish`. Reddit prüft Code, Beispiel-Posts und README. Neue Apps brauchen etwa eine Woche, Updates meist 1 bis 2 Werktage. Jede Version wird neu geprüft, daher Releases höchstens wöchentlich.
- **README:** Pflicht, in einfachen Worten für Nicht-Entwickler (Überblick oben, höchstens 1000 Wörter, dann Einrichtung und alle Funktionen). Ohne brauchbares README wird abgelehnt. Unseres ist deutsch und für Entwickler.
- **Kein Scrollen in Inline-Posts:** ausdrücklich verboten. Der neue Tagespost scrollt in der Rangliste. Das muss weg.
- **Teilen von Ergebnissen:** muss als Spieler gepostet werden (haben wir), aber als Antwort auf einen angehefteten Kommentar, nicht als eigener Kommentar oben. Der Knopf muss klar sagen, dass unter dem eigenen Namen gepostet wird und wer es sieht.
- **Bilder von Spielern** (unsere Zeichnungen) sollen mit meldbarer Zuordnung erscheinen, zum Beispiel als Post des Spielers. Unsere Benennen-Posts kommen vom App-Konto.
- **Löschen:** Wird ein Post oder Kommentar gelöscht, muss alles dazu aus Redis. Wird ein Konto gelöscht, müssen ID und Name des Spielers überall raus. Für Konten gibt es in Devvit Web keinen Trigger.
- **Eigenes Subreddit, kein Test-Subreddit:** r/beforeitdries passt. Ein Playtest dort ersetzt aber die Version für alle, also brauchen Playtests ein anderes Subreddit.
- **Tests mit mehreren Konten:** Entwickler, Mod und normaler Spieler.
- **Sofort verständlich, eigener erster Bildschirm, Handy und Desktop.**
- **Unkritisch, geprüft:** keine Zahlungen, kein Fetch nach außen, keine KI. Pigment nur durchs Spielen, Handel nur gegen Pigment, also kein Glücksspiel im Sinne der Regeln. Schriften OFL, Grafik aus Code, keine fremden Marken.

## Schritte

### 1 Regeln erfüllen

- **Tagespost ohne Scrollen:** Top 6 mit Blättern und dein Platz passen in den Post. Die ganze Liste gibt es im Spiel.
- **Teilen nach Regel:** Die App setzt im Tagespost einen angehefteten Kommentar („Share your sheet here“). „Share as a comment“ antwortet darauf. Über dem Knopf steht: „Posts a reply as u/name under today’s sheet. Everyone can see it.“
- **Benennen-Posts im Namen des Finders** (`runAs: 'USER'` mit `userGeneratedContent`), Frage 2.
- **Löschen:**
  - `onPostDelete`: Benennen-Post weg, dann Eintrag weg. Ist das Benennen noch offen, wird die Art wieder frei. Beim Tagespost bleibt nur die Zuordnung Post → Tag.
  - `onCommentDelete`: Kommentar mit dem Namen einer Art weg, siehe Frage 3.
  - Konten: wöchentlicher Auftrag fragt bei Reddit nach jedem Spieler. Ist das Konto gelöscht, verschwinden Spielstand, Duelle, Galerie, Markt, Angebote, Lieferungen, Rangliste und Ergebnisse. Namen in Archiv, Bestiary, Herkunft und Meldungen werden zu „a painter“. Seriennummern und Würfel anderer Spieler bleiben.
- Tests für alles.

### 2 Aufräumen

- **Alter Code raus:** altes Malblatt (src/client/game.*, splash.*), Tagesklecks und Fangen aus src/server/core.ts, alte Tests dazu, Einstellung `dryHours` (Mods sähen eine Einstellung ohne Wirkung), leere Route `daily-blot`.
- **README neu auf Englisch** für Spieler und Mods: was das Spiel ist, die Post-Arten (Spiel, Tagesblatt, Benennen), Mod-Menüs, Mod-Werkzeuge, Prüfen von Zeichnungen, Zeitpläne. Die deutsche Entwickler-Beschreibung wandert nach docs/entwickler.md.

### 3 Neuer Spieler und Qualität

- **Erster Weg durchgespielt** mit leerem Stand in der Vorschau: Startbild, Lern-Duell, Startzüge, erstes Duell, Tagesblatt. Gemessen: Taps, Wartezeiten, Stellen ohne klaren nächsten Schritt. Bilder davon. Kleine Brüche behebe ich gleich, größere kommen als Frage.
- **Ladezeit:** Der Inline-Spielpost lädt gut 110 KB Renderer (gepackt) und Schriften. Ich messe am gedrosselten Handy und mache ihn leichter, falls er spürbar wartet.
- **Desktop:** alle Bildschirme im Breitbild prüfen.
- **Zweites Konto:** Du testest einmal als normaler Spieler ohne Mod-Rechte (Frage 6).

### 4 Veröffentlichen

- **Test-Subreddit** (Frage 1): Du legst es an, ich stelle `dev.subreddit` um. Danach laufen Playtests dort.
- **Version 0.1.0 einreichen** mit `npx devvit publish`. Danach in r/beforeitdries installieren, Spiel-Post und Tagespost anlegen.
- **Nach der Freigabe:**
  - Katalog-Bilder für das Featuring: App-Icon, großes Bild, Kachel, Text. Ich erzeuge sie aus dem Renderer.
  - Feedback-Posts in r/GamesOnReddit (Flair Feedback) und r/Devvit (Feedback Friday), Text schreibe ich dir vor.
- **Rhythmus danach:** Playtests jederzeit im Test-Subreddit, Releases gesammelt höchstens einmal pro Woche.

## Fragen

1. **Test-Subreddit:** Du legst ein privates Subreddit an (z. B. r/beforeitdries_dev), Playtests laufen künftig dort, r/beforeitdries bekommt die veröffentlichte Version? (Empfehlung: ja)
2. **Benennen-Posts im Namen des Finders** statt vom App-Konto? Damit sind Zeichnungen meldbar zugeordnet, wie die Regeln es wollen. (Empfehlung: ja)
3. **Kommentar mit dem Namen einer Art gelöscht:**
   - a: Die Art wird wieder offen und kann neu benannt werden. So verlangen es die Regeln streng genommen.
   - b: Der Name bleibt, nur der Namensgeber verschwindet.
   (Empfehlung: a)
4. **Umfang:** alles veröffentlichen, oder Selbstmalen und Tausch zuerst ausschalten (weniger Prüfaufwand, schnellere Freigabe, später nachreichen)? (Empfehlung: alles, Prüfliste, Sperre und Melden sind da. Lehnt Reddit etwas ab, schalte ich es per Schalter aus)
5. **Tagespost:** Top 6 mit Blättern und dein Platz, die volle Liste im Spiel? (Empfehlung: ja)
6. **Zweites Reddit-Konto** ohne Mod-Rechte zum Testen: Hast du eins oder legst du eins an? (Reddit verlangt Tests als normaler Spieler)
