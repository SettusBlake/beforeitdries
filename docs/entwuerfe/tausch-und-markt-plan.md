# Plan: Würfel tauschen (A) und verkaufen (B)

Stand 31.10.2026, Fassung 1. Wartet auf Freigabe.

Anlass (31.10.2026): Frage „Tauschen und verkaufen geht?“. Gewählt: A direkter Tausch und B Markt, mit Schutz vor Zweitkonten.

Entwurf: docs/entwuerfe/tausch-markt-entwurf.png (Attrappen in der echten Vorschau, Quelle tools/mockup/markt-entwurf.cjs).

## Grundsätze

- **Nur gegen Pigment.** Nie gegen Geld oder Reddit Gold. Die Devvit-Regeln (devvit_rules.md, „Payment rules“) verbieten digitale Güter, die sich gegen echtes Geld tauschen lassen, als Glücksspiel. Solange Würfel handelbar sind, darf Pigment nie für echtes Geld zu kaufen sein.
- **Alles am Server.** Beide Seiten bestätigen, der Server tauscht alles auf einmal oder gar nichts.
- **Einzigartig bleibt einzigartig.** Seriennummer und Seed bleiben, das Seed-Register zeigt den neuen Besitzer, die Herkunft wandert mit.
- **Was mitwandert:** der Würfel mit allem, was an ihm hängt. Das sind Seiten, mit Lasur verbesserte Seiten, Patina und Würfe, Stil, Holo und die Zeichnung. Der Lasur-Vorrat einer Art bleibt beim alten Besitzer, er gehört zu seiner Sammlung.

## Schutz vor Zweitkonten und Fehlgriffen

- **Startwürfel gebunden:** Die 9 freien Startwürfel lassen sich weder tauschen noch verkaufen. Bei bisherigen Ständen gelten die ersten 9 Würfel als Startwürfel.
- **Handeln ab:** Reddit-Konto mindestens 7 Tage alt und 5 fertige Duelle (ohne Lern-Duell, gezählt ab jetzt).
- **Limits:**
  - 3 Tausche und 5 Käufe am Tag
  - 5 offene Angebote
  - 5 Würfel im Markt
  - höchstens 500 Pigment je Tauschangebot
- **Mindestens 9 Würfel** bleiben in der Sammlung, wie beim Auswaschen.
- **Gesperrte Würfel:** Würfel im Deck, in einem offenen Angebot oder im Markt. Sie sind reserviert, bis das Angebot endet.
- **Gemalte Monster:** nur mit Freigabe durch einen Mod.
- **Nachfrage:** Holo und Legendary fragen beim Abgeben noch einmal nach (zweiter Tipp).

## A Direkter Tausch

- **Start:** auf der Karte „Offer in a trade“, oder „Trades“ in „Your dice“ und dort „New trade“.
- **Partner:** u/Name eintippen, oder aus den Gegnern der Galerie und den Verkäufern im Markt wählen. Dafür gibt es ein Namen-Register, das sich bei jedem Besuch füllt.
- **Sammlung des anderen:** Man sieht nur seine handelbaren Würfel, nur zum Ansehen.
- **Angebot:**
  - Bis zu 3 eigene Würfel und bis zu 500 Pigment gegen bis zu 3 Würfel des anderen.
  - Auf jeder Seite muss etwas liegen, Pigment allein gegen Pigment geht nicht.
- **Reserviert:** Die eigenen Würfel im Angebot sind reserviert, das Pigment wird abgezogen und kommt bei Ablehnung zurück.
- **Antwort:** Der Empfänger sieht das Angebot unter „Trades“ und kann annehmen oder ablehnen. Gegenangebote kommen später.
- **Laufzeit 3 Tage,** dann geht alles zurück. Der Absender kann vorher zurückziehen.
- **Benachrichtigung:**
  - Im Spiel: Zähler am Knopf „Trades“, Sepia sagt es beim Öffnen.
  - Private Nachricht der App nur für Spieler, die das im Menü einschalten. Die Devvit-Regeln verbieten ungefragte Nachrichten.
  - Push-Benachrichtigungen sind bei Devvit eine geschlossene Beta für etablierte Spiele, also nicht jetzt.

## B Markt

- **Einstellen:** auf der Karte „Sell“.
  - Preis 10 bis 50 000 Pigment.
  - Laufzeit 3 Tage, dann kommt der Würfel zurück. Zurückziehen geht jederzeit.
- **Preisvorschlag:** aus den Verkäufen der letzten 7 Tage mit derselben Seltenheit, Holo und Stil getrennt („Rares sold for 300 to 520 this week“, mittlere Hälfte der Preise).
  - Ohne Verkäufe ein Richtwert aus dem Ziehen: Ein Zug kostet 100 Pigment, ein Rare kommt etwa jeder 7. Zug, ein Epic jeder 25., ein Legendary jeder 100.
