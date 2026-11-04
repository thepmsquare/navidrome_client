import * as SecureStore from "expo-secure-store";

import { readLegacyPreferences } from "@/modules/legacy-prefs";
import type { LegacyPreferences } from "@/modules/legacy-prefs";
import {
  LEGACY_SUBSONIC_VERSION,
  migrateLegacyCredentials,
  normalizeServerUrl,
} from "@/services/migration/credentials";
import { MIGRATION_COMPLETE_KEY } from "@/services/migration/state";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

jest.mock("@/modules/legacy-prefs", () => ({
  readLegacyPreferences: jest.fn(),
}));

const mockGetItem = SecureStore.getItemAsync as jest.Mock;
const mockSetItem = SecureStore.setItemAsync as jest.Mock;
const mockReadLegacy = readLegacyPreferences as jest.Mock;

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
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("does nothing when the migration flag is already set", async () => {
    mockGetItem.mockResolvedValue("true");

    await expect(migrateLegacyCredentials()).resolves.toEqual({
      status: "already-complete",
    });
    expect(mockReadLegacy).not.toHaveBeenCalled();
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it("does not migrate when the flag cannot be read", async () => {
    mockGetItem.mockRejectedValue(new Error("secure store unavailable"));

    await expect(migrateLegacyCredentials()).resolves.toEqual({
      status: "already-complete",
    });
    expect(mockReadLegacy).not.toHaveBeenCalled();
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it("marks the migration complete when there is no legacy data", async () => {
    mockReadLegacy.mockResolvedValue(null);

    await expect(migrateLegacyCredentials()).resolves.toEqual({
      status: "no-legacy-data",
    });
    expect(writes()).toEqual([[MIGRATION_COMPLETE_KEY, "true"]]);
  });

  it("migrates credentials and writes the flag last", async () => {
    mockReadLegacy.mockResolvedValue(
      legacyPrefs({ alternateServerUrls: ["https://backup.example.com"] }),
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
      [MIGRATION_COMPLETE_KEY, "true"],
    ]);
  });

  it("normalizes, deduplicates, and labels alternate urls", async () => {
    mockReadLegacy.mockResolvedValue(
      legacyPrefs({
        serverUrl: "music.example.com/",
        alternateServerUrls: [
          "",
          "https://music.example.com",
          "backup.example.com/",
          "http://plain.example.com",
        ],
      }),
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

  it("skips a logged-out legacy session but still marks complete", async () => {
    mockReadLegacy.mockResolvedValue(legacyPrefs({ isLoggedIn: false }));

    await expect(migrateLegacyCredentials()).resolves.toEqual({
      status: "skipped",
      reason: "logged-out",
    });
    expect(writes()).toEqual([[MIGRATION_COMPLETE_KEY, "true"]]);
  });

  it("skips incomplete credentials but still marks complete", async () => {
    mockReadLegacy.mockResolvedValue(legacyPrefs({ password: null }));

    await expect(migrateLegacyCredentials()).resolves.toEqual({
      status: "skipped",
      reason: "incomplete-credentials",
    });
    expect(writes()).toEqual([[MIGRATION_COMPLETE_KEY, "true"]]);
  });

  it("does not set the flag when a credential write fails", async () => {
    const error = new Error("secure store unavailable");
    mockReadLegacy.mockResolvedValue(legacyPrefs());
    mockSetItem.mockRejectedValue(error);

    await expect(migrateLegacyCredentials()).resolves.toEqual({
      status: "failed",
      error,
    });
    expect(writes()).not.toContainEqual([MIGRATION_COMPLETE_KEY, "true"]);
  });

  it("reports a failed result when the flag write fails", async () => {
    const error = new Error("secure store unavailable");
    mockReadLegacy.mockResolvedValue(null);
    mockSetItem.mockRejectedValue(error);

    await expect(migrateLegacyCredentials()).resolves.toEqual({
      status: "failed",
      error,
    });
  });
});
