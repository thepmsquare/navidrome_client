import { Directory, File, Paths } from "expo-file-system";
import {
  calculateDirectorySizeBytes,
  checkLegacyOfflineCache,
  deleteLegacyOfflineCache,
  formatBytes,
  getLegacyOfflineDirectory,
} from "@/services/legacyCache";

const mockDelete = jest.fn();

class MockFile {
  uri: string;
  size: number;
  constructor(uri: string, size = 1024) {
    this.uri = uri;
    this.size = size;
  }
}

class MockDirectory {
  uri: string;
  exists: boolean;
  children: (MockDirectory | MockFile)[];
  delete = mockDelete;

  constructor(
    uri: string,
    exists = true,
    children: (MockDirectory | MockFile)[] = [],
  ) {
    this.uri = uri;
    this.exists = exists;
    this.children = children;
  }

  list() {
    if (!this.exists) {
      throw new Error("directory does not exist");
    }
    return this.children;
  }
}

jest.mock("expo-file-system", () => {
  const mockParent = {
    uri: "file:///data/user/0/com.thepmsquare.navidrome_client",
  };
  return {
    Paths: {
      document: {
        uri: "file:///data/user/0/com.thepmsquare.navidrome_client/files",
        parentDirectory: mockParent,
      },
    },
    Directory: jest.fn().mockImplementation((parent: any, ...parts: string[]) => {
      const parentUri = typeof parent === "string" ? parent : parent?.uri || "";
      const path = [parentUri, ...parts].join("/").replace(/\/+/g, "/");
      return new MockDirectory(path);
    }),
    File: jest.fn(),
  };
});

describe("legacyCache service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("formatBytes", () => {
    it("formats 0 bytes correctly", () => {
      expect(formatBytes(0)).toBe("0 b");
      expect(formatBytes(-10)).toBe("0 b");
    });

    it("formats kilobytes, megabytes, and gigabytes", () => {
      expect(formatBytes(1024)).toBe("1 kb");
      expect(formatBytes(1536)).toBe("1.5 kb");
      expect(formatBytes(1048576)).toBe("1 mb");
      expect(formatBytes(1073741824)).toBe("1 gb");
    });
  });

  describe("getLegacyOfflineDirectory", () => {
    it("resolves the app_flutter/offline directory", () => {
      const dir = getLegacyOfflineDirectory();
      expect(dir).toBeDefined();
      expect(dir?.uri).toContain("app_flutter/offline");
    });
  });

  describe("calculateDirectorySizeBytes", () => {
    it("returns 0 if directory does not exist", () => {
      const dir = new MockDirectory("file:///test/offline", false) as any;
      expect(calculateDirectorySizeBytes(dir)).toBe(0);
    });

    it("sums file sizes across nested directories", () => {
      const tracksDir = new MockDirectory("file:///test/offline/tracks", true, [
        new MockFile("file:///test/offline/tracks/1.mp3", 500000) as any,
        new MockFile("file:///test/offline/tracks/2.mp3", 500000) as any,
      ]);
      const coversDir = new MockDirectory("file:///test/offline/covers", true, [
        new MockFile("file:///test/offline/covers/c1.jpg", 20000) as any,
      ]);
      const rootDir = new MockDirectory("file:///test/offline", true, [
        tracksDir,
        coversDir,
        new MockFile("file:///test/offline/meta.json", 1000) as any,
      ]) as any;

      expect(calculateDirectorySizeBytes(rootDir)).toBe(1021000);
    });
  });

  describe("checkLegacyOfflineCache", () => {
    it("returns exists: false when directory does not exist", async () => {
      const dir = new MockDirectory("file:///test/offline", false) as any;
      const result = await checkLegacyOfflineCache(dir);
      expect(result).toEqual({
        exists: false,
        sizeBytes: 0,
        uri: "file:///test/offline",
      });
    });

    it("returns exists: false when directory is empty", async () => {
      const dir = new MockDirectory("file:///test/offline", true, []) as any;
      const result = await checkLegacyOfflineCache(dir);
      expect(result).toEqual({
        exists: false,
        sizeBytes: 0,
        uri: "file:///test/offline",
      });
    });

    it("returns exists: true with size when legacy cache files are present", async () => {
      const dir = new MockDirectory("file:///test/offline", true, [
        new MockFile("file:///test/offline/1.mp3", 4000000) as any,
      ]) as any;
      const result = await checkLegacyOfflineCache(dir);
      expect(result.exists).toBe(true);
      expect(result.sizeBytes).toBe(4000000);
    });
  });

  describe("deleteLegacyOfflineCache", () => {
    it("deletes the directory if it exists", async () => {
      const dir = new MockDirectory("file:///test/offline", true) as any;
      const result = await deleteLegacyOfflineCache(dir);
      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
    });

    it("does not throw when directory does not exist", async () => {
      const dir = new MockDirectory("file:///test/offline", false) as any;
      const result = await deleteLegacyOfflineCache(dir);
      expect(mockDelete).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("handles delete failures gracefully", async () => {
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const dir = new MockDirectory("file:///test/offline", true) as any;
      dir.delete = jest.fn().mockImplementation(() => {
        throw new Error("permission denied");
      });
      const result = await deleteLegacyOfflineCache(dir);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      consoleSpy.mockRestore();
    });
  });
});
