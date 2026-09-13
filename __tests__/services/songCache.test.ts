import { File } from "expo-file-system";

import { getSongStreamUrl } from "@/services/api";
import {
  deleteSongCacheEntry,
  getSongById,
  getSongCacheEntry,
  insertSongCacheEntryIfNotExists,
  updateSongCacheLastAccessed,
  upsertSongCacheEntry,
} from "@/services/db";
import {
  autoCacheSong,
  cacheSongManually,
  cancelSongCaching,
  clearAllAutoCachedSongs,
  clearAllCachedSongs,
  deleteSongFromCache,
  getCachedSongPlaybackUri,
  isSongCaching,
  notifySongCacheProgress,
  notifySongCacheUpdated,
  subscribeSongCache,
  subscribeSongCacheProgress,
} from "@/services/songCache";
import { SongCacheType } from "@/types";

jest.mock("@/services/api", () => ({
  getSongStreamUrl: jest.fn(),
}));

jest.mock("@/services/db", () => ({
  deleteAutoSongCacheEntries: jest.fn(),
  deleteSongCacheEntry: jest.fn(),
  getAutoCacheCount: jest.fn(() => 0),
  getAutoCacheEnabled: jest.fn(() => true),
  getAutoCacheMaxBytes: jest.fn(() => 1024 * 1024 * 1024),
  getAutoCacheSongIds: jest.fn(() => []),
  getAutoCacheTotalSize: jest.fn(() => 0),
  getLeastRecentlyUsedAutoCacheEntries: jest.fn(() => []),
  getSongById: jest.fn(),
  getSongCacheEntry: jest.fn(),
  insertSongCacheEntryIfNotExists: jest.fn(),
  updateSongCacheLastAccessed: jest.fn(),
  upsertSongCacheEntry: jest.fn(),
}));

const mockFileDelete = jest.fn();
const mockDirectoryDelete = jest.fn();
const mockDirectoryExists = { current: false };

jest.mock("expo-file-system", () => {
  const mockCreate = jest.fn();
  const mockDownloadFileAsync = jest.fn();

  class MockDirectory {
    get exists() {
      return mockDirectoryExists.current;
    }
    set exists(val: boolean) {
      mockDirectoryExists.current = val;
    }
    create = mockCreate;
    delete = mockDirectoryDelete;
    uri: string;
    constructor(_parent?: any, name?: string) {
      this.uri = name
        ? `file:///data/user/0/com.thepmsquare.navidrome_client/files/${name}`
        : "file:///data/user/0/com.thepmsquare.navidrome_client/files/manual-cache";
    }
  }

  class MockFile {
    uri: string;
    size = 1048576;
    exists = true;
    delete = mockFileDelete;
    static downloadFileAsync = mockDownloadFileAsync;
    constructor(dirOrUri: any, name?: string) {
      if (name) {
        const base =
          dirOrUri?.uri ||
          "file:///data/user/0/com.thepmsquare.navidrome_client/files/manual-cache";
        this.uri = `${base}/${name}`;
      } else {
        this.uri = typeof dirOrUri === "string" ? dirOrUri : "file:///test/file";
      }
      if (typeof dirOrUri === "string" && dirOrUri.includes("missing")) {
        this.exists = false;
      }
      if (typeof dirOrUri === "string" && dirOrUri.includes("throw_exists")) {
        Object.defineProperty(this, "exists", {
          get: () => {
            throw new Error("exists check failure");
          },
        });
      }
    }
  }

  return {
    Paths: {
      document: new MockDirectory(),
    },
    Directory: MockDirectory,
    File: MockFile,
  };
});

