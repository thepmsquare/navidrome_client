import React from "react";
import renderer, { act } from "react-test-renderer";
import * as SecureStore from "expo-secure-store";
import { Button } from "react-native-paper";

import ConnectScreen from "@/app/(auth)/connect";
import * as api from "@/services/api";
import * as backup from "@/services/backup";
import * as db from "@/services/db";
import * as lyrics from "@/services/lyrics";
import * as player from "@/services/player";
import { BackupData } from "@/types";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("expo-clipboard", () => ({
  getStringAsync: jest.fn().mockResolvedValue(""),
}));

jest.mock("@/services/api", () => ({
  ping: jest.fn().mockResolvedValue({ version: "1.16.1" }),
  login: jest.fn().mockResolvedValue(undefined),
  notifyAuthState: jest.fn(),
}));

jest.mock("@/services/backup", () => ({
  pickProfileFile: jest.fn(),
}));

jest.mock("@/services/db", () => ({
  setAutoCacheEnabled: jest.fn(),
  setAutoCacheMaxBytes: jest.fn(),
  setScrobbleMinDuration: jest.fn(),
  setScrobbleMinPercent: jest.fn(),
}));

jest.mock("@/services/lyrics", () => ({
  setLyricsMode: jest.fn(),
}));

jest.mock("@/services/player", () => ({
  updateKeepPlayingOnAppDismissed: jest.fn().mockResolvedValue(undefined),
}));

describe("ConnectScreen - handleImportProfile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should import profile and restore settings, credentials and navigate to sync", async () => {
    const mockProfile: BackupData = {
      app_identifier: "navidrome_client_backup",
      server_url: "https://music.example.com",
      username: "testuser",
      password: "password123",
      settings: {
        auto_cache_enabled: true,
        auto_cache_max_bytes: 2147483648,
        scrobble_min_duration: 120,
        scrobble_min_percent: 60,
        keep_playing_on_app_dismissed: true,
        lyrics_mode: "online_first",
      },
      stop_playback_on_task_removed: false,
      home_sections: [
        { id: "most_played", visible: true },
        { id: "random_tracks", visible: false },
      ],
      export_date: "2026-10-09T03:30:00.000000",
      version: 1,
    };

    (backup.pickProfileFile as jest.Mock).mockResolvedValue(mockProfile);

    let component: renderer.ReactTestRenderer;
    await act(async () => {
      component = renderer.create(<ConnectScreen />);
    });

    const root = component!.root;
    // Find import button
    const buttons = root.findAllByType(Button);
    const importButton = buttons.find((b) => b.props.icon === "file-import");

    expect(importButton).toBeDefined();

    await act(async () => {
      await importButton?.props.onPress();
    });

    // Verify ping and login were called
    expect(api.ping).toHaveBeenCalledWith("https://music.example.com");
    expect(api.login).toHaveBeenCalledWith({
      serverUrl: "https://music.example.com",
      username: "testuser",
      password: "password123",
    });

    // Verify credentials saved
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "username",
      "testuser",
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "password",
      "password123",
    );

    // Verify settings applied
    expect(db.setAutoCacheEnabled).toHaveBeenCalledWith(true);
    expect(db.setAutoCacheMaxBytes).toHaveBeenCalledWith(2147483648);
    expect(db.setScrobbleMinDuration).toHaveBeenCalledWith(120);
    expect(db.setScrobbleMinPercent).toHaveBeenCalledWith(60);
    expect(player.updateKeepPlayingOnAppDismissed).toHaveBeenCalledWith(true);
    expect(lyrics.setLyricsMode).toHaveBeenCalledWith("online_first");

    // Verify legacy & home sections saved
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "stop_playback_on_task_removed",
      "false",
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "home_sections",
      JSON.stringify(mockProfile.home_sections),
    );

    // Verify auth state and router redirect
    expect(api.notifyAuthState).toHaveBeenCalledWith(true);
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/sync",
      params: { initial: "true" },
    });
  });

  it("should do nothing if file picker was cancelled", async () => {
    (backup.pickProfileFile as jest.Mock).mockResolvedValue(null);

    let component: renderer.ReactTestRenderer;
    await act(async () => {
      component = renderer.create(<ConnectScreen />);
    });

    const root = component!.root;
    const buttons = root.findAllByType(Button);
    const importButton = buttons.find((b) => b.props.icon === "file-import");

    await act(async () => {
      await importButton?.props.onPress();
    });

    expect(api.ping).not.toHaveBeenCalled();
    expect(api.login).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
