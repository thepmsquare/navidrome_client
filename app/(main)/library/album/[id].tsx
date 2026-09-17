import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { Appbar, Avatar, List, Surface, Text } from "react-native-paper";

import { BulkSongCacheButton } from "@/components/BulkSongCacheButton";
import { SongCacheButton } from "@/components/SongCacheButton";
import { getCoverArtBaseUrl } from "@/services/api";
import { getAlbumById, getAllSongCacheEntries, getSongsByAlbumId } from "@/services/db";
import { playPlaylist } from "@/services/player";
import { subscribeSongCache } from "@/services/songCache";
import { albumDetailStyles } from "@/stylesheets";
import { AlbumID3, Child, SongCacheRow, useAppTheme } from "@/types";

function formatDuration(seconds?: number): string {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function AlbumDetailScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [album] = useState<AlbumID3 | null>(() => (id ? getAlbumById(id) : null));
  const [songs] = useState<Child[]>(() => (id ? getSongsByAlbumId(id) : []));
  const [cacheEntries, setCacheEntries] = useState<Map<string, SongCacheRow>>(() =>
    getAllSongCacheEntries(),
  );
  const [getArtUrl, setGetArtUrl] = useState<
    ((artId?: string | null) => string | null) | null
  >(null);

  useFocusEffect(
    useCallback(() => {
      setCacheEntries(getAllSongCacheEntries());
    }, []),
  );

  useEffect(() => {
    const unsubscribe = subscribeSongCache(({ songId, entry }) => {
      setCacheEntries((prev) => {
        const next = new Map(prev);
        if (entry) {
          next.set(songId, entry);
        } else {
          next.delete(songId);
        }
        return next;
      });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    getCoverArtBaseUrl()
      .then((fn) => setGetArtUrl(() => fn))
      .catch((err) =>
        console.error("failed to get cover art url helper:", err),
      );
  }, []);

  const artUrl = album && getArtUrl ? getArtUrl(album.coverArt) : null;

  return (
    <Surface style={albumDetailStyles.page}>
      <Appbar.Header statusBarHeight={0}>
        <Appbar.BackAction
          onPress={() => router.back()}
          accessibilityLabel="go back"
        />
        <Appbar.Content title="album" />
        <Appbar.Action
          icon="play"
          onPress={() => {
            if (songs.length > 0) {
              playPlaylist(songs, 0);
            }
          }}
          disabled={songs.length === 0}
          accessibilityLabel="play album"
        />
      </Appbar.Header>

      <FlatList
        data={songs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={albumDetailStyles.listContent}
        ListHeaderComponent={
          album ? (
            <View style={albumDetailStyles.albumInfoContainer}>
              {artUrl ? (
                <Image
                  source={{ uri: artUrl, cacheKey: `${album.coverArt}-300` }}
                  style={albumDetailStyles.coverArt}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              ) : (
                <Avatar.Icon size={120} icon="album" />
              )}
              <Text variant="headlineSmall" style={albumDetailStyles.albumName}>
                {album.name}
              </Text>
              {album.artist ? (
                <Text
                  variant="titleMedium"
                  style={[
                    albumDetailStyles.artistName,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {album.artist}
                </Text>
              ) : null}
              <Text
                variant="bodySmall"
                style={[
                  albumDetailStyles.metaText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {[
                  album.year ? `${album.year}` : null,
                  album.songCount ? `${album.songCount} songs` : null,
                ]
                  .filter(Boolean)
                  .join(" • ")}
              </Text>
              <BulkSongCacheButton
                songIds={songs.map((s) => s.id)}
                cacheEntries={cacheEntries}
              />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={albumDetailStyles.emptyContainer}>
            <Text variant="bodyLarge">no songs found in album</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <List.Item
            title={item.title}
            description={item.artist ?? undefined}
            style={albumDetailStyles.trackItem}
            onPress={() => playPlaylist(songs, index)}
            left={() => (
              <Text
                variant="bodyMedium"
                style={[
                  albumDetailStyles.trackNumber,
                  { color: theme.colors.outline },
                ]}
              >
                {item.track ? `${item.track}` : "-"}
              </Text>
            )}
            right={() => (
              <View style={albumDetailStyles.rightContainer}>
                <SongCacheButton
                  songId={item.id}
                  mini
                  hideIfUncached
                  initialEntry={cacheEntries.get(item.id) ?? null}
                />
                {item.duration ? (
                  <Text
                    variant="bodySmall"
                    style={[
                      albumDetailStyles.metaText,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    {formatDuration(item.duration)}
                  </Text>
                ) : null}
              </View>
            )}
          />
        )}
      />
    </Surface>
  );
}
