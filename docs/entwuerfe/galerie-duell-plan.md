# Plan: Galerie-Duell (andere Spieler im Duell)

Stand 31.10.2026, Fassung 1. Gewünscht am 31.10.2026 („mach 1, schreib den plan“). Freigegeben am 31.10.2026 („alles ja“, alle sieben Fragen). Schritt 1 gebaut (siehe unten).

Entwurf: docs/entwuerfe/galerie-duell-entwurf.png (Attrappe auf der echten Vorschau, Quelle tools/mockup/galerie-entwurf.cjs).

## Die Idee

Jeder Spieler hängt sein Deck in die Galerie. Im Galerie-Duell spielst du gegen das Deck eines anderen Spielers. Der Computer führt es, aber mit den echten Würfeln: Seriennummern, Lasuren, Patina, Stil, Holo und freigegebene Zeichnungen. Gewinnt sein Deck, bekommt der Besitzer etwas Pigment, auch wenn er gerade nicht spielt.

Dazu treiben ausgewaschene Monster anderer Spieler im normalen Duell beim Rivalen mit. Das passt zur Welt: Irgendwer radiert, und was an den Rand treibt, kommt zurück.

## Ablauf für dich

1. **Startbild:** neuer Knopf „Gallery duel“ unter „Start duel“. Darunter steht klein, wie dein eigenes Deck in der Galerie läuft („Your deck hangs in the gallery · 4 won · 2 lost“).
2. **Vorschau:** „u/name's deck“ mit den 9 Würfeln als Bilder (Seriennummer, Holo-Rand, Stil), Bilanz des Decks und Stärke im Vergleich zu deinem Deck. Knöpfe „Duel u/name“ und „Another deck“.
3. **Im Duell:** oben steht u/name statt „Rival“, das Banner sagt „u/name's deck plays“. Sonst läuft alles wie im normalen Duell.
4. **Karte:** Antippen eines gegnerischen Würfels zeigt wie bisher seine Karte, dazu Besitzer, Seriennummer, Lasur und Patina. Bei gemalten Monstern steht dort „Report drawing“.
5. **Ergebnis:** „You beat u/name's deck“ oder „u/name's deck beat you“, Pigment wie bisher.
6. **Als Besitzer:** Beim nächsten Öffnen von „Your dice“ sagt Sepia, was in der Galerie passiert ist, und du nimmst das Pigment mit „Collect“.

## Regeln

### Ausstellen

- Dein Deck hängt automatisch in der Galerie, sobald du ein Duell fertig gespielt hast (nicht das Lern-Duell).
- Es hängt als Abzug: die 9 Würfel, wie sie am Ende deines letzten Duells waren. Was du danach änderst, kommt mit dem nächsten fertigen Duell in die Galerie.
- Im Menü: „Hang my deck in the gallery“, an oder aus, Standard an. Aus nimmt es sofort ab.
- Mit im Abzug: Lasuren und Patina der Würfel und deine freigeschalteten Malmittel (der Computer wählt daraus).
- Zeichnungen sehen andere nur, wenn ein Mod sie freigegeben hat. Sonst zeigt der Würfel für andere die zufällige Form aus seinem Seed (wie nach dem Übermalen), für dich bleibt die Zeichnung.
- Angezeigt wird nur dein Reddit-Name (u/name), der auf Reddit ohnehin öffentlich ist.

### Gegner finden

- Stärke eines Decks: Summe der Werte seiner 9 Würfel (dieselben Werte, aus denen das Duell die Stufe eines Kleckses berechnet).
- Gesucht wird ein Deck mit ähnlicher Stärke: zuerst höchstens 10 % Abstand, dann 25 %, dann das nächste.
- Nie dein eigenes Deck, nicht dasselbe Deck zweimal am Tag, Decks von Spielern, die in den letzten 14 Tagen gespielt haben, zuerst.
- „Another deck“ einmal pro Duell, damit man nicht so lange tauscht, bis ein schwaches Deck kommt.
- Gibt es kein passendes Deck: Sepia sagt „The gallery is empty for now. Come back when more paint has dried.“ Das normale Duell bleibt.

### Stärke im Duell

- Das Galerie-Deck kämpft mit seinen echten Werten, ohne die Auf- und Abschläge von Apprentice, Journeyman und Master.
- Lasuren und Patina zählen auch auf der Seite des Rivalen (bisher bekommt der Rivale keine).
- Der Computer denkt wie beim Master (alle Züge). Ziel in der Simulation: Bei gleicher Stärke gewinnst du etwa die Hälfte. Passt das nicht, stelle ich nur ein, wie weit der Computer denkt, nicht die Werte.
- Set-Boni, Sepias Auftrag und Malmittel wie im normalen Duell.

