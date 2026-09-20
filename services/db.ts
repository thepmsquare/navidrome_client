import * as SQLite from "expo-sqlite";

import {
  AlbumID3,
  ArtistID3,
  Child,
  Playlist,
  Search3Counts,
  SongCacheRow,
  SongCacheType,
  PendingScrobble,
} from "@/types";
import {
  DB_NAME,
  DEFAULT_AUTO_CACHE_MAX_BYTES,
  DEFAULT_SCROBBLE_MIN_DURATION,
  DEFAULT_SCROBBLE_MIN_PERCENT,
} from "@/utils/constants";

let dbInstance: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync(DB_NAME);
    initDatabase(dbInstance);
  }
  return dbInstance;
}

export function initDatabase(db: SQLite.SQLiteDatabase = getDb()): void {
  db.execSync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS artists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      coverArt TEXT,
      artistImageUrl TEXT,
      albumCount INTEGER,
      starred TEXT,
      userRating INTEGER,
      musicBrainzId TEXT,
      sortName TEXT,
      roles TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name);
    CREATE INDEX IF NOT EXISTS idx_artists_sortName ON artists(sortName);

    CREATE TABLE IF NOT EXISTS albums (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      artist TEXT,
      artistId TEXT,
      coverArt TEXT,
      songCount INTEGER,
      duration INTEGER,
      playCount INTEGER,
      created TEXT,
      played TEXT,
      starred TEXT,
      year INTEGER,
      genre TEXT,
      genres TEXT,
      userRating INTEGER,
      musicBrainzId TEXT,
      isCompilation INTEGER,
      sortName TEXT,
      originalReleaseDate TEXT,
      releaseDate TEXT,
      releaseTypes TEXT,
      recordLabels TEXT,
      artists TEXT,
      displayArtist TEXT,
      explicitStatus TEXT,
      version TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_albums_name ON albums(name);
    CREATE INDEX IF NOT EXISTS idx_albums_artistId ON albums(artistId);
    CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist);
    CREATE INDEX IF NOT EXISTS idx_albums_year ON albums(year);
    CREATE INDEX IF NOT EXISTS idx_albums_sortName ON albums(sortName);

    CREATE TABLE IF NOT EXISTS songs (
      id TEXT PRIMARY KEY,
      parent TEXT,
      isDir INTEGER,
      title TEXT NOT NULL,
      album TEXT,
      albumId TEXT,
      artist TEXT,
      artistId TEXT,
      track INTEGER,
      year INTEGER,
      genre TEXT,
      genres TEXT,
      coverArt TEXT,
      size INTEGER,
      contentType TEXT,
      suffix TEXT,
      duration INTEGER,
      bitRate INTEGER,
      path TEXT,
      isVideo INTEGER,
      userRating INTEGER,
      averageRating REAL,
      playCount INTEGER,
      discNumber INTEGER,
      created TEXT,
      played TEXT,
      starred TEXT,
      type TEXT,
      bpm INTEGER,
      comment TEXT,
      sortName TEXT,
      mediaType TEXT,
      musicBrainzId TEXT,
      isrc TEXT,
      channelCount INTEGER,
      samplingRate INTEGER,
      bitDepth INTEGER,
      artists TEXT,
      displayArtist TEXT,
      albumArtists TEXT,
      displayAlbumArtist TEXT,
      contributors TEXT,
      displayComposer TEXT,
      explicitStatus TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
    CREATE INDEX IF NOT EXISTS idx_songs_albumId ON songs(albumId);
    CREATE INDEX IF NOT EXISTS idx_songs_artistId ON songs(artistId);
    CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist);
    CREATE INDEX IF NOT EXISTS idx_songs_album ON songs(album);
    CREATE INDEX IF NOT EXISTS idx_songs_starred ON songs(starred);
    CREATE INDEX IF NOT EXISTS idx_songs_sortName ON songs(sortName);

    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      comment TEXT,
      owner TEXT,
      public INTEGER,
      songCount INTEGER,
      duration INTEGER,
      created TEXT,
      changed TEXT,
      coverArt TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_playlists_name ON playlists(name);

    CREATE TABLE IF NOT EXISTS song_cache (
      songId TEXT PRIMARY KEY,
      cacheType TEXT NOT NULL CHECK (cacheType IN ('manual','auto')),
      filePath TEXT NOT NULL,
      fileSizeBytes INTEGER NOT NULL,
      addedAt TEXT NOT NULL,
      lastAccessedAt TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_song_cache_cacheType ON song_cache(cacheType);

    CREATE TABLE IF NOT EXISTS player_session (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      queueJson TEXT NOT NULL,
      currentIndex INTEGER NOT NULL,
      position REAL NOT NULL,
      repeatMode TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pending_scrobbles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pending_scrobbles_created ON pending_scrobbles(created_at);
  `);
}

export function getSyncMeta(key: string): string | null {
  const db = getDb();
  const row = db.getFirstSync<{ value: string }>(
    "SELECT value FROM sync_meta WHERE key = ?",
    [key],
  );
  return row ? row.value : null;
}

export function setSyncMeta(key: string, value: string): void {
  const db = getDb();
  db.runSync(
    "INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value],
  );
}

export function upsertArtistsBatch(artists: ArtistID3[]): void {
  if (artists.length === 0) return;
  const db = getDb();

  db.withTransactionSync(() => {
    const stmt = db.prepareSync(`
      INSERT INTO artists (
        id, name, coverArt, artistImageUrl, albumCount,
        starred, userRating, musicBrainzId, sortName, roles
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        coverArt = excluded.coverArt,
        artistImageUrl = excluded.artistImageUrl,
        albumCount = excluded.albumCount,
        starred = excluded.starred,
        userRating = excluded.userRating,
        musicBrainzId = excluded.musicBrainzId,
        sortName = excluded.sortName,
        roles = excluded.roles;
    `);

    try {
      for (const a of artists) {
        stmt.executeSync([
          a.id,
          a.name,
          a.coverArt ?? null,
          a.artistImageUrl ?? null,
          a.albumCount ?? null,
          a.starred ?? null,
          a.userRating ?? null,
          a.musicBrainzId ?? null,
          a.sortName ?? null,
          a.roles ? JSON.stringify(a.roles) : null,
        ]);
      }
    } finally {
      stmt.finalizeSync();
    }
  });
}

export function upsertAlbumsBatch(albums: AlbumID3[]): void {
  if (albums.length === 0) return;
  const db = getDb();

  db.withTransactionSync(() => {
    const stmt = db.prepareSync(`
      INSERT INTO albums (
        id, name, artist, artistId, coverArt,
        songCount, duration, playCount, created, played,
        starred, year, genre, genres, userRating,
        musicBrainzId, isCompilation, sortName,
        originalReleaseDate, releaseDate, releaseTypes,
        recordLabels, artists, displayArtist, explicitStatus, version
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        artist = excluded.artist,
        artistId = excluded.artistId,
        coverArt = excluded.coverArt,
        songCount = excluded.songCount,
        duration = excluded.duration,
        playCount = excluded.playCount,
        created = excluded.created,
        played = excluded.played,
        starred = excluded.starred,
        year = excluded.year,
        genre = excluded.genre,
        genres = excluded.genres,
        userRating = excluded.userRating,
        musicBrainzId = excluded.musicBrainzId,
        isCompilation = excluded.isCompilation,
        sortName = excluded.sortName,
        originalReleaseDate = excluded.originalReleaseDate,
        releaseDate = excluded.releaseDate,
        releaseTypes = excluded.releaseTypes,
        recordLabels = excluded.recordLabels,
        artists = excluded.artists,
        displayArtist = excluded.displayArtist,
        explicitStatus = excluded.explicitStatus,
        version = excluded.version;
    `);

    try {
      for (const al of albums) {
        stmt.executeSync([
          al.id,
          al.name,
          al.artist ?? null,
          al.artistId ?? null,
          al.coverArt ?? null,
          al.songCount ?? null,
          al.duration ?? null,
          al.playCount ?? null,
          al.created ?? null,
          al.played ?? null,
          al.starred ?? null,
          al.year ?? null,
          al.genre ?? null,
          al.genres ? JSON.stringify(al.genres) : JSON.stringify([]),
          al.userRating ?? null,
          al.musicBrainzId ?? null,
          al.isCompilation ? 1 : 0,
          al.sortName ?? null,
          al.originalReleaseDate ? JSON.stringify(al.originalReleaseDate) : null,
          al.releaseDate ? JSON.stringify(al.releaseDate) : null,
          al.releaseTypes ? JSON.stringify(al.releaseTypes) : null,
          al.recordLabels ? JSON.stringify(al.recordLabels) : null,
          al.artists ? JSON.stringify(al.artists) : null,
          al.displayArtist ?? null,
          al.explicitStatus ?? null,
          al.version ?? null,
        ]);
      }
    } finally {
      stmt.finalizeSync();
    }
  });
}

export function upsertSongsBatch(songs: Child[]): void {
  if (songs.length === 0) return;
  const db = getDb();

  db.withTransactionSync(() => {
    const stmt = db.prepareSync(`
      INSERT INTO songs (
        id, parent, isDir, title, album,
        albumId, artist, artistId, track, year,
        genre, genres, coverArt, size, contentType,
        suffix, duration, bitRate, path, isVideo,
        userRating, averageRating, playCount, discNumber,
        created, played, starred, type, bpm,
        comment, sortName, mediaType, musicBrainzId, isrc,
        channelCount, samplingRate, bitDepth, artists,
        displayArtist, albumArtists, displayAlbumArtist,
        contributors, displayComposer, explicitStatus
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
      ON CONFLICT(id) DO UPDATE SET
        parent = excluded.parent,
        isDir = excluded.isDir,
        title = excluded.title,
        album = excluded.album,
        albumId = excluded.albumId,
        artist = excluded.artist,
        artistId = excluded.artistId,
        track = excluded.track,
        year = excluded.year,
        genre = excluded.genre,
        genres = excluded.genres,
        coverArt = excluded.coverArt,
        size = excluded.size,
        contentType = excluded.contentType,
        suffix = excluded.suffix,
        duration = excluded.duration,
        bitRate = excluded.bitRate,
        path = excluded.path,
        isVideo = excluded.isVideo,
        userRating = excluded.userRating,
        averageRating = excluded.averageRating,
        playCount = excluded.playCount,
        discNumber = excluded.discNumber,
        created = excluded.created,
        played = excluded.played,
        starred = excluded.starred,
        type = excluded.type,
        bpm = excluded.bpm,
        comment = excluded.comment,
        sortName = excluded.sortName,
        mediaType = excluded.mediaType,
        musicBrainzId = excluded.musicBrainzId,
        isrc = excluded.isrc,
        channelCount = excluded.channelCount,
        samplingRate = excluded.samplingRate,
        bitDepth = excluded.bitDepth,
        artists = excluded.artists,
        displayArtist = excluded.displayArtist,
        albumArtists = excluded.albumArtists,
        displayAlbumArtist = excluded.displayAlbumArtist,
        contributors = excluded.contributors,
        displayComposer = excluded.displayComposer,
        explicitStatus = excluded.explicitStatus;
    `);

    try {
      for (const s of songs) {
        stmt.executeSync([
          s.id,
          s.parent ?? null,
          s.isDir ? 1 : 0,
          s.title,
          s.album ?? null,
          s.albumId ?? null,
          s.artist ?? null,
          s.artistId ?? null,
          s.track ?? null,
          s.year ?? null,
          s.genre ?? null,
          s.genres ? JSON.stringify(s.genres) : JSON.stringify([]),
          s.coverArt ?? null,
          s.size ?? null,
          s.contentType ?? null,
          s.suffix ?? null,
          s.duration ?? null,
          s.bitRate ?? null,
          s.path ?? null,
          s.isVideo ? 1 : 0,
          s.userRating ?? null,
          s.averageRating ?? null,
          s.playCount ?? null,
          s.discNumber ?? null,
          s.created ?? null,
          s.played ?? null,
          s.starred ?? null,
          s.type ?? null,
          s.bpm ?? null,
          s.comment ?? null,
          s.sortName ?? null,
          s.mediaType ?? null,
          s.musicBrainzId ?? null,
          s.isrc ? JSON.stringify(s.isrc) : null,
          s.channelCount ?? null,
          s.samplingRate ?? null,
          s.bitDepth ?? null,
          s.artists ? JSON.stringify(s.artists) : null,
          s.displayArtist ?? null,
          s.albumArtists ? JSON.stringify(s.albumArtists) : null,
          s.displayAlbumArtist ?? null,
          s.contributors ? JSON.stringify(s.contributors) : null,
          s.displayComposer ?? null,
          s.explicitStatus ?? null,
        ]);
      }
    } finally {
      stmt.finalizeSync();
    }
  });
}

export function upsertPlaylistsBatch(playlists: Playlist[]): void {
  if (playlists.length === 0) return;
  const db = getDb();
  db.withTransactionSync(() => {
    const stmt = db.prepareSync(`
      INSERT OR REPLACE INTO playlists (
        id, name, comment, owner, public, songCount, duration, created, changed, coverArt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      for (const pl of playlists) {
        stmt.executeSync([
          pl.id,
          pl.name,
          pl.comment ?? null,
          pl.owner ?? null,
          pl.public ? 1 : 0,
          pl.songCount ?? 0,
          pl.duration ?? 0,
          pl.created ?? null,
          pl.changed ?? null,
          pl.coverArt ?? null,
        ]);
      }
    } finally {
      stmt.finalizeSync();
    }
  });
}

export function getLocalCounts(): Search3Counts {
  const db = getDb();
  const artistRow = db.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM artists",
  );
  const albumRow = db.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM albums",
  );
  const songRow = db.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM songs",
  );
  const playlistRow = db.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM playlists",
  );

  return {
    artistCount: artistRow?.count ?? 0,
    albumCount: albumRow?.count ?? 0,
    songCount: songRow?.count ?? 0,
    playlistCount: playlistRow?.count ?? 0,
  };
}

