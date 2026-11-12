import { Directory, File } from "expo-file-system";

import {
  clearAllCachedCoverArt,
  deleteCachedCoverArt,
  getCachedCoverArtUri,
  getCoverCacheDirectory,
  getCoverFileName,
  isCoverArtCached,
  saveCoverArt,
} from "@/services/coverArtCache";
import { getSongById } from "@/services/db";

jest.mock("@/services/db", () => ({
  getSongById: jest.fn(),
}));

const mockFileDelete = jest.fn();
const mockDirectoryDelete = jest.fn();
const mockDirectoryCreate = jest.fn();
const mockDirectoryExists = { current: true };
const mockFileExistsMap = new Map<string, boolean>();

jest.mock("expo-file-system", () => {
  const mockCreate = jest.fn();
  const mockDelete = jest.fn();
  const mockDownload = jest.fn();

  class MockDirectory {
    get exists() {
      return mockDirectoryExists.current;
    }
    set exists(val: boolean) {
      mockDirectoryExists.current = val;
    }
    create = mockDirectoryCreate;
    delete = mockDirectoryDelete;
    uri: string;
    constructor(_parent?: any, name?: string) {
      this.uri = name
        ? `file:///data/user/0/com.thepmsquare.navidrome_client/files/${name}`
        : "file:///data/user/0/com.thepmsquare.navidrome_client/files/cover-cache";
    }
  }

  class MockFile {
    uri: string;
    delete = mockFileDelete;
    static downloadFileAsync = mockDownload;
    constructor(dirOrUri: any, name?: string) {
      if (name) {
        const base =
          dirOrUri?.uri ||
          "file:///data/user/0/com.thepmsquare.navidrome_client/files/cover-cache";
        this.uri = `${base}/${name}`;
      } else {
        this.uri =
          typeof dirOrUri === "string" ? dirOrUri : "file:///test/file";
      }
    }
    get exists() {
      return mockFileExistsMap.get(this.uri) ?? false;
    }
    set exists(val: boolean) {
      mockFileExistsMap.set(this.uri, val);
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

describe("coverArtCache", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFileExistsMap.clear();
    mockDirectoryExists.current = true;
  });

  describe("getCoverCacheDirectory", () => {
    it("returns directory pointing to cover-cache", () => {
      const dir = getCoverCacheDirectory();
      expect(dir.uri).toContain("cover-cache");
    });
  });

  describe("getCoverFileName", () => {
    it("sanitizes unsafe characters in cover id", () => {
      expect(getCoverFileName("al-123")).toBe("al-123.jpg");
      expect(getCoverFileName("cover/art:test?*")).toBe(
        encodeURIComponent("cover/art:test?*").replace(/[%*?:|"<>\/\\]/g, "_") +
          ".jpg",
      );
    });
  });

  describe("getCachedCoverArtUri and isCoverArtCached", () => {
    it("returns null if coverArtId is null or undefined", () => {
      expect(getCachedCoverArtUri(null)).toBeNull();
      expect(getCachedCoverArtUri(undefined)).toBeNull();
      expect(isCoverArtCached(null)).toBe(false);
    });

    it("returns file uri if file exists directly", () => {
      const dir = getCoverCacheDirectory();
      const expectedUri = `${dir.uri}/${getCoverFileName("al-456")}`;
      mockFileExistsMap.set(expectedUri, true);

      expect(getCachedCoverArtUri("al-456")).toBe(expectedUri);
      expect(isCoverArtCached("al-456")).toBe(true);
    });

    it("falls back to song.coverArt if songId is provided", () => {
      (getSongById as jest.Mock).mockReturnValue({
        id: "song-1",
        coverArt: "al-999",
      });
      const dir = getCoverCacheDirectory();
      const expectedUri = `${dir.uri}/${getCoverFileName("al-999")}`;
      mockFileExistsMap.set(expectedUri, true);

      expect(getCachedCoverArtUri("song-1")).toBe(expectedUri);
      expect(isCoverArtCached("song-1")).toBe(true);
    });

    it("returns null if neither direct nor song coverArt exists", () => {
      (getSongById as jest.Mock).mockReturnValue({
        id: "song-2",
        coverArt: "al-888",
      });
      expect(getCachedCoverArtUri("song-2")).toBeNull();
      expect(isCoverArtCached("song-2")).toBe(false);
    });
  });

  describe("saveCoverArt", () => {
    it("returns null if coverArtId or downloadUrl is empty", async () => {
      expect(await saveCoverArt("", "https://example.com/art.jpg")).toBeNull();
      expect(await saveCoverArt("al-1", "")).toBeNull();
    });

    it("creates directory if not exists", async () => {
      mockDirectoryExists.current = false;
      (File.downloadFileAsync as jest.Mock).mockResolvedValueOnce({
        uri: "file:///test/downloaded.jpg",
      });

      await saveCoverArt("al-1", "https://example.com/art.jpg");

      expect(mockDirectoryCreate).toHaveBeenCalledWith({ idempotent: true });
    });

    it("returns existing file uri if file already exists on disk without re-downloading", async () => {
      const dir = getCoverCacheDirectory();
      const expectedUri = `${dir.uri}/${getCoverFileName("al-existing")}`;
      mockFileExistsMap.set(expectedUri, true);

      const result = await saveCoverArt(
        "al-existing",
        "https://example.com/art.jpg",
      );

      expect(result).toBe(expectedUri);
      expect(File.downloadFileAsync).not.toHaveBeenCalled();
    });

    it("downloads file and returns uri on success", async () => {
      (File.downloadFileAsync as jest.Mock).mockResolvedValueOnce({
        uri: "file:///test/downloaded.jpg",
      });

      const result = await saveCoverArt(
        "al-new",
        "https://example.com/art.jpg",
      );

      expect(File.downloadFileAsync).toHaveBeenCalledWith(
        "https://example.com/art.jpg",
        expect.any(Object),
        { idempotent: true, signal: undefined },
      );
      expect(result).toBe("file:///test/downloaded.jpg");
    });

    it("cleans up destination file and returns null on download failure", async () => {
      (File.downloadFileAsync as jest.Mock).mockImplementationOnce(
        async (_url, dest) => {
          mockFileExistsMap.set(dest.uri, true);
          throw new Error("network failed");
        },
      );

      const result = await saveCoverArt(
        "al-fail",
        "https://example.com/art.jpg",
      );

      expect(result).toBeNull();
      expect(mockFileDelete).toHaveBeenCalled();
    });
  });

  describe("deleteCachedCoverArt", () => {
    it("deletes file if it exists", () => {
      const dir = getCoverCacheDirectory();
      const targetUri = `${dir.uri}/${getCoverFileName("al-del")}`;
      mockFileExistsMap.set(targetUri, true);

      deleteCachedCoverArt("al-del");

      expect(mockFileDelete).toHaveBeenCalled();
    });

    it("does nothing if file does not exist", () => {
      deleteCachedCoverArt("al-not-found");
      expect(mockFileDelete).not.toHaveBeenCalled();
    });
  });

  describe("clearAllCachedCoverArt", () => {
    it("deletes cover cache directory if it exists", () => {
      mockDirectoryExists.current = true;
      clearAllCachedCoverArt();
      expect(mockDirectoryDelete).toHaveBeenCalled();
    });

    it("does not crash if directory does not exist", () => {
      mockDirectoryExists.current = false;
      expect(() => clearAllCachedCoverArt()).not.toThrow();
    });
  });
});
