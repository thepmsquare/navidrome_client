import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import {
  Avatar,
  Button,
  IconButton,
  List,
  Menu,
  Searchbar,
  Surface,
  Text,
} from "react-native-paper";

import { getCoverArtBaseUrl } from "@/services/api";
import { getAllSongs } from "@/services/db";
import { playPlaylist } from "@/services/player";
import { songsStyles } from "@/stylesheets";
import { Child } from "@/types";

type SortKey =
  | "title"
  | "artist"
  | "album"
  | "year"
  | "duration"
  | "created"
  | "played"
  | "playCount"
  | "userRating"
  | "size";

type SortOrder = "asc" | "desc";

interface SortOption {
  label: string;
  key: SortKey;
}

const SORT_OPTIONS: SortOption[] = [
  { label: "title", key: "title" },
  { label: "artist", key: "artist" },
  { label: "album", key: "album" },
  { label: "year", key: "year" },
  { label: "duration", key: "duration" },
  { label: "date added", key: "created" },
  { label: "last played", key: "played" },
  { label: "play count", key: "playCount" },
  { label: "user rating", key: "userRating" },
  { label: "size", key: "size" },
];

export default function SongsScreen() {
  const router = useRouter();
  const [songs] = useState<Child[]>(() => getAllSongs());
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [menuVisible, setMenuVisible] = useState(false);
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

  const processedSongs = useMemo(() => {
    let result = songs;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (song) =>
          song.title.toLowerCase().includes(query) ||
          (song.artist && song.artist.toLowerCase().includes(query)) ||
          (song.album && song.album.toLowerCase().includes(query)),
      );
    }

    return [...result].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];

      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      let comparison = 0;
      if (typeof valA === "string" && typeof valB === "string") {
        comparison = valA.localeCompare(valB, undefined, {
          sensitivity: "base",
        });
      } else if (typeof valA === "number" && typeof valB === "number") {
        comparison = valA - valB;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [songs, searchQuery, sortKey, sortOrder]);

  const currentSortLabel =
    SORT_OPTIONS.find((opt) => opt.key === sortKey)?.label ?? "title";

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

      <View style={songsStyles.sortRow}>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Button
              mode="contained-tonal"
              icon="sort"
              onPress={() => setMenuVisible(true)}
            >
              {`sort by: ${currentSortLabel}`}
            </Button>
          }
        >
          {SORT_OPTIONS.map((option) => (
            <Menu.Item
              key={option.key}
              title={option.label}
              leadingIcon={sortKey === option.key ? "check" : undefined}
              onPress={() => {
                setSortKey(option.key);
                setMenuVisible(false);
              }}
            />
          ))}
        </Menu>

        <IconButton
          icon={sortOrder === "asc" ? "sort-ascending" : "sort-descending"}
          size={24}
          mode="contained-tonal"
          onPress={() =>
            setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
          }
        />
      </View>

      <FlatList
        data={processedSongs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={songsStyles.listContent}
        ListEmptyComponent={
          <View style={songsStyles.emptyContainer}>
            <Text variant="bodyLarge">no songs found</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const artUrl = getArtUrl ? getArtUrl(item.coverArt) : null;

          return (
            <List.Item
              title={item.title}
              description={item.artist ?? undefined}
              onPress={() => playPlaylist(processedSongs, index)}
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
