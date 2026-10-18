import { Alert, PermissionsAndroid, Platform } from "react-native";

import { getSyncMeta, setSyncMeta } from "@/services/db";
import {
  hasPromptedNotificationPermission,
  isNotificationPermissionGranted,
  markPromptedNotificationPermission,
  requestDownloadNotificationPermission,
} from "@/services/permissions";

jest.mock("@/services/db", () => ({
  getSyncMeta: jest.fn(),
  setSyncMeta: jest.fn(),
}));

describe("services/permissions", () => {
  const originalOS = Platform.OS;
  const originalVersionDesc = Object.getOwnPropertyDescriptor(
    Platform,
    "Version",
  );

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = originalOS;
    if (originalVersionDesc) {
      Object.defineProperty(Platform, "Version", originalVersionDesc);
    }
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  afterAll(() => {
    Platform.OS = originalOS;
    if (originalVersionDesc) {
      Object.defineProperty(Platform, "Version", originalVersionDesc);
    }
  });

  describe("isNotificationPermissionGranted", () => {
    it("returns true on non-Android platforms", async () => {
      Platform.OS = "ios";
      const result = await isNotificationPermissionGranted();
      expect(result).toBe(true);
    });

    it("returns true on Android API < 33", async () => {
      Platform.OS = "android";
      Object.defineProperty(Platform, "Version", {
        value: 30,
        configurable: true,
        writable: true,
      });
      const result = await isNotificationPermissionGranted();
      expect(result).toBe(true);
    });

    it("checks permission on Android API >= 33", async () => {
      Platform.OS = "android";
      Object.defineProperty(Platform, "Version", {
        value: 33,
        configurable: true,
        writable: true,
      });
      jest
        .spyOn(PermissionsAndroid, "check")
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      expect(await isNotificationPermissionGranted()).toBe(true);
      expect(await isNotificationPermissionGranted()).toBe(false);
    });
  });

  describe("hasPromptedNotificationPermission and markPromptedNotificationPermission", () => {
    it("reads and marks sync meta state", () => {
      (getSyncMeta as jest.Mock).mockReturnValue("true");
      expect(hasPromptedNotificationPermission()).toBe(true);

      markPromptedNotificationPermission();
      expect(setSyncMeta).toHaveBeenCalledWith(
        "notif_permission_prompted",
        "true",
      );
    });
  });

  describe("requestDownloadNotificationPermission", () => {
    it("returns true immediately on non-Android or API < 33", async () => {
      Platform.OS = "ios";
      expect(await requestDownloadNotificationPermission()).toBe(true);

      Platform.OS = "android";
      Object.defineProperty(Platform, "Version", {
        value: 30,
        configurable: true,
        writable: true,
      });
      expect(await requestDownloadNotificationPermission()).toBe(true);
    });

    it("returns true if already granted on Android API >= 33", async () => {
      Platform.OS = "android";
      Object.defineProperty(Platform, "Version", {
        value: 33,
        configurable: true,
        writable: true,
      });
      jest.spyOn(PermissionsAndroid, "check").mockResolvedValueOnce(true);

      const result = await requestDownloadNotificationPermission();
      expect(result).toBe(true);
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it("returns false without prompt if already prompted before", async () => {
      Platform.OS = "android";
      Object.defineProperty(Platform, "Version", {
        value: 33,
        configurable: true,
        writable: true,
      });
      jest.spyOn(PermissionsAndroid, "check").mockResolvedValueOnce(false);
      (getSyncMeta as jest.Mock).mockReturnValue("true");

      const result = await requestDownloadNotificationPermission();
      expect(result).toBe(false);
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it("displays rationale and handles deny", async () => {
      Platform.OS = "android";
      Object.defineProperty(Platform, "Version", {
        value: 33,
        configurable: true,
        writable: true,
      });
      jest.spyOn(PermissionsAndroid, "check").mockResolvedValueOnce(false);
      (getSyncMeta as jest.Mock).mockReturnValue("false");

      const promise = requestDownloadNotificationPermission();
      await new Promise<void>((resolve) => setImmediate(() => resolve()));

      expect(Alert.alert).toHaveBeenCalledWith(
        "enable notifications",
        "enable notifications to track background download progress and offline scrobble sync.",
        expect.any(Array),
        { cancelable: false },
      );

      const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const denyBtn = alertButtons.find((b: any) => b.text === "deny");
      denyBtn.onPress();

      const result = await promise;
      expect(result).toBe(false);
      expect(setSyncMeta).toHaveBeenCalledWith(
        "notif_permission_prompted",
        "true",
      );
    });

    it("displays rationale and handles allow with granted response", async () => {
      Platform.OS = "android";
      Object.defineProperty(Platform, "Version", {
        value: 33,
        configurable: true,
        writable: true,
      });
      jest.spyOn(PermissionsAndroid, "check").mockResolvedValueOnce(false);
      jest
        .spyOn(PermissionsAndroid, "request")
        .mockResolvedValueOnce(PermissionsAndroid.RESULTS.GRANTED as any);
      (getSyncMeta as jest.Mock).mockReturnValue("false");

      const promise = requestDownloadNotificationPermission();
      await new Promise<void>((resolve) => setImmediate(() => resolve()));

      const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const allowBtn = alertButtons.find((b: any) => b.text === "allow");
      await allowBtn.onPress();

      const result = await promise;
      expect(result).toBe(true);
    });
  });
});
