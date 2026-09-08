import * as DocumentPicker from "expo-document-picker";
import { Directory, File } from "expo-file-system";
import { readAsStringAsync, StorageAccessFramework } from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { BackupData } from "@/types";
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

  return {
    app_identifier: APP_IDENTIFIER,
    server_url: serverUrl ?? "",
    username: username ?? "",
    password: password ?? "",
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
          "navidrome_client_backup",
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
        "navidrome_client_backup.json",
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

  return {
    app_identifier: data.app_identifier,
    server_url,
    username,
    password,
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

