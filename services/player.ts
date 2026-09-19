import { useEffect, useState } from "react";
import { AppState, Image } from "react-native";

import {
  addNextTrackListener,
  addPlaybackErrorListener,
  addPlaybackStateListener,
  addPreviousTrackListener,
  addRepeatModeListener,
  addTrackEndedListener,
  getPlaybackStatus,
  loadTrack,
  playTestSound as nativePlayTestSound,
  stopTestSound as nativeStopTestSound,
  pause,
  play,
  PlaybackStatus,
  seekTo,
  setRepeatMode,
  setStopOnAppDismissed,
  setVolume,
  stop,
} from "@/modules/audio-playback";
import {
  getCoverArtBaseUrl,
  getSongStreamUrl,
  scrobble,
  scrobbleSong,
} from "@/services/api";
import {
  clearPlayerSession,
  getKeepPlayingOnAppDismissed,
  getPlayerSession,
  getScrobbleMinDuration,
  getScrobbleMinPercent,
  savePlayerSession,
  setKeepPlayingOnAppDismissed,
  updateSongCacheLastAccessed,
} from "@/services/db";
import {
  autoCacheSong,
  getCachedSongPlaybackUri,
  subscribeSongCache,
} from "@/services/songCache";
import { Child } from "@/types";

export interface ActiveTrackInfo {
  id: string;
  title: string;
  artist?: string | null;
  album?: string | null;
  coverArt?: string | null;
  duration?: number | null;
}

export interface PlayerState {
  currentTrack: ActiveTrackInfo | null;
  isPlaying: boolean;
  isBuffering: boolean;
  duration: number;
  position: number;
  repeatMode: "off" | "one" | "all";
  hasPrevious: boolean;
  hasNext: boolean;
  isPlayingFromCache: boolean;
  scrobbled: boolean;
}

let currentQueue: Child[] = [];
let currentIndex = 0;
let currentTrack: ActiveTrackInfo | null = null;
let currentPlaybackSource: { songId: string; isFromCache: boolean } | null =
  null;
let currentRepeatMode: "off" | "one" | "all" = "off";
let lastPlaybackStatus: PlaybackStatus = {
  isPlaying: false,
  isBuffering: false,
  duration: 0,
  position: 0,
  repeatMode: "off",
};
let isInitialized = false;
let scrobbleInFlightTrackId: string | null = null;
let scrobbledSuccessfullyTrackId: string | null = null;
// Set only after loadTrack resolves for the current song. Any playback-state
// callbacks that arrive before this is set (e.g. late events from the
// previous track) are ignored by checkAndScrobble.
let activePlaybackTrackId: string | null = null;
let lastPersistedPositionTimestamp = 0;

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
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("failed to persist player session:", err);
  }
}

export function hydratePlayerSession(): void {
  try {
    const session = getPlayerSession();
    if (session && session.queue && session.queue.length > 0) {
      currentQueue = session.queue;
      currentIndex =
        session.currentIndex >= 0 && session.currentIndex < session.queue.length
          ? session.currentIndex
          : 0;
      currentRepeatMode = session.repeatMode ?? "off";
      const song = currentQueue[currentIndex];
      if (song) {
        currentTrack = {
          id: song.id,
          title: song.title,
          artist: song.artist,
          album: song.album,
          coverArt: song.coverArt,
          duration: song.duration,
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
    setStopOnAppDismissed(!keepPlaying).catch(() => {});
  } catch {
    // ignore
  }
}

let hasHydrated = false;

export function ensureSessionHydrated(): void {
  if (hasHydrated) return;
  hasHydrated = true;
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
    hasPrevious,
    hasNext,
    isPlayingFromCache,
    scrobbled,
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
    const getArtUrl = await getCoverArtBaseUrl();
    const artworkUrl = getArtUrl(currentSong.coverArt);

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
  }
}

async function checkAndScrobble(): Promise<void> {
  if (!currentTrack) return;
  // If already successfully scrobbled or currently in flight, do not trigger again
  if (scrobbledSuccessfullyTrackId === currentTrack.id) return;
  if (scrobbleInFlightTrackId === currentTrack.id) return;

  // Only check once the audio layer has actually loaded this track.
  // This prevents stale position values from a just-finished track from
  // triggering an immediate scrobble on the incoming song.
  if (activePlaybackTrackId !== currentTrack.id) return;

  const position = lastPlaybackStatus.position;
  const duration = lastPlaybackStatus.duration || currentTrack.duration || 0;

  if (duration <= 0) return;

  const minDuration = getScrobbleMinDuration();
  const minPercent = getScrobbleMinPercent();

  const durationMet = position >= minDuration;
  const percentMet = (position / duration) * 100 >= minPercent;

  if (durationMet || percentMet) {
    const trackId = currentTrack.id;
    scrobbleInFlightTrackId = trackId;
    try {
      await scrobbleSong(trackId);
      scrobbledSuccessfullyTrackId = trackId;
      notifyStateChanged();
    } catch (err) {
      console.error("failed to scrobble song:", err);
    } finally {
      if (scrobbleInFlightTrackId === trackId) {
        scrobbleInFlightTrackId = null;
      }
    }
  }
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
    }
    lastPlaybackStatus = status;
    checkAndScrobble();
    notifyStateChanged();

    // Throttled position persistence during active playback (every 10 seconds)
    const now = Date.now();
    if (status.isPlaying && now - lastPersistedPositionTimestamp >= 10000) {
      lastPersistedPositionTimestamp = now;
      persistCurrentSession();
    }
  });

  // Ensure playback state and scrobble status sync when returning from background,
  // and persist session state when entering background
  AppState.addEventListener("change", async (nextAppState) => {
    if (nextAppState === "active") {
      try {
        const latest = await getPlaybackStatus();
        lastPlaybackStatus = latest;
        await checkAndScrobble();
        notifyStateChanged();
      } catch {
        // ignore
      }
    } else if (nextAppState === "background" || nextAppState === "inactive") {
      persistCurrentSession();
    }
  });

  addTrackEndedListener(() => {
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
  });
}

