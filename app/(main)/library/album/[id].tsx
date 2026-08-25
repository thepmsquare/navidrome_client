import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { Avatar, IconButton, List, Surface, Text } from "react-native-paper";

import { getCoverArtBaseUrl } from "@/services/api";
import { getAlbumById, getSongsByAlbumId } from "@/services/db";
import { playPlaylist } from "@/services/player";
import { albumDetailStyles } from "@/stylesheets";
import { AlbumID3, Child } from "@/types";

function formatDuration(seconds?: number): string {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function AlbumDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [album] = useState<AlbumID3 | null>(() => (id ? getAlbumById(id) : null));
  const [songs] = useState<Child[]>(() => (id ? getSongsByAlbumId(id) : []));
  const [getArtUrl, setGetArtUrl] = useState<
    ((artId?: string | null) => string | null) | null
  >(null);

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
      <View style={albumDetailStyles.header}>
        <IconButton icon="arrow-left" size={24} onPress={() => router.back()} />
        <Text variant="titleLarge">album</Text>
      </View>

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
                <Text variant="titleMedium" style={albumDetailStyles.artistName}>
                  {album.artist}
                </Text>
              ) : null}
              <Text variant="bodySmall" style={albumDetailStyles.metaText}>
                {[
                  album.year ? `${album.year}` : null,
                  album.songCount ? `${album.songCount} songs` : null,
                ]
                  .filter(Boolean)
                  .join(" • ")}
              </Text>
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
              <Text variant="bodyMedium" style={albumDetailStyles.trackNumber}>
                {item.track ? `${item.track}` : "-"}
              </Text>
            )}
            right={() =>
              item.duration ? (
                <Text variant="bodySmall" style={albumDetailStyles.metaText}>
                  {formatDuration(item.duration)}
                </Text>
              ) : null
            }
          />
        )}
      />
    </Surface>
  );
}
