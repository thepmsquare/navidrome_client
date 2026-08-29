import { useRouter } from "expo-router";
import { Button, Surface, Text } from "react-native-paper";

import { libraryStyles } from "@/stylesheets";

export default function LibraryHomeScreen() {
  const router = useRouter();

  return (
    <Surface style={libraryStyles.page}>
      <Text variant="displaySmall">library</Text>

      <Button
        mode="contained"
        icon="music"
        style={libraryStyles.button}
        onPress={() => router.push("/library/songs")}
      >
        songs
      </Button>

      <Button
        mode="contained"
        icon="album"
        style={libraryStyles.button}
        onPress={() => router.push("/library/albums")}
      >
        albums
      </Button>

      <Button
        mode="contained"
        icon="playlist-music"
        style={libraryStyles.button}
        onPress={() => router.push("/library/playlists")}
      >
        playlists
      </Button>

      <Button
        mode="contained"
        icon="account-music"
        style={libraryStyles.button}
        onPress={() => router.push("/library/artists")}
      >
        artists
      </Button>
    </Surface>
  );
}
