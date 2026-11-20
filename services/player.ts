import { useEffect, useState } from "react";
import { AppState, Image } from "react-native";

import {
  addMediaItemTransitionListener,
  addNextTrackListener,
  addPlaybackErrorListener,
  addPlaybackStateListener,
  addPlaybackStoppedListener,
  addPreviousTrackListener,
  addRepeatModeListener,
  addTrackEndedListener,
  addPlaylistItem,
  clearCompletedTracks,
  clearPendingAutoCacheTracks,
  clearPlaylist,
  getCompletedTracks,
  getPendingAutoCacheTracks,
  getPlaybackStatus,
  getPlaylistState,
  loadTrack,
  movePlaylistItem,
  playTestSound as nativePlayTestSound,
  stopTestSound as nativeStopTestSound,
  pause,
  play,
  PlaybackStatus,
  PlaylistItem,
  PlaylistState,
  removePlaylistItem,
  seekTo,
  seekToTrack,
  setAutoCacheEnabled,
  setDownloadWifiOnly,
  setPlaybackSpeed as nativeSetPlaybackSpeed,
  setPlaylist,
  setRepeatMode,
  setShuffleModeEnabled,
  setStopOnAppDismissed,
  setVolume,
  stop,
  updatePlaylistItemUri,
} from "@/modules/audio-playback";
import {
  getCoverArtBaseUrl,
  getSongStreamUrl,
  scrobble,
  scrobbleSong,
  setRating,
  star,
  unstar,
} from "@/services/api";
import {
  addPendingScrobble,
  clearPlayerSession,
  getAutoCacheEnabled,
  getDownloadWifiOnlySetting,
  getKeepPlayingOnAppDismissed,
  getPlaybackSpeedSetting,
  getPlayerSession,
  getScrobbleMinDuration,
  getScrobbleMinPercent,
  getSongById,
  savePlayerSession,
  setKeepPlayingOnAppDismissed,
  setPlaybackSpeedSetting,
  updateSongCacheLastAccessed,
  updateSongRating,
  updateSongStarred,
} from "@/services/db";
import {
  notifyScrobbleQueueChanged,
  syncPendingScrobbles,
} from "@/services/scrobbleQueue";
import {
  autoCacheSong,
  getCachedCoverArtUri,
  getCachedSongPlaybackUri,
  reconcileNativeAutoCache,
  subscribeSongCache,
} from "@/services/songCache";
import {
  handlePlaybackStopped,
  handleTrackEnded,
  registerPauseExecutor,
  syncSleepTimer,
} from "@/services/sleepTimer";
import { Child } from "@/types";
import { handleNetworkOrOfflineError } from "@/utils/network";

export interface ActiveTrackInfo {
  id: string;
  title: string;
  artist?: string | null;
  artistId?: string | null;
  album?: string | null;
  albumId?: string | null;
  coverArt?: string | null;
  duration?: number | null;
  starred?: string | null;
  userRating?: number | null;
}

export interface PlayerState {
  currentTrack: ActiveTrackInfo | null;
  isPlaying: boolean;
  isBuffering: boolean;
  duration: number;
  position: number;
  repeatMode: "off" | "one" | "all";
  shuffle: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  isPlayingFromCache: boolean;
  scrobbled: boolean;
  playbackSpeed: number;
}

let currentQueue: Child[] = [];
let originalQueue: Child[] = [];
let currentIndex = 0;
let currentTrack: ActiveTrackInfo | null = null;
let currentPlaybackSource: { songId: string; isFromCache: boolean } | null =
  null;
let currentRepeatMode: "off" | "one" | "all" = "off";
let currentShuffle = false;
let currentPlaybackSpeed = 1.0;
let lastPlaybackStatus: PlaybackStatus = {
  isPlaying: false,
  isBuffering: false,
  duration: 0,
  position: 0,
  repeatMode: "off",
  playbackSpeed: 1.0,
};
let isInitialized = false;
let scrobbleInFlightTrackId: string | null = null;
let scrobbledSuccessfullyTrackId: string | null = null;
// Set only after loadTrack resolves for the current song. Any playback-state
// callbacks that arrive before this is set (e.g. late events from the
// previous track) are ignored by checkAndScrobble.
let activePlaybackTrackId: string | null = null;
let lastPersistedPositionTimestamp = 0;
let accumulatedListeningTimeSeconds = 0;
let lastEvaluatedPosition: number | null = null;
let hasPendingSeek = false;

function safeNativeCall(promiseOrVoid: any): Promise<void> {
  return Promise.resolve(promiseOrVoid).catch(() => {});
}

