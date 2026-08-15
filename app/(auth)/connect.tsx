import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useState } from "react";
import { Alert, View } from "react-native";
import {
  Button,
  MD3Colors,
  ProgressBar,
  Surface,
  Text,
  TextInput,
} from "react-native-paper";

import { login, ping } from "@/services/api";
import { connectStyles } from "@/stylesheets";
import { ConnectStage } from "@/types";

export default function ConnectScreen() {
  const router = useRouter();
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
      let loginResponse = await login({
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
      <Text variant="displaySmall">connect / login screen</Text>
      {connectStage === "ping" ? (
        <Surface elevation={2} style={connectStyles.form}>
          <View>
            <ProgressBar progress={0.5} color={MD3Colors.error50} />
          </View>
          <TextInput
            label="server url"
            value={serverUrl}
            onChangeText={setServerUrl}
            autoCapitalize="none"
          />
          <Button mode="contained" onPress={handlePing} disabled={loading}>
            {loading ? "loading..." : "ping"}
          </Button>
        </Surface>
      ) : (
        <Surface elevation={2} style={connectStyles.form}>
          <View>
            <ProgressBar progress={0.99} color={MD3Colors.error50} />
          </View>
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
    </Surface>
  );
}
