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
import { getAllArtists, searchArtists } from "@/services/db";
import { artistsStyles } from "@/stylesheets";
import { ArtistID3 } from "@/types";

type SortKey = "name" | "albumCount" | "starred" | "userRating" | "sortName";

type SortOrder = "asc" | "desc";

interface SortOption {
  label: string;
  key: SortKey;
}

const SORT_OPTIONS: SortOption[] = [
  { label: "name", key: "name" },
  { label: "album count", key: "albumCount" },
  { label: "starred", key: "starred" },
  { label: "user rating", key: "userRating" },
  { label: "sort name", key: "sortName" },
];

export default function ArtistsScreen() {
  const router = useRouter();
  const [artists] = useState<ArtistID3[]>(() => getAllArtists());
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

  const processedArtists = useMemo(() => {
    let result = artists;

    if (searchQuery.trim()) {
      result = searchArtists(searchQuery, 1000);
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
  }, [artists, searchQuery, sortKey, sortOrder]);

  const currentSortLabel =
    SORT_OPTIONS.find((opt) => opt.key === sortKey)?.label ?? "name";

  return (
    <Surface style={artistsStyles.page}>
      <Appbar.Header statusBarHeight={0}>
        <Appbar.BackAction
          onPress={() => router.back()}
          accessibilityLabel="go back"
        />
        <Appbar.Content title="artists" />
      </Appbar.Header>

      <Searchbar
        placeholder="search artists"
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={artistsStyles.searchbar}
      />

      <View style={artistsStyles.sortRow}>
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
        data={processedArtists}
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
                  <Image
                    source={{ uri: artUrl, cacheKey: `${item.coverArt}-300` }}
                    style={artistsStyles.artwork}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
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
