import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Avatar,
  IconButton,
  Modal,
  Portal,
  Text,
  TouchableRipple,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { star, unstar } from "@/services/api";
import {
  getSongsByArtistId,
  updateArtistStarred,
} from "@/services/db";
import { addToQueue, playPlaylist } from "@/services/player";
import { showSnackbar } from "@/services/snackbar";
import { ArtistID3, useAppTheme } from "@/types";
import { triggerHapticSelection } from "@/utils/haptics";
import { shape, spacing } from "@/utils/spacing";

export interface ArtistContextMenuModalProps {
  visible: boolean;
  onDismiss: () => void;
  artist: ArtistID3 | null;
  getArtUrl?: ((id?: string | null) => string | null) | null;
  onGoToArtist?: (artistId: string) => void;
  onStarredChange?: (starred: boolean) => void;
}

export function ArtistContextMenuModal({
  visible,
  onDismiss,
  artist,
  getArtUrl,
  onGoToArtist,
  onStarredChange,
}: ArtistContextMenuModalProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [overrideStarred, setOverrideStarred] = useState<boolean | null>(null);
  const [isStarring, setIsStarring] = useState(false);

  const isStarred =
    overrideStarred !== null ? overrideStarred : Boolean(artist?.starred);

  const getArtistSongs = useCallback(() => {
    if (!artist) return [];
    return getSongsByArtistId(artist.id, artist.name);
  }, [artist]);

  const handlePlayArtist = useCallback(async () => {
    if (!artist) return;
    triggerHapticSelection();
    onDismiss();
    const songs = getArtistSongs();
    if (songs.length > 0) {
      await playPlaylist(songs, 0);
    } else {
      showSnackbar("no songs found for this artist");
    }
  }, [artist, onDismiss, getArtistSongs]);

  const handleShufflePlayArtist = useCallback(async () => {
    if (!artist) return;
    triggerHapticSelection();
    onDismiss();
    const songs = getArtistSongs();
    if (songs.length > 0) {
      const shuffled = [...songs].sort(() => Math.random() - 0.5);
      await playPlaylist(shuffled, 0);
    } else {
      showSnackbar("no songs found for this artist");
    }
  }, [artist, onDismiss, getArtistSongs]);

  const handleAddToQueue = useCallback(async () => {
    if (!artist) return;
    triggerHapticSelection();
    onDismiss();
    const songs = getArtistSongs();
    if (songs.length > 0) {
      await addToQueue(songs);
      showSnackbar(`added ${songs.length} ${songs.length === 1 ? "song" : "songs"} to queue`);
    } else {
      showSnackbar("no songs found for this artist");
    }
  }, [artist, onDismiss, getArtistSongs]);

  const handleGoToArtist = useCallback(() => {
    if (!artist) return;
    triggerHapticSelection();
    onDismiss();
    if (onGoToArtist) {
      onGoToArtist(artist.id);
    } else {
      router.push({
        pathname: "/artist/[id]",
        params: { id: artist.id },
      });
    }
  }, [artist, onDismiss, onGoToArtist, router]);

  const handleToggleStar = useCallback(async () => {
    if (!artist || isStarring) return;
    triggerHapticSelection();
    setIsStarring(true);
    const nextStarred = !isStarred;
    setOverrideStarred(nextStarred);

    try {
      if (nextStarred) {
        await star({ artistId: artist.id });
        updateArtistStarred(artist.id, new Date().toISOString());
      } else {
        await unstar({ artistId: artist.id });
        updateArtistStarred(artist.id, null);
      }
      onStarredChange?.(nextStarred);
      showSnackbar(nextStarred ? "added to favorites" : "removed from favorites");
    } catch (error) {
      console.error("failed to toggle star for artist:", error);
      setOverrideStarred(!nextStarred);
      showSnackbar("failed to update favorite");
    } finally {
      setIsStarring(false);
    }
  }, [artist, isStarring, isStarred, onStarredChange]);

  if (!artist) return null;

  let artUrl: string | null = null;
  if (artist.artistImageUrl && artist.artistImageUrl.startsWith("http")) {
    artUrl = artist.artistImageUrl;
  } else if (getArtUrl && artist.coverArt) {
    artUrl = getArtUrl(artist.coverArt);
  }

  const subtitle =
    artist.albumCount !== undefined && artist.albumCount !== null
      ? `${artist.albumCount} ${artist.albumCount === 1 ? "album" : "albums"}`
      : null;

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        style={styles.modalRoot}
        contentContainerStyle={[
          styles.sheetContainer,
          {
            backgroundColor: theme.colors.surfaceContainerLow,
            paddingBottom: Math.max(insets.bottom, spacing.md),
          },
        ]}
      >
        <View style={styles.dragHandleContainer}>
          <View
            style={[
              styles.dragHandle,
              { backgroundColor: theme.colors.outlineVariant },
            ]}
          />
        </View>

        <View style={styles.header}>
          {artUrl ? (
            <Image
              source={{ uri: artUrl, cacheKey: `${artist.coverArt ?? artist.id}-300` }}
              style={styles.headerArtwork}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <Avatar.Icon size={44} icon="account-music" style={styles.headerArtworkFallback} />
          )}
          <View style={styles.headerTextContainer}>
            <Text
              variant="titleMedium"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[styles.headerTitle, { color: theme.colors.onSurface }]}
            >
              {artist.name}
            </Text>
            {subtitle ? (
              <Text
                variant="bodySmall"
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        <View
          style={[
            styles.divider,
            { backgroundColor: theme.colors.outlineVariant },
          ]}
        />

        <TouchableRipple
          onPress={handlePlayArtist}
          accessibilityRole="button"
          accessibilityLabel="play artist"
          style={styles.menuItem}
        >
          <View style={styles.menuItemRow}>
            <IconButton
              icon="play"
              size={24}
              iconColor={theme.colors.onSurface}
              style={styles.menuIcon}
            />
            <Text
              variant="bodyLarge"
              style={[styles.menuLabel, { color: theme.colors.onSurface }]}
            >
              play
            </Text>
          </View>
        </TouchableRipple>

        <TouchableRipple
          onPress={handleShufflePlayArtist}
          accessibilityRole="button"
          accessibilityLabel="shuffle play artist"
          style={styles.menuItem}
        >
          <View style={styles.menuItemRow}>
            <IconButton
              icon="shuffle"
              size={24}
              iconColor={theme.colors.onSurface}
              style={styles.menuIcon}
            />
            <Text
              variant="bodyLarge"
              style={[styles.menuLabel, { color: theme.colors.onSurface }]}
            >
              shuffle play
            </Text>
          </View>
        </TouchableRipple>

        <TouchableRipple
          onPress={handleAddToQueue}
          accessibilityRole="button"
          accessibilityLabel="add to queue"
          style={styles.menuItem}
        >
          <View style={styles.menuItemRow}>
            <IconButton
              icon="playlist-plus"
              size={24}
              iconColor={theme.colors.onSurface}
              style={styles.menuIcon}
            />
            <Text
              variant="bodyLarge"
              style={[styles.menuLabel, { color: theme.colors.onSurface }]}
            >
              add to queue
            </Text>
          </View>
        </TouchableRipple>

        <TouchableRipple
          onPress={handleToggleStar}
          accessibilityRole="button"
          accessibilityLabel={isStarred ? "remove from favorites" : "add to favorites"}
          style={styles.menuItem}
        >
          <View style={styles.menuItemRow}>
            <IconButton
              icon={isStarred ? "heart" : "heart-outline"}
              size={24}
              iconColor={isStarred ? theme.colors.primary : theme.colors.onSurface}
              style={styles.menuIcon}
            />
            <Text
              variant="bodyLarge"
              style={[styles.menuLabel, { color: theme.colors.onSurface }]}
            >
              {isStarred ? "remove from favorites" : "add to favorites"}
            </Text>
          </View>
        </TouchableRipple>

        <TouchableRipple
          onPress={handleGoToArtist}
          accessibilityRole="button"
          accessibilityLabel="go to artist"
          style={styles.menuItem}
        >
          <View style={styles.menuItemRow}>
            <IconButton
              icon="account-music"
              size={24}
              iconColor={theme.colors.onSurface}
              style={styles.menuIcon}
            />
            <Text
              variant="bodyLarge"
              style={[styles.menuLabel, { color: theme.colors.onSurface }]}
            >
              go to artist
            </Text>
          </View>
        </TouchableRipple>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    justifyContent: "flex-end",
    margin: 0,
  },
  sheetContainer: {
    borderTopLeftRadius: shape.extraLarge,
    borderTopRightRadius: shape.extraLarge,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  dragHandleContainer: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: shape.full,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  headerArtwork: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  headerArtworkFallback: {
    backgroundColor: "transparent",
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: spacing.md,
  },
  headerTitle: {
    fontWeight: "600",
  },
  divider: {
    height: 1,
    marginVertical: spacing.xs,
  },
  menuItem: {
    borderRadius: shape.small,
    marginVertical: 1,
  },
  menuItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingRight: spacing.md,
  },
  menuIcon: {
    margin: 0,
    marginRight: spacing.sm,
  },
  menuLabel: {
    flex: 1,
  },
});
