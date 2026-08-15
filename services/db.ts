import * as SQLite from "expo-sqlite";

import { AlbumID3, ArtistID3, Child, Search3Counts } from "@/types";
import { DB_NAME } from "@/utils/constants";

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

  return {
    artistCount: artistRow?.count ?? 0,
    albumCount: albumRow?.count ?? 0,
    songCount: songRow?.count ?? 0,
  };
}

export function clearDatabase(): void {
  const db = getDb();
  db.execSync(`
    DELETE FROM artists;
    DELETE FROM albums;
    DELETE FROM songs;
    DELETE FROM sync_meta;
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


