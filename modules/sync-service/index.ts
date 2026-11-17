import { NativeModule, requireNativeModule } from "expo";

type SyncServiceEvents = {
  onCancelSync: () => void;
};

declare class SyncServiceNativeModule extends NativeModule<SyncServiceEvents> {
  startForegroundService(
    title: string,
    text: string,
    progress: number,
    max: number,
  ): boolean;
  updateProgress(
    title: string,
    text: string,
    progress: number,
    max: number,
  ): boolean;
  stopForegroundService(): boolean;
}

let SyncService: SyncServiceNativeModule | null = null;

try {
  SyncService = requireNativeModule<SyncServiceNativeModule>("SyncService");
} catch {
  SyncService = null;
}

export function startSyncForegroundService(
  title = "syncing library",
  text = "",
  progress = 0,
  max = 0,
): boolean {
  if (!SyncService) return false;
  try {
    return SyncService.startForegroundService(title, text, progress, max);
  } catch (e) {
    console.error("failed to start sync foreground service:", e);
    return false;
  }
}

export function updateSyncProgress(
  title = "syncing library",
  text = "",
  progress = 0,
  max = 0,
): boolean {
  if (!SyncService) return false;
  try {
    return SyncService.updateProgress(title, text, progress, max);
  } catch (e) {
    console.error("failed to update sync progress:", e);
    return false;
  }
}

export function stopSyncForegroundService(): boolean {
  if (!SyncService) return false;
  try {
    return SyncService.stopForegroundService();
  } catch (e) {
    console.error("failed to stop sync foreground service:", e);
    return false;
  }
}

export function addSyncCancelListener(
  listener: () => void,
): { remove: () => void } {
  if (!SyncService) {
    return { remove: () => {} };
  }
  return SyncService.addListener("onCancelSync", listener);
}

export default SyncService;
