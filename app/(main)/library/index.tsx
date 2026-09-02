import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Button, Surface, Text } from "react-native-paper";

import { libraryStyles } from "@/stylesheets";

export default function LibraryHomeScreen() {
  const router = useRouter();
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
      <Text variant="displaySmall">library</Text>

      <Button
        mode="contained"
        icon="music"
        style={libraryStyles.button}
        loading={loadingRoute === "/library/songs"}
        disabled={loadingRoute !== null}
        onPress={() => handleNavigate("/library/songs")}
      >
        songs
      </Button>

      <Button
        mode="contained"
        icon="album"
        style={libraryStyles.button}
        loading={loadingRoute === "/library/albums"}
        disabled={loadingRoute !== null}
        onPress={() => handleNavigate("/library/albums")}
      >
        albums
      </Button>

      <Button
        mode="contained"
        icon="playlist-music"
        style={libraryStyles.button}
        loading={loadingRoute === "/library/playlists"}
        disabled={loadingRoute !== null}
        onPress={() => handleNavigate("/library/playlists")}
      >
        playlists
      </Button>

      <Button
        mode="contained"
        icon="account-music"
        style={libraryStyles.button}
        loading={loadingRoute === "/library/artists"}
        disabled={loadingRoute !== null}
        onPress={() => handleNavigate("/library/artists")}
      >
        artists
      </Button>
    </Surface>
  );
}