export async function playTrackAtIndex(index: number): Promise<void> {
  if (index < 0 || index >= currentQueue.length) return;
  currentIndex = index;
  const song = currentQueue[index];
  if (!song) return;

  // Reset scrobble guard for the new track. activePlaybackTrackId is also
  // cleared so that checkAndScrobble ignores any stale playback-state
  // callbacks that still carry the previous song's position before the
  // audio layer has loaded the new track.
  scrobbleInFlightTrackId = null;
  scrobbledSuccessfullyTrackId = null;
  activePlaybackTrackId = null;
  lastPlaybackStatus = {
    ...lastPlaybackStatus,
    position: 0,
    duration: 0,
  };

  currentTrack = {
    id: song.id,
    title: song.title,
    artist: song.artist,
    album: song.album,
    coverArt: song.coverArt,
    duration: song.duration,
  };

  ensureListenersInitialized();
  notifyStateChanged();
  persistCurrentSession();

  try {
    const cachedUri = getCachedSongPlaybackUri(song.id);
    const isFromCache = !!cachedUri;
    const playbackUrl = cachedUri ?? (await getSongStreamUrl(song.id));
    const getArtUrl = await getCoverArtBaseUrl();
    const artworkUrl = getArtUrl(song.coverArt);

    currentPlaybackSource = { songId: song.id, isFromCache };

    if (isFromCache) {
      updateSongCacheLastAccessed(song.id);
    }

    await loadTrack({
      url: playbackUrl,
      title: song.title,
      artist: song.artist ?? undefined,
      album: song.album ?? undefined,
      artworkUrl: artworkUrl ?? undefined,
      playWhenReady: true,
    });

    // Mark the track as active for scrobble eligibility only after the
    // audio layer has successfully loaded it.
    if (currentTrack?.id === song.id) {
      activePlaybackTrackId = song.id;
    }

    // Send "now playing" ping immediately (submission: false)
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
  }
}

export async function playPlaylist(
  songs: Child[],
  startIndex: number = 0,
): Promise<void> {
  if (!songs.length) return;

  try {
    currentQueue = songs;
    await playTrackAtIndex(startIndex);
  } catch (error) {
    console.error("failed to play playlist:", error);
  }
}

export async function playSong(song: Child): Promise<void> {
  await playPlaylist([song], 0);
}

export async function playNext(): Promise<void> {
  if (currentIndex + 1 < currentQueue.length) {
    await playTrackAtIndex(currentIndex + 1);
  } else if (currentRepeatMode === "all" && currentQueue.length > 0) {
    await playTrackAtIndex(0);
  }
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

export async function pausePlayback(): Promise<void> {
  await pause();
  persistCurrentSession();
}

export async function resumePlayback(): Promise<void> {
  if (currentTrack && activePlaybackTrackId !== currentTrack.id) {
    const resumePosition = lastPlaybackStatus.position;
    await playTrackAtIndex(currentIndex);
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
  await stop();
  activePlaybackTrackId = null;
  currentTrack = null;
  notifyStateChanged();
}

export async function resetPlayer(): Promise<void> {
  try {
    await stop();
  } catch (error) {
    console.error("failed to stop playback during reset:", error);
  }
  hasHydrated = true;
  currentQueue = [];
  currentIndex = 0;
  currentTrack = null;
  currentPlaybackSource = null;
  currentRepeatMode = "off";
  scrobbleInFlightTrackId = null;
  scrobbledSuccessfullyTrackId = null;
  activePlaybackTrackId = null;
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

export {
  addPlaybackErrorListener,
  addPlaybackStateListener,
  addRepeatModeListener,
};
export type { PlaybackStatus };
