import React from "react";
import renderer, { act } from "react-test-renderer";

import { SleepTimerModal } from "@/components/SleepTimerModal";
import {
  cancelSleepTimer,
  setDurationTimer,
  setEndOfTrackTimer,
  useSleepTimer,
} from "@/services/sleepTimer";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("react-native-paper", () => {
  const actual = jest.requireActual("react-native-paper");
  return {
    ...actual,
    Portal: ({ children }: any) => children,
  };
});

jest.mock("@/services/sleepTimer", () => ({
  useSleepTimer: jest.fn(),
  setDurationTimer: jest.fn(),
  setEndOfTrackTimer: jest.fn(),
  cancelSleepTimer: jest.fn(),
}));

describe("SleepTimerModal", () => {
  const mockOnDismiss = jest.fn();
  const mockOnTimerSet = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useSleepTimer as jest.Mock).mockReturnValue({
      isActive: false,
      mode: null,
      targetTimestamp: null,
      remainingSeconds: 0,
    });
  });

  it("should render presets and end of track option when visible", () => {
    let tree: any;
    act(() => {
      tree = renderer.create(
        <SleepTimerModal
          visible={true}
          onDismiss={mockOnDismiss}
          onTimerSet={mockOnTimerSet}
        />,
      );
    });

    const str = JSON.stringify(tree.toJSON());
    expect(str).toContain("sleep timer");
    expect(str).toContain("15 minutes");
    expect(str).toContain("30 minutes");
    expect(str).toContain("45 minutes");
    expect(str).toContain("60 minutes");
    expect(str).toContain("end of current track");
    expect(str).toContain("custom minutes");
  });

  it("should select preset duration and notify", () => {
    let root: any;
    act(() => {
      root = renderer.create(
        <SleepTimerModal
          visible={true}
          onDismiss={mockOnDismiss}
          onTimerSet={mockOnTimerSet}
        />,
      );
    });

    const preset30 = root.root.findByProps({
      accessibilityLabel: "30 minutes",
    });
    act(() => {
      preset30.props.onPress();
    });

    expect(setDurationTimer).toHaveBeenCalledWith(30);
    expect(mockOnTimerSet).toHaveBeenCalledWith(
      "sleep timer set for 30 minutes",
    );
    expect(mockOnDismiss).toHaveBeenCalled();
  });

  it("should select end of track and notify", () => {
    let root: any;
    act(() => {
      root = renderer.create(
        <SleepTimerModal
          visible={true}
          onDismiss={mockOnDismiss}
          onTimerSet={mockOnTimerSet}
        />,
      );
    });

    const endOfTrack = root.root.findByProps({
      accessibilityLabel: "end of current track",
    });
    act(() => {
      endOfTrack.props.onPress();
    });

    expect(setEndOfTrackTimer).toHaveBeenCalled();
    expect(mockOnTimerSet).toHaveBeenCalledWith(
      "sleep timer set for end of current track",
    );
    expect(mockOnDismiss).toHaveBeenCalled();
  });

  it("should render active timer banner and allow cancelling timer", () => {
    (useSleepTimer as jest.Mock).mockReturnValue({
      isActive: true,
      mode: "duration",
      targetTimestamp: Date.now() + 600000,
      remainingSeconds: 600,
    });

    let root: any;
    act(() => {
      root = renderer.create(
        <SleepTimerModal
          visible={true}
          onDismiss={mockOnDismiss}
          onTimerSet={mockOnTimerSet}
        />,
      );
    });

    const str = JSON.stringify(root.toJSON());
    expect(str).toContain("timer active");
    expect(str).toContain("10m 00s remaining");

    const turnOffBtn = root.root.findByProps({
      accessibilityLabel: "turn off timer",
    });
    act(() => {
      turnOffBtn.props.onPress();
    });

    expect(cancelSleepTimer).toHaveBeenCalled();
    expect(mockOnTimerSet).toHaveBeenCalledWith("sleep timer turned off");
    expect(mockOnDismiss).toHaveBeenCalled();
  });
});
