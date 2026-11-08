# Tägliche Aktivität: Vorschlag

Stand 08.11.2026, Fassung 5. T1 und T2 sind gebaut (04.11.2026). Fassung 3 freigegeben am 08.11.2026 („alles Empfehlung“). Schritt 1 (T8 Tagesgeschenk, T9 Morgen-Zeile, T3 Tagesregel) ist gebaut, Bild docs/entwuerfe/tagesgeschenk-im-spiel.png. Schritt 2 (T10 Willkommen zurück, T11 Wochenziele) ist gebaut, Bild docs/entwuerfe/wochenziele-im-spiel.png. T4 vorerst nicht (08.11.2026). Entwurfsbild der Fassung 3: docs/entwuerfe/taegliche-aktivitaet3-entwurf.png (Attrappe in der echten Vorschau, Quelle tools/mockup/geschenk-entwurf.cjs). Entscheidungen in Abschnitt 9.

Quellen: Devvit-Doku (Feature Guide, User Actions, Adding Streaks, Devvit Rules), die Analyse anderer Reddit-Spiele (reddit-spiele-analyse.md im Repo SettusBlake/RedditGame, Stand mit den Bedingungen der Developer Funds H2 2026) und der Stand des Spiels.

## 1 Was es schon gibt

| Was | Rhythmus | Lohn |
| --- | --- | --- |
| Freier Zug („free dip“) | einmal am Tag | ein Monster |
| Belohnte Duelle | 5 am Tag | Pigment und bis zu 2 Tropfen je Duell |
| Tagesblatt (Bleach) mit Rangliste, Tagespost, Teilen als Kommentar, „Final board“ am nächsten Tag | ein Wertungslauf am Tag | 40 Pigment und 1 Tropfen |
| Strähne mit Retarder (T2), auf Wunsch als Flair | jeder Tag mit Tagesblatt | ab 2 Tagen +5 Pigment je Tag bis +50, alle 7 Tage ein Tropfen |
| Beitreten nach dem ersten und fünften Ergebnis (T1) | zweimal | |
| „What do you see?“-Post | einer je Spieler und Tag | 50 Pigment für Finder und Namensgeber |
| Leerer Würfel zum Selbstmalen | einer pro Woche (Montag) | |
| Gilded weekend | Samstag und Sonntag | höhere Chance auf Stil und Holo |
| Galerie-Gebühren abholen, Markt, Tausch | jederzeit | |

Es gibt genug zu tun und auch täglichen Lohn. Er ist aber über das Spiel verteilt und nirgends als „heute wartet das auf dich“ zu sehen.

## 2 Was fehlt

- **Kein sichtbares Tagesgeschenk:** keine Leiste, die zeigt „heute Tag 4, an Tag 7 wartet etwas Großes“. Das ist die bekannteste Rückkehr-Mechanik aus Gacha-Spielen.
- **Kein Ausblick:** Nach dem Spielen steht nirgends, was morgen wartet.
- **Das Tagesblatt ist jeden Tag gleich:** andere Würfe, aber dieselbe Regel. Der Tagespost sieht jeden Tag ähnlich aus (T3 offen).
- **Wer ein paar Tage weg war,** findet nur eine getrocknete Strähne. Nichts sagt „schön, dass du da bist“.
- **Kein Wochenziel:** Kleine Tage zahlen in nichts Größeres ein.
- **Kein Wochenbogen der Geschichte** (T4) und **kein gemeinsames Ziel** (T5).
- **Keine Push-Benachrichtigungen:** gibt es nur als Beta auf Bewerbung.

Warum das zählt:
- Reddit hebt Spiele im Featuring nach Klickrate, Verweildauer und **Rückkehr an Tag 1 und Tag 3** (Feature Guide).
- Die Developer Funds H2 2026 beginnen bei **5 000 eingeloggten Spielern am Tag** im 7-Tage-Schnitt, in einer Community mit mindestens 200 Mitgliedern. Das schafft nur echte tägliche Rückkehr, kein viraler Tag.

## 3 Schritt 1: Tagesgeschenk, Morgen-Zeile, Tagesregel (gebaut am 08.11.2026)

### T8 Tagesgeschenk (klein bis mittel)

