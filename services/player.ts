import { useEffect, useState } from "react";
import { Image } from "react-native";

import {
  addNextTrackListener,
  addPlaybackErrorListener,
  addPlaybackStateListener,
  addPreviousTrackListener,
  addRepeatModeListener,
  addTrackEndedListener,
  getPlaybackStatus,
  loadTrack,
  pause,
  play,
  PlaybackStatus,
  playTestSound as nativePlayTestSound,
  seekTo,
  setRepeatMode,
  setVolume,
  stop,
  stopTestSound as nativeStopTestSound,
} from "@/modules/audio-playback";
import { getCoverArtBaseUrl, getSongStreamUrl, scrobble, scrobbleSong } from "@/services/api";
import { getScrobbleMinDuration, getScrobbleMinPercent, updateSongCacheLastAccessed } from "@/services/db";
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
let currentPlaybackSource: { songId: string; isFromCache: boolean } | null = null;
let currentRepeatMode: "off" | "one" | "all" = "off";
let lastPlaybackStatus: PlaybackStatus = {
  isPlaying: false,
  isBuffering: false,
  duration: 0,
  position: 0,
  repeatMode: "off",
};
let isInitialized = false;
let scrobbleTriggeredForTrackId: string | null = null;
// Set only after loadTrack resolves for the current song. Any playback-state
// callbacks that arrive before this is set (e.g. late events from the
// previous track) are ignored by checkAndScrobble.
let activePlaybackTrackId: string | null = null;

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
  const hasPrevious = currentIndex > 0 || (currentRepeatMode === "all" && currentQueue.length > 0);
  const hasNext =
    currentIndex + 1 < currentQueue.length ||
    (currentRepeatMode === "all" && currentQueue.length > 0);

  const isPlayingFromCache =
    !!currentTrack &&
    currentPlaybackSource?.songId === currentTrack.id &&
    !!currentPlaybackSource.isFromCache;

  const scrobbled =
    scrobbleTriggeredForTrackId !== null &&
    scrobbleTriggeredForTrackId === currentTrack?.id;

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

function checkAndScrobble(): void {
  if (!currentTrack) return;
  if (scrobbleTriggeredForTrackId === currentTrack.id) return;
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
    scrobbleTriggeredForTrackId = currentTrack.id;
    scrobbleSong(currentTrack.id).catch((err) =>
      console.error("failed to scrobble song:", err),
    );
    notifyStateChanged();
  }
}

function ensureListenersInitialized(): void {
  if (isInitialized) return;
  isInitialized = true;

  addPlaybackStateListener((status) => {
    lastPlaybackStatus = status;
    checkAndScrobble();
    notifyStateChanged();
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
  scrobbleTriggeredForTrackId = null;
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
  return currentQueue;
}

export function getCurrentIndex(): number {
  return currentIndex;
}

export function getCurrentTrack(): ActiveTrackInfo | null {
  return currentTrack;
}

export function getCurrentRepeatMode(): "off" | "one" | "all" {
  return currentRepeatMode;
}

export async function pausePlayback(): Promise<void> {
  await pause();
}

export async function resumePlayback(): Promise<void> {
  await play();
}

export async function togglePlayback(): Promise<void> {
  const status = await getPlaybackStatus();
  if (status.isPlaying) {
    await pause();
  } else {
    await play();
  }
}

export async function stopPlayback(): Promise<void> {
  await stop();
  currentTrack = null;
  notifyStateChanged();
}

export async function resetPlayer(): Promise<void> {
  try {
    await stop();
  } catch (error) {
    console.error("failed to stop playback during reset:", error);
  }
  currentQueue = [];
  currentIndex = 0;
  currentTrack = null;
  currentPlaybackSource = null;
  currentRepeatMode = "off";
  scrobbleTriggeredForTrackId = null;
  activePlaybackTrackId = null;
  lastPlaybackStatus = {
    isPlaying: false,
    isBuffering: false,
    duration: 0,
    position: 0,
    repeatMode: "off",
  };
  notifyStateChanged();
}

export async function seekToPosition(seconds: number): Promise<void> {
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

  // Update progress periodically when playing
  useEffect(() => {
    if (!state.isPlaying) return;

    const interval = setInterval(async () => {
      try {
        const latest = await getPlaybackStatus();
        lastPlaybackStatus = latest;
        setState((prev) => ({
          ...prev,
          isPlaying: latest.isPlaying,
          isBuffering: latest.isBuffering,
          duration: latest.duration || prev.currentTrack?.duration || 0,
          position: latest.position,
        }));
      } catch {
        // ignore polling errors
      }
    }, 800);

    return () => clearInterval(interval);
  }, [state.isPlaying]);

  return state;
}

export {
  addPlaybackErrorListener,
  addPlaybackStateListener,
  addRepeatModeListener,
};
export type { PlaybackStatus };

