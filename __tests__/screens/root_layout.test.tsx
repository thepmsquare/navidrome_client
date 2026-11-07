import React from "react";
import renderer, { act } from "react-test-renderer";

import RootLayout from "@/app/_layout";
import { migrateLegacyCredentials } from "@/services/migration/credentials";
import * as SecureStore from "expo-secure-store";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

jest.mock("@/services/migration/credentials", () => ({
  migrateLegacyCredentials: jest.fn(),
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

const mockMigrate = migrateLegacyCredentials as jest.Mock;
const mockGetItem = SecureStore.getItemAsync as jest.Mock;
const mockSetItem = SecureStore.setItemAsync as jest.Mock;

describe("RootLayout credential migration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMigrate.mockResolvedValue({ status: "no-legacy-data" });
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
      status: "skipped",
      reason: "unreadable-prefs",
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
      "failed to migrate legacy credentials:",
      expect.any(Error),
    );

    await act(async () => {
      tree!.unmount();
    });

    consoleError.mockRestore();
  });
});