### Belohnung

- **Du:** wie bisher (Sieg 60, Unentschieden 40, Niederlage 25), zählt zu den 5 bezahlten Duellen am Tag. Patina und Malmittel-Freischaltung wie bisher.
- **Besitzer:** je Sieg seines Decks 15 Pigment, je Unentschieden 8, je Niederlage 3 als Gebühr fürs Aufhängen. Höchstens 60 am Tag, gutgeschrieben beim nächsten Öffnen von „Your dice“.
- Die Bilanz des Decks (gewonnen, verloren) zählt über alle Abzüge, sie gehört zum Spieler.
- Patina bekommen die Würfel des Besitzers nur in seinen eigenen Duellen, nicht in der Galerie.

### Aus dem Archiv

- Im normalen Duell (Apprentice, Journeyman, Master) kommen bis zu 2 der 9 Würfel des Rivalen aus dem Archiv ausgewaschener Monster anderer Spieler.
- Sie kämpfen wie die übrigen Würfel des Rivalen, mit Auf- und Abschlag der gewählten Stufe.
- Erkennbar am ausgeblichenen Rand (im Duell und auf der Karte) und an der Zeile „Drifted back from the margins · washed out by u/name · #00031“.
- Nie deine eigenen, Zeichnungen nur, wenn ein Mod sie freigegeben hat.
- Ist das Archiv leer, bleibt alles wie heute.

### Melden

Ab jetzt sehen Spieler fremde Zeichnungen (nur freigegebene). Deshalb kommt „Report drawing“ dazu, wie im Selbstmalen-Plan vorgesehen:

- Steht auf der Karte jedes fremden gemalten Monsters (Galerie-Duell, Archiv-Würfel).
- Eine Meldung blendet die Zeichnung sofort für alle anderen aus (zufällige Form aus dem Seed) und legt sie mit „reported“ oben in „Review drawings“.
- OK zeigt sie wieder. Danach blendet eine weitere Meldung sie nicht mehr von selbst aus, sie landet nur wieder in der Liste.
- „Paint over“ wie bisher, zählt für die Sperre.
- Je Spieler höchstens 5 Meldungen am Tag.

## Test im Playtest

Allein im Test-Subreddit gibt es keine fremden Decks und kein fremdes Archiv. Deshalb für Mods in Playtest-Versionen ein Schalter „Playtest · mods only: gallery uses my own deck“: dein eigenes Deck als Gegner (Abzug vom letzten Duell), dein eigenes Archiv für die Archiv-Würfel, die Gebühr des Besitzers geht an dich. Verschwindet beim Veröffentlichen von selbst, wie die anderen Test-Knöpfe.

## Technik

- **Redis** (alle IDs in bekannten Sammlungen, src/server/keys.ts):
  - `gallery:{Spieler}`: JSON des Abzugs (Name, 9 Würfel, Malmittel, Stärke, Zeit).
  - `gallery:power`: Sorted Set Spieler → Stärke, für die Suche nach ähnlicher Stärke.
  - `gallery:inbox:{Spieler}`: Hash mit Siegen, Unentschieden, Niederlagen, Pigment und den letzten Herausforderern. Gutschrift mit hIncrBy, ohne die Sperre des Besitzers. So warten zwei Spieler, die sich gleichzeitig herausfordern, nicht aufeinander.
  - `gallery:record`: Hash Spieler → Bilanz.
  - `drawn:reports`: Hash Zeichnung → Meldungen.
  - Archiv-Würfel kommen aus `recycled:at` und `recycled` (Herkunft steht schon drin).
- **Duell-Speicher:** Besitzer des Galerie-Decks (Spieler nur am Server, Name auch für die Anzeige), Herkunft je Würfel des Rivalen für die Karte.
- **Regeln:** newGame bekommt Lasuren und Patina auch für den Rivalen, neue Stufe `gallery` ohne Auf- und Abschläge. Simulation der Siegquoten bei gleicher Stärke.
- **Zeichnungen:** Beim Start des Duells prüft der Server jede Zeichnung gegen `drawn:ok` und `drawn:reports`. Was nicht freigegeben ist, geht ohne Zeichnung an den Client.
- DUEL_PROTOCOL 11, Speicherstand des Duells bleibt lesbar.

## Reihenfolge

