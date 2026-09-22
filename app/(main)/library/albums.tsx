import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import {
  Appbar,
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
import { getAllAlbums, searchAlbums } from "@/services/db";
import { albumsStyles } from "@/stylesheets";
import { AlbumID3 } from "@/types";

type SortKey =
  | "name"
  | "artist"
  | "year"
  | "duration"
  | "songCount"
  | "created"
  | "played"
  | "playCount"
  | "userRating"
  | "genre"
  | "starred";

type SortOrder = "asc" | "desc";

interface SortOption {
  label: string;
  key: SortKey;
}

const SORT_OPTIONS: SortOption[] = [
  { label: "title", key: "name" },
  { label: "artist", key: "artist" },
  { label: "year", key: "year" },
  { label: "duration", key: "duration" },
  { label: "song count", key: "songCount" },
  { label: "date added", key: "created" },
  { label: "last played", key: "played" },
  { label: "play count", key: "playCount" },
  { label: "user rating", key: "userRating" },
  { label: "genre", key: "genre" },
  { label: "starred", key: "starred" },
];

export default function AlbumsScreen() {
  const router = useRouter();
  const [albums] = useState<AlbumID3[]>(() => getAllAlbums());
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
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

  const processedAlbums = useMemo(() => {
    let result = albums;

    if (searchQuery.trim()) {
      result = searchAlbums(searchQuery, 1000);
      if (sortKey === "name" && sortOrder === "asc") {
        return result;
      }
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
  }, [albums, searchQuery, sortKey, sortOrder]);

  const currentSortLabel =
    SORT_OPTIONS.find((opt) => opt.key === sortKey)?.label ?? "title";

  return (
    <Surface style={albumsStyles.page}>
      <Appbar.Header statusBarHeight={0}>
        <Appbar.BackAction
          onPress={() => router.back()}
          accessibilityLabel="go back"
        />
        <Appbar.Content title="albums" />
      </Appbar.Header>

      <Searchbar
        placeholder="search albums"
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={albumsStyles.searchbar}
      />

      <View style={albumsStyles.sortRow}>
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
        data={processedAlbums}
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
