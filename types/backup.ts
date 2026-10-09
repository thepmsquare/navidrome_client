import { LyricsMode } from "./lyrics";

export interface HomeSectionConfig {
  id: string;
  visible: boolean;
}

export interface BackupSettings {
  auto_cache_enabled?: boolean;
  auto_cache_max_bytes?: number;
  scrobble_min_duration?: number;
  scrobble_min_percent?: number;
  keep_playing_on_app_dismissed?: boolean;
  lyrics_mode?: LyricsMode;
}

export interface BackupData {
  app_identifier: string;
  server_url: string;
  username: string;
  password: string;
  settings?: BackupSettings;
  stop_playback_on_task_removed?: boolean;
  home_sections?: HomeSectionConfig[];
  export_date: string;
  version: number;
}