export function clearDatabase(): void {
  const db = getDb();
  db.execSync(`
    DELETE FROM artists;
    DELETE FROM albums;
    DELETE FROM songs;
    DELETE FROM playlists;
    DELETE FROM sync_meta;
    DELETE FROM song_cache;
    DELETE FROM player_session;
    DELETE FROM pending_scrobbles;
  `);
}

export function getAllArtists(): ArtistID3[] {
  const db = getDb();
  return db.getAllSync<ArtistID3>(
    "SELECT * FROM artists ORDER BY name COLLATE NOCASE ASC",
  );
}

export function getAllAlbums(): AlbumID3[] {
  const db = getDb();
  return db.getAllSync<AlbumID3>(
    "SELECT * FROM albums ORDER BY name COLLATE NOCASE ASC",
  );
}

export function getAllSongs(): Child[] {
  const db = getDb();
  return db.getAllSync<Child>(
    "SELECT * FROM songs ORDER BY title COLLATE NOCASE ASC",
  );
}

export function getAllPlaylists(): Playlist[] {
  const db = getDb();
  return db.getAllSync<Playlist>(
    "SELECT * FROM playlists ORDER BY name COLLATE NOCASE ASC",
  );
}

export function getPlaylistById(id: string): Playlist | null {
  const db = getDb();
  return db.getFirstSync<Playlist>("SELECT * FROM playlists WHERE id = ?", [id]);
}

