import {
  getPendingScrobbles,
  incrementPendingScrobbleAttempts,
  removePendingScrobble,
} from "@/services/db";
import { scrobble } from "@/services/api";
import { syncPendingScrobbles } from "@/services/scrobbleQueue";

jest.mock("@/services/db", () => ({
  getPendingScrobbles: jest.fn(),
  removePendingScrobble: jest.fn(),
  incrementPendingScrobbleAttempts: jest.fn(),
}));

jest.mock("@/services/api", () => ({
  scrobble: jest.fn(),
}));

describe("scrobbleQueue service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return zeros when there are no pending scrobbles", async () => {
    (getPendingScrobbles as jest.Mock).mockReturnValue([]);

    const result = await syncPendingScrobbles();
    expect(result).toEqual({ synced: 0, failed: 0 });
    expect(scrobble).not.toHaveBeenCalled();
  });

  it("should sync pending scrobbles successfully and remove them", async () => {
    (getPendingScrobbles as jest.Mock).mockReturnValue([
      { id: 1, songId: "song-1", timestamp: 1000, attempts: 0, createdAt: 1000 },
      { id: 2, songId: "song-2", timestamp: 2000, attempts: 1, createdAt: 2000 },
    ]);
    (scrobble as jest.Mock).mockResolvedValue(true);

    const result = await syncPendingScrobbles();

    expect(result).toEqual({ synced: 2, failed: 0 });
    expect(scrobble).toHaveBeenCalledWith({
      id: "song-1",
      submission: true,
      time: 1000,
    });
    expect(scrobble).toHaveBeenCalledWith({
      id: "song-2",
      submission: true,
      time: 2000,
    });
    expect(removePendingScrobble).toHaveBeenCalledWith(1);
    expect(removePendingScrobble).toHaveBeenCalledWith(2);
    expect(incrementPendingScrobbleAttempts).not.toHaveBeenCalled();
  });

  it("should increment attempts if scrobble fails and continue to next item", async () => {
    (getPendingScrobbles as jest.Mock).mockReturnValue([
      { id: 1, songId: "song-1", timestamp: 1000, attempts: 0, createdAt: 1000 },
      { id: 2, songId: "song-2", timestamp: 2000, attempts: 1, createdAt: 2000 },
    ]);
    (scrobble as jest.Mock)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(true);

    const result = await syncPendingScrobbles();

    expect(result).toEqual({ synced: 1, failed: 1 });
    expect(incrementPendingScrobbleAttempts).toHaveBeenCalledWith(1);
    expect(removePendingScrobble).not.toHaveBeenCalledWith(1);
    expect(removePendingScrobble).toHaveBeenCalledWith(2);
  });

  it("should prevent concurrent sync invocations", async () => {
    let resolveFirst: (val: any) => void;
    const promise = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    (getPendingScrobbles as jest.Mock).mockReturnValue([
      { id: 1, songId: "song-1", timestamp: 1000, attempts: 0, createdAt: 1000 },
    ]);
    (scrobble as jest.Mock).mockImplementationOnce(() => promise);

    const sync1 = syncPendingScrobbles();
    const sync2 = syncPendingScrobbles();

    expect(await sync2).toEqual({ synced: 0, failed: 0 });

    resolveFirst!(true);
    const res1 = await sync1;
    expect(res1).toEqual({ synced: 1, failed: 0 });
  });
});
