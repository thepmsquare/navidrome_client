import { Alert, PermissionsAndroid, Platform } from "react-native";

import { getSyncMeta, setSyncMeta } from "@/services/db";

const NOTIF_PERMISSION_PROMPTED_KEY = "notif_permission_prompted";

export async function isNotificationPermissionGranted(): Promise<boolean> {
  if (
    Platform.OS === "android" &&
    typeof Platform.Version === "number" &&
    Platform.Version >= 33
  ) {
    try {
      const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
      if (!permission) return true;
      return await PermissionsAndroid.check(permission);
    } catch {
      return false;
    }
  }
  return true;
}

export function hasPromptedNotificationPermission(): boolean {
  try {
    return getSyncMeta(NOTIF_PERMISSION_PROMPTED_KEY) === "true";
  } catch {
    return false;
  }
}

export function markPromptedNotificationPermission(): void {
  try {
    setSyncMeta(NOTIF_PERMISSION_PROMPTED_KEY, "true");
  } catch {
    // ignore
  }
}

export async function requestDownloadNotificationPermission(): Promise<boolean> {
  if (
    Platform.OS !== "android" ||
    typeof Platform.Version !== "number" ||
    Platform.Version < 33
  ) {
    return true;
  }

  const alreadyGranted = await isNotificationPermissionGranted();
  if (alreadyGranted) {
    return true;
  }

  if (hasPromptedNotificationPermission()) {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    markPromptedNotificationPermission();
    Alert.alert(
      "enable notifications",
      "enable notifications to track background download progress and offline scrobble sync.",
      [
        {
          text: "deny",
          style: "cancel",
          onPress: () => {
            resolve(false);
          },
        },
        {
          text: "allow",
          onPress: async () => {
            try {
              const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
              if (!permission) {
                resolve(true);
                return;
              }
              const result = await PermissionsAndroid.request(permission);
              resolve(result === PermissionsAndroid.RESULTS.GRANTED);
            } catch (err) {
              console.warn("failed to request post_notifications permission:", err);
              resolve(false);
            }
          },
        },
      ],
      { cancelable: false },
    );
  });
}