export function getAlbumById(id: string): AlbumID3 | null {
  const db = getDb();
  return db.getFirstSync<AlbumID3>("SELECT * FROM albums WHERE id = ?", [id]);
}

export function getSongsByAlbumId(albumId: string): Child[] {
  const db = getDb();
  return db.getAllSync<Child>(
    "SELECT * FROM songs WHERE albumId = ? ORDER BY discNumber ASC, track ASC, title COLLATE NOCASE ASC",
    [albumId],
  );
}

export function getSongById(id: string): Child | null {
  const db = getDb();
  return db.getFirstSync<Child>("SELECT * FROM songs WHERE id = ?", [id]);
}

export function getSongsByIds(ids: string[]): Child[] {
  if (!ids || ids.length === 0) {
    return [];
  }
  const db = getDb();
  const placeholders = ids.map(() => "?").join(", ");
  return db.getAllSync<Child>(
    `SELECT * FROM songs WHERE id IN (${placeholders})`,
    ids,
  );
}

export function getCachedSongs(): Child[] {
  const db = getDb();
  return db.getAllSync<Child>(
    `SELECT s.* FROM songs s
     INNER JOIN song_cache sc ON s.id = sc.songId
     ORDER BY s.title COLLATE NOCASE ASC`,
  );
}

export function upsertSongCacheEntry(
  songId: string,
  cacheType: SongCacheType,
  filePath: string,
  fileSizeBytes: number,
): void {
  const db = getDb();
  const addedAt = new Date().toISOString();
  db.runSync(
    `INSERT OR REPLACE INTO song_cache (
      songId, cacheType, filePath, fileSizeBytes, addedAt, lastAccessedAt
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [songId, cacheType, filePath, fileSizeBytes, addedAt, null],
  );
}

export function insertSongCacheEntryIfNotExists(
  songId: string,
  cacheType: SongCacheType,
  filePath: string,
  fileSizeBytes: number,
): boolean {
  const db = getDb();
  const existing = getSongCacheEntry(songId);
  if (existing) {
    return false;
  }
  const addedAt = new Date().toISOString();
  db.runSync(
    `INSERT OR IGNORE INTO song_cache (
      songId, cacheType, filePath, fileSizeBytes, addedAt, lastAccessedAt
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [songId, cacheType, filePath, fileSizeBytes, addedAt, null],
  );
  return true;
}

export function getSongCacheEntry(songId: string): SongCacheRow | null {
  const db = getDb();
  return db.getFirstSync<SongCacheRow>(
    "SELECT * FROM song_cache WHERE songId = ?",
    [songId],
  );
}

export function getAllSongCacheEntries(): Map<string, SongCacheRow> {
  const db = getDb();
  const rows = db.getAllSync<SongCacheRow>("SELECT * FROM song_cache");
  const map = new Map<string, SongCacheRow>();
  for (const row of rows) {
    map.set(row.songId, row);
  }
  return map;
}

export function updateSongCacheLastAccessed(songId: string): void {
  const db = getDb();
  const lastAccessedAt = new Date().toISOString();
  db.runSync(
    "UPDATE song_cache SET lastAccessedAt = ? WHERE songId = ?",
    [lastAccessedAt, songId],
  );
}

export function deleteSongCacheEntry(songId: string): void {
  const db = getDb();
  db.runSync("DELETE FROM song_cache WHERE songId = ?", [songId]);
}

export function getAutoCacheMaxBytes(): number {
  const val = getSyncMeta("auto_cache_max_bytes");
  if (!val) {
    return DEFAULT_AUTO_CACHE_MAX_BYTES;
  }
  const parsed = parseInt(val, 10);
  return isNaN(parsed) || parsed <= 0 ? DEFAULT_AUTO_CACHE_MAX_BYTES : parsed;
}

export function setAutoCacheMaxBytes(bytes: number): void {
  const db = getDb();
  db.runSync(
    "INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('auto_cache_max_bytes', ?)",
    [String(bytes)],
  );
}

export function getAutoCacheTotalSize(): number {
  const db = getDb();
  const row = db.getFirstSync<{ total: number | null }>(
    "SELECT SUM(fileSizeBytes) AS total FROM song_cache WHERE cacheType = 'auto'",
  );
  return row?.total ?? 0;
}

export function getLeastRecentlyUsedAutoCacheEntries(
  limit: number,
): SongCacheRow[] {
  const db = getDb();
  return db.getAllSync<SongCacheRow>(
    "SELECT * FROM song_cache WHERE cacheType = 'auto' ORDER BY lastAccessedAt ASC LIMIT ?",
    [limit],
  );
}

export function getAutoCacheEnabled(): boolean {
  const val = getSyncMeta("auto_cache_enabled");
  if (val === null) {
    return true;
  }
  return val !== "false";
}

export function setAutoCacheEnabled(enabled: boolean): void {
  const db = getDb();
  db.runSync(
    "INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('auto_cache_enabled', ?)",
    [String(enabled)],
  );
}

export function deleteAutoSongCacheEntries(): void {
  const db = getDb();
  db.runSync("DELETE FROM song_cache WHERE cacheType = 'auto'");
}

export function getAutoCacheSongIds(): string[] {
  const db = getDb();
  const rows = db.getAllSync<{ songId: string }>(
    "SELECT songId FROM song_cache WHERE cacheType = 'auto'",
  );
  return rows.map((r) => r.songId);
}

export function getAutoCacheCount(): number {
  const db = getDb();
  const row = db.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM song_cache WHERE cacheType = 'auto'",
  );
  return row?.count ?? 0;
}

