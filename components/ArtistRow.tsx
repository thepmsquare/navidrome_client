import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Avatar, IconButton, Text, TouchableRipple } from "react-native-paper";

import { ArtistContextMenuModal } from "@/components/ArtistContextMenuModal";
import { getCoverArtBaseUrl } from "@/services/api";
import { ArtistID3, useAppTheme } from "@/types";
import { triggerHapticSelection } from "@/utils/haptics";
import { shape, spacing } from "@/utils/spacing";

export interface ArtistRowProps {
  artist: ArtistID3;
  onPress?: () => void;
  onLongPress?: () => void;
  getArtUrl?: ((id?: string | null) => string | null) | null;
  showMoreButton?: boolean;
  onStarredChange?: (starred: boolean) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function ArtistRow({
  artist,
  onPress,
  onLongPress,
  getArtUrl: propGetArtUrl,
  showMoreButton = true,
  onStarredChange,
  style,
  testID,
}: ArtistRowProps) {
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
        console.error("failed to get cover art url helper in artist row:", err),
      );
  }, [propGetArtUrl]);

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress();
    } else {
      router.push({ pathname: "/artist/[id]", params: { id: artist.id } });
    }
  }, [onPress, router, artist.id]);

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
    if (artist.artistImageUrl && artist.artistImageUrl.startsWith("http")) {
      return artist.artistImageUrl;
    }
    if (getArtUrl && artist.coverArt) {
      return getArtUrl(artist.coverArt);
    }
    return null;
  }, [artist.artistImageUrl, artist.coverArt, getArtUrl]);

  const subtitle = useMemo(() => {
    if (artist.albumCount === undefined || artist.albumCount === null) {
      return null;
    }
    return `${artist.albumCount} ${artist.albumCount === 1 ? "album" : "albums"}`;
  }, [artist.albumCount]);

  const a11yLabel = useMemo(() => {
    const name = artist.name || "unknown artist";
    const albums = subtitle ? `, ${subtitle}` : "";
    return `open ${name}${albums}`.toLowerCase();
  }, [artist.name, subtitle]);

  return (
    <>
      <TouchableRipple
        onPress={handlePress}
        onLongPress={handleLongPress}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityHint="tap to open, long-press for options"
        style={[styles.container, style]}
        testID={testID ?? `artist-row-${artist.id}`}
      >
        <View style={styles.rowContent}>
          <View style={styles.artworkContainer}>
            {artUrl ? (
              <Image
                source={{ uri: artUrl, cacheKey: `${artist.coverArt ?? artist.id}-300` }}
                style={styles.artwork}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
            ) : (
              <Avatar.Icon
                size={48}
                icon="account-music"
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
              {artist.name}
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

          {showMoreButton ? (
            <IconButton
              icon="dots-vertical"
              size={20}
              mode="contained-tonal"
              accessibilityRole="button"
              accessibilityLabel="artist options"
              onPress={handleOpenMenu}
              style={styles.moreButton}
            />
          ) : null}
        </View>
      </TouchableRipple>

      {menuVisible ? (
        <ArtistContextMenuModal
          visible={menuVisible}
          onDismiss={handleDismissMenu}
          artist={artist}
          getArtUrl={getArtUrl}
          onStarredChange={onStarredChange}
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
    borderRadius: 24, // circular avatar for artists
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
