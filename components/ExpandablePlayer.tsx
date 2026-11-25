import React, { useCallback, useEffect, useState } from "react";
import { BackHandler, Dimensions, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PlayerContent } from "@/app/player";
import { MiniPlayer } from "@/components/MiniPlayer";
import { usePlayerOverlay } from "@/contexts/PlayerOverlayContext";
import { usePlayerState } from "@/services/player";
import { useAppTheme } from "@/types";
import { triggerHapticSelection } from "@/utils/haptics";

const SPRING_CONFIG = {
  damping: 26,
  stiffness: 240,
  overshootClamping: true,
};

const EXPAND_PROGRESS_THRESHOLD = 0.22;
const EXPAND_VELOCITY_THRESHOLD = -450;
const COLLAPSE_PROGRESS_THRESHOLD = 0.78;
const COLLAPSE_VELOCITY_THRESHOLD = 450;

export interface ExpandablePlayerProps {
  visible?: boolean;
}

export function ExpandablePlayer({ visible = true }: ExpandablePlayerProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { currentTrack } = usePlayerState();
  const {
    bottomBarHeight,
    miniPlayerHeight,
    setMiniPlayerHeight,
    isExpanded,
    setIsExpanded,
    registerHandlers,
  } = usePlayerOverlay();

  const [containerHeight, setContainerHeight] = useState(
    () => Dimensions.get("window").height - insets.top - insets.bottom,
  );
  const [playerViewMode, setPlayerViewMode] = useState<"player" | "queue">(
    "player",
  );

  const expandProgress = useSharedValue(0);

  const dragDistance = Math.max(
    1,
    containerHeight - bottomBarHeight - miniPlayerHeight,
  );
  const collapsedTop = dragDistance;

  const expandPanGesture = Gesture.Pan()
    .enabled(!isExpanded)
    .activeOffsetY([-10, 10])
    .failOffsetX([-12, 12])
    .onUpdate((event) => {
      const next = Math.max(
        0,
        Math.min(1, -event.translationY / dragDistance),
      );
      expandProgress.value = next;
    })
    .onEnd((event) => {
      const shouldExpand =
        expandProgress.value > EXPAND_PROGRESS_THRESHOLD ||
        event.velocityY < EXPAND_VELOCITY_THRESHOLD;

      if (shouldExpand) {
        runOnJS(triggerHapticSelection)();
        runOnJS(setIsExpanded)(true);
        expandProgress.value = withSpring(1, SPRING_CONFIG);
      } else {
        expandProgress.value = withSpring(0, SPRING_CONFIG);
      }
    });

  const collapsePanGesture = Gesture.Pan()
    .enabled(isExpanded && playerViewMode === "player")
    .activeOffsetY([-999, 12])
    .failOffsetX([-15, 15])
    .onUpdate((event) => {
      const next = Math.max(
        0,
        Math.min(1, 1 - event.translationY / dragDistance),
      );
      expandProgress.value = next;
    })
    .onEnd((event) => {
      const shouldCollapse =
        expandProgress.value < COLLAPSE_PROGRESS_THRESHOLD ||
        event.velocityY > COLLAPSE_VELOCITY_THRESHOLD;

      if (shouldCollapse) {
        expandProgress.value = withSpring(0, SPRING_CONFIG, (finished) => {
          if (finished) {
            runOnJS(setIsExpanded)(false);
          }
        });
      } else {
        expandProgress.value = withSpring(1, SPRING_CONFIG);
      }
    });

  const expandToFull = useCallback(() => {
    setIsExpanded(true);
    expandProgress.value = withSpring(1, SPRING_CONFIG);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setIsExpanded]);

  const collapseToMini = useCallback(() => {
    // eslint-disable-next-line react-hooks/immutability
    expandProgress.value = withSpring(0, SPRING_CONFIG, (finished) => {
      if (finished) {
        runOnJS(setIsExpanded)(false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setIsExpanded]);

  useEffect(() => {
    registerHandlers(expandToFull, collapseToMini);
  }, [registerHandlers, expandToFull, collapseToMini]);

  useEffect(() => {
    if (!currentTrack || !visible) {
      // eslint-disable-next-line react-hooks/immutability
      expandProgress.value = 0;
      if (isExpanded) {
        setIsExpanded(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack, visible, isExpanded, setIsExpanded]);

  useEffect(() => {
    if (!isExpanded || playerViewMode !== "player") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      collapseToMini();
      return true;
    });
    return () => sub.remove();
  }, [isExpanded, playerViewMode, collapseToMini]);

  const sheetStyle = useAnimatedStyle(() => ({
    top: interpolate(expandProgress.value, [0, 1], [collapsedTop, 0], "clamp"),
    bottom: interpolate(
      expandProgress.value,
      [0, 1],
      [bottomBarHeight, 0],
      "clamp",
    ),
    borderTopLeftRadius: interpolate(
      expandProgress.value,
      [0, 1],
      [16, 0],
      "clamp",
    ),
    borderTopRightRadius: interpolate(
      expandProgress.value,
      [0, 1],
      [16, 0],
      "clamp",
    ),
  }));

  const miniLayerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expandProgress.value, [0, 0.25], [1, 0], "clamp"),
  }));

  const fullLayerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expandProgress.value, [0.1, 0.65], [0, 1], "clamp"),
  }));

  if (!visible || !currentTrack || bottomBarHeight <= 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.overlayContainer,
        {
          top: insets.top,
          bottom: insets.bottom,
          left: insets.left,
          right: insets.right,
        },
      ]}
      pointerEvents="box-none"
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0) setContainerHeight(h);
      }}
    >
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: theme.colors.background },
          sheetStyle,
        ]}
        testID="expandable-player-sheet"
      >
        <GestureDetector gesture={collapsePanGesture}>
          <Animated.View
            style={[
              styles.fullLayer,
              { height: containerHeight },
              fullLayerStyle,
            ]}
            pointerEvents={isExpanded ? "auto" : "none"}
          >
            <PlayerContent
              onCollapse={collapseToMini}
              isActive={isExpanded}
              onViewModeChange={setPlayerViewMode}
            />
          </Animated.View>
        </GestureDetector>

        <GestureDetector gesture={expandPanGesture}>
          <Animated.View
            style={[styles.miniLayer, miniLayerStyle]}
            pointerEvents={isExpanded ? "none" : "auto"}
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (h > 0) setMiniPlayerHeight(h);
            }}
          >
            <MiniPlayer onExpand={expandToFull} disableVerticalGesture />
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  fullLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  miniLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
});
