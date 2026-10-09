import * as DocumentPicker from "expo-document-picker";
import { Directory, File } from "expo-file-system";
import { readAsStringAsync, StorageAccessFramework } from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { HOME_SECTIONS } from "@/components/home";
import {
  getAutoCacheEnabled,
  getAutoCacheMaxBytes,
  getKeepPlayingOnAppDismissed,
  getScrobbleMinDuration,
  getScrobbleMinPercent,
} from "@/services/db";
import { getLyricsMode } from "@/services/lyrics";
import { BackupData, BackupSettings, HomeSectionConfig } from "@/types";
import { APP_IDENTIFIER, BACKUP_VERSION } from "@/utils/constants";

export interface ExportResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
}

export function formatExportDate(date: Date = new Date()): string {
  const iso = date.toISOString();
  return iso.replace("Z", "") + "000";
}

export async function createBackupData(): Promise<BackupData> {
  const serverUrl = await SecureStore.getItemAsync("serverUrl");
  const username = await SecureStore.getItemAsync("username");
  const password = await SecureStore.getItemAsync("password");
  const stopPlaybackStr = await SecureStore.getItemAsync(
    "stop_playback_on_task_removed",
  );
  const homeSectionsStr = await SecureStore.getItemAsync("home_sections");

  const keepPlaying = getKeepPlayingOnAppDismissed();
  const stopPlayback =
    stopPlaybackStr !== null ? stopPlaybackStr === "true" : !keepPlaying;

  let homeSections: HomeSectionConfig[] | undefined;
  if (homeSectionsStr) {
    try {
      const parsed = JSON.parse(homeSectionsStr);
      if (Array.isArray(parsed)) {
        homeSections = parsed;
      }
    } catch {
      // ignore json error
    }
  }
  if (!homeSections) {
    homeSections = HOME_SECTIONS.map((section) => ({
      id: section.id,
      visible: true,
    }));
  }

  return {
    app_identifier: APP_IDENTIFIER,
    server_url: serverUrl ?? "",
    username: username ?? "",
    password: password ?? "",
    settings: {
      auto_cache_enabled: getAutoCacheEnabled(),
      auto_cache_max_bytes: getAutoCacheMaxBytes(),
      scrobble_min_duration: getScrobbleMinDuration(),
      scrobble_min_percent: getScrobbleMinPercent(),
      keep_playing_on_app_dismissed: keepPlaying,
      lyrics_mode: getLyricsMode(),
    },
    stop_playback_on_task_removed: stopPlayback,
    home_sections: homeSections,
    export_date: formatExportDate(),
    version: BACKUP_VERSION,
  };
}

export async function exportBackupToFile(): Promise<ExportResult> {
  try {
    const backupData = await createBackupData();
    const jsonString = JSON.stringify(backupData, null, 2);

    if (Platform.OS === "android") {
      try {
        const permissions =
          await StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permissions.granted) {
          return { success: false, cancelled: true };
        }

        const fileUri = await StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          APP_IDENTIFIER,
          "application/json",
        );
        await StorageAccessFramework.writeAsStringAsync(fileUri, jsonString);
        return { success: true };
      } catch (safError: any) {
        const msg = safError?.message?.toLowerCase() || "";
        if (msg.includes("cancel")) {
          return { success: false, cancelled: true };
        }
      }
    }

    if (Directory?.pickDirectoryAsync) {
      const directory = await Directory.pickDirectoryAsync();
      const file = directory.createFile(
        `${APP_IDENTIFIER}.json`,
        "application/json",
      );
      file.write(jsonString);
      return { success: true };
    }

    return {
      success: false,
      error: "directory picker not supported on this platform",
    };
  } catch (error: any) {
    const msg = error?.message?.toLowerCase() || "";
    if (msg.includes("cancel")) {
      return { success: false, cancelled: true };
    }
    console.error("failed to export backup:", error);
    return {
      success: false,
      error: error?.message || "export failed",
    };
  }
}

export function parseProfileData(jsonString: string): BackupData {
  let data: any;
  try {
    data = JSON.parse(jsonString);
  } catch {
    throw new Error("invalid json format");
  }

  if (!data || typeof data !== "object") {
    throw new Error("invalid profile format");
  }

  if (data.app_identifier !== APP_IDENTIFIER) {
    throw new Error("invalid backup file identifier");
  }

  const server_url = data.server_url || data.serverUrl;
  const username = data.username;
  const password = data.password;

  if (!server_url || !username || !password) {
    throw new Error("missing required server credentials in profile");
  }

  let settings: BackupSettings | undefined;
  if (data.settings && typeof data.settings === "object") {
    settings = {
      auto_cache_enabled:
        typeof data.settings.auto_cache_enabled === "boolean"
          ? data.settings.auto_cache_enabled
          : undefined,
      auto_cache_max_bytes:
        typeof data.settings.auto_cache_max_bytes === "number"
          ? data.settings.auto_cache_max_bytes
          : undefined,
      scrobble_min_duration:
        typeof data.settings.scrobble_min_duration === "number"
          ? data.settings.scrobble_min_duration
          : undefined,
      scrobble_min_percent:
        typeof data.settings.scrobble_min_percent === "number"
          ? data.settings.scrobble_min_percent
          : undefined,
      keep_playing_on_app_dismissed:
        typeof data.settings.keep_playing_on_app_dismissed === "boolean"
          ? data.settings.keep_playing_on_app_dismissed
          : undefined,
      lyrics_mode:
        data.settings.lyrics_mode === "file_only" ||
        data.settings.lyrics_mode === "file_first" ||
        data.settings.lyrics_mode === "online_first"
          ? data.settings.lyrics_mode
          : undefined,
    };
  }

  return {
    app_identifier: data.app_identifier,
    server_url,
    username,
    password,
    settings,
    stop_playback_on_task_removed: data.stop_playback_on_task_removed,
    home_sections: Array.isArray(data.home_sections)
      ? data.home_sections
      : undefined,
    export_date: data.export_date || "",
    version: typeof data.version === "number" ? data.version : BACKUP_VERSION,
  };
}

export async function pickProfileFile(): Promise<BackupData | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/json", "*/*"],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  let content = "";
  try {
    content = await readAsStringAsync(asset.uri);
  } catch {
    const file = new File(asset.uri);
    content = await file.text();
  }

  return parseProfileData(content);
}

