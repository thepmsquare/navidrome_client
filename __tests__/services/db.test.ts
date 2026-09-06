import {
  getSongById,
  getSongCacheEntry,
  upsertSongCacheEntry,
} from "@/services/db";
import { SongCacheType } from "@/types";

const mockGetFirstSync = jest.fn();
const mockRunSync = jest.fn();

jest.mock("expo-sqlite", () => ({
  openDatabaseSync: jest.fn(() => ({
    execSync: jest.fn(),
    getFirstSync: mockGetFirstSync,
    runSync: mockRunSync,
  })),
}));

describe("db song_cache and song helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getSongById", () => {
    it("should query songs by id", () => {
      mockGetFirstSync.mockReturnValue({ id: "track-1", title: "Song One" });
      const result = getSongById("track-1");
      expect(mockGetFirstSync).toHaveBeenCalledWith(
        "SELECT * FROM songs WHERE id = ?",
        ["track-1"],
      );
      expect(result).toEqual({ id: "track-1", title: "Song One" });
    });
  });

  describe("upsertSongCacheEntry", () => {
    it("should run INSERT OR REPLACE INTO song_cache", () => {
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
  });

  describe("getSongCacheEntry", () => {
    it("should query song_cache by songId", () => {
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

    it("should return null if not found", () => {
      mockGetFirstSync.mockReturnValue(null);
      const result = getSongCacheEntry("track-nonexistent");
      expect(result).toBeNull();
    });
  });
});
