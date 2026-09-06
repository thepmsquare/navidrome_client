import { Directory, File, Paths } from "expo-file-system";

import { getSongStreamUrl } from "@/services/api";
import {
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
  entry: SongCacheRow;
}) => void;
const cacheListeners = new Set<SongCacheListener>();

export function subscribeSongCache(listener: SongCacheListener): () => void {
  cacheListeners.add(listener);
  return () => {
    cacheListeners.delete(listener);
  };
}

export function notifySongCacheUpdated(
  songId: string,
  entry: SongCacheRow,
): void {
  cacheListeners.forEach((listener) => {
    try {
      listener({ songId, entry });
    } catch (e) {
      console.error("error in song cache listener:", e);
    }
  });
}

export async function cacheSongManually(songId: string): Promise<void> {
  const song = getSongById(songId);
  if (!song) {
    throw new Error(`song with id ${songId} not found`);
  }

  const suffix = song.suffix || "mp3";
  const streamUrl = await getSongStreamUrl(songId);

  const cacheDir = new Directory(Paths.document, "manual-cache");
  if (!cacheDir.exists) {
    cacheDir.create({ idempotent: true });
  }

  const destination = new File(cacheDir, `${songId}.${suffix}`);
  const downloadedFile = await File.downloadFileAsync(streamUrl, destination, {
    idempotent: true,
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
}
