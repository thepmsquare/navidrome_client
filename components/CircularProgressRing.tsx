import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import Svg, { Circle } from "react-native-svg";

import { useAppTheme } from "@/types";

export interface CircularProgressRingProps {
  /**
   * Progress value between 0 and 1. If negative (e.g. -1), treated as indeterminate.
   */
  progress: number;
  /**
   * Outer diameter of the circular ring in density pixels.
   */
  size?: number;
  /**
   * Thickness of the progress stroke.
   */
  strokeWidth?: number;
  /**
   * Active progress stroke color.
   */
  color: string;
  /**
   * Background track stroke color. Defaults to theme.colors.surfaceContainerHighest.
   */
  trackColor?: string;
  /**
   * Whether to display the percentage label (e.g. "45%") inside the circle.
   */
  showPercentage?: boolean;
}

export function CircularProgressRing({
  progress,
  size = 28,
  strokeWidth = 2.5,
  color,
  trackColor,
  showPercentage = true,
}: CircularProgressRingProps) {
  const theme = useAppTheme();
  const effectiveTrackColor = trackColor ?? theme.colors.surfaceContainerHighest;
  const radius = Math.max(1, (size - strokeWidth) / 2);
  const circumference = 2 * Math.PI * radius;

  // Clamp progress between 0 and 1
  const clamped = progress < 0 ? 0.25 : Math.min(1, Math.max(0, progress));
  const strokeDashoffset = circumference - clamped * circumference;

  // Calculate percentage string
  const percentText =
    progress < 0 ? "" : `${Math.round(clamped * 100)}%`;

  // Scale inner font size based on diameter
  const fontSize = Math.max(7, Math.floor(size * 0.28));

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: progress < 0 ? undefined : Math.round(clamped * 100),
      }}
    >
      <Svg width={size} height={size} style={styles.svg}>
        {/* Background track circle */}
        <Circle
          stroke={effectiveTrackColor}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        {/* Active progress ring */}
        <Circle
          stroke={color}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {showPercentage && percentText ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.labelContainer}>
            <Text
              numberOfLines={1}
              style={[
                styles.percentageText,
                { fontSize, color },
              ]}
            >
              {percentText}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
  svg: {
    position: "absolute",
  },
  labelContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  percentageText: {
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.5,
  },
});

export default CircularProgressRing;
