import React, { useEffect, useState } from "react";
import {
  AccessibilityActionEvent,
  LayoutChangeEvent,
  StyleSheet,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Surface, Text } from "react-native-paper";

import { useAppTheme } from "@/types";
import { triggerHapticSelection } from "@/utils/haptics";
import { shape, spacing } from "@/utils/spacing";
import { formatTime } from "@/utils/time";

export type PlayerSeekBarSkin = "default" | "minimal" | "wave";

export interface PlayerSeekBarProps {
  position: number;
  duration: number;
  onSeek: (seconds: number) => void;
  color?: string;
  trackColor?: string;
  skin?: PlayerSeekBarSkin;
  accessibilityLabel?: string;
}

const TRACK_HEIGHT = 6;
const THUMB_SIZE = 14;
const TOUCH_AREA_HEIGHT = 44;
const TOOLTIP_WIDTH = 56;
const TOOLTIP_HEIGHT = 26;

export function PlayerSeekBar({
  position,
  duration,
  onSeek,
  color,
  trackColor,
  accessibilityLabel = "song progress",
}: PlayerSeekBarProps) {
  const theme = useAppTheme();
  const trackWidth = useSharedValue(0);
  const scrubX = useSharedValue(0);
  const isScrubbing = useSharedValue(false);
  const lastRoundedSecs = useSharedValue(-1);

  const [previewSecs, setPreviewSecs] = useState<number | null>(null);

  const activeColor = color ?? theme.colors.primary;
  const inactiveColor = trackColor ?? theme.colors.surfaceContainerHighest;

  const validDuration = duration > 0 ? duration : 0;
  const progressRatio =
    validDuration > 0 ? Math.min(Math.max(position / validDuration, 0), 1) : 0;

  const onTrackLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    trackWidth.value = width;
    if (!isScrubbing.value && width > 0) {
      scrubX.value = progressRatio * width;
    }
  };

  const handleScrubStart = (secs: number) => {
    triggerHapticSelection();
    setPreviewSecs(secs);
  };

  const handleScrubUpdate = (secs: number) => {
    setPreviewSecs(secs);
  };

  const handleScrubEnd = (secs: number) => {
    triggerHapticSelection();
    setPreviewSecs(null);
    onSeek(secs);
  };

  const panGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      if (trackWidth.value <= 0 || validDuration <= 0) return;
      isScrubbing.value = true;
      const clampedX = Math.max(0, Math.min(trackWidth.value, e.x));
      scrubX.value = clampedX;
      const ratio = clampedX / trackWidth.value;
      const secs = ratio * validDuration;
      lastRoundedSecs.value = Math.floor(secs);
      runOnJS(handleScrubStart)(secs);
    })
    .onUpdate((e) => {
      if (trackWidth.value <= 0 || validDuration <= 0) return;
      const clampedX = Math.max(0, Math.min(trackWidth.value, e.x));
      scrubX.value = clampedX;
      const ratio = clampedX / trackWidth.value;
      const secs = ratio * validDuration;
      const rounded = Math.floor(secs);
      if (rounded !== lastRoundedSecs.value) {
        lastRoundedSecs.value = rounded;
        runOnJS(handleScrubUpdate)(secs);
      }
    })
    .onFinalize(() => {
      if (trackWidth.value <= 0 || validDuration <= 0) {
        isScrubbing.value = false;
        return;
      }
      isScrubbing.value = false;
      const clampedX = Math.max(0, Math.min(trackWidth.value, scrubX.value));
      const ratio = clampedX / trackWidth.value;
      const secs = Math.round(ratio * validDuration);
      runOnJS(handleScrubEnd)(secs);
    });

  // Synchronize playback position into Reanimated shared value when not scrubbing
  useEffect(() => {
    if (!isScrubbing.value && trackWidth.value > 0) {
      scrubX.value = progressRatio * trackWidth.value;
    }
  }, [progressRatio, isScrubbing, scrubX, trackWidth]);

  // Floating tooltip animation
  const tooltipAnimatedStyle = useAnimatedStyle(() => {
    const opacity = withTiming(isScrubbing.value ? 1 : 0, { duration: 150 });
    const scale = withTiming(isScrubbing.value ? 1 : 0.8, { duration: 150 });
    const targetX = scrubX.value - TOOLTIP_WIDTH / 2;
    const maxX = Math.max(0, trackWidth.value - TOOLTIP_WIDTH);
    const clampedX = Math.max(0, Math.min(maxX, targetX));

    return {
      opacity,
      transform: [
        { translateX: clampedX },
        { scale },
      ],
    };
  });

  // Animated progress fill bar
  const fillAnimatedStyle = useAnimatedStyle(() => {
    return {
      width: scrubX.value,
    };
  });

  // Animated draggable thumb
  const thumbAnimatedStyle = useAnimatedStyle(() => {
    const scale = withTiming(isScrubbing.value ? 1.4 : 1, { duration: 150 });
    return {
      transform: [
        { translateX: scrubX.value - THUMB_SIZE / 2 },
        { scale },
      ],
    };
  });

  return (
    <View style={styles.outerContainer}>
      {/* Floating Preview Tooltip (Visible only while scrubbing) */}
      <Animated.View
        pointerEvents="none"
        style={[styles.tooltipContainer, tooltipAnimatedStyle]}
      >
        <Surface
          elevation={3}
          style={[
            styles.tooltipBubble,
            { backgroundColor: theme.colors.inverseSurface },
          ]}
        >
          <Text
            variant="labelSmall"
            style={[
              styles.tooltipText,
              { color: theme.colors.inverseOnSurface },
            ]}
          >
            {formatTime(previewSecs ?? position)}
          </Text>
        </Surface>
      </Animated.View>

      {/* Interactive Touch & Scrub Area */}
      <GestureDetector gesture={panGesture}>
        <View
          onLayout={onTrackLayout}
          style={styles.touchArea}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="adjustable"
          accessibilityHint="drag or tap to seek"
          accessibilityValue={{
            min: 0,
            max: validDuration,
            now: position,
            text: `${formatTime(position)} of ${formatTime(validDuration)}`,
          }}
          accessibilityActions={[
            { name: "increment", label: "seek forward 10 seconds" },
            { name: "decrement", label: "seek backward 10 seconds" },
          ]}
          onAccessibilityAction={(event: AccessibilityActionEvent) => {
            if (event.nativeEvent.actionName === "increment") {
              const newPos = Math.min(validDuration, position + 10);
              onSeek(newPos);
            } else if (event.nativeEvent.actionName === "decrement") {
              const newPos = Math.max(0, position - 10);
              onSeek(newPos);
            }
          }}
        >
          {/* Background Track */}
          <View
            style={[
              styles.backgroundTrack,
              { backgroundColor: inactiveColor },
            ]}
          />

          {/* Active Progress Fill */}
          <Animated.View
            style={[
              styles.progressFill,
              { backgroundColor: activeColor },
              fillAnimatedStyle,
            ]}
          />

          {/* Draggable Scrubber Thumb */}
          <Animated.View
            style={[
              styles.thumb,
              { backgroundColor: activeColor },
              thumbAnimatedStyle,
            ]}
          />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    width: "100%",
    position: "relative",
  },
  tooltipContainer: {
    position: "absolute",
    top: -28,
    left: 0,
    width: TOOLTIP_WIDTH,
    height: TOOLTIP_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  tooltipBubble: {
    width: TOOLTIP_WIDTH,
    height: TOOLTIP_HEIGHT,
    borderRadius: shape.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  tooltipText: {
    fontWeight: "700",
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  touchArea: {
    height: TOUCH_AREA_HEIGHT,
    width: "100%",
    justifyContent: "center",
  },
  backgroundTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
  },
  progressFill: {
    position: "absolute",
    left: 0,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    position: "absolute",
    left: 0,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
  },
});