- **Was:** Im Startbild über „Your dice“ steht eine Leiste mit 7 Farbtöpfen. Einmal am Tag (UTC) tippt man auf „Open today’s gift“, das Geschenk geht mit Klang und einem Satz von Sepia auf („You came back. The paint noticed.“).
- **Was zählt:** nur das Antippen, etwa 5 Sekunden. Kein Duell und kein Tagesblatt nötig.
- **Kein Zurücksetzen:** Die Leiste geht nur an Tagen weiter, an denen man kommt, und fängt nach einem verpassten Tag nicht von vorn an. Nach Tag 7 beginnt sie wieder bei Tag 1. So entsteht kein zweiter Strähnen-Druck neben dem Tagesblatt: Die Strähne belohnt Tage am Stück, das Geschenk belohnt jedes Kommen.
- **Lohn:**

| Tag | Geschenk |
| --- | --- |
| 1 | 20 Pigment |
| 2 | 1 Tropfen der Tagesfarbe |
| 3 | 30 Pigment |
| 4 | 1 Tropfen der Tagesfarbe |
| 5 | 40 Pigment |
| 6 | 1 Tropfen der Tagesfarbe |
| 7 | ein Zug mit dem Loaded brush, gratis (Stil 2 %, Holo 0,75 %, am Gilded weekend mehr) |

- **Anzeige:**
  - Der heutige Topf leuchtet golden, geöffnete Töpfe haben einen Haken, Tag 7 ist größer und golden mit Pinsel.
  - Nach dem Öffnen steht in der Karte schon „Day 7: a free dip with the Loaded brush“.
  - Im Spiel-Post (inline) steht, solange das Geschenk zu ist: „Today’s gift is waiting.“
- **Neue Spieler:** Die Leiste erscheint erst nach den ersten Schritten (E1), damit der Einstieg ruhig bleibt.
- **Technik:** Spielstand `gift` (Zahl der geöffneten Geschenke und zuletzt geöffneter UTC-Tag), /api/dice/gift (src/server/gift.ts), Leiste `GIFTS` in src/shared/daily.ts. Der Server zahlt, die Tropfenfarbe ist die Farbe des heutigen Tagesblatts. Der Tag-7-Zug ist ein Zug ohne Kosten mit dem Loaded brush, sonst wie jeder Zug (Schutz vor Pech und Gilded weekend zählen mit), er läuft nach „Dip it“ im Würfel-Bildschirm.
- **Test-Knopf** (Playtest, nur Mods, in den Moderator-Werkzeugen): „Today’s gift: open it again“, die Leiste läuft dabei weiter. So lässt sich Tag 7 an einem Tag ausprobieren.
- **Anzeige** in src/client/duel/gift.ts und gift.css, im Spiel-Post die Zeile „Today’s gift is waiting.“

### T9 Morgen-Zeile (klein)

- **Was:** eine Zeile unter dem Tagesgeschenk im Startbild.
  - Solange heute noch etwas offen ist: „Today: gift · free dip · Sunday sheet, points ×1.5“.
  - Wenn alles erledigt ist: „Tomorrow: gift 40 pigment · free dip · Monday sheet, light wash“.
- **Dazu** steht dieselbe Morgen-Zeile im Ergebnis des Tagesblatts unter der Strähne.
- **Nur was wirklich wartet:** Ist der freie Zug schon genommen, steht er bei „Tomorrow“. Ist das Tagesblatt noch nicht gespielt, steht es bei „Today“.

### T3 Tagesregel und Wochenbogen (klein bis mittel, jetzt mit Zahlen)

- **Malmittel des Tages:** Auf dem Tagesblatt starten alle mit demselben Malmittel, aus denen, die im Tagesblatt wirken: Gum Arabic, Ox Gall, Salt, Retarder, Sponge, Iridescent Medium, Water Brush. Die übliche Malmittel-Wahl im Lauf bleibt.
  - Gebaut mit kleiner Abweichung: Es kommt aus dem Datum statt aus dem geheimen Tages-Seed. So kommt jedes der sieben in jeder Woche (Montag bis Sonntag) genau einmal, die Reihenfolge rückt jede Woche um drei weiter, nie zweimal dasselbe hintereinander (`dayMedium`).
  - Es steht im Tagespost („Today: Gum Arabic“), unter dem Knopf „Today’s sheet“ und zu Beginn des Laufs als Banner.