function persistCurrentSession(): void {
  try {
    if (currentQueue.length === 0) {
      clearPlayerSession();
      return;
    }
    savePlayerSession({
      queue: currentQueue,
      currentIndex,
      position: Math.floor(lastPlaybackStatus.position || 0),
      repeatMode: currentRepeatMode,
      shuffle: currentShuffle,
      originalQueue: originalQueue.length > 0 ? originalQueue : currentQueue,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("failed to persist player session:", err);
  }
}

function updateCurrentTrackFromSong(song: Child): void {
  let dbStarred = song.starred;
  let dbRating = song.userRating;
  let artistId = song.artistId;
  let albumId = song.albumId;
  try {
    const dbSong = getSongById(song.id);
    if (dbSong) {
      dbStarred = dbSong.starred ?? song.starred;
      dbRating = dbSong.userRating ?? song.userRating;
      artistId = dbSong.artistId ?? song.artistId;
      albumId = dbSong.albumId ?? song.albumId;
    }
  } catch {
    // ignore
  }
  currentTrack = {
    id: song.id,
    title: song.title,
    artist: song.artist,
    artistId,
    album: song.album,
    albumId,
    coverArt: song.coverArt,
    duration: song.duration,
    starred: dbStarred,
    userRating: dbRating,
  };
}

async function buildPlaylistItem(song: Child): Promise<PlaylistItem> {
  const cachedUri = getCachedSongPlaybackUri(song.id);
  const playbackUrl = cachedUri ?? (await getSongStreamUrl(song.id));
  let artworkUrl: string | null = null;
  try {
    const getArtUrl = await getCoverArtBaseUrl();
    artworkUrl = getArtUrl(song.coverArt || song.id);
  } catch {
    artworkUrl = getCachedCoverArtUri(song.coverArt || song.id);
  }
  return {
    mediaId: song.id,
    url: playbackUrl,
    title: song.title,
    artist: song.artist ?? undefined,
    album: song.album ?? undefined,
    artworkUrl: artworkUrl ?? undefined,
  };
}

export async function hydratePlayerSession(): Promise<void> {
  try {
    const session = getPlayerSession();
    if (session && session.queue && session.queue.length > 0) {
      currentQueue = session.queue;
      originalQueue =
        session.originalQueue && session.originalQueue.length > 0
          ? session.originalQueue
          : [...session.queue];
      currentIndex =
        session.currentIndex >= 0 && session.currentIndex < session.queue.length
          ? session.currentIndex
          : 0;
      currentRepeatMode = session.repeatMode ?? "off";
      currentShuffle = Boolean(session.shuffle);
      const song = currentQueue[currentIndex];
      if (song) {
        updateCurrentTrackFromSong(song);
        const cachedUri = getCachedSongPlaybackUri(song.id);
        currentPlaybackSource = {
          songId: song.id,
          isFromCache: !!cachedUri,
        };
        lastPlaybackStatus = {
          isPlaying: false,
          isBuffering: false,
          duration: song.duration || 0,
          position: session.position || 0,
          repeatMode: currentRepeatMode,
        };
      }
    }
  } catch (err) {
    console.error("failed to hydrate player session:", err);
  }

  try {
    const keepPlaying = getKeepPlayingOnAppDismissed();
    safeNativeCall(setStopOnAppDismissed(!keepPlaying));
  } catch {
    // ignore
  }

  try {
    currentPlaybackSpeed = getPlaybackSpeedSetting();
    safeNativeCall(nativeSetPlaybackSpeed(currentPlaybackSpeed));
  } catch {
    // ignore
  }

  try {
    await safeNativeCall(setAutoCacheEnabled(getAutoCacheEnabled()));
    await safeNativeCall(setDownloadWifiOnly(getDownloadWifiOnlySetting()));
  } catch {
    // ignore
  }

  try {
    const completed = await safeNativeCall(getCompletedTracks());
    if (Array.isArray(completed) && completed.length > 0) {
      for (const item of completed) {
        const completedSong = currentQueue.find((s) => s.id === item.mediaId);
        if (completedSong) {
          await checkAndScrobble(true, completedSong, true);
        }
      }
      await safeNativeCall(clearCompletedTracks());
    }
  } catch {
    // ignore
  }

  try {
    const pendingAutoCache = await safeNativeCall(getPendingAutoCacheTracks());
    if (Array.isArray(pendingAutoCache) && pendingAutoCache.length > 0) {
      await reconcileNativeAutoCache(pendingAutoCache);
    }
    await safeNativeCall(clearPendingAutoCacheTracks());
  } catch (err) {
    console.error("failed to reconcile native auto-cache tracks on hydration:", err);
  }

  try {
    const playlistState = await getPlaylistState();
    if (playlistState && currentQueue.length > 0) {
      if (
        playlistState.activeIndex >= 0 &&
        playlistState.activeIndex < currentQueue.length
      ) {
        const sessionIndex = currentIndex;
        currentIndex = playlistState.activeIndex;
        if (sessionIndex < currentIndex) {
          for (let i = sessionIndex; i < currentIndex; i++) {
            const skippedSong = currentQueue[i];
            if (skippedSong) {
              await checkAndScrobble(true, skippedSong, true);
            }
          }
        }

        const song = currentQueue[currentIndex];
        if (song) {
          updateCurrentTrackFromSong(song);
          activePlaybackTrackId = song.id;
          const cachedUri = getCachedSongPlaybackUri(song.id);
          currentPlaybackSource = {
            songId: song.id,
            isFromCache: !!cachedUri,
          };
          if (cachedUri) {
            updateSongCacheLastAccessed(song.id);
          }
        }
        lastPlaybackStatus = {
          ...lastPlaybackStatus,
          isPlaying: playlistState.isPlaying,
          duration: playlistState.duration || currentTrack?.duration || 0,
          position: playlistState.position,
          repeatMode: playlistState.repeatMode,
        };
        currentRepeatMode = playlistState.repeatMode;
        currentShuffle = playlistState.shuffle;
        notifyStateChanged();
      }
    }
  } catch {
    // ignore
  }
}

let hasHydrated = false;

export function ensureSessionHydrated(): void {
  if (hasHydrated) return;
  hasHydrated = true;
  ensureListenersInitialized();
  hydratePlayerSession();
}

const stateListeners = new Set<(state: PlayerState) => void>();

function notifyStateChanged(): void {
  const state = getPlayerState();
  stateListeners.forEach((listener) => {
    try {
      listener(state);
    } catch (e) {
      console.error("error in player state listener:", e);
    }
  });
}

export function getPlayerState(): PlayerState {
  ensureSessionHydrated();
  const hasPrevious =
    currentIndex > 0 ||
    (currentRepeatMode === "all" && currentQueue.length > 0);
  const hasNext =
    currentIndex + 1 < currentQueue.length ||
    (currentRepeatMode === "all" && currentQueue.length > 0);

  const isPlayingFromCache =
    !!currentTrack &&
    currentPlaybackSource?.songId === currentTrack.id &&
    !!currentPlaybackSource.isFromCache;

  const scrobbled =
    scrobbledSuccessfullyTrackId !== null &&
    scrobbledSuccessfullyTrackId === currentTrack?.id;

  return {
    currentTrack,
    isPlaying: lastPlaybackStatus.isPlaying,
    isBuffering: lastPlaybackStatus.isBuffering,
    duration: lastPlaybackStatus.duration || currentTrack?.duration || 0,
    position: lastPlaybackStatus.position || 0,
    repeatMode: currentRepeatMode,
    shuffle: currentShuffle,
    hasPrevious,
    hasNext,
    isPlayingFromCache,
    scrobbled,
    playbackSpeed: currentPlaybackSpeed,
  };
}

export function subscribePlayerState(
  listener: (state: PlayerState) => void,
): () => void {
  stateListeners.add(listener);
  listener(getPlayerState());
  return () => {
    stateListeners.delete(listener);
  };
}

async function switchToRemoteStream(songId: string): Promise<void> {
  if (!currentTrack || currentTrack.id !== songId) return;
  const currentSong = currentQueue[currentIndex];
  if (!currentSong || currentSong.id !== songId) return;

  try {
    const savedPosition = lastPlaybackStatus.position;
    const shouldPlay = lastPlaybackStatus.isPlaying;
    const streamUrl = await getSongStreamUrl(songId);
    let artworkUrl: string | null = null;
    try {
      const getArtUrl = await getCoverArtBaseUrl();
      artworkUrl = getArtUrl(currentSong.coverArt || currentSong.id);
    } catch {
      artworkUrl = getCachedCoverArtUri(currentSong.coverArt || currentSong.id);
    }

    currentPlaybackSource = { songId, isFromCache: false };

    await loadTrack({
      url: streamUrl,
      title: currentSong.title,
      artist: currentSong.artist ?? undefined,
      album: currentSong.album ?? undefined,
      artworkUrl: artworkUrl ?? undefined,
      playWhenReady: shouldPlay,
    });

    if (savedPosition > 0) {
      await seekTo(savedPosition);
    }
  } catch (error) {
    console.error("failed to switch to remote stream:", error);
    handleNetworkOrOfflineError(error);
  }
}

function checkAndScrobble(
  forceEndOfTrack: boolean = false,
  targetTrack?: Child | ActiveTrackInfo | null,
  isNaturalEnd: boolean = false,
): Promise<void> {
  const trackToScrobble = targetTrack ?? currentTrack;
  if (!trackToScrobble) return Promise.resolve();
  const trackId = trackToScrobble.id;

  // If already successfully scrobbled or currently in flight, do not trigger again
  if (scrobbledSuccessfullyTrackId === trackId) return Promise.resolve();
  if (scrobbleInFlightTrackId === trackId) return Promise.resolve();

  // Only enforce activePlaybackTrackId check when evaluating continuous in-flight playback.
  // For forceEndOfTrack (e.g. track transition or completed background track), the track
  // may have just finished, so activePlaybackTrackId may already point to the new song.
  if (!forceEndOfTrack && activePlaybackTrackId !== trackId) return Promise.resolve();

  const position = lastPlaybackStatus.position;
  const duration =
    (trackToScrobble.id === currentTrack?.id ? lastPlaybackStatus.duration : 0) ||
    trackToScrobble.duration ||
    0;

  if (duration <= 0 && !forceEndOfTrack) return Promise.resolve();

  const minDuration = getScrobbleMinDuration();
  const minPercent = getScrobbleMinPercent();
  const targetDuration =
    duration > 0
      ? Math.min(minDuration, (minPercent / 100) * duration)
      : minDuration;

  const durationMet = position >= minDuration;
  const percentMet = duration > 0 && (position / duration) * 100 >= minPercent;
  const positionMet = durationMet || percentMet || forceEndOfTrack;

  const listenedMet =
    isNaturalEnd ||
    accumulatedListeningTimeSeconds >= targetDuration ||
    (forceEndOfTrack &&
      (accumulatedListeningTimeSeconds >= targetDuration - 2 ||
        position >= targetDuration - 2));

  if (positionMet && listenedMet) {
    const listenTimestamp = Date.now();
    scrobbleInFlightTrackId = trackId;
    return (async () => {
      try {
        await scrobbleSong(trackId, listenTimestamp);
        scrobbledSuccessfullyTrackId = trackId;
        notifyStateChanged();
      } catch (err) {
        console.error("failed to scrobble song, queueing for offline sync:", err);
        try {
          addPendingScrobble(trackId, listenTimestamp);
          notifyScrobbleQueueChanged();
          scrobbledSuccessfullyTrackId = trackId;
          notifyStateChanged();
        } catch (dbErr) {
          console.error("failed to persist pending scrobble:", dbErr);
        }
      } finally {
        if (scrobbleInFlightTrackId === trackId) {
          scrobbleInFlightTrackId = null;
        }
      }
    })();
  }
  return Promise.resolve();
}

function ensureListenersInitialized(): void {
  if (isInitialized) return;
  isInitialized = true;

  addPlaybackStateListener((status) => {
    if (
      currentRepeatMode === "one" &&
      status.position < 2 &&
      lastPlaybackStatus.position > 5
    ) {
      scrobbleInFlightTrackId = null;
      scrobbledSuccessfullyTrackId = null;
      accumulatedListeningTimeSeconds = 0;
      lastEvaluatedPosition = null;
      hasPendingSeek = false;
    }

    if (activePlaybackTrackId === currentTrack?.id && status.isPlaying) {
      if (hasPendingSeek) {
        hasPendingSeek = false;
        lastEvaluatedPosition = status.position;
      } else if (lastEvaluatedPosition !== null) {
        const delta = status.position - lastEvaluatedPosition;
        if (delta > 0 && delta <= 15.0) {
          accumulatedListeningTimeSeconds += delta;
        }
      }
      lastEvaluatedPosition = status.position;
    } else {
      lastEvaluatedPosition = status.position;
    }

    if (typeof status.playbackSpeed === "number" && status.playbackSpeed > 0) {
      currentPlaybackSpeed = status.playbackSpeed;
    }

    const preservedPosition =
      !status.isPlaying && status.position === 0 && lastPlaybackStatus.position > 0
        ? lastPlaybackStatus.position
        : status.position;

    lastPlaybackStatus = {
      ...status,
      position: preservedPosition,
    };
    checkAndScrobble();
    notifyStateChanged();

    // Throttled position persistence during active playback (every 10 seconds)
    const now = Date.now();
    if (status.isPlaying && now - lastPersistedPositionTimestamp >= 10000) {
      lastPersistedPositionTimestamp = now;
      persistCurrentSession();
    }
  });

  addPlaybackStoppedListener(() => {
    activePlaybackTrackId = null;
    lastPlaybackStatus = {
      ...lastPlaybackStatus,
      isPlaying: false,
      isBuffering: false,
    };
    persistCurrentSession();
    notifyStateChanged();
  });

  // Ensure playback state and scrobble status sync when returning from background,
  // and persist session state when entering background
  AppState.addEventListener("change", async (nextAppState) => {
    if (nextAppState === "active") {
      syncSleepTimer();
      try {
        if (currentQueue.length === 0) {
          await hydratePlayerSession();
        }

        // 1. Process any natively completed tracks recorded by AudioPlaybackService
        try {
          const completed = await safeNativeCall(getCompletedTracks());
          if (Array.isArray(completed) && completed.length > 0) {
            for (const item of completed) {
              const completedSong = currentQueue.find(
                (s) => s.id === item.mediaId,
              );
              if (completedSong) {
                await checkAndScrobble(true, completedSong, true);
              }
            }
            await safeNativeCall(clearCompletedTracks());
          }
        } catch {
          // ignore
        }

        // Process any native auto-cache tracks recorded by AudioPlaybackService
        try {
          const pendingAutoCache = await safeNativeCall(getPendingAutoCacheTracks());
          if (Array.isArray(pendingAutoCache) && pendingAutoCache.length > 0) {
            await reconcileNativeAutoCache(pendingAutoCache);
          }
          await safeNativeCall(clearPendingAutoCacheTracks());
        } catch (err) {
          console.error("failed to reconcile native auto-cache tracks on app resume:", err);
        }

        const playlistState = await getPlaylistState();
        if (playlistState && currentQueue.length > 0) {
          if (
            playlistState.activeIndex >= 0 &&
            playlistState.activeIndex < currentQueue.length
          ) {
            const previousTrackId = activePlaybackTrackId;
            const previousIndex = currentIndex;
            currentIndex = playlistState.activeIndex;
            const song = currentQueue[currentIndex];

            // If playback advanced across multiple tracks while in background
            if (previousIndex < currentIndex) {
              for (let i = previousIndex; i < currentIndex; i++) {
                const skippedSong = currentQueue[i];
                if (skippedSong) {
                  await checkAndScrobble(true, skippedSong, true);
                }
              }
            }

            if (song) {
              updateCurrentTrackFromSong(song);
              activePlaybackTrackId = song.id;
              const cachedUri = getCachedSongPlaybackUri(song.id);
              currentPlaybackSource = {
                songId: song.id,
                isFromCache: !!cachedUri,
              };
              if (cachedUri) {
                updateSongCacheLastAccessed(song.id);
              }

              if (previousTrackId && previousTrackId !== song.id) {
                scrobbleInFlightTrackId = null;
                scrobbledSuccessfullyTrackId = null;
                accumulatedListeningTimeSeconds = 0;
                lastEvaluatedPosition = null;
                hasPendingSeek = false;

                scrobble({ id: song.id, submission: false }).catch((err) =>
                  console.error("failed now playing ping on app active:", err),
                );

                if (!cachedUri) {
                  autoCacheSong(song.id).catch((err) => {
                    console.error("failed auto-cache on app active:", err);
                  });
                }

                const prevIndex = currentQueue.findIndex(
                  (s) => s.id === previousTrackId,
                );
                if (prevIndex !== -1 && prevIndex !== currentIndex) {
                  const prevCachedUri = getCachedSongPlaybackUri(previousTrackId);
                  if (prevCachedUri) {
                    safeNativeCall(
                      updatePlaylistItemUri(prevIndex, prevCachedUri),
                    );
                  }
                }
              }
            }
            if (playlistState.repeatMode) {
              currentRepeatMode = playlistState.repeatMode;
            }
            if (typeof playlistState.shuffle === "boolean") {
              currentShuffle = playlistState.shuffle;
            }
          }
        }
        const latest = await getPlaybackStatus();
        const isSameTrack = activePlaybackTrackId === currentTrack?.id;
        const preservedPosition =
          isSameTrack &&
          !latest.isPlaying &&
          latest.position === 0 &&
          lastPlaybackStatus.position > 0
            ? lastPlaybackStatus.position
            : latest.position;
        lastPlaybackStatus = {
          ...latest,
          position: preservedPosition,
          duration: latest.duration || currentTrack?.duration || 0,
          repeatMode: currentRepeatMode,
        };
        await checkAndScrobble();
        notifyStateChanged();
      } catch {
        // ignore
      }
      syncPendingScrobbles().catch((err) =>
        console.error("failed to sync pending scrobbles on app active:", err),
      );
    } else if (nextAppState === "background" || nextAppState === "inactive") {
      persistCurrentSession();
    }
  });

  addMediaItemTransitionListener(({ index, mediaId }) => {
    const prevTrackId = activePlaybackTrackId;
    const prevSong = prevTrackId
      ? currentQueue.find((s) => s.id === prevTrackId)
      : null;

    if (prevSong && prevSong.id !== mediaId) {
      // 1. Scrobble the previous track that just naturally finished or transitioned
      checkAndScrobble(true, prevSong).catch((err) => {
        console.error("failed transition scrobble check:", err);
      });

      // 2. Update its playlist item URI to local cached file if it finished caching
      const prevIndex = currentQueue.findIndex((s) => s.id === prevSong.id);
      if (prevIndex !== -1 && prevIndex !== index) {
        const prevCachedUri = getCachedSongPlaybackUri(prevSong.id);
        if (prevCachedUri) {
          safeNativeCall(updatePlaylistItemUri(prevIndex, prevCachedUri));
        }
      }
    }

    if (index >= 0 && index < currentQueue.length) {
      currentIndex = index;
      const song = currentQueue[index];
      if (song) {
        updateCurrentTrackFromSong(song);
      }
    }

    if (handleTrackEnded()) {
      safeNativeCall(pause());
      return;
    }

    scrobbleInFlightTrackId = null;
    scrobbledSuccessfullyTrackId = null;
    activePlaybackTrackId = mediaId;
    accumulatedListeningTimeSeconds = 0;
    lastEvaluatedPosition = 0;
    hasPendingSeek = false;

    scrobble({ id: mediaId, submission: false }).catch((err) =>
      console.error("failed to send now playing ping:", err),
    );

    const cachedUri = getCachedSongPlaybackUri(mediaId);
    currentPlaybackSource = { songId: mediaId, isFromCache: !!cachedUri };
    if (!cachedUri) {
      autoCacheSong(mediaId).catch((err) => {
        console.error("failed to auto-cache song in background:", err);
      });
    } else {
      updateSongCacheLastAccessed(mediaId);
    }

    notifyStateChanged();
    persistCurrentSession();
  });

  addTrackEndedListener(() => {
    checkAndScrobble(true).catch((err) => {
      console.error("failed track-ended scrobble check:", err);
    });
    if (activePlaybackTrackId) {
      const cachedUri = getCachedSongPlaybackUri(activePlaybackTrackId);
      const currIdx = currentQueue.findIndex(
        (s) => s.id === activePlaybackTrackId,
      );
      if (cachedUri && currIdx !== -1) {
        safeNativeCall(updatePlaylistItemUri(currIdx, cachedUri));
      }
    }
    if (handleTrackEnded()) {
      return;
    }
    playNext();
  });

  addNextTrackListener(() => {
    playNext();
  });

  addPreviousTrackListener(() => {
    playPrevious();
  });

  addPlaybackErrorListener(async (error) => {
    console.error("playback error:", error.errorCode, error.message);
    // If an error occurred while playing a track loaded from the local cache,
    // seamlessly recover by switching to the remote stream url
    if (
      currentTrack &&
      currentPlaybackSource?.songId === currentTrack.id &&
      currentPlaybackSource.isFromCache
    ) {
      await switchToRemoteStream(currentTrack.id);
    } else {
      await pause().catch(() => {});
      handleNetworkOrOfflineError(error);
    }
  });

  addRepeatModeListener((data) => {
    currentRepeatMode = data.mode;
    lastPlaybackStatus.repeatMode = data.mode;
    notifyStateChanged();
    persistCurrentSession();
  });

  // If a song currently playing from local cache is removed from cache,
  // transition to network stream at current position
  subscribeSongCache(async ({ songId, entry }) => {
    if (
      entry === null &&
      currentTrack &&
      currentTrack.id === songId &&
      currentPlaybackSource?.songId === songId &&
      currentPlaybackSource.isFromCache
    ) {
      await switchToRemoteStream(songId);
    }

    const queueIndex = currentQueue.findIndex((s) => s.id === songId);
    if (queueIndex !== -1) {
      if (entry) {
        const localUri =
          (entry.filePath || (entry as any).localFilePath) ??
          getCachedSongPlaybackUri(songId);
        if (localUri) {
          // If the song is currently playing, do not replace the active MediaItem
          // mid-playback to avoid interrupting active streaming and resetting position.
          // Instead, update the cache status, and when playback naturally transitions away
          // or finishes, the item's playlist URI is updated for subsequent replays.
          if (queueIndex !== currentIndex) {
            await safeNativeCall(updatePlaylistItemUri(queueIndex, localUri));
          }
          currentPlaybackSource = { songId, isFromCache: true };
          notifyStateChanged();
        }
      } else if (entry === null) {
        try {
          const streamUrl = await getSongStreamUrl(songId);
          await safeNativeCall(updatePlaylistItemUri(queueIndex, streamUrl));
        } catch {
          // ignore
        }
      }
    }
  });
}

export async function playTrackAtIndex(index: number): Promise<void> {
  if (index < 0 || index >= currentQueue.length) return;
  currentIndex = index;
  const song = currentQueue[index];
  if (!song) return;

  scrobbleInFlightTrackId = null;
  scrobbledSuccessfullyTrackId = null;
  activePlaybackTrackId = song.id;
  accumulatedListeningTimeSeconds = 0;
  lastEvaluatedPosition = null;
  hasPendingSeek = false;
  lastPlaybackStatus = {
    ...lastPlaybackStatus,
    position: 0,
    duration: song.duration || 0,
  };

  updateCurrentTrackFromSong(song);
  ensureListenersInitialized();
  notifyStateChanged();
  persistCurrentSession();

  try {
    const cachedUri = getCachedSongPlaybackUri(song.id);
    const isFromCache = !!cachedUri;
    currentPlaybackSource = { songId: song.id, isFromCache };

    if (isFromCache) {
      updateSongCacheLastAccessed(song.id);
      await safeNativeCall(updatePlaylistItemUri(index, cachedUri));
    }

    await seekToTrack(index, 0);

    scrobble({ id: song.id, submission: false }).catch((err) =>
      console.error("failed to send now playing ping:", err),
    );

    if (!isFromCache) {
      autoCacheSong(song.id).catch((err) => {
        console.error("failed to auto-cache song in background:", err);
      });
    }
  } catch (error) {
    console.error("failed to play track:", error);
    handleNetworkOrOfflineError(error);
  }
}

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

export async function playPlaylist(
  songs: Child[],
  startIndex: number = 0,
): Promise<void> {
  if (!songs.length) return;

  try {
    ensureListenersInitialized();
    originalQueue = [...songs];
    const safeStartIndex =
      startIndex >= 0 && startIndex < songs.length ? startIndex : 0;

    let finalQueue = [...songs];
    let finalStartIndex = safeStartIndex;

    if (currentShuffle && songs.length > 1) {
      const selectedSong = songs[safeStartIndex];
      const remainingSongs = songs.filter((_, idx) => idx !== safeStartIndex);
      const shuffledRemaining = shuffleArray(remainingSongs);
      finalQueue = [selectedSong, ...shuffledRemaining];
      finalStartIndex = 0;
    }

    currentQueue = finalQueue;
    currentIndex = finalStartIndex;

    const initialSong = currentQueue[finalStartIndex];
    if (initialSong) {
      updateCurrentTrackFromSong(initialSong);
    }

    notifyStateChanged();
    persistCurrentSession();

    let getArtUrl: ((id?: string | null) => string | null) | null = null;
    try {
      getArtUrl = await getCoverArtBaseUrl();
    } catch {
      // ignore
    }

    const items: PlaylistItem[] = await Promise.all(
      currentQueue.map(async (song) => {
        const cachedUri = getCachedSongPlaybackUri(song.id);
        const playbackUrl = cachedUri ?? (await getSongStreamUrl(song.id));
        let artworkUrl: string | null = null;
        if (getArtUrl) {
          try {
            artworkUrl = getArtUrl(song.coverArt || song.id);
          } catch {
            artworkUrl = getCachedCoverArtUri(song.coverArt || song.id);
          }
        } else {
          artworkUrl = getCachedCoverArtUri(song.coverArt || song.id);
        }
        return {
          mediaId: song.id,
          url: playbackUrl,
          title: song.title,
          artist: song.artist ?? undefined,
          album: song.album ?? undefined,
          artworkUrl: artworkUrl ?? undefined,
          suffix: song.suffix ?? "mp3",
        };
      })
    );

    const activeCachedUri = getCachedSongPlaybackUri(initialSong.id);
    currentPlaybackSource = {
      songId: initialSong.id,
      isFromCache: !!activeCachedUri,
    };
    if (activeCachedUri) {
      updateSongCacheLastAccessed(initialSong.id);
    }

    await setPlaylist(items, finalStartIndex, 0);

    activePlaybackTrackId = initialSong.id;
    scrobbledSuccessfullyTrackId = null;
    scrobbleInFlightTrackId = null;
    accumulatedListeningTimeSeconds = 0;
    lastEvaluatedPosition = 0;

    scrobble({ id: initialSong.id, submission: false }).catch((err) =>
      console.error("failed to send now playing ping:", err),
    );

    if (!activeCachedUri) {
      autoCacheSong(initialSong.id).catch((err) => {
        console.error("failed to auto-cache song in background:", err);
      });
    }
  } catch (error) {
    console.error("failed to play playlist:", error);
    handleNetworkOrOfflineError(error);
  }
}

export async function playSong(song: Child): Promise<void> {
  await playPlaylist([song], 0);
}

export async function playNext(): Promise<void>;
export async function playNext(song: Child): Promise<void>;
export async function playNext(song?: Child): Promise<void> {
  ensureSessionHydrated();
  if (song) {
    await playNextSong(song);
    return;
  }
  if (currentIndex + 1 < currentQueue.length) {
    await playTrackAtIndex(currentIndex + 1);
  } else if (currentRepeatMode === "all" && currentQueue.length > 0) {
    await playTrackAtIndex(0);
  } else {
    handlePlaybackStopped();
  }
}

export async function playNextSong(song: Child): Promise<void> {
  ensureSessionHydrated();
  if (currentQueue.length === 0 || !currentTrack) {
    await playPlaylist([song], 0);
    return;
  }
  const insertIndex = currentIndex + 1;
  currentQueue.splice(insertIndex, 0, song);
  if (originalQueue.length > 0) {
    const origIndex = currentTrack
      ? originalQueue.findIndex((s) => s.id === currentTrack?.id)
      : -1;
    if (origIndex >= 0) {
      originalQueue.splice(origIndex + 1, 0, song);
    } else {
      originalQueue.push(song);
    }
  } else {
    originalQueue = [...currentQueue];
  }
  const item = await buildPlaylistItem(song);
  await safeNativeCall(addPlaylistItem(item, insertIndex));
  notifyStateChanged();
  persistCurrentSession();
}

export async function addToQueue(song: Child | Child[]): Promise<void> {
  ensureSessionHydrated();
  const songsToAdd = Array.isArray(song) ? song : [song];
  if (songsToAdd.length === 0) return;

  if (currentQueue.length === 0 || !currentTrack) {
    await playPlaylist(songsToAdd, 0);
    return;
  }

  currentQueue.push(...songsToAdd);
  if (originalQueue.length > 0) {
    originalQueue.push(...songsToAdd);
  } else {
    originalQueue = [...currentQueue];
  }

  for (const s of songsToAdd) {
    const item = await buildPlaylistItem(s);
    await safeNativeCall(addPlaylistItem(item));
  }

  notifyStateChanged();
  persistCurrentSession();
}

export function removeFromQueue(index: number): boolean {
  ensureSessionHydrated();
  if (index < 0 || index >= currentQueue.length) {
    return false;
  }
  const [removed] = currentQueue.splice(index, 1);

  if (index < currentIndex) {
    currentIndex--;
  } else if (index === currentIndex) {
    if (currentQueue.length === 0) {
      currentIndex = 0;
    } else if (currentIndex >= currentQueue.length) {
      currentIndex = currentQueue.length - 1;
    }
  }

  if (originalQueue.length > 0 && removed) {
    const origIndex = originalQueue.findIndex((s) => s.id === removed.id);
    if (origIndex >= 0) {
      originalQueue.splice(origIndex, 1);
    }
  }

  safeNativeCall(removePlaylistItem(index));

  notifyStateChanged();
  persistCurrentSession();
  return true;
}

export function clearQueue(clearAll: boolean = false): void {
  ensureSessionHydrated();
  if (currentQueue.length === 0) return;

  if (clearAll) {
    currentQueue = [];
    originalQueue = [];
    currentIndex = 0;
    currentTrack = null;
    safeNativeCall(clearPlaylist());
    safeNativeCall(stop());
    notifyStateChanged();
    persistCurrentSession();
    return;
  }

  if (currentIndex < currentQueue.length - 1) {
    const itemsToRemove = currentQueue.length - (currentIndex + 1);
    currentQueue = currentQueue.slice(0, currentIndex + 1);
    if (originalQueue.length > 0 && currentTrack) {
      const origIndex = originalQueue.findIndex(
        (s) => s.id === currentTrack?.id,
      );
      if (origIndex >= 0) {
        originalQueue = originalQueue.slice(0, origIndex + 1);
      } else {
        originalQueue = [...currentQueue];
      }
    } else {
      originalQueue = [...currentQueue];
    }
    for (let i = 0; i < itemsToRemove; i++) {
      safeNativeCall(removePlaylistItem(currentIndex + 1));
    }
    notifyStateChanged();
    persistCurrentSession();
  }
}

export function moveQueueItem(
  fromIndex: number,
  toIndex: number,
): boolean {
  ensureSessionHydrated();
  if (
    fromIndex < 0 ||
    fromIndex >= currentQueue.length ||
    toIndex < 0 ||
    toIndex >= currentQueue.length ||
    fromIndex === toIndex
  ) {
    return false;
  }
  const [movedItem] = currentQueue.splice(fromIndex, 1);
  currentQueue.splice(toIndex, 0, movedItem);

  if (currentIndex === fromIndex) {
    currentIndex = toIndex;
  } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
    currentIndex--;
  } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
    currentIndex++;
  }

  safeNativeCall(movePlaylistItem(fromIndex, toIndex));

  notifyStateChanged();
  persistCurrentSession();
  return true;
}

