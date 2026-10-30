import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Avatar,
  Button,
  Chip,
  IconButton,
  List,
  Surface,
  Text,
} from "react-native-paper";

import { getCoverArtBaseUrl } from "@/services/api";
import {
  getPendingScrobbles,
  getSongById,
  getSongsByIds,
} from "@/services/db";
import {
  clearAllPendingScrobbles,
  deletePendingScrobble,
  isScrobbleSyncInProgress,
  subscribeScrobbleQueue,
  syncPendingScrobbles,
  syncSinglePendingScrobble,
} from "@/services/scrobbleQueue";
import { songsStyles } from "@/stylesheets";
import { Child, PendingScrobble, useAppTheme } from "@/types";

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = Date.now();
  const diffSec = Math.floor((now - timestamp) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60);
    return `${mins}m ago`;
  }
  if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    return `${hours}h ago`;
  }
  return date
    .toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .toLowerCase();
}

export default function PendingScrobblesScreen() {
  const router = useRouter();
  const theme = useAppTheme();

  const [scrobbles, setScrobbles] = useState<PendingScrobble[]>(() => {
    try {
      return getPendingScrobbles();
    } catch {
      return [];
    }
  });

  const [isSyncing, setIsSyncing] = useState<boolean>(() =>
    isScrobbleSyncInProgress(),
  );
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [syncingItemId, setSyncingItemId] = useState<number | null>(null);

  const [songMap, setSongMap] = useState<Map<string, Child>>(() => {
    try {
      const items = getPendingScrobbles();
      const ids = Array.from(new Set(items.map((i) => i.songId)));
      if (ids.length === 0) return new Map();
      const songs = getSongsByIds(ids);
      const map = new Map<string, Child>();
      for (const s of songs) {
        map.set(s.id, s);
      }
      for (const id of ids) {
        if (!map.has(id)) {
          const single = getSongById(id);
          if (single) map.set(id, single);
        }
      }
      return map;
    } catch {
      return new Map();
    }
  });

  const [getArtUrl, setGetArtUrl] = useState<
    ((id?: string | null) => string | null) | null
  >(null);

  const reloadData = useCallback(() => {
    try {
      const items = getPendingScrobbles();
      setScrobbles(items);
      setIsSyncing(isScrobbleSyncInProgress());

      const ids = Array.from(new Set(items.map((i) => i.songId)));
      if (ids.length === 0) {
        setSongMap(new Map());
        return;
      }

      const songs = getSongsByIds(ids);
      const map = new Map<string, Child>();
      for (const s of songs) {
        map.set(s.id, s);
      }
      for (const id of ids) {
        if (!map.has(id)) {
          const single = getSongById(id);
          if (single) map.set(id, single);
        }
      }
      setSongMap(map);
    } catch (err) {
      console.error("failed to reload pending scrobbles:", err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reloadData();
    }, [reloadData]),
  );

  useEffect(() => {
    getCoverArtBaseUrl()
      .then((fn) => setGetArtUrl(() => fn))
      .catch((err) =>
        console.error("failed to get cover art url helper:", err),
      );
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeScrobbleQueue(() => {
      reloadData();
    });
    return unsubscribe;
  }, [reloadData]);

  const handleSyncAll = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await syncPendingScrobbles();
      if (result.synced > 0 || result.failed > 0) {
        Alert.alert(
          "sync completed",
          `synced ${result.synced} scrobbles${
            result.failed > 0 ? `, ${result.failed} failed` : ""
          }`,
        );
      }
    } finally {
      setIsSyncing(false);
      reloadData();
    }
  };

  const handlePullRefresh = async () => {
    setRefreshing(true);
    try {
      await handleSyncAll();
    } finally {
      setRefreshing(false);
    }
  };

  const handleSyncSingle = async (item: PendingScrobble) => {
    if (isSyncing || syncingItemId !== null) return;
    setSyncingItemId(item.id);
    try {
      const success = await syncSinglePendingScrobble(item.id);
      if (!success) {
        Alert.alert("sync failed", "could not sync scrobble to server");
      }
    } finally {
      setSyncingItemId(null);
      reloadData();
    }
  };

  const handleDeleteItem = (item: PendingScrobble) => {
    Alert.alert(
      "delete scrobble",
      "are you sure you want to remove this pending scrobble from the queue?",
      [
        {
          text: "cancel",
          style: "cancel",
        },
        {
          text: "delete",
          style: "destructive",
          onPress: () => {
            deletePendingScrobble(item.id);
          },
        },
      ],
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      "clear all",
      "are you sure you want to clear all pending scrobbles?",
      [
        {
          text: "cancel",
          style: "cancel",
        },
        {
          text: "clear",
          style: "destructive",
          onPress: () => {
            clearAllPendingScrobbles();
          },
        },
      ],
    );
  };

  return (
    <Surface style={styles.container}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="pending scrobbles" />
        {scrobbles.length > 0 && (
          <>
            <Appbar.Action
              icon="sync"
              disabled={isSyncing}
              onPress={handleSyncAll}
              accessibilityLabel="sync all pending scrobbles"
            />
            <Appbar.Action
              icon="delete-sweep"
              disabled={isSyncing}
              onPress={handleClearAll}
              accessibilityLabel="clear all pending scrobbles"
            />
          </>
        )}
      </Appbar.Header>

      {scrobbles.length > 0 && (
        <Surface
          elevation={0}
          style={[
            styles.statusBar,
            { backgroundColor: theme.colors.surfaceContainerHighest },
          ]}
        >
          <View style={styles.statusInfo}>
            <Text variant="titleSmall">
              {scrobbles.length === 1
                ? "1 pending scrobble"
                : `${scrobbles.length} pending scrobbles`}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {isSyncing
                ? "syncing with server..."
                : "queued offline plays waiting to sync"}
            </Text>
          </View>
          <Button
            mode="contained-tonal"
            icon="sync"
            loading={isSyncing}
            disabled={isSyncing}
            onPress={handleSyncAll}
            compact
          >
            sync now
          </Button>
        </Surface>
      )}

      <FlatList
        data={scrobbles}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[
          songsStyles.listContent,
          scrobbles.length === 0 && styles.emptyListContent,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handlePullRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
            progressBackgroundColor={theme.colors.surfaceContainerHighest}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Avatar.Icon
              size={64}
              icon="cloud-check-outline"
              style={{ backgroundColor: theme.colors.surfaceContainerHighest }}
              color={theme.colors.primary}
            />
            <Text
              variant="titleMedium"
              style={[styles.emptyTitle, { color: theme.colors.onSurface }]}
            >
              no pending scrobbles
            </Text>
            <Text
              variant="bodyMedium"
              style={[
                styles.emptySubtitle,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              all plays have been synced to the server
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const song = songMap.get(item.songId);
          const title = song?.title || item.songId;
          const artUrl =
            song?.coverArt && getArtUrl ? getArtUrl(song.coverArt) : null;
          const artist = song?.artist ?? song?.displayAlbumArtist;
          const album = song?.album;
          const subtitleParts: string[] = [];
          if (artist) subtitleParts.push(artist);
          if (album) subtitleParts.push(album);
          const subtitle = subtitleParts.join(" • ");

          const isItemSyncing = syncingItemId === item.id;

          return (
            <Surface
              elevation={0}
              style={[
                styles.itemCard,
                { backgroundColor: theme.colors.surfaceContainerLow },
              ]}
            >
              <List.Item
                title={title}
                titleNumberOfLines={1}
                description={() => (
                  <View style={styles.descriptionContainer}>
                    {subtitle.length > 0 && (
                      <Text
                        variant="bodySmall"
                        numberOfLines={1}
                        style={{ color: theme.colors.onSurfaceVariant }}
                      >
                        {subtitle}
                      </Text>
                    )}
                    <View style={styles.badgeRow}>
                      <Text
                        variant="labelSmall"
                        style={{ color: theme.colors.outline }}
                      >
                        {`played: ${formatTimestamp(item.timestamp)}`}
                      </Text>
                      {item.attempts > 0 ? (
                        <Chip
                          compact
                          textStyle={styles.chipText}
                          style={[
                            styles.chip,
                            {
                              backgroundColor:
                                theme.colors.errorContainer,
                            },
                          ]}
                        >
                          <Text
                            variant="labelSmall"
                            style={{ color: theme.colors.onErrorContainer }}
                          >
                            {`failed (${item.attempts} attempts)`}
                          </Text>
                        </Chip>
                      ) : (
                        <Chip
                          compact
                          textStyle={styles.chipText}
                          style={[
                            styles.chip,
                            {
                              backgroundColor:
                                theme.colors.surfaceContainerHighest,
                            },
                          ]}
                        >
                          <Text
                            variant="labelSmall"
                            style={{ color: theme.colors.onSurfaceVariant }}
                          >
                            pending
                          </Text>
                        </Chip>
                      )}
                    </View>
                  </View>
                )}
                left={(props) =>
                  artUrl ? (
                    <Image
                      source={{
                        uri: artUrl,
                        cacheKey: `${song?.coverArt}-300`,
                      }}
                      style={songsStyles.artwork}
                      contentFit="cover"
                      transition={200}
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <Avatar.Icon
                      {...props}
                      size={48}
                      icon="music"
                      style={styles.avatarIcon}
                    />
                  )
                }
                right={() => (
                  <View style={styles.actionsRow}>
                    {isItemSyncing ? (
                      <ActivityIndicator
                        size={20}
                        style={styles.actionSpinner}
                        color={theme.colors.primary}
                      />
                    ) : (
                      <IconButton
                        icon="sync"
                        size={20}
                        disabled={isSyncing}
                        onPress={() => handleSyncSingle(item)}
                        accessibilityLabel="sync scrobble now"
                      />
                    )}
                    <IconButton
                      icon="delete-outline"
                      size={20}
                      disabled={isSyncing || isItemSyncing}
                      onPress={() => handleDeleteItem(item)}
                      accessibilityLabel="delete pending scrobble"
                    />
                  </View>
                )}
              />
            </Surface>
          );
        }}
      />
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 12,
  },
  statusInfo: {
    flex: 1,
    marginRight: 8,
    gap: 2,
  },
  itemCard: {
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    overflow: "hidden",
  },
  descriptionContainer: {
    marginTop: 2,
    gap: 4,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 2,
  },
  chip: {
    height: 24,
    alignSelf: "flex-start",
  },
  chipText: {
    fontSize: 11,
    lineHeight: 12,
    marginVertical: 0,
    marginHorizontal: 0,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionSpinner: {
    marginHorizontal: 12,
  },
  avatarIcon: {
    marginRight: 8,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 64,
    gap: 12,
  },
  emptyTitle: {
    marginTop: 8,
  },
  emptySubtitle: {
    textAlign: "center",
  },
});

