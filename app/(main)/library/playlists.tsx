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
import { getAllPlaylists, searchPlaylists } from "@/services/db";
import { playlistsStyles } from "@/stylesheets";
import { Playlist } from "@/types";

type SortKey =
  | "name"
  | "songCount"
  | "duration"
  | "created"
  | "changed"
  | "owner"
  | "public";

type SortOrder = "asc" | "desc";

interface SortOption {
  label: string;
  key: SortKey;
}

const SORT_OPTIONS: SortOption[] = [
  { label: "title", key: "name" },
  { label: "song count", key: "songCount" },
  { label: "duration", key: "duration" },
  { label: "date added", key: "created" },
  { label: "last modified", key: "changed" },
  { label: "owner", key: "owner" },
  { label: "public", key: "public" },
];

export default function PlaylistsScreen() {
  const router = useRouter();
  const [playlists] = useState<Playlist[]>(() => getAllPlaylists());
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

  const processedPlaylists = useMemo(() => {
    let result = playlists;

    if (searchQuery.trim()) {
      result = searchPlaylists(searchQuery, 1000);
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
      } else if (typeof valA === "boolean" && typeof valB === "boolean") {
        comparison = valA === valB ? 0 : valA ? -1 : 1;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [playlists, searchQuery, sortKey, sortOrder]);

  const currentSortLabel =
    SORT_OPTIONS.find((opt) => opt.key === sortKey)?.label ?? "title";

  return (
    <Surface style={playlistsStyles.page}>
      <Appbar.Header statusBarHeight={0}>
        <Appbar.BackAction
          onPress={() => router.back()}
          accessibilityLabel="go back"
        />
        <Appbar.Content title="playlists" />
      </Appbar.Header>

      <Searchbar
        placeholder="search playlists"
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={playlistsStyles.searchbar}
      />

      <View style={playlistsStyles.sortRow}>
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
        data={processedPlaylists}
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
