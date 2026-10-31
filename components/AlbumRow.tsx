import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Avatar, IconButton, Text, TouchableRipple } from "react-native-paper";

import { AlbumContextMenuModal } from "@/components/AlbumContextMenuModal";
import { getCoverArtBaseUrl } from "@/services/api";
import { AlbumID3, useAppTheme } from "@/types";
import { triggerHapticSelection } from "@/utils/haptics";
import { shape, spacing } from "@/utils/spacing";

export interface AlbumRowProps {
  album: AlbumID3;
  onPress?: () => void;
  onLongPress?: () => void;
  getArtUrl?: ((id?: string | null) => string | null) | null;
  showMoreButton?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function AlbumRow({
  album,
  onPress,
  onLongPress,
  getArtUrl: propGetArtUrl,
  showMoreButton = true,
  style,
  testID,
}: AlbumRowProps) {
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
        console.error("failed to get cover art url helper in album row:", err),
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
        style={[styles.container, style]}
        testID={testID ?? `album-row-${album.id}`}
      >
        <View style={styles.rowContent}>
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
              <Avatar.Icon
                size={48}
                icon="album"
                style={styles.artworkFallback}
              />
            )}
          </View>

          <View style={styles.infoContainer}>
            <Text
              variant="bodyLarge"
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

          {showMoreButton ? (
            <IconButton
              icon="dots-vertical"
              size={20}
              mode="contained-tonal"
              accessibilityRole="button"
              accessibilityLabel="album options"
              onPress={handleOpenMenu}
              style={styles.moreButton}
            />
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
  artworkContainer: {
    marginRight: spacing.md,
  },
  artwork: {
    width: 48,
    height: 48,
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
    fontWeight: "500",
  },
  subtitleText: {
    marginTop: 2,
  },
  moreButton: {
    margin: 0,
  },
});
