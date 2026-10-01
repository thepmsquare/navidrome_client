import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  RadioButton,
  Surface,
  Switch,
  Text,
  TextInput,
} from "react-native-paper";

import { client_app_sync, logout } from "@/services/api";
import { exportBackupToFile } from "@/services/backup";
import {
  getAutoCacheCount,
  getAutoCacheEnabled,
  getAutoCacheMaxBytes,
  getAutoCacheTotalSize,
  getKeepPlayingOnAppDismissed,
  getLocalCounts,
  getScrobbleMinDuration,
  getScrobbleMinPercent,
  setAutoCacheEnabled,
  setAutoCacheMaxBytes,
  setScrobbleMinDuration,
  setScrobbleMinPercent,
} from "@/services/db";
import {
  getLyricsMode,
  setLyricsMode,
  subscribeLyricsMode,
} from "@/services/lyrics";
import {
  playTestSound,
  updateKeepPlayingOnAppDismissed,
  usePlayerState,
} from "@/services/player";
import { clearAllAutoCachedSongs } from "@/services/songCache";
import { settingsStyles } from "@/stylesheets";
import { LyricsMode, Search3Counts, useAppTheme } from "@/types";
import { useAudioOutputDevice } from "@/utils/audioOutput";
import { ANDROID_VERSION_CODE, APP_VERSION } from "@/utils/constants";
import { spacing } from "@/utils/spacing";

