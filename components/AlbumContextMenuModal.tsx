import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
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

import { getAlbumById, getArtistByName } from "@/services/db";
import { AlbumID3, useAppTheme } from "@/types";
import { triggerHapticSelection } from "@/utils/haptics";
import { shape, spacing } from "@/utils/spacing";

export interface AlbumContextMenuModalProps {
  visible: boolean;
  onDismiss: () => void;
  album: AlbumID3 | null;
  getArtUrl?: ((id?: string | null) => string | null) | null;
  onGoToArtist?: (artistId: string) => void;
}

export function AlbumContextMenuModal({
  visible,
  onDismiss,
  album,
  getArtUrl,
  onGoToArtist,
}: AlbumContextMenuModalProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const resolvedArtistId = useMemo(() => {
    if (!album) return null;
    if (album.artistId) return album.artistId;
    try {
      const dbAlbum = getAlbumById(album.id);
      if (dbAlbum?.artistId) return dbAlbum.artistId;
    } catch {}
    if (album.artist) {
      try {
        const art = getArtistByName(album.artist);
        if (art?.id) return art.id;
      } catch {}
    }
    return null;
  }, [album]);

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

  if (!album) return null;

  const artUrl = getArtUrl ? getArtUrl(album.coverArt) : null;
  const subtitle = album.year
    ? `${album.artist ?? ""} • ${album.year}`.trim()
    : (album.artist ?? "");

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
              source={{ uri: artUrl, cacheKey: `${album.coverArt}-300` }}
              style={styles.headerArtwork}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <Avatar.Icon size={44} icon="album" style={styles.headerArtwork} />
          )}
          <View style={styles.headerTextContainer}>
            <Text
              variant="titleMedium"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[styles.headerTitle, { color: theme.colors.onSurface }]}
            >
              {album.name}
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

        {resolvedArtistId ? (
          <>
            <View
              style={[
                styles.divider,
                { backgroundColor: theme.colors.outlineVariant },
              ]}
            />

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
          </>
        ) : null}
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
