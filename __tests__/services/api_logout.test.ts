import * as SecureStore from "expo-secure-store";

import { logout, notifyAuthState, subscribeAuthState } from "@/services/api";
import { clearDatabase } from "@/services/db";
import { resetPlayer } from "@/services/player";
import { clearAllCachedSongs } from "@/services/songCache";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/services/db", () => ({
  clearDatabase: jest.fn(),
  getLocalCounts: jest.fn(),
  getSyncMeta: jest.fn(),
  setSyncMeta: jest.fn(),
  upsertAlbumsBatch: jest.fn(),
  upsertArtistsBatch: jest.fn(),
  upsertPlaylistsBatch: jest.fn(),
  upsertSongsBatch: jest.fn(),
}));

jest.mock("@/services/player", () => ({
  resetPlayer: jest.fn().mockResolvedValue(undefined),
  stopPlayback: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/services/songCache", () => ({
  clearAllCachedSongs: jest.fn().mockResolvedValue(undefined),
  getCachedSongPlaybackUri: jest.fn(),
  subscribeSongCache: jest.fn(),
}));

describe("api logout and auth state", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("subscribeAuthState and notifyAuthState", () => {
    it("should notify subscribers when auth state changes", () => {
      const listener = jest.fn();
      const unsubscribe = subscribeAuthState(listener);

      notifyAuthState(true);
      expect(listener).toHaveBeenCalledWith(true);

      notifyAuthState(false);
      expect(listener).toHaveBeenCalledWith(false);

      unsubscribe();
      notifyAuthState(true);
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  describe("logout", () => {
    it("should reset player, clear song cache, clear database, delete all keys, and notify auth state", async () => {
      const authListener = jest.fn();
      const unsubscribe = subscribeAuthState(authListener);

      await logout();

      expect(resetPlayer).toHaveBeenCalled();
      expect(clearAllCachedSongs).toHaveBeenCalled();
      expect(clearDatabase).toHaveBeenCalled();

      const expectedDeletedKeys = [
        "subsonicVersion",
        "serverUrl",
        "username",
        "password",
        "stop_playback_on_task_removed",
        "home_sections",
      ];
      expectedDeletedKeys.forEach((key) => {
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(key);
      });

      expect(authListener).toHaveBeenCalledWith(false);
      unsubscribe();
    });

    it("should not fail logout if one step throws an error", async () => {
      (resetPlayer as jest.Mock).mockRejectedValueOnce(new Error("player stop error"));
      (clearAllCachedSongs as jest.Mock).mockRejectedValueOnce(new Error("cache delete error"));
      (clearDatabase as jest.Mock).mockImplementationOnce(() => {
        throw new Error("db clear error");
      });
      (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValueOnce(new Error("key delete error"));

      const authListener = jest.fn();
      const unsubscribe = subscribeAuthState(authListener);

      await expect(logout()).resolves.not.toThrow();
      expect(authListener).toHaveBeenCalledWith(false);

      unsubscribe();
    });
  });
});
