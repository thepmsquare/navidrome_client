import * as SecureStore from "expo-secure-store";

/**
 * secure store key marking that the one-time legacy migration has finished.
 *
 * it lives in secure store instead of the sqlite database because `logout()`
 * clears the database while the legacy preferences remain on disk. a database
 * flag would be lost on logout and the next launch would silently import the
 * old credentials again.
 */
export const MIGRATION_COMPLETE_KEY = "migration.complete";

/**
 * value stored under {@link MIGRATION_COMPLETE_KEY}. bump it whenever a new
 * migration step is added so installs that completed an older version rerun
 * the idempotent steps; the previous credentials-only build wrote "true".
 */
export const MIGRATION_COMPLETE_VALUE = "2";

/**
 * returns true when the flag cannot be read, so an unreadable flag can never
 * trigger a second import that overwrites credentials set after migration.
 * the next launch retries the read.
 */
export async function isMigrationComplete(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(MIGRATION_COMPLETE_KEY);
    return value === MIGRATION_COMPLETE_VALUE;
  } catch (error) {
    console.error("failed to read migration state:", error);
    return true;
  }
}

/** may reject; callers decide whether a failed flag write is fatal. */
export async function markMigrationComplete(): Promise<void> {
  await SecureStore.setItemAsync(
    MIGRATION_COMPLETE_KEY,
    MIGRATION_COMPLETE_VALUE,
  );
}
