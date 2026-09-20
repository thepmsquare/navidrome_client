import React from "react";
import { AppState, Image } from "react-native";
import renderer from "react-test-renderer";

import * as audioPlayback from "@/modules/audio-playback";
import * as api from "@/services/api";
import {
  cycleRepeatMode,
  getCurrentIndex,
  getCurrentQueue,
  getCurrentRepeatMode,
  getCurrentTrack,
  getPlayerState,
  getStatus,
  pausePlayback,
  playNext,
  playPlaylist,
  playPrevious,
  playSong,
  playTestSound,
  playTrackAtIndex,
  resetPlayer,
  resumePlayback,
  seekToPosition,
  setPlaybackRepeatMode,
  setPlaybackVolume,
  stopPlayback,
  stopTestSound,
  subscribePlayerState,
  togglePlayback,
  usePlayerState,
  hydratePlayerSession,
  updateKeepPlayingOnAppDismissed,
} from "@/services/player";
import * as songCache from "@/services/songCache";
import {
  clearPlayerSession,
  getKeepPlayingOnAppDismissed,
  getPlayerSession,
  savePlayerSession,
  setKeepPlayingOnAppDismissed,
  updateSongCacheLastAccessed,
  addPendingScrobble,
} from "@/services/db";
import { syncPendingScrobbles } from "@/services/scrobbleQueue";
import { Child } from "@/types";

let stateListenerCb: ((status: any) => void) | null = null;
let trackEndedCb: (() => void) | null = null;
let nextTrackCb: (() => void) | null = null;
let prevTrackCb: (() => void) | null = null;
let playbackErrorCb: ((err: any) => void) | null = null;
let repeatModeCb: ((data: any) => void) | null = null;
let songCacheCb: ((data: any) => void) | null = null;
let appStateCb: ((state: string) => void) | null = null;

jest.spyOn(AppState, "addEventListener").mockImplementation(((event: string, cb: any) => {
  if (event === "change") {
    appStateCb = cb;
  }
  return { remove: jest.fn() };
}) as any);

jest.mock("@/services/scrobbleQueue", () => ({
  syncPendingScrobbles: jest.fn().mockResolvedValue({ synced: 0, failed: 0 }),
}));

jest.mock("@/services/db", () => ({
  updateSongCacheLastAccessed: jest.fn(),
  getScrobbleMinDuration: jest.fn().mockReturnValue(240),
  getScrobbleMinPercent: jest.fn().mockReturnValue(75),
  savePlayerSession: jest.fn(),
  getPlayerSession: jest.fn().mockReturnValue(null),
  clearPlayerSession: jest.fn(),
  getKeepPlayingOnAppDismissed: jest.fn().mockReturnValue(false),
  setKeepPlayingOnAppDismissed: jest.fn(),
  addPendingScrobble: jest.fn(),
}));

jest.mock("@/modules/audio-playback", () => ({
  loadTrack: jest.fn(),
  play: jest.fn(),
  pause: jest.fn(),
  stop: jest.fn(),
  seekTo: jest.fn(),
  setVolume: jest.fn(),
  setRepeatMode: jest.fn(),
  setStopOnAppDismissed: jest.fn().mockResolvedValue(undefined),
  playTestSound: jest.fn(),
  stopTestSound: jest.fn(),
  getPlaybackStatus: jest.fn().mockResolvedValue({
    isPlaying: false,
    isBuffering: false,
    duration: 100,
    position: 10,
    repeatMode: "off",
  }),
  addPlaybackStateListener: jest.fn((cb) => {
    stateListenerCb = cb;
  }),
  addTrackEndedListener: jest.fn((cb) => {
    trackEndedCb = cb;
  }),
  addNextTrackListener: jest.fn((cb) => {
    nextTrackCb = cb;
  }),
  addPreviousTrackListener: jest.fn((cb) => {
    prevTrackCb = cb;
  }),
  addPlaybackErrorListener: jest.fn((cb) => {
    playbackErrorCb = cb;
  }),
  addRepeatModeListener: jest.fn((cb) => {
    repeatModeCb = cb;
  }),
}));

