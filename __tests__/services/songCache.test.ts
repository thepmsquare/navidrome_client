import { File } from "expo-file-system";

import { getSongStreamUrl } from "@/services/api";
import {
  deleteSongCacheEntry,
  getSongById,
  getSongCacheEntry,
  updateSongCacheLastAccessed,
  upsertSongCacheEntry,
} from "@/services/db";
import {
  cacheSongManually,
  cancelSongCaching,
  deleteSongFromCache,
  getCachedSongPlaybackUri,
  isSongCaching,
  subscribeSongCache,
} from "@/services/songCache";
import { SongCacheType } from "@/types";

jest.mock("@/services/api", () => ({
  getSongStreamUrl: jest.fn(),
}));

jest.mock("@/services/db", () => ({
  deleteSongCacheEntry: jest.fn(),
  getSongById: jest.fn(),
  getSongCacheEntry: jest.fn(),
  updateSongCacheLastAccessed: jest.fn(),
  upsertSongCacheEntry: jest.fn(),
}));

const mockFileDelete = jest.fn();

jest.mock("expo-file-system", () => {
  const mockCreate = jest.fn();
  const mockDownloadFileAsync = jest.fn();

  class MockDirectory {
    exists = false;
    create = mockCreate;
    uri = "file:///data/user/0/com.thepmsquare.navidrome_client/files/manual-cache";
    constructor(..._args: any[]) {}
  }

  class MockFile {
    uri: string;
    size = 1048576;
    exists = true;
    delete = mockFileDelete;
    static downloadFileAsync = mockDownloadFileAsync;
    constructor(dirOrUri: any, name?: string) {
      if (name) {
        this.uri = `file:///data/user/0/com.thepmsquare.navidrome_client/files/manual-cache/${name}`;
      } else {
        this.uri = typeof dirOrUri === "string" ? dirOrUri : "file:///test/file";
      }
      if (typeof dirOrUri === "string" && dirOrUri.includes("missing")) {
        this.exists = false;
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
  });
});

