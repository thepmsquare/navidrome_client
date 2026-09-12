import * as DocumentPicker from "expo-document-picker";
import { Directory, File } from "expo-file-system";
import { readAsStringAsync, StorageAccessFramework } from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import {
  createBackupData,
  exportBackupToFile,
  formatExportDate,
  parseProfileData,
  pickProfileFile,
} from "@/services/backup";
import { APP_IDENTIFIER, BACKUP_VERSION } from "@/utils/constants";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
}));

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock("expo-file-system/legacy", () => ({
  readAsStringAsync: jest.fn(),
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn(),
    createFileAsync: jest.fn(),
    writeAsStringAsync: jest.fn(),
  },
}));

const mockFileWrite = jest.fn();
const mockFileText = jest.fn();

jest.mock("expo-file-system", () => ({
  Directory: {
    pickDirectoryAsync: jest.fn(),
  },
  File: jest.fn().mockImplementation(() => ({
    write: mockFileWrite,
    text: mockFileText,
  })),
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

    it("should handle user cancelling the directory picker gracefully on android", async () => {
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

    it("should catch safError with cancel message and return cancelled", async () => {
      Platform.OS = "android";
      (
        StorageAccessFramework.requestDirectoryPermissionsAsync as jest.Mock
      ).mockRejectedValue(new Error("user cancelled picker"));

      const result = await exportBackupToFile();
      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(true);
    });

    it("should export via Directory.pickDirectoryAsync on non-Android platform", async () => {
      Platform.OS = "ios";
      const mockCreatedFile = { write: jest.fn() };
      (Directory.pickDirectoryAsync as jest.Mock).mockResolvedValue({
        createFile: jest.fn(() => mockCreatedFile),
      });

      const result = await exportBackupToFile();
      expect(result.success).toBe(true);
      expect(mockCreatedFile.write).toHaveBeenCalledWith(
        expect.stringContaining('"app_identifier": "navidrome_client_backup"'),
      );
    });

    it("should return error if Directory.pickDirectoryAsync is not available on non-Android", async () => {
      Platform.OS = "ios";
      const origPick = Directory.pickDirectoryAsync;
      (Directory as any).pickDirectoryAsync = undefined;

      const result = await exportBackupToFile();
      expect(result.success).toBe(false);
      expect(result.error).toBe("directory picker not supported on this platform");

      (Directory as any).pickDirectoryAsync = origPick;
    });

    it("should handle error with cancel on non-Android", async () => {
      Platform.OS = "ios";
      (Directory.pickDirectoryAsync as jest.Mock).mockRejectedValue(
        new Error("cancelled by user"),
      );

      const result = await exportBackupToFile();
      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(true);
    });

    it("should handle generic error on non-Android", async () => {
      Platform.OS = "ios";
      (Directory.pickDirectoryAsync as jest.Mock).mockRejectedValue(
        new Error("storage disk full"),
      );

      const result = await exportBackupToFile();
      expect(result.success).toBe(false);
      expect(result.error).toBe("storage disk full");
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

    it("should throw on non-object JSON values like null or primitive", () => {
      expect(() => parseProfileData("null")).toThrow("invalid profile format");
      expect(() => parseProfileData('"just a string"')).toThrow("invalid profile format");
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

  describe("pickProfileFile", () => {
    it("should return null if DocumentPicker was canceled", async () => {
      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
        canceled: true,
      });

      const res = await pickProfileFile();
      expect(res).toBeNull();
    });

    it("should return null if assets array is empty", async () => {
      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [],
      });

      const res = await pickProfileFile();
      expect(res).toBeNull();
    });

    it("should parse file using readAsStringAsync when successful", async () => {
      const sampleProfile = JSON.stringify({
        app_identifier: "navidrome_client_backup",
        server_url: "https://example.com",
        username: "user",
        password: "pwd",
      });

      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: "file:///profile.json" }],
      });
      (readAsStringAsync as jest.Mock).mockResolvedValue(sampleProfile);

      const res = await pickProfileFile();
      expect(res?.server_url).toBe("https://example.com");
      expect(res?.username).toBe("user");
    });

    it("should fallback to File.text() when readAsStringAsync throws", async () => {
      const sampleProfile = JSON.stringify({
        app_identifier: "navidrome_client_backup",
        server_url: "https://fallback.com",
        username: "fallbackUser",
        password: "fallbackPwd",
      });

      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: "file:///fallback.json" }],
      });
      (readAsStringAsync as jest.Mock).mockRejectedValue(new Error("read failed"));
      mockFileText.mockResolvedValue(sampleProfile);

      const res = await pickProfileFile();
      expect(res?.server_url).toBe("https://fallback.com");
      expect(res?.username).toBe("fallbackUser");
    });
  });
});
