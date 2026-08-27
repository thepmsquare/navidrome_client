import { useEffect, useState } from "react";

import {
  addAudioOutputListener,
  AudioOutputDeviceInfo,
  getCurrentOutputDevice,
} from "@/modules/audio-output";

export type { AudioOutputDeviceInfo };

export async function get_current_default_audio_output_device(): Promise<AudioOutputDeviceInfo> {
  return await getCurrentOutputDevice();
}

export function addAudioOutputChangeListener(
  listener: (device: AudioOutputDeviceInfo) => void,
): () => void {
  const subscription = addAudioOutputListener(listener);
  return () => {
    subscription.remove();
  };
}

export function useAudioOutputDevice(): AudioOutputDeviceInfo {
  const [device, setDevice] = useState<AudioOutputDeviceInfo>({
    name: "speaker",
    type: "speaker",
    isHeadphones: false,
  });

  useEffect(() => {
    get_current_default_audio_output_device()
      .then(setDevice)
      .catch((err) => console.error("failed to get audio output device:", err));

    const unsubscribe = addAudioOutputChangeListener((newDevice) => {
      setDevice(newDevice);
    });

    return unsubscribe;
  }, []);

  return device;
}
