import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Surface,
  Text,
} from "react-native-paper";

import { client_app_sync } from "@/services/api";
import { getLocalCounts } from "@/services/db";
import { Search3Counts } from "@/types";

export default function HomeScreen() {
  const router = useRouter();
  const [subsonicVersion, setSubsonicVersion] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [counts, setCounts] = useState<Search3Counts | null>(null);
  const [loadingCounts, setLoadingCounts] = useState<boolean>(true);
  const [syncStatusText, setSyncStatusText] = useState<string | null>(null);

  async function performSync(force: boolean = false) {
    try {
      setLoadingCounts(true);
      const initialCounts = getLocalCounts();
      setCounts(initialCounts);

      const syncResult = await client_app_sync(force);
      if (syncResult.synced) {
        setSyncStatusText("synced: true (fresh sync from server)");
        setCounts({
          artistCount: syncResult.artistCount ?? 0,
          albumCount: syncResult.albumCount ?? 0,
          songCount: syncResult.songCount ?? 0,
        });
      } else {
        setSyncStatusText("synced: false (loaded from cache)");
        setCounts({
          artistCount: syncResult.artistCount ?? initialCounts.artistCount,
          albumCount: syncResult.albumCount ?? initialCounts.albumCount,
          songCount: syncResult.songCount ?? initialCounts.songCount,
        });
      }
    } catch (error) {
      console.error("failed to sync library:", error);
      setSyncStatusText("sync failed");
    } finally {
      setLoadingCounts(false);
    }
  }

  useEffect(() => {
    async function loadData() {
      const version = await SecureStore.getItemAsync("subsonicVersion");
      const url = await SecureStore.getItemAsync("serverUrl");
      const user = await SecureStore.getItemAsync("username");
      setSubsonicVersion(version);
      setServerUrl(url);
      setUsername(user);

      await performSync(false);
    }

    loadData();
  }, []);

  async function handleLogout() {
    await SecureStore.deleteItemAsync("subsonicVersion");
    await SecureStore.deleteItemAsync("serverUrl");
    await SecureStore.deleteItemAsync("username");
    await SecureStore.deleteItemAsync("password");
    router.replace("/connect");
  }

  return (
    <Surface elevation={0}>
      <Text variant="headlineMedium">welcome home! 🎉</Text>
      <Text variant="bodyLarge">you are currently logged in.</Text>

      <Text variant="titleMedium">username</Text>
      <Text variant="bodyMedium">{username}</Text>
      <Text variant="titleMedium">subsonic version</Text>
      <Text variant="bodyMedium">{subsonicVersion}</Text>
      <Text variant="titleMedium">server url</Text>
      <Text variant="bodyMedium">{serverUrl}</Text>

      <Text variant="titleLarge">library stats</Text>
      {syncStatusText && <Text variant="bodyMedium">{syncStatusText}</Text>}

      {loadingCounts ? (
        <View>
          <ActivityIndicator size="small" />
          <Text variant="bodySmall">syncing library...</Text>
        </View>
      ) : (
        <View>
          <Card>
            <Card.Content>
              <Text variant="headlineSmall">{counts?.artistCount ?? 0}</Text>
              <Text variant="bodyMedium">artists</Text>
            </Card.Content>
          </Card>
          <Card>
            <Card.Content>
              <Text variant="headlineSmall">{counts?.albumCount ?? 0}</Text>
              <Text variant="bodyMedium">albums</Text>
            </Card.Content>
          </Card>
          <Card>
            <Card.Content>
              <Text variant="headlineSmall">{counts?.songCount ?? 0}</Text>
              <Text variant="bodyMedium">songs</Text>
            </Card.Content>
          </Card>
        </View>
      )}

      <Button
        mode="outlined"
        onPress={() => performSync(false)}
        disabled={loadingCounts}
      >
        sync
      </Button>
      <Button
        mode="outlined"
        onPress={() => performSync(true)}
        disabled={loadingCounts}
      >
        force sync
      </Button>
      <Button mode="contained" onPress={handleLogout}>
        log out
      </Button>
    </Surface>
  );
}
