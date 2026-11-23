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
    withTiming: (val: any, _cfg: any, cb?: any) => {
      if (cb) cb(true);
      return val;
    },
    withSpring: (val: any) => val,
    runOnJS: (fn: any) => fn,
    interpolate: (_v: any, _inR: any, outR: any) => outR[0],
  };
});

let capturedPan: any = null;

jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    GestureDetector: ({ children, gesture }: any) => {
      return React.createElement(View, { testID: "gesture-detector", gesture }, children);
    },
    Gesture: {
      Pan: () => {
        const panObj: any = {
          activeOffsetX: () => panObj,
          failOffsetY: () => panObj,
          onUpdate: (cb: any) => {
            panObj._onUpdate = cb;
            return panObj;
          },
          onEnd: (cb: any) => {
            panObj._onEnd = cb;
            return panObj;
          },
        };
        capturedPan = panObj;
        return panObj;
      },
    },
  };
});

import { MiniPlayer } from "@/components/MiniPlayer";
import { playNext, playPrevious, togglePlayback, usePlayerState } from "@/services/player";
import { Child } from "@/types";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock("expo-image", () => ({
  Image: "Image",
}));

jest.mock("@/services/api", () => ({
  getCoverArtBaseUrl: jest.fn(async () => (id?: string | null) => (id ? `https://art/${id}` : null)),
}));

jest.mock("@/services/player", () => ({
  usePlayerState: jest.fn(),
  togglePlayback: jest.fn().mockResolvedValue(undefined),
  playNext: jest.fn().mockResolvedValue(undefined),
  playPrevious: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/utils/haptics", () => ({
  triggerHapticSelection: jest.fn(),
}));

const mockTrack: Child = {
  id: "song-1",
  title: "comfortably numb",
  artist: "pink floyd",
  album: "the wall",
  coverArt: "art-1",
  duration: 382,
};

describe("MiniPlayer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null if no current track", async () => {
    (usePlayerState as jest.Mock).mockReturnValue({
      currentTrack: null,
      isPlaying: false,
      isBuffering: false,
      position: 0,
      duration: 0,
      isPlayingFromCache: false,
    });

    let component: any;
    await renderer.act(async () => {
      component = renderer.create(<MiniPlayer />);
    });

    expect(component.toJSON()).toBeNull();

    await renderer.act(async () => {
      component.unmount();
    });
  });

  it("renders track title and artist when playing", async () => {
    (usePlayerState as jest.Mock).mockReturnValue({
      currentTrack: mockTrack,
      isPlaying: true,
      isBuffering: false,
      position: 100,
      duration: 382,
      isPlayingFromCache: false,
    });

    let component: any;
    await renderer.act(async () => {
      component = renderer.create(<MiniPlayer />);
    });

    const tree = component.toJSON();
    expect(JSON.stringify(tree)).toContain("comfortably numb");
    expect(JSON.stringify(tree)).toContain("pink floyd");

    await renderer.act(async () => {
      component.unmount();
    });
  });

  it("navigates to /player when track area is pressed", async () => {
    (usePlayerState as jest.Mock).mockReturnValue({
      currentTrack: mockTrack,
      isPlaying: true,
      isBuffering: false,
      position: 100,
      duration: 382,
      isPlayingFromCache: false,
    });

    let component: any;
    await renderer.act(async () => {
      component = renderer.create(<MiniPlayer />);
    });

    const trackPressable = component.root.findByProps({ testID: "mini-player-track" });
    await renderer.act(async () => {
      trackPressable.props.onPress();
    });

    expect(mockPush).toHaveBeenCalledWith("/player");

    await renderer.act(async () => {
      component.unmount();
    });
  });

  it("toggles playback when play/pause button is pressed", async () => {
    (usePlayerState as jest.Mock).mockReturnValue({
      currentTrack: mockTrack,
      isPlaying: true,
      isBuffering: false,
      position: 100,
      duration: 382,
      isPlayingFromCache: false,
    });

    let component: any;
    await renderer.act(async () => {
      component = renderer.create(<MiniPlayer />);
    });

    const actionButton = component.root.findByProps({ accessibilityLabel: "pause" });
    await renderer.act(async () => {
      actionButton.props.onPress();
    });

    expect(togglePlayback).toHaveBeenCalled();

    await renderer.act(async () => {
      component.unmount();
    });
  });

  it("triggers playNext when swiped left past threshold", async () => {
    (usePlayerState as jest.Mock).mockReturnValue({
      currentTrack: mockTrack,
      isPlaying: true,
      isBuffering: false,
      position: 100,
      duration: 382,
      isPlayingFromCache: false,
    });

    let component: any;
    await renderer.act(async () => {
      component = renderer.create(<MiniPlayer />);
    });

    expect(capturedPan).toBeDefined();

    await renderer.act(async () => {
      capturedPan._onEnd({
        translationX: -80,
        velocityX: -600,
      });
    });

    expect(playNext).toHaveBeenCalled();

    await renderer.act(async () => {
      component.unmount();
    });
  });

  it("triggers playPrevious when swiped right past threshold", async () => {
    (usePlayerState as jest.Mock).mockReturnValue({
      currentTrack: mockTrack,
      isPlaying: true,
      isBuffering: false,
      position: 100,
      duration: 382,
      isPlayingFromCache: false,
    });

    let component: any;
    await renderer.act(async () => {
      component = renderer.create(<MiniPlayer />);
    });

    expect(capturedPan).toBeDefined();

    await renderer.act(async () => {
      capturedPan._onEnd({
        translationX: 80,
        velocityX: 600,
      });
    });

    expect(playPrevious).toHaveBeenCalled();

    await renderer.act(async () => {
      component.unmount();
    });
  });
});
