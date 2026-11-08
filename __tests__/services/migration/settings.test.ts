import * as SecureStore from "expo-secure-store";

import { readLegacyPreferencesResult } from "@/modules/legacy-prefs";
import type { LegacyPreferences } from "@/modules/legacy-prefs";
import {
  setAutoCacheEnabled,
  setAutoCacheMaxBytes,
  setKeepPlayingOnAppDismissed,
} from "@/services/db";
import {
  migrateLegacySettings,
  parseHomeSections,
} from "@/services/migration/settings";

jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(),
}));

jest.mock("@/modules/legacy-prefs", () => ({
  readLegacyPreferencesResult: jest.fn(),
}));

jest.mock("@/services/db", () => ({
  setAutoCacheEnabled: jest.fn(),
  setAutoCacheMaxBytes: jest.fn(),
  setKeepPlayingOnAppDismissed: jest.fn(),
}));

const mockSetItem = SecureStore.setItemAsync as jest.Mock;
const mockReadLegacy = readLegacyPreferencesResult as jest.Mock;
const mockSetAutoCacheEnabled = setAutoCacheEnabled as jest.Mock;
const mockSetAutoCacheMaxBytes = setAutoCacheMaxBytes as jest.Mock;
const mockSetKeepPlaying = setKeepPlayingOnAppDismissed as jest.Mock;

function legacyPrefs(
  overrides: Partial<LegacyPreferences> = {},
): LegacyPreferences {
  return {
    sourceFile: "FlutterSharedPreferences",
    serverUrl: "https://music.example.com",
    alternateServerUrls: [],
    username: "alice",
    password: "secret",
    isLoggedIn: true,
    stopPlaybackOnTaskRemoved: null,
    autoSaveOfflinePlayed: null,
    autoSaveOfflineMaxBytes: null,
    autoSaveOfflineLruEvict: null,
    homeSections: null,
    ...overrides,
  };
}

function ok(preferences: LegacyPreferences) {
  return { status: "ok" as const, preferences };
}

describe("parseHomeSections", () => {
  it("parses valid sections and drops malformed entries", () => {
    expect(
      parseHomeSections(
        JSON.stringify([
          { id: "most_played", visible: true },
          { id: "random_tracks", visible: false },
          { id: 42, visible: true },
          { id: "missing_visible" },
          null,
        ]),
      ),
    ).toEqual([
      { id: "most_played", visible: true },
      { id: "random_tracks", visible: false },
    ]);
  });

  it("returns null for absent, invalid, or empty json", () => {
    expect(parseHomeSections(null)).toBeNull();
    expect(parseHomeSections("")).toBeNull();
    expect(parseHomeSections("not json")).toBeNull();
    expect(parseHomeSections('{"id":"most_played"}')).toBeNull();
    expect(parseHomeSections("[]")).toBeNull();
    expect(parseHomeSections('[{"id":1,"visible":true}]')).toBeNull();
  });
});

