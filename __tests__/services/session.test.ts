import * as SecureStore from "expo-secure-store";

import { notifyAuthState } from "@/services/api";
import { clearDatabase, clearLyricsCache } from "@/services/db";
import { resetPlayer } from "@/services/player";
import { logout } from "@/services/session";
import { clearAllCachedSongs } from "@/services/songCache";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/services/api", () => ({
  notifyAuthState: jest.fn(),
}));

jest.mock("@/services/db", () => ({
  clearDatabase: jest.fn(),
  clearLyricsCache: jest.fn(),
}));

jest.mock("@/services/player", () => ({
  resetPlayer: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/services/songCache", () => ({
  clearAllCachedSongs: jest.fn().mockResolvedValue(undefined),
}));

describe("session service: logout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should reset player, clear song cache, clear lyrics cache, clear database, delete keys, and notify auth", async () => {
    await logout();

    expect(resetPlayer).toHaveBeenCalled();
    expect(clearAllCachedSongs).toHaveBeenCalled();
    expect(clearLyricsCache).toHaveBeenCalled();
    expect(clearDatabase).toHaveBeenCalled();

    const expectedKeys = [
      "subsonicVersion",
      "serverUrl",
      "username",
      "password",
      "stop_playback_on_task_removed",
      "home_sections",
    ];
    for (const key of expectedKeys) {
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(key);
    }
    expect(notifyAuthState).toHaveBeenCalledWith(false);
  });

  it("should handle errors gracefully during logout teardown", async () => {
    (resetPlayer as jest.Mock).mockRejectedValueOnce(new Error("player error"));
    (clearAllCachedSongs as jest.Mock).mockRejectedValueOnce(new Error("cache error"));
    (clearLyricsCache as jest.Mock).mockImplementationOnce(() => {
      throw new Error("lyrics cache clear error");
    });
    (clearDatabase as jest.Mock).mockImplementationOnce(() => {
      throw new Error("db clear error");
    });

    await expect(logout()).resolves.not.toThrow();
    expect(notifyAuthState).toHaveBeenCalledWith(false);
  });
});
