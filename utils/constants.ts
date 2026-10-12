import packageJson from '../package.json';

export const APP_SHORT_NAME = "navidrome client";
export const APP_SUBTITLE = "by thepmsquare";
export const APP_FULL_NAME = "navidrome client by thepmsquare";
export const APP_VERSION = packageJson.version;
export const APP_VERSION_CODE = packageJson.versionCode;
export const DB_NAME = "navidrome.db";
export const APP_IDENTIFIER_FOR_PROFILE_EXPORT = "navidrome_client_backup";
export const FILE_NAME_FOR_PROFILE_EXPORT = APP_IDENTIFIER_FOR_PROFILE_EXPORT;
export const BACKUP_VERSION = 1;

export const DEFAULT_AUTO_CACHE_MAX_GIB = 1;
export const DEFAULT_AUTO_CACHE_MAX_BYTES =
  DEFAULT_AUTO_CACHE_MAX_GIB * 1024 * 1024 * 1024;

export const DEFAULT_SCROBBLE_MIN_DURATION = 240; // seconds
export const DEFAULT_SCROBBLE_MIN_PERCENT = 75; // 0-100

// 3 days negative lyrics cache TTL (in milliseconds)
export const LYRICS_NEGATIVE_CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000;

// 30 days instrumental lyrics cache TTL (in milliseconds)
export const LYRICS_INSTRUMENTAL_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const DEFAULT_LYRICS_MODE = "file_only" as const;

export const LRCLIB_USER_AGENT = `${APP_SHORT_NAME}/${APP_VERSION} (${packageJson.repository})`;
