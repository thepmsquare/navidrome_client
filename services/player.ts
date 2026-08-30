import {
  AudioPlayer,
  AudioStatus,
  createAudioPlayer,
  setAudioModeAsync,
} from "expo-audio";

import {
  getCoverArtBaseUrl,
  getSongStreamUrl,
  scrobbleSong,
} from "@/services/api";
import { Child } from "@/types";

let playerInstance: AudioPlayer | null = null;
let currentQueue: Child[] = [];
let currentIndex = 0;

export async function playTrackAtIndex(index: number): Promise<void> {
  if (index < 0 || index >= currentQueue.length) return;
  currentIndex = index;
  const song = currentQueue[index];
  if (!song) return;

  try {
    const streamUrl = await getSongStreamUrl(song.id);
    const getArtUrl = await getCoverArtBaseUrl();
    const artworkUrl = getArtUrl(song.coverArt);

    if (playerInstance) {
      playerInstance.pause();
      playerInstance.replace({ uri: streamUrl });
    } else {
      playerInstance = createAudioPlayer({ uri: streamUrl });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (playerInstance as any).addListener?.(
        "playbackStatusUpdate",
        (status: AudioStatus) => {
          if (status.didJustFinish) {
            playNext();
          }
        },
      );
    }

    playerInstance.setActiveForLockScreen(
      true,
      {
        title: song.title,
        artist: song.artist ?? undefined,
        albumTitle: song.album ?? undefined,
        artworkUrl: artworkUrl ?? undefined,
      },
      {
        showSeekBackward: true,
        showSeekForward: true,
      },
    );

    playerInstance.play();
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
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    });

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
  }
}

export async function playPrevious(): Promise<void> {
  if (currentIndex - 1 >= 0) {
    await playTrackAtIndex(currentIndex - 1);
  }
}

export function getCurrentPlayer(): AudioPlayer | null {
  return playerInstance;
}

export function getCurrentQueue(): Child[] {
  return currentQueue;
}

export function getCurrentIndex(): number {
  return currentIndex;
}

export function pausePlayback(): void {
  if (playerInstance) {
    playerInstance.pause();
  }
}

export function resumePlayback(): void {
  if (playerInstance) {
    playerInstance.play();
  }
}

export function togglePlayback(): void {
  if (playerInstance) {
    if (playerInstance.playing) {
      playerInstance.pause();
    } else {
      playerInstance.play();
    }
  }
}

export function stopPlayback(): void {
  if (playerInstance) {
    playerInstance.pause();
    playerInstance.setActiveForLockScreen(false);
  }
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TEST_AUDIO_SOURCE = require("@/assets/sounds/test.wav");

export async function playTestSound(): Promise<void> {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    });

    if (playerInstance) {
      playerInstance.pause();
      playerInstance.replace(TEST_AUDIO_SOURCE);
    } else {
      playerInstance = createAudioPlayer(TEST_AUDIO_SOURCE);
    }

    playerInstance.setActiveForLockScreen(
      true,
      {
        title: "test sound",
        artist: "navidrome client",
      },
      {
        showSeekBackward: true,
        showSeekForward: true,
      },
    );

    playerInstance.play();
  } catch (error) {
    console.error("failed to play test sound:", error);
  }
}

