import {
  addSyncCancelListener,
  startSyncForegroundService,
  stopSyncForegroundService,
  updateSyncProgress,
} from "@/modules/sync-service";

describe("sync-service module", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("handles missing native module gracefully without throwing", () => {
    expect(() => {
      startSyncForegroundService("syncing library", "testing", 0, 0);
    }).not.toThrow();

    expect(() => {
      updateSyncProgress("syncing library", "testing", 5, 10);
    }).not.toThrow();

    expect(() => {
      stopSyncForegroundService();
    }).not.toThrow();

    expect(() => {
      const listener = addSyncCancelListener(() => {});
      listener.remove();
    }).not.toThrow();
  });

  it("safely returns boolean values when called", () => {
    const started = startSyncForegroundService();
    expect(typeof started).toBe("boolean");

    const updated = updateSyncProgress();
    expect(typeof updated).toBe("boolean");

    const stopped = stopSyncForegroundService();
    expect(typeof stopped).toBe("boolean");
  });
});
