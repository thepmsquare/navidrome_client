import React from "react";
import renderer, { act } from "react-test-renderer";

import PlayerScreen from "@/app/player";
import { getCoverArtBaseUrl } from "@/services/api";
import {
  cycleRepeatMode,
  playNext,
  playPrevious,
  seekToPosition,
  setRatingCurrentTrack,
  togglePlayback,
  toggleStarCurrentTrack,
  usePlayerState,
} from "@/services/player";

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

jest.mock("react-native-paper", () => {
  const actual = jest.requireActual("react-native-paper");
  return {
    ...actual,
    Snackbar: ({ children, visible }: any) => (visible ? children : null),
  };
});



jest.mock("expo-image", () => ({
  Image: "Image",
}));

jest.mock("@/services/api", () => ({
  getCoverArtBaseUrl: jest.fn().mockResolvedValue((id?: string) => `https://art/${id}`),
}));

jest.mock("@/services/player", () => ({
  usePlayerState: jest.fn(),
  cycleRepeatMode: jest.fn().mockResolvedValue(undefined),
  playNext: jest.fn().mockResolvedValue(undefined),
  playPrevious: jest.fn().mockResolvedValue(undefined),
  seekToPosition: jest.fn().mockResolvedValue(undefined),
  togglePlayback: jest.fn().mockResolvedValue(undefined),
  toggleStarCurrentTrack: jest.fn().mockResolvedValue(true),
  setRatingCurrentTrack: jest.fn().mockResolvedValue(4),
}));

jest.mock("@/components/SongCacheButton", () => ({
  SongCacheButton: "SongCacheButton",
}));

jest.mock("@/components/SongSaveButton", () => ({
  SongSaveButton: "SongSaveButton",
}));

describe("PlayerScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render empty state when no track is playing", () => {
    (usePlayerState as jest.Mock).mockReturnValue({
      currentTrack: null,
      isPlaying: false,
      isBuffering: false,
      position: 0,
      duration: 0,
      repeatMode: "off",
      hasPrevious: false,
      hasNext: false,
      isPlayingFromCache: false,
      scrobbled: false,
    });

    let tree: any;
    act(() => {
      tree = renderer.create(<PlayerScreen />);
    });

    const str = JSON.stringify(tree.toJSON());
    expect(str).toContain("no track playing");
  });

  it("should render current track with unstarred heart and allow starring", async () => {
    (usePlayerState as jest.Mock).mockReturnValue({
      currentTrack: {
        id: "song-1",
        title: "Neon Lights",
        artist: "Kraftwerk",
        album: "The Man-Machine",
        coverArt: "art-1",
        duration: 300,
        starred: null,
        userRating: 0,
      },
      isPlaying: true,
      isBuffering: false,
      position: 60,
      duration: 300,
      repeatMode: "off",
      hasPrevious: true,
      hasNext: true,
      isPlayingFromCache: false,
      scrobbled: false,
    });

    let root: any;
    await act(async () => {
      root = renderer.create(<PlayerScreen />);
    });

    const str = JSON.stringify(root.toJSON());
    expect(str).toContain("Neon Lights");
    expect(str).toContain("Kraftwerk");
    expect(str).toContain("The Man-Machine");

    // Find heart button (accessibilityLabel="star song")
    const heartBtn = root.root.findByProps({ accessibilityLabel: "star song" });
    expect(heartBtn).toBeDefined();

    await act(async () => {
      heartBtn.props.onPress();
    });

    expect(toggleStarCurrentTrack).toHaveBeenCalledTimes(1);
  });

  it("should render starred heart when track is starred and allow unstarring", async () => {
    (toggleStarCurrentTrack as jest.Mock).mockResolvedValueOnce(false);
    (usePlayerState as jest.Mock).mockReturnValue({
      currentTrack: {
        id: "song-1",
        title: "Neon Lights",
        artist: "Kraftwerk",
        album: "The Man-Machine",
        coverArt: "art-1",
        duration: 300,
        starred: "2026-09-26T10:00:00Z",
        userRating: 3,
      },
      isPlaying: true,
      isBuffering: false,
      position: 60,
      duration: 300,
      repeatMode: "all",
      hasPrevious: true,
      hasNext: true,
      isPlayingFromCache: false,
      scrobbled: true,
    });

    let root: any;
    await act(async () => {
      root = renderer.create(<PlayerScreen />);
    });

    const heartBtn = root.root.findByProps({ accessibilityLabel: "unstar song" });
    expect(heartBtn).toBeDefined();

    await act(async () => {
      heartBtn.props.onPress();
    });

    expect(toggleStarCurrentTrack).toHaveBeenCalledTimes(1);
  });

  it("should allow setting rating by pressing a star icon", async () => {
    (usePlayerState as jest.Mock).mockReturnValue({
      currentTrack: {
        id: "song-1",
        title: "Neon Lights",
        artist: "Kraftwerk",
        album: "The Man-Machine",
        coverArt: "art-1",
        duration: 300,
        starred: null,
        userRating: 2,
      },
      isPlaying: false,
      isBuffering: false,
      position: 0,
      duration: 300,
      repeatMode: "off",
      hasPrevious: false,
      hasNext: true,
      isPlayingFromCache: false,
      scrobbled: false,
    });

    let root: any;
    await act(async () => {
      root = renderer.create(<PlayerScreen />);
    });

    const star4 = root.root.findByProps({ accessibilityLabel: "rate 4 stars" });
    expect(star4).toBeDefined();

    await act(async () => {
      star4.props.onPress();
    });

    expect(setRatingCurrentTrack).toHaveBeenCalledWith(4);
  });

  it("should trigger transport controls (play/pause, next, prev, repeat)", async () => {
    (usePlayerState as jest.Mock).mockReturnValue({
      currentTrack: {
        id: "song-1",
        title: "Neon Lights",
        artist: "Kraftwerk",
        album: "The Man-Machine",
        coverArt: "art-1",
        duration: 300,
        starred: null,
        userRating: 0,
      },
      isPlaying: false,
      isBuffering: false,
      position: 120,
      duration: 300,
      repeatMode: "off",
      hasPrevious: true,
      hasNext: true,
      isPlayingFromCache: false,
      scrobbled: false,
    });

    let root: any;
    await act(async () => {
      root = renderer.create(<PlayerScreen />);
    });

    // Play button
    const playBtn = root.root.findByProps({ accessibilityLabel: "play" });
    await act(async () => {
      playBtn.props.onPress();
    });
    expect(togglePlayback).toHaveBeenCalledTimes(1);

    // Next track button
    const nextBtn = root.root.findByProps({ accessibilityLabel: "next track" });
    await act(async () => {
      nextBtn.props.onPress();
    });
    expect(playNext).toHaveBeenCalledTimes(1);

    // Previous track button
    const prevBtn = root.root.findByProps({ accessibilityLabel: "previous track" });
    await act(async () => {
      prevBtn.props.onPress();
    });
    expect(playPrevious).toHaveBeenCalledTimes(1);

    // Repeat button
    const repeatBtn = root.root.findByProps({ accessibilityLabel: "repeat off" });
    await act(async () => {
      repeatBtn.props.onPress();
    });
    expect(cycleRepeatMode).toHaveBeenCalledTimes(1);
  });
});