describe("songCache service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should throw error when song is not found", async () => {
    (getSongById as jest.Mock).mockReturnValue(null);

    await expect(cacheSongManually("unknown-song-id")).rejects.toThrow(
      "song with id unknown-song-id not found",
    );
  });

  it("should download song stream to manual-cache folder and record in db", async () => {
    (getSongById as jest.Mock).mockReturnValue({
      id: "song-123",
      title: "Test Track",
      suffix: "flac",
    });
    (getSongStreamUrl as jest.Mock).mockResolvedValue(
      "https://example.com/rest/stream.view?id=song-123",
    );
    (File.downloadFileAsync as jest.Mock).mockResolvedValue({
      uri: "file:///data/user/0/com.thepmsquare.navidrome_client/files/manual-cache/song-123.flac",
      size: 15728640,
    });

    await cacheSongManually("song-123");

    expect(getSongStreamUrl).toHaveBeenCalledWith("song-123");
    expect(File.downloadFileAsync).toHaveBeenCalledWith(
      "https://example.com/rest/stream.view?id=song-123",
      expect.objectContaining({
        uri: "file:///data/user/0/com.thepmsquare.navidrome_client/files/manual-cache/song-123.flac",
      }),
      expect.objectContaining({ idempotent: true }),
    );
    expect(upsertSongCacheEntry).toHaveBeenCalledWith(
      "song-123",
      SongCacheType.Manual,
      "file:///data/user/0/com.thepmsquare.navidrome_client/files/manual-cache/song-123.flac",
      15728640,
    );
  });

  it("should default suffix to mp3 if song suffix is missing", async () => {
    (getSongById as jest.Mock).mockReturnValue({
      id: "song-no-suffix",
      title: "No Suffix Track",
    });
    (getSongStreamUrl as jest.Mock).mockResolvedValue(
      "https://example.com/rest/stream.view?id=song-no-suffix",
    );
    (File.downloadFileAsync as jest.Mock).mockResolvedValue({
      uri: "file:///data/user/0/com.thepmsquare.navidrome_client/files/manual-cache/song-no-suffix.mp3",
      size: 5000000,
    });

    await cacheSongManually("song-no-suffix");

    expect(upsertSongCacheEntry).toHaveBeenCalledWith(
      "song-no-suffix",
      SongCacheType.Manual,
      "file:///data/user/0/com.thepmsquare.navidrome_client/files/manual-cache/song-no-suffix.mp3",
      5000000,
    );
  });

  it("should notify subscribers when song is cached", async () => {
    const mockListener = jest.fn();
    const unsubscribe = subscribeSongCache(mockListener);

    const mockEntry = {
      songId: "song-sub",
      cacheType: SongCacheType.Manual,
      filePath: "file:///test/path.mp3",
      fileSizeBytes: 1000,
      addedAt: "2026-09-06T12:00:00.000Z",
      lastAccessedAt: null,
    };

    (getSongById as jest.Mock).mockReturnValue({
      id: "song-sub",
      title: "Subscribed Track",
      suffix: "mp3",
    });
    (getSongStreamUrl as jest.Mock).mockResolvedValue("https://example.com/stream");
    (File.downloadFileAsync as jest.Mock).mockResolvedValue({
      uri: "file:///test/path.mp3",
      size: 1000,
    });
    (getSongCacheEntry as jest.Mock).mockReturnValue(mockEntry);

    await cacheSongManually("song-sub");

    expect(mockListener).toHaveBeenCalledWith({
      songId: "song-sub",
      entry: mockEntry,
    });

    unsubscribe();
  });

  describe("getCachedSongPlaybackUri", () => {
    it("should return null if cache entry does not exist", () => {
      (getSongCacheEntry as jest.Mock).mockReturnValue(null);
      const uri = getCachedSongPlaybackUri("uncached-song");
      expect(uri).toBeNull();
      expect(updateSongCacheLastAccessed).not.toHaveBeenCalled();
    });

    it("should return null if cache file does not exist on disk", () => {
      (getSongCacheEntry as jest.Mock).mockReturnValue({
        songId: "missing-song",
        cacheType: SongCacheType.Manual,
        filePath: "file:///missing/track.mp3",
      });
      const uri = getCachedSongPlaybackUri("missing-song");
      expect(uri).toBeNull();
      expect(updateSongCacheLastAccessed).not.toHaveBeenCalled();
    });

    it("should return file uri and update lastAccessedAt when cached file exists", () => {
      (getSongCacheEntry as jest.Mock).mockReturnValue({
        songId: "cached-song",
        cacheType: SongCacheType.Auto,
        filePath: "file:///cached/track.mp3",
      });
      const uri = getCachedSongPlaybackUri("cached-song");
      expect(uri).toBe("file:///cached/track.mp3");
      expect(updateSongCacheLastAccessed).toHaveBeenCalledWith("cached-song");
    });
  });

  describe("progress tracking", () => {
    it("should notify progress listeners and onProgress callback", async () => {
      const mockProgressListener = jest.fn();
      const { subscribeSongCacheProgress } = jest.requireActual(
        "@/services/songCache",
      );
      const unsubscribe = subscribeSongCacheProgress(mockProgressListener);
      const onProgressCallback = jest.fn();

      (getSongById as jest.Mock).mockReturnValue({
        id: "song-progress",
        title: "Progress Track",
        suffix: "mp3",
      });
      (getSongStreamUrl as jest.Mock).mockResolvedValue("https://example.com/stream");
      (File.downloadFileAsync as jest.Mock).mockImplementation(
        async (_url, _dest, options) => {
          options?.onProgress?.({ bytesWritten: 50, totalBytes: 100 });
          return { uri: "file:///test/path.mp3", size: 100 };
        },
      );

      await cacheSongManually("song-progress", onProgressCallback);

      expect(onProgressCallback).toHaveBeenCalledWith(0);
      expect(onProgressCallback).toHaveBeenCalledWith(0.5);
      expect(mockProgressListener).toHaveBeenCalledWith({
        songId: "song-progress",
        progress: 0.5,
      });

      unsubscribe();
    });
  });

  describe("cancellation", () => {
    it("should abort download and clean up file when cancelled", async () => {
      (getSongById as jest.Mock).mockReturnValue({
        id: "song-cancel",
        title: "Cancel Track",
        suffix: "mp3",
      });
      (getSongStreamUrl as jest.Mock).mockResolvedValue("https://example.com/stream");

      let receivedSignal: AbortSignal | undefined;
      (File.downloadFileAsync as jest.Mock).mockImplementation(
        async (_url, _dest, options) => {
          receivedSignal = options?.signal;
          return new Promise((_resolve, reject) => {
            options?.signal?.addEventListener("abort", () => {
              const abortErr = new Error("The user aborted a request.");
              abortErr.name = "AbortError";
              reject(abortErr);
            });
          });
        },
      );

      const downloadPromise = cacheSongManually("song-cancel");

      // Yield event loop so downloadFileAsync gets invoked and receives signal
      await new Promise<void>((r) => {
        setImmediate(() => r());
      });

      expect(isSongCaching("song-cancel")).toBe(true);

      const cancelled = cancelSongCaching("song-cancel");
      expect(cancelled).toBe(true);
      expect(receivedSignal?.aborted).toBe(true);

      await expect(downloadPromise).rejects.toThrow("aborted");
      expect(isSongCaching("song-cancel")).toBe(false);
    });
  });

  describe("deleteSongFromCache", () => {
    it("should delete cached file from disk and remove db record", async () => {
      const mockEntry = {
        songId: "song-del",
        cacheType: SongCacheType.Manual,
        filePath: "file:///data/user/0/manual-cache/song-del.mp3",
        fileSizeBytes: 2048,
        addedAt: "2026-09-06T12:00:00.000Z",
        lastAccessedAt: null,
      };

      (getSongCacheEntry as jest.Mock).mockReturnValue(mockEntry);
      const mockListener = jest.fn();
      const unsubscribe = subscribeSongCache(mockListener);

      await deleteSongFromCache("song-del");

      expect(mockFileDelete).toHaveBeenCalled();
      expect(deleteSongCacheEntry).toHaveBeenCalledWith("song-del");
      expect(mockListener).toHaveBeenCalledWith({
        songId: "song-del",
        entry: null,
      });

      unsubscribe();
    });

    it("should catch file deletion error gracefully", async () => {
      const mockEntry = {
        songId: "song-del-err",
        cacheType: SongCacheType.Manual,
        filePath: "file:///data/user/0/manual-cache/song-del-err.mp3",
        fileSizeBytes: 2048,
        addedAt: "2026-09-06T12:00:00.000Z",
        lastAccessedAt: null,
      };
      (getSongCacheEntry as jest.Mock).mockReturnValue(mockEntry);
      mockFileDelete.mockImplementationOnce(() => {
        throw new Error("delete permission denied");
      });

      await expect(deleteSongFromCache("song-del-err")).resolves.not.toThrow();
      expect(deleteSongCacheEntry).toHaveBeenCalledWith("song-del-err");
    });
  });

  describe("listeners and progress handling", () => {
    it("should return cached URI even if file.exists check throws", () => {
      (getSongCacheEntry as jest.Mock).mockReturnValue({
        songId: "song-throw",
        filePath: "file:///throw_exists.mp3",
      });

      const uri = getCachedSongPlaybackUri("song-throw");
      expect(uri).toBe("file:///throw_exists.mp3");
    });

    it("should catch listener error in notifySongCacheUpdated", () => {
      const badListener = jest.fn(() => {
        throw new Error("listener fail");
      });
      const unsubscribe = subscribeSongCache(badListener);
      expect(() => notifySongCacheUpdated("s-1", null)).not.toThrow();
      unsubscribe();
    });

    it("should catch listener error in notifySongCacheProgress", () => {
      const badListener = jest.fn(() => {
        throw new Error("progress listener fail");
      });
      const unsubscribe = subscribeSongCacheProgress(badListener);
      expect(() => notifySongCacheProgress("s-1", 0.5)).not.toThrow();
      unsubscribe();
    });

    it("should handle external signal and indeterminate progress in cacheSongManually", async () => {
      (getSongById as jest.Mock).mockReturnValue({
        id: "song-progress",
        title: "Progress Track",
        suffix: "mp3",
      });
      (getSongStreamUrl as jest.Mock).mockResolvedValue("https://example.com/stream");

      let onProgressCb: ((e: any) => void) | undefined;
      (File.downloadFileAsync as jest.Mock).mockImplementation(
        async (_url, _dest, options) => {
          onProgressCb = options?.onProgress;
          onProgressCb?.({ totalBytes: 0, bytesWritten: 100 });
          return { uri: "file:///cached/song-progress.mp3", size: 100 };
        },
      );

      const abortController = new AbortController();
      const progressFn = jest.fn();
      await cacheSongManually("song-progress", progressFn, abortController.signal);

      expect(progressFn).toHaveBeenCalledWith(-1);
    });
  });

  describe("autoCacheSong", () => {
    it("should return early if autoCache is disabled", async () => {
      const { getAutoCacheEnabled } = require("@/services/db");
      (getAutoCacheEnabled as jest.Mock).mockReturnValueOnce(false);

      await autoCacheSong("song-disabled");
      expect(File.downloadFileAsync).not.toHaveBeenCalled();
      expect(getSongById).not.toHaveBeenCalled();
    });

    it("should return early if song does not exist", async () => {
      (getSongById as jest.Mock).mockReturnValue(null);
      await autoCacheSong("nonexistent-song");
      expect(File.downloadFileAsync).not.toHaveBeenCalled();
      expect(insertSongCacheEntryIfNotExists).not.toHaveBeenCalled();
    });

    it("should return early if song is already cached in db", async () => {
      (getSongById as jest.Mock).mockReturnValue({
        id: "song-already-cached",
        title: "Cached Track",
        suffix: "mp3",
      });
      (getSongCacheEntry as jest.Mock).mockReturnValue({
        songId: "song-already-cached",
        cacheType: SongCacheType.Manual,
        filePath: "file:///path/to/manual.mp3",
        fileSizeBytes: 1234,
        addedAt: "2026-09-01T00:00:00.000Z",
        lastAccessedAt: null,
      });

      await autoCacheSong("song-already-cached");
      expect(File.downloadFileAsync).not.toHaveBeenCalled();
      expect(insertSongCacheEntryIfNotExists).not.toHaveBeenCalled();
    });

    it("should download to auto-cache directory and insert with cacheType Auto on success", async () => {
      (getSongById as jest.Mock).mockReturnValue({
        id: "song-auto-1",
        title: "Auto Song 1",
        suffix: "flac",
      });
      (getSongCacheEntry as jest.Mock)
        .mockReturnValueOnce(null) // initial check
        .mockReturnValueOnce(null) // post-download check
        .mockReturnValueOnce({
          songId: "song-auto-1",
          cacheType: SongCacheType.Auto,
          filePath:
            "file:///data/user/0/com.thepmsquare.navidrome_client/files/auto-cache/song-auto-1.flac",
          fileSizeBytes: 1048576,
          addedAt: "2026-09-13T00:00:00.000Z",
          lastAccessedAt: null,
        });
      (getSongStreamUrl as jest.Mock).mockResolvedValue(
        "https://example.com/stream?id=song-auto-1",
      );
      (File.downloadFileAsync as jest.Mock).mockResolvedValue({
        uri: "file:///data/user/0/com.thepmsquare.navidrome_client/files/auto-cache/song-auto-1.flac",
        size: 1048576,
      });
      (insertSongCacheEntryIfNotExists as jest.Mock).mockReturnValue(true);

      const progressSpy = jest.fn();
      const unsubProgress = subscribeSongCacheProgress(progressSpy);

      const listenerSpy = jest.fn();
      const unsubCache = subscribeSongCache(listenerSpy);

      await autoCacheSong("song-auto-1");

      unsubProgress();
      unsubCache();

      expect(File.downloadFileAsync).toHaveBeenCalledWith(
        "https://example.com/stream?id=song-auto-1",
        expect.objectContaining({
          uri: "file:///data/user/0/com.thepmsquare.navidrome_client/files/auto-cache/song-auto-1.flac",
        }),
        expect.objectContaining({
          idempotent: true,
        }),
      );

      // Auto caching should NOT emit progress events (invisible to user)
      expect(progressSpy).not.toHaveBeenCalled();

      expect(insertSongCacheEntryIfNotExists).toHaveBeenCalledWith(
        "song-auto-1",
        SongCacheType.Auto,
        "file:///data/user/0/com.thepmsquare.navidrome_client/files/auto-cache/song-auto-1.flac",
        1048576,
      );

      expect(listenerSpy).toHaveBeenCalledWith({
        songId: "song-auto-1",
        entry: expect.objectContaining({
          songId: "song-auto-1",
          cacheType: SongCacheType.Auto,
        }),
      });
    });

    it("should clean up auto file and not overwrite if existing entry appears after download", async () => {
      (getSongById as jest.Mock).mockReturnValue({
        id: "song-concurrent-manual",
        title: "Concurrent Song",
        suffix: "mp3",
      });
      // Initial check returns null, but post-download check returns manual row
      (getSongCacheEntry as jest.Mock)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({
          songId: "song-concurrent-manual",
          cacheType: SongCacheType.Manual,
          filePath: "file:///path/to/manual.mp3",
          fileSizeBytes: 1234,
          addedAt: "2026-09-01T00:00:00.000Z",
          lastAccessedAt: null,
        });
      (getSongStreamUrl as jest.Mock).mockResolvedValue(
        "https://example.com/stream?id=song-concurrent-manual",
      );
      (File.downloadFileAsync as jest.Mock).mockResolvedValue({
        uri: "file:///data/user/0/com.thepmsquare.navidrome_client/files/auto-cache/song-concurrent-manual.mp3",
        size: 500000,
      });

      mockFileDelete.mockClear();
      await autoCacheSong("song-concurrent-manual");

      expect(insertSongCacheEntryIfNotExists).not.toHaveBeenCalled();
      expect(mockFileDelete).toHaveBeenCalled();
    });

    it("should clean up partial file on download failure", async () => {
      (getSongById as jest.Mock).mockReturnValue({
        id: "song-fail",
        title: "Fail Track",
        suffix: "mp3",
      });
      (getSongCacheEntry as jest.Mock).mockReturnValue(null);
      (getSongStreamUrl as jest.Mock).mockResolvedValue("https://example.com/stream");
      (File.downloadFileAsync as jest.Mock).mockRejectedValue(
        new Error("network failure"),
      );

      mockFileDelete.mockClear();
      await expect(autoCacheSong("song-fail")).resolves.not.toThrow();
      expect(mockFileDelete).toHaveBeenCalled();
    });

    it("should evict least-recently-used auto entries when limit is exceeded", async () => {
      const {
        getAutoCacheMaxBytes,
        getAutoCacheTotalSize,
        getLeastRecentlyUsedAutoCacheEntries,
      } = require("@/services/db");

      (getSongById as jest.Mock).mockReturnValue({
        id: "song-new",
        title: "New Song",
        suffix: "flac",
      });
      (getSongCacheEntry as jest.Mock)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({
          songId: "song-new",
          cacheType: SongCacheType.Auto,
          filePath: "file:///auto-cache/song-new.flac",
          fileSizeBytes: 300,
          addedAt: "2026-09-13T00:00:00.000Z",
          lastAccessedAt: null,
        });

      (getSongStreamUrl as jest.Mock).mockResolvedValue("https://example.com/stream");
      (File.downloadFileAsync as jest.Mock).mockResolvedValue({
        uri: "file:///data/user/0/com.thepmsquare.navidrome_client/files/auto-cache/song-new.flac",
        size: 300,
      });

      (getAutoCacheMaxBytes as jest.Mock).mockReturnValue(1000);
      (getAutoCacheTotalSize as jest.Mock).mockReturnValue(800); // 800 + 300 = 1100 > 1000

      const victim = {
        songId: "song-lru-victim",
        cacheType: SongCacheType.Auto,
        filePath: "file:///data/user/0/com.thepmsquare.navidrome_client/files/auto-cache/victim.mp3",
        fileSizeBytes: 400,
        addedAt: "2026-09-01T00:00:00.000Z",
        lastAccessedAt: "2026-09-02T00:00:00.000Z",
      };

      (getLeastRecentlyUsedAutoCacheEntries as jest.Mock)
        .mockReturnValueOnce([victim])
        .mockReturnValue([]);

      (insertSongCacheEntryIfNotExists as jest.Mock).mockReturnValue(true);

      mockFileDelete.mockClear();
      await autoCacheSong("song-new");

      expect(mockFileDelete).toHaveBeenCalled();
      expect(deleteSongCacheEntry).toHaveBeenCalledWith("song-lru-victim");
      expect(insertSongCacheEntryIfNotExists).toHaveBeenCalledWith(
        "song-new",
        SongCacheType.Auto,
        "file:///data/user/0/com.thepmsquare.navidrome_client/files/auto-cache/song-new.flac",
        300,
      );
    });

    it("should skip caching and clean up destination if single file exceeds maxBytes alone", async () => {
      const {
        getAutoCacheMaxBytes,
        getAutoCacheTotalSize,
        getLeastRecentlyUsedAutoCacheEntries,
      } = require("@/services/db");

      (getSongById as jest.Mock).mockReturnValue({
        id: "song-giant",
        title: "Giant Song",
        suffix: "flac",
      });
      (getSongCacheEntry as jest.Mock)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null);

      (getSongStreamUrl as jest.Mock).mockResolvedValue("https://example.com/stream");
      (File.downloadFileAsync as jest.Mock).mockResolvedValue({
        uri: "file:///data/user/0/com.thepmsquare.navidrome_client/files/auto-cache/song-giant.flac",
        size: 2000,
      });

      (getAutoCacheMaxBytes as jest.Mock).mockReturnValue(1000);
      (getAutoCacheTotalSize as jest.Mock).mockReturnValue(0);
      (getLeastRecentlyUsedAutoCacheEntries as jest.Mock).mockReturnValue([]);

      mockFileDelete.mockClear();
      await autoCacheSong("song-giant");

      expect(mockFileDelete).toHaveBeenCalled();
      expect(insertSongCacheEntryIfNotExists).not.toHaveBeenCalled();
    });
  });

  describe("clearAllAutoCachedSongs", () => {
    it("should abort auto-caching, delete auto directory, and delete db auto rows", async () => {
      const {
        getAutoCacheSongIds,
        deleteAutoSongCacheEntries,
      } = require("@/services/db");

      (getAutoCacheSongIds as jest.Mock).mockReturnValue(["auto-song-1", "auto-song-2"]);
      mockDirectoryExists.current = true;
      mockDirectoryDelete.mockClear();

      const listenerSpy = jest.fn();
      const unsub = subscribeSongCache(listenerSpy);

      await clearAllAutoCachedSongs();

      unsub();

      expect(mockDirectoryDelete).toHaveBeenCalled();
      expect(deleteAutoSongCacheEntries).toHaveBeenCalled();
      expect(listenerSpy).toHaveBeenCalledWith({
        songId: "auto-song-1",
        entry: null,
      });
      expect(listenerSpy).toHaveBeenCalledWith({
        songId: "auto-song-2",
        entry: null,
      });
    });

    it("should handle missing auto-cache directory without error", async () => {
      mockDirectoryExists.current = false;
      mockDirectoryDelete.mockClear();
      await expect(clearAllAutoCachedSongs()).resolves.not.toThrow();
    });
  });

  describe("clearAllCachedSongs", () => {
    it("should abort in-flight caching operations and delete cache directory if exists", async () => {
      mockDirectoryExists.current = true;
      await clearAllCachedSongs();
      expect(mockDirectoryDelete).toHaveBeenCalled();
    });

    it("should not crash if cache directory does not exist", async () => {
      mockDirectoryExists.current = false;
      mockDirectoryDelete.mockClear();
      await clearAllCachedSongs();
      expect(mockDirectoryDelete).not.toHaveBeenCalled();
    });

    it("should catch directory delete error gracefully", async () => {
      mockDirectoryExists.current = true;
      mockDirectoryDelete.mockImplementationOnce(() => {
        throw new Error("dir delete error");
      });
      await expect(clearAllCachedSongs()).resolves.not.toThrow();
    });
  });
});