- **Die Woche wird schwerer:** Lebenskraft der Pales je Wochentag (UTC), mit Namen im Tagespost.

| Tag | Name im Tagespost | Lebenskraft der Pales |
| --- | --- | --- |
| Montag | light wash | × 0,9 |
| Dienstag | first layer | × 0,95 |
| Mittwoch | second layer | × 1,0 |
| Donnerstag | half dry | × 1,05 |
| Freitag | heavy wash | × 1,1 |
| Samstag | the margins creep | × 1,15 |
| Sonntag | the Eraser’s day | × 1,2 |

- **Sonntag:** dazu ein zweiter großer Pale in Welle 5 und Punkte × 1,5. Zusammen mit dem Gilded weekend wird der Sonntag ein kleines Ereignis.
- **Fair bleibt es:** Alle haben am selben Tag dieselbe Regel. Die Rangliste gilt weiter je Tag.
- **Simulation** (120 Läufe je Wochentag): Ein starker Spieler behält montags in 93 % alle Herzen, mittwochs in 86 % (wie bisher), freitags bis sonntags in etwa 80 %. Mittlere und schwache Spieler merken den Wochentag kaum. Die Zahlen bleiben wie vorgeschlagen.
- **Technik:** `sheetRule` in src/shared/daily.ts, im Tagesblatt `rule` und `boss2` (src/shared/duel/bleach.ts), Punkte mit `mult` im Ergebnis („Sunday ×1.5“, „The great Pales 1 of 2“). DUEL_PROTOCOL 22.

## 4 Schritt 2: Willkommen zurück, Wochenziele (gebaut am 08.11.2026)

### T10 Willkommen zurück (klein)

- **Was:** Wer 3 UTC-Tage oder länger nicht da war (gemessen am letzten Geschenk, Zug oder Duell), bekommt beim nächsten Öffnen von „Your dice“ einen Zug mit dem Plain brush gratis. Sepia: „Four days away. The sheet kept your place. Have a dip on me.“
- **Grenze:** höchstens einmal in 14 Tagen. Die Strähne bleibt, wie sie ist (Retarder verzeiht weiter einen Tag je Woche).
- **Warum:** Wer zurückkommt, soll zuerst etwas bekommen, nicht nur sehen, was er verloren hat.
- **Gebaut:** Zettel von Sepia oben in „Your dice“ mit „Take the dip“, der Zug läuft wie jeder Zug. Sepias Satz nennt die Tage (bis zwölf in Worten, danach „Two weeks away“, „Weeks away“, „Months away“). Dazu „Sepia’s welcome dip“ in der Morgen-Zeile, „Sepia’s dip“ am Knopf „Your dice“ und „Welcome back. Master Sepia has a free dip for you.“ im Spiel-Post. Aktiv heißt: Geschenk, Zug, Malen, Duell oder Tagesblatt. Wer schon vor Schritt 2 gespielt hat, wird nach freiem Zug, Geschenk, Tagesblatt oder Duell beurteilt. Ein fälliger Zug bleibt liegen, auch wenn man zuerst etwas anderes tut. Test-Knopf „Welcome back: as if 4 days away“ (Playtest, Mods).

### T11 Wochenziele (klein bis mittel)

- **Was:** 3 Ziele je Woche, neu jeden Montag (UTC), für alle gleich. Nur Ziele mit Regeln, die für den Spieler schon gelten (Regeln nach und nach, E2).
  - Beispiele: „Finish 4 daily sheets“, „Win 6 duels“, „Wash out 12 rival blots“, „Land 5 Glaze hits“, „Dip 7 times“, „Hit 3 hearts“.
