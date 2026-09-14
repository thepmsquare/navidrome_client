import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, View } from "react-native";
import { Appbar, Avatar, List, Surface, Text } from "react-native-paper";

import { CircularProgressRing } from "@/components/CircularProgressRing";
import { getCoverArtBaseUrl } from "@/services/api";
import { getSongById, getSongsByIds } from "@/services/db";
import {
  cancelSongCaching,
  getActiveDownloadSongIds,
  subscribeSongCache,
  subscribeSongCacheProgress,
} from "@/services/songCache";
import { songsStyles } from "@/stylesheets";
import { Child, useAppTheme } from "@/types";

export default function DownloadQueueScreen() {
  const router = useRouter();
  const theme = useAppTheme();

  const [activeSongs, setActiveSongs] = useState<Child[]>(() => {
    const ids = getActiveDownloadSongIds?.() ?? [];
    if (ids.length === 0) return [];
    const found = getSongsByIds?.(ids) ?? [];
    const map = new Map(found.map((s) => [s.id, s]));
    return ids.map((id) => map.get(id) ?? ({ id, title: id } as Child));
  });

  const [progressMap, setProgressMap] = useState<Map<string, number>>(
    () => new Map(),
  );

  const [getArtUrl, setGetArtUrl] = useState<
    ((id?: string | null) => string | null) | null
  >(null);

  const refreshActiveSongs = useCallback(() => {
    const ids = getActiveDownloadSongIds?.() ?? [];
    if (ids.length === 0) {
      setActiveSongs([]);
      return;
    }
    const found = getSongsByIds?.(ids) ?? [];
    const map = new Map(found.map((s) => [s.id, s]));
    setActiveSongs(ids.map((id) => map.get(id) ?? ({ id, title: id } as Child)));
  }, []);

  useFocusEffect(refreshActiveSongs);

  useEffect(() => {
    getCoverArtBaseUrl()
      .then((fn) => setGetArtUrl(() => fn))
      .catch((err) =>
        console.error("failed to get cover art url helper:", err),
      );
  }, []);

  // Subscribe to live progress
  useEffect(() => {
    const unsubscribeProgress = subscribeSongCacheProgress(
      ({ songId, progress }) => {
        setProgressMap((prev) => {
          const next = new Map(prev);
          next.set(songId, progress);
          return next;
        });

        // Ensure newly started download is in list
        setActiveSongs((prev) => {
          if (prev.some((s) => s.id === songId)) {
            return prev;
          }
          const song = getSongById?.(songId) ?? ({ id: songId, title: songId } as Child);
          return [...prev, song];
        });
      },
    );

    // Subscribe to completions/reverts to remove from queue
    const unsubscribeCache = subscribeSongCache(({ songId }) => {
      setActiveSongs((prev) => prev.filter((s) => s.id !== songId));
      setProgressMap((prev) => {
        const next = new Map(prev);
        next.delete(songId);
        return next;
      });
    });

    return () => {
      unsubscribeProgress();
      unsubscribeCache();
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

  return (
    <Surface style={songsStyles.page}>
      <Appbar.Header statusBarHeight={0}>
        <Appbar.BackAction
          onPress={() => router.back()}
          accessibilityLabel="go back"
        />
        <Appbar.Content title="download queue" />
      </Appbar.Header>

      <FlatList
        data={activeSongs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={songsStyles.listContent}
        ListEmptyComponent={
          <View style={songsStyles.emptyContainer}>
            <Text variant="bodyLarge">no downloads in progress</Text>
          </View>
        }
        renderItem={({ item }) => {
          const artUrl = getArtUrl ? getArtUrl(item.coverArt) : null;
          const progress = progressMap.get(item.id) ?? 0;
          const description =
            item.artist && item.album
              ? `${item.artist} • ${item.album}`
              : (item.artist ?? item.album ?? undefined);

          return (
            <List.Item
              title={item.title}
              description={description}
              left={(props) =>
                artUrl ? (
                  <Image
                    source={{ uri: artUrl, cacheKey: `${item.coverArt}-300` }}
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
                  onPress={() => handleCancelSong(item.id)}
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
});