jest.mock("@/services/api", () => ({
  getCoverArtBaseUrl: jest.fn(async () => (id?: string | null) => (id ? `https://art/${id}` : null)),
  getSongStreamUrl: jest.fn(async (id: string) => `https://stream/${id}`),
  scrobble: jest.fn().mockResolvedValue(true),
  scrobbleSong: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/services/songCache", () => ({
  autoCacheSong: jest.fn().mockResolvedValue(undefined),
  getCachedSongPlaybackUri: jest.fn(),
  subscribeSongCache: jest.fn((cb) => {
    songCacheCb = cb;
  }),
}));

describe("player service", () => {
  const sampleSong1: Child = {
    id: "song-1",
    title: "Song One",
    artist: "Artist 1",
    album: "Album 1",
    coverArt: "art-1",
    duration: 200,
  };

  const sampleSong2: Child = {
    id: "song-2",
    title: "Song Two",
    artist: "Artist 2",
    album: "Album 2",
    coverArt: "art-2",
    duration: 180,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await resetPlayer();
  });

  describe("playback queue and track switching", () => {
    it("playPlaylist should initialize queue and play starting track", async () => {
      await playPlaylist([sampleSong1, sampleSong2], 0);

      expect(getCurrentQueue()).toEqual([sampleSong1, sampleSong2]);
      expect(getCurrentIndex()).toBe(0);
      expect(getCurrentTrack()?.id).toBe("song-1");
      expect(audioPlayback.loadTrack).toHaveBeenCalledWith({
        url: "https://stream/song-1",
        title: "Song One",
        artist: "Artist 1",
        album: "Album 1",
        artworkUrl: "https://art/art-1",
        playWhenReady: true,
      });
      // now-playing ping fires immediately at track load
      expect(api.scrobble).toHaveBeenCalledWith({ id: "song-1", submission: false });
      // scrobbleSong should NOT be called yet (threshold not met)
      expect(api.scrobbleSong).not.toHaveBeenCalled();
    });

    function simulateContinuousPlayback(
      duration: number,
      targetPosition: number,
      step: number = 2,
      repeatMode: "off" | "one" | "all" = "off",
    ) {
      for (let pos = step; pos <= targetPosition; pos += step) {
        stateListenerCb!({
          isPlaying: true,
          isBuffering: false,
          duration,
          position: pos,
          repeatMode,
        });
      }
    }

    it("scrobbleSong should fire when duration threshold is met via continuous playback", async () => {
      await playPlaylist([sampleSong1], 0);
      jest.clearAllMocks();

      simulateContinuousPlayback(300, 241, 2);

      expect(api.scrobbleSong).toHaveBeenCalledWith("song-1", expect.any(Number));
    });

    it("scrobbleSong should fire when percent threshold is met via continuous playback", async () => {
      await playPlaylist([sampleSong1], 0);
      jest.clearAllMocks();

      simulateContinuousPlayback(200, 152, 2);

      expect(api.scrobbleSong).toHaveBeenCalledWith("song-1", expect.any(Number));
    });

    it("scrobbleSong should not fire on seek jump ahead past threshold without listening", async () => {
      await playPlaylist([sampleSong1], 0);
      jest.clearAllMocks();

      await seekToPosition(245);
      stateListenerCb!({
        isPlaying: true,
        isBuffering: false,
        duration: 300,
        position: 245,
        repeatMode: "off",
      });

      expect(api.scrobbleSong).not.toHaveBeenCalled();
    });

    it("scrobbleSong should not fire twice for the same track", async () => {
      await playPlaylist([sampleSong1], 0);
      jest.clearAllMocks();

      simulateContinuousPlayback(300, 241, 2);
      stateListenerCb!({
        isPlaying: true,
        isBuffering: false,
        duration: 300,
        position: 250,
        repeatMode: "off",
      });

      expect(api.scrobbleSong).toHaveBeenCalledTimes(1);
    });

    it("scrobbled label should reset when next track starts after natural track end", async () => {
      await playPlaylist([sampleSong1, sampleSong2], 0);

      // Scrobble song 1 by meeting duration threshold via continuous playback
      simulateContinuousPlayback(300, 241, 2);
      expect(api.scrobbleSong).toHaveBeenCalledWith("song-1", expect.any(Number));
      await Promise.resolve();
      expect(getPlayerState().scrobbled).toBe(true);
      jest.clearAllMocks();

      // Natural track end
      await trackEndedCb!();

      // A stale playback-state callback arrives before loadTrack resolves
      stateListenerCb!({
        isPlaying: true,
        isBuffering: false,
        duration: 300,
        position: 241, // stale high position from song-1
        repeatMode: "off",
      });

      expect(getPlayerState().currentTrack?.id).toBe("song-2");
      // scrobbled must be false — the label should have disappeared
      expect(getPlayerState().scrobbled).toBe(false);
      // scrobbleSong must NOT have fired for song-2 yet
      expect(api.scrobbleSong).not.toHaveBeenCalled();
    });

    it("scrobbleSong failure should queue track into pending_scrobbles and mark scrobbled", async () => {
      await playPlaylist([sampleSong1], 0);
      jest.clearAllMocks();

      (api.scrobbleSong as jest.Mock).mockRejectedValueOnce(new Error("network error"));

      simulateContinuousPlayback(300, 241, 2);
      await Promise.resolve();

      expect(api.scrobbleSong).toHaveBeenCalledWith("song-1", expect.any(Number));
      expect(addPendingScrobble).toHaveBeenCalledWith("song-1", expect.any(Number));
      expect(getPlayerState().scrobbled).toBe(true);
    });

    it("repeat-one mode should reset scrobble guard on loop so each iteration scrobbles", async () => {
      await playPlaylist([sampleSong1], 0);
      await setPlaybackRepeatMode("one");
      jest.clearAllMocks();

      simulateContinuousPlayback(300, 245, 2, "one");
      await Promise.resolve();
      expect(api.scrobbleSong).toHaveBeenCalledWith("song-1", expect.any(Number));
      expect(getPlayerState().scrobbled).toBe(true);

      // Loop occurs: position jumps back near 0
      stateListenerCb!({
        isPlaying: true,
        isBuffering: false,
        duration: 300,
        position: 1,
        repeatMode: "one",
      });
      await Promise.resolve();
      expect(getPlayerState().scrobbled).toBe(false);

      // Next iteration reaches threshold again via continuous playback
      simulateContinuousPlayback(300, 245, 2, "one");
      await Promise.resolve();
      expect(api.scrobbleSong).toHaveBeenCalledTimes(2);
      expect(getPlayerState().scrobbled).toBe(true);
    });

    it("natural track end should scrobble if listened threshold was reached upon completion", async () => {
      await playPlaylist([sampleSong1, sampleSong2], 0);
      jest.clearAllMocks();

      // Listen to 74s of 100s track (target is 75s, within 2s grace at track end)
      simulateContinuousPlayback(100, 74, 2);
      expect(api.scrobbleSong).not.toHaveBeenCalled();

      // Natural track end fires
      await trackEndedCb!();

      expect(api.scrobbleSong).toHaveBeenCalledWith("song-1", expect.any(Number));
    });

    it("app resume should trigger syncPendingScrobbles", async () => {
      expect(appStateCb).toBeDefined();
      await appStateCb!("active");

      expect(syncPendingScrobbles).toHaveBeenCalled();
    });

    it("playSong should play single song in queue", async () => {
      await playSong(sampleSong2);

      expect(getCurrentQueue()).toEqual([sampleSong2]);
      expect(getCurrentIndex()).toBe(0);
      expect(getCurrentTrack()?.id).toBe("song-2");
    });

    it("playPlaylist with empty songs should return early without action", async () => {
      await playPlaylist([]);
      expect(getCurrentQueue()).toEqual([]);
    });

    it("playTrackAtIndex with invalid index should return early", async () => {
      await playPlaylist([sampleSong1], 0);
      await playTrackAtIndex(5);
      expect(getCurrentIndex()).toBe(0);
    });

    it("should prioritize cached song playback uri when available", async () => {
      (songCache.getCachedSongPlaybackUri as jest.Mock).mockReturnValue(
        "file:///cache/song-1.flac",
      );

      await playPlaylist([sampleSong1], 0);

      expect(audioPlayback.loadTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "file:///cache/song-1.flac",
        }),
      );
      expect(getPlayerState().isPlayingFromCache).toBe(true);
      expect(songCache.autoCacheSong).not.toHaveBeenCalled();
      expect(updateSongCacheLastAccessed).toHaveBeenCalledWith("song-1");
    });

    it("should kick off autoCacheSong in background when playing streaming track", async () => {
      (songCache.getCachedSongPlaybackUri as jest.Mock).mockReturnValue(null);

      await playPlaylist([sampleSong1], 0);

      expect(audioPlayback.loadTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://stream/song-1",
        }),
      );
      expect(getPlayerState().isPlayingFromCache).toBe(false);
      expect(songCache.autoCacheSong).toHaveBeenCalledWith("song-1");
      expect(updateSongCacheLastAccessed).not.toHaveBeenCalled();
    });
  });

  describe("playNext and playPrevious", () => {
    it("playNext should advance to next song in queue", async () => {
      await playPlaylist([sampleSong1, sampleSong2], 0);
      expect(getCurrentIndex()).toBe(0);

      await playNext();
      expect(getCurrentIndex()).toBe(1);
      expect(getCurrentTrack()?.id).toBe("song-2");
    });

    it("playNext at end of queue with repeatMode=all should loop to start", async () => {
      await playPlaylist([sampleSong1, sampleSong2], 1);
      await setPlaybackRepeatMode("all");

      await playNext();
      expect(getCurrentIndex()).toBe(0);
    });

    it("playPrevious should move to previous song in queue", async () => {
      await playPlaylist([sampleSong1, sampleSong2], 1);

      await playPrevious();
      expect(getCurrentIndex()).toBe(0);
      expect(getCurrentTrack()?.id).toBe("song-1");
    });

    it("playPrevious at start of queue with repeatMode=all should loop to end", async () => {
      await playPlaylist([sampleSong1, sampleSong2], 0);
      await setPlaybackRepeatMode("all");

      await playPrevious();
      expect(getCurrentIndex()).toBe(1);
    });
  });

  describe("playback controls", () => {
    it("pausePlayback calls pause", async () => {
      await pausePlayback();
      expect(audioPlayback.pause).toHaveBeenCalled();
    });

    it("resumePlayback calls play", async () => {
      await resumePlayback();
      expect(audioPlayback.play).toHaveBeenCalled();
    });

    it("togglePlayback pauses when playing and resumes when paused", async () => {
      (audioPlayback.getPlaybackStatus as jest.Mock).mockResolvedValueOnce({
        isPlaying: true,
      });
      await togglePlayback();
      expect(audioPlayback.pause).toHaveBeenCalled();

      (audioPlayback.getPlaybackStatus as jest.Mock).mockResolvedValueOnce({
        isPlaying: false,
      });
      await togglePlayback();
      expect(audioPlayback.play).toHaveBeenCalled();
    });

    it("stopPlayback calls stop and clears current track", async () => {
      await playPlaylist([sampleSong1], 0);
      await stopPlayback();

      expect(audioPlayback.stop).toHaveBeenCalled();
      expect(getCurrentTrack()).toBeNull();
    });

    it("seekToPosition calls seekTo", async () => {
      await seekToPosition(45);
      expect(audioPlayback.seekTo).toHaveBeenCalledWith(45);
    });

    it("setPlaybackVolume calls setVolume", async () => {
      await setPlaybackVolume(0.8);
      expect(audioPlayback.setVolume).toHaveBeenCalledWith(0.8);
    });

    it("cycleRepeatMode cycles off -> all -> one -> off", async () => {
      expect(getCurrentRepeatMode()).toBe("off");

      await cycleRepeatMode();
      expect(getCurrentRepeatMode()).toBe("all");

      await cycleRepeatMode();
      expect(getCurrentRepeatMode()).toBe("one");

      await cycleRepeatMode();
      expect(getCurrentRepeatMode()).toBe("off");
    });

    it("getStatus updates lastPlaybackStatus and returns it", async () => {
      (audioPlayback.getPlaybackStatus as jest.Mock).mockResolvedValueOnce({
        isPlaying: true,
        isBuffering: false,
        duration: 300,
        position: 150,
        repeatMode: "one",
      });

      const status = await getStatus();
      expect(status.position).toBe(150);
      expect(getPlayerState().position).toBe(150);
    });
  });

  describe("events, failover and state subscriptions", () => {
    it("subscribePlayerState should notify listener immediately and on changes", async () => {
      const listener = jest.fn();
      const unsubscribe = subscribePlayerState(listener);

      expect(listener).toHaveBeenCalled();

      await playPlaylist([sampleSong1], 0);
      expect(listener).toHaveBeenCalledTimes(2);

      unsubscribe();
      await stopPlayback();
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it("should catch listener error in notifyStateChanged", async () => {
      const badListener = jest.fn()
        .mockImplementationOnce(() => {})
        .mockImplementation(() => {
          throw new Error("listener error");
        });
      const unsubscribe = subscribePlayerState(badListener);
      expect(badListener).toHaveBeenCalledTimes(1);

      await stopPlayback();
      expect(badListener).toHaveBeenCalledTimes(2);
      unsubscribe();
    });

    it("track ended and next/prev native listeners should trigger track changes", async () => {
      await playPlaylist([sampleSong1, sampleSong2], 0);

      trackEndedCb?.();
      expect(getCurrentIndex()).toBe(1);

      prevTrackCb?.();
      expect(getCurrentIndex()).toBe(0);

      nextTrackCb?.();
      expect(getCurrentIndex()).toBe(1);
    });

    it("playback state and repeat mode native listeners should update state", async () => {
      await playPlaylist([sampleSong1], 0);

      stateListenerCb?.({
        isPlaying: true,
        isBuffering: false,
        duration: 200,
        position: 50,
        repeatMode: "off",
      });
      expect(getPlayerState().isPlaying).toBe(true);
      expect(getPlayerState().position).toBe(50);

      repeatModeCb?.({ mode: "all" });
      expect(getCurrentRepeatMode()).toBe("all");
    });

    it("repeat all should wrap around to first track when last track ends", async () => {
      await playPlaylist([sampleSong1, sampleSong2], 1);
      await setPlaybackRepeatMode("all");
      expect(getCurrentIndex()).toBe(1);
      expect(getCurrentTrack()?.id).toBe("song-2");

      jest.clearAllMocks();

      await playNext();

      // Should wrap around to song-1
      expect(getCurrentIndex()).toBe(0);
      expect(getCurrentTrack()?.id).toBe("song-1");
      expect(audioPlayback.loadTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Song One",
        }),
      );
    });

    it("should recover from cache playback error by switching to remote stream", async () => {
      (songCache.getCachedSongPlaybackUri as jest.Mock).mockReturnValue(
        "file:///cached/song-1.mp3",
      );
      await playPlaylist([sampleSong1], 0);
      expect(getPlayerState().isPlayingFromCache).toBe(true);

      // Simulate playback status with position
      stateListenerCb?.({
        isPlaying: true,
        isBuffering: false,
        duration: 200,
        position: 40,
        repeatMode: "off",
      });

      await playbackErrorCb?.({ errorCode: "LOAD_ERR", message: "disk read error" });

      expect(audioPlayback.loadTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://stream/song-1",
        }),
      );
      expect(audioPlayback.seekTo).toHaveBeenCalledWith(40);
    });

    it("should switch to remote stream if cached track is deleted while playing", async () => {
      (songCache.getCachedSongPlaybackUri as jest.Mock).mockReturnValue(
        "file:///cached/song-1.mp3",
      );
      await playPlaylist([sampleSong1], 0);

      await songCacheCb?.({ songId: "song-1", entry: null });

      expect(audioPlayback.loadTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://stream/song-1",
        }),
      );
    });
  });

  describe("playTestSound", () => {
    it("should resolve asset and call native playTestSound without affecting currentTrack", async () => {
      jest.spyOn(Image, "resolveAssetSource").mockReturnValue({
        uri: "file:///assets/test.wav",
        width: 0,
        height: 0,
        scale: 1,
      });

      const initialTrack = getCurrentTrack();
      await playTestSound();

      expect(getCurrentTrack()).toBe(initialTrack);
      expect(audioPlayback.playTestSound).toHaveBeenCalledWith(
        "file:///assets/test.wav",
      );
      expect(audioPlayback.loadTrack).not.toHaveBeenCalled();
    });

    it("should catch error in playTestSound gracefully", async () => {
      jest.spyOn(Image, "resolveAssetSource").mockImplementationOnce(() => {
        throw new Error("asset resolve error");
      });
      await expect(playTestSound()).resolves.not.toThrow();
    });

    it("should call native stopTestSound and catch errors gracefully", async () => {
      await stopTestSound();
      expect(audioPlayback.stopTestSound).toHaveBeenCalled();

      (audioPlayback.stopTestSound as jest.Mock).mockRejectedValueOnce(
        new Error("stop test error"),
      );
      await expect(stopTestSound()).resolves.not.toThrow();
    });
  });

  describe("error handling in player service", () => {
    it("should catch stop error during resetPlayer", async () => {
      (audioPlayback.stop as jest.Mock).mockRejectedValueOnce(
        new Error("stop error"),
      );
      await expect(resetPlayer()).resolves.not.toThrow();
    });

    it("should catch track loading error during playTrackAtIndex", async () => {
      (audioPlayback.loadTrack as jest.Mock).mockRejectedValueOnce(
        new Error("load failed"),
      );
      await expect(playPlaylist([sampleSong1], 0)).resolves.not.toThrow();
    });
  });

  describe("usePlayerState hook", () => {
    it("should initialize and render player state hook", () => {
      function TestHookComponent() {
        const state = usePlayerState();
        return React.createElement("text", null, state.isPlaying ? "playing" : "paused");
      }

      let tree: any;
      renderer.act(() => {
        tree = renderer.create(React.createElement(TestHookComponent));
      });

      expect(tree.toJSON()).toEqual({
        type: "text",
        props: {},
        children: ["paused"],
      });
      renderer.act(() => {
        tree.unmount();
      });
    });

    it("should update state when playback status changes via listener", async () => {
      function TestPlayingComponent() {
        const state = usePlayerState();
        return React.createElement("text", null, `${state.isPlaying}-${state.position}`);
      }

      let tree: any;
      renderer.act(() => {
        tree = renderer.create(React.createElement(TestPlayingComponent));
      });

      expect(tree.toJSON()).toEqual({
        type: "text",
        props: {},
        children: ["false-0"],
      });

      // Simulate playing state update from native listener
      await renderer.act(async () => {
        stateListenerCb?.({
          isPlaying: true,
          isBuffering: false,
          duration: 200,
          position: 10,
          repeatMode: "off",
        });
      });

      expect(tree.toJSON()).toEqual({
        type: "text",
        props: {},
        children: ["true-10"],
      });

      renderer.act(() => {
        tree.unmount();
      });
    });
  });

  describe("session persistence and hydration", () => {
    it("should persist session when playlist starts", async () => {
      await playPlaylist([sampleSong1, sampleSong2], 0);

      expect(savePlayerSession).toHaveBeenCalledWith(
        expect.objectContaining({
          queue: [sampleSong1, sampleSong2],
          currentIndex: 0,
          position: 0,
          repeatMode: "off",
        }),
      );
    });

    it("should persist session when playback is paused", async () => {
      await playPlaylist([sampleSong1], 0);
      (savePlayerSession as jest.Mock).mockClear();

      stateListenerCb!({
        isPlaying: true,
        isBuffering: false,
        duration: 200,
        position: 45,
        repeatMode: "off",
      });

      await pausePlayback();

      expect(savePlayerSession).toHaveBeenCalledWith(
        expect.objectContaining({
          queue: [sampleSong1],
          currentIndex: 0,
          position: 45,
          repeatMode: "off",
        }),
      );
    });

    it("should persist session when repeat mode is changed", async () => {
      await playPlaylist([sampleSong1], 0);
      (savePlayerSession as jest.Mock).mockClear();

      await setPlaybackRepeatMode("all");

      expect(savePlayerSession).toHaveBeenCalledWith(
        expect.objectContaining({
          repeatMode: "all",
        }),
      );
    });

    it("should persist session periodically (throttled) during playback", async () => {
      await playPlaylist([sampleSong1], 0);
      (savePlayerSession as jest.Mock).mockClear();

      const realDateNow = Date.now;
      try {
        let mockedTime = 100000;
        Date.now = jest.fn(() => mockedTime);

        // First update at mockedTime (100000)
        stateListenerCb!({
          isPlaying: true,
          isBuffering: false,
          duration: 200,
          position: 10,
          repeatMode: "off",
        });
        expect(savePlayerSession).toHaveBeenCalledTimes(1);
        (savePlayerSession as jest.Mock).mockClear();

        // 3 seconds later (< 10s throttle) - should NOT trigger save
        mockedTime += 3000;
        stateListenerCb!({
          isPlaying: true,
          isBuffering: false,
          duration: 200,
          position: 13,
          repeatMode: "off",
        });
        expect(savePlayerSession).not.toHaveBeenCalled();

        // 11 seconds later (total 14s > 10s throttle) - should trigger save
        mockedTime += 11000;
        stateListenerCb!({
          isPlaying: true,
          isBuffering: false,
          duration: 200,
          position: 24,
          repeatMode: "off",
        });
        expect(savePlayerSession).toHaveBeenCalledTimes(1);
        expect(savePlayerSession).toHaveBeenCalledWith(
          expect.objectContaining({
            position: 24,
          }),
        );
      } finally {
        Date.now = realDateNow;
      }
    });

    it("should clear session when player is reset", async () => {
      await playPlaylist([sampleSong1], 0);
      await resetPlayer();

      expect(clearPlayerSession).toHaveBeenCalled();
    });

    it("hydratePlayerSession should restore queue, index, position, and repeatMode", () => {
      (getPlayerSession as jest.Mock).mockReturnValueOnce({
        queue: [sampleSong1, sampleSong2],
        currentIndex: 1,
        position: 50,
        repeatMode: "all",
        updatedAt: "2026-09-19T00:00:00.000Z",
      });

      hydratePlayerSession();

      expect(getCurrentQueue()).toEqual([sampleSong1, sampleSong2]);
      expect(getCurrentIndex()).toBe(1);
      expect(getCurrentTrack()?.id).toBe("song-2");
      expect(getCurrentRepeatMode()).toBe("all");
      const state = getPlayerState();
      expect(state.position).toBe(50);
      expect(state.isPlaying).toBe(false);
    });

    it("resumePlayback after cold start hydration should load track and seek to saved position", async () => {
      (getPlayerSession as jest.Mock).mockReturnValueOnce({
        queue: [sampleSong1, sampleSong2],
        currentIndex: 1,
        position: 65,
        repeatMode: "off",
        updatedAt: "2026-09-19T00:00:00.000Z",
      });

      hydratePlayerSession();

      await resumePlayback();

      expect(audioPlayback.loadTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Song Two",
          playWhenReady: true,
        }),
      );
      expect(audioPlayback.seekTo).toHaveBeenCalledWith(65);
    });

    it("togglePlayback after cold start hydration should call resumePlayback and seek to saved position", async () => {
      (getPlayerSession as jest.Mock).mockReturnValueOnce({
        queue: [sampleSong1, sampleSong2],
        currentIndex: 0,
        position: 30,
        repeatMode: "off",
        updatedAt: "2026-09-19T00:00:00.000Z",
      });

      hydratePlayerSession();

      await togglePlayback();

      expect(audioPlayback.loadTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Song One",
          playWhenReady: true,
        }),
      );
      expect(audioPlayback.seekTo).toHaveBeenCalledWith(30);
    });

    it("seekToPosition before track is active should update state position and persist", async () => {
      (getPlayerSession as jest.Mock).mockReturnValueOnce({
        queue: [sampleSong1],
        currentIndex: 0,
        position: 10,
        repeatMode: "off",
        updatedAt: "2026-09-19T00:00:00.000Z",
      });

      hydratePlayerSession();
      (savePlayerSession as jest.Mock).mockClear();

      await seekToPosition(75);

      expect(getPlayerState().position).toBe(75);
      expect(savePlayerSession).toHaveBeenCalledWith(
        expect.objectContaining({
          position: 75,
        }),
      );
      // Native seekTo should not be called because track is not active yet in ExoPlayer
      expect(audioPlayback.seekTo).not.toHaveBeenCalled();
    });

    it("updateKeepPlayingOnAppDismissed should update db and native audioPlayback", async () => {
      await updateKeepPlayingOnAppDismissed(true);

      expect(setKeepPlayingOnAppDismissed).toHaveBeenCalledWith(true);
      expect(audioPlayback.setStopOnAppDismissed).toHaveBeenCalledWith(false);

      await updateKeepPlayingOnAppDismissed(false);

      expect(setKeepPlayingOnAppDismissed).toHaveBeenCalledWith(false);
      expect(audioPlayback.setStopOnAppDismissed).toHaveBeenCalledWith(true);
    });

    it("hydratePlayerSession should synchronize stopOnAppDismissed from db", () => {
      (getKeepPlayingOnAppDismissed as jest.Mock).mockReturnValueOnce(true);

      hydratePlayerSession();

      expect(audioPlayback.setStopOnAppDismissed).toHaveBeenCalledWith(false);
    });
  });
});
