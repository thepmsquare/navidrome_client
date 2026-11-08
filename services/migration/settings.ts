import * as SecureStore from "expo-secure-store";

import { readLegacyPreferencesResult } from "@/modules/legacy-prefs";
import type { LegacyPrefsReadResult } from "@/modules/legacy-prefs";
import {
  setAutoCacheEnabled,
  setAutoCacheMaxBytes,
  setKeepPlayingOnAppDismissed,
} from "@/services/db";
import type { HomeSectionConfig } from "@/types";

export type SettingsMigrationResult =
  | { status: "applied"; applied: string[] }
  | { status: "no-settings" }
  | { status: "skipped"; reason: "logged-out" | "unreadable-prefs" }
  | { status: "failed"; error: unknown };

/**
 * defensively parses the raw `home_sections` json written by the legacy app.
 * invalid entries are dropped; returns null when nothing usable remains.
 */
export function parseHomeSections(
  raw: string | null,
): HomeSectionConfig[] | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const sections = parsed.flatMap((item): HomeSectionConfig[] => {
      if (!item || typeof item !== "object") return [];
      const { id, visible } = item as { id?: unknown; visible?: unknown };
      if (typeof id !== "string" || typeof visible !== "boolean") return [];
      return [{ id, visible }];
    });

    return sections.length > 0 ? sections : null;
  } catch {
    return null;
  }
}

/**
 * imports the legacy settings into the v2 stores. every missing or invalid
 * value is skipped so the current v2 default applies. the caller owns the
 * `migration.complete` flag.
 *
 * mapping:
 * - `auto_save_offline_played`        -> `auto_cache_enabled`
 * - `auto_save_offline_max_bytes`     -> `auto_cache_max_bytes`
 * - `stop_playback_on_task_removed`   -> `keep_playing_on_app_dismissed` (inverted)
 * - `home_sections`                   -> secure store `home_sections`
 * - `auto_save_offline_lru_evict`     -> no v2 setting; v2 always evicts by lru
 *
 * the pre-1.1.0 `auto_download_*` names are resolved by
 * `readLegacyPreferencesResult()`, so callers only see the current names.
 */
export async function migrateLegacySettings(): Promise<SettingsMigrationResult> {
  const readResult: LegacyPrefsReadResult =
    await readLegacyPreferencesResult().catch(
      (error): LegacyPrefsReadResult => {
        console.error("failed to read legacy preferences:", error);
        return { status: "unreadable", errors: [error] };
      },
    );

  if (readResult.status === "unreadable") {
    console.warn(
      "legacy settings are unreadable, keeping v2 defaults:",
      readResult.errors,
    );
    return { status: "skipped", reason: "unreadable-prefs" };
  }

  if (readResult.status !== "ok") {
    return { status: "no-settings" };
  }

  const legacy = readResult.preferences;
  if (legacy.isLoggedIn === false) {
    return { status: "skipped", reason: "logged-out" };
  }

  const homeSections = parseHomeSections(legacy.homeSections);
  const applied: string[] = [];

  try {
    if (legacy.autoSaveOfflinePlayed !== null) {
      setAutoCacheEnabled(legacy.autoSaveOfflinePlayed);
      applied.push("auto_save_offline_played");
    }

    if (
      legacy.autoSaveOfflineMaxBytes !== null &&
      Number.isFinite(legacy.autoSaveOfflineMaxBytes) &&
      legacy.autoSaveOfflineMaxBytes > 0
    ) {
      setAutoCacheMaxBytes(Math.round(legacy.autoSaveOfflineMaxBytes));
      applied.push("auto_save_offline_max_bytes");
    }

    if (legacy.stopPlaybackOnTaskRemoved !== null) {
      setKeepPlayingOnAppDismissed(!legacy.stopPlaybackOnTaskRemoved);
      await SecureStore.setItemAsync(
        "stop_playback_on_task_removed",
        String(legacy.stopPlaybackOnTaskRemoved),
      );
      applied.push("stop_playback_on_task_removed");
    }

    if (homeSections) {
      await SecureStore.setItemAsync(
        "home_sections",
        JSON.stringify(homeSections),
      );
      applied.push("home_sections");
    }
  } catch (error) {
    console.error("failed to migrate legacy settings:", error);
    return { status: "failed", error };
  }

  if (applied.length === 0) {
    return { status: "no-settings" };
  }

  return { status: "applied", applied };
}
