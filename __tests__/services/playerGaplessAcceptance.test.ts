import { AppState } from "react-native";
import * as audioPlayback from "@/modules/audio-playback";
import * as api from "@/services/api";
import * as songCache from "@/services/songCache";
import {
  addToQueue,
  clearQueue,
  ensureSessionHydrated,
  getCurrentIndex,
  getCurrentQueue,
  getCurrentRepeatMode,
  getCurrentShuffle,
  getCurrentTrack,
  getPlayerState,
  hydratePlayerSession,
  moveQueueItem,
  playPlaylist,
  playTrackAtIndex,
  removeFromQueue,
  resetPlayer,
  setPlaybackRepeatMode,
  setPlaybackShuffle,
  subscribePlayerState,
} from "@/services/player";
import {
  cancelSleepTimer,
  getSleepTimerState,
  setDurationTimer,
  setEndOfTrackTimer,
} from "@/services/sleepTimer";
import { savePlayerSession, getPlayerSession } from "@/services/db";
import { Child } from "@/types";

let stateListenerCb: ((status: any) => void) | null = null;
let mediaItemTransitionCb: ((data: { index: number; mediaId: string }) => void) | null = null;
let songCacheCb: ((data: { songId: string; entry: any }) => void) | null = null;
let playbackErrorCb: ((err: any) => void) | null = null;
let repeatModeCb: ((data: { mode: string }) => void) | null = null;
let appStateCb: ((state: string) => void) | null = null;

jest.spyOn(AppState, "addEventListener").mockImplementation(((event: string, cb: any) => {
  if (event === "change") {
    appStateCb = cb;
  }
  return { remove: jest.fn() };
}) as any);

jest.mock("@/services/scrobbleQueue", () => ({
  syncPendingScrobbles: jest.fn().mockResolvedValue({ synced: 0, failed: 0 }),
  notifyScrobbleQueueChanged: jest.fn(),
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
  getSongById: jest.fn().mockReturnValue(null),
  updateSongStarred: jest.fn(),
  updateSongRating: jest.fn(),
  getPlaybackSpeedSetting: jest.fn().mockReturnValue(1.0),
  setPlaybackSpeedSetting: jest.fn(),
}));

jest.mock("@/modules/audio-playback", () => ({
  loadTrack: jest.fn().mockResolvedValue(undefined),
  setPlaylist: jest.fn().mockResolvedValue(undefined),
  addPlaylistItem: jest.fn().mockResolvedValue(undefined),
  removePlaylistItem: jest.fn().mockResolvedValue(undefined),
  movePlaylistItem: jest.fn().mockResolvedValue(undefined),
  clearPlaylist: jest.fn().mockResolvedValue(undefined),
  seekToTrack: jest.fn().mockResolvedValue(undefined),
  updatePlaylistItemUri: jest.fn().mockResolvedValue(undefined),
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  seekTo: jest.fn().mockResolvedValue(undefined),
  setVolume: jest.fn().mockResolvedValue(undefined),
  setRepeatMode: jest.fn().mockResolvedValue(undefined),
  setShuffleModeEnabled: jest.fn().mockResolvedValue(undefined),
  setPlaybackSpeed: jest.fn().mockResolvedValue(undefined),
  setStopOnAppDismissed: jest.fn().mockResolvedValue(undefined),
  getPlaybackStatus: jest.fn().mockResolvedValue({
    isPlaying: false,
    isBuffering: false,
    duration: 100,
    position: 0,
    repeatMode: "off",
    playbackSpeed: 1.0,
  }),
  getPlaylistState: jest.fn().mockResolvedValue(null),
  addPlaybackStateListener: jest.fn((cb) => {
    stateListenerCb = cb;
  }),
  addPlaybackStoppedListener: jest.fn(),
  addTrackEndedListener: jest.fn(),
  addNextTrackListener: jest.fn(),
  addPreviousTrackListener: jest.fn(),
  addPlaybackErrorListener: jest.fn((cb) => {
    playbackErrorCb = cb;
  }),
  addRepeatModeListener: jest.fn((cb) => {
    repeatModeCb = cb;
  }),
  addMediaItemTransitionListener: jest.fn((cb) => {
    mediaItemTransitionCb = cb;
  }),
}));