- **Gebühr:** ein Zehntel des Preises (mindestens 1) verschwindet. Der Verkäufer bekommt den Rest sofort gutgeschrieben, Sepia meldet es beim nächsten Öffnen. Die Gebühr hält die Pigment-Menge im Spiel stabil.
- **Kaufen:**
  - „Market“ in „Your dice“, Kacheln mit Preis und Verkäufer.
  - Filter: All, Rare+, Holo, Styles, Drawn, Art.
  - Sortieren: neu, billig, teuer.
  - Antippen öffnet die gewohnte Karte mit Werten. Kaufen mit „Buy for 340“ und zweitem Tipp.
- **Nicht im ersten Schritt:** Bieten (Auktion).

## Herkunft auf der Karte

- **Neues Würfel-Feld `hist`:** höchstens 10 Einträge, jeder mit Name, Zeit, Art (gezogen, getauscht, gekauft) und Preis.
- **Karte:** zeigt zum Beispiel „Pulled by u/Inkwell on 29 Oct · bought by u/Oldbrush for 340 · traded to you today“.
- **Erster Eintrag:** Er entsteht beim ersten Handel aus dem bisherigen Besitzer und dem Zugdatum.

## Galerie und Archiv

- **Galerie:** Der Abzug in der Galerie bleibt ein Abzug. Ein verkaufter Würfel bleibt im alten Abzug, bis das nächste Duell das Deck neu aufhängt.
- **Auswaschen:** Wer einen Würfel besitzt, kann ihn auswaschen. Das Archiv nennt den letzten Besitzer.

## Testen (nur Playtest, nur Mods)

- **„+1 test offer“:** Ein Test-Maler aus der Galerie bietet einen seiner Würfel und etwas Pigment für einen deiner Würfel.
- **„+3 test listings“:** Test-Maler stellen Würfel in den Markt.
- **„Test buyer“:** Ein Test-Maler kauft dein günstigstes Angebot.
- **Ausnahmen:** Konto-Alter und Duell-Zahl gelten im Playtest für Mods nicht.

## Technik

- **Redis** (alle IDs in bekannten Sammlungen):
  - `names`: Name (klein) zu Spieler-ID
  - Tausch:
    - `trade:{id}`: ein Angebot
    - `trade:in:{uid}`, `trade:out:{uid}`: Angebote nach Zeit
    - `trade:n`: Zähler
  - Markt:
    - `market`: Eintrag je ID
    - `market:at`: Einträge nach Zeit
    - `market:n`: Zähler
    - `market:sales`: die letzten 200 Verkäufe
- **Neue Felder:**
  - Spielstand: `duels`, `tradeDay`, `tradeN`, `buyN`, `tradeMsg` (Nachricht erlaubt)
  - Würfel: `bound`, `held`, `hist`
- **Atomar:**
  - Beide Spieler-Sperren in fester Reihenfolge, alles prüfen, dann beide Stände schreiben.
  - Seed-Register auf den neuen Besitzer, Seriennummer bleibt.
- **Ablauf:** Abgelaufene Angebote und Einträge werden beim Laden aufgeräumt und einmal am Tag per Scheduler.
- **Routen:**
  - Tausch: `/api/trade/offer`, `accept`, `decline`, `cancel`, `list`, `collection`
  - Markt: `/api/market/list`, `sell`, `unlist`, `buy`, `mine`
- **Tests:**
  - Tausch und Kauf sind atomar.
  - Gesperrte und gebundene Würfel lassen sich nicht handeln.
  - Limits, Ablauf, Gebühr, Herkunft und Register stimmen.
  - Zwei Käufer gleichzeitig: einer bekommt den Würfel, der andere eine Meldung.
- **Duell:** Am Duell ändert sich nichts, DUEL_PROTOCOL bleibt.

## Reihenfolge

1. **Server:**
   - Namen-Register, Bindung, Zähler
   - Markt (Einstellen, Kaufen, Ablauf, Gebühr, Verlauf)
   - Tausch (Angebot, Annehmen, Ablehnen, Ablauf)
   - Test-Knöpfe und Tests
   - Upload
2. **Bedienung Markt:**
   - Knöpfe in „Your dice“, Markt-Fenster
   - Verkaufen auf der Karte, Sepias Meldung
   - Upload mit Bild
3. **Bedienung Tausch:**
   - Neuer Tausch, fremde Sammlung, Angebote
   - Herkunft auf der Karte, Nachricht-Schalter im Menü
   - Upload mit Bild

## Fragen

1. Startwürfel gebunden? (Empfehlung: ja)
2. Handeln ab einem Reddit-Konto von 7 Tagen und 5 fertigen Duellen? (Empfehlung: ja)
3. Im Markt ein Zehntel Gebühr, im Tausch keine, dafür höchstens 500 Pigment je Angebot? (Empfehlung: ja)
4. Limits: 3 Tausche und 5 Käufe am Tag, 5 offene Angebote, 5 Würfel im Markt? (Empfehlung: ja)
5. Laufzeit 3 Tage für Angebote und Markt? (Empfehlung: ja)
6. Private Nachricht der App bei Angeboten nur, wenn der Spieler sie im Menü einschaltet (Standard aus)? (Empfehlung: ja)
7. Herkunft mit Reddit-Namen auf der Karte? (Empfehlung: ja)
8. Markt vor Tausch bauen? (Empfehlung: ja, der Markt braucht keinen Partner und lässt sich mit den Test-Malern gut prüfen)
