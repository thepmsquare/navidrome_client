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
  toggleShuffle,
  toggleStarCurrentTrack,
  usePlayerState,
} from "@/services/player";
import {
  getCachedLyricsSync,
  resolveLyricsForSong,
} from "@/services/lyrics";

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
  toggleShuffle: jest.fn().mockResolvedValue(true),
  toggleStarCurrentTrack: jest.fn().mockResolvedValue(true),
  setRatingCurrentTrack: jest.fn().mockResolvedValue(4),
}));

jest.mock("@/components/SongCacheButton", () => ({
  SongCacheButton: "SongCacheButton",
}));

jest.mock("@/components/SongSaveButton", () => ({
  SongSaveButton: "SongSaveButton",
}));

jest.mock("@/services/sleepTimer", () => ({
  useSleepTimer: jest.fn().mockReturnValue({
    isActive: false,
    mode: null,
    targetTimestamp: null,
    remainingSeconds: 0,
  }),
  setDurationTimer: jest.fn(),
  setEndOfTrackTimer: jest.fn(),
  cancelSleepTimer: jest.fn(),
}));

let mockLyricsMode = "file_only";
let mockModeListeners: ((mode: string) => void)[] = [];

jest.mock("@/services/lyrics", () => ({
  fetchLyricsForSong: jest.fn().mockResolvedValue(null),
  getCachedLyricsSync: jest.fn().mockReturnValue(null),
  getLyricsMode: jest.fn(() => mockLyricsMode),
  resolveLyricsForSong: jest.fn().mockResolvedValue(null),
  subscribeLyricsMode: jest.fn((cb) => {
    mockModeListeners.push(cb);
    cb(mockLyricsMode);
    return () => {
      mockModeListeners = mockModeListeners.filter((l) => l !== cb);
    };
  }),
}));

jest.mock("@/components/SleepTimerModal", () => ({
  SleepTimerModal: (props: any) =>
    props.visible ? "SleepTimerModalVisible" : null,
}));

jest.mock("@/components/LyricsSheetModal", () => ({
  LyricsSheetModal: (props: any) =>
    props.visible ? "LyricsSheetModalVisible" : null,
}));

