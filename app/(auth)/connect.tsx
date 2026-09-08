import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import {
  Button,
  ProgressBar,
  Snackbar,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

import { login, ping } from "@/services/api";
import { connectStyles } from "@/stylesheets";
import { ConnectStage } from "@/types";
import { APP_SHORT_NAME, APP_SUBTITLE } from "@/utils/constants";

export default function ConnectScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [serverUrl, setServerUrl] = useState("https://");
  const [loading, setLoading] = useState(false);
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

  const isConnectDisabled =
    loading ||
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
          {connectStage === "ping" ? (
            <Surface elevation={2} style={connectStyles.form}>
              <ProgressBar
                progress={0.5}
                color={theme.colors.primary}
                style={connectStyles.progressBar}
              />
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
                  disabled={loading}
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
            </Surface>
          ) : (
            <Surface elevation={2} style={connectStyles.form}>
              <ProgressBar
                progress={1}
                color={theme.colors.primary}
                style={connectStyles.progressBar}
              />
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
            </Surface>
          )}
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