export function setQueue(newQueue: Child[]): void {
  ensureSessionHydrated();
  currentQueue = [...newQueue];
  if (currentTrack) {
    const foundIdx = currentQueue.findIndex((s) => s.id === currentTrack?.id);
    if (foundIdx >= 0) {
      currentIndex = foundIdx;
    }
  }
  if (!currentShuffle) {
    originalQueue = [...currentQueue];
  }
  notifyStateChanged();
  persistCurrentSession();
}

export async function playPrevious(): Promise<void> {
  if (currentIndex - 1 >= 0) {
    await playTrackAtIndex(currentIndex - 1);
  } else if (currentRepeatMode === "all" && currentQueue.length > 0) {
    await playTrackAtIndex(currentQueue.length - 1);
  }
}

export function getCurrentQueue(): Child[] {
  ensureSessionHydrated();
  return currentQueue;
}

export function getCurrentIndex(): number {
  ensureSessionHydrated();
  return currentIndex;
}

export function getCurrentTrack(): ActiveTrackInfo | null {
  ensureSessionHydrated();
  return currentTrack;
}

export function getCurrentRepeatMode(): "off" | "one" | "all" {
  ensureSessionHydrated();
  return currentRepeatMode;
}

export function getCurrentShuffle(): boolean {
  ensureSessionHydrated();
  return currentShuffle;
}

