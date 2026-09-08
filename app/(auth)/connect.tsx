import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import {
  Button,
  Snackbar,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

import { ConnectProgress } from "@/components/ConnectProgress";

import { login, ping } from "@/services/api";
import { pickProfileFile } from "@/services/backup";
import { connectStyles } from "@/stylesheets";
import { ConnectStage } from "@/types";
import { APP_SHORT_NAME, APP_SUBTITLE } from "@/utils/constants";

export default function ConnectScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [serverUrl, setServerUrl] = useState("https://");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [connectStage, setConnectStage] = useState<ConnectStage>("ping");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  function showSnackbar(message: string) {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  }

  async function handlePaste() {
    try {
      const text = await Clipboard.getStringAsync();
      const trimmed = text?.trim();
      if (!trimmed) {
        showSnackbar("clipboard is empty");
        return;
      }
      if (/^https?:\/\//i.test(trimmed)) {
        setServerUrl(trimmed);
      } else {
        setServerUrl(`https://${trimmed}`);
      }
      showSnackbar("url pasted from clipboard");
    } catch (error: any) {
      showSnackbar(error?.message || "could not read clipboard");
    }
  }

  function handleClear() {
    setServerUrl("https://");
  }

  async function handlePing() {
    let targetUrl = serverUrl.trim();
    if (!targetUrl || targetUrl === "https://" || targetUrl === "http://") {
      Alert.alert("error", "please fill in all fields");
      return;
    }
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
      setServerUrl(targetUrl);
    }
    setLoading(true);

    try {
      let pingResponse = await ping(targetUrl);
      await SecureStore.setItemAsync("subsonicVersion", pingResponse.version);
      await SecureStore.setItemAsync("serverUrl", targetUrl);
      setConnectStage("login");
    } catch (error: any) {
      Alert.alert("ping failed", error.message || "could not ping");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (!username || !password) {
      Alert.alert("error", "please fill in all fields");
      return;
    }
    setLoading(true);

    try {
      await login({
        serverUrl,
        username,
        password,
      });
      await SecureStore.setItemAsync("username", username);
      await SecureStore.setItemAsync("password", password);
      router.replace("/");
    } catch (error: any) {
      Alert.alert("login failed", error.message || "could not login");
    } finally {
      setLoading(false);
    }
  }

  async function handleImportProfile() {
    try {
      const profile = await pickProfileFile();
      if (!profile) {
        return;
      }

      let targetUrl = profile.server_url.trim();
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = `https://${targetUrl}`;
      }

      setImporting(true);

      const pingResponse = await ping(targetUrl);
      await SecureStore.setItemAsync("subsonicVersion", pingResponse.version);
      await SecureStore.setItemAsync("serverUrl", targetUrl);

      await login({
        serverUrl: targetUrl,
        username: profile.username,
        password: profile.password,
      });

      await SecureStore.setItemAsync("username", profile.username);
      await SecureStore.setItemAsync("password", profile.password);

      if (profile.stop_playback_on_task_removed !== undefined) {
        await SecureStore.setItemAsync(
          "stop_playback_on_task_removed",
          String(profile.stop_playback_on_task_removed),
        );
      }

      if (profile.home_sections !== undefined) {
        await SecureStore.setItemAsync(
          "home_sections",
          JSON.stringify(profile.home_sections),
        );
      }

      router.replace("/");
    } catch (error: any) {
      Alert.alert(
        "import failed",
        error?.message || "could not import profile",
      );
    } finally {
      setImporting(false);
    }
  }

  const isConnectDisabled =
    loading ||
    importing ||
    !serverUrl.trim() ||
    serverUrl.trim() === "https://" ||
    serverUrl.trim() === "http://";

  return (
    <Surface style={connectStyles.page}>
      <ScrollView
        contentContainerStyle={connectStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={connectStyles.brandingGroup}>
          <Image
            source={require("@/assets/branding/foreground_layer_white.png")}
            style={connectStyles.icon}
            tintColor={theme.colors.primary}
            contentFit="contain"
            accessibilityLabel="app icon"
          />
          <View style={connectStyles.header}>
            <Text variant="headlineMedium" style={connectStyles.appName}>
              {APP_SHORT_NAME}
            </Text>
            <Text
              variant="bodyLarge"
              style={[
                connectStyles.appSubtitle,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {APP_SUBTITLE}
            </Text>
          </View>
        </View>

        <View style={connectStyles.formGroup}>
          <Text variant="titleLarge">connect to your server</Text>
          <Surface elevation={2} style={connectStyles.form}>
            <ConnectProgress
              stage={connectStage}
              loading={loading || importing}
            />
            {connectStage === "ping" ? (
              <>
                <TextInput
                  mode="outlined"
                  label="server url"
                  value={serverUrl}
                  onChangeText={setServerUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="go"
                  onSubmitEditing={handlePing}
                  autoFocus
                  left={<TextInput.Icon icon="web" />}
                  right={
                    serverUrl !== "https://" ? (
                      <TextInput.Icon
                        icon="close-circle-outline"
                        onPress={handleClear}
                        accessibilityLabel="clear"
                      />
                    ) : (
                      <TextInput.Icon
                        icon="content-paste"
                        onPress={handlePaste}
                        accessibilityLabel="paste from clipboard"
                      />
                    )
                  }
                />
                <View style={connectStyles.inputActionsRow}>
                  <Button
                    mode="text"
                    compact
                    icon="content-paste"
                    onPress={handlePaste}
                    disabled={loading || importing}
                  >
                    paste from clipboard
                  </Button>
                </View>
                <Button
                  mode="contained"
                  onPress={handlePing}
                  disabled={isConnectDisabled}
                  loading={loading}
                >
                  {loading ? "connecting..." : "connect"}
                </Button>
                <Button
                  mode="outlined"
                  onPress={handleImportProfile}
                  disabled={loading || importing}
                  loading={importing}
                  icon="file-import"
                >
                  {importing ? "importing profile..." : "import profile"}
                </Button>
              </>
            ) : (
              <>
                <TextInput
                  label="username"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
                <TextInput
                  label="password"
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  secureTextEntry
                />

                <Button
                  mode="contained"
                  onPress={handleLogin}
                  disabled={loading || !username.trim() || !password.trim()}
                  loading={loading}
                >
                  {loading ? "logging in..." : "login"}
                </Button>
                <Button
                  mode="text"
                  onPress={() => setConnectStage("ping")}
                  disabled={loading}
                  icon="arrow-left"
                >
                  change server url
                </Button>
              </>
            )}
          </Surface>
        </View>

        <View
          style={[
            connectStyles.dummyGroup,
            { backgroundColor: theme.colors.primary },
          ]}
        />
      </ScrollView>
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={2500}
      >
        {snackbarMessage}
      </Snackbar>
    </Surface>
  );
}
