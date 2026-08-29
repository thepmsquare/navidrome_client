import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { Avatar, IconButton, List, Surface, Text } from "react-native-paper";

import { getCoverArtBaseUrl } from "@/services/api";
import { getAllPlaylists } from "@/services/db";
import { playlistsStyles } from "@/stylesheets";
import { Playlist } from "@/types";

export default function PlaylistsScreen() {
  const router = useRouter();
  const [playlists] = useState<Playlist[]>(() => getAllPlaylists());
  const [getArtUrl, setGetArtUrl] = useState<
    ((id?: string | null) => string | null) | null
  >(null);

  useEffect(() => {
    getCoverArtBaseUrl()
      .then((fn) => setGetArtUrl(() => fn))
      .catch((err) =>
        console.error("failed to get cover art url helper:", err),
      );
  }, []);

  return (
    <Surface style={playlistsStyles.page}>
      <View style={playlistsStyles.header}>
        <IconButton icon="arrow-left" size={24} onPress={() => router.back()} />
        <Text variant="titleLarge">playlists</Text>
      </View>

      <FlatList
        data={playlists}
        keyExtractor={(item) => item.id}
        contentContainerStyle={playlistsStyles.listContent}
        ListEmptyComponent={
          <View style={playlistsStyles.emptyContainer}>
            <Text variant="bodyLarge">no playlists found</Text>
          </View>
        }
        renderItem={({ item }) => {
          const artUrl = getArtUrl ? getArtUrl(item.coverArt) : null;

          return (
            <List.Item
              title={item.name}
              description={`${item.songCount ?? 0} songs`}
              onPress={() =>
                router.push({
                  pathname: "/(main)/library/playlist/[id]",
                  params: { id: item.id },
                })
              }
              left={(props) =>
                artUrl ? (
                  <Image
                    source={{ uri: artUrl, cacheKey: `${item.coverArt}-300` }}
                    style={playlistsStyles.artwork}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <Avatar.Icon {...props} size={48} icon="playlist-music" />
                )
              }
            />
          );
        }}
      />
    </Surface>
  );
}
