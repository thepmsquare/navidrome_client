import {
  client_app_sync,
  getCoverArtBaseUrl,
  getPlaylist,
  getPlaylists,
  getScanStatus,
  getSongDownloadUrl,
  getSongStreamUrl,
  getStoredCredentials,
  login,
  notifyAuthState,
  ping,
  scrobble,
  scrobbleSong,
  search3,
  subscribeAuthState,
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

jest.mock("@/services/player", () => ({
  resetPlayer: jest.fn(),
}));

jest.mock("@/services/songCache", () => ({
  clearAllCachedSongs: jest.fn(),
}));

jest.mock("@/services/db", () => ({
  clearDatabase: jest.fn(),
  getLocalCounts: jest.fn(() => ({
    artistCount: 1,
    albumCount: 2,
    songCount: 3,
    playlistCount: 4,
  })),
  getSyncMeta: jest.fn(),
  setSyncMeta: jest.fn(),
  upsertAlbumsBatch: jest.fn(),
  upsertArtistsBatch: jest.fn(),
  upsertPlaylistsBatch: jest.fn(),
  upsertSongsBatch: jest.fn(),
}));

describe("api service", () => {
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

  describe("getStoredCredentials", () => {
    it("should return credentials if all are found", async () => {
      const creds = await getStoredCredentials();
      expect(creds).toEqual({
        serverUrl: "https://music.example.com/",
        username: "demo_user",
        password: "demo_pass",
      });
    });

    it("should throw error if any credential is missing", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      await expect(getStoredCredentials()).rejects.toThrow(
        "missing stored credentials",
      );
    });
  });

  describe("ping", () => {
    it("should return ping response for valid navidrome server", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          "subsonic-response": {
            status: "ok",
            version: "1.16.1",
            type: "navidrome",
            serverVersion: "0.54.0",
          },
        }),
      });

      const res = await ping("https://music.example.com");
      expect(res.status).toBe("ok");
      expect(res.type).toBe("navidrome");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://music.example.com/rest/ping?f=json",
      );
    });

    it("should throw error if fetch response is not ok", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(ping("https://music.example.com")).rejects.toThrow(
        "http error: 500",
      );
    });

    it("should throw error if server is not navidrome compatible", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          "subsonic-response": {
            status: "ok",
            version: "1.16.1",
            type: "other_server",
            serverVersion: "1.0",
          },
        }),
      });

      await expect(ping("https://music.example.com")).rejects.toThrow(
        "server is not navidrome compatible.",
      );
    });
  });

  describe("login", () => {
    it("should throw if subsonicVersion is missing in SecureStore", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation(
        async (key: string) => (key === "subsonicVersion" ? null : "val"),
      );

      await expect(
        login({
          serverUrl: "https://music.example.com",
          username: "user",
          password: "pass",
        }),
      ).rejects.toThrow("unable to find subsonic version.");
    });

    it("should succeed with valid response", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          "subsonic-response": {
            status: "ok",
            version: "1.16.1",
            type: "navidrome",
            serverVersion: "0.54.0",
          },
        }),
      });

      const res = await login({
        serverUrl: "https://music.example.com",
        username: "user",
        password: "pass",
      });
      expect(res.status).toBe("ok");
    });

    it("should throw if response is not ok", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(
        login({
          serverUrl: "https://music.example.com",
          username: "user",
          password: "pass",
        }),
      ).rejects.toThrow("http error: 401");
    });

    it("should throw error message from subsonic response if status is not ok", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          "subsonic-response": {
            status: "failed",
            version: "1.16.1",
            type: "navidrome",
            serverVersion: "0.54.0",
            error: {
              code: 40,
              message: "Wrong username or password",
            },
          },
        }),
      });

      await expect(
        login({
          serverUrl: "https://music.example.com",
          username: "user",
          password: "wrong",
        }),
      ).rejects.toThrow("Wrong username or password");
    });
  });

  describe("auth state subscriber", () => {
    it("should notify subscribed listeners and allow unsubscribe", () => {
      const listener = jest.fn();
      const unsubscribe = subscribeAuthState(listener);

      notifyAuthState(true);
      expect(listener).toHaveBeenCalledWith(true);

      unsubscribe();
      notifyAuthState(false);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should safely catch errors in listeners during notifyAuthState", () => {
      const failingListener = jest.fn(() => {
        throw new Error("listener error");
      });
      const unsubscribe = subscribeAuthState(failingListener);
      expect(() => notifyAuthState(true)).not.toThrow();
      unsubscribe();
    });
  });

  describe("search3", () => {
    it("should fetch search results with formatted query params", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          "subsonic-response": {
            status: "ok",
            version: "1.16.1",
            type: "navidrome",
            serverVersion: "0.54.0",
            searchResult3: {
              artist: [{ id: "art-1", name: "Artist 1" }],
              album: [{ id: "alb-1", name: "Album 1" }],
              song: [{ id: "s-1", title: "Song 1" }],
            },
          },
        }),
      });

      const res = await search3({
        query: "rock",
        artistCount: 10,
        artistOffset: 5,
        albumCount: 20,
        albumOffset: 15,
        songCount: 30,
        songOffset: 25,
        musicFolderId: "folder-1",
      });

      expect(res.artist).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("query=rock"),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("artistCount=10"),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("musicFolderId=folder-1"),
      );
    });

    it("should throw if response is not ok", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(search3({ query: "" })).rejects.toThrow("http error: 500");
    });

    it("should throw error message if status is failed", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          "subsonic-response": {
            status: "failed",
            version: "1.16.1",
            type: "navidrome",
            serverVersion: "0.54.0",
            error: {
              code: 10,
              message: "Search failed",
            },
          },
        }),
      });

      await expect(search3({ query: "test" })).rejects.toThrow("Search failed");
    });
  });

  describe("getScanStatus", () => {
    it("should return scan status if ok", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          "subsonic-response": {
            status: "ok",
            version: "1.16.1",
            type: "navidrome",
            serverVersion: "0.54.0",
            scanStatus: {
              scanning: false,
              count: 100,
              lastScan: "2026-09-01T12:00:00Z",
            },
          },
        }),
      });

      const status = await getScanStatus();
      expect(status.scanning).toBe(false);
      expect(status.lastScan).toBe("2026-09-01T12:00:00Z");
    });

    it("should throw if fetch response is not ok", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });
      await expect(getScanStatus()).rejects.toThrow("http error: 500");
    });

    it("should throw if scanStatus is missing in response", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          "subsonic-response": {
            status: "ok",
            version: "1.16.1",
            type: "navidrome",
            serverVersion: "0.54.0",
          },
        }),
      });
      await expect(getScanStatus()).rejects.toThrow(
        "missing scan status in response",
      );
    });

    it("should throw if response status is failed", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          "subsonic-response": {
            status: "failed",
            version: "1.16.1",
            type: "navidrome",
            serverVersion: "0.54.0",
            error: {
              code: 10,
              message: "scan status failed",
            },
          },
        }),
      });
      await expect(getScanStatus()).rejects.toThrow("scan status failed");
    });
  });

  describe("client_app_sync", () => {
    it("should skip sync if force is false and lastScan matches", async () => {
      (db.getSyncMeta as jest.Mock).mockImplementation((key: string) => {
        if (key === "lastScan") return "2026-09-01T12:00:00Z";
        if (key === "lastSyncedAt") return "2026-09-01T12:05:00Z";
        return null;
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          "subsonic-response": {
            status: "ok",
            version: "1.16.1",
            type: "navidrome",
            serverVersion: "0.54.0",
            scanStatus: {
              scanning: false,
              count: 100,
              lastScan: "2026-09-01T12:00:00Z",
            },
          },
        }),
      });

      const res = await client_app_sync(false);
      expect(res.synced).toBe(false);
      expect(res.artistCount).toBe(1);
      expect(res.lastScan).toBe("2026-09-01T12:00:00Z");
      expect(db.upsertArtistsBatch).not.toHaveBeenCalled();
    });

    it("should perform full sync with pagination and playlists", async () => {
      (db.getSyncMeta as jest.Mock).mockReturnValue(null);

      // 1. scanStatus response
      // 2. search3 batch response
      // 3. getPlaylists response
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            "subsonic-response": {
              status: "ok",
              version: "1.16.1",
              type: "navidrome",
              serverVersion: "0.54.0",
              scanStatus: {
                scanning: false,
                count: 1,
                lastScan: "2026-09-02T12:00:00Z",
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            "subsonic-response": {
              status: "ok",
              version: "1.16.1",
              type: "navidrome",
              serverVersion: "0.54.0",
              searchResult3: {
                artist: [{ id: "art-1", name: "Artist 1" }],
                album: [{ id: "alb-1", name: "Album 1" }],
                song: [{ id: "s-1", title: "Song 1" }],
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            "subsonic-response": {
              status: "ok",
              version: "1.16.1",
              type: "navidrome",
              serverVersion: "0.54.0",
              playlists: {
                playlist: [
                  {
                    id: "pl-1",
                    name: "Playlist 1",
                    songCount: 1,
                    duration: 120,
                    public: true,
                    created: "2026-01-01",
                    changed: "2026-01-02",
                  },
                ],
              },
            },
          }),
        });

      const res = await client_app_sync(true);

      expect(res.synced).toBe(true);
      expect(res.artistCount).toBe(1);
      expect(res.albumCount).toBe(1);
      expect(res.songCount).toBe(1);
      expect(res.playlistCount).toBe(1);
      expect(db.upsertArtistsBatch).toHaveBeenCalled();
      expect(db.upsertAlbumsBatch).toHaveBeenCalled();
      expect(db.upsertSongsBatch).toHaveBeenCalled();
      expect(db.upsertPlaylistsBatch).toHaveBeenCalled();
      expect(db.setSyncMeta).toHaveBeenCalledWith(
        "lastScan",
        "2026-09-02T12:00:00Z",
      );
      expect(db.setSyncMeta).toHaveBeenCalledWith(
        "lastSyncedAt",
        expect.any(String),
      );
    });

    it("should handle error when syncing playlists gracefully", async () => {
      (db.getSyncMeta as jest.Mock).mockReturnValue(null);

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            "subsonic-response": {
              status: "ok",
              version: "1.16.1",
              type: "navidrome",
              serverVersion: "0.54.0",
              scanStatus: {
                scanning: false,
                lastScan: "2026-09-02T12:00:00Z",
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            "subsonic-response": {
              status: "ok",
              version: "1.16.1",
              type: "navidrome",
              serverVersion: "0.54.0",
              searchResult3: {},
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        });

      const res = await client_app_sync(true);
      expect(res.synced).toBe(true);
      expect(res.playlistCount).toBe(0);
    });
  });

  describe("getCoverArtBaseUrl and getSongStreamUrl", () => {
    it("getCoverArtBaseUrl returns formatter that handles null, ids, and custom sizes", async () => {
      const getArtUrl = await getCoverArtBaseUrl();
      expect(getArtUrl(null)).toBeNull();
      expect(getArtUrl("cover-123")).toContain(
        "/rest/getCoverArt.view?u=demo_user",
      );
      expect(getArtUrl("cover-123")).toContain("id=cover-123");
      expect(getArtUrl("cover-123")).toContain("size=300");
      expect(getArtUrl("cover-123", 600)).toContain("size=600");

      const get600ArtUrl = await getCoverArtBaseUrl(600);
      expect(get600ArtUrl("cover-123")).toContain("size=600");
    });

    it("getSongStreamUrl returns url with songId", async () => {
      const url = await getSongStreamUrl("song-456");
      expect(url).toContain("/rest/stream.view?u=demo_user");
      expect(url).toContain("id=song-456");
    });

    it("getSongDownloadUrl returns url with songId", async () => {
      const url = await getSongDownloadUrl("song-456");
      expect(url).toContain("/rest/download.view?u=demo_user");
      expect(url).toContain("id=song-456");
    });
  });

  describe("scrobble and scrobbleSong", () => {
    it("scrobble should return true on success", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          "subsonic-response": {
            status: "ok",
            version: "1.16.1",
            type: "navidrome",
            serverVersion: "0.54.0",
          },
        }),
      });

      const res = await scrobble({
        id: "song-1",
        time: 12345,
        submission: true,
      });
      expect(res).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("id=song-1"),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("submission=true"),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("time=12345"),
      );
    });

    it("scrobble should throw if fetch is not ok", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });
      await expect(scrobble({ id: "s-1" })).rejects.toThrow(
        "scrobble request failed with status 500",
      );
    });

    it("scrobble should throw if response has error", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          "subsonic-response": {
            status: "failed",
            version: "1.16.1",
            type: "navidrome",
            serverVersion: "0.54.0",
            error: { code: 10, message: "scrobble err" },
          },
        }),
      });
      await expect(scrobble({ id: "s-1" })).rejects.toThrow("scrobble err");
    });

    it("scrobbleSong should invoke scrobble with submission true", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          "subsonic-response": {
            status: "ok",
            version: "1.16.1",
            type: "navidrome",
            serverVersion: "0.54.0",
          },
        }),
      });

      await scrobbleSong("song-1");
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("submission=true"),
      );
    });

    it("scrobbleSong should invoke scrobble with explicit timestamp if provided", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          "subsonic-response": {
            status: "ok",
          },
        }),
      });

      await scrobbleSong("song-1", 1600000000000);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("time=1600000000000"),
      );
    });

    it("scrobble should return true on 200 even if response body is empty or non-json", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error("Unexpected end of JSON input");
        },
      });

      await expect(
        scrobble({ id: "song-1", submission: true }),
      ).resolves.toBe(true);
    });
  });

  describe("getPlaylists and getPlaylist", () => {
    it("getPlaylists should return playlists array with username param if passed", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          "subsonic-response": {
            status: "ok",
            version: "1.16.1",
            type: "navidrome",
            serverVersion: "0.54.0",
            playlists: {
              playlist: [{ id: "pl-1", name: "Favorites" }],
            },
          },
        }),
      });

      const playlists = await getPlaylists("john_doe");
      expect(playlists).toHaveLength(1);
      expect(playlists[0].id).toBe("pl-1");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("username=john_doe"),
      );
    });

    it("getPlaylists should throw if response is not ok", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });
      await expect(getPlaylists()).rejects.toThrow(
        "getPlaylists request failed with status 500",
      );
    });

    it("getPlaylists should throw if response fails schema", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          invalid: "data",
        }),
      });
      await expect(getPlaylists()).rejects.toThrow(
        "failed to parse getPlaylists response",
      );
    });

    it("getPlaylists should throw if status is not ok", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          "subsonic-response": {
            status: "failed",
            version: "1.16.1",
            type: "navidrome",
            serverVersion: "0.54.0",
            error: { code: 10, message: "custom err" },
          },
        }),
      });
      await expect(getPlaylists()).rejects.toThrow("custom err");
    });

    it("getPlaylist should return playlist with entries", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          "subsonic-response": {
            status: "ok",
            version: "1.16.1",
            type: "navidrome",
            serverVersion: "0.54.0",
            playlist: {
              id: "pl-1",
              name: "Pop Hits",
              entry: [{ id: "song-1", title: "Hit 1" }],
            },
          },
        }),
      });

      const pl = await getPlaylist("pl-1");
      expect(pl.id).toBe("pl-1");
      expect(pl.entry).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("id=pl-1"),
      );
    });

    it("getPlaylist should throw if response is not ok", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });
      await expect(getPlaylist("pl-1")).rejects.toThrow(
        "getPlaylist request failed with status 404",
      );
    });

    it("getPlaylist should throw if schema parse fails", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          invalid: "payload",
        }),
      });
      await expect(getPlaylist("pl-1")).rejects.toThrow(
        "failed to parse getPlaylist response",
      );
    });

    it("getPlaylist should throw if status is not ok", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          "subsonic-response": {
            status: "failed",
            version: "1.16.1",
            type: "navidrome",
            serverVersion: "0.54.0",
            error: { code: 70, message: "playlist not found" },
          },
        }),
      });
      await expect(getPlaylist("pl-1")).rejects.toThrow("playlist not found");
    });

    it("getPlaylist should throw if playlist missing in response", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          "subsonic-response": {
            status: "ok",
            version: "1.16.1",
            type: "navidrome",
            serverVersion: "0.54.0",
          },
        }),
      });
      await expect(getPlaylist("pl-1")).rejects.toThrow(
        "playlist not found in response",
      );
    });
  });
});
