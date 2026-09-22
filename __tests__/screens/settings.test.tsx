import React from "react";
import renderer from "react-test-renderer";
import { Switch, Text } from "react-native-paper";

import SettingsScreen from "@/app/(main)/settings";
import * as db from "@/services/db";
import * as player from "@/services/player";
import { ANDROID_VERSION_CODE, APP_VERSION } from "@/utils/constants";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

jest.mock("@/services/api", () => ({
  logout: jest.fn().mockResolvedValue(undefined),
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
  getScrobbleMinDuration: jest.fn().mockReturnValue(240),
  getScrobbleMinPercent: jest.fn().mockReturnValue(75),
  setAutoCacheEnabled: jest.fn(),
  setAutoCacheMaxBytes: jest.fn(),
  setKeepPlayingOnAppDismissed: jest.fn(),
  setScrobbleMinDuration: jest.fn(),
  setScrobbleMinPercent: jest.fn(),
}));

jest.mock("@/services/player", () => ({
  updateKeepPlayingOnAppDismissed: jest.fn().mockResolvedValue(undefined),
}));

describe("SettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders playback settings toggle with default false", () => {
    (db.getKeepPlayingOnAppDismissed as jest.Mock).mockReturnValue(false);

    let tree: any;
    renderer.act(() => {
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
    renderer.act(() => {
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

  it("renders version number and version code below logout button", () => {
    let tree: any;
    renderer.act(() => {
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
});
