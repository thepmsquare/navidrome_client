import { Directory, File, Paths } from "expo-file-system";

import { getSongStreamUrl } from "@/services/api";
import {
  deleteAutoSongCacheEntries,
  deleteSongCacheEntry,
  getAutoCacheEnabled,
  getAutoCacheMaxBytes,
  getAutoCacheSongIds,
  getAutoCacheTotalSize,
  getLeastRecentlyUsedAutoCacheEntries,
  getSongById,
  getSongCacheEntry,
  insertSongCacheEntryIfNotExists,
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
const activeAutoControllers = new Map<string, AbortController>();

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

  const autoController = activeAutoControllers.get(songId);
  if (autoController) {
    autoController.abort();
    activeAutoControllers.delete(songId);
  }

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
    const downloadedFile = await File.downloadFileAsync(
      streamUrl,
      destination,
      {
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
      },
    );

    const fileSizeBytes = downloadedFile.size || destination.size || 0;
    const filePath = downloadedFile.uri || destination.uri;

    const oldEntry = getSongCacheEntry(songId);
    if (oldEntry?.filePath && oldEntry.filePath !== filePath) {
      try {
        const oldFile = new File(oldEntry.filePath);
        if (oldFile.exists) {
          oldFile.delete();
        }
      } catch {
        // Ignore file deletion error
      }
    }

    upsertSongCacheEntry(songId, SongCacheType.Manual, filePath, fileSizeBytes);

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

export async function autoCacheSong(songId: string): Promise<void> {
  if (!getAutoCacheEnabled()) {
    return;
  }

  const song = getSongById(songId);
  if (!song) {
    return;
  }

  // Do not auto-cache if an entry already exists in song_cache or already auto-caching
  if (getSongCacheEntry(songId) || activeAutoControllers.has(songId)) {
    return;
  }

  const controller = new AbortController();
  activeAutoControllers.set(songId, controller);

  const suffix = song.suffix || "mp3";
  let destination: File | null = null;

  try {
    const streamUrl = await getSongStreamUrl(songId);

    const cacheDir = new Directory(Paths.document, "auto-cache");
    if (!cacheDir.exists) {
      cacheDir.create({ idempotent: true });
    }

    destination = new File(cacheDir, `${songId}.${suffix}`);

    const downloadedFile = await File.downloadFileAsync(
      streamUrl,
      destination,
      {
        idempotent: true,
        signal: controller.signal,
      },
    );

    // Guard: only insert if no existing row for that song already
    // (don't overwrite a manually cached song with an auto entry)
    const existingEntry = getSongCacheEntry(songId);
    if (existingEntry) {
      try {
        if (destination.exists) {
          destination.delete();
        }
      } catch {
        // Ignore file deletion error
      }
      return;
    }

    const fileSizeBytes = downloadedFile.size || destination.size || 0;
    const filePath = downloadedFile.uri || destination.uri;

    const maxBytes = getAutoCacheMaxBytes();
    let currentTotal = getAutoCacheTotalSize();

    if (currentTotal + fileSizeBytes > maxBytes) {
      while (currentTotal + fileSizeBytes > maxBytes) {
        const lruEntries = getLeastRecentlyUsedAutoCacheEntries(1);
        if (!lruEntries || lruEntries.length === 0) {
          break;
        }
        const victim = lruEntries[0];
        try {
          const victimFile = new File(victim.filePath);
          if (victimFile.exists) {
            victimFile.delete();
          }
        } catch (e) {
          console.error("failed to delete evicted auto-cache file:", e);
        }
        deleteSongCacheEntry(victim.songId);
        notifySongCacheUpdated(victim.songId, null);
        currentTotal -= victim.fileSizeBytes;
      }

      // Edge case: if maxBytes is smaller than this single file, stop once bucket is empty and skip caching
      if (currentTotal + fileSizeBytes > maxBytes) {
        try {
          if (destination.exists) {
            destination.delete();
          }
        } catch {
          // Ignore file deletion error
        }
        return;
      }
    }

    const inserted = insertSongCacheEntryIfNotExists(
      songId,
      SongCacheType.Auto,
      filePath,
      fileSizeBytes,
    );

    if (inserted) {
      const entry = getSongCacheEntry(songId);
      if (entry) {
        notifySongCacheUpdated(songId, entry);
      }
    } else {
      try {
        if (destination.exists) {
          destination.delete();
        }
      } catch {
        // Ignore file deletion error
      }
    }
  } catch (error: any) {
    // If download was aborted or failed, clean up partial destination file
    try {
      if (destination && destination.exists) {
        destination.delete();
      }
    } catch {
      // Ignore file deletion error
    }
  } finally {
    if (activeAutoControllers.get(songId) === controller) {
      activeAutoControllers.delete(songId);
    }
  }
}

export async function clearAllAutoCachedSongs(): Promise<void> {
  // Abort and clear all in-flight auto caching operations
  activeAutoControllers.forEach((controller) => {
    try {
      controller.abort();
    } catch {
      // Ignore abort errors
    }
  });
  activeAutoControllers.clear();

  // Get all auto-cached song IDs before deletion to notify listeners
  let autoSongIds: string[] = [];
  try {
    autoSongIds = getAutoCacheSongIds();
  } catch (error) {
    console.error("failed to get auto-cached song ids:", error);
  }

  // Delete auto-cache directory and its contents
  try {
    const autoCacheDir = new Directory(Paths.document, "auto-cache");
    if (autoCacheDir.exists) {
      autoCacheDir.delete();
    }
  } catch (error) {
    console.error("failed to delete auto cache directory:", error);
  }

  // Delete all auto-cache rows from database
  try {
    deleteAutoSongCacheEntries();
  } catch (error) {
    console.error("failed to delete auto song cache entries from db:", error);
  }

  // Notify listeners that songs were removed from cache
  autoSongIds.forEach((songId) => {
    notifySongCacheUpdated(songId, null);
  });
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

  activeAutoControllers.forEach((controller) => {
    try {
      controller.abort();
    } catch {
      // Ignore abort errors
    }
  });
  activeAutoControllers.clear();

  // Delete manual cache folder and its contents
  try {
    const cacheDir = new Directory(Paths.document, "manual-cache");
    if (cacheDir.exists) {
      cacheDir.delete();
    }
  } catch (error) {
    console.error("failed to delete manual cache directory:", error);
  }

  // Delete auto cache folder and its contents
  try {
    const autoCacheDir = new Directory(Paths.document, "auto-cache");
    if (autoCacheDir.exists) {
      autoCacheDir.delete();
    }
  } catch (error) {
    console.error("failed to delete auto cache directory:", error);
  }
}
