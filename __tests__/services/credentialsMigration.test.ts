type SecureStoreMock = {
  getItemAsync: jest.Mock;
  setItemAsync: jest.Mock;
};

type CredentialsModule =
  typeof import("@/services/migration/credentials");
type LegacyPrefsModule = typeof import("@/modules/legacy-prefs");
type MigrationStateModule = typeof import("@/services/migration/state");

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

let mockNativeAvailable = true;
const mockNativeRead = jest.fn();

jest.mock("expo", () => ({
  requireNativeModule: () => {
    if (!mockNativeAvailable) {
      throw new Error("native module LegacyPrefs is unavailable");
    }
    return {
      read: (...args: unknown[]) => mockNativeRead(...args),
    };
  },
}));

/**
 * preference names as seen by the native reader, which adds the `flutter.`
 * prefix used by `shared_preferences` on android.
 */
const PREF = {
  serverUrl: "flutter.server_url",
  alternateServerUrls: "flutter.alternate_server_urls",
  username: "flutter.username",
  password: "flutter.password",
  isLoggedIn: "flutter.is_logged_in",
  stopPlaybackOnTaskRemoved: "flutter.stop_playback_on_task_removed",
  autoSaveOfflinePlayed: "flutter.auto_save_offline_played",
  autoSaveOfflineMaxBytes: "flutter.auto_save_offline_max_bytes",
  autoSaveOfflineLruEvict: "flutter.auto_save_offline_lru_evict",
  homeSections: "flutter.home_sections",
} as const;

const HOME_SECTIONS = '[{"id":"most_played","visible":true}]';

/** 1.0.0: credentials + session only, settings still used the old auto_download names. */
const LEGACY_1_0_0 = {
  [PREF.serverUrl]: "https://music.example.com",
  [PREF.username]: "alice",
  [PREF.password]: "secret",
  [PREF.isLoggedIn]: true,
  [PREF.stopPlaybackOnTaskRemoved]: false,
  [PREF.homeSections]: HOME_SECTIONS,
};

/** 1.1.0: same credentials, settings renamed to auto_save_offline. */
const LEGACY_1_1_0 = {
  ...LEGACY_1_0_0,
  [PREF.autoSaveOfflinePlayed]: true,
  [PREF.autoSaveOfflineMaxBytes]: 1_073_741_824,
  [PREF.autoSaveOfflineLruEvict]: false,
};

/** 1.3.2: adds alternate server urls used for failover. */
const LEGACY_1_3_2 = {
  ...LEGACY_1_1_0,
  [PREF.alternateServerUrls]: [
    "https://backup.example.com",
    "https://fallback.example.com",
  ],
};

function loadModules() {
  // each test gets a fresh module registry so `LegacyPrefs` picks up the
  // current availability of the native module.
  jest.resetModules();

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const secureStore = require("expo-secure-store") as SecureStoreMock;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const credentials = require(
    "@/services/migration/credentials",
  ) as CredentialsModule;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const legacyPrefs = require("@/modules/legacy-prefs") as LegacyPrefsModule;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const state = require(
    "@/services/migration/state",
  ) as MigrationStateModule;

  secureStore.getItemAsync.mockResolvedValue(null);
  secureStore.setItemAsync.mockResolvedValue(undefined);

  return { secureStore, credentials, legacyPrefs, state };
}

function writes(secureStore: SecureStoreMock): [string, string][] {
  return secureStore.setItemAsync.mock.calls.map(([key, value]) => [
    key,
    value,
  ]);
}