export function getOriginalQueue(): Child[] {
  ensureSessionHydrated();
  return originalQueue;
}

export async function toggleShuffle(): Promise<boolean> {
  ensureSessionHydrated();
  const nextShuffle = !currentShuffle;

  if (nextShuffle) {
    if (originalQueue.length === 0 && currentQueue.length > 0) {
      originalQueue = [...currentQueue];
    }
    if (currentQueue.length > 1) {
      const safeIndex =
        currentIndex >= 0 && currentIndex < currentQueue.length
          ? currentIndex
          : 0;
      const currentSong = currentQueue[safeIndex];
      const remainingSongs = currentQueue.filter((_, idx) => idx !== safeIndex);
      const shuffledRemaining = shuffleArray(remainingSongs);
      currentQueue = [currentSong, ...shuffledRemaining];
      currentIndex = 0;
    }
  } else {
    if (originalQueue.length > 0) {
      const currentSongId = currentTrack?.id;
      currentQueue = [...originalQueue];
      if (currentSongId) {
        const foundIndex = currentQueue.findIndex((s) => s.id === currentSongId);
        currentIndex = foundIndex >= 0 ? foundIndex : 0;
      }
    }
  }

  currentShuffle = nextShuffle;
  await safeNativeCall(setShuffleModeEnabled(nextShuffle));
  notifyStateChanged();
  persistCurrentSession();
  return currentShuffle;
}

