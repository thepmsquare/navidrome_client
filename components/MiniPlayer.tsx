import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  ActivityIndicator,
  Avatar,
  IconButton,
  ProgressBar,
  Surface,
  Text,
} from "react-native-paper";

import { getCoverArtBaseUrl } from "@/services/api";
import {
  playNext,
  playPrevious,
  togglePlayback,
  usePlayerState,
} from "@/services/player";
import { miniPlayerStyles } from "@/stylesheets";
import { useAppTheme } from "@/types";
import { triggerHapticSelection } from "@/utils/haptics";

const SWIPE_THRESHOLD = 50;
const VELOCITY_THRESHOLD = 500;
const EXIT_DISTANCE = 160;

export function MiniPlayer() {
  const router = useRouter();
  const theme = useAppTheme();
  const playerState = usePlayerState();
  const [getArtUrl, setGetArtUrl] = useState<
    ((id?: string | null) => string | null) | null
  >(null);

  const translateX = useSharedValue(0);
  const trackOpacity = useSharedValue(1);

  const previousTrackIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getCoverArtBaseUrl()
      .then((fn) => {
        if (isMounted) setGetArtUrl(() => fn);
      })
      .catch((err) =>
        console.error("failed to get cover art url helper in mini player:", err),
      );
    return () => {
      isMounted = false;
    };
  }, []);

  const {
    currentTrack,
    isPlaying,
    isBuffering,
    position,
    duration,
    isPlayingFromCache,
  } = playerState;

  // Animate track entry when currentTrack changes
  useEffect(() => {
    if (!currentTrack) return;
    if (previousTrackIdRef.current && previousTrackIdRef.current !== currentTrack.id) {
      trackOpacity.value = 0;
      translateX.value = translateX.value < 0 ? 30 : -30;
      translateX.value = withSpring(0, {
        damping: 26,
        stiffness: 240,
        overshootClamping: true,
      });
      trackOpacity.value = withTiming(1, { duration: 160 });
    }
    previousTrackIdRef.current = currentTrack.id;
  }, [currentTrack?.id, trackOpacity, translateX]);

  const progress = useMemo(() => {
    if (!duration || duration <= 0) return 0;
    return Math.min(Math.max(position / duration, 0), 1);
  }, [position, duration]);

  const handleOpenPlayer = useCallback(() => {
    router.push("/player");
  }, [router]);

  const triggerNext = useCallback(() => {
    triggerHapticSelection();
    playNext().catch((err) =>
      console.error("failed to play next track from mini player:", err),
    );
  }, []);

  const triggerPrevious = useCallback(() => {
    triggerHapticSelection();
    playPrevious().catch((err) =>
      console.error("failed to play previous track from mini player:", err),
    );
  }, []);

  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .activeOffsetX([-10, 10])
      .failOffsetY([-15, 15])
      .onUpdate((event) => {
        translateX.value = event.translationX;
        trackOpacity.value = interpolate(
          Math.abs(event.translationX),
          [0, 100],
          [1, 0.4],
          "clamp",
        );
      })
      .onEnd((event) => {
        const isSwipeLeft =
          event.translationX < -SWIPE_THRESHOLD ||
          event.velocityX < -VELOCITY_THRESHOLD;
        const isSwipeRight =
          event.translationX > SWIPE_THRESHOLD ||
          event.velocityX > VELOCITY_THRESHOLD;

        if (isSwipeLeft) {
          // Swipe left -> play next
          translateX.value = withTiming(
            -EXIT_DISTANCE,
            { duration: 120 },
            (finished) => {
              if (finished) {
                runOnJS(triggerNext)();
              }
            },
          );
          trackOpacity.value = withTiming(0, { duration: 120 });
        } else if (isSwipeRight) {
          // Swipe right -> play previous
          translateX.value = withTiming(
            EXIT_DISTANCE,
            { duration: 120 },
            (finished) => {
              if (finished) {
                runOnJS(triggerPrevious)();
              }
            },
          );
          trackOpacity.value = withTiming(0, { duration: 120 });
        } else {
          // Cancel gesture and snap back to center
          translateX.value = withSpring(0, {
            damping: 26,
            stiffness: 240,
            overshootClamping: true,
          });
          trackOpacity.value = withTiming(1, { duration: 140 });
        }
      });
  }, [translateX, trackOpacity, triggerNext, triggerPrevious]);

  const animatedTrackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: trackOpacity.value,
  }));

  if (!currentTrack) {
    return null;
  }

  const artUrl =
    getArtUrl && currentTrack.coverArt
      ? getArtUrl(currentTrack.coverArt)
      : null;

  return (
    <Surface
      style={[
        miniPlayerStyles.container,
        {
          backgroundColor: theme.colors.elevation.level2,
          borderTopColor: theme.colors.outlineVariant,
        },
      ]}
      elevation={0}
      testID="mini-player"
    >
      <ProgressBar
        progress={progress}
        color={
          isPlayingFromCache
            ? theme.colors.tertiary
            : theme.colors.primary
        }
        style={[
          miniPlayerStyles.progressBar,
          { backgroundColor: theme.colors.surfaceContainerHighest },
        ]}
      />
      <View style={miniPlayerStyles.content}>
        <View style={styles.gestureContainer}>
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[miniPlayerStyles.trackPressable, animatedTrackStyle]}>
              <Pressable
                style={styles.innerTrackPressable}
                onPress={handleOpenPlayer}
                accessibilityRole="button"
                accessibilityLabel="open player"
                testID="mini-player-track"
              >
                {artUrl ? (
                  <Image
                    source={{
                      uri: artUrl,
                      cacheKey: `${currentTrack.coverArt}-300`,
                    }}
                    style={miniPlayerStyles.artwork}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <Avatar.Icon
                    size={44}
                    icon="music"
                    style={[
                      miniPlayerStyles.artworkPlaceholder,
                      { backgroundColor: theme.colors.secondaryContainer },
                    ]}
                    color={theme.colors.onSecondaryContainer}
                  />
                )}

                <View style={miniPlayerStyles.infoContainer}>
                  <Text
                    variant="titleSmall"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[miniPlayerStyles.title, { color: theme.colors.onSurface }]}
                  >
                    {currentTrack.title || "unknown track"}
                  </Text>
                  <Text
                    variant="bodySmall"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[
                      miniPlayerStyles.subtitle,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    {currentTrack.artist ||
                      currentTrack.album ||
                      "unknown artist"}
                  </Text>
                </View>
              </Pressable>
            </Animated.View>
          </GestureDetector>
        </View>

        <View style={miniPlayerStyles.actionsContainer}>
          {isBuffering ? (
            <View style={miniPlayerStyles.bufferingIndicator}>
              <ActivityIndicator size={20} color={theme.colors.primary} />
            </View>
          ) : (
            <IconButton
              icon={isPlaying ? "pause" : "play"}
              size={24}
              iconColor={theme.colors.onSurface}
              style={miniPlayerStyles.actionButton}
              accessibilityLabel={isPlaying ? "pause" : "play"}
              onPress={() => {
                togglePlayback().catch((err) =>
                  console.error("failed to toggle playback:", err),
                );
              }}
            />
          )}
        </View>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  gestureContainer: {
    flex: 1,
    overflow: "hidden",
  },
  innerTrackPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
});

export default MiniPlayer;
