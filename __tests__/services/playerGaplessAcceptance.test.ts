import { AppState } from "react-native";
import * as audioPlayback from "@/modules/audio-playback";
import * as api from "@/services/api";
import {
  addToQueue,
  clearQueue,
  getCurrentIndex,
  getCurrentTrack,
  moveQueueItem,
  playPlaylist,
  removeFromQueue,
  resetPlayer,
  subscribePlayerState,
} from "@/services/player";
import { Child } from "@/types";

let stateListenerCb: ((status: any) => void) | null = null;
let mediaItemTransitionCb: ((data: { index: number; mediaId: string }) => void) | null = null;

jest.spyOn(AppState, "addEventListener").mockImplementation((() => ({
  remove: jest.fn(),
})) as any);

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
  loadTrack: jest.fn(),
  setPlaylist: jest.fn(),
  addPlaylistItem: jest.fn(),
  removePlaylistItem: jest.fn(),
  movePlaylistItem: jest.fn(),
  clearPlaylist: jest.fn(),
  seekToTrack: jest.fn(),
  play: jest.fn(),
  pause: jest.fn(),
  stop: jest.fn(),
  seekTo: jest.fn(),
  setVolume: jest.fn(),
  setRepeatMode: jest.fn(),
  setPlaybackSpeed: jest.fn(),
  setStopOnAppDismissed: jest.fn().mockResolvedValue(undefined),
  getPlaybackStatus: jest.fn().mockResolvedValue({
    isPlaying: false,
    isBuffering: false,
    duration: 100,
    position: 0,
    repeatMode: "off",
    playbackSpeed: 1.0,
  }),
  addPlaybackStateListener: jest.fn((cb) => {
    stateListenerCb = cb;
  }),
  addPlaybackStoppedListener: jest.fn(),
  addTrackEndedListener: jest.fn(),
  addNextTrackListener: jest.fn(),
  addPreviousTrackListener: jest.fn(),
  addPlaybackErrorListener: jest.fn(),
  addRepeatModeListener: jest.fn(),
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
  subscribeSongCache: jest.fn(),
}));

describe("full native exoplayer playlist & state synchronization (pb-3 & arch-1)", () => {
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
    await resetPlayer();
  });

  describe("1. full native playlist lifecycle (pb-3)", () => {
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
      // Simulate native ExoPlayer transitioning to index 1 (Song Two)
      mediaItemTransitionCb?.({ index: 1, mediaId: "song-2" });

      expect(getCurrentIndex()).toBe(1);
      expect(getCurrentTrack()?.id).toBe("song-2");
      expect(getCurrentTrack()?.title).toBe("Song Two");
    });

    test.todo("delegates repeat mode directly to exoplayer (REPEAT_MODE_OFF, REPEAT_MODE_ALL, REPEAT_MODE_ONE)");
    test.todo("delegates shuffle mode directly to exoplayer (setShuffleModeEnabled) preserving original playlist order in timeline");
    test.todo("exoplayer native media notification next/previous actions navigate playlist without js roundtrip");
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

    test.todo("clears native playlist via clearMediaItems when clearQueue is invoked");
    test.todo("allows direct seek across playlist via seekToTrack(index, positionMs)");
  });

  describe("3. scrobbling and now-playing reporting", () => {
    it("evaluates and triggers scrobble for completed track when onMediaItemTransition fires", async () => {
      await playPlaylist([song1, song2], 0);

      // Simulate playing past scrobble threshold on song1 (200s duration, threshold 75% = 150s)
      stateListenerCb?.({
        isPlaying: true,
        isBuffering: false,
        duration: 200,
        position: 160,
        repeatMode: "off",
        playbackSpeed: 1.0,
      });

      // Now native ExoPlayer auto-transitions to song-2
      mediaItemTransitionCb?.({ index: 1, mediaId: "song-2" });

      expect(api.scrobbleSong).toHaveBeenCalledWith("song-1", expect.any(Number));
      expect(api.scrobble).toHaveBeenCalledWith({ id: "song-2", submission: false });
    });

    test.todo("resets listening duration accumulator and scrobble guard immediately upon track transition");
    test.todo("does not emit duplicate scrobble if user rapidly skips through playlist items");
  });

  describe("4. caching, downloads, and offline playback", () => {
    test.todo("populates MediaItem with local file uri when track is cached on disk");
    test.todo("populates MediaItem with authenticated remote stream url when track is not cached");
    test.todo("updates MediaItem uri via updateMediaItemUri when background download completes during playback");
    test.todo("falls back to remote stream url if cached file is deleted while queued in exoplayer");
    test.todo("transitions seamlessly between cached tracks when network connection is offline");
    test.todo("emits playback error and halts cleanly when transitioning to an uncached track while offline");
  });

  describe("5. sleep timer integration", () => {
    test.todo("pauses playback at the exact transition boundary when sleep timer is set to stop after current track");
    test.todo("ramps down native player volume during fade-out window without disrupting playlist sequence");
  });

  describe("6. native authoritative state & activity recreation (arch-1)", () => {
    test.todo("native audio service exposes getPlaylistState with active index, position, timeline count, and playback state");
    test.todo("js hydrates player state directly from native exoplayer on app launch and activity resume");
    test.todo("reconciles js queue with native playlist if playback advanced multiple tracks while js activity was destroyed");
    test.todo("native MediaSession automatically reflects current track metadata and artwork from active MediaItem");
    test.todo("persists synchronized player session to sqlite when app is backgrounded or playback state changes");
  });
});
