export interface HomeSectionConfig {
  id: string;
  visible: boolean;
}

export interface BackupData {
  app_identifier: string;
  server_url: string;
  username: string;
  password: string;
  stop_playback_on_task_removed?: boolean;
  home_sections?: HomeSectionConfig[];
  export_date: string;
  version: number;
}

