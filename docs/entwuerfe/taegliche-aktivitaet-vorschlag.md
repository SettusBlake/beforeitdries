# Tägliche Aktivität: Vorschlag

Stand 04.11.2026, Fassung 1. Nichts davon ist gebaut. Fragen am Ende.

Quellen: Devvit-Doku (Feature Guide, User Actions, Adding Streaks, Devvit Rules, Blog vom 18.12.2025), die Analyse anderer Reddit-Spiele im Repo SettusBlake/RedditGame (reddit-spiele-analyse.md) und der Stand des Spiels.

## 1 Was es schon gibt

| Was | Rhythmus | Dauer |
| --- | --- | --- |
| Freier Zug („free dip“) | einmal am Tag | etwa 20 s |
| Belohnte Duelle (Pigment, Tropfen) | 5 am Tag | 3 bis 5 Minuten je Duell |
| Tagesblatt (Bleach) mit Rangliste, Tagespost, Teilen als Kommentar, „Final board“ am nächsten Tag | ein Wertungslauf am Tag | 1,5 bis 3 Minuten |
| „What do you see?“-Post | einer je Spieler und Tag, Name nach 24 Stunden | kurz |
| Leerer Würfel zum Selbstmalen | einer pro Woche | 1 bis 2 Minuten |
| Galerie-Gebühren abholen, Markt, Tausch | jederzeit | kurz |

Es gibt also schon genug, das man an einem Tag tun kann. Es fehlt ein Grund, morgen wiederzukommen.

## 2 Was fehlt

- **Keine Strähne:** Wer gestern gespielt hat, hat heute nichts zu verlieren.
- **Das Tagesblatt ist jeden Tag gleich:** andere Würfe, aber dieselbe Regel. Der Tagespost sieht jeden Tag gleich aus.
- **Kein Beitreten:** Wer den Post im Feed spielt, folgt dem Subreddit oft nicht und sieht den nächsten Tagespost nie.
- **Im Feed sieht man keine Spieler:** keine Flair, kein „Maler der Woche“.
- **Kein Wochenbogen:** Laut CLAUDE.md erzählt sich die Welt „in Splittern über seltene Kleckse und wöchentliche Kapitel-Posts“. Die Kapitel-Posts gibt es noch nicht.
- **Kein gemeinsames Ziel:** Jeder spielt für sich.

Warum das zählt:
- Reddit hebt Spiele im Featuring nach Klickrate, Verweildauer und **Rückkehr an Tag 1 und Tag 3** (Feature Guide).
- Die Developer Funds starten ab **500 eingeloggten Spielern am Tag, sieben Tage lang** (Blog vom 18.12.2025, Stand damals).

## 3 Vorschläge

### T1 Beitreten (klein)
- **Was:** Nach dem ersten fertigen Tagesblatt oder Duell steht im Ergebnis „Join r/beforeitdries: a new sheet every day“. Ein Tipp tritt bei (User Action `SUBSCRIBE_TO_SUBREDDIT`).
- **Wann:** Höchstens zweimal (erstes Ergebnis, fünftes Ergebnis), nie für Mitglieder, nie als Bedingung zum Weiterspielen. So verlangen es die Regeln für User Actions.
- **Warum:** Nur Mitglieder sehen den Tagespost am nächsten Morgen sicher im Feed.

### T2 Strähne mit Retarder (klein bis mittel)
- **Was zählt:** Ein Tag zählt, wenn du den Wertungslauf des Tagesblatts fertig spielst. Der Server zählt, der Tag ist der UTC-Tag des Blatts (wie bei Syllo). Offen in Frage 2: ob ein fertiges Duell auch zählt.
- **Schonung:** Ein verpasster Tag je Woche bricht die Strähne nicht. Das heißt „Retarder“ („Sepia kept your paint wet“), passend zum Malmittel, das Farbe länger nass hält.
- **Anzeige:** Tropfen mit Zahl im Startbild und im Tagespost neben deinem Platz („🖌 12 days“). Die Zahl steht auch im geteilten Kommentar. Sepia sagt bei 3, 7, 30 und 100 Tagen einen Satz.
- **Lohn** (Vorschlag, Frage 3): beim Tagesblatt +5 Pigment je Tag der Strähne, höchstens +50. Alle 7 Tage ein Tropfen der Tagesfarbe dazu.
- **Flair** (Frage 4): Auf Wunsch setzt die App deine User-Flair im Subreddit auf „🖌 12“. Es gibt einen Schalter im Menü, der standardmäßig aus ist. Wer eine eigene Flair hat, behält sie.
- **Speicher:** ein Bit je Tag in Redis, wie im Beispiel der Devvit-Doku.

### T3 Tagesregel und Wochenbogen (klein bis mittel)
- **Malmittel des Tages:** Jeden Tag bekommt jeder auf dem Tagesblatt dasselbe Malmittel. Es kommt aus denen, die im Tagesblatt wirken: Gum Arabic, Ox Gall, Salt, Retarder, Sponge, Iridescent Medium, Water Brush.
  - Es steht groß im Tagespost („Today: Salt“) und im Startbild.
  - Das gibt es schon als Regel, man muss nichts Neues lernen.
