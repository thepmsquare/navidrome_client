import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import {
  Button,
  Chip,
  IconButton,
  RadioButton,
  Surface,
  Switch,
  Text,
  TextInput,
} from "react-native-paper";

import { exportBackupToFile } from "@/services/backup";
import { logout } from "@/services/session";
import {
  addServerUrl,
  getServerConnectionState,
  pingServerUrl,
  removeServerUrl,
  saveServerUrls,
  switchActiveServerUrl,
} from "@/services/connection";
import {
  getHomeSections,
  HOME_SECTION_LABELS,
  saveHomeSections,
} from "@/services/homeSections";
import type { ServerUrlItem } from "@/types/auth";
import type { HomeSectionConfig } from "@/types";
import {
  getAutoCacheCount,
  getAutoCacheEnabled,
  getAutoCacheMaxBytes,
  getAutoCacheTotalSize,
  getHapticsEnabled,
  getKeepPlayingOnAppDismissed,
  getScrobbleMinDuration,
  getScrobbleMinPercent,
  setAutoCacheEnabled,
  setAutoCacheMaxBytes,
  setHapticsEnabled,
  setScrobbleMinDuration,
  setScrobbleMinPercent,
} from "@/services/db";
import { triggerHapticSelection } from "@/utils/haptics";
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
import {
  checkLegacyOfflineCache,
  deleteLegacyOfflineCache,
} from "@/services/legacyCache";
import { ChangelogModal } from "@/components/ChangelogModal";
import { settingsStyles } from "@/stylesheets";
import { LyricsMode, useAppTheme } from "@/types";
import { useAudioOutputDevice } from "@/utils/audioOutput";
import { APP_VERSION, APP_VERSION_CODE } from "@/utils/constants";
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
  const [changelogVisible, setChangelogVisible] = useState(false);
  const [legacyCacheBytes, setLegacyCacheBytes] = useState(0);
  const [clearingLegacyCache, setClearingLegacyCache] = useState(false);

  const [serverUrls, setServerUrls] = useState<ServerUrlItem[]>([]);
  const [newServerUrl, setNewServerUrl] = useState("");
  const [newServerLabel, setNewServerLabel] = useState("");
  const [showAddServer, setShowAddServer] = useState(false);
  const [pingLatencies, setPingLatencies] = useState<
    Record<string, { latencyMs?: number; error?: string; testing?: boolean }>
  >({});
  const [homeSections, setHomeSections] = useState<HomeSectionConfig[]>([]);

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
  const [hapticsEnabled, setHapticsEnabledState] = useState(() =>
    getHapticsEnabled(),
  );
  const [lyricsMode, setLyricsModeState] = useState<LyricsMode>(() =>
    getLyricsMode(),
  );

  useEffect(() => {
    async function loadData() {
      const version = await SecureStore.getItemAsync("subsonicVersion");
      const url = await SecureStore.getItemAsync("serverUrl");
      const user = await SecureStore.getItemAsync("username");
      setSubsonicVersion(version);
      setServerUrl(url);
      setUsername(user);

      try {
        const conn = await getServerConnectionState();
        setServerUrls(conn.serverUrls);
        if (conn.activeUrl) {
          setServerUrl(conn.activeUrl);
        }
      } catch (e) {
        console.error("failed to load connection state in settings:", e);
      }

      try {
        const sections = await getHomeSections();
        setHomeSections(sections);
      } catch (e) {
        console.error("failed to load home sections in settings:", e);
      }

      try {
        const legacyCache = await checkLegacyOfflineCache();
        if (legacyCache.exists) {
          setLegacyCacheBytes(legacyCache.sizeBytes);
        }
      } catch (e) {
        console.error("failed to check legacy cache in settings:", e);
      }
    }

    loadData();
  }, []);

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

  function handleToggleHaptics(nextValue: boolean) {
    setHapticsEnabledState(nextValue);
    setHapticsEnabled(nextValue);
    if (nextValue) {
      triggerHapticSelection();
    }
  }

  async function handlePingUrl(targetUrl: string) {
    setPingLatencies((prev) => ({
      ...prev,
      [targetUrl]: { testing: true },
    }));

    try {
      const result = await pingServerUrl(targetUrl);
      setPingLatencies((prev) => ({
        ...prev,
        [targetUrl]: { latencyMs: result.latencyMs, testing: false },
      }));
    } catch {
      setPingLatencies((prev) => ({
        ...prev,
        [targetUrl]: { error: "unreachable", testing: false },
      }));
    }
  }

  function handlePingAll() {
    serverUrls.forEach((item) => {
      handlePingUrl(item.url);
    });
  }

  async function handleSwitchActiveUrl(target: ServerUrlItem) {
    try {
      await switchActiveServerUrl(target.url, target.label);
      setServerUrl(target.url);
      triggerHapticSelection();
      Alert.alert(
        "connection",
        `switched active server to ${target.label || target.url}`,
      );
    } catch (err: any) {
      Alert.alert("error", err?.message || "failed to switch active server");
    }
  }

  async function handleAddServerUrl() {
    if (!newServerUrl.trim()) {
      Alert.alert("error", "please enter a valid server url");
      return;
    }

    try {
      const updated = await addServerUrl(newServerUrl, newServerLabel);
      setServerUrls(updated);
      setNewServerUrl("");
      setNewServerLabel("");
      setShowAddServer(false);
      triggerHapticSelection();
    } catch (err: any) {
      Alert.alert("error", err?.message || "failed to add server url");
    }
  }

  function handleRemoveServerUrl(targetUrl: string) {
    Alert.alert(
      "remove server url",
      "are you sure you want to remove this server url?",
      [
        { text: "cancel", style: "cancel" },
        {
          text: "remove",
          style: "destructive",
          onPress: async () => {
            try {
              const updated = await removeServerUrl(targetUrl);
              setServerUrls(updated);
              triggerHapticSelection();
            } catch (err: any) {
              Alert.alert(
                "error",
                err?.message || "failed to remove server url",
              );
            }
          },
        },
      ],
    );
  }

  async function handleMoveServerUrl(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= serverUrls.length) return;

    const copy = [...serverUrls];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);

    setServerUrls(copy);
    await saveServerUrls(copy);
    triggerHapticSelection();
  }

  async function handleToggleSectionVisibility(id: string) {
    const updated = homeSections.map((sec) =>
      sec.id === id ? { ...sec, visible: !sec.visible } : sec,
    );
    setHomeSections(updated);
    await saveHomeSections(updated);
    triggerHapticSelection();
  }

  async function handleMoveSection(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= homeSections.length) return;

    const copy = [...homeSections];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);

    setHomeSections(copy);
    await saveHomeSections(copy);
    triggerHapticSelection();
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

  async function handleCleanLegacyCache() {
    Alert.alert(
      "delete legacy offline downloads",
      `delete ${formatSize(legacyCacheBytes)} of legacy downloads? this cannot be undone.`,
      [
        { text: "cancel", style: "cancel" },
        {
          text: "delete",
          style: "destructive",
          onPress: async () => {
            setClearingLegacyCache(true);
            try {
              const res = await deleteLegacyOfflineCache();
              if (res.success) {
                setLegacyCacheBytes(0);
                Alert.alert(
                  "success",
                  "legacy offline downloads removed successfully",
                );
              } else {
                Alert.alert(
                  "error",
                  "failed to delete legacy offline downloads",
                );
              }
            } catch (error: any) {
              Alert.alert(
                "error",
                error?.message || "failed to delete legacy offline downloads",
              );
            } finally {
              setClearingLegacyCache(false);
            }
          },
        },
      ],
    );
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
          <Text variant="titleMedium">account</Text>
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
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text variant="titleMedium">connection</Text>
            {serverUrls.length > 0 && (
              <Button mode="text" compact onPress={handlePingAll}>
                test all
              </Button>
            )}
          </View>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            manage server urls and test connectivity
          </Text>

          {serverUrls.map((item, index) => {
            const isActive = item.url === serverUrl;
            const pingStatus = pingLatencies[item.url];

            return (
              <Surface
                key={item.url}
                elevation={1}
                style={{
                  padding: spacing.md,
                  borderRadius: 12,
                  backgroundColor: theme.colors.surfaceContainerLow,
                  gap: spacing.xs,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ flex: 1, gap: 2, marginRight: spacing.sm }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.xs,
                      }}
                    >
                      <Text variant="titleSmall" style={{ fontWeight: "600" }}>
                        {item.label || "server url"}
                      </Text>
                      {isActive && (
                        <Chip compact textStyle={{ fontSize: 10 }}>
                          active
                        </Chip>
                      )}
                    </View>
                    <Text
                      variant="bodySmall"
                      numberOfLines={1}
                      ellipsizeMode="middle"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      {item.url}
                    </Text>
                  </View>

                  {pingStatus?.testing ? (
                    <Text
                      variant="labelSmall"
                      style={{ color: theme.colors.primary }}
                    >
                      pinging...
                    </Text>
                  ) : pingStatus?.latencyMs !== undefined ? (
                    <Text
                      variant="labelSmall"
                      style={{ color: theme.colors.primary }}
                    >
                      {pingStatus.latencyMs} ms
                    </Text>
                  ) : pingStatus?.error ? (
                    <Text
                      variant="labelSmall"
                      style={{ color: theme.colors.error }}
                    >
                      {pingStatus.error}
                    </Text>
                  ) : null}
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 4,
                    flexWrap: "wrap",
                  }}
                >
                  <IconButton
                    icon="arrow-up"
                    size={18}
                    disabled={index === 0}
                    onPress={() => handleMoveServerUrl(index, "up")}
                    accessibilityLabel="move up"
                  />
                  <IconButton
                    icon="arrow-down"
                    size={18}
                    disabled={index === serverUrls.length - 1}
                    onPress={() => handleMoveServerUrl(index, "down")}
                    accessibilityLabel="move down"
                  />
                  <Button
                    mode="outlined"
                    compact
                    loading={pingStatus?.testing}
                    onPress={() => handlePingUrl(item.url)}
                  >
                    test ping
                  </Button>
                  {!isActive && (
                    <Button
                      mode="contained-tonal"
                      compact
                      onPress={() => handleSwitchActiveUrl(item)}
                    >
                      set active
                    </Button>
                  )}
                  {!isActive && serverUrls.length > 1 && (
                    <IconButton
                      icon="delete-outline"
                      size={18}
                      iconColor={theme.colors.error}
                      onPress={() => handleRemoveServerUrl(item.url)}
                      accessibilityLabel="remove"
                    />
                  )}
                </View>
              </Surface>
            );
          })}

          {showAddServer ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
              <TextInput
                mode="outlined"
                label="server url"
                placeholder="http://..."
                value={newServerUrl}
                onChangeText={setNewServerUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                mode="outlined"
                label="label (optional)"
                placeholder="home wifi"
                value={newServerLabel}
                onChangeText={setNewServerLabel}
                autoCapitalize="none"
              />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: spacing.sm,
                }}
              >
                <Button mode="text" onPress={() => setShowAddServer(false)}>
                  cancel
                </Button>
                <Button mode="contained" onPress={handleAddServerUrl}>
                  add
                </Button>
              </View>
            </View>
          ) : (
            <Button
              mode="outlined"
              icon="plus"
              onPress={() => setShowAddServer(true)}
              style={{ marginTop: spacing.xs }}
            >
              add alternative url
            </Button>
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

        {legacyCacheBytes > 0 && (
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
                <Text variant="titleMedium">legacy offline downloads</Text>
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {formatSize(legacyCacheBytes)} of downloaded music from the previous version of the app. these downloads cannot be played in this version.
                </Text>
              </View>
            </View>

            <Button
              mode="contained-tonal"
              icon="delete-outline"
              textColor={theme.colors.error}
              onPress={handleCleanLegacyCache}
              loading={clearingLegacyCache}
              disabled={clearingLegacyCache}
            >
              delete legacy downloads
            </Button>
          </Surface>
        )}

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
          <Button
            mode="contained-tonal"
            icon="cloud-sync"
            onPress={() => router.push("/library/scrobbles")}
            style={{ marginTop: 4 }}
          >
            view pending scrobbles
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
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flex: 1, paddingRight: spacing.sm }}>
              <Text variant="titleMedium">haptic feedback</Text>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                tactile vibrations on touch and interactions
              </Text>
            </View>
            <Switch
              value={hapticsEnabled}
              onValueChange={handleToggleHaptics}
              accessibilityLabel="haptic feedback"
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
          <Text variant="titleMedium">home sections</Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            customize order and visibility of sections on the home screen
          </Text>

          {homeSections.map((section, index) => {
            const label = HOME_SECTION_LABELS[section.id] ?? section.id;
            return (
              <View
                key={section.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 2,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                  }}
                >
                  <Switch
                    value={section.visible}
                    onValueChange={() =>
                      handleToggleSectionVisibility(section.id)
                    }
                  />
                  <Text
                    variant="bodyMedium"
                    style={{
                      opacity: section.visible ? 1 : 0.5,
                    }}
                  >
                    {label}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <IconButton
                    icon="arrow-up"
                    size={18}
                    disabled={index === 0}
                    onPress={() => handleMoveSection(index, "up")}
                    accessibilityLabel="move up"
                  />
                  <IconButton
                    icon="arrow-down"
                    size={18}
                    disabled={index === homeSections.length - 1}
                    onPress={() => handleMoveSection(index, "down")}
                    accessibilityLabel="move down"
                  />
                </View>
              </View>
            );
          })}
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

        <Button
          mode="outlined"
          icon="history"
          onPress={() => setChangelogVisible(true)}
          accessibilityLabel={`view changelog, version ${APP_VERSION} (${APP_VERSION_CODE})`}
          style={{
            alignSelf: "center",
            borderRadius: 20,
            borderColor: theme.colors.outlineVariant,
            marginTop: spacing.xs,
          }}
          textColor={theme.colors.onSurfaceVariant}
        >
          {`version ${APP_VERSION} (${APP_VERSION_CODE}) • changelog`}
        </Button>

        <ChangelogModal
          visible={changelogVisible}
          onDismiss={() => setChangelogVisible(false)}
        />
      </ScrollView>
    </Surface>
  );
}
