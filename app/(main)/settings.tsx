import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { Button, Surface, Switch, Text, TextInput } from "react-native-paper";

import { logout } from "@/services/api";
import { exportBackupToFile } from "@/services/backup";
import {
  getAutoCacheCount,
  getAutoCacheEnabled,
  getAutoCacheMaxBytes,
  getAutoCacheTotalSize,
  getKeepPlayingOnAppDismissed,
  getScrobbleMinDuration,
  getScrobbleMinPercent,
  setAutoCacheEnabled,
  setAutoCacheMaxBytes,
  setScrobbleMinDuration,
  setScrobbleMinPercent,
} from "@/services/db";
import { updateKeepPlayingOnAppDismissed } from "@/services/player";
import { clearAllAutoCachedSongs } from "@/services/songCache";
import { settingsStyles } from "@/stylesheets";
import { useAppTheme } from "@/types";
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
        "turn off auto-cache",
        `turn off auto-cache? this will remove ${count} auto-cached song(s) (${formatSize(usage)}) from your device.`,
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
                Alert.alert("error", error?.message || "failed to clear auto-cache");
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
              <Text variant="titleMedium">auto-cache</Text>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                automatically cache songs while streaming
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
      </ScrollView>
    </Surface>
  );
}
