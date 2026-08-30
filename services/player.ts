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
  seekTo,
  setRepeatMode,
  setVolume,
  stop,
} from "@/modules/audio-playback";
import {
  getCoverArtBaseUrl,
  getSongStreamUrl,
  scrobbleSong,
} from "@/services/api";
import { Child } from "@/types";

let currentQueue: Child[] = [];
let currentIndex = 0;
let currentRepeatMode: "off" | "one" | "all" = "off";
let isInitialized = false;

function ensureListenersInitialized(): void {
  if (isInitialized) return;
  isInitialized = true;

  addTrackEndedListener(() => {
    playNext();
  });

  addNextTrackListener(() => {
    playNext();
  });

  addPreviousTrackListener(() => {
    playPrevious();
  });

  addPlaybackErrorListener((error) => {
    console.error("playback error:", error.errorCode, error.message);
  });

  addRepeatModeListener((data) => {
    currentRepeatMode = data.mode;
    console.log(`repeat mode changed to: ${data.mode}`);
  });
}

export async function playTrackAtIndex(index: number): Promise<void> {
  if (index < 0 || index >= currentQueue.length) return;
  currentIndex = index;
  const song = currentQueue[index];
  if (!song) return;

  ensureListenersInitialized();

  try {
    const streamUrl = await getSongStreamUrl(song.id);
    const getArtUrl = await getCoverArtBaseUrl();
    const artworkUrl = getArtUrl(song.coverArt);

    await loadTrack({
      url: streamUrl,
      title: song.title,
      artist: song.artist ?? undefined,
      album: song.album ?? undefined,
      artworkUrl: artworkUrl ?? undefined,
      playWhenReady: true,
    });

    scrobbleSong(song.id);
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
  return await getPlaybackStatus();
}

const TEST_AUDIO_SOURCE = require("@/assets/sounds/test.wav");

export async function playTestSound(): Promise<void> {
  try {
    ensureListenersInitialized();
    const resolved = Image.resolveAssetSource(TEST_AUDIO_SOURCE);

    await loadTrack({
      url: resolved.uri,
      title: "test sound",
      artist: "navidrome client",
      playWhenReady: true,
    });
  } catch (error) {
    console.error("failed to play test sound:", error);
  }
}

export {
  addPlaybackErrorListener,
  addPlaybackStateListener,
  addRepeatModeListener,
};
export type { PlaybackStatus };
