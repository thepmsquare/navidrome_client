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
    let isMounted = true;
    get_current_default_audio_output_device()
      .then((d) => {
        if (isMounted) setDevice(d);
      })
      .catch((err) => console.error("failed to get audio output device:", err));

    const unsubscribe = addAudioOutputChangeListener((newDevice) => {
      if (isMounted) setDevice(newDevice);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return device;
}
