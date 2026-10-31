import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  useWindowDimensions,
  View,
} from "react-native";
import {
  Appbar,
  Button,
  IconButton,
  Menu,
  Searchbar,
  Surface,
  Text,
} from "react-native-paper";

import { AlbumCard } from "@/components/AlbumCard";
import { AlbumRow } from "@/components/AlbumRow";
import { client_app_sync, getCoverArtBaseUrl } from "@/services/api";
import { getAllAlbums, searchAlbums } from "@/services/db";
import { albumsStyles } from "@/stylesheets";
import { AlbumID3, useAppTheme } from "@/types";
import { spacing } from "@/utils/spacing";

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

type ViewMode = "list" | "grid";

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
  const theme = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [albums, setAlbums] = useState<AlbumID3[]>(() => getAllAlbums());
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [menuVisible, setMenuVisible] = useState(false);
  const [getArtUrl, setGetArtUrl] = useState<
    ((id?: string | null) => string | null) | null
  >(null);

  useFocusEffect(
    useCallback(() => {
      setAlbums(getAllAlbums());
    }, []),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    client_app_sync(false)
      .catch((err) => {
        console.error("failed to refresh albums:", err);
      })
      .finally(() => {
        setAlbums(getAllAlbums());
        setRefreshing(false);
      });
  }, []);

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

  const cardWidth = useMemo(
    () => Math.max(0, (windowWidth - spacing.sm * 3) / 2),
    [windowWidth],
  );

  const isGrid = viewMode === "grid";

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
        <View style={albumsStyles.sortActions}>
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

        <IconButton
          icon={isGrid ? "view-list" : "view-grid"}
          size={24}
          mode="contained-tonal"
          accessibilityLabel={
            isGrid ? "switch to list view" : "switch to grid view"
          }
          onPress={() => setViewMode(isGrid ? "list" : "grid")}
        />
      </View>

      <FlatList
        key={viewMode}
        data={processedAlbums}
        keyExtractor={(item) => item.id}
        numColumns={isGrid ? 2 : 1}
        columnWrapperStyle={isGrid ? albumsStyles.gridRow : undefined}
        contentContainerStyle={albumsStyles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
            progressBackgroundColor={theme.colors.surfaceContainerHighest}
          />
        }
        ListEmptyComponent={
          <View style={albumsStyles.emptyContainer}>
            <Text variant="bodyLarge">no albums found</Text>
          </View>
        }
        renderItem={({ item }) =>
          isGrid ? (
            <AlbumCard album={item} getArtUrl={getArtUrl} width={cardWidth} />
          ) : (
            <AlbumRow album={item} getArtUrl={getArtUrl} />
          )
        }
      />
    </Surface>
  );
}
