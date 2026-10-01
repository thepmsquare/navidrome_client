import {
  getLyricsMode,
  isSyncedLyrics,
  needsOnlineLookup,
  pickLyrics,
  resetLyricsMode,
  setLyricsMode,
  subscribeLyricsMode,
} from "@/services/lyrics";
import { getLyricsModeSetting, setLyricsModeSetting } from "@/services/db";
import { NormalizedLyrics } from "@/types";

jest.mock("@/services/db", () => ({
  getDb: jest.fn(),
  getLyricsCacheEntrySync: jest.fn(),
  getLyricsModeSetting: jest.fn(() => "file_only"),
  getSongById: jest.fn(),
  setLyricsModeSetting: jest.fn(),
  upsertLyricsCacheEntry: jest.fn(),
}));

jest.mock("@/services/api", () => ({
  getLyricsBySongId: jest.fn(),
}));

jest.mock("@/services/lrclib", () => ({
  fetchLyricsFromLrclib: jest.fn(),
}));

describe("lyrics service: mode and selection logic", () => {
  const syncedLyrics: NormalizedLyrics = {
    synced: true,
    lines: [
      { startMs: 1000, text: "synced line 1" },
      { startMs: 2000, text: "synced line 2" },
    ],
  };

  const unsyncedLyrics: NormalizedLyrics = {
    synced: false,
    lines: [{ text: "unsynced line 1" }, { text: "unsynced line 2" }],
  };

  describe("isSyncedLyrics", () => {
    it("should return true for timestamped lyrics", () => {
      expect(isSyncedLyrics(syncedLyrics)).toBe(true);
    });

    it("should return false for plain unsynced lyrics", () => {
      expect(isSyncedLyrics(unsyncedLyrics)).toBe(false);
    });

    it("should return false for null/undefined or empty lines", () => {
      expect(isSyncedLyrics(null)).toBe(false);
      expect(isSyncedLyrics(undefined)).toBe(false);
      expect(isSyncedLyrics({ synced: true, lines: [] })).toBe(false);
    });
  });

  describe("pickLyrics matrix", () => {
    describe("mode: file_only", () => {
      it("should always return server lyrics and ignore online lyrics", () => {
        // File synced
        expect(pickLyrics("file_only", syncedLyrics, syncedLyrics)).toBe(syncedLyrics);
        expect(pickLyrics("file_only", syncedLyrics, unsyncedLyrics)).toBe(syncedLyrics);
        expect(pickLyrics("file_only", syncedLyrics, null)).toBe(syncedLyrics);

        // File unsynced
        expect(pickLyrics("file_only", unsyncedLyrics, syncedLyrics)).toBe(unsyncedLyrics);
        expect(pickLyrics("file_only", unsyncedLyrics, unsyncedLyrics)).toBe(unsyncedLyrics);
        expect(pickLyrics("file_only", unsyncedLyrics, null)).toBe(unsyncedLyrics);

        // File none
        expect(pickLyrics("file_only", null, syncedLyrics)).toBeNull();
        expect(pickLyrics("file_only", null, unsyncedLyrics)).toBeNull();
        expect(pickLyrics("file_only", null, null)).toBeNull();
      });

      it("should return null if server is instrumental", () => {
        expect(
          pickLyrics("file_only", null, syncedLyrics, "instrumental", "found"),
        ).toBeNull();
      });
    });

    describe("mode: file_first", () => {
      it("when server lyrics are synced, online lyrics never override them", () => {
        expect(pickLyrics("file_first", syncedLyrics, syncedLyrics)).toBe(syncedLyrics);
        expect(pickLyrics("file_first", syncedLyrics, unsyncedLyrics)).toBe(syncedLyrics);
        expect(pickLyrics("file_first", syncedLyrics, null)).toBe(syncedLyrics);
      });

      it("when server lyrics are unsynced, online synced lyrics WIN", () => {
        expect(pickLyrics("file_first", unsyncedLyrics, syncedLyrics)).toBe(syncedLyrics);
      });

      it("when server lyrics are unsynced, online plain or missing lyrics do NOT override server", () => {
        expect(pickLyrics("file_first", unsyncedLyrics, unsyncedLyrics)).toBe(unsyncedLyrics);
        expect(pickLyrics("file_first", unsyncedLyrics, null)).toBe(unsyncedLyrics);
      });

      it("when server lyrics are missing, uses whatever online returns", () => {
        expect(pickLyrics("file_first", null, syncedLyrics)).toBe(syncedLyrics);
        expect(pickLyrics("file_first", null, unsyncedLyrics)).toBe(unsyncedLyrics);
        expect(pickLyrics("file_first", null, null)).toBeNull();
      });

      it("should return null if server is instrumental", () => {
        expect(
          pickLyrics("file_first", null, syncedLyrics, "instrumental", "found"),
        ).toBeNull();
      });

      it("should return null if server is missing and online is instrumental", () => {
        expect(
          pickLyrics("file_first", null, null, "none", "instrumental"),
        ).toBeNull();
      });
    });

    describe("mode: online_first", () => {
      it("prefers online lyrics (synced or plain)", () => {
        expect(pickLyrics("online_first", syncedLyrics, syncedLyrics)).toBe(syncedLyrics);
        expect(pickLyrics("online_first", syncedLyrics, unsyncedLyrics)).toBe(unsyncedLyrics);
        expect(pickLyrics("online_first", unsyncedLyrics, syncedLyrics)).toBe(syncedLyrics);
        expect(pickLyrics("online_first", unsyncedLyrics, unsyncedLyrics)).toBe(unsyncedLyrics);
        expect(pickLyrics("online_first", null, syncedLyrics)).toBe(syncedLyrics);
        expect(pickLyrics("online_first", null, unsyncedLyrics)).toBe(unsyncedLyrics);
      });

      it("falls back to server lyrics when online has nothing", () => {
        expect(pickLyrics("online_first", syncedLyrics, null)).toBe(syncedLyrics);
        expect(pickLyrics("online_first", unsyncedLyrics, null)).toBe(unsyncedLyrics);
        expect(pickLyrics("online_first", null, null)).toBeNull();
      });

      it("should return null if online is instrumental", () => {
        expect(
          pickLyrics("online_first", syncedLyrics, null, "found", "instrumental"),
        ).toBeNull();
      });
    });
  });

  describe("needsOnlineLookup", () => {
    it("should always return false for file_only", () => {
      expect(needsOnlineLookup("file_only", syncedLyrics)).toBe(false);
      expect(needsOnlineLookup("file_only", unsyncedLyrics)).toBe(false);
      expect(needsOnlineLookup("file_only", null)).toBe(false);
    });

    it("should always return true for online_first", () => {
      expect(needsOnlineLookup("online_first", syncedLyrics)).toBe(true);
      expect(needsOnlineLookup("online_first", unsyncedLyrics)).toBe(true);
      expect(needsOnlineLookup("online_first", null)).toBe(true);
    });

    it("for file_first: returns false if server has synced lyrics", () => {
      expect(needsOnlineLookup("file_first", syncedLyrics)).toBe(false);
    });

    it("for file_first: returns true if server has unsynced lyrics or missing", () => {
      expect(needsOnlineLookup("file_first", unsyncedLyrics)).toBe(true);
      expect(needsOnlineLookup("file_first", null)).toBe(true);
    });

    it("for file_first: returns false if server is instrumental", () => {
      expect(needsOnlineLookup("file_first", null, "instrumental")).toBe(false);
    });
  });

  describe("lyrics mode settings & subscribers", () => {
    beforeEach(() => {
      resetLyricsMode();
      jest.clearAllMocks();
    });

    it("should default to file_only", () => {
      expect(getLyricsMode()).toBe("file_only");
    });

    it("setLyricsMode should update setting in db and notify subscribers", () => {
      const listener = jest.fn();
      const unsubscribe = subscribeLyricsMode(listener);

      // Immediately called with current mode
      expect(listener).toHaveBeenCalledWith("file_only");

      setLyricsMode("file_first");
      expect(setLyricsModeSetting).toHaveBeenCalledWith("file_first");
      expect(getLyricsMode()).toBe("file_first");
      expect(listener).toHaveBeenCalledWith("file_first");

      setLyricsMode("online_first");
      expect(listener).toHaveBeenCalledWith("online_first");

      unsubscribe();
      setLyricsMode("file_only");
      expect(listener).toHaveBeenCalledTimes(3); // not called after unsubscribe
    });

    it("resetLyricsMode should reset to file_only and notify subscribers", () => {
      setLyricsMode("online_first");
      expect(getLyricsMode()).toBe("online_first");

      const listener = jest.fn();
      subscribeLyricsMode(listener);
      expect(listener).toHaveBeenCalledWith("online_first");

      resetLyricsMode();
      expect(getLyricsMode()).toBe("file_only");
      expect(listener).toHaveBeenCalledWith("file_only");
    });
  });
});
