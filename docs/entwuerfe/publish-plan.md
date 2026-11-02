# Plan: Veröffentlichen und Subreddit-Auftritt

Stand 02.11.2026, Fassung 2. Release-Plan Schritt 4. Entwurf docs/entwuerfe/subreddit-entwurf.png (Quelle tools/mockup/sub-entwurf.ts, alles aus dem Renderer gemalt, keine Bilddateien, keine KI). Fertige Bilder in docs/entwuerfe/subreddit/.

## Was Reddit verlangt und was noch fehlt

Geprüft in der Devvit-Doku (Launch Guide, Feature Guide, In-app Catalog Assets, Playtest).

- **Einreichen:** `npx devvit publish` mit README. Das README ist fertig. Neue Apps brauchen etwa eine Woche, Updates 1 bis 2 Werktage. Spiele bleiben standardmäßig ungelistet (nicht im App-Verzeichnis), das passt.
- **Eigenes Subreddit, kein Test-Subreddit:** r/beforeitdries. Reddit schaut sich bei der Prüfung auch die Beispiel-Posts dort an.
- **Playtests:** Ein Playtest-Subreddit darf höchstens 199 Mitglieder haben, und ein Playtest ersetzt dort die installierte Version. Nach dem Veröffentlichen dürfen Playtests also nicht mehr in r/beforeitdries laufen.
- **Katalog** (für Spiele-Feed und Featuring, nach der Freigabe, im Developer Portal unter Developer Settings, eigene Prüfung): App-Icon, großes Bild oder Video, Kachelbild, kurze Beschreibung, Tagline, Spielkategorie, App-Subreddit. Post-Flairs werden ausdrücklich empfohlen, damit Reddit nur passende Posts zeigt.
- **App-Icon in devvit.json:** `marketingAssets.icon`, PNG 1024 × 1024, höchstens 500 KB.
- **Banner, Community-Icon, Farben, Beschreibung:** kann eine App nicht setzen, das geht nur in den Mod-Einstellungen (auch in der Reddit-App am Handy).
- **Kann die App selbst anlegen:** Regeln, Post-Flairs, Seitenleisten-Widgets, Wiki-Seiten, Gründe fürs Entfernen.

## Entscheidungen (02.11.2026)

1. **Banner:** A „Parade“.
2. **Icon:** A, Klecks mit Hut.
3. bis 6. und 8. offen gelassen: gebaut nach den Empfehlungen (Einrichtung per Mod-Menü, Regeln wie vorgeschlagen, Flairs auf App-Posts automatisch). Test-Subreddit (6) und Version (8) erst beim Veröffentlichen, Einspruch bis dahin möglich.
7. **Testdaten:** A, Test-Maler, Test-Händler und alte Test-Posts entfernen, dein Spielstand bleibt.

## Schritte

### 1 Auftritt des Subreddits

**Gebaut (02.11.2026, Playtest v0.0.1.143).**

**Bilder** in docs/entwuerfe/subreddit/ (am Handy aus GitHub laden):