export function getScrobbleMinDuration(): number {
  const val = getSyncMeta("scrobble_min_duration");
  if (!val) return DEFAULT_SCROBBLE_MIN_DURATION;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) || parsed < 10 ? DEFAULT_SCROBBLE_MIN_DURATION : parsed;
}

export function setScrobbleMinDuration(seconds: number): void {
  setSyncMeta("scrobble_min_duration", String(Math.max(10, Math.round(seconds))));
}

export function getScrobbleMinPercent(): number {
  const val = getSyncMeta("scrobble_min_percent");
  if (!val) return DEFAULT_SCROBBLE_MIN_PERCENT;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) || parsed < 5 || parsed > 100
    ? DEFAULT_SCROBBLE_MIN_PERCENT
    : parsed;
}

export function setScrobbleMinPercent(percent: number): void {
  setSyncMeta(
    "scrobble_min_percent",
    String(Math.min(100, Math.max(5, Math.round(percent)))),
  );
}

export function getKeepPlayingOnAppDismissed(): boolean {
  const val = getSyncMeta("keep_playing_on_app_dismissed");
  if (val === null) {
    return false;
  }
  return val === "true";
}

export function setKeepPlayingOnAppDismissed(enabled: boolean): void {
  setSyncMeta("keep_playing_on_app_dismissed", String(enabled));
}

