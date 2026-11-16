import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, ScrollView, View } from "react-native";
import {
  Appbar,
  Avatar,
  Button,
  Chip,
  IconButton,
  List,
  Menu,
  Searchbar,
  Surface,
  Text,
} from "react-native-paper";

import { AlbumRow } from "@/components/AlbumRow";
import { SongRow } from "@/components/SongRow";
import { client_app_sync, getCoverArtBaseUrl } from "@/services/api";
import {
  getAllSongCacheEntries,
  getStarredAlbums,
  getStarredArtists,
  getStarredSongs,
  searchStarredAlbums,
  searchStarredArtists,
  searchStarredSongs,
} from "@/services/db";
import { playPlaylist } from "@/services/player";
import { artistsStyles, searchStyles, songsStyles } from "@/stylesheets";
import { AlbumID3, ArtistID3, Child, SongCacheRow, useAppTheme } from "@/types";

type FavoriteTab = "tracks" | "albums" | "artists";

const TABS: { label: string; value: FavoriteTab }[] = [
  { label: "tracks", value: "tracks" },
  { label: "albums", value: "albums" },
  { label: "artists", value: "artists" },
];

type TrackSortKey =
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

type AlbumSortKey =
  | "name"
  | "artist"
  | "year"
  | "duration"
  | "songCount"
  | "created"
  | "played"
  | "playCount"
  | "userRating"
  | "genre";

type ArtistSortKey = "name" | "albumCount" | "userRating";

type SortOrder = "asc" | "desc";

interface SortOption<T extends string> {
  label: string;
  key: T;
}