- **Kompakt (02.11.2026, Rückmeldung „die Banner sind zu lang“):** `banner-3x1-titel.jpg` (fürs Desktop-Banner) und `banner-3x1-ohne-titel.jpg` (fürs Handy-Banner), je 1800 × 600 (3:1). Titel und Kleckse stehen im mittleren Band, schneidet Reddit auf 4:1 oder 5:1 zu, fällt nur Papier weg. Bild docs/entwuerfe/banner-kompakt.png (Quelle tools/mockup/sub-entwurf.ts#compact).
- Erste Fassung, zu lang: `banner-desktop.jpg` 1920 × 384 (5:1) und `banner-mobile.jpg` 1600 × 480.
- `community-icon.jpg` 512 × 512, Icon A (Klecks mit Hut), wird rund geschnitten, 56 KB.
- `app-icon.png` 1024 × 1024 im selben Motiv, 472 KB, liegt auch als `assets/icon.png` und steht in devvit.json (`marketingAssets.icon`).

**Farben:** Hauptfarbe Sepia `#6B4A2F` (Knöpfe wie Join), Hintergrund Papier `#F4EEE2`.

**Beschreibung** (Mod-Einstellungen, höchstens 500 Zeichen):

> A watercolour dice game. Every monster is a one-of-a-kind blot and a die. Duel, collect, hold the sheet against the Bleach, and name new species together. Tap Play on the pinned post to start.

**Einrichtung per Mod-Menü** „Before It Dries: set up the community“ (src/server/community.ts). Ein zweiter Lauf legt nichts doppelt an, geänderte Texte werden ersetzt. Jeder Teil läuft für sich, scheitert einer, sagt die Meldung welcher und warum.

- **Regeln:**
  1. *Be kind.* No harassment, hate or slurs, in comments, names or drawings.
  2. *Keep drawings clean.* No obscene drawings, hate symbols or real people. Drawings are reviewed before others see them, and repeated paint-overs lock drawing.
  3. *Good names only.* Species names are short, family-friendly, and not the names of real people, brands or ads.
  4. *No real money.* Dice and pigment are traded for pigment only. Offers of money, gift cards, accounts or Reddit Gold are removed and lead to a ban.
  5. *No spam.* Ideas, feedback and bug reports are welcome with the right flair.
- **Gründe fürs Entfernen:** je einer zu den Regeln 1 bis 4 (Not kind, Drawing not okay, Name not okay, Real money offer).
- **Post-Flairs:** Play (Sepia), Today's sheet (Ultramarin), What do you see? (Carmine), diese drei nur für Mods und die App, dazu Discussion, Feedback, Bug für alle. Gerades Apostroph, damit man den Namen im Katalog tippen kann.
- **Flairs auf App-Posts** (src/server/flair.ts): Spiel-Post Play, Tagespost Today's sheet, Benennen-Post What do you see?, sobald die Einrichtung gelaufen ist. Die schon vorhandenen Posts (Spiel-Post, heutiger Tagespost, laufende Benennen) bekommen ihr Flair bei der Einrichtung.
- **Seitenleiste:** Text „How to play“ (fünf Schritte und der Hinweis auf What do you see?) und Knöpfe „Links“: Play (zum Spiel-Post) und Full guide (zum Wiki). Ein neuer Spiel-Post über das Mod-Menü zieht den Play-Knopf nach.
- **Wiki-Seite `how-to-play`:** Start, Duelle, Today’s sheet, Your dice, Benennen, häufige Fragen (Pigment kaufen, faire Würfe, gelöschtes Konto, Fehler melden). Das Wiki muss in den Subreddit-Einstellungen eingeschaltet sein.

**Was du machst** (etwa 5 Minuten in der Reddit-App): Mod Tools, Community appearance: Banner (Desktop und Handy), Icon, Farben. Mod Tools, Description: Text oben. Danach im Subreddit-Menü einmal „set up the community“ antippen.

### 2 Test-Subreddit für Playtests

Beim Veröffentlichen (Schritt 4). Empfehlung: das private Test-Subreddit, das Devvit beim ersten Upload automatisch angelegt hat (meist r/beforeitdries_dev, nur Mods, du bist Mod). Ich stelle `dev.subreddit` in devvit.json darauf um. u/Vegatest wird dort genehmigter Nutzer, damit du auch als normaler Spieler testen kannst. Danach gilt: Playtests nur dort, r/beforeitdries bekommt nur geprüfte Versionen.

### 3 Testdaten vor dem Start

**Gebaut (02.11.2026, Variante A).** Knopf „Before launch: remove test data“ unten im Fenster 🛠 (nur Playtest, nur Mods, zweiter Tipp):

- Alle Test-Maler der Galerie (test:deck) und Test-Händler (test:trader) werden wie gelöschte Konten bereinigt: Galerie, Markt-Einträge, Angebote, Lieferungen, Namen. Würfel, die du von ihnen gekauft hast, bleiben bei dir, als Herkunft steht dann „a painter“. Angebote an sie gehen an den Absender zurück.
- Die Test-Schalter in deinem Stand (nächster Zug mit Stil oder Holo, Galerie gegen das eigene Deck) gehen aus.
- Alte Posts der App und alle bekannten Benennen- und Tagesposts werden entfernt (nicht gelöscht, die Lösch-Trigger legen deshalb nichts neu an), außer dem angepinnten Spiel-Post und dem heutigen Tagespost. Offene Benennen darin werden abgesagt. Posts anderer bleiben.
- Dein Spielstand, deine Würfel und vergebene Namen bleiben.

Test tests/community.test.ts durchsucht danach ganz Redis nach den IDs und Namen der Test-Maler.

### 4 Veröffentlichen

1. Test als u/Vegatest (Liste in docs/entwuerfe/neuer-spieler-bericht.md), Rückmeldung einbauen.
2. Letzter Playtest in r/beforeitdries: „Before launch: remove test data“, „set up the community“, Banner, Icon, Farben, Beschreibung.
3. Playtests auf das Test-Subreddit umstellen.
4. `npx devvit publish --version 0.1.0`, ungelistet. Danach läuft Reddits Prüfung. In der Zeit bleibt der letzte Playtest in r/beforeitdries installiert.
5. Nach der Freigabe: `npx devvit install beforeitdries` (die geprüfte Version ersetzt den Playtest), Spiel-Post und Tagespost prüfen. Test-Knöpfe sind dann von selbst weg (Version ohne vierte Stelle).

### 5 Katalog und Feedback (nach der Freigabe)

- **Katalog** im Developer Portal (developers.reddit.com, Developer Settings, In-app catalog, geht im Handy-Browser): App-Icon, großes Bild, Kachelbild, Texte, Kategorie, App-Subreddit r/beforeitdries, Flairs Play und Today's sheet. Die Maße zeigt der Editor, ich male die Bilder dann passend aus dem Renderer.
  - Tagline: *Every blot is a die.*
  - Beschreibung: *Collect one-of-a-kind watercolour monsters, roll them as dice and paint the sheet before it dries. Duel rivals, hold the daily sheet against the Bleach, and name new species with your community.*
  - Kategorie: Strategy (falls es sie gibt, sonst die nächstpassende).
- **Feedback-Posts:** r/GamesOnReddit mit Flair Feedback und r/Devvit mit Flair Feedback Friday. Die Texte schreibe ich dir vor.
- **Rhythmus danach:** Playtests jederzeit im Test-Subreddit, Releases gesammelt höchstens einmal pro Woche.
