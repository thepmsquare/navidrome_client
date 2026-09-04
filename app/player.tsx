import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { GestureResponderEvent, Pressable, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  IconButton,
  ProgressBar,
  Text,
  useTheme,
} from "react-native-paper";

import { getCoverArtBaseUrl } from "@/services/api";
import {
  cycleRepeatMode,
  playNext,
  playPrevious,
  seekToPosition,
  togglePlayback,
  usePlayerState,
} from "@/services/player";
import { playerStyles } from "@/stylesheets";

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const totalSecs = Math.floor(seconds);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function PlayerScreen() {
  const router = useRouter();
  const theme = useTheme();
  const playerState = usePlayerState();
  const [progressBarWidth, setProgressBarWidth] = useState<number>(0);
  const [getArtUrl, setGetArtUrl] = useState<
    ((id?: string | null) => string | null) | null
  >(null);

  useEffect(() => {
    getCoverArtBaseUrl()
      .then((fn) => setGetArtUrl(() => fn))
      .catch((err) =>
        console.error("failed to get cover art url helper in player screen:", err),
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

  const handleSeek = (event: GestureResponderEvent) => {
    if (!duration || duration <= 0 || !progressBarWidth) return;
    const touchX = event.nativeEvent.locationX;
    const percentage = Math.min(Math.max(touchX / progressBarWidth, 0), 1);
    const targetSeconds = percentage * duration;
    seekToPosition(targetSeconds).catch((err) =>
      console.error("failed to seek position:", err),
    );
  };

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

  if (!currentTrack) {
    return (
      <View
        style={[
          playerStyles.container,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <View style={playerStyles.header}>
          <IconButton
            icon="chevron-down"
            size={28}
            iconColor={theme.colors.onSurface}
            accessibilityLabel="close player"
            onPress={() => router.back()}
          />
          <Text
            variant="titleMedium"
            style={[playerStyles.headerTitle, { color: theme.colors.onSurface }]}
          >
            now playing
          </Text>
          <View style={playerStyles.headerSpacer} />
        </View>

        <View style={playerStyles.emptyContainer}>
          <Avatar.Icon
            size={96}
            icon="music-off"
            style={{ backgroundColor: theme.colors.surfaceVariant }}
            color={theme.colors.onSurfaceVariant}
          />
          <Text
            variant="bodyLarge"
            style={[playerStyles.emptyText, { color: theme.colors.onSurfaceVariant }]}
          >
            no track playing
          </Text>
          <IconButton
            icon="arrow-left"
            mode="contained"
            size={24}
            accessibilityLabel="close player"
            onPress={() => router.back()}
          />
        </View>
      </View>
    );
  }

  const artUrl =
    getArtUrl && currentTrack.coverArt
      ? getArtUrl(currentTrack.coverArt)
      : null;

  return (
    <View
      style={[
        playerStyles.container,
        { backgroundColor: theme.colors.background },
      ]}
    >
      {/* Header with Close Icon and Title */}
      <View style={playerStyles.header}>
        <IconButton
          icon="chevron-down"
          size={28}
          iconColor={theme.colors.onSurface}
          accessibilityLabel="close player"
          onPress={() => router.back()}
        />
        <Text
          variant="titleMedium"
          style={[playerStyles.headerTitle, { color: theme.colors.onSurfaceVariant }]}
        >
          now playing
        </Text>
        <IconButton
          icon={repeatIcon}
          size={24}
          iconColor={repeatColor}
          accessibilityLabel={repeatLabel}
          onPress={() => {
            cycleRepeatMode().catch((err) =>
              console.error("failed to cycle repeat mode:", err),
            );
          }}
        />
      </View>

      {/* Large Album Artwork */}
      <View style={playerStyles.artContainer}>
        {artUrl ? (
          <Image
            source={{
              uri: artUrl,
              cacheKey: `${currentTrack.coverArt}-600`,
            }}
            style={playerStyles.artwork}
            contentFit="cover"
            transition={250}
            cachePolicy="memory-disk"
          />
        ) : (
          <View
            style={[
              playerStyles.artworkPlaceholder,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <Avatar.Icon
              size={120}
              icon="music"
              style={{ backgroundColor: theme.colors.secondaryContainer }}
              color={theme.colors.onSecondaryContainer}
            />
          </View>
        )}
      </View>

      {/* Song Name, Artist, and Album Name */}
      <View style={playerStyles.infoContainer}>
        <Text
          variant="headlineSmall"
          numberOfLines={2}
          ellipsizeMode="tail"
          style={[playerStyles.title, { color: theme.colors.onSurface }]}
        >
          {currentTrack.title || "unknown track"}
        </Text>
        <Text
          variant="titleMedium"
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[playerStyles.artist, { color: theme.colors.onSurfaceVariant }]}
        >
          {currentTrack.artist || "unknown artist"}
        </Text>
        {currentTrack.album ? (
          <Text
            variant="bodyMedium"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[playerStyles.album, { color: theme.colors.outline }]}
          >
            {currentTrack.album}
          </Text>
        ) : (
          <Text
            variant="bodyMedium"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[playerStyles.album, { color: theme.colors.outline }]}
          >
            unknown album
          </Text>
        )}
      </View>

      {/* Song Progress and Timestamps */}
      <View style={playerStyles.progressSection}>
        <Pressable
          onPress={handleSeek}
          onLayout={(e) => setProgressBarWidth(e.nativeEvent.layout.width)}
          style={playerStyles.progressTouchArea}
          accessibilityLabel="song progress"
          accessibilityRole="adjustable"
        >
          <ProgressBar
            progress={progress}
            color={theme.colors.primary}
            style={[
              playerStyles.progressBar,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          />
        </Pressable>
        <View style={playerStyles.timeRow}>
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {formatTime(position)}
          </Text>
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {formatTime(duration)}
          </Text>
        </View>
      </View>

      {/* Playback Controls */}
      <View style={playerStyles.controlsRow}>
        <IconButton
          icon="skip-previous"
          size={36}
          iconColor={
            hasPrevious
              ? theme.colors.onSurface
              : theme.colors.onSurfaceDisabled
          }
          disabled={!hasPrevious}
          accessibilityLabel="previous track"
          onPress={() => {
            playPrevious().catch((err) =>
              console.error("failed to play previous track:", err),
            );
          }}
        />

        {isBuffering ? (
          <ActivityIndicator size={48} color={theme.colors.primary} />
        ) : (
          <IconButton
            icon={isPlaying ? "pause-circle" : "play-circle"}
            size={64}
            iconColor={theme.colors.primary}
            style={playerStyles.playButton}
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
          size={36}
          iconColor={
            hasNext
              ? theme.colors.onSurface
              : theme.colors.onSurfaceDisabled
          }
          disabled={!hasNext}
          accessibilityLabel="next track"
          onPress={() => {
            playNext().catch((err) =>
              console.error("failed to play next track:", err),
            );
          }}
        />
      </View>
    </View>
  );
}
