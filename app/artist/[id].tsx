import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, TouchableOpacity, View } from "react-native";
import { Appbar, Avatar, Surface, Text } from "react-native-paper";

import { AlbumCard } from "@/components/AlbumCard";
import { AppBottomBar, TabKey } from "@/components/AppBottomBar";
import { DetailActionsRow } from "@/components/DetailActionsRow";
import { RichHtmlText } from "@/components/RichHtmlText";
import { SongRow } from "@/components/SongRow";
import {
  getArtistInfo,
  getCoverArtBaseUrl,
  star,
  unstar,
} from "@/services/api";
import {
  getAlbumsByArtistId,
  getAllSongCacheEntries,
  getArtistById,
  getSongsByArtistId,
  updateArtistStarred,
} from "@/services/db";
import { playPlaylist } from "@/services/player";
import { subscribeSongCache } from "@/services/songCache";
import { artistDetailStyles } from "@/stylesheets";
import {
  AlbumID3,
  ArtistID3,
  ArtistInfo,
  Child,
  SongCacheRow,
  useAppTheme,
} from "@/types";

export default function ArtistDetailScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();

  const [artist, setArtist] = useState<ArtistID3 | null>(() =>
    id ? getArtistById(id) : null,
  );
  const [artistInfo, setArtistInfo] = useState<ArtistInfo | null>(null);
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  const [isStarring, setIsStarring] = useState(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const [cacheEntries, setCacheEntries] = useState<Map<string, SongCacheRow>>(
    () => getAllSongCacheEntries(),
  );
  const [getArtUrl, setGetArtUrl] = useState<
    ((artId?: string | null) => string | null) | null
  >(null);

  const albums: AlbumID3[] = useMemo(() => {
    if (!id) return [];
    return getAlbumsByArtistId(id, artist?.name);
  }, [id, artist?.name]);

  const songs: Child[] = useMemo(() => {
    if (!id) return [];
    return getSongsByArtistId(id, artist?.name);
  }, [id, artist?.name]);

  useFocusEffect(
    useCallback(() => {
      setCacheEntries(getAllSongCacheEntries());
      if (id) {
        setArtist(getArtistById(id));
      }
    }, [id]),
  );

  useEffect(() => {
    const unsubscribe = subscribeSongCache(({ songId, entry }) => {
      setCacheEntries((prev) => {
        const next = new Map(prev);
        if (entry) {
          next.set(songId, entry);
        } else {
          next.delete(songId);
        }
        return next;
      });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    getCoverArtBaseUrl()
      .then((fn) => setGetArtUrl(() => fn))
      .catch((err) =>
        console.error("failed to get cover art url helper:", err),
      );

    if (id) {
      getArtistInfo(id)
        .then((info) => {
          if (info) setArtistInfo(info);
        })
        .catch((err) =>
          console.warn("failed to fetch artist info from api:", err),
        );
    }
  }, [id]);

  const onRefresh = useCallback(() => {
    if (!id) return;
    setRefreshing(true);
    setArtist(getArtistById(id));
    getArtistInfo(id)
      .then((info) => {
        if (info) setArtistInfo(info);
      })
      .catch((err) => {
        console.warn("failed to refresh artist info:", err);
      })
      .finally(() => {
        setRefreshing(false);
      });
  }, [id]);

  const handleToggleStar = async () => {
    if (!id || !artist || isStarring) return;
    setIsStarring(true);
    const isCurrentlyStarred = !!artist.starred;
    const nextStarredValue = isCurrentlyStarred
      ? null
      : new Date().toISOString();

    try {
      if (isCurrentlyStarred) {
        await unstar({ artistId: id });
      } else {
        await star({ artistId: id });
      }
      updateArtistStarred(id, nextStarredValue);
      setArtist((prev) =>
        prev ? { ...prev, starred: nextStarredValue } : null,
      );
    } catch (err) {
      console.error("failed to toggle artist starred status:", err);
    } finally {
      setIsStarring(false);
    }
  };

  const isStarred = !!artist?.starred;

  let artistArtUri: string | null = null;
  if (artist?.artistImageUrl && artist.artistImageUrl.startsWith("http")) {
    artistArtUri = artist.artistImageUrl;
  } else if (artistInfo?.largeImageUrl) {
    artistArtUri = artistInfo.largeImageUrl;
  } else if (getArtUrl && artist?.coverArt) {
    artistArtUri = getArtUrl(artist.coverArt);
  }

  return (
    <Surface style={artistDetailStyles.page}>
      <Appbar.Header statusBarHeight={0}>
        <Appbar.BackAction
          onPress={() => router.back()}
          accessibilityLabel="go back"
        />
        <Appbar.Content title="artist" />
        <Appbar.Action
          icon={isStarred ? "heart" : "heart-outline"}
          iconColor={isStarred ? theme.colors.primary : undefined}
          onPress={handleToggleStar}
          disabled={isStarring || !artist}
          accessibilityLabel={isStarred ? "unstar artist" : "star artist"}
        />
        <Appbar.Action
          icon="play"
          onPress={() => {
            if (songs.length > 0) {
              playPlaylist(songs, 0);
            }
          }}
          disabled={songs.length === 0}
          accessibilityLabel="play all"
        />
      </Appbar.Header>

      <FlatList
        data={songs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={artistDetailStyles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
            progressBackgroundColor={theme.colors.surfaceContainerHighest}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={artistDetailStyles.headerInfoContainer}>
              {artistArtUri ? (
                <Image
                  source={{
                    uri: artistArtUri,
                    cacheKey: `${artist?.coverArt ?? id}-300`,
                  }}
                  style={artistDetailStyles.artistImage}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              ) : (
                <Avatar.Icon
                  size={150}
                  icon="account-music"
                  style={{ marginBottom: 8 }}
                />
              )}

              <Text
                variant="headlineMedium"
                style={artistDetailStyles.artistName}
              >
                {artist?.name || "unknown artist"}
              </Text>

              <Text
                variant="bodyMedium"
                style={[
                  artistDetailStyles.metaText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {`${albums.length} ${albums.length === 1 ? "album" : "albums"} • ${songs.length} ${songs.length === 1 ? "song" : "songs"}`}
              </Text>

              <DetailActionsRow
                songs={songs}
                sourceKey={`artist:${artist?.id ?? id}`}
                cacheEntries={cacheEntries}
              />
            </View>

            {artistInfo?.biography ? (
              <Surface
                elevation={1}
                style={[
                  artistDetailStyles.bioContainer,
                  { backgroundColor: theme.colors.surfaceContainerHighest },
                ]}
              >
                <View style={artistDetailStyles.bioHeaderRow}>
                  <Text variant="titleSmall" style={{ fontWeight: "bold" }}>
                    biography
                  </Text>
                </View>
                <RichHtmlText
                  html={artistInfo.biography}
                  numberOfLines={isBioExpanded ? undefined : 3}
                  style={[
                    artistDetailStyles.bioText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                />
                <TouchableOpacity
                  onPress={() => setIsBioExpanded((prev) => !prev)}
                >
                  <Text
                    variant="labelMedium"
                    style={[
                      artistDetailStyles.bioToggleText,
                      { color: theme.colors.primary },
                    ]}
                  >
                    {isBioExpanded ? "read less" : "read more"}
                  </Text>
                </TouchableOpacity>
              </Surface>
            ) : null}

            {albums.length > 0 ? (
              <View>
                <View style={artistDetailStyles.sectionHeader}>
                  <Text
                    variant="titleMedium"
                    style={artistDetailStyles.sectionTitle}
                  >
                    albums
                  </Text>
                </View>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={albums}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={artistDetailStyles.albumListContent}
                  renderItem={({ item }) => (
                    <AlbumCard album={item} width={140} getArtUrl={getArtUrl} />
                  )}
                />
              </View>
            ) : null}

            <View style={artistDetailStyles.sectionHeader}>
              <Text
                variant="titleMedium"
                style={artistDetailStyles.sectionTitle}
              >
                songs
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={artistDetailStyles.emptyContainer}>
            <Text variant="bodyLarge">no songs found</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <SongRow
            song={item}
            index={index}
            showTrackNumber
            trackNumber={index + 1}
            subtitle={item.album ?? undefined}
            showDuration
            onPress={() => playPlaylist(songs, index)}
            initialCacheEntry={cacheEntries.get(item.id) ?? null}
          />
        )}
      />

      <AppBottomBar activeTab={(from as TabKey) ?? "library"} />
    </Surface>
  );
}
