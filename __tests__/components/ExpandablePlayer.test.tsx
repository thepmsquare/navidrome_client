import React from "react";
import { BackHandler } from "react-native";
import renderer, { act } from "react-test-renderer";

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: {
      View,
    },
    useSharedValue: (init: any) => ({ value: init }),
    useAnimatedStyle: (fn: any) => fn(),
    withSpring: (val: any, _cfg?: any, cb?: any) => {
      if (cb) cb(true);
      return val;
    },
    runOnJS: (fn: any) => fn,
    interpolate: (_v: any, _inR: any, outR: any) => outR[0],
  };
});

let capturedExpandPan: any = null;
let capturedCollapsePan: any = null;

jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    GestureDetector: ({ children, gesture }: any) =>
      React.createElement(View, { testID: "gesture-detector", gesture }, children),
    Gesture: {
      Pan: () => {
        const panObj: any = {
          enabled: () => panObj,
          activeOffsetY: (offsets: [number, number]) => {
            if (offsets[0] === -999) {
              capturedCollapsePan = panObj;
            } else {
              capturedExpandPan = panObj;
            }
            return panObj;
          },
          failOffsetX: () => panObj,
          onUpdate: (cb: any) => {
            panObj._onUpdate = cb;
            return panObj;
          },
          onEnd: (cb: any) => {
            panObj._onEnd = cb;
            return panObj;
          },
        };
        return panObj;
      },
    },
  };
});

const mockSetMiniPlayerHeight = jest.fn();
const mockSetIsExpanded = jest.fn();
const mockRegisterHandlers = jest.fn();
let mockOverlayState = {
  bottomBarHeight: 80,
  miniPlayerHeight: 67,
  setMiniPlayerHeight: mockSetMiniPlayerHeight,
  isExpanded: false,
  setIsExpanded: mockSetIsExpanded,
  registerHandlers: mockRegisterHandlers,
};

jest.mock("@/contexts/PlayerOverlayContext", () => ({
  usePlayerOverlay: () => mockOverlayState,
}));

jest.mock("@/services/player", () => ({
  usePlayerState: jest.fn(),
}));

jest.mock("@/utils/haptics", () => ({
  triggerHapticSelection: jest.fn(),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 24, left: 0, right: 0 }),
}));

let capturedPlayerContentProps: any = null;
let capturedMiniPlayerProps: any = null;

jest.mock("@/app/player", () => ({
  PlayerContent: (props: any) => {
    capturedPlayerContentProps = props;
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, { testID: "mock-player-content" });
  },
}));

jest.mock("@/components/MiniPlayer", () => ({
  MiniPlayer: (props: any) => {
    capturedMiniPlayerProps = props;
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, { testID: "mock-mini-player" });
  },
}));

import { ExpandablePlayer } from "@/components/ExpandablePlayer";
import { usePlayerState } from "@/services/player";

describe("ExpandablePlayer", () => {
  let backHandlerCallback: (() => boolean) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedExpandPan = null;
    capturedCollapsePan = null;
    capturedPlayerContentProps = null;
    capturedMiniPlayerProps = null;
    backHandlerCallback = null;
    mockOverlayState = {
      bottomBarHeight: 80,
      miniPlayerHeight: 67,
      setMiniPlayerHeight: mockSetMiniPlayerHeight,
      isExpanded: false,
      setIsExpanded: mockSetIsExpanded,
      registerHandlers: mockRegisterHandlers,
    };
    (usePlayerState as jest.Mock).mockReturnValue({
      currentTrack: { id: "song-1", title: "test track" },
    });
    jest.spyOn(BackHandler, "addEventListener").mockImplementation((_e: any, cb: any) => {
      backHandlerCallback = cb;
      return { remove: jest.fn() } as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns null when not visible, no track, or bottomBarHeight is 0", () => {
    let tree: any;
    act(() => {
      tree = renderer.create(<ExpandablePlayer visible={false} />);
    });
    expect(tree.toJSON()).toBeNull();

    (usePlayerState as jest.Mock).mockReturnValue({ currentTrack: null });
    act(() => {
      tree = renderer.create(<ExpandablePlayer visible={true} />);
    });
    expect(tree.toJSON()).toBeNull();

    (usePlayerState as jest.Mock).mockReturnValue({
      currentTrack: { id: "song-1", title: "test track" },
    });
    mockOverlayState.bottomBarHeight = 0;
    act(() => {
      tree = renderer.create(<ExpandablePlayer visible={true} />);
    });
    expect(tree.toJSON()).toBeNull();
  });

  it("renders both MiniPlayer and PlayerContent and registers handlers", () => {
    let tree: any;
    act(() => {
      tree = renderer.create(<ExpandablePlayer visible={true} />);
    });

    expect(tree.root.findByProps({ testID: "mock-mini-player" })).toBeDefined();
    expect(tree.root.findByProps({ testID: "mock-player-content" })).toBeDefined();
    expect(mockRegisterHandlers).toHaveBeenCalled();
    expect(capturedMiniPlayerProps.disableVerticalGesture).toBe(true);
  });

  it("expands when MiniPlayer onExpand is called or swiped up past threshold", () => {
    act(() => {
      renderer.create(<ExpandablePlayer visible={true} />);
    });

    act(() => {
      capturedMiniPlayerProps.onExpand();
    });
    expect(mockSetIsExpanded).toHaveBeenCalledWith(true);

    mockSetIsExpanded.mockClear();
    act(() => {
      capturedExpandPan._onUpdate({ translationY: -300 });
      capturedExpandPan._onEnd({ translationY: -300, velocityY: -200 });
    });
    expect(mockSetIsExpanded).toHaveBeenCalledWith(true);
  });

  it("does not expand on small upward drag", () => {
    act(() => {
      renderer.create(<ExpandablePlayer visible={true} />);
    });

    act(() => {
      capturedExpandPan._onUpdate({ translationY: -20 });
      capturedExpandPan._onEnd({ translationY: -20, velocityY: -50 });
    });
    expect(mockSetIsExpanded).not.toHaveBeenCalledWith(true);
  });

  it("collapses on downward swipe past threshold or hardware back when expanded", () => {
    mockOverlayState.isExpanded = true;
    act(() => {
      renderer.create(<ExpandablePlayer visible={true} />);
    });

    act(() => {
      capturedCollapsePan._onUpdate({ translationY: 300 });
      capturedCollapsePan._onEnd({ translationY: 300, velocityY: 200 });
    });
    expect(mockSetIsExpanded).toHaveBeenCalledWith(false);

    mockSetIsExpanded.mockClear();
    expect(typeof backHandlerCallback).toBe("function");
    act(() => {
      const handled = backHandlerCallback!();
      expect(handled).toBe(true);
    });
    expect(mockSetIsExpanded).toHaveBeenCalledWith(false);
  });
});
