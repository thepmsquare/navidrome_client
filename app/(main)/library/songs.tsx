import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import {
  Avatar,
  IconButton,
  List,
  Searchbar,
  Surface,
  Text,
} from "react-native-paper";

import { getCoverArtBaseUrl } from "@/services/api";
import { getAllSongs } from "@/services/db";
import { playSong } from "@/services/player";
import { songsStyles } from "@/stylesheets";
import { Child } from "@/types";

export default function SongsScreen() {
  const router = useRouter();
  const [songs] = useState<Child[]>(() => getAllSongs());
  const [searchQuery, setSearchQuery] = useState("");
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

  const filteredSongs = useMemo(() => {
    if (!searchQuery.trim()) {
      return songs;
    }
    const query = searchQuery.toLowerCase().trim();
    return songs.filter(
      (song) =>
        song.title.toLowerCase().includes(query) ||
        (song.artist && song.artist.toLowerCase().includes(query)) ||
        (song.album && song.album.toLowerCase().includes(query)),
    );
  }, [songs, searchQuery]);

  return (
    <Surface style={songsStyles.page}>
      <View style={songsStyles.header}>
        <IconButton icon="arrow-left" size={24} onPress={() => router.back()} />
        <Text variant="titleLarge">songs</Text>
      </View>

      <Searchbar
        placeholder="search songs"
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={songsStyles.searchbar}
      />

      <FlatList
        data={filteredSongs}
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
              onPress={() => playSong(item)}
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
            />
          );
        }}
      />
    </Surface>
  );
}