export async function setPlaybackShuffle(enabled: boolean): Promise<void> {
  if (currentShuffle === enabled) return;
  await toggleShuffle();
}

export async function pausePlayback(): Promise<void> {
  await pause();
  persistCurrentSession();
}

registerPauseExecutor(pausePlayback);

export async function resumePlayback(): Promise<void> {
  if (currentTrack && activePlaybackTrackId !== currentTrack.id) {
    const resumePosition = lastPlaybackStatus.position;
    if (!activePlaybackTrackId) {
      await playPlaylist(currentQueue, currentIndex);
    } else {
      await playTrackAtIndex(currentIndex);
    }
    if (resumePosition > 0) {
      await seekTo(resumePosition);
    }
    return;
  }
  await play();
}

export async function togglePlayback(): Promise<void> {
  if (currentTrack && activePlaybackTrackId !== currentTrack.id) {
    await resumePlayback();
    return;
  }
  const status = await getPlaybackStatus();
  if (status.isPlaying) {
    await pausePlayback();
  } else {
    await resumePlayback();
  }
}

export async function stopPlayback(): Promise<void> {
  handlePlaybackStopped();
  await stop();
  activePlaybackTrackId = null;
  currentTrack = null;
  notifyStateChanged();
}

export async function resetPlayer(): Promise<void> {
  handlePlaybackStopped();
  try {
    await stop();
  } catch (error) {
    console.error("failed to stop playback during reset:", error);
  }
  hasHydrated = true;
  currentQueue = [];
  originalQueue = [];
  currentIndex = 0;
  currentTrack = null;
  currentPlaybackSource = null;
  currentRepeatMode = "off";
  currentShuffle = false;
  scrobbleInFlightTrackId = null;
  scrobbledSuccessfullyTrackId = null;
  activePlaybackTrackId = null;
  accumulatedListeningTimeSeconds = 0;
  lastEvaluatedPosition = null;
  hasPendingSeek = false;
  lastPersistedPositionTimestamp = 0;
  lastPlaybackStatus = {
    isPlaying: false,
    isBuffering: false,
    duration: 0,
    position: 0,
    repeatMode: "off",
  };
  try {
    clearPlayerSession();
  } catch (error) {
    console.error("failed to clear player session:", error);
  }
  notifyStateChanged();
}

