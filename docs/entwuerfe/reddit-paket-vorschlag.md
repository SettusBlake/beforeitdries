# Vorschlag: Before It Dries wird ein Reddit-Spiel

Stand 28.10.2026. Vorschlag, nichts davon ist gebaut. Fragen am Ende.

Grundlage: die Analysen aus Amber Delve (RedditGame-Repo, `docs/entwuerfe/reddit-spiele-analyse.md` vom 24.10.2026 und `sword-and-supper-analyse.md` vom 18.10.2026) und die Pflichtliste vor Reddits Prüfung (Chronik, „Prüfungs-Paket“, 19.10.2026). Quellen stehen dort.

## 1. Kurz

Gebaut ist heute ein MVP: Tagesklecks fangen, Bogen, Lasieren mit Trockenzeit, Artname aus Kommentaren. Was Reddit-Spiele erfolgreich macht, fehlt noch fast ganz:

1. **Täglicher Grund zu kommen** ist da (Tagesklecks), aber ohne Strähne und ohne Lohn fürs Wiederkommen.
2. **Spieler erzeugen keine Posts.** Der Feed bekommt nur einen Post am Tag. Das ist laut Reddit der häufigste Grund, warum Spiele verschwinden.
3. **Kein Beitreten, kein Teilen** nach dem Erfolg.
4. **Pflichtpunkte für die Prüfung** fehlen: Namen als Antworten auf einen angehefteten Kommentar, Spielen ohne Login, Löschpflicht, englisches README.

## 2. Before It Dries im Vergleich

| Muster aus der Analyse | Before It Dries heute | Lücke |
|---|---|---|
| Tagesspiel mit Strähne | Tagesklecks, trocknet um Mitternacht UTC | **keine Strähne** |
| Spieler machen Posts | Namensvorschläge als Kommentare | **keine Posts von Spielern** |
| Join nach dem Aha-Moment | – | **kein Join-Knopf** |
| Teilen mit Daten im Link | – | **kein Teilen** |
| Gemeinsames Ziel | Arten benennen | Bestiarium nicht sichtbar |
| Startkarte zeigt jeden Tag etwas anderes | ja, der Klecks des Tages | Strähne und Name fehlen auf der Karte |
| Ohne Login spielbar | nur ansehen | **kein Spielen ohne Login** |
| Ergebnisse als Antwort auf angehefteten Kommentar | App schreibt eigenen Kommentar zum Artnamen | **Regelverstoß, umbauen** |
| Löschpflicht | – | **fehlt** |
| Messen (Journeys), Flairs | – | fehlt |

## 3. Vorschläge

Nach Wirkung geordnet, jeweils mit Lore-Check.

### P. Pflicht vor der Prüfung

- **P1 Namen als Antworten.** Jeder Klecks-Post bekommt beim Anlegen einen angehefteten Kommentar der App: „What do you see? Reply to this comment with one name. The top-voted reply names the species when the blot dries.“ Gezählt werden nur Antworten darauf. Beim Trocknen bearbeitet die App diesen Kommentar („Dried. The Bestiary records **Puddlemoth**, named by u/carol.“), statt einen neuen zu schreiben. Ist die Art schon benannt, steht dort der Name samt Namensgeber.
  - Lore-Check: Sepia führt das Bestiarium. Passt.
- **P2 Spielen ohne Login.** Ausgeloggte sehen den Klecks und dürfen im Malblatt Probe-Lasuren auftragen: im Browser gewürfelt, nichts gespeichert, deutlich „Practice sheet: log in to keep it“. Fangen braucht Login.
  - Lore-Check: „Sepia lets you try a scrap sheet.“ Passt.
- **P3 Löschpflicht** (wie Amber Delve A bis C): gelöschter Post oder Kommentar nimmt seine Daten mit; wird die Antwort gelöscht, die eine Art benannt hat, ist die Art wieder offen; nächtliche Runde für gelöschte Konten; Fängerlisten je Klecks laufen nach 30 Tagen ab. Monster bleiben, sie sind der Spielstand.
- **P4 README auf Englisch** für Reddit (unter 1.000 Wörter, für Nicht-Programmierer, Hinweise für Moderatoren, „Fetch domains: None“). Die deutschen Entwicklernotizen ziehen nach docs/.
- **P5 Startkarte messen:** unter 1 Sekunde, Lighthouse über 80, nichts scrollt im Feed.

### R. Rückkehr

- **R1 Strähne „Wet days“.** Tage in Folge mit mindestens einem Fang, gezählt am Server je UTC-Tag. Ein verpasster Tag je Woche wird verziehen („the sheet stayed damp“). Lohn: alle 3 Tage ein **Föhn** (Hair Dryer), höchstens 3 auf Vorrat. Ein Föhn trocknet eine Lasur sofort, die Trockenzeit entfällt einmal.
  - Warum Föhn: belohnt Wiederkommen, ohne Werte zu kaufen. Kein Pay-to-win.
  - Lore-Check: Aquarellmaler föhnen wirklich. Sepia: „Cheating. But honest cheating.“
