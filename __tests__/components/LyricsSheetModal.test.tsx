import React from "react";
import renderer, { act } from "react-test-renderer";

import { LyricsSheetModal } from "@/components/LyricsSheetModal";
import { seekToPosition } from "@/services/player";
import { NormalizedLyrics } from "@/types";

jest.mock("@/services/player", () => ({
  seekToPosition: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 20, left: 0, right: 0 }),
}));

jest.mock("react-native-paper", () => {
  const actual = jest.requireActual("react-native-paper");
  return {
    ...actual,
    Portal: ({ children }: any) => children,
    Modal: ({ visible, children }: any) => (visible ? children : null),
  };
});

describe("LyricsSheetModal", () => {
  const mockDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("should not render contents when not visible", () => {
    let component: any;
    act(() => {
      component = renderer.create(
        <LyricsSheetModal
          visible={false}
          onDismiss={mockDismiss}
          lyrics={null}
        />,
      );
    });

    expect(component.toJSON()).toBeNull();
  });

  it("should render loading state when isLoading is true", () => {
    let component: any;
    act(() => {
      component = renderer.create(
        <LyricsSheetModal
          visible={true}
          onDismiss={mockDismiss}
          lyrics={null}
          isLoading={true}
        />,
      );
    });

    const json = JSON.stringify(component.toJSON());
    expect(json).toContain("loading lyrics...");
  });

  it("should render empty state when no lyrics available", () => {
    let component: any;
    act(() => {
      component = renderer.create(
        <LyricsSheetModal
          visible={true}
          onDismiss={mockDismiss}
          lyrics={null}
          isLoading={false}
        />,
      );
    });

    const json = JSON.stringify(component.toJSON());
    expect(json).toContain("no lyrics available");
  });

  it("should render lyrics lines and preserve original casing", () => {
    const mockLyrics: NormalizedLyrics = {
      synced: true,
      lines: [
        { startMs: 1200, text: "Is this the Real Life?" },
        { startMs: 3400, text: "Is this just fantasy?" },
      ],
    };

    let component: any;
    act(() => {
      component = renderer.create(
        <LyricsSheetModal
          visible={true}
          onDismiss={mockDismiss}
          lyrics={mockLyrics}
          isLoading={false}
          positionSeconds={1.5}
        />,
      );
    });

    const json = JSON.stringify(component.toJSON());
    expect(json).toContain("Is this the Real Life?");
    expect(json).toContain("Is this just fantasy?");
    expect(json).toContain("lyrics");
  });

  it("should support tap-to-seek on synced lines accounting for offset", async () => {
    const mockLyrics: NormalizedLyrics = {
      synced: true,
      offsetMs: 200,
      lines: [
        { startMs: 1200, text: "line 1" },
        { startMs: 5200, text: "line 2" },
      ],
    };

    let root: any;
    act(() => {
      root = renderer.create(
        <LyricsSheetModal
          visible={true}
          onDismiss={mockDismiss}
          lyrics={mockLyrics}
          positionSeconds={1.0}
        />,
      );
    });

    const lineBtn = root.root.findByProps({
      accessibilityLabel: "lyrics line: line 2",
    });
    expect(lineBtn).toBeDefined();

    await act(async () => {
      lineBtn.props.onPress();
    });

    // targetSeconds = (5200 - 200) / 1000 = 5.0
    expect(seekToPosition).toHaveBeenCalledWith(5);
  });

  it("should keep unsynced lyrics plain without tap-to-seek pressables", () => {
    const mockLyrics: NormalizedLyrics = {
      synced: false,
      lines: [{ text: "plain unsynced line" }],
    };

    let root: any;
    act(() => {
      root = renderer.create(
        <LyricsSheetModal
          visible={true}
          onDismiss={mockDismiss}
          lyrics={mockLyrics}
        />,
      );
    });

    const pressables = root.root.findAllByProps({
      accessibilityLabel: "lyrics line: plain unsynced line",
    });
    expect(pressables).toHaveLength(0);

    const json = JSON.stringify(root.toJSON());
    expect(json).toContain("plain unsynced line");
  });

  it("should show jump to current button when dragging synced lyrics and resume on click", async () => {
    const mockLyrics: NormalizedLyrics = {
      synced: true,
      lines: [
        { startMs: 1000, text: "line 1" },
        { startMs: 3000, text: "line 2" },
      ],
    };

    let root: any;
    act(() => {
      root = renderer.create(
        <LyricsSheetModal
          visible={true}
          onDismiss={mockDismiss}
          lyrics={mockLyrics}
          positionSeconds={1.5}
        />,
      );
    });

    // Before drag: no jump button
    expect(
      root.root.findAllByProps({ accessibilityLabel: "jump to current" }),
    ).toHaveLength(0);

    // Simulate drag on FlatList
    const flatList = root.root.findByType("RCTScrollView");
    act(() => {
      flatList.props.onScrollBeginDrag();
    });

    // Now jump button should be present
    const jumpBtn = root.root.findByProps({
      accessibilityLabel: "jump to current",
    });
    expect(jumpBtn).toBeDefined();

    // Press jump button
    act(() => {
      jumpBtn.props.onPress();
    });

    // Jump button is hidden again
    expect(
      root.root.findAllByProps({ accessibilityLabel: "jump to current" }),
    ).toHaveLength(0);
  });

  it("should not show jump button when dragging unsynced lyrics", () => {
    const mockLyrics: NormalizedLyrics = {
      synced: false,
      lines: [{ text: "unsynced line" }],
    };

    let root: any;
    act(() => {
      root = renderer.create(
        <LyricsSheetModal
          visible={true}
          onDismiss={mockDismiss}
          lyrics={mockLyrics}
        />,
      );
    });

    const flatList = root.root.findByType("RCTScrollView");
    act(() => {
      flatList.props.onScrollBeginDrag();
    });

    expect(
      root.root.findAllByProps({ accessibilityLabel: "jump to current" }),
    ).toHaveLength(0);
  });
});
