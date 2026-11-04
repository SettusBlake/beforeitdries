# Entwicklung: Vorschlag

Stand 04.11.2026, Fassung 1. Nichts davon ist gebaut. Fragen am Ende.

Bild: docs/entwuerfe/entwicklung-entwurf.png (Quelle tools/mockup/entwicklung-entwurf.ts). Die Kleckse sind echt aus dem Renderer, die Schichten sind im Entwurf nachträglich aufgemalt. Alle Zahlen sind Vorschläge und werden vor dem Bau simuliert.

## 1 Was es schon gibt

| Was | Wirkung |
| --- | --- |
| Lasur (aus ausgewaschenen Würfeln derselben Art) | 3 Lasur machen eine einfache Seite doppelt |
| Patina | nach 10, 30 und 60 Würfen wird eine Seite besser |
| Umfärben | 5 Tropfen färben eine Seite um, höchstens 2 je Würfel |
| Holo | hebt die Seltenheit, aber nur einmal beim Ziehen |

All das ändert nur Würfelseiten. Der Klecks selbst sieht immer gleich aus. Lebenskraft, Schaden, Reichweite und die Fähigkeit bleiben, wie sie beim Ziehen gewürfelt wurden.

Das Ziel in CLAUDE.md lautet: „der Spieler malt sein Exemplar Schicht für Schicht (Lasuren) stärker“. Das alte Malblatt mit Lasieren und Trockenzeit ist seit dem 02.11.2026 weg. Dieser Teil des Ziels fehlt im Spiel also gerade.

## 2 Grenzen

- **Kein Füttern und kein fester Baum:** keine Gegenstände, die man einem Klecks gibt, und keine vorgegebenen Entwicklungsformen je Art. Das wäre Amber Delve oder Digimon. Jeder Klecks bleibt einzigartig.
- **Kein Austrocknen und kein Reifen über Zeit:** Austrocknen wurde am 29.10.2026 abgelehnt.
- **Gleicher Seed, gleiches Bild:** Schichten kommen als eigener Zufallsstrom obendrauf. Die Grundform bleibt gleich, Generation 1 bleibt pixelgleich.
- **Alle Würfe am Server.**

## 3 Vorschläge

### E1 Schichten (mittel)

Jeder Würfel kann drei Schichten mehr bekommen. Jede braucht Erfahrung im Spiel und kostet etwas.

| Schicht | Name | Aussehen | Wirkung (Vorschlag) |
| --- | --- | --- | --- |
| 0 | First wash | wie heute | |
| 1 | Second wash | Farbe tiefer, deckender, dunkler Wasserrand | +2 Lebenskraft, eine Seite wird besser (Server würfelt, wie bei der Patina) |
| 2 | eine Richtung (E2) | je nach Richtung | Wert der Richtung |
| 3 | Signed | Tuschelinie am Rand, Blattgold | Meisterzug schon ab 5 statt 6 Sättigung, die Stufe kann steigen, „painted by u/name“ auf der Karte |

- **Erfahrung:** jedes Beschwören zählt (der Klecks klappt aufs Blatt), im Duell und im Tagesblatt. Schwellen 5, 15 und 30 Mal.
  - Grob gerechnet: etwa 3,6 Beschwörungen je Duell und Seite, verteilt auf 9 Würfel, also etwa 0,4 je Würfel und Duell.
  - Mit 5 Duellen und dem Tagesblatt am Tag ist Schicht 1 nach etwa 2 Tagen erreicht, Schicht 2 nach etwa einer Woche, Schicht 3 nach etwa 2 Wochen. Das gilt für alle Würfel im Deck gleichzeitig.
- **Kosten** (Frage 3): Pigment 100, 250 und 500.
- **Anzeige:**
  - Fortschritt steht auf der Würfelkarte („Layer 1/3 · Unfolded 9/15“).
  - Ist die Schicht bereit, leuchtet die Karte. Ein Tipp malt sie: Pinsel, Lasur und Ton wie beim Ziehen, die Werte zählen sichtbar hoch, Sepia sagt etwas dazu.
  - Im Duell sieht man die Schichten am Klecks, der Chip zeigt eine kleine Ziffer.
- **Gilt überall:**
  - Duell und Tagesblatt.
  - Galerie: die Stärke zählt mit, die Suche nach ähnlicher Stärke bleibt fair.
  - Archiv: Pales behalten ihre Schichten.
  - Markt und Tausch: die Schichten wandern mit, die Signatur bleibt als Herkunft.

### E2 Richtung bei Schicht 2 (Teil von E1)

Bei Schicht 2 bietet Sepia zwei von vier Richtungen an. Es sind die zwei, die zu dem passen, was der Klecks im Duell am meisten getan hat. Du wählst eine.

