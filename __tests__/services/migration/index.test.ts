import { migrateLegacyCredentials } from "@/services/migration/credentials";
import { runLegacyMigration } from "@/services/migration";
import { migrateLegacySettings } from "@/services/migration/settings";
import {
  isMigrationComplete,
  markMigrationComplete,
} from "@/services/migration/state";

jest.mock("@/services/migration/credentials", () => ({
  migrateLegacyCredentials: jest.fn(),
}));

jest.mock("@/services/migration/settings", () => ({
  migrateLegacySettings: jest.fn(),
}));

jest.mock("@/services/migration/state", () => ({
  isMigrationComplete: jest.fn(),
  markMigrationComplete: jest.fn(),
}));

const mockCredentials = migrateLegacyCredentials as jest.Mock;
const mockSettings = migrateLegacySettings as jest.Mock;
const mockIsComplete = isMigrationComplete as jest.Mock;
const mockMarkComplete = markMigrationComplete as jest.Mock;

const CREDENTIALS_MIGRATED = {
  status: "migrated",
  serverUrl: "https://music.example.com",
  alternateUrlCount: 0,
} as const;

const SETTINGS_APPLIED = {
  status: "applied",
  applied: ["auto_save_offline_played"],
} as const;

describe("runLegacyMigration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsComplete.mockResolvedValue(false);
    mockCredentials.mockResolvedValue(CREDENTIALS_MIGRATED);
    mockSettings.mockResolvedValue(SETTINGS_APPLIED);
    mockMarkComplete.mockResolvedValue(undefined);
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("short-circuits when the complete flag is already set", async () => {
    mockIsComplete.mockResolvedValue(true);

    await expect(runLegacyMigration()).resolves.toEqual({
      status: "already-complete",
    });
    expect(mockCredentials).not.toHaveBeenCalled();
    expect(mockSettings).not.toHaveBeenCalled();
    expect(mockMarkComplete).not.toHaveBeenCalled();
  });

  it("runs both steps and writes the flag last", async () => {
    await expect(runLegacyMigration()).resolves.toEqual({
      status: "migrated",
      credentials: CREDENTIALS_MIGRATED,
      settings: SETTINGS_APPLIED,
    });

    expect(mockCredentials).toHaveBeenCalledTimes(1);
    expect(mockSettings).toHaveBeenCalledTimes(1);
    expect(mockCredentials.mock.invocationCallOrder[0]).toBeLessThan(
      mockSettings.mock.invocationCallOrder[0],
    );
    expect(mockMarkComplete.mock.invocationCallOrder[0]).toBeGreaterThan(
      mockSettings.mock.invocationCallOrder[0],
    );
  });

  it("still imports settings when credentials are skipped", async () => {
    mockCredentials.mockResolvedValue({
      status: "skipped",
      reason: "incomplete-credentials",
    });

    await expect(runLegacyMigration()).resolves.toMatchObject({
      status: "migrated",
    });
    expect(mockMarkComplete).toHaveBeenCalledTimes(1);
  });

  it("does not set the flag when credentials fail", async () => {
    const error = new Error("secure store unavailable");
    mockCredentials.mockResolvedValue({ status: "failed", error });

    await expect(runLegacyMigration()).resolves.toEqual({
      status: "failed",
      error,
      credentials: { status: "failed", error },
      settings: SETTINGS_APPLIED,
    });
    expect(mockSettings).toHaveBeenCalledTimes(1);
    expect(mockMarkComplete).not.toHaveBeenCalled();
  });

  it("does not set the flag when settings fail", async () => {
    const error = new Error("sqlite unavailable");
    mockSettings.mockResolvedValue({ status: "failed", error });

    await expect(runLegacyMigration()).resolves.toEqual({
      status: "failed",
      error,
      credentials: CREDENTIALS_MIGRATED,
      settings: { status: "failed", error },
    });
    expect(mockMarkComplete).not.toHaveBeenCalled();
  });

  it("reports a failure when the flag cannot be written", async () => {
    const error = new Error("secure store unavailable");
    mockMarkComplete.mockRejectedValue(error);

    await expect(runLegacyMigration()).resolves.toMatchObject({
      status: "failed",
      error,
    });
  });
});
