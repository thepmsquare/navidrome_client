import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Surface,
  Text,
} from "react-native-paper";

import { client_app_sync } from "@/services/api";
import { getLocalCounts } from "@/services/db";
import { playTestSound } from "@/services/player";
import { homeStyles } from "@/stylesheets";
import { Search3Counts, useAppTheme } from "@/types";
import { useAudioOutputDevice } from "@/utils/audioOutput";

export default function HomeScreen() {
  const theme = useAppTheme();
  const audioDevice = useAudioOutputDevice();
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
          playlistCount: syncResult.playlistCount ?? 0,
        });
      } else {
        setSyncStatusText("synced: false (loaded from cache)");
        setCounts({
          artistCount: syncResult.artistCount ?? initialCounts.artistCount,
          albumCount: syncResult.albumCount ?? initialCounts.albumCount,
          songCount: syncResult.songCount ?? initialCounts.songCount,
          playlistCount:
            syncResult.playlistCount ?? initialCounts.playlistCount,
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

  return (
    <Surface style={homeStyles.page}>
      <ScrollView contentContainerStyle={homeStyles.scrollContent}>
        <Text variant="titleLarge">home</Text>

        <Surface
          elevation={0}
          style={[
            homeStyles.sectionCard,
            { backgroundColor: theme.colors.surfaceContainerHighest },
          ]}
        >
          <Text variant="titleMedium">connection</Text>
          <View style={homeStyles.infoRow}>
            <Text
              variant="labelLarge"
              style={[
                homeStyles.infoLabel,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              username
            </Text>
            <Text variant="bodyMedium" style={homeStyles.infoValue}>
              {username}
            </Text>
          </View>
          <View style={homeStyles.infoRow}>
            <Text
              variant="labelLarge"
              style={[
                homeStyles.infoLabel,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              server
            </Text>
            <Text
              variant="bodyMedium"
              style={homeStyles.infoValue}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {serverUrl}
            </Text>
          </View>
          <View style={homeStyles.infoRow}>
            <Text
              variant="labelLarge"
              style={[
                homeStyles.infoLabel,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              subsonic version
            </Text>
            <Text variant="bodyMedium" style={homeStyles.infoValue}>
              {subsonicVersion}
            </Text>
          </View>
          <View style={homeStyles.infoRow}>
            <Text
              variant="labelLarge"
              style={[
                homeStyles.infoLabel,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              audio output
            </Text>
            <Text variant="bodyMedium" style={homeStyles.infoValue}>
              {audioDevice.name} ({audioDevice.type})
            </Text>
          </View>
        </Surface>

        <Surface
          elevation={0}
          style={[
            homeStyles.sectionCard,
            { backgroundColor: theme.colors.surfaceContainerHighest },
          ]}
        >
          <Text variant="titleMedium">library</Text>
          {syncStatusText && (
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {syncStatusText}
            </Text>
          )}
          {loadingCounts ? (
            <View style={homeStyles.loadingRow}>
              <ActivityIndicator size="small" />
              <Text variant="bodySmall">syncing library...</Text>
            </View>
          ) : (
            <View style={homeStyles.countsContainer}>
              <View style={homeStyles.countsRow}>
                <Card
                  mode="contained"
                  style={[
                    homeStyles.countCard,
                    { backgroundColor: theme.colors.surfaceContainer },
                  ]}
                >
                  <Card.Content>
                    <Text variant="headlineSmall">
                      {counts?.artistCount ?? 0}
                    </Text>
                    <Text
                      variant="bodyMedium"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      artists
                    </Text>
                  </Card.Content>
                </Card>
                <Card
                  mode="contained"
                  style={[
                    homeStyles.countCard,
                    { backgroundColor: theme.colors.surfaceContainer },
                  ]}
                >
                  <Card.Content>
                    <Text variant="headlineSmall">{counts?.albumCount ?? 0}</Text>
                    <Text
                      variant="bodyMedium"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      albums
                    </Text>
                  </Card.Content>
                </Card>
              </View>
              <View style={homeStyles.countsRow}>
                <Card
                  mode="contained"
                  style={[
                    homeStyles.countCard,
                    { backgroundColor: theme.colors.surfaceContainer },
                  ]}
                >
                  <Card.Content>
                    <Text variant="headlineSmall">{counts?.songCount ?? 0}</Text>
                    <Text
                      variant="bodyMedium"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      songs
                    </Text>
                  </Card.Content>
                </Card>
                <Card
                  mode="contained"
                  style={[
                    homeStyles.countCard,
                    { backgroundColor: theme.colors.surfaceContainer },
                  ]}
                >
                  <Card.Content>
                    <Text variant="headlineSmall">
                      {counts?.playlistCount ?? 0}
                    </Text>
                    <Text
                      variant="bodyMedium"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      playlists
                    </Text>
                  </Card.Content>
                </Card>
              </View>
            </View>
          )}
        </Surface>

        <Surface
          elevation={0}
          style={[
            homeStyles.sectionCard,
            { backgroundColor: theme.colors.surfaceContainerHighest },
          ]}
        >
          <Text variant="titleMedium">actions</Text>
          <Button
            mode="contained-tonal"
            icon="volume-high"
            onPress={playTestSound}
          >
            play test sound
          </Button>
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
        </Surface>
      </ScrollView>
    </Surface>
  );
}
