import {
  client_app_sync,
  getAlbum,
  getAlbumList2,
  refreshPlayStats,
  scrobble,
  subscribePlayStats,
} from "@/services/api";
import * as db from "@/services/db";
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

const mockWithTransactionSync = jest.fn((cb: () => void) => cb());

jest.mock("@/services/db", () => ({
  getDb: jest.fn(() => ({
    withTransactionSync: mockWithTransactionSync,
  })),
  getAlbumById: jest.fn(),
  getSongById: jest.fn(),
  updateAlbumPlayStats: jest.fn(),
  updateSongPlayStats: jest.fn(),
  getSyncMeta: jest.fn(),
  setSyncMeta: jest.fn(),
  getLocalCounts: jest.fn(() => ({
    artistCount: 1,
    albumCount: 2,
    songCount: 3,
    playlistCount: 4,
  })),
  upsertArtistsBatch: jest.fn(),
  upsertAlbumsBatch: jest.fn(),
  upsertSongsBatch: jest.fn(),
  upsertPlaylistsBatch: jest.fn(),
}));

describe("refreshPlayStats and helpers", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockImplementation(
      async (key: string) => {
        if (key === "serverUrl") return "https://music.example.com/";
        if (key === "username") return "demo_user";
        if (key === "password") return "demo_pass";
        if (key === "subsonicVersion") return "1.16.1";
        return null;
      },
    );
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe("getAlbumList2", () => {
    it("should fetch albums with type=recent and size=30", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          "subsonic-response": {
            status: "ok",
            version: "1.16.1",
            albumList2: {
              album: [
                {
                  id: "alb-1",
                  name: "album 1",
                  playCount: 10,
                  played: "2026-10-01T00:00:00Z",
                },
              ],
            },
          },
        }),
      });

      const albums = await getAlbumList2({ type: "recent", size: 30 });
      expect(albums).toHaveLength(1);
      expect(albums[0].id).toBe("alb-1");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("type=recent"),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("size=30"),
      );
    });

    it("should return empty array if no albums found in response", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          "subsonic-response": {
            status: "ok",
            version: "1.16.1",
            albumList2: {},
          },
        }),
      });

      const albums = await getAlbumList2("frequent", 30);
      expect(albums).toEqual([]);
    });

    it("should throw error if response status is not ok", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          "subsonic-response": {
            status: "failed",
            error: { code: 10, message: "required parameter is missing" },
          },
        }),
      });

      await expect(getAlbumList2({ type: "recent" })).rejects.toThrow(
        "required parameter is missing",
      );
    });
  });

  describe("getAlbum", () => {
    it("should throw if albumId is empty", async () => {
      await expect(getAlbum("")).rejects.toThrow("albumId is required");
    });

    it("should fetch album details with song list", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          "subsonic-response": {
            status: "ok",
            version: "1.16.1",
            album: {
              id: "alb-1",
              name: "album 1",
              song: [
                {
                  id: "song-1",
                  title: "track 1",
                  playCount: 5,
                  played: "2026-10-01T00:00:00Z",
                },
              ],
            },
          },
        }),
      });

      const album = await getAlbum("alb-1");
      expect(album.id).toBe("alb-1");
      expect(album.song).toHaveLength(1);
      expect(album.song?.[0].id).toBe("song-1");
    });
  });

  describe("refreshPlayStats", () => {
    it("unchanged albums skipped: should skip albums where played and playCount match local row", async () => {
      // Server returns alb-1 with played=2026-10-01 and playCount=5
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes("type=recent") || url.includes("type=frequent")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              "subsonic-response": {
                status: "ok",
                version: "1.16.1",
                albumList2: {
                  album: [
                    {
                      id: "alb-1",
                      name: "album 1",
                      played: "2026-10-01T00:00:00Z",
                      playCount: 5,
                    },
                  ],
                },
              },
            }),
          });
        }
        return Promise.reject(new Error("unexpected request"));
      });

      // Local DB already has alb-1 with the same played and playCount
      (db.getAlbumById as jest.Mock).mockReturnValue({
        id: "alb-1",
        name: "album 1",
        artist: "artist 1",
        played: "2026-10-01T00:00:00Z",
        playCount: 5,
      });

      const result = await refreshPlayStats();

      expect(result).toEqual({
        refreshed: true,
        albumsUpdated: 0,
        songsUpdated: 0,
      });
      // No album updates were run
      expect(db.updateAlbumPlayStats).not.toHaveBeenCalled();
      // No getAlbum call made because album was unchanged
      expect(global.fetch).toHaveBeenCalledTimes(2); // Only recent and frequent
    });

    it("unknown album ids ignored: should skip albums that do not exist locally", async () => {
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes("type=recent") || url.includes("type=frequent")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              "subsonic-response": {
                status: "ok",
                version: "1.16.1",
                albumList2: {
                  album: [
                    {
                      id: "alb-unknown",
                      name: "unknown album",
                      played: "2026-10-01T00:00:00Z",
                      playCount: 10,
                    },
                  ],
                },
              },
            }),
          });
        }
        return Promise.reject(new Error("unexpected request"));
      });

      // Local DB does not have this album
      (db.getAlbumById as jest.Mock).mockReturnValue(null);

      const result = await refreshPlayStats();

      expect(result).toEqual({
        refreshed: true,
        albumsUpdated: 0,
        songsUpdated: 0,
      });
      expect(db.updateAlbumPlayStats).not.toHaveBeenCalled();
      expect(db.updateSongPlayStats).not.toHaveBeenCalled();
      // Only recent and frequent fetched, getAlbum not called
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("other columns untouched: should only update played and playCount", async () => {
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes("type=recent") || url.includes("type=frequent")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              "subsonic-response": {
                status: "ok",
                version: "1.16.1",
                albumList2: {
                  album: [
                    {
                      id: "alb-1",
                      name: "new album name from server",
                      artist: "new artist name from server",
                      played: "2026-10-02T12:00:00Z",
                      playCount: 15,
                    },
                  ],
                },
              },
            }),
          });
        }
        if (url.includes("getAlbum.view")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              "subsonic-response": {
                status: "ok",
                version: "1.16.1",
                album: {
                  id: "alb-1",
                  name: "new album name",
                  song: [
                    {
                      id: "song-1",
                      title: "new song title from server",
                      artist: "new artist from server",
                      played: "2026-10-02T12:00:00Z",
                      playCount: 8,
                    },
                  ],
                },
              },
            }),
          });
        }
        return Promise.reject(new Error("unexpected request"));
      });

      (db.getAlbumById as jest.Mock).mockReturnValue({
        id: "alb-1",
        name: "original album name",
        artist: "original artist",
        starred: "2025-01-01",
        userRating: 5,
        played: "2026-10-01T00:00:00Z",
        playCount: 10,
      });

      (db.getSongById as jest.Mock).mockReturnValue({
        id: "song-1",
        title: "original song title",
        artist: "original artist",
        starred: "2025-01-01",
        userRating: 4,
        played: "2026-10-01T00:00:00Z",
        playCount: 5,
      });

      (db.updateAlbumPlayStats as jest.Mock).mockReturnValue(true);
      (db.updateSongPlayStats as jest.Mock).mockReturnValue(true);

      const result = await refreshPlayStats();

      expect(result).toEqual({
        refreshed: true,
        albumsUpdated: 1,
        songsUpdated: 1,
      });

      // Verify updateAlbumPlayStats was called with ONLY (id, played, playCount)
      expect(db.updateAlbumPlayStats).toHaveBeenCalledWith(
        "alb-1",
        "2026-10-02T12:00:00Z",
        15,
      );

      // Verify updateSongPlayStats was called with ONLY (id, played, playCount)
      expect(db.updateSongPlayStats).toHaveBeenCalledWith(
        "song-1",
        "2026-10-02T12:00:00Z",
        8,
      );
    });

    it("network failure returning refreshed: false without throwing on getAlbumList2 failure", async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error("network request failed"));

      const result = await refreshPlayStats();

      expect(result).toEqual({ refreshed: false });
      // Local database was never touched
      expect(db.updateAlbumPlayStats).not.toHaveBeenCalled();
      expect(db.updateSongPlayStats).not.toHaveBeenCalled();
    });

    it("network failure returning refreshed: false without throwing on getAlbum failure", async () => {
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes("type=recent") || url.includes("type=frequent")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              "subsonic-response": {
                status: "ok",
                version: "1.16.1",
                albumList2: {
                  album: [
                    {
                      id: "alb-1",
                      name: "album 1",
                      played: "2026-10-02T10:00:00Z",
                      playCount: 20,
                    },
                  ],
                },
              },
            }),
          });
        }
        if (url.includes("getAlbum.view")) {
          // getAlbum fails with network error
          return Promise.reject(new Error("getAlbum network failed"));
        }
        return Promise.reject(new Error("unexpected request"));
      });

      (db.getAlbumById as jest.Mock).mockReturnValue({
        id: "alb-1",
        name: "album 1",
        played: "2026-10-01T00:00:00Z",
        playCount: 10,
      });

      const result = await refreshPlayStats();

      expect(result).toEqual({ refreshed: false });
      // Local data is untouched because getAlbum failed before applying updates
      expect(db.updateAlbumPlayStats).not.toHaveBeenCalled();
      expect(db.updateSongPlayStats).not.toHaveBeenCalled();
    });

    it("should update changed albums and matching changed songs only", async () => {
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes("type=recent")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              "subsonic-response": {
                status: "ok",
                version: "1.16.1",
                albumList2: {
                  album: [
                    {
                      id: "alb-1",
                      name: "album 1",
                      played: "2026-10-02T15:00:00Z",
                      playCount: 12,
                    },
                  ],
                },
              },
            }),
          });
        }
        if (url.includes("type=frequent")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              "subsonic-response": {
                status: "ok",
                version: "1.16.1",
                albumList2: {
                  album: [
                    {
                      id: "alb-1",
                      name: "album 1",
                      played: "2026-10-02T15:00:00Z",
                      playCount: 12,
                    },
                  ],
                },
              },
            }),
          });
        }
        if (url.includes("getAlbum.view")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              "subsonic-response": {
                status: "ok",
                version: "1.16.1",
                album: {
                  id: "alb-1",
                  name: "album 1",
                  song: [
                    {
                      id: "s-changed",
                      title: "song changed",
                      played: "2026-10-02T15:00:00Z",
                      playCount: 8,
                    },
                    {
                      id: "s-unchanged",
                      title: "song unchanged",
                      played: "2026-10-01T00:00:00Z",
                      playCount: 4,
                    },
                    {
                      id: "s-not-local",
                      title: "song not local",
                      played: "2026-10-02T15:00:00Z",
                      playCount: 1,
                    },
                  ],
                },
              },
            }),
          });
        }
        return Promise.reject(new Error("unexpected request"));
      });

      (db.getAlbumById as jest.Mock).mockReturnValue({
        id: "alb-1",
        played: "2026-10-01T00:00:00Z",
        playCount: 10,
      });

      (db.getSongById as jest.Mock).mockImplementation((songId: string) => {
        if (songId === "s-changed") {
          return {
            id: "s-changed",
            played: "2026-10-01T00:00:00Z",
            playCount: 6,
          };
        }
        if (songId === "s-unchanged") {
          return {
            id: "s-unchanged",
            played: "2026-10-01T00:00:00Z",
            playCount: 4,
          };
        }
        return null; // s-not-local
      });

      (db.updateAlbumPlayStats as jest.Mock).mockReturnValue(true);
      (db.updateSongPlayStats as jest.Mock).mockReturnValue(true);

      const result = await refreshPlayStats();

      expect(result).toEqual({
        refreshed: true,
        albumsUpdated: 1,
        songsUpdated: 1,
      });

      expect(db.updateAlbumPlayStats).toHaveBeenCalledWith(
        "alb-1",
        "2026-10-02T15:00:00Z",
        12,
      );
      expect(db.updateSongPlayStats).toHaveBeenCalledWith(
        "s-changed",
        "2026-10-02T15:00:00Z",
        8,
      );
      expect(db.updateSongPlayStats).not.toHaveBeenCalledWith(
        "s-unchanged",
        expect.anything(),
        expect.anything(),
      );
      expect(db.updateSongPlayStats).not.toHaveBeenCalledWith(
        "s-not-local",
        expect.anything(),
        expect.anything(),
      );
    });

    it("notifies play stats updated when rows are updated", async () => {
      const listener = jest.fn();
      const unsubscribe = subscribePlayStats(listener);

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes("type=recent") || url.includes("type=frequent")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              "subsonic-response": {
                status: "ok",
                version: "1.16.1",
                albumList2: {
                  album: [
                    {
                      id: "alb-notify",
                      name: "Notify Album",
                      played: "2026-10-02T15:00:00Z",
                      playCount: 15,
                    },
                  ],
                },
              },
            }),
          });
        }
        if (url.includes("getAlbum.view")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              "subsonic-response": {
                status: "ok",
                version: "1.16.1",
                album: {
                  id: "alb-notify",
                  name: "Notify Album",
                  song: [],
                },
              },
            }),
          });
        }
        return Promise.reject(new Error(`unexpected url: ${url}`));
      });

      (db.getAlbumById as jest.Mock).mockReturnValue({
        id: "alb-notify",
        played: "2026-10-01T00:00:00Z",
        playCount: 10,
      });
      (db.updateAlbumPlayStats as jest.Mock).mockReturnValue(true);

      const res = await refreshPlayStats();
      expect(res).toEqual({
        refreshed: true,
        albumsUpdated: 1,
        songsUpdated: 0,
      });
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
    });

    it("does not notify play stats updated when no rows are updated", async () => {
      const listener = jest.fn();
      const unsubscribe = subscribePlayStats(listener);

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes("type=recent") || url.includes("type=frequent")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              "subsonic-response": {
                status: "ok",
                version: "1.16.1",
                albumList2: {
                  album: [
                    {
                      id: "alb-same",
                      name: "Same Album",
                      played: "2026-10-01T00:00:00Z",
                      playCount: 10,
                    },
                  ],
                },
              },
            }),
          });
        }
        return Promise.reject(new Error(`unexpected url: ${url}`));
      });

      (db.getAlbumById as jest.Mock).mockReturnValue({
        id: "alb-same",
        played: "2026-10-01T00:00:00Z",
        playCount: 10,
      });

      const res = await refreshPlayStats();
      expect(res).toEqual({
        refreshed: true,
        albumsUpdated: 0,
        songsUpdated: 0,
      });
      expect(listener).not.toHaveBeenCalled();

      unsubscribe();
    });

    it("timeout returns refreshed: false", async () => {
      global.fetch = jest.fn().mockImplementation((_url: string, _init?: any) => {
        const err = new Error("The operation was aborted due to timeout");
        err.name = "AbortError";
        return Promise.reject(err);
      });

      const res = await refreshPlayStats();
      expect(res).toEqual({ refreshed: false });
    });
  });

  describe("client_app_sync wiring with refreshPlayStats", () => {
    it("sync skipped by gate still calls refreshPlayStats", async () => {
      (db.getSyncMeta as jest.Mock).mockReturnValue("2026-10-01T12:00:00Z");

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes("getScanStatus.view")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              "subsonic-response": {
                status: "ok",
                version: "1.16.1",
                scanStatus: {
                  scanning: false,
                  count: 100,
                  lastScan: "2026-10-01T12:00:00Z",
                },
              },
            }),
          });
        }
        if (url.includes("type=recent") || url.includes("type=frequent")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              "subsonic-response": {
                status: "ok",
                version: "1.16.1",
                albumList2: {
                  album: [
                    {
                      id: "alb-changed",
                      name: "Album Changed",
                      played: "2026-10-02T16:00:00Z",
                      playCount: 20,
                    },
                  ],
                },
              },
            }),
          });
        }
        if (url.includes("getAlbum.view")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              "subsonic-response": {
                status: "ok",
                version: "1.16.1",
                album: {
                  id: "alb-changed",
                  name: "Album Changed",
                  song: [],
                },
              },
            }),
          });
        }
        return Promise.reject(new Error(`unexpected url: ${url}`));
      });

      (db.getAlbumById as jest.Mock).mockReturnValue({
        id: "alb-changed",
        name: "Album Changed",
        played: "2026-10-01T12:00:00Z",
        playCount: 10,
      });
      (db.updateAlbumPlayStats as jest.Mock).mockReturnValue(true);

      const res = await client_app_sync(false);

      // Gate decided catalog is unchanged
      expect(res.synced).toBe(false);
      // But refreshPlayStats ran and updated play stats
      expect(res.playStatsRefreshed).toBe(true);
      expect(db.updateAlbumPlayStats).toHaveBeenCalledWith(
        "alb-changed",
        "2026-10-02T16:00:00Z",
        20,
      );
      // Catalog upserts were NOT called
      expect(db.upsertArtistsBatch).not.toHaveBeenCalled();
    });

    it("force sync doesn't call it twice (skips refreshPlayStats because full sync runs)", async () => {
      (db.getSyncMeta as jest.Mock).mockReturnValue(null);

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes("getScanStatus.view")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              "subsonic-response": {
                status: "ok",
                version: "1.16.1",
                scanStatus: {
                  scanning: false,
                  count: 10,
                  lastScan: "2026-10-02T12:00:00Z",
                },
              },
            }),
          });
        }
        if (url.includes("search3.view")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              "subsonic-response": {
                status: "ok",
                version: "1.16.1",
                searchResult3: {},
              },
            }),
          });
        }
        if (url.includes("getPlaylists.view")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              "subsonic-response": {
                status: "ok",
                version: "1.16.1",
                playlists: { playlist: [] },
              },
            }),
          });
        }
        if (url.includes("getAlbumList2.view")) {
          throw new Error("getAlbumList2 should NOT be called on force sync");
        }
        return Promise.reject(new Error(`unexpected url: ${url}`));
      });

      const res = await client_app_sync(true);

      expect(res.synced).toBe(true);
      expect(res.playStatsRefreshed).toBe(false);
      expect(db.updateAlbumPlayStats).not.toHaveBeenCalled();
    });

    it("playStatsRefreshed flag set correctly when albums/songs are updated vs not", async () => {
      (db.getSyncMeta as jest.Mock).mockReturnValue("2026-10-01T12:00:00Z");

      // Case: No albums changed
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes("getScanStatus.view")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              "subsonic-response": {
                status: "ok",
                version: "1.16.1",
                scanStatus: {
                  scanning: false,
                  count: 100,
                  lastScan: "2026-10-01T12:00:00Z",
                },
              },
            }),
          });
        }
        if (url.includes("getAlbumList2.view")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              "subsonic-response": {
                status: "ok",
                version: "1.16.1",
                albumList2: {
                  album: [
                    {
                      id: "alb-same",
                      name: "Same Album",
                      played: "2026-10-01T12:00:00Z",
                      playCount: 10,
                    },
                  ],
                },
              },
            }),
          });
        }
        return Promise.reject(new Error(`unexpected url: ${url}`));
      });

      (db.getAlbumById as jest.Mock).mockReturnValue({
        id: "alb-same",
        name: "Same Album",
        played: "2026-10-01T12:00:00Z",
        playCount: 10,
      });

      const res = await client_app_sync(false);

      expect(res.synced).toBe(false);
      expect(res.playStatsRefreshed).toBe(false);
    });

    it("refresh failure doesn't change the sync result and does not throw", async () => {
      (db.getSyncMeta as jest.Mock).mockReturnValue("2026-10-01T12:00:00Z");

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes("getScanStatus.view")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              "subsonic-response": {
                status: "ok",
                version: "1.16.1",
                scanStatus: {
                  scanning: false,
                  count: 100,
                  lastScan: "2026-10-01T12:00:00Z",
                },
              },
            }),
          });
        }
        if (url.includes("getAlbumList2.view")) {
          return Promise.reject(new Error("network failure during play stats refresh"));
        }
        return Promise.reject(new Error(`unexpected url: ${url}`));
      });

      const res = await client_app_sync(false);

      expect(res.synced).toBe(false);
      expect(res.playStatsRefreshed).toBe(false);
      expect(res.lastScan).toBe("2026-10-01T12:00:00Z");
    });
  });

  describe("scrobble play stats updating", () => {
    it("scrobble success bumps local stats on song and parent album", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          "subsonic-response": {
            status: "ok",
            version: "1.16.1",
          },
        }),
      });

      (db.getSongById as jest.Mock).mockReturnValue({
        id: "song-1",
        title: "Track 1",
        playCount: 5,
        albumId: "alb-1",
      });

      (db.getAlbumById as jest.Mock).mockReturnValue({
        id: "alb-1",
        name: "Album 1",
        playCount: 12,
      });

      const originalPlayTime = 1700000000000;
      const res = await scrobble({
        id: "song-1",
        submission: true,
        time: originalPlayTime,
      });

      expect(res).toBe(true);
      expect(db.updateSongPlayStats).toHaveBeenCalledWith(
        "song-1",
        new Date(originalPlayTime).toISOString(),
        6,
      );
      expect(db.updateAlbumPlayStats).toHaveBeenCalledWith(
        "alb-1",
        new Date(originalPlayTime).toISOString(),
        13,
      );
    });

    it("scrobble acknowledgement without time param falls back to current time", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          "subsonic-response": {
            status: "ok",
            version: "1.16.1",
          },
        }),
      });

      (db.getSongById as jest.Mock).mockReturnValue({
        id: "song-1",
        title: "Track 1",
        playCount: 5,
        albumId: "alb-1",
      });

      (db.getAlbumById as jest.Mock).mockReturnValue({
        id: "alb-1",
        name: "Album 1",
        playCount: 12,
      });

      const before = new Date().toISOString();
      const res = await scrobble({
        id: "song-1",
        submission: true,
      });
      const after = new Date().toISOString();

      expect(res).toBe(true);
      const songPlayedArg = (db.updateSongPlayStats as jest.Mock).mock.calls[0][1];
      expect(songPlayedArg >= before && songPlayedArg <= after).toBe(true);
    });

    it("queued / unsent scrobble does not bump local stats when server fails", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      (db.getSongById as jest.Mock).mockReturnValue({
        id: "song-1",
        title: "Track 1",
        playCount: 5,
        albumId: "alb-1",
      });

      await expect(
        scrobble({
          id: "song-1",
          submission: true,
          time: 123456789,
        }),
      ).rejects.toThrow("scrobble request failed with status 500");

      expect(db.updateSongPlayStats).not.toHaveBeenCalled();
      expect(db.updateAlbumPlayStats).not.toHaveBeenCalled();
    });

    it("now playing ping (submission: false) does not bump local stats", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          "subsonic-response": {
            status: "ok",
            version: "1.16.1",
          },
        }),
      });

      (db.getSongById as jest.Mock).mockReturnValue({
        id: "song-1",
        title: "Track 1",
        playCount: 5,
        albumId: "alb-1",
      });

      const res = await scrobble({
        id: "song-1",
        submission: false,
      });

      expect(res).toBe(true);
      expect(db.updateSongPlayStats).not.toHaveBeenCalled();
      expect(db.updateAlbumPlayStats).not.toHaveBeenCalled();
    });
  });
});

