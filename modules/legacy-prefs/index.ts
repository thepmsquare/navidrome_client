import { NativeModule, requireNativeModule } from "expo";

/**
 * file used by flutter's `shared_preferences` plugin, where the legacy app
 * actually wrote its credentials and settings.
 */
export const LEGACY_FLUTTER_PREFS_FILE = "FlutterSharedPreferences";

/**
 * default android shared preferences file (`<applicationId>_preferences`),
 * checked as a fallback in case legacy keys were ever mirrored there.
 */
export const LEGACY_DEFAULT_PREFS_FILE =
  "com.thepmsquare.navidrome_client_preferences";

/**
 * prefixed preference names written by the legacy flutter app
 * (`lib/services/auth_service.dart` + `lib/services/session_service.dart`).
 * keys keep the `flutter.` prefix that `shared_preferences` adds on android.
 */
export const LEGACY_PREF_KEYS = {
  serverUrl: "flutter.server_url",
  alternateServerUrls: "flutter.alternate_server_urls",
  username: "flutter.username",
  password: "flutter.password",
  isLoggedIn: "flutter.is_logged_in",
  stopPlaybackOnTaskRemoved: "flutter.stop_playback_on_task_removed",
  autoSaveOfflinePlayed: "flutter.auto_save_offline_played",
  autoSaveOfflineMaxBytes: "flutter.auto_save_offline_max_bytes",
  autoSaveOfflineLruEvict: "flutter.auto_save_offline_lru_evict",
  // pre-1.1.0 names, before "download" was renamed to "save offline".
  autoDownloadPlayed: "flutter.auto_download_played",
  autoDownloadMaxBytes: "flutter.auto_download_max_bytes",
  autoDownloadLruEvict: "flutter.auto_download_lru_evict",
  homeSections: "flutter.home_sections",
} as const;

export type LegacyPrefKey =
  (typeof LEGACY_PREF_KEYS)[keyof typeof LEGACY_PREF_KEYS];

/** raw payload returned by the native reader. */
export type LegacyPrefsRaw = Partial<
  Record<LegacyPrefKey, string | boolean | number | string[]>
>;

/** typed view of the legacy preferences. absent keys are null. */
export interface LegacyPreferences {
  /** preferences file the values came from. */
  sourceFile: string;
  serverUrl: string | null;
  alternateServerUrls: string[];
  username: string | null;
  password: string | null;
  isLoggedIn: boolean | null;
  stopPlaybackOnTaskRemoved: boolean | null;
  autoSaveOfflinePlayed: boolean | null;
  autoSaveOfflineMaxBytes: number | null;
  autoSaveOfflineLruEvict: boolean | null;
  /** raw json string, as written by the legacy app (`jsonEncode(sections)`). */
  homeSections: string | null;
}

export type LegacyCredentials = Pick<
  LegacyPreferences,
  "sourceFile" | "serverUrl" | "username" | "password"
>;

/** outcome of reading the legacy store, ready for migration logging. */
export type LegacyPrefsReadResult =
  | { status: "ok"; preferences: LegacyPreferences }
  | { status: "absent" }
  | { status: "unavailable" }
  | { status: "unreadable"; errors: unknown[] };

declare class LegacyPrefsNativeModule extends NativeModule {
  read(fileName: string): Promise<LegacyPrefsRaw | null>;
}

let LegacyPrefs: LegacyPrefsNativeModule | null = null;

try {
  LegacyPrefs = requireNativeModule<LegacyPrefsNativeModule>("LegacyPrefs");
} catch {
  LegacyPrefs = null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function toPreferences(
  raw: LegacyPrefsRaw,
  sourceFile: string,
): LegacyPreferences {
  return {
    sourceFile,
    serverUrl: asString(raw[LEGACY_PREF_KEYS.serverUrl]),
    alternateServerUrls: asStringArray(
      raw[LEGACY_PREF_KEYS.alternateServerUrls],
    ),
    username: asString(raw[LEGACY_PREF_KEYS.username]),
    password: asString(raw[LEGACY_PREF_KEYS.password]),
    isLoggedIn: asBoolean(raw[LEGACY_PREF_KEYS.isLoggedIn]),
    stopPlaybackOnTaskRemoved: asBoolean(
      raw[LEGACY_PREF_KEYS.stopPlaybackOnTaskRemoved],
    ),
    // `auto_download_*` is the pre-1.1.0 name; prefer the newer key when both
    // exist so a partially upgraded store still resolves to the latest value.
    autoSaveOfflinePlayed:
      asBoolean(raw[LEGACY_PREF_KEYS.autoSaveOfflinePlayed]) ??
      asBoolean(raw[LEGACY_PREF_KEYS.autoDownloadPlayed]),
    autoSaveOfflineMaxBytes:
      asNumber(raw[LEGACY_PREF_KEYS.autoSaveOfflineMaxBytes]) ??
      asNumber(raw[LEGACY_PREF_KEYS.autoDownloadMaxBytes]),
    autoSaveOfflineLruEvict:
      asBoolean(raw[LEGACY_PREF_KEYS.autoSaveOfflineLruEvict]) ??
      asBoolean(raw[LEGACY_PREF_KEYS.autoDownloadLruEvict]),
    homeSections: asString(raw[LEGACY_PREF_KEYS.homeSections]),
  };
}

/**
 * reads the preferences written by the legacy flutter app and reports why the
 * result is empty. migration uses this to tell "nothing to import" apart from
 * "the legacy store exists but could not be read".
 *
 * tries the flutter `shared_preferences` file first, then the default android
 * preferences file. pass `fileName` to read a single specific file instead.
 */
export async function readLegacyPreferencesResult(
  fileName?: string,
): Promise<LegacyPrefsReadResult> {
  if (!LegacyPrefs) {
    return { status: "unavailable" };
  }

  const candidates = fileName
    ? [fileName]
    : [LEGACY_FLUTTER_PREFS_FILE, LEGACY_DEFAULT_PREFS_FILE];
  const errors: unknown[] = [];

  for (const candidate of candidates) {
    try {
      const raw = await LegacyPrefs.read(candidate);
      if (raw) {
        return {
          status: "ok",
          preferences: toPreferences(raw, candidate),
        };
      }
    } catch (error) {
      console.warn(
        `failed to read legacy preferences from ${candidate}`,
        error,
      );
      errors.push(error);
    }
  }

  // a missing file resolves to null rather than throwing, so any error means
  // a preference file was present but could not be decoded.
  if (errors.length > 0) {
    return { status: "unreadable", errors };
  }

  return { status: "absent" };
}

/**
 * convenience wrapper over {@link readLegacyPreferencesResult} for callers that
 * only need the values. returns `null` for absent, unavailable, or unreadable
 * legacy data.
 */
export async function readLegacyPreferences(
  fileName?: string,
): Promise<LegacyPreferences | null> {
  const result = await readLegacyPreferencesResult(fileName);
  return result.status === "ok" ? result.preferences : null;
}

/**
 * credentials-only view for `mig-1`. returns `null` when no preference file
 * has credentials: a file that only contains settings is not an import source.
 */
export async function readLegacyCredentials(
  fileName?: string,
): Promise<LegacyCredentials | null> {
  const preferences = await readLegacyPreferences(fileName);
  if (!preferences) return null;

  const { sourceFile, serverUrl, username, password } = preferences;
  if (serverUrl === null && username === null && password === null) {
    return null;
  }

  return { sourceFile, serverUrl, username, password };
}

export default LegacyPrefs;
