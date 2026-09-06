import { Directory, File, Paths } from "expo-file-system";

import { getSongStreamUrl } from "@/services/api";
import { getSongById, upsertSongCacheEntry } from "@/services/db";
import { SongCacheType } from "@/types";

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
}
