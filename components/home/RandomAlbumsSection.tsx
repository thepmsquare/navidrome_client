import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { Avatar, IconButton, Text } from "react-native-paper";

import { AlbumCard } from "@/components/AlbumCard";
import { getCoverArtBaseUrl, subscribeSyncState } from "@/services/api";
import { getRandomAlbums } from "@/services/db";
import { homeStyles } from "@/stylesheets";
import { AlbumID3, useAppTheme } from "@/types";

export function RandomAlbumsSection() {
  const theme = useAppTheme();
  const [albums, setAlbums] = useState<AlbumID3[]>(() => getRandomAlbums(20));
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
          "failed to get cover art url helper in random albums section:",
          err,
        ),
      );
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof subscribeSyncState === "function") {
      const unsubscribe = subscribeSyncState((isSyncing) => {
        if (!isSyncing) {
          setAlbums(getRandomAlbums(20));
        }
      });
      return unsubscribe;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setAlbums((prev) => (prev.length === 0 ? getRandomAlbums(20) : prev));
    }, []),
  );

  const handleRefresh = useCallback(() => {
    setAlbums(getRandomAlbums(20));
  }, []);

  return (
    <View style={homeStyles.section}>
      <View style={homeStyles.sectionHeaderRow}>
        <Text variant="titleMedium" style={homeStyles.sectionHeaderTitle}>
          random albums
        </Text>
        <IconButton
          icon="shuffle-variant"
          size={20}
          onPress={handleRefresh}
          accessibilityLabel="shuffle random albums"
        />
      </View>

      {albums.length === 0 ? (
        <View
          style={[
            homeStyles.emptyCard,
            { backgroundColor: theme.colors.surfaceContainerHighest },
          ]}
        >
          <Avatar.Icon
            size={40}
            icon="album"
            style={{ backgroundColor: theme.colors.surfaceContainerHigh }}
          />
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}
          >
            no random albums
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
