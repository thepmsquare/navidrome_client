import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Avatar, Icon, Text, TouchableRipple } from "react-native-paper";

import { AlbumContextMenuModal } from "@/components/AlbumContextMenuModal";
import { getCoverArtBaseUrl } from "@/services/api";
import { getSongsByAlbumId } from "@/services/db";
import { playPlaylist } from "@/services/player";
import { AlbumID3, useAppTheme } from "@/types";
import { triggerHapticSelection } from "@/utils/haptics";
import { shape, spacing } from "@/utils/spacing";

export interface AlbumCardProps {
  album: AlbumID3;
  onPress?: () => void;
  onLongPress?: () => void;
  getArtUrl?: ((id?: string | null) => string | null) | null;
  showMoreButton?: boolean;
  showPlayButton?: boolean;
  width?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function AlbumCard({
  album,
  onPress,
  onLongPress,
  getArtUrl: propGetArtUrl,
  showMoreButton = true,
  showPlayButton = true,
  width,
  style,
  testID,
}: AlbumCardProps) {
  const theme = useAppTheme();
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [internalGetArtUrl, setInternalGetArtUrl] = useState<
    ((id?: string | null) => string | null) | null
  >(null);

  const getArtUrl = propGetArtUrl ?? internalGetArtUrl;

  useEffect(() => {
    if (propGetArtUrl) return;
    getCoverArtBaseUrl()
      .then((fn) => setInternalGetArtUrl(() => fn))
      .catch((err) =>
        console.error("failed to get cover art url helper in album card:", err),
      );
  }, [propGetArtUrl]);

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress();
    } else {
      router.push({ pathname: "/album/[id]", params: { id: album.id } });
    }
  }, [onPress, router, album.id]);

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

  const handlePlay = useCallback(() => {
    triggerHapticSelection();
    try {
      const songs = getSongsByAlbumId(album.id);
      if (songs.length > 0) {
        playPlaylist(songs, 0).catch((err) =>
          console.error("failed to play album from card:", err),
        );
      }
    } catch (err) {
      console.error("failed to load songs for album card:", err);
    }
  }, [album.id]);

  const hasSongs = useMemo(() => {
    if (!showPlayButton) return false;
    try {
      return getSongsByAlbumId(album.id).length > 0;
    } catch (err) {
      console.error("failed to check songs for album card:", err);
      return false;
    }
  }, [album.id, showPlayButton]);

  const handleDismissMenu = useCallback(() => {
    setMenuVisible(false);
  }, []);

  const artUrl = useMemo(() => {
    if (!getArtUrl) return null;
    return getArtUrl(album.coverArt);
  }, [getArtUrl, album.coverArt]);

  const a11yLabel = useMemo(() => {
    const title = album.name || "unknown album";
    const artist = album.artist ? `, by ${album.artist}` : "";
    return `open ${title}${artist}`.toLowerCase();
  }, [album.name, album.artist]);

  return (
    <>
      <TouchableRipple
        onPress={handlePress}
        onLongPress={handleLongPress}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityHint="tap to open, long-press for options"
        style={[width ? { width } : styles.flexContainer, style]}
        testID={testID ?? `album-card-${album.id}`}
      >
        <View>
          <View style={styles.artworkContainer}>
            {artUrl ? (
              <Image
                source={{ uri: artUrl, cacheKey: `${album.coverArt}-300` }}
                style={styles.artwork}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
            ) : (
              <View
                style={[
                  styles.artwork,
                  styles.artworkFallback,
                  { backgroundColor: theme.colors.surfaceContainerHighest },
                ]}
              >
                <Avatar.Icon
                  size={48}
                  icon="album"
                  style={styles.artworkFallbackIcon}
                />
              </View>
            )}

            {hasSongs ? (
              <TouchableRipple
                onPress={handlePlay}
                accessibilityRole="button"
                accessibilityLabel={`play ${album.name || "album"}`.toLowerCase()}
                accessibilityHint="start playing this album"
                style={[
                  styles.playButton,
                  { backgroundColor: theme.colors.secondaryContainer },
                ]}
                borderless
                testID={`album-card-play-${album.id}`}
              >
                <Icon
                  source="play"
                  size={35}
                  color={theme.colors.onSecondaryContainer}
                />
              </TouchableRipple>
            ) : null}
          </View>

          {showMoreButton ? (
            <TouchableRipple
              onPress={handleOpenMenu}
              accessibilityRole="button"
              accessibilityLabel="album options"
              style={[
                styles.moreButton,
                { backgroundColor: theme.colors.secondaryContainer },
              ]}
              borderless
              hitSlop={10}
            >
              <Icon
                source="dots-vertical"
                size={18}
                color={theme.colors.onSecondaryContainer}
              />
            </TouchableRipple>
          ) : null}

          <Text
            variant="bodyMedium"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[styles.titleText, { color: theme.colors.onSurface }]}
          >
            {album.name}
          </Text>
          {album.artist ? (
            <Text
              variant="bodySmall"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[
                styles.subtitleText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {album.artist}
            </Text>
          ) : null}
        </View>
      </TouchableRipple>

      {menuVisible ? (
        <AlbumContextMenuModal
          visible={menuVisible}
          onDismiss={handleDismissMenu}
          album={album}
          getArtUrl={getArtUrl}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flexContainer: {
    flex: 1,
  },
  artworkContainer: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: shape.small,
    overflow: "hidden",
  },
  artwork: {
    width: "100%",
    height: "100%",
    borderRadius: shape.small,
  },
  artworkFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  artworkFallbackIcon: {
    backgroundColor: "transparent",
  },
  moreButton: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    width: 28,
    height: 28,
    borderRadius: shape.full,
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    position: "absolute",
    bottom: spacing.sm,
    right: spacing.sm,
    width: 50,
    height: 50,
    borderRadius: shape.full,
    alignItems: "center",
    justifyContent: "center",
  },
  titleText: {
    marginTop: spacing.xs + 2,
    fontWeight: "500",
    letterSpacing: 0.15,
  },
  subtitleText: {
    marginTop: 2,
  },
});
