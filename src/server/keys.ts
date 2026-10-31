/*
 * Redis-Schlüssel. Redis kann keine Keys auflisten, deshalb liegen alle IDs zusätzlich
 * in bekannten Sammlungen (days, user:{id}:monsters, day:{datum}:catchers, species:index, duel:players, dice:players, seeds, recycled:at,
 * drawn:queue, drawn:ok, drawn:washed, drawn:strikes, drawn:reports, naming:posts, naming:open, gallery:power, gallery:record,
 * names, market, market:at, market:sales, trades). Schlüssel je Spieler (dice:{id}, duel:{id}, gallery:{id}, gallery:me:{id},
 * gallery:inbox:{id}, deliver:{id}, market:by:{id}, trade:in:{id}, trade:out:{id}) folgen aus dice:players.
 */
export const K = {
  /** Hash: seed, humidity, postId, bp, main, createdAt, named */
  day: (day: string) => `day:${day}`,
  /** Hash: userId → monsterId, zugleich Sperre gegen doppeltes Fangen */
  dayCatchers: (day: string) => `day:${day}:catchers`,
  /** Sorted Set aller Tage, Score = Tagesbeginn */
  days: 'days',
  /** String: Datum des Tagesklecks zu einem Post */
  post: (postId: string) => `post:${postId}`,
  /** Sorted Set nach Fangzeit */
  userMonsters: (userId: string) => `user:${userId}:monsters`,
  /** JSON des Monsters */
  monster: (id: string) => `monster:${id}`,
  /** Hash: name, namedBy, firstSeen, day, commentId. key = {bauplan}:{pigment} */
  species: (key: string) => `species:${key}`,
  /** Sorted Set benannter Arten, Score = Benennungszeit */
  speciesIndex: 'species:index',
  /** Hash: kleingeschriebener Name → Artschlüssel, damit kein Name doppelt vergeben wird */
  speciesNames: 'species:names',
  /** Hash: Sperren für laufende Schreibvorgänge */
  locks: 'locks',
  /** JSON des laufenden Duells (mit Würfelzufall, nur am Server) */
  duel: (userId: string) => `duel:${userId}`,
  /** Sorted Set aller Spieler mit Duell, Score = letzte Aktion */
  duelPlayers: 'duel:players',
  /** String: ID des Spiel-Posts (Duell und Würfel) */
  playPost: 'play:post',
  /** JSON der Würfelsammlung (DiceSave): Würfel, Beutel, Pigment, Schutz vor Pech, Lasur je Art */
  dice: (userId: string) => `dice:${userId}`,
  /** Sorted Set aller Spieler mit Würfelsammlung, Score = letzte Änderung */
  dicePlayers: 'dice:players',
  /** Hash: Monster-Seed → {userId}:{Würfel-ID}, nach dem Auswaschen recycled:{userId}:{Würfel-ID}. Jeder Seed nur einmal */
  seeds: 'seeds',
  /** Hash: Monster-Seed → JSON des ausgewaschenen Würfels mit Herkunft (Archiv, später Gegner und Marktplatz) */
  recycled: 'recycled',
  /** Sorted Set der ausgewaschenen Seeds, Score = Zeit des Auswaschens */
  recycledAt: 'recycled:at',
  /** Zähler der Seriennummern aller Würfel */
  serial: 'serial',
  /** Hash: {userId}:{Würfel-ID} → JSON einer neuen Zeichnung (ReviewItem), die noch kein Mod angesehen hat (Prüfliste) */
  drawnQueue: 'drawn:queue',
  /** Hash: {userId}:{Würfel-ID} → JSON der freigegebenen Zeichnung mit Mod und Zeit. Andere sehen später nur diese */
  drawnOk: 'drawn:ok',
  /** Hash: {userId}:{Würfel-ID} → JSON der übermalten Zeichnung mit Strichen, Mod und Zeit (Protokoll für Einsprüche) */
  drawnWashed: 'drawn:washed',
  /** Hash: {userId}:{Würfel-ID} → JSON der Meldungen einer Zeichnung (Zahl, wer, ob ein Mod sie danach freigegeben hat) */
  drawnReports: 'drawn:reports',
  /** Hash: userId → JSON mit Name, Zeitpunkten der übermalten Zeichnungen und Sperre */
  drawnStrikes: 'drawn:strikes',
  /** JSON eines „What do you see?“-Posts (NamingInfo) */
  naming: (postId: string) => `naming:${postId}`,
  /** Sorted Set aller „What do you see?“-Posts, Score = angelegt */
  namingPosts: 'naming:posts',
  /** Hash: Art → Post, solange ihr Post läuft (je Art nur einer) */
  namingOpen: 'naming:open',
  /** JSON des Galerie-Abzugs eines Spielers (GallerySnap): sein Deck am Ende seines letzten fertigen Duells */
  gallery: (userId: string) => `gallery:${userId}`,
  /** Sorted Set der Decks, die in der Galerie hängen, Score = Stärke (Suche nach ähnlicher Stärke) */
  galleryPower: 'gallery:power',
  /** JSON: Galerie-Stand des Herausforderers (GalleryMe): gefundenes Deck, Tausch, Gegner des Tages */
  galleryMe: (userId: string) => `gallery:me:${userId}`,
  /** Hash: was das Deck eines Spielers in der Galerie erlebt hat, bis er es abholt (w, l, d, pig, p:{Tag}, who:{Zeit}) */
  galleryInbox: (userId: string) => `gallery:inbox:${userId}`,
  /** Hash: Bilanz der Galerie-Decks, Felder {userId}:w, {userId}:l, {userId}:d */
  galleryRecord: 'gallery:record',
  /** Zähler der Test-Decks (Playtest, nur Mods): Spieler-IDs test:deck{n} */
  galleryTestN: 'gallery:testn',
  /** Hash: Reddit-Name klein → Spieler-ID (für Tauschangebote per u/Name), gefüllt bei jedem Besuch */
  names: 'names',
  /** Hash: Spieler-ID → Reddit-Name, wie er geschrieben wird */
  nameOf: 'names:of',
  /** Hash: Lieferungen an einen Spieler (Würfel, Pigment, Nachricht), abgeholt unter seiner Sperre beim nächsten Laden */
  deliver: (userId: string) => `deliver:${userId}`,
  /** Hash: Markt-Eintrag (MarketRec) je ID. Der Würfel liegt darin, bis er verkauft oder zurück ist */
  market: 'market',
  /** Sorted Set der Markt-Einträge, Score = eingestellt */
  marketAt: 'market:at',
  /** Sorted Set der Einträge eines Verkäufers, Score = eingestellt */
  marketBy: (userId: string) => `market:by:${userId}`,
  /** Zähler der Markt-Einträge */
  marketN: 'market:n',
  /** Sorted Set der letzten Verkäufe (JSON mit Seltenheit und Preis), Score = Zeit */
  marketSales: 'market:sales',
  /** Hash: Tauschangebot (TradeRec) je ID. Die Würfel und das Pigment des Absenders liegen darin, bis es endet */
  trades: 'trades',
  /** Sorted Sets der Angebote an einen Spieler und von ihm, Score = Ablauf */
  tradeIn: (userId: string) => `trade:in:${userId}`,
  tradeOut: (userId: string) => `trade:out:${userId}`,
  tradeN: 'trade:n',
  /** Zähler der Test-Händler (Playtest, nur Mods): Spieler-IDs test:trader{n} */
  tradeTestN: 'trade:testn',
} as const;
