import * as SecureStore from "expo-secure-store";

import { readLegacyPreferences } from "@/modules/legacy-prefs";
import type { LegacyPreferences } from "@/modules/legacy-prefs";
import {
  isMigrationComplete,
  markMigrationComplete,
} from "@/services/migration/state";
import type { ServerUrlItem } from "@/types";

/**
 * subsonic api version sent by the legacy flutter app
 * (`lib/services/api_service.dart`). using the same constant keeps
 * `checkToken()` working offline on the first launch after the upgrade; a
 * later connect refreshes it with the version reported by the server.
 */
export const LEGACY_SUBSONIC_VERSION = "1.16.1";

const PRIMARY_URL_LABEL = "server url";

export type CredentialMigrationResult =
  | { status: "migrated"; serverUrl: string; alternateUrlCount: number }
  | { status: "already-complete" }
  | { status: "no-legacy-data" }
  | { status: "skipped"; reason: "logged-out" | "incomplete-credentials" }
  | { status: "failed"; error: unknown };

/**
 * normalizes a legacy server url the same way the connect screen does: trim,
 * default to https, and drop trailing slashes. returns null for blank or
 * scheme-only values.
 */
export function normalizeServerUrl(raw: string | null): string | null {
  if (!raw) return null;

  let url = raw.trim();
  if (!url) return null;

  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  url = url.replace(/\/+$/, "");
  if (url === "https:" || url === "http:") return null;

  return url;
}

function buildServerUrls(
  primaryUrl: string,
  alternateUrls: string[],
): ServerUrlItem[] {
  const serverUrls: ServerUrlItem[] = [
    { url: primaryUrl, label: PRIMARY_URL_LABEL },
  ];

  alternateUrls.forEach((raw, index) => {
    const url = normalizeServerUrl(raw);
    if (!url || serverUrls.some((item) => item.url === url)) return;

    serverUrls.push({ url, label: `alternative url ${index + 1}` });
  });

  return serverUrls;
}

async function markComplete(
  result: CredentialMigrationResult,
): Promise<CredentialMigrationResult> {
  try {
    await markMigrationComplete();
    return result;
  } catch (error) {
    console.error("failed to mark legacy migration complete:", error);
    return { status: "failed", error };
  }
}

/**
 * one-time import of the credentials written by the legacy flutter app into
 * secure store, followed by the migration flag.
 *
 * every failure is logged and reported instead of thrown so startup can fall
 * back to the connect screen. partial writes are safe: a retry overwrites them
 * with the same values.
 */
export async function migrateLegacyCredentials(): Promise<CredentialMigrationResult> {
  if (await isMigrationComplete()) {
    return { status: "already-complete" };
  }

  let legacy: LegacyPreferences | null = null;
  try {
    legacy = await readLegacyPreferences();
  } catch (error) {
    console.error("failed to read legacy preferences:", error);
    return { status: "failed", error };
  }

  if (!legacy) {
    return markComplete({ status: "no-legacy-data" });
  }

  // the legacy app clears its preferences on logout, so this only guards
  // against a file that survived a partial logout.
  if (legacy.isLoggedIn === false) {
    return markComplete({ status: "skipped", reason: "logged-out" });
  }

  const serverUrl = normalizeServerUrl(legacy.serverUrl);
  const username = legacy.username?.trim();
  const password = legacy.password?.trim();

  if (!serverUrl || !username || !password) {
    return markComplete({ status: "skipped", reason: "incomplete-credentials" });
  }

  const serverUrls = buildServerUrls(serverUrl, legacy.alternateServerUrls);

  try {
    // order matters: credentials first, flag last.
    await SecureStore.setItemAsync("subsonicVersion", LEGACY_SUBSONIC_VERSION);
    await SecureStore.setItemAsync("serverUrl", serverUrl);
    await SecureStore.setItemAsync("serverUrlLabel", PRIMARY_URL_LABEL);
    await SecureStore.setItemAsync("serverUrls", JSON.stringify(serverUrls));
    await SecureStore.setItemAsync("username", username);
    await SecureStore.setItemAsync("password", password);
  } catch (error) {
    console.error("failed to migrate legacy credentials:", error);
    return { status: "failed", error };
  }

  return markComplete({
    status: "migrated",
    serverUrl,
    alternateUrlCount: serverUrls.length - 1,
  });
}
