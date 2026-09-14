import React from "react";
import { Alert } from "react-native";
import renderer from "react-test-renderer";

import DownloadQueueScreen from "@/app/(main)/library/queue";
import { getCoverArtBaseUrl } from "@/services/api";
import { getSongById, getSongsByIds } from "@/services/db";
import {
  cancelSongCaching,
  getActiveDownloadSongIds,
  subscribeSongCache,
  subscribeSongCacheProgress,
} from "@/services/songCache";
import { Child } from "@/types";

let progressCallback:
  | ((event: { songId: string; progress: number }) => void)
  | null = null;
let cacheCallback:
  | ((event: { songId: string; entry: any }) => void)
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
  getSongsByIds: jest.fn(),
  getSongById: jest.fn(),
}));

jest.mock("@/services/songCache", () => ({
  getActiveDownloadSongIds: jest.fn(),
  cancelSongCaching: jest.fn(),
  subscribeSongCacheProgress: jest.fn((fn) => {
    progressCallback = fn;
    return () => {
      progressCallback = null;
    };
  }),
  subscribeSongCache: jest.fn((fn) => {
    cacheCallback = fn;
    return () => {
      cacheCallback = null;
    };
  }),
}));

const mockSongs: Child[] = [
  {
    id: "active-1",
    title: "downloading song 1",
    artist: "artist 1",
    album: "album 1",
    coverArt: "art-1",
  },
  {
    id: "active-2",
    title: "downloading song 2",
    artist: "artist 2",
    album: "album 2",
    coverArt: "art-2",
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
    progressCallback = null;
    cacheCallback = null;
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    (getCoverArtBaseUrl as jest.Mock).mockResolvedValue(
      (id?: string | null) => (id ? `https://art/${id}` : null),
    );
  });

  it("renders empty state when no active downloads", () => {
    (getActiveDownloadSongIds as jest.Mock).mockReturnValue([]);
    (getSongsByIds as jest.Mock).mockReturnValue([]);

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

  it("renders active downloads and updates progress live", () => {
    (getActiveDownloadSongIds as jest.Mock).mockReturnValue([
      "active-1",
      "active-2",
    ]);
    (getSongsByIds as jest.Mock).mockReturnValue(mockSongs);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<DownloadQueueScreen />);
    });

    let texts = getAllTexts(component);
    expect(texts).toContain("downloading song 1");
    expect(texts).toContain("downloading song 2");

    // Send progress event for active-1
    renderer.act(() => {
      progressCallback?.({ songId: "active-1", progress: 0.65 });
    });

    texts = getAllTexts(component);
    expect(texts.some((t) => t.includes("65%"))).toBe(true);

    renderer.act(() => {
      component.unmount();
    });
  });

  it("adds newly started download when progress event arrives for unlisted ID", () => {
    (getActiveDownloadSongIds as jest.Mock).mockReturnValue(["active-1"]);
    (getSongsByIds as jest.Mock).mockReturnValue([mockSongs[0]]);
    (getSongById as jest.Mock).mockReturnValue(mockSongs[1]);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<DownloadQueueScreen />);
    });

    let texts = getAllTexts(component);
    expect(texts).toContain("downloading song 1");
    expect(texts).not.toContain("downloading song 2");

    // active-2 starts downloading
    renderer.act(() => {
      progressCallback?.({ songId: "active-2", progress: 0.1 });
    });

    texts = getAllTexts(component);
    expect(texts).toContain("downloading song 2");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("removes song from queue when cache event fires (completed or cancelled)", () => {
    (getActiveDownloadSongIds as jest.Mock).mockReturnValue(["active-1"]);
    (getSongsByIds as jest.Mock).mockReturnValue([mockSongs[0]]);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<DownloadQueueScreen />);
    });

    let texts = getAllTexts(component);
    expect(texts).toContain("downloading song 1");

    // Cache event fires indicating completion
    renderer.act(() => {
      cacheCallback?.({ songId: "active-1", entry: {} as any });
    });

    texts = getAllTexts(component);
    expect(texts).not.toContain("downloading song 1");
    expect(texts).toContain("no downloads in progress");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("prompts confirmation to cancel download when pressed", () => {
    (getActiveDownloadSongIds as jest.Mock).mockReturnValue(["active-1"]);
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
      "are you sure you want to cancel caching this song?",
      expect.any(Array),
    );

    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    const confirmBtn = alertCalls[0][2].find((b: any) => b.text === "yes");

    renderer.act(() => {
      confirmBtn.onPress();
    });

    expect(cancelSongCaching).toHaveBeenCalledWith("active-1");

    renderer.act(() => {
      component.unmount();
    });
  });
});
