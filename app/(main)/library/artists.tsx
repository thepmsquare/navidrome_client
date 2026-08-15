import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { Avatar, IconButton, List, Surface, Text } from "react-native-paper";

import { getCoverArtBaseUrl } from "@/services/api";
import { getAllArtists } from "@/services/db";
import { artistsStyles } from "@/stylesheets";
import { ArtistID3 } from "@/types";

export default function ArtistsScreen() {
  const router = useRouter();
  const [artists, setArtists] = useState<ArtistID3[]>([]);
  const [getArtUrl, setGetArtUrl] = useState<
    ((id?: string | null) => string | null) | null
  >(null);

  useEffect(() => {
    const list = getAllArtists();
    setArtists(list);

    getCoverArtBaseUrl()
      .then((fn) => setGetArtUrl(() => fn))
      .catch((err) =>
        console.error("failed to get cover art url helper:", err),
      );
  }, []);

  return (
    <Surface style={artistsStyles.page}>
      <View style={artistsStyles.header}>
        <IconButton icon="arrow-left" size={24} onPress={() => router.back()} />
        <Text variant="titleLarge">artists</Text>
      </View>

      <FlatList
        data={artists}
        keyExtractor={(item) => item.id}
        contentContainerStyle={artistsStyles.listContent}
        ListEmptyComponent={
          <View style={artistsStyles.emptyContainer}>
            <Text variant="bodyLarge">no artists found</Text>
          </View>
        }
        renderItem={({ item }) => {
          let artUrl: string | null = null;
          if (item.artistImageUrl && item.artistImageUrl.startsWith("http")) {
            artUrl = item.artistImageUrl;
          } else if (getArtUrl) {
            artUrl = getArtUrl(item.coverArt);
          }

          return (
            <List.Item
              title={item.name}
              description={
                item.albumCount !== undefined && item.albumCount !== null
                  ? `${item.albumCount} ${item.albumCount === 1 ? "album" : "albums"}`
                  : undefined
              }
              left={(props) =>
                artUrl ? (
                  <Avatar.Image {...props} size={48} source={{ uri: artUrl }} />
                ) : (
                  <Avatar.Icon {...props} size={48} icon="account-music" />
                )
              }
            />
          );
        }}
      />
    </Surface>
  );
}
