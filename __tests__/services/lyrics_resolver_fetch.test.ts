import { resolveLyricsForSong } from "@/services/lyrics";
import { getLyricsCacheEntrySync, upsertLyricsCacheEntry } from "@/services/db";
import * as SecureStore from "expo-secure-store";

declare let global: any;

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("@/utils/crypto", () => ({
  generateSalt: jest.fn(() => "mockSalt123"),
  createAuthToken: jest.fn(async () => "mockAuthToken456"),
}));

jest.mock("@/services/db", () => ({
  getLyricsCacheEntrySync: jest.fn(),
  upsertLyricsCacheEntry: jest.fn(),
}));

describe("resolveLyricsForSong with real api and mocked fetch", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
      if (key === "serverUrl") return Promise.resolve("http://navidrome.local");
      if (key === "username") return Promise.resolve("testuser");
      if (key === "password") return Promise.resolve("testpass");
      if (key === "subsonicVersion") return Promise.resolve("1.16.1");
      return Promise.resolve(null);
    });
    (getLyricsCacheEntrySync as jest.Mock).mockReturnValue(null);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should NOT write to lyrics_cache on network offline error", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network offline"));

    const result = await resolveLyricsForSong("song-offline");

    expect(result).toBeNull();
    expect(upsertLyricsCacheEntry).not.toHaveBeenCalled();
  });

  it("should NOT write to lyrics_cache on network timeout error", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("The operation was aborted due to timeout"));

    const result = await resolveLyricsForSong("song-timeout");

    expect(result).toBeNull();
    expect(upsertLyricsCacheEntry).not.toHaveBeenCalled();
  });

  it("should NOT write to lyrics_cache on HTTP 404 (endpoint unsupported or not found)", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const result = await resolveLyricsForSong("song-404");

    expect(result).toBeNull();
    expect(upsertLyricsCacheEntry).not.toHaveBeenCalled();
  });

  it("should NOT write to lyrics_cache on HTTP 501 (not implemented)", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 501,
    });

    const result = await resolveLyricsForSong("song-501");

    expect(result).toBeNull();
    expect(upsertLyricsCacheEntry).not.toHaveBeenCalled();
  });

  it("should NOT write to lyrics_cache on HTTP 500 (internal server error)", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await resolveLyricsForSong("song-500");

    expect(result).toBeNull();
    expect(upsertLyricsCacheEntry).not.toHaveBeenCalled();
  });

  it("should write status 'none' to lyrics_cache on definitive HTTP 200 with empty list", async () => {
    const mockResponse = {
      "subsonic-response": {
        status: "ok",
        version: "1.16.1",
        lyricsList: {},
      },
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const now = 1700000000;
    const result = await resolveLyricsForSong("song-empty-list", "server", { now });

    expect(result).toBeNull();
    expect(upsertLyricsCacheEntry).toHaveBeenCalledTimes(1);
    expect(upsertLyricsCacheEntry).toHaveBeenCalledWith({
      songId: "song-empty-list",
      source: "server",
      status: "none",
      synced: 0,
      lang: null,
      offsetMs: null,
      linesJson: null,
      fetchedAt: now,
    });
  });

  it("should write status 'none' to lyrics_cache on definitive Subsonic error 70 (data not found)", async () => {
    const mockResponse = {
      "subsonic-response": {
        status: "failed",
        error: {
          code: 70,
          message: "The requested data was not found",
        },
      },
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const now = 1700000000;
    const result = await resolveLyricsForSong("song-err-70", "server", { now });

    expect(result).toBeNull();
    expect(upsertLyricsCacheEntry).toHaveBeenCalledTimes(1);
    expect(upsertLyricsCacheEntry).toHaveBeenCalledWith({
      songId: "song-err-70",
      source: "server",
      status: "none",
      synced: 0,
      lang: null,
      offsetMs: null,
      linesJson: null,
      fetchedAt: now,
    });
  });

  it("should write status 'found' to lyrics_cache on HTTP 200 with valid lyrics", async () => {
    const mockResponse = {
      "subsonic-response": {
        status: "ok",
        version: "1.16.1",
        lyricsList: {
          structuredLyrics: [
            {
              lang: "eng",
              synced: true,
              offset: 200,
              line: [
                { start: 1000, value: "hello world" },
                { start: 2000, value: "second line" },
              ],
            },
          ],
        },
      },
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const now = 1700000000;
    const result = await resolveLyricsForSong("song-valid", "server", { now });

    expect(result).toEqual({
      synced: true,
      lang: "eng",
      offsetMs: 200,
      lines: [
        { startMs: 1000, text: "hello world" },
        { startMs: 2000, text: "second line" },
      ],
    });
    expect(upsertLyricsCacheEntry).toHaveBeenCalledTimes(1);
    expect(upsertLyricsCacheEntry).toHaveBeenCalledWith({
      songId: "song-valid",
      source: "server",
      status: "found",
      synced: true,
      lang: "eng",
      offsetMs: 200,
      linesJson: JSON.stringify([
        { text: "hello world", startMs: 1000 },
        { text: "second line", startMs: 2000 },
      ]),
      fetchedAt: now,
    });
  });
});