describe("legacy credentials migration", () => {
  beforeEach(() => {
    mockNativeAvailable = true;
    mockNativeRead.mockReset();
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe.each([
    ["1.0.0", LEGACY_1_0_0, 0],
    ["1.1.0", LEGACY_1_1_0, 0],
    ["1.3.2", LEGACY_1_3_2, 2],
  ] as [string, Record<string, unknown>, number][])(
    "legacy %s preference shape",
    (version, raw, alternateUrlCount) => {
      it(`migrates the ${version} shape`, async () => {
        mockNativeRead.mockResolvedValue(raw);
        const { secureStore, credentials, state } = loadModules();

        await expect(
          credentials.migrateLegacyCredentials(),
        ).resolves.toEqual({
          status: "migrated",
          serverUrl: "https://music.example.com",
          alternateUrlCount,
        });

        expect(mockNativeRead).toHaveBeenCalledWith("FlutterSharedPreferences");

        const serverUrls = JSON.parse(
          writes(secureStore).find(([key]) => key === "serverUrls")![1],
        );
        expect(serverUrls).toHaveLength(alternateUrlCount + 1);
        expect(serverUrls[0]).toEqual({
          url: "https://music.example.com",
          label: "server url",
        });
        if (alternateUrlCount > 0) {
          expect(serverUrls.slice(1)).toEqual([
            {
              url: "https://backup.example.com",
              label: "alternative url 1",
            },
            {
              url: "https://fallback.example.com",
              label: "alternative url 2",
            },
          ]);
        }

        expect(writes(secureStore)).toContainEqual(["subsonicVersion", "1.16.1"]);
        expect(writes(secureStore)).toContainEqual(["username", "alice"]);
        expect(writes(secureStore)).toContainEqual(["password", "secret"]);
        expect(writes(secureStore).at(-1)).toEqual([
          state.MIGRATION_COMPLETE_KEY,
          "true",
        ]);
      });
    },
  );

  describe.each([
    [
      "a missing password",
      {
        [PREF.serverUrl]: "https://music.example.com",
        [PREF.username]: "alice",
        [PREF.isLoggedIn]: true,
      },
    ],
    [
      "a missing server url",
      {
        [PREF.username]: "alice",
        [PREF.password]: "secret",
        [PREF.isLoggedIn]: true,
      },
    ],
    [
      "settings but no credentials",
      {
        [PREF.isLoggedIn]: true,
        [PREF.homeSections]: HOME_SECTIONS,
        [PREF.autoSaveOfflinePlayed]: true,
      },
    ],
  ] as [string, Record<string, unknown>][])(
    "partial legacy data with %s",
    (_description, raw) => {
      it("skips credentials and still marks the migration complete", async () => {
        mockNativeRead.mockResolvedValue(raw);
        const { secureStore, credentials, state } = loadModules();

        await expect(
          credentials.migrateLegacyCredentials(),
        ).resolves.toEqual({
          status: "skipped",
          reason: "incomplete-credentials",
        });

        expect(writes(secureStore)).toEqual([
          [state.MIGRATION_COMPLETE_KEY, "true"],
        ]);
      });
    },
  );

  it("short-circuits when the migration flag is already set", async () => {
    const { secureStore, credentials } = loadModules();
    secureStore.getItemAsync.mockResolvedValue("true");

    await expect(credentials.migrateLegacyCredentials()).resolves.toEqual({
      status: "already-complete",
    });

    expect(mockNativeRead).not.toHaveBeenCalled();
    expect(secureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it("marks complete without importing when the native module is unavailable", async () => {
    mockNativeAvailable = false;
    const { secureStore, credentials, legacyPrefs, state } = loadModules();

    await expect(legacyPrefs.readLegacyPreferencesResult()).resolves.toEqual({
      status: "unavailable",
    });

    await expect(credentials.migrateLegacyCredentials()).resolves.toEqual({
      status: "no-legacy-data",
    });

    expect(mockNativeRead).not.toHaveBeenCalled();
    expect(writes(secureStore)).toEqual([
      [state.MIGRATION_COMPLETE_KEY, "true"],
    ]);
  });

  it("falls back to connect when every legacy file is corrupt", async () => {
    mockNativeRead.mockRejectedValue(new Error("corrupt preference xml"));
    const { secureStore, credentials, state } = loadModules();

    await expect(credentials.migrateLegacyCredentials()).resolves.toEqual({
      status: "skipped",
      reason: "unreadable-prefs",
    });

    // both candidate files were attempted and left untouched.
    expect(mockNativeRead).toHaveBeenCalledTimes(2);
    expect(writes(secureStore)).toEqual([
      [state.MIGRATION_COMPLETE_KEY, "true"],
    ]);
  });
});
