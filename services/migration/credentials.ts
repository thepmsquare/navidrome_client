import * as SecureStore from "expo-secure-store";

import { readLegacyPreferencesResult } from "@/modules/legacy-prefs";
import type { LegacyPrefsReadResult } from "@/modules/legacy-prefs";
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
  | { status: "no-legacy-data" }
  | { status: "skipped"; reason: "logged-out" | "incomplete-credentials" | "unreadable-prefs" }
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

/**
 * one-time import of the credentials written by the legacy flutter app into
 * secure store. the caller is responsible for the `migration.complete` flag so
 * settings can be imported in the same run.
 *
 * every failure is logged and reported instead of thrown so startup can fall
 * back to the connect screen. partial writes are safe: a retry overwrites them
 * with the same values.
 */
export async function migrateLegacyCredentials(): Promise<CredentialMigrationResult> {
  // an unexpected throw (or a corrupt preference file) must not crash startup
  // or retry forever. log it, leave the legacy store untouched, and let the
  // session restore fall back to the connect screen.
  const readResult: LegacyPrefsReadResult =
    await readLegacyPreferencesResult().catch(
      (error): LegacyPrefsReadResult => {
        console.error("failed to read legacy preferences:", error);
        return { status: "unreadable", errors: [error] };
      },
    );

  if (readResult.status === "unreadable") {
    console.warn(
      "legacy credentials are unreadable, falling back to connect:",
      readResult.errors,
    );
    return { status: "skipped", reason: "unreadable-prefs" };
  }

  if (readResult.status !== "ok") {
    return { status: "no-legacy-data" };
  }

  const legacy = readResult.preferences;

  // the legacy app clears its preferences on logout, so this only guards
  // against a file that survived a partial logout.
  if (legacy.isLoggedIn === false) {
    return { status: "skipped", reason: "logged-out" };
  }

  const serverUrl = normalizeServerUrl(legacy.serverUrl);
  const username = legacy.username?.trim();
  const password = legacy.password?.trim();

  if (!serverUrl || !username || !password) {
    return { status: "skipped", reason: "incomplete-credentials" };
  }

  const serverUrls = buildServerUrls(serverUrl, legacy.alternateServerUrls);

  try {
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

  return {
    status: "migrated",
    serverUrl,
    alternateUrlCount: serverUrls.length - 1,
  };
}