- **R2 Join nach dem ersten Fang.** Nach dem ersten Fang, wer dem Subreddit noch nicht folgt: „Join r/beforeitdries: a new blot every day“. Ein Tipp tritt bei. Höchstens zweimal gefragt, ohne Belohnung (Regel).
- **R3 Teilen.** Nach Fang oder Lasur: „Share“ öffnet Reddits Teilen-Fenster: „I caught a Cotton Rag Crawler. What do you see?“. Im Link steckt das Exemplar. Wer ihn öffnet, sieht oben dieses Exemplar (nur ansehen) und darunter den heutigen Klecks.
- **R4 Titel und Startkarte mit Lust aufs Spielen.** Mehrere Titelsätze in Daten, der Tag wählt einen („A blot appeared overnight. What do you see?“, „Still wet: today's blot. What do you see?“). Startkarte zusätzlich mit eigener Strähne und „dries in 6 h“.

### S. Posts von Spielern (größter Hebel fürs Featuring)

- **S1 Klecks verschütten („Spill a blot“).** Wer heute gefangen hat, darf einmal am Tag einen eigenen wilden Klecks als Post anlegen, nur auf eigenen Tipp.
  - Der Server würfelt den Seed. Der Klecks trocknet 24 Stunden nach dem Verschütten. Andere fangen ihn wie den Tagesklecks, das zählt für die Strähne, Namensvorschläge laufen wie in P1.
  - Titel aus festen Sätzen: „u/name spilled a blot. What do you see?“. Bis Reddit die App freigibt, steht der Post unter u/beforeitdries.
  - Lohn für den Verschütter: je 5 Fänger ein Föhn, höchstens 2 am Tag.
  - Option: Der Verschütter wählt das Hauptpigment aus seinen eigenen Pigmenten, der Rest bleibt Zufall („Build tools, not just toys“).
  - Lore-Check: Das Blatt bleicht von den Rändern her aus, jemand radiert. Jeder neue Klecks hält es nass. Wer verschüttet, malt gegen das Ausbleichen an. Passt und deutet den Plot an, ohne ihn zu verraten.

### G. Gemeinschaft

- **G1 Bestiarium als Ansicht.** Alle benannten Arten mit Bild, Namensgeber und Tag, dazu „23 of 96 species named“. Unbenannte Arten als leere Umrisse. Gemeinsames Ziel für alle.
  - Lore-Check: Sepia kartiert das Blatt, bevor es verblasst. Passt.

### M. Messen und Finden

- **M1 Devvit Journeys:** Spiel geöffnet, gefangen, lasiert, Ende. Reddit misst damit Rückkehr und Verweildauer fürs Featuring.
- **M2 Post-Flairs** „Daily blot“ und „Spilled blot“, damit Reddits Spiele-Feed die Posts filtern kann.

### U. Testen am Handy

- **U1 `npm run playtest:upload`** wie in Amber Delve: lädt einmal hoch und hört auf. Nach jedem Schritt hochladen, du testest auf Reddit am Handy.
- **U2 Entwürfe als PNG** in docs/entwuerfe, damit du sie auf GitHub ansehen kannst.

## 4. Was wir nicht übernehmen

- Automatische Kommentare über Fortschritt (auch nicht den heutigen Artnamen-Kommentar, siehe P1).
- Leben oder Energie, die das Spielen begrenzen. Die Trockenzeit bremst schon, der Föhn ist die einzige Abkürzung.
- Bezahlschranken, Pay-to-win.
- Freitext über die App. Namen schreiben Spieler selbst in Reddits Kommentarfeld.
- Pushes, bevor das öffentliche Subreddit läuft.

## 5. Empfehlung

1. **Sofort:** U1 (Upload, damit du heute am Handy testen kannst), P1, P2, R4.
2. **Danach:** R1 Strähne mit Föhn, R2 Join, G1 Bestiarium.
3. **Größter Hebel:** S1 Klecks verschütten, vorher als Entwurf mit Bildern.
4. **Vor der Prüfung:** P3, P4, P5, R3, M1, M2.

## 6. Fragen

1. Passt die Reihenfolge, oder soll S1 nach vorne?
2. S1: ja? Darf der Verschütter das Hauptpigment wählen?
3. R1: Strähne mit Föhn als Lohn, ja?
4. Subreddit: r/beforeitdries jetzt als Test-Sub (Playtest geht nur unter 200 Mitgliedern) und später öffentlich, oder ein eigenes Test-Sub wie r/beforeitdries_dev?
5. Trockenzeit 8 Stunden bestätigen? Mit Föhn und Strähne wirkt sie wie ein Takt, nicht wie eine Sperre.
6. Artnamen: erster Name bleibt für immer (Vorschlag), oder darf eine Art später umbenannt werden?
