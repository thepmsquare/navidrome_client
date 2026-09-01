import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  IconButton,
  ProgressBar,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";

import { getCoverArtBaseUrl } from "@/services/api";
import {
  cycleRepeatMode,
  playNext,
  playPrevious,
  togglePlayback,
  usePlayerState,
} from "@/services/player";
import { miniPlayerStyles } from "@/stylesheets";

export function MiniPlayer() {
  const theme = useTheme();
  const playerState = usePlayerState();
  const [getArtUrl, setGetArtUrl] = useState<
    ((id?: string | null) => string | null) | null
  >(null);

  useEffect(() => {
    getCoverArtBaseUrl()
      .then((fn) => setGetArtUrl(() => fn))
      .catch((err) =>
        console.error("failed to get cover art url helper in mini player:", err),
      );
  }, []);

  const {
    currentTrack,
    isPlaying,
    isBuffering,
    position,
    duration,
    repeatMode,
    hasPrevious,
    hasNext,
  } = playerState;

  const progress = useMemo(() => {
    if (!duration || duration <= 0) return 0;
    return Math.min(Math.max(position / duration, 0), 1);
  }, [position, duration]);

  if (!currentTrack) {
    return null;
  }

  const artUrl =
    getArtUrl && currentTrack.coverArt
      ? getArtUrl(currentTrack.coverArt)
      : null;

  const repeatIcon =
    repeatMode === "one"
      ? "repeat-once"
      : repeatMode === "all"
        ? "repeat"
        : "repeat-off";

  const repeatColor =
    repeatMode === "off"
      ? theme.colors.outline
      : theme.colors.primary;

  const repeatLabel =
    repeatMode === "one"
      ? "repeat one"
      : repeatMode === "all"
        ? "repeat all"
        : "repeat off";

  return (
    <Surface
      style={[
        miniPlayerStyles.container,
        {
          backgroundColor: theme.colors.elevation.level2,
          borderTopColor: theme.colors.outlineVariant,
        },
      ]}
      elevation={3}
    >
      <ProgressBar
        progress={progress}
        color={theme.colors.primary}
        style={[
          miniPlayerStyles.progressBar,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      />
      <View style={miniPlayerStyles.content}>
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

        <View style={miniPlayerStyles.actionsContainer}>
          <IconButton
            icon={repeatIcon}
            size={22}
            iconColor={repeatColor}
            style={miniPlayerStyles.actionButton}
            accessibilityLabel={repeatLabel}
            onPress={() => {
              cycleRepeatMode().catch((err) =>
                console.error("failed to cycle repeat mode:", err),
              );
            }}
          />

          <IconButton
            icon="skip-previous"
            size={24}
            iconColor={
              hasPrevious
                ? theme.colors.onSurface
                : theme.colors.onSurfaceDisabled
            }
            disabled={!hasPrevious}
            style={miniPlayerStyles.actionButton}
            accessibilityLabel="previous track"
            onPress={() => {
              playPrevious().catch((err) =>
                console.error("failed to play previous track:", err),
              );
            }}
          />

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

          <IconButton
            icon="skip-next"
            size={24}
            iconColor={
              hasNext
                ? theme.colors.onSurface
                : theme.colors.onSurfaceDisabled
            }
            disabled={!hasNext}
            style={miniPlayerStyles.actionButton}
            accessibilityLabel="next track"
            onPress={() => {
              playNext().catch((err) =>
                console.error("failed to play next track:", err),
              );
            }}
          />
        </View>
      </View>
    </Surface>
  );
}

export default MiniPlayer;
