import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { Avatar, Text } from "react-native-paper";

import { AlbumCard } from "@/components/AlbumCard";
import { getCoverArtBaseUrl, subscribePlayStats } from "@/services/api";
import { getRecentlyPlayedAlbums } from "@/services/db";
import { homeStyles } from "@/stylesheets";
import { AlbumID3, useAppTheme } from "@/types";

export function RecentlyPlayedSection() {
  const theme = useAppTheme();
  const [albums, setAlbums] = useState<AlbumID3[]>(() =>
    getRecentlyPlayedAlbums(20),
  );
  const [getArtUrl, setGetArtUrl] = useState<
    ((id?: string | null) => string | null) | null
  >(null);

  useEffect(() => {
    let isMounted = true;
    getCoverArtBaseUrl()
      .then((fn) => {
        if (isMounted) setGetArtUrl(() => fn);
      })
      .catch((err) =>
        console.error(
          "failed to get cover art url helper in recently played section:",
          err,
        ),
      );
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof subscribePlayStats === "function") {
      const unsubscribe = subscribePlayStats(() => {
        setAlbums(getRecentlyPlayedAlbums(20));
      });
      return unsubscribe;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setAlbums(getRecentlyPlayedAlbums(20));
    }, []),
  );

  return (
    <View style={homeStyles.section}>
      <Text variant="titleMedium" style={homeStyles.sectionHeader}>
        recently played
      </Text>

      {albums.length === 0 ? (
        <View
          style={[
            homeStyles.emptyCard,
            { backgroundColor: theme.colors.surfaceContainerHighest },
          ]}
        >
          <Avatar.Icon
            size={40}
            icon="history"
            style={{ backgroundColor: theme.colors.surfaceContainerHigh }}
          />
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}
          >
            no recently played albums
          </Text>
        </View>
      ) : (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={albums}
          keyExtractor={(item) => item.id}
          contentContainerStyle={homeStyles.horizontalList}
          renderItem={({ item }) => (
            <AlbumCard album={item} width={140} getArtUrl={getArtUrl} />
          )}
        />
      )}
    </View>
  );
}
