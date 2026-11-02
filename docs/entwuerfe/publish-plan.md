# Plan: Veröffentlichen und Subreddit-Auftritt

Stand 02.11.2026, Fassung 1. Release-Plan Schritt 4. Entwurf docs/entwuerfe/subreddit-entwurf.png (Quelle tools/mockup/sub-entwurf.ts, alles aus dem Renderer gemalt, keine Bilddateien, keine KI).

## Was Reddit verlangt und was noch fehlt

Geprüft in der Devvit-Doku (Launch Guide, Feature Guide, In-app Catalog Assets, Playtest).

- **Einreichen:** `npx devvit publish` mit README. Das README ist fertig. Neue Apps brauchen etwa eine Woche, Updates 1 bis 2 Werktage. Spiele bleiben standardmäßig ungelistet (nicht im App-Verzeichnis), das passt.
- **Eigenes Subreddit, kein Test-Subreddit:** r/beforeitdries. Reddit schaut sich bei der Prüfung auch die Beispiel-Posts dort an.
- **Playtests:** Ein Playtest-Subreddit darf höchstens 199 Mitglieder haben, und ein Playtest ersetzt dort die installierte Version. Nach dem Veröffentlichen dürfen Playtests also nicht mehr in r/beforeitdries laufen.
- **Katalog** (für Spiele-Feed und Featuring, nach der Freigabe, im Developer Portal unter Developer Settings, eigene Prüfung): App-Icon, großes Bild oder Video, Kachelbild, kurze Beschreibung, Tagline, Spielkategorie, App-Subreddit. Post-Flairs werden ausdrücklich empfohlen, damit Reddit nur passende Posts zeigt.
- **App-Icon in devvit.json:** `marketingAssets.icon`, PNG 1024 × 1024.
- **Banner, Community-Icon, Farben, Beschreibung:** kann eine App nicht setzen, das geht nur in den Mod-Einstellungen (auch in der Reddit-App am Handy).
- **Kann die App selbst anlegen:** Regeln, Post-Flairs, Seitenleisten-Widgets, Wiki-Seiten, Gründe fürs Entfernen.

## Schritte

### 1 Auftritt des Subreddits

**Bilder** (Entwurf, Auswahl in Frage 1 und 2), fertig als JPG unter 120 KB, PNG für das App-Icon:

- Banner Desktop 1920 × 384: A „Parade“ (Titel links, Kleckse ziehen nach rechts, der rechte Rand bleicht aus, dort ausgebleichte Pales) oder B „Duell“ (zwei Gebiete auf dem Blatt, „vs“).
- Banner Handy 1600 × 480: Kleckse oben, Mitte unten frei für Icon und Name.
- Community-Icon 512 × 512, rund geschnitten: A Klecks mit Hut (Ultramarin) oder B Stachelklecks (Opera Rose).
- App-Icon 1024 × 1024 im selben Motiv wie das Community-Icon.

**Farben:** Hauptfarbe Sepia `#6B4A2F` (Knöpfe wie Join), Hintergrund Papier `#F4EEE2`.

**Beschreibung** (Mod-Einstellungen, höchstens 500 Zeichen):

> A watercolour dice game. Every monster is a one-of-a-kind blot and a die. Duel, collect, hold the sheet against the Bleach, and name new species together. Tap Play on the pinned post to start.

**Einrichtung per Mod-Menü** (Frage 3): Ein neuer Eintrag im Subreddit-Menü „Before It Dries: set up the community“ legt alles Folgende an. Ein zweiter Tipp ändert nichts doppelt, geänderte Texte werden ersetzt.

- **Regeln** (Frage 4):
  1. *Be kind.* No harassment, hate or slurs, in comments, names or drawings.
  2. *Keep drawings clean.* No obscene drawings, hate symbols or real people. Drawings are reviewed before others see them, and repeated paint-overs lock drawing.
  3. *Good names only.* Species names are short, family-friendly, and not the names of real people, brands or ads.
  4. *No real money.* Dice and pigment are traded for pigment only. Offers of money, gift cards, accounts or Reddit Gold are removed and lead to a ban.
  5. *No spam.* Ideas, feedback and bug reports are welcome with the right flair.
- **Gründe fürs Entfernen:** je einer zu den Regeln 1 bis 4.
- **Post-Flairs:** Play, Today’s sheet, What do you see?, Discussion, Feedback, Bug. Die App setzt sie auf ihre eigenen Posts selbst (Spiel-Post, Tagespost, Benennen-Post), Frage 5. Für den Katalog trage ich Play und Today’s sheet ein.
- **Seitenleiste:** Text „How to play“ (fünf Zeilen, wie im README), Knopf „Full guide“ zum Wiki.
- **Wiki-Seite `how-to-play`:** der Spieler-Teil des README auf Englisch, dazu kurze Antworten auf häufige Fragen (Pigment, Drops, Trading, Drawings, Deleting your data).

