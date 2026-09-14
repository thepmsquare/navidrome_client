import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { Appbar, Avatar, List, Surface, Text } from "react-native-paper";

import { SongCacheButton } from "@/components/SongCacheButton";
import { getCoverArtBaseUrl } from "@/services/api";
import { getAllSongCacheEntries, getCachedSongs } from "@/services/db";
import { playPlaylist } from "@/services/player";
import { songsStyles } from "@/stylesheets";
import { Child, SongCacheRow } from "@/types";

export default function AvailableOfflineScreen() {
  const router = useRouter();
  const [songs, setSongs] = useState<Child[]>(() => getCachedSongs());
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
        ListEmptyComponent={
          <View style={songsStyles.emptyContainer}>
            <Text variant="bodyLarge">no songs available offline</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const artUrl = getArtUrl ? getArtUrl(item.coverArt) : null;
          const description =
            item.artist && item.album
              ? `${item.artist} • ${item.album}`
              : (item.artist ?? item.album ?? undefined);

          return (
            <List.Item
              title={item.title}
              description={description}
              onPress={() => playPlaylist(songs, index)}
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
                <SongCacheButton
                  songId={item.id}
                  mini
                  hideIfUncached
                  initialEntry={cacheEntries.get(item.id) ?? null}
                  onCacheRemoved={refreshSongsAndCache}
                />
              )}
            />
          );
        }}
      />
    </Surface>
  );
}