function escapeLike(str: string): string {
  return str.replace(/[%_\\]/g, "\\$0");
}

export function searchSongs(query: string, limit: number = 50): Child[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const db = getDb();
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const escapedTrimmed = escapeLike(trimmed);

  // Exact substring & prefix patterns for ranking
  const prefixPattern = `${escapedTrimmed}%`;
  const substringPattern = `%${escapedTrimmed}%`;

  const tokenClauses: string[] = [];
  const queryParams: (string | number)[] = [];

  for (const token of tokens) {
    const escapedToken = `%${escapeLike(token)}%`;
    tokenClauses.push(
      "(title LIKE ? ESCAPE '\\' OR artist LIKE ? ESCAPE '\\' OR album LIKE ? ESCAPE '\\')",
    );
    queryParams.push(escapedToken, escapedToken, escapedToken);
  }

  let whereClause = tokenClauses.join(" AND ");

  // If single token with length >= 2 and <= 15, also include fuzzy character sequence match
  if (tokens.length === 1 && tokens[0].length >= 2 && tokens[0].length <= 15) {
    const clean = tokens[0].replace(/[^a-zA-Z0-9]/g, "");
    if (clean.length >= 2) {
      const fuzzyPattern = `%${clean.split("").map(escapeLike).join("%")}%`;
      whereClause = `(${whereClause}) OR (title LIKE ? ESCAPE '\\' OR artist LIKE ? ESCAPE '\\' OR album LIKE ? ESCAPE '\\')`;
      queryParams.push(fuzzyPattern, fuzzyPattern, fuzzyPattern);
    }
  }

  const sql = `
    SELECT * FROM songs
    WHERE ${whereClause}
    ORDER BY
      CASE
        WHEN title LIKE ? ESCAPE '\\' THEN 1
        WHEN title LIKE ? ESCAPE '\\' THEN 2
        WHEN artist LIKE ? ESCAPE '\\' THEN 3
        WHEN album LIKE ? ESCAPE '\\' THEN 4
        ELSE 5
      END,
      title COLLATE NOCASE ASC
    LIMIT ?
  `;

  queryParams.push(
    prefixPattern,
    substringPattern,
    substringPattern,
    substringPattern,
    limit,
  );

  return db.getAllSync<Child>(sql, queryParams);
}

