import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback } from "react";
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

import { getPlaylist } from "@/services/api";
import { addToQueue, playPlaylist } from "@/services/player";
import { showSnackbar } from "@/services/snackbar";
import { Playlist, useAppTheme } from "@/types";
import { triggerHapticSelection } from "@/utils/haptics";
import { shape, spacing } from "@/utils/spacing";

export interface PlaylistContextMenuModalProps {
  visible: boolean;
  onDismiss: () => void;
  playlist: Playlist | null;
  getArtUrl?: ((id?: string | null) => string | null) | null;
  onGoToPlaylist?: (playlistId: string) => void;
}

export function PlaylistContextMenuModal({
  visible,
  onDismiss,
  playlist,
  getArtUrl,
  onGoToPlaylist,
}: PlaylistContextMenuModalProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const fetchPlaylistSongs = useCallback(async () => {
    if (!playlist) return [];
    try {
      const full = await getPlaylist(playlist.id);
      return full.entry ?? [];
    } catch (err) {
      console.error("failed to fetch playlist tracks for playback:", err);
      return [];
    }
  }, [playlist]);

  const handlePlayPlaylist = useCallback(async () => {
    if (!playlist) return;
    triggerHapticSelection();
    onDismiss();
    const songs = await fetchPlaylistSongs();
    if (songs.length > 0) {
      await playPlaylist(songs, 0);
    } else {
      showSnackbar("no tracks found in playlist");
    }
  }, [playlist, onDismiss, fetchPlaylistSongs]);

  const handleShufflePlayPlaylist = useCallback(async () => {
    if (!playlist) return;
    triggerHapticSelection();
    onDismiss();
    const songs = await fetchPlaylistSongs();
    if (songs.length > 0) {
      const shuffled = [...songs].sort(() => Math.random() - 0.5);
      await playPlaylist(shuffled, 0);
    } else {
      showSnackbar("no tracks found in playlist");
    }
  }, [playlist, onDismiss, fetchPlaylistSongs]);

  const handleAddToQueue = useCallback(async () => {
    if (!playlist) return;
    triggerHapticSelection();
    onDismiss();
    const songs = await fetchPlaylistSongs();
    if (songs.length > 0) {
      await addToQueue(songs);
      showSnackbar(`added ${songs.length} ${songs.length === 1 ? "track" : "tracks"} to queue`);
    } else {
      showSnackbar("no tracks found in playlist");
    }
  }, [playlist, onDismiss, fetchPlaylistSongs]);

  const handleGoToPlaylist = useCallback(() => {
    if (!playlist) return;
    triggerHapticSelection();
    onDismiss();
    if (onGoToPlaylist) {
      onGoToPlaylist(playlist.id);
    } else {
      router.push({
        pathname: "/(main)/library/playlist/[id]",
        params: { id: playlist.id },
      });
    }
  }, [playlist, onDismiss, onGoToPlaylist, router]);

  if (!playlist) return null;

  const artUrl = getArtUrl ? getArtUrl(playlist.coverArt) : null;
  const subtitle =
    playlist.songCount !== undefined && playlist.songCount !== null
      ? `${playlist.songCount} ${playlist.songCount === 1 ? "track" : "tracks"}`
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
              source={{ uri: artUrl, cacheKey: `${playlist.coverArt ?? playlist.id}-300` }}
              style={styles.headerArtwork}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <Avatar.Icon size={44} icon="playlist-music" style={styles.headerArtworkFallback} />
          )}
          <View style={styles.headerTextContainer}>
            <Text
              variant="titleMedium"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[styles.headerTitle, { color: theme.colors.onSurface }]}
            >
              {playlist.name}
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
          onPress={handlePlayPlaylist}
          accessibilityRole="button"
          accessibilityLabel="play playlist"
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
          onPress={handleShufflePlayPlaylist}
          accessibilityRole="button"
          accessibilityLabel="shuffle play playlist"
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
          onPress={handleGoToPlaylist}
          accessibilityRole="button"
          accessibilityLabel="go to playlist"
          style={styles.menuItem}
        >
          <View style={styles.menuItemRow}>
            <IconButton
              icon="playlist-music"
              size={24}
              iconColor={theme.colors.onSurface}
              style={styles.menuIcon}
            />
            <Text
              variant="bodyLarge"
              style={[styles.menuLabel, { color: theme.colors.onSurface }]}
            >
              go to playlist
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
    borderRadius: shape.small,
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
