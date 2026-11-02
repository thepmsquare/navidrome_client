import { NativeModule, requireNativeModule } from "expo";

/**
 * default android shared preferences file (`<applicationId>_preferences`).
 * this is the file name the mig-1 migration is specified against.
 */
export const LEGACY_DEFAULT_PREFS_FILE =
  "com.thepmsquare.navidrome_client_preferences";

/**
 * file used by flutter's `shared_preferences` plugin, which the legacy app
 * actually wrote to. keys are stored with a `flutter.` prefix.
 */
export const LEGACY_FLUTTER_PREFS_FILE = "FlutterSharedPreferences";

/**
 * raw snapshot of the preferences written by the legacy flutter app
 * (`1.0.0+19` .. `1.3.2+24`). values are returned as stored: callers are
 * responsible for validation and for falling back to defaults.
 */
export interface LegacyPreferences {
  /** true when at least one legacy key was present in the file. */
  found: boolean;
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

export interface LegacyPreferencesSnapshot extends LegacyPreferences {
  sourceFile: string;
}

declare class LegacyPrefsNativeModule extends NativeModule {
  read(fileName: string): Promise<LegacyPreferences>;
}

let LegacyPrefs: LegacyPrefsNativeModule | null = null;

try {
  LegacyPrefs = requireNativeModule<LegacyPrefsNativeModule>("LegacyPrefs");
} catch {
  LegacyPrefs = null;
}

/**
 * reads legacy preferences for the one-time startup migration.
 *
 * tries the default android preferences file first, then the flutter
 * `shared_preferences` file. returns `null` when no legacy data is present
 * (fresh install, already migrated, or a non-android runtime).
 *
 * pass `fileName` to read a single specific file instead.
 */
export async function readLegacyPreferences(
  fileName?: string,
): Promise<LegacyPreferencesSnapshot | null> {
  if (!LegacyPrefs) return null;

  const candidates = fileName
    ? [fileName]
    : [LEGACY_DEFAULT_PREFS_FILE, LEGACY_FLUTTER_PREFS_FILE];

  for (const candidate of candidates) {
    try {
      const snapshot = await LegacyPrefs.read(candidate);
      if (snapshot.found) {
        return { ...snapshot, sourceFile: candidate };
      }
    } catch (error) {
      console.warn(
        `failed to read legacy preferences from ${candidate}`,
        error,
      );
    }
  }

  return null;
}

export default LegacyPrefs;