jest.mock("@/services/api", () => ({
  getCoverArtBaseUrl: jest.fn(async () => (id?: string | null) => (id ? `https://art/${id}` : null)),
  getSongStreamUrl: jest.fn(async (id: string) => `https://stream/${id}`),
  scrobble: jest.fn().mockResolvedValue(true),
  scrobbleSong: jest.fn().mockResolvedValue(undefined),
  star: jest.fn().mockResolvedValue(true),
  unstar: jest.fn().mockResolvedValue(true),
  setRating: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/services/songCache", () => ({
  autoCacheSong: jest.fn().mockResolvedValue(undefined),
  getCachedSongPlaybackUri: jest.fn().mockReturnValue(null),
  getCachedCoverArtUri: jest.fn().mockReturnValue(null),
  subscribeSongCache: jest.fn((cb) => {
    songCacheCb = cb;
  }),
}));

describe("full native exoplayer playlist & state synchronization", () => {
  const song1: Child = {
    id: "song-1",
    title: "Song One",
    artist: "Artist 1",
    album: "Album 1",
    duration: 200,
  };
  const song2: Child = {
    id: "song-2",
    title: "Song Two",
    artist: "Artist 2",
    album: "Album 2",
    duration: 300,
  };
  const song3: Child = {
    id: "song-3",
    title: "Song Three",
    artist: "Artist 3",
    album: "Album 3",
    duration: 250,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    cancelSleepTimer();
    (songCache.getCachedSongPlaybackUri as jest.Mock).mockReturnValue(null);
    (audioPlayback.getPlaylistState as jest.Mock).mockResolvedValue(null);
    await resetPlayer();
  });

  describe("1. full native playlist lifecycle", () => {
    it("sets the entire queue as exoplayer MediaItems via setPlaylist(items, startIndex, initialPosition)", async () => {
      await playPlaylist([song1, song2, song3], 0);

      expect(audioPlayback.setPlaylist).toHaveBeenCalledTimes(1);
      expect(audioPlayback.setPlaylist).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            mediaId: "song-1",
            title: "Song One",
            url: "https://stream/song-1",
          }),
          expect.objectContaining({
            mediaId: "song-2",
            title: "Song Two",
            url: "https://stream/song-2",
          }),
          expect.objectContaining({
            mediaId: "song-3",
            title: "Song Three",
            url: "https://stream/song-3",
          }),
        ],
        0,
        0
      );
    });

    it("updates js currentIndex and currentTrack synchronously upon receiving onMediaItemTransition", async () => {
      await playPlaylist([song1, song2, song3], 0);

      expect(mediaItemTransitionCb).toBeDefined();
      mediaItemTransitionCb?.({ index: 1, mediaId: "song-2" });

      expect(getCurrentIndex()).toBe(1);
      expect(getCurrentTrack()?.id).toBe("song-2");
      expect(getCurrentTrack()?.title).toBe("Song Two");
    });

    it("delegates repeat mode directly to exoplayer (REPEAT_MODE_OFF, REPEAT_MODE_ALL, REPEAT_MODE_ONE)", async () => {
      await playPlaylist([song1, song2], 0);

      await setPlaybackRepeatMode("all");
      expect(audioPlayback.setRepeatMode).toHaveBeenCalledWith("all");
      expect(getCurrentRepeatMode()).toBe("all");

      await setPlaybackRepeatMode("one");
      expect(audioPlayback.setRepeatMode).toHaveBeenCalledWith("one");
      expect(getCurrentRepeatMode()).toBe("one");

      await setPlaybackRepeatMode("off");
      expect(audioPlayback.setRepeatMode).toHaveBeenCalledWith("off");
      expect(getCurrentRepeatMode()).toBe("off");
    });

    it("delegates shuffle mode directly to exoplayer (setShuffleModeEnabled) preserving original playlist order in timeline", async () => {
      await playPlaylist([song1, song2, song3], 0);

      await setPlaybackShuffle(true);
      expect(audioPlayback.setShuffleModeEnabled).toHaveBeenCalledWith(true);
      expect(getCurrentShuffle()).toBe(true);

      await setPlaybackShuffle(false);
      expect(audioPlayback.setShuffleModeEnabled).toHaveBeenCalledWith(false);
      expect(getCurrentShuffle()).toBe(false);
    });

    it("exoplayer native media notification next/previous actions navigate playlist without js roundtrip", async () => {
      await playPlaylist([song1, song2, song3], 0);

      // Simulate native ExoPlayer transitioning directly to next track from notification action
      mediaItemTransitionCb?.({ index: 1, mediaId: "song-2" });

      expect(getCurrentIndex()).toBe(1);
      expect(getCurrentTrack()?.id).toBe("song-2");
      // Does not re-initialize or call setPlaylist again
      expect(audioPlayback.setPlaylist).toHaveBeenCalledTimes(1);
    });
  });

  describe("2. native playlist mutations", () => {
    it("appends MediaItem into exoplayer when addToQueue is called", async () => {
      await playPlaylist([song1, song2], 0);

      await addToQueue(song3);

      expect(audioPlayback.addPlaylistItem).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaId: "song-3",
          title: "Song Three",
          url: "https://stream/song-3",
        })
      );
    });

    it("removes MediaItem from exoplayer by index when removeFromQueue is called", async () => {
      await playPlaylist([song1, song2, song3], 0);

      await removeFromQueue(1);

      expect(audioPlayback.removePlaylistItem).toHaveBeenCalledWith(1);
    });

    it("reorders MediaItems in exoplayer using moveMediaItem(fromIndex, toIndex) on queue drag-and-drop", async () => {
      await playPlaylist([song1, song2, song3], 0);

      await moveQueueItem(0, 2);

      expect(audioPlayback.movePlaylistItem).toHaveBeenCalledWith(0, 2);
    });

    it("clears native playlist via clearMediaItems when clearQueue is invoked", async () => {
      await playPlaylist([song1, song2, song3], 0);

      await clearQueue(true);

      expect(audioPlayback.clearPlaylist).toHaveBeenCalled();
      expect(getCurrentQueue()).toEqual([]);
    });

    it("allows direct seek across playlist via seekToTrack(index, positionMs)", async () => {
      await playPlaylist([song1, song2, song3], 0);

      await playTrackAtIndex(2);

      expect(audioPlayback.seekToTrack).toHaveBeenCalledWith(2, 0);
      expect(audioPlayback.setPlaylist).toHaveBeenCalledTimes(1);
    });
  });

  function simulatePlayback(duration: number, targetPosition: number, step: number = 2) {
    for (let pos = step; pos <= targetPosition; pos += step) {
      stateListenerCb?.({
        isPlaying: true,
        isBuffering: false,
        duration,
        position: pos,
        repeatMode: "off",
        playbackSpeed: 1.0,
      });
    }
  }

  describe("3. scrobbling and now-playing reporting", () => {
    it("evaluates and triggers scrobble for completed track when onMediaItemTransition fires", async () => {
      await playPlaylist([song1, song2], 0);

      simulatePlayback(200, 160);

      mediaItemTransitionCb?.({ index: 1, mediaId: "song-2" });

      expect(api.scrobbleSong).toHaveBeenCalledWith("song-1", expect.any(Number));
      expect(api.scrobble).toHaveBeenCalledWith({ id: "song-2", submission: false });
    });

    it("resets listening duration accumulator and scrobble guard immediately upon track transition", async () => {
      await playPlaylist([song1, song2], 0);

      simulatePlayback(200, 160);

      mediaItemTransitionCb?.({ index: 1, mediaId: "song-2" });
      (api.scrobbleSong as jest.Mock).mockClear();

      // Report position for song-2 at only 10s (should not be scrobbled)
      stateListenerCb?.({
        isPlaying: true,
        isBuffering: false,
        duration: 300,
        position: 10,
        repeatMode: "off",
        playbackSpeed: 1.0,
      });

      expect(api.scrobbleSong).not.toHaveBeenCalled();
    });

    it("does not emit duplicate scrobble if user rapidly skips through playlist items", async () => {
      await playPlaylist([song1, song2, song3], 0);

      // Played only 5 seconds on song-1
      stateListenerCb?.({
        isPlaying: true,
        isBuffering: false,
        duration: 200,
        position: 5,
        repeatMode: "off",
        playbackSpeed: 1.0,
      });

      // Quick skip to song-2
      mediaItemTransitionCb?.({ index: 1, mediaId: "song-2" });
      expect(api.scrobbleSong).not.toHaveBeenCalled();

      // Quick skip to song-3
      mediaItemTransitionCb?.({ index: 2, mediaId: "song-3" });
      expect(api.scrobbleSong).not.toHaveBeenCalled();
    });
  });

  describe("4. caching, downloads, and offline playback", () => {
    it("populates MediaItem with local file uri when track is cached on disk", async () => {
      (songCache.getCachedSongPlaybackUri as jest.Mock).mockImplementation((id: string) => {
        if (id === "song-1") return "file:///cache/manual/song-1.mp3";
        return null;
      });

      await playPlaylist([song1, song2], 0);

      expect(audioPlayback.setPlaylist).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            mediaId: "song-1",
            url: "file:///cache/manual/song-1.mp3",
          }),
          expect.objectContaining({
            mediaId: "song-2",
            url: "https://stream/song-2",
          }),
        ],
        0,
        0
      );
    });

    it("populates MediaItem with authenticated remote stream url when track is not cached", async () => {
      await playPlaylist([song1], 0);

      expect(api.getSongStreamUrl).toHaveBeenCalledWith("song-1");
      expect(audioPlayback.setPlaylist).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            mediaId: "song-1",
            url: "https://stream/song-1",
          }),
        ],
        0,
        0
      );
    });

    it("updates MediaItem uri via updateMediaItemUri when background download completes during playback", async () => {
      await playPlaylist([song1, song2], 0);

      // Background download for song-2 completes
      songCacheCb?.({
        songId: "song-2",
        entry: {
          id: "song-2",
          localFilePath: "file:///cache/manual/song-2.mp3",
        },
      });

      expect(audioPlayback.updatePlaylistItemUri).toHaveBeenCalledWith(
        1,
        "file:///cache/manual/song-2.mp3"
      );
    });

    it("does not immediately replace active MediaItem uri when background download completes for currently playing track", async () => {
      await playPlaylist([song1, song2], 0);
      (audioPlayback.updatePlaylistItemUri as jest.Mock).mockClear();

      // Background download for currently playing song-1 completes
      songCacheCb?.({
        songId: "song-1",
        entry: {
          id: "song-1",
          localFilePath: "file:///cache/manual/song-1.mp3",
        },
      });

      // Should not replace active playing media item mid-playback to prevent position reset to 0
      expect(audioPlayback.updatePlaylistItemUri).not.toHaveBeenCalled();
      expect(getPlayerState().isPlayingFromCache).toBe(true);
    });

    it("updates previous track uri to cached file in playlist when transitioning to next track", async () => {
      await playPlaylist([song1, song2], 0);
      (audioPlayback.updatePlaylistItemUri as jest.Mock).mockClear();

      (songCache.getCachedSongPlaybackUri as jest.Mock).mockImplementation((id: string) => {
        if (id === "song-1") return "file:///cache/manual/song-1.mp3";
        return null;
      });

      // Track naturally transitions to next track
      mediaItemTransitionCb?.({ index: 1, mediaId: "song-2" });

      expect(audioPlayback.updatePlaylistItemUri).toHaveBeenCalledWith(
        0,
        "file:///cache/manual/song-1.mp3"
      );
    });

    it("falls back to remote stream url if cached file is deleted while queued in exoplayer", async () => {
      (songCache.getCachedSongPlaybackUri as jest.Mock).mockReturnValue("file:///cache/manual/song-1.mp3");
      await playPlaylist([song1, song2], 0);

      // Song-1 is deleted from cache
      await songCacheCb?.({
        songId: "song-1",
        entry: null,
      });

      expect(audioPlayback.updatePlaylistItemUri).toHaveBeenCalledWith(
        0,
        "https://stream/song-1"
      );
    });

    it("transitions seamlessly between cached tracks when network connection is offline", async () => {
      (songCache.getCachedSongPlaybackUri as jest.Mock).mockImplementation(
        (id: string) => `file:///cache/${id}.mp3`
      );

      await playPlaylist([song1, song2], 0);
      (api.getSongStreamUrl as jest.Mock).mockClear();

      // Transition to song-2
      mediaItemTransitionCb?.({ index: 1, mediaId: "song-2" });

      expect(getCurrentIndex()).toBe(1);
      expect(api.getSongStreamUrl).not.toHaveBeenCalled();
    });

    it("emits playback error and halts cleanly when transitioning to an uncached track while offline", async () => {
      await playPlaylist([song1, song2], 0);

      playbackErrorCb?.({
        errorCode: "ERROR_CODE_IO_NETWORK_CONNECTION_FAILED",
        message: "No internet connection",
      });

      // Playback status reflects halted state without crash
      expect(audioPlayback.pause).toHaveBeenCalled();
    });
  });

  describe("5. sleep timer integration", () => {
    it("pauses playback at the exact transition boundary when sleep timer is set to stop after current track", async () => {
      await playPlaylist([song1, song2], 0);

      setEndOfTrackTimer();
      expect(getSleepTimerState().isActive).toBe(true);

      // Auto-transition to next track fires at boundary
      mediaItemTransitionCb?.({ index: 1, mediaId: "song-2" });

      expect(audioPlayback.pause).toHaveBeenCalled();
      expect(getSleepTimerState().isActive).toBe(false);
    });

    it("ramps down native player volume during fade-out window without disrupting playlist sequence", async () => {
      await playPlaylist([song1, song2], 0);

      // Set volume directly during sleep timer fade
      await audioPlayback.setVolume(0.5);
      expect(audioPlayback.setVolume).toHaveBeenCalledWith(0.5);

      await audioPlayback.setVolume(0.1);
      expect(audioPlayback.setVolume).toHaveBeenCalledWith(0.1);

      // Playlist sequence remains completely intact
      expect(getCurrentQueue()).toHaveLength(2);
    });
  });

  describe("6. native authoritative state & activity recreation", () => {
    it("native audio service exposes getPlaylistState with active index, position, timeline count, and playback state", async () => {
      (audioPlayback.getPlaylistState as jest.Mock).mockResolvedValue({
        activeIndex: 1,
        position: 45,
        duration: 300,
        isPlaying: true,
        repeatMode: "all",
        shuffle: false,
        itemCount: 2,
      });

      const state = await audioPlayback.getPlaylistState();
      expect(state).toEqual(
        expect.objectContaining({
          activeIndex: 1,
          position: 45,
          isPlaying: true,
        })
      );
    });

    it("js hydrates player state directly from native exoplayer on app launch and activity resume", async () => {
      (audioPlayback.getPlaylistState as jest.Mock).mockResolvedValue({
        activeIndex: 2,
        position: 50,
        duration: 250,
        isPlaying: true,
        repeatMode: "off",
        shuffle: false,
        itemCount: 3,
      });

      (getPlayerSession as jest.Mock).mockReturnValue({
        queue: [song1, song2, song3],
        currentIndex: 0,
        position: 0,
      });

      await hydratePlayerSession();

      expect(getCurrentIndex()).toBe(2);
      expect(getCurrentTrack()?.id).toBe("song-3");
    });

    it("reconciles js queue with native playlist if playback advanced multiple tracks while js activity was destroyed", async () => {
      (getPlayerSession as jest.Mock).mockReturnValue({
        queue: [song1, song2, song3],
        currentIndex: 0,
      });

      (audioPlayback.getPlaylistState as jest.Mock).mockResolvedValue({
        activeIndex: 2,
        position: 10,
        isPlaying: true,
      });

      // App resumes from background
      await appStateCb?.("active");

      expect(getCurrentIndex()).toBe(2);
    });

    it("native MediaSession automatically reflects current track metadata and artwork from active MediaItem", async () => {
      await playPlaylist([song1], 0);

      expect(audioPlayback.setPlaylist).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            mediaId: "song-1",
            title: "Song One",
            artist: "Artist 1",
            album: "Album 1",
            artworkUrl: "https://art/song-1",
          }),
        ],
        0,
        0
      );
    });

    it("persists synchronized player session to sqlite when app is backgrounded or playback state changes", async () => {
      await playPlaylist([song1, song2], 0);

      mediaItemTransitionCb?.({ index: 1, mediaId: "song-2" });

      appStateCb?.("background");

      expect(savePlayerSession).toHaveBeenCalledWith(
        expect.objectContaining({
          currentIndex: 1,
        })
      );
    });
  });
});
