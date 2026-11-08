import { Directory, File, Paths } from "expo-file-system";

export interface LegacyCacheInfo {
  exists: boolean;
  sizeBytes: number;
  uri: string | null;
}

/**
 * returns the directory where the legacy flutter app stored downloaded tracks,
 * covers, lyrics, and metadata (`<app_dir>/app_flutter/offline`).
 */
export function getLegacyOfflineDirectory(): Directory | null {
  try {
    const parent = Paths.document?.parentDirectory;
    if (parent) {
      return new Directory(parent, "app_flutter", "offline");
    }
  } catch (e) {
    console.warn("failed to resolve legacy offline directory:", e);
  }
  return null;
}

/**
 * recursively calculates total size of a directory in bytes.
 */
export function calculateDirectorySizeBytes(dir: Directory): number {
  let total = 0;
  try {
    if (!dir.exists) return 0;
    const items = dir.list();
    for (const item of items) {
      if (
        item instanceof Directory ||
        typeof (item as any).list === "function"
      ) {
        total += calculateDirectorySizeBytes(item as Directory);
      } else {
        total += (item as File).size ?? 0;
      }
    }
  } catch (e) {
    console.error("failed to calculate directory size:", e);
  }
  return total;
}

/**
 * formats bytes into human readable size string using lowercase units.
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 b";
  const k = 1024;
  const sizes = ["b", "kb", "mb", "gb", "tb"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * inspects the filesystem for orphaned legacy flutter offline downloads.
 */
export async function checkLegacyOfflineCache(
  customDir?: Directory | null,
): Promise<LegacyCacheInfo> {
  const dir = customDir !== undefined ? customDir : getLegacyOfflineDirectory();
  if (!dir) {
    return { exists: false, sizeBytes: 0, uri: null };
  }

  try {
    if (!dir.exists) {
      return { exists: false, sizeBytes: 0, uri: dir.uri };
    }
    const sizeBytes = calculateDirectorySizeBytes(dir);
    return {
      exists: sizeBytes > 0,
      sizeBytes,
      uri: dir.uri,
    };
  } catch (e) {
    console.error("failed to check legacy offline cache:", e);
    return { exists: false, sizeBytes: 0, uri: dir.uri };
  }
}

/**
 * deletes the legacy offline downloads directory and its contents to reclaim disk space.
 */
export async function deleteLegacyOfflineCache(
  customDir?: Directory | null,
): Promise<{ success: boolean; error?: unknown }> {
  const dir = customDir !== undefined ? customDir : getLegacyOfflineDirectory();
  if (!dir) {
    return { success: true };
  }

  try {
    if (dir.exists) {
      dir.delete();
    }
    return { success: true };
  } catch (error) {
    console.error("failed to delete legacy offline cache:", error);
    return { success: false, error };
  }
}
