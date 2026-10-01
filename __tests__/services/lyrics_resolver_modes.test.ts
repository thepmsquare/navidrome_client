import {
  getCachedLyricsSync,
  resetLyricsMode,
  resolveLyricsForSong,
  setLyricsMode,
} from "@/services/lyrics";
import { getLyricsBySongId } from "@/services/api";
import {
  getLyricsCacheEntrySync,
  getSongById,
  upsertLyricsCacheEntry,
} from "@/services/db";
import { fetchLyricsFromLrclib } from "@/services/lrclib";
import { LyricsCacheRow } from "@/types";

jest.mock("@/services/api", () => ({
  getLyricsBySongId: jest.fn(),
}));

jest.mock("@/services/lrclib", () => ({
  fetchLyricsFromLrclib: jest.fn(),
}));

jest.mock("@/services/db", () => ({
  getDb: jest.fn(),
  getLyricsCacheEntrySync: jest.fn(),
  getLyricsModeSetting: jest.fn(() => "file_only"),
  getSongById: jest.fn(),
  setLyricsModeSetting: jest.fn(),
  upsertLyricsCacheEntry: jest.fn(),
}));

describe("lyrics resolver across modes", () => {
  const syncedLrc = {
    synced: true,
    lines: [{ startMs: 500, text: "synced line" }],
  };

  const unsyncedLrc = {
    synced: false,
    lines: [{ text: "unsynced line" }],
  };

  beforeEach(() => {
    resetLyricsMode();
    jest.clearAllMocks();
  });

  describe("file_only mode", () => {
    it("should NEVER call LRCLIB, even when server has no lyrics", async () => {
      setLyricsMode("file_only");
      (getLyricsCacheEntrySync as jest.Mock).mockReturnValue(null);
      (getLyricsBySongId as jest.Mock).mockResolvedValue([]);

      const result = await resolveLyricsForSong("song-1", {
        title: "Track",
        duration: 200,
      });

      expect(result).toBeNull();
      expect(getLyricsBySongId).toHaveBeenCalledWith("song-1");
      expect(fetchLyricsFromLrclib).not.toHaveBeenCalled();
    });

    it("should return server lyrics when found without calling LRCLIB", async () => {
      setLyricsMode("file_only");
      (getLyricsCacheEntrySync as jest.Mock).mockReturnValue(null);
      (getLyricsBySongId as jest.Mock).mockResolvedValue([
        { synced: false, line: [{ value: "server unsynced" }] },
      ]);

      const result = await resolveLyricsForSong("song-2", {
        title: "Track 2",
        duration: 200,
      });

      expect(result?.synced).toBe(false);
      expect(fetchLyricsFromLrclib).not.toHaveBeenCalled();
    });
  });

  describe("file_first mode", () => {
    beforeEach(() => {
      setLyricsMode("file_first");
    });

    it("should NOT call LRCLIB if server has synced lyrics", async () => {
      (getLyricsCacheEntrySync as jest.Mock).mockReturnValue(null);
      (getLyricsBySongId as jest.Mock).mockResolvedValue([
        { synced: true, line: [{ start: 1000, value: "server synced" }] },
      ]);

      const result = await resolveLyricsForSong("song-synced", {
        title: "Track",
        duration: 200,
      });

      expect(result?.synced).toBe(true);
      expect(fetchLyricsFromLrclib).not.toHaveBeenCalled();
    });

    it("should call LRCLIB when server has unsynced lyrics and upgrade to online synced", async () => {
      (getLyricsCacheEntrySync as jest.Mock).mockReturnValue(null);
      (getLyricsBySongId as jest.Mock).mockResolvedValue([
        { synced: false, line: [{ value: "server plain" }] },
      ]);
      (fetchLyricsFromLrclib as jest.Mock).mockResolvedValue({
        kind: "found",
        lyrics: syncedLrc,
      });

      const onUpgrade = jest.fn();
      const result = await resolveLyricsForSong(
        "song-upgrade",
        { title: "Track", duration: 200 },
        { onUpgrade },
      );

      expect(fetchLyricsFromLrclib).toHaveBeenCalled();
      expect(result).toEqual(syncedLrc);
      expect(onUpgrade).toHaveBeenCalled();
      expect(upsertLyricsCacheEntry).toHaveBeenCalledWith(
        expect.objectContaining({ source: "lrclib", status: "found" }),
      );
    });

    it("should keep server unsynced lyrics if LRCLIB returns only plain text", async () => {
      (getLyricsCacheEntrySync as jest.Mock).mockReturnValue(null);
      (getLyricsBySongId as jest.Mock).mockResolvedValue([
        { synced: false, line: [{ value: "server plain" }] },
      ]);
      (fetchLyricsFromLrclib as jest.Mock).mockResolvedValue({
        kind: "found",
        lyrics: { synced: false, lines: [{ text: "online plain" }] },
      });

      const result = await resolveLyricsForSong("song-keep-server", {
        title: "Track",
        duration: 200,
      });

      expect(result?.lines).toEqual([{ text: "server plain" }]);
    });

    it("should use LRCLIB lyrics when server has no lyrics", async () => {
      (getLyricsCacheEntrySync as jest.Mock).mockReturnValue(null);
      (getLyricsBySongId as jest.Mock).mockResolvedValue([]);
      (fetchLyricsFromLrclib as jest.Mock).mockResolvedValue({
        kind: "found",
        lyrics: syncedLrc,
      });

      const result = await resolveLyricsForSong("song-no-server", {
        title: "Track",
        duration: 200,
      });

      expect(result).toEqual(syncedLrc);
    });
  });

  describe("online_first mode", () => {
    beforeEach(() => {
      setLyricsMode("online_first");
    });

    it("prefers online lyrics over server lyrics", async () => {
      (getLyricsCacheEntrySync as jest.Mock).mockReturnValue(null);
      (fetchLyricsFromLrclib as jest.Mock).mockResolvedValue({
        kind: "found",
        lyrics: syncedLrc,
      });

      const result = await resolveLyricsForSong("song-online-first", {
        title: "Track",
        duration: 200,
      });

      expect(result).toEqual(syncedLrc);
      // Server is not even fetched when online succeeds
      expect(getLyricsBySongId).not.toHaveBeenCalled();
    });

    it("falls back to server lyrics when online returns none", async () => {
      (getLyricsCacheEntrySync as jest.Mock).mockReturnValue(null);
      (fetchLyricsFromLrclib as jest.Mock).mockResolvedValue({
        kind: "none",
      });
      (getLyricsBySongId as jest.Mock).mockResolvedValue([
        { synced: false, line: [{ value: "server backup" }] },
      ]);

      const result = await resolveLyricsForSong("song-online-none", {
        title: "Track",
        duration: 200,
      });

      expect(result?.lines).toEqual([{ text: "server backup" }]);
    });

    it("returns null when online returns instrumental", async () => {
      (getLyricsCacheEntrySync as jest.Mock).mockReturnValue(null);
      (fetchLyricsFromLrclib as jest.Mock).mockResolvedValue({
        kind: "instrumental",
      });

      const result = await resolveLyricsForSong("song-instrumental", {
        title: "Track",
        duration: 200,
      });

      expect(result).toBeNull();
      expect(getLyricsBySongId).not.toHaveBeenCalled();
      expect(upsertLyricsCacheEntry).toHaveBeenCalledWith(
        expect.objectContaining({ source: "lrclib", status: "instrumental" }),
      );
    });
  });

  describe("missing / unreliable duration check", () => {
    it("skips LRCLIB lookup entirely when duration is missing, 0, or NaN", async () => {
      setLyricsMode("file_first");
      (getLyricsCacheEntrySync as jest.Mock).mockReturnValue(null);
      (getLyricsBySongId as jest.Mock).mockResolvedValue([]);
      (getSongById as jest.Mock).mockReturnValue(null);

      // Duration undefined
      await resolveLyricsForSong("song-no-dur", {
        title: "Track",
        duration: undefined,
      });
      expect(fetchLyricsFromLrclib).not.toHaveBeenCalled();

      // Duration 0
      await resolveLyricsForSong("song-zero-dur", {
        title: "Track",
        duration: 0,
      });
      expect(fetchLyricsFromLrclib).not.toHaveBeenCalled();

      // Duration NaN
      await resolveLyricsForSong("song-nan-dur", {
        title: "Track",
        duration: NaN,
      });
      expect(fetchLyricsFromLrclib).not.toHaveBeenCalled();
    });

    it("prefers track's own duration over 0 live duration", async () => {
      setLyricsMode("file_first");
      (getLyricsCacheEntrySync as jest.Mock).mockReturnValue(null);
      (getLyricsBySongId as jest.Mock).mockResolvedValue([]);
      // songs table has duration 180
      (getSongById as jest.Mock).mockReturnValue({
        id: "song-table-dur",
        title: "Table Song",
        duration: 180,
      });
      (fetchLyricsFromLrclib as jest.Mock).mockResolvedValue({ kind: "none" });

      await resolveLyricsForSong("song-table-dur", {
        title: "Table Song",
        duration: 0, // live player duration is 0
      });

      expect(fetchLyricsFromLrclib).toHaveBeenCalledWith(
        expect.objectContaining({ duration: 180 }),
      );
    });

    it("should write found to lyrics_cache when online lookup succeeds (get 404 then search match)", async () => {
      setLyricsMode("online_first");
      (getLyricsCacheEntrySync as jest.Mock).mockReturnValue(null);
      (fetchLyricsFromLrclib as jest.Mock).mockResolvedValue({
        kind: "found",
        lyrics: syncedLrc,
      });

      const result = await resolveLyricsForSong("song-search-match", {
        title: "Search Match",
        duration: 200,
      });

      expect(result).toEqual(syncedLrc);
      expect(upsertLyricsCacheEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          songId: "song-search-match",
          source: "lrclib",
          status: "found",
          synced: true,
        }),
      );
    });

    it("should write none to lyrics_cache when get 404 and search has only out-of-tolerance durations", async () => {
      setLyricsMode("online_first");
      (getLyricsCacheEntrySync as jest.Mock).mockReturnValue(null);
      (fetchLyricsFromLrclib as jest.Mock).mockResolvedValue({
        kind: "none",
      });
      (getLyricsBySongId as jest.Mock).mockResolvedValue([]);

      const result = await resolveLyricsForSong("song-search-none", {
        title: "Search Out of Tolerance",
        duration: 200,
      });

      expect(result).toBeNull();
      expect(upsertLyricsCacheEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          songId: "song-search-none",
          source: "lrclib",
          status: "none",
        }),
      );
    });

    it("should NOT write to lyrics_cache when online search fails (unavailable, not cached)", async () => {
      setLyricsMode("online_first");
      (getLyricsCacheEntrySync as jest.Mock).mockReturnValue(null);
      (fetchLyricsFromLrclib as jest.Mock).mockResolvedValue({
        kind: "unavailable",
      });
      (getLyricsBySongId as jest.Mock).mockResolvedValue([]);

      const result = await resolveLyricsForSong("song-search-unavailable", {
        title: "Search Unavailable",
        duration: 200,
      });

      expect(result).toBeNull();
      expect(upsertLyricsCacheEntry).not.toHaveBeenCalledWith(
        expect.objectContaining({
          source: "lrclib",
        }),
      );
    });
  });

  describe("getCachedLyricsSync with mode", () => {
    it("returns null in file_only when only lrclib is cached", () => {
      (getLyricsCacheEntrySync as jest.Mock).mockImplementation(
        (songId, source) => {
          if (source === "lrclib") {
            return {
              songId,
              source: "lrclib",
              status: "found",
              synced: 1,
              linesJson: JSON.stringify(syncedLrc.lines),
            };
          }
          return null;
        },
      );

      expect(getCachedLyricsSync("song-1", "file_only")).toBeNull();
    });

    it("returns online synced in file_first when server has unsynced and online has synced", () => {
      (getLyricsCacheEntrySync as jest.Mock).mockImplementation(
        (songId, source) => {
          if (source === "server") {
            return {
              songId,
              source: "server",
              status: "found",
              synced: 0,
              linesJson: JSON.stringify(unsyncedLrc.lines),
            };
          }
          if (source === "lrclib") {
            return {
              songId,
              source: "lrclib",
              status: "found",
              synced: 1,
              linesJson: JSON.stringify(syncedLrc.lines),
            };
          }
          return null;
        },
      );

      const result = getCachedLyricsSync("song-1", "file_first");
      expect(result?.synced).toBe(true);
      expect(result?.lines).toEqual(syncedLrc.lines);
    });
  });
});
