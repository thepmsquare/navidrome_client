describe("full native exoplayer playlist & state synchronization (pb-3 & arch-1)", () => {
  describe("1. full native playlist lifecycle (pb-3)", () => {
    test.todo(
      "sets the entire queue as exoplayer MediaItems via setPlaylist(items, startIndex, initialPosition)",
    );
    test.todo(
      "native exoplayer automatically pre-buffers upcoming items and performs gapless transitions",
    );
    test.todo(
      "dispatches onMediaItemTransition event to js when track boundary is crossed natively",
    );
    test.todo(
      "updates js currentIndex and currentTrack synchronously upon receiving onMediaItemTransition",
    );
    test.todo(
      "delegates repeat mode directly to exoplayer (REPEAT_MODE_OFF, REPEAT_MODE_ALL, REPEAT_MODE_ONE)",
    );
    test.todo(
      "delegates shuffle mode directly to exoplayer (setShuffleModeEnabled) preserving original playlist order in timeline",
    );
    test.todo(
      "exoplayer native media notification next/previous actions navigate playlist without js roundtrip",
    );
  });

  describe("2. native playlist mutations", () => {
    test.todo(
      "appends or inserts MediaItem into exoplayer when addToQueue or playNextSong is called",
    );
    test.todo(
      "removes MediaItem from exoplayer by index when removeFromQueue is called",
    );
    test.todo(
      "reorders MediaItems in exoplayer using moveMediaItem(fromIndex, toIndex) on queue drag-and-drop",
    );
    test.todo(
      "clears native playlist via clearMediaItems when clearQueue is invoked",
    );
    test.todo(
      "replaces entire playlist seamlessly when new album or playlist is played via playPlaylist",
    );
    test.todo(
      "allows direct seek across playlist via seekTo(index, positionMs)",
    );
  });

  describe("3. scrobbling and now-playing reporting", () => {
    test.todo(
      "evaluates and triggers scrobble for completed track when onMediaItemTransition fires",
    );
    test.todo(
      "resets listening duration accumulator and scrobble guard immediately upon track transition",
    );
    test.todo(
      "dispatches now-playing ping to subsonic api for the newly active MediaItem",
    );
    test.todo(
      "does not emit duplicate scrobble if user rapidly skips through playlist items",
    );
  });

  describe("4. caching, downloads, and offline playback", () => {
    test.todo(
      "populates MediaItem with local file uri when track is cached on disk",
    );
    test.todo(
      "populates MediaItem with authenticated remote stream url when track is not cached",
    );
    test.todo(
      "updates MediaItem uri via updateMediaItemUri when background download completes during playback",
    );
    test.todo(
      "falls back to remote stream url if cached file is deleted while queued in exoplayer",
    );
    test.todo(
      "transitions seamlessly between cached tracks when network connection is offline",
    );
    test.todo(
      "emits playback error and halts cleanly when transitioning to an uncached track while offline",
    );
  });

  describe("5. sleep timer integration", () => {
    test.todo(
      "pauses playback at the exact transition boundary when sleep timer is set to stop after current track",
    );
    test.todo(
      "ramps down native player volume during fade-out window without disrupting playlist sequence",
    );
  });

  describe("6. native authoritative state & activity recreation (arch-1)", () => {
    test.todo(
      "native audio service exposes getPlaylistState with active index, position, timeline count, and playback state",
    );
    test.todo(
      "js hydrates player state directly from native exoplayer on app launch and activity resume",
    );
    test.todo(
      "reconciles js queue with native playlist if playback advanced multiple tracks while js activity was destroyed",
    );
    test.todo(
      "native MediaSession automatically reflects current track metadata and artwork from active MediaItem",
    );
    test.todo(
      "persists synchronized player session to sqlite when app is backgrounded or playback state changes",
    );
  });
});