1. **Server:** Abzug nach jedem Duell, Stärke, Suche, Galerie-Duell mit echten Würfeln, Gebühr und Bilanz, Test-Schalter, Tests, Simulation. Upload.
2. **Bedienung und Melden:** Knopf und Vorschau, Name im Duell, Karte mit Besitzer, Ergebnis, Sepias Bericht in „Your dice“, Schalter im Menü, „Report drawing“ und „reported“ in Review drawings. Upload mit Bild.
3. **Archiv-Würfel** im normalen Duell mit ausgeblichenem Rand und Karte. Upload mit Bild.

## Gebaut

**Schritt 1 (Server), 31.10.2026, Playtest v0.0.1.87:**

- Abzug nach jedem fertigen Duell (nicht im Lern-Duell): `hangDeck` in src/server/gallery.ts, Redis `gallery:{Spieler}` und `gallery:power`.
- Suche `galleryFind` (/api/gallery/find, `another` für den Tausch): erst 10 %, dann 25 % Abstand, dann die fünf nächsten, aktive Spieler zuerst, nie das eigene, heute schon gespielte nicht. Das gefundene Deck bleibt bis zum Duell (`gallery:me:{Spieler}`).
- Galerie-Duell: /api/duel/start mit `gallery: true`, Stufe `gallery` (echte Werte, Rivale denkt alle Züge), Lasur und Patina auch beim Rivalen, er wählt aus den Malmitteln des Besitzers. Zeichnungen nur mit Freigabe (`drawn:ok`). Duell-Stand mit `foeName` und `foeDice` (Seriennummer, Lasur, Patina, gemalt), Besitzer nur am Server.
- Gebühr `payOwner` (15, 8, 3, höchstens 60 am Tag) und Bilanz, Abholen `galleryCollect` (/api/gallery/collect), Schalter `galleryHang` (/api/gallery/hang), Test-Schalter `galleryTestSelf` (/api/gallery/test-self, Playtest, nur Mods). Stand kommt mit /api/dice als `gallery`.
- DUEL_PROTOCOL 11. Tests in tests/gallery.test.ts. Vorschau: /dev/gallery?n=4&inbox=3.
- **Simulation** (200 Duelle, gleiche Stärke, beide Seiten mit echten Werten): Spielt der Spieler wie der Computer mit allen Zügen, gewinnt er 68 % (verliert 32 %). Spielt er etwas schwächer (Computer mit 3 Zügen), 50 %. Zum Vergleich gegen den Master: 46 % und 38 %. Der Computer denkt schon alle Züge, weiter einstellen lässt sich daran nichts. Der Vorteil kommt vom ersten Zug jeder Runde. Frage dazu unten.

## Später (nicht in diesem Plan)

- Herausforderung als Post oder Kommentar (Galerie-Duelle als Posts aus „Später, nicht im MVP“).
- Rückkampf gegen das Deck, das dich geschlagen hat, Bestenliste der Decks.
- Marktplatz und Tauschen, ausgewaschene Monster zurückholen.

## Fragen

1. Dein Deck hängt nach jedem fertigen Duell automatisch als Abzug in der Galerie, mit Schalter im Menü zum Abnehmen? (Empfehlung: ja)
2. Gegner mit ähnlicher Stärke, nicht zweimal am Tag dasselbe Deck, „Another deck“ einmal pro Duell? (Empfehlung: ja)
3. Galerie-Deck mit echten Werten samt Lasur und Patina, der Computer denkt wie beim Master, Ziel etwa halbe-halbe bei gleicher Stärke? (Empfehlung: ja)
4. Pigment für dich wie bisher, für den Besitzer 15 je Sieg, 8 je Unentschieden, 3 je Niederlage, höchstens 60 am Tag? (Empfehlung: ja)
5. Bis zu 2 Archiv-Würfel beim Rivalen im normalen Duell, mit ausgeblichenem Rand? (Empfehlung: ja)
6. Melden: eine Meldung blendet die Zeichnung sofort für andere aus, bis ein Mod entscheidet, höchstens 5 Meldungen pro Spieler am Tag? (Empfehlung: ja)
7. Test-Schalter für Mods im Playtest (eigenes Deck und Archiv als Gegner)? (Empfehlung: ja)

Neue Frage nach Schritt 1:

8. Ein gleich starkes Galerie-Deck verliert gegen einen Spieler, der so gut spielt wie der Computer, etwa 2 von 3 Duellen. So lassen (wer gut spielt, gewinnt öfter) oder dem Galerie-Deck einen kleinen Heimvorteil geben, z. B. 1 Guard und 1 Glow zum Start? (Empfehlung: erst so lassen und nach deinen eigenen Duellen entscheiden)
