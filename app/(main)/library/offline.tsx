import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { Appbar, Surface, Text } from "react-native-paper";

import { SongRow } from "@/components/SongRow";
import { getCoverArtBaseUrl } from "@/services/api";
import { getAllSongCacheEntries, getCachedSongs } from "@/services/db";
import { playPlaylist } from "@/services/player";
import { songsStyles } from "@/stylesheets";
import { Child, SongCacheRow, useAppTheme } from "@/types";

export default function AvailableOfflineScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [songs, setSongs] = useState<Child[]>(() => getCachedSongs());
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [cacheEntries, setCacheEntries] = useState<Map<string, SongCacheRow>>(() =>
    getAllSongCacheEntries?.() ?? new Map(),
  );
  const [getArtUrl, setGetArtUrl] = useState<
    ((id?: string | null) => string | null) | null
  >(null);

  const refreshSongsAndCache = useCallback(() => {
    setSongs(getCachedSongs());
    setCacheEntries(getAllSongCacheEntries?.() ?? new Map());
  }, []);

  useFocusEffect(refreshSongsAndCache);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    try {
      refreshSongsAndCache();
    } finally {
      setRefreshing(false);
    }
  }, [refreshSongsAndCache]);

  useEffect(() => {
    getCoverArtBaseUrl()
      .then((fn) => setGetArtUrl(() => fn))
      .catch((err) =>
        console.error("failed to get cover art url helper:", err),
      );
  }, []);

  return (
    <Surface style={songsStyles.page}>
      <Appbar.Header statusBarHeight={0}>
        <Appbar.BackAction
          onPress={() => router.back()}
          accessibilityLabel="go back"
        />
        <Appbar.Content title="available offline" />
      </Appbar.Header>

      <FlatList
        data={songs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={songsStyles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
            progressBackgroundColor={theme.colors.surfaceContainerHighest}
          />
        }
        ListEmptyComponent={
          <View style={songsStyles.emptyContainer}>
            <Text variant="bodyLarge">no songs available offline</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <SongRow
            song={item}
            index={index}
            subtitle={
              item.artist && item.album
                ? `${item.artist} • ${item.album}`
                : (item.artist ?? item.album ?? undefined)
            }
            onPress={() => playPlaylist(songs, index)}
            getArtUrl={getArtUrl}
            initialCacheEntry={cacheEntries.get(item.id) ?? null}
          />
        )}
      />
    </Surface>
  );
}