- **Die Woche wird schwerer** (wie bei Syllo): Montag leicht, Sonntag am schwersten.
  - Lebenskraft der Pales: Montag × 0,9 bis Sonntag × 1,2.
  - Sonntags ein zweiter großer Pale und Punkte × 1,5.
  - Im Tagespost steht der Wochentag als Stufe („Monday · light wash“ bis „Sunday · the Eraser's day“).
- **Warum:** Der Tagespost sieht jeden Tag anders aus, die Rangliste bleibt fair (alle haben dieselbe Regel), und der Sonntag wird ein kleines Ereignis.

### T4 Splitter und Kapitel (mittel)
- **Was:** Jedes fertige Tagesblatt schaltet einen Splitter der Geschichte frei: ein, zwei Sätze, zum Beispiel eine Notiz am Blattrand, ein Satz von Sepia oder eine Spur des Radierers.
  - Sieben Splitter ergeben ein Kapitel.
  - Am Montag legt die App den Kapitel-Post an: das ganze Kapitel als Bild aus dem Renderer mit Text, darunter wird diskutiert.
- **Wer Tage verpasst:** sieht die Lücken als ausgebleichte Stellen. Der Kapitel-Post zeigt alles, damit niemand ausgeschlossen ist, aber nur wer gespielt hat, hat „seine“ Splitter in der Sammlung.
- **Ton:** leicht düster, nicht leicht durchschaubar. Wer radiert, und warum bleicht das Blatt?
- **Aufwand:** Bau mittel. Dazu muss ich die Texte schreiben, etwa 7 Splitter je Woche. Ich würde erst Kapitel 1 bis 4 als Entwurf zur Freigabe vorlegen.

### T5 Gemeinsames Blatt der Woche (mittel bis groß)
- **Was:** Alle Felder, die die Community auf den Tagesblättern malt, füllen zusammen ein großes Wochenblatt. Es ist im Tagespost zu sehen, ein riesiger Klecks wird Woche für Woche sichtbarer.
  - Bei 25, 50 und 100 % gibt es für alle, die mitgemalt haben, Pigment oder einen Tropfen.
  - Wird es bis Sonntag nicht voll, bleicht der Rand wieder aus.
- **Bezug:** Das steht unter „Später“ in CLAUDE.md (Gemeinschaftsbild pro Subreddit mit Riesenklecks als Boss).
- **Vorbehalt:** Mit wenigen Spielern fühlt sich ein gemeinsames Ziel leer an. Die Schwellen müssten mit der Zahl der Spieler wachsen. Lieber erst, wenn täglich ein paar Dutzend spielen.

### T6 Sepias Besorgungen (klein bis mittel)
- **Was:** drei kleine Tagesaufgaben, zum Beispiel „win a duel with a Glaze hit“, „wash out a Fluoro blot“ oder „paint 20 cells on today's sheet“. Jede gibt Pigment, alle drei zusammen einen Tropfen.
- **Vorbehalt:** Das wird schnell zur Pflicht. Mit freiem Zug, 5 belohnten Duellen und dem Tagesblatt gibt es schon genug Tageslohn. Ich empfehle es vorerst nicht.

### T7 Deck des Tages (mittel)
- **Was:** Im Tagespost steht ein Galerie-Deck des Tages, gegen das jeder ein Duell spielen kann. Der Post zählt mit: „u/name's deck beat 41 of 63 painters today“. Der Besitzer bekommt die Gebühr wie bisher und einen Kommentar mit dem Ergebnis.
- **Vorbehalt:** Dafür braucht die Galerie genug echte Decks. Später.

### Später
- **Push-Benachrichtigungen:** nur als Beta auf Bewerbung, für Spiele mit Zugkraft, höchstens zwei am Tag mit Einwilligung. Der Strähnen-Satz aus T2 („Day 12: your paint is still wet“) wäre der passende Anlass. Bewerben, wenn täglich genug spielen.
- **Wochenligen mit Auf- und Abstieg:** brauchen viele Spieler.
- **Devvit Journeys:** misst Start, Fortschritt und Ende einer Sitzung für Reddit. Am Handy unsichtbar, nützt fürs Featuring.

## 4 Empfehlung

1. **Ein Schritt mit T1, T2 und T3.** Alles ist klein, nutzt Vorhandenes (Tagesblatt, Malmittel, Tagespost, Teilen) und gibt sofort einen Grund für morgen.
2. **Danach T4.** Die Splitter passen am besten zur Welt und machen den Montag zum Ereignis. Vorher lege ich die Texte als Entwurf vor.
3. **T5 und T7**, sobald täglich genug Leute spielen. **T6** vorerst nicht.

## 5 Fragen

1. Welche Vorschläge soll ich bauen, und in welcher Reihenfolge? Empfehlung: T1 bis T3 zusammen, dann T4.
2. T2: Zählt nur das Tagesblatt für die Strähne oder auch ein fertiges Duell? Empfehlung: nur das Tagesblatt, das ist das gemeinsame Ritual und dauert unter 3 Minuten.
3. T2: Lohn für die Strähne (+5 Pigment je Tag bis +50, alle 7 Tage ein Tropfen) oder nur Anzeige? Empfehlung: kleiner Lohn wie vorgeschlagen.
4. T2: Flair mit der Strähne als Schalter, der standardmäßig aus ist? Empfehlung: ja.
5. T3: Malmittel des Tages und schwerer zum Sonntag hin, sonntags Punkte × 1,5? Empfehlung: ja.
6. T4: Soll ich die ersten vier Kapitel als Entwurf schreiben?
