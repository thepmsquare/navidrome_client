import {
  clearDatabase,
  getAlbumById,
  getAllAlbums,
  getAllArtists,
  getAllPlaylists,
  getAllSongs,
  getCachedSongs,
  getDb,
  getLocalCounts,
  getPlaylistById,
  getSongById,
  getSongsByIds,
  getSongCacheEntry,
  getAllSongCacheEntries,
  getSongsByAlbumId,
  getSyncMeta,
  initDatabase,
  setSyncMeta,
  updateSongCacheLastAccessed,
  upsertAlbumsBatch,
  upsertArtistsBatch,
  upsertPlaylistsBatch,
  upsertSongCacheEntry,
  upsertSongsBatch,
  deleteSongCacheEntry,
  insertSongCacheEntryIfNotExists,
  getAutoCacheMaxBytes,
  setAutoCacheMaxBytes,
  getAutoCacheTotalSize,
  getLeastRecentlyUsedAutoCacheEntries,
  getAutoCacheEnabled,
  setAutoCacheEnabled,
  deleteAutoSongCacheEntries,
  getAutoCacheSongIds,
  getAutoCacheCount,
  getScrobbleMinDuration,
  setScrobbleMinDuration,
  getScrobbleMinPercent,
  setScrobbleMinPercent,
  getKeepPlayingOnAppDismissed,
  setKeepPlayingOnAppDismissed,
  clearPlayerSession,
  getPlayerSession,
  savePlayerSession,
  PersistedPlayerSession,
} from "@/services/db";
import { AlbumID3, ArtistID3, Child, Playlist, SongCacheType } from "@/types";

const mockGetFirstSync = jest.fn();
const mockGetAllSync = jest.fn();
const mockRunSync = jest.fn();
const mockExecSync = jest.fn();
const mockWithTransactionSync = jest.fn((cb: () => void) => cb());
const mockPrepareSync = jest.fn();
const mockStmt = {
  executeSync: jest.fn(),
  finalizeSync: jest.fn(),
};

jest.mock("expo-sqlite", () => ({
  openDatabaseSync: jest.fn(() => ({
    execSync: mockExecSync,
    getFirstSync: mockGetFirstSync,
    getAllSync: mockGetAllSync,
    runSync: mockRunSync,
    withTransactionSync: mockWithTransactionSync,
    prepareSync: mockPrepareSync,
  })),
}));

