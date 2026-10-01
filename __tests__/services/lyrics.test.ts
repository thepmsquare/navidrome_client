import { getLyricsBySongId } from "@/services/api";
import {
  getLyricsCacheEntrySync,
  upsertLyricsCacheEntry,
} from "@/services/db";
import {
  fetchLyricsForSong,
  getCachedLyricsSync,
  getCurrentLyricsLineIndex,
  normalizeLyricsEntry,
  resolveLyricsForSong,
  selectBestLyrics,
} from "@/services/lyrics";
import { LyricsCacheRow, StructuredLyrics } from "@/types";

jest.mock("@/services/api", () => ({
  getLyricsBySongId: jest.fn(),
}));

jest.mock("@/services/db", () => ({
  getLyricsCacheEntrySync: jest.fn(),
  upsertLyricsCacheEntry: jest.fn(),
  deleteLyricsCacheForSong: jest.fn(),
  clearLyricsCache: jest.fn(),
  getLyricsModeSetting: jest.fn(() => "file_only"),
  setLyricsModeSetting: jest.fn(),
  getSongById: jest.fn(),
}));

describe("services/lyrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("normalizeLyricsEntry", () => {
    it("should normalize a synced entry with timestamps and offset", () => {
      const entry: StructuredLyrics = {
        lang: "eng",
        synced: true,
        offset: 200,
        line: [
          { start: 1000, value: "hello world" },
          { start: 2500, value: "second line" },
        ],
      };

      const normalized = normalizeLyricsEntry(entry);
      expect(normalized).toEqual({
        synced: true,
        lang: "eng",
        offsetMs: 200,
        lines: [
          { startMs: 1000, text: "hello world" },
          { startMs: 2500, text: "second line" },
        ],
      });
    });

    it("should normalize an unsynced entry without timestamps", () => {
      const entry: StructuredLyrics = {
        lang: "spa",
        synced: false,
        line: [
          { start: null, value: "hola mundo" },
          { value: "segunda linea" },
        ],
      };

      const normalized = normalizeLyricsEntry(entry);
      expect(normalized).toEqual({
        synced: false,
        lang: "spa",
        lines: [
          { text: "hola mundo" },
          { text: "segunda linea" },
        ],
      });
    });

    it("should handle null or undefined fields gracefully", () => {
      const entry: StructuredLyrics = {
        synced: null,
        line: null,
      };

      const normalized = normalizeLyricsEntry(entry);
      expect(normalized).toEqual({
        synced: false,
        lines: [],
      });
    });
  });

  describe("selectBestLyrics", () => {
    it("should return null for empty or null array", () => {
      expect(selectBestLyrics([])).toBeNull();
      expect(selectBestLyrics(null as any)).toBeNull();
      expect(selectBestLyrics(undefined as any)).toBeNull();
    });

    it("should return null if all entries have no lines", () => {
      const entries: StructuredLyrics[] = [
        { synced: true, line: [] },
        { synced: false, line: null },
      ];
      expect(selectBestLyrics(entries)).toBeNull();
    });

    it("should prefer a synced entry over an unsynced entry", () => {
      const unsynced: StructuredLyrics = {
        synced: false,
        lang: "eng",
        line: [{ value: "plain line 1" }, { value: "plain line 2" }],
      };
      const synced: StructuredLyrics = {
        synced: true,
        lang: "eng",
        line: [
          { start: 500, value: "synced line 1" },
          { start: 1500, value: "synced line 2" },
        ],
      };

      const result = selectBestLyrics([unsynced, synced]);
      expect(result).not.toBeNull();
      expect(result?.synced).toBe(true);
      expect(result?.lines[0].text).toBe("synced line 1");
      expect(result?.lines[0].startMs).toBe(500);
    });

    it("should return the unsynced entry if no synced entry is present", () => {
      const unsynced: StructuredLyrics = {
        synced: false,
        lang: "eng",
        line: [{ value: "only unsynced" }],
      };

      const result = selectBestLyrics([unsynced]);
      expect(result).not.toBeNull();
      expect(result?.synced).toBe(false);
      expect(result?.lines[0].text).toBe("only unsynced");
    });

    it("should pick the first synced entry when multiple synced entries exist", () => {
      const synced1: StructuredLyrics = {
        synced: true,
        lang: "eng",
        line: [{ start: 100, value: "synced 1" }],
      };
      const synced2: StructuredLyrics = {
        synced: true,
        lang: "spa",
        line: [{ start: 200, value: "synced 2" }],
      };

      const result = selectBestLyrics([synced1, synced2]);
      expect(result?.lang).toBe("eng");
      expect(result?.lines[0].text).toBe("synced 1");
    });
  });

  describe("fetchLyricsForSong", () => {
    it("should return null for empty songId", async () => {
      expect(await fetchLyricsForSong("")).toBeNull();
      expect(await fetchLyricsForSong("   ")).toBeNull();
    });

    it("should fetch and select best lyrics successfully", async () => {
      (getLyricsBySongId as jest.Mock).mockResolvedValue([
        {
          synced: true,
          line: [{ start: 1000, value: "first line" }],
        },
      ]);

      const result = await fetchLyricsForSong("song-123");
      expect(getLyricsBySongId).toHaveBeenCalledWith("song-123");
      expect(result).toEqual({
        synced: true,
        lines: [{ startMs: 1000, text: "first line" }],
      });
    });

    it("should return null silently if getLyricsBySongId returns empty array", async () => {
      (getLyricsBySongId as jest.Mock).mockResolvedValue([]);
      const result = await fetchLyricsForSong("song-456");
      expect(result).toBeNull();
    });

    it("should return null silently if getLyricsBySongId throws an error", async () => {
      (getLyricsBySongId as jest.Mock).mockRejectedValue(new Error("Network failed"));
      const result = await fetchLyricsForSong("song-789");
      expect(result).toBeNull();
    });
  });

  describe("getCurrentLyricsLineIndex", () => {
    const lines = [
      { startMs: 1000, text: "first line" },
      { startMs: 3000, text: "second line" },
      { startMs: 5000, text: "   " }, // blank line
      { startMs: 7000, text: "fourth line" },
    ];

    it("should return -1 for empty lines array", () => {
      expect(getCurrentLyricsLineIndex([], 2000)).toBe(-1);
    });

    it("should return -1 before the first timestamp", () => {
      expect(getCurrentLyricsLineIndex(lines, 0)).toBe(-1);
      expect(getCurrentLyricsLineIndex(lines, 999)).toBe(-1);
    });

    it("should return 0 on the exact boundary of the first line", () => {
      expect(getCurrentLyricsLineIndex(lines, 1000)).toBe(0);
    });

    it("should return the current line between timestamps", () => {
      expect(getCurrentLyricsLineIndex(lines, 1500)).toBe(0);
      expect(getCurrentLyricsLineIndex(lines, 2999)).toBe(0);
      expect(getCurrentLyricsLineIndex(lines, 3000)).toBe(1);
      expect(getCurrentLyricsLineIndex(lines, 4500)).toBe(1);
    });

    it("should return the last line after the last timestamp", () => {
      expect(getCurrentLyricsLineIndex(lines, 7000)).toBe(3);
      expect(getCurrentLyricsLineIndex(lines, 100000)).toBe(3);
    });

    it("should apply positive offset correctly (shifts lyrics earlier)", () => {
      // Line 0 starts at 1000ms. With +200ms offset, at 800ms effective time is 1000ms -> line 0
      expect(getCurrentLyricsLineIndex(lines, 799, 200)).toBe(-1);
      expect(getCurrentLyricsLineIndex(lines, 800, 200)).toBe(0);
    });

    it("should apply negative offset correctly (delays lyrics)", () => {
      // Line 0 starts at 1000ms. With -200ms offset, at 1000ms effective time is 800ms -> -1
      expect(getCurrentLyricsLineIndex(lines, 1000, -200)).toBe(-1);
      expect(getCurrentLyricsLineIndex(lines, 1200, -200)).toBe(0);
    });

    it("should keep previous non-blank line highlighted when landing on a blank line", () => {
      // Line 2 (5000ms) is blank "   ". Line 1 (3000ms) is "second line".
      expect(getCurrentLyricsLineIndex(lines, 5000)).toBe(1);
      expect(getCurrentLyricsLineIndex(lines, 6500)).toBe(1);
      // Once line 3 (7000ms) begins:
      expect(getCurrentLyricsLineIndex(lines, 7000)).toBe(3);
    });

    it("should return -1 if candidate is blank and all preceding lines are blank", () => {
      const introBlankLines = [
        { startMs: 0, text: "" },
        { startMs: 500, text: "   " },
        { startMs: 2000, text: "actual vocal" },
      ];
      expect(getCurrentLyricsLineIndex(introBlankLines, 200)).toBe(-1);
      expect(getCurrentLyricsLineIndex(introBlankLines, 1000)).toBe(-1);
      expect(getCurrentLyricsLineIndex(introBlankLines, 2000)).toBe(2);
    });
  });

  describe("getCachedLyricsSync", () => {
    it("should return null if songId is null or empty", () => {
      expect(getCachedLyricsSync(null)).toBeNull();
      expect(getCachedLyricsSync("")).toBeNull();
      expect(getCachedLyricsSync("   ")).toBeNull();
    });

    it("should return null if not in cache or status is not found", () => {
      (getLyricsCacheEntrySync as jest.Mock).mockReturnValue(null);
      expect(getCachedLyricsSync("song-1")).toBeNull();

      (getLyricsCacheEntrySync as jest.Mock).mockReturnValue({
        songId: "song-1",
        source: "server",
        status: "none",
        synced: 0,
        lang: null,
        offsetMs: null,
        linesJson: null,
        fetchedAt: Date.now(),
      });
      expect(getCachedLyricsSync("song-1")).toBeNull();
    });

    it("should parse and return NormalizedLyrics if found in cache", () => {
      const mockRow: LyricsCacheRow = {
        songId: "song-1",
        source: "server",
        status: "found",
        synced: 1,
        lang: "eng",
        offsetMs: 150,
        linesJson: JSON.stringify([
          { startMs: 1000, text: "cached line 1" },
          { startMs: 2000, text: "cached line 2" },
        ]),
        fetchedAt: Date.now(),
      };
      (getLyricsCacheEntrySync as jest.Mock).mockReturnValue(mockRow);

      const result = getCachedLyricsSync("song-1");
      expect(result).toEqual({
        synced: true,
        lang: "eng",
        offsetMs: 150,
        lines: [
          { startMs: 1000, text: "cached line 1" },
          { startMs: 2000, text: "cached line 2" },
        ],
      });
    });

    it("should return null if linesJson is invalid JSON", () => {
      (getLyricsCacheEntrySync as jest.Mock).mockReturnValue({
        songId: "song-1",
        source: "server",
        status: "found",
        synced: 1,
        lang: null,
        offsetMs: null,
        linesJson: "{invalid-json",
        fetchedAt: Date.now(),
      });
      expect(getCachedLyricsSync("song-1")).toBeNull();
    });
  });

  describe("resolveLyricsForSong", () => {
    it("should return null for invalid songId without db or network calls", async () => {
      const result = await resolveLyricsForSong("");
      expect(result).toBeNull();
      expect(getLyricsCacheEntrySync).not.toHaveBeenCalled();
      expect(getLyricsBySongId).not.toHaveBeenCalled();
    });

    it("should return cached lyrics immediately on cache hit ('found') without network", async () => {
      const mockRow: LyricsCacheRow = {
        songId: "song-cached",
        source: "server",
        status: "found",
        synced: 1,
        lang: "fra",
        offsetMs: 50,
        linesJson: JSON.stringify([{ startMs: 100, text: "bonjour" }]),
        fetchedAt: Date.now() - 1000,
      };
      (getLyricsCacheEntrySync as jest.Mock).mockReturnValue(mockRow);

      const result = await resolveLyricsForSong("song-cached");
      expect(result).toEqual({
        synced: true,
        lang: "fra",
        offsetMs: 50,
        lines: [{ startMs: 100, text: "bonjour" }],
      });
      expect(getLyricsBySongId).not.toHaveBeenCalled();
      expect(upsertLyricsCacheEntry).not.toHaveBeenCalled();
    });

    it("should return null without network if status is 'none' and within negative TTL", async () => {
      const mockRow: LyricsCacheRow = {
        songId: "song-none-fresh",
        source: "server",
        status: "none",
        synced: 0,
        lang: null,
        offsetMs: null,
        linesJson: null,
        fetchedAt: 1000000,
      };
      (getLyricsCacheEntrySync as jest.Mock).mockReturnValue(mockRow);

      // Current time is 1 day after fetch (negative TTL is 3 days = 259,200,000 ms)
      const now = 1000000 + 24 * 60 * 60 * 1000;
      const result = await resolveLyricsForSong("song-none-fresh", "server", { now });
      expect(result).toBeNull();
      expect(getLyricsBySongId).not.toHaveBeenCalled();
    });

    it("should refetch if status is 'none' but negative TTL has expired", async () => {
      const mockRow: LyricsCacheRow = {
        songId: "song-none-expired",
        source: "server",
        status: "none",
        synced: 0,
        lang: null,
        offsetMs: null,
        linesJson: null,
        fetchedAt: 1000000,
      };
      (getLyricsCacheEntrySync as jest.Mock).mockReturnValue(mockRow);

      // Current time is 4 days after fetch (TTL is 3 days)
      const now = 1000000 + 4 * 24 * 60 * 60 * 1000;
      (getLyricsBySongId as jest.Mock).mockResolvedValue([
        {
          synced: true,
          line: [{ start: 500, value: "newly added lyrics" }],
        },
      ]);

      const result = await resolveLyricsForSong("song-none-expired", "server", { now });
      expect(getLyricsBySongId).toHaveBeenCalledWith("song-none-expired");
      expect(result).toEqual({
        synced: true,
        lines: [{ startMs: 500, text: "newly added lyrics" }],
      });
      expect(upsertLyricsCacheEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          songId: "song-none-expired",
          status: "found",
          synced: true,
          linesJson: JSON.stringify([{ text: "newly added lyrics", startMs: 500 }]),
        }),
      );
    });

    it("should fetch, store 'found', and return lyrics on cache miss", async () => {
      (getLyricsCacheEntrySync as jest.Mock).mockReturnValue(null);
      (getLyricsBySongId as jest.Mock).mockResolvedValue([
        {
          lang: "deu",
          synced: false,
          line: [{ value: "guten tag" }],
        },
      ]);

      const now = 2000000;
      const result = await resolveLyricsForSong("song-miss", "server", { now });

      expect(getLyricsBySongId).toHaveBeenCalledWith("song-miss");
      expect(upsertLyricsCacheEntry).toHaveBeenCalledWith({
        songId: "song-miss",
        source: "server",
        status: "found",
        synced: false,
        lang: "deu",
        offsetMs: null,
        linesJson: JSON.stringify([{ text: "guten tag" }]),
        fetchedAt: now,
      });
      expect(result).toEqual({
        synced: false,
        lang: "deu",
        lines: [{ text: "guten tag" }],
      });
    });

    it("should fetch, store 'none', and return null on definitive empty server response", async () => {
      (getLyricsCacheEntrySync as jest.Mock).mockReturnValue(null);
      (getLyricsBySongId as jest.Mock).mockResolvedValue([]);

      const now = 3000000;
      const result = await resolveLyricsForSong("song-empty", "server", { now });

      expect(getLyricsBySongId).toHaveBeenCalledWith("song-empty");
      expect(upsertLyricsCacheEntry).toHaveBeenCalledWith({
        songId: "song-empty",
        source: "server",
        status: "none",
        synced: 0,
        lang: null,
        offsetMs: null,
        linesJson: null,
        fetchedAt: now,
      });
      expect(result).toBeNull();
    });

    it("should NOT cache anything and return null on network failure", async () => {
      (getLyricsCacheEntrySync as jest.Mock).mockReturnValue(null);
      (getLyricsBySongId as jest.Mock).mockRejectedValue(new Error("Network timeout"));

      const result = await resolveLyricsForSong("song-error");
      expect(result).toBeNull();
      expect(upsertLyricsCacheEntry).not.toHaveBeenCalled();
    });
  });
});
