import React from "react";
import renderer, { act } from "react-test-renderer";

import RootLayout from "@/app/_layout";
import { runLegacyMigration } from "@/services/migration";
import { showSnackbar } from "@/services/snackbar";
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

let capturedChangelogProps: any = null;
jest.mock("@/components/ChangelogModal", () => ({
  ChangelogModal: (props: any) => {
    capturedChangelogProps = props;
    return null;
  },
}));

let capturedLegacyModalProps: any = null;
jest.mock("@/components/LegacyOfflineDownloadsModal", () => ({
  LegacyOfflineDownloadsModal: (props: any) => {
    capturedLegacyModalProps = props;
    return null;
  },
}));

jest.mock("@/components/ExpandablePlayer", () => ({
  ExpandablePlayer: () => null,
}));

jest.mock("react-native-gesture-handler", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  const { View } = require("react-native");
  return {
    GestureHandlerRootView: ({
      children,
      ...props
    }: {
      children?: React.ReactNode;
    }) => React.createElement(View, props, children),
  };
});

jest.mock("react-native-safe-area-context", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  const { View } = require("react-native");
  const insets = { top: 0, bottom: 0, left: 0, right: 0 };
  const SafeAreaInsetsContext = React.createContext(insets);
  return {
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, null, children),
    SafeAreaView: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement(View, props, children),
    SafeAreaInsetsContext,
    initialWindowMetrics: {
      insets,
      frame: { x: 0, y: 0, width: 390, height: 844 },
    },
    useSafeAreaInsets: () => insets,
  };
});

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
    capturedChangelogProps = null;
    capturedLegacyModalProps = null;
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

  it("auto-deletes legacy offline downloads on launch and informs the user", async () => {
    mockCheckLegacyOfflineCache.mockResolvedValueOnce({
      exists: true,
      sizeBytes: 52428800,
      uri: "file:///test/offline",
    });

    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(<RootLayout />);
    });

    expect(mockDeleteLegacyOfflineCache).toHaveBeenCalledTimes(1);
    expect(mockSetItem).toHaveBeenCalledWith(
      "legacy_cache_cleared_bytes",
      "52428800",
    );
    expect(capturedLegacyModalProps?.visible).toBe(true);
    expect(capturedLegacyModalProps?.sizeBytes).toBe(52428800);

    await act(async () => {
      capturedLegacyModalProps?.onDismiss?.();
    });

    expect(capturedLegacyModalProps?.visible).toBe(false);

    await act(async () => {
      tree!.unmount();
    });
  });

  it("subscribes to global snackbar on mount and unsubscribes on unmount", async () => {
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(<RootLayout />);
    });

    await act(async () => {
      showSnackbar("unable to connect to server");
    });

    await act(async () => {
      tree!.unmount();
    });
  });

  it("defers legacy offline modal until ChangelogModal is dismissed", async () => {
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
    mockCheckLegacyOfflineCache.mockResolvedValueOnce({
      exists: true,
      sizeBytes: 1024,
      uri: "file:///test/offline",
    });

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<RootLayout />);
    });

    expect(capturedChangelogProps?.visible).toBe(true);
    expect(capturedLegacyModalProps?.visible).toBe(false);

    await act(async () => {
      capturedChangelogProps.onDismiss();
    });

    expect(capturedLegacyModalProps?.visible).toBe(true);
    expect(capturedLegacyModalProps?.sizeBytes).toBe(1024);

    await act(async () => {
      tree!.unmount();
    });
  });

  it("persists dismissal and skips legacy modal on future launches", async () => {
    mockCheckLegacyOfflineCache.mockResolvedValue({
      exists: true,
      sizeBytes: 2048,
      uri: "file:///test/offline",
    });

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<RootLayout />);
    });

    expect(capturedLegacyModalProps?.visible).toBe(true);

    await act(async () => {
      capturedLegacyModalProps?.onDismiss?.();
    });

    expect(mockSetItem).toHaveBeenCalledWith(
      "legacy_cache_prompt_dismissed",
      "true",
    );
    expect(capturedLegacyModalProps?.visible).toBe(false);

    await act(async () => {
      tree!.unmount();
    });

    // Simulate next launch where SecureStore returns "true" for dismissal
    capturedLegacyModalProps = null;
    mockGetItem.mockImplementation(async (key: string) =>
      key === "legacy_cache_prompt_dismissed" ? "true" : null,
    );

    await act(async () => {
      tree = renderer.create(<RootLayout />);
    });

    expect(capturedLegacyModalProps?.visible).toBe(false);

    await act(async () => {
      tree!.unmount();
    });
  });
});
