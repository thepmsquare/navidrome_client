import * as SecureStore from "expo-secure-store";

import { notifyAuthState } from "@/services/api";
import { clearDatabase } from "@/services/db";
import { resetPlayer } from "@/services/player";
import { clearAllCachedSongs } from "@/services/songCache";

export async function logout(): Promise<void> {
  // 1. Stop audio playback and reset in-memory player state
  try {
    await resetPlayer();
  } catch (error) {
    console.error("failed to reset player on logout:", error);
  }

  // 2. Cancel in-flight caching operations and delete cached songs on disk
  try {
    await clearAllCachedSongs();
  } catch (error) {
    console.error("failed to clear song cache on logout:", error);
  }

  // 3. Clear SQLite database tables
  try {
    clearDatabase();
  } catch (error) {
    console.error("failed to clear database on logout:", error);
  }

  // 4. Delete all auth credentials & stored preferences in parallel
  const keysToDelete = [
    "subsonicVersion",
    "serverUrl",
    "username",
    "password",
    "stop_playback_on_task_removed",
    "home_sections",
  ];
  await Promise.allSettled(
    keysToDelete.map((key) => SecureStore.deleteItemAsync(key)),
  );

  // 5. Notify auth state listeners
  notifyAuthState(false);
}