- **Lohn:** je Ziel 80 Pigment, sofort beim Erfüllen. Alle drei: ein leerer Würfel extra (zählt auch über die Obergrenze 2, wie der Fund beim Ziehen).
- **Anzeige:** Kasten oben in „Your dice“ mit drei Balken, erfüllte grün mit Haken.
- **Warum Woche statt Tag:** Tagesaufgaben (T6) werden schnell zur Pflicht. Drei Wochenziele lassen sich in normalem Spiel nebenbei schaffen.
- **Gebaut:** je Woche ein Ziel aus jeder Gruppe, die Reihenfolge rückt jeden Montag eins weiter. Die Ziele werden beim ersten Öffnen der Woche festgehalten, auch wenn danach neue Regeln dazukommen.
  - Tagesblatt: „Finish 4 daily sheets“, „Wash out 30 Pales“, „Keep every heart on 2 daily sheets“ (nur Wertungsläufe).
  - Duell: „Win 6 duels“, „Wash out 12 rival blots“, „Hit 6 palette hearts“, „Roll Glaze or Pure 5 times“, ab Stufe 3 „Land 5 element hits at ×2“, ab Stufe 4 „Land 3 master strokes“, ab Stufe 6 „Meet 4 of Sepia’s tasks“ und „Win 2 gallery duels“. Gezählt wird bis zum Ende des Duells, nicht im Lern-Duell.
  - Sammeln: „Dip the brush 7 times“ (jeder Zug außer den freien Startzügen), „Open 5 daily gifts“, „Collect 6 drops“.
  - Abweichung von den Beispielen: „Hit 6 palette hearts“ statt 3 (3 Herzen sind eine einzige Palette, das wäre viel leichter als die anderen Ziele), „Roll Glaze or Pure“ statt „Land 5 Glaze hits“ (der Wurf ist das, was man selbst schafft).
  - Anzeige wie im Entwurf, oben „new goals in 3 days“ oder „tomorrow“. Erfüllt: kurze Meldung, die Zeile leuchtet, im Ergebnis „✓ Weekly goal: Win 6 duels · +80 pigment“, bei allen dreien „+1 blank canvas“. Test-Knopf „Weekly goals: finish the next one“ (Playtest, Mods). Tests tests/weekly.test.ts.

## 5 Weiter offen aus Fassung 2

### T4 Splitter und Kapitel (mittel, vorerst nicht, festgelegt am 08.11.2026)
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
- **Was:** drei kleine Tagesaufgaben mit Pigment und einem Tropfen für alle drei.
- **Vorbehalt:** Das wird schnell zur Pflicht. Statt T6 schlage ich jetzt die Wochenziele (T11) vor.

### T7 Deck des Tages (mittel)
- **Was:** Im Tagespost steht ein Galerie-Deck des Tages, gegen das jeder ein Duell spielen kann. Der Post zählt mit: „u/name's deck beat 41 of 63 painters today“. Der Besitzer bekommt die Gebühr wie bisher und einen Kommentar mit dem Ergebnis.
- **Vorbehalt:** Dafür braucht die Galerie genug echte Decks. Später.

### Später
- **Push-Benachrichtigungen:** nur als Beta. Bewerben musst du dich selbst per Modmail an r/Devvit. Höchstens zwei am Tag mit Einwilligung. Passende Anlässe wären „Your gift is waiting“ und der Strähnen-Satz aus T2. Sinnvoll, wenn täglich genug spielen.
- **Wochenligen mit Auf- und Abstieg:** brauchen viele Spieler.
- **Monster als Herausforderungs-Posts** (Galerie-Duelle als Posts, steht unter „Später“ in CLAUDE.md).
- **Devvit Journeys:** misst Start, Fortschritt und Ende einer Sitzung für Reddit. Am Handy unsichtbar, nützt fürs Featuring.

## 6 Wirtschaft

- **Heute:** etwa 250 bis 300 Pigment am Tag aus Duellen und Tagesblatt, dazu die Strähne mit bis zu 50.
- **T8:** je 7 geöffnete Geschenke 90 Pigment, 3 Tropfen und ein Loaded-Zug (Wert 300). Das sind gut 13 Pigment am Tag und etwa 43 an Zugwert.
- **T11:** bis zu 240 Pigment je Woche (gut 34 am Tag) und ein leerer Würfel.
- **T10:** selten, höchstens ein Plain-Zug in 14 Tagen.
- **Zusammen:** Wer jeden Tag spielt, hat etwa 15 bis 20 % mehr. Tropfen: 3 je Woche mehr, Umfärben kostet weiter 5. Pigment bleibt nur zu verdienen, nie zu kaufen (Devvit-Regeln).