function formatSize(bytes: number): string {
  if (bytes <= 0) return "0 b";
  const gib = bytes / (1024 * 1024 * 1024);
  if (gib >= 1) {
    return `${gib.toFixed(2)} gib`;
  }
  const mib = bytes / (1024 * 1024);
  if (mib >= 1) {
    return `${mib.toFixed(1)} mib`;
  }
  const kib = bytes / 1024;
  return `${kib.toFixed(1)} kib`;
}

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const audioDevice = useAudioOutputDevice();
  const { isPlaying } = usePlayerState();
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

  const [exporting, setExporting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [autoCacheLimitText, setAutoCacheLimitText] = useState(() => {
    const bytes = getAutoCacheMaxBytes();
    const gib = bytes / (1024 * 1024 * 1024);
    return Number.isInteger(gib) ? gib.toString() : gib.toFixed(2);
  });
  const [autoCacheUsageBytes, setAutoCacheUsageBytes] = useState(() =>
    getAutoCacheTotalSize(),
  );
  const [autoCacheEnabled, setAutoCacheEnabledState] = useState(() =>
    getAutoCacheEnabled(),
  );
  const [clearingAutoCache, setClearingAutoCache] = useState(false);
  const [scrobbleMinDurationText, setScrobbleMinDurationText] = useState(() =>
    String(getScrobbleMinDuration()),
  );
  const [scrobbleMinPercentText, setScrobbleMinPercentText] = useState(() =>
    String(getScrobbleMinPercent()),
  );
  const [keepPlayingOnAppDismissed, setKeepPlayingOnAppDismissedState] = useState(() =>
    getKeepPlayingOnAppDismissed(),
  );
  const [lyricsMode, setLyricsModeState] = useState<LyricsMode>(() =>
    getLyricsMode(),
  );

  useEffect(() => {
    return subscribeLyricsMode((mode) => {
      setLyricsModeState(mode);
    });
  }, []);

  function handleLyricsModeChange(mode: LyricsMode) {
    setLyricsMode(mode);
  }

  async function handleToggleKeepPlaying(nextValue: boolean) {
    setKeepPlayingOnAppDismissedState(nextValue);
    await updateKeepPlayingOnAppDismissed(nextValue);
  }


  async function handleToggleAutoCache(nextValue: boolean) {
    if (nextValue) {
      setAutoCacheEnabled(true);
      setAutoCacheEnabledState(true);
      return;
    }

    // Toggling off: check if any songs are currently auto-cached
    const count = getAutoCacheCount();
    const usage = getAutoCacheTotalSize();

    if (count > 0) {
      Alert.alert(
        "turn off automatically make available offline",
        `turn off automatically make available offline? this will remove ${count} offline song(s) (${formatSize(usage)}) from your device.`,
        [
          {
            text: "cancel",
            style: "cancel",
          },
          {
            text: "turn off",
            style: "destructive",
            onPress: async () => {
              setClearingAutoCache(true);
              try {
                setAutoCacheEnabled(false);
                setAutoCacheEnabledState(false);
                await clearAllAutoCachedSongs();
                setAutoCacheUsageBytes(0);
              } catch (error: any) {
                Alert.alert("error", error?.message || "failed to remove offline songs");
              } finally {
                setClearingAutoCache(false);
              }
            },
          },
        ],
        { cancelable: true },
      );
    } else {
      setAutoCacheEnabled(false);
      setAutoCacheEnabledState(false);
      setAutoCacheUsageBytes(0);
    }
  }

  function handleLimitChange(text: string) {
    setAutoCacheLimitText(text);
    const parsed = parseFloat(text);
    if (!isNaN(parsed) && parsed > 0) {
      const bytes = Math.round(parsed * 1024 * 1024 * 1024);
      setAutoCacheMaxBytes(bytes);
    }
  }

  function handleLimitBlur() {
    const parsed = parseFloat(autoCacheLimitText);
    if (isNaN(parsed) || parsed <= 0) {
      const currentGb = getAutoCacheMaxBytes() / (1024 * 1024 * 1024);
      setAutoCacheLimitText(String(currentGb));
    }
  }

  function handleScrobbleDurationChange(text: string) {
    setScrobbleMinDurationText(text);
    const parsed = parseInt(text, 10);
    if (!isNaN(parsed) && parsed >= 10) {
      setScrobbleMinDuration(parsed);
    }
  }

  function handleScrobbleDurationBlur() {
    const parsed = parseInt(scrobbleMinDurationText, 10);
    if (isNaN(parsed) || parsed < 10) {
      setScrobbleMinDurationText(String(getScrobbleMinDuration()));
    }
  }

  function handleScrobblePercentChange(text: string) {
    setScrobbleMinPercentText(text);
    const parsed = parseInt(text, 10);
    if (!isNaN(parsed) && parsed >= 5 && parsed <= 100) {
      setScrobbleMinPercent(parsed);
    }
  }

  function handleScrobblePercentBlur() {
    const parsed = parseInt(scrobbleMinPercentText, 10);
    if (isNaN(parsed) || parsed < 5 || parsed > 100) {
      setScrobbleMinPercentText(String(getScrobbleMinPercent()));
    }
  }

  const parsedNum = parseFloat(autoCacheLimitText);
  const parsedLimitBytes =
    !isNaN(parsedNum) && parsedNum > 0
      ? Math.round(parsedNum * 1024 * 1024 * 1024)
      : getAutoCacheMaxBytes();

  async function performLogout() {
    setLoggingOut(true);
    try {
      await logout();
      router.replace("/connect");
    } catch (error: any) {
      Alert.alert("error", error?.message || "failed to log out");
    } finally {
      setLoggingOut(false);
    }
  }

  function handleLogout() {
    Alert.alert(
      "log out",
      "are you sure you want to log out?",
      [
        {
          text: "cancel",
          style: "cancel",
        },
        {
          text: "log out",
          style: "destructive",
          onPress: performLogout,
        },
      ],
      { cancelable: true },
    );
  }

  async function handleExport() {
    setExporting(true);
    try {
      const result = await exportBackupToFile();
      if (result.success) {
        Alert.alert("success", "backup exported successfully");
      } else if (!result.cancelled) {
        Alert.alert("error", result.error || "failed to export backup");
      }
    } catch (error: any) {
      Alert.alert("error", error?.message || "failed to export backup");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Surface style={settingsStyles.page}>
      <ScrollView contentContainerStyle={settingsStyles.scrollContent}>
        <Text variant="titleLarge">settings</Text>

        <Surface
          elevation={0}
          style={[
            settingsStyles.sectionCard,
            { backgroundColor: theme.colors.surfaceContainerHighest },
          ]}
        >
          <Text variant="titleMedium">connection</Text>
          <View style={settingsStyles.infoRow}>
            <Text
              variant="labelLarge"
              style={[
                settingsStyles.infoLabel,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              username
            </Text>
            <Text variant="bodyMedium" style={settingsStyles.infoValue}>
              {username}
            </Text>
          </View>
          <View style={settingsStyles.infoRow}>
            <Text
              variant="labelLarge"
              style={[
                settingsStyles.infoLabel,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              server
            </Text>
            <Text
              variant="bodyMedium"
              style={settingsStyles.infoValue}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {serverUrl}
            </Text>
          </View>
          <View style={settingsStyles.infoRow}>
            <Text
              variant="labelLarge"
              style={[
                settingsStyles.infoLabel,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              subsonic version
            </Text>
            <Text variant="bodyMedium" style={settingsStyles.infoValue}>
              {subsonicVersion}
            </Text>
          </View>
          <View style={settingsStyles.infoRow}>
            <Text
              variant="labelLarge"
              style={[
                settingsStyles.infoLabel,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              audio output
            </Text>
            <Text variant="bodyMedium" style={settingsStyles.infoValue}>
              {audioDevice.name} ({audioDevice.type})
            </Text>
          </View>
        </Surface>

        <Surface
          elevation={0}
          style={[
            settingsStyles.sectionCard,
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
            <View style={settingsStyles.loadingRow}>
              <ActivityIndicator size="small" />
              <Text variant="bodySmall">syncing library...</Text>
            </View>
          ) : (
            <View style={settingsStyles.countsContainer}>
              <View style={settingsStyles.countsRow}>
                <Card
                  mode="contained"
                  style={[
                    settingsStyles.countCard,
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
                    settingsStyles.countCard,
                    { backgroundColor: theme.colors.surfaceContainer },
                  ]}
                >
                  <Card.Content>
                    <Text variant="headlineSmall">
                      {counts?.albumCount ?? 0}
                    </Text>
                    <Text
                      variant="bodyMedium"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      albums
                    </Text>
                  </Card.Content>
                </Card>
              </View>
              <View style={settingsStyles.countsRow}>
                <Card
                  mode="contained"
                  style={[
                    settingsStyles.countCard,
                    { backgroundColor: theme.colors.surfaceContainer },
                  ]}
                >
                  <Card.Content>
                    <Text variant="headlineSmall">
                      {counts?.songCount ?? 0}
                    </Text>
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
                    settingsStyles.countCard,
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
            settingsStyles.sectionCard,
            { backgroundColor: theme.colors.surfaceContainerHighest },
          ]}
        >
          <Text variant="titleMedium">actions</Text>
          <Button
            mode="contained-tonal"
            icon="volume-high"
            onPress={playTestSound}
            disabled={isPlaying}
          >
            play test sound {isPlaying && "(disabled while music is playing)"}
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

        <Surface
          elevation={0}
          style={[
            settingsStyles.sectionCard,
            { backgroundColor: theme.colors.surfaceContainerHighest },
          ]}
        >
          <Text variant="titleMedium">data</Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            export your server connection details and preferences as a backup
            file. you can import this on another device from the connect screen.
          </Text>
          <Button
            mode="outlined"
            onPress={handleExport}
            loading={exporting}
            disabled={exporting || loggingOut}
            icon="file-export"
          >
            export profile
          </Button>
        </Surface>

        <Surface
          elevation={0}
          style={[
            settingsStyles.sectionCard,
            { backgroundColor: theme.colors.surfaceContainerHighest },
          ]}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flex: 1, paddingRight: spacing.sm }}>
              <Text variant="titleMedium">automatically make available offline</Text>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                automatically make songs available offline while streaming
              </Text>
            </View>
            <Switch
              value={autoCacheEnabled}
              onValueChange={handleToggleAutoCache}
              disabled={clearingAutoCache}
            />
          </View>

          <Text
            variant="bodyMedium"
            style={{
              color: autoCacheEnabled
                ? theme.colors.onSurfaceVariant
                : theme.colors.outline,
            }}
          >
            used: {formatSize(autoCacheUsageBytes)} / {formatSize(parsedLimitBytes)}
          </Text>

          <TextInput
            mode="outlined"
            label="limit in gib"
            value={autoCacheLimitText}
            onChangeText={handleLimitChange}
            onBlur={handleLimitBlur}
            keyboardType="decimal-pad"
            disabled={!autoCacheEnabled || clearingAutoCache}
          />
        </Surface>

        <Surface
          elevation={0}
          style={[
            settingsStyles.sectionCard,
            { backgroundColor: theme.colors.surfaceContainerHighest },
          ]}
        >
          <Text variant="titleMedium">scrobble</Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            scrobble is submitted when either threshold is met
          </Text>

          <TextInput
            mode="outlined"
            label="min duration (seconds)"
            value={scrobbleMinDurationText}
            onChangeText={handleScrobbleDurationChange}
            onBlur={handleScrobbleDurationBlur}
            keyboardType="number-pad"
          />

          <TextInput
            mode="outlined"
            label="min percent (5–100)"
            value={scrobbleMinPercentText}
            onChangeText={handleScrobblePercentChange}
            onBlur={handleScrobblePercentBlur}
            keyboardType="number-pad"
          />
        </Surface>

        <Surface
          elevation={0}
          style={[
            settingsStyles.sectionCard,
            { backgroundColor: theme.colors.surfaceContainerHighest },
          ]}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flex: 1, paddingRight: spacing.sm }}>
              <Text variant="titleMedium">playback</Text>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                continue playback when app is closed
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.outline, marginTop: spacing.xs }}
              >
                keep audio playing when the app is swiped away from the app switcher
              </Text>
            </View>
            <Switch
              value={keepPlayingOnAppDismissed}
              onValueChange={handleToggleKeepPlaying}
            />
          </View>
        </Surface>

        <Surface
          elevation={0}
          style={[
            settingsStyles.sectionCard,
            { backgroundColor: theme.colors.surfaceContainerHighest },
          ]}
        >
          <Text variant="titleMedium">lyrics</Text>
          <RadioButton.Group
            onValueChange={(val) => handleLyricsModeChange(val as LyricsMode)}
            value={lyricsMode}
          >
            <Pressable
              onPress={() => handleLyricsModeChange("file_only")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: spacing.xs,
              }}
              accessibilityRole="radio"
              accessibilityLabel="library only"
            >
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <Text variant="bodyLarge">library only</Text>
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  uses lyrics from your server. nothing is sent online.
                </Text>
              </View>
              <RadioButton.Android value="file_only" />
            </Pressable>

            <Pressable
              onPress={() => handleLyricsModeChange("file_first")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: spacing.xs,
              }}
              accessibilityRole="radio"
              accessibilityLabel="library, then online"
            >
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <Text variant="bodyLarge">library, then online</Text>
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {"uses server lyrics, and looks online when they're missing or not synced."}
                </Text>
              </View>
              <RadioButton.Android value="file_first" />
            </Pressable>

            <Pressable
              onPress={() => handleLyricsModeChange("online_first")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: spacing.xs,
              }}
              accessibilityRole="radio"
              accessibilityLabel="online first"
            >
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <Text variant="bodyLarge">online first</Text>
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  looks online first, uses server lyrics as backup.
                </Text>
              </View>
              <RadioButton.Android value="online_first" />
            </Pressable>
          </RadioButton.Group>

          <Text
            variant="bodySmall"
            style={{ color: theme.colors.outline, marginTop: spacing.xs }}
          >
            {"online lookups send the song's title, artist, album and duration to lrclib.net."}
          </Text>
        </Surface>

        <Surface
          elevation={0}
          style={[
            settingsStyles.sectionCard,
            { backgroundColor: theme.colors.surfaceContainerHighest },
          ]}
        >
          <Text variant="titleMedium">account</Text>

          <Button
            mode="outlined"
            onPress={handleLogout}
            loading={loggingOut}
            disabled={loggingOut}
            textColor={theme.colors.error}
            style={{ borderColor: theme.colors.error }}
          >
            log out
          </Button>
        </Surface>

        <Text
          variant="bodySmall"
          style={{
            textAlign: "center",
            color: theme.colors.outline,
          }}
        >
          {`version ${APP_VERSION} (${ANDROID_VERSION_CODE})`}
        </Text>
      </ScrollView>
    </Surface>
  );
}
