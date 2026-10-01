import {
  convertLrclibItem,
  fetchLyricsFromLrclib,
  fetchOnlineLyricsFromLrclib,
  parseLrc,
  parseLrcTimestamp,
  parsePlainLyrics,
} from "@/services/lrclib";
import { APP_SHORT_NAME, APP_VERSION } from "@/utils/constants";

describe("lrclib service", () => {
  describe("parseLrcTimestamp", () => {
    it("should parse 2-digit fraction [mm:ss.xx]", () => {
      // 01:23.45 -> 1m 23s 450ms = 60000 + 23000 + 450 = 83450
      expect(parseLrcTimestamp("01", "23", "45")).toBe(83450);
    });

    it("should parse 3-digit fraction [mm:ss.xxx]", () => {
      // 02:10.123 -> 2m 10s 123ms = 120000 + 10000 + 123 = 130123
      expect(parseLrcTimestamp("02", "10", "123")).toBe(130123);
    });

    it("should parse timestamp without fraction", () => {
      expect(parseLrcTimestamp("00", "45")).toBe(45000);
    });
  });

  describe("parseLrc", () => {
    it("should return null for empty, null, or whitespace string", () => {
      expect(parseLrc(null)).toBeNull();
      expect(parseLrc("")).toBeNull();
      expect(parseLrc("   \n   ")).toBeNull();
    });

    it("should parse standard LRC format and sort by startMs", () => {
      const lrc = `
        [00:15.50] Second line
        [00:05.00] First line
        [00:30.00] Third line
      `;
      const result = parseLrc(lrc);
      expect(result).not.toBeNull();
      expect(result?.synced).toBe(true);
      expect(result?.lines).toEqual([
        { startMs: 5000, text: "First line" },
        { startMs: 15500, text: "Second line" },
        { startMs: 30000, text: "Third line" },
      ]);
    });

    it("should support multiple timestamps on a single line", () => {
      const lrc = `[00:10.00][00:20.00] Repeated chorus`;
      const result = parseLrc(lrc);
      expect(result?.lines).toEqual([
        { startMs: 10000, text: "Repeated chorus" },
        { startMs: 20000, text: "Repeated chorus" },
      ]);
    });

    it("should preserve blank timestamped lines for spacing", () => {
      const lrc = `
        [00:05.00] Intro
        [00:10.00]
        [00:15.00] Verse starts
      `;
      const result = parseLrc(lrc);
      expect(result?.lines).toEqual([
        { startMs: 5000, text: "Intro" },
        { startMs: 10000, text: "" },
        { startMs: 15000, text: "Verse starts" },
      ]);
    });

    it("should ignore metadata tags like [ar:], [ti:], [al:], and [offset:]", () => {
      const lrc = `
        [ar: Queen]
        [ti: Bohemian Rhapsody]
        [al: A Night at the Opera]
        [offset: 500]
        [by: author]
        [00:01.00] Is this the real life?
      `;
      const result = parseLrc(lrc);
      expect(result?.lines).toEqual([
        { startMs: 1000, text: "Is this the real life?" },
      ]);
      expect(result?.offsetMs).toBeUndefined();
    });

    it("should return null if content contains only metadata tags and no timestamps", () => {
      const lrc = `
        [ar: Pink Floyd]
        [ti: Time]
      `;
      expect(parseLrc(lrc)).toBeNull();
    });
  });

  describe("parsePlainLyrics", () => {
    it("should return null for empty string", () => {
      expect(parsePlainLyrics(null)).toBeNull();
      expect(parsePlainLyrics("")).toBeNull();
    });

    it("should parse multiline text into unsynced lines", () => {
      const plain = "line one\nline two\r\nline three";
      const result = parsePlainLyrics(plain);
      expect(result).toEqual({
        synced: false,
        lines: [
          { text: "line one" },
          { text: "line two" },
          { text: "line three" },
        ],
      });
    });
  });

  describe("convertLrclibItem", () => {
    it("should return instrumental when instrumental is true", () => {
      const result = convertLrclibItem({
        id: 1,
        instrumental: true,
      });
      expect(result).toEqual({ kind: "instrumental" });
    });

    it("should prefer syncedLyrics over plainLyrics", () => {
      const result = convertLrclibItem({
        id: 2,
        instrumental: false,
        syncedLyrics: "[00:01.00] Synced line",
        plainLyrics: "Plain line",
      });
      expect(result).toEqual({
        kind: "found",
        lyrics: {
          synced: true,
          lines: [{ startMs: 1000, text: "Synced line" }],
        },
      });
    });

    it("should fall back to plainLyrics when syncedLyrics is missing or invalid", () => {
      const result = convertLrclibItem({
        id: 3,
        instrumental: false,
        syncedLyrics: null,
        plainLyrics: "Plain line only",
      });
      expect(result).toEqual({
        kind: "found",
        lyrics: {
          synced: false,
          lines: [{ text: "Plain line only" }],
        },
      });
    });

    it("should return none when both lyrics are missing", () => {
      const result = convertLrclibItem({
        id: 4,
        instrumental: false,
      });
      expect(result).toEqual({ kind: "none" });
    });
  });

  describe("fetchLyricsFromLrclib", () => {
    it("should skip lookup and return null if track duration is missing, 0, or NaN", async () => {
      const mockFetch = jest.fn();

      expect(
        await fetchLyricsFromLrclib(
          { title: "Song", artist: "Artist", duration: undefined },
          { fetchFn: mockFetch },
        ),
      ).toBeNull();

      expect(
        await fetchLyricsFromLrclib(
          { title: "Song", artist: "Artist", duration: 0 },
          { fetchFn: mockFetch },
        ),
      ).toBeNull();

      expect(
        await fetchLyricsFromLrclib(
          { title: "Song", artist: "Artist", duration: NaN },
          { fetchFn: mockFetch },
        ),
      ).toBeNull();

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should skip lookup if title is empty", async () => {
      const mockFetch = jest.fn();
      expect(
        await fetchLyricsFromLrclib(
          { title: "", artist: "Artist", duration: 200 },
          { fetchFn: mockFetch },
        ),
      ).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should successfully fetch from /api/get on exact duration match and include User-Agent", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 123,
          duration: 200,
          instrumental: false,
          syncedLyrics: "[00:05.00] hello world",
        }),
      });

      const result = await fetchLyricsFromLrclib(
        { title: "Song", artist: "Artist", album: "Album", duration: 200 },
        { fetchFn: mockFetch },
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/get?"),
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": expect.stringContaining(APP_SHORT_NAME),
          }),
        }),
      );
      expect(result).toEqual({
        kind: "found",
        lyrics: {
          synced: true,
          lines: [{ startMs: 5000, text: "hello world" }],
        },
      });
    });

    it("should accept match if duration is within 3 seconds", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 124,
          duration: 202.5, // 2.5s diff <= 3s
          syncedLyrics: "[00:02.00] close duration match",
        }),
      });

      const result = await fetchLyricsFromLrclib(
        { title: "Song", duration: 200 },
        { fetchFn: mockFetch },
      );

      expect(result?.kind).toBe("found");
    });

    it("should reject /get result if duration is more than 3 seconds off", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 125,
          duration: 205, // 5s diff > 3s
          syncedLyrics: "[00:02.00] wrong song",
        }),
      });

      const result = await fetchLyricsFromLrclib(
        { title: "Song", duration: 200 },
        { fetchFn: mockFetch },
      );

      expect(result).toEqual({ kind: "none" });
    });

    it("should fall back to /api/search when /api/get returns 404 and pick closest match", async () => {
      const mockFetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [
            {
              id: 201,
              duration: 300, // 100s diff -> reject
              syncedLyrics: "[00:01.00] too far",
            },
            {
              id: 202,
              duration: 201, // 1s diff -> pick this!
              syncedLyrics: "[00:01.00] closest match",
            },
          ],
        });

      const result = await fetchOnlineLyricsFromLrclib(
        { title: "Search Song", artist: "Search Artist", duration: 200 },
        { fetchFn: mockFetch },
      );

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("/search?"),
        expect.anything(),
      );
      expect(result).toEqual({
        kind: "found",
        lyrics: {
          synced: true,
          lines: [{ startMs: 1000, text: "closest match" }],
        },
      });
    });

    it("should return 'none' when /get returns 404 and search results have only out-of-tolerance durations", async () => {
      const mockFetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [
            { id: 301, duration: 250 }, // diff 50s > 3s
            { id: 302, duration: 204 }, // diff 4s > 3s
          ],
        });

      const result = await fetchOnlineLyricsFromLrclib(
        { title: "No Match", duration: 200 },
        { fetchFn: mockFetch },
      );

      expect(result).toEqual({ kind: "none" });
    });

    it("should prefer a result with syncedLyrics when two candidates are within the tolerance", async () => {
      const mockFetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [
            {
              id: 401,
              duration: 200.5, // 0.5s off (closer duration), but only plain lyrics
              plainLyrics: "plain unsynced line",
              syncedLyrics: null,
            },
            {
              id: 402,
              duration: 202, // 2s off (still <= 3s tolerance), but has synced lyrics
              syncedLyrics: "[00:02.00] synced line wins",
            },
          ],
        });

      const result = await fetchOnlineLyricsFromLrclib(
        { title: "Tolerance Preference", duration: 200 },
        { fetchFn: mockFetch },
      );

      expect(result).toEqual({
        kind: "found",
        lyrics: {
          synced: true,
          lines: [{ startMs: 2000, text: "synced line wins" }],
        },
      });
    });

    it("should pick closest duration when both candidates within tolerance have syncedLyrics", async () => {
      const mockFetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [
            {
              id: 501,
              duration: 202, // 2s off
              syncedLyrics: "[00:02.00] 2s off",
            },
            {
              id: 502,
              duration: 200.8, // 0.8s off (closer)
              syncedLyrics: "[00:01.00] closer synced wins",
            },
          ],
        });

      const result = await fetchOnlineLyricsFromLrclib(
        { title: "Synced Duration Tiebreaker", duration: 200 },
        { fetchFn: mockFetch },
      );

      expect(result).toEqual({
        kind: "found",
        lyrics: {
          synced: true,
          lines: [{ startMs: 1000, text: "closer synced wins" }],
        },
      });
    });

    it("should return 'unavailable' when /get returns 404 and search fails with 429", async () => {
      const mockFetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: false, status: 429 });

      const result = await fetchOnlineLyricsFromLrclib(
        { title: "Search 429", duration: 200 },
        { fetchFn: mockFetch },
      );

      expect(result).toEqual({ kind: "unavailable" });
    });

    it("should return 'unavailable' when /get returns 404 and search fails with 5xx", async () => {
      const mockFetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: false, status: 502 });

      const result = await fetchOnlineLyricsFromLrclib(
        { title: "Search 502", duration: 200 },
        { fetchFn: mockFetch },
      );

      expect(result).toEqual({ kind: "unavailable" });
    });

    it("should return 'unavailable' when /get returns 404 and search fails with network/timeout error", async () => {
      const mockFetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockRejectedValueOnce(new Error("Network offline"));

      const result = await fetchOnlineLyricsFromLrclib(
        { title: "Search Timeout", duration: 200 },
        { fetchFn: mockFetch },
      );

      expect(result).toEqual({ kind: "unavailable" });
    });

    it("should return 'unavailable' when /get fails with 429 rate limit", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
      });

      const result = await fetchOnlineLyricsFromLrclib(
        { title: "Rate Limited", duration: 200 },
        { fetchFn: mockFetch },
      );

      expect(result).toEqual({ kind: "unavailable" });
    });

    it("should return 'unavailable' on network timeout / abort during /get", async () => {
      const mockFetch = jest
        .fn()
        .mockRejectedValue(new Error("AbortError: The operation was aborted"));

      const result = await fetchOnlineLyricsFromLrclib(
        { title: "Timeout Song", duration: 200 },
        { fetchFn: mockFetch },
      );

      expect(result).toEqual({ kind: "unavailable" });
    });
  });
});
