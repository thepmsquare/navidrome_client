import React from "react";
import { Alert } from "react-native";
import { IconButton } from "react-native-paper";
import renderer from "react-test-renderer";

import DownloadQueueScreen from "@/app/(main)/library/queue";
import { getCoverArtBaseUrl } from "@/services/api";
import { getDownloadQueueState, getSongById, getSongsByIds } from "@/services/db";
import {
  cancelSongCaching,
  dequeuePendingSong,
  subscribeCacheQueue,
  subscribeSongCacheProgress,
} from "@/services/songCache";
import { Child, DownloadQueueState } from "@/types";

let queueCallback: ((state: DownloadQueueState) => void) | null = null;
let progressCallback:
  | ((event: { songId: string; progress: number }) => void)
  | null = null;

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    push: jest.fn(),
  }),
  useFocusEffect: jest.fn(),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("expo-image", () => ({
  Image: "Image",
}));

jest.mock("@/services/api", () => ({
  getCoverArtBaseUrl: jest.fn(),
}));

jest.mock("@/services/db", () => ({
  getDownloadQueueState: jest.fn(),
  getSongsByIds: jest.fn(),
  getSongById: jest.fn(),
}));

jest.mock("@/services/songCache", () => ({
  cancelSongCaching: jest.fn(),
  dequeuePendingSong: jest.fn(),
  subscribeCacheQueue: jest.fn((fn) => {
    queueCallback = fn;
    return () => {
      queueCallback = null;
    };
  }),
  subscribeSongCacheProgress: jest.fn((fn) => {
    progressCallback = fn;
    return () => {
      progressCallback = null;
    };
  }),
}));

const mockSongs: Child[] = [
  {
    id: "song-active",
    title: "downloading song 1",
    artist: "artist 1",
    album: "album 1",
    coverArt: "art-1",
  },
  {
    id: "song-pending-1",
    title: "queued song 2",
    artist: "artist 2",
    album: "album 2",
    coverArt: "art-2",
  },
  {
    id: "song-pending-2",
    title: "queued song 3",
    artist: "artist 3",
    album: "album 3",
    coverArt: "art-3",
  },
];

function getAllTexts(component: any): string[] {
  return component.root
    .findAllByType("Text")
    .map((node: any) => node.props.children)
    .flat()
    .filter(Boolean)
    .map((c: any) => (typeof c === "string" ? c : String(c)));
}

describe("DownloadQueueScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queueCallback = null;
    progressCallback = null;
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    (getCoverArtBaseUrl as jest.Mock).mockResolvedValue(
      (id?: string | null) => (id ? `https://art/${id}` : null),
    );
    (getDownloadQueueState as jest.Mock).mockReturnValue({
      active: null,
      pending: [],
    });
    (getSongsByIds as jest.Mock).mockReturnValue([]);
    (getSongById as jest.Mock).mockReturnValue(null);
  });

  it("renders empty state when no active or pending downloads", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(<DownloadQueueScreen />);
    });

    const texts = getAllTexts(component);
    expect(texts).toContain("download queue");
    expect(texts).toContain("no downloads in progress");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("renders active and pending songs in queue with counters", () => {
    (getDownloadQueueState as jest.Mock).mockReturnValue({
      active: "song-active",
      pending: ["song-pending-1", "song-pending-2"],
    });
    (getSongsByIds as jest.Mock).mockReturnValue(mockSongs);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<DownloadQueueScreen />);
    });

    let texts = getAllTexts(component);
    expect(texts).toContain("downloading song 1");
    expect(texts).toContain("queued song 2");
    expect(texts).toContain("queued song 3");
    expect(texts).toContain("3 songs in queue");
    expect(texts).toContain("1 downloading • 2 queued");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("updates live progress for active song", () => {
    (getDownloadQueueState as jest.Mock).mockReturnValue({
      active: "song-active",
      pending: [],
    });
    (getSongsByIds as jest.Mock).mockReturnValue([mockSongs[0]]);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<DownloadQueueScreen />);
    });

    // Send progress event
    renderer.act(() => {
      progressCallback?.({ songId: "song-active", progress: 0.65 });
    });

    const texts = getAllTexts(component);
    expect(texts.some((t) => t.includes("65%"))).toBe(true);

    renderer.act(() => {
      component.unmount();
    });
  });

  it("removes pending song when remove icon button is pressed", () => {
    (getDownloadQueueState as jest.Mock).mockReturnValue({
      active: null,
      pending: ["song-pending-1"],
    });
    (getSongsByIds as jest.Mock).mockReturnValue([mockSongs[1]]);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<DownloadQueueScreen />);
    });

    const removeButton = component.root.findByProps({
      accessibilityLabel: "remove from queue",
    });

    renderer.act(() => {
      removeButton.props.onPress();
    });

    expect(dequeuePendingSong).toHaveBeenCalledWith("song-pending-1");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("updates list when queue state changes via subscribeCacheQueue", () => {
    (getDownloadQueueState as jest.Mock).mockReturnValue({
      active: null,
      pending: [],
    });
    (getSongsByIds as jest.Mock).mockReturnValue(mockSongs);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<DownloadQueueScreen />);
    });

    let texts = getAllTexts(component);
    expect(texts).toContain("no downloads in progress");

    // Queue updates with new active and pending songs
    renderer.act(() => {
      queueCallback?.({
        active: "song-active",
        pending: ["song-pending-1"],
      });
    });

    texts = getAllTexts(component);
    expect(texts).toContain("downloading song 1");
    expect(texts).toContain("queued song 2");
    expect(texts).toContain("2 songs in queue");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("prompts confirmation to cancel active download when pressed", () => {
    (getDownloadQueueState as jest.Mock).mockReturnValue({
      active: "song-active",
      pending: [],
    });
    (getSongsByIds as jest.Mock).mockReturnValue([mockSongs[0]]);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<DownloadQueueScreen />);
    });

    const pressable = component.root.findByProps({
      accessibilityLabel: "cancel download",
    });

    renderer.act(() => {
      pressable.props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      "cancel download",
      "are you sure you want to cancel downloading this song?",
      expect.any(Array),
    );

    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    const confirmBtn = alertCalls[0][2].find((b: any) => b.text === "yes");

    renderer.act(() => {
      confirmBtn.onPress();
    });

    expect(cancelSongCaching).toHaveBeenCalledWith("song-active");

    renderer.act(() => {
      component.unmount();
    });
  });
});

