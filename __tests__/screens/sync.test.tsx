import React from "react";
import renderer, { act } from "react-test-renderer";
import { Button, Text } from "react-native-paper";

import SyncScreen from "@/app/(main)/sync";
import * as api from "@/services/api";
import * as db from "@/services/db";

const mockReplace = jest.fn();
let mockSearchParams: { initial?: string } = {};

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
    back: jest.fn(),
  }),
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock("@/services/api", () => ({
  client_app_sync: jest.fn().mockResolvedValue({
    synced: true,
    artistCount: 15,
    albumCount: 25,
    songCount: 150,
    playlistCount: 8,
    lastSyncedAt: "2026-10-08T00:00:00.000Z",
  }),
  isSyncInProgress: jest.fn().mockReturnValue(false),
  subscribeSyncState: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock("@/services/db", () => ({
  getLocalCounts: jest.fn().mockReturnValue({
    artistCount: 10,
    albumCount: 20,
    songCount: 100,
    playlistCount: 5,
  }),
  getSyncMeta: jest.fn().mockReturnValue("2026-10-07T12:00:00.000Z"),
}));

describe("SyncScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = {};
    (api.isSyncInProgress as jest.Mock).mockReturnValue(false);
    (db.getSyncMeta as jest.Mock).mockReturnValue("2026-10-07T12:00:00.000Z");
  });

  it("does not trigger sync automatically on subsequent visits", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<SyncScreen />);
    });

    expect(api.client_app_sync).not.toHaveBeenCalled();

    const root = tree.root;
    const texts = root.findAllByType(Text).map((t: any) => t.props.children);
    expect(texts).toContain("library sync");
  });

  it("auto-starts sync on initial setup after login and displays initial setup text", async () => {
    (db.getSyncMeta as jest.Mock).mockReturnValue(null);
    mockSearchParams = { initial: "true" };

    let resolveSync: (val: any) => void;
    (api.client_app_sync as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSync = resolve;
        }),
    );

    let tree: any;
    await act(async () => {
      tree = renderer.create(<SyncScreen />);
    });

    // Auto-starts sync on mount
    expect(api.client_app_sync).toHaveBeenCalledWith(false);

    const root = tree.root;
    const texts = root.findAllByType(Text).map((t: any) => t.props.children);
    expect(texts).toContain(
      "we are getting details for initial setup of the app.",
    );

    // Go to home is disabled during initial sync
    const buttons = root.findAllByType(Button);
    const homeBtn = buttons.find((b: any) => b.props.children === "go to home");
    expect(homeBtn.props.disabled).toBe(true);

    // Finish sync
    await act(async () => {
      resolveSync!({
        synced: true,
        artistCount: 15,
        albumCount: 25,
        songCount: 150,
        playlistCount: 8,
        lastSyncedAt: "2026-10-08T00:00:00.000Z",
      });
    });

    // Now go to home is enabled and prominent (contained mode)
    expect(homeBtn.props.disabled).toBe(false);
    expect(homeBtn.props.mode).toBe("contained");
  });

  it("renders manual sync, force sync, and go to home buttons", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<SyncScreen />);
    });

    const root = tree.root;
    const buttons = root.findAllByType(Button);
    const syncBtn = buttons.find((b: any) => b.props.children === "sync");
    const forceSyncBtn = buttons.find((b: any) => b.props.children === "force sync");
    const homeBtn = buttons.find((b: any) => b.props.children === "go to home");

    expect(syncBtn).toBeDefined();
    expect(forceSyncBtn).toBeDefined();
    expect(homeBtn).toBeDefined();
  });

  it("triggers manual sync on 'sync' button press", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<SyncScreen />);
    });

    const root = tree.root;
    const buttons = root.findAllByType(Button);
    const syncBtn = buttons.find((b: any) => b.props.children === "sync");

    await act(async () => {
      syncBtn.props.onPress();
    });

    expect(api.client_app_sync).toHaveBeenCalledWith(false);
  });

  it("triggers force sync on 'force sync' button press", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<SyncScreen />);
    });

    const root = tree.root;
    const buttons = root.findAllByType(Button);
    const forceSyncBtn = buttons.find((b: any) => b.props.children === "force sync");

    await act(async () => {
      forceSyncBtn.props.onPress();
    });

    expect(api.client_app_sync).toHaveBeenCalledWith(true);
  });

  it("navigates to home when 'go to home' is pressed", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<SyncScreen />);
    });

    const root = tree.root;
    const buttons = root.findAllByType(Button);
    const homeBtn = buttons.find((b: any) => b.props.children === "go to home");

    await act(async () => {
      homeBtn.props.onPress();
    });

    expect(mockReplace).toHaveBeenCalledWith("/");
  });
});