const TRACK_SORT_OPTIONS: SortOption<TrackSortKey>[] = [
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

const ALBUM_SORT_OPTIONS: SortOption<AlbumSortKey>[] = [
  { label: "title", key: "name" },
  { label: "artist", key: "artist" },
  { label: "year", key: "year" },
  { label: "duration", key: "duration" },
  { label: "track count", key: "songCount" },
  { label: "date added", key: "created" },
  { label: "last played", key: "played" },
  { label: "play count", key: "playCount" },
  { label: "user rating", key: "userRating" },
  { label: "genre", key: "genre" },
];

const ARTIST_SORT_OPTIONS: SortOption<ArtistSortKey>[] = [
  { label: "name", key: "name" },
  { label: "album count", key: "albumCount" },
  { label: "user rating", key: "userRating" },
];

export default function FavoritesScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [activeTab, setActiveTab] = useState<FavoriteTab>("tracks");
  const [songs, setSongs] = useState<Child[]>(() => getStarredSongs());
  const [albums, setAlbums] = useState<AlbumID3[]>(() => getStarredAlbums());
  const [artists, setArtists] = useState<ArtistID3[]>(() => getStarredArtists());
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [trackSortKey, setTrackSortKey] = useState<TrackSortKey>("title");
  const [trackSortOrder, setTrackSortOrder] = useState<SortOrder>("asc");
  const [albumSortKey, setAlbumSortKey] = useState<AlbumSortKey>("name");
  const [albumSortOrder, setAlbumSortOrder] = useState<SortOrder>("asc");
  const [artistSortKey, setArtistSortKey] = useState<ArtistSortKey>("name");
  const [artistSortOrder, setArtistSortOrder] = useState<SortOrder>("asc");
  const [menuVisible, setMenuVisible] = useState(false);
  const [getArtUrl, setGetArtUrl] = useState<
    ((id?: string | null) => string | null) | null
  >(null);
  const [cacheEntries, setCacheEntries] = useState<Map<string, SongCacheRow>>(() =>
    getAllSongCacheEntries(),
  );

  const refreshData = useCallback(() => {
    setSongs(getStarredSongs());
    setAlbums(getStarredAlbums());
    setArtists(getStarredArtists());
    setCacheEntries(getAllSongCacheEntries());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [refreshData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    client_app_sync(false)
      .catch((err) => {
        console.error("failed to refresh favorites:", err);
      })
      .finally(() => {
        refreshData();
        setRefreshing(false);
      });
  }, [refreshData]);

  useEffect(() => {
    getCoverArtBaseUrl()
      .then((fn) => setGetArtUrl(() => fn))
      .catch((err) =>
        console.error("failed to get cover art url helper:", err),
      );
  }, []);

  const handleStarredChange = useCallback((songId: string, starred: boolean) => {
    if (!starred) {
      setSongs((prev) => prev.filter((s) => s.id !== songId));
    }
  }, []);

  const processedSongs = useMemo(() => {
    let result = songs;

    if (searchQuery.trim()) {
      result = searchStarredSongs(searchQuery, 1000);
      if (trackSortKey === "title" && trackSortOrder === "asc") {
        return result;
      }
    }

    return [...result].sort((a, b) => {
      const valA = a[trackSortKey];
      const valB = b[trackSortKey];

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

      return trackSortOrder === "asc" ? comparison : -comparison;
    });
  }, [songs, searchQuery, trackSortKey, trackSortOrder]);

  const processedAlbums = useMemo(() => {
    let result = albums;

    if (searchQuery.trim()) {
      result = searchStarredAlbums(searchQuery, 1000);
      if (albumSortKey === "name" && albumSortOrder === "asc") {
        return result;
      }
    }

    return [...result].sort((a, b) => {
      const valA = a[albumSortKey];
      const valB = b[albumSortKey];

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

      return albumSortOrder === "asc" ? comparison : -comparison;
    });
  }, [albums, searchQuery, albumSortKey, albumSortOrder]);

  const processedArtists = useMemo(() => {
    let result = artists;

    if (searchQuery.trim()) {
      result = searchStarredArtists(searchQuery, 1000);
      if (artistSortKey === "name" && artistSortOrder === "asc") {
        return result;
      }
    }

    return [...result].sort((a, b) => {
      const valA = a[artistSortKey];
      const valB = b[artistSortKey];

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

      return artistSortOrder === "asc" ? comparison : -comparison;
    });
  }, [artists, searchQuery, artistSortKey, artistSortOrder]);

  const currentSortOptions = useMemo(() => {
    switch (activeTab) {
      case "albums":
        return ALBUM_SORT_OPTIONS;
      case "artists":
        return ARTIST_SORT_OPTIONS;
      case "tracks":
      default:
        return TRACK_SORT_OPTIONS;
    }
  }, [activeTab]);

  const currentSortKey =
    activeTab === "tracks"
      ? trackSortKey
      : activeTab === "albums"
        ? albumSortKey
        : artistSortKey;

  const currentSortOrder =
    activeTab === "tracks"
      ? trackSortOrder
      : activeTab === "albums"
        ? albumSortOrder
        : artistSortOrder;

  const handleSelectSortKey = (key: string) => {
    if (activeTab === "tracks") {
      setTrackSortKey(key as TrackSortKey);
    } else if (activeTab === "albums") {
      setAlbumSortKey(key as AlbumSortKey);
    } else {
      setArtistSortKey(key as ArtistSortKey);
    }
    setMenuVisible(false);
  };

  const handleToggleSortOrder = () => {
    if (activeTab === "tracks") {
      setTrackSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else if (activeTab === "albums") {
      setAlbumSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setArtistSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    }
  };

  const currentSortLabel =
    currentSortOptions.find((opt) => opt.key === currentSortKey)?.label ??
    "title";

  const emptyText = useMemo(() => {
    if (searchQuery.trim()) {
      switch (activeTab) {
        case "albums":
          return "no albums found";
        case "artists":
          return "no artists found";
        case "tracks":
        default:
          return "no tracks found";
      }
    }
    switch (activeTab) {
      case "albums":
        return "no favorite albums found";
      case "artists":
        return "no favorite artists found";
      case "tracks":
      default:
        return "no favorite tracks found";
    }
  }, [activeTab, searchQuery]);

  return (
    <Surface style={songsStyles.page}>
      <Appbar.Header statusBarHeight={0}>
        <Appbar.BackAction
          onPress={() => router.back()}
          accessibilityLabel="go back"
        />
        <Appbar.Content title="favorites" />
      </Appbar.Header>

      <Searchbar
        placeholder={`search ${activeTab}`}
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={songsStyles.searchbar}
      />

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={searchStyles.chipScrollContent}
        >
          {TABS.map((tab) => (
            <Chip
              key={tab.value}
              selected={activeTab === tab.value}
              onPress={() => setActiveTab(tab.value)}
              style={searchStyles.chip}
              showSelectedOverlay
            >
              {tab.label}
            </Chip>
          ))}
        </ScrollView>
      </View>

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
          {currentSortOptions.map((option) => (
            <Menu.Item
              key={option.key}
              title={option.label}
              leadingIcon={currentSortKey === option.key ? "check" : undefined}
              onPress={() => handleSelectSortKey(option.key)}
            />
          ))}
        </Menu>

        <IconButton
          icon={
            currentSortOrder === "asc"
              ? "sort-ascending"
              : "sort-descending"
          }
          size={24}
          mode="contained-tonal"
          onPress={handleToggleSortOrder}
        />
      </View>

      {activeTab === "tracks" && (
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
              <Text variant="bodyLarge">{emptyText}</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <SongRow
              song={item}
              index={index}
              onPress={() => playPlaylist(processedSongs, index)}
              getArtUrl={getArtUrl}
              initialCacheEntry={cacheEntries.get(item.id) ?? null}
              onStarredChange={(starred) => handleStarredChange(item.id, starred)}
            />
          )}
        />
      )}

      {activeTab === "albums" && (
        <FlatList
          data={processedAlbums}
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
              <Text variant="bodyLarge">{emptyText}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <AlbumRow album={item} getArtUrl={getArtUrl} />
          )}
        />
      )}

      {activeTab === "artists" && (
        <FlatList
          data={processedArtists}
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
              <Text variant="bodyLarge">{emptyText}</Text>
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
                onPress={() =>
                  router.push({
                    pathname: "/artist/[id]",
                    params: { id: item.id },
                  })
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
      )}
    </Surface>
  );
}
