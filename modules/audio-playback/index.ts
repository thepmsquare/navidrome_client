import { NativeModule, requireNativeModule } from "expo";

export interface PlaybackStatus {
  isPlaying: boolean;
  isBuffering: boolean;
  duration: number;
  position: number;
  repeatMode: "off" | "one" | "all";
  playbackSpeed?: number;
}

export interface PlaybackError {
  errorCode: string;
  message: string;
}

export interface RepeatModeChanged {
  mode: "off" | "one" | "all";
}

export interface MediaItemTransition {
  index: number;
  mediaId: string;
}

export interface TrackParams {
  url: string;
  title?: string;
  artist?: string;
  album?: string;
  artworkUrl?: string | null;
  playWhenReady?: boolean;
}

export interface PlaylistItem {
  mediaId: string;
  url: string;
  title?: string;
  artist?: string;
  album?: string;
  artworkUrl?: string | null;
  suffix?: string | null;
}

export interface PlaylistState {
  activeIndex: number;
  position: number;
  duration: number;
  isPlaying: boolean;
  repeatMode: "off" | "one" | "all";
  shuffle: boolean;
  itemCount: number;
}

type AudioPlaybackEvents = {
  onPlaybackStateChanged: (status: PlaybackStatus) => void;
  onTrackEnded: () => void;
  onNextTrack: () => void;
  onPreviousTrack: () => void;
  onPlaybackError: (error: PlaybackError) => void;
  onRepeatModeChanged: (data: RepeatModeChanged) => void;
  onPlaybackStopped: () => void;
  onMediaItemTransition: (data: MediaItemTransition) => void;
  onSleepTimerExpired: () => void;
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
  setPlaylist(
    items: PlaylistItem[],
    startIndex: number,
    initialPositionSeconds: number,
  ): Promise<void>;
  addPlaylistItem(item: PlaylistItem, index?: number): Promise<void>;
  removePlaylistItem(index: number): Promise<void>;
  movePlaylistItem(fromIndex: number, toIndex: number): Promise<void>;
  clearPlaylist(): Promise<void>;
  seekToTrack(index: number, positionSeconds: number): Promise<void>;
  updatePlaylistItemUri(index: number, url: string): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  seekTo(positionSeconds: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  setRepeatMode(mode: "off" | "one" | "all"): Promise<void>;
  setShuffleModeEnabled(enabled: boolean): Promise<void>;
  setPlaybackSpeed(speed: number): Promise<void>;
  setStopOnAppDismissed(stop: boolean): Promise<void>;
  getPlaybackStatus(): Promise<PlaybackStatus>;
  getPlaylistState(): Promise<PlaylistState | null>;
  getCompletedTracks(): Promise<CompletedTrackInfo[]>;
  clearCompletedTracks(): Promise<void>;
  getPendingAutoCacheTracks(): Promise<PendingAutoCacheTrackInfo[]>;
  clearPendingAutoCacheTracks(): Promise<void>;
  setAutoCacheEnabled(enabled: boolean): Promise<void>;
  setDownloadWifiOnly(wifiOnly: boolean): Promise<void>;
  setSleepTimer(durationMs: number): Promise<void>;
  cancelSleepTimer(): Promise<void>;
  getSleepTimerRemainingSeconds(): Promise<number>;
  playTestSound(url: string): Promise<void>;
  stopTestSound(): Promise<void>;
}

let AudioPlayback: AudioPlaybackNativeModule | null = null;

try {
  AudioPlayback =
    requireNativeModule<AudioPlaybackNativeModule>("AudioPlayback");
} catch {
  AudioPlayback = null;
}

export async function playTestSound(url: string): Promise<void> {
  if (!AudioPlayback) return;
  await AudioPlayback.playTestSound(url);
}

export async function stopTestSound(): Promise<void> {
  if (!AudioPlayback) return;
  await AudioPlayback.stopTestSound();
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

export async function setPlaylist(
  items: PlaylistItem[],
  startIndex: number = 0,
  initialPositionSeconds: number = 0,
): Promise<void> {
  if (!AudioPlayback) return;
  await AudioPlayback.setPlaylist(items, startIndex, initialPositionSeconds);
}

export async function addPlaylistItem(
  item: PlaylistItem,
  index?: number,
): Promise<void> {
  if (!AudioPlayback) return;
  await AudioPlayback.addPlaylistItem(item, index);
}

export async function removePlaylistItem(index: number): Promise<void> {
  if (!AudioPlayback) return;
  await AudioPlayback.removePlaylistItem(index);
}

export async function movePlaylistItem(
  fromIndex: number,
  toIndex: number,
): Promise<void> {
  if (!AudioPlayback) return;
  await AudioPlayback.movePlaylistItem(fromIndex, toIndex);
}

export async function clearPlaylist(): Promise<void> {
  if (!AudioPlayback) return;
  await AudioPlayback.clearPlaylist();
}

export async function seekToTrack(
  index: number,
  positionSeconds: number = 0,
): Promise<void> {
  if (!AudioPlayback) return;
  await AudioPlayback.seekToTrack(index, positionSeconds);
}

export async function updatePlaylistItemUri(
  index: number,
  url: string,
): Promise<void> {
  if (!AudioPlayback) return;
  await AudioPlayback.updatePlaylistItemUri(index, url);
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

export async function setShuffleModeEnabled(enabled: boolean): Promise<void> {
  if (!AudioPlayback) return;
  await AudioPlayback.setShuffleModeEnabled(enabled);
}

export async function setPlaybackSpeed(speed: number): Promise<void> {
  if (!AudioPlayback) return;
  await AudioPlayback.setPlaybackSpeed(speed);
}

export async function setStopOnAppDismissed(stop: boolean): Promise<void> {
  if (!AudioPlayback) return;
  await AudioPlayback.setStopOnAppDismissed(stop);
}

export async function getPlaybackStatus(): Promise<PlaybackStatus> {
  if (!AudioPlayback) {
    return {
      isPlaying: false,
      isBuffering: false,
      duration: 0,
      position: 0,
      repeatMode: "off",
      playbackSpeed: 1.0,
    };
  }
  return await AudioPlayback.getPlaybackStatus();
}

export interface CompletedTrackInfo {
  mediaId: string;
  index: number;
  timestamp: number;
}

export interface PendingAutoCacheTrackInfo {
  mediaId: string;
  index: number;
  timestamp: number;
  status: "pending" | "completed" | "failed";
  filePath?: string;
  fileSizeBytes?: number;
}

export async function getCompletedTracks(): Promise<CompletedTrackInfo[]> {
  if (!AudioPlayback) return [];
  return await AudioPlayback.getCompletedTracks();
}

export async function clearCompletedTracks(): Promise<void> {
  if (!AudioPlayback) return;
  await AudioPlayback.clearCompletedTracks();
}

export async function getPlaylistState(): Promise<PlaylistState | null> {
  if (!AudioPlayback) return null;
  return await AudioPlayback.getPlaylistState();
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

export function addPlaybackStoppedListener(listener: () => void) {
  if (!AudioPlayback) return { remove: () => {} };
  return AudioPlayback.addListener("onPlaybackStopped", listener);
}

export function addMediaItemTransitionListener(
  listener: (data: MediaItemTransition) => void,
) {
  if (!AudioPlayback) return { remove: () => {} };
  return AudioPlayback.addListener("onMediaItemTransition", listener);
}

export async function setSleepTimer(durationMs: number): Promise<void> {
  if (!AudioPlayback) return;
  await AudioPlayback.setSleepTimer(durationMs);
}

export async function cancelSleepTimer(): Promise<void> {
  if (!AudioPlayback) return;
  await AudioPlayback.cancelSleepTimer();
}

export async function getSleepTimerRemainingSeconds(): Promise<number> {
  if (!AudioPlayback) return 0;
  return await AudioPlayback.getSleepTimerRemainingSeconds();
}

export function addSleepTimerExpiredListener(listener: () => void) {
  if (!AudioPlayback) return { remove: () => {} };
  return AudioPlayback.addListener("onSleepTimerExpired", listener);
}

export async function getPendingAutoCacheTracks(): Promise<PendingAutoCacheTrackInfo[]> {
  if (!AudioPlayback) return [];
  return await AudioPlayback.getPendingAutoCacheTracks();
}

export async function clearPendingAutoCacheTracks(): Promise<void> {
  if (!AudioPlayback) return;
  await AudioPlayback.clearPendingAutoCacheTracks();
}

export async function setAutoCacheEnabled(enabled: boolean): Promise<void> {
  if (!AudioPlayback) return;
  await AudioPlayback.setAutoCacheEnabled(enabled);
}

export async function setDownloadWifiOnly(wifiOnly: boolean): Promise<void> {
  if (!AudioPlayback) return;
  await AudioPlayback.setDownloadWifiOnly(wifiOnly);
}

export default AudioPlayback;