export async function seekToPosition(seconds: number): Promise<void> {
  hasPendingSeek = true;
  lastEvaluatedPosition = seconds;
  if (currentTrack && activePlaybackTrackId !== currentTrack.id) {
    lastPlaybackStatus = {
      ...lastPlaybackStatus,
      position: seconds,
    };
    notifyStateChanged();
    persistCurrentSession();
    return;
  }
  await seekTo(seconds);
}

export async function setPlaybackVolume(volume: number): Promise<void> {
  await setVolume(volume);
}

export async function setPlaybackRepeatMode(
  mode: "off" | "one" | "all",
): Promise<void> {
  await setRepeatMode(mode);
  currentRepeatMode = mode;
  lastPlaybackStatus.repeatMode = mode;
  notifyStateChanged();
  persistCurrentSession();
}

export async function cycleRepeatMode(): Promise<void> {
  const nextMode: "off" | "one" | "all" =
    currentRepeatMode === "off"
      ? "all"
      : currentRepeatMode === "all"
        ? "one"
        : "off";
  await setPlaybackRepeatMode(nextMode);
}

export async function setPlaybackSpeed(speed: number): Promise<void> {
  const clamped = Math.max(0.25, Math.min(3.0, speed));
  currentPlaybackSpeed = clamped;
  lastPlaybackStatus.playbackSpeed = clamped;
  try {
    setPlaybackSpeedSetting(clamped);
  } catch (err) {
    console.error("failed to persist playback speed:", err);
  }
  try {
    await nativeSetPlaybackSpeed(clamped);
  } catch (err) {
    console.error("failed to set native playback speed:", err);
  }
  notifyStateChanged();
}

