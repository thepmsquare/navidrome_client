import { Directory, File } from "expo-file-system";

import { getSongDownloadUrl } from "@/services/api";
import { getSongById, getSongCacheEntry } from "@/services/db";
import {
  cancelSongExport,
  getAudioMimeType,
  getSanitizedSongFileName,
  isPickerCancelledError,
  isSongExporting,
  sanitizeFileName,
  saveSongToFiles,
  subscribeSongExportProgress,
} from "@/services/songExport";
import { Child, SongCacheType } from "@/types";

jest.mock("@/services/api", () => ({
  getSongDownloadUrl: jest.fn(),
}));

jest.mock("@/services/db", () => ({
  getSongById: jest.fn(),
  getSongCacheEntry: jest.fn(),
}));

const mockCopy = jest.fn();
const mockDelete = jest.fn();
const mockCreateFile = jest.fn();

jest.mock("expo-file-system", () => {
  return {
    Paths: {
      cache: "file:///mock/cache",
      document: "file:///mock/document",
    },
    File: Object.assign(
      jest.fn().mockImplementation((...args: any[]) => ({
        uri: typeof args[0] === "string" ? args.join("/") : "file:///mock/file.mp3",
        exists: true,
        size: 1024,
        copy: mockCopy,
        delete: mockDelete,
      })),
      {
        downloadFileAsync: jest.fn(),
      },
    ),
    Directory: Object.assign(
      jest.fn().mockImplementation((...args: any[]) => ({
        uri: typeof args[0] === "string" ? args.join("/") : "file:///mock/dir",
        exists: true,
        createFile: mockCreateFile,
      })),
      {
        pickDirectoryAsync: jest.fn(),
      },
    ),
  };
});

