export interface PendingScrobble {
  id: number;
  songId: string;
  timestamp: number;
  attempts: number;
  createdAt: number;
}