describe("PlayerScreen", () => {
  beforeEach(() => {
    mockLyricsMode = "file_only";
    mockModeListeners = [];
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

    // Shuffle button
    const shuffleBtn = root.root.findByProps({ accessibilityLabel: "shuffle off" });
    await act(async () => {
      shuffleBtn.props.onPress();
    });
    expect(toggleShuffle).toHaveBeenCalledTimes(1);
  });

  it("should render shuffle on button when shuffle is active and toggle it", async () => {
    (toggleShuffle as jest.Mock).mockResolvedValueOnce(false);
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
      shuffle: true,
      hasPrevious: true,
      hasNext: true,
      isPlayingFromCache: false,
      scrobbled: false,
    });

    let root: any;
    await act(async () => {
      root = renderer.create(<PlayerScreen />);
    });

    const shuffleBtn = root.root.findByProps({ accessibilityLabel: "shuffle on" });
    expect(shuffleBtn).toBeDefined();

    await act(async () => {
      shuffleBtn.props.onPress();
    });
    expect(toggleShuffle).toHaveBeenCalledTimes(1);
  });

  it("should handle shuffle toggle failure gracefully", async () => {
    (toggleShuffle as jest.Mock).mockRejectedValueOnce(new Error("failed"));
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
      shuffle: false,
      hasPrevious: true,
      hasNext: true,
      isPlayingFromCache: false,
      scrobbled: false,
    });

    let root: any;
    await act(async () => {
      root = renderer.create(<PlayerScreen />);
    });

    const shuffleBtn = root.root.findByProps({ accessibilityLabel: "shuffle off" });
    await act(async () => {
      shuffleBtn.props.onPress();
    });
    expect(toggleShuffle).toHaveBeenCalledTimes(1);
  });

  it("should open sleep timer modal when sleep timer button is pressed", async () => {
    const { useSleepTimer } = require("@/services/sleepTimer");
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
      hasPrevious: false,
      hasNext: true,
      isPlayingFromCache: false,
      scrobbled: false,
    });
    (useSleepTimer as jest.Mock).mockReturnValue({
      isActive: false,
      mode: null,
      targetTimestamp: null,
      remainingSeconds: 0,
    });

    let root: any;
    await act(async () => {
      root = renderer.create(<PlayerScreen />);
    });

    expect(JSON.stringify(root.toJSON())).not.toContain("SleepTimerModalVisible");

    const timerBtn = root.root.findByProps({ accessibilityLabel: "sleep timer" });
    expect(timerBtn).toBeDefined();

    await act(async () => {
      timerBtn.props.onPress();
    });

    expect(JSON.stringify(root.toJSON())).toContain("SleepTimerModalVisible");
  });

  it("should show active sleep timer badge and active button accessibility label", async () => {
    const { useSleepTimer } = require("@/services/sleepTimer");
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
      hasPrevious: false,
      hasNext: true,
      isPlayingFromCache: false,
      scrobbled: false,
    });
    (useSleepTimer as jest.Mock).mockReturnValue({
      isActive: true,
      mode: "duration",
      targetTimestamp: Date.now() + 900000,
      remainingSeconds: 900,
    });

    let root: any;
    await act(async () => {
      root = renderer.create(<PlayerScreen />);
    });

    const activeTimerBtn = root.root.findByProps({
      accessibilityLabel: "sleep timer active",
    });
    expect(activeTimerBtn).toBeDefined();

    const str = JSON.stringify(root.toJSON());
    expect(str).toContain("timer: 15m");
  });

  it("should not render lyrics button when song has no lyrics", async () => {
    (usePlayerState as jest.Mock).mockReturnValue({
      currentTrack: {
        id: "song-no-lyrics",
        title: "Track without lyrics",
        artist: "Artist",
        duration: 200,
      },
      isPlaying: false,
      position: 0,
      duration: 200,
      repeatMode: "off",
      hasPrevious: false,
      hasNext: false,
    });
    (resolveLyricsForSong as jest.Mock).mockResolvedValue(null);
    (getCachedLyricsSync as jest.Mock).mockReturnValue(null);

    let root: any;
    await act(async () => {
      root = renderer.create(<PlayerScreen />);
    });

    const lyricsButtons = root.root.findAllByProps({
      accessibilityLabel: "lyrics",
    });
    expect(lyricsButtons).toHaveLength(0);
    expect(JSON.stringify(root.toJSON())).not.toContain("LyricsSheetModalVisible");
  });

  it("should render lyrics button when song has lyrics and open modal on press", async () => {
    (usePlayerState as jest.Mock).mockReturnValue({
      currentTrack: {
        id: "song-with-lyrics",
        title: "Track with lyrics",
        artist: "Artist",
        duration: 200,
      },
      isPlaying: false,
      position: 0,
      duration: 200,
      repeatMode: "off",
      hasPrevious: false,
      hasNext: false,
    });
    (resolveLyricsForSong as jest.Mock).mockResolvedValue({
      synced: true,
      lines: [{ startMs: 500, text: "sing along" }],
    });

    let root: any;
    await act(async () => {
      root = renderer.create(<PlayerScreen />);
    });

    const lyricsButton = root.root.findByProps({
      accessibilityLabel: "lyrics",
    });
    expect(lyricsButton).toBeDefined();

    expect(JSON.stringify(root.toJSON())).not.toContain("LyricsSheetModalVisible");

    await act(async () => {
      lyricsButton.props.onPress();
    });

    expect(JSON.stringify(root.toJSON())).toContain("LyricsSheetModalVisible");
  });

  it("should render lyrics button immediately on render when getCachedLyricsSync returns lyrics", async () => {
    (usePlayerState as jest.Mock).mockReturnValue({
      currentTrack: {
        id: "song-cached",
        title: "Cached Track",
        artist: "Artist",
        duration: 200,
      },
      isPlaying: false,
      position: 0,
      duration: 200,
      repeatMode: "off",
      hasPrevious: false,
      hasNext: false,
    });
    (getCachedLyricsSync as jest.Mock).mockReturnValue({
      synced: true,
      lines: [{ startMs: 100, text: "cached line" }],
    });
    (resolveLyricsForSong as jest.Mock).mockResolvedValue({
      synced: true,
      lines: [{ startMs: 100, text: "cached line" }],
    });

    let root: any;
    await act(async () => {
      root = renderer.create(<PlayerScreen />);
    });

    // The lyrics button should exist immediately on first render
    const lyricsButton = root.root.findByProps({
      accessibilityLabel: "lyrics",
    });
    expect(lyricsButton).toBeDefined();
  });

  it("should re-resolve lyrics when mode changes while player screen is open", async () => {
    (usePlayerState as jest.Mock).mockReturnValue({
      currentTrack: {
        id: "song-mode-switch",
        title: "Track Switch",
        artist: "Artist",
        duration: 200,
      },
      isPlaying: false,
      position: 0,
      duration: 200,
      repeatMode: "off",
      hasPrevious: false,
      hasNext: false,
    });
    (getCachedLyricsSync as jest.Mock).mockReturnValue(null);
    (resolveLyricsForSong as jest.Mock).mockResolvedValue(null);

    let root: any;
    await act(async () => {
      root = renderer.create(<PlayerScreen />);
    });

    expect(resolveLyricsForSong).toHaveBeenCalledWith(
      "song-mode-switch",
      expect.objectContaining({ duration: 200, title: "Track Switch" }),
      expect.objectContaining({ mode: "file_only" }),
    );

    (resolveLyricsForSong as jest.Mock).mockResolvedValue({
      synced: true,
      lines: [{ startMs: 500, text: "online synced" }],
    });

    // Notify mode change to online_first
    await act(async () => {
      mockModeListeners.forEach((l) => l("online_first"));
    });

    expect(resolveLyricsForSong).toHaveBeenCalledWith(
      "song-mode-switch",
      expect.objectContaining({ duration: 200, title: "Track Switch" }),
      expect.objectContaining({ mode: "online_first" }),
    );

    const lyricsButton = root.root.findByProps({
      accessibilityLabel: "lyrics",
    });
    expect(lyricsButton).toBeDefined();
  });

  it("should prevent in-flight request from previous mode from overwriting new mode result", async () => {
    (usePlayerState as jest.Mock).mockReturnValue({
      currentTrack: {
        id: "song-race",
        title: "Track Race",
        artist: "Artist",
        duration: 200,
      },
      isPlaying: false,
      position: 0,
      duration: 200,
      repeatMode: "off",
      hasPrevious: false,
      hasNext: false,
    });

    let resolveFirstMode: any;
    const firstPromise = new Promise((resolve) => {
      resolveFirstMode = resolve;
    });

    let resolveSecondMode: any;
    const secondPromise = new Promise((resolve) => {
      resolveSecondMode = resolve;
    });

    (resolveLyricsForSong as jest.Mock)
      .mockReturnValueOnce(firstPromise)
      .mockReturnValueOnce(secondPromise);

    let root: any;
    await act(async () => {
      root = renderer.create(<PlayerScreen />);
    });

    // Switch mode to online_first while first request is still in flight
    await act(async () => {
      mockModeListeners.forEach((l) => l("online_first"));
    });

    // Resolve second request first (with online lyrics)
    await act(async () => {
      resolveSecondMode({
        synced: true,
        lines: [{ startMs: 1000, text: "second mode result" }],
      });
    });

    // Now resolve first mode request late with null
    await act(async () => {
      resolveFirstMode(null);
    });

    // The lyrics button should still be present because second mode won and first was cancelled
    const lyricsButton = root.root.findByProps({
      accessibilityLabel: "lyrics",
    });
    expect(lyricsButton).toBeDefined();
  });
});

