/*
 * Redis-Schlüssel. Redis kann keine Keys auflisten, deshalb liegen alle IDs zusätzlich
 * in bekannten Sammlungen (days, user:{id}:monsters, day:{datum}:catchers, species:index, duel:players, dice:players, seeds, recycled:at,
 * drawn:queue, drawn:ok, drawn:washed, drawn:strikes, naming:posts, naming:open).
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
  /** Hash: userId → JSON mit Name, Zeitpunkten der übermalten Zeichnungen und Sperre */
  drawnStrikes: 'drawn:strikes',
  /** JSON eines „What do you see?“-Posts (NamingInfo) */
  naming: (postId: string) => `naming:${postId}`,
  /** Sorted Set aller „What do you see?“-Posts, Score = angelegt */
  namingPosts: 'naming:posts',
  /** Hash: Art → Post, solange ihr Post läuft (je Art nur einer) */
  namingOpen: 'naming:open',
} as const;
