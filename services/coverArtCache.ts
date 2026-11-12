import { Directory, File, Paths } from "expo-file-system";

import { getSongById } from "@/services/db";

export function getCoverCacheDirectory(): Directory {
  return new Directory(Paths.document, "cover-cache");
}

export function getCoverFileName(coverArtId: string): string {
  const safeId = encodeURIComponent(coverArtId).replace(/[%*?:|"<>\/\\]/g, "_");
  return `${safeId}.jpg`;
}

export function getCachedCoverArtUri(
  coverArtId?: string | null,
): string | null {
  if (!coverArtId) {
    return null;
  }

  try {
    const coverDir = getCoverCacheDirectory();
    const fileName = getCoverFileName(coverArtId);
    const file = new File(coverDir, fileName);
    if (file.exists) {
      return file.uri;
    }

    // If not found by direct id, check if id is a songId with a coverArt field
    const song = getSongById(coverArtId);
    if (song?.coverArt && song.coverArt !== coverArtId) {
      const songCoverFile = new File(coverDir, getCoverFileName(song.coverArt));
      if (songCoverFile.exists) {
        return songCoverFile.uri;
      }
    }
  } catch {
    // Return null if filesystem check fails or error occurs
  }

  return null;
}

export function isCoverArtCached(coverArtId?: string | null): boolean {
  return getCachedCoverArtUri(coverArtId) !== null;
}

export async function saveCoverArt(
  coverArtId: string,
  downloadUrl: string,
  signal?: AbortSignal,
): Promise<string | null> {
  if (!coverArtId || !downloadUrl) {
    return null;
  }

  const coverDir = getCoverCacheDirectory();
  if (!coverDir.exists) {
    coverDir.create({ idempotent: true });
  }

  const destination = new File(coverDir, getCoverFileName(coverArtId));
  if (destination.exists) {
    return destination.uri;
  }

  try {
    const downloadedFile = await File.downloadFileAsync(
      downloadUrl,
      destination,
      {
        idempotent: true,
        signal,
      },
    );
    return downloadedFile.uri || destination.uri;
  } catch (error) {
    try {
      if (destination.exists) {
        destination.delete();
      }
    } catch {
      // Ignore deletion error
    }
    return null;
  }
}

export function deleteCachedCoverArt(coverArtId: string): void {
  if (!coverArtId) return;
  try {
    const coverDir = getCoverCacheDirectory();
    const file = new File(coverDir, getCoverFileName(coverArtId));
    if (file.exists) {
      file.delete();
    }
  } catch (e) {
    console.error("failed to delete cached cover art:", e);
  }
}

export function clearAllCachedCoverArt(): void {
  try {
    const coverDir = getCoverCacheDirectory();
    if (coverDir.exists) {
      coverDir.delete();
    }
  } catch (e) {
    console.error("failed to clear cover art cache directory:", e);
  }
}