export function searchAlbums(query: string, limit: number = 20): AlbumID3[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const db = getDb();
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const escapedTrimmed = escapeLike(trimmed);

  const prefixPattern = `${escapedTrimmed}%`;
  const substringPattern = `%${escapedTrimmed}%`;

  const tokenClauses: string[] = [];
  const queryParams: (string | number)[] = [];

  for (const token of tokens) {
    const escapedToken = `%${escapeLike(token)}%`;
    tokenClauses.push("(name LIKE ? ESCAPE '\\' OR artist LIKE ? ESCAPE '\\')");
    queryParams.push(escapedToken, escapedToken);
  }

  let whereClause = tokenClauses.join(" AND ");

  if (tokens.length === 1 && tokens[0].length >= 2 && tokens[0].length <= 15) {
    const clean = tokens[0].replace(/[^a-zA-Z0-9]/g, "");
    if (clean.length >= 2) {
      const fuzzyPattern = `%${clean.split("").map(escapeLike).join("%")}%`;
      whereClause = `(${whereClause}) OR (name LIKE ? ESCAPE '\\' OR artist LIKE ? ESCAPE '\\')`;
      queryParams.push(fuzzyPattern, fuzzyPattern);
    }
  }

  const sql = `
    SELECT * FROM albums
    WHERE ${whereClause}
    ORDER BY
      CASE
        WHEN name LIKE ? ESCAPE '\\' THEN 1
        WHEN name LIKE ? ESCAPE '\\' THEN 2
        WHEN artist LIKE ? ESCAPE '\\' THEN 3
        ELSE 4
      END,
      name COLLATE NOCASE ASC
    LIMIT ?
  `;

  queryParams.push(prefixPattern, substringPattern, substringPattern, limit);

  return db.getAllSync<AlbumID3>(sql, queryParams);
}

