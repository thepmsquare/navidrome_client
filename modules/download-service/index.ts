import { NativeModule, requireNativeModule } from "expo";

type DownloadServiceEvents = {
  onCancelDownload: () => void;
  onNetworkChanged: (event: { isWifi: boolean }) => void;
};

declare class DownloadServiceNativeModule extends NativeModule<DownloadServiceEvents> {
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
  isWifiConnected(): boolean;
}

let DownloadService: DownloadServiceNativeModule | null = null;

try {
  DownloadService =
    requireNativeModule<DownloadServiceNativeModule>("DownloadService");
} catch {
  DownloadService = null;
}

export function startDownloadForegroundService(
  title: string,
  text: string,
  progress = 0,
  max = 100,
): boolean {
  if (!DownloadService) return false;
  try {
    return DownloadService.startForegroundService(title, text, progress, max);
  } catch (e) {
    console.error("failed to start download foreground service:", e);
    return false;
  }
}

export function updateDownloadProgress(
  title: string,
  text: string,
  progress: number,
  max = 100,
): boolean {
  if (!DownloadService) return false;
  try {
    return DownloadService.updateProgress(title, text, progress, max);
  } catch (e) {
    console.error("failed to update download progress:", e);
    return false;
  }
}

export function stopDownloadForegroundService(): boolean {
  if (!DownloadService) return false;
  try {
    return DownloadService.stopForegroundService();
  } catch (e) {
    console.error("failed to stop download foreground service:", e);
    return false;
  }
}

export function addDownloadCancelListener(
  listener: () => void,
): { remove: () => void } {
  if (!DownloadService) {
    return { remove: () => {} };
  }
  return DownloadService.addListener("onCancelDownload", listener);
}

export function isWifiConnected(): boolean {
  if (!DownloadService) return true;
  try {
    return DownloadService.isWifiConnected();
  } catch (e) {
    console.error("failed to check wifi connection:", e);
    return true;
  }
}

export function addNetworkChangeListener(
  listener: (isWifi: boolean) => void,
): { remove: () => void } {
  if (!DownloadService) {
    return { remove: () => {} };
  }
  return DownloadService.addListener("onNetworkChanged", (event) => {
    listener(Boolean(event?.isWifi));
  });
}

export default DownloadService;
