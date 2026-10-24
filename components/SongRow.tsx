import { Image } from "expo-image";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Avatar, IconButton, Text, TouchableRipple } from "react-native-paper";

import { SongContextMenuModal } from "@/components/SongContextMenuModal";
import { getCoverArtBaseUrl } from "@/services/api";
import { playSong, usePlayerState } from "@/services/player";
import { Child, SongCacheRow, useAppTheme } from "@/types";
import { triggerHapticSelection } from "@/utils/haptics";
import { shape, spacing } from "@/utils/spacing";

export interface SongRowProps {
  song: Child;
  onPress?: () => void;
  onLongPress?: () => void;
  index?: number;
  showCoverArt?: boolean;
  showTrackNumber?: boolean;
  trackNumber?: number | string;
  subtitle?: string;
  showArtist?: boolean;
  showAlbum?: boolean;
  isActive?: boolean;

  initialCacheEntry?: SongCacheRow | null;
  rightActions?: React.ReactNode;
  showMoreButton?: boolean;
  showDuration?: boolean;
  getArtUrl?: ((id?: string | null) => string | null) | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function SongRow({
  song,
  onPress,
  onLongPress,
  index,
  showCoverArt = true,
  showTrackNumber = false,
  trackNumber,
  subtitle: customSubtitle,
  showArtist = true,
  showAlbum = false,
  isActive: explicitIsActive,

  initialCacheEntry,
  rightActions,
  showMoreButton = true,
  showDuration = false,
  getArtUrl: propGetArtUrl,
  style,
  testID,
}: SongRowProps) {
  const theme = useAppTheme();
  const playerState = usePlayerState();
  const [menuVisible, setMenuVisible] = useState(false);
  const [internalGetArtUrl, setInternalGetArtUrl] = useState<
    ((id?: string | null) => string | null) | null
  >(null);

  const getArtUrl = propGetArtUrl ?? internalGetArtUrl;

  useEffect(() => {
    if (propGetArtUrl || !showCoverArt) return;
    getCoverArtBaseUrl()
      .then((fn) => setInternalGetArtUrl(() => fn))
      .catch((err) =>
        console.error("failed to get cover art url helper in song row:", err),
      );
  }, [propGetArtUrl, showCoverArt]);

  const isActive = useMemo(() => {
    if (explicitIsActive !== undefined) return explicitIsActive;
    return playerState.currentTrack?.id === song.id;
  }, [explicitIsActive, playerState.currentTrack?.id, song.id]);

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress();
    } else {
      playSong(song).catch((err) =>
        console.error("failed to play song on row press:", err),
      );
    }
  }, [onPress, song]);

  const handleLongPress = useCallback(() => {
    triggerHapticSelection();
    if (onLongPress) {
      onLongPress();
    } else {
      setMenuVisible(true);
    }
  }, [onLongPress]);

  const handleOpenMenu = useCallback(() => {
    triggerHapticSelection();
    setMenuVisible(true);
  }, []);

  const handleDismissMenu = useCallback(() => {
    setMenuVisible(false);
  }, []);

  const subtitle = useMemo(() => {
    if (customSubtitle !== undefined) return customSubtitle;
    const parts: string[] = [];
    if (showArtist && song.artist) {
      parts.push(song.artist);
    }
    if (showAlbum && song.album) {
      parts.push(song.album);
    }
    return parts.join(" • ");
  }, [customSubtitle, showArtist, showAlbum, song.artist, song.album]);

  const artUrl = useMemo(() => {
    if (!showCoverArt || !getArtUrl) return null;
    return getArtUrl(song.coverArt);
  }, [showCoverArt, getArtUrl, song.coverArt]);

  const displayTrackNum = useMemo(() => {
    if (trackNumber !== undefined) return `${trackNumber}`;
    if (song.track !== undefined && song.track !== null) return `${song.track}`;
    if (index !== undefined) return `${index + 1}`;
    return "-";
  }, [trackNumber, song.track, index]);

  const a11yLabel = useMemo(() => {
    const title = song.title || "unknown track";
    const artist = song.artist ? `, by ${song.artist}` : "";
    return `play ${title}${artist}`.toLowerCase();
  }, [song.title, song.artist]);

  return (
    <>
      <TouchableRipple
        onPress={handlePress}
        onLongPress={handleLongPress}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityHint="tap to play, long-press for options"
        style={[styles.container, style]}
        testID={testID ?? `song-row-${song.id}`}
      >
        <View style={styles.rowContent}>
          {/* Left Element: Track Number or Cover Art */}
          {showTrackNumber ? (
            <View style={styles.trackNumberContainer}>
              <Text
                variant="bodyMedium"
                style={[
                  styles.trackNumberText,
                  {
                    color: isActive
                      ? theme.colors.primary
                      : theme.colors.outline,
                  },
                ]}
              >
                {displayTrackNum}
              </Text>
            </View>
          ) : showCoverArt ? (
            <View style={styles.artworkContainer}>
              {artUrl ? (
                <Image
                  source={{ uri: artUrl, cacheKey: `${song.coverArt}-300` }}
                  style={styles.artwork}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              ) : (
                <Avatar.Icon
                  size={44}
                  icon="music"
                  style={styles.artworkFallback}
                />
              )}
            </View>
          ) : null}

          {/* Center Element: Song Title & Subtitle with tail truncation */}
          <View style={styles.infoContainer}>
            <Text
              variant="bodyLarge"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[
                styles.titleText,
                {
                  color: isActive
                    ? theme.colors.primary
                    : theme.colors.onSurface,
                  fontWeight: isActive ? "700" : "500",
                },
              ]}
            >
              {song.title}
            </Text>
            {subtitle ? (
              <Text
                variant="bodySmall"
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[
                  styles.subtitleText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>

          {/* Right Element: Offline indicator / custom actions / 3-dot context trigger */}
          <View style={styles.rightActionsContainer}>
            {rightActions ? (
              rightActions
            ) : (
              <>
                {showDuration && song.duration ? (
                  <Text
                    variant="bodySmall"
                    style={[
                      styles.durationText,
                      { color: theme.colors.outline },
                    ]}
                  >
                    {formatSongDuration(song.duration)}
                  </Text>
                ) : null}
                {showMoreButton ? (
                  <IconButton
                    icon="dots-vertical"
                    size={20}
                    accessibilityRole="button"
                    accessibilityLabel="song options"
                    onPress={handleOpenMenu}
                    style={styles.moreButton}
                  />
                ) : null}
              </>
            )}
          </View>
        </View>
      </TouchableRipple>

      {menuVisible ? (
        <SongContextMenuModal
          visible={menuVisible}
          onDismiss={handleDismissMenu}
          song={song}
          getArtUrl={getArtUrl}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: shape.small,
    marginVertical: 2,
  },
  rowContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    minHeight: 56,
  },
  trackNumberContainer: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  trackNumberText: {
    textAlign: "center",
    fontWeight: "500",
  },
  artworkContainer: {
    marginRight: spacing.md,
  },
  artwork: {
    width: 44,
    height: 44,
    borderRadius: shape.small,
  },
  artworkFallback: {
    backgroundColor: "transparent",
  },
  infoContainer: {
    flex: 1,
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  titleText: {
    letterSpacing: 0.15,
  },
  subtitleText: {
    marginTop: 2,
  },
  rightActionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  durationText: {
    marginRight: spacing.xs,
  },
  moreButton: {
    margin: 0,
  },
});

function formatSongDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
