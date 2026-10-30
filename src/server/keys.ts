/*
 * Redis-Schlüssel. Redis kann keine Keys auflisten, deshalb liegen alle IDs zusätzlich
 * in bekannten Sammlungen (days, user:{id}:monsters, day:{datum}:catchers, species:index, duel:players, dice:players, seeds).
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
  /** Hash: Monster-Seed → {userId}:{Würfel-ID}. Jeder Seed nur einmal, auch nach dem Auswaschen */
  seeds: 'seeds',
  /** Zähler der Seriennummern aller Würfel */
  serial: 'serial',
} as const;