export async function updateKeepPlayingOnAppDismissed(
  enabled: boolean,
): Promise<void> {
  try {
    setKeepPlayingOnAppDismissed(enabled);
    await setStopOnAppDismissed(!enabled);
  } catch (err) {
    console.error("failed to update keep playing on app dismissed:", err);
  }
}

export async function getStatus(): Promise<PlaybackStatus> {
  const status = await getPlaybackStatus();
  lastPlaybackStatus = status;
  return status;
}

const TEST_AUDIO_SOURCE = require("@/assets/sounds/test.wav");

export async function playTestSound(): Promise<void> {
  try {
    const resolved = Image.resolveAssetSource(TEST_AUDIO_SOURCE);
    await nativePlayTestSound(resolved.uri);
  } catch (error) {
    console.error("failed to play test sound:", error);
  }
}

export async function stopTestSound(): Promise<void> {
  try {
    await nativeStopTestSound();
  } catch (error) {
    console.error("failed to stop test sound:", error);
  }
}

/**
 * React hook to observe real-time playback state and active track metadata
 */
export function usePlayerState(): PlayerState {
  const [state, setState] = useState<PlayerState>(() => getPlayerState());

  useEffect(() => {
    const unsubscribe = subscribePlayerState((newState) => {
      setState(newState);
    });

    return unsubscribe;
  }, []);

  return state;
}

