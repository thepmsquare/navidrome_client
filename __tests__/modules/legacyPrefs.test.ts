import {
  LEGACY_DEFAULT_PREFS_FILE,
  LEGACY_FLUTTER_PREFS_FILE,
  LEGACY_PREF_KEYS,
  readLegacyCredentials,
  readLegacyPreferences,
} from "@/modules/legacy-prefs";
import type { LegacyPrefsRaw } from "@/modules/legacy-prefs";

jest.mock("expo", () => {
  const read = jest.fn();
  return {
    requireNativeModule: () => ({ read }),
    __read: read,
  };
});

const { __read: mockRead } = jest.requireMock("expo") as {
  __read: jest.Mock;
};

const FULL_RAW: LegacyPrefsRaw = {
  [LEGACY_PREF_KEYS.serverUrl]: "https://music.example.com",
  [LEGACY_PREF_KEYS.alternateServerUrls]: ["https://backup.example.com"],
  [LEGACY_PREF_KEYS.username]: "alice",
  [LEGACY_PREF_KEYS.password]: "secret",
  [LEGACY_PREF_KEYS.isLoggedIn]: true,
  [LEGACY_PREF_KEYS.stopPlaybackOnTaskRemoved]: false,
  [LEGACY_PREF_KEYS.autoSaveOfflinePlayed]: true,
  [LEGACY_PREF_KEYS.autoSaveOfflineMaxBytes]: 1_073_741_824,
  [LEGACY_PREF_KEYS.autoSaveOfflineLruEvict]: false,
  [LEGACY_PREF_KEYS.homeSections]: '[{"id":"most_played","visible":true}]',
};

describe("readLegacyPreferences", () => {
  beforeEach(() => {
    mockRead.mockReset();
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns null when no preference file holds legacy data", async () => {
    mockRead.mockResolvedValue(null);

    await expect(readLegacyPreferences()).resolves.toBeNull();
    expect(mockRead).toHaveBeenNthCalledWith(1, LEGACY_FLUTTER_PREFS_FILE);
    expect(mockRead).toHaveBeenNthCalledWith(2, LEGACY_DEFAULT_PREFS_FILE);
  });

  it("maps the raw payload to typed preferences", async () => {
    mockRead.mockResolvedValue(FULL_RAW);

    await expect(readLegacyPreferences()).resolves.toEqual({
      sourceFile: LEGACY_FLUTTER_PREFS_FILE,
      serverUrl: "https://music.example.com",
      alternateServerUrls: ["https://backup.example.com"],
      username: "alice",
      password: "secret",
      isLoggedIn: true,
      stopPlaybackOnTaskRemoved: false,
      autoSaveOfflinePlayed: true,
      autoSaveOfflineMaxBytes: 1_073_741_824,
      autoSaveOfflineLruEvict: false,
      homeSections: '[{"id":"most_played","visible":true}]',
    });
  });

  it("fills absent keys with nulls and an empty url list", async () => {
    mockRead.mockResolvedValue({
      [LEGACY_PREF_KEYS.username]: "alice",
    });

    await expect(readLegacyPreferences()).resolves.toEqual({
      sourceFile: LEGACY_FLUTTER_PREFS_FILE,
      serverUrl: null,
      alternateServerUrls: [],
      username: "alice",
      password: null,
      isLoggedIn: null,
      stopPlaybackOnTaskRemoved: null,
      autoSaveOfflinePlayed: null,
      autoSaveOfflineMaxBytes: null,
      autoSaveOfflineLruEvict: null,
      homeSections: null,
    });
  });

  it("ignores values whose runtime type does not match", async () => {
    mockRead.mockResolvedValue({
      [LEGACY_PREF_KEYS.serverUrl]: 42,
      [LEGACY_PREF_KEYS.isLoggedIn]: "yes",
      [LEGACY_PREF_KEYS.autoSaveOfflineMaxBytes]: "10",
      [LEGACY_PREF_KEYS.alternateServerUrls]: "https://backup.example.com",
    } as unknown as LegacyPrefsRaw);

    await expect(readLegacyPreferences()).resolves.toEqual({
      sourceFile: LEGACY_FLUTTER_PREFS_FILE,
      serverUrl: null,
      alternateServerUrls: [],
      username: null,
      password: null,
      isLoggedIn: null,
      stopPlaybackOnTaskRemoved: null,
      autoSaveOfflinePlayed: null,
      autoSaveOfflineMaxBytes: null,
      autoSaveOfflineLruEvict: null,
      homeSections: null,
    });
  });

  it("reads a single file when one is provided", async () => {
    mockRead.mockResolvedValue(FULL_RAW);

    await expect(
      readLegacyPreferences(LEGACY_DEFAULT_PREFS_FILE),
    ).resolves.toMatchObject({ sourceFile: LEGACY_DEFAULT_PREFS_FILE });
    expect(mockRead).toHaveBeenCalledTimes(1);
    expect(mockRead).toHaveBeenCalledWith(LEGACY_DEFAULT_PREFS_FILE);
  });

  it("falls through to the next file when a native read throws", async () => {
    mockRead
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(FULL_RAW);

    await expect(readLegacyPreferences()).resolves.toMatchObject({
      sourceFile: LEGACY_DEFAULT_PREFS_FILE,
    });
  });
});

describe("readLegacyCredentials", () => {
  beforeEach(() => {
    mockRead.mockReset();
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns only the credential fields", async () => {
    mockRead.mockResolvedValue(FULL_RAW);

    await expect(readLegacyCredentials()).resolves.toEqual({
      sourceFile: LEGACY_FLUTTER_PREFS_FILE,
      serverUrl: "https://music.example.com",
      username: "alice",
      password: "secret",
    });
  });

  it("returns null when the file only contains settings", async () => {
    mockRead.mockResolvedValue({
      [LEGACY_PREF_KEYS.homeSections]: "[]",
      [LEGACY_PREF_KEYS.autoSaveOfflinePlayed]: true,
    });

    await expect(readLegacyCredentials()).resolves.toBeNull();
  });

  it("returns null when no file has legacy data", async () => {
    mockRead.mockResolvedValue(null);

    await expect(readLegacyCredentials()).resolves.toBeNull();
  });
});