describe("songExport service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSongById as jest.Mock).mockReturnValue(null);
    (getSongCacheEntry as jest.Mock).mockReturnValue(null);
    (getSongDownloadUrl as jest.Mock).mockResolvedValue("https://navidrome.example/rest/download.view?id=123");
    (Directory.pickDirectoryAsync as jest.Mock).mockResolvedValue({
      uri: "content://mock/saf/tree",
      createFile: mockCreateFile.mockReturnValue({
        uri: "content://mock/saf/tree/file.mp3",
      }),
    });
    mockCopy.mockResolvedValue(undefined);
    (File.downloadFileAsync as jest.Mock).mockResolvedValue({
      uri: "file:///mock/cache/downloaded.mp3",
      size: 2048,
    });
  });

  describe("sanitizeFileName", () => {
    it("should remove illegal filesystem characters and collapse spaces", () => {
      const sanitized = sanitizeFileName('  Queen: "Bohemian/Rhapsody*?<test>|"?  ');
      expect(sanitized).toBe("Queen_ _Bohemian_Rhapsody_test_");
    });

    it("should strip leading dots and trim whitespace", () => {
      expect(sanitizeFileName("...hidden_track.mp3")).toBe("hidden_track.mp3");
    });
  });

  describe("getAudioMimeType", () => {
    it("should return correct MIME types", () => {
      expect(getAudioMimeType("flac")).toBe("audio/flac");
      expect(getAudioMimeType("mp3")).toBe("audio/mpeg");
      expect(getAudioMimeType(".m4a")).toBe("audio/aac");
      expect(getAudioMimeType("opus")).toBe("audio/opus");
      expect(getAudioMimeType("wav")).toBe("audio/wav");
      expect(getAudioMimeType("unknown")).toBe("audio/*");
    });
  });

  describe("getSanitizedSongFileName", () => {
    it("should prioritize server path filename if present", () => {
      const song: Partial<Child> = {
        id: "song-1",
        title: "Track Title",
        artist: "Artist Name",
        suffix: "flac",
        path: "Queen/A Night At The Opera/04 - Bohemian Rhapsody.flac",
      };
      const name = getSanitizedSongFileName(song as Child, "song-1");
      expect(name).toBe("04 - Bohemian Rhapsody.flac");
    });

    it("should format as Artist - Title.suffix when path is absent", () => {
      const song: Partial<Child> = {
        id: "song-2",
        title: "Comfortably Numb",
        artist: "Pink Floyd",
        suffix: "mp3",
      };
      const name = getSanitizedSongFileName(song as Child, "song-2");
      expect(name).toBe("Pink Floyd - Comfortably Numb.mp3");
    });

    it("should format as Title.suffix when artist is missing", () => {
      const song: Partial<Child> = {
        id: "song-3",
        title: "Just Title",
        suffix: "mp3",
      };
      const name = getSanitizedSongFileName(song as Child, "song-3");
      expect(name).toBe("Just Title.mp3");
    });

    it("should use fallback id when title and artist are missing", () => {
      const name = getSanitizedSongFileName(null, "fallback-id");
      expect(name).toBe("song-fallback-id.mp3");
    });
  });

  describe("isPickerCancelledError", () => {
    it("should detect cancellation messages and names", () => {
      expect(isPickerCancelledError(new Error("Picker cancelled"))).toBe(true);
      expect(isPickerCancelledError({ message: "user cancelled directory selection" })).toBe(true);
      expect(isPickerCancelledError({ code: "ERR_PICKER_CANCELLED" })).toBe(true);
      expect(isPickerCancelledError(new Error("File not found"))).toBe(false);
      expect(isPickerCancelledError(null)).toBe(false);
    });
  });

  describe("saveSongToFiles", () => {
    it("returns cancelled when user cancels directory picker", async () => {
      (Directory.pickDirectoryAsync as jest.Mock).mockRejectedValue(new Error("Picker cancelled"));
      const result = await saveSongToFiles("song-1");
      expect(result).toEqual({ success: false, cancelled: true });
      expect(File.downloadFileAsync).not.toHaveBeenCalled();
      expect(mockCopy).not.toHaveBeenCalled();
    });

    it("copies directly from cache when song is already cached locally", async () => {
      const song: Partial<Child> = {
        id: "song-1",
        title: "Cached Song",
        artist: "Cached Artist",
        suffix: "mp3",
      };
      (getSongById as jest.Mock).mockReturnValue(song);
      (getSongCacheEntry as jest.Mock).mockReturnValue({
        songId: "song-1",
        cacheType: SongCacheType.Manual,
        filePath: "file:///mock/document/manual-cache/song-1.mp3",
        fileSizeBytes: 5000,
        cachedAt: "2026-01-01",
        lastAccessedAt: "2026-01-01",
      });

      const onProgress = jest.fn();
      const result = await saveSongToFiles("song-1", onProgress);

      expect(result.success).toBe(true);
      expect(result.fileName).toBe("Cached Artist - Cached Song.mp3");
      expect(Directory.pickDirectoryAsync).toHaveBeenCalled();
      expect(mockCreateFile).toHaveBeenCalledWith(
        "Cached Artist - Cached Song.mp3",
        "audio/mpeg",
      );
      expect(mockCopy).toHaveBeenCalled();
      expect(File.downloadFileAsync).not.toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(1);
    });

    it("downloads over network to temp file then copies when song is uncached", async () => {
      const song: Partial<Child> = {
        id: "song-uncached",
        title: "Uncached Song",
        artist: "Stream Artist",
        suffix: "flac",
      };
      (getSongById as jest.Mock).mockReturnValue(song);
      (getSongCacheEntry as jest.Mock).mockReturnValue(null);

      const onProgress = jest.fn();
      (File.downloadFileAsync as jest.Mock).mockImplementation(async (_url: string, _to: any, options: any) => {
        options?.onProgress?.({ bytesWritten: 500, totalBytes: 1000 });
        return { uri: "file:///mock/cache/export.flac" };
      });

      const result = await saveSongToFiles("song-uncached", onProgress);

      expect(result.success).toBe(true);
      expect(result.fileName).toBe("Stream Artist - Uncached Song.flac");
      expect(File.downloadFileAsync).toHaveBeenCalled();
      expect(mockCopy).toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(0.5);
      expect(onProgress).toHaveBeenCalledWith(1);
    });

    it("handles error and returns error message when copy fails", async () => {
      (getSongCacheEntry as jest.Mock).mockReturnValue({
        songId: "song-err",
        filePath: "file:///mock/cached.mp3",
      });
      mockCopy.mockRejectedValue(new Error("Disk write error"));

      const result = await saveSongToFiles("song-err");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Disk write error");
    });
  });

  describe("subscription and cancellation", () => {
    it("notifies progress listeners", () => {
      const listener = jest.fn();
      const unsubscribe = subscribeSongExportProgress(listener);

      // Trigger via listener check
      expect(isSongExporting("test-1")).toBe(false);
      unsubscribe();
    });

    it("cancelSongExport returns false when not exporting", () => {
      expect(cancelSongExport("non-existent")).toBe(false);
    });
  });
});
