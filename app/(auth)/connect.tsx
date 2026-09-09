import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useRef, useState } from "react";
import { Alert, Linking, ScrollView, View } from "react-native";
import {
  Button,
  Icon,
  IconButton,
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
  const [demoLoading, setDemoLoading] = useState(false);
  const [connectStage, setConnectStage] = useState<ConnectStage>("ping");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const passwordInputRef = useRef<any>(null);
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

  async function handleTryDemo() {
    setDemoLoading(true);
    const demoUrl = "https://demo.navidrome.org";
    const demoUser = "demo";
    const demoPass = "demo";

    try {
      const pingResponse = await ping(demoUrl);
      await SecureStore.setItemAsync("subsonicVersion", pingResponse.version);
      await SecureStore.setItemAsync("serverUrl", demoUrl);

      await login({
        serverUrl: demoUrl,
        username: demoUser,
        password: demoPass,
      });

      await SecureStore.setItemAsync("username", demoUser);
      await SecureStore.setItemAsync("password", demoPass);

      router.replace("/");
    } catch (error: any) {
      Alert.alert(
        "demo login failed",
        error?.message || "could not connect to demo server",
      );
    } finally {
      setDemoLoading(false);
    }
  }

  async function handleVisitWebsite() {
    try {
      await Linking.openURL("https://www.navidrome.org");
    } catch {
      Alert.alert("error", "could not open website");
    }
  }

  function handleLearnMore() {
    router.push("/learn-more");
  }

  const isConnectDisabled =
    loading ||
    importing ||
    demoLoading ||
    !serverUrl.trim() ||
    serverUrl.trim() === "https://" ||
    serverUrl.trim() === "http://";

  return (
    <Surface style={connectStyles.page}>
      <View style={connectStyles.helpButtonContainer}>
        <IconButton
          icon="help-circle-outline"
          size={24}
          onPress={handleLearnMore}
          accessibilityLabel="learn more"
        />
      </View>
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
                  autoComplete="url"
                  textContentType="URL"
                  keyboardType="url"
                  returnKeyType="go"
                  onSubmitEditing={handlePing}
                  autoFocus
                  left={<TextInput.Icon icon="server" />}
                  right={
                    serverUrl !== "https://" &&
                    serverUrl !== "http://" &&
                    serverUrl !== "" ? (
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
                    disabled={loading || importing || demoLoading}
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
                  disabled={loading || importing || demoLoading}
                  loading={importing}
                  icon="file-import"
                >
                  {importing ? "importing profile..." : "import profile"}
                </Button>
              </>
            ) : (
              <>
                <View style={connectStyles.serverInfoRow}>
                  <Icon
                    source="server"
                    size={18}
                    color={theme.colors.onSurfaceVariant}
                  />
                  <Text
                    variant="bodySmall"
                    numberOfLines={1}
                    ellipsizeMode="middle"
                    style={[
                      connectStyles.serverInfoText,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    {serverUrl}
                  </Text>
                </View>

                <TextInput
                  mode="outlined"
                  label="username"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  textContentType="username"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                  autoFocus
                  left={<TextInput.Icon icon="account" />}
                  right={
                    username ? (
                      <TextInput.Icon
                        icon="close-circle-outline"
                        onPress={() => setUsername("")}
                        accessibilityLabel="clear username"
                      />
                    ) : null
                  }
                />
                <TextInput
                  ref={passwordInputRef}
                  mode="outlined"
                  label="password"
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  textContentType="password"
                  secureTextEntry={!showPassword}
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                  left={<TextInput.Icon icon="lock" />}
                  right={
                    <TextInput.Icon
                      icon={showPassword ? "eye-off" : "eye"}
                      onPress={() => setShowPassword((prev) => !prev)}
                      accessibilityLabel={
                        showPassword ? "hide password" : "show password"
                      }
                    />
                  }
                />

                <Button
                  mode="contained"
                  onPress={handleLogin}
                  disabled={loading || demoLoading || !username.trim() || !password.trim()}
                  loading={loading}
                >
                  {loading ? "logging in..." : "login"}
                </Button>
                <Button
                  mode="text"
                  onPress={() => setConnectStage("ping")}
                  disabled={loading || demoLoading}
                  icon="arrow-left"
                >
                  change server url
                </Button>
              </>
            )}
          </Surface>
        </View>

        <View style={connectStyles.aboutGroup}>
          <Text variant="titleLarge">new to navidrome?</Text>
          <Surface elevation={2} style={connectStyles.aboutCard}>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              get started by exploring a live demo, learning how it works, or visiting the official website.
            </Text>
            <View style={connectStyles.aboutActions}>
              <Button
                mode="contained"
                icon="play-circle-outline"
                onPress={handleTryDemo}
                loading={demoLoading}
                disabled={loading || importing || demoLoading}
              >
                try demo
              </Button>
              <View style={connectStyles.aboutSecondaryRow}>
                <Button
                  mode="outlined"
                  icon="information-outline"
                  onPress={handleLearnMore}
                  disabled={loading || importing || demoLoading}
                  style={connectStyles.aboutSecondaryButton}
                >
                  learn more
                </Button>
                <Button
                  mode="outlined"
                  icon="web"
                  onPress={handleVisitWebsite}
                  disabled={loading || importing || demoLoading}
                  style={connectStyles.aboutSecondaryButton}
                >
                  visit website
                </Button>
              </View>
            </View>
          </Surface>
        </View>
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
