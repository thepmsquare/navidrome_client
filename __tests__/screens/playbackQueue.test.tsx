import React from "react";
import { Alert } from "react-native";
import { IconButton } from "react-native-paper";
import renderer, { act } from "react-test-renderer";

import QueueScreen from "@/app/queue";
import { PlaybackQueueView } from "@/components/PlaybackQueueView";
import { getCoverArtBaseUrl } from "@/services/api";
import {
  clearQueue,
  moveQueueItem,
  playTrackAtIndex,
  removeFromQueue,
  togglePlayback,
  usePlaybackQueue,
  usePlayerState,
} from "@/services/player";
import { Child } from "@/types";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    push: jest.fn(),
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("expo-image", () => ({
  Image: "Image",
}));

jest.mock("@/services/api", () => ({
  getCoverArtBaseUrl: jest.fn().mockResolvedValue((id?: string) => `https://art/${id}`),
}));

jest.mock("@/services/player", () => ({
  usePlaybackQueue: jest.fn(),
  usePlayerState: jest.fn(),
  playTrackAtIndex: jest.fn().mockResolvedValue(undefined),
  removeFromQueue: jest.fn().mockReturnValue(true),
  clearQueue: jest.fn(),
  moveQueueItem: jest.fn().mockReturnValue(true),
  togglePlayback: jest.fn().mockResolvedValue(undefined),
}));

const mockSong0: Child = {
  id: "song-0",
  title: "Song Zero (History)",
  artist: "Artist Zero",
  album: "Album Zero",
  duration: 180,
  coverArt: "art-0",
};

const mockSong1: Child = {
  id: "song-1",
  title: "Song One (Current)",
  artist: "Artist One",
  album: "Album One",
  duration: 200,
  coverArt: "art-1",
};

const mockSong2: Child = {
  id: "song-2",
  title: "Song Two (Up Next 1)",
  artist: "Artist Two",
  album: "Album Two",
  duration: 240,
  coverArt: "art-2",
};

const mockSong3: Child = {
  id: "song-3",
  title: "Song Three (Up Next 2)",
  artist: "Artist Three",
  album: "Album Three",
  duration: 210,
  coverArt: "art-3",
};

