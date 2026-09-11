import { Directory, File, Paths } from "expo-file-system";

import { getSongStreamUrl } from "@/services/api";
import {
  deleteSongCacheEntry,
  getSongById,
  getSongCacheEntry,
  updateSongCacheLastAccessed,
  upsertSongCacheEntry,
} from "@/services/db";
import { SongCacheRow, SongCacheType } from "@/types";

export function getCachedSongPlaybackUri(songId: string): string | null {
  const entry = getSongCacheEntry(songId);
  if (!entry || !entry.filePath) return null;

  try {
    const file = new File(entry.filePath);
    if (!file.exists) {
      return null;
    }
    updateSongCacheLastAccessed(songId);
    return entry.filePath;
  } catch {
    // If file existence check fails or uri is directly usable
    return entry.filePath;
  }
}

type SongCacheListener = (event: {
  songId: string;
  entry: SongCacheRow | null;
}) => void;

type SongCacheProgressListener = (event: {
  songId: string;
  progress: number; // 0 to 1, or -1 if indeterminate
}) => void;

const cacheListeners = new Set<SongCacheListener>();
const progressListeners = new Set<SongCacheProgressListener>();

export function subscribeSongCache(listener: SongCacheListener): () => void {
  cacheListeners.add(listener);
  return () => {
    cacheListeners.delete(listener);
  };
}

export function subscribeSongCacheProgress(
  listener: SongCacheProgressListener,
): () => void {
  progressListeners.add(listener);
  return () => {
    progressListeners.delete(listener);
  };
}

export function notifySongCacheUpdated(
  songId: string,
  entry: SongCacheRow | null,
): void {
  cacheListeners.forEach((listener) => {
    try {
      listener({ songId, entry });
    } catch (e) {
      console.error("error in song cache listener:", e);
    }
  });
}

export async function deleteSongFromCache(songId: string): Promise<void> {
  const entry = getSongCacheEntry(songId);
  if (entry?.filePath) {
    try {
      const file = new File(entry.filePath);
      if (file.exists) {
        file.delete();
      }
    } catch (e) {
      console.error("failed to delete cached file from disk:", e);
    }
  }

  deleteSongCacheEntry(songId);
  notifySongCacheUpdated(songId, null);
}

export function notifySongCacheProgress(
  songId: string,
  progress: number,
): void {
  progressListeners.forEach((listener) => {
    try {
      listener({ songId, progress });
    } catch (e) {
      console.error("error in song cache progress listener:", e);
    }
  });
}

const activeControllers = new Map<string, AbortController>();

export function cancelSongCaching(songId: string): boolean {
  const controller = activeControllers.get(songId);
  if (controller) {
    controller.abort();
    activeControllers.delete(songId);
    notifySongCacheProgress(songId, 0);
    return true;
  }
  return false;
}

export function isSongCaching(songId: string): boolean {
  return activeControllers.has(songId);
}

export async function cacheSongManually(
  songId: string,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const song = getSongById(songId);
  if (!song) {
    throw new Error(`song with id ${songId} not found`);
  }

  // Cancel any existing active download for this song
  cancelSongCaching(songId);

  const controller = new AbortController();
  activeControllers.set(songId, controller);

  if (signal) {
    signal.addEventListener("abort", () => {
      controller.abort();
    });
  }

  const suffix = song.suffix || "mp3";
  const streamUrl = await getSongStreamUrl(songId);

  const cacheDir = new Directory(Paths.document, "manual-cache");
  if (!cacheDir.exists) {
    cacheDir.create({ idempotent: true });
  }

  notifySongCacheProgress(songId, 0);
  onProgress?.(0);

  const destination = new File(cacheDir, `${songId}.${suffix}`);

  try {
    const downloadedFile = await File.downloadFileAsync(streamUrl, destination, {
      idempotent: true,
      signal: controller.signal,
      onProgress: (event) => {
        let progressFraction = 0;
        if (event.totalBytes > 0) {
          progressFraction = Math.min(
            1,
            Math.max(0, event.bytesWritten / event.totalBytes),
          );
        } else {
          // If content-length header was not provided
          progressFraction = -1;
        }
        notifySongCacheProgress(songId, progressFraction);
        onProgress?.(progressFraction);
      },
    });

    const fileSizeBytes = downloadedFile.size || destination.size || 0;
    const filePath = downloadedFile.uri || destination.uri;

    upsertSongCacheEntry(
      songId,
      SongCacheType.Manual,
      filePath,
      fileSizeBytes,
    );

    const entry = getSongCacheEntry(songId);
    if (entry) {
      notifySongCacheUpdated(songId, entry);
    }
  } catch (error: any) {
    // If download was aborted or cancelled, clean up partial destination file
    try {
      if (destination.exists) {
        destination.delete();
      }
    } catch {
      // Ignore file deletion error
    }
    throw error;
  } finally {
    if (activeControllers.get(songId) === controller) {
      activeControllers.delete(songId);
    }
  }
}

export async function clearAllCachedSongs(): Promise<void> {
  // Cancel and abort all in-flight caching operations
  activeControllers.forEach((controller) => {
    try {
      controller.abort();
    } catch {
      // Ignore abort errors
    }
  });
  activeControllers.clear();

  // Delete manual cache folder and its contents
  try {
    const cacheDir = new Directory(Paths.document, "manual-cache");
    if (cacheDir.exists) {
      cacheDir.delete();
    }
  } catch (error) {
    console.error("failed to delete manual cache directory:", error);
  }
}
