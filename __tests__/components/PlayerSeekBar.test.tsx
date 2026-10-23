import React from "react";
import renderer from "react-test-renderer";

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: {
      View,
    },
    useSharedValue: (init: any) => ({ value: init }),
    useAnimatedStyle: (fn: any) => fn(),
    withTiming: (val: any) => val,
    withSpring: (val: any) => val,
    runOnJS: (fn: any) => fn,
  };
});

jest.mock("react-native-gesture-handler", () => {
  const View = require("react-native").View;
  return {
    GestureDetector: ({ children }: any) => children,
    Gesture: {
      Pan: () => {
        const pan: any = {
          minDistance: () => pan,
          onBegin: () => pan,
          onUpdate: () => pan,
          onFinalize: () => pan,
        };
        return pan;
      },
    },
  };
});

import { PlayerSeekBar } from "@/components/PlayerSeekBar";

jest.mock("@/utils/haptics", () => ({
  triggerHapticSelection: jest.fn(),
  triggerHapticImpact: jest.fn(),
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/types", () => ({
  useAppTheme: () => ({
    colors: {
      primary: "#6750A4",
      secondary: "#625B71",
      tertiary: "#7D5260",
      surfaceContainerHighest: "#E6E0E9",
      inverseSurface: "#313033",
      inverseOnSurface: "#F4EFF4",
    },
  }),
}));

describe("PlayerSeekBar", () => {
  it("renders with correct accessibility attributes", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <PlayerSeekBar
          position={45}
          duration={180}
          onSeek={jest.fn()}
        />,
      );
    });

    const touchArea = component.root.findByProps({
      accessibilityLabel: "song progress",
    });
    expect(touchArea).toBeDefined();
    expect(touchArea.props.accessibilityRole).toBe("adjustable");
    expect(touchArea.props.accessibilityValue).toEqual({
      min: 0,
      max: 180,
      now: 45,
      text: "0:45 of 3:00",
    });
  });

  it("handles accessibility increment and decrement actions", () => {
    const onSeek = jest.fn();
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <PlayerSeekBar
          position={50}
          duration={100}
          onSeek={onSeek}
        />,
      );
    });

    const touchArea = component.root.findByProps({
      accessibilityLabel: "song progress",
    });

    // Test increment (+10s)
    renderer.act(() => {
      touchArea.props.onAccessibilityAction({
        nativeEvent: { actionName: "increment" },
      });
    });
    expect(onSeek).toHaveBeenCalledWith(60);

    // Test decrement (-10s)
    renderer.act(() => {
      touchArea.props.onAccessibilityAction({
        nativeEvent: { actionName: "decrement" },
      });
    });
    expect(onSeek).toHaveBeenCalledWith(40);
  });

  it("clamps accessibility seek within [0, duration]", () => {
    const onSeek = jest.fn();
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <PlayerSeekBar
          position={95}
          duration={100}
          onSeek={onSeek}
        />,
      );
    });

    const touchArea = component.root.findByProps({
      accessibilityLabel: "song progress",
    });

    // Incrementing past duration clamps to duration
    renderer.act(() => {
      touchArea.props.onAccessibilityAction({
        nativeEvent: { actionName: "increment" },
      });
    });
    expect(onSeek).toHaveBeenCalledWith(100);

    // Decrementing below 0 clamps to 0
    let zeroComponent: any;
    renderer.act(() => {
      zeroComponent = renderer.create(
        <PlayerSeekBar
          position={5}
          duration={100}
          onSeek={onSeek}
        />,
      );
    });
    const zeroTouchArea = zeroComponent.root.findByProps({
      accessibilityLabel: "song progress",
    });
    renderer.act(() => {
      zeroTouchArea.props.onAccessibilityAction({
        nativeEvent: { actionName: "decrement" },
      });
    });
    expect(onSeek).toHaveBeenCalledWith(0);
  });
});