| Richtung | Kommt von | Aussehen | Wirkung (Vorschlag) |
| --- | --- | --- | --- |
| Spatter | oft gespritzt | Spritzerkranz in seiner Farbe | Schaden +2 |
| Impasto | oft getroffen und überlebt | dicke, deckende Farbe mit Pinselrelief | Lebenskraft +4 |
| Bloom | viele Felder gemalt | Blumenkohl-Ränder, wo Farbe zurückläuft | seine Farbe verläuft 1 Feld weiter (wie Ox Gall, nur für diesen Klecks) |
| Lift | viel gegangen, ausgewichen | ausgehobene Lichter, Papier scheint durch | Ausweichen +5 %, 1 Schritt weiter |

- Gezählt wird je Würfel am Server, wie die Würfe für die Patina.
- Sepia sagt zum Beispiel: „It keeps throwing paint at things. Shall we lean into that, or let it bloom?“
- Zwei Würfel derselben Art können so ganz verschieden enden.

### E3 Falten (groß, später)

Steht in CLAUDE.md unter „Später“: zwei Monster spiegelsymmetrisch verschmelzen.

- **Ablauf:** Zwei Kleckse kommen auf eine Hälfte des Blatts, das Blatt klappt zu. Heraus kommt ein neuer, spiegelgleicher Klecks, wie beim Rorschach-Test. Wo beide übereinanderlagen, mischen sich die Farben.
- **Was der neue Klecks bekommt (Skizze):**
  - Hauptpigment vom einen, Zweitfarbe vom anderen. Das Element würfelt der Server aus beiden.
  - Die Seltenheit des besseren, Holo, wenn einer Holo hatte.
  - Werte im Mittel beider und +1. Schichten fangen wieder bei 0 an.
- **Folgen:**
  - Beide alten Würfel gehen ins Archiv.
  - Es entsteht eine neue Art, also ein neuer „What do you see?“-Post.
  - Später auch mit Faltpartnern aus den Kommentaren.
- **Aufwand:** Der Renderer braucht dafür eine eigene Form aus zwei Seeds, die echt gefaltet wird. Im Entwurf ist es nur nachgestellt.
- Größer als E1. Ich würde es als eigenen Vorschlag nach E1 bringen.

### Was ich nicht vorschlage

- **Reifen über Zeit** (Kleckse ändern sich nach Tagen von selbst): zu nah am abgelehnten Austrocknen, und es baut Druck auf statt Freude.
- **Feste Entwicklungsformen je Art:** widerspricht „jedes Monster einzigartig“ und ist zu nah an Amber Delve.
- **Schichten nur gegen Pigment, ohne Spielen:** dann wäre es ein Kauf, keine Entwicklung.

## 4 Empfehlung

E1 mit E2 als ein Plan in drei Schritten:

1. Regeln und Server: Zähler je Würfel, Schichten, Werte, Simulation der Siegquoten.
2. Renderer: Schichten als eigener Zufallsstrom. Vorher ein Entwurf mit echtem Renderer statt nachgemalt.
3. Bedienung: Würfelkarte mit Fortschritt, Ritual beim Malen einer Schicht, Sepias Angebot.

E3 Falten danach als eigener Vorschlag.

## 5 Fragen

1. Erst E1 Schichten mit E2 Richtung, E3 Falten später? Empfehlung: ja.
2. Was zählt als Erfahrung: Beschwören, alle Würfe (wie die Patina) oder ausgewaschene Rivalen? Empfehlung: Beschwören, das ist sichtbar und belohnt, den Klecks wirklich einzusetzen.
3. Was kostet eine Schicht: Pigment (100, 250, 500), Tropfen seiner Hauptfarbe (2, 4, 6) oder nichts? Empfehlung: Pigment.
4. Richtung: Sepia bietet zwei passende an und du wählst, alle vier frei wählbar, oder der Server würfelt? Empfehlung: zwei passende zur Wahl.
5. Wie stark: Werte wie oben und nach der Simulation nachgestimmt, oder nur Aussehen ohne Werte? Empfehlung: Werte, aber so, dass Siegquoten gegen gleich starke Galerie-Decks im bisherigen Rahmen bleiben.
6. Stil- und Holo-Würfel: Sie bekommen Schichten nur als Werte, Rahmen und Signatur, ihr Stil bleibt unverändert. Oder bekommen sie gar keine? Empfehlung: Werte, Rahmen und Signatur.
7. Signatur bei Schicht 3: dein Name auf der Karte, der beim Handel bleibt? Empfehlung: ja.
8. Patina: bleibt sie wie sie ist (Würfe verbessern Seiten) und Schichten kommen dazu, oder geht die Patina in den Schichten auf? Empfehlung: bleibt, viele Würfel haben schon Patina.
