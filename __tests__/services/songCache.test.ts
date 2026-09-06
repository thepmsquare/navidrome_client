import { File } from "expo-file-system";

import { getSongStreamUrl } from "@/services/api";
import {
  getSongById,
  getSongCacheEntry,
  upsertSongCacheEntry,
} from "@/services/db";
import { cacheSongManually, subscribeSongCache } from "@/services/songCache";
import { SongCacheType } from "@/types";

jest.mock("@/services/api", () => ({
  getSongStreamUrl: jest.fn(),
}));

jest.mock("@/services/db", () => ({
  getSongById: jest.fn(),
  getSongCacheEntry: jest.fn(),
  upsertSongCacheEntry: jest.fn(),
}));

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
    static downloadFileAsync = mockDownloadFileAsync;
    constructor(_dir: any, name: string) {
      this.uri = `file:///data/user/0/com.thepmsquare.navidrome_client/files/manual-cache/${name}`;
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
      { idempotent: true },
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
});

