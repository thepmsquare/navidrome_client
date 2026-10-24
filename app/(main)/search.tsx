import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, ScrollView, View } from "react-native";
import {
  Appbar,
  Avatar,
  Button,
  Chip,
  Icon,
  List,
  Searchbar,
  Surface,
  Text,
} from "react-native-paper";

import { SongRow } from "@/components/SongRow";
import { getCoverArtBaseUrl } from "@/services/api";
import {
  addRecentSearch,
  clearRecentSearches,
  getAllSongCacheEntries,
  getRecentSearches,
  removeRecentSearch,
  searchAlbums,
  searchArtists,
  searchPlaylists,
  searchSongs,
} from "@/services/db";
import { playPlaylist } from "@/services/player";
import { searchStyles } from "@/stylesheets";
import { AlbumID3, ArtistID3, Child, Playlist, SongCacheRow, useAppTheme } from "@/types";

type SearchCategory = "all" | "songs" | "albums" | "artists" | "playlists";

const CATEGORIES: { label: string; value: SearchCategory }[] = [
  { label: "all", value: "all" },
  { label: "songs", value: "songs" },
  { label: "albums", value: "albums" },
  { label: "artists", value: "artists" },
  { label: "playlists", value: "playlists" },
];

export default function SearchScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<SearchCategory>("all");
  const [getArtUrl, setGetArtUrl] = useState<
    ((id?: string | null) => string | null) | null
  >(null);
  const [cacheEntries, setCacheEntries] = useState<Map<string, SongCacheRow>>(() =>
    getAllSongCacheEntries(),
  );
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    getRecentSearches(),
  );

  useFocusEffect(
    useCallback(() => {
      setCacheEntries(getAllSongCacheEntries());
      setRecentSearches(getRecentSearches());
    }, []),
  );

  const saveCurrentSearch = useCallback(
    (termToSave?: string) => {
      const queryToSave = (termToSave ?? searchQuery).trim();
      if (!queryToSave) return;
      addRecentSearch(queryToSave);
      setRecentSearches(getRecentSearches());
    },
    [searchQuery],
  );

  const handleSelectRecentSearch = useCallback((term: string) => {
    setSearchQuery(term);
    addRecentSearch(term);
    setRecentSearches(getRecentSearches());
  }, []);

  const handleRemoveRecentSearch = useCallback((term: string) => {
    removeRecentSearch(term);
    setRecentSearches(getRecentSearches());
  }, []);

  const handleClearRecentSearches = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, []);

  useEffect(() => {
    getCoverArtBaseUrl()
      .then((fn) => setGetArtUrl(() => fn))
      .catch((err) =>
        console.error("failed to get cover art url helper:", err),
      );
  }, []);

  const songs = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchSongs(searchQuery, activeCategory === "songs" ? 100 : 5);
  }, [searchQuery, activeCategory]);

  const albums = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchAlbums(searchQuery, activeCategory === "albums" ? 50 : 5);
  }, [searchQuery, activeCategory]);

  const artists = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchArtists(searchQuery, activeCategory === "artists" ? 50 : 5);
  }, [searchQuery, activeCategory]);

  const playlists = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchPlaylists(searchQuery, activeCategory === "playlists" ? 50 : 5);
  }, [searchQuery, activeCategory]);

  const totalResults =
    songs.length + albums.length + artists.length + playlists.length;
  const isSearching = searchQuery.trim().length > 0;

  const renderSongItem = (item: Child, index: number, list: Child[]) => {
    return (
      <SongRow
        key={`song-${item.id}`}
        song={item}
        index={index}
        subtitle={
          item.artist
            ? item.album
              ? `${item.artist} • ${item.album}`
              : item.artist
            : (item.album ?? undefined)
        }
        onPress={() => {
          saveCurrentSearch();
          playPlaylist(list, index);
        }}
        getArtUrl={getArtUrl}
        initialCacheEntry={cacheEntries.get(item.id) ?? null}
      />
    );
  };

  const renderAlbumItem = (item: AlbumID3) => {
    const artUrl = getArtUrl ? getArtUrl(item.coverArt) : null;
    const description = [
      item.artist,
      item.year ? String(item.year) : null,
      item.songCount
        ? `${item.songCount} ${item.songCount === 1 ? "song" : "songs"}`
        : null,
    ]
      .filter(Boolean)
      .join(" • ");

    return (
      <List.Item
        key={`album-${item.id}`}
        title={item.name}
        description={description || undefined}
        onPress={() => {
          saveCurrentSearch();
          router.push({
            pathname: "/album/[id]",
            params: { id: item.id },
          });
        }}
        left={(props) =>
          artUrl ? (
            <Image
              source={{ uri: artUrl, cacheKey: `${item.coverArt}-300` }}
              style={searchStyles.artwork}
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
  };

  const renderArtistItem = (item: ArtistID3) => {
    let artUrl: string | null = null;
    if (item.artistImageUrl && item.artistImageUrl.startsWith("http")) {
      artUrl = item.artistImageUrl;
    } else if (getArtUrl) {
      artUrl = getArtUrl(item.coverArt);
    }

    return (
      <List.Item
        key={`artist-${item.id}`}
        title={item.name}
        description={
          item.albumCount !== undefined && item.albumCount !== null
            ? `${item.albumCount} ${item.albumCount === 1 ? "album" : "albums"}`
            : undefined
        }
        onPress={() => {
          saveCurrentSearch();
          router.push({
            pathname: "/artist/[id]",
            params: { id: item.id },
          });
        }}
        left={(props) =>
          artUrl ? (
            <Image
              source={{ uri: artUrl, cacheKey: `${item.coverArt}-300` }}
              style={searchStyles.artistAvatar}
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
  };

  const renderPlaylistItem = (item: Playlist) => {
    const artUrl = getArtUrl ? getArtUrl(item.coverArt) : null;
    return (
      <List.Item
        key={`playlist-${item.id}`}
        title={item.name}
        description={
          item.songCount !== undefined && item.songCount !== null
            ? `${item.songCount} ${item.songCount === 1 ? "song" : "songs"}`
            : undefined
        }
        onPress={() => {
          saveCurrentSearch();
          router.push({
            pathname: "/(main)/library/playlist/[id]",
            params: { id: item.id },
          });
        }}
        left={(props) =>
          artUrl ? (
            <Image
              source={{ uri: artUrl, cacheKey: `${item.coverArt}-300` }}
              style={searchStyles.artwork}
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
  };

  return (
    <Surface style={searchStyles.page}>
      <Appbar.Header statusBarHeight={0}>
        <Appbar.Content title="search" />
      </Appbar.Header>

      <Searchbar
        placeholder="search songs, albums, artists..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        onSubmitEditing={() => saveCurrentSearch()}
        style={searchStyles.searchbar}
      />

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={searchStyles.chipScrollContent}
        >
          {CATEGORIES.map((cat) => (
            <Chip
              key={cat.value}
              selected={activeCategory === cat.value}
              onPress={() => setActiveCategory(cat.value)}
              style={searchStyles.chip}
              showSelectedOverlay
            >
              {cat.label}
            </Chip>
          ))}
        </ScrollView>
      </View>

      {!isSearching && (
        recentSearches.length > 0 ? (
          <ScrollView
            contentContainerStyle={searchStyles.recentContainer}
            keyboardShouldPersistTaps="handled"
          >
            <View style={searchStyles.recentHeader}>
              <Text variant="titleMedium" style={searchStyles.recentTitle}>
                recent searches
              </Text>
              <Button
                mode="text"
                compact
                onPress={handleClearRecentSearches}
                accessibilityLabel="clear recent searches"
              >
                clear recent searches
              </Button>
            </View>
            <View style={searchStyles.recentChips}>
              {recentSearches.map((term) => (
                <Chip
                  key={term}
                  icon="history"
                  onPress={() => handleSelectRecentSearch(term)}
                  onClose={() => handleRemoveRecentSearch(term)}
                  style={searchStyles.recentChip}
                >
                  {term}
                </Chip>
              ))}
            </View>
          </ScrollView>
        ) : (
          <View style={searchStyles.emptyContainer}>
            <Icon source="magnify" size={64} color={theme.colors.onSurfaceVariant} />
            <Text
              variant="titleMedium"
              style={[searchStyles.emptyText, { color: theme.colors.onSurfaceVariant }]}
            >
              type to search your library
            </Text>
            <Text
              variant="bodySmall"
              style={[searchStyles.emptyText, { color: theme.colors.outline }]}
            >
              find songs, albums, artists, and playlists
            </Text>
          </View>
        )
      )}

      {isSearching && totalResults === 0 && (
        <View style={searchStyles.emptyContainer}>
          <Icon
            source="magnify-remove-outline"
            size={64}
            color={theme.colors.onSurfaceVariant}
          />
          <Text
            variant="titleMedium"
            style={[searchStyles.emptyText, { color: theme.colors.onSurfaceVariant }]}
          >
            no results found
          </Text>
          <Text
            variant="bodySmall"
            style={[searchStyles.emptyText, { color: theme.colors.outline }]}
          >
            {`no results found for "${searchQuery}"`}
          </Text>
        </View>
      )}

      {isSearching && totalResults > 0 && activeCategory === "all" && (
        <ScrollView contentContainerStyle={searchStyles.listContent}>
          {songs.length > 0 && (
            <View>
              <View style={searchStyles.sectionHeader}>
                <Text variant="titleMedium" style={searchStyles.sectionTitle}>
                  songs
                </Text>
                <Button
                  mode="text"
                  compact
                  onPress={() => setActiveCategory("songs")}
                >
                  see all
                </Button>
              </View>
              {songs.map((song, idx) => renderSongItem(song, idx, songs))}
            </View>
          )}

          {albums.length > 0 && (
            <View>
              <View style={searchStyles.sectionHeader}>
                <Text variant="titleMedium" style={searchStyles.sectionTitle}>
                  albums
                </Text>
                <Button
                  mode="text"
                  compact
                  onPress={() => setActiveCategory("albums")}
                >
                  see all
                </Button>
              </View>
              {albums.map((album) => renderAlbumItem(album))}
            </View>
          )}

          {artists.length > 0 && (
            <View>
              <View style={searchStyles.sectionHeader}>
                <Text variant="titleMedium" style={searchStyles.sectionTitle}>
                  artists
                </Text>
                <Button
                  mode="text"
                  compact
                  onPress={() => setActiveCategory("artists")}
                >
                  see all
                </Button>
              </View>
              {artists.map((artist) => renderArtistItem(artist))}
            </View>
          )}

          {playlists.length > 0 && (
            <View>
              <View style={searchStyles.sectionHeader}>
                <Text variant="titleMedium" style={searchStyles.sectionTitle}>
                  playlists
                </Text>
                <Button
                  mode="text"
                  compact
                  onPress={() => setActiveCategory("playlists")}
                >
                  see all
                </Button>
              </View>
              {playlists.map((playlist) => renderPlaylistItem(playlist))}
            </View>
          )}
        </ScrollView>
      )}

      {isSearching && activeCategory === "songs" && (
        <FlatList
          data={songs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={searchStyles.listContent}
          renderItem={({ item, index }) => renderSongItem(item, index, songs)}
          ListEmptyComponent={
            <View style={searchStyles.emptyContainer}>
              <Text variant="bodyLarge">no songs found</Text>
            </View>
          }
        />
      )}

      {isSearching && activeCategory === "albums" && (
        <FlatList
          data={albums}
          keyExtractor={(item) => item.id}
          contentContainerStyle={searchStyles.listContent}
          renderItem={({ item }) => renderAlbumItem(item)}
          ListEmptyComponent={
            <View style={searchStyles.emptyContainer}>
              <Text variant="bodyLarge">no albums found</Text>
            </View>
          }
        />
      )}

      {isSearching && activeCategory === "artists" && (
        <FlatList
          data={artists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={searchStyles.listContent}
          renderItem={({ item }) => renderArtistItem(item)}
          ListEmptyComponent={
            <View style={searchStyles.emptyContainer}>
              <Text variant="bodyLarge">no artists found</Text>
            </View>
          }
        />
      )}

      {isSearching && activeCategory === "playlists" && (
        <FlatList
          data={playlists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={searchStyles.listContent}
          renderItem={({ item }) => renderPlaylistItem(item)}
          ListEmptyComponent={
            <View style={searchStyles.emptyContainer}>
              <Text variant="bodyLarge">no playlists found</Text>
            </View>
          }
        />
      )}
    </Surface>
  );
}