describe("migrateLegacySettings", () => {
  beforeEach(() => {
    mockSetItem.mockReset().mockResolvedValue(undefined);
    mockReadLegacy.mockReset();
    mockSetAutoCacheEnabled.mockReset();
    mockSetAutoCacheMaxBytes.mockReset();
    mockSetKeepPlaying.mockReset();
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("maps every supported legacy setting", async () => {
    mockReadLegacy.mockResolvedValue(
      ok(
        legacyPrefs({
          autoSaveOfflinePlayed: false,
          autoSaveOfflineMaxBytes: 2_147_483_648,
          stopPlaybackOnTaskRemoved: false,
          homeSections: JSON.stringify([
            { id: "most_played", visible: true },
            { id: "random_tracks", visible: false },
          ]),
        }),
      ),
    );

    await expect(migrateLegacySettings()).resolves.toEqual({
      status: "applied",
      applied: [
        "auto_save_offline_played",
        "auto_save_offline_max_bytes",
        "stop_playback_on_task_removed",
        "home_sections",
      ],
    });

    expect(mockSetAutoCacheEnabled).toHaveBeenCalledWith(false);
    expect(mockSetAutoCacheMaxBytes).toHaveBeenCalledWith(2_147_483_648);
    expect(mockSetKeepPlaying).toHaveBeenCalledWith(true);
    expect(mockSetItem).toHaveBeenCalledWith(
      "stop_playback_on_task_removed",
      "false",
    );
    expect(mockSetItem).toHaveBeenCalledWith(
      "home_sections",
      JSON.stringify([
        { id: "most_played", visible: true },
        { id: "random_tracks", visible: false },
      ]),
    );
  });

  it("inverts stop_playback_on_task_removed for keep playing", async () => {
    mockReadLegacy.mockResolvedValue(
      ok(legacyPrefs({ stopPlaybackOnTaskRemoved: true })),
    );

    await expect(migrateLegacySettings()).resolves.toEqual({
      status: "applied",
      applied: ["stop_playback_on_task_removed"],
    });
    expect(mockSetKeepPlaying).toHaveBeenCalledWith(false);
  });

  it("keeps defaults for missing or invalid values", async () => {
    mockReadLegacy.mockResolvedValue(
      ok(
        legacyPrefs({
          autoSaveOfflineMaxBytes: 0,
          homeSections: "not json",
        }),
      ),
    );

    await expect(migrateLegacySettings()).resolves.toEqual({
      status: "no-settings",
    });
    expect(mockSetAutoCacheEnabled).not.toHaveBeenCalled();
    expect(mockSetAutoCacheMaxBytes).not.toHaveBeenCalled();
    expect(mockSetKeepPlaying).not.toHaveBeenCalled();
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it("skips a logged-out legacy session", async () => {
    mockReadLegacy.mockResolvedValue(
      ok(
        legacyPrefs({
          isLoggedIn: false,
          autoSaveOfflinePlayed: true,
        }),
      ),
    );

    await expect(migrateLegacySettings()).resolves.toEqual({
      status: "skipped",
      reason: "logged-out",
    });
    expect(mockSetAutoCacheEnabled).not.toHaveBeenCalled();
  });

  it("skips when the legacy prefs are unreadable", async () => {
    mockReadLegacy.mockResolvedValue({
      status: "unreadable",
      errors: [new Error("corrupt xml")],
    });

    await expect(migrateLegacySettings()).resolves.toEqual({
      status: "skipped",
      reason: "unreadable-prefs",
    });
  });

  it("skips when reading throws unexpectedly", async () => {
    mockReadLegacy.mockRejectedValue(new Error("native module exploded"));

    await expect(migrateLegacySettings()).resolves.toEqual({
      status: "skipped",
      reason: "unreadable-prefs",
    });
  });

  it("returns no-settings when no legacy store exists", async () => {
    mockReadLegacy.mockResolvedValue({ status: "absent" });

    await expect(migrateLegacySettings()).resolves.toEqual({
      status: "no-settings",
    });
  });

  it("reports a failure when a database write throws", async () => {
    const error = new Error("sqlite unavailable");
    mockReadLegacy.mockResolvedValue(
      ok(legacyPrefs({ autoSaveOfflinePlayed: true })),
    );
    mockSetAutoCacheEnabled.mockImplementation(() => {
      throw error;
    });

    await expect(migrateLegacySettings()).resolves.toEqual({
      status: "failed",
      error,
    });
  });

  it("reports a failure when a secure-store write throws", async () => {
    const error = new Error("secure store unavailable");
    mockReadLegacy.mockResolvedValue(
      ok(legacyPrefs({ homeSections: '[{"id":"most_played","visible":true}]' })),
    );
    mockSetItem.mockRejectedValue(error);

    await expect(migrateLegacySettings()).resolves.toEqual({
      status: "failed",
      error,
    });
  });
});
