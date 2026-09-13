import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView } from "react-native";
import { Button, Surface, Text } from "react-native-paper";

import { libraryStyles } from "@/stylesheets";
import { useAppTheme } from "@/types";

export default function LibraryHomeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [loadingRoute, setLoadingRoute] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setLoadingRoute(null);
    }, []),
  );

  const handleNavigate = (route: string) => {
    if (loadingRoute) return;
    setLoadingRoute(route);
    setTimeout(() => {
      router.push(route as any);
    }, 50);
  };

  return (
    <Surface style={libraryStyles.page}>
      <ScrollView contentContainerStyle={libraryStyles.scrollContent}>
        <Text variant="titleLarge">library</Text>

        <Surface
          elevation={0}
          style={[
            libraryStyles.sectionCard,
            { backgroundColor: theme.colors.surfaceContainerHighest },
          ]}
        >
          <Text variant="titleMedium">browse</Text>

          <Button
            mode="contained-tonal"
            icon="music"
            style={libraryStyles.button}
            loading={loadingRoute === "/library/songs"}
            disabled={loadingRoute !== null}
            onPress={() => handleNavigate("/library/songs")}
          >
            songs
          </Button>

          <Button
            mode="contained-tonal"
            icon="album"
            style={libraryStyles.button}
            loading={loadingRoute === "/library/albums"}
            disabled={loadingRoute !== null}
            onPress={() => handleNavigate("/library/albums")}
          >
            albums
          </Button>

          <Button
            mode="contained-tonal"
            icon="playlist-music"
            style={libraryStyles.button}
            loading={loadingRoute === "/library/playlists"}
            disabled={loadingRoute !== null}
            onPress={() => handleNavigate("/library/playlists")}
          >
            playlists
          </Button>

          <Button
            mode="contained-tonal"
            icon="account-music"
            style={libraryStyles.button}
            loading={loadingRoute === "/library/artists"}
            disabled={loadingRoute !== null}
            onPress={() => handleNavigate("/library/artists")}
          >
            artists
          </Button>

          <Button
            mode="contained-tonal"
            icon="cloud-check"
            style={libraryStyles.button}
            loading={loadingRoute === "/library/offline"}
            disabled={loadingRoute !== null}
            onPress={() => handleNavigate("/library/offline")}
          >
            available offline
          </Button>
        </Surface>
      </ScrollView>
    </Surface>
  );
}
