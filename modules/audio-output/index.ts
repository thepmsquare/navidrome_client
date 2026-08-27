import { NativeModule, requireNativeModule } from "expo";

export interface AudioOutputDeviceInfo {
  name: string;
  type: string;
  isHeadphones: boolean;
}

type AudioOutputEvents = {
  onAudioOutputChanged: (device: AudioOutputDeviceInfo) => void;
};

declare class AudioOutputNativeModule extends NativeModule<AudioOutputEvents> {
  getCurrentOutputDevice(): Promise<AudioOutputDeviceInfo>;
}

let AudioOutput: AudioOutputNativeModule | null = null;

try {
  AudioOutput = requireNativeModule<AudioOutputNativeModule>("AudioOutput");
} catch {
  AudioOutput = null;
}

export function addAudioOutputListener(
  listener: (device: AudioOutputDeviceInfo) => void,
) {
  if (!AudioOutput) {
    return { remove: () => {} };
  }
  return AudioOutput.addListener("onAudioOutputChanged", listener);
}

export async function getCurrentOutputDevice(): Promise<AudioOutputDeviceInfo> {
  if (!AudioOutput) {
    return {
      name: "speaker",
      type: "speaker",
      isHeadphones: false,
    };
  }
  return await AudioOutput.getCurrentOutputDevice();
}

export default AudioOutput;