describe("PlaybackQueueView & QueueScreen", () => {
  let tree: renderer.ReactTestRenderer | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    (usePlayerState as jest.Mock).mockReturnValue({
      isPlaying: true,
      currentTrack: {
        id: "song-1",
        title: "Song One (Current)",
        artist: "Artist One",
        album: "Album One",
        coverArt: "art-1",
      },
    });
    (usePlaybackQueue as jest.Mock).mockReturnValue({
      queue: [mockSong0, mockSong1, mockSong2, mockSong3],
      currentIndex: 1,
      currentTrack: {
        id: "song-1",
        title: "Song One (Current)",
        artist: "Artist One",
        album: "Album One",
        coverArt: "art-1",
      },
    });
  });

  afterEach(() => {
    if (tree) {
      act(() => {
        tree?.unmount();
      });
      tree = null;
    }
  });

  it("should render now playing, upcoming count, and history section", () => {
    act(() => {
      tree = renderer.create(<PlaybackQueueView onBack={mockBack} />);
    });

    const root = tree!.root;
    expect(root.findAll((node: any) => node.props?.children === "Song One (Current)").length).toBeGreaterThan(0);
    expect(root.findAll((node: any) => node.props?.children === "history (1)").length).toBeGreaterThan(0);
    expect(root.findAll((node: any) => node.props?.children === "up next (2)").length).toBeGreaterThan(0);
  });

  it("should trigger back action when back button is pressed", () => {
    act(() => {
      tree = renderer.create(<PlaybackQueueView onBack={mockBack} />);
    });

    const root = tree!.root;
    const backBtn = root.findByProps({ accessibilityLabel: "back to player" });
    act(() => {
      backBtn.props.onPress();
    });

    expect(mockBack).toHaveBeenCalled();
  });

  it("should render standalone QueueScreen and trigger router.back", () => {
    act(() => {
      tree = renderer.create(<QueueScreen />);
    });

    const root = tree!.root;
    const backBtn = root.findByProps({ accessibilityLabel: "back to player" });
    act(() => {
      backBtn.props.onPress();
    });

    expect(mockBack).toHaveBeenCalled();
  });

  it("should expand history section when tapped and allow replaying past track", () => {
    act(() => {
      tree = renderer.create(<PlaybackQueueView onBack={mockBack} />);
    });

    const root = tree!.root;
    const historyBtn = root.findByProps({ accessibilityLabel: "history, 1 songs" });
    act(() => {
      historyBtn.props.onPress();
    });

    expect(root.findAll((node: any) => node.props?.children === "Song Zero (History)").length).toBeGreaterThan(0);

    const replayBtn = root.findByProps({ accessibilityLabel: "play again" });
    act(() => {
      replayBtn.props.onPress();
    });

    expect(playTrackAtIndex).toHaveBeenCalledWith(0);
  });

  it("should allow reordering upcoming tracks up and down", () => {
    act(() => {
      tree = renderer.create(<PlaybackQueueView onBack={mockBack} />);
    });

    const root = tree!.root;
    const moveDownButtons = root.findAll(
      (node: any) =>
        node.type === IconButton &&
        node.props?.accessibilityLabel === "move down",
    );
    expect(moveDownButtons.length).toBe(2);

    act(() => {
      moveDownButtons[0].props.onPress();
    });
    expect(moveQueueItem).toHaveBeenCalledWith(2, 3);

    const moveUpButtons = root.findAll(
      (node: any) =>
        node.type === IconButton && node.props?.accessibilityLabel === "move up",
    );
    expect(moveUpButtons.length).toBe(2);

    act(() => {
      moveUpButtons[1].props.onPress();
    });
    expect(moveQueueItem).toHaveBeenCalledWith(3, 2);
  });

  it("should allow removing an individual track from queue", () => {
    act(() => {
      tree = renderer.create(<PlaybackQueueView onBack={mockBack} />);
    });

    const root = tree!.root;
    const removeButtons = root.findAll(
      (node: any) =>
        node.type === IconButton &&
        node.props?.accessibilityLabel === "remove track",
    );
    expect(removeButtons.length).toBe(2);

    act(() => {
      removeButtons[0].props.onPress();
    });

    expect(removeFromQueue).toHaveBeenCalledWith(2);
  });

  it("should prompt confirmation before clearing the remaining queue", () => {
    const alertSpy = jest.spyOn(Alert, "alert");

    act(() => {
      tree = renderer.create(<PlaybackQueueView onBack={mockBack} />);
    });

    const root = tree!.root;
    const clearBtn = root.find((node: any) => node.props?.children === "clear" && typeof node.props?.onPress === "function");
    act(() => {
      clearBtn.props.onPress();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      "clear queue",
      "are you sure you want to clear upcoming tracks from the queue?",
      expect.any(Array),
    );

    const alertButtons = alertSpy.mock.calls[0][2] as any[];
    const confirmButton = alertButtons.find((btn) => btn.text === "clear");
    act(() => {
      confirmButton.onPress();
    });

    expect(clearQueue).toHaveBeenCalled();
  });

  it("should render empty state when there are no upcoming tracks", () => {
    (usePlaybackQueue as jest.Mock).mockReturnValue({
      queue: [mockSong1],
      currentIndex: 0,
      currentTrack: mockSong1,
    });

    act(() => {
      tree = renderer.create(<PlaybackQueueView onBack={mockBack} />);
    });

    const root = tree!.root;
    expect(root.findAll((node: any) => node.props?.children === "no upcoming tracks").length).toBeGreaterThan(0);
  });
});
