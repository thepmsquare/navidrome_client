import {
  migrateLegacyCredentials,
  type CredentialMigrationResult,
} from "./credentials";
import {
  migrateLegacySettings,
  type SettingsMigrationResult,
} from "./settings";
import { isMigrationComplete, markMigrationComplete } from "./state";

export type LegacyMigrationResult =
  | { status: "already-complete" }
  | {
      status: "migrated";
      credentials: CredentialMigrationResult;
      settings: SettingsMigrationResult;
    }
  | {
      status: "failed";
      error?: unknown;
      credentials: CredentialMigrationResult;
      settings: SettingsMigrationResult;
    };

/**
 * runs the one-time legacy import for credentials and settings, then writes
 * the `migration.complete` flag.
 *
 * both steps run even when one skips (for example, logged-out or unreadable
 * legacy data) so partial legacy stores still import what they safely can. the
 * flag is only written when neither step failed, so a transient write error is
 * retried on the next launch.
 */
export async function runLegacyMigration(): Promise<LegacyMigrationResult> {
  if (await isMigrationComplete()) {
    return { status: "already-complete" };
  }

  const credentials = await migrateLegacyCredentials();
  const settings = await migrateLegacySettings();

  if (credentials.status === "failed" || settings.status === "failed") {
    const error =
      credentials.status === "failed"
        ? credentials.error
        : settings.status === "failed"
          ? settings.error
          : undefined;

    return {
      status: "failed",
      error,
      credentials,
      settings,
    };
  }

  try {
    await markMigrationComplete();
  } catch (error) {
    console.error("failed to mark legacy migration complete:", error);
    return { status: "failed", error, credentials, settings };
  }

  return { status: "migrated", credentials, settings };
}

export type { CredentialMigrationResult } from "./credentials";
export type { SettingsMigrationResult } from "./settings";