export function searchArtists(query: string, limit: number = 20): ArtistID3[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const db = getDb();
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const escapedTrimmed = escapeLike(trimmed);

  const prefixPattern = `${escapedTrimmed}%`;
  const substringPattern = `%${escapedTrimmed}%`;

  const tokenClauses: string[] = [];
  const queryParams: (string | number)[] = [];

  for (const token of tokens) {
    const escapedToken = `%${escapeLike(token)}%`;
    tokenClauses.push("name LIKE ? ESCAPE '\\'");
    queryParams.push(escapedToken);
  }

  let whereClause = tokenClauses.join(" AND ");

  if (tokens.length === 1 && tokens[0].length >= 2 && tokens[0].length <= 15) {
    const clean = tokens[0].replace(/[^a-zA-Z0-9]/g, "");
    if (clean.length >= 2) {
      const fuzzyPattern = `%${clean.split("").map(escapeLike).join("%")}%`;
      whereClause = `(${whereClause}) OR (name LIKE ? ESCAPE '\\')`;
      queryParams.push(fuzzyPattern);
    }
  }

  const sql = `
    SELECT * FROM artists
    WHERE ${whereClause}
    ORDER BY
      CASE
        WHEN name LIKE ? ESCAPE '\\' THEN 1
        WHEN name LIKE ? ESCAPE '\\' THEN 2
        ELSE 3
      END,
      name COLLATE NOCASE ASC
    LIMIT ?
  `;

  queryParams.push(prefixPattern, substringPattern, limit);

  return db.getAllSync<ArtistID3>(sql, queryParams);
}