## 7 Empfehlung

1. **Schritt 1: T8, T9 und T3 zusammen.** Alles nutzt Vorhandenes (Ziehen, Tropfen, Tagesblatt, Malmittel, Tagespost) und gibt jeden Tag einen sichtbaren Grund für morgen. Der Sonntag wird mit dem Gilded weekend ein Ereignis.
2. **Schritt 2: T10 und T11.**
3. **Danach T4.** Vorher lege ich die Texte als Entwurf vor.
4. **T5, T7, Push und Ligen,** sobald täglich ein paar Dutzend spielen. **T6** nicht, T11 ersetzt es.

## 8 Fragen (alle am 08.11.2026 mit der Empfehlung beantwortet)

1. Reihenfolge: Schritt 1 mit T8, T9 und T3, Schritt 2 mit T10 und T11? Empfehlung: ja.
2. T8: Zählt nur das Antippen des Geschenks, und die Leiste wird nie zurückgesetzt? Empfehlung: ja.
3. T8: Lohn wie in der Tabelle, an Tag 7 ein Loaded-Zug gratis? Empfehlung: ja.
4. T8: Leiste erst nach den ersten Schritten? Empfehlung: ja.
5. T3: Zahlen wie vorgeschlagen (Montag × 0,9 bis Sonntag × 1,2, sonntags ein zweiter großer Pale und Punkte × 1,5, Malmittel des Tages), nach der Simulation nachgestimmt? Empfehlung: ja.
6. T10: ab 3 Tagen Pause ein Plain-Zug gratis, höchstens alle 14 Tage? Empfehlung: ja.
7. T11: 3 Ziele je Woche, je 80 Pigment, alle drei ein leerer Würfel extra? Empfehlung: ja.
8. Push: Willst du dich bei r/Devvit bewerben? Empfehlung: später, wenn täglich ein paar Dutzend spielen.

## 9 Entscheidungen

### 04.11.2026 (Fassung 2)
- Gewählt: T1 und T2 („T1 und T2 erstmal“). T3 bis T7 blieben offen.
- Frage 2 offen gelassen, gebaut nach Empfehlung: nur der Wertungslauf des Tagesblatts zählt für die Strähne.
- Frage 3: kleiner Lohn (ab 2 Tagen +5 Pigment je Tag, höchstens +50, alle 7 Tage ein Tropfen der Tagesfarbe).
- Frage 4: Flair als Schalter im Menü, Standard aus.
- Abweichung im Text: Die Flair heißt „🖌 12 days“ statt „🖌 12“, sonst versteht man sie im Feed nicht.
- Dazu: Eine getrocknete Strähne nimmt die Flair in der Nacht danach wieder ab (Auftrag `daily-sheet`), die vorige Flair kommt zurück.
- Gebaut: T1 Beitreten und T2 Strähne, Bild docs/entwuerfe/straehne-im-spiel.png.

### 08.11.2026 (Fassung 3)
- Gewünscht: Vorschlag zu Tagesbelohnungen und dem, was für die Rückkehr noch fehlt („ja, mach“).
- Freigegeben: alle acht Fragen mit der Empfehlung („alles Empfehlung“). Schritt 1 mit T8, T9 und T3, Schritt 2 mit T10 und T11, danach T4. Push später.
- Gebaut Schritt 1 (Fassung 4): Tagesgeschenk, Morgen-Zeile, Tagesregel wie beschrieben, Malmittel des Tages aus dem Datum (Abweichung, siehe T3). Tests tests/gift.test.ts. Bild docs/entwuerfe/tagesgeschenk-im-spiel.png.
- Gebaut Schritt 2 (Fassung 5): Willkommen zurück und Wochenziele wie in Abschnitt 4, zwei Abweichungen bei den Zielen (6 Herzen statt 3, Glaze oder Pure würfeln statt Glaze-Treffer). Tests tests/weekly.test.ts. Bild docs/entwuerfe/wochenziele-im-spiel.png.
- T4 vorerst nicht („t4 brauch ich nicht vorerst“). T5, T7, Push und Ligen bleiben für später.
