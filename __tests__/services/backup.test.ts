import { StorageAccessFramework } from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import {
  createBackupData,
  exportBackupToFile,
  formatExportDate,
  parseProfileData,
} from "@/services/backup";
import { APP_IDENTIFIER, BACKUP_VERSION } from "@/utils/constants";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
}));

jest.mock("expo-file-system/legacy", () => ({
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn(),
    createFileAsync: jest.fn(),
    writeAsStringAsync: jest.fn(),
  },
}));

jest.mock("expo-file-system", () => ({
  Directory: {
    pickDirectoryAsync: jest.fn(),
  },
}));

describe("backup service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("formatExportDate", () => {
    it("should format date matching YYYY-MM-DDTHH:mm:ss.ssssss without Z", () => {
      const fixedDate = new Date("2026-06-27T16:22:38.368Z");
      const formatted = formatExportDate(fixedDate);
      expect(formatted).toBe("2026-06-27T16:22:38.368000");
    });
  });

  describe("createBackupData", () => {
    it("should retrieve credentials from SecureStore and construct backup JSON structure", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation(
        async (key: string) => {
          if (key === "serverUrl") return "https://music.example.com";
          if (key === "username") return "actual username";
          if (key === "password") return "actual_password";
          return null;
        },
      );

      const backup = await createBackupData();

      expect(backup).toEqual({
        app_identifier: APP_IDENTIFIER,
        server_url: "https://music.example.com",
        username: "actual username",
        password: "actual_password",
        export_date: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/,
        ),
        version: BACKUP_VERSION,
      });
      expect(backup.app_identifier).toBe("navidrome_client_backup");
      expect(backup.version).toBe(1);
    });

    it("should default missing credentials to empty strings", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const backup = await createBackupData();

      expect(backup.server_url).toBe("");
      expect(backup.username).toBe("");
      expect(backup.password).toBe("");
    });
  });

  describe("exportBackupToFile", () => {
    it("should export via StorageAccessFramework on Android when permission is granted", async () => {
      Platform.OS = "android";
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("test");
      (
        StorageAccessFramework.requestDirectoryPermissionsAsync as jest.Mock
      ).mockResolvedValue({
        granted: true,
        directoryUri: "content://tree/primary",
      });
      (StorageAccessFramework.createFileAsync as jest.Mock).mockResolvedValue(
        "content://tree/primary/document/navidrome_client_backup.json",
      );

      const result = await exportBackupToFile();

      expect(result.success).toBe(true);
      expect(
        StorageAccessFramework.requestDirectoryPermissionsAsync,
      ).toHaveBeenCalledTimes(1);
      expect(StorageAccessFramework.createFileAsync).toHaveBeenCalledWith(
        "content://tree/primary",
        "navidrome_client_backup",
        "application/json",
      );
      expect(StorageAccessFramework.writeAsStringAsync).toHaveBeenCalledWith(
        "content://tree/primary/document/navidrome_client_backup.json",
        expect.stringContaining('"app_identifier": "navidrome_client_backup"'),
      );
    });

    it("should handle user cancelling the directory picker gracefully", async () => {
      Platform.OS = "android";
      (
        StorageAccessFramework.requestDirectoryPermissionsAsync as jest.Mock
      ).mockResolvedValue({
        granted: false,
      });

      const result = await exportBackupToFile();

      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(true);
    });
  });

  describe("parseProfileData", () => {
    it("should successfully parse valid profile JSON matching user format", () => {
      const sampleJson = JSON.stringify({
        app_identifier: "navidrome_client_backup",
        server_url: "https://songs.thepmsquare.com",
        username: "thepmsquare",
        password: "Imhphdnri!1",
        stop_playback_on_task_removed: true,
        home_sections: [
          { id: "most_played", visible: true },
          { id: "random_tracks", visible: true },
          { id: "recently_played", visible: true },
          { id: "random_albums", visible: false },
          { id: "newly_added_releases", visible: false },
          { id: "recently_released", visible: false },
        ],
        export_date: "2026-06-27T16:22:38.368390",
        version: 1,
      });

      const parsed = parseProfileData(sampleJson);

      expect(parsed.app_identifier).toBe("navidrome_client_backup");
      expect(parsed.server_url).toBe("https://songs.thepmsquare.com");
      expect(parsed.username).toBe("thepmsquare");
      expect(parsed.password).toBe("Imhphdnri!1");
      expect(parsed.stop_playback_on_task_removed).toBe(true);
      expect(parsed.home_sections).toHaveLength(6);
      expect(parsed.home_sections?.[0]).toEqual({
        id: "most_played",
        visible: true,
      });
      expect(parsed.version).toBe(1);
    });

    it("should throw on invalid JSON", () => {
      expect(() => parseProfileData("invalid json")).toThrow("invalid json format");
    });

    it("should throw on invalid app identifier", () => {
      const wrongIdentifier = JSON.stringify({
        app_identifier: "wrong_app",
        server_url: "https://example.com",
        username: "u",
        password: "p",
      });
      expect(() => parseProfileData(wrongIdentifier)).toThrow(
        "invalid backup file identifier",
      );
    });

    it("should throw on missing credentials", () => {
      const missingCredentials = JSON.stringify({
        app_identifier: "navidrome_client_backup",
        server_url: "https://example.com",
      });
      expect(() => parseProfileData(missingCredentials)).toThrow(
        "missing required server credentials in profile",
      );
    });
  });
});
