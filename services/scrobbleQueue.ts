import { scrobble } from "@/services/api";
import {
  clearPendingScrobbles as clearPendingScrobblesDb,
  getPendingScrobbles,
  incrementPendingScrobbleAttempts,
  removePendingScrobble as removePendingScrobbleDb,
} from "@/services/db";

let isSyncing = false;
type QueueListener = () => void;
const listeners = new Set<QueueListener>();

export function subscribeScrobbleQueue(listener: QueueListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyScrobbleQueueChanged(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (err) {
      console.error("error in scrobble queue listener:", err);
    }
  }
}

export function isScrobbleSyncInProgress(): boolean {
  return isSyncing;
}

export function deletePendingScrobble(id: number): void {
  removePendingScrobbleDb(id);
  notifyScrobbleQueueChanged();
}

export function clearAllPendingScrobbles(): void {
  clearPendingScrobblesDb();
  notifyScrobbleQueueChanged();
}

export async function syncSinglePendingScrobble(id: number): Promise<boolean> {
  if (isSyncing) {
    return false;
  }

  const pending = getPendingScrobbles();
  const item = pending.find((p) => p.id === id);
  if (!item) {
    return false;
  }

  try {
    await scrobble({
      id: item.songId,
      submission: true,
      time: item.timestamp,
    });
    removePendingScrobbleDb(item.id);
    notifyScrobbleQueueChanged();
    return true;
  } catch (err) {
    console.error(`failed to sync pending scrobble for ${item.songId}:`, err);
    incrementPendingScrobbleAttempts(item.id);
    notifyScrobbleQueueChanged();
    return false;
  }
}

export async function syncPendingScrobbles(): Promise<{
  synced: number;
  failed: number;
}> {
  if (isSyncing) {
    return { synced: 0, failed: 0 };
  }

  isSyncing = true;
  notifyScrobbleQueueChanged();
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
        removePendingScrobbleDb(item.id);
        synced++;
        notifyScrobbleQueueChanged();
      } catch (err) {
        console.error(`failed to sync pending scrobble for ${item.songId}:`, err);
        incrementPendingScrobbleAttempts(item.id);
        failed++;
        notifyScrobbleQueueChanged();
      }
    }
  } finally {
    isSyncing = false;
    notifyScrobbleQueueChanged();
  }

  return { synced, failed };
}
