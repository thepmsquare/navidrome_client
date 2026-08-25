import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { Avatar, IconButton, List, Surface, Text } from "react-native-paper";

import { getCoverArtBaseUrl } from "@/services/api";
import { getAllAlbums } from "@/services/db";
import { albumsStyles } from "@/stylesheets";
import { AlbumID3 } from "@/types";

export default function AlbumsScreen() {
  const router = useRouter();
  const [albums] = useState<AlbumID3[]>(() => getAllAlbums());
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
    <Surface style={albumsStyles.page}>
      <View style={albumsStyles.header}>
        <IconButton icon="arrow-left" size={24} onPress={() => router.back()} />
        <Text variant="titleLarge">albums</Text>
      </View>

      <FlatList
        data={albums}
        keyExtractor={(item) => item.id}
        contentContainerStyle={albumsStyles.listContent}
        ListEmptyComponent={
          <View style={albumsStyles.emptyContainer}>
            <Text variant="bodyLarge">no albums found</Text>
          </View>
        }
        renderItem={({ item }) => {
          const artUrl = getArtUrl ? getArtUrl(item.coverArt) : null;

          return (
            <List.Item
              title={item.name}
              description={item.artist ?? undefined}
              onPress={() =>
                router.push({
                  pathname: "/(main)/library/album/[id]",
                  params: { id: item.id },
                })
              }
              left={(props) =>
                artUrl ? (
                  <Image
                    source={{ uri: artUrl, cacheKey: `${item.coverArt}-300` }}
                    style={albumsStyles.artwork}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <Avatar.Icon {...props} size={48} icon="album" />
                )
              }
            />
          );
        }}
      />
    </Surface>
  );
}
