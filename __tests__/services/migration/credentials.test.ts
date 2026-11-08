import * as SecureStore from "expo-secure-store";

import { readLegacyPreferencesResult } from "@/modules/legacy-prefs";
import type { LegacyPreferences } from "@/modules/legacy-prefs";
import {
  LEGACY_SUBSONIC_VERSION,
  migrateLegacyCredentials,
  normalizeServerUrl,
} from "@/services/migration/credentials";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

jest.mock("@/modules/legacy-prefs", () => ({
  readLegacyPreferencesResult: jest.fn(),
}));

const mockGetItem = SecureStore.getItemAsync as jest.Mock;
const mockSetItem = SecureStore.setItemAsync as jest.Mock;
const mockReadLegacy = readLegacyPreferencesResult as jest.Mock;

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

function writes(): [string, string][] {
  return mockSetItem.mock.calls.map(([key, value]) => [key, value]);
}

function ok(preferences: LegacyPreferences) {
  return { status: "ok" as const, preferences };
}

describe("normalizeServerUrl", () => {
  it("trims whitespace and trailing slashes", () => {
    expect(normalizeServerUrl("  https://music.example.com///  ")).toBe(
      "https://music.example.com",
    );
  });

  it("defaults to https when no scheme is present", () => {
    expect(normalizeServerUrl("music.example.com")).toBe(
      "https://music.example.com",
    );
  });

  it("keeps an explicit http scheme", () => {
    expect(normalizeServerUrl("http://music.example.com")).toBe(
      "http://music.example.com",
    );
  });

  it("rejects blank and scheme-only values", () => {
    expect(normalizeServerUrl(null)).toBeNull();
    expect(normalizeServerUrl("   ")).toBeNull();
    expect(normalizeServerUrl("https://")).toBeNull();
  });
});

describe("migrateLegacyCredentials", () => {
  beforeEach(() => {
    mockGetItem.mockReset();
    mockSetItem.mockReset();
    mockReadLegacy.mockReset();
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns no-legacy-data when the legacy store is absent", async () => {
    mockReadLegacy.mockResolvedValue({ status: "absent" });

    await expect(migrateLegacyCredentials()).resolves.toEqual({
      status: "no-legacy-data",
    });
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it("migrates credentials and writes the flag last", async () => {
    mockReadLegacy.mockResolvedValue(
      ok(legacyPrefs({ alternateServerUrls: ["https://backup.example.com"] })),
    );

    await expect(migrateLegacyCredentials()).resolves.toEqual({
      status: "migrated",
      serverUrl: "https://music.example.com",
      alternateUrlCount: 1,
    });

    expect(writes()).toEqual([
      ["subsonicVersion", LEGACY_SUBSONIC_VERSION],
      ["serverUrl", "https://music.example.com"],
      ["serverUrlLabel", "server url"],
      [
        "serverUrls",
        JSON.stringify([
          { url: "https://music.example.com", label: "server url" },
          {
            url: "https://backup.example.com",
            label: "alternative url 1",
          },
        ]),
      ],
      ["username", "alice"],
      ["password", "secret"],
    ]);
  });

  it("normalizes, deduplicates, and labels alternate urls", async () => {
    mockReadLegacy.mockResolvedValue(
      ok(
        legacyPrefs({
          serverUrl: "music.example.com/",
          alternateServerUrls: [
            "",
            "https://music.example.com",
            "backup.example.com/",
            "http://plain.example.com",
          ],
        }),
      ),
    );

    await expect(migrateLegacyCredentials()).resolves.toEqual({
      status: "migrated",
      serverUrl: "https://music.example.com",
      alternateUrlCount: 2,
    });

    const serverUrls = JSON.parse(
      mockSetItem.mock.calls.find(([key]) => key === "serverUrls")![1],
    );
    expect(serverUrls).toEqual([
      { url: "https://music.example.com", label: "server url" },
      { url: "https://backup.example.com", label: "alternative url 3" },
      { url: "http://plain.example.com", label: "alternative url 4" },
    ]);
  });

  it("skips a logged-out legacy session without writing", async () => {
    mockReadLegacy.mockResolvedValue(ok(legacyPrefs({ isLoggedIn: false })));

    await expect(migrateLegacyCredentials()).resolves.toEqual({
      status: "skipped",
      reason: "logged-out",
    });
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it("skips incomplete credentials without writing", async () => {
    mockReadLegacy.mockResolvedValue(ok(legacyPrefs({ password: null })));

    await expect(migrateLegacyCredentials()).resolves.toEqual({
      status: "skipped",
      reason: "incomplete-credentials",
    });
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it("reports a failure when a credential write fails", async () => {
    const error = new Error("secure store unavailable");
    mockReadLegacy.mockResolvedValue(ok(legacyPrefs()));
    mockSetItem.mockRejectedValue(error);

    await expect(migrateLegacyCredentials()).resolves.toEqual({
      status: "failed",
      error,
    });
  });

  it("skips unreadable legacy prefs without writing", async () => {
    mockReadLegacy.mockResolvedValue({
      status: "unreadable",
      errors: [new Error("corrupt xml")],
    });

    await expect(migrateLegacyCredentials()).resolves.toEqual({
      status: "skipped",
      reason: "unreadable-prefs",
    });
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it("skips when reading throws unexpectedly", async () => {
    mockReadLegacy.mockRejectedValue(new Error("native module exploded"));

    await expect(migrateLegacyCredentials()).resolves.toEqual({
      status: "skipped",
      reason: "unreadable-prefs",
    });
    expect(mockSetItem).not.toHaveBeenCalled();
  });
});
