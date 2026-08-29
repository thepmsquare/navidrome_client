import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  IconButton,
  List,
  Surface,
  Text,
} from "react-native-paper";

import { getCoverArtBaseUrl, getPlaylist } from "@/services/api";
import { getPlaylistById } from "@/services/db";
import { playPlaylist } from "@/services/player";
import { playlistDetailStyles } from "@/stylesheets";
import { Child, Playlist } from "@/types";

function formatDuration(seconds?: number): string {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function PlaylistDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [playlist, setPlaylist] = useState<Playlist | null>(() =>
    id ? getPlaylistById(id) : null,
  );
  const [songs, setSongs] = useState<Child[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [getArtUrl, setGetArtUrl] = useState<
    ((artId?: string | null) => string | null) | null
  >(null);

  useEffect(() => {
    getCoverArtBaseUrl()
      .then((fn) => setGetArtUrl(() => fn))
      .catch((err) =>
        console.error("failed to get cover art url helper:", err),
      );

    if (id) {
      getPlaylist(id)
        .then((fullPlaylist) => {
          setPlaylist(fullPlaylist);
          setSongs(fullPlaylist.entry ?? []);
        })
        .catch((err) => {
          console.error("failed to fetch playlist details:", err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [id]);

  const artUrl = playlist && getArtUrl ? getArtUrl(playlist.coverArt) : null;

  return (
    <Surface style={playlistDetailStyles.page}>
      <View style={playlistDetailStyles.header}>
        <IconButton icon="arrow-left" size={24} onPress={() => router.back()} />
        <Text variant="titleLarge">playlist</Text>
      </View>

      <FlatList
        data={songs}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={playlistDetailStyles.listContent}
        ListHeaderComponent={
          playlist ? (
            <View style={playlistDetailStyles.playlistInfoContainer}>
              {artUrl ? (
                <Image
                  source={{ uri: artUrl, cacheKey: `${playlist.coverArt}-300` }}
                  style={playlistDetailStyles.coverArt}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              ) : (
                <Avatar.Icon size={120} icon="playlist-music" />
              )}
              <Text
                variant="headlineSmall"
                style={playlistDetailStyles.playlistName}
              >
                {playlist.name}
              </Text>
              {playlist.comment ? (
                <Text
                  variant="bodyMedium"
                  style={playlistDetailStyles.commentText}
                >
                  {playlist.comment}
                </Text>
              ) : null}
              <Text variant="bodySmall" style={playlistDetailStyles.metaText}>
                {[
                  playlist.owner ? `by ${playlist.owner}` : null,
                  playlist.songCount ? `${playlist.songCount} songs` : null,
                  playlist.duration
                    ? formatDuration(playlist.duration)
                    : null,
                ]
                  .filter(Boolean)
                  .join(" • ")}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <View style={playlistDetailStyles.loadingContainer}>
              <ActivityIndicator size="small" />
              <Text variant="bodySmall">loading playlist songs...</Text>
            </View>
          ) : (
            <View style={playlistDetailStyles.emptyContainer}>
              <Text variant="bodyLarge">no songs found in playlist</Text>
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <List.Item
            title={item.title}
            description={item.artist ?? undefined}
            style={playlistDetailStyles.trackItem}
            onPress={() => playPlaylist(songs, index)}
            left={() => (
              <Text variant="bodyMedium" style={playlistDetailStyles.trackNumber}>
                {index + 1}
              </Text>
            )}
            right={() =>
              item.duration ? (
                <Text variant="bodySmall" style={playlistDetailStyles.metaText}>
                  {formatDuration(item.duration)}
                </Text>
              ) : null
            }
          />
        )}
      />
    </Surface>
  );
}