export interface PlaybackQueueState {
  queue: Child[];
  currentIndex: number;
  currentTrack: ActiveTrackInfo | null;
}

export function getPlaybackQueueState(): PlaybackQueueState {
  ensureSessionHydrated();
  return {
    queue: [...currentQueue],
    currentIndex,
    currentTrack,
  };
}

/**
 * React hook to observe queue state and active track index without
 * re-rendering on high-frequency playback position changes.
 */
export function usePlaybackQueue(): PlaybackQueueState {
  const [state, setState] = useState<PlaybackQueueState>(() =>
    getPlaybackQueueState(),
  );

  useEffect(() => {
    const unsubscribe = subscribePlayerState(() => {
      const next = getPlaybackQueueState();
      setState((prev) => {
        if (
          prev.currentIndex === next.currentIndex &&
          prev.currentTrack?.id === next.currentTrack?.id &&
          prev.queue.length === next.queue.length &&
          prev.queue.every((song, i) => song.id === next.queue[i]?.id)
        ) {
          return prev;
        }
        return next;
      });
    });

    return unsubscribe;
  }, []);

  return state;
}

export async function toggleStarCurrentTrack(): Promise<boolean> {
  if (!currentTrack) return false;
  const songId = currentTrack.id;
  const isCurrentlyStarred = !!currentTrack.starred;
  const newStarred = isCurrentlyStarred ? null : new Date().toISOString();

  updateTrackStarredState(songId, newStarred);

  try {
    if (isCurrentlyStarred) {
      await unstar(songId);
    } else {
      await star(songId);
    }
    try {
      updateSongStarred(songId, newStarred);
    } catch {
      // ignore
    }
    return !isCurrentlyStarred;
  } catch (error) {
    updateTrackStarredState(
      songId,
      isCurrentlyStarred ? currentTrack.starred ?? new Date().toISOString() : null,
    );
    console.error("failed to toggle star for track:", error);
    throw error;
  }
}

export function updateTrackStarredState(
  songId: string,
  starred: string | null,
): void {
  if (currentTrack && currentTrack.id === songId) {
    currentTrack = {
      ...currentTrack,
      starred,
    };
  }
  const queueItem = currentQueue.find((s) => s.id === songId);
  if (queueItem) {
    queueItem.starred = starred;
  }
  notifyStateChanged();
}

export async function setRatingCurrentTrack(rating: number): Promise<number> {
  if (!currentTrack) return 0;
  const songId = currentTrack.id;
  const previousRating = currentTrack.userRating ?? 0;
  const newRating = rating === previousRating ? 0 : rating;
  const targetRatingVal = newRating === 0 ? null : newRating;

  updateTrackRatingState(songId, targetRatingVal);

  try {
    await setRating(songId, newRating);
    try {
      updateSongRating(songId, targetRatingVal);
    } catch {
      // ignore
    }
    return newRating;
  } catch (error) {
    updateTrackRatingState(songId, previousRating === 0 ? null : previousRating);
    console.error("failed to set rating for track:", error);
    throw error;
  }
}

export function updateTrackRatingState(
  songId: string,
  userRating: number | null,
): void {
  if (currentTrack && currentTrack.id === songId) {
    currentTrack = {
      ...currentTrack,
      userRating,
    };
  }
  const queueItem = currentQueue.find((s) => s.id === songId);
  if (queueItem) {
    queueItem.userRating = userRating;
  }
  notifyStateChanged();
}

export {
  addPlaybackErrorListener,
  addPlaybackStateListener,
  addRepeatModeListener,
};
export type { PlaybackStatus };