**Was du machst** (etwa 5 Minuten in der Reddit-App): Mod Tools, Community appearance: Banner (Desktop und Handy), Icon, Farben. Mod Tools, Description: Text oben. Danach einmal „set up the community“ antippen. Die fertigen Bilder lege ich in docs/entwuerfe/subreddit/, dort kannst du sie am Handy aus GitHub laden.

### 2 Test-Subreddit für Playtests

Frage 6. Empfehlung: das private Test-Subreddit, das Devvit beim ersten Upload automatisch angelegt hat (meist r/beforeitdries_dev, nur Mods, du bist Mod). Ich stelle `dev.subreddit` in devvit.json darauf um und lade den nächsten Stand dorthin. u/Vegatest lade ich dort als genehmigten Nutzer ein, damit du auch als normaler Spieler testen kannst. Danach gilt: Playtests nur dort, r/beforeitdries bekommt nur geprüfte Versionen.

### 3 Testdaten vor dem Start

Frage 7. In r/beforeitdries liegen noch Daten aus den Tests: Test-Maler in der Galerie (test:deck), Test-Händler in Markt und Tausch (test:trader), Test-Tagesblätter, Arten-Namen aus Tests und viele alte Posts (Tagesposts, Benennen-Posts, Spiel-Posts). Echte Spieler würden die Test-Maler treffen.

- **A** (Empfehlung): Ein Mod-Werkzeug „Remove test data“ (nur im Playtest, wie die anderen Test-Knöpfe) entfernt alle Test-Maler und Test-Händler samt Einträgen, Angeboten und Lieferungen. Alte App-Posts außer dem angepinnten Spiel-Post und dem heutigen Tagespost werden entfernt, ohne dass die Lösch-Trigger einen neuen Post anlegen. Dein Spielstand, deine Würfel und vergebene Namen bleiben.
- **B:** Alles auf null (alle Spielstände, Galerie, Markt, Archiv, Namen, Ranglisten). Gleicher Start für alle, deine Sammlung ist weg.
- **C:** Nichts tun.

### 4 Veröffentlichen

1. Test als u/Vegatest (Liste in docs/entwuerfe/neuer-spieler-bericht.md), Rückmeldung einbauen.
2. Letzter Playtest in r/beforeitdries, „Remove test data“, „set up the community“.
3. Playtests auf das Test-Subreddit umstellen.
4. `npx devvit publish --version 0.1.0`, ungelistet (Frage 8). Danach läuft Reddits Prüfung. In der Zeit bleibt der letzte Playtest in r/beforeitdries installiert.
5. Nach der Freigabe: `npx devvit install beforeitdries` (die geprüfte Version ersetzt den Playtest), Spiel-Post und Tagespost prüfen. Test-Knöpfe sind dann von selbst weg (Version ohne vierte Stelle).

### 5 Katalog und Feedback (nach der Freigabe)

- **Katalog** im Developer Portal (developers.reddit.com, Developer Settings, In-app catalog, geht im Handy-Browser): App-Icon, großes Bild, Kachelbild, Texte, Kategorie, App-Subreddit r/beforeitdries, Flairs Play und Today’s sheet. Die Maße zeigt der Editor, ich male die Bilder dann passend aus dem Renderer.
  - Tagline: *Every blot is a die.*
  - Beschreibung: *Collect one-of-a-kind watercolour monsters, roll them as dice and paint the sheet before it dries. Duel rivals, hold the daily sheet against the Bleach, and name new species with your community.*
  - Kategorie: Strategy (falls es sie gibt, sonst die nächstpassende).
- **Feedback-Posts:** r/GamesOnReddit mit Flair Feedback und r/Devvit mit Flair Feedback Friday. Die Texte schreibe ich dir vor.
- **Rhythmus danach:** Playtests jederzeit im Test-Subreddit, Releases gesammelt höchstens einmal pro Woche.

## Fragen

1. **Banner:** A „Parade“ oder B „Duell“? (Empfehlung: A, zeigt mehrere Monster und den Namen)
2. **Icon:** A Klecks mit Hut oder B Stachelklecks? (Empfehlung: B, bleibt in Feed-Größe 24 bis 32 Pixel besser erkennbar)
3. **Einrichtung per Mod-Menü** (Regeln, Gründe, Flairs, Seitenleiste, Wiki) oder von Hand nach meiner Liste? (Empfehlung: Mod-Menü, die Seitenleiste geht in der Reddit-App sonst gar nicht)
4. **Regeln** wie oben? (Empfehlung: ja)
5. **Flairs auf App-Posts** automatisch? (Empfehlung: ja, der Katalog braucht sie)
6. **Test-Subreddit:** das automatisch angelegte private oder ein neues, das du anlegst? (Empfehlung: das automatische)
7. **Testdaten:** A, B oder C? (Empfehlung: A)
8. **Version 0.1.0, ungelistet:** ja? (Empfehlung: ja)
