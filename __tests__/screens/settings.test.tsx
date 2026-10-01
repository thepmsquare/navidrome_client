import React from "react";
import renderer from "react-test-renderer";
import { Button, Switch, Text } from "react-native-paper";

import SettingsScreen from "@/app/(main)/settings";
import * as api from "@/services/api";
import * as db from "@/services/db";
import * as player from "@/services/player";
import { ANDROID_VERSION_CODE, APP_VERSION } from "@/utils/constants";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockImplementation((key: string) => {
    if (key === "username") return Promise.resolve("testuser");
    if (key === "serverUrl") return Promise.resolve("https://example.com");
    if (key === "subsonicVersion") return Promise.resolve("1.16.1");
    return Promise.resolve(null);
  }),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/utils/audioOutput", () => ({
  useAudioOutputDevice: jest.fn().mockReturnValue({
    name: "speaker",
    type: "speaker",
    isHeadphones: false,
  }),
}));

jest.mock("@/services/api", () => ({
  logout: jest.fn().mockResolvedValue(undefined),
  client_app_sync: jest.fn().mockResolvedValue({
    synced: true,
    artistCount: 10,
    albumCount: 20,
    songCount: 100,
    playlistCount: 5,
  }),
}));

jest.mock("@/services/backup", () => ({
  exportBackupToFile: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock("@/services/songCache", () => ({
  clearAllAutoCachedSongs: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/services/db", () => ({
  getAutoCacheCount: jest.fn().mockReturnValue(0),
  getAutoCacheEnabled: jest.fn().mockReturnValue(true),
  getAutoCacheMaxBytes: jest.fn().mockReturnValue(1073741824),
  getAutoCacheTotalSize: jest.fn().mockReturnValue(0),
  getKeepPlayingOnAppDismissed: jest.fn().mockReturnValue(false),
  getLocalCounts: jest.fn().mockReturnValue({
    artistCount: 10,
    albumCount: 20,
    songCount: 100,
    playlistCount: 5,
  }),
  getScrobbleMinDuration: jest.fn().mockReturnValue(240),
  getScrobbleMinPercent: jest.fn().mockReturnValue(75),
  setAutoCacheEnabled: jest.fn(),
  setAutoCacheMaxBytes: jest.fn(),
  setKeepPlayingOnAppDismissed: jest.fn(),
  setScrobbleMinDuration: jest.fn(),
  setScrobbleMinPercent: jest.fn(),
}));

jest.mock("@/services/player", () => ({
  playTestSound: jest.fn().mockResolvedValue(undefined),
  updateKeepPlayingOnAppDismissed: jest.fn().mockResolvedValue(undefined),
  usePlayerState: jest.fn().mockReturnValue({
    isPlaying: false,
  }),
}));

jest.mock("@/services/lyrics", () => ({
  getLyricsMode: jest.fn(() => "file_only"),
  setLyricsMode: jest.fn(),
  subscribeLyricsMode: jest.fn((cb) => {
    cb("file_only");
    return jest.fn();
  }),
}));

describe("SettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders connection, library, and actions sections transferred from home", async () => {
    let tree: any;
    await renderer.act(async () => {
      tree = renderer.create(<SettingsScreen />);
    });

    const root = tree.root;
    const texts = root.findAllByType(Text).map((t: any) => t.props.children);

    expect(texts).toContain("connection");
    expect(texts).toContain("username");
    expect(texts).toContain("server");
    expect(texts).toContain("subsonic version");
    expect(texts).toContain("audio output");
    expect(texts).toContain("library");
    expect(texts).toContain("actions");
  });

  it("renders playback settings toggle with default false", async () => {
    (db.getKeepPlayingOnAppDismissed as jest.Mock).mockReturnValue(false);

    let tree: any;
    await renderer.act(async () => {
      tree = renderer.create(<SettingsScreen />);
    });

    const root = tree.root;
    const switches = root.findAllByType(Switch);
    // There are 2 switches: autoCache and keepPlayingOnAppDismissed
    expect(switches.length).toBe(2);

    const playbackSwitch = switches[1];
    expect(playbackSwitch.props.value).toBe(false);
  });

  it("toggling playback switch calls updateKeepPlayingOnAppDismissed", async () => {
    (db.getKeepPlayingOnAppDismissed as jest.Mock).mockReturnValue(false);

    let tree: any;
    await renderer.act(async () => {
      tree = renderer.create(<SettingsScreen />);
    });

    const root = tree.root;
    const switches = root.findAllByType(Switch);
    const playbackSwitch = switches[1];

    await renderer.act(async () => {
      playbackSwitch.props.onValueChange(true);
    });

    expect(player.updateKeepPlayingOnAppDismissed).toHaveBeenCalledWith(true);
  });

  it("renders version number and version code below logout button", async () => {
    let tree: any;
    await renderer.act(async () => {
      tree = renderer.create(<SettingsScreen />);
    });

    const root = tree.root;
    const texts = root.findAllByType(Text);
    const expectedVersionString = `version ${APP_VERSION} (${ANDROID_VERSION_CODE})`;
    const matchingText = texts.find(
      (t: any) => t.props.children === expectedVersionString,
    );
    expect(matchingText).toBeDefined();
  });

  it("renders 'automatically make available offline' without the word cache", async () => {
    let tree: any;
    await renderer.act(async () => {
      tree = renderer.create(<SettingsScreen />);
    });

    const root = tree.root;
    const texts = root.findAllByType(Text).map((t: any) => t.props.children);
    expect(texts).toContain("automatically make available offline");
    expect(texts).toContain("automatically make songs available offline while streaming");
    expect(texts.some((t: any) => typeof t === "string" && /cache/i.test(t))).toBe(false);
  });

  it("prompts confirmation when toggling off auto-offline with cached songs", async () => {
    const { Alert } = require("react-native");
    jest.spyOn(Alert, "alert").mockImplementation(() => {});

    (db.getAutoCacheCount as jest.Mock).mockReturnValue(3);
    (db.getAutoCacheTotalSize as jest.Mock).mockReturnValue(15 * 1024 * 1024);

    let tree: any;
    await renderer.act(async () => {
      tree = renderer.create(<SettingsScreen />);
    });

    const root = tree.root;
    const switches = root.findAllByType(Switch);
    const autoOfflineSwitch = switches[0];

    await renderer.act(async () => {
      autoOfflineSwitch.props.onValueChange(false);
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      "turn off automatically make available offline",
      expect.stringContaining("remove 3 offline song(s)"),
      expect.any(Array),
      { cancelable: true },
    );
  });

  it("allows triggering sync and force sync from actions", async () => {
    let tree: any;
    await renderer.act(async () => {
      tree = renderer.create(<SettingsScreen />);
    });

    const root = tree.root;
    const buttons = root.findAllByType(Button);
    const syncBtn = buttons.find((b: any) => b.props.children === "sync");
    const forceSyncBtn = buttons.find((b: any) => b.props.children === "force sync");

    expect(syncBtn).toBeDefined();
    expect(forceSyncBtn).toBeDefined();

    await renderer.act(async () => {
      syncBtn.props.onPress();
    });
    expect(api.client_app_sync).toHaveBeenCalledWith(false);

    await renderer.act(async () => {
      forceSyncBtn.props.onPress();
    });
    expect(api.client_app_sync).toHaveBeenCalledWith(true);
  });

  it("renders lyrics mode section with options and handles selection", async () => {
    const { setLyricsMode } = require("@/services/lyrics");
    let tree: any;
    await renderer.act(async () => {
      tree = renderer.create(<SettingsScreen />);
    });

    const root = tree.root;
    const texts = root.findAllByType(Text).map((t: any) => t.props.children);

    expect(texts).toContain("lyrics");
    expect(texts).toContain("library only");
    expect(texts).toContain("library, then online");
    expect(texts).toContain("online first");
    expect(texts).toContain(
      "online lookups send the song's title, artist, album and duration to lrclib.net.",
    );

    // Find radio item for "online first"
    const onlineFirstPressable = root.findByProps({
      accessibilityLabel: "online first",
    });
    expect(onlineFirstPressable).toBeDefined();

    await renderer.act(async () => {
      onlineFirstPressable.props.onPress();
    });

    expect(setLyricsMode).toHaveBeenCalledWith("online_first");
  });
});
