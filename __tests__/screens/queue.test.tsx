import React from "react";
import { Alert } from "react-native";
import renderer from "react-test-renderer";

import DownloadQueueScreen from "@/app/(main)/library/queue";
import { getCoverArtBaseUrl } from "@/services/api";
import { getSongById, getSongsByIds } from "@/services/db";
import {
  cancelSongCaching,
  dequeuePendingSong,
  getDownloadQueueState,
  subscribeCacheQueue,
  subscribeSongCacheProgress,
} from "@/services/songCache";
import { Child } from "@/types";

let progressCallback:
  | ((event: { songId: string; progress: number }) => void)
  | null = null;
let queueCallback:
  | ((state: { pending: string[]; active: string | null }) => void)
  | null = null;
let mockQueueState: { pending: string[]; active: string | null } = {
  pending: [],
  active: null,
};

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
  cancelSongCaching: jest.fn(),
  dequeuePendingSong: jest.fn(),
  getDownloadQueueState: jest.fn(() => mockQueueState),
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
    id: "active-1",
    title: "downloading song 1",
    artist: "artist 1",
    album: "album 1",
    coverArt: "art-1",
  },
  {
    id: "pending-1",
    title: "pending song 1",
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
    queueCallback = null;
    mockQueueState = { pending: [], active: null };
    (getDownloadQueueState as jest.Mock).mockImplementation(() => mockQueueState);
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    (getCoverArtBaseUrl as jest.Mock).mockResolvedValue(
      (id?: string | null) => (id ? `https://art/${id}` : null),
    );
  });

  it("renders empty state when no active downloads and no pending songs", () => {
    mockQueueState = { pending: [], active: null };
    (getSongsByIds as jest.Mock).mockReturnValue([]);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<DownloadQueueScreen />);
    });

    const texts = getAllTexts(component);
    expect(texts).toContain("download queue");
    expect(texts).toContain("0 songs in queue");
    expect(texts).toContain("no downloads in progress");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("renders active download and updates progress live", () => {
    mockQueueState = { active: "active-1", pending: [] };
    (getSongsByIds as jest.Mock).mockReturnValue([mockSongs[0]]);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<DownloadQueueScreen />);
    });

    let texts = getAllTexts(component);
    expect(texts).toContain("downloading song 1");
    expect(texts).toContain("1 song in queue");

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

  it("renders pending downloads and instantly dequeues on remove press without alert", () => {
    mockQueueState = { active: "active-1", pending: ["pending-1"] };
    (getSongsByIds as jest.Mock).mockReturnValue(mockSongs);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<DownloadQueueScreen />);
    });

    const texts = getAllTexts(component);
    expect(texts).toContain("downloading song 1");
    expect(texts).toContain("pending song 1");

    // Find the remove button for the pending song
    const removeButton = component.root.findByProps({
      accessibilityLabel: "remove from queue",
    });

    renderer.act(() => {
      removeButton.props.onPress();
    });

    // Should call dequeuePendingSong without prompting Alert
    expect(dequeuePendingSong).toHaveBeenCalledWith("pending-1");
    expect(Alert.alert).not.toHaveBeenCalled();

    renderer.act(() => {
      component.unmount();
    });
  });

  it("prompts confirmation to cancel active download when pressed", () => {
    mockQueueState = { active: "active-1", pending: [] };
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

  it("updates rendered list when subscribeCacheQueue callback fires", () => {
    mockQueueState = { active: null, pending: [] };
    (getSongsByIds as jest.Mock).mockReturnValue([]);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<DownloadQueueScreen />);
    });

    let texts = getAllTexts(component);
    expect(texts).toContain("no downloads in progress");

    // New queue state arrives with active song
    (getSongsByIds as jest.Mock).mockReturnValue([mockSongs[0]]);
    renderer.act(() => {
      queueCallback?.({ active: "active-1", pending: [] });
    });

    texts = getAllTexts(component);
    expect(texts).toContain("downloading song 1");
    expect(texts).not.toContain("no downloads in progress");

    renderer.act(() => {
      component.unmount();
    });
  });

  it("displays accurate counter and breakdown for active and pending downloads", () => {
    mockQueueState = { active: "active-1", pending: ["pending-1"] };
    (getSongsByIds as jest.Mock).mockReturnValue(mockSongs);

    let component: any;
    renderer.act(() => {
      component = renderer.create(<DownloadQueueScreen />);
    });

    let texts = getAllTexts(component);
    expect(texts).toContain("2 songs in queue");
    expect(texts).toContain("1 downloading • 1 queued");

    // Queue updates to 1 song only (pending dequeued or finished)
    renderer.act(() => {
      queueCallback?.({ active: "active-1", pending: [] });
    });

    texts = getAllTexts(component);
    expect(texts).toContain("1 song in queue");
    expect(texts).not.toContain("2 songs in queue");

    // All downloads completed
    renderer.act(() => {
      queueCallback?.({ active: null, pending: [] });
    });

    texts = getAllTexts(component);
    expect(texts).toContain("0 songs in queue");
    expect(texts).toContain("no downloads in progress");

    renderer.act(() => {
      component.unmount();
    });
  });
});

