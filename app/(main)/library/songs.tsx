import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { Avatar, IconButton, List, Surface, Text } from "react-native-paper";

import { getCoverArtBaseUrl } from "@/services/api";
import { getAllSongs } from "@/services/db";
import { songsStyles } from "@/stylesheets";
import { Child } from "@/types";

export default function SongsScreen() {
  const router = useRouter();
  const [songs, setSongs] = useState<Child[]>([]);
  const [getArtUrl, setGetArtUrl] = useState<
    ((id?: string | null) => string | null) | null
  >(null);

  useEffect(() => {
    const list = getAllSongs();
    setSongs(list);

    getCoverArtBaseUrl()
      .then((fn) => setGetArtUrl(() => fn))
      .catch((err) =>
        console.error("failed to get cover art url helper:", err),
      );
  }, []);

  return (
    <Surface style={songsStyles.page}>
      <View style={songsStyles.header}>
        <IconButton icon="arrow-left" size={24} onPress={() => router.back()} />
        <Text variant="titleLarge">songs</Text>
      </View>

      <FlatList
        data={songs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={songsStyles.listContent}
        ListEmptyComponent={
          <View style={songsStyles.emptyContainer}>
            <Text variant="bodyLarge">no songs found</Text>
          </View>
        }
        renderItem={({ item }) => {
          const artUrl = getArtUrl ? getArtUrl(item.coverArt) : null;

          return (
            <List.Item
              title={item.title}
              description={item.artist ?? undefined}
              left={(props) =>
                artUrl ? (
                  <Avatar.Image {...props} size={48} source={{ uri: artUrl }} />
                ) : (
                  <Avatar.Icon {...props} size={48} icon="music" />
                )
              }
            />
          );
        }}
      />
    </Surface>
  );
}
