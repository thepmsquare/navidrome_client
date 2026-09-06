export enum SongCacheType {
  Manual = "manual",
  Auto = "auto",
}

export interface SongCacheRow {
  songId: string;
  cacheType: SongCacheType;
  filePath: string;
  fileSizeBytes: number;
  addedAt: string;
  lastAccessedAt: string | null;
}
