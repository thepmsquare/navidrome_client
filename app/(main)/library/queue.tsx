import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, View } from "react-native";
import { Appbar, Avatar, IconButton, List, Surface, Text } from "react-native-paper";

import { CircularProgressRing } from "@/components/CircularProgressRing";
import { getCoverArtBaseUrl } from "@/services/api";
import { getSongById, getSongsByIds } from "@/services/db";
import {
  cancelSongCaching,
  dequeuePendingSong,
  getDownloadQueueState,
  subscribeCacheQueue,
  subscribeSongCacheProgress,
} from "@/services/songCache";
import { songsStyles } from "@/stylesheets";
import { Child, DownloadQueueState, useAppTheme } from "@/types";
import { spacing } from "@/utils/spacing";

interface QueueItem {
  song: Child;
  status: "active" | "pending";
}

export default function DownloadQueueScreen() {
  const router = useRouter();
  const theme = useAppTheme();

  const [queueState, setQueueState] = useState<DownloadQueueState>(() => {
    try {
      return getDownloadQueueState?.() ?? { pending: [], active: null };
    } catch {
      return { pending: [], active: null };
    }
  });

  const [songMap, setSongMap] = useState<Map<string, Child>>(() => {
    try {
      const state = getDownloadQueueState?.() ?? { pending: [], active: null };
      const allIds = [
        ...(state.active ? [state.active] : []),
        ...state.pending,
      ];
      if (allIds.length === 0) return new Map();
      const found = getSongsByIds?.(allIds) ?? [];
      const map = new Map<string, Child>();
      for (const s of found) {
        map.set(s.id, s);
      }
      for (const id of allIds) {
        if (!map.has(id)) {
          map.set(id, getSongById?.(id) ?? ({ id, title: id } as Child));
        }
      }
      return map;
    } catch {
      return new Map();
    }
  });

  const [progressMap, setProgressMap] = useState<Map<string, number>>(
    () => new Map(),
  );

  const [getArtUrl, setGetArtUrl] = useState<
    ((id?: string | null) => string | null) | null
  >(null);

  const refreshSongs = useCallback((state: DownloadQueueState) => {
    const allIds = [
      ...(state.active ? [state.active] : []),
      ...state.pending,
    ];
    if (allIds.length === 0) {
      setSongMap(new Map());
      return;
    }
    const found = getSongsByIds?.(allIds) ?? [];
    const map = new Map<string, Child>();
    for (const s of found) {
      map.set(s.id, s);
    }
    for (const id of allIds) {
      if (!map.has(id)) {
        map.set(id, getSongById?.(id) ?? ({ id, title: id } as Child));
      }
    }
    setSongMap(map);
  }, []);

  const refreshQueue = useCallback(() => {
    try {
      const state = getDownloadQueueState?.() ?? { pending: [], active: null };
      setQueueState(state);
      refreshSongs(state);
    } catch {
      // Ignore
    }
  }, [refreshSongs]);

  useFocusEffect(refreshQueue);

  useEffect(() => {
    getCoverArtBaseUrl()
      .then((fn) => setGetArtUrl(() => fn))
      .catch((err) =>
        console.error("failed to get cover art url helper:", err),
      );
  }, []);

  // Subscribe to queue state updates
  useEffect(() => {
    const unsubscribeQueue = subscribeCacheQueue?.((state) => {
      setQueueState(state);
      refreshSongs(state);
    });

    return () => {
      unsubscribeQueue?.();
    };
  }, [refreshSongs]);

  // Subscribe to live progress
  useEffect(() => {
    const unsubscribeProgress = subscribeSongCacheProgress?.(
      ({ songId, progress }) => {
        setProgressMap((prev) => {
          const next = new Map(prev);
          next.set(songId, progress);
          return next;
        });
      },
    );

    return () => {
      unsubscribeProgress?.();
    };
  }, []);

  const handleCancelSong = (songId: string) => {
    Alert.alert(
      "cancel download",
      "are you sure you want to cancel caching this song?",
      [
        {
          text: "no",
          style: "cancel",
        },
        {
          text: "yes",
          style: "destructive",
          onPress: () => {
            cancelSongCaching(songId);
          },
        },
      ],
    );
  };

  const queueItems: QueueItem[] = [];
  if (queueState.active) {
    const song =
      songMap.get(queueState.active) ??
      ({ id: queueState.active, title: queueState.active } as Child);
    queueItems.push({ song, status: "active" });
  }
  for (const pendingId of queueState.pending) {
    const song =
      songMap.get(pendingId) ??
      ({ id: pendingId, title: pendingId } as Child);
    queueItems.push({ song, status: "pending" });
  }

  const totalCount = queueItems.length;

  return (
    <Surface style={songsStyles.page}>
      <Appbar.Header statusBarHeight={0}>
        <Appbar.BackAction
          onPress={() => router.back()}
          accessibilityLabel="go back"
        />
        <Appbar.Content title="download queue" />
      </Appbar.Header>

      <View style={styles.counterContainer} testID="download-queue-counter">
        <Text
          variant="labelLarge"
          style={[styles.counterText, { color: theme.colors.onSurfaceVariant }]}
        >
          {totalCount === 1
            ? "1 song in queue"
            : `${totalCount} songs in queue`}
        </Text>
        {queueState.active && queueState.pending.length > 0 ? (
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.outline }}
          >
            {`1 downloading • ${queueState.pending.length} queued`}
          </Text>
        ) : null}
      </View>

      <FlatList
        data={queueItems}
        keyExtractor={(item) => item.song.id}
        contentContainerStyle={songsStyles.listContent}
        ListEmptyComponent={
          <View style={songsStyles.emptyContainer}>
            <Text variant="bodyLarge">no downloads in progress</Text>
          </View>
        }
        renderItem={({ item }) => {
          const song = item.song;
          const artUrl = getArtUrl ? getArtUrl(song.coverArt) : null;
          const description =
            song.artist && song.album
              ? `${song.artist} • ${song.album}`
              : (song.artist ?? song.album ?? undefined);

          if (item.status === "active") {
            const progress = progressMap.get(song.id) ?? 0;
            return (
              <List.Item
                title={song.title}
                description={description}
                left={(props) =>
                  artUrl ? (
                    <Image
                      source={{ uri: artUrl, cacheKey: `${song.coverArt}-300` }}
                      style={songsStyles.artwork}
                      contentFit="cover"
                      transition={200}
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <Avatar.Icon {...props} size={48} icon="music" />
                  )
                }
                right={() => (
                  <Pressable
                    style={styles.progressContainer}
                    accessibilityRole="button"
                    accessibilityLabel="cancel download"
                    onPress={() => handleCancelSong(song.id)}
                  >
                    <CircularProgressRing
                      progress={progress}
                      size={28}
                      strokeWidth={2.5}
                      color={theme.colors.tertiary}
                      trackColor={theme.colors.surfaceContainerHighest}
                      showPercentage
                    />
                  </Pressable>
                )}
              />
            );
          }

          return (
            <List.Item
              title={song.title}
              description={description}
              left={(props) =>
                artUrl ? (
                  <Image
                    source={{ uri: artUrl, cacheKey: `${song.coverArt}-300` }}
                    style={songsStyles.artwork}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <Avatar.Icon {...props} size={48} icon="music" />
                )
              }
              right={() => (
                <IconButton
                  icon="close"
                  size={20}
                  accessibilityRole="button"
                  accessibilityLabel="remove from queue"
                  onPress={() => dequeuePendingSong(song.id)}
                />
              )}
            />
          );
        }}
      />
    </Surface>
  );
}

const styles = StyleSheet.create({
  progressContainer: {
    justifyContent: "center",
    alignItems: "center",
    padding: 6,
  },
  counterContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  counterText: {
    fontWeight: "600",
  },
});
