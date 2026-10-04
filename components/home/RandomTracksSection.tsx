import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { Avatar, IconButton, List, Surface, Text } from "react-native-paper";

import { SongCacheButton } from "@/components/SongCacheButton";
import { getCoverArtBaseUrl } from "@/services/api";
import { getAllSongCacheEntries, getRandomSongs } from "@/services/db";
import { playPlaylist } from "@/services/player";
import { subscribeSongCache } from "@/services/songCache";
import { homeStyles } from "@/stylesheets";
import { Child, SongCacheRow, useAppTheme } from "@/types";

export function RandomTracksSection() {
  const theme = useAppTheme();
  const [tracks, setTracks] = useState<Child[]>(() => getRandomSongs(10));
  const [getArtUrl, setGetArtUrl] = useState<
    ((id?: string | null) => string | null) | null
  >(null);
  const [cacheEntries, setCacheEntries] = useState<Map<string, SongCacheRow>>(() =>
    getAllSongCacheEntries(),
  );

  useEffect(() => {
    let isMounted = true;
    getCoverArtBaseUrl()
      .then((fn) => {
        if (isMounted) setGetArtUrl(() => fn);
      })
      .catch((err) =>
        console.error(
          "failed to get cover art url helper in random tracks section:",
          err,
        ),
      );
    return () => {
      isMounted = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      setCacheEntries(getAllSongCacheEntries());
      setTracks((prev) => (prev.length === 0 ? getRandomSongs(10) : prev));
    }, []),
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
    return () => {
      unsubscribe();
    };
  }, []);

  const handleRefresh = useCallback(() => {
    setTracks(getRandomSongs(10));
  }, []);

  return (
    <View style={homeStyles.section}>
      <View style={homeStyles.sectionHeaderRow}>
        <Text variant="titleMedium" style={homeStyles.sectionHeaderTitle}>
          random tracks
        </Text>
        <IconButton
          icon="refresh"
          size={20}
          onPress={handleRefresh}
          accessibilityLabel="refresh random tracks"
        />
      </View>

      {tracks.length === 0 ? (
        <Text
          variant="bodyMedium"
          style={[{ color: theme.colors.onSurfaceVariant }, homeStyles.emptyText]}
        >
          no tracks found
        </Text>
      ) : (
        <View style={homeStyles.trackList}>
          {tracks.map((item, index) => {
            const artUrl = getArtUrl ? getArtUrl(item.coverArt) : null;

            return (
              <List.Item
                key={item.id}
                title={item.title}
                description={item.artist ?? undefined}
                onPress={() => playPlaylist(tracks, index)}
                left={(props) =>
                  artUrl ? (
                    <Image
                      source={{ uri: artUrl, cacheKey: `${item.coverArt}-300` }}
                      style={homeStyles.trackArtwork}
                      contentFit="cover"
                      transition={200}
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <Surface
                      style={[
                        homeStyles.trackPlaceholder,
                        {
                          backgroundColor:
                            theme.colors.surfaceContainerHighest,
                        },
                      ]}
                    >
                      <Avatar.Icon {...props} size={28} icon="music" />
                    </Surface>
                  )
                }
                right={() => (
                  <SongCacheButton
                    songId={item.id}
                    mini
                    hideIfUncached
                    initialEntry={cacheEntries.get(item.id) ?? null}
                  />
                )}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}