export function searchPlaylists(query: string, limit: number = 20): Playlist[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const db = getDb();
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const escapedTrimmed = escapeLike(trimmed);

  const prefixPattern = `${escapedTrimmed}%`;
  const substringPattern = `%${escapedTrimmed}%`;

  const tokenClauses: string[] = [];
  const queryParams: (string | number)[] = [];

  for (const token of tokens) {
    const escapedToken = `%${escapeLike(token)}%`;
    tokenClauses.push("name LIKE ? ESCAPE '\\'");
    queryParams.push(escapedToken);
  }

  let whereClause = tokenClauses.join(" AND ");

  if (tokens.length === 1 && tokens[0].length >= 2 && tokens[0].length <= 15) {
    const clean = tokens[0].replace(/[^a-zA-Z0-9]/g, "");
    if (clean.length >= 2) {
      const fuzzyPattern = `%${clean.split("").map(escapeLike).join("%")}%`;
      whereClause = `(${whereClause}) OR (name LIKE ? ESCAPE '\\')`;
      queryParams.push(fuzzyPattern);
    }
  }

  const sql = `
    SELECT * FROM playlists
    WHERE ${whereClause}
    ORDER BY
      CASE
        WHEN name LIKE ? ESCAPE '\\' THEN 1
        WHEN name LIKE ? ESCAPE '\\' THEN 2
        ELSE 3
      END,
      name COLLATE NOCASE ASC
    LIMIT ?
  `;

  queryParams.push(prefixPattern, substringPattern, limit);

  return db.getAllSync<Playlist>(sql, queryParams);
}

export interface PersistedPlayerSession {
  queue: Child[];
  currentIndex: number;
  position: number;
  repeatMode: "off" | "one" | "all";
  updatedAt: string;
}

export function savePlayerSession(session: PersistedPlayerSession): void {
  const db = getDb();
  db.runSync(
    `INSERT INTO player_session (id, queueJson, currentIndex, position, repeatMode, updatedAt)
     VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       queueJson = excluded.queueJson,
       currentIndex = excluded.currentIndex,
       position = excluded.position,
       repeatMode = excluded.repeatMode,
       updatedAt = excluded.updatedAt`,
    [
      JSON.stringify(session.queue),
      session.currentIndex,
      session.position,
      session.repeatMode,
      session.updatedAt,
    ],
  );
}

export function getPlayerSession(): PersistedPlayerSession | null {
  const db = getDb();
  const row = db.getFirstSync<{
    queueJson: string;
    currentIndex: number;
    position: number;
    repeatMode: string;
    updatedAt: string;
  }>(
    "SELECT queueJson, currentIndex, position, repeatMode, updatedAt FROM player_session WHERE id = 1",
  );

  if (!row) return null;

  try {
    const queue = JSON.parse(row.queueJson) as Child[];
    const repeatMode =
      row.repeatMode === "one" || row.repeatMode === "all"
        ? row.repeatMode
        : "off";
    return {
      queue,
      currentIndex: row.currentIndex,
      position: row.position,
      repeatMode,
      updatedAt: row.updatedAt,
    };
  } catch (err) {
    console.error("failed to parse player session queueJson:", err);
    return null;
  }
}

export function clearPlayerSession(): void {
  const db = getDb();
  db.runSync("DELETE FROM player_session WHERE id = 1");
}

export function addPendingScrobble(songId: string, timestamp?: number): void {
  const db = getDb();
  const now = Date.now();
  const ts = timestamp ?? now;
  db.runSync(
    "INSERT INTO pending_scrobbles (song_id, timestamp, attempts, created_at) VALUES (?, ?, ?, ?)",
    [songId, ts, 0, now],
  );
}

export function getPendingScrobbles(): PendingScrobble[] {
  const db = getDb();
  const rows = db.getAllSync<{
    id: number;
    song_id: string;
    timestamp: number;
    attempts: number;
    created_at: number;
  }>(
    "SELECT id, song_id, timestamp, attempts, created_at FROM pending_scrobbles ORDER BY created_at ASC",
  );

  return rows.map((r) => ({
    id: r.id,
    songId: r.song_id,
    timestamp: r.timestamp,
    attempts: r.attempts,
    createdAt: r.created_at,
  }));
}

export function removePendingScrobble(id: number): void {
  const db = getDb();
  db.runSync("DELETE FROM pending_scrobbles WHERE id = ?", [id]);
}

export function incrementPendingScrobbleAttempts(id: number): void {
  const db = getDb();
  db.runSync(
    "UPDATE pending_scrobbles SET attempts = attempts + 1 WHERE id = ?",
    [id],
  );
}

export function getPendingScrobblesCount(): number {
  const db = getDb();
  const row = db.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) as count FROM pending_scrobbles",
  );
  return row?.count ?? 0;
}

export function clearPendingScrobbles(): void {
  const db = getDb();
  db.runSync("DELETE FROM pending_scrobbles");
}
