import React from "react";
import renderer, { act } from "react-test-renderer";

import RootLayout from "@/app/_layout";
import { runLegacyMigration } from "@/services/migration";
import * as SecureStore from "expo-secure-store";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

jest.mock("@/services/migration", () => ({
  runLegacyMigration: jest.fn(),
}));

jest.mock("@/services/api", () => ({
  subscribeAuthState: jest.fn(() => jest.fn()),
}));

jest.mock("@/services/songCache", () => ({
  resumePendingDownloadsAfterRestart: jest.fn(),
}));

jest.mock("@/components/ChangelogModal", () => ({
  ChangelogModal: () => null,
}));

jest.mock("@pchmn/expo-material3-theme", () => ({
  useMaterial3Theme: () => ({ theme: { dark: {}, light: {} } }),
}));

const mockCheckLegacyOfflineCache = jest.fn().mockResolvedValue({
  exists: false,
  sizeBytes: 0,
  uri: null,
});
const mockDeleteLegacyOfflineCache = jest.fn().mockResolvedValue({
  success: true,
});

jest.mock("@/services/legacyCache", () => ({
  checkLegacyOfflineCache: () => mockCheckLegacyOfflineCache(),
  deleteLegacyOfflineCache: () => mockDeleteLegacyOfflineCache(),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  formatBytes: (bytes: number) => `${bytes} b`,
}));

const mockReplace = jest.fn();

jest.mock("expo-router", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  const Stack = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  // eslint-disable-next-line react/display-name
  Stack.Screen = () => null;
  return {
    Stack,
    useRouter: () => ({ replace: mockReplace }),
    useSegments: () => [],
  };
});

const mockMigrate = runLegacyMigration as jest.Mock;
const mockGetItem = SecureStore.getItemAsync as jest.Mock;
const mockSetItem = SecureStore.setItemAsync as jest.Mock;

describe("RootLayout credential migration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMigrate.mockResolvedValue({ status: "already-complete" });
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
  });

  it("runs the migration before restoring the session", async () => {
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(<RootLayout />);
    });

    expect(mockMigrate).toHaveBeenCalledTimes(1);

    const sessionRestoreCall = mockGetItem.mock.calls.findIndex(
      ([key]) => key === "subsonicVersion",
    );
    expect(sessionRestoreCall).toBeGreaterThanOrEqual(0);

    const migrationOrder = mockMigrate.mock.invocationCallOrder[0];
    const restoreOrder =
      mockGetItem.mock.invocationCallOrder[sessionRestoreCall];
    expect(migrationOrder).toBeLessThan(restoreOrder);
    expect(mockReplace).toHaveBeenCalledWith("/connect");

    await act(async () => {
      tree!.unmount();
    });
  });

  it("sends the user to connect when unreadable prefs skip the migration", async () => {
    mockMigrate.mockResolvedValue({
      status: "migrated",
      credentials: { status: "skipped", reason: "unreadable-prefs" },
      settings: { status: "skipped", reason: "unreadable-prefs" },
    });

    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(<RootLayout />);
    });

    expect(mockReplace).toHaveBeenCalledWith("/connect");

    await act(async () => {
      tree!.unmount();
    });
  });

  it("still restores the session when the migration throws", async () => {
    mockMigrate.mockRejectedValue(new Error("migration boom"));
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(<RootLayout />);
    });

    expect(mockGetItem).toHaveBeenCalledWith("serverUrl");
    expect(consoleError).toHaveBeenCalledWith(
      "failed to run legacy migration:",
      expect.any(Error),
    );

    await act(async () => {
      tree!.unmount();
    });

    consoleError.mockRestore();
  });

  it("redirects to the sync screen with initial=true after a successful legacy migration", async () => {
    mockMigrate.mockResolvedValue({
      status: "migrated",
      credentials: {
        status: "migrated",
        serverUrl: "https://music.example.com",
        alternateUrlCount: 0,
      },
      settings: { status: "applied", applied: [] },
    });
    mockGetItem.mockImplementation(async (key: string) => {
      if (
        key === "serverUrl" ||
        key === "subsonicVersion" ||
        key === "username" ||
        key === "password"
      ) {
        return "val";
      }
      return null;
    });

    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(<RootLayout />);
    });

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/sync",
      params: { initial: "true" },
    });

    await act(async () => {
      tree!.unmount();
    });
  });

  it("prompts the user to clean up legacy offline downloads when detected on launch", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const alertSpy = jest.spyOn(require("react-native").Alert, "alert");
    mockCheckLegacyOfflineCache.mockResolvedValueOnce({
      exists: true,
      sizeBytes: 52428800,
      uri: "file:///test/offline",
    });

    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(<RootLayout />);
    });

    expect(alertSpy).toHaveBeenCalledWith(
      "legacy offline downloads detected",
      expect.stringContaining("52428800 b"),
      expect.arrayContaining([
        expect.objectContaining({ text: "not now", style: "cancel" }),
        expect.objectContaining({ text: "delete and reclaim space" }),
      ]),
    );

    const deleteButton = (alertSpy.mock.calls[0][2] as any[])?.find(
      (btn: any) => btn.text === "delete and reclaim space",
    );
    expect(deleteButton).toBeDefined();

    await act(async () => {
      await deleteButton?.onPress?.();
    });

    expect(mockDeleteLegacyOfflineCache).toHaveBeenCalled();

    await act(async () => {
      tree!.unmount();
    });

    alertSpy.mockRestore();
  });
});
