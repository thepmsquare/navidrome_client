import React from "react";
import { AppState } from "react-native";
import renderer, { act } from "react-test-renderer";

import MainLayout, {
  _resetAutoRefreshStateForTesting,
  triggerAutoPlayStatsRefresh,
} from "@/app/(main)/_layout";
import * as api from "@/services/api";

jest.mock("expo-router", () => {
  const React = require("react");
  const MockTabs = ({ children }: any) => <>{children}</>;
  MockTabs.Screen = () => null;
  return {
    Tabs: MockTabs,
    useRouter: () => ({
      replace: jest.fn(),
    }),
  };
});

jest.mock("@/components/AppBottomBar", () => ({
  AppBottomBar: () => null,
}));

jest.mock("@/services/api", () => ({
  getStoredCredentials: jest.fn().mockResolvedValue({
    serverUrl: "https://example.com",
    username: "user1",
    password: "password1",
  }),
  refreshPlayStats: jest.fn().mockResolvedValue({
    refreshed: true,
    albumsUpdated: 0,
    songsUpdated: 0,
  }),
  isSyncInProgress: jest.fn().mockReturnValue(false),
  subscribeSyncState: jest.fn().mockReturnValue(jest.fn()),
  client_app_sync: jest.fn().mockResolvedValue({ synced: true }),
}));

describe("MainLayout auto play-stats refresh", () => {
  let appStateListeners: ((state: string) => void)[] = [];
  const mockRemove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    _resetAutoRefreshStateForTesting();
    appStateListeners = [];
    mockRemove.mockClear();

    (api.getStoredCredentials as jest.Mock).mockResolvedValue({
      serverUrl: "https://example.com",
      username: "user1",
      password: "password1",
    });

    (api.refreshPlayStats as jest.Mock).mockResolvedValue({
      refreshed: true,
      albumsUpdated: 0,
      songsUpdated: 0,
    });

    jest.spyOn(AppState, "addEventListener").mockImplementation((event: string, cb: any) => {
      if (event === "change") {
        appStateListeners.push(cb);
      }
      return {
        remove: () => {
          mockRemove();
          appStateListeners = appStateListeners.filter((l) => l !== cb);
        },
      } as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("refresh fires on mount and on foreground", async () => {
    let testRenderer: any;
    await act(async () => {
      testRenderer = renderer.create(<MainLayout />);
    });

    expect(api.refreshPlayStats).toHaveBeenCalledTimes(1);

    // Fast-forward past the 60s cooldown
    jest.spyOn(Date, "now").mockReturnValue(Date.now() + 65000);

    // Simulate foreground
    await act(async () => {
      appStateListeners.forEach((listener) => listener("active"));
    });

    expect(api.refreshPlayStats).toHaveBeenCalledTimes(2);

    await act(async () => {
      testRenderer.unmount();
    });
  });

  it("cooldown blocks a second call within 60s", async () => {
    const startTime = 1000000;
    jest.spyOn(Date, "now").mockReturnValue(startTime);

    let testRenderer: any;
    await act(async () => {
      testRenderer = renderer.create(<MainLayout />);
    });

    expect(api.refreshPlayStats).toHaveBeenCalledTimes(1);

    // Advance by only 30s (< 60s cooldown)
    jest.spyOn(Date, "now").mockReturnValue(startTime + 30000);

    await act(async () => {
      appStateListeners.forEach((listener) => listener("active"));
    });

    // Still only 1 call
    expect(api.refreshPlayStats).toHaveBeenCalledTimes(1);

    // Advance past 60s (e.g. 61s)
    jest.spyOn(Date, "now").mockReturnValue(startTime + 61000);

    await act(async () => {
      appStateListeners.forEach((listener) => listener("active"));
    });

    // Now second call goes through
    expect(api.refreshPlayStats).toHaveBeenCalledTimes(2);

    await act(async () => {
      testRenderer.unmount();
    });
  });

  it("in-flight guard prevents duplicate concurrent calls", async () => {
    let resolveRefresh: (val: any) => void;
    const refreshPromise = new Promise((resolve) => {
      resolveRefresh = resolve;
    });
    (api.refreshPlayStats as jest.Mock).mockReturnValue(refreshPromise);

    // First call begins and is in flight
    const call1 = triggerAutoPlayStatsRefresh();
    // Second call attempted while first is still pending
    const call2 = triggerAutoPlayStatsRefresh();

    // Flush microtasks
    await Promise.resolve();

    expect(api.refreshPlayStats).toHaveBeenCalledTimes(1);

    // Resolve first call
    resolveRefresh!({ refreshed: true, albumsUpdated: 0, songsUpdated: 0 });
    await Promise.all([call1, call2]);

    expect(api.refreshPlayStats).toHaveBeenCalledTimes(1);
  });

  it("not called when logged out (missing credentials)", async () => {
    (api.getStoredCredentials as jest.Mock).mockRejectedValueOnce(
      new Error("missing stored credentials"),
    );

    let testRenderer: any;
    await act(async () => {
      testRenderer = renderer.create(<MainLayout />);
    });

    expect(api.refreshPlayStats).not.toHaveBeenCalled();

    await act(async () => {
      testRenderer.unmount();
    });
  });

  it("listeners removed on unmount", async () => {
    let testRenderer: any;
    await act(async () => {
      testRenderer = renderer.create(<MainLayout />);
    });

    expect(mockRemove).toHaveBeenCalledTimes(0);

    await act(async () => {
      testRenderer.unmount();
    });

    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it("does not throw or display errors if refresh fails", async () => {
    (api.refreshPlayStats as jest.Mock).mockRejectedValueOnce(
      new Error("network exploded"),
    );

    // Should resolve cleanly without throwing
    await expect(triggerAutoPlayStatsRefresh()).resolves.toBeUndefined();
  });
});
