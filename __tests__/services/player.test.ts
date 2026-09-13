import React from "react";
import { Image } from "react-native";
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
  subscribePlayerState,
  togglePlayback,
  usePlayerState,
} from "@/services/player";
import * as songCache from "@/services/songCache";
import { updateSongCacheLastAccessed } from "@/services/db";
import { Child } from "@/types";

let stateListenerCb: ((status: any) => void) | null = null;
let trackEndedCb: (() => void) | null = null;
let nextTrackCb: (() => void) | null = null;
let prevTrackCb: (() => void) | null = null;
let playbackErrorCb: ((err: any) => void) | null = null;
let repeatModeCb: ((data: any) => void) | null = null;
let songCacheCb: ((data: any) => void) | null = null;

jest.mock("@/services/db", () => ({
  updateSongCacheLastAccessed: jest.fn(),
}));

jest.mock("@/modules/audio-playback", () => ({
  loadTrack: jest.fn(),
  play: jest.fn(),
  pause: jest.fn(),
  stop: jest.fn(),
  seekTo: jest.fn(),
  setVolume: jest.fn(),
  setRepeatMode: jest.fn(),
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
  scrobbleSong: jest.fn(),
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
      expect(api.scrobbleSong).toHaveBeenCalledWith("song-1");
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
    it("should resolve asset and load track for test sound", async () => {
      jest.spyOn(Image, "resolveAssetSource").mockReturnValue({
        uri: "file:///assets/test.wav",
        width: 0,
        height: 0,
        scale: 1,
      });

      await playTestSound();

      expect(getCurrentTrack()?.id).toBe("test-sound");
      expect(audioPlayback.loadTrack).toHaveBeenCalledWith({
        url: "file:///assets/test.wav",
        title: "test sound",
        artist: "navidrome client",
        playWhenReady: true,
      });
    });

    it("should catch error in playTestSound gracefully", async () => {
      jest.spyOn(Image, "resolveAssetSource").mockImplementationOnce(() => {
        throw new Error("asset resolve error");
      });
      await expect(playTestSound()).resolves.not.toThrow();
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

    it("should poll playback status when isPlaying is true", async () => {
      jest.useFakeTimers();

      (audioPlayback.getPlaybackStatus as jest.Mock).mockResolvedValue({
        isPlaying: true,
        isBuffering: false,
        duration: 200,
        position: 30,
        repeatMode: "off",
      });

      function TestPlayingComponent() {
        const state = usePlayerState();
        return React.createElement("text", null, `${state.isPlaying}-${state.position}`);
      }

      let tree: any;
      renderer.act(() => {
        tree = renderer.create(React.createElement(TestPlayingComponent));
      });

      // Simulate playing state update
      await renderer.act(async () => {
        stateListenerCb?.({
          isPlaying: true,
          isBuffering: false,
          duration: 200,
          position: 10,
          repeatMode: "off",
        });
      });

      // Advance timer for interval
      await renderer.act(async () => {
        jest.advanceTimersByTime(1000);
      });

      renderer.act(() => {
        tree.unmount();
      });

      jest.useRealTimers();
    });
  });
});
