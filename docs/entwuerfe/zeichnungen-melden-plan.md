# Plan: Anstößige Zeichnungen (Übermalen, Melden, Sperre)

Stand 30.10.2026, Fassung 1, wartet auf Freigabe.

Wunsch vom 30.10.2026: Wenn jemand obszöne Dinge oder verbotene Symbole malt, muss etwas passieren.

## Heute

- Jeder sieht nur seine eigenen Zeichnungen. Es gibt noch keine Stelle, an der fremde Monster auftauchen (der Rivale ist der Computer).
- Im Plan zum Selbstmalen steht schon: Melden und Mod-Menü kommen, sobald fremde Monster sichtbar werden. Dieser Plan macht das konkret und zieht einen Teil vor.

## Was passiert mit einer verbotenen Zeichnung

**Übermalen („Paint over“):**

- Die Zeichnung verschwindet vom Monster. Es bekommt eine **zufällige Form** aus seinem Seed, wie bei einem normalen Zug (Generation 2 mit 2b-Aussehen).
- Seriennummer, Seltenheit, Papier, Werte, Lasuren und ein Shiny-Stil bleiben. Der Spieler verliert also nur die Zeichnung, nicht den Würfel.
- Beim nächsten Öffnen sagt Sepia: „I painted over #00427. Some things do not belong on my sheet.“
- Die Striche kommen in ein Mod-Protokoll (Redis-Hash `drawn:washed`, mit Spieler, Mod und Datum), damit Mods Einsprüche prüfen können. Sie werden nirgends mehr gezeigt außer dort.

**Sperre bei Wiederholung:**

- 2-mal übermalt innerhalb von 30 Tagen: 14 Tage kein Blank canvas. Die leeren Würfel bleiben liegen, der Knopf zeigt „locked for 14 days“.
- 3-mal: gesperrt, bis ein Mod es aufhebt.

## Wie Mods davon erfahren

**Prüfliste (jetzt bauen, empfohlen):**

- Jede neue Zeichnung kommt in eine Liste am Server (`drawn:queue`).
- Mods sehen im Würfelbildschirm einen Knopf „Review drawings (3)“, auch in veröffentlichten Versionen, sonst nirgends sichtbar. Der Server prüft wie beim Test-Knopf, ob jemand Mod ist.
- Die Liste zeigt jede Zeichnung als schlichte Strichzeichnung (wie auf dem Zeichenblatt, gut erkennbar), dazu Spieler und Seriennummer. Zwei Knöpfe: **OK** (frei, aus der Liste) und **Paint over**.

**Melden (später, mit der ersten Stelle, an der fremde Monster zu sehen sind):**

- An jeder fremden gemalten Karte „Report“. Gemeldete Zeichnungen stehen oben in der Prüfliste.
- Ab 2 Meldungen sehen andere statt der Zeichnung die zufällige Form, bis ein Mod entscheidet. Der Besitzer sieht weiter seine Zeichnung.

**Sichtbar für andere erst nach Freigabe (Empfehlung für den Anfang):**

- Fremde sehen eine Zeichnung erst, wenn ein Mod sie in der Prüfliste mit OK freigegeben hat. Bis dahin sehen sie die zufällige Form.
- Bei wenig Spielern ist das sicher und machbar. Wird es mehr, lässt sich das auf „sofort sichtbar, mit Melden“ umstellen (Einstellung für Mods).

## Was ich nicht vorschlage

- **Automatische Erkennung** (Symbole oder Anstößiges per Bilderkennung): Bei frei gemalten Strichen unzuverlässig, braucht einen fremden Dienst, und Devvit erlaubt nur freigegebene Adressen. Die Prüfliste ist sicherer.

## Umfang und Reihenfolge

1. Server: Prüfliste, Übermalen (Würfel verliert `draw`, Protokoll), Sperre, Endpunkte nur für Mods. Tests.
2. Bildschirm für Mods (Prüfliste mit OK und Paint over), Hinweis von Sepia an den Besitzer, gesperrter Knopf.
3. Upload und Handy-Test.
4. Später mit der ersten fremden Ansicht: Report, Verhüllen ab 2 Meldungen, Freigabe-Regel.

## Offene Fragen

1. Prüfliste, Übermalen und Sperre jetzt bauen, Melden später? (Empfehlung: ja)
2. Andere sehen Zeichnungen anfangs erst nach Freigabe durch Mods? (Empfehlung: ja, später umstellbar)
3. Sperre: 2-mal in 30 Tagen gibt 14 Tage Pause, 3-mal bis ein Mod aufhebt? (Empfehlung: ja)
4. Keine automatische Erkennung? (Empfehlung: ja, keine)
