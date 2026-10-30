import React from "react";
import { Alert } from "react-native";
import { Button, IconButton } from "react-native-paper";
import renderer, { act } from "react-test-renderer";

import PendingScrobblesScreen from "@/app/(main)/library/scrobbles";
import { getCoverArtBaseUrl } from "@/services/api";
import { getPendingScrobbles, getSongById, getSongsByIds } from "@/services/db";
import {
  clearAllPendingScrobbles,
  deletePendingScrobble,
  isScrobbleSyncInProgress,
  subscribeScrobbleQueue,
  syncPendingScrobbles,
  syncSinglePendingScrobble,
} from "@/services/scrobbleQueue";
import { Child, PendingScrobble } from "@/types";

import { SafeAreaProvider } from "react-native-safe-area-context";

let queueListener: (() => void) | null = null;
const mockBack = jest.fn();

const initialMetrics = {
  frame: { x: 0, y: 0, width: 320, height: 640 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function renderScreen() {
  return renderer.create(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <PendingScrobblesScreen />
    </SafeAreaProvider>,
  );
}

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    push: jest.fn(),
  }),
  useFocusEffect: (cb: any) => require("react").useEffect(cb, []),
}));

jest.mock("expo-image", () => ({
  Image: "Image",
}));

jest.mock("@/services/api", () => ({
  getCoverArtBaseUrl: jest.fn().mockResolvedValue(() => "https://example.com/art"),
}));

jest.mock("@/services/db", () => ({
  getPendingScrobbles: jest.fn(),
  getSongsByIds: jest.fn(),
  getSongById: jest.fn(),
}));

jest.mock("@/services/scrobbleQueue", () => ({
  isScrobbleSyncInProgress: jest.fn(),
  subscribeScrobbleQueue: jest.fn((fn) => {
    queueListener = fn;
    return () => {
      queueListener = null;
    };
  }),
  syncPendingScrobbles: jest.fn().mockResolvedValue({ synced: 1, failed: 0 }),
  syncSinglePendingScrobble: jest.fn().mockResolvedValue(true),
  deletePendingScrobble: jest.fn(),
  clearAllPendingScrobbles: jest.fn(),
}));

const mockScrobbles: PendingScrobble[] = [
  {
    id: 1,
    songId: "song-1",
    timestamp: 1600000000000,
    attempts: 0,
    createdAt: 1600000000000,
  },
  {
    id: 2,
    songId: "song-2",
    timestamp: 1600000010000,
    attempts: 2,
    createdAt: 1600000010000,
  },
];

const mockSongs: Child[] = [
  {
    id: "song-1",
    title: "Offline Track 1",
    artist: "Artist 1",
    album: "Album 1",
  },
  {
    id: "song-2",
    title: "Offline Track 2",
    artist: "Artist 2",
    album: "Album 2",
  },
];

describe("PendingScrobblesScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queueListener = null;
    (isScrobbleSyncInProgress as jest.Mock).mockReturnValue(false);
  });

  it("renders empty state when there are no pending scrobbles", async () => {
    (getPendingScrobbles as jest.Mock).mockReturnValue([]);
    (getSongsByIds as jest.Mock).mockReturnValue([]);

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderScreen();
    });

    const root = tree!.root;
    const texts = root.findAllByType("Text" as any).map((n) => n.props.children);
    expect(texts).toContain("no pending scrobbles");
    expect(texts).toContain("all plays have been synced to the server");
  });

  it("renders pending scrobbles list with attempts and metadata", async () => {
    (getPendingScrobbles as jest.Mock).mockReturnValue(mockScrobbles);
    (getSongsByIds as jest.Mock).mockReturnValue(mockSongs);

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderScreen();
    });

    const root = tree!.root;
    const texts = root.findAllByType("Text" as any).map((n) => n.props.children);
    expect(texts).toContain("2 pending scrobbles");
    expect(texts).toContain("pending");
    expect(texts).toContain("failed (2 attempts)");
  });

  it("triggers sync all when sync button is pressed", async () => {
    jest.spyOn(Alert, "alert");
    (getPendingScrobbles as jest.Mock).mockReturnValue(mockScrobbles);
    (getSongsByIds as jest.Mock).mockReturnValue(mockSongs);

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderScreen();
    });

    const root = tree!.root;
    const buttons = root.findAllByType(Button);
    const syncButton = buttons.find((b) => b.props.children === "sync now");
    expect(syncButton).toBeDefined();

    await act(async () => {
      syncButton!.props.onPress();
    });

    expect(syncPendingScrobbles).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      "sync completed",
      "synced 1 scrobbles",
    );
  });

  it("triggers individual item deletion with confirmation alert", async () => {
    jest.spyOn(Alert, "alert");
    (getPendingScrobbles as jest.Mock).mockReturnValue(mockScrobbles);
    (getSongsByIds as jest.Mock).mockReturnValue(mockSongs);

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderScreen();
    });

    const root = tree!.root;
    const deleteButtons = root
      .findAllByType(IconButton)
      .filter((btn) => btn.props.icon === "delete-outline");
    expect(deleteButtons.length).toBeGreaterThan(0);

    act(() => {
      deleteButtons[0].props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      "delete scrobble",
      expect.stringContaining("are you sure"),
      expect.any(Array),
    );

    const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
    const confirmButton = alertButtons.find((b: any) => b.text === "delete");
    expect(confirmButton).toBeDefined();

    act(() => {
      confirmButton.onPress();
    });

    expect(deletePendingScrobble).toHaveBeenCalledWith(1);
  });

  it("triggers individual scrobble retry sync", async () => {
    (getPendingScrobbles as jest.Mock).mockReturnValue(mockScrobbles);
    (getSongsByIds as jest.Mock).mockReturnValue(mockSongs);

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderScreen();
    });

    const root = tree!.root;
    const syncButtons = root
      .findAllByType(IconButton)
      .filter((btn) => btn.props.icon === "sync");
    // Header sync plus row syncs
    expect(syncButtons.length).toBeGreaterThan(1);

    await act(async () => {
      syncButtons[1].props.onPress();
    });

    expect(syncSinglePendingScrobble).toHaveBeenCalledWith(1);
  });
});