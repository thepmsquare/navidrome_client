import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from "expo-audio";

import { getCoverArtBaseUrl, getSongStreamUrl } from "@/services/api";
import { Child } from "@/types";

let playerInstance: AudioPlayer | null = null;

export async function playSong(song: Child): Promise<void> {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    });

    const streamUrl = await getSongStreamUrl(song.id);
    const getArtUrl = await getCoverArtBaseUrl();
    const artworkUrl = getArtUrl(song.coverArt);

    if (playerInstance) {
      playerInstance.pause();
      playerInstance.replace({ uri: streamUrl });
    } else {
      playerInstance = createAudioPlayer({ uri: streamUrl });
    }

    // Register this player as the active source for lock screen / notification controls
    playerInstance.setActiveForLockScreen(
      true,
      {
        title: song.title,
        artist: song.artist ?? undefined,
        artworkUrl: artworkUrl ?? undefined,
      },
      {
        showSeekBackward: true,
        showSeekForward: true,
      },
    );

    playerInstance.play();
  } catch (error) {
    console.error("failed to play song with expo-audio:", error);
  }
}

