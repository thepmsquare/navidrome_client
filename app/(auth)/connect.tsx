import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import {
  Button,
  ProgressBar,
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
  const [serverUrl, setServerUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [connectStage, setConnectStage] = useState<ConnectStage>("ping");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function handlePing() {
    if (!serverUrl) {
      Alert.alert("error", "please fill in all fields");
      return;
    }
    setLoading(true);

    try {
      let pingResponse = await ping(serverUrl);
      await SecureStore.setItemAsync("subsonicVersion", pingResponse.version);
      await SecureStore.setItemAsync("serverUrl", serverUrl);
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
                label="server url"
                value={serverUrl}
                onChangeText={setServerUrl}
                autoCapitalize="none"
              />
              <Button mode="contained" onPress={handlePing} disabled={loading}>
                {loading ? "loading..." : "next"}
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

              <Button mode="contained" onPress={handleLogin} disabled={loading}>
                {loading ? "loading..." : "login"}
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
    </Surface>
  );
}
