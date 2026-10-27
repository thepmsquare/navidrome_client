import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import {
  Appbar,
  Button,
  IconButton,
  Menu,
  Searchbar,
  Surface,
  Text,
} from "react-native-paper";

import { SongRow } from "@/components/SongRow";
import { getCoverArtBaseUrl } from "@/services/api";
import {
  getAllSongCacheEntries,
  getCachedSongs,
  searchCachedSongs,
} from "@/services/db";
import { playPlaylist } from "@/services/player";
import { songsStyles } from "@/stylesheets";
import { Child, SongCacheRow, useAppTheme } from "@/types";

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

export default function AvailableOfflineScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [songs, setSongs] = useState<Child[]>(() => getCachedSongs());
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [menuVisible, setMenuVisible] = useState(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [cacheEntries, setCacheEntries] = useState<Map<string, SongCacheRow>>(() =>
    getAllSongCacheEntries?.() ?? new Map(),
  );
  const [getArtUrl, setGetArtUrl] = useState<
    ((id?: string | null) => string | null) | null
  >(null);

  const refreshSongsAndCache = useCallback(() => {
    setSongs(getCachedSongs());
    setCacheEntries(getAllSongCacheEntries?.() ?? new Map());
  }, []);

  useFocusEffect(refreshSongsAndCache);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    try {
      refreshSongsAndCache();
    } finally {
      setRefreshing(false);
    }
  }, [refreshSongsAndCache]);

  useEffect(() => {
    getCoverArtBaseUrl()
      .then((fn) => setGetArtUrl(() => fn))
      .catch((err) =>
        console.error("failed to get cover art url helper:", err),
      );
  }, []);

  const processedSongs = useMemo(() => {
    let result = songs;

    const trimmed = searchQuery.trim();
    if (trimmed) {
      if (typeof searchCachedSongs === "function") {
        result = searchCachedSongs(trimmed, 1000);
      } else {
        const lower = trimmed.toLowerCase();
        result = songs.filter(
          (s) =>
            s.title?.toLowerCase().includes(lower) ||
            s.artist?.toLowerCase().includes(lower) ||
            s.album?.toLowerCase().includes(lower),
        );
      }
      if (sortKey === "title" && sortOrder === "asc") {
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
  }, [songs, searchQuery, sortKey, sortOrder]);

  const currentSortLabel =
    SORT_OPTIONS.find((opt) => opt.key === sortKey)?.label ?? "title";

  return (
    <Surface style={songsStyles.page}>
      <Appbar.Header statusBarHeight={0}>
        <Appbar.BackAction
          onPress={() => router.back()}
          accessibilityLabel="go back"
        />
        <Appbar.Content title="available offline" />
      </Appbar.Header>

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
          <View style={songsStyles.emptyContainer}>
            <Text variant="bodyLarge">
              {searchQuery.trim()
                ? "no songs found"
                : "no songs available offline"}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <SongRow
            song={item}
            index={index}
            subtitle={
              item.artist && item.album
                ? `${item.artist} • ${item.album}`
                : (item.artist ?? item.album ?? undefined)
            }
            onPress={() => playPlaylist(processedSongs, index)}
            getArtUrl={getArtUrl}
            initialCacheEntry={cacheEntries.get(item.id) ?? null}
          />
        )}
      />
    </Surface>
  );
}
