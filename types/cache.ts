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

export type DownloadQueueStatus = "pending" | "active";

export interface DownloadQueueRow {
  songId: string;
  status: DownloadQueueStatus;
  createdAt: string;
}

export interface DownloadQueueRequesterRow {
  songId: string;
  sourceKey: string;
}

export interface DownloadQueueState {
  pending: string[];
  active: string | null;
}
