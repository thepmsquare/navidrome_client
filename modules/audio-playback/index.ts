import { NativeModule, requireNativeModule } from "expo";

export interface PlaybackStatus {
  isPlaying: boolean;
  isBuffering: boolean;
  duration: number;
  position: number;
  repeatMode: "off" | "one" | "all";
}

export interface PlaybackError {
  errorCode: string;
  message: string;
}

export interface RepeatModeChanged {
  mode: "off" | "one" | "all";
}

export interface TrackParams {
  url: string;
  title?: string;
  artist?: string;
  album?: string;
  artworkUrl?: string | null;
  playWhenReady?: boolean;
}

type AudioPlaybackEvents = {
  onPlaybackStateChanged: (status: PlaybackStatus) => void;
  onTrackEnded: () => void;
  onNextTrack: () => void;
  onPreviousTrack: () => void;
  onPlaybackError: (error: PlaybackError) => void;
  onRepeatModeChanged: (data: RepeatModeChanged) => void;
};

declare class AudioPlaybackNativeModule extends NativeModule<AudioPlaybackEvents> {
  loadTrack(
    url: string,
    title: string | null,
    artist: string | null,
    album: string | null,
    artworkUrl: string | null,
    playWhenReady: boolean,
  ): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  seekTo(positionSeconds: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  setRepeatMode(mode: "off" | "one" | "all"): Promise<void>;
  getPlaybackStatus(): Promise<PlaybackStatus>;
}

let AudioPlayback: AudioPlaybackNativeModule | null = null;

try {
  AudioPlayback =
    requireNativeModule<AudioPlaybackNativeModule>("AudioPlayback");
} catch {
  AudioPlayback = null;
}

export async function loadTrack(params: TrackParams): Promise<void> {
  if (!AudioPlayback) return;
  await AudioPlayback.loadTrack(
    params.url,
    params.title ?? null,
    params.artist ?? null,
    params.album ?? null,
    params.artworkUrl ?? null,
    params.playWhenReady ?? true,
  );
}

export async function play(): Promise<void> {
  if (!AudioPlayback) return;
  await AudioPlayback.play();
}

export async function pause(): Promise<void> {
  if (!AudioPlayback) return;
  await AudioPlayback.pause();
}

export async function stop(): Promise<void> {
  if (!AudioPlayback) return;
  await AudioPlayback.stop();
}

export async function seekTo(seconds: number): Promise<void> {
  if (!AudioPlayback) return;
  await AudioPlayback.seekTo(seconds);
}

export async function setVolume(volume: number): Promise<void> {
  if (!AudioPlayback) return;
  await AudioPlayback.setVolume(volume);
}

export async function setRepeatMode(
  mode: "off" | "one" | "all",
): Promise<void> {
  if (!AudioPlayback) return;
  await AudioPlayback.setRepeatMode(mode);
}

export async function getPlaybackStatus(): Promise<PlaybackStatus> {
  if (!AudioPlayback) {
    return {
      isPlaying: false,
      isBuffering: false,
      duration: 0,
      position: 0,
      repeatMode: "off",
    };
  }
  return await AudioPlayback.getPlaybackStatus();
}

export function addPlaybackStateListener(
  listener: (status: PlaybackStatus) => void,
) {
  if (!AudioPlayback) return { remove: () => {} };
  return AudioPlayback.addListener("onPlaybackStateChanged", listener);
}

export function addTrackEndedListener(listener: () => void) {
  if (!AudioPlayback) return { remove: () => {} };
  return AudioPlayback.addListener("onTrackEnded", listener);
}

export function addNextTrackListener(listener: () => void) {
  if (!AudioPlayback) return { remove: () => {} };
  return AudioPlayback.addListener("onNextTrack", listener);
}

export function addPreviousTrackListener(listener: () => void) {
  if (!AudioPlayback) return { remove: () => {} };
  return AudioPlayback.addListener("onPreviousTrack", listener);
}

export function addPlaybackErrorListener(
  listener: (error: PlaybackError) => void,
) {
  if (!AudioPlayback) return { remove: () => {} };
  return AudioPlayback.addListener("onPlaybackError", listener);
}

export function addRepeatModeListener(
  listener: (data: RepeatModeChanged) => void,
) {
  if (!AudioPlayback) return { remove: () => {} };
  return AudioPlayback.addListener("onRepeatModeChanged", listener);
}

export default AudioPlayback;
