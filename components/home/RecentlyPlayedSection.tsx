import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, TouchableOpacity, View } from "react-native";
import { Avatar, Surface, Text } from "react-native-paper";

import { getCoverArtBaseUrl, subscribePlayStats } from "@/services/api";
import { getRecentlyPlayedAlbums } from "@/services/db";
import { homeStyles } from "@/stylesheets";
import { AlbumID3, useAppTheme } from "@/types";

export function RecentlyPlayedSection() {
  const router = useRouter();
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
          renderItem={({ item }) => {
            const artUrl = getArtUrl ? getArtUrl(item.coverArt) : null;

            return (
              <TouchableOpacity
                activeOpacity={0.7}
                style={homeStyles.tile}
                onPress={() =>
                  router.push({
                    pathname: "/album/[id]",
                    params: { id: item.id },
                  })
                }
              >
                {artUrl ? (
                  <Image
                    source={{ uri: artUrl, cacheKey: `${item.coverArt}-300` }}
                    style={homeStyles.artwork}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <Surface
                    style={[
                      homeStyles.artworkPlaceholder,
                      { backgroundColor: theme.colors.surfaceContainerHighest },
                    ]}
                  >
                    <Avatar.Icon size={48} icon="album" />
                  </Surface>
                )}
                <Text
                  variant="bodyMedium"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={homeStyles.tileTitle}
                >
                  {item.name}
                </Text>
                {item.artist && (
                  <Text
                    variant="bodySmall"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[
                      { color: theme.colors.onSurfaceVariant },
                      homeStyles.tileSubtitle,
                    ]}
                  >
                    {item.artist}
                  </Text>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
