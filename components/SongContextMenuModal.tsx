import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
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
  getAlbumByName,
  getArtistByName,
  getSongById,
  updateSongStarred,
} from "@/services/db";
import {
  addToQueue,
  playNext,
  updateTrackStarredState,
} from "@/services/player";
import { SongCacheButton } from "@/components/SongCacheButton";
import { Child, useAppTheme } from "@/types";
import { triggerHapticSelection } from "@/utils/haptics";
import { shape, spacing } from "@/utils/spacing";

export interface SongContextMenuModalProps {
  visible: boolean;
  onDismiss: () => void;
  song: Child | null;
  getArtUrl?: ((id?: string | null) => string | null) | null;
  onPlayNext?: () => void;
  onAddToQueue?: () => void;
  onGoToArtist?: (artistId: string) => void;
  onGoToAlbum?: (albumId: string) => void;
  onStarredChange?: (starred: boolean) => void;
}

export function SongContextMenuModal({
  visible,
  onDismiss,
  song,
  getArtUrl,
  onPlayNext,
  onAddToQueue,
  onGoToArtist,
  onGoToAlbum,
  onStarredChange,
}: SongContextMenuModalProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [overrideStarred, setOverrideStarred] = useState<boolean | null>(null);
  const isStarred =
    overrideStarred !== null ? overrideStarred : Boolean(song?.starred);

  const resolvedArtistId = useMemo(() => {
    if (!song) return null;
    if (song.artistId) return song.artistId;
    try {
      const dbSong = getSongById(song.id);
      if (dbSong?.artistId) return dbSong.artistId;
    } catch {}
    if (song.artist) {
      try {
        const art = getArtistByName(song.artist);
        if (art?.id) return art.id;
      } catch {}
    }
    return null;
  }, [song]);

  const resolvedAlbumId = useMemo(() => {
    if (!song) return null;
    if (song.albumId) return song.albumId;
    try {
      const dbSong = getSongById(song.id);
      if (dbSong?.albumId) return dbSong.albumId;
    } catch {}
    if (song.album) {
      try {
        const alb = getAlbumByName(
          song.album,
          song.artistId ?? song.artist ?? undefined,
        );
        if (alb?.id) return alb.id;
      } catch {}
    }
    return null;
  }, [song]);

  const handlePlayNext = useCallback(async () => {
    if (!song) return;
    triggerHapticSelection();
    onDismiss();
    if (onPlayNext) {
      onPlayNext();
    } else {
      await playNext(song);
    }
  }, [song, onDismiss, onPlayNext]);

  const handleAddToQueue = useCallback(async () => {
    if (!song) return;
    triggerHapticSelection();
    onDismiss();
    if (onAddToQueue) {
      onAddToQueue();
    } else {
      await addToQueue(song);
    }
  }, [song, onDismiss, onAddToQueue]);

  const handleGoToArtist = useCallback(() => {
    if (!resolvedArtistId) return;
    triggerHapticSelection();
    onDismiss();
    if (onGoToArtist) {
      onGoToArtist(resolvedArtistId);
    } else {
      router.push({
        pathname: "/artist/[id]",
        params: { id: resolvedArtistId },
      });
    }
  }, [resolvedArtistId, onDismiss, onGoToArtist, router]);

  const handleGoToAlbum = useCallback(() => {
    if (!resolvedAlbumId) return;
    triggerHapticSelection();
    onDismiss();
    if (onGoToAlbum) {
      onGoToAlbum(resolvedAlbumId);
    } else {
      router.push({
        pathname: "/album/[id]",
        params: { id: resolvedAlbumId },
      });
    }
  }, [resolvedAlbumId, onDismiss, onGoToAlbum, router]);

  const handleToggleStar = useCallback(async () => {
    if (!song) return;
    triggerHapticSelection();
    const nextVal = !isStarred;
    setOverrideStarred(nextVal);
    const newStarredDate = nextVal ? new Date().toISOString() : null;
    updateTrackStarredState(song.id, newStarredDate);
    try {
      updateSongStarred(song.id, newStarredDate);
    } catch {}
    onDismiss();
    onStarredChange?.(nextVal);
    try {
      if (nextVal) {
        await star(song.id);
      } else {
        await unstar(song.id);
      }
    } catch (err) {
      console.error("failed to toggle star from context menu:", err);
    }
  }, [song, isStarred, onDismiss, onStarredChange]);

  if (!song) return null;

  const artUrl = getArtUrl ? getArtUrl(song.coverArt) : null;
  const subtitle =
    song.artist && song.album
      ? `${song.artist} • ${song.album}`
      : (song.artist ?? song.album ?? "");

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

        {/* Header with track details */}
        <View style={styles.header}>
          {artUrl ? (
            <Image
              source={{ uri: artUrl, cacheKey: `${song.coverArt}-300` }}
              style={styles.headerArtwork}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <Avatar.Icon size={44} icon="music" style={styles.headerArtwork} />
          )}
          <View style={styles.headerTextContainer}>
            <Text
              variant="titleMedium"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[styles.headerTitle, { color: theme.colors.onSurface }]}
            >
              {song.title}
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

        {/* Menu items */}
        <TouchableRipple
          onPress={handlePlayNext}
          accessibilityRole="button"
          accessibilityLabel="play next"
          style={styles.menuItem}
        >
          <View style={styles.menuItemRow}>
            <IconButton
              icon="playlist-play"
              size={24}
              iconColor={theme.colors.onSurface}
              style={styles.menuIcon}
            />
            <Text
              variant="bodyLarge"
              style={[styles.menuLabel, { color: theme.colors.onSurface }]}
            >
              play next
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

        {resolvedArtistId ? (
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
        ) : null}

        {resolvedAlbumId ? (
          <TouchableRipple
            onPress={handleGoToAlbum}
            accessibilityRole="button"
            accessibilityLabel="go to album"
            style={styles.menuItem}
          >
            <View style={styles.menuItemRow}>
              <IconButton
                icon="album"
                size={24}
                iconColor={theme.colors.onSurface}
                style={styles.menuIcon}
              />
              <Text
                variant="bodyLarge"
                style={[styles.menuLabel, { color: theme.colors.onSurface }]}
              >
                go to album
              </Text>
            </View>
          </TouchableRipple>
        ) : null}

        <TouchableRipple
          onPress={handleToggleStar}
          accessibilityRole="button"
          accessibilityLabel={isStarred ? "unfavorite" : "favorite"}
          style={styles.menuItem}
        >
          <View style={styles.menuItemRow}>
            <IconButton
              icon={isStarred ? "heart" : "heart-outline"}
              size={24}
              iconColor={
                isStarred ? theme.colors.primary : theme.colors.onSurface
              }
              style={styles.menuIcon}
            />
            <Text
              variant="bodyLarge"
              style={[
                styles.menuLabel,
                {
                  color: isStarred
                    ? theme.colors.primary
                    : theme.colors.onSurface,
                },
              ]}
            >
              {isStarred ? "unfavorite" : "favorite"}
            </Text>
          </View>
        </TouchableRipple>

        <SongCacheButton
          songId={song.id}
          variant="menu-item"
          onAction={() => {
            triggerHapticSelection();
            onDismiss();
          }}
        />
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