describe("db service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrepareSync.mockReturnValue(mockStmt);
  });

  describe("initDatabase and getDb", () => {
    it("should initialize database tables with PRAGMA journal_mode = WAL", () => {
      const db = getDb();
      expect(db).toBeDefined();
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("PRAGMA journal_mode = WAL;"),
      );
      initDatabase(db);
      expect(mockExecSync).toHaveBeenCalledTimes(2);
    });
  });

  describe("sync_meta", () => {
    it("getSyncMeta should return value if row exists", () => {
      mockGetFirstSync.mockReturnValue({ value: "scan-123" });
      const val = getSyncMeta("lastScan");
      expect(mockGetFirstSync).toHaveBeenCalledWith(
        "SELECT value FROM sync_meta WHERE key = ?",
        ["lastScan"],
      );
      expect(val).toBe("scan-123");
    });

    it("getSyncMeta should return null if row does not exist", () => {
      mockGetFirstSync.mockReturnValue(null);
      const val = getSyncMeta("missingKey");
      expect(val).toBeNull();
    });

    it("setSyncMeta should insert or update key-value pair", () => {
      setSyncMeta("lastScan", "scan-456");
      expect(mockRunSync).toHaveBeenCalledWith(
        "INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        ["lastScan", "scan-456"],
      );
    });
  });

  describe("upsertArtistsBatch", () => {
    it("should return early if empty array provided", () => {
      upsertArtistsBatch([]);
      expect(mockWithTransactionSync).not.toHaveBeenCalled();
    });

    it("should execute statement for each artist and finalize statement", () => {
      const artists: ArtistID3[] = [
        {
          id: "art-1",
          name: "Artist One",
          coverArt: "cover-1",
          artistImageUrl: "img-1",
          albumCount: 2,
          starred: "2026-01-01",
          userRating: 5,
          musicBrainzId: "mbid-1",
          sortName: "One, Artist",
          roles: ["Main"],
        },
        {
          id: "art-2",
          name: "Artist Two",
        },
      ];

      upsertArtistsBatch(artists);

      expect(mockWithTransactionSync).toHaveBeenCalledTimes(1);
      expect(mockPrepareSync).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO artists"),
      );
      expect(mockStmt.executeSync).toHaveBeenCalledTimes(2);
      expect(mockStmt.executeSync).toHaveBeenNthCalledWith(1, [
        "art-1",
        "Artist One",
        "cover-1",
        "img-1",
        2,
        "2026-01-01",
        5,
        "mbid-1",
        "One, Artist",
        JSON.stringify(["Main"]),
      ]);
      expect(mockStmt.executeSync).toHaveBeenNthCalledWith(2, [
        "art-2",
        "Artist Two",
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ]);
      expect(mockStmt.finalizeSync).toHaveBeenCalledTimes(1);
    });
  });

  describe("upsertAlbumsBatch", () => {
    it("should return early if empty array provided", () => {
      upsertAlbumsBatch([]);
      expect(mockWithTransactionSync).not.toHaveBeenCalled();
    });

    it("should execute statement for each album with parsed json fields and finalize", () => {
      const albums: AlbumID3[] = [
        {
          id: "alb-1",
          name: "Album One",
          artist: "Artist One",
          artistId: "art-1",
          coverArt: "cov-1",
          songCount: 10,
          duration: 3600,
          playCount: 15,
          created: "2026-01-01",
          played: "2026-01-02",
          starred: "2026-01-03",
          year: 2026,
          genre: "Rock",
          genres: [{ name: "Rock" }],
          userRating: 4,
          musicBrainzId: "mb-alb-1",
          isCompilation: true,
          sortName: "One, Album",
          originalReleaseDate: { year: 2025, month: 12, day: 25 },
          releaseDate: { year: 2026, month: 1, day: 1 },
          releaseTypes: ["Album"],
          recordLabels: [{ name: "Record Co" }],
          artists: [{ id: "art-1", name: "Artist One" }],
          displayArtist: "Artist One",
          explicitStatus: "clean",
          version: "Deluxe",
        },
        {
          id: "alb-2",
          name: "Album Two",
        },
      ];

      upsertAlbumsBatch(albums);

      expect(mockWithTransactionSync).toHaveBeenCalledTimes(1);
      expect(mockPrepareSync).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO albums"),
      );
      expect(mockStmt.executeSync).toHaveBeenCalledTimes(2);
      expect(mockStmt.executeSync).toHaveBeenNthCalledWith(
        1,
        expect.arrayContaining([
          "alb-1",
          "Album One",
          "Artist One",
          "art-1",
          "cov-1",
          10,
          3600,
          15,
          "2026-01-01",
          "2026-01-02",
          "2026-01-03",
          2026,
          "Rock",
          JSON.stringify([{ name: "Rock" }]),
          4,
          "mb-alb-1",
          1,
          "One, Album",
          JSON.stringify({ year: 2025, month: 12, day: 25 }),
          JSON.stringify({ year: 2026, month: 1, day: 1 }),
          JSON.stringify(["Album"]),
          JSON.stringify([{ name: "Record Co" }]),
          JSON.stringify([{ id: "art-1", name: "Artist One" }]),
          "Artist One",
          "clean",
          "Deluxe",
        ]),
      );
      expect(mockStmt.finalizeSync).toHaveBeenCalledTimes(1);
    });
  });

  describe("upsertSongsBatch", () => {
    it("should return early if empty array provided", () => {
      upsertSongsBatch([]);
      expect(mockWithTransactionSync).not.toHaveBeenCalled();
    });

    it("should execute statement for each song and finalize", () => {
      const songs: Child[] = [
        {
          id: "s-1",
          parent: "parent-1",
          isDir: false,
          title: "Song One",
          album: "Album One",
          albumId: "alb-1",
          artist: "Artist One",
          artistId: "art-1",
          track: 1,
          year: 2026,
          genre: "Pop",
          genres: [{ name: "Pop" }],
          coverArt: "art-1",
          size: 1024,
          contentType: "audio/flac",
          suffix: "flac",
          duration: 240,
          bitRate: 1411,
          path: "/music/s1.flac",
          isVideo: false,
          userRating: 5,
          averageRating: 4.8,
          playCount: 12,
          discNumber: 1,
          created: "2026-01-01",
          played: "2026-01-02",
          starred: "2026-01-03",
          type: "music",
          bpm: 120,
          comment: "favorite",
          sortName: "One, Song",
          mediaType: "song",
          musicBrainzId: "mb-s-1",
          isrc: ["US123"],
          channelCount: 2,
          samplingRate: 44100,
          bitDepth: 16,
          artists: [{ id: "art-1", name: "Artist One" }],
          displayArtist: "Artist One",
          albumArtists: [{ id: "art-1", name: "Artist One" }],
          displayAlbumArtist: "Artist One",
          contributors: [{ role: "Producer", artist: { id: "p1", name: "Producer" } }],
          displayComposer: "Composer",
          explicitStatus: "clean",
        },
      ];

      upsertSongsBatch(songs);

      expect(mockWithTransactionSync).toHaveBeenCalledTimes(1);
      expect(mockPrepareSync).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO songs"),
      );
      expect(mockStmt.executeSync).toHaveBeenCalledTimes(1);
      expect(mockStmt.finalizeSync).toHaveBeenCalledTimes(1);
    });
  });

  describe("upsertPlaylistsBatch", () => {
    it("should return early if empty array provided", () => {
      upsertPlaylistsBatch([]);
      expect(mockWithTransactionSync).not.toHaveBeenCalled();
    });

    it("should execute statement for each playlist and finalize", () => {
      const playlists: Playlist[] = [
        {
          id: "pl-1",
          name: "Playlist One",
          comment: "Best tracks",
          owner: "admin",
          public: true,
          songCount: 25,
          duration: 5000,
          created: "2026-01-01",
          changed: "2026-01-02",
          coverArt: "pl-cov-1",
        },
      ];

      upsertPlaylistsBatch(playlists);

      expect(mockWithTransactionSync).toHaveBeenCalledTimes(1);
      expect(mockPrepareSync).toHaveBeenCalledWith(
        expect.stringContaining("INSERT OR REPLACE INTO playlists"),
      );
      expect(mockStmt.executeSync).toHaveBeenCalledWith([
        "pl-1",
        "Playlist One",
        "Best tracks",
        "admin",
        1,
        25,
        5000,
        "2026-01-01",
        "2026-01-02",
        "pl-cov-1",
      ]);
      expect(mockStmt.finalizeSync).toHaveBeenCalledTimes(1);
    });
  });

  describe("getLocalCounts", () => {
    it("should return counts from tables", () => {
      mockGetFirstSync
        .mockReturnValueOnce({ count: 5 })
        .mockReturnValueOnce({ count: 10 })
        .mockReturnValueOnce({ count: 100 })
        .mockReturnValueOnce({ count: 3 });

      const counts = getLocalCounts();
      expect(counts).toEqual({
        artistCount: 5,
        albumCount: 10,
        songCount: 100,
        playlistCount: 3,
      });
    });

    it("should fallback to 0 if count rows are null", () => {
      mockGetFirstSync.mockReturnValue(null);
      const counts = getLocalCounts();
      expect(counts).toEqual({
        artistCount: 0,
        albumCount: 0,
        songCount: 0,
        playlistCount: 0,
      });
    });
  });

  describe("clearDatabase", () => {
    it("should delete records from all tables", () => {
      clearDatabase();
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM artists;"),
      );
    });
  });

  describe("query helpers", () => {
    it("getAllArtists should query artists sorted", () => {
      mockGetAllSync.mockReturnValue([{ id: "art-1", name: "A" }]);
      const res = getAllArtists();
      expect(mockGetAllSync).toHaveBeenCalledWith(
        "SELECT * FROM artists ORDER BY name COLLATE NOCASE ASC",
      );
      expect(res).toHaveLength(1);
    });

    it("getAllAlbums should query albums sorted", () => {
      mockGetAllSync.mockReturnValue([{ id: "alb-1", name: "B" }]);
      const res = getAllAlbums();
      expect(mockGetAllSync).toHaveBeenCalledWith(
        "SELECT * FROM albums ORDER BY name COLLATE NOCASE ASC",
      );
      expect(res).toHaveLength(1);
    });

    it("getAllSongs should query songs sorted", () => {
      mockGetAllSync.mockReturnValue([{ id: "s-1", title: "C" }]);
      const res = getAllSongs();
      expect(mockGetAllSync).toHaveBeenCalledWith(
        "SELECT * FROM songs ORDER BY title COLLATE NOCASE ASC",
      );
      expect(res).toHaveLength(1);
    });

    it("getCachedSongs should query songs joined with song_cache", () => {
      mockGetAllSync.mockReturnValue([{ id: "s-1", title: "C" }]);
      const res = getCachedSongs();
      expect(mockGetAllSync).toHaveBeenCalledWith(
        expect.stringContaining("INNER JOIN song_cache"),
      );
      expect(res).toHaveLength(1);
    });

    it("getAllPlaylists should query playlists sorted", () => {
      mockGetAllSync.mockReturnValue([{ id: "pl-1", name: "D" }]);
      const res = getAllPlaylists();
      expect(mockGetAllSync).toHaveBeenCalledWith(
        "SELECT * FROM playlists ORDER BY name COLLATE NOCASE ASC",
      );
      expect(res).toHaveLength(1);
    });

    it("getPlaylistById should query playlist by id", () => {
      mockGetFirstSync.mockReturnValue({ id: "pl-1", name: "D" });
      const res = getPlaylistById("pl-1");
      expect(mockGetFirstSync).toHaveBeenCalledWith(
        "SELECT * FROM playlists WHERE id = ?",
        ["pl-1"],
      );
      expect(res?.id).toBe("pl-1");
    });

    it("getAlbumById should query album by id", () => {
      mockGetFirstSync.mockReturnValue({ id: "alb-1", name: "Alb" });
      const res = getAlbumById("alb-1");
      expect(mockGetFirstSync).toHaveBeenCalledWith(
        "SELECT * FROM albums WHERE id = ?",
        ["alb-1"],
      );
      expect(res?.id).toBe("alb-1");
    });

    it("getSongsByAlbumId should query songs by albumId", () => {
      mockGetAllSync.mockReturnValue([{ id: "s-1", title: "Track" }]);
      const res = getSongsByAlbumId("alb-1");
      expect(mockGetAllSync).toHaveBeenCalledWith(
        "SELECT * FROM songs WHERE albumId = ? ORDER BY discNumber ASC, track ASC, title COLLATE NOCASE ASC",
        ["alb-1"],
      );
      expect(res).toHaveLength(1);
    });

    it("getSongById should query songs by id", () => {
      mockGetFirstSync.mockReturnValue({ id: "track-1", title: "Song One" });
      const result = getSongById("track-1");
      expect(mockGetFirstSync).toHaveBeenCalledWith(
        "SELECT * FROM songs WHERE id = ?",
        ["track-1"],
      );
      expect(result).toEqual({ id: "track-1", title: "Song One" });
    });

    it("getSongsByIds should return empty array if empty array provided", () => {
      const result = getSongsByIds([]);
      expect(result).toEqual([]);
      expect(mockGetAllSync).not.toHaveBeenCalled();
    });

    it("getSongsByIds should query songs with IN clause", () => {
      const mockSongs = [
        { id: "track-1", title: "Song One" },
        { id: "track-2", title: "Song Two" },
      ];
      mockGetAllSync.mockReturnValue(mockSongs);
      const result = getSongsByIds(["track-1", "track-2"]);
      expect(mockGetAllSync).toHaveBeenCalledWith(
        "SELECT * FROM songs WHERE id IN (?, ?)",
        ["track-1", "track-2"],
      );
      expect(result).toEqual(mockSongs);
    });
  });

  describe("song_cache helpers", () => {
    it("upsertSongCacheEntry should run INSERT OR REPLACE INTO song_cache", () => {
      upsertSongCacheEntry(
        "track-1",
        SongCacheType.Manual,
        "file:///path/to/song.flac",
        123456,
      );
      expect(mockRunSync).toHaveBeenCalledWith(
        expect.stringContaining("INSERT OR REPLACE INTO song_cache"),
        expect.arrayContaining([
          "track-1",
          SongCacheType.Manual,
          "file:///path/to/song.flac",
          123456,
          expect.any(String),
          null,
        ]),
      );
    });

    it("insertSongCacheEntryIfNotExists should insert when entry does not exist", () => {
      mockGetFirstSync.mockReturnValue(null);
      const inserted = insertSongCacheEntryIfNotExists(
        "track-auto-1",
        SongCacheType.Auto,
        "file:///path/to/auto.flac",
        456789,
      );
      expect(inserted).toBe(true);
      expect(mockRunSync).toHaveBeenCalledWith(
        expect.stringContaining("INSERT OR IGNORE INTO song_cache"),
        expect.arrayContaining([
          "track-auto-1",
          SongCacheType.Auto,
          "file:///path/to/auto.flac",
          456789,
          expect.any(String),
          null,
        ]),
      );
    });

    it("insertSongCacheEntryIfNotExists should return false and not insert when entry already exists", () => {
      mockGetFirstSync.mockReturnValue({
        songId: "track-auto-1",
        cacheType: SongCacheType.Manual,
        filePath: "file:///path/to/manual.flac",
        fileSizeBytes: 123456,
        addedAt: "2026-09-06T12:00:00.000Z",
        lastAccessedAt: null,
      });
      const inserted = insertSongCacheEntryIfNotExists(
        "track-auto-1",
        SongCacheType.Auto,
        "file:///path/to/auto.flac",
        456789,
      );
      expect(inserted).toBe(false);
      expect(mockRunSync).not.toHaveBeenCalledWith(
        expect.stringContaining("INSERT OR IGNORE INTO song_cache"),
        expect.anything(),
      );
    });

    it("getSongCacheEntry should query song_cache by songId", () => {
      const mockRow = {
        songId: "track-1",
        cacheType: SongCacheType.Manual,
        filePath: "file:///path/to/song.flac",
        fileSizeBytes: 123456,
        addedAt: "2026-09-06T12:00:00.000Z",
        lastAccessedAt: null,
      };
      mockGetFirstSync.mockReturnValue(mockRow);

      const result = getSongCacheEntry("track-1");
      expect(mockGetFirstSync).toHaveBeenCalledWith(
        "SELECT * FROM song_cache WHERE songId = ?",
        ["track-1"],
      );
      expect(result).toEqual(mockRow);
    });

    it("getSongCacheEntry should return null if not found", () => {
      mockGetFirstSync.mockReturnValue(null);
      const result = getSongCacheEntry("track-nonexistent");
      expect(result).toBeNull();
    });

    it("getAllSongCacheEntries should return map of all rows keyed by songId", () => {
      const mockRows = [
        {
          songId: "track-1",
          cacheType: SongCacheType.Manual,
          filePath: "file:///path/to/song1.flac",
          fileSizeBytes: 1000,
          addedAt: "2026-09-06T12:00:00.000Z",
          lastAccessedAt: null,
        },
        {
          songId: "track-2",
          cacheType: SongCacheType.Auto,
          filePath: "file:///path/to/song2.flac",
          fileSizeBytes: 2000,
          addedAt: "2026-09-06T13:00:00.000Z",
          lastAccessedAt: "2026-09-06T14:00:00.000Z",
        },
      ];
      mockGetAllSync.mockReturnValue(mockRows);

      const result = getAllSongCacheEntries();
      expect(mockGetAllSync).toHaveBeenCalledWith("SELECT * FROM song_cache");
      expect(result.size).toBe(2);
      expect(result.get("track-1")).toEqual(mockRows[0]);
      expect(result.get("track-2")).toEqual(mockRows[1]);
    });

    it("getAllSongCacheEntries should return empty map when table is empty", () => {
      mockGetAllSync.mockReturnValue([]);
      const result = getAllSongCacheEntries();
      expect(result.size).toBe(0);
    });

    it("updateSongCacheLastAccessed should update lastAccessedAt in song_cache", () => {
      updateSongCacheLastAccessed("track-1");
      expect(mockRunSync).toHaveBeenCalledWith(
        "UPDATE song_cache SET lastAccessedAt = ? WHERE songId = ?",
        [expect.any(String), "track-1"],
      );
    });

    it("deleteSongCacheEntry should delete song from song_cache", () => {
      deleteSongCacheEntry("track-1");
      expect(mockRunSync).toHaveBeenCalledWith(
        "DELETE FROM song_cache WHERE songId = ?",
        ["track-1"],
      );
    });

    it("getAutoCacheMaxBytes should return default 1 GiB when no row in sync_meta", () => {
      mockGetFirstSync.mockReturnValue(null);
      const result = getAutoCacheMaxBytes();
      expect(result).toBe(1024 * 1024 * 1024);
    });

    it("getAutoCacheMaxBytes should return parsed bytes when stored in sync_meta", () => {
      mockGetFirstSync.mockReturnValue({ value: "2147483648" });
      const result = getAutoCacheMaxBytes();
      expect(result).toBe(2147483648);
    });

    it("setAutoCacheMaxBytes should insert or replace in sync_meta", () => {
      setAutoCacheMaxBytes(1073741824);
      expect(mockRunSync).toHaveBeenCalledWith(
        "INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('auto_cache_max_bytes', ?)",
        ["1073741824"],
      );
    });

    it("getAutoCacheTotalSize should sum fileSizeBytes for auto cacheType", () => {
      mockGetFirstSync.mockReturnValue({ total: 52428800 });
      const total = getAutoCacheTotalSize();
      expect(mockGetFirstSync).toHaveBeenCalledWith(
        "SELECT SUM(fileSizeBytes) AS total FROM song_cache WHERE cacheType = 'auto'",
      );
      expect(total).toBe(52428800);
    });

    it("getAutoCacheTotalSize should return 0 if sum is null", () => {
      mockGetFirstSync.mockReturnValue({ total: null });
      const total = getAutoCacheTotalSize();
      expect(total).toBe(0);
    });

    it("getLeastRecentlyUsedAutoCacheEntries should query song_cache ordered by lastAccessedAt ASC", () => {
      const mockEntries = [
        {
          songId: "track-old",
          cacheType: SongCacheType.Auto,
          filePath: "file:///path/old.mp3",
          fileSizeBytes: 1000,
          addedAt: "2026-09-01T00:00:00.000Z",
          lastAccessedAt: "2026-09-02T00:00:00.000Z",
        },
      ];
      mockGetAllSync.mockReturnValue(mockEntries);
      const result = getLeastRecentlyUsedAutoCacheEntries(1);
      expect(mockGetAllSync).toHaveBeenCalledWith(
        "SELECT * FROM song_cache WHERE cacheType = 'auto' ORDER BY lastAccessedAt ASC LIMIT ?",
        [1],
      );
      expect(result).toEqual(mockEntries);
    });

    it("getAutoCacheEnabled should return true by default when unset", () => {
      mockGetFirstSync.mockReturnValue(null);
      expect(getAutoCacheEnabled()).toBe(true);
    });

    it("getAutoCacheEnabled should return false when set to 'false'", () => {
      mockGetFirstSync.mockReturnValue({ value: "false" });
      expect(getAutoCacheEnabled()).toBe(false);
    });

    it("getAutoCacheEnabled should return true when set to 'true'", () => {
      mockGetFirstSync.mockReturnValue({ value: "true" });
      expect(getAutoCacheEnabled()).toBe(true);
    });

    it("setAutoCacheEnabled should insert or replace in sync_meta", () => {
      setAutoCacheEnabled(false);
      expect(mockRunSync).toHaveBeenCalledWith(
        "INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('auto_cache_enabled', ?)",
        ["false"],
      );
    });

    it("deleteAutoSongCacheEntries should delete auto cache rows", () => {
      deleteAutoSongCacheEntries();
      expect(mockRunSync).toHaveBeenCalledWith(
        "DELETE FROM song_cache WHERE cacheType = 'auto'",
      );
    });

    it("getAutoCacheSongIds should return list of auto-cached songIds", () => {
      mockGetAllSync.mockReturnValue([
        { songId: "auto-1" },
        { songId: "auto-2" },
      ]);
      const ids = getAutoCacheSongIds();
      expect(mockGetAllSync).toHaveBeenCalledWith(
        "SELECT songId FROM song_cache WHERE cacheType = 'auto'",
      );
      expect(ids).toEqual(["auto-1", "auto-2"]);
    });

    it("getAutoCacheCount should return count of auto-cached rows", () => {
      mockGetFirstSync.mockReturnValue({ count: 5 });
      const count = getAutoCacheCount();
      expect(mockGetFirstSync).toHaveBeenCalledWith(
        "SELECT COUNT(*) AS count FROM song_cache WHERE cacheType = 'auto'",
      );
      expect(count).toBe(5);
    });
  });

  describe("scrobble settings", () => {
    it("getScrobbleMinDuration should return default when not set", () => {
      mockGetFirstSync.mockReturnValue(null);
      expect(getScrobbleMinDuration()).toBe(240);
    });

    it("getScrobbleMinDuration should return parsed value if >= 10", () => {
      mockGetFirstSync.mockReturnValue({ value: "180" });
      expect(getScrobbleMinDuration()).toBe(180);
    });

    it("getScrobbleMinDuration should return default if value < 10 or invalid", () => {
      mockGetFirstSync.mockReturnValue({ value: "5" });
      expect(getScrobbleMinDuration()).toBe(240);
      mockGetFirstSync.mockReturnValue({ value: "abc" });
      expect(getScrobbleMinDuration()).toBe(240);
    });

    it("setScrobbleMinDuration should clamp to minimum 10 seconds", () => {
      setScrobbleMinDuration(300);
      expect(mockRunSync).toHaveBeenCalledWith(
        "INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        ["scrobble_min_duration", "300"],
      );
      setScrobbleMinDuration(3);
      expect(mockRunSync).toHaveBeenCalledWith(
        "INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        ["scrobble_min_duration", "10"],
      );
    });

    it("getScrobbleMinPercent should return default when not set", () => {
      mockGetFirstSync.mockReturnValue(null);
      expect(getScrobbleMinPercent()).toBe(75);
    });

    it("getScrobbleMinPercent should return parsed value if between 5 and 100", () => {
      mockGetFirstSync.mockReturnValue({ value: "50" });
      expect(getScrobbleMinPercent()).toBe(50);
    });

    it("getScrobbleMinPercent should return default if value < 5 or > 100", () => {
      mockGetFirstSync.mockReturnValue({ value: "2" });
      expect(getScrobbleMinPercent()).toBe(75);
      mockGetFirstSync.mockReturnValue({ value: "120" });
      expect(getScrobbleMinPercent()).toBe(75);
    });

    it("setScrobbleMinPercent should clamp between 5 and 100", () => {
      setScrobbleMinPercent(80);
      expect(mockRunSync).toHaveBeenCalledWith(
        "INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        ["scrobble_min_percent", "80"],
      );
      setScrobbleMinPercent(2);
      expect(mockRunSync).toHaveBeenCalledWith(
        "INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        ["scrobble_min_percent", "5"],
      );
      setScrobbleMinPercent(150);
      expect(mockRunSync).toHaveBeenCalledWith(
        "INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        ["scrobble_min_percent", "100"],
      );
    });

    it("getKeepPlayingOnAppDismissed should return false by default", () => {
      mockGetFirstSync.mockReturnValue(null);
      expect(getKeepPlayingOnAppDismissed()).toBe(false);
    });

    it("getKeepPlayingOnAppDismissed should return true when set to 'true'", () => {
      mockGetFirstSync.mockReturnValue({ value: "true" });
      expect(getKeepPlayingOnAppDismissed()).toBe(true);
    });

    it("getKeepPlayingOnAppDismissed should return false when set to 'false'", () => {
      mockGetFirstSync.mockReturnValue({ value: "false" });
      expect(getKeepPlayingOnAppDismissed()).toBe(false);
    });

    it("setKeepPlayingOnAppDismissed should store boolean string in sync_meta", () => {
      setKeepPlayingOnAppDismissed(true);
      expect(mockRunSync).toHaveBeenCalledWith(
        "INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        ["keep_playing_on_app_dismissed", "true"],
      );
      setKeepPlayingOnAppDismissed(false);
      expect(mockRunSync).toHaveBeenCalledWith(
        "INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        ["keep_playing_on_app_dismissed", "false"],
      );
    });
  });

  describe("player_session", () => {
    const mockSession: PersistedPlayerSession = {
      queue: [
        {
          id: "song-1",
          title: "Song 1",
          artist: "Artist 1",
          album: "Album 1",
          coverArt: "art-1",
          duration: 180,
        },
      ],
      currentIndex: 0,
      position: 42,
      repeatMode: "all",
      updatedAt: "2026-09-19T00:00:00.000Z",
    };

    it("savePlayerSession should insert/update player session row", () => {
      savePlayerSession(mockSession);
      expect(mockRunSync).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO player_session"),
        [
          JSON.stringify(mockSession.queue),
          0,
          42,
          "all",
          "2026-09-19T00:00:00.000Z",
        ],
      );
    });

    it("getPlayerSession should return null when row does not exist", () => {
      mockGetFirstSync.mockReturnValue(null);
      const result = getPlayerSession();
      expect(result).toBeNull();
      expect(mockGetFirstSync).toHaveBeenCalledWith(
        expect.stringContaining("SELECT queueJson, currentIndex, position, repeatMode, updatedAt FROM player_session WHERE id = 1"),
      );
    });

    it("getPlayerSession should parse and return saved session", () => {
      mockGetFirstSync.mockReturnValue({
        queueJson: JSON.stringify(mockSession.queue),
        currentIndex: 0,
        position: 42,
        repeatMode: "all",
        updatedAt: "2026-09-19T00:00:00.000Z",
      });

      const result = getPlayerSession();
      expect(result).toEqual(mockSession);
    });

    it("getPlayerSession should default repeatMode to off if unknown", () => {
      mockGetFirstSync.mockReturnValue({
        queueJson: JSON.stringify(mockSession.queue),
        currentIndex: 0,
        position: 42,
        repeatMode: "invalid_mode",
        updatedAt: "2026-09-19T00:00:00.000Z",
      });

      const result = getPlayerSession();
      expect(result?.repeatMode).toBe("off");
    });

    it("getPlayerSession should return null and catch JSON parse error on corrupted queueJson", () => {
      const spyError = jest.spyOn(console, "error").mockImplementation(() => {});
      mockGetFirstSync.mockReturnValue({
        queueJson: "{corrupted json",
        currentIndex: 0,
        position: 0,
        repeatMode: "off",
        updatedAt: "2026-09-19T00:00:00.000Z",
      });

      const result = getPlayerSession();
      expect(result).toBeNull();
      expect(spyError).toHaveBeenCalled();
      spyError.mockRestore();
    });

    it("clearPlayerSession should delete session row", () => {
      clearPlayerSession();
      expect(mockRunSync).toHaveBeenCalledWith("DELETE FROM player_session WHERE id = 1");
    });
  });
});
