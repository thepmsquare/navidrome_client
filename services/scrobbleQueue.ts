import { scrobble } from "@/services/api";
import {
  getPendingScrobbles,
  incrementPendingScrobbleAttempts,
  removePendingScrobble,
} from "@/services/db";

let isSyncing = false;

export async function syncPendingScrobbles(): Promise<{
  synced: number;
  failed: number;
}> {
  if (isSyncing) {
    return { synced: 0, failed: 0 };
  }

  isSyncing = true;
  let synced = 0;
  let failed = 0;

  try {
    const pending = getPendingScrobbles();
    for (const item of pending) {
      try {
        await scrobble({
          id: item.songId,
          submission: true,
          time: item.timestamp,
        });
        removePendingScrobble(item.id);
        synced++;
      } catch (err) {
        console.error(`failed to sync pending scrobble for ${item.songId}:`, err);
        incrementPendingScrobbleAttempts(item.id);
        failed++;
      }
    }
  } finally {
    isSyncing = false;
  }

  return { synced, failed };
}
