import { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";

import { ConnectStage } from "@/types";

export interface ConnectProgressProps {
  stage: ConnectStage;
  loading?: boolean;
}

export function ConnectProgress({
  stage,
  loading = false,
}: ConnectProgressProps) {
  const theme = useTheme();
  const [pulseAnim] = useState(() => new Animated.Value(1));

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (loading) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.35,
            duration: 650,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 650,
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
    } else {
      pulseAnim.setValue(1);
    }

    return () => {
      if (animation) {
        animation.stop();
      }
    };
  }, [loading, pulseAnim]);

  const isStepOne = stage === "ping";
  const stepText = isStepOne ? "step 1 of 2" : "step 2 of 2";

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={stepText}
      accessibilityValue={{
        min: 1,
        max: 2,
        now: isStepOne ? 1 : 2,
        text: stepText,
      }}
      style={styles.container}
    >
      <View style={styles.segmentsRow}>
        {/* segment 1: server url */}
        <Animated.View
          style={[
            styles.segment,
            {
              backgroundColor: theme.colors.primary,
              opacity: isStepOne && loading ? pulseAnim : 1,
            },
          ]}
        />
        {/* segment 2: credentials */}
        <Animated.View
          style={[
            styles.segment,
            {
              backgroundColor: !isStepOne
                ? theme.colors.primary
                : theme.colors.surfaceVariant,
              opacity: !isStepOne && loading ? pulseAnim : 1,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  segmentsRow: {
    flexDirection: "row",
    gap: 8,
    height: 4,
    width: "100%",
  },
  segment: {
    flex: 1,
    height: "100%",
    borderRadius: 2,
  },
});

export default ConnectProgress;
