import { Directory, File, Paths } from "expo-file-system";

import { getSongDownloadUrl } from "@/services/api";
import { getSongById, getSongCacheEntry } from "@/services/db";
import { Child } from "@/types";

export interface SongExportResult {
  success: boolean;
  cancelled?: boolean;
  fileName?: string;
  error?: string;
}

export type SongExportProgressListener = (event: {
  songId: string;
  progress: number; // 0 to 1, or -1 for indeterminate
}) => void;

const exportProgressListeners = new Set<SongExportProgressListener>();
const activeExportControllers = new Map<string, AbortController>();

export function subscribeSongExportProgress(
  listener: SongExportProgressListener,
): () => void {
  exportProgressListeners.add(listener);
  return () => {
    exportProgressListeners.delete(listener);
  };
}

export function notifySongExportProgress(
  songId: string,
  progress: number,
): void {
  exportProgressListeners.forEach((listener) => {
    try {
      listener({ songId, progress });
    } catch (e) {
      console.error("error in song export progress listener:", e);
    }
  });
}

export function isSongExporting(songId: string): boolean {
  return activeExportControllers.has(songId);
}

export function cancelSongExport(songId: string): boolean {
  const controller = activeExportControllers.get(songId);
  if (controller) {
    controller.abort();
    activeExportControllers.delete(songId);
    notifySongExportProgress(songId, 0);
    return true;
  }
  return false;
}

export function sanitizeFileName(name: string): string {
  return name
    .replace(/[/\\:*?"<>|\x00-\x1F]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 180);
}

export function getAudioMimeType(suffix?: string | null): string {
  const ext = (suffix || "mp3").toLowerCase().replace(/^\./, "");
  switch (ext) {
    case "flac":
      return "audio/flac";
    case "mp3":
      return "audio/mpeg";
    case "m4a":
    case "aac":
      return "audio/aac";
    case "ogg":
    case "oga":
      return "audio/ogg";
    case "opus":
      return "audio/opus";
    case "wav":
      return "audio/wav";
    case "wma":
      return "audio/x-ms-wma";
    default:
      return "audio/*";
  }
}

export function getSanitizedSongFileName(
  song: Child | null,
  fallbackId: string,
): string {
  const suffix = (song?.suffix || "mp3").replace(/^\./, "");

  // 1. If song.path from the server contains an original filename with extension, use and sanitize it
  if (song?.path) {
    const rawName = song.path.split(/[/\\]/).pop();
    if (rawName && rawName.includes(".")) {
      return sanitizeFileName(rawName);
    }
  }

  // 2. Otherwise format from track metadata: Artist - Title.suffix
  const title = song?.title?.trim() || "";
  const artist = song?.artist?.trim() || "";

  let baseName = "";
  if (artist && title) {
    baseName = `${artist} - ${title}`;
  } else if (title) {
    baseName = title;
  } else {
    baseName = `song-${fallbackId}`;
  }

  return `${sanitizeFileName(baseName)}.${suffix}`;
}

export function isPickerCancelledError(error: any): boolean {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  const code = (error.code || "").toLowerCase();
  const name = (error.name || "").toLowerCase();
  return (
    msg.includes("cancel") ||
    code.includes("cancel") ||
    name.includes("cancel")
  );
}

export async function saveSongToFiles(
  songId: string,
  onProgress?: (progress: number) => void,
): Promise<SongExportResult> {
  const song = getSongById(songId);
  const fileName = getSanitizedSongFileName(song, songId);
  const mimeType = getAudioMimeType(song?.suffix);

  // 1. Prompt user to choose destination directory
  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync();
  } catch (pickerError: any) {
    if (isPickerCancelledError(pickerError)) {
      return { success: false, cancelled: true };
    }
    console.error("directory picker error:", pickerError);
    return {
      success: false,
      error: pickerError?.message || "failed to select folder",
    };
  }

  // Cancel any previous active export for this song
  cancelSongExport(songId);

  const controller = new AbortController();
  activeExportControllers.set(songId, controller);

  notifySongExportProgress(songId, 0);
  onProgress?.(0);

  // 2. Check if song already exists in local offline cache (manual or auto)
  const cacheEntry = getSongCacheEntry(songId);
  let localCachedFile: File | null = null;
  if (cacheEntry?.filePath) {
    try {
      const file = new File(cacheEntry.filePath);
      if (file.exists) {
        localCachedFile = file;
      }
    } catch {
      localCachedFile = null;
    }
  }

  // If already cached locally, copy directly without network transfer
  if (localCachedFile) {
    try {
      notifySongExportProgress(songId, 0.5);
      onProgress?.(0.5);

      const targetFile = directory.createFile(fileName, mimeType);
      await localCachedFile.copy(targetFile);

      notifySongExportProgress(songId, 1);
      onProgress?.(1);

      return { success: true, fileName };
    } catch (copyError: any) {
      if (controller.signal.aborted) {
        return { success: false, cancelled: true };
      }
      console.error("failed to copy cached song to files:", copyError);
      return {
        success: false,
        error: copyError?.message || "failed to save file",
      };
    } finally {
      if (activeExportControllers.get(songId) === controller) {
        activeExportControllers.delete(songId);
      }
      notifySongExportProgress(songId, 0);
    }
  }

  // 3. Not cached locally: download to temporary cache file first with progress
  const tempFile = new File(
    Paths.cache,
    `export-${Date.now()}-${sanitizeFileName(fileName)}`,
  );

  try {
    const downloadUrl = await getSongDownloadUrl(songId);

    await File.downloadFileAsync(downloadUrl, tempFile, {
      idempotent: true,
      signal: controller.signal,
      onProgress: (event) => {
        let frac = 0;
        if (event.totalBytes > 0) {
          frac = Math.min(1, Math.max(0, event.bytesWritten / event.totalBytes));
        } else {
          frac = -1;
        }
        notifySongExportProgress(songId, frac);
        onProgress?.(frac);
      },
    });

    notifySongExportProgress(songId, 0.95);
    onProgress?.(0.95);

    const targetFile = directory.createFile(fileName, mimeType);
    await tempFile.copy(targetFile);

    notifySongExportProgress(songId, 1);
    onProgress?.(1);

    return { success: true, fileName };
  } catch (downloadError: any) {
    if (
      controller.signal.aborted ||
      downloadError?.name === "AbortError" ||
      downloadError?.message?.includes("aborted")
    ) {
      return { success: false, cancelled: true };
    }
    console.error("failed to download and save song to files:", downloadError);
    return {
      success: false,
      error: downloadError?.message || "failed to save file",
    };
  } finally {
    try {
      if (tempFile.exists) {
        tempFile.delete();
      }
    } catch {
      // Ignore temporary file deletion errors
    }
    if (activeExportControllers.get(songId) === controller) {
      activeExportControllers.delete(songId);
    }
    notifySongExportProgress(songId, 0);
  }
}
